/**
 * Indeks harga acuan — dibaca dari data/hargaIndex.json (60.586 item hasil
 * pemindaian 4.927 berkas pengadaan 2024-2026).
 *
 * HANYA untuk sisi server (route API): berkasnya ~8 MB, dimuat sekali lalu
 * disimpan di memori proses. Dipakai dua route:
 *   GET  /api/harga/cari   — pencarian interaktif (pengguna mengetik)
 *   POST /api/harga/cocok  — pencocokan borongan untuk baris RL/penunjang
 */
import fs from "fs";
import path from "path";

export interface IndeksHarga {
  sumber: string;
  kolom: string[];
  kamus: { kategori: string[]; satuan: string[]; tren: string[] };
  // 0 kode 1 jenis 2 kategori 3 uraian 4 spek 5 satuan 6 n
  // 7 lo 8 hi 9 median 10 h2024 11 h2025 12 h2026 13 tren 14 kapal
  baris: any[][];
}

let INDEKS: IndeksHarga | null = null;
let NORMAL: string[] | null = null;
let GAGAL = "";

export const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function muatIndeks(): { db: IndeksHarga; teks: string[] } | null {
  if (!INDEKS && !GAGAL) {
    try {
      const p = path.join(process.cwd(), "data", "hargaIndex.json");
      INDEKS = JSON.parse(fs.readFileSync(p, "utf8"));
      NORMAL = INDEKS!.baris.map((b) => norm(`${b[3]} ${b[4]} ${INDEKS!.kamus.kategori[b[2]] || ""}`));
    } catch (e: any) { GAGAL = e?.message || String(e); }
  }
  return INDEKS && NORMAL ? { db: INDEKS, teks: NORMAL } : null;
}
export const galatIndeks = () => GAGAL;

export interface HasilHarga {
  kode: string; jenis: string; kategori: string; uraian: string; spek: string;
  satuan: string; n: number; lo: number; hi: number; median: number;
  h2024: number; h2025: number; h2026: number; tren: string; kapal: string;
}

export const keHasil = (db: IndeksHarga, b: any[]): HasilHarga => ({
  kode: b[0], jenis: b[1], kategori: db.kamus.kategori[b[2]] || "",
  uraian: b[3], spek: b[4], satuan: db.kamus.satuan[b[5]] || "",
  n: b[6], lo: b[7], hi: b[8], median: b[9],
  h2024: b[10], h2025: b[11], h2026: b[12],
  tren: db.kamus.tren[b[13]] || "", kapal: b[14],
});

/** harga yang paling layak dipakai: tahun terbaru, mundur sampai median */
export const hargaUsul = (h: HasilHarga) => h.h2026 || h.h2025 || h.median || h.h2024 || h.lo;

// kata yang tak membedakan barang — dibuang sebelum mencocokkan
const KATA_UMUM = new Set([
  "yang", "dan", "atau", "untuk", "pada", "dari", "dengan", "di", "ke", "the",
  "baru", "ganti", "buah", "unit", "set", "pcs", "cm", "mm", "m", "m2", "kg",
  "uk", "ukuran", "buatkan", "dibuatkan", "pasang", "dipasang", "beserta",
  "sudah", "keropos", "bocor", "kanan", "kiri", "buritan", "haluan", "sebelah",
]);

/** kata kunci sebuah uraian: >=3 huruf, bukan angka murni, bukan kata umum */
export function kataKunci(teks: string): string[] {
  return Array.from(new Set(
    norm(teks).split(" ").filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !KATA_UMUM.has(w)),
  ));
}

export interface Kecocokan { hasil: HasilHarga; skor: number; kena: number; dari: number }

/**
 * Cari satu pasangan terbaik untuk sebuah uraian bebas (baris RL / permintaan
 * kapal). Berbeda dengan pencarian interaktif, di sini TIDAK semua kata wajib
 * ada — uraian kapal panjang dan berbunga. Kecocokan dinilai dari berapa kata
 * kunci yang kena, ditambah bobot mutu data (berulang, harga terbaru).
 */
export function cocokkanSatu(uraian: string): Kecocokan | null {
  const m = muatIndeks();
  if (!m) return null;
  const kunci = kataKunci(uraian);
  if (kunci.length < 2) return null;
  const wajib = Math.max(2, Math.ceil(kunci.length * 0.5));
  let terbaik: { i: number; skor: number; kena: number } | null = null;
  for (let i = 0; i < m.teks.length; i++) {
    const t = m.teks[i];
    let kena = 0;
    for (const k of kunci) if (t.includes(k)) kena++;
    if (kena < wajib) continue;
    const b = m.db.baris[i];
    let skor = kena * 10;
    skor += Math.min(b[6] || 0, 8) * 2;                 // makin sering diadakan makin dipercaya
    if (b[12]) skor += 8; else if (b[11]) skor += 4;    // punya harga terbaru
    skor -= Math.min(t.length / 60, 5);                 // teks kelewat panjang biasanya beda barang
    if (!terbaik || skor > terbaik.skor) terbaik = { i, skor, kena };
  }
  if (!terbaik) return null;
  return { hasil: keHasil(m.db, m.db.baris[terbaik.i]), skor: terbaik.skor, kena: terbaik.kena, dari: kunci.length };
}
