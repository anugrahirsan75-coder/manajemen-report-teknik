"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useNonpr } from "@/lib/nonpr/store";
import { tanggalIndo, rupiah, bulanTahun } from "@/lib/format";
import { nonprTotal } from "@/lib/nonpr/types";
import { MAX_NILAI_NONPR } from "@/lib/nonpr/db";

export default function NonprList() {
  const { listRemote, deleteRemote, loadById, newDraft, supabaseReady } = useNonpr();
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulan, setBulan] = useState("");

  const refresh = async () => { setLoading(true); setRows(await listRemote()); setLoading(false); };
  useEffect(() => { if (supabaseReady) refresh(); /* eslint-disable-next-line */ }, [supabaseReady]);

  const ym = (r: any): string => (r.payload?.tanggal || "").slice(0, 7);
  const bulanList = Array.from(new Set(rows.map(ym).filter(Boolean))).sort().reverse();
  const filtered = bulan ? rows.filter((r) => ym(r) === bulan) : rows;

  const mulai = () => { newDraft(); router.push("/nonpr/isi"); };
  const buka = (r: any) => { loadById(r); router.push("/nonpr/detail"); };
  const hapus = async (id: string, nama: string) => { if (!confirm(`Hapus "${nama}"?`)) return; await deleteRemote(id); refresh(); };

  return (
    <main className="max-w-4xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] shadow-xl">
        <div className="glass rounded-3xl px-7 py-6 flex items-center gap-4">
          <div className="bg-white rounded-2xl p-2 shadow-md shrink-0"><Image src="/logo-asdp.png" alt="ASDP" width={56} height={38} className="object-contain" /></div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold asdp-text-gradient">SPPBJ Non PR PO</h1>
            <p className="text-slate-500 text-sm">Formulir Persetujuan Pengadaan Non Purchase Order — maks Rp {rupiah(MAX_NILAI_NONPR)}/file</p>
          </div>
          <button onClick={mulai} className="asdp-gradient text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md">＋ Mulai Pengadaan</button>
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
          {supabaseReady && <button onClick={refresh} className="text-xs border px-3 py-1.5 rounded-lg">↻ Refresh</button>}
        </div>
      </div>

      {!supabaseReady ? (
        <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">Riwayat butuh Supabase (env). Mode lokal: pakai ＋ Mulai Pengadaan.</p>
      ) : loading ? (
        <p className="mt-3 text-sm text-slate-400">Memuat…</p>
      ) : rows.length === 0 ? (
        <div className="mt-3 text-center bg-white rounded-2xl border border-slate-100 p-8">
          <p className="text-slate-400 text-sm">Belum ada pengadaan. Klik <b>＋ Mulai Pengadaan</b>.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-3 text-center bg-white rounded-2xl border border-slate-100 p-8">
          <p className="text-slate-400 text-sm">Tak ada pengadaan di <b>{bulanTahun(bulan + "-01")}</b>.</p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="p-2 border-b text-center w-10">No</th>
                <th className="p-2 border-b text-left">Nama Pengadaan</th>
                <th className="p-2 border-b text-left w-28">No. SPPB</th>
                <th className="p-2 border-b text-left w-28">Tanggal</th>
                <th className="p-2 border-b text-right w-32">Total</th>
                <th className="p-2 border-b text-center w-32">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const total = nonprTotal(r.payload?.items || []);
                const over = total > MAX_NILAI_NONPR;
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-sky-50 cursor-pointer" onClick={() => buka(r)}>
                    <td className="p-2 text-center text-slate-400">{i + 1}</td>
                    <td className="p-2 font-medium text-slate-800">{r.nama_pengadaan || "(tanpa nama)"}</td>
                    <td className="p-2 text-slate-600">{r.payload?.noSPPB || "-"}</td>
                    <td className="p-2 text-slate-600">{r.payload?.tanggal ? tanggalIndo(r.payload.tanggal) : "-"}</td>
                    <td className={`p-2 text-right ${over ? "text-red-600 font-semibold" : "text-slate-600"}`}>{rupiah(total)}</td>
                    <td className="p-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => buka(r)} className="text-xs text-white asdp-gradient px-2.5 py-1 rounded-lg mr-1">Buka</button>
                      <button onClick={() => hapus(r.id, r.nama_pengadaan)} className="text-xs text-red-500 border border-red-200 px-2.5 py-1 rounded-lg">Hapus</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
