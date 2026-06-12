"use client";

import { useMemo, useState } from "react";
import { useAnggaran, PengadaanRow } from "@/lib/anggaran/store";
import {
  MATA_ANGGARAN, kategoriPengadaan, kodeMA, KAPAL_ANGGARAN,
  namaKapalPenuh, MA_RENCANA, RKA, RREntry,
} from "@/lib/anggaran/types";
import { rupiah, bulanTahun } from "@/lib/format";

const estPengadaan = (r: PengadaanRow) => (r.items || []).reduce((s, it: any) => s + (it.harga || 0) * (it.jumlah || 0), 0);

export default function DashboardAnggaran() {
  const { ready, loading, pengadaan, rka, rr, reload, saveRka, saveRr } = useAnggaran();
  const [tahun, setTahun] = useState<string>("");

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
      // per mata anggaran (bagi rata bila >1 MA)
      const codes = (r.mataAnggaran.length ? r.mataAnggaran.map(kodeMA).filter(Boolean) : [""]);
      for (const c of codes) perMA[c] = (perMA[c] || 0) + est / codes.length;
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

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex flex-wrap items-center gap-4">
          <div className="h-12 w-12 rounded-2xl asdp-gradient grid place-items-center text-2xl text-white shadow-md shrink-0">📊</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold asdp-text-gradient tracking-tight">Dashboard Anggaran</h1>
            <p className="text-slate-500 text-sm">Resume penyerapan anggaran — gabungan SPPBJ Pengadaan &amp; SPPBJ Non PR PO</p>
          </div>
          <select value={tahun} onChange={(e) => setTahun(e.target.value)} className="text-xs border px-2.5 py-1.5 rounded-lg bg-white">
            <option value="">Semua tahun</option>
            {tahunList.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={reload} className="btn btn-ghost text-xs">↻ Muat ulang</button>
        </div>
      </div>

      {!ready ? (
        <p className="mt-5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">Dashboard butuh Supabase (env) untuk membaca data pengadaan.</p>
      ) : loading ? (
        <p className="mt-5 text-sm text-slate-400">Memuat…</p>
      ) : (
        <>
          {/* KPI */}
          <section className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
            <Kpi label="Total Penyerapan" value={rupiah(a.total)} sub={`${a.n} pengadaan`} icon="💰" tint="blue" />
            <Kpi label="Penyerapan Biaya" value={rupiah(a.biaya)} sub="mata anggaran 501x" icon="🛠️" tint="teal" />
            <Kpi label="Penyerapan Investasi" value={rupiah(a.investasi)} sub="mata anggaran 10206x" icon="📈" tint="indigo" />
            <Kpi label="RKA (acuan)" value={rupiah(rkaTotal)} sub={rkaTotal ? `terserap ${serapPct}%` : "belum diisi"} icon="🎯" tint="green" />
          </section>

          {/* RKA vs penyerapan */}
          <RkaSection rka={rka} perMA={a.perMA} onSave={saveRka} />

          {/* Penyerapan per mata anggaran */}
          <Card title="Penyerapan per Mata Anggaran (Biaya & Investasi)" icon="🏷️">
            <MaTable perMA={a.perMA} />
          </Card>

          {/* Penyerapan per kapal */}
          <Card title="Penyerapan per Kapal" icon="🚢">
            <KapalTable perKapal={a.perKapal} />
          </Card>

          {/* Rencana & Realisasi */}
          <RencanaRealisasi rr={rr} onSave={saveRr} />
        </>
      )}
    </main>
  );
}

