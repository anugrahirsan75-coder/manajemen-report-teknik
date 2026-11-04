/**
 * Terima SPPB/J dari Excel, lewat dua pintu yang berakhir di tempat yang sama:
 *
 *   · JSON     - dari tombol di dalam berkas Excel; isinya sel lembar yang terbuka.
 *   · formData - dari halaman web; berkas .xlsx/.xlsm diunggah utuh.
 *
 * Route ini ada di balik gerbang login biasa (lihat middleware), jadi tidak ada
 * jalur baru yang terbuka untuk umum. Tombol Excel masuk memakai akun aplikasi
 * dan membawa cookie sesi yang sama dengan peramban, sehingga tak ada kunci
 * rahasia yang perlu ditanam di berkas Excel - berkasnya boleh berpindah laptop
 * dan dikirim ke orang lain. Akun SCM tertahan di middleware.
 *
 * Dua langkah: "cek" hanya membaca dan menjawab apa yang akan terjadi, "kirim"
 * menulis. Pemakai melihat ringkasannya dulu, karena satu klik di sini menulis
 * ke data yang dipakai dashboard anggaran dan rekap.
 *
 * Route ini hanya MENAMBAH catatan baru. Yang sudah masuk aplikasi tidak pernah
 * diubah, diganti, atau dihapus dari sini: mengganti isinya berarti membuang
 * item lama, dan keputusan itu hanya boleh diambil pemiliknya di aplikasi.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbServer, dbSiap } from "@/lib/dbServer";
import { bacaLembar, HasilLembar, JenisKirim, LembarExcel } from "@/lib/sppbj/dariExcel";
import { bacaBerkasExcel } from "@/lib/sppbj/bacaBerkasExcel";
import { buildRekapRow } from "@/lib/sppbj/rekapBaris";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
const kunci = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const bacaJenis = (v: unknown): JenisKirim | undefined => (v === "rutin" || v === "docking" ? v : undefined);

interface Tersimpan { id: string; no: string | null; nama: string | null; tgl: string | null }

interface Temuan {
  /** catatan yang memang pengadaan ini */
  sama: Tersimpan | null;
  /** pengadaan LAIN yang memakai nomor ini */
  nomorDipakai: Tersimpan | null;
  /** pengadaan lain bernama sama di bulan yang sama, beda nomor */
  namaKembar: Tersimpan | null;
}

/**
 * Cari catatan yang sama, supaya satu lembar tidak masuk dua kali. Nomor saja
 * tidak cukup: lembar sering disalin dari pengadaan sebelumnya dan nomornya ikut
 * terbawa, padahal pengadaannya lain. Dua lembar dianggap sama hanya kalau
 * namanya sama dan nomornya sama, atau namanya sama di bulan yang sama sementara
 * salah satunya belum bernomor. Selain itu lembar masuk sebagai catatan baru.
 */
async function cariTersimpan(c: ReturnType<typeof dbServer>, req: HasilLembar["req"]): Promise<Temuan> {
  const { data, error } = await c!.from("projects")
    .select("id,no:payload->>noSPPBJ,nama:payload->>namaPengadaan,tgl:payload->>tanggal")
    .filter("payload->>kind", "eq", "sppbj");
  if (error) throw new Error(error.message);
  const baris = (data || []) as unknown as Tersimpan[];
  const no = kunci(req.noSPPBJ);
  const bulan = (req.tanggal || "").slice(0, 7);
  const namaSama = baris.filter((d) => kunci(d.nama) === kunci(req.namaPengadaan));
  const bulanSama = (d: Tersimpan) => (d.tgl || "").slice(0, 7) === bulan;
  const sama = (no && namaSama.find((d) => kunci(d.no) === no))
    || namaSama.find((d) => bulanSama(d) && (!no || !kunci(d.no)))
    || null;
  return {
    sama,
    nomorDipakai: (no && baris.find((d) => kunci(d.no) === no && d.id !== sama?.id)) || null,
    namaKembar: sama ? null : namaSama.find(bulanSama) || null,
  };
}

