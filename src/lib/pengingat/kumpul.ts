/**
 * Pusat pengingat "outstanding pekerjaan".
 *
 * Satu tempat yang menjawab: apa yang lewat tenggat / harus diurus hari ini?
 * Datanya dikumpulkan dari modul yang sudah ada — tidak ada angka baru yang
 * dihitung dengan cara berbeda, supaya tak pernah berselisih dengan halamannya.
 *
 * Kenapa bukan tiap modul bikin lonceng sendiri: tenggat itu lintas modul
 * (Lampiran 3, docking, termin, servis, kelas BKI), dan yang dibutuhkan
 * pengguna adalah SATU daftar terurut mendesak — bukan enam badge terpisah.
 */

export type TingkatPengingat = "lewat" | "mendesak" | "dekat" | "info";

export interface Pengingat {
  id: string;
  tingkat: TingkatPengingat;
  /** Notifikasi kejadian baru dibedakan dari pekerjaan/tenggat biasa. */
  jenis?: "notifikasi" | "pekerjaan";
  modul: string;          // label modul, mis. "Rencana & Realisasi"
  ikon: string;
  judul: string;
  rincian?: string;
  /** tenggat/acuan (ISO) — dipakai mengurutkan */
  tenggat?: string;
  /** + = sekian hari lagi, − = sudah lewat sekian hari */
  sisaHari?: number | null;
  href: string;           // ke mana pengguna dibawa
}

export const GAYA_TINGKAT: Record<TingkatPengingat, { chip: string; bar: string; label: string }> = {
  lewat: { chip: "bg-red-100 text-red-800 ring-red-300", bar: "bg-red-500", label: "Lewat tenggat" },
  mendesak: { chip: "bg-amber-100 text-amber-800 ring-amber-300", bar: "bg-amber-500", label: "Mendesak" },
  dekat: { chip: "bg-sky-100 text-sky-800 ring-sky-300", bar: "bg-sky-500", label: "Segera" },
  info: { chip: "bg-slate-100 text-slate-600 ring-slate-300", bar: "bg-slate-400", label: "Perlu diurus" },
};

const p2 = (n: number) => String(n).padStart(2, "0");
export const isoHariIni = (now = new Date()) =>
  `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;

export const selisihHari = (dari: string, ke: string): number | null => {
  if (!dari || !ke) return null;
  const a = new Date(dari + "T00:00:00").getTime();
  const b = new Date(ke + "T00:00:00").getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
};

/** tingkat dari sisa hari: lewat / ≤3 mendesak / ≤7 dekat / sisanya info */
export function tingkatDariSisa(sisa: number | null | undefined): TingkatPengingat {
  if (sisa == null) return "info";
  if (sisa < 0) return "lewat";
  if (sisa <= 3) return "mendesak";
  if (sisa <= 7) return "dekat";
  return "info";
}

/** Kejadian baru tampil paling atas, lalu pekerjaan paling mendesak. */
const BOBOT: Record<TingkatPengingat, number> = { lewat: 0, mendesak: 1, dekat: 2, info: 3 };
export const urutPengingat = (a: Pengingat, b: Pengingat) =>
  (a.jenis === "notifikasi" ? -1 : BOBOT[a.tingkat]) - (b.jenis === "notifikasi" ? -1 : BOBOT[b.tingkat])
  || (a.sisaHari ?? 9999) - (b.sisaHari ?? 9999);

export const ringkasTingkat = (list: Pengingat[]) => ({
  total: list.length,
  notifikasi: list.filter((x) => x.jenis === "notifikasi").length,
  lewat: list.filter((x) => x.tingkat === "lewat").length,
  mendesak: list.filter((x) => x.tingkat === "mendesak").length,
  dekat: list.filter((x) => x.tingkat === "dekat").length,
});

export const teksSisa = (sisa?: number | null) =>
  sisa == null ? "" : sisa < 0 ? `lewat ${-sisa} hari` : sisa === 0 ? "hari ini" : `${sisa} hari lagi`;
