// Dashboard / Resume Anggaran — gabung penyerapan SPPBJ + Non PR PO, RKA, Rencana/Realisasi.

export type Kategori = "Biaya" | "Investasi";

// master mata anggaran (kode -> label + kategori). Investasi = kode prefix 10206, lainnya Biaya.
export const MATA_ANGGARAN: { kode: string; label: string; kategori: Kategori }[] = [
  { kode: "5010403003", label: "Kapal Ro-Ro", kategori: "Biaya" },
  { kode: "5010403100", label: "Permesinan & Kelistrikan Kapal", kategori: "Biaya" },
  { kode: "5010403009", label: "Akomodasi, Peralatan & Perlengkapan Kapal", kategori: "Biaya" },
  { kode: "5010317000", label: "Biaya Sertifikasi Alat Produksi Docking", kategori: "Biaya" },
  { kode: "5010318000", label: "Beban Sertifikasi Produksi Docking", kategori: "Biaya" },
  { kode: "5010302006", label: "Fumigasi", kategori: "Biaya" },
  { kode: "5010302004", label: "Mobilisasi Docking", kategori: "Biaya" },
  { kode: "5010303001", label: "Beban Bahan Pelumas", kategori: "Biaya" },
  { kode: "1020604003", label: "Investasi Kapal Ro-Ro", kategori: "Investasi" },
  { kode: "1020604009", label: "Investasi Akomodasi, Peralatan & Perlengkapan", kategori: "Investasi" },
  { kode: "1020604010", label: "Investasi Permesinan dan Kelistrikan", kategori: "Investasi" },
];

export const kategoriDariKode = (kode: string): Kategori => (/^10206/.test(kode || "") ? "Investasi" : "Biaya");
// ambil kode (angka pertama) dari label/teks mata anggaran
export const kodeMA = (s: string): string => (s || "").match(/\d{6,}/)?.[0] || "";
export const labelMA = (kode: string) => MATA_ANGGARAN.find((m) => m.kode === kode)?.label || kode;
export const fullMA = (kode: string) => (kode ? `${kode} (${labelMA(kode)})` : "(Tanpa Mata Anggaran)");

// klasifikasi Rutin vs Docking (anti-overlap): field eksplisit, else turunkan dari kategoriRekap.
export type JenisAnggaran = "rutin" | "docking" | "lainnya";
export function jenisAnggaranOf(p: { jenisAnggaran?: string; kategoriRekap?: string; programId?: string }): JenisAnggaran {
  const j = (p.jenisAnggaran || "").toLowerCase();
  if (j === "rutin" || j === "docking" || j === "lainnya") return j as JenisAnggaran;
  if (p.programId) return "lainnya"; // sudah ditautkan ke Persetujuan Biaya Lainnya
  return /docking/i.test(p.kategoriRekap || "") ? "docking" : "rutin";
}

// kategori dari teks mata anggaran (utama) atau nama pengadaan (fallback)
export function kategoriPengadaan(mataAnggaran: string[] | string | undefined, nama?: string): Kategori {
  const arr = Array.isArray(mataAnggaran) ? mataAnggaran : mataAnggaran ? [mataAnggaran] : [];
  for (const m of arr) { if (kategoriDariKode(kodeMA(m)) === "Investasi") return "Investasi"; }
  if (arr.length) return "Biaya";
  return /investasi/i.test(nama || "") ? "Investasi" : "Biaya";
}

// 13 kapal nama lengkap (TANPA singkatan di UI)
export const KAPAL_ANGGARAN = [
  "KMP. TUNA", "KMP. MAMING", "KMP. PULAU SAGORI", "KMP. PORTLINK VIII", "KMP. LOMPA",
  "KMP. NGAFI", "KMP. KOLORAI", "KMP. BARONANG", "KMP. KERAPU II", "KMP. GORANGO",
  "KMP. BOBARA", "KMP. ARIWANGAN", "KMP. LEMA",
];

// mapping singkatan sheet Rencana/Realisasi (gdrive) -> nama lengkap. UI selalu pakai nama lengkap.
export const SINGKATAN_KAPAL: Record<string, string> = {
  ARWNG: "KMP. ARIWANGAN", "PL 8": "KMP. PORTLINK VIII", PL8: "KMP. PORTLINK VIII",
  MMG: "KMP. MAMING", "KRP II": "KMP. KERAPU II", KRPII: "KMP. KERAPU II",
  LMPA: "KMP. LOMPA", TUNA: "KMP. TUNA", BRG: "KMP. BARONANG", NGF: "KMP. NGAFI",
  BBR: "KMP. BOBARA", SAGORI: "KMP. PULAU SAGORI", LMA: "KMP. LEMA",
  GRNG: "KMP. GORANGO", KLRAI: "KMP. KOLORAI",
};
export const namaKapalPenuh = (s: string): string => {
  const t = (s || "").trim();
  return SINGKATAN_KAPAL[t.toUpperCase()] || SINGKATAN_KAPAL[t] || t;
};

