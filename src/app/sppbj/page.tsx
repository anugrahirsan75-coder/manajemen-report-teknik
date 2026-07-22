"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSppbj } from "@/lib/sppbj/store";
import { STATUS_LABEL, STATUS_COLOR, SppbjStatus, fullNoKontrak } from "@/lib/sppbj/types";
import { tanggalIndo, bulanTahun } from "@/lib/format";
import { getKatalog } from "@/lib/katalog/source";
import { buildRekapRow, sendToRekap, NoRekapConfigError } from "@/lib/sppbj/rekapSync";
import KapalCell, { kapalDariItems } from "@/components/KapalCell";
import PreviewModal from "@/components/PreviewModal";
import JenisBadge from "@/components/JenisBadge";
import { useAnggaran } from "@/lib/anggaran/store";

export default function SppbjList() {
  const { listRemote, deleteRemote, loadById, newDraft, supabaseReady } = useSppbj();
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulan, setBulan] = useState(""); // "" = semua bulan, else "YYYY-MM"
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<any | null>(null); // baris yang sedang dilihat
  const { program, pengadaan } = useAnggaran(); // utk isi popover badge jenis anggaran

  // daftar bulan unik dari tanggal SPPBJ (desc)
  const ym = (r: any): string => (r.payload?.tanggal || "").slice(0, 7);
  const bulanList = Array.from(new Set(rows.map(ym).filter(Boolean))).sort().reverse();

  // gabung field yang dicari (judul/nomor/kapal/status) -> normalisasi lowercase
  const matchTokens = (r: any, q: string): boolean => {
    if (!q) return true;
    const items: any[] = r.payload?.items || [];
    const hay = [
      r.nama_pengadaan, r.payload?.noSPPBJ, r.payload?.noKontrak, r.payload?.status,
      ...items.map((i) => i.kapal), ...items.map((i) => i.nama), ...kapalDariItems(items),
    ].filter(Boolean).join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
  };
  const filtered = rows.filter((r) => (!bulan || ym(r) === bulan) && matchTokens(r, query));

  const refresh = async () => { setLoading(true); setRows(await listRemote()); setLoading(false); };
  useEffect(() => { if (supabaseReady) refresh(); /* eslint-disable-next-line */ }, [supabaseReady]);

  const mulai = () => { newDraft(); router.push("/sppbj/isi"); };
  const buka = (r: any) => { loadById(r); router.push("/sppbj/detail"); };
  const hapus = async (id: string, nama: string) => { if (!confirm(`Hapus "${nama}"?`)) return; await deleteRemote(id); refresh(); };

  // Sync ke spreadsheet REKAP PJK (semua pengadaan di filter -> tab bulan masing-masing)
  const [rekapBusy, setRekapBusy] = useState(false);
  const syncRekap = async () => {
    const rows = filtered.map((r) => buildRekapRow(r.payload)).filter((x) => x.nomorSppbj && x.month);
    if (!rows.length) { alert("Tak ada pengadaan dgn No. PR SAP di filter ini. Isi No. PR SAP dulu."); return; }
    if (!confirm(`Kirim ${rows.length} pengadaan ke spreadsheet REKAP?\n(pengadaan tanpa No. PR SAP dilewati)`)) return;
    setRekapBusy(true);
    try {
      const r = await sendToRekap(rows);
      if (r.ok) alert(`Terkirim ${r.results?.length || rows.length} baris ke rekap (per tab bulan).`);
      else alert("Gagal kirim: " + r.error);
    } catch (e: any) {
      if (e instanceof NoRekapConfigError) alert("Fitur rekap belum aktif.\nDeploy Apps Script + set REKAP_GAS_URL & REKAP_GAS_SECRET (lihat docs/rekap-apps-script.gs).");
      else alert("Gagal: " + (e?.message || e));
    } finally { setRekapBusy(false); }
  };

  // Feedback loop: kumpulkan harga final SPPBJ per kode katalog -> Excel usulan update Riil ke RAB
  const [exporting, setExporting] = useState(false);
  const exportUsulan = async () => {
    setExporting(true);
    try {
      const list = await listRemote();
      const kat = await getKatalog();
      const byKode: Record<string, any> = {};
      kat.forEach((k) => { byKode[k.kode] = k; });
      const out: any[] = [];
      list.forEach((r: any) => {
        const p = r.payload || {};
        (p.items || []).forEach((it: any) => {
          const finalHarga = it.hargaSpbj && it.hargaSpbj > 0 ? it.hargaSpbj : 0;
          if (it.kodeKatalog && finalHarga > 0) {
            out.push({
              kode: it.kodeKatalog,
              nama: it.nama || byKode[it.kodeKatalog]?.nama || "",
              kategori: it.kategoriKatalog || byKode[it.kodeKatalog]?.kategori || "",
              satuan: it.satuan || byKode[it.kodeKatalog]?.satuan || "",
              sumberLama: it.sumberHarga || byKode[it.kodeKatalog]?.sumber || "",
              hargaHspk: byKode[it.kodeKatalog]?.harga ?? 0,
              hargaAktual: finalHarga,
              tanggal: p.tanggal || "",
              noSpbj: fullNoKontrak(p) || p.noSpbjNum || "",
              vendor: p.vendor || "",
              pengadaan: r.nama_pengadaan || p.namaPengadaan || "",
            });
          }
        });
      });
      if (!out.length) { alert("Belum ada item ber-kode katalog dengan Harga SPBJ final.\nPilih item via 📚 Katalog di form, lalu isi Harga SPBJ (Fase 2)."); return; }
      const res = await fetch("/api/sppbj/usulan-harga-export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: out }) });
      if (!res.ok) { alert("Gagal ekspor: " + res.status); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `Usulan_Harga_Riil_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click(); URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };

  const rekap = {
    total: filtered.length,
    menunggu: filtered.filter((r) => (r.status || "menunggu_spbj") === "menunggu_spbj").length,
    spbj: filtered.filter((r) => r.status === "spbj_terbit").length,
    selesai: filtered.filter((r) => r.status === "selesai").length,
  };

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex items-center gap-4">
          <div className="bg-white rounded-2xl p-2 shadow-md shrink-0"><Image src="/logo-asdp.png" alt="ASDP" width={56} height={38} className="object-contain" /></div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold asdp-text-gradient">SPPBJ Pengadaan</h1>
            <p className="text-slate-500 text-sm">Riwayat &amp; rekap pengadaan — klik untuk buka & generate dokumen</p>
          </div>
          <button onClick={mulai} className="btn btn-primary px-5 py-2.5 text-sm">＋ Mulai Pengadaan</button>
        </div>
      </div>

      {/* Rekap */}
      <section className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total" value={rekap.total} color="text-slate-800" />
        <Stat label="Menunggu SPBJ" value={rekap.menunggu} color="text-amber-600" />
        <Stat label="SPBJ Terbit" value={rekap.spbj} color="text-blue-600" />
        <Stat label="Selesai" value={rekap.selesai} color="text-green-600" />
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-slate-700">Riwayat Pengadaan</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari judul / nomor / kapal…"
              className="text-xs border px-3 py-1.5 rounded-lg bg-white pl-7 w-56 focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/20 outline-none" />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            {query && <button onClick={() => setQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs px-1">✕</button>}
          </div>
          {supabaseReady && (
            <select value={bulan} onChange={(e) => setBulan(e.target.value)}
              className="text-xs border px-2.5 py-1.5 rounded-lg bg-white">
              <option value="">Semua bulan</option>
              {bulanList.map((b) => <option key={b} value={b}>{bulanTahun(b + "-01")}</option>)}
            </select>
          )}
          <Link href="/dashboard" className="btn btn-ghost text-xs">📊 Dashboard Anggaran</Link>
          {supabaseReady && <button onClick={syncRekap} disabled={rekapBusy} className="btn btn-ghost text-xs" title="Kirim semua pengadaan (filter ini) ke spreadsheet REKAP PJK, per tab bulan">{rekapBusy ? "…" : "📊 Sync ke Rekap"}</button>}
          {supabaseReady && <button onClick={exportUsulan} disabled={exporting} className="btn btn-ghost text-xs" title="Excel usulan update harga Riil ke RAB master dari realisasi SPPBJ">{exporting ? "…" : "📤 Usulan Harga Riil"}</button>}
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
          <p className="text-slate-400 text-sm">
            {query
              ? <>Tak ada hasil untuk &quot;<b>{query}</b>&quot;. Coba kata lain atau hapus filter bulan.</>
              : <>Tak ada pengadaan di <b>{bulanTahun(bulan + "-01")}</b>. Ganti filter bulan.</>}
          </p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto bg-white rounded-2xl elev-md ring-line anim-in">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100/60 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="p-2 border-b text-center w-10">No</th>
                <th className="p-2 border-b text-left">Judul SPPBJ</th>
                <th className="p-2 border-b text-left w-44">Kapal</th>
                <th className="p-2 border-b text-left w-40">Nomor</th>
                <th className="p-2 border-b text-left w-32">Tanggal</th>
                <th className="p-2 border-b text-left w-36">Status</th>
                <th className="p-2 border-b text-center w-32">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const st = (r.status as SppbjStatus) || "menunggu_spbj";
                const nomor = r.payload?.noSPPBJ || r.payload?.noKontrak || "-";
                return (
                  <tr key={r.id} className="border-b last:border-0 row-hover cursor-pointer" onClick={() => buka(r)}>
                    <td className="p-2 text-center text-slate-400">{i + 1}</td>
                    <td className="p-2 font-medium text-slate-800">
                      <span className="flex items-center gap-2">
                        <JenisBadge payload={r.payload || {}} program={program} pengadaan={pengadaan} />
                        {r.nama_pengadaan || "(tanpa nama)"}
                      </span>
                    </td>
                    <td className="p-2"><KapalCell items={r.payload?.items || []} /></td>
                    <td className="p-2 text-slate-600">{nomor}</td>
                    <td className="p-2 text-slate-600">{r.payload?.tanggal ? tanggalIndo(r.payload.tanggal) : "-"}</td>
                    <td className="p-2"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[st] ?? STATUS_COLOR.menunggu_spbj}`}>{STATUS_LABEL[st] ?? r.status}</span></td>
                    <td className="p-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setPreview(r)} className="btn btn-ghost text-[11px] px-2.5 py-1 mr-1" title="Lihat isi dokumen tanpa membuka halaman">👁 Preview</button>
                      <button onClick={() => buka(r)} className="btn btn-primary text-[11px] px-2.5 py-1 mr-1">Buka</button>
                      <button onClick={() => hapus(r.id, r.nama_pengadaan)} className="btn btn-danger-soft text-[11px] px-2.5 py-1">Hapus</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {preview && (
        <PreviewModal jenis="SPPBJ" payload={preview.payload} onTutup={() => setPreview(null)}
          onBuka={() => { const r = preview; setPreview(null); buka(r); }} />
      )}
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl ring-line elev-sm p-4 card-hover border border-transparent">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</p>
      <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}
