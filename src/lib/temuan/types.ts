/**
 * Monitoring temuan pemeriksaan kapal sampai pemenuhannya.
 *
 * Temuan datang dari beberapa pihak yang berbeda kewenangannya — Marine
 * Inspector KSOP lewat pemeriksaan CIC, auditor internal, dan surveyor klas —
 * dan yang menentukan mendesaknya bukan siapa yang menemukan melainkan apa
 * akibatnya bila tidak dipenuhi. Temuan Major menahan Surat Persetujuan
 * Berlayar; temuan Observation tidak. Karena itu kategori dan prioritas
 * disimpan terpisah: kategori milik pemeriksa, prioritas milik cabang.
 *
 * Sebuah temuan dianggap selesai hanya kalau ada BUKTINYA. Status CLOSED tanpa
 * satu pun dokumen bukti adalah laporan yang tidak bisa diperiksa siapa pun,
 * dan lembar monitoring yang seluruhnya hijau tanpa bukti justru lebih
 * berbahaya daripada lembar yang jujur menunjukkan tunggakan.
 */

export type StatusTemuan = "open" | "proses" | "closed";

export const STATUS_LABEL: Record<StatusTemuan, string> = {
  open: "OPEN",
  proses: "ON PROGRESS",
  closed: "CLOSED",
};

export const STATUS_WARNA: Record<StatusTemuan, string> = {
  open: "bg-red-100 text-red-700 ring-red-200",
  proses: "bg-amber-100 text-amber-700 ring-amber-200",
  closed: "bg-emerald-100 text-emerald-700 ring-emerald-200",
};

/** kategori sebagaimana ditulis pemeriksa pada laporannya */
export const KATEGORI = ["Major", "Minor", "Observation"] as const;
export type Kategori = (typeof KATEGORI)[number];

export const PRIORITAS = ["Tinggi", "Sedang", "Rendah"] as const;
export type Prioritas = (typeof PRIORITAS)[number];

/** prioritas bawaan menurut kategori; tetap boleh diubah cabang */
export const PRIORITAS_BAWAAN: Record<string, Prioritas> = {
  Major: "Tinggi",
  Minor: "Sedang",
  Observation: "Rendah",
};

export const PENERBIT = [
  "Marine Inspector",
  "Auditor Internal",
  "Surveyor Klasifikasi (BKI)",
  "Syahbandar / KSOP",
  "Owner Surveyor",
];

/** satu berkas bukti pemenuhan */
export interface BuktiTemuan {
  id: string;
  nama: string;
  /** URL di Supabase Storage, atau tautan Drive bila berkasnya terlalu besar */
  url: string;
  /** "unggahan" bila berkasnya diunggah ke Storage, "tautan" bila hanya ditaut */
  jenis: "unggahan" | "tautan";
  /** ukuran bita; 0 untuk tautan luar */
  bita: number;
  diunggahPada: string;
  catatan: string;
}

export interface TemuanItem {
  id: string;
  kapal: string;
  /** rumusan temuan apa adanya dari laporan pemeriksa */
  deskripsi: string;
  kategori: string;
  penerbit: string;
  /** nomor/judul laporan sumber, mis. "Laporan CIC 28-09-2026" */
  sumber: string;
  referensi: string;
  tglTemuan: string;
  jatuhTempo: string;

  prioritas: string;
  rencanaTindakLanjut: string;
  penanggungJawab: string;
  targetSelesai: string;
  prosesSaatIni: string;
  pihakProses: string;
  tglRealisasi: string;

  status: StatusTemuan;
  bukti: BuktiTemuan[];
  catatan: string;
  createdAt?: string;
  updatedAt?: string;
}

export const temuanKosong = (): TemuanItem => ({
  id: (globalThis.crypto?.randomUUID?.() || String(Date.now())),
  kapal: "", deskripsi: "", kategori: "Minor", penerbit: PENERBIT[0], sumber: "",
  referensi: "", tglTemuan: "", jatuhTempo: "",
  prioritas: "Sedang", rencanaTindakLanjut: "", penanggungJawab: "", targetSelesai: "",
  prosesSaatIni: "", pihakProses: "", tglRealisasi: "",
  status: "open", bukti: [], catatan: "",
});

/**
 * Sisa hari sampai jatuh tempo; negatif berarti sudah lewat.
 *
 * Dihitung terhadap tengah malam, bukan terhadap jam sekarang — temuan yang
 * jatuh tempo hari ini bukan temuan yang terlambat, dan menampilkannya merah
 * sejak pagi membuat daftar merah yang tak bisa dipercaya.
 */
export function sisaHari(jatuhTempo: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((jatuhTempo || "").trim());
  if (!m) return null;
  const tempo = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const kini = new Date();
  const hariIni = Date.UTC(kini.getFullYear(), kini.getMonth(), kini.getDate());
  return Math.round((tempo - hariIni) / 86400000);
}

/** Boleh ditutup hanya bila ada bukti — lihat catatan di kepala berkas ini. */
export function bolehDitutup(t: TemuanItem): boolean {
  return (t.bukti || []).length > 0;
}
