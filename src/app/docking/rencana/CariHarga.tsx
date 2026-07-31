"use client";
/**
 * Pencari harga acuan — menempel pada DATABASE HARGA RAB (60 ribu item hasil
 * pemindaian berkas pengadaan 2024-2026).
 *
 * Yang ditampilkan bukan cuma satu angka: rentang terendah-tertinggi, median,
 * harga per tahun, dan berapa kali item itu benar-benar pernah diadakan. Dari
 * situ pengusul bisa memilih angka yang bisa dipertanggungjawabkan, bukan
 * menebak — dan rentangnya ikut disimpan sebagai pembanding di baris RL.
 */
import { useEffect, useRef, useState } from "react";
import { rupiah } from "@/lib/format";

export interface HasilHarga {
  kode: string; jenis: string; kategori: string; uraian: string; spek: string;
  satuan: string; n: number; lo: number; hi: number; median: number;
  h2024: number; h2025: number; h2026: number; tren: string; kapal: string;
}

export interface PilihanHarga {
  harga: number; satuan: string; uraian: string; spek: string;
  kode: string; lo: number; hi: number;
}

export default function CariHarga({ awal, onPilih, onTutup }: {
  awal?: string;
  onPilih: (p: PilihanHarga) => void;
  onTutup: () => void;
}) {
  const [q, setQ] = useState(awal || "");
  const [jenis, setJenis] = useState("");
  const [hasil, setHasil] = useState<HasilHarga[]>([]);
  const [sibuk, setSibuk] = useState(false);
  const [info, setInfo] = useState("");
  const [galat, setGalat] = useState("");
  const timer = useRef<any>(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setHasil([]); setInfo(""); return; }
    timer.current = setTimeout(async () => {
      setSibuk(true); setGalat("");
      try {
        const r = await fetch(`/api/harga/cari?q=${encodeURIComponent(q)}&jenis=${jenis}&batas=30`);
        const j = await r.json();
        if (!j.ok) { setGalat(j.error || "Gagal mencari"); setHasil([]); }
        else { setHasil(j.hasil); setInfo(`${j.cocok} cocok dari ${j.total.toLocaleString("id-ID")} item`); }
      } catch (e: any) { setGalat(e?.message || String(e)); }
      finally { setSibuk(false); }
    }, 320);
    return () => clearTimeout(timer.current);
  }, [q, jenis]);

  // angka yang paling layak dipakai: harga tahun terbaru, kalau tak ada pakai median
  const usul = (h: HasilHarga) => h.h2026 || h.h2025 || h.median || h.h2024 || h.lo;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-[2px] p-4 overflow-y-auto" onClick={onTutup}>
      <div className="max-w-4xl mx-auto my-6 bg-white rounded-2xl elev-lg ring-line overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <span className="h-9 w-9 rounded-xl asdp-gradient text-white grid place-items-center text-sm shrink-0">💰</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 leading-tight">Cari harga acuan</h3>
            <p className="text-xs text-slate-500">dari realisasi pengadaan 2024-2026 · {info || "ketik nama barang/jasa"}</p>
          </div>
          <button onClick={onTutup} className="text-slate-400 hover:text-slate-700 text-lg px-1">✕</button>
        </div>

        <div className="p-5 pb-3 flex flex-wrap gap-2 items-center">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="mis. zinc anode, pipa galvanis 2 inch, sand blasting"
            className="flex-1 min-w-[16rem] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/20 outline-none" />
          <div className="flex rounded-lg overflow-hidden ring-1 ring-slate-200">
            {([["", "Semua"], ["B", "Barang"], ["J", "Jasa"], ["S", "Suku cadang"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setJenis(v)}
                className={`text-[11px] font-bold px-2.5 py-2 ${jenis === v ? "bg-slate-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{l}</button>
            ))}
          </div>
        </div>

        {galat && <p className="mx-5 mb-3 text-xs text-rose-800 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">{galat}</p>}

        <div className="px-5 pb-5 max-h-[60vh] overflow-y-auto">
          {sibuk && <p className="text-xs text-slate-400 py-3">Mencari…</p>}
          {!sibuk && q.trim().length >= 2 && !hasil.length && !galat && (
            <p className="text-xs text-slate-400 py-3">Tak ada yang cocok. Coba kata yang lebih umum — pencarian menuntut semua kata ada.</p>
          )}
          <div className="space-y-2">
            {hasil.map((h) => {
              const nilai = usul(h);
              const rentang = h.hi > h.lo;
              return (
                <button key={h.kode} onClick={() => onPilih({
                  harga: nilai, satuan: h.satuan, uraian: h.uraian, spek: h.spek,
                  kode: h.kode, lo: h.lo, hi: h.hi,
                })}
                  className="w-full text-left rounded-xl ring-1 ring-slate-200 hover:ring-[#1ca3dd] hover:bg-sky-50/40 p-3 transition">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-snug">{h.uraian}</p>
                      {h.spek && <p className="text-[11px] text-slate-500 leading-snug">{h.spek}</p>}
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {h.kategori} · {h.satuan || "—"} · {h.n}× data
                        {h.kapal ? ` · ${h.kapal}` : ""}
                        {h.tren && h.tren !== "-" ? ` · tren ${h.tren}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-800 tabular-nums">{rupiah(nilai)}</p>
                      <p className="text-[10px] text-slate-500 tabular-nums">
                        {h.h2026 ? "harga 2026" : h.h2025 ? "harga 2025" : "median"}
                      </p>
                      {rentang && (
                        <p className="text-[10px] text-slate-400 tabular-nums">{rupiah(h.lo)} – {rupiah(h.hi)}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
