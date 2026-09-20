/**
 * Catatan pengerjaan PMS — siapa mengerjakan apa, kapan, dan siapa mengesahkan.
 *
 * Dua pihak mengisi tempat yang sama, dengan alasan berbeda:
 *
 *   ABK DI KAPAL yang mengerjakan. Merekalah satu-satunya yang tahu pekerjaan
 *   itu benar-benar selesai dan pada jam berapa. Kalau kantor yang harus
 *   mengetik semuanya, catatan selalu tertinggal beberapa hari di belakang
 *   kenyataan — dan PMS yang tertinggal tidak dipakai orang.
 *
 *   STAF KANTOR yang mengesahkan, dan ikut mencatat untuk pekerjaan yang
 *   dikerjakan pihak ketiga (bengkel, docking) atau dilaporkan lewat jalan lain.
 *
 * Yang dicatat adalah PERISTIWA, bukan keadaan. Rencana kerja boleh diubah
 * intervalnya atau dihapus tahun depan; peristiwa "12 Agustus 2026 ganti oli
 * ME-01 pada 1.240 jam" tidak boleh ikut berubah. Karena itu nama pekerjaan dan
 * tagnya DISALIN ke dalam catatan, tidak ditunjuk lewat id saja.
 */
import { Basis, RencanaKerja, idBaru } from "./types";

export const KIND_KERJA = "pms_kerja";

export type SumberKerja = "kapal" | "kantor";
export type StatusKerja = "menunggu" | "disahkan" | "ditolak";

export interface Pengerjaan {
  id: string;
  /** rencana yang dipenuhi; boleh tak ada lagi di kemudian hari */
  rencanaId: string;
  tag: string;
  /** salinan nama pekerjaan saat itu — riwayat harus terbaca tanpa rencananya */
  pekerjaan: string;
  basis: Basis;
  /** tanggal pekerjaan DIKERJAKAN (bukan tanggal dicatat) */
  tanggal: string;
  /** jam jalan mesin saat dikerjakan, untuk rencana berbasis jam */
  jam?: number;
  /** yang mengerjakan di kapal — jabatan atau nama */
  pelaksana: string;
  catatan?: string;
  sukuCadangDipakai?: string;
  sumber: SumberKerja;
  /** akun yang mengetik: akun portal kapal atau nama staf kantor */
  olehAkun: string;
  dicatatPada: string;

  status: StatusKerja;
  disahkanOleh?: string;
  disahkanPada?: string;
  alasanTolak?: string;

  /**
   * Capaian rencana SEBELUM catatan ini dipakai.
   *
   * Disimpan supaya penolakan bisa mengembalikan keadaan persis seperti semula.
   * Tanpa ini, satu laporan keliru yang sudah terlanjur menggeser jam jalan
   * hanya bisa dibetulkan dengan menebak angka lamanya.
   */
  sebelumTanggal?: string;
  sebelumJam?: number;
}

export interface PmsKerjaKapal {
  kapal: string;
  riwayat: Pengerjaan[];
  diubahPada?: string;
}

/** batas riwayat per kapal — tua dibuang supaya satu baris tidak menggelembung */
export const BATAS_RIWAYAT = 600;

export const WARNA_KERJA: Record<StatusKerja, string> = {
  menunggu: "bg-amber-100 text-amber-800 ring-amber-300",
  disahkan: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  ditolak: "bg-rose-100 text-rose-800 ring-rose-300",
};

export const LABEL_KERJA: Record<StatusKerja, string> = {
  menunggu: "Menunggu pengesahan",
  disahkan: "Disahkan",
  ditolak: "Ditolak",
};

/**
 * Bagian kapal yang lazim memegang pekerjaan itu, ditebak dari penanggungnya.
 *
 * Dipakai HANYA untuk mengurutkan tampilan di portal — akun Mesin melihat
 * pekerjaan kamar mesin lebih dulu. Bukan penghalang: satu kapal kerap
 * kekurangan orang, dan mengunci Mualim dari mencatat pekerjaan pompa got
 * berarti pekerjaan itu tidak tercatat sama sekali.
 */
export function bagianRencana(penanggung: string): "deck" | "mesin" | "lain" {
  const p = penanggung.toLowerCase();
  if (/nakhoda|mualim/.test(p)) return "deck";
  if (/kkm|masinis|mandor/.test(p)) return "mesin";
  return "lain";
}

/** catatan kosong siap isi */
export const pengerjaanBaru = (r: RencanaKerja, sumber: SumberKerja): Pengerjaan => ({
  id: idBaru(),
  rencanaId: r.id,
  tag: r.tag,
  pekerjaan: r.pekerjaan,
  basis: r.basis,
  tanggal: new Date().toISOString().slice(0, 10),
  pelaksana: r.penanggung,
  sukuCadangDipakai: r.sukuCadang || "",
  sumber,
  olehAkun: "",
  dicatatPada: new Date().toISOString(),
  status: sumber === "kantor" ? "disahkan" : "menunggu",
  sebelumTanggal: r.terakhirTanggal,
  sebelumJam: r.terakhirJam,
});

/**
 * Pasang capaian sebuah catatan ke rencananya.
 *
 * Jamnya digeser SEKARANG, sebelum kantor mengesahkan. Alasannya: pekerjaannya
 * memang sudah dikerjakan, dan menahan pergeseran sampai ada tanda tangan
 * membuat daftar jatuh tempo memperlihatkan tunggakan palsu selama berhari-hari
 * — persis jenis angka salah yang membuat orang berhenti melihat daftar itu.
 * Yang ditahan adalah pengesahannya, bukan kenyataannya.
 */
export function terapkan(r: RencanaKerja, k: Pengerjaan): RencanaKerja {
  return {
    ...r,
    terakhirTanggal: k.tanggal,
    terakhirJam: k.basis === "jam" && k.jam !== undefined ? k.jam : r.terakhirJam,
  };
}

/**
 * Kembalikan capaian ke keadaan sebelum catatan itu — dipakai saat ditolak.
 *
 * Hanya dikembalikan bila rencananya masih memegang angka dari catatan ini.
 * Kalau sesudahnya sudah ada pengerjaan lain yang lebih baru, mengembalikan
 * angka lama justru memundurkan catatan yang benar.
 */
export function kembalikan(r: RencanaKerja, k: Pengerjaan): RencanaKerja {
  const masihMilikDia =
    r.terakhirTanggal === k.tanggal &&
    (k.basis !== "jam" || k.jam === undefined || r.terakhirJam === k.jam);
  if (!masihMilikDia) return r;
  return { ...r, terakhirTanggal: k.sebelumTanggal, terakhirJam: k.sebelumJam };
}

/** urutan baca riwayat: yang paling baru dikerjakan di atas */
export const urutRiwayat = (a: Pengerjaan, b: Pengerjaan) =>
  (b.tanggal || "").localeCompare(a.tanggal || "") ||
  (b.dicatatPada || "").localeCompare(a.dicatatPada || "");
