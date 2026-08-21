/**
 * Pembersih NAMA ITEM — kembaran TypeScript dari scripts/sumber/bersih_nama.py.
 *
 * Berkas RAB di lapangan menuliskan satu barang dengan segala bungkusnya: nomor
 * surat di depan, kata "Pengadaan"/"Belanja" sebagai pembuka, nama kapal dan
 * bulan di belakang. Semuanya benar sebagai judul PEKERJAAN, tapi salah sebagai
 * nama BARANG — dan yang masuk ke Lampiran 3 adalah nama barang.
 *
 *   "035/TN.202/ASDP-TTE/2024 - Oli Filter"      -> "Oli Filter"
 *   "Pengadaan Majun Kapal KMP. TUNA Juli 2026"  -> "Majun"
 *   "Pemeliharaan Mesin - Deterjen"              -> "Deterjen"
 *
 * Aturannya KONSERVATIF: bila hasil pengupasan tinggal kurang dari tiga huruf,
 * nama aslinya yang dipakai. Satu nama kepanjangan masih bisa dibaca orang;
 * barang yang kehilangan identitasnya tidak.
 *
 * Indeks harga (data/hargaIndex.json) sudah dibersihkan saat dibangun. Fungsi
 * ini untuk nama yang datang dari tempat lain — terutama item SPPBJ yang
 * ditarik jadi bahan usulan.
 */

const BULAN = "januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember"
  + "|jan|feb|mar|apr|jun|jul|ags|agt|agu|sep|sept|okt|nov|des";

