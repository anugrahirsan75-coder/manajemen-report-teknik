"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { getKatalog, searchKatalog, katalogSeed, KatalogItem } from "@/lib/katalog/source";
import { KAPAL_LIST } from "@/lib/sppbj/db";
import { rupiah } from "@/lib/format";

/** Modal telusur SELURUH katalog HSPK → centang banyak → tambah ke tabel SPPBJ.
 *
 * `fokus` mempersempit katalog ke satu rumpun kategori (mis. "Perbaikan —").
 * Tanpa itu, pekerjaan perbaikan harian tenggelam di antara ratusan item
 * docking: yang dicari pemakai justru yang paling sulit ditemukan.
 */
export default function KatalogBrowser({ open, onClose, onAdd, defaultKapal = "", fokus = "", judul = "" }: {
  open: boolean;
  onClose: () => void;
  onAdd: (items: KatalogItem[], kapal: string) => void;
  defaultKapal?: string;
  fokus?: string;
  judul?: string;
}) {
  const [all, setAll] = useState<KatalogItem[]>(katalogSeed());
  const [q, setQ] = useState("");
  const [jenis, setJenis] = useState("");
  const [sumber, setSumber] = useState("");
  const [kategori, setKategori] = useState("");
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [buka, setBuka] = useState<Record<string, boolean>>({});
  const [kapal, setKapal] = useState(defaultKapal);

  useEffect(() => { if (open) getKatalog().then(setAll).catch(() => {}); }, [open]);
  useEffect(() => {
    if (open) { setSel({}); setBuka({}); setKapal(defaultKapal); setQ(""); setJenis(""); setSumber(""); setKategori(""); }
  }, [open, defaultKapal, fokus]);

  const dasar = useMemo(
    () => (fokus ? all.filter((i) => (i.kategori || "").startsWith(fokus)) : all),
    [all, fokus],
  );
  const kategoriList = useMemo(() => Array.from(new Set(dasar.map((i) => i.kategori).filter(Boolean))).sort(), [dasar]);
  /** nama kelompok tanpa awalan fokus, supaya chip-nya pendek dan terbaca */
  const labelKategori = (k: string) => (fokus && k.startsWith(fokus) ? k.slice(fokus.length).trim() : k);

  const filtered = useMemo(() => {
    let r = dasar;
    if (jenis) r = r.filter((i) => i.jenis === jenis);
    if (sumber) r = r.filter((i) => i.sumber === sumber);
    if (kategori) r = r.filter((i) => i.kategori === kategori);
    return searchKatalog(r, q, 1000);
  }, [dasar, jenis, sumber, kategori, q]);

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
            <h3 className="font-extrabold text-slate-800">{judul || "📚 Katalog Harga Satuan (HSPK)"}</h3>
            <p className="text-[11px] text-slate-500">{filtered.length} item tampil dari {dasar.length} · centang lalu tambah ke tabel SPPBJ · klik “rincian” untuk melihat bahannya</p>
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

        {/* kelompok pekerjaan — pintasan sekali klik, isinya sama dengan dropdown kategori */}
        {fokus && kategoriList.length > 1 && (
          <div className="px-5 py-2 border-b bg-white flex flex-wrap gap-1.5">
            <button onClick={() => setKategori("")}
              className={`text-[11px] px-2.5 py-1 rounded-full border ${!kategori ? "bg-[#16357f] text-white border-[#16357f]" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
              Semua ({dasar.length})
            </button>
            {kategoriList.map((k) => (
              <button key={k} onClick={() => setKategori(kategori === k ? "" : k)}
                className={`text-[11px] px-2.5 py-1 rounded-full border ${kategori === k ? "bg-[#16357f] text-white border-[#16357f]" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
                {labelKategori(k)} ({dasar.filter((i) => i.kategori === k).length})
              </button>
            ))}
          </div>
        )}

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
                const rinci = it.breakdown || [];
                const terbuka = !!buka[it.kode];
                return (
                  <Fragment key={it.kode}>
                    <tr onClick={() => setSel((s) => ({ ...s, [it.kode]: !s[it.kode] }))}
                      className={`border-b cursor-pointer ${on ? "bg-sky-50" : "hover:bg-slate-50"}`}>
                      <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={on} onChange={() => setSel((s) => ({ ...s, [it.kode]: !s[it.kode] }))} />
                      </td>
                      <td className="p-2 font-mono text-[10px] text-slate-500">{it.kode}</td>
                      <td className="p-2 text-slate-800">
                        {it.nama}
                        {rinci.length > 0 && (
                          <button onClick={(e) => { e.stopPropagation(); setBuka((b) => ({ ...b, [it.kode]: !b[it.kode] })); }}
                            className="text-[9px] text-sky-600 ml-1.5 underline hover:text-sky-800">
                            {terbuka ? "▾" : "▸"} {rinci.length} rincian
                          </button>
                        )}
                      </td>
                      <td className="p-2 text-slate-500">{it.spesifikasi}</td>
                      <td className="p-2 text-center text-slate-500">{it.satuan}</td>
                      <td className="p-2 text-right font-semibold text-slate-700">{rupiah(it.harga)}</td>
                      <td className="p-2 text-center"><span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${it.sumber === "Riil" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{it.sumber === "Riil" ? "Riil ✓" : "Pasar ⚠"}</span></td>
                    </tr>
                    {terbuka && (
                      <tr className="border-b bg-slate-50/70">
                        <td />
                        <td colSpan={6} className="px-2 pb-2 pt-0">
                          <ul className="text-[11px] text-slate-600 leading-relaxed">
                            {rinci.map((b, i) => <li key={i}>– {b}</li>)}
                          </ul>
                          <p className="text-[10px] text-slate-400 mt-1">Rincian ikut terbawa ke SPPBJ dan masih bisa disunting di sana.</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
