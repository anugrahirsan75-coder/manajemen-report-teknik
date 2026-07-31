/**
 * Tahapan baku perencanaan docking — disalin dari berkas
 * "PROYEKSI DOCKING KAPAL TERNATE 2025.xlsx" (sheet Contoh), lalu diberi
 * jangka waktu supaya seluruh jadwal bisa lahir dari SATU tanggal: rencana
 * kapal naik dok.
 *
 * Berkas asalnya berisi tanggal yang diketik satu per satu tiap tahun. Di sini
 * yang disimpan adalah JARAK HARI tiap tugas terhadap tanggal naik dok (minus =
 * sebelum, plus = sesudah), jadi sekali tanggal docking digeser, semua tenggat
 * ikut bergeser — termasuk tenggat administrasi yang biasanya jadi penyebab
 * docking mundur.
 *
 * Jangka waktunya mengikuti alur nyata cabang: usulan RL ± 4 bulan sebelum
 * naik dok, persetujuan pusat ± 2 bulan, kontrak & pengadaan penunjang ± 1,5
 * bulan, mobilisasi beberapa hari sebelum naik dok. Semua boleh diubah per
 * rencana — nilai di sini hanya titik awal yang masuk akal.
 */

export type SifatTugas = "normal" | "urgent" | "top";
export type JenisTugas = "administratif" | "koordinatif" | "teknis";
/** patokan hitung tanggal: naik dok, atau selesai docking (akhir pengerjaan) */
export type Patokan = "naikDok" | "selesai";

export interface TugasBaku {
  id: string;
  fase: string;
  uraian: string;
  sifat: SifatTugas;
  jenis: JenisTugas[];
  pic: string[];
  /** hari terhadap patokan; -120 = 120 hari sebelum kapal naik dok */
  mulai: number;
  /** lama pengerjaan (hari kalender, minimal 1) */
  lama: number;
  patokan?: Patokan;      // baku "naikDok"
  /** tugas ini menghasilkan dokumen yang dipantau modul lain */
  tautan?: "repairList" | "persetujuan" | "kontrak" | "termin1" | "termin2" | "termin3" | "ba";
  catatan?: string;
}

export const FASE: { key: string; nama: string; warna: string }[] = [
  { key: "survey", nama: "A · Survey & Repair List", warna: "sky" },
  { key: "usul", nama: "B · Permohonan Persetujuan", warna: "indigo" },
  { key: "setuju", nama: "C · Persetujuan Pusat", warna: "violet" },
  { key: "siap", nama: "D · Persiapan Docking", warna: "amber" },
  { key: "pra", nama: "E · Pra Docking", warna: "orange" },
  { key: "mob", nama: "F · Mobilisasi", warna: "rose" },
  { key: "laksana", nama: "G · Pelaksanaan Docking", warna: "emerald" },
];
export const namaFase = (k: string) => FASE.find((f) => f.key === k)?.nama || k;

export const SIFAT_LABEL: Record<SifatTugas, string> = {
  normal: "Normal", urgent: "Urgent", top: "Top Urgent",
};
export const SIFAT_WARNA: Record<SifatTugas, string> = {
  normal: "bg-slate-100 text-slate-600 ring-slate-200",
  urgent: "bg-amber-100 text-amber-800 ring-amber-200",
  top: "bg-rose-100 text-rose-700 ring-rose-200",
};

const t = (
  id: string, fase: string, uraian: string, mulai: number, lama: number,
  sifat: SifatTugas, jenis: JenisTugas[], pic: string[],
  extra: Partial<TugasBaku> = {},
): TugasBaku => ({ id, fase, uraian, mulai, lama, sifat, jenis, pic, ...extra });

