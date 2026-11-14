/**
 * Monitor Pekerjaan — daftar kerja pribadi staf Teknik.
 *
 * Bukan modul pengadaan dan bukan modul kapal: satu baris adalah satu hal yang
 * sedang dipegang seseorang, dari "susun repair list docking Tuna" sampai
 * "kirim laporan bulanan ke pusat". Yang dijaga halaman ini hanya dua: jangan
 * sampai ada pekerjaan yang terlupa, dan untuk tiap pekerjaan selalu jelas
 * langkah berikutnya apa serta sedang menunggu siapa.
 *
 * Datanya menumpang tabel `projects` dengan payload.kind = "monitor_pekerjaan".
 */

export const KIND_MONITOR = "monitor_pekerjaan";

export type StatusPekerjaan = "belum" | "jalan" | "menunggu" | "selesai" | "batal";

export const URUTAN_STATUS: StatusPekerjaan[] = ["belum", "jalan", "menunggu", "selesai", "batal"];

export const STATUS_LABEL: Record<StatusPekerjaan, string> = {
  belum: "Belum mulai",
  jalan: "Sedang dikerjakan",
  menunggu: "Menunggu pihak lain",
  selesai: "Selesai",
  batal: "Batal",
};

export const STATUS_WARNA: Record<StatusPekerjaan, string> = {
  belum: "bg-slate-100 text-slate-700 ring-slate-300",
  jalan: "bg-sky-100 text-sky-800 ring-sky-200",
  menunggu: "bg-violet-100 text-violet-800 ring-violet-200",
  selesai: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  batal: "bg-zinc-100 text-zinc-500 ring-zinc-200",
};

/** warna garis kartu ringkasan, sejajar dengan STATUS_WARNA */
export const STATUS_BAR: Record<StatusPekerjaan, string> = {
  belum: "bg-slate-400",
  jalan: "bg-sky-500",
  menunggu: "bg-violet-500",
  selesai: "bg-emerald-600",
  batal: "bg-zinc-400",
};

/** pekerjaan yang masih harus dipikirkan — selesai & batal sudah lepas dari tangan */
export const masihAktif = (s: StatusPekerjaan) => s !== "selesai" && s !== "batal";

export const KATEGORI = ["Docking", "Rutin", "Investasi", "Administrasi", "Lainnya"] as const;
export type Kategori = (typeof KATEGORI)[number];

export const KATEGORI_WARNA: Record<string, string> = {
  Docking: "bg-blue-50 text-blue-800 ring-blue-200",
  Rutin: "bg-teal-50 text-teal-800 ring-teal-200",
  Investasi: "bg-amber-50 text-amber-800 ring-amber-200",
  Administrasi: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200",
  Lainnya: "bg-slate-50 text-slate-700 ring-slate-200",
};

export const PRIORITAS = ["Tinggi", "Sedang", "Rendah"] as const;
export type Prioritas = (typeof PRIORITAS)[number];

export const PRIORITAS_WARNA: Record<string, string> = {
  Tinggi: "text-red-700",
  Sedang: "text-amber-700",
  Rendah: "text-slate-500",
};

/** bobot urut: Tinggi dulu */
export const BOBOT_PRIORITAS: Record<string, number> = { Tinggi: 0, Sedang: 1, Rendah: 2 };

export interface Pekerjaan {
  id: string;
  /** pemilik / PIC; bisa lebih dari satu orang */
  pemilik: string[];
  judul: string;
  kategori: string;
  /** kapal terkait; kosong bila pekerjaannya tidak menyangkut kapal tertentu */
  kapal: string[];
  prioritas: string;
  status: StatusPekerjaan;
  tglMulai: string;
  tenggat: string;
  /** 0–100 */
  progres: number;
  langkahBerikut: string;
  menungguSiapa: string;
  /** No. PR / SPPBJ / PO, atau tautan berkas */
  dokumen: string;
  catatan: string;
  tglSelesai: string;
  createdAt?: string;
  updatedAt?: string;
}

