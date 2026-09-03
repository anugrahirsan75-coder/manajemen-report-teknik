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

export async function GET() {
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

    return NextResponse.json({
      ok: true,
      kapal,
      dokumen,
      diambilPada,
      dilayaniPada: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lembar sertifikat tidak terbaca" }, { status: 502 });
  }
}
