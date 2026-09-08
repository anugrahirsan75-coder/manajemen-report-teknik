/**
 * Portal Kapal — akun milik kapal, bukan milik orang.
 *
 * Tiap kapal memegang DUA akun: satu Deck, satu Mesin. Bukan satu akun per ABK,
 * karena awak berganti tiap beberapa bulan sedangkan tanggung jawabnya tidak:
 * yang harus selalu ada penanggungnya adalah "Mesin KMP. MAMING", siapa pun
 * yang sedang berdinas. Akun per orang berarti akun mati tiap kali orangnya
 * pindah kapal, dan data yang menggantung tanpa pemilik.
 *
 * Nama masuknya dibentuk dari nama kapal + bagiannya: KMP. MAMING → "mamingdeck"
 * dan "mamingmesin". Sengaja tanpa titik, spasi, maupun huruf besar — diketik di
 * papan tik ponsel, di anjungan, kadang sambil berdiri.
 */

export const KIND_AKUN_KAPAL = "akun_kapal";
export const KIND_STOK_FILTER = "stok_filter";
export const KIND_ALKES = "alkes_kapal";

export type BagianKapal = "deck" | "mesin";

export const BAGIAN: { id: BagianKapal; label: string; ikon: string }[] = [
  { id: "deck", label: "Deck", ikon: "🧭" },
  { id: "mesin", label: "Mesin", ikon: "⚙️" },
];

/**
 * Nama masuk dari nama kapal.
 *
 * "KMP. PORTLINK VIII" → "portlinkviiideck". Angka Romawi ikut apa adanya:
 * mengubahnya menjadi angka biasa akan membuat nama akun tidak lagi bisa ditebak
 * dari nama kapalnya, dan yang mengetiknya di kapal tidak memegang daftar.
 */
export const namaAkun = (kapal: string, bagian: BagianKapal) =>
  `${kapal.replace(/^KMP\.?\s*/i, "").replace(/[^A-Za-z0-9]/g, "").toLowerCase()}${bagian}`;

export interface AkunKapal {
  /** id baris Supabase */
  id: string;
  kapal: string;
  bagian: BagianKapal;
  /** nama masuk, huruf kecil semua */
  nama: string;
  aktif: boolean;
  dibuatPada: string;
  terakhirMasuk: string;
  sandiDiubahPada: string;
  /** catatan kantor: siapa yang memegang, nomor WA, dll */
  catatan: string;
}

/** satu jenis filter yang distok kapal */
export interface BarisFilter {
  id: string;
  /** ME / AE 1 / AE 2 / Gearbox / lainnya — mesin yang memakainya */
  mesin: string;
  /** Filter oli, filter solar, filter udara, … */
  jenis: string;
  partNumber: string;
  jumlah: number;
  satuan: string;
  /** batas stok minimal menurut kapal; di bawah ini kantor perlu tahu */
  minimum: number;
  catatan: string;
  diperbaruiPada: string;
}

/** pembacaan jam kerja mesin — dasar menghitung kapan filter berikutnya diganti */
export interface JamMesin {
  id: string;
  mesin: string;
  /**
   * Merek dan tipe mesinnya — Yanmar 6CH-DTE, Mitsubishi S6R, Cummins KTA19.
   *
   * "ME Kanan" saja tidak menolong yang menyiapkan filternya: part number filter
   * berbeda antar-merek, dan selama merek tidak tercatat, kantor menebaknya dari
   * ingatan atau menelepon kapal untuk menanyakan hal yang seharusnya sudah
   * tertulis.
   */
  merek: string;
  tipe: string;
  /** nomor seri di pelat mesin — pembeda terakhir bila satu tipe dipakai banyak kapal */
  nomorSeri: string;
  /** jam kerja terbaru sesuai penunjuk di kamar mesin */
  jam: number;
  /** jam kerja saat filter terakhir diganti; selisihnya = umur pakai berjalan */
  jamGantiTerakhir: number;
  /** anjuran pabrik, mis. 250 atau 500 jam */
  intervalJam: number;
  dicatatPada: string;
}

export interface StokFilterKapal {
  kind: typeof KIND_STOK_FILTER;
  kapal: string;
  filter: BarisFilter[];
  mesin: JamMesin[];
  diperbaruiPada: string;
  /** akun yang terakhir menyunting — bukti siapa yang bertanggung jawab */
  olehAkun: string;
  riwayat: JejakPortal[];
}

/** golongan alat kesehatan di kapal — menentukan siapa yang mengurusnya */
export const GOLONGAN_ALKES = ["Obat", "Alat P3K", "Alat medis", "Cairan", "Lainnya"] as const;
export type GolonganAlkes = (typeof GOLONGAN_ALKES)[number];

export interface BarisAlkes {
  id: string;
  nama: string;
  golongan: string;
  jumlah: number;
  satuan: string;
  /** ISO yyyy-mm-dd; kosong untuk alat yang tidak punya masa kedaluwarsa */
  kedaluwarsa: string;
  /** kotak P3K anjungan, kamar mesin, klinik — supaya bisa dicari saat dibutuhkan */
  lokasi: string;
  minimum: number;
  catatan: string;
  diperbaruiPada: string;
}

export interface AlkesKapal {
  kind: typeof KIND_ALKES;
  kapal: string;
  item: BarisAlkes[];
  diperbaruiPada: string;
  olehAkun: string;
  riwayat: JejakPortal[];
}

/**
 * Jejak perubahan.
 *
 * Stok adalah angka yang dipakai kantor mengambil keputusan belanja; angka yang
 * bisa berubah tanpa bekas tidak bisa dipertanggungjawabkan, dan pertanyaan
 * "siapa yang menurunkan jumlahnya" harus punya jawaban.
 */
export interface JejakPortal {
  pada: string;
  oleh: string;
  aksi: string;
  rincian: string;
}

/** sisa hari menuju kedaluwarsa; null bila tidak bertanggal */
export function sisaHariAlkes(kedaluwarsa: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(kedaluwarsa || "")) return null;
  const [y, m, d] = kedaluwarsa.split("-").map(Number);
  const habis = new Date(y, m - 1, d);
  const kini = new Date();
  const nol = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate());
  return Math.round((habis.getTime() - nol.getTime()) / 86_400_000);
}

export type TingkatAlkes = "lewat" | "kritis" | "waspada" | "aman" | "tanpa";

export const tingkatAlkes = (kedaluwarsa: string): TingkatAlkes => {
  const sisa = sisaHariAlkes(kedaluwarsa);
  if (sisa === null) return "tanpa";
  if (sisa < 0) return "lewat";
  if (sisa <= 30) return "kritis";
  if (sisa <= 90) return "waspada";
  return "aman";
};

export const NADA_ALKES: Record<TingkatAlkes, { label: string; kelas: string }> = {
  lewat: { label: "Kedaluwarsa", kelas: "bg-rose-100 text-rose-800 ring-rose-300" },
  kritis: { label: "≤ 30 hari", kelas: "bg-orange-100 text-orange-800 ring-orange-300" },
  waspada: { label: "≤ 90 hari", kelas: "bg-amber-100 text-amber-800 ring-amber-300" },
  aman: { label: "Aman", kelas: "bg-emerald-100 text-emerald-800 ring-emerald-300" },
  tanpa: { label: "Tanpa masa berlaku", kelas: "bg-slate-100 text-slate-600 ring-slate-300" },
};

/** id baris baru tanpa Math.random — dua kapal tak pernah menulis baris yang sama */
export const idBaris = (awalan: string) =>
  `${awalan}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