/** UUID v4 — kolom id tabel projects bertipe uuid, jadi cadangannya pun harus berbentuk UUID */
export function idBaru(): string {
  const asli = globalThis.crypto?.randomUUID?.();
  if (asli) return asli;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const hariIniIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const pekerjaanKosong = (pemilik: string): Pekerjaan => ({
  id: idBaru(),
  pemilik: pemilik.trim() ? [pemilik.trim()] : [],
  judul: "", kategori: "Rutin", kapal: [], prioritas: "Sedang", status: "belum",
  tglMulai: hariIniIso(), tenggat: "", progres: 0,
  langkahBerikut: "", menungguSiapa: "", dokumen: "", catatan: "", tglSelesai: "",
});

/**
 * Rapikan sebelum disimpan, supaya status dan angkanya tidak saling membantah:
 * pekerjaan Selesai tercatat 100% dan bertanggal selesai, pekerjaan yang dibuka
 * kembali tidak membawa tanggal selesai lamanya.
 */
export function rapikan(p: Pekerjaan): Pekerjaan {
  const x: Pekerjaan = {
    ...p,
    judul: (p.judul || "").trim(),
    pemilik: Array.from(new Set((p.pemilik || []).map((s) => s.trim()).filter(Boolean))),
    kapal: Array.from(new Set((p.kapal || []).filter(Boolean))),
    progres: Math.max(0, Math.min(100, Math.round(Number(p.progres) || 0))),
  };
  if (x.status === "selesai") {
    x.progres = 100;
    if (!x.tglSelesai) x.tglSelesai = hariIniIso();
  } else if (x.status !== "batal") {
    x.tglSelesai = "";
  }
  return x;
}

/** bentuk aman dari baris lama/rusak — kolom yang hilang diisi bawaan */
export function dariPayload(id: string, raw: any): Pekerjaan {
  const daftar = (v: any): string[] =>
    Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? v.split(",").map((s) => s.trim()) : [];
  const status: StatusPekerjaan = URUTAN_STATUS.includes(raw?.status) ? raw.status : "belum";
  return {
    id,
    pemilik: daftar(raw?.pemilik).filter(Boolean),
    judul: String(raw?.judul || ""),
    kategori: String(raw?.kategori || "Lainnya"),
    kapal: daftar(raw?.kapal).filter(Boolean),
    prioritas: String(raw?.prioritas || "Sedang"),
    status,
    tglMulai: String(raw?.tglMulai || ""),
    tenggat: String(raw?.tenggat || ""),
    progres: Number(raw?.progres) || 0,
    langkahBerikut: String(raw?.langkahBerikut || ""),
    menungguSiapa: String(raw?.menungguSiapa || ""),
    dokumen: String(raw?.dokumen || ""),
    catatan: String(raw?.catatan || ""),
    tglSelesai: String(raw?.tglSelesai || ""),
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
  };
}

/**
 * Sisa hari sampai tenggat; negatif berarti lewat.
 *
 * Dihitung antar-tengah malam: pekerjaan bertenggat hari ini belum terlambat,
 * dan menandainya merah sejak pagi membuat warna merah kehilangan artinya.
 */
export function sisaHari(tenggat: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((tenggat || "").trim());
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const kini = new Date();
  const hariIni = Date.UTC(kini.getFullYear(), kini.getMonth(), kini.getDate());
  return Math.round((t - hariIni) / 86400000);
}

export type Tanda = "telat" | "dekat" | null;

/** merah bila lewat tenggat, kuning bila tenggatnya tinggal ≤3 hari */
export function tandaTenggat(p: Pekerjaan): Tanda {
  if (!masihAktif(p.status)) return null;
  const s = sisaHari(p.tenggat);
  if (s === null) return null;
  if (s < 0) return "telat";
  if (s <= 3) return "dekat";
  return null;
}

/** sisa hari menuju Minggu pekan ini (Senin = awal pekan) */
export function sisaKeMinggu(): number {
  const h = new Date().getDay(); // 0 = Minggu
  return h === 0 ? 0 : 7 - h;
}

/** tautan bila isian dokumen berupa URL */
export const adalahTautan = (s: string) => /^https?:\/\//i.test((s || "").trim());
