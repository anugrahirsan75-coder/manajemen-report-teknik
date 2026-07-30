/**
 * Mesin hitung teknis RKA — meniru rumus berkas "Parameter perhitungan" &
 * "Schedule TP" pada workbook RKA per kapal.
 *
 * Rumus di bawah SUDAH DICOCOKKAN SEL-PER-SEL dengan workbook KMP. TUNA 2026:
 *   - topping up ME  : 0,001 × 0,8 × 1800 HP = 1,44 L/jam → × 3,25 jam = 4,68 L/trip
 *                      × 220 trip = 1.029,6 L → × Rp 30.143,54 = Rp 31.035.789  ✔
 *   - topping up AE  : 0,001 × 1 × 252 HP = 0,252 L/jam → × 12 jam/hari = 3,024 L/hari
 *                      × 366 hari = 1.106,784 L → Rp 33.362.389  ✔
 *   - penggantian    : kapasitas oil pan × jumlah mesin × harga/liter            ✔
 *   - jam kerja/minggu = Σ(trip per minggu × jam per trip)  → TUNA 93 jam/mgg    ✔
 *
 * Yang TIDAK bisa direplika persis dari berkas (dan karena itu dibuat sebagai
 * masukan, bukan tebakan): daftar suku cadang tiap Tingkat Perawatan. Di sini
 * dipakai "biaya per kejadian TP" yang diisi pengguna, dikalikan jumlah kejadian
 * yang dihitung otomatis dari jam kerja.
 */

export interface Lintasan {
  nama: string;
  tripPerMinggu: number;
  jamPerTrip: number;
}

export interface ParameterKapal {
  // identitas & mesin
  grt?: number;
  meUnit?: number; meHp?: number;
  aeUnit?: number; aeHp?: number;
  // operasi
  lintasan?: Lintasan[];
  hariOperasi?: number;      // hari operasi/stand-by setahun (mis. 366)
  tripSetahun?: number;      // total trip setahun (mis. 220) — dipakai topping-up ME
  jamPerTripUtama?: number;  // waktu tempuh 1 trip (jam) — mis. 3,25
  jamAePerHari?: number;     // jam kerja AE per hari (mis. 12)
  kecepatanKnot?: number;    // kecepatan dinas — jam/trip = jarak Nm / kecepatan
  jamKerjaAwalMe?: number;   // jam kerja ME saat awal tahun (dari counter mesin)
  jamKerjaAwalAe?: number;
  // pelumas
  constanta?: number;        // baku SOC = 0,001
  rendemenMe?: number;       // baku 0,8
  rendemenAe?: number;       // baku 1
  hargaPelumas?: number;     // Rp/liter pelumas mesin
  hargaHidraulik?: number;   // Rp/liter
  hargaGemuk?: number;       // Rp/kg
  kapasitasMe?: number;      // liter oil pan per ME
  kapasitasAe?: number;      // liter oil pan per AE
  gantiMeSetahun?: number;   // berapa kali ganti pelumas ME setahun (baku 1)
  gantiAeSetahun?: number;
  gemukKgPerBulan?: number;
  hidraulikLiterPerBulan?: number;
  // tingkat perawatan — biaya per satu kali kejadian
  biayaTpMe?: Record<string, number>;   // { TP1..TP6 }
  biayaTpAe?: Record<string, number>;
}

export const TP_INTERVAL: { key: string; label: string; jam: number }[] = [
  { key: "TP1", label: "TP 1 — harian", jam: 0 },
  { key: "TP2", label: "TP 2 — 250 jam", jam: 250 },
  { key: "TP3", label: "TP 3 — 500 jam", jam: 500 },
  { key: "TP4", label: "TP 4 — 1.000 jam", jam: 1000 },
  { key: "TP5", label: "TP 5 — 2.500 jam", jam: 2500 },
  { key: "TP6", label: "TP 6 — 5.000 jam", jam: 5000 },
];

export const PARAM_BAKU: Partial<ParameterKapal> = {
  constanta: 0.001, rendemenMe: 0.8, rendemenAe: 1,
  hariOperasi: 365, gantiMeSetahun: 1, gantiAeSetahun: 1,
};

/** kebutuhan gemuk baku per bulan menurut GRT (catatan berkas RKA) */
export function gemukBakuKg(grt?: number): number {
  if (!grt) return 0;
  if (grt > 1000) return 30;
  if (grt >= 401) return 20;
  if (grt >= 151) return 15;
  return 10;
}

const n = (v: any, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);

