"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSppbj } from "@/lib/sppbj/store";
import { sppbjTotal, hargaSpbjOf, STATUS_LABEL, STATUS_COLOR, SppbjStatus } from "@/lib/sppbj/types";
import { rupiah, bulanTahun } from "@/lib/format";

const reqEstimasi = (p: any) => sppbjTotal(p?.items || []);
const reqFinal = (p: any) => (p?.items || []).reduce((s: number, it: any) => s + hargaSpbjOf(it) * (it.jumlah || 0), 0);
// kategori anggaran dari nama pengadaan: ada kata "investasi" -> Investasi, lainnya -> Biaya
const kategoriAnggaran = (nama: string): "Investasi" | "Biaya" => (/investasi/i.test(nama || "") ? "Investasi" : "Biaya");

export default function SppbjAnalisa() {
  const { listRemote, loadById, supabaseReady } = useSppbj();
  const router = useRouter();
  const openRow = (r: any) => { loadById(r); router.push("/sppbj/detail"); };
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulan, setBulan] = useState("");

  useEffect(() => { if (supabaseReady) { setLoading(true); listRemote().then((r) => { setRows(r); setLoading(false); }); } /* eslint-disable-next-line */ }, [supabaseReady]);

  const ym = (r: any) => (r.payload?.tanggal || "").slice(0, 7);
  const bulanList = useMemo(() => Array.from(new Set(rows.map(ym).filter(Boolean))).sort().reverse(), [rows]);
  const data = useMemo(() => (bulan ? rows.filter((r) => ym(r) === bulan) : rows), [rows, bulan]);

  const a = useMemo(() => {
    let estimasi = 0, final = 0;
    const byStatus: Record<string, { n: number; nilai: number }> = {};
    const byMA: Record<string, { n: number; nilai: number }> = {};
    const byBulan: Record<string, number> = {};
    const byKat: Record<"Biaya" | "Investasi", { n: number; nilai: number }> = { Biaya: { n: 0, nilai: 0 }, Investasi: { n: 0, nilai: 0 } };
    for (const r of data) {
      const p = r.payload || {};
      const est = reqEstimasi(p);
      estimasi += est; final += reqFinal(p);
      const kat = kategoriAnggaran(r.nama_pengadaan || p.namaPengadaan || "");
      byKat[kat].n++; byKat[kat].nilai += est;
      const st = p.status || "menunggu_spbj";
      (byStatus[st] = byStatus[st] || { n: 0, nilai: 0 }).n++; byStatus[st].nilai += est;
      const mas: string[] = Array.isArray(p.mataAnggaran) && p.mataAnggaran.length ? p.mataAnggaran : ["(Tanpa Mata Anggaran)"];
      for (const m of mas) { (byMA[m] = byMA[m] || { n: 0, nilai: 0 }).n++; byMA[m].nilai += est / mas.length; }
      const b = ym(r); if (b) byBulan[b] = (byBulan[b] || 0) + est;
    }
    const maList = Object.entries(byMA).map(([k, v]) => ({ k, ...v })).sort((x, y) => y.nilai - x.nilai);
    const bulanSeries = Object.entries(byBulan).map(([k, v]) => ({ k, v })).sort((x, y) => x.k.localeCompare(y.k));
    const top = data.map((r) => ({ nama: r.nama_pengadaan || "(tanpa nama)", nilai: reqEstimasi(r.payload), st: r.payload?.status, row: r }))
      .sort((x, y) => y.nilai - x.nilai).slice(0, 5);
    return { estimasi, final, ppn: Math.round(estimasi * 0.11), grand: Math.round(estimasi * 1.11), n: data.length, byStatus, byKat, maList, bulanSeries, top };
  }, [data]);

  const maMax = Math.max(1, ...a.maList.map((m) => m.nilai));
  const bMax = Math.max(1, ...a.bulanSeries.map((b) => b.v));

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <Link href="/sppbj" className="btn btn-ghost text-sm mb-4 inline-flex">← Kembali ke SPPBJ Pengadaan</Link>
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl asdp-gradient grid place-items-center text-2xl text-white shadow-md shrink-0">📊</div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold asdp-text-gradient tracking-tight">Analisa Anggaran</h1>
            <p className="text-slate-500 text-sm">Ringkasan nilai pengadaan per status, kategori, mata anggaran &amp; periode</p>
          </div>
          {supabaseReady && (
            <select value={bulan} onChange={(e) => setBulan(e.target.value)} className="text-xs border px-2.5 py-1.5 rounded-lg bg-white">
              <option value="">Semua bulan</option>
              {bulanList.map((b) => <option key={b} value={b}>{bulanTahun(b + "-01")}</option>)}
            </select>
          )}
        </div>
      </div>

      {!supabaseReady ? (
        <p className="mt-5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">Analisa butuh Supabase (env) untuk membaca riwayat.</p>
      ) : loading ? (
        <p className="mt-5 text-sm text-slate-400">Memuat…</p>
      ) : (
        <>
          {/* KPI */}
          <section className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
            <Kpi label="Total Pengadaan" value={String(a.n)} sub={`${bulan ? bulanTahun(bulan + "-01") : "semua bulan"}`} icon="📑" tint="blue" />
            <Kpi label="Nilai Estimasi" value={rupiah(a.estimasi)} sub="sebelum PPN" icon="💵" tint="teal" />
            <Kpi label="PPN 11%" value={rupiah(a.ppn)} sub="estimasi pajak" icon="🧾" tint="amber" />
            <Kpi label="Grand Total" value={rupiah(a.grand)} sub="estimasi + PPN" icon="💰" tint="green" />
          </section>

          {a.n === 0 ? (
            <div className="mt-5 text-center bg-white rounded-2xl ring-line elev-sm p-10 text-slate-400 text-sm">Belum ada data pengadaan{bulan ? " di bulan ini" : ""}.</div>
          ) : (
            <>
            {/* Biaya vs Investasi */}
            <div className="mt-5 bg-white rounded-2xl elev-md ring-line p-5 anim-in">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                <span className="h-8 w-8 rounded-lg asdp-gradient text-white grid place-items-center text-sm">⚖️</span>
                <span className="accent-bar">Biaya vs Investasi</span>
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {([["Biaya", "from-cyan-500 to-teal-600", "🛠️"], ["Investasi", "from-indigo-500 to-blue-700", "📈"]] as const).map(([k, grad, ic]) => {
                  const v = a.byKat[k];
                  const pct = a.estimasi ? Math.round((v.nilai / a.estimasi) * 100) : 0;
                  return (
                    <div key={k} className="rounded-xl ring-1 ring-slate-100 p-4">
                      <div className="flex items-center gap-2.5">
                        <span className={`grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br ${grad} text-white text-lg shadow-sm`}>{ic}</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-700">{k}</p>
                          <p className="text-[11px] text-slate-400">{v.n} pengadaan · {pct}% dari total</p>
                        </div>
                        <p className="text-lg font-extrabold asdp-text-gradient">{rupiah(v.nilai)}</p>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-3">
                        <div className={`h-full rounded-full bg-gradient-to-r ${grad}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-3">Kategori otomatis dari nama pengadaan: mengandung kata <b>&quot;Investasi&quot;</b> → Investasi, selain itu → Biaya.</p>
            </div>

            <div className="mt-5 grid lg:grid-cols-2 gap-5">
              {/* Per status */}
              <Card title="Distribusi Status" icon="🚦">
                <div className="space-y-3">
                  {(["menunggu_spbj", "spbj_terbit", "selesai"] as SppbjStatus[]).map((st) => {
                    const v = a.byStatus[st] || { n: 0, nilai: 0 };
                    const pct = a.estimasi ? Math.round((v.nilai / a.estimasi) * 100) : 0;
                    return (
                      <div key={st}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className={`chip ${STATUS_COLOR[st]}`}>{STATUS_LABEL[st]} · {v.n}</span>
                          <span className="text-slate-600 font-semibold">{rupiah(v.nilai)}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full asdp-gradient transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Per bulan */}
              <Card title="Nilai per Bulan" icon="📅">
                {a.bulanSeries.length === 0 ? <p className="text-xs text-slate-400">—</p> : (
                  <div className="flex items-end gap-2 h-40 pt-2">
                    {a.bulanSeries.map((b) => (
                      <div key={b.k} className="flex-1 flex flex-col items-center justify-end gap-1.5 group">
                        <span className="text-[10px] text-slate-500 font-semibold opacity-0 group-hover:opacity-100 transition">{rupiah(b.v)}</span>
                        <div className="w-full rounded-t-lg asdp-gradient transition-all" style={{ height: `${Math.max(4, (b.v / bMax) * 100)}%` }} title={rupiah(b.v)} />
                        <span className="text-[10px] text-slate-400">{bulanTahun(b.k + "-01").split(" ")[0].slice(0, 3)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Per mata anggaran */}
              <Card title="Nilai per Mata Anggaran" icon="🏷️" full>
                <div className="space-y-2.5">
                  {a.maList.map((m) => (
                    <div key={m.k}>
                      <div className="flex items-center justify-between text-xs mb-1 gap-3">
                        <span className="text-slate-600 truncate">{m.k}</span>
                        <span className="text-slate-700 font-semibold shrink-0">{rupiah(m.nilai)} · {m.n}×</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#14b8c4] to-[#16357f]" style={{ width: `${(m.nilai / maMax) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Top pengadaan */}
              <Card title="Pengadaan Nilai Tertinggi" icon="🏆" full>
                <div className="divide-y divide-slate-100">
                  {a.top.map((t, i) => (
                    <button key={i} onClick={() => openRow(t.row)} className="w-full flex items-center gap-3 py-2.5 text-left row-hover rounded-lg px-2 -mx-2">
                      <span className={`grid place-items-center h-7 w-7 rounded-lg text-xs font-bold shrink-0 ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span>
                      <span className="flex-1 text-sm text-slate-700 truncate">{t.nama}</span>
                      {t.st && <span className={`chip ${STATUS_COLOR[t.st as SppbjStatus] || ""} hidden sm:inline-flex`}>{STATUS_LABEL[t.st as SppbjStatus]}</span>}
                      <span className="text-sm font-bold asdp-text-gradient shrink-0">{rupiah(t.nilai)}</span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

function Kpi({ label, value, sub, icon, tint }: { label: string; value: string; sub: string; icon: string; tint: "blue" | "teal" | "amber" | "green" }) {
  const T = { blue: "bg-blue-100 text-blue-600", teal: "bg-cyan-100 text-cyan-600", amber: "bg-amber-100 text-amber-600", green: "bg-green-100 text-green-600" }[tint];
  return (
    <div className="bg-white rounded-2xl ring-line elev-sm p-4 card-hover border border-transparent">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 font-bold">{label}</p>
        <span className={`grid place-items-center h-7 w-7 rounded-lg text-sm ${T}`}>{icon}</span>
      </div>
      <p className="text-lg font-extrabold text-slate-800 mt-1.5 leading-tight">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

function Card({ title, icon, children, full }: { title: string; icon: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl elev-md ring-line p-5 anim-in ${full ? "lg:col-span-2" : ""}`}>
      <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
        <span className="h-8 w-8 rounded-lg asdp-gradient text-white grid place-items-center text-sm">{icon}</span>
        <span className="accent-bar">{title}</span>
      </h3>
      {children}
    </div>
  );
}
