import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Isi satu berkas kiriman ABK, untuk DIBACA kantor.
 *
 * Berkasnya tinggal di Drive pemilik dan tidak dibagikan tautannya, jadi
 * peramban tak bisa mengambilnya sendiri — Apps Script yang mengambilkannya.
 *
 * Route ini di balik login (bukan bagian /api/lapor yang dibuka untuk ABK di
 * middleware), sehingga yang bisa membaca isi kiriman hanya orang kantor.
 */
export async function GET(req: NextRequest) {
  const gasUrl = process.env.LAPOR_GAS_URL;
  const secret = process.env.LAPOR_GAS_SECRET;
  if (!gasUrl || !secret) {
    return NextResponse.json({ ok: false, error: "LAPOR_GAS_URL / LAPOR_GAS_SECRET belum diset" }, { status: 501 });
  }
  const fileId = (req.nextUrl.searchParams.get("fileId") || "").trim();
  if (!fileId) return NextResponse.json({ ok: false, error: "fileId kosong" }, { status: 400 });

  try {
    const r = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, aksi: "isi", fileId }),
      signal: AbortSignal.timeout(50_000),
      cache: "no-store",
    });
    const teks = await r.text();
    let hasil: any;
    try { hasil = JSON.parse(teks); }
    catch {
      return NextResponse.json({
        ok: false,
        error: "Apps Script menjawab bukan JSON. Perbarui skripnya ke versi 5 (lihat docs/LAPOR_KAPAL_SETUP.md).",
      }, { status: 502 });
    }
    if (!hasil?.ok) {
      /**
       * Skrip versi lama tidak mengenal aksi "isi", jadi permintaan ini jatuh ke
       * jalur unggah dan dijawab "berkas kosong". Pesan itu menyesatkan — yang
       * kurang bukan berkasnya, melainkan versi skripnya.
       */
      const usang = /berkas kosong/i.test(String(hasil?.error || ""));
      return NextResponse.json({
        ok: false,
        error: usang
          ? "Apps Script masih versi lama sehingga belum bisa membaca isi berkas. Perbarui ke versi 5 (docs/LAPOR_KAPAL_SETUP.md), lalu Deploy → Kelola deployment → Versi baru."
          : (hasil?.error || "gagal membaca berkas"),
      }, { status: 502 });
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
