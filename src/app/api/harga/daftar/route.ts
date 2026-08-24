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
  const lewati = Math.max(0, parseInt(sp.get("lewati") || "0", 10) || 0);
  const hargaMaks = Number(sp.get("hargaMaks") || 0);
  const jenis = (sp.get("jenis") || "").toUpperCase();      // B | J | S
  const minData = Math.max(1, parseInt(sp.get("minData") || "2", 10) || 2);
  /**
   * mesin=1 menyaring barang yang jelas melayani mesin induk atau mesin bantu.
   * Tanpa saringan ini, daftar diurut menurut seberapa sering barang muncul di
   * berkas, dan yang menang selalu barang umum — lampu, baut, packing. Suku
   * cadang mesin justru jarang berulang: tiap kapal beda merek mesin, jadi
   * namanya tak pernah naik ke dua ratus teratas meski jumlahnya ribuan.
   */
  const hanyaMesin = sp.get("mesin") === "1";
  const POLA_MESIN = new RegExp(String.raw`\b(m\s*\/?\s*e|a\s*\/?\s*e|main\s*engine`
    + String.raw`|aux(?:iliary)?|mesin\s*induk|mesin\s*bantu|gen\s*?set)\b`, "i");

  const pilih: { b: any[]; skor: number }[] = [];
  for (const b of db.baris) {
    const kat = db.kamus.kategori[b[2]] || "";
    if (kategori.length && !kategori.includes(kat)) continue;
    if (jenis && b[1] !== jenis) continue;
    const n = b[6] || 0;
    if (n < minData) continue;                             // harga kejadian tunggal
    const harga = b[12] || b[11] || 0;                     // 2026, lalu 2025
    if (!harga) continue;
    if (hargaMaks && harga > hargaMaks) continue;          // tak mungkin muat di jatah
    if (hanyaMesin && !POLA_MESIN.test(`${b[3] || ""} ${b[4] || ""}`)) continue;
    pilih.push({ b, skor: Math.min(n, 30) * (b[12] ? 2 : 1) });
  }
  pilih.sort((x, y) => y.skor - x.skor);

  return NextResponse.json({
    ok: true,
    total: pilih.length,
    hasil: pilih.slice(lewati, lewati + batas).map((x) => keHasil(db, x.b)),
    kategori: db.kamus.kategori,
  });
}
