/**
 * Daftar barang dari database harga menurut KATEGORI — bahan usulan borongan.
 *
 * Berbeda dengan /api/harga/cari yang menjawab ketikan orang, route ini
 * menyerahkan sekumpulan barang sekaligus untuk dipakai penyusun usulan:
 * riwayat satu kapal kerap cuma puluhan barang, tak cukup untuk memenuhi jatah
 * sebulan, sedangkan database ini memuat 60 ribu barang dari berkas RAB
 * 2024-2026.
 *
 * Yang diserahkan hanya barang yang PANTAS diusulkan:
 *   · punya harga tahun berjalan atau tahun lalu — harga 2024 pada barang yang
 *     tak pernah dibeli lagi cuma menyesatkan;
 *   · punya minimal dua data pembanding, jadi harganya bukan kejadian tunggal;
 *   · bukan jasa dan bukan pekerjaan docking (dikenali dari kategorinya).
 * Urutannya: yang paling sering muncul di berkas lebih dulu.
 */
import { NextRequest, NextResponse } from "next/server";
import { muatIndeks, galatIndeks, keHasil } from "@/lib/harga/indeks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const m = muatIndeks();
  if (!m) {
    return NextResponse.json({ ok: false, error: "Indeks harga belum tersedia: " + galatIndeks() }, { status: 503 });
  }
  const { db } = m;
  const sp = req.nextUrl.searchParams;
  const kategori = (sp.get("kategori") || "").split("|").map((s) => s.trim()).filter(Boolean);
  const batas = Math.min(400, Math.max(10, parseInt(sp.get("batas") || "150", 10) || 150));
  const hargaMaks = Number(sp.get("hargaMaks") || 0);

  const pilih: { b: any[]; skor: number }[] = [];
  for (const b of db.baris) {
    const kat = db.kamus.kategori[b[2]] || "";
    if (kategori.length && !kategori.includes(kat)) continue;
    const n = b[6] || 0;
    if (n < 2) continue;                                   // harga kejadian tunggal
    const harga = b[12] || b[11] || 0;                     // 2026, lalu 2025
    if (!harga) continue;
    if (hargaMaks && harga > hargaMaks) continue;          // tak mungkin muat di jatah
    pilih.push({ b, skor: Math.min(n, 30) * (b[12] ? 2 : 1) });
  }
  pilih.sort((x, y) => y.skor - x.skor);

  return NextResponse.json({
    ok: true,
    total: pilih.length,
    hasil: pilih.slice(0, batas).map((x) => keHasil(db, x.b)),
    kategori: db.kamus.kategori,
  });
}
