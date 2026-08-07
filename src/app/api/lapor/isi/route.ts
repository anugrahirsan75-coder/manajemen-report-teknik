import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Isi satu berkas kiriman ABK, untuk DIBACA kantor.
 *
 * Berkasnya tinggal di Drive pemilik dan tautannya tidak dibagikan, jadi
 * peramban tak bisa mengambilnya sendiri — Apps Script yang mengambilkannya.
 *
 * Yang dikirim balik ke peramban adalah BINER apa adanya, bukan JSON berisi
 * base64. Base64 menggelembungkan ukuran sepertiga (berkas 475 KB jadi 633 KB
 * teks), dan seluruhnya harus disusun di memori lalu diurai lagi di peramban —
 * cukup untuk membuat permintaan mati di tengah jalan dan muncul sebagai
 * "Failed to fetch" yang tak menjelaskan apa pun.
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
      signal: AbortSignal.timeout(45_000),
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

    const bytes = Buffer.from(String(hasil.dataBase64 || ""), "base64");
    if (!bytes.length) return NextResponse.json({ ok: false, error: "berkas kosong di Drive" }, { status: 502 });

    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": String(hasil.mime || "application/octet-stream"),
        "Content-Length": String(bytes.length),
        // nama berkas dikirim di kepala, bukan di badan, supaya badannya tetap
        // murni isi berkas; encodeURIComponent menjaga nama berspasi & tanda baca
        "X-Nama-Berkas": encodeURIComponent(String(hasil.nama || "berkas")),
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    const putus = e?.name === "TimeoutError";
    return NextResponse.json({
      ok: false,
      error: putus
        ? "Google Drive lambat menjawab (lebih dari 45 detik). Coba lagi, atau buka berkasnya langsung di Drive."
        : (e?.message || "gagal"),
    }, { status: putus ? 504 : 502 });
  }
}