export const TUGAS_BAKU: TugasBaku[] = [
  // ── A. Survey & Repair List ────────────────────────────────────────────────
  t("a1", "survey", "Join Survey kapal (cabang + kapal + OS)", -150, 2, "normal", ["administratif", "koordinatif", "teknis"], ["Cabang", "Kapal"]),
  t("a2", "survey", "Penyusunan Repair List", -148, 5, "normal", ["administratif"], ["Kapal"], { tautan: "repairList" }),
  t("a3", "survey", "Kelengkapan berkas pendukung biaya & investasi", -143, 7, "normal", ["koordinatif"], ["Cabang", "Kapal"]),
  t("a4", "survey", "Penyusunan RAB penunjang docking (cat, SC, swakelola)", -140, 7, "normal", ["administratif", "teknis"], ["Cabang"]),

  // ── B. Permohonan Persetujuan ─────────────────────────────────────────────
  t("b1", "usul", "Kepastian ketersediaan dock space", -130, 7, "urgent", ["koordinatif", "administratif"], ["Cabang"]),
  t("b2", "usul", "Penawaran penyedia barang & jasa (galangan)", -123, 7, "normal", ["koordinatif"], ["Cabang"]),
  t("b3", "usul", "Permohonan persetujuan pelaksanaan docking ke pusat", -115, 3, "urgent", ["administratif", "koordinatif"], ["Cabang"], { tautan: "persetujuan" }),
  t("b4", "usul", "Permohonan penunjukan galangan pelaksana", -112, 3, "normal", ["administratif", "koordinatif"], ["Cabang"]),

  // ── C. Persetujuan Pusat ──────────────────────────────────────────────────
  t("c1", "setuju", "Evaluasi & persetujuan pelaksanaan docking", -105, 21, "normal", ["koordinatif", "administratif"], ["Pusat"], { tautan: "persetujuan" }),
  t("c2", "setuju", "Penunjukan Owner Surveyor docking", -84, 7, "normal", ["koordinatif", "administratif"], ["Pusat"]),
  t("c3", "setuju", "Rilis budget", -84, 14, "urgent", ["administratif"], ["Pusat"]),
  t("c4", "setuju", "Persetujuan galangan pelaksana docking", -77, 10, "normal", ["administratif", "koordinatif"], ["Regional"]),

  // ── D. Persiapan Docking ──────────────────────────────────────────────────
  t("d1", "siap", "Pembagian kerja: galangan · swakelola · vendor", -63, 5, "normal", ["administratif"], ["Cabang"]),
  t("d2", "siap", "Kontrak galangan", -58, 10, "urgent", ["administratif"], ["Cabang"], { tautan: "kontrak" }),
  t("d3", "siap", "Kontrak suku cadang", -58, 14, "urgent", ["administratif"], ["Cabang"], { tautan: "kontrak" }),
  t("d4", "siap", "Kontrak cat", -58, 14, "urgent", ["administratif"], ["Cabang"], { tautan: "kontrak" }),
  t("d5", "siap", "Kontrak service ILR / PMK / MES", -50, 14, "normal", ["administratif"], ["Cabang"]),
  t("d6", "siap", "Ketersediaan peralatan kerja permesinan", -35, 14, "normal", ["teknis"], ["Cabang"]),
  t("d7", "siap", "Ketersediaan peralatan kerja deck", -35, 14, "normal", ["teknis"], ["Cabang"]),
  t("d8", "siap", "Barang tiba di kapal: cat, suku cadang, seluruh material", -14, 12, "top", ["koordinatif"], ["Cabang"], { catatan: "penyebab paling sering docking molor" }),
  t("d9", "siap", "Permohonan survey BKI & statutoria", -30, 7, "urgent", ["administratif"], ["Cabang"]),
  t("d10", "siap", "Permohonan UT / NDT / vacuum test", -30, 7, "normal", ["administratif"], ["Cabang"]),

  // ── E. Pra Docking ────────────────────────────────────────────────────────
  t("e1", "pra", "Running / floating repair", -30, 14, "normal", ["teknis"], ["Cabang"]),
  t("e2", "pra", "Swakelola kapal", -30, 21, "normal", ["teknis"], ["Kapal"]),
  t("e3", "pra", "Cleaning tangki", -12, 7, "urgent", ["teknis"], ["Cabang"]),
  t("e4", "pra", "Cicilan overhaul (bila ada)", -30, 21, "normal", ["teknis"], ["Cabang"]),
  t("e5", "pra", "Perpipaan (bila ada)", -25, 14, "normal", ["teknis"], ["Cabang"]),
  t("e6", "pra", "Replating AGA (bila ada)", -25, 14, "normal", ["teknis"], ["Cabang"]),
  t("e7", "pra", "Outfitting (bila ada)", -25, 14, "normal", ["teknis"], ["Cabang"]),
  t("e8", "pra", "Perbengkelan (bila ada)", -25, 14, "normal", ["teknis"], ["Cabang"]),
  t("e9", "pra", "Pekerjaan akomodasi & fasilitas (bila ada)", -25, 14, "normal", ["teknis"], ["Cabang"]),

  // ── F. Mobilisasi ─────────────────────────────────────────────────────────
  t("f1", "mob", "Ketersediaan BBM & perbekalan mobilisasi", -7, 5, "urgent", ["teknis"], ["Cabang"]),
  t("f2", "mob", "Pemberitahuan keluar lintasan untuk docking", -7, 3, "normal", ["koordinatif", "administratif"], ["Cabang"]),
  t("f3", "mob", "Surat perintah berangkat docking", -3, 1, "normal", ["administratif"], ["Cabang", "Kapal"]),
  t("f4", "mob", "Mobilisasi ke galangan yang dituju", -2, 2, "urgent", ["teknis", "koordinatif"], ["Cabang", "Kapal"]),

  // ── G. Pelaksanaan Docking ────────────────────────────────────────────────
  t("g1", "laksana", "Kapal tiba galangan & naik dok", 0, 1, "normal", ["teknis"], ["Cabang", "Kapal"], { tautan: "ba" }),
  t("g2", "laksana", "Arrival meeting", 1, 1, "urgent", ["administratif"], ["OS", "Kapal", "Cabang"]),
  t("g3", "laksana", "Survey klas (BKI) & Marine Inspector", 2, 2, "top", ["koordinatif"], ["OS"]),
  t("g4", "laksana", "Memorandum & rekomendasi", 4, 2, "top", ["administratif"], ["OS"]),
  t("g5", "laksana", "Pembayaran Termin I (BA Naik Dok)", 5, 3, "urgent", ["administratif", "koordinatif"], ["Cabang"], { tautan: "termin1" }),
  t("g6", "laksana", "Permohonan persetujuan pekerjaan tambahan (OS)", 7, 3, "urgent", ["administratif"], ["OS"]),
  t("g7", "laksana", "Kelengkapan berkas pekerjaan tambahan", 10, 4, "urgent", ["administratif"], ["Cabang", "OS"]),
  t("g8", "laksana", "Persetujuan pekerjaan tambahan (addendum)", 14, 10, "urgent", ["administratif"], ["Pusat"]),
  t("g9", "laksana", "Progres report docking & swakelola (mingguan)", 7, 21, "urgent", ["teknis"], ["OS", "Cabang"]),
  t("g10", "laksana", "Undocking (turun dok)", -4, 2, "top", ["teknis", "koordinatif"], ["Cabang", "OS"], { patokan: "selesai" }),
  t("g11", "laksana", "Kesiapan & pengurusan fumigasi, sea trial, sertifikat", -6, 5, "urgent", ["administratif", "teknis", "koordinatif"], ["Cabang", "OS"], { patokan: "selesai" }),
  t("g12", "laksana", "Pelaksanaan sea trial", -2, 1, "top", ["teknis"], ["OS"], { patokan: "selesai" }),
  t("g13", "laksana", "Docking report", 0, 7, "normal", ["administratif"], ["OS", "Cabang"], { patokan: "selesai" }),
  t("g14", "laksana", "Kapal kembali ke lintasan", 1, 2, "urgent", ["teknis", "koordinatif"], ["OS", "Cabang"], { patokan: "selesai", tautan: "ba" }),
  t("g15", "laksana", "Pembayaran Termin II (BA Selesai Pekerjaan)", 3, 5, "urgent", ["administratif"], ["Cabang"], { patokan: "selesai", tautan: "termin2" }),
  t("g16", "laksana", "Masa pemeliharaan 30 hari", 1, 30, "normal", ["teknis"], ["Kapal", "Cabang"], { patokan: "selesai" }),
  t("g17", "laksana", "Pembayaran Termin III (BA Selesai Masa Pemeliharaan)", 31, 7, "urgent", ["administratif"], ["Cabang"], { patokan: "selesai", tautan: "termin3" }),
];

