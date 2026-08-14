/**
 * Skema borang permintaan kapal — MURNI, tanpa peramban.
 *
 * Dipisah dari bacaPermintaan.ts (yang "use client") supaya kode sisi server
 * — juru baca yang berjalan di dalam server lokal — bisa memakai skema yang
 * SAMA PERSIS. Dua definisi kolom yang berbeda antara peramban dan server
 * berarti dua hasil bacaan yang berbeda untuk berkas yang sama.
 */
import { KolomTabel } from "@/lib/surat/types";

/** kolom yang dicari dari borang permintaan kapal */
export const KOLOM_PERMINTAAN: KolomTabel[] = [
  { id: "nama", label: "Nama barang / pekerjaan", jenis: "teks" },
  { id: "spesifikasi", label: "Spesifikasi / part number", jenis: "teks" },
  { id: "jumlah", label: "Jumlah", jenis: "teks" },
  { id: "satuan", label: "Satuan", jenis: "teks" },
  { id: "keterangan", label: "Keterangan", jenis: "teks" },
];

export const KONTEKS_PERMINTAAN =
  "Borang permintaan barang dari kapal (Deck atau Mesin) milik PT ASDP. Tiap baris adalah satu barang "
  + "atau pekerjaan yang diminta ABK: nama barangnya, spesifikasi atau part number bila ada, jumlah, dan "
  + "satuan (pcs, set, liter, buah, unit). Kolom keterangan diisi bila borangnya memuat catatan seperti "
  + "merek mesin, letak pemakaian, atau kondisi kerusakan. Abaikan kop surat, nama kapal, tanda tangan, "
  + "dan baris tanda terima.";

export interface BarisPermintaan {
  nama: string;
  spesifikasi: string;
  jumlah: string;
  satuan: string;
  keterangan: string;
}

/** angka jumlah dari isian bebas ("4", "4 pcs", "±2") */
export const keJumlah = (v: string): number => {
  const m = /(\d+(?:[.,]\d+)?)/.exec(String(v || ""));
  return m ? Math.max(1, Math.round(Number(m[1].replace(",", ".")))) : 1;
};
