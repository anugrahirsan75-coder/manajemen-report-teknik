/**
 * TEMPLATE 7 — Surat kustom (ditulis sendiri).
 *
 * Berbeda dari template lain: tidak punya borang isian, melainkan satu
 * penyunting bebas. Yang disimpan pada isian "isi" SUDAH berupa HTML bergaya
 * e-office — penormalannya dikerjakan penyunting (lib/surat/kustom.ts) setiap
 * kali isinya berubah, bukan di sini, supaya yang tampil di pratinjau persis
 * yang tersalin ke e-office.
 */
import { TemplateSurat } from "../types";

export const suratKustom: TemplateSurat = {
  id: "kustom",
  nama: "Surat Kustom (tulis sendiri)",
  perihal: "— tulis perihalnya langsung di e-office —",
  tujuan: "bebas, sesuai keperluan",
  deskripsi: "Menulis badan surat sendiri: paragraf, daftar, dan tabel. Hasilnya tetap bergaya e-office.",
  ikon: "✍️",
  kustom: true,
  isian: [
    { id: "isi", label: "Badan surat", jenis: "kustom", wajib: true },
  ],
  generate: (d) => String(d.isi || ""),
};
