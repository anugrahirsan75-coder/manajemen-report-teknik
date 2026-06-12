"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { saveAs } from "file-saver";
import { useServis } from "@/lib/servis/store";
import { ServisItem, ServisStatus, SERVIS_STATUS_LABEL, SERVIS_STATUS_COLOR, newServisItem, lamaHari, telatHari } from "@/lib/servis/types";
import { KAPAL_LIST_NONPR } from "@/lib/nonpr/db";
import { tanggalIndo, rupiah, bulanTahun } from "@/lib/format";

export default function ServisList() {
  const { items, loading, refresh, deleteItem, setEditing, supabaseReady } = useServis();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fKapal, setFKapal] = useState("");
  const [fBulan, setFBulan] = useState("");
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<{ fotos: string[]; i: number } | null>(null);

  const bulanList = useMemo(() =>
    Array.from(new Set(items.map((i) => (i.tanggalKirim || "").slice(0, 7)).filter(Boolean))).sort().reverse(), [items]);

  const filtered = useMemo(() => items.filter((it) => {
    if (fStatus && it.status !== fStatus) return false;
    if (fKapal && it.kapal !== fKapal) return false;
    if (fBulan && (it.tanggalKirim || "").slice(0, 7) !== fBulan) return false;
    if (q) {
      const s = `${it.namaBarang} ${it.jenis} ${it.kapal} ${it.bengkel} ${it.kerusakan}`.toLowerCase();
      if (!s.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [items, q, fStatus, fKapal, fBulan]);

  const rekap = {
    total: filtered.length,
    bengkel: filtered.filter((i) => i.status === "di_bengkel").length,
    selesai: filtered.filter((i) => i.status === "selesai").length,
    kembali: filtered.filter((i) => i.status === "kembali").length,
    biaya: filtered.reduce((s, i) => s + (i.biaya || 0), 0),
  };

  const tambah = () => { setEditing(newServisItem()); router.push("/servis/isi"); };
  const edit = (it: ServisItem) => { setEditing(it); router.push("/servis/isi"); };
  const hapus = async (it: ServisItem) => { if (!confirm(`Hapus "${it.namaBarang}"?`)) return; await deleteItem(it.id); };

  const exportExcel = async () => {
    if (!filtered.length) { alert("Tidak ada data untuk diekspor."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/servis/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: filtered }),
      });
      if (!res.ok) { let m = res.statusText; try { m = (await res.json()).error ?? m; } catch {} throw new Error(m); }
      const blob = await res.blob();
      saveAs(blob, `Monitoring Servis Bengkel ${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) { alert("Gagal export: " + (e?.message ?? e)); } finally { setBusy(false); }
  };

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex items-center gap-4">
          <div className="bg-white rounded-2xl p-2.5 elev-md shrink-0 ring-1 ring-black/5"><Image src="/logo-asdp.png" alt="ASDP" width={56} height={38} className="object-contain" /></div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold asdp-text-gradient tracking-tight">Monitoring Servis Bengkel</h1>
            <p className="text-slate-500 text-sm">Tracking barang kapal yang diservis — alternator, pompa, dinamo, dll.</p>
          </div>
          <button onClick={tambah} className="btn btn-primary px-5 py-2.5 text-sm">＋ Input Barang</button>
        </div>
      </div>

      <section className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3 stagger">
        <Stat label="Total" value={String(rekap.total)} icon="📦" tint="slate" />
        <Stat label="Di Bengkel" value={String(rekap.bengkel)} icon="🔧" tint="amber" />
        <Stat label="Siap Diambil" value={String(rekap.selesai)} icon="✅" tint="blue" />
        <Stat label="Sudah Kembali" value={String(rekap.kembali)} icon="🚢" tint="green" />
        <Stat label="Total Biaya" value={rupiah(rekap.biaya)} icon="💰" tint="slate" small />
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 cari barang/bengkel…"
          className="text-xs border px-3 py-1.5 rounded-lg w-44" />
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="text-xs border px-2.5 py-1.5 rounded-lg bg-white">
          <option value="">Semua status</option>
          {(Object.keys(SERVIS_STATUS_LABEL) as ServisStatus[]).map((s) => <option key={s} value={s}>{SERVIS_STATUS_LABEL[s]}</option>)}
        </select>
        <select value={fKapal} onChange={(e) => setFKapal(e.target.value)} className="text-xs border px-2.5 py-1.5 rounded-lg bg-white">
          <option value="">Semua kapal</option>
          {KAPAL_LIST_NONPR.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={fBulan} onChange={(e) => setFBulan(e.target.value)} className="text-xs border px-2.5 py-1.5 rounded-lg bg-white">
          <option value="">Semua bulan</option>
          {bulanList.map((b) => <option key={b} value={b}>{bulanTahun(b + "-01")}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button onClick={refresh} className="btn btn-ghost text-xs">↻ Refresh</button>
          <button onClick={exportExcel} disabled={busy} className="btn btn-success text-xs">
            {busy ? "Menyiapkan…" : "📊 Export Excel"}
          </button>
        </div>
      </div>

      {!supabaseReady && <p className="mt-2 text-xs text-amber-600">Supabase tak aktif — data tersimpan lokal di browser ini.</p>}

      {loading ? (
        <p className="mt-3 text-sm text-slate-400">Memuat…</p>
      ) : filtered.length === 0 ? (
        <div className="mt-3 text-center bg-white rounded-2xl border border-slate-100 p-8">
          <p className="text-slate-400 text-sm">{items.length === 0 ? <>Belum ada barang. Klik <b>＋ Input Barang</b>.</> : "Tak ada barang cocok filter."}</p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto bg-white rounded-2xl elev-md ring-line anim-in">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100/60 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="p-2 border-b text-center w-9">No</th>
                <th className="p-2 border-b text-left">Barang</th>
                <th className="p-2 border-b text-left w-36">Kapal</th>
                <th className="p-2 border-b text-left w-36">Bengkel</th>
                <th className="p-2 border-b text-left w-28">Tgl Kirim</th>
                <th className="p-2 border-b text-center w-20">Lama</th>
                <th className="p-2 border-b text-left w-36">Status</th>
                <th className="p-2 border-b text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it, i) => {
                const telat = telatHari(it);
                return (
                  <tr key={it.id} className="border-b last:border-0 row-hover cursor-pointer" onClick={() => edit(it)}>
                    <td className="p-2 text-center text-slate-400">{i + 1}</td>
                    <td className="p-2">
                      <p className="font-medium text-slate-800 flex items-center gap-1.5">
                        {it.namaBarang || "(tanpa nama)"}
                        {!!it.foto?.length && (
                          <button title={`Lihat ${it.foto.length} foto`} onClick={(e) => { e.stopPropagation(); setLightbox({ fotos: it.foto!, i: 0 }); }}
                            className="text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded hover:bg-sky-200">📷 {it.foto.length}</button>
                        )}
                      </p>
                      {it.jenis && <p className="text-[11px] text-slate-400">{it.jenis}</p>}
                    </td>
                    <td className="p-2 text-slate-600">{it.kapal || "-"}</td>
                    <td className="p-2 text-slate-600">{it.bengkel || "-"}</td>
                    <td className="p-2 text-slate-600">{it.tanggalKirim ? tanggalIndo(it.tanggalKirim) : "-"}</td>
                    <td className="p-2 text-center text-slate-600">{lamaHari(it)} hr</td>
                    <td className="p-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SERVIS_STATUS_COLOR[it.status]}`}>{SERVIS_STATUS_LABEL[it.status]}</span>
                      {telat > 0 && <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">telat {telat} hr</span>}
                    </td>
                    <td className="p-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => edit(it)} className="btn btn-primary text-[11px] px-2.5 py-1 mr-1">Edit</button>
                      <button onClick={() => hapus(it)} className="btn btn-danger-soft text-[11px] px-2.5 py-1">Hapus</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-5 text-white text-3xl leading-none">✕</button>
          <img src={lightbox.fotos[lightbox.i]} alt="foto" className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          {lightbox.fotos.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, i: (lightbox.i - 1 + lightbox.fotos.length) % lightbox.fotos.length }); }}
                className="absolute left-4 text-white text-4xl px-3 py-1 bg-white/10 rounded-full hover:bg-white/20">‹</button>
              <button onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, i: (lightbox.i + 1) % lightbox.fotos.length }); }}
                className="absolute right-4 text-white text-4xl px-3 py-1 bg-white/10 rounded-full hover:bg-white/20">›</button>
              <span className="absolute bottom-5 text-white text-sm bg-black/50 px-3 py-1 rounded-full">{lightbox.i + 1} / {lightbox.fotos.length}</span>
            </>
          )}
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, icon, tint, small }: { label: string; value: string; icon: string; tint: "slate" | "amber" | "blue" | "green"; small?: boolean }) {
  const T = {
    slate: { v: "text-slate-800", chip: "bg-slate-100 text-slate-600" },
    amber: { v: "text-amber-600", chip: "bg-amber-100 text-amber-600" },
    blue: { v: "text-blue-600", chip: "bg-blue-100 text-blue-600" },
    green: { v: "text-green-600", chip: "bg-green-100 text-green-600" },
  }[tint];
  return (
    <div className="bg-white rounded-2xl ring-line elev-sm p-4 card-hover border border-transparent">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 font-bold">{label}</p>
        <span className={`grid place-items-center h-7 w-7 rounded-lg text-sm ${T.chip}`}>{icon}</span>
      </div>
      <p className={`${small ? "text-base mt-1.5" : "text-2xl mt-1"} font-extrabold ${T.v}`}>{value}</p>
    </div>
  );
}
