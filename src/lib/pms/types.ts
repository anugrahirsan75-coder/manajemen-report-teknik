/**
 * PMS — Planned Maintenance System.
 *
 * Bagian ini SENGAJA berdiri sendiri, terpisah dari Docking, Kerusakan, dan
 * Pengadaan. Ketiganya menjawab "apa yang sudah terjadi dan berapa biayanya";
 * PMS menjawab hal lain: "apa yang HARUS dikerjakan sebelum rusak".
 *
 * Dua benda yang menopang seluruhnya:
 *
 *   PERALATAN — barang yang dirawat, punya TAG (ME-01, PMP-GS-01). Tanpa tag,
 *   sebuah pekerjaan berkala tidak punya tempat menempel dan riwayatnya tak
 *   bisa dikumpulkan. Inilah yang selama ini tidak ada di aplikasi.
 *
 *   RENCANA KERJA — pekerjaan berulang pada satu peralatan, berjarak JAM JALAN
 *   (250/500/1000 jam) atau KALENDER (bulanan/tahunan).
 *
 * Jatuh temponya dihitung, tidak diketik. Angka yang diketik tangan akan basi
 * diam-diam begitu lembarnya tidak dibuka — dan justru kebasian itulah yang
 * membuat perawatan berkala terlewat.
 */

export const SISTEM = [
  "Propulsi & Kemudi",
  "Permesinan Bantu",
  "Kelistrikan",
  "Perpipaan & Pompa",
  "Geladak & Tambat",
  "Keselamatan",
  "Navigasi & Komunikasi",
  "Lambung & Konstruksi",
  "Akomodasi & Sanitasi",
] as const;
export type Sistem = (typeof SISTEM)[number];

/**
 * Tingkat kekritisan.
 *
 * "kritis" bukan hiasan: ISM menuntut peralatan yang kegagalannya berbahaya
 * (kemudi, pemadam, mesin induk) diperlakukan khusus — diuji berkala dan
 * didahulukan. Penanda ini yang membuat daftar jatuh tempo bisa diurutkan
 * menurut akibat, bukan sekadar menurut tanggal.
 */
export const KEKRITISAN = ["kritis", "penting", "biasa"] as const;
export type Kekritisan = (typeof KEKRITISAN)[number];

export const WARNA_KRITIS: Record<Kekritisan, string> = {
  kritis: "bg-red-100 text-red-700 ring-red-200",
  penting: "bg-amber-100 text-amber-700 ring-amber-200",
  biasa: "bg-slate-100 text-slate-600 ring-slate-200",
};

export interface Peralatan {
  id: string;
  tag: string;
  nama: string;
  sistem: Sistem;
  merek?: string;
  tipe?: string;
  nomorSeri?: string;
  kekritisan: Kekritisan;
  /**
   * Nama mesin sebagaimana ditulis ABK di Portal Kapal (JamMesin.mesin).
   * Diisi hanya untuk peralatan berjam-meter; itulah yang menyambungkan
   * rencana berbasis jam ke angka yang dikirim kapal.
   */
  sumberJam?: string;
  catatan?: string;
  aktif: boolean;
}

export type Basis = "jam" | "kalender";

export interface RencanaKerja {
  id: string;
  /** tag peralatan yang dirawat */
  tag: string;
  pekerjaan: string;
  basis: Basis;
  intervalJam?: number;
  intervalHari?: number;
  penanggung: string;
  langkah?: string;
  sukuCadang?: string;
  /** capaian terakhir — dasar hitung jatuh tempo berikutnya */
  terakhirTanggal?: string;
  terakhirJam?: number;
  aktif: boolean;
}

export interface PmsKapal {
  kapal: string;
  peralatan: Peralatan[];
  rencana: RencanaKerja[];
  diubahPada?: string;
}

/* ── jatuh tempo ──────────────────────────────────────────────────────── */

export type StatusJatuh = "terlambat" | "segera" | "aman" | "belum";

export const WARNA_STATUS: Record<StatusJatuh, string> = {
  terlambat: "bg-red-600 text-white",
  segera: "bg-amber-500 text-white",
  aman: "bg-emerald-600 text-white",
  belum: "bg-slate-300 text-slate-700",
};

