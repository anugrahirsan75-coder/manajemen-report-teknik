/**
 * RKA 2026 cabang Ternate — dari "KONTROL ANGGARAN TERNATE.xlsx".
 *
 * Dipakai sebagai PEMBANDING, bukan sumber realisasi: pagu docking mengisi
 * sendiri kolom pagu di Perencanaan Docking, investasi dipakai menakar usulan
 * belanja modal, dan pagu rutin per bulan jadi acuan Kendali Anggaran Rutin.
 *
 * Angka RKA docking sudah diadu dengan berkas asalnya: Rp 21.672.854.585 untuk
 * 13 kapal — sama persis dengan jumlah kolom RKA di sana.
 */
import data from "./rka2026.json";

export interface PosDocking {
  rka: number; tambahan: number; persetujuan: number;
  release: number; realisasi: number; label: string;
}
export interface BarisInvestasi {
  kapal: string; ma: string; uraian: string; program: string; nilai: number;
}

interface Rka {
  tahun: number; sumber: string;
  docking: Record<string, Record<string, PosDocking>>;
  investasi: BarisInvestasi[];
  rutin: Record<string, Record<string, number[]>>;
}
const RKA = data as unknown as Rka;

export const TAHUN_RKA = RKA.tahun;
export const SUMBER_RKA = RKA.sumber;

/** kode M.A. -> kelompok RAB penunjang pada Perencanaan Docking */
const KE_KELOMPOK: Record<string, string> = {
  "5010403003": "roro",
  "5010318000": "sertifikasi",
  "5010317000": "sertifikasi",
  "5010302004": "mobilisasi",
  "5010302006": "fumigasi",
  "5011099006": "fumigasi",
  "5010403009": "akomodasi",
  "5010403100": "permesinan",
};

/** nama kapal ditulis berbeda-beda antar berkas — samakan sebelum dicocokkan */
const kunci = (s: string) =>
  (s || "").toUpperCase().replace(/^(KMP|KM|BUS AIR)\.?\s*/i, "").replace(/[^A-Z0-9]/g, "");

const cariKapal = (kapal: string) => {
  const k = kunci(kapal);
  const nama = Object.keys(RKA.docking).find((x) => kunci(x) === k);
  return nama ? RKA.docking[nama] : undefined;
};

/** seluruh pos RKA docking satu kapal, apa adanya (termasuk pelumas) */
export const posDocking = (kapal: string) => cariKapal(kapal) || {};

/**
 * Pagu per kelompok RAB penunjang untuk satu kapal.
 * Pelumas & pengangkutannya tidak punya kelompok penunjang — dikembalikan
 * terpisah supaya tetap kelihatan, bukan dibuang diam-diam.
 */
export function paguDocking(kapal: string): { pagu: Record<string, number>; luarKelompok: PosDocking[] } {
  const pos = posDocking(kapal);
  const pagu: Record<string, number> = {};
  const luar: PosDocking[] = [];
  for (const [ma, v] of Object.entries(pos)) {
    const kel = KE_KELOMPOK[ma];
    if (kel) pagu[kel] = (pagu[kel] || 0) + (v.rka || 0);
    else if (v.rka) luar.push(v);
  }
  const inv = investasiKapal(kapal).reduce((s, x) => s + x.nilai, 0);
  if (inv) pagu.investasi = inv;
  return { pagu, luarKelompok: luar };
}

export const investasiKapal = (kapal: string) =>
  RKA.investasi.filter((x) => kunci(x.kapal) === kunci(kapal));

/** pagu rutin 12 bulan per Mata Anggaran untuk satu kapal */
export function rutinKapal(kapal: string): Record<string, number[]> {
  const k = kunci(kapal);
  const nama = Object.keys(RKA.rutin).find((x) => kunci(x) === k);
  return nama ? RKA.rutin[nama] : {};
}

/** pagu rutin satu kapal pada satu bulan (1-12), dijumlah per Mata Anggaran */
export function rutinBulan(kapal: string, bulan: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [ma, arr] of Object.entries(rutinKapal(kapal))) {
    const v = arr[bulan - 1] || 0;
    if (v) out[ma] = v;
  }
  return out;
}

export const daftarKapalRka = () => Object.keys(RKA.docking).sort();

/**
 * Pagu RKA rutin seluruh kapal untuk sederet bulan ("2026-03" dst.),
 * dijumlahkan per Mata Anggaran. Dipakai Kendali Anggaran Rutin sebagai
 * pembanding: pagu di sana adalah Persetujuan Pusat, RKA adalah rencana awal —
 * dua angka berbeda yang memang perlu dilihat berdampingan.
 */
export function rutinRentang(bulanYm: string[]): { perMa: Record<string, number>; total: number } {
  const perMa: Record<string, number> = {};
  for (const ym of bulanYm) {
    const [th, bl] = ym.split("-").map(Number);
    if (th !== RKA.tahun || !bl) continue;
    for (const kapal of Object.values(RKA.rutin)) {
      for (const [ma, arr] of Object.entries(kapal)) {
        const v = arr[bl - 1] || 0;
        if (v) perMa[ma] = (perMa[ma] || 0) + v;
      }
    }
  }
  return { perMa, total: Object.values(perMa).reduce((s, v) => s + v, 0) };
}
