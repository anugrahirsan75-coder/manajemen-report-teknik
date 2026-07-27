"use client";
/**
 * Rutin Sepanjang Tahun — panel grafik di dalam Kendali Anggaran Rutin.
 *
 * Dua pertanyaan yang dijawab:
 *   1. Bulan mana yang OVER pagu?  -> grafik bullet 12 bulan (Jan–Des).
 *      Batang abu = pagu, batang berwarna = realisasi. Lewat garis pagu = over.
 *      Warna = STATUS (aman / waspada / overbudget), bukan identitas — jadi
 *      selalu ditemani angka % + legenda + tampilan Tabel (bukan warna saja).
 *   2. Kapal mana yang paling besar biayanya? -> batang mendatar terurut,
 *      satu warna (kategori nominal, panjang batang sudah membawa besarannya).
 *
 * Angka dihitung ulang dari realisasiRutin/realisasiRutinKapal per bulan supaya
 * PERSIS sama dengan yang tampil di kartu bulanan (tanpa jalur hitung kedua).
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { PengadaanRow, realisasiRutin, realisasiRutinKapal } from "@/lib/anggaran/store";
import { PlafonRutin, rupiahShort } from "@/lib/anggaran/types";
import { rupiah, bulanTahun } from "@/lib/format";
import { ringkasKapal } from "@/lib/kapal/nama";

const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
const p2 = (n: number) => String(n).padStart(2, "0");

/** status serapan -> warna batang + label. Dipakai sama persis di grafik, legenda & tabel. */
type Tingkat = "kosong" | "aman" | "waspada" | "over";
const tingkatDari = (pagu: number, pakai: number): Tingkat => {
  if (!pagu && !pakai) return "kosong";
  if (!pagu) return "over";                    // ada belanja tanpa pagu = tak terkendali
  const pct = (pakai / pagu) * 100;
  return pct > 100 ? "over" : pct >= 80 ? "waspada" : "aman";
};
const GAYA: Record<Tingkat, { bar: string; teks: string; label: string }> = {
  kosong:  { bar: "bg-slate-300",   teks: "text-slate-500",   label: "Belum ada data" },
  aman:    { bar: "bg-emerald-500", teks: "text-emerald-700", label: "Aman (<80%)" },
  waspada: { bar: "bg-amber-500",   teks: "text-amber-700",   label: "Waspada (80–100%)" },
  over:    { bar: "bg-red-500",     teks: "text-red-700",     label: "Overbudget (>100%)" },
};

