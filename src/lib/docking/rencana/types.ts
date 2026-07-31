/**
 * Perencanaan Docking — model data.
 *
 * Mengikuti tiga berkas kerja yang selama ini dipakai cabang:
 *   1. REPAIR LIST (sheet "RL DOK" / "RL Floating")  → daftar pekerjaan galangan
 *   2. "Penunjang Docking"                            → RAB di luar kontrak galangan,
 *                                                       dikelompokkan per Mata Anggaran
 *   3. "PROYEKSI DOCKING"                             → jadwal tahapan (lihat tahapan.ts)
 *
 * Satu rencana = satu kapal, satu tahun docking.
 */

import { TugasBaku } from "./tahapan";

export const PPN_BAKU = 11;

/** kelompok RAB penunjang — persis judul romawi di berkas "Penunjang Docking" */
export interface KelompokPenunjang {
  key: string;
  romawi: string;
  nama: string;
  ma: string;                 // kode Mata Anggaran SAP
  sub: string[];              // sub-judul baku di dalamnya
}

export const KELOMPOK_PENUNJANG: KelompokPenunjang[] = [
  { key: "roro", romawi: "I", nama: "Pemeliharaan Kapal Ro-Ro / Penyeberangan", ma: "5010403003",
    sub: ["Docking Induk", "Cat BGA", "Penunjang Docking Lainnya", "Swakelola ABK"] },
  { key: "sertifikasi", romawi: "II", nama: "Sertifikasi Produksi Docking", ma: "5010318000",
    sub: ["Surat-Surat Kapal"] },
  { key: "mobilisasi", romawi: "III", nama: "Beban Mobilisasi Docking", ma: "5010302004",
    sub: ["BBM & Air Tawar", "Perbekalan & Personil"] },
  { key: "fumigasi", romawi: "IV", nama: "Fumigasi", ma: "5011099006",
    sub: ["Fumigasi (termasuk penginapan ABK)"] },
  { key: "akomodasi", romawi: "V", nama: "Akomodasi, Peralatan, dan Perlengkapan Kapal", ma: "5010403009",
    sub: ["Alat Kerja Deck", "Pemeliharaan Deck", "Alat Keselamatan", "Cat AGA",
          "Pemeliharaan Perlengkapan Kapal", "Pemeliharaan Peralatan Kapal"] },
  { key: "permesinan", romawi: "VI", nama: "Permesinan dan Kelistrikan", ma: "5010403100",
    sub: ["Suku Cadang Mesin Induk", "Suku Cadang Mesin Bantu", "Kelistrikan", "Jasa Perbengkelan"] },
  { key: "investasi", romawi: "VII", nama: "Investasi (belanja modal)", ma: "1020604",
    sub: ["Investasi Deck", "Investasi Permesinan", "Investasi Navigasi & Keselamatan"] },
];
export const kelompokPenunjang = (k: string) => KELOMPOK_PENUNJANG.find((x) => x.key === k);

/** dari mana harga sebuah baris diambil — dipakai menilai kewajaran usulan */
export type SumberHarga = "tarif" | "database" | "manual" | "penawaran";
export const SUMBER_LABEL: Record<SumberHarga, string> = {
  tarif: "Tarif galangan", database: "Database harga", manual: "Isi tangan", penawaran: "Penawaran vendor",
};

