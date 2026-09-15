/**
 * Data kepala surat — bagian yang biasanya dibuatkan sendiri oleh e-office.
 *
 * Untuk menempel ke e-office bagian ini tidak diperlukan: nomor, tanggal,
 * tujuan, dan tanda tangan sudah diurus aplikasinya. Tetapi untuk mencetak
 * KONSEP surat lengkap menjadi PDF, semuanya harus ada — dan konsep itulah yang
 * diedarkan ke pimpinan sebelum suratnya benar-benar diterbitkan.
 */
import { DataSurat, TemplateSurat } from "./types";
import { NAMA_BULAN, romawi, tanggalSurat } from "./format";

export interface PenandaTangan {
  nama: string;
  jabatan: string;
  /** jabatan sebelum nomenklatur 2026 — dipakai kalau surat bertanggal lebih awal */
  jabatanLama?: string;
}

/** tahun berlakunya nomenklatur baru: "Manager" berganti "Department Head" */
export const TAHUN_NOMENKLATUR = 2026;

/**
 * Pejabat penanda tangan surat cabang. Daftar ini hanya NAMA dan JABATAN —
 * tanda tangan elektroniknya sendiri terbit dari e-office saat surat disahkan,
 * dan tidak pernah disalin dari surat lain.
 */
export const PENANDA_TANGAN: PenandaTangan[] = [
  { nama: "Mushar Usman", jabatan: "General Manager Ternate" },
  { nama: "Muchlis Burhanuddin", jabatan: "PGS. General Manager Ternate" },
  {
    nama: "Eryanto Sidabalok",
    jabatan: "Department Head Operasional dan Teknik Ternate",
    jabatanLama: "Manager Teknik Ternate",
  },
];

/** tahun pada tanggal surat; kalau tanggalnya belum diisi, tahun berjalan */
export function tahunSurat(tanggalIso: string): number {
  const m = /^(\d{4})-/.exec((tanggalIso || "").trim());
  return m ? Number(m[1]) : new Date().getFullYear();
}

/**
 * Jabatan yang dipakai pada tanggal surat tertentu.
 *
 * Surat bertanggal 2025 harus menyebut jabatan yang berlaku waktu itu. Pak
 * Eryanto baru menjadi Department Head pada 2026; sebelum itu Manager Teknik,
 * dan surat lama yang menyebutnya Department Head akan salah di arsip.
 */
export function jabatanPada(p: PenandaTangan, tanggalIso: string): string {
  if (!p.jabatanLama) return p.jabatan;
  return tahunSurat(tanggalIso) < TAHUN_NOMENKLATUR ? p.jabatanLama : p.jabatan;
}

/** kode klasifikasi yang dipakai surat teknik cabang */
export const KODE_SURAT = [
  "TN.101", "UM.301", "KU.302", "PA.111", "HK.204", "OP.201",
];

/** nomor urut belum terbit: ditulis sebagai isian titik-titik, seperti surat konsep */
export const URUT_KOSONG = "[...]";

/**
 * TN.101/00241/VI/ASDP-TTE/2026 — bulan romawi dan tahunnya diambil dari
 * tanggal surat, bukan diketik. Nomor yang bulannya tidak cocok dengan
 * tanggalnya adalah nomor yang tidak akan diakui arsip.
 */
export function susunNomor(kode: string, urut: string, tanggalIso: string): string {
  const m = /^(\d{4})-(\d{2})-/.exec((tanggalIso || "").trim());
  const tahun = String(tahunSurat(tanggalIso));
  const bulan = romawi(m ? Number(m[2]) : new Date().getMonth() + 1);
  const angka = (urut || "").replace(/\D/g, "");
  return `${kode || "TN.101"}/${angka ? angka.padStart(5, "0") : URUT_KOSONG}/${bulan}/ASDP-TTE/${tahun}`;
}

/** "Ternate, 13 September 2026" */
export function tanggalKop(tanggalIso: string, kota = "Ternate"): string {
  const teks = tanggalSurat(tanggalIso);
  if (teks) return `${kota}, ${teks}`;
  const n = new Date();
  return `${kota}, ${n.getDate()} ${NAMA_BULAN[n.getMonth()]} ${n.getFullYear()}`;
}

/**
 * Perihal bawaan: pola template diisi dari borangnya sendiri.
 *
 * Penanda yang tidak punya isian dibuang berikut spasi berlebihnya — pola
 * penunjukan langsung memuat {lingkup} yang memang sering kosong, dan
 * membiarkannya membuat perihal berbunyi "Docking dan  Kmp. Lompa".
 */
export function perihalBawaan(t: TemplateSurat, d: DataSurat): string {
  return t.perihal
    .replace(/\{(\w+)\}/g, (_, kunci) => String(d?.[kunci] ?? "").trim())
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

/**
 * Tujuan bawaan, penandanya diisi dari borang.
 *
 * Surat dock space dialamatkan ke direktur galangan, dan galangannya berbeda
 * tiap kapal — tujuannya karena itu tidak bisa berupa kalimat tetap. Diperlakukan
 * sama seperti perihal: pola template diisi dari isiannya sendiri.
 */
export function tujuanBawaan(t: TemplateSurat, d: DataSurat): string {
  return t.tujuan
    .replace(/\{(\w+)\}/g, (_, kunci) => String(d?.[kunci] ?? "").trim())
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** "Direktur Teknik — Jakarta" dipecah jadi jabatan dan kota tujuan */
export function pisahTujuan(tujuan: string): { jabatan: string; kota: string } {
  const [jabatan, kota] = String(tujuan || "").split(/\s*[—–-]\s*/);
  return { jabatan: (jabatan || "").trim(), kota: (kota || "Jakarta").trim() };
}

export const TEMBUSAN_SERING = [
  "EXECUTIVE DIRECTOR REGIONAL IV",
  "GROUP HEAD OPTIMASI DAN MANAJEMEN ARMADA",
  "KEPALA SATUAN PENGAWASAN INTERN",
  "MANAGER TEKNIK CABANG TERNATE",
  "OWNER SURVEYOR",
];
