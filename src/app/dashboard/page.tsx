"use client";

import { useMemo, useState, useCallback, Fragment, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAnggaran, PengadaanRow, realisasiRutin, realisasiRutinKapal, realisasiDocking, nilaiPerMA, type RealisasiKapal } from "@/lib/anggaran/store";
import {
  MATA_ANGGARAN, kategoriPengadaan, kodeMA, KAPAL_ANGGARAN, DOCKING_MA_INVESTASI, isMaInvestasi, rupiahShort,
  namaKapalPenuh, RKA, PlafonRutin, PlafonDocking, PlafonRow, maKey, fullMA, DOCKING_MA,
} from "@/lib/anggaran/types";
import { rupiah, bulanTahun, tanggalIndo } from "@/lib/format";
import { ringkasKapal } from "@/lib/kapal/nama";
import ProgramLainnya from "@/components/anggaran/ProgramLainnya";
import Ringkasan from "@/components/anggaran/Ringkasan";
import { exportTipeExcel } from "@/lib/anggaran/exportTipe";
import PreviewModal from "@/components/PreviewModal";

const JUDUL: Record<string, string> = {
  ringkas: "Dashboard Anggaran", rutin: "Kendali Anggaran Rutin", docking: "Kendali Anggaran Docking",
  lainnya: "Persetujuan Biaya Lainnya", rincian: "Rincian & RKA",
};
const SUB: Record<string, string> = {
  ringkas: "Ringkasan seluruh sumber anggaran — klik kartu untuk masuk ke detailnya",
  rutin: "Persetujuan Rutin per BULAN · pagu per Mata Anggaran",
  docking: "Persetujuan Pusat per KAPAL · pagu per Mata Anggaran docking",
  lainnya: "Persetujuan Pusat per SURAT — di luar Rutin & Docking",
  rincian: "Penyerapan per Mata Anggaran & kapal, RKA, Rencana vs Realisasi",
};
const NAV = [
  { v: "ringkas", label: "Ringkasan", ikon: "📊", aktif: "bg-[#16357f] text-white border-[#16357f]" },
  { v: "rutin", label: "Rutin", ikon: "🧭", aktif: "bg-[#16357f] text-white border-[#16357f]" },
  { v: "docking", label: "Docking", ikon: "⚓", aktif: "bg-orange-700 text-white border-orange-700" },
  { v: "lainnya", label: "Lainnya", ikon: "📜", aktif: "bg-indigo-700 text-white border-indigo-700" },
  { v: "rincian", label: "Rincian & RKA", ikon: "🏷️", aktif: "bg-slate-800 text-white border-slate-800" },
];

const estPengadaan = (r: PengadaanRow) => (r.items || []).reduce((s, it: any) => s + (it.harga || 0) * (it.jumlah || 0), 0);

