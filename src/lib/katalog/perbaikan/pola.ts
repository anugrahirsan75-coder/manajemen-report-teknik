/**
 * Mesin pola katalog perbaikan.
 *
 * Katalog pekerjaan kapal tidak berbentuk daftar, melainkan matriks: satu
 * pekerjaan ("ganti jalur pipa") berlaku untuk tiap bahan dan tiap diameter,
 * dan harga maupun bahannya ikut berubah. Menuliskan tiap perpaduan satu per
 * satu berarti ribuan baris yang saling menyalin — dan begitu satu harga
 * berubah, yang lain tertinggal.
 *
 * Jadi yang ditulis adalah polanya: dimensi nyata (bahan, ukuran, jenis
 * pekerjaan, lokasi) beserta angka bahannya, lalu perpaduannya dikembangkan.
 * Perpaduan yang tidak ada di lapangan disaring lewat `sah`, supaya katalognya
 * besar karena memang banyak pekerjaannya, bukan karena dikarang.
 */
import type { KatalogItem } from "../source";

export interface Nilai { id: string; [k: string]: any }

export interface Pola {
  /** awalan kode keluarga, mis. "PIP" -> PBK-PIP-GIP-2-GANTI */
  kode: string;
  kategori: string;
  jenis?: "JASA" | "BARANG";
  sumber?: "Riil" | "Pasar";
  dimensi: Record<string, Nilai[]>;
  /** buang perpaduan yang tak ada di lapangan (mis. pipa tembaga 8 inci) */
  sah?: (v: any) => boolean;
  nama: (v: any) => string;
  /** mutu hasil yang mengikat penyedia, bukan uraian ulang pekerjaannya */
  spek: (v: any) => string;
  satuan: (v: any) => string;
  harga: (v: any) => number;
  bahan: (v: any) => (string | false | undefined)[];
}

/**
 * Pembulatan harga penawaran.
 *
 * Harga hasil hitungan bahan + upah keluar sampai rupiah terakhir
 * (Rp 1.247.318). Angka begitu terbaca sebagai hasil kalkulasi yang presisi,
 * padahal ini taksiran — dibulatkan supaya jujur tampil sebagai taksiran.
 */
export function bulat(n: number): number {
  const a = Math.abs(n);
  const kelipatan = a < 100_000 ? 5_000 : a < 1_000_000 ? 10_000 : a < 10_000_000 ? 50_000 : 100_000;
  return Math.max(kelipatan, Math.round(n / kelipatan) * kelipatan);
}

function silang(dim: Record<string, Nilai[]>): any[] {
  let hasil: any[] = [{}];
  for (const k of Object.keys(dim)) {
    const next: any[] = [];
    for (const dasar of hasil) for (const nilai of dim[k]) next.push({ ...dasar, [k]: nilai });
    hasil = next;
  }
  return hasil;
}

export function kembangkan(pola: Pola[]): KatalogItem[] {
  const out: KatalogItem[] = [];
  for (const p of pola) {
    const keys = Object.keys(p.dimensi);
    for (const v of silang(p.dimensi)) {
      if (p.sah && !p.sah(v)) continue;
      out.push({
        kode: `PBK-${p.kode}-${keys.map((k) => v[k].id).join("-")}`.toUpperCase(),
        jenis: p.jenis || "JASA",
        kategori: p.kategori,
        nama: p.nama(v),
        spesifikasi: p.spek(v),
        satuan: p.satuan(v),
        harga: bulat(p.harga(v)),
        sumber: p.sumber || "Pasar",
        breakdown: p.bahan(v).filter(Boolean) as string[],
      });
    }
  }
  return out;
}

/* ── bahan yang berulang di banyak keluarga ───────────────────────────── */

export const KAWAT_LAS = "Kawat las RB 2.5 mm — AWS E6013, kemasan 5 kg";
export const KAWAT_LAS_SS = "Kawat las stainless — AWS E308L-16, 2.6 mm, kemasan 2 kg";
export const OKSIGEN = "Tabung oksigen — isi ulang tabung 6 m3";
export const ASETILEN = "Tabung asetilen — isi ulang tabung 6 kg";
export const GERINDA = "Mata gerinda potong — 4 inci x 1.2 mm, 1 box isi 50 lembar";
export const GERINDA_ASAH = "Mata gerinda asah — 4 inci x 6 mm, 1 box isi 25 lembar";
export const SEAL_TAPE = "Seal tape — 12 mm x 10 m";
export const SEALANT = "Sealant — silikon netral marine, 300 ml";
export const AMPLAS = "Amplas dan sikat kawat — amplas no. 80 dan 120";
export const THINNER = "Thinner — thinner A, 4 liter";
export const MAJUN = "Majun dan bahan pembersih — majun katun 5 kg, solvent 1 liter";
export const ISOLASI = "Isolasi kabel — PVC 3M, 19 mm x 20 m";

export const LAS_SET = [KAWAT_LAS, OKSIGEN, GERINDA];
export const CAT_BESI = "Cat besi — cat dasar zinc chromate dan cat akhir, 1 kg";

/** upah harian tukang/teknisi yang dipakai menyusun harga pekerjaan */
export const UPAH = { tukang: 185_000, teknisi: 275_000, ahli: 425_000 };
