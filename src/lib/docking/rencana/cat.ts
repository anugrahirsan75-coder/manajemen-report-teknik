/**
 * Kalkulator kebutuhan cat docking — rumus diambil dari berkas kerja cabang
 * "Perhitungan Kebutuhan CAT" dan sudah dicocokkan sel-per-sel dengan
 * KMP. NGAFI (LOA 39,38 · LBP 34,5 · B 11 · H 3,3 · T 2,3 · Cb 0,75):
 * bottom 430,008 m² dan boottop 81,725 m² — sama persis.
 *
 * Luas bidang (m²):
 *   Bottom  = 1,025 × LBP × ((Cb × B) + (1,7 × T))
 *   Boottop = ((H − T) × 1,025 × LBP × 2) + B
 *   Cardeck = (LOA × B) × 78%
 *   Deck    = (LBP × B × 4,8) − 20%
 *   Tangki  = (LBP × B × H × Cb) × 60%
 *   Rampdoor: luas baku 4×6 m dua muka (dalam) dan 24×2×2,4 (luar) — angka
 *   berkas; boleh ditimpa bila kapal punya ukuran sendiri.
 *
 * Volume cat = luas ÷ daya sebar (m²/liter, sudah termasuk loss factor pada
 * angka berkas); thinner = 20% dari jumlah cat bidang itu.
 */

export interface UkuranCat {
  loa: number; lbp: number; b: number; h: number; t: number; cb: number;
}

export interface LapisCat {
  nama: string;              // mis. "Cat Primer"
  spek: string;              // mis. "EPOXY (RED)"
  dayaSebar: number;         // m²/liter (0 = thinner, dihitung 20% dari cat)
  thinner?: boolean;
}

export interface BidangCat {
  key: string;
  nama: string;
  /** kelompok RAB tujuan + grupnya bila dimasukkan */
  kelompok: string; grup: string;
  luas: (u: UkuranCat) => number;
  lapis: LapisCat[];
}

const L = (nama: string, spek: string, dayaSebar: number): LapisCat => ({ nama, spek, dayaSebar });
const T = (nama: string): LapisCat => ({ nama, spek: "", dayaSebar: 0, thinner: true });

export const BIDANG_CAT: BidangCat[] = [
  {
    key: "bottom", nama: "Bottom (BGA)", kelompok: "roro", grup: "Cat BGA",
    luas: (u) => 1.025 * u.lbp * ((u.cb * u.b) + (1.7 * u.t)),
    lapis: [
      L("Cat Primer", "EPOXY", 3.32),
      L("Cat Anti Corrosive (AC)", "EPOXY", 5.69),
      T("Thinner Epoxy"),
      L("Cat Anti Fouling (AF)", "TIN FREE", 2.71),
      T("Thinner AF"),
    ],
  },
  {
    key: "boottop", nama: "Boottop", kelompok: "roro", grup: "Cat BGA",
    luas: (u) => ((u.h - u.t) * 1.025 * u.lbp * 2) + u.b,
    lapis: [
      L("Cat Primer", "EPOXY", 4.6),
      L("Cat AC", "", 5.79),
      L("Cat AC Finishes", "", 5.79),
      T("Thinner AC"),
    ],
  },
  {
    key: "cardeck", nama: "Car Deck", kelompok: "akomodasi", grup: "Cat AGA",
    luas: (u) => (u.loa * u.b) * 0.78,
    lapis: [L("Cat Primer", "", 4.87), L("Cat Epoxy", "", 4.59), T("Thinner Epoxy")],
  },
  {
    key: "rampDalam", nama: "Rampdoor Sisi Dalam", kelompok: "akomodasi", grup: "Cat AGA",
    luas: () => 4 * 6 * 2,
    lapis: [L("Cat Primer", "", 4.87), L("Cat Epoxy", "", 4.59), T("Thinner Epoxy")],
  },
  {
    key: "rampLuar", nama: "Rampdoor Sisi Luar", kelompok: "akomodasi", grup: "Cat AGA",
    luas: () => 24 * 2 * 2.4,
    lapis: [L("Cat Primer", "", 4.87), L("Cat Epoxy", "", 4.59), T("Thinner Epoxy")],
  },
  {
    key: "deck", nama: "Perawatan Deck Kapal", kelompok: "akomodasi", grup: "Cat AGA",
    luas: (u) => (u.lbp * u.b * 4.8) * 0.8,
    lapis: [L("Cat Primer Alkyd", "", 10.4), L("Cat Warna Alkyd", "Putih/Hijau dll.", 9.6), T("Thinner Alkyd")],
  },
  {
    key: "tangki", nama: "Perawatan Tangki-Tangki", kelompok: "roro", grup: "Cat BGA",
    luas: (u) => (u.lbp * u.b * u.h * u.cb) * 0.6,
    lapis: [L("Cat Primer Alkyd", "", 10.4), L("Cat Finishes Alkyd", "", 9.6), T("Thinner Alkyd")],
  },
];

export interface HasilLapis { nama: string; spek: string; liter: number; thinner: boolean }
export interface HasilBidang { key: string; nama: string; kelompok: string; grup: string; luas: number; lapis: HasilLapis[] }

/** hitung seluruh bidang; liter dibulatkan ke atas kelipatan 5 (kemasan cat) */
export function hitungCat(u: UkuranCat): HasilBidang[] {
  const bulat = (v: number) => Math.ceil(v / 5) * 5;
  return BIDANG_CAT.map((b) => {
    const luas = b.luas(u);
    let jumlahCat = 0;
    const lapis: HasilLapis[] = [];
    for (const l of b.lapis) {
      if (l.thinner) {
        lapis.push({ nama: l.nama, spek: l.spek, liter: bulat(jumlahCat * 0.2), thinner: true });
      } else {
        const liter = luas / l.dayaSebar;
        jumlahCat += liter;
        lapis.push({ nama: l.nama, spek: l.spek, liter: bulat(liter), thinner: false });
      }
    }
    return { key: b.key, nama: b.nama, kelompok: b.kelompok, grup: b.grup, luas: Math.round(luas * 100) / 100, lapis };
  });
}

export const totalLiter = (hasil: HasilBidang[]) =>
  hasil.reduce((s, b) => s + b.lapis.reduce((x, l) => x + l.liter, 0), 0);
