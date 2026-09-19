/**
 * Rekap Dokumentasi Pekerjaan.
 *
 * Isinya PETUNJUK ke foto, bukan fotonya. Foto pekerjaan cabang berjumlah 6.400
 * berkas (7,6 GB) dan tetap tinggal di arsip laptop; yang masuk aplikasi hanya
 * keterangan tiap folder — kapal, tahun, bidang pekerjaan, jumlah, dan alamat
 * foldernya. Memindahkan fotonya ke awan tidak diminta dan tidak dibutuhkan
 * untuk menjawab pertanyaan yang biasa muncul: pekerjaan mana yang sudah ada
 * buktinya.
 */
import bibit from "./seed.json";

export interface ItemDokumentasi {
  tahun: string;
  bulan: string;
  kapal: string;
  /** dari proses apa berkas ini lahir: Docking, Joint Survey, Pengadaan, … */
  proses: string;
  /** pekerjaan teknik apa yang difoto: Permesinan, Kelistrikan, … */
  bidang: string;
  pekerjaan: string;
  foto: number;
  video: number;
  mb: number;
  dari: string;
  sampai: string;
  /** penanda salinan lintas kapal / duplikat, hasil pemeriksaan isi berkas */
  catatan: string;
  /** alamat folder relatif terhadap akar arsip */
  folder: string;
}

/** Suntingan pemakai; disimpan terpisah agar data bibit bisa disusun ulang. */
export interface UbahanDokumentasi {
  bidang?: string;
  kapal?: string;
  pekerjaan?: string;
  keterangan?: string;
  /** ditandai sudah diperiksa mata manusia */
  diperiksa?: boolean;
}

export const AKAR_ARSIP: string = (bibit as any).akar || "E:\\ASDP";
export const DISUSUN: string = (bibit as any).disusun || "";
export const SEED: ItemDokumentasi[] = ((bibit as any).item || []) as ItemDokumentasi[];

export const BIDANG_PILIHAN = [
  "Permesinan", "Kelistrikan", "Perpipaan & Katup", "Konstruksi & Pengelasan",
  "Pengecatan & Blasting", "Propulsi & Kemudi", "Jangkar, Tambat & Ramp Door",
  "Tangki & Pembersihan", "Akomodasi & Interior", "Keselamatan",
  "Navigasi & Komunikasi", "Sertifikasi & Klas", "Fasilitas Darat & Bengkel",
  "Alat Kerja & Perlengkapan", "Bahan Bakar & Pelumas", "Progres Docking Harian",
  "Pemeriksaan Joint Survey", "Belum terinci — nama berkas tak menyebut pekerjaan",
];

/** Gabungkan data bibit dengan suntingan pemakai; folder jadi kuncinya. */
export function gabung(
  seed: ItemDokumentasi[],
  ubahan: Record<string, UbahanDokumentasi>,
): (ItemDokumentasi & { diperiksa?: boolean; keterangan?: string })[] {
  return seed.map((s) => {
    const u = ubahan[s.folder];
    return u ? { ...s, ...u } : s;
  });
}

export const cocokTeks = (s: string) =>
  (s || "").toLowerCase().replace(/\s+/g, " ").trim();
