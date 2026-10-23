/**
 * Harga satuan RESMI — menang atas indeks harga hasil pemindaian.
 *
 * KENAPA PERLU LAPIS SENDIRI. Indeks harga (data/hargaIndex.json) dibangun
 * dengan memindai 4.927 berkas pengadaan 2024-2026, jadi angkanya adalah
 * REKAMAN apa yang pernah dibeli — bukan harga yang berlaku sekarang. Untuk
 * sebagian besar barang itu sudah cukup. Untuk pelumas tidak: harganya
 * ditetapkan per paketisasi bulanan, dan satu bulan saja tertinggal membuat
 * seluruh usulan 13 kapal meleset dengan arah yang sama.
 *
 * Ditulis sebagai daftar kecil di dalam kode, bukan ditambalkan ke indeksnya,
 * karena tiga alasan: indeks itu berkas bangkitan yang sewaktu-waktu dibuat
 * ulang dan tambalan di dalamnya akan hilang tanpa jejak; angkanya perlu
 * terbaca jelas oleh orang, berikut tanggal berlaku dan berkas sumbernya; dan
 * harga resmi memang layak dilihat sebagai keputusan, bukan sebagai data.
 *
 * CARA KERJANYA. Yang ditimpa hanya `h2026` dan `median` — dua nilai yang
 * dipakai semua layar sebagai harga usulan. Rentang `lo`/`hi` hasil pemindaian
 * SENGAJA dibiarkan apa adanya, supaya masih terlihat berapa harga yang pernah
 * dibayar dan sebesar apa bedanya dengan harga resmi sekarang.
 *
 * MENAMBAH HARGA BARU: salin satu baris di HARGA_RESMI, isi tanggal berlaku
 * dan nama berkas sumbernya. Jangan menghapus baris lama — ganti `berlaku`-nya
 * supaya riwayat penetapan harga tetap terbaca.
 */
import type { HasilHarga } from "./indeks";

export interface HargaResmi {
  /** nama baku, dipakai pada keterangan di layar */
  nama: string;
  /** pengenal pada gabungan uraian + spesifikasi barang */
  pola: RegExp;
  /** satuan yang harganya berlaku; baris bersatuan lain tidak ditimpa */
  satuan: RegExp;
  harga: number;
  /** bulan berlakunya, untuk ditampilkan apa adanya */
  berlaku: string;
  sumber: string;
}

/*
 * Pelumas Pertamina, paketisasi Oktober 2026.
 *
 * Angkanya sama persis pada kedua berkas paketisasi (perintis dan komersil),
 * dan SAE 40 dikuatkan ulang oleh baris-baris SPPB/J di dalamnya: 8.581.540
 * per drum dipakai untuk seluruh kapal pada kedua paket.
 *
 * SAE 10 dan SAE 30 Oktober 2026 tidak ada pengadaannya — jumlahnya nol di
 * kedua berkas — tetapi harga satuannya tercantum pada lembar SUBSIDI dan
 * sama di kedua berkas, jadi dipakai sebagai harga acuan.
 */
const SUMBER_PELUMAS_OKT_2026 =
  "PAKETISASI PELUMAS KAPAL PERINTIS & KOMERSIL OKTOBER 2026.xlsx (lembar SPPBJ & SUBSIDI)";

const DRUM = /drum/i;

export const HARGA_RESMI: HargaResmi[] = [
  {
    nama: "Pelumas Meditran SAE 40 (Pertamina)",
    pola: /\bsae\s*-?\s*40\b/i,
    satuan: DRUM,
    harga: 8_581_540,
    berlaku: "Oktober 2026",
    sumber: SUMBER_PELUMAS_OKT_2026,
  },
  {
    nama: "Pelumas Meditran SAE 30 (Pertamina)",
    pola: /\bsae\s*-?\s*30\b/i,
    satuan: DRUM,
    harga: 7_321_270,
    berlaku: "Oktober 2026",
    sumber: SUMBER_PELUMAS_OKT_2026,
  },
  {
    nama: "Pelumas Meditran SAE 10 (Pertamina)",
    pola: /\bsae\s*-?\s*10\b/i,
    satuan: DRUM,
    harga: 8_412_250,
    berlaku: "Oktober 2026",
    sumber: SUMBER_PELUMAS_OKT_2026,
  },
];

/*
 * Pola SAE saja tidak cukup untuk memastikan barangnya pelumas: indeks juga
 * memuat barang lain yang namanya memuat angka serupa. Baris baru ditimpa bila
 * namanya menyebut pelumas atau mereknya sekalian.
 */
const PELUMAS = /pelumas|meditran|oli|lubric|lube/i;

/*
 * Sebagian baris indeks tidak punya satuan sama sekali — berkas sumbernya
 * memang tidak menuliskannya. Baris begitu tetap boleh ditimpa, tetapi hanya
 * kalau harganya sendiri berskala drum. Pelumas dijual per drum atau per
 * liter, dan keduanya terpaut ratusan kali; ambang satu juta memisahkan
 * keduanya tanpa perlu menebak.
 */
const AMBANG_DRUM = 1_000_000;

/** harga resmi untuk satu baris indeks, atau null bila tidak ada */
export function hargaResmiUntuk(
  uraian: string, spek = "", satuan = "", hargaAcuan = 0,
): HargaResmi | null {
  const teks = `${uraian || ""} ${spek || ""}`;
  if (!PELUMAS.test(teks)) return null;
  const sat = (satuan || "").trim();
  const satuanCocok = (h: HargaResmi) =>
    sat ? h.satuan.test(sat) : hargaAcuan >= AMBANG_DRUM;
  return HARGA_RESMI.find((h) => h.pola.test(teks) && satuanCocok(h)) || null;
}

/**
 * Timpa harga usulan satu baris dengan harga resmi bila ada.
 *
 * Dipasang di keHasil() supaya seluruh layar — pencarian, pencocokan borongan,
 * dan daftar per kategori — memakai angka yang sama. Menaruhnya di tiap
 * pemanggil berarti cepat atau lambat ada satu layar yang terlewat, dan layar
 * itulah yang akan dipakai menyusun usulan.
 */
export function terapkanHargaResmi(h: HasilHarga): HasilHarga {
  const acuan = h.h2026 || h.h2025 || h.median || h.h2024 || h.lo || 0;
  const r = hargaResmiUntuk(h.uraian, h.spek, h.satuan, acuan);
  if (!r) return h;
  return {
    ...h,
    // lo/hi hasil pemindaian dibiarkan: bedanya dengan harga resmi justru
    // informasi, bukan gangguan
    h2026: r.harga,
    median: r.harga,
    tren: `harga resmi ${r.berlaku}`,
    resmi: r,
  };
}
