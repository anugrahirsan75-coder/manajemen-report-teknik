/**
 * Monitoring Docking Kapal — lama pengerjaan, berita acara, dan status kelas BKI.
 *
 * Tanggal milestone mengikuti form pusat (Jadwal Docking):
 *   keluar lintasan → berangkat galangan → tiba galangan → naik dock → turun dock
 *   → selesai pekerjaan → sea trial → kembali ke lintasan → tiba di lintasan → SKKP
 *
 * "Target Docking (hari)" pada form pusat dihitung dari kapal KELUAR LINTASAN
 * sampai TIBA DI LINTASAN lagi — itulah lama kapal berhenti melayani, jadi itu
 * pula yang dipakai sebagai angka utama di sini.
 */

export type StatusDocking = "rencana" | "berjalan" | "selesai";

/** Berita Acara baku Instruksi Kerja Owner Surveyor (kode dokumen ASDP). */
export const JENIS_BA = [
  { key: "serah_terima", kode: "TF-102.02.06", label: "BA Serah Terima Kapal", tahap: "tibaGalangan" },
  { key: "mulai", kode: "TF-102.02.11", label: "BA Mulai Pekerjaan", tahap: "tibaGalangan" },
  { key: "naik_dok", kode: "TF-102.02.07", label: "BA Naik Dok", tahap: "naikDock" },
  { key: "turun_dok", kode: "TF-102.02.08", label: "BA Turun Dok", tahap: "turunDock" },
  { key: "periksa", kode: "TF-102.02.09", label: "BA Pemeriksaan Hasil Pekerjaan", tahap: "selesaiPekerjaan" },
  { key: "selesai", kode: "TF-102.02.11", label: "BA Selesai Pekerjaan", tahap: "selesaiPekerjaan" },
  { key: "sea_trial", kode: "—", label: "BA Sea Trial", tahap: "seaTrial" },
  { key: "serah_kembali", kode: "—", label: "BA Serah Terima Kembali", tahap: "kembaliLintasan" },
  { key: "selesai_pemeliharaan", kode: "—", label: "BA Selesai Masa Pemeliharaan", tahap: "selesaiPemeliharaan" },
  { key: "lain", kode: "—", label: "Dokumen lain", tahap: "" },
] as const;
export type KeyBA = typeof JENIS_BA[number]["key"];
export const labelBA = (k: string) => JENIS_BA.find((x) => x.key === k)?.label || k;

export interface BerkasBA {
  id: string;
  jenis: string;      // KeyBA
  nama: string;       // nama berkas asli
  url: string;        // URL publik di Supabase Storage
  nomor?: string;     // No. BA, mis. 05/OS-TUNA/VI/ASDP-2026
  tanggal?: string;   // tanggal BA (ISO)
  ukuran?: number;    // byte
  diunggahPada?: string;
}

/** urutan milestone + labelnya (dipakai form, tabel, dan garis waktu) */
export const TAHAP: { key: string; label: string; wajib?: boolean }[] = [
  { key: "keluarLintasan", label: "Keluar Lintasan", wajib: true },
  { key: "berangkatGalangan", label: "Berangkat ke Galangan", wajib: true },
  { key: "tibaGalangan", label: "Tiba di Galangan", wajib: true },
  { key: "naikDock", label: "Naik Dock" },
  { key: "turunDock", label: "Turun Dock" },
  { key: "selesaiPekerjaan", label: "Selesai Pekerjaan Galangan" },
  { key: "seaTrial", label: "Sea Trial" },
  { key: "kembaliLintasan", label: "Kembali ke Lintasan" },
  { key: "tibaLintasan", label: "Tiba di Lintasan" },
  { key: "tanggalSKKP", label: "Tanggal SKKP" },
  // Bukan bagian lama docking: kapal sudah melayani lagi. Dicatat karena
  // menjadi pemicu pembayaran Termin III.
  { key: "selesaiPemeliharaan", label: "Selesai Masa Pemeliharaan" },
];

