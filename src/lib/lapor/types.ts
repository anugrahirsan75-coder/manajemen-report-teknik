/**
 * Permintaan & Laporan Kapal — kiriman berkas dari ABK lewat halaman terbuka.
 *
 * Berkasnya sendiri TIDAK disimpan di Supabase, melainkan di Google Drive
 * pemilik (lewat Apps Script, lihat docs/lapor-apps-script.gs). Yang tersimpan
 * di basis data cuma catatan ringkas + tautan Drive, jadi kuota penyimpanan
 * Supabase tidak ikut terbebani berapa pun banyaknya berkas.
 */

export type JenisLapor = "permintaan_deck" | "permintaan_mesin" | "laporan_deck" | "laporan_mesin";

export const JENIS_LAPOR: { id: JenisLapor; label: string; singkat: string; ikon: string; bagian: "Deck" | "Mesin" }[] = [
  { id: "permintaan_deck", label: "Permintaan Kapal — Deck", singkat: "Permintaan Deck", ikon: "🧭", bagian: "Deck" },
  { id: "permintaan_mesin", label: "Permintaan Kapal — Mesin", singkat: "Permintaan Mesin", ikon: "⚙️", bagian: "Mesin" },
  { id: "laporan_deck", label: "Laporan Deck", singkat: "Laporan Deck", ikon: "📋", bagian: "Deck" },
  { id: "laporan_mesin", label: "Laporan Mesin", singkat: "Laporan Mesin", ikon: "📈", bagian: "Mesin" },
];

/**
 * Nama folder Drive untuk tiap jenis — kembaran LABEL di docs/lapor-apps-script.gs.
 * Dipakai kantor saat mencocokkan kiriman kosong dengan berkas yang ternyata
 * sudah ada di Drive; kalau daftar ini melenceng dari skripnya, foldernya tak
 * akan ketemu dan berkas yang ada tetap terbaca hilang.
 */
export const LABEL_FOLDER_DRIVE: Record<string, string> = {
  permintaan_deck: "Permintaan Deck",
  permintaan_mesin: "Permintaan Mesin",
  laporan_deck: "Laporan Deck",
  laporan_mesin: "Laporan Mesin",
};

export const labelJenis = (j: string) => JENIS_LAPOR.find((x) => x.id === j)?.label || j;
export const singkatJenis = (j: string) => JENIS_LAPOR.find((x) => x.id === j)?.singkat || j;

export type StatusLapor = "baru" | "dibaca" | "ditindaklanjuti" | "selesai";

export const STATUS_LAPOR: { id: StatusLapor; label: string; kelas: string }[] = [
  { id: "baru", label: "Baru", kelas: "bg-rose-100 text-rose-700 ring-rose-200" },
  { id: "dibaca", label: "Dibaca", kelas: "bg-slate-100 text-slate-700 ring-slate-200" },
  { id: "ditindaklanjuti", label: "Ditindaklanjuti", kelas: "bg-amber-100 text-amber-800 ring-amber-200" },
  { id: "selesai", label: "Selesai", kelas: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
];

export interface BerkasLapor {
  nama: string;
  mime: string;
  ukuran: number;
  /** id berkas di Google Drive */
  fileId: string;
  /** tautan buka di Drive */
  url: string;
  diunggahPada: string;
  /** kunci idempotensi: retry jaringan tidak membuat salinan Drive baru */
  unggahId?: string;
  /** tautannya ditambalkan kantor dari isi Drive, bukan datang dari unggahan ABK */
  ditautkanKantor?: boolean;
}

/** satu perubahan status — jejak supaya kantor tahu kapan sesuatu diputuskan */
export interface JejakStatus {
  status: StatusLapor;
  pada: string;
}

export interface KirimanLapor {
  id: string;
  kapal: string;
  jenis: JenisLapor;
  /** YYYY-MM — periode yang dilaporkan, bukan tanggal kirim */
  periode: string;
  pengirim: string;
  jabatan: string;
  kontak: string;
  catatan: string;
  berkas: BerkasLapor[];
  dikirimPada: string;
  status: StatusLapor;
  /** catatan internal dari kantor — tidak pernah keluar ke halaman terbuka */
  tindakLanjut: string;
  /** sebab kegagalan unggahan terakhir, diisi halaman ABK; kosong bila lancar */
  galatUnggah: string;
  /** kapan status terakhir diubah kantor — kosong bila belum pernah disentuh */
  statusPada?: string;
  /** riwayat perubahan status, terbaru di belakang (maksimal 20 langkah) */
  riwayatStatus?: JejakStatus[];
  /** kiriman ini digantikan kiriman lain (percobaan ulang yang berkasnya nihil) */
  digantikan?: string;
}

/** kiriman yang catatannya ada tapi berkasnya tidak pernah sampai */
export const kirimanGagal = (k: { berkas: unknown[] }) => k.berkas.length === 0;

/** nomor WA kantor untuk konfirmasi kiriman (format internasional tanpa +) */
export const WA_KONFIRMASI = "6281994892686";

export function tautanWa(pesan: string) {
  return `https://wa.me/${WA_KONFIRMASI}?text=${encodeURIComponent(pesan)}`;
}

export const bulanIndo = (p: string) => {
  const [y, m] = (p || "").split("-");
  const nama = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return nama[+m] ? `${nama[+m]} ${y}` : p || "—";
};

export const ukuranSingkat = (b: number) =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
