/**
 * Bentuk data template surat.
 *
 * Isian dijelaskan sebagai DATA, bukan sebagai JSX. Dengan begitu menambah
 * template baru cukup membuat satu berkas di templates/ lalu mendaftarkannya di
 * registry.ts — halaman UI tidak perlu disentuh sama sekali.
 */

export type JenisIsian =
  | "teks"
  | "textarea"
  | "tanggal"
  | "pilih"
  | "rupiah"
  | "angka"
  | "daftar-centang"   // banyak pilihan + boleh tambah sendiri
  | "daftar-teks"      // daftar bebas (mis. lintasan), dirangkai jadi kalimat
  | "tabel";

export interface KolomTabel {
  id: string;
  label: string;
  jenis: "teks" | "rupiah" | "tanggal";
  lebar?: string;
  /** saran isi untuk kolom teks (mis. daftar mata anggaran) */
  saran?: { nilai: string; label: string }[];
}

export interface Isian {
  id: string;
  label: string;
  jenis: JenisIsian;
  wajib?: boolean;
  petunjuk?: string;
  contoh?: string;
  awal?: string | string[] | Record<string, string>[];
  /** untuk jenis "pilih" & "daftar-centang" */
  pilihan?: string[];
  /** "pilih" boleh diisi bebas di luar daftar */
  bebas?: boolean;
  /** untuk jenis "tabel" */
  kolom?: KolomTabel[];
  /** lebar isian pada tata letak borang (1 = penuh, 2 = setengah) */
  kolomBorang?: 1 | 2;
}

export type DataSurat = Record<string, any>;

export interface Peringatan {
  pesan: string;
}

export interface TemplateSurat {
  id: string;
  nama: string;
  /** dipakai sebagai pengingat: perihal yang biasanya dipakai di e-office */
  perihal: string;
  tujuan: string;
  deskripsi: string;
  ikon: string;
  isian: Isian[];
  /** hasilkan badan surat: HTML murni bergaya inline */
  generate: (d: DataSurat) => string;
  /** pemeriksaan tambahan di luar "wajib diisi" — mis. total tidak sinkron */
  periksa?: (d: DataSurat) => string[];
  /** angka yang ditonjolkan di panel ringkas (mis. total biaya) */
  ringkasNilai?: (d: DataSurat) => { label: string; nilai: number } | null;
}
