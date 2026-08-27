/**
 * Mengisi template borang HP-103.00.01 dengan data yang diketik ABK.
 *
 * Template-nya (borangTemplate.ts) adalah markup Word cabang apa adanya, jadi
 * di sini tidak ada satu pun ukuran atau garis yang ditentukan ulang — hanya
 * penanda {{...}} yang ditukar isinya.
 *
 * Sel yang kosong diisi &nbsp;, bukan string kosong: sel benar-benar kosong
 * membuat tinggi barisnya menyusut di sebagian peramban, dan borang yang
 * barisnya tidak sama tinggi langsung terlihat berbeda dari berkas lama.
 */
import { BARIS_CETAK_MINIMAL, FormulirPermintaan, tanggalIndo } from "./formulir";
import { BORANG_TEMPLATE } from "./borangTemplate";

const KOSONG = "&nbsp;";

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** teks isian: kosong tetap menyisakan ruang setinggi satu baris */
const isi = (v: unknown) => {
  const t = esc(v).trim();
  return t || KOSONG;
};

export function isiBorang(f: FormulirPermintaan): string {
  const barang = f.baris.filter((b) => b.uraian.trim()).slice(0, BARIS_CETAK_MINIMAL);

  const peta: Record<string, string> = {
    NOSURAT: isi(f.noSurat),
    KAPAL: isi(f.kapal || "KMP."),
    TANGGAL: isi(tanggalIndo(f.tanggal)),
    DASAR: isi(f.dasar),
    DIBUTUHKAN: isi(f.tanggalDibutuhkan || "Segera"),
    KAPAL_TANGGAL: isi([f.kapal, tanggalIndo(f.tanggal)].filter(Boolean).join(", ")),
    CATATAN: f.catatan.trim() ? esc(f.catatan) : KOSONG,
    PEMINTA: isi(f.peminta),
    JABATAN: isi(f.jabatanPeminta),
    NAKHODA: isi(f.nakhoda),
    MASINIS: isi(f.masinis),
    // atasan yang menandatangani berbeda menurut bagiannya, seperti borang lama
    ATASAN: f.bagian === "mesin" ? "Masinis I" : "Mualim I",
  };

  for (let k = 0; k < BARIS_CETAK_MINIMAL; k++) {
    const b = barang[k];
    peta[`I${k}_NO`] = b ? String(k + 1) : KOSONG;
    peta[`I${k}_JML`] = b ? isi(b.jumlah) : KOSONG;
    peta[`I${k}_SAT`] = b ? isi(b.satuan) : KOSONG;
    peta[`I${k}_MERK`] = b ? isi(b.merk) : KOSONG;
    peta[`I${k}_URAIAN`] = b ? isi(b.uraian) : KOSONG;
    peta[`I${k}_SPEK`] = b ? isi(b.spesifikasi) : KOSONG;
  }

  return BORANG_TEMPLATE.replace(/{{([A-Z0-9_]+)}}/g, (_, kunci: string) => peta[kunci] ?? KOSONG);
}
