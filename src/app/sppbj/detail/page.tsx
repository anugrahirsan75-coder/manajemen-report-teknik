"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useSppbj } from "@/lib/sppbj/store";
import { sppbjTotal, kapalUnik, STATUS_LABEL, STATUS_COLOR } from "@/lib/sppbj/types";
import { rupiahRp, bulanTahun } from "@/lib/format";
import { generateSppbjDoc, generateSppbjAll } from "@/lib/sppbj/generateClient";

export default function SppbjDetail() {
  const { req, update, saveRemote, saving, lastSaved } = useSppbj();
  const [busy, setBusy] = useState<string | null>(null);
  const total = sppbjTotal(req.items);
  const kapals = kapalUnik(req.items);
  const fase2 = req.status !== "menunggu_spbj";

  const run = async (fn: () => Promise<void>, key: string) => {
    setBusy(key); try { await fn(); } catch (e: any) { alert("Gagal: " + (e?.message ?? e)); } finally { setBusy(null); }
  };

  return (
    <main className="max-w-4xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-5">
          <Link href="/sppbj" className="text-xs text-slate-500 hover:text-[#16357f]">‹ Riwayat Pengadaan</Link>
          <div className="flex items-center gap-4 mt-1">
            <div className="bg-white rounded-2xl p-2 shadow-md shrink-0"><Image src="/logo-asdp.png" alt="ASDP" width={50} height={34} className="object-contain" /></div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold asdp-text-gradient truncate">{req.namaPengadaan}</h1>
              <p className="text-slate-500 text-sm">{bulanTahun(req.tanggal)} · {req.items.length} item · {kapals.length} kapal · {rupiahRp(total)}</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[req.status]}`}>{STATUS_LABEL[req.status]}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href="/sppbj/isi" className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow">✏️ Edit Data</Link>
        <button onClick={() => run(() => generateSppbjDoc("lengkap", "native", req), "lkp")} disabled={!!busy} className="bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow disabled:opacity-50">{busy === "lkp" ? "…" : "📗 Excel Lengkap (1 file)"}</button>
        <button onClick={() => run(() => generateSppbjAll(req), "zip")} disabled={!!busy} className="bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow disabled:opacity-50">{busy === "zip" ? "…" : "🗂️ ZIP per file"}</button>
        <button onClick={saveRemote} disabled={saving} className="asdp-gradient text-white text-sm font-semibold px-4 py-2 rounded-xl shadow ml-auto">{saving ? "…" : "💾 Simpan"}</button>
        {lastSaved && <span className="text-xs text-slate-400">✓ {lastSaved}</span>}
      </div>

      {/* Fase 1 */}
      <h2 className="font-bold text-slate-700 mt-7 mb-3">Fase 1 — SPPBJ & FORMAT SAP</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <p className="font-semibold text-slate-800 text-sm">📊 Excel SPPBJ (1 file)</p>
        <p className="text-xs text-slate-400">Sheet <b>SPPBJ + KAK</b> dan <b>FORMAT SAP</b> sekaligus</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <button onClick={() => run(() => generateSppbjDoc("fase1", "native", req), "f1")} disabled={!!busy} className="btn btn-success text-xs disabled:opacity-50">📊 {busy === "f1" ? "…" : "Excel (SPPBJ + SAP)"}</button>
          <button onClick={() => run(() => generateSppbjDoc("sppbj", "pdf", req), "sp")} disabled={!!busy} className="btn btn-rose text-xs disabled:opacity-50">📄 PDF SPPBJ</button>
          <button onClick={() => run(() => generateSppbjDoc("sap", "pdf", req), "sapp")} disabled={!!busy} className="bg-rose-500 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">📄 PDF SAP</button>
        </div>
      </div>

      {/* Fase 2 */}
      <div className="mt-7 flex items-center gap-2">
        <h2 className="font-bold text-slate-700">Fase 2 — setelah SPBJ (PO) terbit</h2>
        {!fase2 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">aktifkan di Edit → Data SPBJ</span>}
        {req.status === "spbj_terbit" && <button onClick={() => update({ status: "selesai" })} className="ml-auto text-xs bg-green-600 text-white px-3 py-1 rounded-lg">✓ Tandai Selesai</button>}
      </div>
      <div className={`mt-3 space-y-4 ${!fase2 ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <p className="font-semibold text-slate-800 text-sm mb-2">📦 BSTB — per kapal</p>
          <div className="flex flex-wrap gap-2">
            {kapals.length === 0 && <span className="text-xs text-slate-400">Belum ada kapal.</span>}
            {kapals.map((k) => (
              <div key={k} className="flex items-center gap-2 border rounded-lg px-2.5 py-1.5">
                <span className="text-xs font-medium">{k}</span>
                <button onClick={() => run(() => generateSppbjDoc("bstb", "native", req, k), "b" + k)} disabled={!!busy} className="bg-green-700 text-white text-xs px-2.5 py-1 rounded-lg disabled:opacity-50">📊 Excel</button>
                <button onClick={() => run(() => generateSppbjDoc("bstb", "pdf", req, k), "bp" + k)} disabled={!!busy} className="bg-rose-600 text-white text-xs px-2.5 py-1 rounded-lg disabled:opacity-50">📄 PDF</button>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <p className="font-semibold text-slate-800 text-sm">📝 BAPP — Berita Acara Penyelesaian</p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => run(() => generateSppbjDoc("bapp", "native", req), "bx")} disabled={!!busy} className="btn btn-success text-xs disabled:opacity-50">📊 Excel</button>
            <button onClick={() => run(() => generateSppbjDoc("bapp", "pdf", req), "bpp")} disabled={!!busy} className="btn btn-rose text-xs disabled:opacity-50">📄 PDF</button>
          </div>
        </div>
      </div>
    </main>
  );
}
