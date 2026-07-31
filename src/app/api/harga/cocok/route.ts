/**
 * Pencocokan harga BORONGAN — untuk baris Repair List / RAB penunjang hasil
 * bacaan borang kapal yang belum berharga.
 *
 * Masuk : { items: [{ id, teks }] }   (maks 150 baris sekali jalan)
 * Keluar: { hasil: { [id]: { harga, kode, uraian, satuan, lo, hi, yakin } } }
 *
 * Yang dikembalikan hanya PASANGAN TERBAIK per baris + tanda `yakin`. Batasnya
 * disengaja ketat: salah harga lebih mahal daripada kosong — baris yang tak
 * yakin dibiarkan kosong dan dilaporkan, bukan diisi asal.
 */
import { NextRequest, NextResponse } from "next/server";
import { cocokkanSatu, hargaUsul, muatIndeks, galatIndeks } from "@/lib/harga/indeks";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!muatIndeks()) {
    return NextResponse.json({ ok: false, error: "Indeks harga belum tersedia: " + galatIndeks() }, { status: 503 });
  }
  const { items } = (await req.json()) as { items: { id: string; teks: string }[] };
  if (!Array.isArray(items) || !items.length) return NextResponse.json({ ok: true, hasil: {} });
  const potong = items.slice(0, 150);

  const hasil: Record<string, any> = {};
  for (const it of potong) {
    const c = cocokkanSatu(it.teks || "");
    if (!c) continue;
    // yakin bila sebagian besar kata kunci kena DAN datanya bukan sekali lewat
    const yakin = c.kena >= Math.max(2, Math.ceil(c.dari * 0.6)) && (c.hasil.n >= 2 || !!c.hasil.h2026);
    hasil[it.id] = {
      harga: hargaUsul(c.hasil), kode: c.hasil.kode, uraian: c.hasil.uraian,
      satuan: c.hasil.satuan, lo: c.hasil.lo, hi: c.hasil.hi,
      n: c.hasil.n, kena: c.kena, dari: c.dari, yakin,
    };
  }
  return NextResponse.json({ ok: true, hasil, diproses: potong.length, terlewat: items.length - potong.length });
}
