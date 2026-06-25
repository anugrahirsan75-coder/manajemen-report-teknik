"use client";

import { useEffect, useRef, useState } from "react";
import { ocrTableItems, ParsedItem } from "@/lib/sppbj/ocrTable";
import { rupiah } from "@/lib/format";

/** Modal: screenshot tabel Excel -> OCR -> isi item SPPBJ (kapal header + breakdown). */
export default function ScanSppbj({ open, onClose, onAdd }: {
  open: boolean; onClose: () => void; onAdd: (items: ParsedItem[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsed, setParsed] = useState<ParsedItem[] | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!open) { setBusy(false); setProgress(0); setParsed(null); setPreview(""); setErr(""); } }, [open]);

  const run = async (file: File | Blob) => {
    setErr(""); setParsed(null); setBusy(true); setProgress(0);
    try {
      setPreview(URL.createObjectURL(file));
      const items = await ocrTableItems(file, setProgress);
      if (!items.length) setErr("Tak ada baris terbaca. Pastikan screenshot tabel jelas & tegak (zoom Excel ~125%).");
      setParsed(items);
    } catch (e: any) { setErr("Gagal OCR: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  // paste Ctrl+V gambar saat modal terbuka
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const img = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith("image/"));
      if (img) { const f = img.getAsFile(); if (f) { e.preventDefault(); run(f); } }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open]);

  if (!open) return null;
  const totalBreakdown = parsed?.reduce((s, i) => s + (i.breakdown?.length || 0), 0) || 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 bg-black/50 overflow-auto" onMouseDown={onClose}>
      <div className="bg-white w-full max-w-2xl my-4 rounded-2xl shadow-2xl overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-extrabold text-slate-800">📷 Scan Tabel dari Excel (OCR)</h3>
            <p className="text-[11px] text-slate-500">Screenshot tabel item → terisi otomatis (kapal, item, rincian).</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
        </div>

        <div className="px-5 py-4">
          {!parsed && !busy && (
            <div onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) run(f); }}
              className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#1ca3dd] hover:bg-sky-50/50 px-4 py-10 text-center transition">
              <div className="text-3xl mb-2">🖼️</div>
              <p className="text-sm font-semibold text-slate-700">Klik pilih · tarik · atau <kbd className="px-1.5 py-0.5 bg-slate-100 border rounded text-[10px]">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 bg-slate-100 border rounded text-[10px]">V</kbd> tempel screenshot</p>
              <p className="text-[11px] text-slate-400 mt-1">Tip: zoom Excel ~125%, screenshot rapi termasuk baris header (No · Jumlah · …).</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ""; }} />
            </div>
          )}

          {busy && (
            <div className="py-8 text-center">
              <div className="text-sm font-semibold text-slate-700 mb-2">⏳ Membaca tabel… {progress}%</div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden max-w-xs mx-auto"><div className="h-full bg-[#1ca3dd] transition-all" style={{ width: `${progress}%` }} /></div>
              <p className="text-[11px] text-slate-400 mt-2">OCR jalan di browser (offline). Pertama kali muat model bisa agak lama.</p>
            </div>
          )}

          {err && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-1">{err}</p>}

          {parsed && parsed.length > 0 && (
            <div className="mt-1">
              <p className="text-xs text-slate-500 mb-2">Terbaca <b className="text-slate-800">{parsed.length} item</b>{totalBreakdown > 0 && <> · {totalBreakdown} baris rincian</>}. Periksa dulu — bisa diedit lagi di tabel setelah ditambah.</p>
              <div className="max-h-72 overflow-auto rounded-xl ring-1 ring-slate-200 divide-y">
                {parsed.map((it, i) => (
                  <div key={i} className="px-3 py-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-slate-400 text-xs mt-0.5 w-5 shrink-0">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        {it.kapal && <span className="text-[10px] font-bold text-[#16357f] bg-sky-50 rounded px-1.5 py-0.5 mr-1">{it.kapal}</span>}
                        {it.keterangan && <div className="text-[11px] font-semibold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mb-0.5 inline-block whitespace-pre-line">{it.keterangan}</div>}
                        <span className="font-medium text-slate-800">{it.nama || <em className="text-slate-300">—</em>}</span>
                        {it.spesifikasi && <span className="text-slate-400 text-xs"> · {it.spesifikasi}</span>}
                        <div className="text-[11px] text-slate-500">{it.jumlah} {it.satuan} × {rupiah(it.harga)}{it.breakdown?.length ? <span className="text-sky-600"> · {it.breakdown.length} rincian</span> : null}</div>
                        {it.breakdown?.length ? <ul className="mt-0.5 ml-2 text-[11px] text-slate-400 list-disc list-inside">{it.breakdown.slice(0, 4).map((b, bi) => <li key={bi} className="truncate">{b}</li>)}{it.breakdown.length > 4 && <li>… +{it.breakdown.length - 4}</li>}</ul> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t bg-slate-50 flex items-center gap-2">
          {preview && <a href={preview} target="_blank" className="text-[11px] text-slate-400 hover:text-slate-600">lihat gambar</a>}
          <div className="ml-auto flex items-center gap-2">
            {parsed && <button onClick={() => { setParsed(null); setPreview(""); setErr(""); }} className="text-xs px-3 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-white">Ulang</button>}
            <button onClick={onClose} className="text-xs px-3 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-white">Tutup</button>
            <button onClick={() => { if (parsed?.length) { onAdd(parsed); onClose(); } }} disabled={!parsed?.length}
              className="text-xs font-semibold px-4 py-2 rounded-lg asdp-gradient text-white disabled:opacity-40">＋ Tambah {parsed?.length || ""} item</button>
          </div>
        </div>
      </div>
    </div>
  );
}
