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
import { jenisAnggaranOf } from "@/lib/anggaran/types";
import { konfirmasi } from "@/components/Konfirmasi";

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
  // saring per jenis anggaran (Rutin/Docking/Lainnya) — aturan sama dgn Dashboard
  const [jenis, setJenis] = useState<"" | "rutin" | "docking" | "lainnya">("");
  const jenisOf = (r: any) => jenisAnggaranOf(r.payload || {});
  const filtered = rows.filter((r) => (!bulan || ym(r) === bulan) && (!jenis || jenisOf(r) === jenis));
  const hitungJenis = (j: "rutin" | "docking" | "lainnya") =>
    rows.filter((r) => (!bulan || ym(r) === bulan) && jenisOf(r) === j).length;

  const mulai = () => { newDraft(); router.push("/nonpr/isi"); };
  const buka = (r: any) => { loadById(r); router.push("/nonpr/detail"); };

  // Dibuka langsung dari Dashboard Anggaran: /nonpr?buka=<id> -> muat lalu lompat ke detailnya.
  const [bukaId, setBukaId] = useState<string | null>(null);
  const [bukaGagal, setBukaGagal] = useState("");
  useEffect(() => { setBukaId(new URLSearchParams(window.location.search).get("buka")); }, []);
  useEffect(() => {
    if (!bukaId || loading || !rows.length) return;
    const r = rows.find((x) => x.id === bukaId);
    setBukaId(null);
    if (r) buka(r);
    else setBukaGagal("Pengadaan yang dituju tak ditemukan — mungkin sudah dihapus.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bukaId, rows, loading]);
  const hapus = async (id: string, nama: string) => {
    if (!(await konfirmasi({
      nada: "bahaya", judul: "Hapus pengadaan ini?", pesan: nama,
      tegasan: "Seluruh itemnya ikut terhapus dan tak bisa dikembalikan.", tombolYa: "Ya, hapus",
    }))) return;
    await deleteRemote(id); refresh();
  };

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex items-center gap-4">
          <div className="bg-white rounded-2xl p-2 shadow-md shrink-0"><Image src="/logo-asdp.png" alt="ASDP" width={56} height={38} className="object-contain" /></div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold asdp-text-gradient">SPPBJ Non PR PO</h1>
            <p className="text-slate-500 text-sm">Formulir Persetujuan Pengadaan Non Purchase Order — maks Rp {rupiah(MAX_NILAI_NONPR)}/file</p>
            {bukaId && <p className="text-xs text-slate-500 mt-1">Membuka pengadaan dari Dashboard…</p>}
            {bukaGagal && <p className="text-xs text-rose-700 mt-1">{bukaGagal}</p>}
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
          <div className="flex rounded-lg overflow-hidden ring-1 ring-slate-200 bg-white">
            {([["", "Semua", "text-slate-700", "bg-slate-700"],
               ["rutin", "Rutin", "text-emerald-700", "bg-emerald-600"],
               ["docking", "Docking", "text-amber-700", "bg-amber-500"],
               ["lainnya", "Lainnya", "text-indigo-700", "bg-indigo-600"]] as const).map(([v, l, tint, aktif]) => (
              <button key={v} onClick={() => setJenis(v as any)}
                title={v ? `Tampilkan hanya pengadaan ber-Jenis Anggaran ${l}` : "Tampilkan semua jenis"}
                className={`text-[11px] font-bold px-2.5 py-1.5 ${jenis === v ? `${aktif} text-white` : `${tint} hover:bg-slate-50`}`}>
                {l}{v ? ` ${hitungJenis(v as any)}` : ""}
              </button>
            ))}
          </div>
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
                        <span className="block max-w-[17rem] font-medium text-slate-800 text-[12px] leading-[1.35] break-words" title={r.nama_pengadaan || ""}>{r.nama_pengadaan || "(tanpa nama)"}</span>
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
