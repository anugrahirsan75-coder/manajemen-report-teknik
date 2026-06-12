// Dashboard / Resume Anggaran — gabung penyerapan SPPBJ + Non PR PO, RKA, Rencana/Realisasi.

export type Kategori = "Biaya" | "Investasi";

// master mata anggaran (kode -> label + kategori). Investasi = kode prefix 10206, lainnya Biaya.
export const MATA_ANGGARAN: { kode: string; label: string; kategori: Kategori }[] = [
  { kode: "5010403003", label: "Kapal Ro-Ro", kategori: "Biaya" },
  { kode: "5010403100", label: "Permesinan & Kelistrikan Kapal", kategori: "Biaya" },
  { kode: "5010403009", label: "Akomodasi, Peralatan & Perlengkapan Kapal", kategori: "Biaya" },
  { kode: "5010317000", label: "Biaya Sertifikasi Alat Produksi Docking", kategori: "Biaya" },
  { kode: "5010302006", label: "Fumigasi", kategori: "Biaya" },
  { kode: "5010302004", label: "Mobilisasi Docking", kategori: "Biaya" },
  { kode: "1020604003", label: "Investasi Kapal Ro-Ro", kategori: "Investasi" },
  { kode: "1020604009", label: "Investasi Akomodasi, Peralatan & Perlengkapan", kategori: "Investasi" },
  { kode: "1020604010", label: "Investasi Permesinan dan Kelistrikan", kategori: "Investasi" },
];

export const kategoriDariKode = (kode: string): Kategori => (/^10206/.test(kode || "") ? "Investasi" : "Biaya");
// ambil kode (angka pertama) dari label/teks mata anggaran
export const kodeMA = (s: string): string => (s || "").match(/\d{6,}/)?.[0] || "";
export const labelMA = (kode: string) => MATA_ANGGARAN.find((m) => m.kode === kode)?.label || kode;
export const fullMA = (kode: string) => (kode ? `${kode} (${labelMA(kode)})` : "(Tanpa Mata Anggaran)");

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

// 3 mata anggaran Biaya untuk Rencana/Realisasi bulanan
export const MA_RENCANA: { kode: string; label: string }[] = [
  { kode: "5010403003", label: "Kapal Ro-Ro" },
  { kode: "5010403009", label: "Akomodasi" },
  { kode: "5010403100", label: "Permesinan" },
];

// ====== RKA (acuan biaya disetujui pusat) ======
// nilai per kode mata anggaran
export interface RKA {
  tahun: number;
  nilai: Record<string, number>; // kode MA -> nilai disetujui
  catatan?: string;
}

// ====== Rencana & Realisasi bulanan (3 MA biaya, per kapal) ======
// key bulan "YYYY-MM"; nilai[kapal][kodeMA]
export interface RREntry {
  bulan: string;           // YYYY-MM
  tipe: "rencana" | "realisasi";
  nilai: Record<string, Record<string, number>>; // kapal -> { kodeMA: nilai }
}

export const rupiahShort = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, "")} M`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")} jt`;
  if (a >= 1e3) return `${Math.round(n / 1e3)} rb`;
  return String(Math.round(n));
};