function DashboardInner() {
  const qs = useSearchParams();
  const v = (qs.get("v") || "ringkas") as "ringkas" | "rutin" | "docking" | "lainnya" | "rincian";
  const { ready, loading, pengadaan, rka, plafon, docking, program, reload, saveRka, savePlafon, saveDocking, saveProgram } = useAnggaran();
  const [tahun, setTahun] = useState<string>("");
  const [xlsBusy, setXlsBusy] = useState(false);
  // Export Excel PER TIPE (berjenjang + tautan antar sheet)
  const unduhExcel = async (tipe: "rutin" | "docking" | "lainnya") => {
    setXlsBusy(true);
    try {
      await exportTipeExcel({
        tipe, plafon, docking, program, pengadaan,
        bulan: new Date().toISOString().slice(0, 7),
        tahun: parseInt(tahun || String(new Date().getFullYear()), 10),
      });
    } catch (e: any) { alert("Gagal export: " + (e?.message ?? e)); }
    finally { setXlsBusy(false); }
  };

  const tahunList = useMemo(() => Array.from(new Set(pengadaan.map((r) => (r.tanggal || "").slice(0, 4)).filter(Boolean))).sort().reverse(), [pengadaan]);
  const data = useMemo(() => (tahun ? pengadaan.filter((r) => (r.tanggal || "").startsWith(tahun)) : pengadaan), [pengadaan, tahun]);

  const a = useMemo(() => {
    let biaya = 0, investasi = 0;
    const perMA: Record<string, number> = {};
    const perKapal: Record<string, { Biaya: number; Investasi: number }> = {};
    for (const r of data) {
      const est = estPengadaan(r);
      const kat = kategoriPengadaan(r.mataAnggaran, r.nama);
      if (kat === "Investasi") investasi += est; else biaya += est;
      // per mata anggaran — pakai MA tiap ITEM (kosong = ikut MA pertama pengadaan)
      for (const [ma, v] of Object.entries(nilaiPerMA(r, undefined, false))) {
        const c = kodeMA(ma);
        perMA[c] = (perMA[c] || 0) + v;
      }
      // per kapal (item-level)
      for (const it of r.items || []) {
        const kp = namaKapalPenuh(it.kapal || "");
        if (!kp) continue;
        const v = (it.harga || 0) * (it.jumlah || 0);
        const slot = (perKapal[kp] = perKapal[kp] || { Biaya: 0, Investasi: 0 });
        slot[kat] += v;
      }
    }
    return { biaya, investasi, total: biaya + investasi, n: data.length, perMA, perKapal };
  }, [data]);

  const rkaTotal = Object.values(rka.nilai || {}).reduce((s, v) => s + (v || 0), 0);
  const serapPct = rkaTotal ? Math.round((a.total / rkaTotal) * 100) : 0;

  // rincian pengadaan per kode Mata Anggaran (utk klik-baris di RKA & Penyerapan per MA)
  const detailMA = useMemo(() => {
    const by: Record<string, { id: string; nama: string; nilai: number; sumber: string; tanggal: string; raw?: any }[]> = {};
    for (const r of data) {
      for (const [ma, v] of Object.entries(nilaiPerMA(r, undefined, false))) {
        const c = kodeMA(ma);
        if (!c || v <= 0) continue;
        (by[c] ||= []).push({ id: r.id, nama: r.nama, nilai: v, sumber: r.sumber, tanggal: r.tanggal, raw: r.raw });
      }
    }
    Object.values(by).forEach((l) => l.sort((x, y) => y.nilai - x.nilai));
    return by;
  }, [data]);

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex flex-wrap items-center gap-4">
          <div className="h-12 w-12 rounded-2xl asdp-gradient grid place-items-center text-2xl text-white shadow-md shrink-0">📊</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold asdp-text-gradient tracking-tight">{JUDUL[v]}</h1>
            <p className="text-slate-500 text-sm">{SUB[v]}</p>
          </div>
          <select value={tahun} onChange={(e) => setTahun(e.target.value)} className="text-xs border px-2.5 py-1.5 rounded-lg bg-white">
            <option value="">Semua tahun</option>
            {tahunList.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {/* Di tampilan Rutin/Docking/Lainnya tombolnya ada di dalam kartu masing-masing (dekat Export PDF) */}
          {(v === "ringkas" || v === "rincian") && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 font-semibold">{xlsBusy ? "menyiapkan…" : "Export Excel:"}</span>
              {([["rutin", "Rutin"], ["docking", "Docking"], ["lainnya", "Lainnya"]] as const).map(([t, l]) => (
                <button key={t} onClick={() => unduhExcel(t)} disabled={xlsBusy}
                  className="btn btn-ghost text-xs disabled:opacity-50" title={`Unduh Excel ${l} — berjenjang sampai item pengadaan`}>
                  📊 {l}
                </button>
              ))}
            </div>
          )}
          <button onClick={reload} className="btn btn-ghost text-xs">↻ Muat ulang</button>
        </div>
      </div>

      {/* navigasi antar tampilan */}
      <nav className="mt-4 flex flex-wrap items-center gap-1.5">
        {NAV.map((n) => (
          <Link key={n.v} href={n.v === "ringkas" ? "/dashboard" : `/dashboard?v=${n.v}`}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${v === n.v ? n.aktif : "bg-white border-slate-300 text-slate-600 hover:border-[#1ca3dd] hover:text-[#16357f]"}`}>
            {n.ikon} {n.label}
          </Link>
        ))}
      </nav>

      {!ready ? (
        <p className="mt-5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">Dashboard butuh Supabase (env) untuk membaca data pengadaan.</p>
      ) : loading ? (
        <p className="mt-5 text-sm text-slate-500">Memuat…</p>
      ) : (
        <>
          {v === "ringkas" && <Ringkasan plafon={plafon} docking={docking} program={program} pengadaan={pengadaan} />}

          {v === "rutin" && <AnggaranRutin plafon={plafon} pengadaan={pengadaan} onSave={savePlafon} onExcel={() => unduhExcel("rutin")} xlsBusy={xlsBusy} />}

          {v === "docking" && <AnggaranDocking docking={docking} pengadaan={pengadaan} onSave={saveDocking} onExcel={() => unduhExcel("docking")} xlsBusy={xlsBusy} />}

          {v === "lainnya" && (
            <Card tone="indigo" icon="📜" badge="Di luar Docking & Rutin" title="Persetujuan Biaya Lainnya"
              sub="Persetujuan Pusat per SURAT — investasi/pekerjaan khusus, pagu per kapal & Mata Anggaran">
              <ProgramLainnya program={program} pengadaan={pengadaan} onSave={saveProgram} onExcel={() => unduhExcel("lainnya")} xlsBusy={xlsBusy} />
            </Card>
          )}

          {v === "rincian" && (
            <>
              <section className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
                <Kpi label="Total Penyerapan" value={rupiah(a.total)} sub={`${a.n} pengadaan`} icon="💰" tint="blue" />
                <Kpi label="Penyerapan Biaya" value={rupiah(a.biaya)} sub="mata anggaran 501x" icon="🛠️" tint="teal" />
                <Kpi label="Penyerapan Investasi" value={rupiah(a.investasi)} sub="mata anggaran 10206x" icon="📈" tint="indigo" />
                <Kpi label="RKA (acuan)" value={rupiah(rkaTotal)} sub={rkaTotal ? `terserap ${serapPct}%` : "belum diisi"} icon="🎯" tint="green" />
              </section>
              <RkaSection rka={rka} perMA={a.perMA} detail={detailMA} onSave={saveRka} />
              <Card title="Penyerapan per Mata Anggaran (Biaya & Investasi)" icon="🏷️">
                <MaTable perMA={a.perMA} detail={detailMA} />
              </Card>
              <Card title="Penyerapan per Kapal" icon="🚢">
                <KapalTable perKapal={a.perKapal} />
              </Card>
              <Card title="Rencana &amp; Realisasi Perawatan (Lampiran 3)" icon="📆">
                <p className="text-sm text-slate-600">
                  Pengisian rencana &amp; realisasi bulanan kini punya halaman sendiri — bentuknya mengikuti
                  Lampiran 3 (per kapal, per Mata Anggaran, sampai item) lengkap dengan pengingat tenggat
                  (rencana batas tanggal 22, realisasi batas tanggal 1 bulan berikutnya).
                </p>
                <a href="/rencana" className="btn btn-primary text-xs mt-3">Buka Rencana &amp; Realisasi →</a>
              </Card>
            </>
          )}
        </>
      )}
    </main>
  );
}

export default function DashboardAnggaran() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Memuat dashboard…</p>}>
      <DashboardInner />
    </Suspense>
  );
}

/* ---------- KPI & Card ---------- */
function Kpi({ label, value, sub, icon, tint }: { label: string; value: string; sub: string; icon: string; tint: string }) {
  const T: Record<string, string> = { blue: "bg-blue-100 text-blue-600", teal: "bg-cyan-100 text-cyan-600", indigo: "bg-indigo-100 text-indigo-600", green: "bg-green-100 text-green-600" };
  return (
    <div className="bg-white rounded-2xl ring-line elev-sm p-4 card-hover border border-transparent">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold">{label}</p>
        <span className={`grid place-items-center h-7 w-7 rounded-lg text-sm ${T[tint]}`}>{icon}</span>
      </div>
      <p className="text-lg font-extrabold tabular-nums text-slate-900 mt-1.5 leading-tight">{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}
/* Identitas warna kartu — biar Rutin (biru, bulanan) & Docking (amber, per kapal) tak tertukar */
type Nada = "biru" | "amber" | "indigo";
const NADA: Record<Nada, {
  strip: string; ikon: string; judul: string; badge: string; kartu: string;
  head: string; bar: string; pilihAktif: string; pilihPasif: string;
}> = {
  biru: {
    strip: "bg-gradient-to-r from-[#14b8c4] via-[#1ca3dd] to-[#16357f]",
    ikon: "asdp-gradient text-white",
    judul: "text-[#16357f]",
    badge: "bg-sky-100 text-sky-800 ring-1 ring-sky-300",
    kartu: "bg-white ring-1 ring-slate-200",
    head: "bg-sky-50 text-sky-900 border-sky-200",
    bar: "bg-gradient-to-r from-[#14b8c4] to-[#16357f]",
    pilihAktif: "bg-[#16357f] text-white border-[#16357f]",
    pilihPasif: "bg-white border-slate-300 text-slate-600 hover:border-[#1ca3dd] hover:text-[#16357f]",
  },
  amber: {
    strip: "bg-gradient-to-r from-amber-400 via-orange-500 to-amber-700",
    ikon: "bg-gradient-to-br from-amber-500 to-orange-700 text-white",
    judul: "text-orange-900",
    badge: "bg-amber-100 text-amber-900 ring-1 ring-amber-400",
    kartu: "bg-amber-50 ring-1 ring-amber-200",
    head: "bg-amber-100/70 text-amber-900 border-amber-300",
    bar: "bg-gradient-to-r from-amber-500 to-orange-700",
    pilihAktif: "bg-orange-700 text-white border-orange-700",
    pilihPasif: "bg-white border-amber-300 text-amber-800 hover:border-orange-500 hover:text-orange-800",
  },
  indigo: {
    strip: "bg-gradient-to-r from-indigo-400 via-indigo-600 to-violet-800",
    ikon: "bg-gradient-to-br from-indigo-500 to-violet-700 text-white",
    judul: "text-indigo-900",
    badge: "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-400",
    kartu: "bg-indigo-50 ring-1 ring-indigo-200",
    head: "bg-indigo-100/70 text-indigo-900 border-indigo-300",
    bar: "bg-gradient-to-r from-indigo-500 to-violet-700",
    pilihAktif: "bg-indigo-700 text-white border-indigo-700",
    pilihPasif: "bg-white border-indigo-300 text-indigo-800 hover:border-indigo-500",
  },
};

function Card({ title, icon, children, tone = "biru", badge, sub }: {
  title: string; icon: string; children: React.ReactNode; tone?: Nada; badge?: string; sub?: string;
}) {
  const n = NADA[tone];
  return (
    <div className={`mt-5 rounded-2xl elev-md p-5 pt-4 anim-in overflow-hidden relative ${n.kartu}`}>
      <span className={`absolute inset-x-0 top-0 h-1.5 ${n.strip}`} />
      <h3 className="flex items-center gap-2.5 mb-4 mt-1.5">
        <span className={`h-9 w-9 rounded-xl grid place-items-center text-base shrink-0 ${n.ikon}`}>{icon}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className={`font-extrabold ${n.judul}`}>{title}</span>
            {badge && <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${n.badge}`}>{badge}</span>}
          </span>
          {sub && <span className="block text-[11px] text-slate-500 font-medium">{sub}</span>}
        </span>
      </h3>
      {children}
    </div>
  );
}

/* ---------- rincian pengadaan per MA (reusable) ---------- */
type MaDetailItem = { id: string; nama: string; nilai: number; sumber: string; tanggal: string; raw?: any };
function MaDetailList({ list }: { list: MaDetailItem[] }) {
  // dokumen yang sedang dilihat sekilas (tanpa meninggalkan halaman ini)
  const [lihat, setLihat] = useState<MaDetailItem | null>(null);
  if (!list || !list.length) return <p className="text-[11px] text-slate-500 py-1">Belum ada pengadaan pada Mata Anggaran ini.</p>;
  return (
    <>
    {lihat?.raw && (
      <PreviewModal jenis={lihat.sumber === "Non PR PO" ? "Non PR PO" : "SPPBJ"} payload={lihat.raw}
        onTutup={() => setLihat(null)}
        onBuka={() => { window.location.href = `${lihat.sumber === "Non PR PO" ? "/nonpr" : "/sppbj"}?buka=${lihat.id}`; }} />
    )}
    <table className="w-full text-[11px]"><tbody>
      {list.map((x) => (
        <tr key={x.id} className="border-b border-slate-200 last:border-0">
          <td className="py-1 pr-2 w-20"><span className={`px-1.5 py-0.5 rounded font-bold ${x.sumber === "Non PR PO" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"}`}>{x.sumber === "Non PR PO" ? "Non PR PO" : "SPPBJ"}</span></td>
          <td className="py-1 pr-2 text-slate-800">{x.nama}</td>
          <td className="py-1 pr-2 text-slate-500 whitespace-nowrap w-24">{x.tanggal ? tanggalIndo(x.tanggal) : "—"}</td>
          <td className="py-1 text-right font-bold tabular-nums text-slate-900 whitespace-nowrap">{rupiah(x.nilai)}</td>
          {/* lihat isinya sekilas tanpa pindah halaman */}
          <td className="py-1 pl-3 text-right w-14">
            {x.raw ? (
              <button onClick={() => setLihat(x)} className="text-slate-600 font-bold hover:text-slate-900 hover:underline whitespace-nowrap"
                title={`Lihat isi ${x.sumber} ini (tanpa meninggalkan halaman)`}>👁 preview</button>
            ) : <span className="text-slate-300">—</span>}
          </td>
          {/* langsung ke dokumennya — mis. utk membetulkan Mata Anggaran / Jenis Anggaran yang salah tag */}
          <td className="py-1 pl-3 text-right w-16">
            <Link href={`${x.sumber === "Non PR PO" ? "/nonpr" : "/sppbj"}?buka=${x.id}`}
              className="text-blue-700 font-bold hover:underline whitespace-nowrap"
              title={`Buka ${x.sumber} ini untuk dilihat / diedit`}>buka →</Link>
          </td>
        </tr>
      ))}
    </tbody></table>
    </>
  );
}

