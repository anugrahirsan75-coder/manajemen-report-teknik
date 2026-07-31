/**
 * Pencarian harga acuan dari DATABASE HARGA RAB ASDP TERNATE
 * (60.586 item hasil pemindaian 4.927 berkas pengadaan 2024-2026).
 *
 * Indeksnya ~8 MB, dimuat sekali di memori proses (lib/harga/indeks) dan
 * dipakai bersama route /api/harga/cocok; peramban cuma menerima 30-an baris
 * teratas. Semua kata yang diketik harus ada (pencarian interaktif), lalu
 * diurutkan dengan pembobotan: banyaknya data pembanding, ada-tidaknya harga
 * tahun berjalan, dan kecocokan kata utuh — supaya "seal" tidak kalah oleh
 * "sealant".
 */
import { NextRequest, NextResponse } from "next/server";
import { muatIndeks, galatIndeks, keHasil, norm } from "@/lib/harga/indeks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const m = muatIndeks();
  if (!m) {
    return NextResponse.json({ ok: false, error: "Indeks harga belum tersedia: " + galatIndeks() }, { status: 503 });
  }
  const { db, teks } = m;
  const sp = req.nextUrl.searchParams;
  const q = norm(sp.get("q") || "");
  const jenis = (sp.get("jenis") || "").toUpperCase();      // B | J | S
  const kategori = sp.get("kategori") || "";
  const batas = Math.min(60, Math.max(5, parseInt(sp.get("batas") || "25", 10) || 25));
  if (q.length < 2) {
    return NextResponse.json({ ok: true, total: db.baris.length, hasil: [], kategori: db.kamus.kategori });
  }
  const kata = q.split(" ").filter(Boolean);
  const hasil: { i: number; skor: number }[] = [];
  for (let i = 0; i < teks.length; i++) {
    const t = teks[i];
    let cocok = true;
    for (const k of kata) { if (!t.includes(k)) { cocok = false; break; } }
    if (!cocok) continue;
    const b = db.baris[i];
    if (jenis && b[1] !== jenis) continue;
    if (kategori && db.kamus.kategori[b[2]] !== kategori) continue;
    let skor = Math.min(b[6] || 0, 8) * 3;
    if (b[12]) skor += 12; else if (b[11]) skor += 6;
    for (const k of kata) if (new RegExp(`(^| )${k}( |$)`).test(t)) skor += 4;
    skor -= Math.min(t.length / 40, 6);
    hasil.push({ i, skor });
  }
  hasil.sort((a, b) => b.skor - a.skor);
  const out = hasil.slice(0, batas).map(({ i }) => keHasil(db, db.baris[i]));
  return NextResponse.json({ ok: true, total: db.baris.length, cocok: hasil.length, hasil: out });
}
