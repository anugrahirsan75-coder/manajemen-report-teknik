/**
 * Data sertifikat untuk LAYAR KANTOR — terbuka, hanya baca, sudah dipangkas.
 *
 * Layar di ruang kantor tidak bisa login: ia menyala sendiri, membuka satu
 * tautan, dan dibiarkan berhari-hari. Karena itu route ini di luar gerbang
 * sesi — dan justru karena terbuka, yang dikirim hanya yang perlu dibaca dari
 * jarak tiga meter: kapal, nama dokumen, tanggal berakhir, sisa hari.
 *
 * Yang TIDAK ikut: tautan Google Drive dan nama berkasnya. Tautan itu menuju
 * arsip cabang, dan menaruhnya di alamat terbuka sama saja membagikan
 * arsipnya kepada siapa pun yang menebak URL-nya.
 *
 * Kesegaran: lembar MUSTER dibaca ulang paling cepat tiap 3 menit. Layar
 * memanggil tiap menit; permintaan di sela itu dijawab dari singgahan, jadi
 * lembarnya tidak diunduh belasan kali per jam tanpa ada yang berubah.
 */
import { NextResponse } from "next/server";
import { ambilSertifikat } from "@/lib/sertifikat/sumber";
import { statusSert } from "@/lib/sertifikat/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** jarak minimum antar-pembacaan lembar untuk pemanggil layar */
const JEDA_SEGAR = 3 * 60 * 1000;
let terakhirSegar = 0;

/**
 * Sidik isi jawaban, dipakai sebagai ETag.
 *
 * Dihitung dari isi yang BERARTI saja — daftar dokumen dan waktu lembar
 * terakhir dibaca — bukan dari seluruh badan jawaban. "dilayaniPada" berubah
 * tiap permintaan, dan kalau ikut dihitung, sidiknya tidak pernah sama
 * sehingga 304 tidak pernah terjadi dan seluruh 89 KB dikirim ulang tiap menit.
 */
function sidik(isi: unknown): string {
  const t = JSON.stringify(isi);
  let a = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    a ^= t.charCodeAt(i);
    a = Math.imul(a, 0x01000193);
  }
  return `W/"${(a >>> 0).toString(16)}-${t.length.toString(16)}"`;
}

export async function GET(req: Request) {
  try {
    const bolehSegar = Date.now() - terakhirSegar > JEDA_SEGAR;
    if (bolehSegar) terakhirSegar = Date.now();

    const { baris, kapal, diambilPada } = await ambilSertifikat(bolehSegar);

    /*
     * Baris bantu di lembar MUSTER ("Masa berlaku sertifikat < 30 hari") bukan
     * dokumen; di layar ia akan tampil sebagai sertifikat yang tak punya
     * tanggal dan hanya menambah keributan.
     */
    const dokumen = baris
      .filter((s) => !/^Masa berlaku sertifikat/i.test(s.jenis))
      .map((s) => ({
        kapal: s.kapal,
        kelompok: s.kelompok,
        jenis: s.jenis,
        berlaku: s.berlaku,
        terbit: s.terbit,
        permanen: s.permanen,
        sisaHari: s.sisaHari,
        status: statusSert(s),
      }));

    /*
     * Layar kantor memanggil tiap menit dan dibiarkan menyala berhari-hari.
     * Dengan "no-store" seluruh 89 KB menyeberang tiap panggilan — 1.440 kali
     * sehari, sekitar 3,8 GB sebulan untuk SATU layar, padahal isinya berubah
     * paling cepat tiap 3 menit. Itu yang menghabiskan kuota Fast Origin
     * Transfer dan mem-pause seluruh situs pada 24 September 2026.
     *
     * Dua lapis penahan sekarang:
     *
     *   s-maxage: CDN menjawab sendiri selama 2 menit, fungsinya tidak
     *   dipanggil sama sekali — inilah yang memotong transfer origin.
     *
     *   ETag: kalaupun sampai ke fungsi, jawaban yang isinya tidak berubah
     *   dibalas 304 tanpa badan, jadi yang menyeberang hanya kepala.
     */
    const inti = { ok: true, kapal, dokumen, diambilPada };
    const etag = sidik(inti);
    const kepala = {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      ETag: etag,
    };
    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: kepala });
    }
    return NextResponse.json(
      { ...inti, dilayaniPada: new Date().toISOString() }, { headers: kepala });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lembar sertifikat tidak terbaca" }, { status: 502 });
  }
}
