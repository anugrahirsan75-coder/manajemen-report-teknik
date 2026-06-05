// Cek apakah item barang/suku cadang punya kode Material (SAP) di DATABASE KODE MATERIAL.
// - Suku cadang (punya part number): cocokkan part number -> kolom R "Old Material Number"
//   (abaikan semua pemisah, bandingkan urutan alfanumerik). 1 part bisa >1 kode material.
// - Barang umum (tanpa part number): cocokkan nama -> kolom D "Material description" FUZZY,
//   banyak kandidat berperingkat utk dipilih.
//
// SUMBER DB: live dari Google Sheet (CSV export) dengan cache TTL — user update sheet,
// server auto-refresh tanpa rebuild. Fallback ke kodeMaterialDb.json (bundled) bila gagal fetch.
import seed from "./kodeMaterialDb.json";

export interface KodeRow { m: string; d: string; p: string; g: string } // material, description, part(old mat number), material group

const SHEET_ID = "14WA01qxI5kwVfTKcnaVuCEqMZQFPo3ASdPrXcmxIths";
const GID = "1216282764";
const CSV_URL = process.env.MATERIAL_DB_CSV_URL ||
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
const TTL_MS = 30 * 60 * 1000; // auto-refresh tiap 30 menit

// kolom CSV (0-based): A=Material(0), D=description(3), G=material group(6), R=old material number(17)
const C_MAT = 0, C_DESC = 3, C_GROUP = 6, C_PART = 17;

let rows: KodeRow[] = seed as KodeRow[]; // awal = seed bundled (offline-ready)
let lastFetch = 0;       // 0 = belum pernah fetch live
let lastOk = 0;          // timestamp fetch live sukses terakhir
let built = false;
let loading: Promise<void> | null = null;

// ---------- CSV ----------
function parseLine(line: string): string[] {
  const o: string[] = [];
  let c = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; }
      else c += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === ",") { o.push(c); c = ""; }
      else c += ch;
    }
  }
  o.push(c);
  return o;
}
function parseCsv(text: string): KodeRow[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const out: KodeRow[] = [];
  for (let i = 1; i < lines.length; i++) { // skip header
    const f = parseLine(lines[i]);
    const m = (f[C_MAT] || "").trim();
    if (!m) continue;
    out.push({ m, d: (f[C_DESC] || "").trim(), p: (f[C_PART] || "").trim(), g: (f[C_GROUP] || "").trim() });
  }
  return out;
}

async function refresh(force = false) {
  const now = Date.now();
  if (!force && lastFetch && now - lastFetch < TTL_MS) return; // cache masih segar
  if (loading) return loading;                                 // hindari fetch paralel
  loading = (async () => {
    try {
      const res = await fetch(CSV_URL, { cache: "no-store", redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseCsv(await res.text());
      if (parsed.length > 100) { rows = parsed; built = false; lastOk = Date.now(); } // sanity guard
      lastFetch = Date.now();
    } catch {
      // gagal fetch (offline/akses) -> pertahankan rows yg ada (seed atau fetch sukses terakhir)
      lastFetch = Date.now(); // jangan spam retry; tunggu TTL berikut
    } finally {
      loading = null;
    }
  })();
  return loading;
}

// ---------- index ----------
const normPart = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); // abaikan semua pemisah
const normDesc = (s: string) => (s || "").toUpperCase().replace(/\s+/g, " ").trim();
const tokenize = (s: string) => s.split(/[^A-Z0-9]+/).filter((t) => t.length >= 2);

let partIdx: Map<string, string[]> = new Map();
let matDesc: Map<string, string> = new Map();
let descList: { nd: string; kode: string; desc: string; toks: string[] }[] = [];

function buildIndexes() {
  partIdx = new Map();
  matDesc = new Map();
  descList = [];
  const seenDesc = new Set<string>();
  for (const r of rows) {
    if (r.m && !matDesc.has(r.m)) matDesc.set(r.m, r.d);
    if (r.p) {
      const k = normPart(r.p);
      if (k) { let arr = partIdx.get(k); if (!arr) { arr = []; partIdx.set(k, arr); } if (!arr.includes(r.m)) arr.push(r.m); }
    }
    const nd = normDesc(r.d);
    if (nd && !seenDesc.has(nd)) { seenDesc.add(nd); descList.push({ nd, kode: r.m, desc: r.d, toks: tokenize(nd) }); }
  }
  built = true;
}

async function ensureDb(force = false) {
  await refresh(force);
  if (!built) buildIndexes();
}

export interface DbMeta { count: number; source: "live" | "seed"; lastSync: number | null }
export function dbMeta(): DbMeta {
  return { count: rows.length, source: lastOk ? "live" : "seed", lastSync: lastOk || null };
}

// ---------- skor fuzzy (barang umum) ----------
function score(qNorm: string, qToks: string[], c: { nd: string; toks: string[] }): number {
  if (c.nd === qNorm) return 1000;
  let s = 0;
  if (c.nd.includes(qNorm) || qNorm.includes(c.nd)) s += 50;
  for (const qt of qToks) {
    if (c.toks.includes(qt)) s += 10;
    else if (c.toks.some((t) => t.startsWith(qt) || qt.startsWith(t))) s += 3;
  }
  return s;
}

export interface CekInput { id: string; nama: string; partNumber: string }
export interface Cand { kode: string; desc: string }
export interface CekResult {
  id: string;
  kategori: "SC" | "UMUM";
  kode: string;
  desc: string;
  status: "ada" | "cek" | "tidak ada";
  kode2?: string;
  desc2?: string;
  candidates?: Cand[];
}

const MAX_CAND = 15;

export async function cekKode(items: CekInput[], opts?: { refresh?: boolean }): Promise<CekResult[]> {
  await ensureDb(opts?.refresh);
  return items.map((it) => {
    const part = (it.partNumber || "").trim();
    if (part) {
      // SUKU CADANG
      const mats = partIdx.get(normPart(part)) || [];
      if (!mats.length) return { id: it.id, kategori: "SC", kode: "", desc: "", status: "tidak ada" };
      const candidates: Cand[] = mats.map((m) => ({ kode: m, desc: matDesc.get(m) || "" }));
      const r: CekResult = { id: it.id, kategori: "SC", kode: candidates[0].kode, desc: candidates[0].desc, status: "ada", candidates };
      if (mats.length > 1) { r.kode2 = candidates[1].kode; r.desc2 = candidates[1].desc; }
      return r;
    }
    // BARANG UMUM (fuzzy)
    const qNorm = normDesc(it.nama);
    if (!qNorm) return { id: it.id, kategori: "UMUM", kode: "", desc: "", status: "tidak ada" };
    const qToks = tokenize(qNorm);
    const scored = descList
      .map((c) => ({ c, s: score(qNorm, qToks, c) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_CAND);
    if (!scored.length) return { id: it.id, kategori: "UMUM", kode: "", desc: "", status: "tidak ada" };
    const candidates: Cand[] = scored.map(({ c }) => ({ kode: c.kode, desc: c.desc }));
    const exact = scored[0].s >= 1000;
    return { id: it.id, kategori: "UMUM", kode: candidates[0].kode, desc: candidates[0].desc, status: exact ? "ada" : "cek", candidates };
  });
}

// refresh manual (tombol Sinkron) -> kembalikan meta terbaru
export async function syncDb(): Promise<DbMeta> {
  await ensureDb(true);
  return dbMeta();
}
