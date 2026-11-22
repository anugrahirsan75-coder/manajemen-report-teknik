/**
 * Monitoring Permintaan Kapal — lapisan KEPUTUSAN di atas hasil Juru Baca.
 *
 * Juru Baca sudah memecah PDF permintaan ABK menjadi baris barang. Yang belum
 * ada selama ini: keputusan kantor atas tiap barang (urgent atau tidak, rutin
 * atau biaya, disetujui atau tidak) dan sampai mana barang itu diproses. Tanpa
 * itu permintaan hanya bisa dipantau dengan membuka PDF satu per satu.
 *
 * Satu barang = satu baris Supabase kind="permintaan_eval". Barang yang belum
 * pernah disentuh TIDAK punya baris — ia tetap tampil (dari hasil bacaan)
 * dengan status "Belum dievaluasi". Baris baru lahir pada sentuhan pertama.
 *
 * Status pengadaannya TIDAK diketik: dicocokkan dari SPPBJ / Non PR PO yang
 * tersimpan di aplikasi (kapal + nama barang) dan tahap SCM-nya. Yang diketik
 * orang hanya tiga pilihan: prioritas, klasifikasi, keputusan.
 */

export const KIND_EVAL = "permintaan_eval";

/** barang urgent yang belum diproses lebih dari sekian hari dianggap menggantung */
export const BATAS_MENGGANTUNG_HARI = 7;
/** barang yang sama diminta lagi dalam rentang ini ditandai "diminta ulang" */
export const RENTANG_ULANG_HARI = 60;

export type Prioritas = "urgent" | "normal" | "tunda";
export type Klasifikasi = "rutin" | "biaya" | "investasi" | "docking" | "stok";
export type Keputusan = "setuju" | "tunda" | "tolak";

export const PRIORITAS: { id: Prioritas; label: string; ikon: string; kelas: string; ket: string }[] = [
  { id: "urgent", label: "Urgent", ikon: "🔴", kelas: "bg-rose-100 text-rose-800 ring-rose-300",
    ket: "Menyangkut keselamatan, laik laut, atau kapal tak bisa beroperasi" },
  { id: "normal", label: "Normal", ikon: "🟡", kelas: "bg-amber-100 text-amber-800 ring-amber-300",
    ket: "Kebutuhan biasa, diproses sesuai jadwal pengadaan" },
  { id: "tunda", label: "Bisa ditunda", ikon: "⚪", kelas: "bg-slate-100 text-slate-700 ring-slate-300",
    ket: "Tidak mendesak, boleh menunggu pagu atau docking" },
];

export const KLASIFIKASI: { id: Klasifikasi; label: string; kelas: string; ket: string }[] = [
  { id: "rutin", label: "Rutin", kelas: "bg-sky-100 text-sky-800 ring-sky-300", ket: "Perawatan rutin bulanan (Lampiran 3)" },
  { id: "biaya", label: "Biaya", kelas: "bg-violet-100 text-violet-800 ring-violet-300", ket: "Perbaikan / pengadaan di luar rutin" },
  { id: "investasi", label: "Investasi", kelas: "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-300", ket: "Barang modal / unit baru, perlu persetujuan Pusat" },
  { id: "docking", label: "Masuk docking", kelas: "bg-teal-100 text-teal-800 ring-teal-300", ket: "Dikerjakan saat docking" },
  { id: "stok", label: "Stok gudang", kelas: "bg-lime-100 text-lime-800 ring-lime-300", ket: "Dipenuhi dari persediaan, tanpa pengadaan" },
];

export const KEPUTUSAN: { id: Keputusan; label: string; kelas: string }[] = [
  { id: "setuju", label: "Setuju", kelas: "bg-emerald-100 text-emerald-800 ring-emerald-300" },
  { id: "tunda", label: "Tunda", kelas: "bg-slate-100 text-slate-700 ring-slate-300" },
  { id: "tolak", label: "Tolak", kelas: "bg-rose-100 text-rose-800 ring-rose-300" },
];

/** tahap barang dari diminta sampai diterima kapal */
export type Tahap =
  | "baru"        // belum disentuh kantor
  | "menunggu"    // sudah dinilai sebagian, keputusan belum ada
  | "disetujui"   // disetujui, belum ada SPPBJ
  | "stok"        // disetujui dari stok gudang, belum diterima kapal
  | "ditunda"
  | "ditolak"
  | "sppbj"       // SPPBJ dibuat, menunggu SPBJ (tahap SCM ikut ditampilkan)
  | "spbj"        // SPBJ terbit / Non PR PO — barang sedang diadakan
  | "selesai";    // pengadaan selesai atau diterima kapal

