/**
 * INSPEKSI KAPAL — temuan Marine Superintendent dan penutupannya.
 *
 * Satu baris data = SATU TEMUAN, bukan satu laporan. Alasannya bukan selera:
 * yang dipantau kantor adalah temuan yang belum tertutup, dan temuan-temuan itu
 * berpindah status sendiri-sendiri, kadang berbulan-bulan setelah laporannya
 * ditandatangani. Menyimpannya sebagai daftar di dalam satu laporan berarti dua
 * orang yang menutup dua temuan berbeda pada laporan yang sama akan saling
 * menimpa pekerjaan.
 *
 * Bentuk kolomnya mengikuti formulir baku TF-101.00.03 "Resume Hasil Inspeksi
 * Kondisi Kapal" (NO · NAMA KOMPONEN · KONDISI PERALATAN: uraian/penyebab/
 * tindakan pencegahan · KLASIFIKASI), ditambah yang memang tidak ada di kertas
 * tetapi wajib ada untuk memantau: target selesai, penanggung jawab, status,
 * bukti perbaikan, dan jejak perubahannya.
 */

export type BagianInspeksi = "lambung" | "dek" | "navigasi" | "safety" | "mesin" | "akomodasi" | "lain";

export const BAGIAN_INSPEKSI: { id: BagianInspeksi; label: string; ikon: string }[] = [
  { id: "lambung", label: "Lambung", ikon: "🚢" },
  { id: "dek", label: "Dek", ikon: "🧭" },
  { id: "navigasi", label: "Navigasi", ikon: "📡" },
  { id: "safety", label: "Safety", ikon: "🦺" },
  { id: "mesin", label: "Mesin", ikon: "⚙️" },
  { id: "akomodasi", label: "Akomodasi", ikon: "🛏️" },
  { id: "lain", label: "Lain-lain", ikon: "📌" },
];

/**
 * Klasifikasi temuan. Tenggat bawaannya melekat di sini supaya tidak jadi
 * perdebatan tiap kali: temuan kritis menyangkut keselamatan berlayar dan tidak
 * boleh menunggu rapat berikutnya.
 */
export type TingkatTemuan = "kritis" | "mayor" | "minor";

export const TINGKAT_TEMUAN: { id: TingkatTemuan; label: string; hari: number; kelas: string; ket: string }[] = [
  { id: "kritis", label: "Kritis", hari: 7, kelas: "bg-rose-100 text-rose-800 ring-rose-200",
    ket: "menyangkut keselamatan / kelaiklautan — kapal tidak boleh menunggu" },
  { id: "mayor", label: "Mayor", hari: 30, kelas: "bg-amber-100 text-amber-800 ring-amber-200",
    ket: "mengganggu operasional, perlu perbaikan terjadwal" },
  { id: "minor", label: "Minor", hari: 60, kelas: "bg-slate-100 text-slate-700 ring-slate-200",
    ket: "perawatan biasa, dikerjakan pada kesempatan terdekat" },
];

export type StatusTemuan = "terbuka" | "proses" | "tunggu" | "selesai";

export const STATUS_TEMUAN: { id: StatusTemuan; label: string; kelas: string; warna: string }[] = [
  { id: "terbuka", label: "Terbuka", kelas: "bg-rose-100 text-rose-700 ring-rose-200", warna: "#e11d48" },
  { id: "proses", label: "Dikerjakan", kelas: "bg-sky-100 text-sky-700 ring-sky-200", warna: "#0284c7" },
  { id: "tunggu", label: "Menunggu barang/dok", kelas: "bg-amber-100 text-amber-800 ring-amber-200", warna: "#d97706" },
  { id: "selesai", label: "Selesai", kelas: "bg-emerald-100 text-emerald-700 ring-emerald-200", warna: "#059669" },
];

export type PenanggungJawab = "kapal" | "darat" | "galangan";

export interface BuktiTemuan {
  nama: string;
  mime: string;
  ukuran: number;
  fileId: string;
  url: string;
  diunggahPada: string;
  unggahId?: string;
  /** foto kondisi awal atau hasil perbaikan */
  jenis: "sebelum" | "sesudah";
}

export interface JejakTemuan {
  status: StatusTemuan;
  pada: string;
  catatan?: string;
}

export interface Temuan {
  id: string;
  kapal: string;
  /** YYYY-MM-DD */
  tanggalInspeksi: string;
  inspektor: string;
  bagian: BagianInspeksi;
  /** kolom "NAMA KOMPONEN" pada formulir baku */
  komponen: string;
  /** kolom "KONDISI PERALATAN — uraian" */
  uraian: string;
  penyebab: string;
  tindakan: string;
  tingkat: TingkatTemuan;
  /** YYYY-MM-DD; diisi otomatis dari tingkatnya bila dikosongkan */
  targetSelesai: string;
  penanggungJawab: PenanggungJawab;
  status: StatusTemuan;
  catatanTutup: string;
  /** penutupan wajib punya pemeriksa — lihat bolehTutup() */
  diverifikasiOleh: string;
  diverifikasiPada: string;
  bukti: BuktiTemuan[];
  riwayat: JejakTemuan[];
  /** nama berkas laporan asalnya, bila diimpor */
  sumber: string;
  dibuatPada: string;
  /** kunci unggah berkas bukti ke Drive */
  token?: string;
}