/** jam kerja mesin induk per MINGGU dari pola operasi */
export const jamPerMinggu = (p: ParameterKapal) =>
  (p.lintasan || []).reduce((s, l) => s + n(l.tripPerMinggu) * n(l.jamPerTrip), 0);

export interface HasilPelumas {
  toppingMeLiter: number; toppingMeRp: number;
  toppingAeLiter: number; toppingAeRp: number;
  gantiMeRp: number; gantiAeRp: number;
  hidraulikRp: number; gemukRp: number;
  total: number;
  /** angka antara supaya bisa ditelusuri pengguna */
  literPerJamMe: number; literPerTripMe: number;
  literPerJamAe: number; literPerHariAe: number;
}

export function hitungPelumas(p: ParameterKapal): HasilPelumas {
  const k = n(p.constanta, 0.001);
  const hargaP = n(p.hargaPelumas);
  const hpMe = n(p.meUnit) * n(p.meHp);
  const hpAe = n(p.aeUnit) * n(p.aeHp);

  const literPerJamMe = k * n(p.rendemenMe, 0.8) * hpMe;
  const literPerTripMe = literPerJamMe * n(p.jamPerTripUtama);
  const toppingMeLiter = literPerTripMe * n(p.tripSetahun);
  const toppingMeRp = toppingMeLiter * hargaP;

  const literPerJamAe = k * n(p.rendemenAe, 1) * hpAe;
  const literPerHariAe = literPerJamAe * n(p.jamAePerHari);
  const toppingAeLiter = literPerHariAe * n(p.hariOperasi, 365);
  const toppingAeRp = toppingAeLiter * hargaP;

  const gantiMeRp = n(p.kapasitasMe) * n(p.meUnit) * hargaP * n(p.gantiMeSetahun, 1);
  const gantiAeRp = n(p.kapasitasAe) * n(p.aeUnit) * hargaP * n(p.gantiAeSetahun, 1);

  const hidraulikRp = n(p.hidraulikLiterPerBulan) * 12 * n(p.hargaHidraulik);
  const gemukRp = n(p.gemukKgPerBulan) * 12 * n(p.hargaGemuk);

  return {
    toppingMeLiter, toppingMeRp, toppingAeLiter, toppingAeRp,
    gantiMeRp, gantiAeRp, hidraulikRp, gemukRp,
    total: toppingMeRp + toppingAeRp + gantiMeRp + gantiAeRp + hidraulikRp + gemukRp,
    literPerJamMe, literPerTripMe, literPerJamAe, literPerHariAe,
  };
}

export interface BarisTp { key: string; label: string; jam: number; kali: number; biaya: number; total: number }
export interface HasilTp { jamSetahun: number; jamAwal: number; jamAkhir: number; baris: BarisTp[]; total: number }

/**
 * Jumlah kejadian tiap Tingkat Perawatan setahun = berapa kali jam kerja
 * kumulatif melewati kelipatan intervalnya (persis cara berkas Schedule TP
 * menandai minggu). TP1 harian = jumlah hari operasi.
 */
export function hitungTp(p: ParameterKapal, biaya: Record<string, number> | undefined, mesin: "me" | "ae"): HasilTp {
  const jamSetahun = mesin === "me"
    ? jamPerMinggu(p) * 52
    : n(p.jamAePerHari) * n(p.hariOperasi, 365);
  const jamAwal = n(mesin === "me" ? p.jamKerjaAwalMe : p.jamKerjaAwalAe);
  const jamAkhir = jamAwal + jamSetahun;

  const baris = TP_INTERVAL.map((t) => {
    const kali = t.jam === 0
      ? n(p.hariOperasi, 365)
      : Math.max(0, Math.floor(jamAkhir / t.jam) - Math.floor(jamAwal / t.jam));
    const b = n(biaya?.[t.key]);
    return { key: t.key, label: t.label, jam: t.jam, kali, biaya: b, total: kali * b };
  });
  return { jamSetahun, jamAwal, jamAkhir, baris, total: baris.reduce((s, x) => s + x.total, 0) };
}

/** ringkasan lengkap untuk dipindahkan ke usulan RKA */
export function hitungSemua(p: ParameterKapal) {
  const pelumas = hitungPelumas(p);
  const tpMe = hitungTp(p, p.biayaTpMe, "me");
  const tpAe = hitungTp(p, p.biayaTpAe, "ae");
  return { pelumas, tpMe, tpAe, permesinan: tpMe.total + tpAe.total };
}
