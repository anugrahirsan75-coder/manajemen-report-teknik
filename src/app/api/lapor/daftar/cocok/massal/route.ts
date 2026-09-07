/**
 * Cocokkan SEMUA kiriman kosong satu periode dengan isi Google Drive sekaligus.
 *
 * Route sebelahnya (../cocok) mengerjakan satu kiriman: buka kirimannya, tekan
 * cari, centang, tautkan. Untuk satu kejadian itu cukup. Tetapi kiriman kosong
 * datang berombongan — satu kapal yang jaringannya putus mencoba lima kali
 * berturut-turut, dan lima catatan kosong itu semuanya menunjuk berkas yang
 * sudah utuh di Drive. Merapikannya satu per satu berarti dua puluh klik untuk
 * pekerjaan yang isinya sama persis, dan yang paling sering terjadi: tidak
 * dikerjakan sama sekali, lalu kapal ditagih ulang untuk berkas yang sudah ada.
 *
 * Yang dijaga di sini:
 *  · Satu berkas Drive hanya boleh menjadi milik SATU kiriman. Karena kiriman
 *    kosong sering berupa percobaan berulang pada kapal, jenis, dan jam yang
 *    sama, berkasnya dibagikan menurut kedekatan waktu, dan yang sudah terpakai
 *    dicoret dari daftar sebelum kiriman berikutnya dilayani.
 *  · Isi folder Drive dibaca SEKALI per kapal+jenis, bukan sekali per kiriman.
 *    Lima kiriman kosong dari satu kapal berarti satu pembacaan, bukan lima.
 *  · Kiriman yang tidak menemukan apa pun dilaporkan apa adanya. Itu bukan
 *    kegagalan route ini, melainkan jawaban: unggahannya memang tak pernah
 *    sampai, dan kapal itu memang perlu ditagih.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbLapor, dbSiap } from "@/lib/lapor/db";
import { LABEL_FOLDER_DRIVE } from "@/lib/lapor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** selisih waktu yang masih dianggap "kiriman yang sama" — sama dengan ../cocok */
const JENDELA_JAM = 12;

interface BerkasDrive { nama: string; id: string; url: string; mime: string; ukuran: number; diubah: string }

/**
 * Nama tanpa cap waktu unggah — "… - 20260804-201926.pdf" menjadi "…".
 *
 * Apps Script menambahkan cap waktu pada tiap berkas supaya dua unggahan tidak
 * saling menimpa. Akibatnya percobaan yang gagal meninggalkan salinan bernama
 * beda padahal isinya sama, dan itulah yang benar-benar terjadi di Drive: ABK
 * KMP. MAMING menekan kirim dua kali, sehingga "Air Tawar Juli 2026" duduk di
 * folder dalam dua salinan berukuran identik.
 */
const namaInti = (nama: string) =>
  nama.replace(/\s*-\s*\d{8}-\d{6}(\.[a-z0-9]+)$/i, "$1").trim().toLowerCase();

/**
 * Buang salinan ganda: nama inti + ukuran yang sama dianggap berkas yang sama.
 *
 * Yang dipertahankan salinan PALING DEKAT waktunya dengan kiriman — itu yang
 * paling mungkin berasal dari percobaan yang catatannya hilang. Menautkan
 * keduanya membuat kantor membaca "6 dokumen" untuk tiga dokumen yang nyata,
 * dan angka kelengkapan yang dilebihkan lebih buruk daripada tidak ada angka.
 */
function tanpaKembar<T extends { nama: string; ukuran: number }>(daftar: T[]): { unik: T[]; kembar: number } {
  const dilihat = new Set<string>();
  const unik: T[] = [];
  daftar.forEach((f) => {
    const k = `${namaInti(f.nama)}|${f.ukuran}`;
    if (dilihat.has(k)) return;
    dilihat.add(k);
    unik.push(f);
  });
  return { unik, kembar: daftar.length - unik.length };
}

async function daftarFolder(jalur: string[]): Promise<BerkasDrive[]> {
  const gasUrl = process.env.LAPOR_GAS_URL;
  if (!gasUrl) throw new Error("Penyimpanan Google Drive belum aktif (LAPOR_GAS_URL kosong).");
  const res = await fetch(gasUrl, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: process.env.LAPOR_GAS_SECRET || "", aksi: "daftar", jalur }),
    redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(45_000),
  });
  const teks = await res.text();
  let d: any;
  try { d = JSON.parse(teks); } catch { throw new Error("Apps Script menjawab bukan JSON."); }
  if (d?.ok !== true) throw new Error(d?.error || "Google Drive menolak permintaan daftar isi.");
  return (d.berkas || []) as BerkasDrive[];
}