const NOMOR_DEPAN = /^\s*[([]?\s*\d{2,4}\s*[/.]\s*[A-Za-z]{2,}[A-Za-z0-9./-]*\s*[-–—:]\s*/i;
const HANYA_NOMOR = /^[\d\W]{0,6}\d{2,4}\s*[/.]\s*[A-Za-z]{2,}[A-Za-z0-9./-]*\s*$/i;

const NARASI_DEPAN = new RegExp(
  "^\\s*(?:jasa\\s+)?(?:pengadaan|belanja|pembelian|penyediaan|pekerjaan|biaya|"
  + "paketisasi|perawatan\\s+rutin|perawatan|pemeliharaan|perbaikan\\s+rutin|"
  + "kebutuhan|usulan|permintaan|penggantian\\s+rutin)\\s+"
  + "(?:barang\\s+|jasa\\s+|rutin\\s+)?", "i");

const EKOR_KAPAL = /\s*[-–—,]?\s*(?:untuk\s+)?(?:kapal\s+)?(?:kmp|km|bus\s*air)\.?\s+[A-Za-z][A-Za-z .'/]*$/i;
const EKOR_BULAN = new RegExp(`\\s*[-–—,]?\\s*(?:bu?la?n\\.?\\s+)?(?:${BULAN})\\.?\\s*\\d{4}\\s*$`, "i");
const EKOR_TAHUN = /\s*[-–—,]?\s*(?:tahun\s+)?(?:t\.?a\.?\s*)?20\d{2}\s*$/i;
const EKOR_KAPAL_POLOS = /\s*[-–—,]\s*kapal\s*$/i;

/**
 * Awalan sampah yang menempel dengan tanda hubung — kembaran aturan di
 * scripts/sumber/bersih_nama.py. Baris bantu spreadsheet ("Insert diatas ini"),
 * judul kolom yang ikut tersalin, label perputaran barang, bulan, dan nama
 * kapal. Semuanya pernah muncul sebagai "nama barang" di berkas nyata.
 */
const AWALAN_SAMPAH = new RegExp(
  String.raw`^\s*(?:insert\s*di\s*atas\s*ini|insert\s*diatas\s*ini|`
  + String.raw`harga(?:\s+(?:pjk|sat|satuan|total|net|nego|awal|akhir|lama|baru))?(?:\s*\(\s*rp\.?\s*\))?|`
  + String.raw`uraian(?:\s+barang)?(?:\s*/\s*jasa)?|nama\s+barang(?:\s*/\s*part\s*number)?|part\s*number|`
  + String.raw`deskripsi|keterangan|[a-d]\s*[:.]\s*(?:fast|slow|death|dead|non)[\s-]*moving|`
  + `(?:${BULAN})` + String.raw`(?:\s*\d{4})?|`
  + String.raw`(?:bus\s*air\s+)?(?:kmp|km)\.?\s*[A-Za-z][A-Za-z0-9.'-]*(?:\s+[A-Za-z0-9.'-]+)*?`
  + String.raw`)\s+[-–—:]\s+`, "i");

/** baris yang seluruhnya bukan nama barang */
const BUKAN_NAMA = new RegExp(
  String.raw`^\s*(?:insert\s*di\s*ata?s\s*ini|no|nomor|uraian|spesifikasi|satuan|jumlah|qty|volume|`
  + String.raw`keterangan|deskripsi|nama\s+barang|harga(?:\s+satuan)?|sub\s*total|total|grand\s*total|`
  + `(?:${BULAN})` + String.raw`(?:\s*\d{4})?)\s*[:.-]?\s*$`, "i");

/** hasil pengupasan yang ternyata cuma nama kapal */
const HANYA_KAPAL = /^\s*(?:bus\s*air\s+)?(?:kmp|km)\.?\s*[A-Za-z][A-Za-z0-9 .'-]*$/i;

const CATATAN: RegExp[] = [
  /\(\s*by\s+tim[^)]*\)/i,
  /\(\s*lihat\s+kontrak[^)]*\)/i,
  /\btotal\s*rp\.?\s*$/i,
  /^belum\s+pernah\s+diadakan[^\w]*/i,
];

/** sebutan BAGIAN, bukan nama barang — dipakai memotong "Pemeliharaan Mesin - Deterjen" */
const KATA_KELOMPOK = new RegExp(
  "^(?:mesin|deck|dek|kamar\\s+mesin|permesinan|kelistrikan|listrik|akomodasi|"
  + "perlengkapan|peralatan|alat\\s+kerja(?:\\s+mesin|\\s+deck)?|alat\\s+keselamatan"
  + "(?:\\s+dan\\s+navigasi)?|keselamatan|navigasi|kebersihan|cleaning|consumable|"
  + "filter|suku\\s+cadang|persiapan|pelumas|oli|cat|labour|material|umum|lain[\\s-]*lain)"
  + "(?:\\s+(?:kapal|mesin|deck|dek|bagian\\s+\\w+|tambahan|rutin))*$", "i");

const SISA_TANDA_AWAL = /^[\s\-–—:,.;/·]+/;
const SISA_TANDA_AKHIR = /[\s\-–—:,.;/·]+$/;
const rapikan = (s: string) => s.replace(SISA_TANDA_AWAL, "").replace(SISA_TANDA_AKHIR, "").trim();

function buangAwalanKelompok(t: string): string {
  for (const pemisah of [" - ", " – ", " — ", " : "]) {
    const i = t.indexOf(pemisah);
    if (i < 0) continue;
    const kiri = t.slice(0, i).replace(/\(.*?\)/g, "").trim();
    const kanan = t.slice(i + pemisah.length).trim();
    if (kanan.length >= 3 && kiri.split(/\s+/).length <= 5 && KATA_KELOMPOK.test(kiri)) return kanan;
  }
  return t;
}

export function bersihNamaItem(mentah: string): string {
  // spasi aneh dari salinan Excel disamakan lebih dulu
  let t = String(mentah || "").replace(/[  -​ 　﻿]/g, " ")
    .replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (HANYA_NOMOR.test(t)) return "";
  if (/^[\d\W]+$/.test(t)) return "";
  if (BUKAN_NAMA.test(t)) return "";

  const asli = t;
  CATATAN.forEach((p) => { t = t.replace(p, " "); });

  // awalan bisa bertumpuk & berselang-seling: nomor surat, sampah, lalu narasi
  for (let i = 0; i < 4; i++) {
    const sebelum = t;
    t = t.replace(NOMOR_DEPAN, "").replace(AWALAN_SAMPAH, "").replace(NARASI_DEPAN, "");
    t = rapikan(t);
    if (t === sebelum) break;
  }
  for (let i = 0; i < 4; i++) {
    const sebelum = t;
    t = t.replace(EKOR_BULAN, "").replace(EKOR_TAHUN, "").replace(EKOR_KAPAL, "").replace(EKOR_KAPAL_POLOS, "");
    if (t === sebelum) break;
  }

  t = rapikan(buangAwalanKelompok(rapikan(t.replace(/\s+/g, " "))));
  if (!t || HANYA_KAPAL.test(t) || BUKAN_NAMA.test(t)) return "";
  return t.length < 3 ? rapikan(asli) : t;
}