/* ---------- KPI & Card ---------- */
function Kpi({ label, value, sub, icon, tint }: { label: string; value: string; sub: string; icon: string; tint: string }) {
  const T: Record<string, string> = { blue: "bg-blue-100 text-blue-600", teal: "bg-cyan-100 text-cyan-600", indigo: "bg-indigo-100 text-indigo-600", green: "bg-green-100 text-green-600" };
  return (
    <div className="bg-white rounded-2xl ring-line elev-sm p-4 card-hover border border-transparent">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 font-bold">{label}</p>
        <span className={`grid place-items-center h-7 w-7 rounded-lg text-sm ${T[tint]}`}>{icon}</span>
      </div>
      <p className="text-lg font-extrabold text-slate-800 mt-1.5 leading-tight">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}
function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 bg-white rounded-2xl elev-md ring-line p-5 anim-in">
      <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
        <span className="h-8 w-8 rounded-lg asdp-gradient text-white grid place-items-center text-sm">{icon}</span>
        <span className="accent-bar">{title}</span>
      </h3>
      {children}
    </div>
  );
}

/* ---------- RKA ---------- */
function RkaSection({ rka, perMA, onSave }: { rka: RKA; perMA: Record<string, number>; onSave: (r: RKA) => Promise<void> }) {
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
          <thead className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50">
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
              return (
                <tr key={m.kode} className="border-b last:border-0">
                  <td className="p-2"><span className="font-mono text-xs text-slate-400">{m.kode}</span> {m.label}</td>
                  <td className="p-2 text-center"><span className={`chip ${m.kategori === "Investasi" ? "bg-indigo-100 text-indigo-700" : "bg-cyan-100 text-cyan-700"}`}>{m.kategori}</span></td>
                  <td className="p-2 text-right">
                    {edit ? (
                      <input type="number" value={draft[m.kode] || ""} onChange={(e) => setDraft({ ...draft, [m.kode]: +e.target.value })}
                        className="w-32 text-right border rounded px-2 py-1 text-xs" placeholder="0" />
                    ) : (rkaV ? rupiah(rkaV) : <span className="text-slate-300">—</span>)}
                  </td>
                  <td className="p-2 text-right text-slate-600">{rupiah(serap)}</td>
                  <td className="p-2 text-right">
                    {rkaV ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className={sisa < 0 ? "text-red-600 font-semibold" : "text-slate-500"}>{rupiah(sisa)}</span>
                        <span className={`chip ${pct > 100 ? "bg-red-100 text-red-700" : pct >= 80 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>{pct}%</span>
                      </div>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
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
function MaTable({ perMA }: { perMA: Record<string, number> }) {
  const rows = MATA_ANGGARAN.map((m) => ({ ...m, nilai: Math.round(perMA[m.kode] || 0) })).filter((r) => r.nilai > 0).sort((x, y) => y.nilai - x.nilai);
  const max = Math.max(1, ...rows.map((r) => r.nilai));
  if (!rows.length) return <p className="text-xs text-slate-400">Belum ada penyerapan.</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((m) => (
        <div key={m.kode}>
          <div className="flex items-center justify-between text-xs mb-1 gap-3">
            <span className="text-slate-600 truncate"><span className="font-mono text-slate-400">{m.kode}</span> {m.label}
              <span className={`chip ml-2 ${m.kategori === "Investasi" ? "bg-indigo-100 text-indigo-700" : "bg-cyan-100 text-cyan-700"}`}>{m.kategori}</span>
            </span>
            <span className="text-slate-700 font-semibold shrink-0">{rupiah(m.nilai)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${m.kategori === "Investasi" ? "bg-gradient-to-r from-indigo-500 to-blue-700" : "bg-gradient-to-r from-[#14b8c4] to-[#16357f]"}`} style={{ width: `${(m.nilai / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- per Kapal ---------- */
function KapalTable({ perKapal }: { perKapal: Record<string, { Biaya: number; Investasi: number }> }) {
  const rows = Object.entries(perKapal).map(([k, v]) => ({ kapal: k, ...v, total: v.Biaya + v.Investasi }))
    .filter((r) => r.total > 0).sort((x, y) => y.total - x.total);
  if (!rows.length) return <p className="text-xs text-slate-400">Belum ada penyerapan per kapal.</p>;
  const tB = rows.reduce((s, r) => s + r.Biaya, 0), tI = rows.reduce((s, r) => s + r.Investasi, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50">
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

/* ---------- Rencana & Realisasi ---------- */
function RencanaRealisasi({ rr, onSave }: { rr: RREntry[]; onSave: (r: RREntry[]) => Promise<void> }) {
  const now = new Date();
  const [bulan, setBulan] = useState(now.toISOString().slice(0, 7));
  const [tipe, setTipe] = useState<"rencana" | "realisasi">("rencana");
  const [busy, setBusy] = useState(false);

  const entry = rr.find((e) => e.bulan === bulan && e.tipe === tipe);
  const [grid, setGrid] = useState<Record<string, Record<string, number>>>({});
  // sinkron grid saat ganti bulan/tipe
  const key = bulan + tipe;
  const [lastKey, setLastKey] = useState("");
  if (key !== lastKey) { setLastKey(key); setGrid(entry?.nilai || {}); }

  const setCell = (kapal: string, kode: string, v: number) =>
    setGrid((g) => ({ ...g, [kapal]: { ...(g[kapal] || {}), [kode]: v } }));

  const simpan = async () => {
    setBusy(true);
    try {
      const next = rr.filter((e) => !(e.bulan === bulan && e.tipe === tipe));
      next.push({ bulan, tipe, nilai: grid });
      await onSave(next);
    } finally { setBusy(false); }
  };

  const totalKode = (kode: string) => KAPAL_ANGGARAN.reduce((s, k) => s + (grid[k]?.[kode] || 0), 0);
  const totalAll = MA_RENCANA.reduce((s, m) => s + totalKode(m.kode), 0);

  return (
    <div className="mt-5 bg-white rounded-2xl elev-md ring-line p-5 anim-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg asdp-gradient text-white grid place-items-center text-sm">📆</span>
          <span className="accent-bar">Rencana &amp; Realisasi Bulanan (Biaya)</span>
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden ring-1 ring-slate-200">
            {(["rencana", "realisasi"] as const).map((t) => (
              <button key={t} onClick={() => setTipe(t)} className={`text-xs px-3 py-1.5 capitalize ${tipe === t ? "asdp-gradient text-white" : "bg-white text-slate-600"}`}>{t}</button>
            ))}
          </div>
          <input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5" />
          <button onClick={simpan} disabled={busy} className="btn btn-primary text-xs">{busy ? "Menyimpan…" : "💾 Simpan"}</button>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        {tipe === "rencana" ? "Rencana" : "Realisasi"} <b>{bulanTahun(bulan + "-01")}</b> · hanya mata anggaran <b>Biaya</b> (Kapal Ro-Ro, Akomodasi, Permesinan). Acuan: RKA.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50">
            <tr>
              <th className="p-2 text-left">Kapal</th>
              {MA_RENCANA.map((m) => <th key={m.kode} className="p-2 text-right w-36">{m.label}</th>)}
              <th className="p-2 text-right w-36">Total</th>
            </tr>
          </thead>
          <tbody>
            {KAPAL_ANGGARAN.map((k) => {
              const rowTot = MA_RENCANA.reduce((s, m) => s + (grid[k]?.[m.kode] || 0), 0);
              return (
                <tr key={k} className="border-b last:border-0">
                  <td className="p-2 font-medium text-slate-700">{k}</td>
                  {MA_RENCANA.map((m) => (
                    <td key={m.kode} className="p-1 text-right">
                      <input type="number" value={grid[k]?.[m.kode] || ""} onChange={(e) => setCell(k, m.kode, +e.target.value)}
                        className="w-28 text-right border rounded px-2 py-1 text-xs" placeholder="0" />
                    </td>
                  ))}
                  <td className="p-2 text-right font-semibold text-slate-700">{rowTot ? rupiah(rowTot) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-bold text-slate-700">
              <td className="p-2">TOTAL</td>
              {MA_RENCANA.map((m) => <td key={m.kode} className="p-2 text-right">{rupiah(totalKode(m.kode))}</td>)}
              <td className="p-2 text-right">{rupiah(totalAll)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