export const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const tambahHari = (iso: string, hari: number) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + hari);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** umur temuan dalam hari sejak inspeksi; dipakai mengelompokkan yang menganggur */
export const umurHari = (t: { tanggalInspeksi: string }) => {
  const d = new Date(`${t.tanggalInspeksi}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
};

/** temuan yang lewat tenggat dan belum selesai */
export const lewatTarget = (t: Temuan) =>
  t.status !== "selesai" && !!t.targetSelesai && t.targetSelesai < hariIni();

/**
 * Syarat menutup temuan.
 *
 * Status "selesai" tidak boleh sekadar diklik: harus ada bukti perbaikan dan
 * nama yang memverifikasi. Tanpa itu, rekap penutupan cepat terlihat bagus
 * sementara temuannya masih utuh di kapal — dan justru rekap semacam itu yang
 * membuat inspeksi berikutnya menemukan hal yang sama lagi.
 */
export function bolehTutup(t: Pick<Temuan, "bukti" | "diverifikasiOleh">): string[] {
  const kurang: string[] = [];
  if (!t.bukti.some((b) => b.jenis === "sesudah")) kurang.push("bukti perbaikan (foto/dokumen) belum diunggah");
  if (!t.diverifikasiOleh.trim()) kurang.push("nama pemeriksa belum diisi");
  return kurang;
}

export const labelBagian = (b: string) => BAGIAN_INSPEKSI.find((x) => x.id === b)?.label || b;
export const labelTingkat = (b: string) => TINGKAT_TEMUAN.find((x) => x.id === b)?.label || b;
export const labelStatus = (b: string) => STATUS_TEMUAN.find((x) => x.id === b)?.label || b;
export const kelasStatus = (b: string) =>
  STATUS_TEMUAN.find((x) => x.id === b)?.kelas || "bg-slate-100 text-slate-700 ring-slate-200";
export const kelasTingkat = (b: string) =>
  TINGKAT_TEMUAN.find((x) => x.id === b)?.kelas || "bg-slate-100 text-slate-700 ring-slate-200";

/**
 * Tebak bagian kapal dari nama komponennya.
 *
 * Laporan inspeksi tidak selalu menuliskan bagiannya; yang tertulis nama
 * barangnya. Tebakan ini hanya bawaan awal — orang kantor tetap bisa
 * mengubahnya saat meninjau hasil impor.
 */
const PETA_BAGIAN: [BagianInspeksi, RegExp][] = [
  ["safety", /life\s*raft|lifebuoy|life\s*jacket|pelampung|apar|fire|pemadam|hydrant|alarm|epirb|sart|smoke|parachute|flare|sekoci|muster/i],
  ["navigasi", /radar|gps|kompas|compass|ais|vhf|ssb|echo\s*sounder|navtex|lampu\s*navigasi|magnet|anemometer|radio|antena/i],
  ["mesin", /mesin|engine|\bm\/?e\b|\ba\/?e\b|genset|generator|pompa|pump|kompresor|turbo|gearbox|propeller|poros|kemudi\s*hidrolik|bahan\s*bakar|pelumas|cooler|filter|blower|kelistrikan|panel|batter|accu|alternator/i],
  ["lambung", /lambung|pelat|plat|gading|sekat|void|tank|bilge|dock|korosi|keropos|cat\s*bawah|zinc|anode|las/i],
  ["akomodasi", /akomodasi|kabin|kamar|toilet|dapur|pantry|ac\b|pendingin|kasur|kursi|meja|interior|air\s*tawar|sanitasi/i],
  ["dek", /dek|deck|winch|jangkar|anchor|tali|mooring|ramp\s*door|rampdoor|derek|railing|tangga|pintu|jendela|kaca/i],
];

export function tebakBagian(teks: string): BagianInspeksi {
  const t = String(teks || "");
  for (const [bagian, pola] of PETA_BAGIAN) if (pola.test(t)) return bagian;
  return "lain";
}

/** tebak klasifikasi dari kata-kata yang dipakai superintendent */
export function tebakTingkat(teks: string): TingkatTemuan {
  const t = String(teks || "").toLowerCase();
  if (/kritis|critical|bahaya|tidak\s*berfungsi|rusak\s*berat|mati\s*total|bocor\s*besar|segera/.test(t)) return "kritis";
  if (/mayor|major|rusak|bocor|retak|tidak\s*normal|kurang\s*berfungsi|expired|kadaluarsa/.test(t)) return "mayor";
  return "minor";
}
