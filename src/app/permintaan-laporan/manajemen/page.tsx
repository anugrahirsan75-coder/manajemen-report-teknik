"use client";
/**
 * DASHBOARD MANAJEMEN — permintaan kapal dalam satu layar untuk Manajemen Cabang.
 *
 * Dibaca, bukan diisi. Pertanyaan yang dijawab:
 *  · Kapal mana yang permintaannya menumpuk, dan berapa yang urgent?
 *  · Barang urgent mana yang sudah lewat seminggu belum diproses? (daftar merah)
 *  · Berapa nilai kebutuhan terbuka, dan berapa yang rutin / biaya / investasi?
 *  · Seberapa lama permintaan menunggu, dan berapa yang sudah tuntas?
 * Seluruh angka dihitung dari data yang sama dengan layar Monitoring.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { bulanIndo } from "@/lib/lapor/types";
import { rupiah, tanggalIndo } from "@/lib/format";
import { ringkasKapal } from "@/lib/kapal/nama";
import { nilaiBarang, ringkas } from "@/lib/permintaanMonitor/logika";
import { BATAS_MENGGANTUNG_HARI, KLASIFIKASI, PRIORITAS, TAHAP, Tahap } from "@/lib/permintaanMonitor/types";
import { perKapal, unduhExcel, useMonitorPermintaan } from "@/lib/permintaanMonitor/useMonitor";
import { beritahu } from "@/components/Konfirmasi";

const jt = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)} M` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} jt` : n >= 1e3 ? `${Math.round(n / 1e3)} rb` : n ? String(Math.round(n)) : "0";

const URUT_TAHAP: Tahap[] = ["baru", "menunggu", "disetujui", "stok", "ditunda", "sppbj", "spbj", "selesai", "ditolak"];
const WARNA_BAR: Record<Tahap, string> = {
  baru: "bg-slate-300", menunggu: "bg-amber-400", disetujui: "bg-orange-500", stok: "bg-lime-500", ditunda: "bg-slate-500",
  sppbj: "bg-sky-500", spbj: "bg-indigo-500", selesai: "bg-emerald-500", ditolak: "bg-rose-400",
};

export default function DashboardManajemen() {
  const m = useMonitorPermintaan();
  const [bulan, setBulan] = useState("");
  const [unduh, setUnduh] = useState(false);

  const daftarBulan = useMemo(
    () => Array.from(new Set(m.baris.map((b) => (b.dikirimPada || "").slice(0, 7)).filter(Boolean))).sort().reverse(), [m.baris]);
  const data = useMemo(() => (bulan ? m.baris.filter((b) => (b.dikirimPada || "").startsWith(bulan)) : m.baris), [m.baris, bulan]);
  const r = useMemo(() => ringkas(data, m.harga), [data, m.harga]);
  const kapal = useMemo(() => perKapal(data, m.harga), [data, m.harga]);

  const tahap = useMemo(() => {
    const h = Object.fromEntries(URUT_TAHAP.map((t) => [t, 0])) as Record<Tahap, number>;
    data.forEach((b) => { h[b.tahap]++; });
    return h;
  }, [data]);

  const merah = useMemo(() => data.filter((b) => b.menggantung).sort((a, b) => b.umurHari - a.umurHari), [data]);

  const umur = useMemo(() => {
    const kel = [
      { label: "0–7 hari", min: 0, max: 7 }, { label: "8–14 hari", min: 8, max: 14 },
      { label: "15–30 hari", min: 15, max: 30 }, { label: "> 30 hari", min: 31, max: Infinity },
    ];
    const buka = data.filter((b) => b.tahap !== "selesai" && b.tahap !== "ditolak");
    return kel.map((k) => {
      const d = buka.filter((b) => b.umurHari >= k.min && b.umurHari <= k.max);
      return { ...k, n: d.length, urgent: d.filter((b) => b.prioritas === "urgent").length };
    });
  }, [data]);

  const tren = useMemo(() => {
    const t = new Map<string, { n: number; selesai: number; proses: number; urgent: number }>();
    m.baris.forEach((b) => {
      const k = (b.dikirimPada || "").slice(0, 7); if (!k) return;
      const x = t.get(k) || { n: 0, selesai: 0, proses: 0, urgent: 0 };
      x.n++; if (b.tahap === "selesai") x.selesai++; if (b.tahap === "sppbj" || b.tahap === "spbj") x.proses++;
      if (b.prioritas === "urgent") x.urgent++;
      t.set(k, x);
    });
    return Array.from(t.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  }, [m.baris]);

  const persenSelesai = r.total ? Math.round((r.selesai / r.total) * 100) : 0;
  const maksNilai = Math.max(1, ...Object.values(r.nilaiPerKlasifikasi));

  const ekspor = async () => {
    if (!data.length || unduh) return;
    setUnduh(true);
    try { await unduhExcel(data, m.harga, bulan ? bulanIndo(bulan) : `per ${new Date().toLocaleDateString("id-ID")}`); }
    catch (e: any) { void beritahu(e?.message || String(e)); }
    finally { setUnduh(false); }
  };

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex flex-wrap items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 grid place-items-center text-2xl text-white shadow-md shrink-0">📊</div>
          <div className="flex-1 min-w-[240px]">
            <h1 className="text-2xl font-extrabold asdp-text-gradient tracking-tight">Dashboard Manajemen — Permintaan Kapal</h1>
            <p className="text-slate-500 text-sm">Ringkasan untuk Manajemen Cabang: beban permintaan per kapal, urgent yang tertahan, dan nilai kebutuhan.</p>
          </div>
          <select value={bulan} onChange={(e) => setBulan(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white print:hidden">
            <option value="">Semua bulan kirim</option>
            {daftarBulan.map((b) => <option key={b} value={b}>{bulanIndo(b)}</option>)}
          </select>
          <button onClick={ekspor} disabled={!data.length || unduh} className="btn btn-primary text-xs px-4 py-2 disabled:opacity-50 print:hidden">
            {unduh ? "Menyusun…" : "⬇ Rekap Excel"}
          </button>
          <button onClick={() => window.print()} className="btn btn-ghost text-xs print:hidden">🖨 Cetak</button>
          <Link href="/permintaan-laporan/monitoring" className="btn btn-ghost text-xs print:hidden">📋 Monitoring</Link>
        </div>
      </div>

      {m.galat && <p className="mt-4 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{m.galat}</p>}
      {m.muat ? <p className="mt-6 text-sm text-slate-500">Memuat data permintaan, penilaian dan pengadaan…</p> : (
        <>
          <section className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi label="Barang diminta" nilai={String(r.total)} sub={`${r.terbuka} masih terbuka`} warna="text-slate-900" />
            <Kpi label="Urgent terbuka" nilai={String(r.urgentTerbuka)} warna="text-rose-700" />
            <Kpi label={`Urgent > ${BATAS_MENGGANTUNG_HARI} hari`} nilai={String(r.menggantung)} sub="belum masuk pengadaan" warna={r.menggantung ? "text-red-700" : "text-emerald-700"} />
            <Kpi label="Belum dievaluasi" nilai={String(r.belumDievaluasi)} warna="text-amber-700" />
            <Kpi label="Nilai terbuka" nilai={`Rp${jt(r.nilaiTerbuka)}`} sub="taksiran RAB / harga kantor" warna="text-indigo-700" />
            <Kpi label="Tuntas" nilai={`${persenSelesai}%`} sub={`${r.selesai} selesai · ${r.prosesPengadaan} diproses`} warna="text-emerald-700" />
          </section>

          {/* alur status */}
          <section className="mt-4 bg-white rounded-2xl ring-line elev-sm p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Posisi seluruh barang</p>
            <div className="flex h-5 rounded-full overflow-hidden ring-1 ring-slate-200">
              {URUT_TAHAP.filter((t) => tahap[t]).map((t) => (
                <div key={t} title={`${TAHAP[t].label}: ${tahap[t]}`} className={WARNA_BAR[t]} style={{ width: `${(tahap[t] / Math.max(1, data.length)) * 100}%` }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {URUT_TAHAP.map((t) => (
                <span key={t} className="text-[11px] text-slate-700 flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-sm ${WARNA_BAR[t]}`} />{TAHAP[t].label} <b>{tahap[t]}</b>
                </span>
              ))}
            </div>
          </section>

          {/* daftar merah */}
          <section className="mt-4 bg-white rounded-2xl ring-line elev-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <h2 className="font-extrabold text-red-700">⏰ Daftar merah — urgent lebih dari {BATAS_MENGGANTUNG_HARI} hari belum diproses</h2>
              <span className="ml-auto text-xs text-slate-500">{merah.length} barang</span>
              {merah.length > 0 && <Link href="/permintaan-laporan/monitoring?saring=menggantung" className="text-xs font-bold text-sky-700 hover:underline print:hidden">tindak lanjuti →</Link>}
            </div>
            {!merah.length ? <p className="p-4 text-sm text-emerald-700">Tidak ada barang urgent yang tertahan. 👍</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-red-50 text-[10px] uppercase text-red-900 font-bold">
                    <tr><th className="p-2 text-left">Kapal</th><th className="p-2 text-left">Barang</th><th className="p-2 text-right">Menunggu</th>
                      <th className="p-2 text-left">Status</th><th className="p-2 text-right">Taksiran</th><th className="p-2 text-left">Catatan kantor</th></tr>
                  </thead>
                  <tbody>
                    {merah.slice(0, 25).map((b) => (
                      <tr key={b.kunci} className="border-b border-slate-100 align-top">
                        <td className="p-2 font-semibold whitespace-nowrap">{ringkasKapal(b.kapal)}</td>
                        <td className="p-2">{b.nama}<span className="text-slate-500"> · {b.jumlah} {b.satuan}</span>
                          {b.dimintaUlang > 0 && <span className="ml-1 text-[10px] text-amber-700 font-bold">🔁 {b.dimintaUlang}×</span>}</td>
                        <td className="p-2 text-right font-bold text-red-700 whitespace-nowrap">{b.umurHari} hari</td>
                        <td className="p-2 whitespace-nowrap">{TAHAP[b.tahap].label}</td>
                        <td className="p-2 text-right tabular-nums">{rupiah(nilaiBarang(b, m.harga))}</td>
                        <td className="p-2 text-slate-600">{b.ev?.catatan || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {merah.length > 25 && <p className="px-4 py-2 text-[11px] text-slate-500">+{merah.length - 25} barang lain — lihat di Monitoring.</p>}
              </div>
            )}
          </section>

          {/* per kapal */}
          <section className="mt-4 bg-white rounded-2xl ring-line elev-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200"><h2 className="font-extrabold text-slate-800">Per kapal</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-[10px] uppercase text-slate-600 font-bold">
                  <tr>
                    <th className="p-2 text-left">Kapal</th><th className="p-2 text-right">Terbuka</th><th className="p-2 text-right">Urgent</th>
                    <th className="p-2 text-right">Menggantung</th><th className="p-2 text-right">Belum dinilai</th><th className="p-2 text-right">Diproses</th>
                    <th className="p-2 text-right">Selesai</th>
                    {KLASIFIKASI.map((k) => <th key={k.id} className="p-2 text-right">{k.label} (Rp)</th>)}
                    <th className="p-2 print:hidden" />
                  </tr>
                </thead>
                <tbody>
                  {kapal.map((k) => (
                    <tr key={k.kapal} className={`border-b border-slate-100 ${k.menggantung ? "bg-red-50/50" : ""}`}>
                      <td className="p-2 font-semibold whitespace-nowrap">{k.kapal}</td>
                      <td className="p-2 text-right tabular-nums">{k.terbuka}</td>
                      <td className="p-2 text-right tabular-nums text-rose-700 font-bold">{k.urgent || ""}</td>
                      <td className="p-2 text-right tabular-nums text-red-700 font-extrabold">{k.menggantung || ""}</td>
                      <td className="p-2 text-right tabular-nums text-amber-700">{k.belum || ""}</td>
                      <td className="p-2 text-right tabular-nums">{k.proses || ""}</td>
                      <td className="p-2 text-right tabular-nums text-emerald-700">{k.selesai || ""}</td>
                      {KLASIFIKASI.map((x) => <td key={x.id} className="p-2 text-right tabular-nums">{k[x.id] ? jt(k[x.id]) : ""}</td>)}
                      <td className="p-2 print:hidden"><Link href={`/permintaan-laporan/monitoring?kapal=${encodeURIComponent(k.kapal)}&saring=perlu`} className="text-sky-700 hover:underline whitespace-nowrap">lihat →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-4 grid md:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl ring-line elev-sm p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Nilai terbuka per klasifikasi</p>
              {KLASIFIKASI.map((k) => (
                <div key={k.id} className="mb-1.5">
                  <div className="flex justify-between text-xs"><span>{k.label}</span><b className="tabular-nums">Rp{jt(r.nilaiPerKlasifikasi[k.id])}</b></div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${(r.nilaiPerKlasifikasi[k.id] / maksNilai) * 100}%` }} /></div>
                </div>
              ))}
              <p className="text-[10px] text-slate-400 mt-2">Termasuk saran mesin yang belum dikonfirmasi.</p>
            </div>
            <div className="bg-white rounded-2xl ring-line elev-sm p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Lama menunggu (barang terbuka)</p>
              {umur.map((u) => (
                <div key={u.label} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                  <span>{u.label}</span>
                  <span><b className="tabular-nums">{u.n}</b>{u.urgent ? <span className="text-rose-700"> · {u.urgent} urgent</span> : null}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl ring-line elev-sm p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Tren per bulan kirim</p>
              <table className="w-full text-xs">
                <thead className="text-[10px] text-slate-500"><tr><th className="text-left">Bulan</th><th className="text-right">Diminta</th><th className="text-right">Urgent</th><th className="text-right">Diproses</th><th className="text-right">Selesai</th></tr></thead>
                <tbody>{tren.map(([b, x]) => (
                  <tr key={b} className="border-t border-slate-100"><td className="py-1">{bulanIndo(b)}</td><td className="text-right tabular-nums">{x.n}</td>
                    <td className="text-right tabular-nums text-rose-700">{x.urgent}</td><td className="text-right tabular-nums">{x.proses}</td><td className="text-right tabular-nums text-emerald-700">{x.selesai}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </section>

          <p className="mt-4 text-[11px] text-slate-500">
            Prioritas: {PRIORITAS.map((p) => `${p.ikon} ${p.label} = ${p.ket.toLowerCase()}`).join(" · ")}.
            Status pengadaan dicocokkan otomatis dari SPPBJ / Non PR PO / SCM. Disusun {tanggalIndo(new Date().toISOString().slice(0, 10))}.
          </p>
        </>
      )}
    </main>
  );
}

function Kpi({ label, nilai, sub, warna }: { label: string; nilai: string; sub?: string; warna: string }) {
  return (
    <div className="bg-white rounded-2xl ring-line elev-sm px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold">{label}</p>
      <p className={`text-2xl font-extrabold tabular-nums leading-tight ${warna}`}>{nilai}</p>
      {sub ? <p className="text-[10px] text-slate-500">{sub}</p> : null}
    </div>
  );
}
