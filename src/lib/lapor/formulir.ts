/**
 * Formulir "Permintaan Pengadaan Barang/Jasa Kapal" (HP-103.00.01 Rev.06) —
 * bentuk digital dari borang yang selama ini diketik ulang di Word oleh ABK.
 *
 * Ukuran dan susunannya diambil dari berkas aslinya, bukan dikira-kira:
 * kolom No 28,3pt · Jumlah 49,5pt · Satuan 45pt · Merk/Katalog 89,4pt ·
 * Uraian/Spesifikasi 326,5pt; kertas A4 dengan tepi kiri 58pt, kanan 17pt,
 * atas & bawah 50pt. Hasil cetaknya harus bisa ditumpuk dengan borang lama
 * tanpa kelihatan bedanya — itu syarat yang membuat borang ini boleh dipakai.
 */

export type BagianKapal = "deck" | "mesin";

export interface BarisPermintaan {
  id: string;
  jumlah: string;
  satuan: string;
  /** kolom "Merk/Katalog" — di berkas asli juga dipakai untuk catatan kondisi */
  merk: string;
  /** kolom "Uraian / Spesifikasi Barang" */
  uraian: string;
  spesifikasi: string;
  /** kode Database RAB, kosong bila barangnya diketik sendiri */
  kode?: string;
}

export interface FormulirPermintaan {
  kapal: string;
  bagian: BagianKapal;
  noSurat: string;
  tanggal: string;             // YYYY-MM-DD
  dasar: string;
  tanggalDibutuhkan: string;
  peminta: string;
  jabatanPeminta: string;
  nakhoda: string;
  masinis: string;
  kontak: string;
  catatan: string;
  baris: BarisPermintaan[];
}

export const BAGIAN: { id: BagianKapal; label: string; ikon: string; jenisLapor: string; atasan: string }[] = [
  { id: "deck", label: "Deck", ikon: "🧭", jenisLapor: "permintaan_deck", atasan: "Mualim I" },
  { id: "mesin", label: "Mesin", ikon: "⚙️", jenisLapor: "permintaan_mesin", atasan: "Masinis I" },
];

/**
 * Kategori Database RAB yang dilayani tiap bagian.
 *
 * Pemisahan ini bukan kerapian belaka: permintaan Deck dan Mesin berjalan lewat
 * dua jalur persetujuan yang berbeda, dan borang yang mencampur keduanya harus
 * dikembalikan untuk dipisah lagi. Alat kerja dan barang habis pakai sengaja
 * masuk ke dua-duanya — keduanya memang memakainya.
 */
export const KATEGORI_BAGIAN: Record<BagianKapal, string[]> = {
  deck: [
    "Akomodasi & Interior Deck",
    "Alat Keselamatan",
    "Alat Navigasi & Komunikasi",
    "Perlengkapan Kapal & Tali Temali",
    "Bahan Kebersihan & Pantry",
    "Cat, Thinner & Material Coating",
    "Konstruksi, Replating & Fabrikasi",
    "Zinc Anode & Proteksi Katodik",
    "Blasting & Persiapan Permukaan",
    "Alat Kerja & Consumable",
    "Perawatan Rutin & Kebersihan Kapal (Jasa)",
    "Lain-lain",
  ],
  mesin: [
    "Suku Cadang Mesin",
    "Permesinan & Kelistrikan",
    "Kelistrikan & Penerangan",
    "Perpipaan & Katup",
    "Bahan Bakar & Pelumas",
    "Tangki, Got & Limbah",
    "Alat Kerja & Consumable",
    "Lain-lain",
  ],
};

/** isian "Dasar" yang benar-benar dipakai pada borang-borang sebelumnya */
export const DASAR_UMUM: Record<BagianKapal, string[]> = {
  deck: ["Kebutuhan Deck", "Kebutuhan Perlengkapan Deck", "Kebutuhan Operasional Kapal", "Kebutuhan Temuan NC"],
  mesin: ["Kebutuhan Mesin", "Kebutuhan Operasional Kapal", "Kebutuhan Suku Cadang", "Kebutuhan Temuan NC"],
};

/** satuan yang lazim di borang kapal; boleh diketik bebas kalau tak ada di sini */
export const SATUAN_UMUM = [
  "Pcs", "Buah", "Unit", "Set", "Roll", "Meter", "Batang", "Lembar", "Pasang",
  "Kg", "Liter", "Botol", "Kaleng", "Pail", "Drum", "Tabung", "Box", "Dus",
  "Pack", "Rim", "Bungkus", "Au", "Ls", "Titik",
];

/** jumlah baris pada cetakan — mengikuti borang aslinya (baris 7 sampai 27) */
export const BARIS_CETAK_MINIMAL = 21;

export const bagianDari = (b: string): BagianKapal => (b === "mesin" ? "mesin" : "deck");

export const tanggalIndo = (iso: string) => {
  const [y, m, d] = (iso || "").split("-");
  const nama = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
    "Agustus", "September", "Oktober", "November", "Desember"];
  return nama[+m] ? `${+d} ${nama[+m]} ${y}` : iso || "";
};

/** borang tanpa barang tidak berarti apa-apa; nama peminta menentukan tanda tangannya */
export function periksaFormulir(f: FormulirPermintaan): string[] {
  const kurang: string[] = [];
  if (!f.kapal) kurang.push("kapal belum dipilih");
  if (!f.noSurat.trim()) kurang.push("No. SPPB/J belum diisi");
  if (!f.tanggal) kurang.push("tanggal belum diisi");
  if (!f.dasar.trim()) kurang.push("dasar permintaan belum diisi");
  if (f.peminta.trim().length < 3) kurang.push("nama peminta belum diisi");
  const isi = f.baris.filter((b) => b.uraian.trim());
  if (!isi.length) kurang.push("belum ada barang yang diminta");
  if (isi.some((b) => !String(b.jumlah).trim() || !b.satuan.trim())) {
    kurang.push("ada barang yang jumlah atau satuannya kosong");
  }
  return kurang;
}
