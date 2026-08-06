import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Isi folder "Laporan Docking" di Google Drive pemilik.
 *
 * Yang dibaca adalah Drive-nya langsung (lewat Apps Script yang berjalan
 * sebagai pemilik), bukan salinan di basis data. Dengan begitu berkas yang
 * ditaruh manual dari Google Drive langsung terlihat di aplikasi, tanpa perlu
 * dicatat dua kali — dan tidak ada daftar yang bisa basi.
 *
 * Jalur folder dikirim sebagai NAMA, bukan ID. Skrip menelusurinya dari akar
 * yang sudah ditentukan, jadi permintaan tak bisa diarahkan ke folder lain.
 */
export async function GET(req: NextRequest) {
  const gasUrl = process.env.LAPOR_GAS_URL;
  const secret = process.env.LAPOR_GAS_SECRET;
  if (!gasUrl || !secret) {
    return NextResponse.json({ ok: false, error: "LAPOR_GAS_URL / LAPOR_GAS_SECRET belum diset" }, { status: 501 });
  }

  const jalur = (req.nextUrl.searchParams.get("jalur") || "")
    .split("/").map((s) => s.trim()).filter(Boolean).slice(0, 6);

  try {
    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, aksi: "daftar", akar: "docking", jalur }),
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });
    const teks = await res.text();
    let hasil: any;
    try { hasil = JSON.parse(teks); }
    catch {
      // Apps Script selalu menjawab 200; balasan bukan-JSON berarti skripnya
      // belum diperbarui ke versi yang mengenal aksi "daftar".
      return NextResponse.json({
        ok: false,
        error: "Apps Script menjawab bukan JSON. Perbarui skripnya ke versi 4 (lihat docs/LAPOR_KAPAL_SETUP.md).",
      }, { status: 502 });
    }
    if (!hasil?.ok) {
      return NextResponse.json({ ok: false, error: hasil?.error || "gagal membaca folder" }, { status: 502 });
    }
    return NextResponse.json(hasil);
  } catch (e: any) {
    const putus = e?.name === "TimeoutError";
    return NextResponse.json({
      ok: false,
      error: putus ? "Google Drive lambat menjawab. Coba lagi." : (e?.message || "gagal"),
    }, { status: 504 });
  }
}