function ringkasan(h: HasilLembar, tampilKategori: boolean): string[] {
  const r = h.req;
  const baris = [
    `Nama     : ${r.namaPengadaan}`,
    `No       : ${r.noSPPBJ || "(kosong)"}    Tanggal: ${r.tanggal}`,
    `DRP      : ${r.noDRP || "(kosong)"}`,
    ...(tampilKategori ? [`Kategori : ${r.kategoriRekap ? r.kategoriRekap + " (tebakan, periksa)" : "(kosong)"}`] : []),
    `Item     : ${h.ringkas.item} item, ${h.ringkas.kapal.join(", ") || "tanpa kapal"}`,
    `Nilai    : ${rupiah(h.ringkas.jumlah)} (belum PPN)`,
    "Mata Anggaran:",
    ...h.ringkas.perMa.map((m) => `  ${m.ma.slice(0, 44)}: ${m.item} item, ${rupiah(m.nilai)}`),
  ];
  if (h.catatan.length) {
    baris.push("", "Perlu dilihat:");
    // kotak pesan Excel memotong teks di sekitar 1.024 huruf
    h.catatan.slice(0, 5).forEach((c) => baris.push("  - " + c.slice(0, 150)));
    if (h.catatan.length > 5) baris.push(`  - dan ${h.catatan.length - 5} catatan lain`);
  }
  return baris;
}

/** Teruskan ke spreadsheet rekap. Gagal di sini tidak membatalkan simpan. */
async function keRekap(req: any): Promise<string> {
  const url = process.env.REKAP_GAS_URL;
  if (!url) return "";
  if (!String(req.noPRSAP || req.noSPPBJ || "").trim()) return "Rekap: menunggu No. SPPB/J.";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.REKAP_GAS_SECRET || "", rows: [buildRekapRow(req)] }),
      redirect: "follow",
    });
    const data = await res.json().catch(() => ({} as any));
    const r = data?.results?.[0];
    if (!res.ok || data?.ok === false || r?.error) return "Rekap GAGAL; kirim ulang dari aplikasi.";
    return `Rekap: tab ${r?.sheet || "-"} (${r?.action === "append" ? "baris baru" : "diperbarui"}).`;
  } catch {
    return "Rekap GAGAL; kirim ulang dari aplikasi.";
  }
}

interface Jawab {
  lembar: string;
  kode: "SIAP" | "TERKIRIM" | "GAGAL" | "TERKUNCI";
  id?: string;
  pesan: string;
  ringkas?: HasilLembar["ringkas"];
  namaPengadaan?: string;
  catatan?: string[];
}

interface OpsiOlah {
  aksi: string;
  jenis?: JenisKirim;
  /** pengirim bisa memilih Rutin/Docking; salinan makro pertama belum bisa */
  bisaPilih: boolean;
}

