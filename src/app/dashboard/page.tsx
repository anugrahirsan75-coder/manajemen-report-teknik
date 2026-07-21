"use client";

import { useMemo, useState, useCallback, Fragment } from "react";
import { useAnggaran, PengadaanRow, realisasiRutin, realisasiDocking, nilaiPerMA } from "@/lib/anggaran/store";
import {
  MATA_ANGGARAN, kategoriPengadaan, kodeMA, KAPAL_ANGGARAN,
  namaKapalPenuh, MA_RENCANA, RKA, RREntry, PlafonRutin, PlafonDocking, PlafonRow, maKey, fullMA, DOCKING_MA,
} from "@/lib/anggaran/types";
import { rupiah, bulanTahun, tanggalIndo } from "@/lib/format";

const estPengadaan = (r: PengadaanRow) => (r.items || []).reduce((s, it: any) => s + (it.harga || 0) * (it.jumlah || 0), 0);

export default function DashboardAnggaran() {
  const { ready, loading, pengadaan, rka, rr, plafon, docking, reload, saveRka, saveRr, savePlafon, saveDocking } = useAnggaran();
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
    const by: Record<string, { id: string; nama: string; nilai: number; sumber: string; tanggal: string }[]> = {};
    for (const r of data) {
      for (const [ma, v] of Object.entries(nilaiPerMA(r, undefined, false))) {
        const c = kodeMA(ma);
        if (!c || v <= 0) continue;
        (by[c] ||= []).push({ id: r.id, nama: r.nama, nilai: v, sumber: r.sumber, tanggal: r.tanggal });
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
        <p className="mt-5 text-sm text-slate-500">Memuat…</p>
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

          {/* Kendali Anggaran Docking per kapal (pagu Persetujuan Pusat vs realisasi DOCKING) */}
          <AnggaranDocking docking={docking} pengadaan={pengadaan} onSave={saveDocking} />

          {/* RKA vs penyerapan */}
          <RkaSection rka={rka} perMA={a.perMA} detail={detailMA} onSave={saveRka} />

          {/* Penyerapan per mata anggaran */}
          <Card title="Penyerapan per Mata Anggaran (Biaya & Investasi)" icon="🏷️">
            <MaTable perMA={a.perMA} detail={detailMA} />
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
        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold">{label}</p>
        <span className={`grid place-items-center h-7 w-7 rounded-lg text-sm ${T[tint]}`}>{icon}</span>
      </div>
      <p className="text-lg font-extrabold tabular-nums text-slate-900 mt-1.5 leading-tight">{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
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

/* ---------- rincian pengadaan per MA (reusable) ---------- */
type MaDetailItem = { id: string; nama: string; nilai: number; sumber: string; tanggal: string };
function MaDetailList({ list }: { list: MaDetailItem[] }) {
  if (!list || !list.length) return <p className="text-[11px] text-slate-500 py-1">Belum ada pengadaan pada Mata Anggaran ini.</p>;
  return (
    <table className="w-full text-[11px]"><tbody>
      {list.map((x) => (
        <tr key={x.id} className="border-b border-slate-200 last:border-0">
          <td className="py-1 pr-2 w-20"><span className={`px-1.5 py-0.5 rounded font-bold ${x.sumber === "Non PR PO" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"}`}>{x.sumber === "Non PR PO" ? "Non PR PO" : "SPPBJ"}</span></td>
          <td className="py-1 pr-2 text-slate-800">{x.nama}</td>
          <td className="py-1 pr-2 text-slate-500 whitespace-nowrap w-24">{x.tanggal ? tanggalIndo(x.tanggal) : "—"}</td>
          <td className="py-1 text-right font-bold tabular-nums text-slate-900 whitespace-nowrap">{rupiah(x.nilai)}</td>
        </tr>
      ))}
    </tbody></table>
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
      <p className="text-[11px] text-slate-500 mb-2">
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
      <p className="text-[11px] text-slate-500 mb-3">
        {tipe === "rencana" ? "Rencana" : "Realisasi"} <b>{bulanTahun(bulan + "-01")}</b> · hanya mata anggaran <b>Biaya</b> (Kapal Ro-Ro, Akomodasi, Permesinan). Acuan: RKA.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-slate-600 font-bold bg-slate-100 border-b-2 border-slate-200">
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
// status pagu -> warna badge (c), warna bar (bar), warna angka % (num). Kontras tinggi biar terbaca.
const statusRutin = (pct: number) =>
  pct > 100
    ? { c: "bg-red-100 text-red-800 ring-1 ring-red-300", t: "OVERBUDGET", bar: "bg-red-500", num: "text-red-700" }
    : pct >= 80
    ? { c: "bg-amber-100 text-amber-800 ring-1 ring-amber-300", t: "Waspada", bar: "bg-amber-500", num: "text-amber-700" }
    : { c: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300", t: "Aman", bar: "bg-emerald-500", num: "text-emerald-700" };

/* kelas tabel kendali anggaran (dipakai Rutin & Docking — sama persis) */
const TBL_HEAD = "bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600 font-bold border-b-2 border-slate-200";
const TD_PAGU = "p-2 text-right tabular-nums text-slate-700";
const TD_PAKAI = "p-2 text-right tabular-nums font-bold text-slate-900";
const TD_MA = "p-2 font-semibold text-slate-800";
const tdSisa = (v: number) => `p-2 text-right tabular-nums font-bold ${v < 0 ? "text-red-700" : "text-emerald-700"}`;
const TFOOT_ROW = "bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900";
// warna aksen KPI mini mengikuti status serapan
const barPct = (pct: number) => (pct > 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500");
const tintPct = (pct: number) => (pct > 100 ? "text-red-700" : pct >= 80 ? "text-amber-700" : "text-slate-900");

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
  const [openKey, setOpenKey] = useState<string | null>(null);

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
                          {rinci.length === 0 ? (
                            <p className="text-[11px] text-slate-500">Belum ada pengadaan pada Mata Anggaran ini bulan ini.</p>
                          ) : (
                            <table className="w-full text-[11px]">
                              <tbody>
                                {rinci.map((x) => (
                                  <tr key={x.id} className="border-b border-slate-200 last:border-0">
                                    <td className="py-1 pr-2 w-20"><span className={`px-1.5 py-0.5 rounded font-bold ${x.sumber === "Non PR PO" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"}`}>{x.sumber === "Non PR PO" ? "Non PR PO" : "SPPBJ"}</span></td>
                                    <td className="py-1 pr-2 text-slate-800">{x.nama}</td>
                                    <td className="py-1 pr-2 text-slate-500 whitespace-nowrap w-24">{x.tanggal ? tanggalIndo(x.tanggal) : "—"}</td>
                                    <td className="py-1 text-right font-bold tabular-nums text-slate-900 whitespace-nowrap">{rupiah(x.nilai)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
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

      {/* daftar pengadaan rutin bulan ini */}
      {!edit && real.list.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-slate-600 font-medium hover:text-slate-900">Semua {real.list.length} pengadaan bulan ini (klik baris Mata Anggaran di atas utk rincian per pos)</summary>
          <ul className="mt-2 space-y-1">
            {real.list.map((x) => (
              <li key={x.id} className="flex justify-between gap-3 border-b border-slate-200 pb-1">
                <span className="text-slate-800 truncate"><span className={`text-[9px] font-bold px-1 rounded mr-1 ${x.sumber === "Non PR PO" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"}`}>{x.sumber === "Non PR PO" ? "NonPR" : "SPPBJ"}</span>{x.nama} <span className="text-slate-500">· {x.ma || "tanpa MA"}</span></span>
                <span className="font-bold tabular-nums text-slate-900 whitespace-nowrap">{rupiah(x.nilai)}</span>
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

/* ---------- Kendali Anggaran Docking (per kapal) ---------- */
// seed draft dari daftar MA docking tetap (user tinggal isi nilai) + baris tambahan non-standar
function seedDockingDraft(existing: PlafonRow[]): PlafonRow[] {
  const byKey: Record<string, number> = {};
  existing.forEach((r) => { byKey[maKey(r.ma)] = r.nilai; });
  const base = DOCKING_MA.map((m) => ({ ma: `${m.kode} (${m.label})`, nilai: byKey[m.kode] || 0 }));
  const dockKeys = new Set(DOCKING_MA.map((m) => m.kode));
  const extras = existing.filter((r) => !dockKeys.has(maKey(r.ma)));
  return [...base, ...extras];
}

function AnggaranDocking({ docking, pengadaan, onSave }: { docking: PlafonDocking[]; pengadaan: PengadaanRow[]; onSave: (d: PlafonDocking[]) => Promise<void> }) {
  const thisYear = new Date().getFullYear();
  const [kapal, setKapal] = useState(KAPAL_ANGGARAN[0]);
  const [tahun, setTahun] = useState(thisYear);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<PlafonRow[]>([]);
  const [noSurat, setNoSurat] = useState("");
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const entry = docking.find((d) => d.kapal === kapal && d.tahun === tahun);
  const rows = entry?.rows || [];
  const real = useMemo(() => realisasiDocking(pengadaan, kapal, tahun), [pengadaan, kapal, tahun]);

  const merged = useMemo(() => {
    const by: Record<string, { key: string; ma: string; pagu: number; pakai: number }> = {};
    rows.forEach((r) => { const k = maKey(r.ma); by[k] = { key: k, ma: r.ma, pagu: (by[k]?.pagu || 0) + (r.nilai || 0), pakai: by[k]?.pakai || 0 }; });
    Object.entries(real.perKey).forEach(([k, v]) => { if (by[k]) by[k].pakai = v; else { const lbl = real.list.find((x) => x.key === k)?.ma || k; by[k] = { key: k, ma: lbl, pagu: 0, pakai: v }; } });
    return Object.values(by).sort((x, y) => (y.pakai / (y.pagu || 1)) - (x.pakai / (x.pagu || 1)));
  }, [rows, real]);

  const totalPagu = rows.reduce((s, r) => s + (r.nilai || 0), 0);
  const totalPakai = real.total;
  const sisa = totalPagu - totalPakai;
  const pctTot = totalPagu ? Math.round((totalPakai / totalPagu) * 100) : 0;

  const startEdit = () => { setDraft(seedDockingDraft(rows)); setNoSurat(entry?.noSurat || ""); setEdit(true); };
  const simpan = async () => {
    setBusy(true);
    try {
      const clean = draft.filter((r) => r.ma.trim() && r.nilai);
      const next = docking.filter((d) => !(d.kapal === kapal && d.tahun === tahun));
      if (clean.length) next.push({ kapal, tahun, noSurat: noSurat.trim() || undefined, rows: clean });
      await onSave(next);
      setEdit(false);
    } finally { setBusy(false); }
  };

  return (
    <Card title="Kendali Anggaran Docking (Persetujuan Pusat per kapal)" icon="🛠️">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={kapal} onChange={(e) => setKapal(e.target.value)} className="text-xs border px-2.5 py-1.5 rounded-lg bg-white">
          {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <input type="number" value={tahun} onChange={(e) => setTahun(+e.target.value)} className="text-xs border px-2 py-1.5 rounded-lg bg-white w-20" />
        {entry?.noSurat && !edit && <span className="text-[11px] text-slate-500">No. {entry.noSurat}</span>}
        <span className="text-[11px] text-slate-500">realisasi = SPPBJ/Non PR PO ber-<b>Jenis Anggaran: Docking</b> utk kapal ini, per Mata Anggaran</span>
        <div className="ml-auto flex items-center gap-2">
          {!edit ? (
            <button onClick={startEdit} className="btn btn-ghost text-xs">✏️ Atur Pagu Docking</button>
          ) : (
            <>
              <button onClick={() => setPaste("")} className="btn btn-ghost text-xs">📋 Tempel dari Excel</button>
              <button onClick={simpan} disabled={busy} className="btn btn-primary text-xs">{busy ? "…" : "💾 Simpan"}</button>
              <button onClick={() => setEdit(false)} className="btn btn-ghost text-xs">Batal</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <MiniStat label="Total Pagu Docking" val={rupiah(totalPagu)} tint="text-slate-900" bar="bg-slate-400" />
        <MiniStat label="Terpakai" val={rupiah(totalPakai)} tint="text-blue-800" bar="bg-blue-600" />
        <MiniStat label="Sisa" val={rupiah(sisa)} tint={sisa < 0 ? "text-red-700" : "text-emerald-800"} bar={sisa < 0 ? "bg-red-500" : "bg-emerald-500"} />
        <MiniStat label="Serapan" val={`${pctTot}%`} tint={tintPct(pctTot)} bar={barPct(pctTot)} />
      </div>

      {edit ? (
        <div className="rounded-xl ring-1 ring-slate-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-slate-500">Pagu docking <b className="text-[#16357f]">{kapal}</b> {tahun}:</span>
            <input value={noSurat} onChange={(e) => setNoSurat(e.target.value)} placeholder="No. Surat Persetujuan (opsional)" className="text-xs border rounded px-2 py-1 flex-1 max-w-xs" />
          </div>
          {draft.map((r, i) => {
            const extra = i >= DOCKING_MA.length;
            return (
              <div key={i} className="flex items-center gap-2 mb-1.5">
                <span className="flex-1 text-xs text-slate-700 bg-slate-50 rounded-lg px-3 py-2 truncate ring-1 ring-slate-100">{r.ma || "—"}</span>
                <input type="number" value={r.nilai || ""} onChange={(e) => setDraft((d) => d.map((x, j) => j === i ? { ...x, nilai: +e.target.value } : x))} placeholder="Total Persetujuan (Rp)" className="w-44 text-xs border rounded-lg px-3 py-2 text-right" />
                {extra ? <button onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button> : <span className="w-4" />}
              </div>
            );
          })}
          <p className="text-[10px] text-slate-500 mt-1.5">Isi nilai <b>Total Persetujuan</b> tiap Mata Anggaran (kosongkan = tak dipakai). Daftar MA sudah tetap sesuai format Docking — tak perlu ketik. Baris tambahan dari "Tempel dari Excel" bisa dihapus.</p>
        </div>
      ) : merged.length === 0 ? (
        <p className="text-sm text-slate-500 py-3 text-center">Belum ada pagu/realisasi docking utk {kapal} {tahun}. Klik <b>Atur Pagu Docking</b> untuk isi dari Persetujuan Pusat.</p>
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
                      <td className={TD_MA}><span className="inline-flex items-center gap-1.5"><span className={`text-slate-500 text-[10px] transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>{m.ma}{rinci.length > 0 && <span className="text-[10px] font-bold text-sky-800 bg-sky-100 rounded-full px-1.5 py-px">{rinci.length}</span>}</span></td>
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
                      <td className="p-2 text-center"><span className={`inline-block text-[10px] font-extrabold tracking-wide px-2.5 py-1 rounded-full ${m.pagu ? s.c : "bg-slate-100 text-slate-500 ring-1 ring-slate-300"}`}>{m.pagu ? s.t : "—"}</span></td>
                    </tr>
                    {isOpen && <tr className="bg-sky-50/50"><td colSpan={6} className="px-3 py-2"><MaDetailList list={rinci} /></td></tr>}
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
