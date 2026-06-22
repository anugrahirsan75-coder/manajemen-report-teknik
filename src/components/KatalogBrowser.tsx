"use client";

import { useEffect, useMemo, useState } from "react";
import { getKatalog, searchKatalog, katalogSeed, KatalogItem } from "@/lib/katalog/source";
import { KAPAL_LIST } from "@/lib/sppbj/db";
import { rupiah } from "@/lib/format";

/** Modal telusur SELURUH katalog HSPK → centang banyak → tambah ke tabel SPPBJ. */
export default function KatalogBrowser({ open, onClose, onAdd, defaultKapal = "" }: {
  open: boolean;
  onClose: () => void;
  onAdd: (items: KatalogItem[], kapal: string) => void;
  defaultKapal?: string;
}) {
  const [all, setAll] = useState<KatalogItem[]>(katalogSeed());
  const [q, setQ] = useState("");
  const [jenis, setJenis] = useState("");
  const [sumber, setSumber] = useState("");
  const [kategori, setKategori] = useState("");
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [kapal, setKapal] = useState(defaultKapal);

  useEffect(() => { if (open) getKatalog().then(setAll).catch(() => {}); }, [open]);
  useEffect(() => { if (open) { setSel({}); setKapal(defaultKapal); } }, [open, defaultKapal]);

  const kategoriList = useMemo(() => Array.from(new Set(all.map((i) => i.kategori).filter(Boolean))).sort(), [all]);

  const filtered = useMemo(() => {
    let r = all;
    if (jenis) r = r.filter((i) => i.jenis === jenis);
    if (sumber) r = r.filter((i) => i.sumber === sumber);
    if (kategori) r = r.filter((i) => i.kategori === kategori);
    return searchKatalog(r, q, 1000);
  }, [all, jenis, sumber, kategori, q]);

  const selectedItems = all.filter((i) => sel[i.kode]);
  const selCount = selectedItems.length;
  const allShownSelected = filtered.length > 0 && filtered.every((i) => sel[i.kode]);
  const toggleAllShown = () => {
    const next = { ...sel };
    if (allShownSelected) filtered.forEach((i) => delete next[i.kode]);
    else filtered.forEach((i) => (next[i.kode] = true));
    setSel(next);
  };
  const tambah = () => { if (!selCount) return; onAdd(selectedItems, kapal.trim()); onClose(); };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/40" onMouseDown={onClose}>
      <div className="bg-white w-full max-w-5xl max-h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="px-5 py-3 border-b flex items-center justify-between gap-3 bg-slate-50">
          <div>
            <h3 className="font-extrabold text-slate-800">📚 Katalog Harga Satuan (HSPK)</h3>
            <p className="text-[11px] text-slate-500">{filtered.length} item tampil dari {all.length} · centang lalu tambah ke tabel SPPBJ</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none px-2">✕</button>
        </div>

        {/* filter bar */}
        <div className="px-5 py-2.5 border-b flex flex-wrap items-center gap-2 bg-white">
          <div className="relative flex-1 min-w-[180px]">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="cari nama / kode / kategori…"
              className="w-full text-xs border rounded-lg pl-7 pr-3 py-1.5 focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/20 outline-none" />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
          </div>
          <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-white">
            <option value="">Semua jenis</option><option value="JASA">Jasa</option><option value="BARANG">Barang</option>
          </select>
          <select value={sumber} onChange={(e) => setSumber(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-white">
            <option value="">Semua sumber</option><option value="Riil">Riil ✓</option><option value="Pasar">Pasar ⚠</option>
          </select>
          <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-white max-w-[180px]">
            <option value="">Semua kategori</option>
            {kategoriList.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          {(q || jenis || sumber || kategori) && <button onClick={() => { setQ(""); setJenis(""); setSumber(""); setKategori(""); }} className="text-xs text-slate-500 hover:text-slate-700 underline">reset</button>}
        </div>

        {/* tabel */}
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-600 z-10">
              <tr>
                <th className="p-2 w-8 text-center"><input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} title="Pilih semua yang tampil" /></th>
                <th className="p-2 text-left w-24">Kode</th>
                <th className="p-2 text-left">Nama</th>
                <th className="p-2 text-left w-48">Spesifikasi</th>
                <th className="p-2 text-center w-12">Sat</th>
                <th className="p-2 text-right w-28">Harga</th>
                <th className="p-2 text-center w-20">Sumber</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">Tak ada item cocok filter.</td></tr>}
              {filtered.map((it) => {
                const on = !!sel[it.kode];
                return (
                  <tr key={it.kode} onClick={() => setSel((s) => ({ ...s, [it.kode]: !s[it.kode] }))}
                    className={`border-b cursor-pointer ${on ? "bg-sky-50" : "hover:bg-slate-50"}`}>
                    <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={on} onChange={() => setSel((s) => ({ ...s, [it.kode]: !s[it.kode] }))} />
                    </td>
                    <td className="p-2 font-mono text-[10px] text-slate-500">{it.kode}</td>
                    <td className="p-2 text-slate-800">{it.nama}{it.breakdown?.length ? <span className="text-[9px] text-sky-600 ml-1">● {it.breakdown.length} rincian</span> : null}</td>
                    <td className="p-2 text-slate-500">{it.spesifikasi}</td>
                    <td className="p-2 text-center text-slate-500">{it.satuan}</td>
                    <td className="p-2 text-right font-semibold text-slate-700">{rupiah(it.harga)}</td>
                    <td className="p-2 text-center"><span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${it.sumber === "Riil" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{it.sumber === "Riil" ? "Riil ✓" : "Pasar ⚠"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* footer aksi */}
        <div className="px-5 py-3 border-t bg-slate-50 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Kapal untuk item ini:
            <input list="kapalBrowserList" value={kapal} onChange={(e) => setKapal(e.target.value)} placeholder="(boleh kosong, isi nanti)"
              className="border rounded-lg px-2 py-1.5 text-xs w-44" />
            <datalist id="kapalBrowserList">{KAPAL_LIST.map((k) => <option key={k} value={k} />)}</datalist>
          </label>
          <span className="text-xs text-slate-500">{selCount} item dipilih</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="text-xs px-3 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-white">Batal</button>
            <button onClick={tambah} disabled={!selCount}
              className="text-xs font-semibold px-4 py-2 rounded-lg asdp-gradient text-white disabled:opacity-40">
              ＋ Tambah {selCount || ""} item ke SPPBJ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
