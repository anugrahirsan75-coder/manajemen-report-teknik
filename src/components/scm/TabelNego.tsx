"use client";
/**
 * Negosiasi harga per item.
 *
 * Potongan rata hanyalah titik berangkat. Di lapangan negosiasi tidak pernah
 * rata: beberapa baris turun banyak, sebagian tak bergerak sama sekali. Karena
 * itu tiap baris bisa disunting sendiri, dan yang tersimpan adalah ANGKA hasil
 * kesepakatan — bukan rumus "penawaran dikali 95%" yang diam-diam mengarang
 * harga yang tak pernah disepakati siapa pun.
 */
import { useMemo, useState } from "react";
import { rupiah } from "@/lib/format";

export interface BarisNego {
  idx: number;
  kapal: string;
  nama: string;
  spesifikasi: string;
  jumlah: number;
  satuan: string;
  harga: number;        // penawaran (satuan)
  hargaNego: number;    // hasil nego (satuan)
}

const PPN = 0.11;

export default function TabelNego({ baris, onUbah, onPotongRata }: {
  baris: BarisNego[];
  onUbah: (idx: number, hargaNego: number) => void;
  onPotongRata: (persen: number) => void;
}) {
  const [persen, setPersen] = useState(5);

  const total = useMemo(() => {
    const awal = baris.reduce((s, b) => s + b.harga * b.jumlah, 0);
    const nego = baris.reduce((s, b) => s + b.hargaNego * b.jumlah, 0);
    return { awal, nego, potongan: awal - nego, ppn: nego * PPN, akhir: nego * (1 + PPN) };
  }, [baris]);

  const kapalSebelum: Record<number, boolean> = {};
  let kapalTerakhir = "";
  baris.forEach((b) => { kapalSebelum[b.idx] = b.kapal !== kapalTerakhir; kapalTerakhir = b.kapal; });

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-slate-600">Potong rata</span>
        <input type="number" min={0} max={100} step={0.5} value={persen}
          onChange={(e) => setPersen(Number(e.target.value))}
          className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
        <span className="text-[11px] text-slate-500">%</span>
        <button onClick={() => onPotongRata(persen)} className="btn btn-ghost text-[11px]">Terapkan ke semua</button>
        <button onClick={() => onPotongRata(0)} className="btn btn-ghost text-[11px]">Kembalikan ke harga penawaran</button>
        <span className="ml-auto text-[11px] text-slate-400">Harga tiap baris tetap bisa diubah sendiri</span>
      </div>

      <div className="max-h-[26rem] overflow-auto rounded-xl ring-1 ring-slate-200">
        <table className="w-full min-w-[54rem] text-xs">
          <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-8 px-2 py-2 text-left font-extrabold">No</th>
              <th className="px-2 py-2 text-left font-extrabold">Nama barang</th>
              <th className="px-2 py-2 text-left font-extrabold">Spesifikasi</th>
              <th className="w-14 px-2 py-2 text-center font-extrabold">Qty</th>
              <th className="w-24 px-2 py-2 text-right font-extrabold">Penawaran</th>
              <th className="w-28 px-2 py-2 text-right font-extrabold">Harga nego</th>
              <th className="w-24 px-2 py-2 text-right font-extrabold">Jumlah nego</th>
              <th className="w-20 px-2 py-2 text-right font-extrabold">Turun</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => {
              const turun = b.harga > 0 ? Math.round((1 - b.hargaNego / b.harga) * 1000) / 10 : 0;
              return (
                <>
                  {kapalSebelum[b.idx] && b.kapal && (
                    <tr key={`k-${b.idx}`} className="bg-slate-100">
                      <td colSpan={8} className="px-2 py-1 text-[11px] font-extrabold text-slate-600">{b.kapal}</td>
                    </tr>
                  )}
                  <tr key={b.idx} className="border-t border-slate-100">
                    <td className="px-2 py-1 text-slate-400 tabular-nums">{b.idx + 1}</td>
                    <td className="px-2 py-1 font-medium text-slate-800">{b.nama}</td>
                    <td className="px-2 py-1 text-slate-500">{b.spesifikasi || "—"}</td>
                    <td className="px-2 py-1 text-center tabular-nums text-slate-600">{b.jumlah} {b.satuan}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-500">{rupiah(b.harga)}</td>
                    <td className="px-2 py-1">
                      <input type="number" min={0} value={b.hargaNego}
                        onChange={(e) => onUbah(b.idx, Math.max(0, Number(e.target.value) || 0))}
                        className={`w-full rounded border px-1.5 py-1 text-right tabular-nums ${
                          b.hargaNego > b.harga ? "border-rose-400 bg-rose-50" : "border-slate-300"}`} />
                    </td>
                    <td className="px-2 py-1 text-right font-semibold tabular-nums text-slate-800">{rupiah(b.hargaNego * b.jumlah)}</td>
                    <td className={`px-2 py-1 text-right tabular-nums ${
                      turun > 0 ? "text-emerald-700" : turun < 0 ? "text-rose-600" : "text-slate-300"}`}>
                      {turun ? `${turun}%` : "—"}
                    </td>
                  </tr>
                </>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 bg-slate-50 text-[11px] font-bold text-slate-700">
            <tr className="border-t-2 border-slate-300">
              <td colSpan={4} className="px-2 py-1.5">Jumlah sebelum PPN</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{rupiah(total.awal)}</td>
              <td />
              <td className="px-2 py-1.5 text-right tabular-nums">{rupiah(total.nego)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">
                {total.potongan ? `−${rupiah(total.potongan)}` : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <dl className="mt-3 grid gap-2 sm:grid-cols-4">
        <Nilai label="Penawaran" nilai={total.awal} />
        <Nilai label="Setelah nego" nilai={total.nego} tebal />
        <Nilai label="PPN 11%" nilai={total.ppn} />
        <Nilai label="Total dibayar" nilai={total.akhir} tebal warna="text-sky-800" />
      </dl>
    </div>
  );
}

function Nilai({ label, nilai, tebal, warna }: { label: string; nilai: number; tebal?: boolean; warna?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
      <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
      <dd className={`tabular-nums ${tebal ? "text-base font-extrabold" : "text-sm font-semibold"} ${warna || "text-slate-800"}`}>
        {rupiah(Math.round(nilai))}
      </dd>
    </div>
  );
}
