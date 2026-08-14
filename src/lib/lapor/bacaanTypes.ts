/**
 * Bentuk simpanan hasil bacaan — MURNI, dipakai peramban maupun server.
 *
 * Aturan "berkas mana yang masih perlu dibaca" ditulis SEKALI di sini. Kalau
 * peramban dan server memakai aturannya masing-masing, keduanya akan membaca
 * berkas yang sama pada saat yang sama — dua kali ongkos untuk satu jawaban.
 */
import type { BarisPermintaan } from "./skemaPermintaan";

/**
 * Naikkan bila mesin baca diperbaiki dan seluruh berkas layak dibaca ulang.
 * Bacaan berversi lama tetap ditampilkan — hanya diantre ulang di belakang.
 */
export const VERSI_BACAAN = 1;

export const KIND_BACAAN = "bacaan-berkas";
export const KIND_STATUS = "juru-baca-status";

export type StatusBacaan = "proses" | "selesai" | "gagal";

export interface BacaanBerkas {
  kind: typeof KIND_BACAAN;
  fileId: string;
  namaBerkas: string;
  kirimanId: string;
  kapal: string;
  jenis: string;
  periode: string;
  status: StatusBacaan;
  baris: BarisPermintaan[];
  mesin: string;
  catatan: string[];
  galat: string;
  /** perangkat yang mengerjakan — dipakai supaya dua pembaca tidak bertabrakan */
  perangkat: string;
  waktu: string;
  versi: number;
  /**
   * Sudah dikoreksi orang. Juru baca TIDAK BOLEH menimpanya: hasil AI yang
   * salah angka sudah dibetulkan manusia, dan membaca ulang berarti
   * mengembalikan kesalahannya.
   */
  disunting?: boolean;
}

/**
 * Denyut juru baca di laptop, disimpan sebagai satu baris.
 *
 * Gunanya cuma satu: orang yang membuka aplikasi dari Vercel atau dari ponsel
 * bisa tahu laptop kantor sedang bekerja atau sedang mati — tanpa itu, layar
 * "34 belum terbaca" tak menjelaskan apakah ia sedang diproses atau tak akan
 * pernah diproses.
 */
export interface StatusJuruBaca {
  kind: typeof KIND_STATUS;
  waktu: string;
  host: string;
  mesin: string;
  sedang: string;
  tahap: string;
  antre: number;
  selesai: number;
  gagal: number;
  jalan: boolean;
  galat: string;
}

/** klaim yang menggantung: pembaca mati di tengah jalan tak boleh mengunci berkas selamanya */
export const KLAIM_KEDALUWARSA_MENIT = 15;

export function klaimMenggantung(b: BacaanBerkas): boolean {
  if (b.status !== "proses") return false;
  const umur = (Date.now() - new Date(b.waktu || 0).getTime()) / 60000;
  return !isFinite(umur) || umur > KLAIM_KEDALUWARSA_MENIT;
}

/** apakah berkas ini masih perlu dibaca */
export function perluDibaca(ada: BacaanBerkas | undefined, aku: string): boolean {
  if (!ada) return true;
  if (ada.disunting) return false;                       // sudah dikoreksi orang
  if (ada.status === "selesai") return (ada.versi || 0) < VERSI_BACAAN;
  if (ada.status === "proses") return ada.perangkat === aku || klaimMenggantung(ada);
  return true;                                            // gagal — layak dicoba lagi
}

export const bacaanBaru = (
  fileId: string, namaBerkas: string, kiriman: { id: string; kapal: string; jenis: string; periode: string },
  perangkat: string,
): BacaanBerkas => ({
  kind: KIND_BACAAN, fileId, namaBerkas,
  kirimanId: kiriman.id, kapal: kiriman.kapal, jenis: kiriman.jenis, periode: kiriman.periode,
  status: "proses", baris: [], mesin: "", catatan: [], galat: "",
  perangkat, waktu: new Date().toISOString(), versi: VERSI_BACAAN,
});

/** berkas yang memang bisa dibaca mesin; .docx & kawan-kawan dilewati */
export const EKSTENSI_BISA = ["xlsx", "xls", "csv", "pdf", "png", "jpg", "jpeg", "webp", "heic", "heif"];

export const bisaDibaca = (nama: string) =>
  EKSTENSI_BISA.includes((nama.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || ""));

/** denyut yang lebih tua dari ini dianggap laptopnya sedang mati */
export const DENYUT_BASI_MENIT = 6;

export const denyutSegar = (s: StatusJuruBaca | null): boolean =>
  !!s && (Date.now() - new Date(s.waktu || 0).getTime()) / 60000 < DENYUT_BASI_MENIT;