export const TAHAP: Record<Tahap, { label: string; kelas: string; urut: number }> = {
  baru: { label: "Belum dievaluasi", kelas: "bg-slate-100 text-slate-700 ring-slate-300", urut: 0 },
  menunggu: { label: "Menunggu keputusan", kelas: "bg-amber-100 text-amber-800 ring-amber-300", urut: 1 },
  disetujui: { label: "Disetujui — belum SPPBJ", kelas: "bg-orange-100 text-orange-800 ring-orange-300", urut: 2 },
  stok: { label: "Kirim dari stok", kelas: "bg-lime-100 text-lime-800 ring-lime-300", urut: 2 },
  ditunda: { label: "Ditunda", kelas: "bg-slate-200 text-slate-700 ring-slate-300", urut: 3 },
  sppbj: { label: "SPPBJ dibuat", kelas: "bg-sky-100 text-sky-800 ring-sky-300", urut: 4 },
  spbj: { label: "SPBJ / sedang diadakan", kelas: "bg-indigo-100 text-indigo-800 ring-indigo-300", urut: 5 },
  selesai: { label: "Selesai", kelas: "bg-emerald-100 text-emerald-800 ring-emerald-300", urut: 6 },
  ditolak: { label: "Ditolak", kelas: "bg-rose-100 text-rose-800 ring-rose-300", urut: 7 },
};

/** tahap yang masih menuntut tindakan kantor */
export const TAHAP_TERBUKA: Tahap[] = ["baru", "menunggu", "disetujui", "stok", "ditunda", "sppbj", "spbj"];
/** tahap yang belum menyentuh pengadaan sama sekali — dasar "urgent menggantung" */
export const TAHAP_BELUM_PROSES: Tahap[] = ["baru", "menunggu", "disetujui", "stok"];

export interface JejakEval { pada: string; oleh: string; ubah: string }

/** satu baris Supabase per barang yang pernah dinilai */
export interface EvalPermintaan {
  kind: typeof KIND_EVAL;
  kunci: string;
  fileId: string;
  kirimanId: string;
  kapal: string;
  jenis: string;
  periode: string;
  dikirimPada: string;
  /** salinan barangnya saat dinilai — supaya tetap terbaca bila bacaan berubah */
  nama: string;
  spesifikasi: string;
  jumlah: string;
  satuan: string;
  prioritas: Prioritas | "";
  klasifikasi: Klasifikasi | "";
  keputusan: Keputusan | "";
  catatan: string;
  pic: string;
  /** tanggal barang diterima kapal (diisi manual) — menutup barangnya */
  diterima: string;
  /** "" = cocok otomatis; id pengadaan = tautan dipatok; "-" = jangan ditautkan */
  tautPengadaan: string;
  /** ringkasan status terakhir yang dilihat layar — dibaca lonceng pengingat di server */
  tahapTerakhir: Tahap | "";
  oleh: string;
  dibuatPada: string;
  diubahPada: string;
  jejak: JejakEval[];
}

/** pengadaan (SPPBJ / Non PR PO) yang ringkas — cukup untuk mencocokkan barang */
export interface Pengadaan {
  id: string;
  asal: "sppbj" | "nonpr";
  nomor: string;
  nama: string;
  tanggal: string;
  status: string;
  tahapScm: string;
  items: { kapal: string; nama: string; spesifikasi: string }[];
}

/** satu barang di layar monitoring — gabungan bacaan + penilaian + status */
export interface BarisMonitor {
  kunci: string;
  fileId: string;
  indeks: number;
  kirimanId: string;
  kapal: string;
  jenis: string;
  periode: string;
  dikirimPada: string;
  pengirim: string;
  berkasNama: string;
  berkasUrl: string;
  nama: string;
  spesifikasi: string;
  jumlah: string;
  satuan: string;
  keterangan: string;
  hargaManual: string;
  /** laporan ketidaksesuaian / kerusakan menyertai permintaan ini */
  adaLk: boolean;
  catatanKapal: string;
  ev: EvalPermintaan | null;
  saranPrioritas: Prioritas;
  saranKlasifikasi: Klasifikasi;
  prioritas: Prioritas;
  klasifikasi: Klasifikasi;
  /** true bila prioritas/klasifikasi di atas masih saran mesin, belum dikonfirmasi */
  prioritasSaran: boolean;
  klasifikasiSaran: boolean;
  tahap: Tahap;
  pengadaan: Pengadaan | null;
  pengadaanOtomatis: boolean;
  umurHari: number;
  menggantung: boolean;
  dimintaUlang: number;
}

/* ── permintaan yang diinput kantor ──────────────────────────────────────── */

export const KIND_MANUAL = "permintaan_manual";

/**
 * Permintaan yang tidak datang lewat aplikasi — WhatsApp, kertas, telepon —
 * atau yang terlewat dikirim ABK. Diinput kantor, lalu diperlakukan sama
 * dengan kiriman kapal: barangnya dinilai dan dipantau di layar yang sama.
 */
export interface PermintaanManual {
  kind: typeof KIND_MANUAL;
  id: string;
  kapal: string;
  jenis: "permintaan_deck" | "permintaan_mesin";
  /** tanggal permintaan (YYYY-MM-DD) — dasar urutan */
  tanggal: string;
  nomor: string;
  catatan: string;
  /** diisi bila ini TAMBAHAN untuk kiriman kapal yang sudah ada (barang terlewat) */
  untukKiriman?: string;
  baris: { nama: string; spesifikasi: string; jumlah: string; satuan: string; keterangan: string }[];
  oleh: string;
  dibuatPada: string;
  diubahPada: string;
}

/** awalan fileId untuk barang yang tidak berasal dari berkas Drive */
export const AWALAN_MANUAL = "manual:";