export const LABEL_STATUS: Record<StatusJatuh, string> = {
  terlambat: "Terlambat",
  segera: "Segera",
  aman: "Aman",
  belum: "Belum disetel",
};

export interface Jatuh {
  status: StatusJatuh;
  /** angka sisa: hari untuk kalender, jam untuk basis jam (minus = lewat) */
  sisa?: number;
  satuan: "hari" | "jam" | "";
  teks: string;
}

const hariAntara = (a: Date, b: Date) =>
  Math.round((b.setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) / 86400000);

/**
 * Hitung jatuh tempo satu rencana.
 *
 * Ambang "segera" ikut panjang intervalnya, bukan angka tetap: sisa 14 hari
 * pada pekerjaan bulanan berarti setengah jalan, sedangkan pada pekerjaan
 * tahunan itu benar-benar sudah di depan mata. Ambang tetap akan menyalakan
 * peringatan terlalu dini pada satu sisi dan terlambat pada sisi lain.
 */
export function hitungJatuh(r: RencanaKerja, jamSekarang?: number, hariIni = new Date()): Jatuh {
  if (r.basis === "jam") {
    const interval = Number(r.intervalJam) || 0;
    if (!interval) return { status: "belum", satuan: "", teks: "interval jam belum diisi" };
    if (jamSekarang === undefined || r.terakhirJam === undefined) {
      return { status: "belum", satuan: "", teks: "jam jalan belum ada dari kapal" };
    }
    const berjalan = Math.max(0, jamSekarang - Number(r.terakhirJam));
    const sisa = Math.round(interval - berjalan);
    const ambang = Math.max(25, Math.round(interval * 0.15));
    const status: StatusJatuh = sisa < 0 ? "terlambat" : sisa <= ambang ? "segera" : "aman";
    return {
      status, sisa, satuan: "jam",
      teks: sisa < 0 ? `lewat ${Math.abs(sisa)} jam` : `sisa ${sisa} jam`,
    };
  }

  const interval = Number(r.intervalHari) || 0;
  if (!interval) return { status: "belum", satuan: "", teks: "interval hari belum diisi" };
  if (!r.terakhirTanggal) return { status: "belum", satuan: "", teks: "tanggal terakhir belum diisi" };
  const lewatHari = hariAntara(new Date(r.terakhirTanggal), new Date(hariIni));
  const sisa = interval - lewatHari;
  const ambang = Math.max(7, Math.round(interval * 0.15));
  const status: StatusJatuh = sisa < 0 ? "terlambat" : sisa <= ambang ? "segera" : "aman";
  return {
    status, sisa, satuan: "hari",
    teks: sisa < 0 ? `lewat ${Math.abs(sisa)} hari` : `sisa ${sisa} hari`,
  };
}

/** urutan tampil daftar jatuh tempo: yang paling mendesak lebih dulu */
export const URUT_STATUS: Record<StatusJatuh, number> = { terlambat: 0, segera: 1, belum: 2, aman: 3 };
export const URUT_KRITIS: Record<Kekritisan, number> = { kritis: 0, penting: 1, biasa: 2 };

/* ── template awal ────────────────────────────────────────────────────── */

/**
 * Susunan peralatan baku kapal penyeberangan, dipakai sebagai TITIK AWAL.
 *
 * Tidak diisikan otomatis ke semua kapal. Armada cabang tidak seragam — ada
 * yang bermesin tunggal, ada yang tanpa bow thruster — dan daftar yang terlihat
 * lengkap padahal salah justru lebih berbahaya daripada daftar kosong: orang
 * berhenti memeriksanya. Jadi template ini hanya berjalan ketika dipanggil,
 * per kapal, lalu disunting.
 */
export interface ButirTemplate {
  tag: string; nama: string; sistem: Sistem; kekritisan: Kekritisan; sumberJam?: string;
}

