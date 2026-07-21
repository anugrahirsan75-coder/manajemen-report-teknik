import { Jabatan } from "./db";

export interface NonprItem {
  id: string;
  kapal: string;
  jumlah: number;
  satuan: string;
  nama: string;
  spesifikasi: string;
  harga: number; // harga satuan
  breakdown?: string[]; // rincian di bawah item (baris "-"), tanpa harga
  keterangan?: string;  // header/kategori di ATAS item (multi-baris), grup >1 item
}

// baris header keterangan (1 baris per poin), muncul di atas item saat keterangan berganti
export const ketLines = (it: NonprItem): string[] =>
  (it.keterangan || "").split("\n").map((s) => s.trim()).filter(Boolean);

// baris-baris rincian breakdown (tiap poin -> "- xxx"), untuk baris terpisah di dokumen
export const bdLines = (it: NonprItem): string[] =>
  (it.breakdown || []).filter((b) => b.trim()).map((b) => `- ${b.trim().replace(/^[-•*]\s*/, "")}`);

export interface NonprRequest {
  id?: string;
  tanggal: string;        // ISO yyyy-mm-dd (T7 SPPB + romawi nomor)
  noSPPB: string;         // nomor awal saja, mis "051" (format final {nnn}/SPPB/TTE/{romawi}/ASDP-{thn})
  namaPengadaan: string;
  dasarPelimpahan: string;
  mataAnggaran: string;   // label dari MATA_ANGGARAN_NONPR (atau manual)
  jenisAnggaran?: "Rutin" | "Docking"; // klasifikasi Dashboard Anggaran (anti-overlap)
  vendor: string;         // nama vendor (Database) -> narasi spkh
  stafTeknik: string;     // R31 (default IRSAN ANUGRAH)
  jabatanByKapal: Record<string, Jabatan>; // kapal -> KKM|Nakhoda (penerima BSTB)
  items: NonprItem[];
  fotoDokumentasi?: string[]; // data URL (base64) 1-2 foto, sheet Foto
}

export const emptyNonprItem = (kapal = ""): NonprItem => ({
  id: globalThis.crypto?.randomUUID?.() ?? String(Math.random()),
  kapal, jumlah: 1, satuan: "Unit", nama: "", spesifikasi: "", harga: 0,
});

// daftar kapal unik (urutan kemunculan)
export function kapalUnikNonpr(items: NonprItem[] = []): string[] {
  const seen: string[] = [];
  for (const it of items) { const k = (it.kapal || "").trim(); if (k && !seen.includes(k)) seen.push(k); }
  return seen;
}

export const nonprTotal = (items: NonprItem[] = []) => items.reduce((s, i) => s + i.harga * i.jumlah, 0);
export const tahunNonpr = (iso: string) => (iso || "").slice(0, 4);

export function newNonprDraft(): NonprRequest {
  return {
    tanggal: new Date().toISOString().slice(0, 10),
    noSPPB: "", namaPengadaan: "", dasarPelimpahan: "", mataAnggaran: "",
    vendor: "", stafTeknik: "IRSAN ANUGRAH", jabatanByKapal: {}, items: [],
  };
}
