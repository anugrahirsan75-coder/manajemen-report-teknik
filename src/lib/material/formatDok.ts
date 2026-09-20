/**
 * Format keluaran tiap dokumen pengajuan kode material.
 *
 * Template Pendaftaran Material adalah satu-satunya yang dikirim sebagai
 * Excel: berkas itu diunggah dan dibaca kembali oleh pusat sebagai data, jadi
 * mengirimnya sebagai PDF membuatnya harus diketik ulang di sana. Tiga
 * dokumen lainnya dibaca manusia dan ditandatangani, sehingga PDF yang tidak
 * bisa bergeser tata letaknya justru yang dibutuhkan.
 */
export type FormatDok = "xlsx" | "pdf";

export const FORMAT_DOK: Record<string, FormatDok> = {
  pendaftaran: "xlsx",
  formulir: "pdf",
  penawaran_sc: "pdf",
  penawaran_umum: "pdf",
};

export const formatDok = (slug: string): FormatDok => FORMAT_DOK[slug] || "pdf";
