/**
 * Pencarian harga acuan dari DATABASE HARGA RAB ASDP TERNATE
 * (60.586 item hasil pemindaian 4.927 berkas pengadaan 2024-2026).
 *
 * Indeksnya ~8 MB, jadi dibaca SEKALI di sisi server lalu disimpan di memori
 * proses; peramban cuma menerima 30-an baris teratas. Pencarian memakai
 * pencocokan kata (semua kata harus ada), lalu diurutkan dengan pembobotan:
 * banyaknya data pembanding, ada-tidaknya harga tahun berjalan, dan kecocokan
 * awalan kata — supaya "seal" tidak kalah oleh "sealant".
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Indeks {
  sumber: string;
  kolom: string[];
  kamus: { kategori: string[]; satuan: string[]; tren: string[] };
  baris: any[][];
}

let INDEKS: Indeks | null = null;
let NORMAL: string[] | null = null;   // teks pencarian per baris, sudah dinormalkan
let GAGAL = "";

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function muat(): Indeks | null {
  if (INDEKS || GAGAL) return INDEKS;
  try {
    const p = path.join(process.cwd(), "data", "hargaIndex.json");
    INDEKS = JSON.parse(fs.readFileSync(p, "utf8"));
    NORMAL = INDEKS!.baris.map((b) => norm(`${b[3]} ${b[4]} ${INDEKS!.kamus.kategori[b[2]] || ""}`));
  } catch (e: any) {
    GAGAL = e?.message || String(e);
  }
  return INDEKS;
}

// urutan kolom: 0 kode 1 jenis 2 kategori 3 uraian 4 spek 5 satuan 6 n
//               7 lo 8 hi 9 median 10 h2024 11 h2025 12 h2026 13 tren 14 kapal
export async function GET(req: NextRequest) {
  const db = muat();
  if (!db || !NORMAL) {
    return NextResponse.json({ ok: false, error: "Indeks harga belum tersedia: " + GAGAL }, { status: 503 });
  }
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
  for (let i = 0; i < NORMAL.length; i++) {
    const teks = NORMAL[i];
    let cocok = true;
    for (const k of kata) { if (!teks.includes(k)) { cocok = false; break; } }
    if (!cocok) continue;
    const b = db.baris[i];
    if (jenis && b[1] !== jenis) continue;
    if (kategori && db.kamus.kategori[b[2]] !== kategori) continue;
    // pembobotan: data berulang lebih dipercaya, harga terbaru lebih berguna,
    // dan kata yang berdiri sendiri lebih tepat daripada yang cuma tersisip
    let skor = Math.min(b[6] || 0, 8) * 3;
    if (b[12]) skor += 12; else if (b[11]) skor += 6;
    for (const k of kata) if (new RegExp(`(^| )${k}( |$)`).test(teks)) skor += 4;
    skor -= Math.min(teks.length / 40, 6);
    hasil.push({ i, skor });
  }
  hasil.sort((a, b) => b.skor - a.skor);
  const out = hasil.slice(0, batas).map(({ i }) => {
    const b = db.baris[i];
    return {
      kode: b[0], jenis: b[1], kategori: db.kamus.kategori[b[2]] || "",
      uraian: b[3], spek: b[4], satuan: db.kamus.satuan[b[5]] || "",
      n: b[6], lo: b[7], hi: b[8], median: b[9],
      h2024: b[10], h2025: b[11], h2026: b[12],
      tren: db.kamus.tren[b[13]] || "", kapal: b[14],
    };
  });
  return NextResponse.json({ ok: true, total: db.baris.length, cocok: hasil.length, hasil: out });
}
