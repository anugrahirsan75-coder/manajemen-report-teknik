"use client";
// Sel "Kapal" utk tabel riwayat pengadaan (SPPBJ & Non PR PO).
// Kapal diambil dari item2 pengadaan (1 pengadaan bisa banyak kapal) -> chip unik.
import { namaKapalPenuh } from "@/lib/anggaran/types";

/** Daftar kapal unik pada 1 pengadaan (nama penuh, urut kemunculan di tabel item). */
export function kapalDariItems(items: any[] = []): string[] {
  const seen: string[] = [];
  for (const it of items || []) {
    const k = namaKapalPenuh((it?.kapal || "").trim());
    if (k && !seen.includes(k)) seen.push(k);
  }
  return seen;
}

// "KMP. ARIWANGAN" -> "ARIWANGAN" (hemat lebar kolom; prefix KMP. sama utk semua)
const ringkas = (k: string) => k.replace(/^KMP\.?\s*/i, "");

export default function KapalCell({ items, max = 2 }: { items: any[]; max?: number }) {
  const list = kapalDariItems(items);
  if (!list.length) return <span className="text-slate-400">—</span>;
  const show = list.slice(0, max);
  const sisa = list.length - show.length;
  return (
    <div className="flex flex-wrap items-center gap-1" title={list.join(", ")}>
      {show.map((k) => (
        <span key={k} className="text-[10px] font-bold text-sky-900 bg-sky-50 ring-1 ring-sky-200 rounded px-1.5 py-0.5 whitespace-nowrap">{ringkas(k)}</span>
      ))}
      {sisa > 0 && (
        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 ring-1 ring-slate-300 rounded px-1.5 py-0.5" title={list.join(", ")}>+{sisa}</span>
      )}
    </div>
  );
}
