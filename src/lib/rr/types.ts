/**
 * Rencana & Realisasi Perawatan Bulanan (Lampiran 3).
 *
 * Bentuknya mengikuti berkas resmi "RENCANA <bulan> - REALISASI <bulan>":
 *   tiap KAPAL punya lembar usulan (USL) & realisasi (REAL), berisi KELOMPOK tetap
 *   (Mata Anggaran + judul kebutuhan), tiap kelompok diisi item:
 *   Deskripsi | Spesifikasi | Jumlah | Satuan | Harga Satuan | Total.
 *
 * ATURAN WAKTU KANTOR PUSAT (dipakai untuk mengingatkan & mengunci):
 *   - Budget rutin dirilis per DUA BULAN (Jan-Feb, Mar-Apr, Mei-Jun, Jul-Ags, Sep-Okt, Nov-Des).
 *   - RENCANA satu periode paling lambat diinput tanggal 22 pada bulan SEBELUM periode itu
 *     (contoh: rencana Juli & Agustus paling lambat 22 Juni).
 *   - REALISASI satu bulan paling lambat diinput tanggal 1 bulan BERIKUTNYA
 *     (contoh: realisasi Juni paling lambat 1 Juli).
 */

export type TipeRR = "rencana" | "realisasi";
export type StatusRR = "draf" | "terkirim";

/** kelompok baku: 1 Mata Anggaran bisa punya beberapa judul kebutuhan */
export interface KelompokRR { ma: string; kode: string; judul: string }

export const KELOMPOK_RR: KelompokRR[] = [
  { kode: "5010303001", ma: "Pelumas M.A. 5010303001", judul: "Kebutuhan Pelumas" },
  { kode: "5010303002", ma: "Pelumas M.A. 5010303002", judul: "Biaya Mobilisasi Pelumas" },
  { kode: "5010403003", ma: "Kapal RO-RO/Penyebrangan M.A. 5010403003", judul: "Pemeliharaan Kapal Ro-Ro" },
  { kode: "5010318000", ma: "Sertifikat Docking Kapal M.A. 5010318000", judul: "Sertifikasi Alat Produksi dalam Rangka Docking" },
  { kode: "5011099006", ma: "Fumigasi M.A. 5011099006", judul: "Fumigasi" },
  { kode: "5010302004", ma: "Mobilisasi Kapal M.A. 5010302004", judul: "Mobilisasi" },
  { kode: "5010403009", ma: "Akomodasi Kapal M.A. 5010403009", judul: "Cleaning dan Peralatan kerja" },
  { kode: "5010403009", ma: "Akomodasi Kapal M.A. 5010403009", judul: "Pemeliharaan Perlengkapan kapal" },
  { kode: "5010403009", ma: "Akomodasi Kapal M.A. 5010403009", judul: "Pemeliharaan Peralatan Kapal" },
  { kode: "5010403009", ma: "Akomodasi Kapal M.A. 5010403009", judul: "Pemeliharaan Alat Keselamatan dan Navigasi" },
  { kode: "5010403009", ma: "Akomodasi Kapal M.A. 5010403009", judul: "Lain Lain" },
  { kode: "5010403100", ma: "Permesinan dan Kelistrikan M.A. 5010403100", judul: "Cleaning dan Peralatan Kerja Mesin" },
  { kode: "5010403100", ma: "Permesinan dan Kelistrikan M.A. 5010403100", judul: "Service / Perbaikan Peralatan Permesinan" },
  { kode: "5010403100", ma: "Permesinan dan Kelistrikan M.A. 5010403100", judul: "Suku Cadang Permesinan" },
  { kode: "5010403100", ma: "Permesinan dan Kelistrikan M.A. 5010403100", judul: "Lain - Lain" },
];

/** urutan Mata Anggaran untuk rekap (sekali per kode, sesuai berkas pusat) */
export const MA_RR: { kode: string; ma: string }[] = KELOMPOK_RR.reduce((acc, k) => {
  if (!acc.some((x) => x.kode === k.kode)) acc.push({ kode: k.kode, ma: k.ma });
  return acc;
}, [] as { kode: string; ma: string }[]);

export const kunciKelompok = (k: { kode: string; judul: string }) => `${k.kode}|${k.judul}`;

export interface RrItem {
  id: string;
  deskripsi: string;
  spesifikasi: string;
  jumlah: number;
  satuan: string;
  harga: number;
}
export interface RrKelompok {
  kunci: string;              // `${kode}|${judul}`
  items: RrItem[];
}
export interface RrDoc {
  id: string;
  tipe: TipeRR;
  bulan: string;              // "YYYY-MM" bulan yang direncanakan / direalisasikan
  kapal: string;
  kelompok: RrKelompok[];
  ppnPersen: number;          // 0 atau 11
  status: StatusRR;
  dikirimPada?: string;       // ISO — terisi saat ditandai terkirim (mengunci)
  catatan?: string;
  diubahPada: string;         // ISO
}

