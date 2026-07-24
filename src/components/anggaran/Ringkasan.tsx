"use client";
/**
 * Halaman muka Dashboard Anggaran: kesimpulan seluruh sumber anggaran dalam 1 layar.
 * Tiga sumber (Rutin bulanan, Docking per kapal, Persetujuan Lainnya per surat) disatukan
 * jadi angka besar + grafik + daftar perhatian, lalu tiap sumber punya pintu ke detailnya.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { PengadaanRow, realisasiRutin, realisasiDocking, realisasiProgram } from "@/lib/anggaran/store";
import { posProgram } from "@/lib/anggaran/program";
import { PlafonRutin, PlafonDocking, PlafonProgram, KAPAL_ANGGARAN, maKey, isMaInvestasi, rupiahShort } from "@/lib/anggaran/types";
import { ringkasKapal } from "@/lib/kapal/nama";
import { rupiah, bulanTahun } from "@/lib/format";
import PengingatRR from "@/components/rr/PengingatRR";

const bulanIni = () => new Date().toISOString().slice(0, 7);
const mundurBulan = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const warnaPct = (p: number) => (p > 100 ? "bg-red-500" : p >= 80 ? "bg-amber-500" : "bg-emerald-500");
const tintPct = (p: number) => (p > 100 ? "text-red-700" : p >= 80 ? "text-amber-700" : "text-emerald-700");

export interface RingkasanProps {
  plafon: PlafonRutin[];
  docking: PlafonDocking[];
  program: PlafonProgram[];
  pengadaan: PengadaanRow[];
}

interface Sumber {
  kunci: "rutin" | "docking" | "lainnya";
  judul: string; sub: string; ikon: string; href: string;
  warna: string; strip: string; teks: string; ring: string;
  pagu: number; pakai: number; jumlahPos: number;
  perhatian: { label: string; pagu: number; pakai: number }[]; // pos >= 80%
}

export default function Ringkasan(p: RingkasanProps) {
  const bulan = bulanIni();
  const tahun = new Date().getFullYear();
  const [tabTren, setTabTren] = useState<"rutin" | "semua">("rutin");
  const [tabRinci, setTabRinci] = useState<"docking" | "lainnya" | "rutin">("docking");

  const sumber: Sumber[] = useMemo(() => {
    // ---- RUTIN (bulan berjalan) ----
    const entryR = p.plafon.find((x) => x.bulan === bulan);
    const realR = realisasiRutin(p.pengadaan, bulan);
    const paguR = (entryR?.rows || []).reduce((s, r) => s + (r.nilai || 0) + (r.addendum || 0), 0);
    const perhatianR: Sumber["perhatian"] = [];
    (entryR?.rows || []).forEach((r) => {
      const pg = (r.nilai || 0) + (r.addendum || 0);
      const pk = realR.perKey[maKey(r.ma)] || 0;
      if (pg > 0 && pct(pk, pg) >= 80) perhatianR.push({ label: r.ma, pagu: pg, pakai: pk });
    });

    // ---- DOCKING (tahun berjalan, semua kapal) ----
    let paguD = 0, pakaiD = 0, posD = 0;
    const perhatianD: Sumber["perhatian"] = [];
    for (const kapal of KAPAL_ANGGARAN) {
      const e = p.docking.find((d) => d.kapal === kapal && d.tahun === tahun);
      if (!e) continue;
      const real = realisasiDocking(p.pengadaan, kapal, tahun);
      for (const r of e.rows || []) {
        const pg = (r.nilai || 0) + (r.addendum || 0);
        if (!pg) continue;
        const pk = real.perKey[maKey(r.ma)] || 0;
        paguD += pg; pakaiD += pk; posD++;
        if (pct(pk, pg) >= 80) perhatianD.push({ label: `${ringkasKapal(kapal)} · ${r.ma}`, pagu: pg, pakai: pk });
      }
    }

    // ---- LAINNYA (semua surat) ----
    let paguL = 0, pakaiL = 0, posL = 0;
    const perhatianL: Sumber["perhatian"] = [];
    for (const pr of p.program) {
      const pos = posProgram(pr, p.pengadaan);
      for (const x of pos) {
        if (!x.pagu) continue;
        paguL += x.pagu; pakaiL += x.pakai; posL++;
        if (pct(x.pakai, x.pagu) >= 80) perhatianL.push({ label: `${pr.nama} · ${ringkasKapal(x.kapal)}`, pagu: x.pagu, pakai: x.pakai });
      }
    }

    return [
      {
        kunci: "rutin", judul: "Anggaran Rutin", sub: `Persetujuan bulanan · ${bulanTahun(bulan + "-01")}`, ikon: "🧭",
        href: "/dashboard?v=rutin", warna: "from-[#14b8c4] to-[#16357f]", strip: "bg-[#16357f]", teks: "text-[#16357f]", ring: "ring-sky-200",
        pagu: paguR, pakai: realR.total, jumlahPos: (entryR?.rows || []).length, perhatian: perhatianR,
      },
      {
        kunci: "docking", judul: "Anggaran Docking", sub: `Persetujuan Pusat per kapal · ${tahun}`, ikon: "⚓",
        href: "/dashboard?v=docking", warna: "from-amber-500 to-orange-700", strip: "bg-orange-600", teks: "text-orange-800", ring: "ring-amber-200",
        pagu: paguD, pakai: pakaiD, jumlahPos: posD, perhatian: perhatianD,
      },
      {
        kunci: "lainnya", judul: "Persetujuan Biaya Lainnya", sub: `${p.program.length} surat persetujuan`, ikon: "📜",
        href: "/dashboard?v=lainnya", warna: "from-indigo-500 to-violet-700", strip: "bg-indigo-700", teks: "text-indigo-900", ring: "ring-indigo-200",
        pagu: paguL, pakai: pakaiL, jumlahPos: posL, perhatian: perhatianL,
      },
    ];
  }, [p.plafon, p.docking, p.program, p.pengadaan, bulan, tahun]);

  const totPagu = sumber.reduce((s, x) => s + x.pagu, 0);
  const totPakai = sumber.reduce((s, x) => s + x.pakai, 0);
  const totPct = pct(totPakai, totPagu);
  const maksPagu = Math.max(1, ...sumber.map((s) => s.pagu));

  // tren serapan 6 bulan terakhir (Rutin = yang punya pagu bulanan)
  const tren = useMemo(() => {
    const out: { bulan: string; pagu: number; pakai: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const b = mundurBulan(bulan, i);
      const e = p.plafon.find((x) => x.bulan === b);
      const pg = (e?.rows || []).reduce((s, r) => s + (r.nilai || 0) + (r.addendum || 0), 0);
      const pk = tabTren === "rutin"
        ? realisasiRutin(p.pengadaan, b).total
        : p.pengadaan.filter((x) => (x.tanggal || "").slice(0, 7) === b)
            .reduce((s, x) => s + (x.items || []).reduce((t: number, it: any) => t + (it.harga || 0) * (it.jumlah || 0), 0), 0);
      out.push({ bulan: b, pagu: pg, pakai: pk });
    }
    return out;
  }, [p.plafon, p.pengadaan, bulan, tabTren]);
  const maksTren = Math.max(1, ...tren.map((t) => Math.max(t.pagu, t.pakai)));

  // Biaya vs Investasi (seluruh pengadaan tahun berjalan)
  const kategori = useMemo(() => {
    let biaya = 0, inv = 0;
    for (const x of p.pengadaan) {
      if (parseInt((x.tanggal || "").slice(0, 4), 10) !== tahun) continue;
      const maDefault = (x.mataAnggaran || [])[0] || "";
      for (const it of x.items || []) {
        const v = (it.harga || 0) * (it.jumlah || 0);
        if (!v) continue;
        const k = maKey((it.mataAnggaran || "").trim() || maDefault);
        if (isMaInvestasi(k)) inv += v; else biaya += v;
      }
    }
    return { biaya, inv, total: biaya + inv };
  }, [p.pengadaan, tahun]);


  // ---- rincian: Docking per kapal, Lainnya per surat, Rutin per Mata Anggaran ----
  interface Rinci { label: string; pendek?: string; sub?: string; pagu: number; add: number; pakai: number }

  const perKapalDocking: Rinci[] = useMemo(() => {
    const out: Rinci[] = [];
    for (const kapal of KAPAL_ANGGARAN) {
      const e = p.docking.find((d) => d.kapal === kapal && d.tahun === tahun);
      if (!e) continue;
      const real = realisasiDocking(p.pengadaan, kapal, tahun);
      let pagu = 0, add = 0, pakai = 0;
      for (const r of e.rows || []) {
        pagu += r.nilai || 0; add += r.addendum || 0;
        pakai += real.perKey[maKey(r.ma)] || 0;
      }
      if (pagu + add > 0 || pakai > 0)
        out.push({ label: kapal, pendek: ringkasKapal(kapal), sub: e.noSuratAddendum ? `addendum ${e.noSuratAddendum}` : e.noSurat ? `No. ${e.noSurat}` : undefined, pagu, add, pakai });
    }
    return out.sort((a, b) => (b.pagu + b.add) - (a.pagu + a.add));
  }, [p.docking, p.pengadaan, tahun]);

  const perSurat: Rinci[] = useMemo(() =>
    p.program.map((pr) => {
      const pos = posProgram(pr, p.pengadaan);
      return {
        label: pr.nama || "(tanpa nama)",
        pendek: (pr.nama || "").split(" ").slice(0, 2).join(" "),
        sub: pr.noSurat ? `No. ${pr.noSurat}` : undefined,
        pagu: (pr.rows || []).reduce((t, r) => t + (r.nilai || 0), 0),
        add: (pr.rows || []).reduce((t, r) => t + (r.addendum || 0), 0),
        pakai: pos.reduce((t, x) => t + x.pakai, 0),
      };
    }).sort((a, b) => (b.pagu + b.add) - (a.pagu + a.add)),
  [p.program, p.pengadaan]);

  const perMaRutin: Rinci[] = useMemo(() => {
    const e = p.plafon.find((x) => x.bulan === bulan);
    const real = realisasiRutin(p.pengadaan, bulan);
    return (e?.rows || []).map((r) => ({
      label: r.ma,
      pendek: (r.ma.match(/\(([^)]+)\)/)?.[1] || r.ma).slice(0, 18),
      pagu: r.nilai || 0, add: r.addendum || 0, pakai: real.perKey[maKey(r.ma)] || 0,
    })).sort((a, b) => (b.pagu + b.add) - (a.pagu + a.add));
  }, [p.plafon, p.pengadaan, bulan]);

  const daftarRinci = tabRinci === "docking" ? perKapalDocking : tabRinci === "lainnya" ? perSurat : perMaRutin;
  const jmlRinci = {
    pagu: daftarRinci.reduce((s2, d) => s2 + d.pagu, 0),
    add: daftarRinci.reduce((s2, d) => s2 + d.add, 0),
    pakai: daftarRinci.reduce((s2, d) => s2 + d.pakai, 0),
  };
  const maksRinci = Math.max(1, ...daftarRinci.map((d) => d.pagu + d.add));

  const semuaPerhatian = sumber.flatMap((s) =>
    s.perhatian.map((x) => ({ ...x, sumber: s.judul, href: s.href, teks: s.teks, pct: pct(x.pakai, x.pagu) }))
  ).sort((a, b) => b.pct - a.pct).slice(0, 8);

  return (
    <>
      {/* pengingat tenggat Rencana/Realisasi — hanya muncul bila memang perlu ditindak */}
      <PengingatRR />

      {/* ===== angka besar ===== */}
      <section className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Besar label="Total Pagu Disetujui" nilai={rupiah(totPagu)} sub="Rutin + Docking + Lainnya" bar="bg-slate-500" />
        <Besar label="Terpakai" nilai={rupiah(Math.round(totPakai))} sub={`${p.pengadaan.length} pengadaan tercatat`} bar="bg-blue-600" tint="text-blue-800" />
        <Besar label="Sisa" nilai={rupiah(Math.round(totPagu - totPakai))} sub="pagu belum terserap" bar={totPagu - totPakai < 0 ? "bg-red-500" : "bg-emerald-500"} tint={totPagu - totPakai < 0 ? "text-red-700" : "text-emerald-800"} />
        <Besar label="Serapan" nilai={`${totPct}%`} sub={totPct > 100 ? "melebihi pagu" : totPct >= 80 ? "mendekati pagu" : "terkendali"} bar={warnaPct(totPct)} tint={tintPct(totPct)} />
      </section>

      {/* ===== 3 pintu: kartu sumber anggaran ===== */}
      <section className="mt-4 grid md:grid-cols-3 gap-4">
        {sumber.map((s) => {
          const ps = pct(s.pakai, s.pagu);
          return (
            <Link key={s.kunci} href={s.href}
              className={`group relative bg-white rounded-2xl elev-md ring-1 ${s.ring} p-4 overflow-hidden hover:elev-lg transition anim-in`}>
              <span className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${s.warna}`} />
              <div className="flex items-start gap-2.5 mt-1">
                <span className={`h-9 w-9 rounded-xl grid place-items-center text-base text-white bg-gradient-to-br ${s.warna} shrink-0`}>{s.ikon}</span>
                <div className="min-w-0 flex-1">
                  <p className={`font-extrabold leading-tight ${s.teks}`}>{s.judul}</p>
                  <p className="text-[11px] text-slate-500">{s.sub}</p>
                </div>
              </div>

              {s.pagu > 0 ? (
                <>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Pagu</span>
                    <span className="text-lg font-extrabold tabular-nums text-slate-900">{rupiah(s.pagu)}</span>
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-slate-200 ring-1 ring-inset ring-slate-300/60 overflow-hidden">
                    <div className={`h-full rounded-full ${warnaPct(ps)}`} style={{ width: `${Math.max(s.pakai > 0 ? 4 : 0, Math.min(100, ps))}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">terpakai <b className="tabular-nums text-slate-900">{rupiahShort(s.pakai)}</b></span>
                    <span className={`font-extrabold tabular-nums ${tintPct(ps)}`}>{ps}%</span>
                    <span className="text-slate-600">sisa <b className={`tabular-nums ${s.pagu - s.pakai < 0 ? "text-red-700" : "text-emerald-700"}`}>{rupiahShort(s.pagu - s.pakai)}</b></span>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-500">{s.jumlahPos} pos anggaran{s.perhatian.length > 0 && <span className="ml-1 font-bold text-amber-700">· {s.perhatian.length} perlu perhatian</span>}</p>
                </>
              ) : (
                <p className="mt-4 text-xs text-slate-500">Belum ada pagu. Klik untuk mengisinya.</p>
              )}

              <span className={`mt-3 block text-center text-xs font-bold ${s.teks} group-hover:underline`}>Buka detail →</span>
            </Link>
          );
        })}
      </section>

      {/* ===== grafik ===== */}
      <section className="mt-4 grid lg:grid-cols-2 gap-4">
        {/* perbandingan pagu vs terpakai per sumber */}
        <div className="bg-white rounded-2xl elev-md ring-line p-5">
          <h3 className="font-bold text-slate-800 mb-1">Pagu vs Terpakai per sumber</h3>
          <p className="text-[11px] text-slate-500 mb-3">batang abu = pagu, batang berwarna = sudah terpakai</p>
          <div className="space-y-3">
            {sumber.map((s) => {
              const ps = pct(s.pakai, s.pagu);
              return (
                <div key={s.kunci}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">{s.ikon} {s.judul}</span>
                    <span className="tabular-nums text-slate-600">{rupiahShort(s.pakai)} / {rupiahShort(s.pagu)} <b className={tintPct(ps)}>({ps}%)</b></span>
                  </div>
                  <div className="relative h-5 rounded-lg bg-slate-100 ring-1 ring-inset ring-slate-200 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-slate-300" style={{ width: `${(s.pagu / maksPagu) * 100}%` }} />
                    <div className={`absolute inset-y-0 left-0 ${warnaPct(ps)}`} style={{ width: `${(s.pakai / maksPagu) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {/* Biaya vs Investasi */}
          <div className="mt-4 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-700">Belanja {tahun}: Biaya vs Investasi</span>
              <span className="tabular-nums text-slate-600">{rupiahShort(kategori.total)}</span>
            </div>
            <div className="flex h-5 rounded-lg overflow-hidden ring-1 ring-inset ring-slate-200">
              <div className="bg-gradient-to-r from-[#14b8c4] to-[#16357f]" style={{ width: `${pct(kategori.biaya, kategori.total)}%` }} />
              <div className="bg-gradient-to-r from-violet-500 to-violet-800" style={{ width: `${pct(kategori.inv, kategori.total)}%` }} />
              {kategori.total === 0 && <div className="flex-1 bg-slate-100" />}
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-[11px]">
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-[#16357f] inline-block" />Biaya <b className="tabular-nums">{rupiahShort(kategori.biaya)}</b> ({pct(kategori.biaya, kategori.total)}%)</span>
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-violet-700 inline-block" />Investasi <b className="tabular-nums">{rupiahShort(kategori.inv)}</b> ({pct(kategori.inv, kategori.total)}%)</span>
            </div>
          </div>
        </div>

        {/* tren 6 bulan */}
        <div className="bg-white rounded-2xl elev-md ring-line p-5">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-slate-800">Tren 6 bulan terakhir</h3>
            <div className="ml-auto flex gap-1">
              {([["rutin", "Rutin"], ["semua", "Semua"]] as const).map(([v, t]) => (
                <button key={v} onClick={() => setTabTren(v)}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition ${tabTren === v ? "bg-[#16357f] text-white border-[#16357f]" : "bg-white border-slate-300 text-slate-600 hover:border-[#1ca3dd]"}`}>{t}</button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mb-3">{tabTree(tabTren)}</p>
          <div className="flex items-stretch gap-2 h-40">
            {tren.map((t) => {
              const hPagu = (t.pagu / maksTren) * 100;
              const hPakai = (t.pakai / maksTren) * 100;
              const ps = pct(t.pakai, t.pagu);
              return (
                <div key={t.bulan} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-[9px] font-bold tabular-nums text-slate-500 opacity-0 group-hover:opacity-100 transition">{rupiahShort(t.pakai)}</span>
                  <div className="relative w-full flex-1 min-h-0" title={`${bulanTahun(t.bulan + "-01")}: terpakai ${rupiah(Math.round(t.pakai))}${t.pagu ? ` dari pagu ${rupiah(t.pagu)} (${ps}%)` : ""}`}>
                    {t.pagu > 0 && <div className="absolute bottom-0 inset-x-0 rounded-t bg-slate-200" style={{ height: `${Math.max(2, hPagu)}%` }} />}
                    <div className={`absolute bottom-0 inset-x-0 rounded-t ${t.pagu ? warnaPct(ps) : "bg-slate-400"}`} style={{ height: `${t.pakai > 0 ? Math.max(2, hPakai) : 0}%` }} />
                    {t.pakai === 0 && t.pagu === 0 && <div className="absolute bottom-0 inset-x-0 h-[2px] bg-slate-200 rounded" />}
                  </div>
                  <span className="text-[9px] text-slate-500 whitespace-nowrap">{bulanTahun(t.bulan + "-01").split(" ")[0].slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== rincian per kapal (Docking) & per surat (Lainnya) ===== */}
      <section className="mt-4 bg-white rounded-2xl elev-md ring-line p-5">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className="font-bold text-slate-800">Rincian anggaran</h3>
          <div className="flex gap-1 ml-auto">
            {([["docking", `⚓ Docking per kapal (${perKapalDocking.length})`], ["lainnya", `📜 Persetujuan Lainnya (${perSurat.length})`], ["rutin", "🧭 Rutin per Mata Anggaran"]] as const).map(([v, t]) => (
              <button key={v} onClick={() => setTabRinci(v)}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition ${tabRinci === v ? "bg-slate-800 text-white border-slate-800" : "bg-white border-slate-300 text-slate-600 hover:border-slate-500"}`}>{t}</button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          {tabRinci === "docking" ? `Pagu Persetujuan Pusat per kapal tahun ${tahun} — batang menunjukkan porsi terpakai`
            : tabRinci === "lainnya" ? "Tiap surat persetujuan di luar Rutin & Docking"
            : `Pagu Rutin ${bulanTahun(bulan + "-01")} per Mata Anggaran`}
        </p>

        {daftarRinci.length === 0 ? (
          <p className="text-sm text-slate-500 py-3 text-center">Belum ada pagu pada bagian ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600 font-bold border-b-2 border-slate-200">
                <tr>
                  <th className="p-2 text-left">{tabRinci === "docking" ? "Kapal" : tabRinci === "lainnya" ? "Surat Persetujuan" : "Mata Anggaran"}</th>
                  <th className="p-2 text-right w-32">Pagu</th>
                  <th className="p-2 text-right w-24 text-violet-800">Addendum</th>
                  <th className="p-2 text-right w-32">Pagu Total</th>
                  <th className="p-2 text-right w-32">Terpakai</th>
                  <th className="p-2 text-right w-32">Sisa</th>
                  <th className="p-2 text-right w-40">Serapan</th>
                  <th className="p-2 text-center w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {daftarRinci.map((d) => {
                  const total = d.pagu + d.add;
                  const ps = pct(d.pakai, total);
                  const st = ps > 100 ? "OVERBUDGET" : ps >= 80 ? "Waspada" : "Aman";
                  const stC = ps > 100 ? "bg-red-100 text-red-800 ring-1 ring-red-300" : ps >= 80 ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300" : "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300";
                  return (
                    <tr key={d.label} className="border-b border-slate-200 even:bg-slate-50/60 row-hover">
                      <td className="p-2 font-semibold text-slate-800">
                        <span className="block truncate max-w-[20rem]" title={d.label}>{d.label}</span>
                        {d.sub && <span className="block text-[10px] text-slate-500 font-normal">{d.sub}</span>}
                      </td>
                      <td className="p-2 text-right tabular-nums whitespace-nowrap text-slate-700">{rupiah(d.pagu)}</td>
                      <td className="p-2 text-right tabular-nums whitespace-nowrap font-bold text-violet-800">{d.add ? "+" + rupiahShort(d.add) : <span className="text-slate-400 font-normal">—</span>}</td>
                      <td className="p-2 text-right tabular-nums whitespace-nowrap font-semibold text-slate-800">{rupiah(total)}</td>
                      <td className="p-2 text-right tabular-nums whitespace-nowrap font-bold text-slate-900">{rupiah(Math.round(d.pakai))}</td>
                      <td className={`p-2 text-right tabular-nums whitespace-nowrap font-bold ${total - d.pakai < 0 ? "text-red-700" : "text-emerald-700"}`}>{rupiah(Math.round(total - d.pakai))}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2.5 rounded-full bg-slate-200 ring-1 ring-inset ring-slate-300/60 overflow-hidden">
                            <div className={`h-full rounded-full ${warnaPct(ps)}`} style={{ width: `${Math.max(d.pakai > 0 ? 4 : 0, Math.min(100, ps))}%` }} />
                          </div>
                          <span className={`text-xs font-bold tabular-nums w-9 text-right ${tintPct(ps)}`}>{ps}%</span>
                        </div>
                      </td>
                      <td className="p-2 text-center"><span className={`inline-block text-[10px] font-extrabold tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap ${stC}`}>{st}</span></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
                  <td className="p-2">TOTAL</td>
                  <td className="p-2 text-right tabular-nums">{rupiah(jmlRinci.pagu)}</td>
                  <td className="p-2 text-right tabular-nums text-violet-800">{jmlRinci.add ? "+" + rupiahShort(jmlRinci.add) : "—"}</td>
                  <td className="p-2 text-right tabular-nums">{rupiah(jmlRinci.pagu + jmlRinci.add)}</td>
                  <td className="p-2 text-right tabular-nums">{rupiah(Math.round(jmlRinci.pakai))}</td>
                  <td className="p-2 text-right tabular-nums text-emerald-700">{rupiah(Math.round(jmlRinci.pagu + jmlRinci.add - jmlRinci.pakai))}</td>
                  <td className="p-2 text-right tabular-nums">{pct(jmlRinci.pakai, jmlRinci.pagu + jmlRinci.add)}%</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* grafik batang perbandingan */}
        {daftarRinci.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-200">
            <p className="text-[11px] font-semibold text-slate-600 mb-2">Perbandingan pagu (abu) vs terpakai (warna)</p>
            <div className="space-y-2">
              {daftarRinci.map((d) => {
                const total = d.pagu + d.add;
                const ps = pct(d.pakai, total);
                return (
                  <div key={"g" + d.label} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-[11px] font-semibold text-slate-700 truncate" title={d.label}>{d.pendek || d.label}</span>
                    <div className="relative flex-1 h-4 rounded-md bg-slate-100 ring-1 ring-inset ring-slate-200 overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-slate-300" style={{ width: `${(total / maksRinci) * 100}%` }} />
                      <div className={`absolute inset-y-0 left-0 ${warnaPct(ps)}`} style={{ width: `${(d.pakai / maksRinci) * 100}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-[10px] tabular-nums text-slate-600 text-right">{rupiahShort(total)}</span>
                    <span className={`w-10 shrink-0 text-[11px] font-bold tabular-nums text-right ${tintPct(ps)}`}>{ps}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ===== perlu perhatian ===== */}
      <section className="mt-4 bg-white rounded-2xl elev-md ring-line p-5">
        <h3 className="font-bold text-slate-800 mb-1">Perlu perhatian</h3>
        <p className="text-[11px] text-slate-500 mb-3">pos anggaran yang serapannya sudah ≥ 80% — dari seluruh sumber</p>
        {semuaPerhatian.length === 0 ? (
          <p className="text-sm text-emerald-800 bg-emerald-50 ring-1 ring-emerald-300 rounded-xl px-3 py-2">✅ Tidak ada pos yang mendekati pagu. Semua terkendali.</p>
        ) : (
          <div className="space-y-1.5">
            {semuaPerhatian.map((x, i) => (
              <Link key={i} href={x.href} className="flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-slate-200 hover:ring-slate-300 hover:bg-slate-50 transition">
                <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${x.pct > 100 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{x.pct > 100 ? "lewat" : "waspada"}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-slate-800 truncate">{x.label}</span>
                  <span className="block text-[10px] text-slate-500">{x.sumber}</span>
                </span>
                <span className="text-[11px] tabular-nums text-slate-600 whitespace-nowrap">{rupiahShort(x.pakai)} / {rupiahShort(x.pagu)}</span>
                <span className={`text-sm font-extrabold tabular-nums w-12 text-right ${tintPct(x.pct)}`}>{x.pct}%</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ===== pintu tambahan ===== */}
      <section className="mt-4 grid sm:grid-cols-3 gap-3">
        <Pintu href="/dashboard?v=rincian" ikon="🏷️" judul="Rincian & RKA" sub="Penyerapan per Mata Anggaran, per kapal, RKA, Rencana vs Realisasi" />
        <Pintu href="/sppbj" ikon="📑" judul="SPPBJ Pengadaan" sub="Riwayat & buat pengadaan baru" />
        <Pintu href="/nonpr" ikon="🧾" judul="SPPBJ Non PR PO" sub="Pengadaan tanpa PR/PO" />
      </section>
    </>
  );
}

const tabTree = (v: "rutin" | "semua") =>
  v === "rutin"
    ? "batang abu = pagu Rutin bulan itu, batang berwarna = realisasi Rutin"
    : "batang berwarna = seluruh pengadaan (Rutin + Docking + Lainnya) pada bulan itu";

function Besar({ label, nilai, sub, bar, tint = "text-slate-900" }: { label: string; nilai: string; sub: string; bar: string; tint?: string }) {
  return (
    <div className="relative bg-white rounded-2xl ring-line elev-sm pl-4 pr-3 py-3 overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${bar}`} />
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold">{label}</p>
      <p className={`text-xl font-extrabold tabular-nums leading-tight ${tint}`}>{nilai}</p>
      <p className="text-[10px] text-slate-500 mt-0.5 truncate">{sub}</p>
    </div>
  );
}

function Pintu({ href, ikon, judul, sub }: { href: string; ikon: string; judul: string; sub: string }) {
  return (
    <Link href={href} className="group bg-white rounded-2xl ring-line elev-sm p-4 hover:elev-md transition flex items-start gap-3">
      <span className="h-9 w-9 rounded-xl grid place-items-center text-base bg-slate-100 shrink-0">{ikon}</span>
      <span className="min-w-0">
        <span className="block font-bold text-slate-800 text-sm group-hover:text-[#16357f]">{judul} →</span>
        <span className="block text-[11px] text-slate-500 leading-snug">{sub}</span>
      </span>
    </Link>
  );
}
