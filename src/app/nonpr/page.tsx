"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useNonpr } from "@/lib/nonpr/store";
import { tanggalIndo, rupiah, bulanTahun } from "@/lib/format";
import { nonprTotal } from "@/lib/nonpr/types";
import { MAX_NILAI_NONPR } from "@/lib/nonpr/db";
import KapalCell from "@/components/KapalCell";
import PreviewModal from "@/components/PreviewModal";
import JenisBadge from "@/components/JenisBadge";
import { useAnggaran } from "@/lib/anggaran/store";

export default function NonprList() {
  const { listRemote, deleteRemote, loadById, newDraft, supabaseReady } = useNonpr();
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulan, setBulan] = useState("");
  const [preview, setPreview] = useState<any | null>(null);
  const { program, pengadaan } = useAnggaran();

  const refresh = async () => { setLoading(true); setRows(await listRemote()); setLoading(false); };
  useEffect(() => { if (supabaseReady) refresh(); /* eslint-disable-next-line */ }, [supabaseReady]);

  const ym = (r: any): string => (r.payload?.tanggal || "").slice(0, 7);
  const bulanList = Array.from(new Set(rows.map(ym).filter(Boolean))).sort().reverse();
  const filtered = bulan ? rows.filter((r) => ym(r) === bulan) : rows;

  const mulai = () => { newDraft(); router.push("/nonpr/isi"); };
  const buka = (r: any) => { loadById(r); router.push("/nonpr/detail"); };
  const hapus = async (id: string, nama: string) => { if (!confirm(`Hapus "${nama}"?`)) return; await deleteRemote(id); refresh(); };

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex items-center gap-4">
          <div className="bg-white rounded-2xl p-2 shadow-md shrink-0"><Image src="/logo-asdp.png" alt="ASDP" width={56} height={38} className="object-contain" /></div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold asdp-text-gradient">SPPBJ Non PR PO</h1>
            <p className="text-slate-500 text-sm">Formulir Persetujuan Pengadaan Non Purchase Order — maks Rp {rupiah(MAX_NILAI_NONPR)}/file</p>
          </div>
          <button onClick={mulai} className="btn btn-primary px-5 py-2.5 text-sm">＋ Mulai Pengadaan</button>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="font-bold text-slate-700">Riwayat Pengadaan</h2>
        <div className="flex items-center gap-2">
          {supabaseReady && (
            <select value={bulan} onChange={(e) => setBulan(e.target.value)} className="text-xs border px-2.5 py-1.5 rounded-lg bg-white">
              <option value="">Semua bulan</option>
              {bulanList.map((b) => <option key={b} value={b}>{bulanTahun(b + "-01")}</option>)}
            </select>
          )}
          {supabaseReady && <button onClick={refresh} className="btn btn-ghost text-xs">↻ Refresh</button>}
        </div>
      </div>

      {!supabaseReady ? (
        <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">Riwayat butuh Supabase (env). Mode lokal: pakai ＋ Mulai Pengadaan.</p>
      ) : loading ? (
        <p className="mt-3 text-sm text-slate-400">Memuat…</p>
      ) : rows.length === 0 ? (
        <div className="mt-3 text-center bg-white rounded-2xl ring-line elev-sm p-8">
          <p className="text-slate-400 text-sm">Belum ada pengadaan. Klik <b>＋ Mulai Pengadaan</b>.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-3 text-center bg-white rounded-2xl ring-line elev-sm p-8">
          <p className="text-slate-400 text-sm">Tak ada pengadaan di <b>{bulanTahun(bulan + "-01")}</b>.</p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto bg-white rounded-2xl elev-md ring-line anim-in">
          <table className="w-full text-sm min-w-[70rem]">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600 font-bold">
              <tr className="border-b-2 border-slate-200">
                <th className="px-2 py-2.5 text-center w-10">No</th>
                <th className="px-2 py-2.5 text-left min-w-[17rem]">Nama Pengadaan</th>
                <th className="px-2 py-2.5 text-left w-40">Kapal</th>
                <th className="px-2 py-2.5 text-left w-28">No. SPPB</th>
                <th className="px-2 py-2.5 text-left w-28">Tanggal</th>
                <th className="px-2 py-2.5 text-right w-32">Total</th>
                <th className="px-2 py-2.5 text-center w-44">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const total = nonprTotal(r.payload?.items || []);
                const over = total > MAX_NILAI_NONPR;
                return (
                  <tr key={r.id} className="border-b border-slate-200 last:border-0 row-hover cursor-pointer align-middle even:bg-slate-50/50" onClick={() => buka(r)}>
                    <td className="px-2 py-2.5 text-center text-xs text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-start gap-2">
                        <JenisBadge payload={r.payload || {}} program={program} pengadaan={pengadaan} />
                        <span className="font-medium text-slate-800 leading-snug klip-2" title={r.nama_pengadaan || ""}>{r.nama_pengadaan || "(tanpa nama)"}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5"><KapalCell items={r.payload?.items || []} /></td>
                    <td className="px-2 py-2.5 text-slate-600 tabular-nums whitespace-nowrap">{r.payload?.noSPPB || "-"}</td>
                    <td className="px-2 py-2.5 text-slate-600 whitespace-nowrap">{r.payload?.tanggal ? tanggalIndo(r.payload.tanggal) : "-"}</td>
                    <td className={`px-2 py-2.5 text-right tabular-nums whitespace-nowrap ${over ? "text-red-700 font-bold" : "text-slate-700 font-semibold"}`}>{rupiah(total)}</td>
                    <td className="px-2 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setPreview(r)} className="btn btn-ghost text-[11px] px-2 py-1" title="Lihat isi dokumen">👁</button>
                        <button onClick={() => buka(r)} className="btn btn-primary text-[11px] px-3 py-1">Buka</button>
                        <button onClick={() => hapus(r.id, r.nama_pengadaan)} className="btn btn-danger-soft text-[11px] px-2 py-1" title="Hapus">🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {preview && (
        <PreviewModal jenis="Non PR PO" payload={preview.payload} onTutup={() => setPreview(null)}
          onBuka={() => { const r = preview; setPreview(null); buka(r); }} />
      )}
    </main>
  );
}