export default function RutinSetahun({
  plafon, pengadaan, bulanAktif, onPilihBulan,
}: {
  plafon: PlafonRutin[];
  pengadaan: PengadaanRow[];
  bulanAktif: string;
  onPilihBulan: (bulan: string) => void;
}) {
  const [buka, setBuka] = useState(true);
  const [tampil, setTampil] = useState<"grafik" | "tabel">("grafik");
  const [kapalBuka, setKapalBuka] = useState<string | null>(null);
  const [tahunSel, setTahunSel] = useState("");

  const tahunList = useMemo(() => {
    const s = new Set<string>();
    plafon.forEach((p) => p.bulan && s.add(p.bulan.slice(0, 4)));
    pengadaan.forEach((r) => { if (r.jenis === "rutin" && r.tanggal) s.add(r.tanggal.slice(0, 4)); });
    return Array.from(s).filter(Boolean).sort().reverse();
  }, [plafon, pengadaan]);
  // ikut bulan yang sedang dibuka di kartu, kecuali pengguna memilih tahun sendiri
  const tahun = tahunSel || bulanAktif.slice(0, 4) || tahunList[0] || String(new Date().getFullYear());

  /* ---- 12 bulan: pagu vs realisasi ---- */
  const bulanan = useMemo(() => BLN.map((_, i) => {
    const bulan = `${tahun}-${p2(i + 1)}`;
    const pagu = (plafon.find((p) => p.bulan === bulan)?.rows || []).reduce((s, r) => s + (r.nilai || 0), 0);
    const pakai = realisasiRutin(pengadaan, bulan).total;
    return { bulan, ke: i, pagu, pakai, sisa: pagu - pakai, pct: pagu ? Math.round((pakai / pagu) * 100) : 0, tingkat: tingkatDari(pagu, pakai) };
  }), [tahun, plafon, pengadaan]);

  const maks = Math.max(1, ...bulanan.map((b) => Math.max(b.pagu, b.pakai)));
  const tot = bulanan.reduce((a, b) => ({ pagu: a.pagu + b.pagu, pakai: a.pakai + b.pakai }), { pagu: 0, pakai: 0 });
  const nOver = bulanan.filter((b) => b.tingkat === "over").length;
  const nWaspada = bulanan.filter((b) => b.tingkat === "waspada").length;
  const pctTot = tot.pagu ? Math.round((tot.pakai / tot.pagu) * 100) : 0;

  /* ---- per kapal sepanjang tahun ---- */
  const kapalan = useMemo(() => {
    const per: Record<string, { kapal: string; nilai: number; dok: { id: string; nama: string; nilai: number; bulan: string; sumber: string }[] }> = {};
    bulanan.forEach(({ bulan }) => {
      realisasiRutinKapal(pengadaan, bulan).list.forEach((k) => {
        const s = (per[k.kapal] ||= { kapal: k.kapal, nilai: 0, dok: [] });
        s.nilai += k.nilai;
        k.pengadaan.forEach((d) => s.dok.push({ id: d.id, nama: d.nama, nilai: d.nilai, bulan, sumber: d.sumber }));
      });
    });
    const list = Object.values(per).sort((a, b) => b.nilai - a.nilai);
    list.forEach((k) => k.dok.sort((a, b) => b.nilai - a.nilai));
    return list;
  }, [bulanan, pengadaan]);

  const totKapal = kapalan.reduce((s, k) => s + k.nilai, 0);
  const TOP = 8;
  const kapalTampil = kapalan.slice(0, TOP);
  const ekor = kapalan.slice(TOP);
  const maksKapal = Math.max(1, kapalTampil[0]?.nilai || 0);

  const adaData = tot.pagu > 0 || tot.pakai > 0;

  return (
    <section className="mb-4 rounded-2xl ring-1 ring-slate-200 bg-slate-50 overflow-hidden">
      {/* kepala */}
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
        <button onClick={() => setBuka(!buka)} className="flex items-center gap-2 text-left group">
          <span className={`text-slate-400 text-xs transition-transform ${buka ? "rotate-90" : ""}`}>▶</span>
          <span className="font-bold text-slate-800 text-sm group-hover:text-[#16357f] transition">📈 Rutin Sepanjang Tahun {tahun}</span>
        </button>
        <span className="text-[11px] text-slate-500 hidden sm:inline">bulan mana yang over &amp; kapal mana yang paling besar biayanya</span>
        {buka && (
          <div className="ml-auto flex items-center gap-2">
            {tahunList.length > 1 && (
              <select value={tahun} onChange={(e) => setTahunSel(e.target.value)}
                className="text-[11px] border border-slate-300 rounded-lg px-2 py-1 bg-white" title="Pilih tahun">
                {tahunList.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <div className="flex gap-1">
              {([["grafik", "📊 Grafik"], ["tabel", "▦ Tabel"]] as const).map(([v, t]) => (
                <button key={v} onClick={() => setTampil(v)}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition ${tampil === v ? "bg-[#16357f] text-white border-[#16357f]" : "bg-white border-slate-300 text-slate-600 hover:border-[#1ca3dd]"}`}>{t}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {buka && (
        <div className="px-3.5 pb-3.5">
          {!adaData ? (
            <p className="text-sm text-slate-500 text-center py-6 bg-white rounded-xl ring-1 ring-slate-200">Belum ada pagu maupun realisasi Rutin di tahun {tahun}.</p>
          ) : (
            <>
              {/* ringkas setahun */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                <Sel label={`Pagu ${tahun}`} nilai={rupiah(tot.pagu)} tint="text-slate-900" bar="bg-slate-400" />
                <Sel label="Terpakai" nilai={rupiah(Math.round(tot.pakai))} tint="text-blue-800" bar="bg-blue-600" sub={`${pctTot}% terserap`} />
                <Sel label="Sisa setahun" nilai={rupiah(Math.round(tot.pagu - tot.pakai))}
                  tint={tot.pakai > tot.pagu ? "text-red-700" : "text-emerald-800"} bar={tot.pakai > tot.pagu ? "bg-red-500" : "bg-emerald-500"} />
                <Sel label="Bulan bermasalah" nilai={`${nOver} over`} sub={nWaspada ? `+ ${nWaspada} waspada` : "tidak ada waspada"}
                  tint={nOver ? "text-red-700" : "text-emerald-800"} bar={nOver ? "bg-red-500" : "bg-emerald-500"} />
              </div>

              {tampil === "grafik" ? (
                <>
                  {/* ============ grafik 1: 12 bulan ============ */}
                  <div className="bg-white rounded-xl ring-1 ring-slate-200 p-3.5 mb-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                      <h4 className="font-bold text-slate-800 text-sm">Pagu vs Realisasi per bulan</h4>
                      <span className="text-[11px] text-slate-500">klik batang untuk membuka bulan itu</span>
                      <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-600">
                        <Legenda kelas="bg-slate-200" teks="pagu" />
                        <Legenda kelas="bg-emerald-500" teks="aman" />
                        <Legenda kelas="bg-amber-500" teks="waspada" />
                        <Legenda kelas="bg-red-500" teks="overbudget" />
                      </div>
                    </div>

                    <div className="flex items-stretch gap-1.5 sm:gap-2 h-48 mt-3">
                      {bulanan.map((b) => {
                        const g = GAYA[b.tingkat];
                        const hPagu = (b.pagu / maks) * 100;
                        const hPakai = (b.pakai / maks) * 100;
                        const aktif = b.bulan === bulanAktif;
                        const judul = `${bulanTahun(b.bulan + "-01")}
pagu       ${b.pagu ? rupiah(b.pagu) : "—"}
terpakai   ${rupiah(Math.round(b.pakai))}${b.pagu ? ` (${b.pct}%)` : ""}
${b.pagu ? (b.sisa < 0 ? `LEBIH      ${rupiah(Math.round(-b.sisa))}` : `sisa       ${rupiah(Math.round(b.sisa))}`) : "belum ada pagu"}`;
                        return (
                          <button key={b.bulan} onClick={() => onPilihBulan(b.bulan)} title={judul}
                            className="flex-1 flex flex-col items-stretch gap-1 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1ca3dd] rounded">
                            {/* label terpilih: hanya bulan yang OVER (agar tak jadi angka di tiap batang) */}
                            <span className={`text-[9px] font-bold tabular-nums h-3 leading-3 ${b.tingkat === "over" && b.pagu ? "text-red-700" : "text-slate-400 opacity-0 group-hover:opacity-100 transition"}`}>
                              {b.tingkat === "over" && b.pagu ? `${b.pct}%` : b.pakai ? rupiahShort(b.pakai) : ""}
                            </span>
                            <span className="relative flex-1 min-h-0 block">
                              {/* jejak pagu */}
                              <span className="absolute bottom-0 inset-x-0 rounded-t bg-slate-200 block" style={{ height: `${Math.max(b.pagu ? 2 : 0, hPagu)}%` }} />
                              {/* garis batas pagu — supaya batang yang melewatinya langsung kelihatan */}
                              {b.pagu > 0 && <span className="absolute inset-x-0 h-[2px] bg-slate-400/70 block" style={{ bottom: `calc(${hPagu}% - 1px)` }} />}
                              {/* realisasi (lebih ramping, ada jarak 2px ke tepi jejak pagu) */}
                              <span className={`absolute bottom-0 left-[22%] right-[22%] rounded-t block ${g.bar}`} style={{ height: `${b.pakai > 0 ? Math.max(2, hPakai) : 0}%` }} />
                              {b.pakai === 0 && b.pagu === 0 && <span className="absolute bottom-0 inset-x-0 h-[2px] bg-slate-200 rounded block" />}
                            </span>
                            <span className={`text-[10px] whitespace-nowrap rounded px-0.5 ${aktif ? "bg-[#16357f] text-white font-bold" : "text-slate-500 group-hover:text-[#16357f]"}`}>{BLN[b.ke]}</span>
                          </button>
                        );
                      })}
                    </div>
                    {nOver > 0 && (
                      <p className="text-[11px] text-red-700 mt-2.5 font-semibold">
                        ⚠ {nOver} bulan melewati pagu: {bulanan.filter((b) => b.tingkat === "over").map((b) => `${BLN[b.ke]} (${b.pagu ? b.pct + "%" : "tanpa pagu"})`).join(", ")}
                      </p>
                    )}
                  </div>

                  {/* ============ grafik 2: per kapal ============ */}
                  <div className="bg-white rounded-xl ring-1 ring-slate-200 p-3.5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                      <h4 className="font-bold text-slate-800 text-sm">Kapal dengan biaya Rutin terbesar</h4>
                      <span className="text-[11px] text-slate-500">sepanjang {tahun} · klik untuk melihat pengadaannya</span>
                      <span className="ml-auto text-[11px] text-slate-500 tabular-nums">total {rupiah(Math.round(totKapal))}</span>
                    </div>
                    {kapalTampil.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-3">Belum ada realisasi Rutin di tahun ini.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {kapalTampil.map((k) => {
                          const w = (k.nilai / maksKapal) * 100;
                          const share = totKapal ? Math.round((k.nilai / totKapal) * 100) : 0;
                          const terbuka = kapalBuka === k.kapal;
                          return (
                            <div key={k.kapal}>
                              <button onClick={() => setKapalBuka(terbuka ? null : k.kapal)}
                                className="w-full text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1ca3dd] rounded"
                                title={`${k.kapal} — ${rupiah(Math.round(k.nilai))} (${share}% dari total Rutin ${tahun}) · ${k.dok.length} pengadaan`}>
                                <div className="flex items-center gap-2">
                                  <span className="w-28 sm:w-40 shrink-0 text-[11px] font-semibold text-slate-700 truncate group-hover:text-[#16357f]">
                                    <span className={`inline-block text-slate-400 mr-1 transition-transform ${terbuka ? "rotate-90" : ""}`}>▸</span>{ringkasKapal(k.kapal)}
                                  </span>
                                  <span className="flex-1 h-4 bg-slate-100 rounded overflow-hidden block">
                                    <span className="h-full bg-[#16357f] rounded block" style={{ width: `${Math.max(1.5, w)}%` }} />
                                  </span>
                                  <span className="w-24 sm:w-28 shrink-0 text-right text-[11px] font-bold tabular-nums text-slate-800">{rupiahShort(k.nilai)}</span>
                                  <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-slate-500">{share}%</span>
                                </div>
                              </button>
                              {terbuka && (
                                <div className="mt-1 mb-2 ml-4 sm:ml-8 rounded-lg bg-slate-50 ring-1 ring-slate-200 divide-y divide-slate-200">
                                  {k.dok.slice(0, 12).map((d, i) => (
                                    <div key={d.id + i} className="flex items-center gap-2 px-2.5 py-1.5 text-[11px]">
                                      <span className="w-8 shrink-0 text-slate-500 font-semibold">{BLN[+d.bulan.slice(5, 7) - 1]}</span>
                                      <span className="flex-1 truncate text-slate-700" title={d.nama}>{d.nama}</span>
                                      <span className="tabular-nums font-semibold text-slate-800">{rupiahShort(d.nilai)}</span>
                                      <Link href={`${d.sumber === "Non PR PO" ? "/nonpr" : "/sppbj"}?buka=${d.id}`}
                                        className="text-[#1ca3dd] hover:text-[#16357f] font-bold shrink-0" title="Buka dokumennya">buka →</Link>
                                    </div>
                                  ))}
                                  {k.dok.length > 12 && <p className="px-2.5 py-1.5 text-[10px] text-slate-500">…{k.dok.length - 12} pengadaan lain</p>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {ekor.length > 0 && (
                          <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200">
                            <span className="w-28 sm:w-40 shrink-0 text-[11px] text-slate-500 italic">{ekor.length} kapal lain</span>
                            <span className="flex-1 h-4 bg-slate-100 rounded overflow-hidden block">
                              <span className="h-full bg-slate-400 rounded block" style={{ width: `${Math.max(1.5, (ekor.reduce((s, k) => s + k.nilai, 0) / maksKapal) * 100)}%` }} />
                            </span>
                            <span className="w-24 sm:w-28 shrink-0 text-right text-[11px] font-bold tabular-nums text-slate-600">{rupiahShort(ekor.reduce((s, k) => s + k.nilai, 0))}</span>
                            <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-slate-500">{totKapal ? Math.round((ekor.reduce((s, k) => s + k.nilai, 0) / totKapal) * 100) : 0}%</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ============ tampilan tabel (padanan grafik, tanpa mengandalkan warna) ============ */
                <div className="grid lg:grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl ring-1 ring-slate-200 p-3 overflow-x-auto">
                    <h4 className="font-bold text-slate-800 text-sm mb-2">Per bulan</h4>
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600 font-bold">
                        <tr><th className="p-1.5 text-left">Bulan</th><th className="p-1.5 text-right">Pagu</th><th className="p-1.5 text-right">Terpakai</th><th className="p-1.5 text-right">Sisa</th><th className="p-1.5 text-right">%</th><th className="p-1.5 text-left">Status</th></tr>
                      </thead>
                      <tbody>
                        {bulanan.map((b) => (
                          <tr key={b.bulan} className="border-b border-slate-100 last:border-0 cursor-pointer row-hover" onClick={() => onPilihBulan(b.bulan)}>
                            <td className="p-1.5 font-semibold text-slate-800">{BLN[b.ke]}</td>
                            <td className="p-1.5 text-right tabular-nums text-slate-600">{b.pagu ? rupiah(b.pagu) : "—"}</td>
                            <td className="p-1.5 text-right tabular-nums font-bold text-slate-900">{b.pakai ? rupiah(Math.round(b.pakai)) : "—"}</td>
                            <td className={`p-1.5 text-right tabular-nums font-bold ${b.sisa < 0 ? "text-red-700" : "text-emerald-700"}`}>{b.pagu || b.pakai ? rupiah(Math.round(b.sisa)) : "—"}</td>
                            <td className="p-1.5 text-right tabular-nums">{b.pagu ? `${b.pct}%` : "—"}</td>
                            <td className={`p-1.5 font-semibold ${GAYA[b.tingkat].teks}`}>{GAYA[b.tingkat].label}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="bg-slate-100 font-extrabold text-slate-900">
                        <td className="p-1.5">TOTAL</td>
                        <td className="p-1.5 text-right tabular-nums">{rupiah(tot.pagu)}</td>
                        <td className="p-1.5 text-right tabular-nums">{rupiah(Math.round(tot.pakai))}</td>
                        <td className={`p-1.5 text-right tabular-nums ${tot.pakai > tot.pagu ? "text-red-700" : "text-emerald-700"}`}>{rupiah(Math.round(tot.pagu - tot.pakai))}</td>
                        <td className="p-1.5 text-right tabular-nums">{pctTot}%</td><td />
                      </tr></tfoot>
                    </table>
                  </div>
                  <div className="bg-white rounded-xl ring-1 ring-slate-200 p-3 overflow-x-auto">
                    <h4 className="font-bold text-slate-800 text-sm mb-2">Per kapal ({kapalan.length})</h4>
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600 font-bold">
                        <tr><th className="p-1.5 text-left">Kapal</th><th className="p-1.5 text-right">Biaya Rutin</th><th className="p-1.5 text-right">Porsi</th><th className="p-1.5 text-right">Pengadaan</th></tr>
                      </thead>
                      <tbody>
                        {kapalan.map((k) => (
                          <tr key={k.kapal} className="border-b border-slate-100 last:border-0">
                            <td className="p-1.5 font-semibold text-slate-800">{k.kapal}</td>
                            <td className="p-1.5 text-right tabular-nums font-bold text-slate-900">{rupiah(Math.round(k.nilai))}</td>
                            <td className="p-1.5 text-right tabular-nums text-slate-600">{totKapal ? Math.round((k.nilai / totKapal) * 100) : 0}%</td>
                            <td className="p-1.5 text-right tabular-nums text-slate-600">{k.dok.length}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="bg-slate-100 font-extrabold text-slate-900">
                        <td className="p-1.5">TOTAL</td><td className="p-1.5 text-right tabular-nums">{rupiah(Math.round(totKapal))}</td><td className="p-1.5 text-right">100%</td><td />
                      </tr></tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Legenda({ kelas, teks }: { kelas: string; teks: string }) {
  return <span className="flex items-center gap-1"><i className={`w-2.5 h-2.5 rounded-sm inline-block ${kelas}`} />{teks}</span>;
}

function Sel({ label, nilai, sub, tint, bar }: { label: string; nilai: string; sub?: string; tint: string; bar: string }) {
  return (
    <div className="relative bg-white rounded-xl ring-1 ring-slate-200 pl-3.5 pr-3 py-2 overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${bar}`} />
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold">{label}</p>
      <p className={`text-base font-extrabold tabular-nums leading-tight ${tint}`}>{nilai}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}
