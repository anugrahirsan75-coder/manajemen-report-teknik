"use client";
/**
 * Pengisian otomatis usulan RKA dari data tahun dasar (mis. 2026) yang sudah
 * ada di aplikasi: SELURUH pengadaan (SPPBJ + Non PR PO, semua jenis anggaran)
 * dipecah per kapal per kelompok RKA lewat kode MA tiap item — memakai helper
 * yang sama dengan Dashboard (nilai per kapal dibagi rata utk item multi-kapal,
 * harga SPBJ final menang atas estimasi), jadi angka dasarnya konsisten.
 */
import { PengadaanRow } from "@/lib/anggaran/store";
import { maKey, namaKapalPenuh } from "@/lib/anggaran/types";
import { pecahKapal } from "@/lib/kapal/nama";
import { kelompokDariSap } from "./types";

/** total per kelompok RKA utk SATU kapal pada tahun dasar */
export function dasarDariTahun(pengadaan: PengadaanRow[], kapal: string, tahunDasar: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of pengadaan) {
    if (parseInt((p.tanggal || "").slice(0, 4), 10) !== tahunDasar) continue;
    const arr: any[] = p.items || [];
    const adaFinal = arr.some((it) => (it.hargaSpbj || 0) > 0);
    const maDefault = (p.mataAnggaran || [])[0] || "";
    for (const it of arr) {
      const nilai = (adaFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0)) * (it.jumlah || 0);
      if (!nilai) continue;
      const kel = kelompokDariSap(maKey((it.mataAnggaran || "").trim() || maDefault));
      if (!kel) continue;
      const semua = pecahKapal(it.kapal || "").map(namaKapalPenuh);
      if (!semua.includes(kapal)) continue;
      out[kel.key] = (out[kel.key] || 0) + Math.round(nilai / (semua.length || 1));
    }
  }
  return out;
}
