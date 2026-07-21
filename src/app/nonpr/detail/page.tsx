"use client";

import Link from "next/link";
import { useState } from "react";
import { useNonpr } from "@/lib/nonpr/store";
import { rupiah, tanggalIndo } from "@/lib/format";
import { generateNonpr } from "@/lib/nonpr/generateClient";
import { kapalUnikNonpr, nonprTotal } from "@/lib/nonpr/types";
import { MAX_NILAI_NONPR } from "@/lib/nonpr/db";
import PreviewPengadaan from "@/components/PreviewPengadaan";

export default function NonprDetail() {
  const { req, saveRemote, saving } = useNonpr();
  const [busy, setBusy] = useState<string | null>(null);
  const total = nonprTotal(req.items);
  const over = total > MAX_NILAI_NONPR;
  const kapals = kapalUnikNonpr(req.items);
  const enablePdf = process.env.NEXT_PUBLIC_ENABLE_PDF !== "false";

  const run = async (fn: () => Promise<void>, key: string) => {
    setBusy(key);
    try { await fn(); } catch (e: any) { alert("Gagal: " + (e?.message ?? e)); } finally { setBusy(null); }
  };

  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <div className="glass rounded-2xl ring-line elev-md px-5 py-4 mb-6">
        <Link href="/nonpr" className="text-xs text-slate-500 hover:text-[#16357f]">‹ SPPBJ Non PR PO</Link>
        <h1 className="text-xl font-extrabold asdp-text-gradient">{req.namaPengadaan || "(tanpa nama)"}</h1>
        <p className="text-xs text-slate-500">No. {req.noSPPB || "-"} · {tanggalIndo(req.tanggal)} · {req.items.length} item · {kapals.length} kapal</p>
      </div>

      <div className="bg-white rounded-2xl elev-md ring-line p-5 mb-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Vendor" value={req.vendor || "-"} />
          <Info label="Mata Anggaran" value={req.mataAnggaran || "-"} />
          <Info label="Total" value={rupiah(total)} red={over} />
          <Info label="Kapal" value={kapals.join(", ") || "-"} />
        </div>
        {over && <p className="mt-3 text-sm text-red-600">⚠️ Total melebihi batas Rp {rupiah(MAX_NILAI_NONPR)}. Generate akan tetap jalan, tapi sebaiknya dipecah.</p>}
      </div>

      <div className="bg-white rounded-2xl elev-md ring-line p-5">
        <h3 className="font-bold text-slate-800 mb-1">Generate File</h3>
        <p className="text-xs text-slate-500 mb-4">1 file Excel berisi: SPPB · spkh · BSTB (per kapal{kapals.length > 1 ? `, ${kapals.length} sheet` : ""}) · Foto.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => run(() => generateNonpr("native", req), "x")} disabled={!!busy}
            className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">{busy === "x" ? "Menyiapkan…" : "📗 Excel (.xlsx)"}</button>
          {enablePdf && (
            <button onClick={() => run(() => generateNonpr("pdf", req), "p")} disabled={!!busy}
              className="bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">{busy === "p" ? "Konversi…" : "📄 PDF"}</button>
          )}
          <Link href="/nonpr/isi" className="text-sm border px-4 py-2 rounded-lg">✏️ Edit</Link>
          <button onClick={() => run(saveRemote, "s")} disabled={saving} className="text-sm border px-4 py-2 rounded-lg disabled:opacity-60">💾 Simpan</button>
        </div>
      </div>

      {/* Preview dokumen */}
      <div className="mt-8 flex items-center gap-2 no-print">
        <h2 className="font-bold text-slate-700">Preview Dokumen</h2>
        <span className="text-[11px] text-slate-500">tampilan isi tabel · file resmi tetap dari tombol Excel/PDF di atas</span>
        <button onClick={() => window.print()} className="btn btn-ghost text-xs ml-auto">🖨️ Cetak preview</button>
      </div>
      <div className="-mx-5">
        <PreviewPengadaan
          jenis="Non PR PO"
          judul="Daftar Kebutuhan Pengadaan (Non PR PO)"
          nomor={req.noSPPB}
          tanggal={req.tanggal}
          dasarPelimpahan={req.dasarPelimpahan}
          namaPengadaan={req.namaPengadaan}
          mataAnggaran={req.mataAnggaran ? [req.mataAnggaran] : []}
          jenisAnggaran={req.jenisAnggaran}
          vendor={req.vendor}
          stafTeknik={req.stafTeknik}
          items={req.items || []}
        />
      </div>
    </main>
  );
}

function Info({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</p>
      <p className={`font-medium ${red ? "text-red-600" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}
