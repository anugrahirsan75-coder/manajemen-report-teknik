// Satu baris REKAP PJK KAPAL PERBULAN dari sebuah pengadaan. Dipisah dari
// rekapSync.ts yang bertanda "use client" supaya route API bisa memakainya juga.
import { SppbjRequest, SppbjItem, sppbjTotal, hargaSpbjOf, fullNoKontrak } from "./types";
import { tanggalIndo } from "@/lib/format";

export interface RekapRow {
  nomorSppbj: string;   // B (= No PR SAP)
  namaPekerjaan: string;// C
  ket: string;          // E (Kategori Rekap)
  nomorPR: string;      // F (= No PR SAP)
  tanggal: string;      // G "7 Juli 2026"
  nilaiSppbj: number;   // H (estimasi, blm PPN)
  nilaiSpbj: number | null; // I (final SPBJ/PO, blm PPN) — null bila belum ada
  nomorPO: string;      // J
  nomorGR: string;      // K
  month: number;        // 1-12 (utk pilih tab)
  year: number;         // 2026
}

export function buildRekapRow(req: SppbjRequest): RekapRow {
  const items: SppbjItem[] = req.items || [];
  const iso = req.tanggal || "";
  const month = parseInt(iso.slice(5, 7), 10) || 0;
  const year = parseInt(iso.slice(0, 4), 10) || 0;
  const hasFinal = items.some((it) => (it.hargaSpbj || 0) > 0);
  const nilaiSpbj = hasFinal ? items.reduce((s, it) => s + hargaSpbjOf(it) * it.jumlah, 0) : null;
  // No. PR SAP = No. SPPB/J (nilainya sama). Isi noPRSAP hanya bila memang beda.
  // JANGAN pakai noDRP sebagai cadangan — itu deskripsi/nomor DRP, bukan nomor PR.
  const prsap = (req.noPRSAP || req.noSPPBJ || "").trim();
  return {
    nomorSppbj: prsap,
    namaPekerjaan: req.namaPengadaan || "",
    ket: req.kategoriRekap || "",
    nomorPR: prsap,
    tanggal: iso ? tanggalIndo(iso) : "",
    nilaiSppbj: sppbjTotal(items),
    nilaiSpbj,
    nomorPO: fullNoKontrak(req) || (req.noSpbjNum || "").trim(),
    nomorGR: "",
    month, year,
  };
}