export type StatusUsulan = "usulan" | "disetujui" | "dicoret" | "tambah";
export const STATUS_USULAN: Record<StatusUsulan, { label: string; kelas: string }> = {
  usulan: { label: "Usulan", kelas: "bg-slate-100 text-slate-600 ring-slate-200" },
  disetujui: { label: "Disetujui", kelas: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
  dicoret: { label: "Dicoret pusat", kelas: "bg-rose-100 text-rose-700 ring-rose-200" },
  tambah: { label: "Pekerjaan tambah", kelas: "bg-amber-100 text-amber-800 ring-amber-200" },
};

/** satu baris Repair List (pekerjaan yang dikerjakan galangan) */
export interface ItemRl {
  id: string;
  jenis: "dok" | "floating";  // RL DOK atau RL Floating Repair
  kode: string;               // Docking Code, mis. "OM - 02"
  sub: string;                // Sub Docking Code, mis. "07"
  bagian: string;             // romawi bagian, mis. "II"
  grup: string;               // sub-judul, mis. "Bawah Garis Air (BGA)"
  uraian: string;
  satuan: string;
  vol: number;
  harga: number;              // harga satuan (pre-PPN)
  sumber?: SumberHarga;
  refHarga?: string;          // kode tarif / kode database yang dipakai
  bandingLo?: number;         // rentang pembanding dari database harga
  bandingHi?: number;
  status?: StatusUsulan;
  nilaiSetuju?: number;       // nilai yang akhirnya disetujui pusat (bila beda)
  ket?: string;
}

/** satu baris RAB penunjang (di luar kontrak galangan) */
export interface ItemPenunjang {
  id: string;
  kelompok: string;           // key KELOMPOK_PENUNJANG
  grup: string;               // sub-judul di dalam kelompok
  uraian: string;
  spek?: string;
  satuan: string;
  vol: number;
  harga: number;
  sumber?: SumberHarga;
  refHarga?: string;
  status?: StatusUsulan;
  nilaiSetuju?: number;
}

export interface UbahJadwal { mulai?: string; lama?: number; buang?: boolean }

export interface RencanaDocking {
  id: string;
  kapal: string;
  tahun: number;
  /** identitas kapal — dipakai memilih tarif bertingkat (GRT) & luas pengecatan */
  grt?: number; loa?: number; lbp?: number; tinggi?: number;
  galangan?: string;
  lokasi?: string;
  naikDok?: string;           // ISO — patokan seluruh jadwal
  lamaDocking?: number;       // hari
  ppn?: number;               // persen, baku 11
  rl: ItemRl[];
  penunjang: ItemPenunjang[];
  /** penyesuaian jadwal per tugas + tanda tugas yang sudah rampung */
  jadwal?: Record<string, UbahJadwal>;
  tugasSelesai?: Record<string, boolean>;
  tugasTambahan?: TugasBaku[];
  /** pagu RKA per kelompok (pembanding usulan) */
  pagu?: Record<string, number>;
  catatan?: string;
  diubahPada?: string;
}

export const rencanaBaru = (kapal: string, tahun: number): RencanaDocking => ({
  id: globalThis.crypto?.randomUUID?.() ?? String(Math.random()),
  kapal, tahun, rl: [], penunjang: [], ppn: PPN_BAKU, lamaDocking: 21,
});

const uid = () => globalThis.crypto?.randomUUID?.() ?? String(Math.random());
export const rlBaru = (p: Partial<ItemRl> = {}): ItemRl => ({
  id: uid(), jenis: "dok", kode: "", sub: "", bagian: "", grup: "", uraian: "",
  satuan: "Ls", vol: 1, harga: 0, status: "usulan", ...p,
});
export const penunjangBaru = (p: Partial<ItemPenunjang> = {}): ItemPenunjang => ({
  id: uid(), kelompok: "roro", grup: "", uraian: "", satuan: "Ls", vol: 1, harga: 0,
  status: "usulan", ...p,
});

// ── hitungan ──────────────────────────────────────────────────────────────────
export const nilaiRl = (i: ItemRl) => (i.vol || 0) * (i.harga || 0);
export const nilaiPenunjang = (i: ItemPenunjang) => (i.vol || 0) * (i.harga || 0);
/** nilai yang dipakai untuk kontrol anggaran: yang disetujui bila ada, else usulan */
export const nilaiBerlaku = (i: { vol: number; harga: number; nilaiSetuju?: number; status?: StatusUsulan }) =>
  i.status === "dicoret" ? 0 : typeof i.nilaiSetuju === "number" ? i.nilaiSetuju : (i.vol || 0) * (i.harga || 0);

export const totalRl = (r: RencanaDocking, jenis?: "dok" | "floating") =>
  (r.rl || []).filter((x) => !jenis || x.jenis === jenis).reduce((s, x) => s + nilaiRl(x), 0);

export const totalPenunjang = (r: RencanaDocking, kelompok?: string) =>
  (r.penunjang || []).filter((x) => !kelompok || x.kelompok === kelompok).reduce((s, x) => s + nilaiPenunjang(x), 0);

export const ppnDari = (n: number, ppn = PPN_BAKU) => Math.round((n * ppn) / 100);

/** rekap per kelompok penunjang + PPN, seperti sub-jumlah di berkas asli */
export function rekapPenunjang(r: RencanaDocking) {
  const ppn = r.ppn ?? PPN_BAKU;
  return KELOMPOK_PENUNJANG.map((k) => {
    const subJumlah = totalPenunjang(r, k.key);
    const pjk = ppnDari(subJumlah, ppn);
    return { ...k, subJumlah, ppn: pjk, jumlah: subJumlah + pjk, pagu: r.pagu?.[k.key] || 0 };
  });
}

/** total keseluruhan rencana: RL galangan + seluruh penunjang, sudah ber-PPN */
export function totalRencana(r: RencanaDocking) {
  const ppn = r.ppn ?? PPN_BAKU;
  const rlDok = totalRl(r, "dok");
  const rlFloat = totalRl(r, "floating");
  const galangan = rlDok + rlFloat;
  const pen = rekapPenunjang(r).reduce((s, k) => s + k.jumlah, 0);
  return {
    rlDok, rlFloat, galangan,
    galanganPpn: galangan + ppnDari(galangan, ppn),
    penunjang: pen,
    total: galangan + ppnDari(galangan, ppn) + pen,
    pagu: KELOMPOK_PENUNJANG.reduce((s, k) => s + (r.pagu?.[k.key] || 0), 0),
  };
}

/**
 * Nilai kewajaran sebuah baris terhadap pembanding database harga.
 * Dipakai memberi tanda sebelum RL dikirim ke pusat — pusat memang memeriksa
 * hal yang sama, jadi lebih baik ketahuan lebih dulu di cabang.
 */
export function periksaHarga(i: { harga: number; bandingLo?: number; bandingHi?: number }) {
  if (!i.harga || !i.bandingHi) return null;
  if (i.harga > i.bandingHi) return { nada: "tinggi" as const, pct: Math.round(((i.harga - i.bandingHi) / i.bandingHi) * 100) };
  if (i.bandingLo && i.harga < i.bandingLo) return { nada: "rendah" as const, pct: Math.round(((i.bandingLo - i.harga) / i.bandingLo) * 100) };
  return { nada: "wajar" as const, pct: 0 };
}
