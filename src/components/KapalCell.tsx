"use client";
// Sel "Kapal" utk tabel riwayat pengadaan (SPPBJ & Non PR PO).
// Kapal diambil dari item2 pengadaan (1 pengadaan bisa banyak kapal) -> chip unik + dropdown lihat semua.
import { useEffect, useRef, useState } from "react";
import { namaKapalPenuh } from "@/lib/anggaran/types";


/**
 * Pecah 1 sel kapal jadi beberapa nama.
 * Menangani: newline / koma / titik-koma / garis miring, DAN kasus nama nempel
 * hasil salin-tempel spt "KMP. TUNAKMP. ARIWANGAN" -> ["KMP. TUNA", "KMP. ARIWANGAN"].
 */
export function pecahKapal(raw: string): string[] {
  const t = (raw || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  return t
    .split(/\s*[\n,;/|]+\s*/)
    // potong tepat sebelum tiap "KMP" (nama yg nempel jadi terpisah lagi)
    .flatMap((s) => s.split(/(?=KMP)/i))
    .map((s) => {
      let v = s.replace(/^[.\s]+|[.,;\s]+$/g, "").trim();
      if (/^KMP/i.test(v)) v = v.replace(/^KMP\.?\s*/i, "KMP. ").trim(); // "KMP.TUNA" -> "KMP. TUNA"
      return namaKapalPenuh(v);
    })
    .filter((s) => s && s.toUpperCase() !== "KMP" && s.toUpperCase() !== "KMP.");
}

/** Kapal unik + jumlah item per kapal (urut kemunculan di tabel item). */
export function kapalHitung(items: any[] = []): { kapal: string; n: number }[] {
  const urut: string[] = [];
  const n: Record<string, number> = {};
  for (const it of items || []) {
    for (const k of pecahKapal(it?.kapal || "")) {
      if (!n[k]) { n[k] = 0; urut.push(k); }
      n[k] += 1;
    }
  }
  return urut.map((k) => ({ kapal: k, n: n[k] }));
}

/** Daftar kapal unik pada 1 pengadaan (nama penuh). */
export function kapalDariItems(items: any[] = []): string[] {
  return kapalHitung(items).map((x) => x.kapal);
}

// "KMP. ARIWANGAN" -> "ARIWANGAN" (hemat lebar kolom; prefix KMP. sama utk semua)
const ringkas = (k: string) => k.replace(/^KMP\.?\s*/i, "");

export default function KapalCell({ items, max = 2 }: { items: any[]; max?: number }) {
  const list = kapalHitung(items);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // tutup saat klik di luar / Esc / halaman digulir
  useEffect(() => {
    if (!open) return;
    const luar = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const tutup = () => setOpen(false);
    document.addEventListener("mousedown", luar);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", tutup, true);
    window.addEventListener("resize", tutup);
    return () => {
      document.removeEventListener("mousedown", luar);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", tutup, true);
      window.removeEventListener("resize", tutup);
    };
  }, [open]);

  if (!list.length) return <span className="text-slate-400">—</span>;

  const banyak = list.length > max;
  const show = banyak ? list.slice(0, max) : list;
  const sisa = list.length - show.length;

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // jangan ikut membuka detail pengadaan
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 272)) });
    setOpen((o) => !o);
  };

  const chips = (
    <>
      {show.map((x) => (
        <span key={x.kapal} className="text-[10px] font-bold text-sky-900 bg-sky-50 ring-1 ring-sky-200 rounded px-1.5 py-0.5 whitespace-nowrap">{ringkas(x.kapal)}</span>
      ))}
      {sisa > 0 && (
        <span className="text-[10px] font-bold text-slate-700 bg-slate-200 ring-1 ring-slate-300 rounded px-1.5 py-0.5 whitespace-nowrap">
          +{sisa} <span className={`inline-block text-[8px] transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
        </span>
      )}
    </>
  );

  // 1-2 kapal: chip biasa (tak perlu dropdown)
  if (!banyak) return <div className="flex flex-wrap items-center gap-1">{chips}</div>;

  return (
    <>
      <button ref={btnRef} onClick={toggle} title={`Lihat ${list.length} kapal`}
        className={`flex flex-wrap items-center gap-1 text-left rounded-lg px-1 -mx-1 py-0.5 transition hover:bg-sky-50 ${open ? "bg-sky-50 ring-1 ring-sky-300" : ""}`}>
        {chips}
      </button>

      {open && (
        <div ref={panelRef} onClick={(e) => e.stopPropagation()} style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-64 bg-white rounded-xl ring-1 ring-slate-300 shadow-2xl overflow-hidden anim-in">
          <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">{list.length} kapal di pengadaan ini</span>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-800 text-xs leading-none">✕</button>
          </div>
          <ul className="max-h-64 overflow-auto py-1">
            {list.map((x) => (
              <li key={x.kapal} className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-sky-50">
                <span className="text-xs font-semibold text-slate-800">{x.kapal}</span>
                <span className="text-[10px] font-bold text-sky-800 bg-sky-100 rounded-full px-1.5 py-px whitespace-nowrap">{x.n} item</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
