"use client";

import { useMemo, useState, useCallback } from "react";
import { useAnggaran, PengadaanRow, realisasiRutin } from "@/lib/anggaran/store";
import {
  MATA_ANGGARAN, kategoriPengadaan, kodeMA, KAPAL_ANGGARAN,
  namaKapalPenuh, MA_RENCANA, RKA, RREntry, PlafonRutin, PlafonRow, maKey, fullMA,
} from "@/lib/anggaran/types";
import { rupiah, bulanTahun } from "@/lib/format";

const estPengadaan = (r: PengadaanRow) => (r.items || []).reduce((s, it: any) => s + (it.harga || 0) * (it.jumlah || 0), 0);

export default function DashboardAnggaran() {
  const { ready, loading, pengadaan, rka, rr, plafon, reload, saveRka, saveRr, savePlafon } = useAnggaran();
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

          {/* Kendali Anggaran Rutin bulanan (pagu vs realisasi RUTIN) */}
          <AnggaranRutin plafon={plafon} pengadaan={pengadaan} onSave={savePlafon} />

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

/* ---------- CSV parser ---------- */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = []; let field = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (q) { if (c === '"' && n === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else {
      if (c === '"') q = true;
      else if (c === ",") { cur.push(field.trim()); field = ""; }
      else if (c === "\n" || (c === "\r" && n === "\n")) {
        if (c === "\r") i++;
        cur.push(field.trim()); field = "";
        if (cur.some(Boolean)) rows.push(cur);
        cur = [];
      } else if (c === "\r") { cur.push(field.trim()); field = ""; if (cur.some(Boolean)) rows.push(cur); cur = []; }
      else field += c;
    }
  }
  cur.push(field.trim()); if (cur.some(Boolean)) rows.push(cur);
  return rows;
}

/* ---------- Import dari Google Drive ---------- */
function ImportGdrive({ onImported }: { onImported: (nilai: Record<string, Record<string, number>>) => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ kapal: string; values: Record<string, number> }[] | null>(null);

  const detectCols = (headers: string[]) => {
    const h = headers.map((s) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim());
    const kapalIdx = h.findIndex((s) => /^(kapal|nama|kapal|ship|nama kapal)$/.test(s));
    const cols: { kode: string; idx: number }[] = [];
    for (const ma of MA_RENCANA) {
      const lbl = ma.label.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
      const idx = h.findIndex((s) => s.includes(lbl) || s.includes(ma.kode));
      if (idx >= 0) cols.push({ kode: ma.kode, idx });
    }
    return { kapalIdx, cols };
  };

  const fetchAndPreview = useCallback(async () => {
    setError(""); setPreview(null); setLoading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Gagal mengambil data. Pastikan URL CSV publik sudah benar.");
      const text = await res.text();
      const rows = parseCSV(text);
      if (rows.length < 2) throw new Error("CSV tidak memiliki data.");
      const { kapalIdx, cols } = detectCols(rows[0]);
      if (kapalIdx < 0) throw new Error("Kolom 'Kapal' tidak ditemukan di header CSV.");
      if (!cols.length) throw new Error("Tidak ada kolom mata anggaran yang dikenali. Header harus mengandung: Kapal Ro-Ro, Akomodasi, Permesinan");
      const data = rows.slice(1).map((row) => {
        const kapal = namaKapalPenuh(row[kapalIdx] || "");
        const values: Record<string, number> = {};
        for (const c of cols) values[c.kode] = parseInt(row[c.idx]?.replace(/[^\d\-]/g, "") || "0", 10) || 0;
        return { kapal, values };
      }).filter((d) => d.kapal && KAPAL_ANGGARAN.includes(d.kapal) && Object.values(d.values).some((v) => v > 0));
      if (!data.length) throw new Error("Tidak ada data kapal yang cocok. Pastikan nama kapal sesuai (KMP. ...)");
      setPreview(data);
    } catch (e: any) { setError(e.message || "Gagal parsing CSV."); }
    finally { setLoading(false); }
  }, [url]);

  const terapkan = () => {
    if (!preview) return;
    const nilai: Record<string, Record<string, number>> = {};
    for (const d of preview) nilai[d.kapal] = d.values;
    onImported(nilai);
    setPreview(null); setUrl("");
  };

  return (
    <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/50 mb-4">
      <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
        <span>📁</span> Import dari Google Drive (CSV publik)
      </p>
      <p className="text-[11px] text-slate-400 mb-2">
        Buka Google Sheet → File → Bagikan → Publikasikan ke web → Pilih format CSV → Salin link, lalu tempel di sini.
      </p>
      <div className="flex items-stretch gap-2">
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
          className="flex-1 text-xs border rounded-lg px-3 py-2 bg-white" />
        <button onClick={fetchAndPreview} disabled={loading || !url.trim()} className="btn btn-primary text-xs shrink-0">
          {loading ? "Memuat…" : "🔍 Lihat"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {preview && (
        <div className="mt-3">
          <p className="text-[11px] text-green-700 font-medium mb-1.5">{preview.length} kapal ditemukan</p>
          <div className="overflow-x-auto max-h-36 overflow-y-auto rounded-lg border text-xs">
            <table className="w-full">
              <thead><tr className="bg-slate-100">{["Kapal", ...MA_RENCANA.map((m) => m.label)].map((h) => <th key={h} className="p-1.5 text-left">{h}</th>)}</tr></thead>
              <tbody>
                {preview.slice(0, 13).map((d) => (
                  <tr key={d.kapal} className="border-t">
                    <td className="p-1.5 font-medium text-slate-700">{d.kapal}</td>
                    {MA_RENCANA.map((m) => <td key={m.kode} className="p-1.5 text-right">{rupiah(d.values[m.kode] || 0)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => { setPreview(null); setUrl(""); }} className="btn btn-ghost text-xs">Batal</button>
            <button onClick={terapkan} className="btn btn-primary text-xs">✅ Terapkan ke Grid</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Rencana & Realisasi ---------- */
function RencanaRealisasi({ rr, onSave }: { rr: RREntry[]; onSave: (r: RREntry[]) => Promise<void> }) {
  const now = new Date();
  const [bulan, setBulan] = useState(now.toISOString().slice(0, 7));
  const [tipe, setTipe] = useState<"rencana" | "realisasi">("rencana");
  const [busy, setBusy] = useState(false);
  const [showImport, setShowImport] = useState(false);

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
          <button onClick={() => setShowImport(!showImport)} className={`btn text-xs ${showImport ? "btn-ghost" : "btn-ghost"}`}>📁 GDrive</button>
          <button onClick={simpan} disabled={busy} className="btn btn-primary text-xs">{busy ? "Menyimpan…" : "💾 Simpan"}</button>
        </div>
      </div>
      {showImport && (
        <ImportGdrive onImported={(nilai) => {
          setGrid((g) => {
            const next = { ...g };
            for (const [kapal, vals] of Object.entries(nilai)) {
              next[kapal] = { ...(next[kapal] || {}), ...vals };
            }
            return next;
          });
          setShowImport(false);
        }} />
      )}
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
const statusRutin = (pct: number) => pct > 100 ? { c: "text-red-600 bg-red-50", t: "OVERBUDGET" } : pct >= 80 ? { c: "text-amber-600 bg-amber-50", t: "Waspada" } : { c: "text-emerald-600 bg-emerald-50", t: "Aman" };

function AnggaranRutin({ plafon, pengadaan, onSave }: { plafon: PlafonRutin[]; pengadaan: PengadaanRow[]; onSave: (p: PlafonRutin[]) => Promise<void> }) {
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

  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<PlafonRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);

  // gabung pagu + realisasi (termasuk realisasi tanpa pagu)
  const merged = useMemo(() => {
    const by: Record<string, { ma: string; pagu: number; pakai: number }> = {};
    rows.forEach((r) => { const k = maKey(r.ma); by[k] = { ma: r.ma, pagu: (by[k]?.pagu || 0) + (r.nilai || 0), pakai: by[k]?.pakai || 0 }; });
    Object.entries(real.perKey).forEach(([k, v]) => {
      if (by[k]) by[k].pakai = v;
      else { const lbl = real.list.find((x) => x.key === k)?.ma || k; by[k] = { ma: lbl, pagu: 0, pakai: v }; }
    });
    return Object.values(by).sort((x, y) => (y.pakai / (y.pagu || 1)) - (x.pakai / (x.pagu || 1)));
  }, [rows, real]);

  const totalPagu = rows.reduce((s, r) => s + (r.nilai || 0), 0);
  const totalPakai = real.total;
  const sisa = totalPagu - totalPakai;
  const pctTot = totalPagu ? Math.round((totalPakai / totalPagu) * 100) : 0;

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
  const simpan = async () => {
    setBusy(true);
    try {
      const clean = draft.filter((r) => r.ma.trim() && r.nilai);
      const next = plafon.filter((p) => p.bulan !== bulan);
      if (clean.length) next.push({ bulan, rows: clean });
      await onSave(next);
      setEdit(false);
    } finally { setBusy(false); }
  };

  return (
    <Card title="Kendali Anggaran Rutin (Persetujuan Rutin per bulan)" icon="🧭">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input type="month" value={bulan} onChange={(e) => setBulanSel(e.target.value)}
          className="text-xs border px-2.5 py-1.5 rounded-lg bg-white" title="Pilih bulan mana pun (termasuk bulan baru)" />
        {bulanList.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">ada data:</span>
            {bulanList.slice(0, 6).map((b) => (
              <button key={b} onClick={() => setBulanSel(b)}
                className={`text-[10px] px-1.5 py-0.5 rounded-md border transition ${b === bulan ? "bg-[#16357f] text-white border-[#16357f]" : "border-slate-300 text-slate-500 hover:border-[#1ca3dd] hover:text-[#16357f]"}`}>
                {bulanTahun(b + "-01")}
              </button>
            ))}
          </div>
        )}
        <span className="text-[11px] text-slate-400">realisasi = SPPBJ kategori RUTIN bulan ini (final bila ada, else estimasi)</span>
        <div className="ml-auto flex items-center gap-2">
          {!edit ? (
            <>
              <button onClick={bulanLain} className="btn btn-ghost text-xs" title={`Siapkan pagu ${bulanTahun(nextMonth(bulan) + "-01")} (disalin dari bulan ini)`}>➕ Pagu Bulan Lain</button>
              <button onClick={startEdit} className="btn btn-ghost text-xs">✏️ Atur Pagu</button>
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
        <MiniStat label="Total Pagu" val={rupiah(totalPagu)} tint="text-slate-800" />
        <MiniStat label="Terpakai" val={rupiah(totalPakai)} tint="text-blue-700" />
        <MiniStat label="Sisa" val={rupiah(sisa)} tint={sisa < 0 ? "text-red-600" : "text-emerald-700"} />
        <MiniStat label="Serapan" val={`${pctTot}%`} tint={pctTot > 100 ? "text-red-600" : "text-slate-800"} />
      </div>

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
        <p className="text-sm text-slate-400 py-3 text-center">Belum ada pagu/realisasi rutin bulan ini. Klik <b>Atur Pagu</b> untuk isi dari dokumen Persetujuan.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr><th className="p-2 text-left">Mata Anggaran</th><th className="p-2 text-right">Pagu</th><th className="p-2 text-right">Terpakai</th><th className="p-2 text-right">Sisa</th><th className="p-2 text-right w-40">Serapan</th><th className="p-2 text-center">Status</th></tr>
            </thead>
            <tbody>
              {merged.map((m, i) => {
                const pct = m.pagu ? Math.round((m.pakai / m.pagu) * 100) : (m.pakai ? 999 : 0);
                const s = statusRutin(pct);
                const sisaM = m.pagu - m.pakai;
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-2 text-slate-700">{m.ma}</td>
                    <td className="p-2 text-right text-slate-600">{m.pagu ? rupiah(m.pagu) : <span className="text-slate-300">tanpa pagu</span>}</td>
                    <td className="p-2 text-right font-medium text-slate-800">{rupiah(m.pakai)}</td>
                    <td className={`p-2 text-right font-semibold ${sisaM < 0 ? "text-red-600" : "text-emerald-700"}`}>{rupiah(sisaM)}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${pct > 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className="text-[11px] text-slate-500 w-9 text-right">{m.pagu ? pct + "%" : "—"}</span>
                      </div>
                    </td>
                    <td className="p-2 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.c}`}>{m.pagu ? s.t : "—"}</span></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold text-slate-700">
                <td className="p-2">TOTAL</td>
                <td className="p-2 text-right">{rupiah(totalPagu)}</td>
                <td className="p-2 text-right">{rupiah(totalPakai)}</td>
                <td className={`p-2 text-right ${sisa < 0 ? "text-red-600" : "text-emerald-700"}`}>{rupiah(sisa)}</td>
                <td className="p-2 text-right">{pctTot}%</td>
                <td className="p-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* daftar pengadaan rutin bulan ini */}
      {!edit && real.list.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-700">{real.list.length} pengadaan RUTIN bulan ini</summary>
          <ul className="mt-2 space-y-1">
            {real.list.map((x) => (
              <li key={x.id} className="flex justify-between gap-3 border-b border-slate-100 pb-1">
                <span className="text-slate-600 truncate">{x.nama} <span className="text-slate-300">· {x.ma || "tanpa MA"}</span></span>
                <span className="font-medium text-slate-700 whitespace-nowrap">{rupiah(x.nilai)}</span>
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

function MiniStat({ label, val, tint }: { label: string; val: string; tint: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
      <p className={`text-lg font-extrabold ${tint}`}>{val}</p>
    </div>
  );
}