/** masa pemeliharaan baku setelah BA Selesai Pekerjaan (hari) */
export const MASA_PEMELIHARAAN_HARI = 30;
export type KeyTahap = typeof TAHAP[number]["key"];

export interface DockingJadwal {
  id: string;
  kapal: string;              // "KMP. TUNA"
  tahun: number;
  cabang: string;             // "Ternate"
  jadwalBulan?: string;       // bulan jadwal dari pusat
  bulanPelaksanaan?: string;
  galangan?: string;
  os?: string;                // Owner Surveyor
  tipe?: string;              // DOCKING / EMERGENCY DOCKING
  targetHari?: number;

  keluarLintasan?: string; berangkatGalangan?: string; tibaGalangan?: string;
  naikDock?: string; turunDock?: string; selesaiPekerjaan?: string;
  seaTrial?: string; kembaliLintasan?: string; tibaLintasan?: string; tanggalSKKP?: string;
  /** tanggal BA Selesai Masa Pemeliharaan (pemicu Termin III) */
  selesaiPemeliharaan?: string;
  /** lama masa pemeliharaan menurut kontrak — kosong = 30 hari */
  masaPemeliharaanHari?: number;

  /** nilai kontrak docking; dipakai menghitung nominal termin dari porsi persen */
  nilaiKontrak?: number;
  termin?: TerminBayar[];

  berkas?: BerkasBA[];
  /** checklist persiapan docking (SPPBJ repair list, anode, cat, dst.) */
  persiapan?: PersiapanItem[];
  catatan?: string;
  diubahPada?: string;
}

// ====================== termin pembayaran ======================

/**
 * Pembayaran docking dibayar 3 termin, masing-masing dipicu terbitnya sebuah
 * Berita Acara — bukan tanggal kalender. Jadi selama BA pemicunya belum ada,
 * termin itu belum boleh dibayar.
 */
export const TERMIN = [
  { ke: 1, label: "Termin I", pemicu: "naikDock", baKey: "naik_dok", baLabel: "BA Naik Dok" },
  { ke: 2, label: "Termin II", pemicu: "selesaiPekerjaan", baKey: "selesai", baLabel: "BA Selesai Pekerjaan" },
  { ke: 3, label: "Termin III", pemicu: "selesaiPemeliharaan", baKey: "selesai_pemeliharaan", baLabel: "BA Selesai Masa Pemeliharaan" },
] as const;

export interface TerminBayar {
  ke: number;              // 1 | 2 | 3
  persen?: number;         // porsi nilai kontrak
  nominal?: number;        // nominal bila tak memakai persen
  tanggalBayar?: string;
  noBukti?: string;        // no. kwitansi / SPP / voucher
  catatan?: string;
}

export type StatusTermin = "belum_siap" | "siap" | "menunggu" | "terlambat" | "dibayar";
export const STATUS_TERMIN: Record<StatusTermin, { label: string; chip: string }> = {
  belum_siap: { label: "BA belum ada", chip: "bg-slate-100 text-slate-600 ring-slate-300" },
  siap: { label: "Bisa dibayar", chip: "bg-sky-100 text-sky-800 ring-sky-300" },
  menunggu: { label: "Menunggu jatuh tempo", chip: "bg-slate-100 text-slate-600 ring-slate-300" },
  terlambat: { label: "Terlambat dibayar", chip: "bg-red-100 text-red-800 ring-red-300" },
  dibayar: { label: "Sudah dibayar", chip: "bg-emerald-100 text-emerald-800 ring-emerald-300" },
};

/** ambang hari sejak BA pemicu terbit sebelum termin dianggap terlambat dibayar */
export const AMBANG_TERLAMBAT = 14;

