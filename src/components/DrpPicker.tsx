"use client";

import { useState, useRef, useEffect } from "react";
import { cariDrp, DRP_DB } from "@/lib/sppbj/drp";

export default function DrpPicker({ value, onChange }: { value: string; onChange: (nomor: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const hasil = cariDrp(q, 12);
  const namaTerpilih = DRP_DB.find((d) => d.nomor === value)?.nama;

  return (
    <div className="relative" ref={ref}>
      <input
        value={open ? q : value}
        onFocus={() => { setQ(""); setOpen(true); }}
        onChange={(e) => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
        placeholder="ketik deskripsi / nomor DRP…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/30 outline-none"
      />
      {!open && namaTerpilih && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{namaTerpilih}</p>}
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {hasil.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Tidak ada cocok. (Isi manual juga boleh.)</p>}
          {hasil.map((d) => (
            <button key={d.nomor} type="button"
              onClick={() => { onChange(d.nomor); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-sky-50 border-b last:border-0">
              <span className="text-xs font-mono text-[#16357f]">{d.nomor}</span>
              <span className="block text-[11px] text-slate-600 truncate">{d.nama}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
