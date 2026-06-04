"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSppbj } from "@/lib/sppbj/store";
import { STATUS_LABEL, STATUS_COLOR, SppbjStatus } from "@/lib/sppbj/types";
import { tanggalIndo } from "@/lib/format";

export default function SppbjList() {
  const { listRemote, deleteRemote, loadById, newDraft, supabaseReady } = useSppbj();
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => { setLoading(true); setRows(await listRemote()); setLoading(false); };
  useEffect(() => { if (supabaseReady) refresh(); /* eslint-disable-next-line */ }, [supabaseReady]);

  const mulai = () => { newDraft(); router.push("/sppbj/isi"); };
  const buka = (r: any) => { loadById(r); router.push("/sppbj/detail"); };
  const hapus = async (id: string, nama: string) => { if (!confirm(`Hapus "${nama}"?`)) return; await deleteRemote(id); refresh(); };

  const rekap = {
    total: rows.length,
    menunggu: rows.filter((r) => (r.status || "menunggu_spbj") === "menunggu_spbj").length,
    spbj: rows.filter((r) => r.status === "spbj_terbit").length,
    selesai: rows.filter((r) => r.status === "selesai").length,
  };

  return (
    <main className="max-w-4xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] shadow-xl">
        <div className="glass rounded-3xl px-7 py-6 flex items-center gap-4">
          <div className="bg-white rounded-2xl p-2 shadow-md shrink-0"><Image src="/logo-asdp.png" alt="ASDP" width={56} height={38} className="object-contain" /></div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold asdp-text-gradient">SPPBJ Pengadaan</h1>
            <p className="text-slate-500 text-sm">Riwayat &amp; rekap pengadaan — klik untuk buka & generate dokumen</p>
          </div>
          <button onClick={mulai} className="asdp-gradient text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md">＋ Mulai Pengadaan</button>
        </div>
      </div>

      {/* Rekap */}
      <section className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total" value={rekap.total} color="text-slate-800" />
        <Stat label="Menunggu SPBJ" value={rekap.menunggu} color="text-amber-600" />
        <Stat label="SPBJ Terbit" value={rekap.spbj} color="text-blue-600" />
        <Stat label="Selesai" value={rekap.selesai} color="text-green-600" />
      </section>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-bold text-slate-700">Riwayat Pengadaan</h2>
        {supabaseReady && <button onClick={refresh} className="text-xs border px-3 py-1.5 rounded-lg">↻ Refresh</button>}
      </div>

      {!supabaseReady ? (
        <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">Riwayat butuh Supabase (env). Mode lokal: pakai ＋ Mulai Pengadaan.</p>
      ) : loading ? (
        <p className="mt-3 text-sm text-slate-400">Memuat…</p>
      ) : rows.length === 0 ? (
        <div className="mt-3 text-center bg-white rounded-2xl border border-slate-100 p-8">
          <p className="text-slate-400 text-sm">Belum ada pengadaan. Klik <b>＋ Mulai Pengadaan</b>.</p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="p-2 border-b text-center w-10">No</th>
                <th className="p-2 border-b text-left">Judul SPPBJ</th>
                <th className="p-2 border-b text-left w-40">Nomor</th>
                <th className="p-2 border-b text-left w-32">Tanggal</th>
                <th className="p-2 border-b text-left w-36">Status</th>
                <th className="p-2 border-b text-center w-32">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const st = (r.status as SppbjStatus) || "menunggu_spbj";
                const nomor = r.payload?.noSPPBJ || r.payload?.noKontrak || "-";
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-sky-50 cursor-pointer" onClick={() => buka(r)}>
                    <td className="p-2 text-center text-slate-400">{i + 1}</td>
                    <td className="p-2 font-medium text-slate-800">{r.nama_pengadaan || "(tanpa nama)"}</td>
                    <td className="p-2 text-slate-600">{nomor}</td>
                    <td className="p-2 text-slate-600">{r.payload?.tanggal ? tanggalIndo(r.payload.tanggal) : "-"}</td>
                    <td className="p-2"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[st] ?? STATUS_COLOR.menunggu_spbj}`}>{STATUS_LABEL[st] ?? r.status}</span></td>
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

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</p>
      <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}