export interface RingkasTermin {
  ke: number;
  label: string;
  baLabel: string;
  /** tanggal BA pemicu (kalau sudah ada) */
  tanggalPemicu?: string;
  /** untuk Termin III: perkiraan tanggal BA bila belum terbit (selesai pekerjaan + masa pemeliharaan) */
  perkiraan?: string;
  adaBerkas: boolean;
  nominal: number | null;
  persen?: number;
  tanggalBayar?: string;
  noBukti?: string;
  status: StatusTermin;
  /** + = masih sekian hari lagi, − = sudah lewat sekian hari */
  sisaHari: number | null;
}

const p2 = (n: number) => String(n).padStart(2, "0");
export const tambahHari = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

/** jatuh tempo BA Selesai Masa Pemeliharaan = BA Selesai Pekerjaan + masa pemeliharaan */
export function jatuhTempoPemeliharaan(d: DockingJadwal): string {
  if (!d.selesaiPekerjaan) return "";
  return tambahHari(d.selesaiPekerjaan, d.masaPemeliharaanHari ?? MASA_PEMELIHARAAN_HARI);
}

export function ringkasTermin(d: DockingJadwal, now = new Date()): RingkasTermin[] {
  const hariIni = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;
  const berkas = d.berkas || [];
  return TERMIN.map((t) => {
    const simpan = (d.termin || []).find((x) => x.ke === t.ke);
    const tanggalPemicu = (d as any)[t.pemicu] as string | undefined;
    const perkiraan = t.ke === 3 && !tanggalPemicu ? jatuhTempoPemeliharaan(d) || undefined : undefined;
    const adaBerkas = berkas.some((b) => b.jenis === t.baKey);

    const nominal = simpan?.nominal
      ? simpan.nominal
      : simpan?.persen && d.nilaiKontrak
      ? Math.round((d.nilaiKontrak * simpan.persen) / 100)
      : null;

    const acuan = tanggalPemicu || perkiraan;
    const sisaHari = acuan ? hariAntara(hariIni, acuan) : null;

    let status: StatusTermin;
    if (simpan?.tanggalBayar) status = "dibayar";
    else if (!tanggalPemicu) status = perkiraan && (sisaHari ?? 1) > 0 ? "menunggu" : "belum_siap";
    else status = (sisaHari ?? 0) <= -AMBANG_TERLAMBAT ? "terlambat" : "siap";

    return {
      ke: t.ke, label: t.label, baLabel: t.baLabel,
      tanggalPemicu, perkiraan, adaBerkas, nominal,
      persen: simpan?.persen, tanggalBayar: simpan?.tanggalBayar, noBukti: simpan?.noBukti,
      status, sisaHari,
    };
  });
}

// ====================== checklist persiapan docking ======================

/**
 * Persiapan docking = deretan pengadaan yang HARUS beres sebelum/selama kapal
 * naik dock. Komponennya mengikuti Evaluasi Persetujuan Pusat (mis. Gorango
 * 2026: Docking Induk/Repair List, Anode, Cat BGA-AGA, Fumigasi, Surat Kapal,
 * Swakelola, Alat Kerja, Suku Cadang, Investasi, Mobilisasi/BBM) — tetapi tiap
 * kapal berbeda, jadi daftarnya bisa ditambah/dikurangi bebas per kapal.
 */
export type StatusSiap = "belum" | "proses" | "selesai" | "tidak_perlu";
export const STATUS_SIAP: Record<StatusSiap, { label: string; chip: string }> = {
  belum: { label: "Belum", chip: "bg-red-100 text-red-800 ring-red-300" },
  proses: { label: "Sedang diproses", chip: "bg-amber-100 text-amber-800 ring-amber-300" },
  selesai: { label: "Sudah", chip: "bg-emerald-100 text-emerald-800 ring-emerald-300" },
  tidak_perlu: { label: "Tidak perlu", chip: "bg-slate-100 text-slate-500 ring-slate-300" },
};

export interface PersiapanItem {
  id: string;
  nama: string;          // mis. "SPPBJ Repair List (Docking Induk)"
  status: StatusSiap;
  noRef?: string;        // No. SPPBJ / SPBJ / dokumen terkait
  tanggal?: string;      // ISO — kapan beres
  catatan?: string;
}

