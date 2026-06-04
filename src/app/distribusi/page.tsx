"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { sampleData } from "@/lib/sampleData";
import { Distribusi, DistribusiGroup, hitungDistribusi, brutoUntukJabatan } from "@/lib/types";
import { rupiah } from "@/lib/format";
import { Input } from "@/components/Field";

export default function DistribusiPage() {
  const { data, update } = useStore();
  const dist: Distribusi = data.distribusi ?? sampleData.distribusi!;

  const setDist = (patch: Partial<Distribusi>) => update({ distribusi: { ...dist, ...patch } });
  const setGroup = (i: number, patch: Partial<DistribusiGroup>) =>
    setDist({ groups: dist.groups.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) });
  const addGroup = () =>
    setDist({ groups: [...dist.groups, { label: "", keywords: [], bobot: 0, jumlah: 0 }] });
  const delGroup = (i: number) => setDist({ groups: dist.groups.filter((_, idx) => idx !== i) });

  const { rows, totalBobot, totalKaryawan, totalBruto } = hitungDistribusi(dist);

  const terapkan = () => {
    let matched = 0;
    const crew = data.crew.map((c) => {
      const b = brutoUntukJabatan(dist, c.jabatan);
      if (b != null) { matched++; return { ...c, nilaiBruto: b }; }
      return c;
    });
    update({ crew, biayaPekerjaan: dist.nilaiSwakelola });
    alert(`Nilai Bruto terisi untuk ${matched}/${data.crew.length} crew (berdasarkan kecocokan jabatan).`);
  };

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <div className="glass rounded-2xl border border-slate-100 shadow-sm px-5 py-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-slate-500 hover:text-[#16357f] inline-flex items-center gap-1"><span className="text-base leading-none">‹</span> Dashboard</Link>
          <h1 className="text-xl font-extrabold asdp-text-gradient">Perhitungan Swakelola (Distribusi)</h1>
          <p className="text-xs text-slate-500">Bagi total nilai per golongan jabatan → Penerimaan Bruto per orang.</p>
        </div>
        <button onClick={terapkan} className="asdp-gradient text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md hover:opacity-95 transition">
          ⤵️ Terapkan Bruto ke Crew
        </button>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
        <label className="block max-w-xs">
          <span className="text-xs font-medium text-slate-600">Jumlah Nilai Swakelola (Rp)</span>
          <Input type="number" value={dist.nilaiSwakelola} onChange={(e) => setDist({ nilaiSwakelola: +e.target.value })} className="mt-1" />
        </label>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-slate-50 text-xs">
              <tr>
                <th className="p-2 border text-left">JABATAN (golongan)</th>
                <th className="p-2 border text-left">Keyword cocok</th>
                <th className="p-2 border w-16">BOBOT</th>
                <th className="p-2 border w-20">JML KARY</th>
                <th className="p-2 border w-20">JML×BOBOT</th>
                <th className="p-2 border w-16">%</th>
                <th className="p-2 border w-28">BESARAN/LEVEL</th>
                <th className="p-2 border w-28">BRUTO/ORANG</th>
                <th className="p-2 border w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="border p-1"><input className="w-36 px-1" value={r.label} onChange={(e) => setGroup(i, { label: e.target.value })} /></td>
                  <td className="border p-1"><input className="w-44 px-1 text-xs" value={r.keywords.join(", ")} onChange={(e) => setGroup(i, { keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></td>
                  <td className="border p-1"><input type="number" className="w-14 px-1 text-center" value={r.bobot} onChange={(e) => setGroup(i, { bobot: +e.target.value })} /></td>
                  <td className="border p-1"><input type="number" className="w-16 px-1 text-center" value={r.jumlah} onChange={(e) => setGroup(i, { jumlah: +e.target.value })} /></td>
                  <td className="border p-1 text-center">{r.jmlhxBobot}</td>
                  <td className="border p-1 text-center">{(r.persentase * 100).toFixed(0)}%</td>
                  <td className="border p-1 text-right">{rupiah(r.besaran)}</td>
                  <td className="border p-1 text-right font-semibold">{rupiah(Math.round(r.brutoPerOrang))}</td>
                  <td className="border p-1 text-center"><button onClick={() => delGroup(i)} className="text-red-500 text-xs">×</button></td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-semibold">
                <td className="border p-1 text-center" colSpan={2}>JUMLAH</td>
                <td className="border p-1 text-center">{dist.groups.reduce((s, g) => s + g.bobot, 0)}</td>
                <td className="border p-1 text-center">{totalKaryawan}</td>
                <td className="border p-1 text-center">{totalBobot}</td>
                <td className="border p-1 text-center">100%</td>
                <td className="border p-1 text-right">{rupiah(Math.round(totalBruto))}</td>
                <td className="border p-1"></td>
                <td className="border p-1"></td>
              </tr>
            </tbody>
          </table>
        </div>
        <button onClick={addGroup} className="mt-3 text-sm border px-3 py-1.5 rounded-lg">+ Tambah Golongan</button>
        <p className="text-xs text-slate-500 mt-3">
          <b>BRUTO/ORANG</b> = BESARAN/LEVEL ÷ JML KARY. <b>Terapkan Bruto ke Crew</b> mengisi kolom Nilai Bruto tiap crew di File 03 &amp; 05 sesuai kecocokan jabatan dengan keyword. Total nilai juga disalin ke Biaya/Nilai Swakelola.
        </p>
      </section>
    </main>
  );
}