export const TEMPLATE_PERALATAN: ButirTemplate[] = [
  { tag: "ME-01", nama: "Mesin Induk Kanan", sistem: "Propulsi & Kemudi", kekritisan: "kritis", sumberJam: "ME Kanan" },
  { tag: "ME-02", nama: "Mesin Induk Kiri", sistem: "Propulsi & Kemudi", kekritisan: "kritis", sumberJam: "ME Kiri" },
  { tag: "GB-01", nama: "Gearbox Kanan", sistem: "Propulsi & Kemudi", kekritisan: "kritis" },
  { tag: "GB-02", nama: "Gearbox Kiri", sistem: "Propulsi & Kemudi", kekritisan: "kritis" },
  { tag: "SHF-01", nama: "Poros & Baling-baling Kanan", sistem: "Propulsi & Kemudi", kekritisan: "kritis" },
  { tag: "SHF-02", nama: "Poros & Baling-baling Kiri", sistem: "Propulsi & Kemudi", kekritisan: "kritis" },
  { tag: "STG-01", nama: "Steering Gear", sistem: "Propulsi & Kemudi", kekritisan: "kritis" },
  { tag: "AE-01", nama: "Mesin Bantu / Genset 1", sistem: "Permesinan Bantu", kekritisan: "kritis", sumberJam: "AE 1" },
  { tag: "AE-02", nama: "Mesin Bantu / Genset 2", sistem: "Permesinan Bantu", kekritisan: "kritis", sumberJam: "AE 2" },
  { tag: "CMP-01", nama: "Kompresor Udara Start", sistem: "Permesinan Bantu", kekritisan: "penting" },
  { tag: "PMP-GS-01", nama: "Pompa General Service", sistem: "Perpipaan & Pompa", kekritisan: "penting" },
  { tag: "PMP-BLG-01", nama: "Pompa Got (Bilge)", sistem: "Perpipaan & Pompa", kekritisan: "kritis" },
  { tag: "PMP-FF-01", nama: "Pompa Pemadam", sistem: "Keselamatan", kekritisan: "kritis" },
  { tag: "PMP-BL-01", nama: "Pompa Ballast", sistem: "Perpipaan & Pompa", kekritisan: "penting" },
  { tag: "SW-01", nama: "Sea Chest & Katup Laut", sistem: "Perpipaan & Pompa", kekritisan: "kritis" },
  { tag: "PNL-01", nama: "Panel Utama (MSB)", sistem: "Kelistrikan", kekritisan: "kritis" },
  { tag: "BAT-01", nama: "Baterai / Aki Start", sistem: "Kelistrikan", kekritisan: "penting" },
  { tag: "WCH-01", nama: "Winch Jangkar", sistem: "Geladak & Tambat", kekritisan: "penting" },
  { tag: "RMP-01", nama: "Ramp Door", sistem: "Geladak & Tambat", kekritisan: "kritis" },
  { tag: "FFE-01", nama: "APAR & Instalasi Pemadam", sistem: "Keselamatan", kekritisan: "kritis" },
  { tag: "LSA-01", nama: "Alat Penolong (Liferaft, Lifejacket)", sistem: "Keselamatan", kekritisan: "kritis" },
  { tag: "NAV-01", nama: "Radar, GPS, AIS", sistem: "Navigasi & Komunikasi", kekritisan: "kritis" },
  { tag: "RAD-01", nama: "Radio VHF", sistem: "Navigasi & Komunikasi", kekritisan: "kritis" },
  { tag: "HUL-01", nama: "Lambung & Tangki", sistem: "Lambung & Konstruksi", kekritisan: "penting" },
];

export interface RencanaTemplate {
  tag: string; pekerjaan: string; basis: Basis;
  intervalJam?: number; intervalHari?: number; penanggung: string; sukuCadang?: string;
}