/** template awal — bisa diubah bebas per kapal setelah dibuat */
export const TEMPLATE_PERSIAPAN: string[] = [
  "SPPBJ Repair List (Docking Induk)",
  "Anode (Zinc Anode)",
  "Cat BGA / AGA / Kamar Mesin (Owner Supply)",
  "Perlengkapan Deck",
  "Alat Kerja Mesin & Deck",
  "Suku Cadang ME / AE",
  "Perbengkelan",
  "Swakelola Docking",
  "Fumigasi",
  "BBM Mobilisasi Docking",
  "Pelumas Docking",
  "Surat-Surat Kapal (Sertifikasi)",
  "Investasi (SC ME/AE, Kelistrikan, dll.)",
];

export const persiapanBaru = (nama = ""): PersiapanItem => ({
  id: globalThis.crypto?.randomUUID?.() ?? String(Math.random()),
  nama, status: "belum",
});

/** progres: yang "tidak perlu" dikeluarkan dari pembagi supaya 100% berarti benar-benar siap */
export function ringkasPersiapan(list: PersiapanItem[] | undefined) {
  const semua = list || [];
  const dihitung = semua.filter((x) => x.status !== "tidak_perlu");
  const selesai = dihitung.filter((x) => x.status === "selesai").length;
  const proses = dihitung.filter((x) => x.status === "proses").length;
  return {
    ada: semua.length > 0,
    total: dihitung.length,
    selesai, proses,
    belum: dihitung.length - selesai - proses,
    pct: dihitung.length ? Math.round((selesai / dihitung.length) * 100) : 0,
  };
}

// ====================== kelas / survey BKI ======================

/**
 * Kapal Ro-Ro di bawah klas BKI menjalani Survey Tahunan (AS = Annual Survey)
 * I–IV dalam satu daur 5 tahun, dengan Survey Pembaruan Kelas (SS = Special
 * Survey) di ujung daur. Survey Antara (IS) jatuh di sekitar AS II/III.
 * Tiap survey punya due date dan jendela ±3 bulan (range) menurut aturan BKI.
 */
export const JENIS_SURVEY = [
  { key: "AS I", label: "AS I — Survey Tahunan ke-1" },
  { key: "AS II", label: "AS II — Survey Tahunan ke-2" },
  { key: "AS III", label: "AS III — Survey Tahunan ke-3" },
  { key: "AS IV", label: "AS IV — Survey Tahunan ke-4" },
  { key: "IS", label: "IS — Survey Antara" },
  { key: "SS", label: "SS — Survey Pembaruan Kelas" },
  { key: "DS", label: "DS — Survey Pengedokan" },
] as const;

export type StatusSurvey = "belum" | "proses" | "selesai";
export const STATUS_SURVEY_LABEL: Record<StatusSurvey, string> = {
  belum: "Belum dilaksanakan", proses: "Sedang berjalan", selesai: "Selesai",
};

export interface KelasBki {
  id: string;
  kapal: string;
  tahun: number;
  jenis: string;         // dari JENIS_SURVEY
  dueDate?: string;      // tanggal jatuh tempo (ISO)
  rentangDari?: string;  // jendela survey (ISO)
  rentangSampai?: string;
  status: StatusSurvey;
  noSertifikat?: string;
  catatan?: string;
  diubahPada?: string;
}

// ====================== hitungan ======================

export const hariAntara = (a?: string, b?: string): number | null => {
  if (!a || !b) return null;
  const d1 = new Date(a + "T00:00:00").getTime();
  const d2 = new Date(b + "T00:00:00").getTime();
  if (isNaN(d1) || isNaN(d2)) return null;
  return Math.round((d2 - d1) / 86400000);
};

