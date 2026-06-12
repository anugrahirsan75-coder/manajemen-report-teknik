// Monitoring barang kapal yang sedang diservis di bengkel.

export type ServisStatus = "di_bengkel" | "selesai" | "kembali" | "tidak_layak";

export const SERVIS_STATUS_LABEL: Record<ServisStatus, string> = {
  di_bengkel: "Di Bengkel",
  selesai: "Selesai (Siap Diambil)",
  kembali: "Sudah Kembali",
  tidak_layak: "Tak Bisa Diperbaiki",
};
export const SERVIS_STATUS_COLOR: Record<ServisStatus, string> = {
  di_bengkel: "bg-amber-100 text-amber-700",
  selesai: "bg-blue-100 text-blue-700",
  kembali: "bg-green-100 text-green-700",
  tidak_layak: "bg-red-100 text-red-700",
};

export const JENIS_BARANG = [
  "Alternator", "Pompa", "Dinamo Starter", "Motor Listrik", "Turbocharger",
  "Injector", "Radiator/Cooler", "Gearbox", "Kompresor", "Hydraulic", "Elektronik/Panel",
];

export interface ServisItem {
  id: string;
  namaBarang: string;       // mis. "Alternator AE Kanan"
  jenis: string;            // kategori (datalist JENIS_BARANG)
  kapal: string;
  bengkel: string;          // nama bengkel/vendor
  kerusakan: string;        // deskripsi kerusakan/keluhan
  tanggalKirim: string;     // ISO
  tanggalEstimasi?: string; // ISO, estimasi selesai
  tanggalKembali?: string;  // ISO, saat sudah kembali
  biaya?: number;           // biaya perbaikan (boleh kosong)
  status: ServisStatus;
  catatan?: string;
  foto?: string[];          // data URL terkompres, maks 3
  createdAt?: string;
  updatedAt?: string;
}

export function newServisItem(): ServisItem {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? String(Math.random()),
    namaBarang: "", jenis: "", kapal: "", bengkel: "", kerusakan: "",
    tanggalKirim: new Date().toISOString().slice(0, 10),
    status: "di_bengkel",
  };
}

// lama hari di bengkel: kirim -> kembali (atau hari ini bila belum kembali)
export function lamaHari(it: ServisItem): number {
  if (!it.tanggalKirim) return 0;
  const a = new Date(it.tanggalKirim).getTime();
  const b = it.tanggalKembali ? new Date(it.tanggalKembali).getTime() : Date.now();
  return Math.max(0, Math.round((b - a) / 86400000));
}

// telat: lewat estimasi & masih di bengkel
export function telatHari(it: ServisItem): number {
  if (!it.tanggalEstimasi || it.status === "kembali" || it.status === "tidak_layak") return 0;
  const d = Math.round((Date.now() - new Date(it.tanggalEstimasi).getTime()) / 86400000);
  return Math.max(0, d);
}
