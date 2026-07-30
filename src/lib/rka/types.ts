/**
 * Rencana RKA (usulan RKA tahun berikutnya, mis. 2027).
 *
 * Mengikuti struktur berkas Penyusunan RKA 2026 (lihat docs/PENYUSUNAN_RKA.md):
 * satu usulan per KAPAL, dipecah per KELOMPOK BIAYA. Tiap kelompok dipetakan ke
 * kode M.A. akuntansi lama (format laporan pusat) DAN kode SAP aplikasi —
 * sehingga usulan bisa diisi otomatis dari data 2026 yang sudah ada di aplikasi
 * (realisasi SPPBJ/Non PR PO, pagu docking, dst.) lalu diekspor dengan format
 * yang diterima pusat.
 */

export interface KelompokRka {
  key: string;
  label: string;
  maLama: string;      // kode M.A. akuntansi di berkas RKA pusat
  /** awalan kode SAP yang dipakai aplikasi — sumber pengisian otomatis */
  kodeSap: string[];
  /** biaya jatuh di bulan docking (bukan disebar 12 bulan) */
  ikutDocking?: boolean;
  keterangan?: string;
}

export const KELOMPOK_RKA: KelompokRka[] = [
  { key: "pelumas", label: "Pelumas dan Gemuk", maLama: "5.1.02.02.00.00", kodeSap: ["5010303001", "5010303002"] },
  { key: "docking_induk", label: "Docking Induk (Repair List)", maLama: "5.1.03.01.00.00", kodeSap: ["5010403003"], ikutDocking: true },
  { key: "owner_supply", label: "Material Owner Supply (Cat & Anode)", maLama: "5.1.03.01.00.00", kodeSap: [], ikutDocking: true },
  { key: "surat_kapal", label: "Surat-Surat Kapal (Sertifikasi)", maLama: "5.1.03.01.00.00", kodeSap: ["5010318000", "5010317000"], ikutDocking: true },
  { key: "swakelola", label: "Swakelola Docking", maLama: "5.1.03.01.00.00", kodeSap: [], ikutDocking: true },
  { key: "akomodasi", label: "Pemeliharaan Deck / Akomodasi & Perlengkapan", maLama: "5.1.03.04.00.00", kodeSap: ["5010403009", "5010403014"] },
  { key: "permesinan", label: "Pemeliharaan Mesin & Kelistrikan", maLama: "5.1.03.05.00.00", kodeSap: ["5010403100"] },
  { key: "fumigasi", label: "Fumigasi", maLama: "5.0.10.51.20.03", kodeSap: ["5011099006"], ikutDocking: true },
  { key: "mobilisasi", label: "Mobilisasi Dalam Rangka Docking", maLama: "5.1.03.08.00.00", kodeSap: ["5010302004"], ikutDocking: true },
  { key: "investasi", label: "Investasi (SC ME/AE, Kelistrikan, dll.)", maLama: "1.02.06.04", kodeSap: ["1020604"], ikutDocking: true },
];
export const labelKelompok = (key: string) => KELOMPOK_RKA.find((k) => k.key === key)?.label || key;

export interface RkaKapal {
  id: string;
  tahun: number;              // tahun RKA yang diusulkan (mis. 2027)
  kapal: string;
  /** bulan rencana docking pada tahun RKA, 1-12 (utk sebaran ekspor & jadwal) */
  bulanDocking?: number;
  /** nilai usulan per kelompok (key -> rupiah setahun) */
  nilai: Record<string, number>;
  /** pembanding yang terekam saat pengisian otomatis (audit jejak) */
  dasar?: Record<string, number>;
  catatan?: string;
  diubahPada?: string;
}

export const rkaBaru = (kapal: string, tahun: number): RkaKapal => ({
  id: globalThis.crypto?.randomUUID?.() ?? String(Math.random()),
  tahun, kapal, nilai: {},
});

export const totalRka = (d: RkaKapal) =>
  KELOMPOK_RKA.reduce((s, k) => s + (d.nilai?.[k.key] || 0), 0);

/** kelompok mana yang menampung sebuah kode MA SAP (utk pengisian otomatis) */
export function kelompokDariSap(kode: string): KelompokRka | undefined {
  return KELOMPOK_RKA.find((k) => k.kodeSap.some((p) => kode.startsWith(p)));
}