export interface RingkasDocking {
  status: StatusDocking;
  /** lama kapal berhenti melayani: keluar lintasan → tiba di lintasan */
  offLintasan: number | null;
  /** lama di galangan: tiba galangan → selesai pekerjaan */
  diGalangan: number | null;
  /** lama di atas dock: naik → turun */
  diAtasDock: number | null;
  /** berjalan berapa hari sampai hari ini (untuk yang belum selesai) */
  berjalan: number | null;
  /** angka yang dipakai grafik & tabel (off-lintasan bila lengkap, else di galangan) */
  utama: number | null;
  target: number | null;
  selisih: number | null;      // + = lewat target
  tepat: boolean | null;
  mulai?: string;
  akhir?: string;
}

export function ringkasDocking(d: DockingJadwal, now = new Date()): RingkasDocking {
  const target = d.targetHari && d.targetHari > 0 ? d.targetHari : null;
  const offLintasan = hariAntara(d.keluarLintasan, d.tibaLintasan);
  const diGalangan = hariAntara(d.tibaGalangan, d.selesaiPekerjaan);
  const diAtasDock = hariAntara(d.naikDock, d.turunDock);

  // Status tahan data separuh: berita acara sering hanya memuat sebagian tanggal.
  const sudahSelesai = !!(d.tibaLintasan || d.kembaliLintasan || d.selesaiPekerjaan);
  const sudahMulai = !!(d.keluarLintasan || d.berangkatGalangan || d.tibaGalangan || d.naikDock);
  const status: StatusDocking = sudahSelesai ? "selesai" : sudahMulai ? "berjalan" : "rencana";

  const hariIni = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const awal = d.keluarLintasan || d.berangkatGalangan || d.tibaGalangan || d.naikDock;
  const berjalan = status === "berjalan" ? hariAntara(awal, hariIni) : null;

  // angka utama: off-lintasan bila lengkap, kalau tidak pakai lama di galangan / di atas dock
  const dipakai = offLintasan ?? diGalangan ?? diAtasDock ?? berjalan;
  const selisih = target != null && dipakai != null ? dipakai - target : null;
  return {
    status, offLintasan, diGalangan, diAtasDock, berjalan, target, selisih, utama: dipakai,
    tepat: selisih == null ? null : selisih <= 0,
    mulai: awal,
    akhir: d.tibaLintasan || d.kembaliLintasan || d.selesaiPekerjaan || d.turunDock,
  };
}

/** warna status untuk grafik & lencana — nilai selalu ditemani angka/label */
export function gayaDocking(r: RingkasDocking) {
  if (r.status === "rencana") return { bar: "bg-slate-300", chip: "bg-slate-100 text-slate-600 ring-slate-300", teks: "Belum mulai" };
  if (r.status === "berjalan") return { bar: "bg-sky-500", chip: "bg-sky-100 text-sky-800 ring-sky-300", teks: "Sedang docking" };
  if (r.selisih == null) return { bar: "bg-slate-400", chip: "bg-slate-100 text-slate-600 ring-slate-300", teks: "Selesai" };
  if (r.selisih > 0) return { bar: "bg-red-500", chip: "bg-red-100 text-red-800 ring-red-300", teks: `Lewat ${r.selisih} hari` };
  if (r.selisih === 0) return { bar: "bg-amber-500", chip: "bg-amber-100 text-amber-800 ring-amber-300", teks: "Pas target" };
  return { bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800 ring-emerald-300", teks: `Lebih cepat ${-r.selisih} hari` };
}

export const dockingBaru = (kapal: string, tahun: number): DockingJadwal => ({
  id: globalThis.crypto?.randomUUID?.() ?? String(Math.random()),
  kapal, tahun, cabang: "Ternate", tipe: "DOCKING", berkas: [],
});

export const kelasBaru = (kapal: string, tahun: number): KelasBki => ({
  id: globalThis.crypto?.randomUUID?.() ?? String(Math.random()),
  kapal, tahun, jenis: "AS I", status: "belum",
});
