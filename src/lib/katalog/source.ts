// Sumber data Katalog HSPK (RAB) untuk autofill SPPBJ.
// Default: seed JSON (offline, di-generate dari RAB_MASTER_Lengkap_v3.xlsx via scripts/gen-katalog-seed.cjs).
// Opsional LIVE: set env NEXT_PUBLIC_KATALOG_CSV_URL (sheet KATALOG) + NEXT_PUBLIC_KATALOG_BREAKDOWN_CSV_URL
//   (sheet BREAKDOWN flat: Kode|Uraian|Volume|Satuan|HargaSatuan|Spesifikasi) -> gviz CSV.
import seed from "./katalogSeed.json";

export interface KatalogItem {
  kode: string;
  jenis: string;            // JASA | BARANG
  kategori: string;
  nama: string;
  spesifikasi: string;
  satuan: string;
  harga: number;            // harga satuan (pre-PPN)
  sumber: "Riil" | "Pasar" | string;
  breakdown?: string[];     // rincian komponen (khusus item ber-detail)
}

const SEED_ITEMS: KatalogItem[] = (seed as any).items || [];

// ---- util ----
export const norm = (s: string) =>
  (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

// CSV parser sederhana (handle quotes & koma dlm sel)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const toNum = (s: string) => { const n = parseFloat(String(s || "").replace(/[^\d.-]/g, "")); return isNaN(n) ? 0 : n; };

async function fetchGviz(): Promise<KatalogItem[] | null> {
  const url = process.env.NEXT_PUBLIC_KATALOG_CSV_URL;
  if (!url) return null;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("gviz katalog HTTP " + res.status);
  const rows = parseCsv(await res.text());
  if (rows.length < 2) throw new Error("katalog CSV kosong");
  // header baris pertama -> map kolom by nama (toleran urutan)
  const head = rows[0].map((h) => norm(h));
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const ci = { kode: col("kode"), jenis: col("jenis"), kategori: col("kategori"), nama: col("nama"), spek: col("spesifikasi", "ukuran"), sat: col("satuan"), harga: col("harga"), sumber: col("sumber") };
  const items: KatalogItem[] = [];
  for (let r = 1; r < rows.length; r++) {
    const g = (i: number) => (i >= 0 ? (rows[r][i] || "").trim() : "");
    const kode = g(ci.kode);
    const nama = g(ci.nama);
    if (!kode || !nama) continue;
    items.push({ kode, jenis: g(ci.jenis), kategori: g(ci.kategori), nama, spesifikasi: g(ci.spek), satuan: g(ci.sat), harga: toNum(g(ci.harga)), sumber: (g(ci.sumber) || "Pasar") as any });
  }
  // breakdown opsional
  const bdUrl = process.env.NEXT_PUBLIC_KATALOG_BREAKDOWN_CSV_URL;
  if (bdUrl) {
    try {
      const bres = await fetch(bdUrl, { cache: "no-store" });
      if (bres.ok) {
        const brows = parseCsv(await bres.text());
        const bhead = brows[0].map((h) => norm(h));
        const bk = bhead.findIndex((h) => h.includes("kode"));
        const bu = bhead.findIndex((h) => h.includes("uraian") || h.includes("komponen"));
        const map: Record<string, string[]> = {};
        for (let r = 1; r < brows.length; r++) {
          const kode = (brows[r][bk] || "").trim();
          const ur = (brows[r][bu] || "").trim();
          if (!kode || !ur) continue;
          (map[kode] ||= []).push(ur);
        }
        items.forEach((it) => { if (map[it.kode]) it.breakdown = map[it.kode]; });
      }
    } catch { /* breakdown opsional, abaikan gagal */ }
  }
  return items.length ? items : null;
}

let cache: KatalogItem[] | null = null;
let inflight: Promise<KatalogItem[]> | null = null;

/** Ambil seluruh item katalog. gviz bila env diset, jika gagal -> seed. */
export async function getKatalog(): Promise<KatalogItem[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try { const live = await fetchGviz(); if (live) { cache = live; return cache; } } catch { /* fallback seed */ }
    cache = SEED_ITEMS;
    return cache;
  })();
  return inflight;
}

/** akses sinkron seed (mis. fallback awal sebelum getKatalog selesai) */
export const katalogSeed = (): KatalogItem[] => SEED_ITEMS;

/** Cari item: multi-token AND, abaikan tanda baca; ranking sederhana. */
export function searchKatalog(all: KatalogItem[], query: string, limit = 30): KatalogItem[] {
  const q = norm(query);
  if (!q) return all.slice(0, limit);
  const toks = q.split(" ").filter(Boolean);
  const scored: { it: KatalogItem; score: number }[] = [];
  for (const it of all) {
    const hayKode = norm(it.kode);
    const hayNama = norm(it.nama);
    const hay = `${hayKode} ${hayNama} ${norm(it.spesifikasi)} ${norm(it.kategori)} ${norm(it.jenis)}`;
    if (!toks.every((t) => hay.includes(t))) continue;
    let score = 0;
    if (hayKode === q) score += 100;
    if (hayNama.startsWith(q)) score += 40;
    if (hayNama.includes(q)) score += 20;
    if (it.sumber === "Riil") score += 5; // prioritaskan harga riil
    scored.push({ it, score });
  }
  scored.sort((a, b) => b.score - a.score || a.it.nama.localeCompare(b.it.nama));
  return scored.slice(0, limit).map((s) => s.it);
}
