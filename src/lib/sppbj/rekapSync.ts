"use client";
// Bangun baris rekap dari SppbjRequest + kirim ke spreadsheet REKAP PJK KAPAL PERBULAN
// (via route -> Apps Script webhook). Baris masuk ke tab bulan sesuai tanggal.
// Bersamaan itu baris ringkas ikut ke spreadsheet REKAP SPPBJ (satu baris per pengadaan).
import type { RekapRow, DaftarRow } from "./rekapBaris";
export { buildRekapRow, buildDaftarRow } from "./rekapBaris";
export type { RekapRow, DaftarRow } from "./rekapBaris";

export class NoRekapConfigError extends Error {}

export interface HasilRekap {
  ok: boolean;
  results?: any[];
  /** hasil per baris REKAP SPPBJ; kosong bila Apps Script belum diperbarui */
  daftar?: any[];
  /** alamat spreadsheet REKAP SPPBJ */
  rekapUrl?: string;
  error?: string;
}

/** Kirim baris ke rekap. Lempar NoRekapConfigError bila webhook belum diset (501). */
export async function sendToRekap(rows: RekapRow[], daftar: DaftarRow[] = []): Promise<HasilRekap> {
  const res = await fetch("/api/sppbj/rekap-sync", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows, daftar }),
  });
  if (res.status === 501) { const e = await res.json().catch(() => ({})); throw new NoRekapConfigError(e.error || "Rekap belum dikonfigurasi"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
  return { ok: true, results: data.results, daftar: data.daftar, rekapUrl: data.rekapUrl };
}
