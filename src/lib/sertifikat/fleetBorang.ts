/**
 * Pemetaan lembar MUSTER cabang ke borang FLEET CERTIFICATE milik Direksi.
 *
 * Borang Direksi memakai 21 baris dokumen tetap dengan kode FDOC/001–FDOC/022
 * (nomor 006 memang tidak dipakai). Lembar MUSTER cabang menamai dokumennya
 * dengan bahasanya sendiri dan memuat baris yang tidak diminta borang. Berkas
 * ini yang menjembatani keduanya.
 *
 * Dokumen yang TIDAK punya barisnya di MUSTER sengaja dibiarkan kosong dan
 * alasannya ikut dicetak di lembar CATATAN: laporan ini naik ke Direksi, dan
 * satu baris karangan lebih mahal daripada satu baris kosong.
 */

export interface BarisBorang {
  /** kode dokumen pada borang Direksi */
  kode: string;
  /** nama dokumen sebagaimana tertulis di borang */
  nama: string;
  /** nama baris padanannya di lembar MUSTER; null bila memang tidak ada */
  padanan: string | null;
  /** keterangan yang dicetak di lembar CATATAN */
  catatan: string;
}

export const BORANG: BarisBorang[] = [
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

/** baris bantu di lembar MUSTER — bukan dokumen, jangan ikut dilaporkan */
export const BUKAN_DOKUMEN = new Set([
  "Masa berlaku sertifikat < 30 hari",
  "Masa berlaku sertifikat < 10 hari",
]);

/** jenis MUSTER yang sudah terpakai oleh borang — sisanya masuk blok "dokumen lain" */
export const JENIS_BORANG = new Set(BORANG.map((b) => b.padanan).filter(Boolean) as string[]);

const ROMAWI = new Set(["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]);

/** "KMP. PORTLINK VIII" -> "Portlink VIII", mengikuti gaya borang Direksi */
export function namaArmada(kapal: string): string {
  return kapal.replace(/^KMP\.?/i, "").trim().split(/\s+/)
    .map((k) => (ROMAWI.has(k.toUpperCase()) ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()))
    .join(" ");
}

/**
 * Validity Periode dalam bahasa borang: "Permanent" atau "N bulan".
 *
 * Dibulatkan ke bulan terdekat karena masa berlaku sertifikat memang dihitung
 * bulanan; menampilkan selisih hari membuat kolomnya sulit dibandingkan.
 */
export function masaBerlaku(terbit: string, berlaku: string, permanen: boolean): string {
  if (permanen) return "Permanent";
  if (!terbit || !berlaku) return "";
  const a = new Date(terbit).getTime();
  const b = new Date(berlaku).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return "";
  const bulan = Math.round((b - a) / (1000 * 60 * 60 * 24) / 30.44);
  if (bulan >= 12 && bulan % 12 === 0) return `${bulan} bulan (${bulan / 12} tahun)`;
  return `${bulan} bulan`;
}

/** kunci penyimpanan nomor sertifikat: satu dokumen satu kunci */
export const kunciNomor = (kode: string, jenis: string) => `${kode}|${jenis}`;