/* ---------- RKA ---------- */
function RkaSection({ rka, perMA, detail, onSave }: { rka: RKA; perMA: Record<string, number>; detail: Record<string, MaDetailItem[]>; onSave: (r: RKA) => Promise<void> }) {
  const [openKode, setOpenKode] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>(rka.nilai || {});
  const [tahun, setTahun] = useState(rka.tahun);
  const [busy, setBusy] = useState(false);

  const simpan = async () => { setBusy(true); try { await onSave({ ...rka, tahun, nilai: draft }); setEdit(false); } finally { setBusy(false); } };

  return (
    <div className="mt-5 bg-white rounded-2xl elev-md ring-line p-5 anim-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg asdp-gradient text-white grid place-items-center text-sm">🎯</span>
          <span className="accent-bar">RKA — Rencana Kerja &amp; Anggaran (acuan pusat)</span>
        </h3>
        {edit ? (
          <div className="flex gap-2">
            <button onClick={() => { setDraft(rka.nilai || {}); setEdit(false); }} className="btn btn-ghost text-xs">Batal</button>
            <button onClick={simpan} disabled={busy} className="btn btn-primary text-xs">{busy ? "Menyimpan…" : "💾 Simpan RKA"}</button>
          </div>
        ) : (
          <button onClick={() => { setDraft(rka.nilai || {}); setTahun(rka.tahun); setEdit(true); }} className="btn btn-ghost text-xs">✏️ Atur RKA</button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-slate-600 font-bold bg-slate-100 border-b-2 border-slate-200">
            <tr>
              <th className="p-2 text-left">Mata Anggaran</th>
              <th className="p-2 text-center w-20">Kategori</th>
              <th className="p-2 text-right w-40">RKA</th>
              <th className="p-2 text-right w-40">Terserap</th>
              <th className="p-2 text-right w-44">Sisa / %</th>
            </tr>
          </thead>
          <tbody>
            {MATA_ANGGARAN.map((m) => {
              const rkaV = (edit ? draft[m.kode] : rka.nilai?.[m.kode]) || 0;
              const serap = Math.round(perMA[m.kode] || 0);
              const sisa = rkaV - serap;
              const pct = rkaV ? Math.round((serap / rkaV) * 100) : 0;
              const rinci = detail[m.kode] || [];
              const isOpen = openKode === m.kode;
              return (
                <Fragment key={m.kode}>
                  <tr className={`border-b row-hover ${!edit ? "cursor-pointer" : ""} ${isOpen ? "bg-sky-50/60" : ""}`} onClick={() => { if (!edit) setOpenKode(isOpen ? null : m.kode); }}>
                    <td className="p-2">
                      <span className="inline-flex items-center gap-1">
                        {!edit && <span className={`text-slate-500 text-[10px] transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>}
                        <span className="font-mono text-xs text-slate-500">{m.kode}</span> {m.label}
                        {!edit && rinci.length > 0 && <span className="text-[10px] text-sky-600">· {rinci.length}</span>}
                      </span>
                    </td>
                    <td className="p-2 text-center"><span className={`chip ${m.kategori === "Investasi" ? "bg-indigo-100 text-indigo-700" : "bg-cyan-100 text-cyan-700"}`}>{m.kategori}</span></td>
                    <td className="p-2 text-right" onClick={(e) => edit && e.stopPropagation()}>
                      {edit ? (
                        <input type="number" value={draft[m.kode] || ""} onChange={(e) => setDraft({ ...draft, [m.kode]: +e.target.value })}
                          className="w-32 text-right border rounded px-2 py-1 text-xs" placeholder="0" />
                      ) : (rkaV ? rupiah(rkaV) : <span className="text-slate-500">—</span>)}
                    </td>
                    <td className="p-2 text-right text-slate-600">{rupiah(serap)}</td>
                    <td className="p-2 text-right">
                      {rkaV ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className={sisa < 0 ? "text-red-600 font-semibold" : "text-slate-500"}>{rupiah(sisa)}</span>
                          <span className={`chip ${pct > 100 ? "bg-red-100 text-red-700" : pct >= 80 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>{pct}%</span>
                        </div>
                      ) : <span className="text-slate-500">—</span>}
                    </td>
                  </tr>
                  {!edit && isOpen && (
                    <tr className="bg-slate-50/70"><td colSpan={5} className="px-3 py-2"><MaDetailList list={rinci} /></td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {edit && <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">Tahun RKA: <input type="number" value={tahun} onChange={(e) => setTahun(+e.target.value)} className="w-24 border rounded px-2 py-1" /></div>}
    </div>
  );
}

/* ---------- per Mata Anggaran ---------- */
function MaTable({ perMA, detail }: { perMA: Record<string, number>; detail: Record<string, MaDetailItem[]> }) {
  const [openKode, setOpenKode] = useState<string | null>(null);
  const rows = MATA_ANGGARAN.map((m) => ({ ...m, nilai: Math.round(perMA[m.kode] || 0) })).filter((r) => r.nilai > 0).sort((x, y) => y.nilai - x.nilai);
  const max = Math.max(1, ...rows.map((r) => r.nilai));
  if (!rows.length) return <p className="text-xs text-slate-500">Belum ada penyerapan.</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((m) => {
        const rinci = detail[m.kode] || [];
        const isOpen = openKode === m.kode;
        return (
          <div key={m.kode}>
            <button onClick={() => setOpenKode(isOpen ? null : m.kode)} className="w-full text-left">
              <div className="flex items-center justify-between text-xs mb-1 gap-3">
                <span className="text-slate-600 truncate">
                  <span className={`text-slate-500 text-[10px] inline-block mr-0.5 transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                  <span className="font-mono text-slate-500">{m.kode}</span> {m.label}
                  <span className={`chip ml-2 ${m.kategori === "Investasi" ? "bg-indigo-100 text-indigo-700" : "bg-cyan-100 text-cyan-700"}`}>{m.kategori}</span>
                  {rinci.length > 0 && <span className="text-[10px] text-sky-600 ml-1">· {rinci.length}</span>}
                </span>
                <span className="text-slate-700 font-semibold shrink-0">{rupiah(m.nilai)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                <div className={`h-full rounded-full ${m.kategori === "Investasi" ? "bg-gradient-to-r from-indigo-500 to-blue-700" : "bg-gradient-to-r from-[#14b8c4] to-[#16357f]"}`} style={{ width: `${(m.nilai / max) * 100}%` }} />
              </div>
            </button>
            {isOpen && <div className="mt-2 ml-4 pl-3 border-l-2 border-slate-100"><MaDetailList list={rinci} /></div>}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- per Kapal ---------- */
function KapalTable({ perKapal }: { perKapal: Record<string, { Biaya: number; Investasi: number }> }) {
  const rows = Object.entries(perKapal).map(([k, v]) => ({ kapal: k, ...v, total: v.Biaya + v.Investasi }))
    .filter((r) => r.total > 0).sort((x, y) => y.total - x.total);
  if (!rows.length) return <p className="text-xs text-slate-500">Belum ada penyerapan per kapal.</p>;
  const tB = rows.reduce((s, r) => s + r.Biaya, 0), tI = rows.reduce((s, r) => s + r.Investasi, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-slate-600 font-bold bg-slate-100 border-b-2 border-slate-200">
          <tr><th className="p-2 text-left">Kapal</th><th className="p-2 text-right w-36">Biaya</th><th className="p-2 text-right w-36">Investasi</th><th className="p-2 text-right w-36">Total</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.kapal} className="border-b last:border-0 row-hover">
              <td className="p-2 font-medium text-slate-700">{r.kapal}</td>
              <td className="p-2 text-right text-cyan-700">{r.Biaya ? rupiah(r.Biaya) : "—"}</td>
              <td className="p-2 text-right text-indigo-700">{r.Investasi ? rupiah(r.Investasi) : "—"}</td>
              <td className="p-2 text-right font-semibold text-slate-800">{rupiah(r.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-bold text-slate-700">
            <td className="p-2">TOTAL</td><td className="p-2 text-right text-cyan-700">{rupiah(tB)}</td>
            <td className="p-2 text-right text-indigo-700">{rupiah(tI)}</td><td className="p-2 text-right">{rupiah(tB + tI)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ---------- Kendali Anggaran Rutin bulanan ---------- */
const prevMonth = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const nextMonth = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
function parsePlafonPaste(text: string): PlafonRow[] {
  const out: PlafonRow[] = [];
  for (const line of (text || "").split(/\r?\n/)) {
    const t = line.trim(); if (!t) continue;
    let ma = "", val = "";
    if (t.includes("\t")) { const parts = t.split("\t"); val = (parts.pop() || "").trim(); ma = parts.join(" ").trim(); }
    else { const m = t.match(/^(.*?)[\s:;]+([\d][\d.,]{3,})\s*$/); if (m) { ma = m[1].trim(); val = m[2]; } }
    const n = parseInt((val || "").replace(/[^\d]/g, ""), 10);
    if (ma && n) out.push({ ma, nilai: n });
  }
  return out;
}
// status pagu -> warna badge (c), warna bar (bar), warna angka % (num). Kontras tinggi biar terbaca.
const statusRutin = (pct: number) =>
  pct > 100
    ? { c: "bg-red-100 text-red-800 ring-1 ring-red-300", t: "OVERBUDGET", bar: "bg-red-500", num: "text-red-700" }
    : pct >= 80
    ? { c: "bg-amber-100 text-amber-800 ring-1 ring-amber-300", t: "Waspada", bar: "bg-amber-500", num: "text-amber-700" }
    : { c: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300", t: "Aman", bar: "bg-emerald-500", num: "text-emerald-700" };

/* kelas tabel kendali anggaran (dipakai Rutin & Docking — sama persis) */
const TBL_HEAD = "bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600 font-bold border-b-2 border-slate-200";
// kepala tabel versi Docking (amber) — beda warna biar tak tertukar dgn kartu Rutin
const TBL_HEAD_AMBER = "bg-amber-100/70 text-[11px] uppercase tracking-wide text-amber-900 font-bold border-b-2 border-amber-300";
const TFOOT_AMBER = "bg-amber-100/70 border-t-2 border-amber-300 font-extrabold text-amber-950";
const TD_PAGU = "p-2 text-right tabular-nums text-slate-700";
const TD_PAKAI = "p-2 text-right tabular-nums font-bold text-slate-900";
const TD_MA = "p-2 font-semibold text-slate-800";
const tdSisa = (v: number) => `p-2 text-right tabular-nums font-bold ${v < 0 ? "text-red-700" : "text-emerald-700"}`;
const TFOOT_ROW = "bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900";
// warna aksen KPI mini mengikuti status serapan
const barPct = (pct: number) => (pct > 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500");
const tintPct = (pct: number) => (pct > 100 ? "text-red-700" : pct >= 80 ? "text-amber-700" : "text-slate-900");

function AnggaranRutin({ plafon, pengadaan, onSave, onExcel, xlsBusy }: { plafon: PlafonRutin[]; pengadaan: PengadaanRow[]; onSave: (p: PlafonRutin[]) => Promise<void>; onExcel?: () => void; xlsBusy?: boolean }) {
  const bulanList = useMemo(() => {
    const s = new Set<string>();
    plafon.forEach((p) => p.bulan && s.add(p.bulan));
    pengadaan.forEach((r) => { if (/rutin/i.test(r.kategoriRekap || "") && r.tanggal) s.add(r.tanggal.slice(0, 7)); });
    return Array.from(s).sort().reverse();
  }, [plafon, pengadaan]);
  const [bulanSel, setBulanSel] = useState("");
  const bulan = bulanSel || bulanList[0] || new Date().toISOString().slice(0, 7);

  const entry = plafon.find((p) => p.bulan === bulan);
  const rows = entry?.rows || [];
  const real = useMemo(() => realisasiRutin(pengadaan, bulan), [pengadaan, bulan]);
  const perKapal = useMemo(() => realisasiRutinKapal(pengadaan, bulan), [pengadaan, bulan]);

  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<PlafonRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [tampil, setTampil] = useState<"ma" | "kapal">("ma"); // rincian per Mata Anggaran / per Kapal

  // gabung pagu + realisasi (termasuk realisasi tanpa pagu)
  const merged = useMemo(() => {
    const by: Record<string, { key: string; ma: string; pagu: number; pakai: number }> = {};
    rows.forEach((r) => { const k = maKey(r.ma); by[k] = { key: k, ma: r.ma, pagu: (by[k]?.pagu || 0) + (r.nilai || 0), pakai: by[k]?.pakai || 0 }; });
    Object.entries(real.perKey).forEach(([k, v]) => {
      if (by[k]) by[k].pakai = v;
      else { const lbl = real.list.find((x) => x.key === k)?.ma || k; by[k] = { key: k, ma: lbl, pagu: 0, pakai: v }; }
    });
    return Object.values(by).sort((x, y) => (y.pakai / (y.pagu || 1)) - (x.pakai / (x.pagu || 1)));
  }, [rows, real]);

  const totalPagu = rows.reduce((s, r) => s + (r.nilai || 0), 0);
  const totalPakai = real.total;
  const sisa = totalPagu - totalPakai;
  const pctTot = totalPagu ? Math.round((totalPakai / totalPagu) * 100) : 0;

  // proyeksi akhir bulan (hanya utk bulan berjalan): ekstrapolasi laju pemakaian
  const proj = useMemo(() => {
    const now = new Date();
    const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (bulan !== curYm) return { active: false, factor: 1, total: totalPakai, pct: pctTot, dayToday: 0, daysInMonth: 0 };
    const dayToday = now.getDate();
    const [y, mo] = bulan.split("-").map(Number);
    const daysInMonth = new Date(y, mo, 0).getDate();
    const factor = dayToday > 0 ? daysInMonth / dayToday : 1;
    const total = totalPakai * factor;
    const pct = totalPagu ? Math.round((total / totalPagu) * 100) : 0;
    return { active: true, factor, total, pct, dayToday, daysInMonth };
  }, [bulan, totalPakai, totalPagu, pctTot]);

  const startEdit = () => { setDraft(rows.length ? rows.map((r) => ({ ...r })) : [{ ma: "", nilai: 0 }]); setEdit(true); };
  // siapkan pagu bulan BERIKUTNYA: lompat bulan + salin pagu bulan aktif + langsung mode edit
  const bulanLain = () => {
    const nb = nextMonth(bulan);
    const src = plafon.find((p) => p.bulan === nb)?.rows || rows;
    setBulanSel(nb);
    setDraft(src.length ? src.map((r) => ({ ...r })) : [{ ma: "", nilai: 0 }]);
    setEdit(true);
  };
  const salin = () => { const pe = plafon.find((p) => p.bulan === prevMonth(bulan)); if (pe?.rows?.length) setDraft(pe.rows.map((r) => ({ ...r }))); else alert("Pagu bulan sebelumnya belum ada."); };
  // hapus SELURUH pagu bulan ini (pengadaan tidak ikut terhapus)
  const hapusPagu = async () => {
    if (!entry) return;
    const nilai = rows.reduce((s, r) => s + (r.nilai || 0), 0);
    if (!confirm(`Hapus pagu RUTIN ${bulanTahun(bulan + "-01")}?
${rows.length} Mata Anggaran, total ${rupiah(nilai)}.

Pengadaan/SPPBJ TIDAK ikut terhapus — hanya angka pagunya.`)) return;
    setBusy(true);
    try { await onSave(plafon.filter((p) => p.bulan !== bulan)); setEdit(false); } finally { setBusy(false); }
  };
  const simpan = async () => {
    setBusy(true);
    try {
      const clean = draft.filter((r) => r.ma.trim()); // baris bernilai 0 tetap disimpan biar tetap tampil
      const next = plafon.filter((p) => p.bulan !== bulan);
      if (clean.length) next.push({ bulan, rows: clean });
      await onSave(next);
      setEdit(false);
    } finally { setBusy(false); }
  };

  return (
    <Card tone="biru" icon="🧭" badge="Bulanan" title="Kendali Anggaran Rutin"
      sub="Persetujuan Rutin per BULAN · pagu per Mata Anggaran">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input type="month" value={bulan} onChange={(e) => setBulanSel(e.target.value)}
          className="text-xs border px-2.5 py-1.5 rounded-lg bg-white" title="Pilih bulan mana pun (termasuk bulan baru)" />
        {bulanList.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 font-semibold">ada data:</span>
            {bulanList.slice(0, 6).map((b) => (
              <button key={b} onClick={() => setBulanSel(b)}
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border transition ${b === bulan ? "bg-[#16357f] text-white border-[#16357f]" : "border-slate-300 text-slate-600 hover:border-[#1ca3dd] hover:text-[#16357f]"}`}>
                {bulanTahun(b + "-01")}
              </button>
            ))}
          </div>
        )}
        <span className="text-[11px] text-slate-500">realisasi = SPPBJ + Non PR PO ber-<b className="text-slate-700">Jenis Anggaran: Rutin</b>, per Mata Anggaran (Docking terpisah, tak overlap)</span>
        <div className="ml-auto flex items-center gap-2">
          {!edit ? (
            <>
              {onExcel && (
                <button onClick={onExcel} disabled={xlsBusy} className="btn btn-success text-xs disabled:opacity-50"
                  title="Unduh Excel berjenjang: ringkasan → per Mata Anggaran → per item pengadaan (bertaut)">
                  {xlsBusy ? "menyiapkan…" : "📊 Export Excel"}
                </button>
              )}
              <a href={`/dashboard/cetak?jenis=rutin&bulan=${bulan}`} target="_blank" rel="noreferrer" className="btn btn-ghost text-xs" title="Buka lembar cetak / simpan PDF">🖨️ Export PDF</a>
              <button onClick={bulanLain} className="btn btn-ghost text-xs" title={`Siapkan pagu ${bulanTahun(nextMonth(bulan) + "-01")} (disalin dari bulan ini)`}>➕ Pagu Bulan Lain</button>
              <button onClick={startEdit} className="btn btn-ghost text-xs">✏️ Atur Pagu</button>
              {entry && <button onClick={hapusPagu} disabled={busy} className="btn btn-ghost text-xs text-red-600 disabled:opacity-50" title="Hapus pagu bulan ini (pengadaan tetap ada)">🗑️ Hapus Pagu</button>}
            </>
          ) : (
            <>
              <button onClick={salin} className="btn btn-ghost text-xs">⧉ Salin bln lalu</button>
              <button onClick={() => setPaste("")} className="btn btn-ghost text-xs">📋 Tempel dari Excel</button>
              <button onClick={simpan} disabled={busy} className="btn btn-primary text-xs">{busy ? "…" : "💾 Simpan"}</button>
              <button onClick={() => setEdit(false)} className="btn btn-ghost text-xs">Batal</button>
            </>
          )}
        </div>
      </div>

      {/* KPI mini */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <MiniStat label="Total Pagu" val={rupiah(totalPagu)} tint="text-slate-900" bar="bg-slate-400" />
        <MiniStat label="Terpakai" val={rupiah(totalPakai)} tint="text-blue-800" bar="bg-blue-600" />
        <MiniStat label="Sisa" val={rupiah(sisa)} tint={sisa < 0 ? "text-red-700" : "text-emerald-800"} bar={sisa < 0 ? "bg-red-500" : "bg-emerald-500"} />
        <MiniStat label="Serapan" val={`${pctTot}%`} tint={tintPct(pctTot)} bar={barPct(pctTot)} />
      </div>

      {proj.active && totalPagu > 0 && (
        <div className={`mb-3 rounded-xl px-3 py-2 text-xs flex flex-wrap items-center gap-x-2 gap-y-1 border ${proj.pct > 100 ? "bg-red-50 text-red-800 border-red-300" : proj.pct >= 80 ? "bg-amber-50 text-amber-800 border-amber-300" : "bg-emerald-50 text-emerald-800 border-emerald-300"}`}>
          <span>📈 Proyeksi akhir bulan (laju sampai hari ke-{proj.dayToday}/{proj.daysInMonth}):</span>
          <b className="text-sm tabular-nums">~{rupiah(Math.round(proj.total))}</b>
          <span className="font-semibold tabular-nums">({proj.pct}% pagu)</span>
          {proj.pct > 100 ? <b>— berpotensi OVERBUDGET ~{rupiah(Math.round(proj.total - totalPagu))}, rem pengeluaran</b> : proj.pct >= 80 ? <b>— mendekati pagu, pantau</b> : <span>— on-track</span>}
        </div>
      )}

      {edit ? (
        <div className="rounded-xl ring-1 ring-slate-200 p-3">
          <p className="text-xs text-slate-500 mb-2">Mengisi pagu untuk <b className="text-[#16357f]">{bulanTahun(bulan + "-01")}</b> — ganti bulan lewat kalender di atas bila perlu.</p>
          <datalist id="maRutinList">{MATA_ANGGARAN.map((m) => <option key={m.kode} value={fullMA(m.kode)} />)}</datalist>
          {draft.map((r, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <input list="maRutinList" value={r.ma} onChange={(e) => setDraft((d) => d.map((x, j) => j === i ? { ...x, ma: e.target.value } : x))} placeholder="Mata Anggaran (mis. Pelumas / 5010403009 Akomodasi)" className="flex-1 text-xs border rounded px-2 py-1.5" />
              <input type="number" value={r.nilai || ""} onChange={(e) => setDraft((d) => d.map((x, j) => j === i ? { ...x, nilai: +e.target.value } : x))} placeholder="pagu Rp" className="w-36 text-xs border rounded px-2 py-1.5 text-right" />
              <button onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
            </div>
          ))}
          <button onClick={() => setDraft((d) => [...d, { ma: "", nilai: 0 }])} className="text-xs text-[#16357f] hover:underline mt-1">+ baris Mata Anggaran</button>
        </div>
      ) : merged.length === 0 ? (
        <p className="text-sm text-slate-500 py-3 text-center">Belum ada pagu/realisasi rutin bulan ini. Klik <b>Atur Pagu</b> untuk isi dari dokumen Persetujuan.</p>
      ) : (
        <>
        {/* pilih rincian: per Mata Anggaran (ada pagu) atau per Kapal (serapan) */}
        <div className="flex items-center gap-1 mb-2">
          {([["ma", "Per Mata Anggaran"], ["kapal", `Per Kapal (${perKapal.list.length})`]] as const).map(([v, t]) => (
            <button key={v} onClick={() => setTampil(v)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${tampil === v ? "bg-[#16357f] text-white border-[#16357f]" : "bg-white border-slate-300 text-slate-600 hover:border-[#1ca3dd] hover:text-[#16357f]"}`}>
              {t}
            </button>
          ))}
          {tampil === "kapal" && <span className="text-[11px] text-slate-500 ml-1">pagu ditetapkan per Mata Anggaran, jadi di sini yang tampil <b className="text-slate-700">serapan</b> tiap kapal</span>}
        </div>
        {tampil === "kapal" ? (
          <SerapanKapal data={perKapal.list} total={perKapal.total} />
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={TBL_HEAD}>
              <tr><th className="p-2 text-left">Mata Anggaran</th><th className="p-2 text-right">Pagu</th><th className="p-2 text-right">Terpakai</th><th className="p-2 text-right">Sisa</th><th className="p-2 text-right w-40">Serapan</th><th className="p-2 text-center">Status</th></tr>
            </thead>
            <tbody>
              {merged.map((m) => {
                const pct = m.pagu ? Math.round((m.pakai / m.pagu) * 100) : (m.pakai ? 999 : 0);
                const s = statusRutin(pct);
                const sisaM = m.pagu - m.pakai;
                const rinci = real.list.filter((x) => x.key === m.key);
                const isOpen = openKey === m.key;
                return (
                  <Fragment key={m.key}>
                    <tr className={`border-b border-slate-200 row-hover cursor-pointer ${isOpen ? "bg-sky-50" : "even:bg-slate-50/60"}`} onClick={() => setOpenKey(isOpen ? null : m.key)}>
                      <td className={TD_MA}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`text-slate-500 text-[10px] transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                          {m.ma}
                          {rinci.length > 0 && <span className="text-[10px] font-bold text-sky-800 bg-sky-100 rounded-full px-1.5 py-px">{rinci.length}</span>}
                        </span>
                      </td>
                      <td className={TD_PAGU}>{m.pagu ? rupiah(m.pagu) : <span className="text-slate-500 italic font-normal">tanpa pagu</span>}</td>
                      <td className={TD_PAKAI}>{rupiah(m.pakai)}</td>
                      <td className={tdSisa(sisaM)}>{rupiah(sisaM)}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2.5 rounded-full bg-slate-200 ring-1 ring-inset ring-slate-300/60 overflow-hidden">
                            <div className={`h-full rounded-full ${m.pagu ? s.bar : "bg-slate-400"}`}
                              style={{ width: m.pagu ? `${Math.max(m.pakai > 0 ? 4 : 0, Math.min(100, pct))}%` : "0%" }} />
                          </div>
                          <span className={`text-xs font-bold tabular-nums w-11 text-right ${m.pagu ? s.num : "text-slate-500"}`}>{m.pagu ? pct + "%" : "—"}</span>
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <span className={`inline-block text-[10px] font-extrabold tracking-wide px-2.5 py-1 rounded-full ${m.pagu ? s.c : "bg-slate-100 text-slate-500 ring-1 ring-slate-300"}`}>{m.pagu ? s.t : "—"}</span>
                        {proj.active && m.pagu > 0 && pct <= 100 && Math.round(m.pakai * proj.factor) > m.pagu && (
                          <span className="block text-[9px] font-bold text-amber-700 mt-1">▲ proyeksi lewat</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-sky-50/50">
                        <td colSpan={6} className="px-3 py-2">
                          <MaDetailList list={rinci} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className={TFOOT_ROW}>
                <td className="p-2">TOTAL</td>
                <td className="p-2 text-right tabular-nums">{rupiah(totalPagu)}</td>
                <td className="p-2 text-right tabular-nums">{rupiah(totalPakai)}</td>
                <td className={`p-2 text-right tabular-nums ${sisa < 0 ? "text-red-700" : "text-emerald-700"}`}>{rupiah(sisa)}</td>
                <td className={`p-2 text-right tabular-nums ${tintPct(pctTot)}`}>{pctTot}%</td>
                <td className="p-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        )}
        </>
      )}

      {/* daftar pengadaan rutin bulan ini */}
      {!edit && real.list.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-slate-600 font-medium hover:text-slate-900">Semua {real.list.length} pengadaan bulan ini (klik baris Mata Anggaran di atas utk rincian per pos)</summary>
          <ul className="mt-2 space-y-1">
            {real.list.map((x) => (
              <li key={x.id} className="flex justify-between gap-3 border-b border-slate-200 pb-1">
                <span className="text-slate-800 truncate"><span className={`text-[9px] font-bold px-1 rounded mr-1 ${x.sumber === "Non PR PO" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"}`}>{x.sumber === "Non PR PO" ? "NonPR" : "SPPBJ"}</span>{x.nama} <span className="text-slate-500">· {x.ma || "tanpa MA"}</span></span>
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <span className="font-bold tabular-nums text-slate-900">{rupiah(x.nilai)}</span>
                  <Link href={`${x.sumber === "Non PR PO" ? "/nonpr" : "/sppbj"}?buka=${x.id}`}
                    className="text-blue-700 font-bold hover:underline" title={`Buka ${x.sumber} ini untuk dilihat / diedit`}>buka →</Link>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* modal tempel */}
      {paste !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/40" onMouseDown={() => setPaste(null)}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-5" onMouseDown={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-slate-800 mb-1">Tempel Pagu dari Excel/Sheets</h4>
            <p className="text-[11px] text-slate-500 mb-2">Salin 2 kolom (Mata Anggaran &amp; nilai) dari dokumen Persetujuan → tempel di sini.</p>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={8} className="w-full border rounded-lg p-2 text-xs font-mono" placeholder={"Akomodasi Kapal\t102066000\nFumigasi\t3500000\nPermesinan dan Kelistrikan\t156379140"} />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setPaste(null)} className="btn btn-ghost text-xs">Tutup</button>
              <button onClick={() => { const p = parsePlafonPaste(paste); if (p.length) { setDraft(p); setEdit(true); setPaste(null); } else alert("Tak terbaca. Pastikan tiap baris: Mata Anggaran lalu nilai."); }} className="btn btn-primary text-xs">Isi {parsePlafonPaste(paste).length || ""} baris →</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- Serapan RUTIN per Kapal (rincian di dalam Kendali Rutin) ---------- */
function SerapanKapal({ data, total }: { data: RealisasiKapal[]; total: number }) {
  const [buka, setBuka] = useState<string | null>(null);
  if (!data.length) return <p className="text-sm text-slate-500 py-3 text-center">Belum ada serapan rutin per kapal bulan ini.</p>;
  const max = Math.max(1, ...data.map((k) => k.nilai));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={TBL_HEAD}>
          <tr>
            <th className="p-2 text-left">Kapal</th>
            <th className="p-2 text-center w-24">Pengadaan</th>
            <th className="p-2 text-right w-40">Terpakai</th>
            <th className="p-2 text-right w-56">Porsi dari total bulan ini</th>
          </tr>
        </thead>
        <tbody>
          {data.map((k) => {
            const pct = total ? Math.round((k.nilai / total) * 100) : 0;
            const isOpen = buka === k.kapal;
            return (
              <Fragment key={k.kapal}>
                <tr className={`border-b border-slate-200 row-hover cursor-pointer ${isOpen ? "bg-sky-50" : "even:bg-slate-50/60"}`} onClick={() => setBuka(isOpen ? null : k.kapal)}>
                  <td className={TD_MA}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`text-slate-500 text-[10px] transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                      {k.kapal}
                    </span>
                  </td>
                  <td className="p-2 text-center"><span className="text-[10px] font-bold text-sky-800 bg-sky-100 rounded-full px-2 py-0.5">{k.pengadaan.length}</span></td>
                  <td className={TD_PAKAI}>{rupiah(Math.round(k.nilai))}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2.5 rounded-full bg-slate-200 ring-1 ring-inset ring-slate-300/60 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#14b8c4] to-[#16357f]" style={{ width: `${Math.max(4, (k.nilai / max) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-bold tabular-nums w-11 text-right text-slate-700">{pct}%</span>
                    </div>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-sky-50/50">
                    <td colSpan={4} className="px-3 py-2">
                      <MaDetailList list={k.pengadaan} />
                      <p className="text-[10px] text-slate-500 mt-1">Nilai pengadaan yang menyebut beberapa kapal dibagi rata ke kapal-kapal itu.</p>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className={TFOOT_ROW}>
            <td className="p-2">TOTAL</td>
            <td className="p-2"></td>
            <td className="p-2 text-right tabular-nums">{rupiah(Math.round(total))}</td>
            <td className="p-2 text-right tabular-nums">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ---------- Kendali Anggaran Docking (per kapal) ---------- */
// seed draft dari daftar MA docking tetap (user tinggal isi nilai) + baris tambahan non-standar
function seedDockingDraft(existing: PlafonRow[]): PlafonRow[] {
  const byKey: Record<string, PlafonRow> = {};
  existing.forEach((r) => { byKey[maKey(r.ma)] = r; });
  const isi = (m: { kode: string; label: string }) => ({
    ma: `${m.kode} (${m.label})`,
    nilai: byKey[m.kode]?.nilai || 0,
    addendum: byKey[m.kode]?.addendum || 0,
  });
  const base = [...DOCKING_MA.map(isi), ...DOCKING_MA_INVESTASI.map(isi)];
  const dockKeys = new Set([...DOCKING_MA, ...DOCKING_MA_INVESTASI].map((m) => m.kode));
  const extras = existing.filter((r) => !dockKeys.has(maKey(r.ma)));
  return [...base, ...extras];
}
// jumlah baris MA Biaya di draft (sisanya Investasi lalu baris tambahan)
const N_BIAYA = DOCKING_MA.length;
const N_DOCK = DOCKING_MA.length + DOCKING_MA_INVESTASI.length;

function AnggaranDocking({ docking, pengadaan, onSave, onExcel, xlsBusy }: { docking: PlafonDocking[]; pengadaan: PengadaanRow[]; onSave: (d: PlafonDocking[]) => Promise<void>; onExcel?: () => void; xlsBusy?: boolean }) {
  const thisYear = new Date().getFullYear();
  const [kapal, setKapal] = useState(KAPAL_ANGGARAN[0]);
  const [tahun, setTahun] = useState(thisYear);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<PlafonRow[]>([]);
  const [noSurat, setNoSurat] = useState("");
  const [noAdd, setNoAdd] = useState("");
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [semuaMA, setSemuaMA] = useState(true); // tampilkan MA baku walau pagunya 0

  const entry = docking.find((d) => d.kapal === kapal && d.tahun === tahun);
  const rows = entry?.rows || [];
  const real = useMemo(() => realisasiDocking(pengadaan, kapal, tahun), [pengadaan, kapal, tahun]);

  // pagu awal + addendum per MA, digabung realisasi. kelompok: Biaya vs Investasi.
  // semuaMA = tampilkan seluruh MA baku docking walau pagunya 0 (biar daftarnya selalu lengkap).
  const merged = useMemo(() => {
    const by: Record<string, { key: string; ma: string; awal: number; add: number; pakai: number; baku: boolean }> = {};
    if (semuaMA) {
      [...DOCKING_MA, ...DOCKING_MA_INVESTASI].forEach((m) => {
        by[m.kode] = { key: m.kode, ma: `${m.kode} (${m.label})`, awal: 0, add: 0, pakai: 0, baku: true };
      });
    }
    rows.forEach((r) => {
      const k = maKey(r.ma);
      by[k] = { key: k, ma: by[k]?.ma || r.ma, awal: (by[k]?.awal || 0) + (r.nilai || 0), add: (by[k]?.add || 0) + (r.addendum || 0), pakai: by[k]?.pakai || 0, baku: true };
    });
    Object.entries(real.perKey).forEach(([k, v]) => { if (by[k]) by[k].pakai = v; else { const lbl = real.list.find((x) => x.key === k)?.ma || k; by[k] = { key: k, ma: lbl, awal: 0, add: 0, pakai: v, baku: false }; } });
    return Object.values(by)
      .map((x) => ({ ...x, pagu: x.awal + x.add, inv: isMaInvestasi(x.key) }))
      .sort((x, y) => (x.inv === y.inv ? (y.pakai / (y.pagu || 1)) - (x.pakai / (x.pagu || 1)) : x.inv ? 1 : -1));
  }, [rows, real, semuaMA]);

  const grup = useMemo(() => ({
    biaya: merged.filter((m) => !m.inv),
    investasi: merged.filter((m) => m.inv),
  }), [merged]);
  const jumlahkan = (arr: typeof merged) => ({
    awal: arr.reduce((s, m) => s + m.awal, 0),
    add: arr.reduce((s, m) => s + m.add, 0),
    pagu: arr.reduce((s, m) => s + m.pagu, 0),
    pakai: arr.reduce((s, m) => s + m.pakai, 0),
  });

  const totalAwal = rows.reduce((s, r) => s + (r.nilai || 0), 0);
  const totalAdd = rows.reduce((s, r) => s + (r.addendum || 0), 0);
  const totalPagu = totalAwal + totalAdd;
  const totalPakai = real.total;
  const sisa = totalPagu - totalPakai;
  const pctTot = totalPagu ? Math.round((totalPakai / totalPagu) * 100) : 0;

  const startEdit = () => { setDraft(seedDockingDraft(rows)); setNoSurat(entry?.noSurat || ""); setNoAdd(entry?.noSuratAddendum || ""); setEdit(true); };
  // hapus pagu docking kapal+tahun ini (pengadaan tidak ikut terhapus)
  const hapusPagu = async () => {
    if (!entry) return;
    if (!confirm(`Hapus pagu DOCKING ${kapal} ${tahun}?
${rows.length} Mata Anggaran, pagu total ${rupiah(totalPagu)}.

Pengadaan/SPPBJ TIDAK ikut terhapus — hanya angka pagunya.`)) return;
    setBusy(true);
    try { await onSave(docking.filter((d) => !(d.kapal === kapal && d.tahun === tahun))); setEdit(false); } finally { setBusy(false); }
  };
  const simpan = async () => {
    setBusy(true);
    try {
      // simpan juga baris bernilai 0 — MA baku docking harus tetap tampil di tabel
      const clean = draft.filter((r) => r.ma.trim());
      const next = docking.filter((d) => !(d.kapal === kapal && d.tahun === tahun));
      if (clean.length) next.push({ kapal, tahun, noSurat: noSurat.trim() || undefined, noSuratAddendum: noAdd.trim() || undefined, rows: clean });
      await onSave(next);
      setEdit(false);
    } finally { setBusy(false); }
  };

  return (
    <Card tone="amber" icon="⚓" badge="Per Kapal · Tahunan" title="Kendali Anggaran Docking"
      sub="Persetujuan Pusat per KAPAL · pagu per Mata Anggaran docking">
      {/* pilih kapal: chip (bukan dropdown) — kapal adalah sumbu utama kartu ini */}
      <div className="rounded-xl bg-white ring-1 ring-amber-200 p-2.5 mb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Pilih kapal</span>
          <input type="number" value={tahun} onChange={(e) => setTahun(+e.target.value)}
            className="text-xs border border-amber-300 px-2 py-1 rounded-lg bg-white w-20 font-bold text-amber-900" title="Tahun docking" />
          {entry?.noSurat && !edit && <span className="text-[11px] font-semibold text-amber-800">No. {entry.noSurat}</span>}
          <div className="ml-auto flex items-center gap-2">
            {!edit ? (
              <>
                {onExcel && (
                  <button onClick={onExcel} disabled={xlsBusy} className="btn btn-success text-xs disabled:opacity-50"
                    title="Unduh Excel berjenjang: ringkasan per kapal → per Mata Anggaran → per item pengadaan (bertaut)">
                    {xlsBusy ? "menyiapkan…" : "📊 Export Excel"}
                  </button>
                )}
                <a href={`/dashboard/cetak?jenis=docking&kapal=${encodeURIComponent(kapal)}&tahun=${tahun}`} target="_blank" rel="noreferrer" className="btn btn-ghost text-xs" title="Buka lembar cetak / simpan PDF">🖨️ Export PDF</a>
                <button onClick={startEdit} className="btn btn-ghost text-xs">✏️ Atur Pagu Docking</button>
                {entry && <button onClick={hapusPagu} disabled={busy} className="btn btn-ghost text-xs text-red-600 disabled:opacity-50" title="Hapus pagu docking kapal ini (pengadaan tetap ada)">🗑️ Hapus Pagu</button>}
              </>
            ) : (
              <>
                <button onClick={() => setPaste("")} className="btn btn-ghost text-xs">📋 Tempel dari Excel</button>
                <button onClick={simpan} disabled={busy} className="btn btn-primary text-xs">{busy ? "…" : "💾 Simpan"}</button>
                <button onClick={() => setEdit(false)} className="btn btn-ghost text-xs">Batal</button>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {KAPAL_ANGGARAN.map((k) => {
            const adaPagu = docking.some((d) => d.kapal === k && d.tahun === tahun && (d.rows || []).some((r) => r.nilai > 0));
            return (
              <button key={k} onClick={() => setKapal(k)}
                className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition ${k === kapal ? NADA.amber.pilihAktif : NADA.amber.pilihPasif}`}>
                {ringkasKapal(k)}
                {adaPagu && <span className={`ml-1 ${k === kapal ? "text-amber-200" : "text-emerald-600"}`}>●</span>}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5">● = pagu docking {tahun} sudah diisi · realisasi = SPPBJ/Non PR PO ber-<b>Jenis Anggaran: Docking</b> untuk kapal ini</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        <MiniStat label={`Pagu Awal ${ringkasKapal(kapal)}`} val={rupiah(totalAwal)} tint="text-slate-900" bar="bg-amber-500" />
        <MiniStat label="Addendum" val={totalAdd ? "+" + rupiah(totalAdd) : "—"} tint={totalAdd ? "text-violet-800" : "text-slate-400"} bar={totalAdd ? "bg-violet-600" : "bg-slate-300"} />
        <MiniStat label="Pagu Total" val={rupiah(totalPagu)} tint="text-slate-900" bar="bg-orange-700" />
        <MiniStat label="Terpakai" val={rupiah(totalPakai)} tint="text-blue-800" bar="bg-blue-600" />
        <MiniStat label="Sisa · Serapan" val={`${rupiahShort(sisa)} · ${pctTot}%`} tint={sisa < 0 ? "text-red-700" : tintPct(pctTot)} bar={barPct(pctTot)} />
      </div>

      {edit ? (
        <div className="rounded-xl bg-white ring-1 ring-amber-200 p-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs text-slate-600">Pagu docking <b className="text-orange-800">{kapal}</b> {tahun}:</span>
            <input value={noSurat} onChange={(e) => setNoSurat(e.target.value)} placeholder="No. Surat Persetujuan awal" className="text-xs border rounded px-2 py-1 flex-1 min-w-[10rem] max-w-xs" />
            <input value={noAdd} onChange={(e) => setNoAdd(e.target.value)} placeholder="No. Surat Addendum (kalau ada)" className="text-xs border border-violet-300 rounded px-2 py-1 flex-1 min-w-[10rem] max-w-xs" />
          </div>
          <div className="flex items-center gap-2 mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <span className="flex-1">Mata Anggaran</span>
            <span className="w-40 text-right">Pagu awal (Rp)</span>
            <span className="w-40 text-right text-violet-700">Addendum (Rp)</span>
            <span className="w-4" />
          </div>
          {draft.map((r, i) => {
            const extra = i >= N_DOCK;
            const total = (r.nilai || 0) + (r.addendum || 0);
            return (
              <Fragment key={i}>
                {i === 0 && <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 mt-1 mb-1">Biaya</p>}
                {i === N_BIAYA && <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-800 mt-3 mb-1">Investasi (belanja modal)</p>}
                {i === N_DOCK && <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mt-3 mb-1">Mata Anggaran tambahan</p>}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex-1 text-xs text-slate-700 bg-slate-50 rounded-lg px-3 py-2 truncate ring-1 ring-slate-100">
                    {r.ma || "—"}
                    {total > 0 && <b className="ml-2 text-slate-500 font-semibold">= {rupiah(total)}</b>}
                  </span>
                  <input type="number" value={r.nilai || ""} onChange={(e) => setDraft((d) => d.map((x, j) => j === i ? { ...x, nilai: +e.target.value } : x))} placeholder="0" className="w-40 text-xs border rounded-lg px-3 py-2 text-right" />
                  <input type="number" value={r.addendum || ""} onChange={(e) => setDraft((d) => d.map((x, j) => j === i ? { ...x, addendum: +e.target.value } : x))} placeholder="0" className="w-40 text-xs border border-violet-300 bg-violet-50/40 rounded-lg px-3 py-2 text-right" />
                  {extra ? <button onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button> : <span className="w-4" />}
                </div>
              </Fragment>
            );
          })}
          <p className="text-[10px] text-slate-500 mt-1.5"><b>Pagu awal</b> = Total Persetujuan Pusat pertama. <b className="text-violet-700">Addendum</b> = persetujuan biaya tambahan saat/sesudah docking — cukup isi selisihnya, sistem menjumlahkan sendiri. Daftar MA sudah tetap, tak perlu ketik.</p>
        </div>
      ) : merged.length === 0 ? (
        <p className="text-sm text-slate-500 py-3 text-center">Belum ada pagu/realisasi docking utk {kapal} {tahun}. Klik <b>Atur Pagu Docking</b> untuk isi dari Persetujuan Pusat.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setSemuaMA((v) => !v)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${semuaMA ? NADA.amber.pilihAktif : NADA.amber.pilihPasif}`}>
              {semuaMA ? "☑ Tampilkan MA tanpa pagu" : "☐ Tampilkan MA tanpa pagu"}
            </button>
            <span className="text-[10px] text-slate-500">semua Mata Anggaran docking tetap terlihat walau nilainya 0</span>
          </div>
          <table className="w-full text-sm">
            <thead className={TBL_HEAD_AMBER}>
              <tr>
                <th className="p-2 text-left">Mata Anggaran</th>
                <th className="p-2 text-right">Pagu Awal</th>
                <th className="p-2 text-right text-violet-800">Addendum</th>
                <th className="p-2 text-right">Pagu Total</th>
                <th className="p-2 text-right">Terpakai</th>
                <th className="p-2 text-right">Sisa</th>
                <th className="p-2 text-right w-36">Serapan</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {([["Biaya", grup.biaya], ["Investasi", grup.investasi]] as const).flatMap(([judul, arr]) => arr.length === 0 ? [] : [
                <tr key={"h" + judul} className={judul === "Biaya" ? "bg-amber-200/60" : "bg-indigo-100"}>
                  <td colSpan={8} className={`px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider ${judul === "Biaya" ? "text-amber-900" : "text-indigo-900"}`}>
                    {judul === "Biaya" ? "Biaya Docking" : "Investasi (belanja modal)"}
                    <span className="ml-2 font-bold normal-case tracking-normal tabular-nums">
                      pagu {rupiah(jumlahkan(arr as any).pagu)} · terpakai {rupiah(jumlahkan(arr as any).pakai)}
                    </span>
                  </td>
                </tr>,
                ...(arr as any).map((m: any) => {
                const pct = m.pagu ? Math.round((m.pakai / m.pagu) * 100) : (m.pakai ? 999 : 0);
                const s = statusRutin(pct);
                const sisaM = m.pagu - m.pakai;
                const rinci = real.list.filter((x) => x.key === m.key);
                const isOpen = openKey === m.key;
                return (
                  <Fragment key={m.key}>
                    <tr className={`border-b border-slate-200 row-hover cursor-pointer ${isOpen ? "bg-amber-100/60" : "even:bg-amber-50/40"}`} onClick={() => setOpenKey(isOpen ? null : m.key)}>
                      <td className={TD_MA}><span className="inline-flex items-center gap-1.5"><span className={`text-slate-500 text-[10px] transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>{m.ma}{rinci.length > 0 && <span className="text-[10px] font-bold text-amber-900 bg-amber-200 rounded-full px-1.5 py-px">{rinci.length}</span>}</span></td>
                      <td className={TD_PAGU}>{m.awal ? rupiah(m.awal) : <span className={m.baku ? "text-slate-400" : "text-slate-500 italic font-normal"}>{m.baku ? "0" : "—"}</span>}</td>
                      <td className="p-2 text-right tabular-nums font-bold text-violet-800">{m.add ? "+" + rupiah(m.add) : <span className="text-slate-400 font-normal">—</span>}</td>
                      <td className="p-2 text-right tabular-nums font-semibold text-slate-800">{m.pagu ? rupiah(m.pagu) : <span className={m.baku ? "text-slate-400 font-normal" : "text-slate-500 italic font-normal"}>{m.baku ? "0" : "tanpa pagu"}</span>}</td>
                      <td className={TD_PAKAI}>{rupiah(m.pakai)}</td>
                      <td className={tdSisa(sisaM)}>{rupiah(sisaM)}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2.5 rounded-full bg-slate-200 ring-1 ring-inset ring-slate-300/60 overflow-hidden">
                            <div className={`h-full rounded-full ${m.pagu ? s.bar : "bg-slate-400"}`}
                              style={{ width: m.pagu ? `${Math.max(m.pakai > 0 ? 4 : 0, Math.min(100, pct))}%` : "0%" }} />
                          </div>
                          <span className={`text-xs font-bold tabular-nums w-11 text-right ${m.pagu ? s.num : "text-slate-500"}`}>{m.pagu ? pct + "%" : "—"}</span>
                        </div>
                      </td>
                      <td className="p-2 text-center"><span className={`inline-block text-[10px] font-extrabold tracking-wide px-2.5 py-1 rounded-full ${m.pagu ? s.c : "bg-slate-100 text-slate-500 ring-1 ring-slate-300"}`}>{m.pagu ? s.t : "—"}</span></td>
                    </tr>
                    {isOpen && <tr className="bg-amber-50/60"><td colSpan={8} className="px-3 py-2"><MaDetailList list={rinci} /></td></tr>}
                  </Fragment>
                );
              }),
              ])}
            </tbody>
            <tfoot>
              <tr className={TFOOT_AMBER}>
                <td className="p-2">TOTAL</td>
                <td className="p-2 text-right tabular-nums">{rupiah(totalAwal)}</td>
                <td className="p-2 text-right tabular-nums text-violet-800">{totalAdd ? "+" + rupiah(totalAdd) : "—"}</td>
                <td className="p-2 text-right tabular-nums">{rupiah(totalPagu)}</td>
                <td className="p-2 text-right tabular-nums">{rupiah(totalPakai)}</td>
                <td className={`p-2 text-right tabular-nums ${sisa < 0 ? "text-red-700" : "text-emerald-700"}`}>{rupiah(sisa)}</td>
                <td className={`p-2 text-right tabular-nums ${tintPct(pctTot)}`}>{pctTot}%</td>
                <td className="p-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {paste !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/40" onMouseDown={() => setPaste(null)}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-5" onMouseDown={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-slate-800 mb-1">Tempel Pagu Docking dari Excel</h4>
            <p className="text-[11px] text-slate-500 mb-2">Salin 2 kolom dari "Budget Control": <b>Mata Anggaran</b> &amp; <b>Total Persetujuan</b> → tempel.</p>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={8} className="w-full border rounded-lg p-2 text-xs font-mono" placeholder={"5010403003 Kapal Ro-Ro\t852446993\n5010303001 Pelumas\t35348770\n5010403100 Permesinan\t144546074"} />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setPaste(null)} className="btn btn-ghost text-xs">Tutup</button>
              <button onClick={() => { const p = parsePlafonPaste(paste); if (p.length) { setDraft(seedDockingDraft(p)); setEdit(true); setPaste(null); } else alert("Tak terbaca."); }} className="btn btn-primary text-xs">Isi {parsePlafonPaste(paste).length || ""} baris →</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function MiniStat({ label, val, tint, bar = "bg-slate-400" }: { label: string; val: string; tint: string; bar?: string }) {
  return (
    <div className="relative bg-white rounded-xl ring-1 ring-slate-200 elev-sm pl-4 pr-3 py-2.5 overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${bar}`} />
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold">{label}</p>
      <p className={`text-xl font-extrabold tabular-nums leading-tight ${tint}`}>{val}</p>
    </div>
  );
}
