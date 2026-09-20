/**
 * TEMPLATE — Pengantar Permohonan Kode Material ke divisi pusat.
 *
 * Surat paling pendek di daftar ini: badannya hanya tiga baris, karena isi
 * sebenarnya ada di lampirannya (Template Pendaftaran Material, Formulir
 * Permintaan Master Data, dan dua daftar penawaran). Yang sering salah justru
 * bagian yang sedikit itu — bulan dan tahun periodenya tertinggal dari
 * pengajuan sebelumnya — jadi keduanya diambil dari satu tanggal periode,
 * bukan diketik terpisah.
 *
 * Tanda tangan tidak ditempelkan di sini. Surat ini diterbitkan lewat e-office,
 * tempat Dept. Head menandatanganinya sendiri dan sistem itu yang membubuhkan
 * QR sahnya; aplikasi ini hanya menyusun badan suratnya.
 */
import { TemplateSurat } from "../types";
import { NAMA_BULAN } from "../format";
import { bungkus, esc } from "../htmlHelpers";

const JENIS_MATERIAL = [
  "Suku Cadang dan Perlengkapan Kapal",
  "Suku Cadang Kapal",
  "Barang Umum Kapal",
  "Suku Cadang dan Barang Umum Kapal",
];

export const pengantarKodeMaterial: TemplateSurat = {
  id: "pengantar-kode-material",
  nama: "Pengantar Permohonan Kode Material",
  perihal: "Permohonan Kode Material {jenis} Bulan {bulan} Tahun {tahun}",
  tujuan: "Group Head Manajemen Rantai Pasok — Jakarta",
  deskripsi:
    "Surat pengantar tiga baris untuk melampirkan berkas pengajuan kode material ke pusat. "
    + "Jenis, bulan, dan tahun mengisi sendiri perihal dan badan suratnya.",
  ikon: "📨",
  isian: [
    {
      id: "jenis", label: "Kode material untuk", jenis: "pilih", pilihan: JENIS_MATERIAL,
      bebas: true, wajib: true, awal: JENIS_MATERIAL[0],
      petunjuk: "Dipakai di perihal dan di kalimat “Terlampir permohonan kode material …”.",
    },
    { id: "bulan", label: "Bulan periode", jenis: "pilih", pilihan: NAMA_BULAN, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    {
      id: "lampiran", label: "Berkas yang dilampirkan", jenis: "daftar-centang",
      pilihan: [
        "Template Pendaftaran Material (SAP)",
        "Formulir Permintaan Master Data",
        "Penawaran Suku Cadang",
        "Penawaran Barang Umum",
      ],
      awal: [
        "Template Pendaftaran Material (SAP)",
        "Formulir Permintaan Master Data",
      ],
      petunjuk: "Ditulis sebagai daftar lampiran di bawah kalimat pengantar. Kosongkan bila tak perlu dirinci.",
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    if (!String(d.bulan || "").trim()) pesan.push("Bulan periode belum dipilih — itu yang membedakan pengajuan ini dari bulan lalu.");
    const lampiran = (d.lampiran as string[]) || [];
    if (!lampiran.length) {
      pesan.push("Belum ada berkas lampiran yang dicentang. Surat ini pengantar — tanpa lampiran, tak ada yang diantarkan.");
    }
    return pesan;
  },

  generate(d) {
    const jenis = esc(String(d.jenis || "").trim());
    const bulan = esc(String(d.bulan || "").trim());
    const tahun = esc(String(d.tahun || "").trim());
    const lampiran = ((d.lampiran as string[]) || []).filter((x) => x && x.trim());

    // Surat ini tidak bernomor butir: badannya memang tiga paragraf lepas,
    // jadi disusun langsung dan tidak lewat suratBernomor().
    const par = (t: string) => `<p style="margin:0 0 10pt 0;text-align:justify">${t}</p>`;
    const daftar = lampiran.length
      ? `<ul style="margin:-4pt 0 10pt 18pt;padding:0">${lampiran
          .map((x) => `<li style="margin:0 0 2pt 0">${esc(x)}</li>`).join("")}</ul>`
      : "";

    return bungkus(
      par("Dengan Hormat,")
      + par(`Terlampir permohonan kode material ${jenis} bulan ${bulan} tahun ${tahun}.`)
      + daftar
      + par("Terima Kasih."),
    );
  },
};
