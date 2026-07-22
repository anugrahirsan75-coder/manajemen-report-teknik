"use client";
/**
 * Lembar cetak / Export PDF untuk Dashboard Anggaran.
 *   /dashboard/cetak?jenis=docking&kapal=KMP. BARONANG&tahun=2026
 *   /dashboard/cetak?jenis=rutin&bulan=2026-07
 *   /dashboard/cetak?jenis=lainnya&program=<id>
 * Halaman ini hanya menampilkan lembar A4 lalu memanggil dialog cetak
 * (di dialog pilih "Save as PDF" untuk menyimpan berkas).
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAnggaran, realisasiDocking, realisasiRutin, realisasiProgram } from "@/lib/anggaran/store";
import { maKey, isMaInvestasi, DOCKING_MA, DOCKING_MA_INVESTASI, namaKapalPenuh } from "@/lib/anggaran/types";
import { ringkasKapal } from "@/lib/kapal/nama";
import { rupiah, bulanTahun, tanggalIndo } from "@/lib/format";

type Baris = { label: string; sub?: string; pagu: number; add: number; pakai: number; inv: boolean };

function Lembar() {
  const q = useSearchParams();
  const jenis = (q.get("jenis") || "docking") as "docking" | "rutin" | "lainnya";
  const kapal = q.get("kapal") || "";
  const tahun = parseInt(q.get("tahun") || "0", 10) || new Date().getFullYear();
  const bulan = q.get("bulan") || new Date().toISOString().slice(0, 7);
  const programId = q.get("program") || "";

  const { loading, pengadaan, plafon, docking, program } = useAnggaran();
  const [siap, setSiap] = useState(false);

  const data = useMemo(() => {
    if (jenis === "docking") {
      const entry = docking.find((d) => d.kapal === kapal && d.tahun === tahun);
      const real = realisasiDocking(pengadaan, kapal, tahun);
      const by: Record<string, Baris> = {};
      [...DOCKING_MA, ...DOCKING_MA_INVESTASI].forEach((m) => { by[m.kode] = { label: `${m.kode} (${m.label})`, pagu: 0, add: 0, pakai: 0, inv: isMaInvestasi(m.kode) }; });
      (entry?.rows || []).forEach((r) => {
        const k = maKey(r.ma);
        by[k] = { label: by[k]?.label || r.ma, pagu: (by[k]?.pagu || 0) + (r.nilai || 0), add: (by[k]?.add || 0) + (r.addendum || 0), pakai: by[k]?.pakai || 0, inv: isMaInvestasi(k) };
      });
      Object.entries(real.perKey).forEach(([k, v]) => { if (by[k]) by[k].pakai = v; else by[k] = { label: k, pagu: 0, add: 0, pakai: v, inv: isMaInvestasi(k) }; });
      return {
        judul: "LAPORAN KENDALI ANGGARAN DOCKING",
        sub: `${kapal} — Tahun ${tahun}`,
        info: [["No. Surat Persetujuan", entry?.noSurat || "—"], ["No. Surat Addendum", entry?.noSuratAddendum || "—"]] as [string, string][],
        kolomLabel: "Mata Anggaran",
        baris: Object.values(by).sort((a, b) => (a.inv === b.inv ? 0 : a.inv ? 1 : -1)),
      };
    }
    if (jenis === "rutin") {
      const entry = plafon.find((p) => p.bulan === bulan);
      const real = realisasiRutin(pengadaan, bulan);
      const by: Record<string, Baris> = {};
      (entry?.rows || []).forEach((r) => { const k = maKey(r.ma); by[k] = { label: r.ma, pagu: (by[k]?.pagu || 0) + (r.nilai || 0), add: 0, pakai: by[k]?.pakai || 0, inv: isMaInvestasi(k) }; });
      Object.entries(real.perKey).forEach(([k, v]) => { if (by[k]) by[k].pakai = v; else by[k] = { label: real.list.find((x) => x.key === k)?.ma || k, pagu: 0, add: 0, pakai: v, inv: isMaInvestasi(k) }; });
      return {
        judul: "LAPORAN KENDALI ANGGARAN RUTIN",
        sub: `Persetujuan Rutin — ${bulanTahun(bulan + "-01")}`,
        info: [["Periode", bulanTahun(bulan + "-01")], ["Sumber realisasi", "SPPBJ Pengadaan & SPPBJ Non PR PO (Jenis Anggaran: Rutin)"]] as [string, string][],
        kolomLabel: "Mata Anggaran",
        baris: Object.values(by),
      };
    }
    const pr = program.find((p) => p.id === programId);
    const real = realisasiProgram(pengadaan, programId);
    const by: Record<string, Baris> = {};
    (pr?.rows || []).forEach((r) => {
      const kp = namaKapalPenuh(r.kapal || "") || "(umum)";
      const k = `${kp}|${maKey(r.ma)}`;
      by[k] = { label: ringkasKapal(kp), sub: r.ma, pagu: (by[k]?.pagu || 0) + (r.nilai || 0), add: (by[k]?.add || 0) + (r.addendum || 0), pakai: by[k]?.pakai || 0, inv: isMaInvestasi(maKey(r.ma)) };
    });
    Object.entries(real.perKunci).forEach(([k, v]) => {
      if (by[k]) by[k].pakai = v;
      else { const [kp, kode] = k.split("|"); by[k] = { label: ringkasKapal(kp), sub: kode, pagu: 0, add: 0, pakai: v, inv: isMaInvestasi(kode) }; }
    });
    return {
      judul: "LAPORAN PERSETUJUAN BIAYA LAINNYA",
      sub: `${pr?.nama || "(program)"} — Tahun ${pr?.tahun || tahun}`,
      info: [["No. Surat", pr?.noSurat || "—"], ["Tanggal Surat", pr?.tanggal ? tanggalIndo(pr.tanggal) : "—"], ["Perihal", pr?.perihal || "—"]] as [string, string][],
      kolomLabel: "Kapal / Mata Anggaran",
      baris: Object.values(by).sort((a, b) => (a.inv === b.inv ? a.label.localeCompare(b.label) : a.inv ? 1 : -1)),
    };
  }, [jenis, kapal, tahun, bulan, programId, pengadaan, plafon, docking, program]);

  // cetak otomatis setelah data siap
  useEffect(() => {
    if (loading || siap) return;
    const t = setTimeout(() => { setSiap(true); window.print(); }, 1200);
    return () => clearTimeout(t);
  }, [loading, siap]);

  const biaya = data.baris.filter((b) => !b.inv);
  const investasi = data.baris.filter((b) => b.inv);
  const jml = (arr: Baris[]) => ({ pagu: arr.reduce((s, x) => s + x.pagu + x.add, 0), pakai: arr.reduce((s, x) => s + x.pakai, 0) });
  const tot = jml(data.baris);
  const pctTot = tot.pagu ? Math.round((tot.pakai / tot.pagu) * 100) : 0;

  const Baris = (b: Baris, i: number) => {
    const pagu = b.pagu + b.add;
    const pct = pagu ? Math.round((b.pakai / pagu) * 100) : (b.pakai ? 999 : 0);
    return (
      <tr key={b.label + (b.sub || "") + i}>
        <td className="text-center">{i + 1}</td>
        <td className="px-1">{b.label}{b.sub && <div className="text-[8pt] text-slate-600">{b.sub}</div>}</td>
        <td className="text-right px-1">{b.pagu ? rupiah(b.pagu) : "0"}</td>
        <td className="text-right px-1">{b.add ? rupiah(b.add) : "—"}</td>
        <td className="text-right px-1">{pagu ? rupiah(pagu) : "0"}</td>
        <td className="text-right px-1">{rupiah(Math.round(b.pakai))}</td>
        <td className="text-right px-1">{rupiah(Math.round(pagu - b.pakai))}</td>
        <td className="text-center">{pagu ? pct + "%" : "—"}</td>
      </tr>
    );
  };

  return (
    <>
      <div className="no-print max-w-[210mm] mx-auto px-4 pt-4 flex items-center gap-2">
        <a href="/dashboard" className="btn btn-ghost text-xs">‹ Kembali ke Dashboard</a>
        <button onClick={() => window.print()} className="btn btn-primary text-xs ml-auto">🖨️ Cetak / Simpan PDF</button>
      </div>

      <div className="print-page landscape text-black">
        <div className="flex items-center gap-3 border-b-2 border-black pb-2 mb-3">
          <Image src="/logo-asdp.png" alt="ASDP" width={70} height={48} className="object-contain" />
          <div className="flex-1 text-center">
            <div className="text-[13pt] font-bold">{data.judul}</div>
            <div className="text-[11pt] font-bold">{data.sub}</div>
            <div className="text-[9pt]">PT ASDP Indonesia Ferry (Persero) — Cabang Ternate</div>
          </div>
          <div className="text-[8pt] text-right">Dicetak<br />{tanggalIndo(new Date().toISOString().slice(0, 10))}</div>
        </div>

        <table className="text-[9pt] mb-2">
          <tbody>
            {data.info.map(([k, v]) => (
              <tr key={k}><td className="pr-2 align-top w-44">{k}</td><td className="pr-1 align-top">:</td><td className="align-top">{v}</td></tr>
            ))}
          </tbody>
        </table>

        <table className="doc-table text-[9pt]">
          <thead>
            <tr className="bg-blue-50 font-bold text-center">
              <td className="w-8">NO.</td><td>{data.kolomLabel}</td>
              <td className="w-28">PAGU AWAL</td><td className="w-24">ADDENDUM</td><td className="w-28">PAGU TOTAL</td>
              <td className="w-28">TERPAKAI</td><td className="w-28">SISA</td><td className="w-16">SERAPAN</td>
            </tr>
          </thead>
          <tbody>
            {biaya.length > 0 && (
              <tr className="font-bold bg-slate-100"><td /><td colSpan={7} className="px-1">BIAYA — pagu {rupiah(jml(biaya).pagu)} · terpakai {rupiah(Math.round(jml(biaya).pakai))}</td></tr>
            )}
            {biaya.map(Baris)}
            {investasi.length > 0 && (
              <tr className="font-bold bg-slate-100"><td /><td colSpan={7} className="px-1">INVESTASI (BELANJA MODAL) — pagu {rupiah(jml(investasi).pagu)} · terpakai {rupiah(Math.round(jml(investasi).pakai))}</td></tr>
            )}
            {investasi.map((b, i) => Baris(b, biaya.length + i))}
            <tr className="font-bold bg-slate-200">
              <td colSpan={2} className="text-center">TOTAL</td>
              <td className="text-right px-1">{rupiah(data.baris.reduce((s, b) => s + b.pagu, 0))}</td>
              <td className="text-right px-1">{rupiah(data.baris.reduce((s, b) => s + b.add, 0))}</td>
              <td className="text-right px-1">{rupiah(tot.pagu)}</td>
              <td className="text-right px-1">{rupiah(Math.round(tot.pakai))}</td>
              <td className="text-right px-1">{rupiah(Math.round(tot.pagu - tot.pakai))}</td>
              <td className="text-center">{pctTot}%</td>
            </tr>
          </tbody>
        </table>

        <div className="grid grid-cols-2 mt-8 text-center text-[10pt]">
          <div><p>Dibuat oleh,</p><p>Staf Teknik</p><div className="h-14" /><p className="font-bold underline">&nbsp;</p></div>
          <div><p>Mengetahui,</p><p>Dept. Head Operasional dan Teknik</p><div className="h-14" /><p className="font-bold underline">&nbsp;</p></div>
        </div>
      </div>
    </>
  );
}

export default function CetakAnggaran() {
  return <Suspense fallback={<p className="p-8 text-sm text-slate-500">Menyiapkan lembar…</p>}><Lembar /></Suspense>;
}