async function olah(lembar: LembarExcel, o: OpsiOlah): Promise<Jawab> {
  const h = bacaLembar(lembar, { jenis: o.jenis, akanDipilih: o.bisaPilih });
  const dasar = { lembar: lembar.nama, ringkas: h.ringkas, namaPengadaan: h.req.namaPengadaan, catatan: h.catatan };
  if (h.masalah.length) {
    return { ...dasar, kode: "GAGAL", pesan: ["Belum bisa dikirim:", ...h.masalah.map((m) => "  - " + m)].join("\n") };
  }
  const c = dbServer()!;
  const { sama: ada, nomorDipakai, namaKembar } = await cariTersimpan(c, h.req);
  if (ada) {
    return {
      ...dasar, kode: "TERKUNCI", id: ada.id,
      pesan: [`"${h.req.namaPengadaan}" sudah ada di aplikasi, jadi tidak diubah dan tidak ditimpa.`,
        "Kalau mau diganti: ubah di aplikasi, atau hapus dulu di aplikasi lalu kirim lagi."].join("\n"),
    };
  }
  if (namaKembar) {
    h.catatan.unshift(`PERIKSA: nama ini sudah ada bulan ini dengan No. ${namaKembar.no}. Lembar ini masuk sebagai pengadaan baru.`);
  }
  if (nomorDipakai) {
    h.catatan.unshift(`PERIKSA: No. ${h.req.noSPPBJ} sudah dipakai "${(nomorDipakai.nama || "").slice(0, 60)}". Data itu tidak disentuh dan rekap dilewati. Kalau nomornya salah, perbaiki di lembar.`);
  }

  if (o.aksi !== "kirim") {
    const baris = ["Kirim SPPBJ ini ke aplikasi?", "", ...ringkasan(h, !o.bisaPilih)];
    if (!o.bisaPilih) baris.push("", "Berkas Excel ini versi lama: belum ada pilihan Rutin/Docking. Pakai templat terbaru.");
    return { ...dasar, kode: "SIAP", pesan: baris.join("\n") };
  }

  if (o.bisaPilih && !o.jenis) {
    return { ...dasar, kode: "GAGAL", pesan: "Pilih Rutin atau Docking dulu." };
  }

  const payload = { ...h.req, kind: "sppbj", sumberInput: "excel" };
  const { data, error } = await c.from("projects")
    .insert({ nama_kapal: h.req.namaPengadaan, tahun: parseInt((h.req.tanggal || "").slice(0, 4), 10) || null, payload })
    .select("id").single();
  if (error) throw new Error(error.message);

  // rekap memakai nomor sebagai kunci baris: nomor kembar akan menimpa baris pengadaan lain
  const rekap = nomorDipakai
    ? `Rekap dilewati: No. ${h.req.noSPPBJ} dipakai pengadaan lain.`
    : await keRekap(payload);
  return {
    ...dasar, kode: "TERKIRIM", id: data?.id,
    pesan: [`Masuk ke aplikasi: ${h.req.namaPengadaan}`,
      `${h.req.jenisAnggaran || ""}, ${h.ringkas.item} item, ${rupiah(h.ringkas.jumlah)}.`, rekap].filter(Boolean).join("\n"),
  };
}

const teksExcel = (kode: string, pesan: string, status = 200) =>
  new NextResponse(`${kode}\n${pesan}`, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function POST(req: NextRequest) {
  const dariExcel = req.headers.get("x-klien") === "excel";
  const gagal = (pesan: string, status: number) => (dariExcel
    ? teksExcel("GAGAL", pesan, 200)
    : NextResponse.json({ ok: false, error: pesan }, { status }));

  if (!dbSiap()) return gagal("Sumber data belum siap.", 503);
  try {
    if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
      const form = await req.formData();
      const berkas = form.get("berkas");
      if (!(berkas instanceof File)) return gagal("Berkas tidak ada.", 400);
      if (!/\.xls[xm]$/i.test(berkas.name)) return gagal("Hanya berkas .xlsx atau .xlsm.", 400);
      const pilih: string[] | null = JSON.parse(String(form.get("pilih") || "null"));
      const jenis: Record<string, unknown> = JSON.parse(String(form.get("jenis") || "{}"));
      const aksi = String(form.get("aksi") || "cek");
      const lembar = await bacaBerkasExcel(await berkas.arrayBuffer(), berkas.name);
      if (!lembar.length) return gagal("Tidak ada lembar SPPB/J di berkas ini.", 400);
      const hasil: Jawab[] = [];
      for (const l of lembar) {
        if (!pilih || pilih.includes(l.nama)) hasil.push(await olah(l, { aksi, jenis: bacaJenis(jenis[l.nama]), bisaPilih: true }));
      }
      return NextResponse.json({ ok: true, hasil });
    }

    const body = await req.json();
    const lembar: LembarExcel | undefined = body?.lembar;
    if (!lembar || !Array.isArray(lembar.baris)) return gagal("Isi lembar tidak terbaca.", 400);
    const hasil = await olah(lembar, {
      aksi: String(body.aksi || "cek"), jenis: bacaJenis(body.jenis), bisaPilih: Number(body.versi) >= 2,
    });
    return dariExcel ? teksExcel(hasil.kode, hasil.pesan) : NextResponse.json({ ok: true, hasil: [hasil] });
  } catch (e: any) {
    return gagal("Gagal memproses: " + (e?.message || e), 500);
  }
}
