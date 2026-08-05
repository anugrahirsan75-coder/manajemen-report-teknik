/**
 * Monitor Sertifikat Kapal — bentuk data yang dipakai layar.
 *
 * Sumbernya lembar Google "MUSTER" milik cabang (13 kapal × sertifikat). Sisa
 * hari TIDAK diambil dari lembar itu: kolom sisa hari di sana ikut basi begitu
 * lembarnya tidak dibuka, sedangkan yang dipakai mengambil keputusan justru
 * hitungan hari ini. Jadi sisa hari dihitung ulang dari tanggal berlaku.
 */

export interface Sertifikat {
  kapal: string;
  /** kelompok aturan: SOLAS, MARPOL, BIRO KLASIFIKASI, ISM-CODE, … */
  kelompok: string;
  no: string;
  jenis: string;
  /** ISO yyyy-mm-dd, kosong bila tidak tercatat */
  terbit: string;
  berlaku: string;
  /** true untuk dokumen tanpa masa berlaku (Surat Laut, Surat Ukur, Grosse Akte) */
  permanen: boolean;
  /** null bila permanen atau tanggal berlakunya kosong */
  sisaHari: number | null;
  berkasNama: string;
  berkasUrl: string;
}

export type StatusSertifikat = "lewat" | "kritis" | "waspada" | "aman" | "permanen" | "kosong";

export const STATUS_SERT: Record<StatusSertifikat, { label: string; kelas: string; titik: string }> = {
  lewat: { label: "Kedaluwarsa", kelas: "bg-rose-100 text-rose-700 ring-rose-200", titik: "bg-rose-500" },
  kritis: { label: "≤ 30 hari", kelas: "bg-orange-100 text-orange-800 ring-orange-200", titik: "bg-orange-500" },
  waspada: { label: "≤ 90 hari", kelas: "bg-amber-100 text-amber-800 ring-amber-200", titik: "bg-amber-400" },
  aman: { label: "Aman", kelas: "bg-emerald-100 text-emerald-700 ring-emerald-200", titik: "bg-emerald-500" },
  permanen: { label: "Permanen", kelas: "bg-slate-100 text-slate-600 ring-slate-200", titik: "bg-slate-400" },
  kosong: { label: "Belum ada data", kelas: "bg-slate-50 text-slate-400 ring-slate-200", titik: "bg-slate-300" },
};

export function statusSert(s: Sertifikat): StatusSertifikat {
  if (s.permanen) return "permanen";
  if (s.sisaHari === null) return "kosong";
  if (s.sisaHari < 0) return "lewat";
  if (s.sisaHari <= 30) return "kritis";
  if (s.sisaHari <= 90) return "waspada";
  return "aman";
}

/** urutan mendesak lebih dulu — dipakai di tabel "perlu tindakan" */
export const bobotStatus: Record<StatusSertifikat, number> = {
  lewat: 0, kritis: 1, waspada: 2, kosong: 3, aman: 4, permanen: 5,
};

export const tanggalSert = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const bulan = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return bulan[+m] ? `${+d} ${bulan[+m]} ${y}` : iso;
};

export const teksSisa = (s: Sertifikat) => {
  if (s.permanen) return "Permanen";
  if (s.sisaHari === null) return "—";
  if (s.sisaHari < 0) return `Lewat ${Math.abs(s.sisaHari)} hari`;
  if (s.sisaHari === 0) return "Habis hari ini";
  return `${s.sisaHari} hari lagi`;
};

/** tautan lembar sumber, dibuka dari layar monitor */
export const URL_LEMBAR =
  "https://docs.google.com/spreadsheets/d/1gXk2f_QVsxgca_zKnQoLnVEe7ta3P8Ep/edit?gid=484570894#gid=484570894";
