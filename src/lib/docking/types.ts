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
];
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

  berkas?: BerkasBA[];
  catatan?: string;
  diubahPada?: string;
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
