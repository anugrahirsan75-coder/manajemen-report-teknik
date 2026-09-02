/*
 * Salinan pemetaan borang untuk skrip di luar Next (CommonJS).
 *
 * Dihasilkan dari src/lib/sertifikat/fleetBorang.ts — sumber kebenarannya di sana;
 * berkas ini hanya cerminan supaya skrip sekali-jalan tidak perlu kompilasi TypeScript.
 */
const BORANG = [
  { kode: "FDOC/001", nama: "Gross Akte", padanan: "Grose Akte", catatan: "" },
  { kode: "FDOC/002", nama: "Surat Ukur", padanan: "Surat Ukur Interansional", catatan: "" },
  { kode: "FDOC/003", nama: "Load Line Cert", padanan: "Sertifikat Garis Muat (IILL Certificate)", catatan: "" },
  { kode: "FDOC/004", nama: "Hull Certificate", padanan: "Sertifikat Klasifikasi Lambung", catatan: "" },
  { kode: "FDOC/005", nama: "Machinery Certificate", padanan: "Sertifikat Klasifikasi Mesin", catatan: "" },
  { kode: "FDOC/007", nama: "SKKP Certificate", padanan: "Sertifikat Keselamatan Kapal Penyeberangan", catatan: "" },
  { kode: "FDOC/008", nama: "SIKR/KOMINFO", padanan: "Sertifikat Ijin Radio Kapal Laut", catatan: "" },
  {
    kode: "FDOC/009", nama: "SNPP Certificate",
    padanan: "Sertifikat Nasional Pencegahan Pencemaran Kapal (SNPP/ IOPP Certificate)", catatan: "",
  },
  { kode: "FDOC/010", nama: "AFS Certificate", padanan: "Sertifikat Nasional Anti Teritip (AFS)", catatan: "" },
  { kode: "FDOC/011", nama: "DOC", padanan: "DOC Sertificate (Copy)", catatan: "" },
  { kode: "FDOC/012", nama: "SMC", padanan: "SMC Sertificate", catatan: "" },
  { kode: "FDOC/013", nama: "SSCC Certificate", padanan: "Sertifikat Bebas Tindakan Sanitasi Kapal ( SSCEC )", catatan: "" },
  { kode: "FDOC/014", nama: "Fumigasi Cert", padanan: null, catatan: "Tidak ada barisnya di lembar MUSTER" },
  { kode: "FDOC/015", nama: "P3K Certificate", padanan: "Sertifikat Pengawasan Obat-obatan dan Alkes Kapal", catatan: "" },
  { kode: "FDOC/016", nama: "SPM Certificate", padanan: "Sertifikat Standar Pelayan Minimal", catatan: "" },
  { kode: "FDOC/017", nama: "CLC Bunker", padanan: null, catatan: "Tidak ada barisnya di lembar MUSTER" },
  {
    kode: "FDOC/018", nama: "Wreck Removal", padanan: "Bunker Bluecard & Wreck Removal Insurance",
    catatan: "MUSTER menggabung Wreck Removal dengan Blue Card dalam SATU baris — isian FDOC/018 dan FDOC/022 berasal dari berkas yang sama",
  },
  {
    kode: "FDOC/019", nama: "MMSI Certificate", padanan: "Sertifikat Ijin Radio Kapal Laut",
    catatan: "MMSI kapal diterbitkan menyatu dengan izin stasiun radio (SIKR) — tanggal dan berkasnya sama dengan FDOC/008; "
      + "nomor MMSI tercetak di dalam berkas itu",
  },
  {
    kode: "FDOC/020", nama: "Call Sign Cert", padanan: null,
    catatan: "Tidak ada barisnya di lembar MUSTER. Tanda panggilan kapal tercetak di dalam SIKR (FDOC/008) dan "
      + "sertifikat garis muat BKI (FDOC/003); dokumen penetapannya sendiri belum diarsipkan cabang",
  },
  { kode: "FDOC/021", nama: "RPK Endorsment", padanan: null, catatan: "Tidak ada barisnya di lembar MUSTER" },
  {
    kode: "FDOC/022", nama: "Blue Card", padanan: "Bunker Bluecard & Wreck Removal Insurance",
    catatan: "Satu baris MUSTER yang sama dengan FDOC/018",
  },
];

module.exports = { BORANG };
