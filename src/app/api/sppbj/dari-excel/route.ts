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
 */
import { NextRequest, NextResponse } from "next/server";
import { dbServer, dbSiap } from "@/lib/dbServer";
import { bacaLembar, gabungKeTersimpan, HasilLembar, LembarExcel } from "@/lib/sppbj/dariExcel";
import { bacaBerkasExcel } from "@/lib/sppbj/bacaBerkasExcel";
import { buildRekapRow } from "@/lib/sppbj/rekapBaris";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
const kunci = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

interface Tersimpan { id: string; no: string | null; nama: string | null; tgl: string | null; status: string | null }

/**
 * Cari catatan yang sama: nomor SPPB/J dulu. Nama + bulan hanya dipakai bila
 * salah satu sisi belum bernomor, sebab nama seperti "Jasa Perbaikan Akomodasi
 * Kapal Ternate" berulang tiap bulan dan dua pengadaan bernomor beda memang dua
 * pengadaan yang berbeda.
 */
async function cariTersimpan(c: ReturnType<typeof dbServer>, req: HasilLembar["req"]): Promise<Tersimpan | null> {
  const { data, error } = await c!.from("projects")
    .select("id,no:payload->>noSPPBJ,nama:payload->>namaPengadaan,tgl:payload->>tanggal,status:payload->>status")
    .filter("payload->>kind", "eq", "sppbj");
  if (error) throw new Error(error.message);
  const baris = (data || []) as unknown as Tersimpan[];
  const no = kunci(req.noSPPBJ);
  if (no) {
    const sama = baris.find((d) => kunci(d.no) === no);
    if (sama) return sama;
  }
  const nama = kunci(req.namaPengadaan);
  const bulan = (req.tanggal || "").slice(0, 7);
  return baris.find((d) =>
    kunci(d.nama) === nama && (d.tgl || "").slice(0, 7) === bulan && (!no || !kunci(d.no))) || null;
}

function ringkasan(h: HasilLembar): string[] {
  const r = h.req;
  const baris = [
    `Nama     : ${r.namaPengadaan}`,
    `No       : ${r.noSPPBJ || "(kosong)"}    Tanggal: ${r.tanggal}`,
    `DRP      : ${r.noDRP || "(kosong)"}`,
    `Kategori : ${r.kategoriRekap ? r.kategoriRekap + " (tebakan, periksa)" : "(kosong)"}`,
    `Item     : ${h.ringkas.item} item, ${h.ringkas.kapal.join(", ") || "tanpa kapal"}`,
    `Nilai    : ${rupiah(h.ringkas.jumlah)} (belum PPN)`,
    "Mata Anggaran:",
    ...h.ringkas.perMa.map((m) => `  ${m.ma.slice(0, 44)}: ${m.item} item, ${rupiah(m.nilai)}`),
  ];
  if (h.catatan.length) {
    baris.push("", "Perlu dilihat:");
    // kotak pesan Excel memotong teks di sekitar 1.024 huruf
    h.catatan.slice(0, 5).forEach((c) => baris.push("  - " + c.slice(0, 110)));
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
  aksi?: "baru" | "perbarui";
  id?: string;
  pesan: string;
  ringkas?: HasilLembar["ringkas"];
  namaPengadaan?: string;
  catatan?: string[];
}

async function olah(lembar: LembarExcel, aksi: string): Promise<Jawab> {
  const h = bacaLembar(lembar);
  const dasar = { lembar: lembar.nama, ringkas: h.ringkas, namaPengadaan: h.req.namaPengadaan, catatan: h.catatan };
  if (h.masalah.length) {
    return { ...dasar, kode: "GAGAL", pesan: ["Belum bisa dikirim:", ...h.masalah.map((m) => "  - " + m)].join("\n") };
  }
  const c = dbServer()!;
  const ada = await cariTersimpan(c, h.req);
  if (ada && (ada.status || "menunggu_spbj") !== "menunggu_spbj") {
    return {
      ...dasar, kode: "TERKUNCI", id: ada.id,
      pesan: `"${h.req.namaPengadaan}" sudah ada di aplikasi dan SPBJ-nya sudah terbit, jadi tidak ditimpa. Kalau perlu diubah, ubah langsung di aplikasi.`,
    };
  }
  const jenis = ada ? "perbarui" : "baru";
  if (aksi !== "kirim") {
    const judul = ada
      ? "Sudah ada di aplikasi. Perbarui dengan isi lembar ini?"
      : "Kirim SPPBJ ini ke aplikasi?";
    return { ...dasar, kode: "SIAP", aksi: jenis, id: ada?.id, pesan: [judul, "", ...ringkasan(h)].join("\n") };
  }

  const tahun = parseInt((h.req.tanggal || "").slice(0, 4), 10) || null;
  let id = ada?.id;
  let payload: any;
  if (ada) {
    const { data, error } = await c.from("projects").select("payload").eq("id", ada.id).single();
    if (error) throw new Error(error.message);
    payload = gabungKeTersimpan(data?.payload || {}, h.req);
    const { error: e2 } = await c.from("projects")
      .update({ nama_kapal: h.req.namaPengadaan, tahun, payload }).eq("id", ada.id);
    if (e2) throw new Error(e2.message);
  } else {
    payload = { ...h.req, kind: "sppbj", sumberInput: "excel" };
    const { data, error } = await c.from("projects")
      .insert({ nama_kapal: h.req.namaPengadaan, tahun, payload }).select("id").single();
    if (error) throw new Error(error.message);
    id = data?.id;
  }
  const rekap = await keRekap(payload);
  return {
    ...dasar, kode: "TERKIRIM", aksi: jenis, id,
    pesan: [`${jenis === "baru" ? "Masuk ke aplikasi" : "Diperbarui di aplikasi"}: ${h.req.namaPengadaan}`,
      `${h.ringkas.item} item, ${rupiah(h.ringkas.jumlah)}.`, rekap].filter(Boolean).join("\n"),
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
      const aksi = String(form.get("aksi") || "cek");
      const lembar = await bacaBerkasExcel(await berkas.arrayBuffer(), berkas.name);
      if (!lembar.length) return gagal("Tidak ada lembar SPPB/J di berkas ini.", 400);
      const hasil: Jawab[] = [];
      for (const l of lembar) if (!pilih || pilih.includes(l.nama)) hasil.push(await olah(l, aksi));
      return NextResponse.json({ ok: true, hasil });
    }

    const body = await req.json();
    const lembar: LembarExcel | undefined = body?.lembar;
    if (!lembar || !Array.isArray(lembar.baris)) return gagal("Isi lembar tidak terbaca.", 400);
    const hasil = await olah(lembar, String(body.aksi || "cek"));
    return dariExcel ? teksExcel(hasil.kode, hasil.pesan) : NextResponse.json({ ok: true, hasil: [hasil] });
  } catch (e: any) {
    return gagal("Gagal memproses: " + (e?.message || e), 500);
  }
}