export async function POST(req: NextRequest) {
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const { periode, ids, aksi } = (await req.json().catch(() => ({}))) as
    { periode?: string; ids?: string[]; aksi?: string };

  const c = dbLapor()!;
  const { data: semua, error } = await c.from("projects")
    .select("id,payload").filter("payload->>kind", "eq", "lapor_kapal");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const pilihId = new Set((ids || []).map(String));
  const sasaran = (semua || []).filter((r: any) => {
    const p = r.payload || {};
    if (p.digantikan) return false;                       // percobaan yang sudah digantikan bukan kekosongan
    if ((p.berkas || []).length) return false;            // yang sudah berisi tidak diapa-apakan
    if (pilihId.size) return pilihId.has(r.id);
    return !periode || p.periode === periode;
  });

  if (!sasaran.length) {
    return NextResponse.json({ ok: true, hasil: [], ditautkan: 0, catatan: "Tidak ada kiriman kosong pada saringan ini." });
  }

  // satu berkas hanya boleh dimiliki satu kiriman — termasuk yang sudah tercatat
  const dipakai = new Set<string>();
  (semua || []).forEach((r: any) => ((r.payload?.berkas || []) as any[])
    .forEach((f) => f?.fileId && dipakai.add(f.fileId)));

  /*
   * Kiriman lama dilayani lebih dulu. Ketika satu kapal mencoba berkali-kali,
   * berkas yang sampai di Drive hampir selalu berasal dari percobaan paling
   * awal yang jaringannya putus — bukan dari percobaan terakhir.
   */
  sasaran.sort((a: any, b: any) =>
    String(a.payload?.dikirimPada || "").localeCompare(String(b.payload?.dikirimPada || "")));

  const singgahan = new Map<string, BerkasDrive[] | { galat: string }>();
  const hasil: any[] = [];
  let ditautkan = 0;

  for (const baris of sasaran) {
    const p: any = baris.payload || {};
    const label = LABEL_FOLDER_DRIVE[p.jenis] || p.jenis || "lainnya";
    const kunci = `${p.kapal}|${label}`;

    if (!singgahan.has(kunci)) {
      try { singgahan.set(kunci, await daftarFolder([p.kapal, label])); }
      catch (e: any) { singgahan.set(kunci, { galat: e?.message || "Gagal membaca Drive" }); }
    }
    const isi = singgahan.get(kunci)!;
    if (!Array.isArray(isi)) {
      hasil.push({ id: baris.id, kapal: p.kapal, jenis: p.jenis, periode: p.periode, galat: isi.galat, ketemu: 0 });
      continue;
    }

    const dikirim = Date.parse(p.dikirimPada || "") || 0;
    const kandidat = isi
      .filter((f) => !dipakai.has(f.id))
      .filter((f) => !p.periode || f.nama.startsWith(p.periode))
      .map((f) => ({ ...f, jarakJam: dikirim ? Math.abs(Date.parse(f.diubah) - dikirim) / 3_600_000 : 0 }))
      .filter((f) => !dikirim || f.jarakJam <= JENDELA_JAM)
      .sort((a, b) => a.jarakJam - b.jarakJam);

    if (!kandidat.length) {
      hasil.push({ id: baris.id, kapal: p.kapal, jenis: p.jenis, periode: p.periode, ketemu: 0 });
      continue;
    }

    // sudah terurut dari yang paling dekat waktunya, jadi salinan yang tersisa
    // sesudah penyaringan ini otomatis yang paling mungkin benar
    const { unik: terpilih, kembar } = tanpaKembar(kandidat);

    if (aksi !== "tautkan") {
      hasil.push({
        id: baris.id, kapal: p.kapal, jenis: p.jenis, periode: p.periode,
        dikirimPada: p.dikirimPada, ketemu: terpilih.length, kembar,
        berkas: terpilih.map((f) => ({ id: f.id, nama: f.nama, ukuran: f.ukuran, jarakJam: Math.round(f.jarakJam * 10) / 10 })),
      });
      /*
       * Pada mode intip pun berkasnya "dipesan" — termasuk salinan kembarnya.
       * Kalau kembarnya dilepas, kiriman kosong berikutnya dari kapal yang sama
       * akan mengklaim salinan itu dan kantor mendapat dua kiriman berisi
       * dokumen yang sama persis.
       */
      kandidat.forEach((f) => dipakai.add(f.id));
      continue;
    }

    // payload dibaca ulang tepat sebelum ditulis — ABK bisa saja baru berhasil
    // mengunggah ulang selagi kantor merapikan
    const { data: kini } = await c.from("projects").select("payload").eq("id", baris.id).single();
    const pTulis: any = { ...(kini?.payload || p) };
    const adaSekarang = (Array.isArray(pTulis.berkas) ? pTulis.berkas : []) as any[];
    if (adaSekarang.length) {
      hasil.push({ id: baris.id, kapal: p.kapal, jenis: p.jenis, periode: p.periode, ketemu: 0, catatan: "sudah berisi saat hendak ditautkan" });
      continue;
    }

    const tambah = terpilih.map((f) => ({
      nama: f.nama, mime: f.mime, ukuran: f.ukuran, fileId: f.id, url: f.url,
      diunggahPada: f.diubah, ditautkanKantor: true,
    }));
    const { error: e2 } = await c.from("projects").update({
      payload: { ...pTulis, berkas: tambah, galatUnggah: "" },
    }).eq("id", baris.id);
    if (e2) {
      console.error("cocok massal:", e2.message);
      hasil.push({ id: baris.id, kapal: p.kapal, jenis: p.jenis, periode: p.periode, ketemu: terpilih.length, galat: "gagal menyimpan" });
      continue;
    }
    kandidat.forEach((f) => dipakai.add(f.id));
    ditautkan += tambah.length;
    hasil.push({
      id: baris.id, kapal: p.kapal, jenis: p.jenis, periode: p.periode,
      ketemu: tambah.length, kembar,
      berkas: tambah.map((f) => ({ id: f.fileId, nama: f.nama, ukuran: f.ukuran })),
    });
  }

  const kosong = hasil.filter((h) => !h.ketemu && !h.galat).length;
  return NextResponse.json({
    ok: true, hasil, ditautkan,
    diperiksa: sasaran.length,
    kosong,
    folderDibaca: singgahan.size,
  });
}
