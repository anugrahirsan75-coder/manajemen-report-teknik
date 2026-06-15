import { descByKode, isSukuCadang, meAe } from "./db";

export interface MaterialItem {
  id: string;
  kapal: string; // "SEMUA KAPAL" atau nama kapal
  partNumber: string; // kolom E (file1), opsional
  nama: string; // kolom F (file1) / Uraian (penawaran)
  kode: string; // kolom I (B0xxxx) — dari Reference
  namaMesin?: string; // khusus suku cadang: nama mesin (sub-header + kolom J)
  satuan: string; // PC/Unit/Set/Pcs/Kg...
  qty: number; // untuk penawaran
  harga: number; // kolom AB (file1) / harga satuan (penawaran)
  spesifikasi?: string;
}

export interface MaterialRequest {
  id?: string;
  tanggal: string; // ISO yyyy-mm-dd (tanggal generate dokumen)
  noPenawaran: string; // angka acak, mis. "177"
  deptHead: string;
  stafTeknik: string;
  // narasi (auto pakai bulan-tahun, bisa diubah)
  judulFormulir: string; // file2: "Pengadaan SC dan Perlengkapan Kapal {Bulan Tahun}"
  judulSC: string; // file3: "Pengadaan Suku Cadang Kapal {Bulan Tahun}"
  judulUmum: string; // file4: "Pengadaan Barang Umum Kapal {Bulan Tahun}"
  items: MaterialItem[];
  fotoDokumentasi?: string[]; // foto dokumentasi (URL/base64)
}

export const itemKategori = (it: MaterialItem): "SC" | "UMUM" =>
  it.kode && isSukuCadang(it.kode) ? "SC" : "UMUM";
export const itemDesc = (it: MaterialItem): string => descByKode(it.kode);

// Purchase Order Text (kolom J file1): SC -> "ME/AE : namaMesin", umum -> deskripsi kode
export function itemPOText(it: MaterialItem): string {
  if (itemKategori(it) === "SC" && it.namaMesin) return `${meAe(it.kode)} : ${it.namaMesin}`;
  return descByKode(it.kode);
}

export function emptyItem(kapal = "SEMUA KAPAL"): MaterialItem {
  return { id: (globalThis.crypto?.randomUUID?.() ?? String(Math.random())), kapal, partNumber: "", nama: "", kode: "", namaMesin: "", satuan: "PC", qty: 1, harga: 0 };
}
