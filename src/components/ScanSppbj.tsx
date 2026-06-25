"use client";

import { useEffect, useRef, useState } from "react";
import { ocrTableItems, ParsedItem } from "@/lib/sppbj/ocrTable";

/** Modal: screenshot tabel Excel -> OCR -> preview EDITABLE -> isi item SPPBJ. */
export default function ScanSppbj({ open, onClose, onAdd }: {
  open: boolean; onClose: () => void; onAdd: (items: ParsedItem[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<ParsedItem[]>([]);
  const [scanned, setScanned] = useState(0);   // jumlah gambar diproses
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!open) { setBusy(false); setProgress(0); setRows([]); setScanned(0); setErr(""); } }, [open]);

  const runMany = async (files: File[]) => {
    if (!files.length) return;
    setErr(""); setBusy(true); setProgress(0);
    try {
      for (const f of files) {
        const items = await ocrTableItems(f, setProgress);
        setRows((prev) => [...prev, ...items]);
        setScanned((n) => n + 1);
      }
    } catch (e: any) { setErr("Gagal OCR: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  // paste Ctrl+V gambar (bisa berkali-kali, hasil ditambahkan)
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const imgs = Array.from(e.clipboardData?.items || []).filter((it) => it.type.startsWith("image/")).map((it) => it.getAsFile()!).filter(Boolean) as File[];
      if (imgs.length) { e.preventDefault(); runMany(imgs); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open]);

  const setField = (i: number, patch: Partial<ParsedItem>) => setRows((r) => r.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const delRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const addBlank = () => setRows((r) => [...r, { kapal: r[r.length - 1]?.kapal || "", jumlah: 1, satuan: "unit", nama: "", spesifikasi: "", harga: 0 }]);

  if (!open) return null;
  const totalBreakdown = rows.reduce((s, i) => s + (i.breakdown?.length || 0), 0);
  const warnCount = rows.filter((r) => r.warn).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 bg-black/50 overflow-auto" onMouseDown={onClose}>
      <div className="bg-white w-full max-w-4xl my-4 rounded-2xl shadow-2xl overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-extrabold text-slate-800">📷 Scan Tabel dari Excel (OCR)</h3>
            <p className="text-[11px] text-slate-500">Screenshot tabel → terbaca otomatis → <b>periksa &amp; edit</b> → tambah. Bisa scan beberapa gambar.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
        </div>

        <div className="px-5 py-4">
          {/* dropzone selalu ada (utk tambah gambar lagi) */}
          <div onClick={() => !busy && fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const fs = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/")); if (fs.length) runMany(fs); }}
            className={`cursor-pointer rounded-2xl border-2 border-dashed px-4 py-4 text-center transition ${busy ? "border-sky-300 bg-sky-50" : "border-slate-300 hover:border-[#1ca3dd] hover:bg-sky-50/50"}`}>
            {busy ? (
              <div>
                <div className="text-sm font-semibold text-slate-700 mb-1">⏳ Membaca tabel… {progress}%</div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden max-w-xs mx-auto"><div className="h-full bg-[#1ca3dd] transition-all" style={{ width: `${progress}%` }} /></div>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-700"><span className="text-lg">🖼️</span> Klik pilih · tarik · <kbd className="px-1.5 py-0.5 bg-slate-100 border rounded text-[10px]">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 bg-slate-100 border rounded text-[10px]">V</kbd> tempel screenshot {rows.length > 0 && "(tambah gambar lagi)"}</p>
                <p className="text-[11px] text-slate-400 mt-1">Gambar diproses & dipertajam otomatis. Ikutkan baris header (No · Jumlah · …). Bisa pilih banyak sekaligus.</p>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) runMany(fs); e.target.value = ""; }} />
          </div>

          {err && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">{err}</p>}

          {rows.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500"><b className="text-slate-800">{rows.length} item</b> dari {scanned} gambar{totalBreakdown > 0 && <> · {totalBreakdown} rincian</>}{warnCount > 0 && <span className="text-amber-600"> · {warnCount} perlu cek</span>}</p>
                <button onClick={addBlank} className="text-[11px] text-[#16357f] hover:underline">+ baris kosong</button>
              </div>
              <div className="max-h-[46vh] overflow-auto rounded-xl ring-1 ring-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0">
                    <tr>
                      <th className="p-1.5 text-left font-semibold">Kapal</th>
                      <th className="p-1.5 text-left font-semibold">Keterangan (atas)</th>
                      <th className="p-1.5 text-left font-semibold">Nama Barang</th>
                      <th className="p-1.5 text-left font-semibold">Spesifikasi</th>
                      <th className="p-1.5 font-semibold w-12">Jml</th>
                      <th className="p-1.5 font-semibold w-12">Sat</th>
                      <th className="p-1.5 font-semibold w-24">Harga</th>
                      <th className="p-1.5 w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={`border-t ${r.warn ? "bg-amber-50/60" : ""}`}>
                        <td className="p-1"><input value={r.kapal} onChange={(e) => setField(i, { kapal: e.target.value })} className="w-24 px-1 py-0.5 border rounded bg-white" /></td>
                        <td className="p-1"><input value={r.keterangan || ""} onChange={(e) => setField(i, { keterangan: e.target.value })} placeholder="—" className="w-32 px-1 py-0.5 border rounded bg-amber-50/40" /></td>
                        <td className="p-1"><input value={r.nama} onChange={(e) => setField(i, { nama: e.target.value })} className="w-40 px-1 py-0.5 border rounded bg-white" /></td>
                        <td className="p-1"><input value={r.spesifikasi} onChange={(e) => setField(i, { spesifikasi: e.target.value })} className="w-28 px-1 py-0.5 border rounded bg-white" /></td>
                        <td className="p-1"><input type="number" value={r.jumlah} onChange={(e) => setField(i, { jumlah: +e.target.value })} className="w-12 px-1 py-0.5 border rounded text-center bg-white" /></td>
                        <td className="p-1"><input value={r.satuan} onChange={(e) => setField(i, { satuan: e.target.value })} className="w-12 px-1 py-0.5 border rounded text-center bg-white" /></td>
                        <td className="p-1"><input type="number" value={r.harga} onChange={(e) => setField(i, { harga: +e.target.value, warn: false })} className={`w-24 px-1 py-0.5 border rounded text-right bg-white ${r.warn ? "border-amber-400" : ""}`} title={r.warn ? "harga hasil koreksi otomatis — mohon cek" : ""} /></td>
                        <td className="p-1 text-center"><button onClick={() => delRow(i)} className="text-red-400 hover:text-red-600">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {warnCount > 0 && <p className="text-[11px] text-amber-600 mt-1.5">⚠ {warnCount} harga ditandai — hasil koreksi otomatis (qty × harga ≠ total OCR). Mohon cek angkanya.</p>}
              <p className="text-[11px] text-slate-400 mt-1">Rincian/breakdown ikut tersimpan otomatis (atur di tabel SPPBJ via tombol “ket/rincian”).</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t bg-slate-50 flex items-center gap-2">
          {rows.length > 0 && <button onClick={() => { setRows([]); setScanned(0); setErr(""); }} className="text-xs px-3 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-white">Bersihkan</button>}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="text-xs px-3 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-white">Tutup</button>
            <button onClick={() => { if (rows.length) { onAdd(rows); onClose(); } }} disabled={!rows.length || busy}
              className="text-xs font-semibold px-4 py-2 rounded-lg asdp-gradient text-white disabled:opacity-40">＋ Tambah {rows.length || ""} item</button>
          </div>
        </div>
      </div>
    </div>
  );
}
