"use client";

import { useEffect, useRef, useState } from "react";
import { getKatalog, searchKatalog, katalogSeed, KatalogItem } from "@/lib/katalog/source";
import { rupiah } from "@/lib/format";

/** Tombol kecil "📚" → popover cari Katalog HSPK. onPick mengisi item. */
export default function KatalogPicker({ initialQuery, onPick }: { initialQuery?: string; onPick: (it: KatalogItem) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [all, setAll] = useState<KatalogItem[]>(katalogSeed());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) getKatalog().then(setAll).catch(() => {}); }, [open]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const results = open ? searchKatalog(all, q, 40) : [];

  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" title="Cari dari Katalog HSPK"
        onClick={() => { setQ(initialQuery || ""); setOpen((o) => !o); }}
        className="text-xs px-1.5 py-0.5 rounded border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100">📚</button>
      {open && (
        <div className="absolute z-50 mt-1 right-0 w-[440px] max-w-[88vw] bg-white border border-slate-200 rounded-xl shadow-2xl p-2">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="cari nama / kode / kategori… (mis. sandblasting, zinc anode, JS2-HL)"
            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs mb-2 focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/20 outline-none" />
          <div className="max-h-80 overflow-auto divide-y divide-slate-100">
            {results.length === 0 && <p className="text-xs text-slate-400 p-3 text-center">Tak ada hasil. Coba kata kunci lain.</p>}
            {results.map((it) => (
              <button type="button" key={it.kode} onClick={() => { onPick(it); setOpen(false); }}
                className="block w-full text-left px-2 py-1.5 hover:bg-sky-50 rounded">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-mono text-[10px] text-slate-400">{it.kode}</span>
                  <span className={`text-[9px] font-semibold px-1 rounded ${it.sumber === "Riil" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{it.sumber === "Riil" ? "Riil ✓" : "Pasar ⚠"}</span>
                  {it.breakdown?.length ? <span className="text-[9px] text-sky-600">● {it.breakdown.length} rincian</span> : null}
                  <span className="text-[9px] text-slate-400 ml-auto">{it.kategori}</span>
                </div>
                <div className="text-xs font-medium text-slate-800 leading-tight">{it.nama}</div>
                <div className="text-[10px] text-slate-500 flex justify-between gap-2">
                  <span className="truncate">{it.spesifikasi}</span>
                  <span className="font-semibold whitespace-nowrap text-slate-700">{rupiah(it.harga)}/{it.satuan}</span>
                </div>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 px-1">Pilih → isi nama, spesifikasi, satuan, harga & rincian otomatis. Harga <b className="text-amber-600">Pasar</b> = estimasi, verifikasi ke supplier.</p>
        </div>
      )}
    </div>
  );
}
