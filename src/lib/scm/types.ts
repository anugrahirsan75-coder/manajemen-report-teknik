/**
 * Proses pengadaan di SCM.
 *
 * Alur nyatanya: Teknik membuat SPPBJ → dikirim ke SCM → SCM mengundang vendor,
 * menerima penawaran, menegosiasi, menerbitkan BAHP, lalu SPBJ → Teknik
 * meng-GR/SES-nya. Yang dicatat di sini adalah PERJALANAN dokumen itu, bukan
 * salinan isinya: item, kapal, dan harga tetap tinggal di SPPBJ-nya sendiri
 * supaya tidak ada dua kebenaran.
 *
 * Tiap tahap disimpan beserta waktunya, sebab pertanyaan yang paling sering
 * muncul bukan "sudah sampai mana" melainkan "kenapa lama" — dan itu hanya
 * terjawab kalau tiap perpindahan tahap punya jam.
 */

export type TahapScm =
  | "masuk"          // SPPBJ diterima SCM
  | "inisiasi"       // didaftarkan di e-proc, nomor inisiasi terbit
  | "undangan"       // undangan + permintaan penawaran dikirim ke vendor
  | "penawaran"      // penawaran harga vendor diterima
  | "nego"           // negosiasi harga
  | "bahp"           // berita acara hasil pengadaan
  | "spbj"           // SPBJ terbit, dikirim balik ke Teknik
  | "selesai";       // GR/SES selesai — pengadaan tuntas

export const URUT_TAHAP: TahapScm[] = [
  "masuk", "inisiasi", "undangan", "penawaran", "nego", "bahp", "spbj", "selesai",
];

export const LABEL_TAHAP: Record<TahapScm, string> = {
  masuk: "Masuk SCM",
  inisiasi: "Inisiasi e-Proc",
  undangan: "Undangan vendor",
  penawaran: "Penawaran masuk",
  nego: "Negosiasi harga",
  bahp: "BAHP",
  spbj: "SPBJ terbit",
  selesai: "Selesai",
};

/** apa yang HARUS dikerjakan SCM pada tahap itu — dipakai layar antrean */
export const TINDAKAN_TAHAP: Record<TahapScm, string> = {
  masuk: "Daftarkan di e-Proc, isi nomor inisiasi",
  inisiasi: "Pilih vendor lalu kirim undangan",
  undangan: "Tunggu / catat penawaran harga vendor",
  penawaran: "Lakukan negosiasi harga",
  nego: "Terbitkan Berita Acara Hasil Pengadaan",
  bahp: "Terbitkan SPBJ dan kirim ke Teknik",
  spbj: "Menunggu GR/SES dari Teknik",
  selesai: "—",
};

export const WARNA_TAHAP: Record<TahapScm, string> = {
  masuk: "bg-slate-100 text-slate-700 ring-slate-200",
  inisiasi: "bg-sky-50 text-sky-800 ring-sky-200",
  undangan: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  penawaran: "bg-violet-50 text-violet-800 ring-violet-200",
  nego: "bg-amber-50 text-amber-800 ring-amber-200",
  bahp: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  spbj: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  selesai: "bg-emerald-600 text-white ring-emerald-700",
};

/**
 * Lama WAJAR tiap tahap dalam hari kerja. Bukan aturan resmi — dipakai layar
 * untuk menyalakan tanda "tertahan" supaya yang macet terlihat lebih dulu
 * daripada yang baru masuk kemarin.
 */
export const WAJAR_HARI: Record<TahapScm, number> = {
  masuk: 2, inisiasi: 2, undangan: 3, penawaran: 3, nego: 2, bahp: 2, spbj: 3, selesai: 0,
};

export interface JejakTahap {
  tahap: TahapScm;
  waktu: string;      // ISO
  oleh?: string;
  catatan?: string;
}

export interface Vendor {
  id: string;
  nama: string;
  pimpinan: string;
  jabatan: string;
  telepon?: string;
  fax?: string;
  npwp?: string;
  alamat?: string;
  kota?: string;
  noVendor?: string;
  nonaktif?: boolean;
}

export interface ItemNego {
  /** nomor baris item pada SPPBJ — penghubung ke item aslinya */
  idx: number;
  hargaNego?: number;   // harga satuan hasil negosiasi
}

export interface ProsesScm {
  kind: "scm";
  sppbjId: string;            // id baris pengadaan di aplikasi Teknik
  tahap: TahapScm;
  jejak: JejakTahap[];

  /** e-Proc */
  noInisiasi?: string;        // 4181/INITIATION/ASDP-DN-11-02-03/VI/2026
  tglInisiasi?: string;

  /** vendor terpilih + penawarannya */
  vendorId?: string;
  noPenawaran?: string;
  tglPenawaran?: string;

  /** negosiasi */
  potonganPersen?: number;    // potongan rata (template memakai 95% dari penawaran)
  itemNego?: ItemNego[];      // penimpaan harga per baris bila tak rata
  tglNego?: string;
  jamNego?: string;

  /** BAHP */
  tglBahp?: string;
  jamBahp?: string;

  /** SPBJ */
  noSpbj?: string;
  tglSpbj?: string;
  hariPenyerahan?: number;    // masa berlaku SPBJ (template: 7 hari)

  /** jadwal pengadaan — 7 baris di sheet JADWAL */
  jadwal?: { nama: string; mulai: string; selesai: string; ket?: string }[];

  catatan?: string;
}

export const SATU_HARI = 24 * 60 * 60 * 1000;

/** kapan tahap yang sedang berjalan dimulai */
export const mulaiTahap = (p: ProsesScm): string =>
  [...(p.jejak || [])].reverse().find((j) => j.tahap === p.tahap)?.waktu
  || (p.jejak || [])[0]?.waktu || "";

/** sudah berapa hari tertahan di tahap sekarang */
export function umurTahap(p: ProsesScm, sekarang = Date.now()): number {
  const mulai = mulaiTahap(p);
  if (!mulai) return 0;
  return Math.max(0, Math.floor((sekarang - new Date(mulai).getTime()) / SATU_HARI));
}

/** lama tiap tahap yang SUDAH dilewati, untuk menjawab "kenapa lama" */
export function lamaPerTahap(p: ProsesScm): { tahap: TahapScm; hari: number }[] {
  const j = [...(p.jejak || [])].sort((a, b) => a.waktu.localeCompare(b.waktu));
  return j.map((x, i) => {
    const akhir = j[i + 1]?.waktu ? new Date(j[i + 1].waktu).getTime() : Date.now();
    return { tahap: x.tahap, hari: Math.max(0, Math.floor((akhir - new Date(x.waktu).getTime()) / SATU_HARI)) };
  });
}

/** total hari sejak masuk SCM sampai tahap sekarang (atau selesai) */
export function totalHari(p: ProsesScm): number {
  const j = p.jejak || [];
  if (!j.length) return 0;
  const mulai = new Date(j[0].waktu).getTime();
  const akhir = p.tahap === "selesai"
    ? new Date([...j].reverse().find((x) => x.tahap === "selesai")?.waktu || Date.now()).getTime()
    : Date.now();
  return Math.max(0, Math.floor((akhir - mulai) / SATU_HARI));
}

export const tertahan = (p: ProsesScm) =>
  p.tahap !== "selesai" && umurTahap(p) > (WAJAR_HARI[p.tahap] ?? 3);

export const tahapBerikut = (t: TahapScm): TahapScm | null =>
  URUT_TAHAP[URUT_TAHAP.indexOf(t) + 1] || null;
