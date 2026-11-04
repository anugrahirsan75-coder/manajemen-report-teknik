"use client";
// Bangun baris rekap dari SppbjRequest + kirim ke spreadsheet REKAP PJK KAPAL PERBULAN
// (via route -> Apps Script webhook). Baris masuk ke tab bulan sesuai tanggal.
import type { RekapRow } from "./rekapBaris";
export { buildRekapRow } from "./rekapBaris";
export type { RekapRow } from "./rekapBaris";

export class NoRekapConfigError extends Error {}

/** Kirim baris ke rekap. Lempar NoRekapConfigError bila webhook belum diset (501). */
export async function sendToRekap(rows: RekapRow[]): Promise<{ ok: boolean; results?: any[]; error?: string }> {
  const res = await fetch("/api/sppbj/rekap-sync", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  if (res.status === 501) { const e = await res.json().catch(() => ({})); throw new NoRekapConfigError(e.error || "Rekap belum dikonfigurasi"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
  return { ok: true, results: data.results };
}
