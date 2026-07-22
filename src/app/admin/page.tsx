"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { tanggalIndo, bulanTahun } from "@/lib/format";

const LABEL: Record<string, string> = {
  sppbj: "SPPBJ Pengadaan", nonpr: "SPPBJ Non PR PO", servis: "Monitoring Servis",
  anggaran: "Dashboard Anggaran", kapal: "Ship Database", swakelola: "Generator Swakelola", material: "Kode Material",
};
const IKON: Record<string, string> = { sppbj: "📑", nonpr: "🧾", servis: "🔧", anggaran: "📊", kapal: "🚢", swakelola: "⚙️", material: "📦" };
const HREF: Record<string, string> = { sppbj: "/sppbj", nonpr: "/nonpr", servis: "/servis", anggaran: "/dashboard", kapal: "/kapal", swakelola: "/", material: "/material" };

// kuota paket gratis Supabase (acuan kasar untuk peringatan dini)
const KUOTA_DB = 500 * 1024 * 1024;      // 500 MB database
const KUOTA_STORAGE = 1024 * 1024 * 1024; // 1 GB storage

const ukuran = (b: number) => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${(b / 1024).toFixed(0)} KB` : `${b} B`;

export default function AdminPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [galat, setGalat] = useState("");
  const [berkas, setBerkas] = useState<{ jumlah: number; bytes: number; gagal: number } | null>(null);
  const [cekBerkas, setCekBerkas] = useState(false);

  const muat = useCallback(async () => {
    if (!supabase) return;
    setLoading(true); setGalat("");
    try {
      const { data, error } = await supabase.from("projects").select("id,nama_kapal,tahun,payload,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      setRows(data || []);
    } catch (e: any) { setGalat(e.message || String(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const stat = useMemo(() => {
    const perJenis: Record<string, { n: number; bytes: number }> = {};
    const perBulan: Record<string, number> = {};
    let bytes = 0;
    const urls = new Set<string>();
    for (const r of rows) {
      const kind = r.payload?.kind || "swakelola";
      const b = JSON.stringify(r).length;
      bytes += b;
      perJenis[kind] = { n: (perJenis[kind]?.n || 0) + 1, bytes: (perJenis[kind]?.bytes || 0) + b };
      const bln = (r.payload?.tanggal || r.created_at || "").slice(0, 7);
      if (bln) perBulan[bln] = (perBulan[bln] || 0) + 1;
      for (const u of JSON.stringify(r).match(/https?:\/\/[^"\\\s]+\/storage\/v1\/object\/public\/[^"\\\s]+/g) || []) urls.add(u);
    }
    // pemeriksaan kesehatan data
    const masalah: { teks: string; jml: number; berat: boolean }[] = [];
    const tanpaKind = rows.filter((r) => !r.payload?.kind).length;
    const tanpaNama = rows.filter((r) => !(r.nama_kapal || "").trim()).length;
    const tanpaTanggal = rows.filter((r) => ["sppbj", "nonpr"].includes(r.payload?.kind) && !r.payload?.tanggal).length;
    const kosongItem = rows.filter((r) => ["sppbj", "nonpr"].includes(r.payload?.kind) && !(r.payload?.items || []).length).length;
    const nama = rows.map((r) => (r.nama_kapal || "").trim().toLowerCase()).filter(Boolean);
    const kembar = nama.filter((n, i) => nama.indexOf(n) !== i).length;
    if (tanpaKind) masalah.push({ teks: "data tanpa penanda jenis (kind) — dianggap Swakelola", jml: tanpaKind, berat: false });
    if (tanpaNama) masalah.push({ teks: "data tanpa nama", jml: tanpaNama, berat: false });
    if (tanpaTanggal) masalah.push({ teks: "pengadaan tanpa tanggal — tak terhitung di Dashboard Anggaran", jml: tanpaTanggal, berat: true });
    if (kosongItem) masalah.push({ teks: "pengadaan tanpa item sama sekali (kemungkinan draf)", jml: kosongItem, berat: false });
    if (kembar) masalah.push({ teks: "nama pengadaan kembar (cek jangan sampai dobel input)", jml: kembar, berat: false });

    const bulanUrut = Object.entries(perBulan).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
    return { perJenis, bytes, urls: Array.from(urls), masalah, bulanUrut };
  }, [rows]);

  // ukuran berkas Storage — HEAD ke tiap URL publik (dipicu manual, bisa banyak permintaan)
  const hitungBerkas = async () => {
    setCekBerkas(true);
    let bytesTotal = 0, ok = 0, gagal = 0;
    for (const u of stat.urls) {
      try {
        const r = await fetch(u, { method: "HEAD" });
        const n = parseInt(r.headers.get("content-length") || "0", 10);
        if (r.ok) { bytesTotal += n; ok++; } else gagal++;
      } catch { gagal++; }
    }
    setBerkas({ jumlah: ok, bytes: bytesTotal, gagal });
    setCekBerkas(false);
  };

  const pctDb = Math.min(100, (stat.bytes / KUOTA_DB) * 100);
  const pctSt = berkas ? Math.min(100, (berkas.bytes / KUOTA_STORAGE) * 100) : 0;
  const maxBulan = Math.max(1, ...stat.bulanUrut.map(([, n]) => n));

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-5 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[16rem]">
            <Link href="/" className="text-xs text-slate-500 hover:text-[#16357f]">‹ Beranda</Link>
            <h1 className="text-2xl font-extrabold asdp-text-gradient mt-1">Panel Admin</h1>
            <p className="text-slate-600 text-sm">Isi database Supabase, pemakaian kuota, dan pemeriksaan kesehatan data.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={muat} className="btn btn-ghost text-xs">{loading ? "…" : "↻ Muat ulang"}</button>
            <Link href="/backup" className="btn btn-primary text-xs">🛡️ Backup Data</Link>
          </div>
        </div>
      </div>

      {!isSupabaseReady ? (
        <p className="mt-5 text-sm text-amber-800 bg-amber-50 ring-1 ring-amber-300 rounded-xl p-4">Supabase belum dikonfigurasi (env). Tak ada data untuk ditampilkan.</p>
      ) : galat ? (
        <p className="mt-5 text-sm text-red-800 bg-red-50 ring-1 ring-red-300 rounded-xl p-4">Gagal membaca database: {galat}</p>
      ) : (
        <>
          {/* ringkasan */}
          <section className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kotak label="Total Data" nilai={String(rows.length)} sub="baris tabel projects" bar="bg-[#16357f]" />
            <Kotak label="Ukuran Data" nilai={ukuran(stat.bytes)} sub={`${pctDb.toFixed(1)}% dari 500 MB`} bar="bg-cyan-600" />
            <Kotak label="Berkas Terlampir" nilai={berkas ? String(berkas.jumlah) : String(stat.urls.length)} sub={berkas ? ukuran(berkas.bytes) : "foto & inventaris"} bar="bg-violet-600" />
            <Kotak label="Data Terbaru" nilai={rows[0]?.created_at ? tanggalIndo(rows[0].created_at.slice(0, 10)) : "—"} sub={rows[0]?.nama_kapal || "—"} bar="bg-emerald-600" />
          </section>

          {/* kuota */}
          <section className="mt-5 bg-white rounded-2xl elev-md ring-line p-5">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-bold text-slate-800">Pemakaian kuota</h2>
              <span className="text-[11px] text-slate-500">acuan paket gratis Supabase</span>
              <button onClick={hitungBerkas} disabled={cekBerkas || !stat.urls.length} className="btn btn-ghost text-xs ml-auto disabled:opacity-50">
                {cekBerkas ? "menghitung…" : berkas ? "↻ Hitung ulang berkas" : `📐 Hitung ukuran ${stat.urls.length} berkas`}
              </button>
            </div>
            <Bar label="Database (baris + isi JSON)" pakai={ukuran(stat.bytes)} dari="500 MB" pct={pctDb} warna="bg-gradient-to-r from-[#14b8c4] to-[#16357f]" />
            <div className="h-3" />
            <Bar label="Storage (foto & lampiran)" pakai={berkas ? ukuran(berkas.bytes) : "belum dihitung"} dari="1 GB" pct={pctSt} warna="bg-gradient-to-r from-violet-500 to-violet-800" />
            {berkas && berkas.gagal > 0 && <p className="text-[11px] text-amber-700 mt-2">{berkas.gagal} berkas tak terbaca (mungkin sudah terhapus di Storage tapi tautannya masih tersimpan).</p>}
          </section>

          {/* per jenis */}
          <section className="mt-5 bg-white rounded-2xl elev-md ring-line p-5">
            <h2 className="font-bold text-slate-800 mb-3">Rincian per jenis data</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600 font-bold border-b-2 border-slate-200">
                  <tr><th className="p-2 text-left">Jenis</th><th className="p-2 text-right w-24">Jumlah</th><th className="p-2 text-right w-28">Ukuran</th><th className="p-2 text-right w-40">Porsi</th><th className="p-2 w-24"></th></tr>
                </thead>
                <tbody>
                  {Object.entries(stat.perJenis).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => (
                    <tr key={k} className="border-b border-slate-200 even:bg-slate-50/60">
                      <td className="p-2 font-semibold text-slate-800">{IKON[k] || "📄"} {LABEL[k] || k}</td>
                      <td className="p-2 text-right tabular-nums font-bold text-slate-900">{v.n}</td>
                      <td className="p-2 text-right tabular-nums text-slate-700">{ukuran(v.bytes)}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2.5 rounded-full bg-slate-200 ring-1 ring-inset ring-slate-300/60 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#14b8c4] to-[#16357f]" style={{ width: `${Math.max(4, (v.bytes / Math.max(1, stat.bytes)) * 100)}%` }} />
                          </div>
                          <span className="text-xs font-bold tabular-nums w-10 text-right text-slate-700">{Math.round((v.bytes / Math.max(1, stat.bytes)) * 100)}%</span>
                        </div>
                      </td>
                      <td className="p-2 text-right">{HREF[k] && <Link href={HREF[k]} className="text-xs font-semibold text-[#16357f] hover:underline">buka →</Link>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
                    <td className="p-2">TOTAL</td>
                    <td className="p-2 text-right tabular-nums">{rows.length}</td>
                    <td className="p-2 text-right tabular-nums">{ukuran(stat.bytes)}</td>
                    <td className="p-2 text-right tabular-nums">100%</td><td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* pertumbuhan + kesehatan */}
          <div className="mt-5 grid md:grid-cols-2 gap-5">
            <section className="bg-white rounded-2xl elev-md ring-line p-5">
              <h2 className="font-bold text-slate-800 mb-3">Data masuk per bulan</h2>
              {stat.bulanUrut.length === 0 ? <p className="text-sm text-slate-500">Belum ada data.</p> : (
                <div className="space-y-1.5">
                  {stat.bulanUrut.map(([b, n]) => (
                    <div key={b} className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0 text-slate-700 font-medium">{bulanTahun(b + "-01")}</span>
                      <div className="flex-1 h-3 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#14b8c4] to-[#16357f]" style={{ width: `${(n / maxBulan) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right font-bold tabular-nums text-slate-800">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl elev-md ring-line p-5">
              <h2 className="font-bold text-slate-800 mb-3">Pemeriksaan data</h2>
              {stat.masalah.length === 0 ? (
                <p className="text-sm text-emerald-800 bg-emerald-50 ring-1 ring-emerald-300 rounded-xl p-3">✅ Tidak ada temuan. Semua data lengkap.</p>
              ) : (
                <ul className="space-y-2">
                  {stat.masalah.map((m, i) => (
                    <li key={i} className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 ring-1 ${m.berat ? "bg-amber-50 ring-amber-300 text-amber-900" : "bg-slate-50 ring-slate-200 text-slate-700"}`}>
                      <span className="font-extrabold tabular-nums text-sm">{m.jml}</span>
                      <span>{m.teks}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* terbaru */}
          <section className="mt-5 bg-white rounded-2xl elev-md ring-line p-5">
            <h2 className="font-bold text-slate-800 mb-3">15 data terakhir masuk</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600 font-bold border-b-2 border-slate-200">
                  <tr><th className="p-2 text-left w-36">Jenis</th><th className="p-2 text-left">Nama</th><th className="p-2 text-left w-32">Dibuat</th><th className="p-2 text-right w-24">Ukuran</th></tr>
                </thead>
                <tbody>
                  {rows.slice(0, 15).map((r) => {
                    const k = r.payload?.kind || "swakelola";
                    return (
                      <tr key={r.id} className="border-b border-slate-200 even:bg-slate-50/60">
                        <td className="p-2"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">{IKON[k]} {LABEL[k] || k}</span></td>
                        <td className="p-2 text-slate-800 font-medium">{r.nama_kapal || <span className="italic text-slate-400">(tanpa nama)</span>}</td>
                        <td className="p-2 text-slate-600">{r.created_at ? tanggalIndo(r.created_at.slice(0, 10)) : "—"}</td>
                        <td className="p-2 text-right tabular-nums text-slate-600">{ukuran(JSON.stringify(r).length)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Kotak({ label, nilai, sub, bar }: { label: string; nilai: string; sub: string; bar: string }) {
  return (
    <div className="relative bg-white rounded-2xl ring-1 ring-slate-200 elev-sm pl-4 pr-3 py-3 overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${bar}`} />
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold">{label}</p>
      <p className="text-xl font-extrabold tabular-nums text-slate-900 leading-tight">{nilai}</p>
      <p className="text-[10px] text-slate-500 mt-0.5 truncate">{sub}</p>
    </div>
  );
}

function Bar({ label, pakai, dari, pct, warna }: { label: string; pakai: string; dari: string; pct: number; warna: string }) {
  const bahaya = pct >= 80;
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <span className="text-xs tabular-nums text-slate-600 ml-auto"><b className={bahaya ? "text-red-700" : "text-slate-900"}>{pakai}</b> / {dari}</span>
        <span className={`text-xs font-bold tabular-nums w-12 text-right ${bahaya ? "text-red-700" : "text-slate-700"}`}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-3 rounded-full bg-slate-200 ring-1 ring-inset ring-slate-300/60 overflow-hidden">
        <div className={`h-full rounded-full ${bahaya ? "bg-red-500" : warna}`} style={{ width: `${Math.max(0.6, pct)}%` }} />
      </div>
    </div>
  );
}
