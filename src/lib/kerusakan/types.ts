/**
 * Rekap Kerusakan Kapal (Report Accident).
 * Mengikuti kolom laporan yang dipakai cabang:
 *   No · Ship · Date · Events/Genesis · Effect/Resulting · Lost Opportunity · Evidence · Follow up
 */

export type StatusKerusakan = "terbuka" | "proses" | "selesai";

export const STATUS_LABEL: Record<StatusKerusakan, string> = {
  terbuka: "Belum ditangani",
  proses: "Sedang ditangani",
  selesai: "Selesai",
};
export const STATUS_WARNA: Record<StatusKerusakan, string> = {
  terbuka: "bg-rose-100 text-rose-800 ring-rose-300",
  proses: "bg-amber-100 text-amber-800 ring-amber-300",
  selesai: "bg-emerald-100 text-emerald-800 ring-emerald-300",
};

/** bagian kapal yang rusak — untuk melihat pola kerusakan berulang */
export const BAGIAN = [
  "Mesin Induk", "Mesin Bantu", "Kelistrikan", "Permesinan Geladak",
  "Jangkar & Rantai", "Rampdoor", "Kemudi & Propulsi", "Lambung & Konstruksi",
  "Akomodasi", "Alat Keselamatan", "Navigasi & Komunikasi", "Lainnya",
] as const;

export interface Kerusakan {
  id: string;
  kapal: string;
  tanggal: string;          // ISO yyyy-mm-dd — tanggal kejadian
  bagian: string;           // bagian kapal (dari BAGIAN, boleh diisi bebas)
  kejadian: string;         // Events / Genesis — apa yang terjadi
  akibat: string;           // Effect / Resulting — dampak & tindakan yang dilakukan
  lostOpportunity: number;  // jumlah trip yang hilang
  evidence: string;         // tautan bukti (Google Drive dsb)
  foto?: string[];          // foto bukti yang diunggah langsung (URL di Storage)
  tindakLanjut: string;     // Follow up
  status: StatusKerusakan;
  biaya?: number;           // perkiraan biaya perbaikan (opsional)
  pengadaanId?: string;     // tautan ke SPPBJ / Non PR PO yang menangani
  catatan?: string;
  dibuatPada?: string;
  diubahPada?: string;
}

export const kerusakanBaru = (kapal = ""): Kerusakan => ({
  id: globalThis.crypto?.randomUUID?.() ?? String(Math.random()),
  kapal, tanggal: new Date().toISOString().slice(0, 10), bagian: "",
  kejadian: "", akibat: "", lostOpportunity: 0, evidence: "", tindakLanjut: "",
  status: "terbuka", dibuatPada: new Date().toISOString(),
});

/** ringkasan untuk kartu di atas tabel */
export function ringkas(list: Kerusakan[]) {
  const per: Record<string, number> = {};
  let trip = 0, biaya = 0;
  for (const k of list) {
    per[k.status] = (per[k.status] || 0) + 1;
    trip += k.lostOpportunity || 0;
    biaya += k.biaya || 0;
  }
  return {
    total: list.length,
    terbuka: per.terbuka || 0,
    proses: per.proses || 0,
    selesai: per.selesai || 0,
    trip, biaya,
  };
}