export const nilaiItem = (i: RrItem) => (i.jumlah || 0) * (i.harga || 0);
export const totalKelompok = (k: RrKelompok) => (k.items || []).reduce((s, i) => s + nilaiItem(i), 0);
export function totalDoc(d: RrDoc) {
  const dasar = (d.kelompok || []).reduce((s, k) => s + totalKelompok(k), 0);
  const ppn = Math.round((dasar * (d.ppnPersen || 0)) / 100);
  return { dasar, ppn, total: dasar + ppn };
}
/** total per kode Mata Anggaran (untuk rekap Budget Control Rutin) */
export function totalPerMA(d: RrDoc): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of d.kelompok || []) {
    const kode = k.kunci.split("|")[0];
    out[kode] = (out[kode] || 0) + totalKelompok(k);
  }
  return out;
}

// ====================== aturan waktu ======================

const p2 = (n: number) => String(n).padStart(2, "0");
export const bulanKe = (bulan: string, delta: number) => {
  const [y, m] = bulan.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
};
export const bulanDari = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export function namaBulan(bulan: string) {
  const [y, m] = bulan.split("-").map(Number);
  return `${NAMA_BULAN[(m || 1) - 1]} ${y}`;
}
export const singkatBulan = (bulan: string) => namaBulan(bulan).slice(0, 3).toUpperCase();

/** periode rilis 2-bulanan yang memuat bulan ini (mulai selalu bulan ganjil) */
export interface Periode { mulai: string; akhir: string; label: string; tenggat: Date }
export function periodeDari(bulan: string): Periode {
  const [y, m] = bulan.split("-").map(Number);
  const mMulai = m % 2 === 1 ? m : m - 1;      // Jan-Feb, Mar-Apr, ...
  const mulai = `${y}-${p2(mMulai)}`;
  const akhir = bulanKe(mulai, 1);
  // tenggat = tanggal 22 pada bulan sebelum periode dimulai
  const sebelum = bulanKe(mulai, -1);
  const [ty, tm] = sebelum.split("-").map(Number);
  return {
    mulai, akhir,
    label: `${namaBulan(mulai).split(" ")[0]} & ${namaBulan(akhir)}`,
    tenggat: new Date(ty, tm - 1, 22, 23, 59, 59),
  };
}
/** periode rencana yang sedang harus diisi bila hari ini = now */
export function periodeAktif(now = new Date()): Periode {
  const ini = periodeDari(bulanDari(now));
  const berikut = periodeDari(bulanKe(ini.mulai, 2));
  // selama tenggat periode berikutnya belum lewat, itulah yang sedang diisi
  return now <= berikut.tenggat ? berikut : periodeDari(bulanKe(berikut.mulai, 2));
}
/** tenggat realisasi bulan tsb = tanggal 1 bulan berikutnya */
export function tenggatRealisasi(bulan: string): Date {
  const b = bulanKe(bulan, 1);
  const [y, m] = b.split("-").map(Number);
  return new Date(y, m - 1, 1, 23, 59, 59);
}
export function tenggatRencana(bulan: string): Date {
  return periodeDari(bulan).tenggat;
}
export function tenggatDoc(tipe: TipeRR, bulan: string): Date {
  return tipe === "rencana" ? tenggatRencana(bulan) : tenggatRealisasi(bulan);
}

export type TingkatTenggat = "aman" | "dekat" | "mendesak" | "lewat";
export interface StatusTenggat { tingkat: TingkatTenggat; sisaHari: number; teks: string; tenggat: Date }
export function statusTenggat(tenggat: Date, now = new Date()): StatusTenggat {
  const ms = tenggat.getTime() - now.getTime();
  // hitung selisih HARI KALENDER (bukan jam), supaya "H-8" berarti tanggalnya memang 8 hari lagi
  const hari0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const hariT = new Date(tenggat.getFullYear(), tenggat.getMonth(), tenggat.getDate()).getTime();
  const sisaHari = Math.round((hariT - hari0) / 86400000);
  const tgl = `${tenggat.getDate()} ${NAMA_BULAN[tenggat.getMonth()]} ${tenggat.getFullYear()}`;
  if (ms < 0) return { tingkat: "lewat", sisaHari, teks: `lewat tenggat ${tgl}`, tenggat };
  if (sisaHari <= 3) return { tingkat: "mendesak", sisaHari, teks: `tinggal ${sisaHari} hari — batas ${tgl}`, tenggat };
  if (sisaHari <= 7) return { tingkat: "dekat", sisaHari, teks: `${sisaHari} hari lagi — batas ${tgl}`, tenggat };
  return { tingkat: "aman", sisaHari, teks: `batas ${tgl}`, tenggat };
}

/** bulan realisasi yang wajib diisi sekarang (bulan lalu bila tanggal 1, else bulan berjalan) */
export function bulanRealisasiAktif(now = new Date()): string {
  const ini = bulanDari(now);
  return now.getDate() === 1 ? bulanKe(ini, -1) : ini;
}