export const TEMPLATE_RENCANA: RencanaTemplate[] = [
  { tag: "ME-01", pekerjaan: "Ganti minyak lumas dan filter oli", basis: "jam", intervalJam: 250, penanggung: "Masinis II", sukuCadang: "Oli SAE 40, filter oli, filter solar" },
  { tag: "ME-01", pekerjaan: "Skir katup dan setel celah", basis: "jam", intervalJam: 1000, penanggung: "KKM", sukuCadang: "Gasket head, pasta skir" },
  { tag: "ME-02", pekerjaan: "Ganti minyak lumas dan filter oli", basis: "jam", intervalJam: 250, penanggung: "Masinis II", sukuCadang: "Oli SAE 40, filter oli, filter solar" },
  { tag: "ME-02", pekerjaan: "Skir katup dan setel celah", basis: "jam", intervalJam: 1000, penanggung: "KKM", sukuCadang: "Gasket head, pasta skir" },
  { tag: "AE-01", pekerjaan: "Servis berkala genset", basis: "jam", intervalJam: 250, penanggung: "Masinis III", sukuCadang: "Oli, filter oli, filter solar, filter udara" },
  { tag: "AE-02", pekerjaan: "Servis berkala genset", basis: "jam", intervalJam: 250, penanggung: "Masinis III", sukuCadang: "Oli, filter oli, filter solar, filter udara" },
  { tag: "GB-01", pekerjaan: "Periksa dan ganti oli gearbox", basis: "jam", intervalJam: 1000, penanggung: "KKM", sukuCadang: "Oli roda gigi SAE 90" },
  { tag: "STG-01", pekerjaan: "Uji fungsi kemudi darurat dan periksa kebocoran hidrolik", basis: "kalender", intervalHari: 30, penanggung: "Mualim I" },
  { tag: "PMP-FF-01", pekerjaan: "Uji jalan pompa pemadam dan tekanan hidran", basis: "kalender", intervalHari: 30, penanggung: "Mualim I" },
  { tag: "PMP-BLG-01", pekerjaan: "Uji jalan pompa got dan bersihkan saringan", basis: "kalender", intervalHari: 30, penanggung: "Masinis II" },
  { tag: "FFE-01", pekerjaan: "Pemeriksaan bulanan APAR (tekanan, segel, selang)", basis: "kalender", intervalHari: 30, penanggung: "Mualim I" },
  { tag: "FFE-01", pekerjaan: "Isi ulang / uji tekan tabung APAR", basis: "kalender", intervalHari: 365, penanggung: "Mualim I" },
  { tag: "LSA-01", pekerjaan: "Servis tahunan liferaft di stasiun resmi", basis: "kalender", intervalHari: 365, penanggung: "Mualim I" },
  { tag: "BAT-01", pekerjaan: "Periksa air aki, terminal, dan tegangan", basis: "kalender", intervalHari: 30, penanggung: "Masinis III" },
  { tag: "PNL-01", pekerjaan: "Megger test dan pengencangan terminal panel", basis: "kalender", intervalHari: 180, penanggung: "KKM" },
  { tag: "WCH-01", pekerjaan: "Pelumasan winch dan periksa kanvas rem", basis: "kalender", intervalHari: 90, penanggung: "Mualim I" },
  { tag: "RMP-01", pekerjaan: "Pelumasan engsel, periksa wire dan hidrolik ramp door", basis: "kalender", intervalHari: 30, penanggung: "Mualim I" },
  { tag: "SW-01", pekerjaan: "Bersihkan saringan sea chest", basis: "kalender", intervalHari: 90, penanggung: "Masinis II" },
  { tag: "NAV-01", pekerjaan: "Uji fungsi radar, GPS, dan AIS", basis: "kalender", intervalHari: 30, penanggung: "Mualim I" },
  { tag: "CMP-01", pekerjaan: "Kuras air kondensat dan periksa katup pengaman", basis: "kalender", intervalHari: 30, penanggung: "Masinis III" },
];

export const PENANGGUNG = ["Nakhoda", "Mualim I", "Mualim II", "KKM", "Masinis II", "Masinis III", "Mandor Mesin", "Staf Teknik"];

export const idBaru = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const peralatanBaru = (): Peralatan => ({
  id: idBaru(), tag: "", nama: "", sistem: "Permesinan Bantu", kekritisan: "biasa", aktif: true,
});

export const rencanaBaru = (tag = ""): RencanaKerja => ({
  id: idBaru(), tag, pekerjaan: "", basis: "kalender", intervalHari: 30,
  penanggung: "Masinis II", aktif: true,
});