export interface TugasJadwal extends TugasBaku {
  mulaiTgl: string;   // ISO
  selesaiTgl: string; // ISO
}

/**
 * Tanggal ditulis memakai komponen LOKAL, bukan toISOString() — Ternate ada di
 * UTC+9, jadi toISOString() atas tengah malam lokal jatuh ke tanggal kemarin
 * dan seluruh jadwal ikut meleset sehari.
 */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const hariIniLokal = () => iso(new Date());

export function geser(tglIso: string, hari: number): string {
  const d = new Date(tglIso + "T00:00:00");
  d.setDate(d.getDate() + hari);
  return iso(d);
}
export const selisihHari = (a: string, b: string) =>
  Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);

/**
 * Susun jadwal dari tanggal naik dok + lama pengerjaan.
 * `ubahan` menimpa tugas tertentu (tanggal digeser tangan atau lamanya diubah).
 */
export function susunJadwal(
  naikDok: string,
  lamaDocking: number,
  ubahan: Record<string, { mulai?: string; lama?: number; buang?: boolean }> = {},
  tambahan: TugasBaku[] = [],
): TugasJadwal[] {
  if (!naikDok) return [];
  const selesai = geser(naikDok, Math.max(1, lamaDocking) - 1);
  return [...TUGAS_BAKU, ...tambahan]
    .filter((x) => !ubahan[x.id]?.buang)
    .map((x) => {
      const u = ubahan[x.id] || {};
      const dasar = x.patokan === "selesai" ? selesai : naikDok;
      const mulaiTgl = u.mulai || geser(dasar, x.mulai);
      const lama = Math.max(1, u.lama ?? x.lama);
      return { ...x, lama, mulaiTgl, selesaiTgl: geser(mulaiTgl, lama - 1) };
    })
    .sort((a, b) => a.mulaiTgl.localeCompare(b.mulaiTgl) || a.id.localeCompare(b.id));
}

/** tugas yang tenggatnya sudah lewat / segera, dibanding tanggal acuan */
export function statusTugas(t: TugasJadwal, hariIni: string, selesaiSet: Record<string, boolean>) {
  if (selesaiSet[t.id]) return "selesai" as const;
  if (t.selesaiTgl < hariIni) return "telat" as const;
  if (t.mulaiTgl <= hariIni) return "berjalan" as const;
  return "menunggu" as const;
}

/** ringkasan siap-tidaknya sebuah rencana */
export function ringkasJadwal(list: TugasJadwal[], hariIni: string, selesai: Record<string, boolean>) {
  let telat = 0, berjalan = 0, kelar = 0;
  for (const t of list) {
    const s = statusTugas(t, hariIni, selesai);
    if (s === "telat") telat++; else if (s === "berjalan") berjalan++; else if (s === "selesai") kelar++;
  }
  return { total: list.length, telat, berjalan, selesai: kelar, pct: list.length ? Math.round((kelar / list.length) * 100) : 0 };
}
