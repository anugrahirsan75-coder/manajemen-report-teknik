import { ProsesScm, TahapScm } from "./types";

/**
 * Isian milik TIAP TAHAP.
 *
 * Borang tidak ditampilkan sekaligus. Alasannya bukan kerapian layar: tanggal
 * BAHP yang bisa diisi sebelum negosiasi terjadi membuat jejak waktunya
 * bohong, dan jejak itulah satu-satunya bukti kenapa sebuah pengadaan lama.
 * Jadi tiap tahap hanya membuka isian yang memang sudah bisa dijawab pada saat
 * itu, dan tahap berikutnya baru terbuka setelah isian wajibnya lengkap.
 *
 * Yang sudah lewat tetap bisa diperbaiki lewat "semua isian" — koreksi salah
 * ketik tak boleh butuh mengulang seluruh proses.
 */
export interface MedanTahap {
  id: keyof ProsesScm;
  label: string;
  jenis: "teks" | "tanggal" | "angka" | "vendor" | "textarea";
  wajib?: boolean;
  petunjuk?: string;
  contoh?: string;
}

export const ISIAN_TAHAP: Record<TahapScm, MedanTahap[]> = {
  masuk: [],
  inisiasi: [
    { id: "noInisiasi", label: "No. Inisiasi e-Proc", jenis: "teks", wajib: true,
      contoh: "4181/INITIATION/ASDP-DN-11-02-03/VI/2026",
      petunjuk: "Empat angka pertamanya dipakai untuk seluruh nomor dokumen." },
    { id: "tglInisiasi", label: "Tanggal inisiasi", jenis: "tanggal", wajib: true },
  ],
  undangan: [
    { id: "vendorId", label: "Vendor yang diundang", jenis: "vendor", wajib: true },
  ],
  penawaran: [
    { id: "noPenawaran", label: "Nomor penawaran harga", jenis: "teks", wajib: true, contoh: "789-2/QUOT/BBS/JKT/VI/2026" },
    { id: "tglPenawaran", label: "Tanggal penawaran", jenis: "tanggal", wajib: true },
  ],
  nego: [
    { id: "tglNego", label: "Tanggal negosiasi", jenis: "tanggal", wajib: true },
    { id: "jamNego", label: "Jam negosiasi", jenis: "teks", contoh: "14.00 WIT" },
  ],
  bahp: [
    { id: "tglBahp", label: "Tanggal BAHP", jenis: "tanggal", wajib: true },
    { id: "jamBahp", label: "Jam BAHP", jenis: "teks", contoh: "15.00 WIT" },
  ],
  spbj: [
    { id: "tglSpbj", label: "Tanggal SPBJ", jenis: "tanggal", wajib: true },
    { id: "hariPenyerahan", label: "Waktu penyerahan (hari kalender)", jenis: "angka",
      petunjuk: "Masa berlaku SPBJ dihitung dari tanggal SPBJ." },
  ],
  selesai: [],
};

/** tahap nego juga menuntut harga hasil nego, bukan sekadar tanggal */
export const perluHargaNego = (t: TahapScm) => t === "nego";

/** isian wajib yang belum terisi pada satu tahap */
export function kurangIsian(p: ProsesScm, tahap: TahapScm, adaHargaNego = false): string[] {
  const kurang = ISIAN_TAHAP[tahap]
    .filter((m) => m.wajib)
    .filter((m) => {
      const v = (p as any)[m.id];
      return v === undefined || v === null || String(v).trim() === "";
    })
    .map((m) => m.label);
  if (perluHargaNego(tahap) && !adaHargaNego) kurang.push("Harga hasil negosiasi");
  return kurang;
}

/** ringkasan isian tahap-tahap yang sudah dilewati, untuk ditampilkan sekilas */
export function ringkasTerisi(p: ProsesScm): { label: string; nilai: string }[] {
  const out: { label: string; nilai: string }[] = [];
  (Object.keys(ISIAN_TAHAP) as TahapScm[]).forEach((t) => {
    ISIAN_TAHAP[t].forEach((m) => {
      const v = (p as any)[m.id];
      if (v === undefined || v === null || String(v).trim() === "") return;
      if (m.jenis === "vendor") return;                     // ditampilkan tersendiri
      out.push({ label: m.label, nilai: String(v) });
    });
  });
  return out;
}