// Mata Anggaran standar DOCKING (dari Persetujuan Pusat "Budget Control").
// Kode dipilih agar cocok dgn yg bisa ditag di SPPBJ (biar realisasi nyambung).
export const DOCKING_MA: { kode: string; label: string }[] = [
  { kode: "5010403003", label: "Kapal Ro-Ro / Penyeberangan" },
  { kode: "5010403009", label: "Akomodasi Kapal" },
  { kode: "5010403100", label: "Permesinan & Kelistrikan" },
  { kode: "5010303001", label: "Pelumas" },
  { kode: "5010302004", label: "Mobilisasi Kapal" },
  { kode: "5010318000", label: "Sertifikat Docking Kapal" },
  { kode: "5010302006", label: "Fumigasi" },
  { kode: "5010103004", label: "Insentif Operasional (Swakelola Docking)" },
];

// Mata Anggaran INVESTASI yang bisa muncul di docking (belanja modal, bukan biaya).
// Dipisah dari DOCKING_MA supaya pagu Biaya vs Investasi tak tercampur.
export const DOCKING_MA_INVESTASI: { kode: string; label: string }[] = [
  { kode: "1020604003", label: "Investasi Kapal Ro-Ro" },
  { kode: "1020604009", label: "Investasi Akomodasi, Peralatan & Perlengkapan" },
  { kode: "1020604010", label: "Investasi Permesinan dan Kelistrikan" },
];
export const isMaInvestasi = (key: string) => key.startsWith("10206") || DOCKING_MA_INVESTASI.some((m) => m.kode === key);

// ====== RKA (acuan biaya disetujui pusat) ======
// nilai per kode mata anggaran
export interface RKA {
  tahun: number;
  nilai: Record<string, number>; // kode MA -> nilai disetujui
  catatan?: string;
}

// Rencana & Realisasi bulanan kini punya modulnya sendiri: src/lib/rr (format Lampiran 3).

// ====== Plafon Rutin bulanan (Persetujuan Rutin Kapal) ======
// Baris pagu BEBAS per Mata Anggaran (tak terkunci 9 master). Key cocok realisasi = kodeMA / slug label.
// nilai   = pagu awal (Persetujuan Pusat pertama)
// addendum = tambahan biaya yang disetujui saat/sesudah docking (pekerjaan tambah)
export interface PlafonRow { ma: string; nilai: number; addendum?: number }
export const paguTotal = (r: PlafonRow) => (r.nilai || 0) + (r.addendum || 0);
export interface PlafonRutin { bulan: string; rows: PlafonRow[]; catatan?: string }
// Pagu DOCKING per kapal + tahun (dari Persetujuan Pusat "Budget Control" — Total Persetujuan per MA)
export interface PlafonDocking {
  kapal: string; tahun: number;
  noSurat?: string;          // no. surat persetujuan awal
  noSuratAddendum?: string;  // no. surat persetujuan tambahan (addendum)
  rows: PlafonRow[];
}


// ====== Persetujuan Biaya Lainnya (di luar Rutin & Docking) ======
// 1 surat Persetujuan Pusat = 1 program. Isinya baris per KAPAL x Mata Anggaran,
// baris per KAPAL x Mata Anggaran dgn nilai Persetujuan Pusat (pagu) + Addendum.
export interface ProgramRow {
  kapal: string;      // nama kapal penuh, atau "" untuk baris umum/cabang
  ma: string;         // "5010403009 (Akomodasi Kapal)" / label bebas
  nilai: number;      // PAGU yang disetujui pusat
  addendum?: number;  // persetujuan tambahan menyusul
}
export interface PlafonProgram {
  id: string;         // dipakai untuk menautkan pengadaan (payload.programId)
  nama: string;       // mis. "Investasi Sarana Hiburan Kapal 2026"
  noSurat?: string;   // TN.205/01044/II/ASDP-2026
  tanggal?: string;   // ISO tanggal surat
  tahun: number;
  perihal?: string;
  ketRekap?: string;   // label kolom KET. di spreadsheet REKAP (default: nama)
  rows: ProgramRow[];
}
export const paguProgram = (p: PlafonProgram) => (p.rows || []).reduce((s, r) => s + (r.nilai || 0) + (r.addendum || 0), 0);

// kunci pencocokan pagu <-> realisasi.
// 1) kalau ada kode 6+ digit -> pakai kode. 2) kalau label bebas ("Pelumas", "Akomodasi Kapal")
//    -> cari MA master yg labelnya memuat semua kata (prefer Biaya) -> pakai kodenya.
//    3) fallback slug. Ini bikin pagu "Pelumas" nyambung ke SPPBJ MA "5010303001 (Beban Bahan Pelumas)".
const normLbl = (x: string) => (x || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
export function maKey(s: string): string {
  const code = kodeMA(s);
  if (code) return code;
  const q = normLbl(s);
  if (!q) return "";
  const words = q.split(" ").filter((w) => w.length >= 3);
  if (words.length) {
    const cands = MATA_ANGGARAN.filter((m) => { const l = normLbl(m.label); return words.every((w) => l.includes(w)); });
    const pick = cands.find((m) => m.kategori === "Biaya") || cands[0];
    if (pick) return pick.kode;
  }
  return q.replace(/\s+/g, "");
}

export const rupiahShort = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, "")} M`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")} jt`;
  if (a >= 1e3) return `${Math.round(n / 1e3)} rb`;
  return String(Math.round(n));
};
