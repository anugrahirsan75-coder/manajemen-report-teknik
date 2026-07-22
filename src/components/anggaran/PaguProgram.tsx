"use client";
/**
 * Panel "Sumber Pagu — Persetujuan Biaya Lainnya" di form SPPBJ / Non PR PO.
 * Tujuan: sekali pilih surat, sisanya otomatis — Mata Anggaran, kapal, nama pengadaan,
 * dasar pelimpahan terisi; sisa pagu tiap pos terlihat; kelebihan pakai langsung diperingatkan.
 */
import { useMemo, useState } from "react";
import { PlafonProgram } from "@/lib/anggaran/types";
import { PengadaanRow } from "@/lib/anggaran/store";
import { posProgram, cekPemakaian, PosProgram } from "@/lib/anggaran/program";
import { ringkasKapal } from "@/lib/kapal/nama";
import { rupiah, tanggalIndo } from "@/lib/format";

export interface PaguProgramProps {
  program: PlafonProgram[];
  pengadaan: PengadaanRow[];
  programId?: string;
  reqId?: string;
  items?: any[];
  mataAnggaran?: string[] | string;
  namaPengadaan?: string;
  onPilih: (programId: string | undefined, prog?: PlafonProgram) => void;
  /** tarik 1 pos jadi baris item (kapal + MA sudah terisi) */
  onTarik?: (pos: PosProgram) => void;
  /** tarik SEMUA pos yang masih punya sisa */
  onTarikSemua?: (pos: PosProgram[]) => void;
}

export default function PaguProgram(p: PaguProgramProps) {
  const [buka, setBuka] = useState(true);
  const prog = p.program.find((x) => x.id === p.programId);
  const pos = useMemo(() => posProgram(prog, p.pengadaan, p.reqId), [prog, p.pengadaan, p.reqId]);
  const cek = useMemo(() => cekPemakaian(pos, { items: p.items, mataAnggaran: p.mataAnggaran }), [pos, p.items, p.mataAnggaran]);

  const totalPagu = pos.reduce((s, x) => s + x.pagu, 0);
  const totalSisa = pos.reduce((s, x) => s + x.sisa, 0);
  const sisaSetelah = totalSisa - cek.totalDipakai;

  return (
    <div className="rounded-xl ring-1 ring-indigo-300 bg-indigo-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900">📜 Sumber pagu — Persetujuan Biaya Lainnya</span>
        <select value={p.programId || ""} onChange={(e) => p.onPilih(e.target.value || undefined, p.program.find((x) => x.id === e.target.value))}
          className="text-xs border border-indigo-300 rounded-lg px-2 py-1.5 bg-white min-w-[16rem]">
          <option value="">— pilih surat persetujuan —</option>
          {p.program.map((pr) => <option key={pr.id} value={pr.id}>{pr.nama} ({pr.tahun}){pr.noSurat ? ` — ${pr.noSurat}` : ""}</option>)}
        </select>
        {prog && <button type="button" onClick={() => setBuka((v) => !v)} className="btn btn-ghost text-xs">{buka ? "▴ sembunyikan pos" : `▾ lihat ${pos.length} pos`}</button>}
        {prog && p.onTarikSemua && (
          <button type="button" onClick={() => p.onTarikSemua!(pos.filter((x) => x.sisa > 0))} className="btn btn-primary text-xs ml-auto">
            ⤵️ Tarik semua pos bersisa ({pos.filter((x) => x.sisa > 0).length})
          </button>
        )}
      </div>

      {p.program.length === 0 && (
        <p className="text-[11px] text-amber-800 mt-2">Belum ada surat persetujuan. Buat dulu di <b>Dashboard Anggaran → Persetujuan Biaya Lainnya</b>.</p>
      )}

      {prog && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-700">
            {prog.noSurat && <span>No. <b>{prog.noSurat}</b></span>}
            {prog.tanggal && <span>{tanggalIndo(prog.tanggal)}</span>}
            <span>Pagu surat <b className="tabular-nums">{rupiah(totalPagu)}</b></span>
            <span>Sisa sebelum pengadaan ini <b className="tabular-nums text-emerald-700">{rupiah(Math.round(totalSisa))}</b></span>
            <span>Dipakai pengadaan ini <b className="tabular-nums text-blue-800">{rupiah(Math.round(cek.totalDipakai))}</b></span>
            <span>Sisa setelah ini <b className={`tabular-nums ${sisaSetelah < 0 ? "text-red-700" : "text-emerald-700"}`}>{rupiah(Math.round(sisaSetelah))}</b></span>
          </div>

          {(cek.over.length > 0 || cek.tanpaPos.length > 0) && (
            <div className="mt-2 space-y-1">
              {cek.over.map((o) => (
                <p key={o.kunci} className="text-[11px] bg-red-50 text-red-800 ring-1 ring-red-300 rounded-lg px-2 py-1">
                  ⚠ <b>{ringkasKapal(o.kapal)} · {o.ma}</b> melebihi pagu {rupiah(Math.round(o.lebih))} (dipakai {rupiah(Math.round(o.nilai))}, sisa {rupiah(Math.round(o.sisa))})
                </p>
              ))}
              {cek.tanpaPos.map((o) => (
                <p key={o.kunci} className="text-[11px] bg-amber-50 text-amber-900 ring-1 ring-amber-300 rounded-lg px-2 py-1">
                  ⚠ <b>{ringkasKapal(o.kapal)} · {o.ma}</b> tak ada di surat ini ({rupiah(Math.round(o.nilai))}) — cek kapal/Mata Anggaran, atau tambahkan posnya di Dashboard.
                </p>
              ))}
            </div>
          )}

          {buka && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-indigo-100 text-indigo-900 font-bold">
                  <tr>
                    <th className="p-1.5 text-left">Kapal</th><th className="p-1.5 text-left">Mata Anggaran</th>
                    <th className="p-1.5 text-right w-28">Pagu</th><th className="p-1.5 text-right w-28">Sisa</th>
                    <th className="p-1.5 text-right w-28">Dipakai di sini</th><th className="p-1.5 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {pos.map((x) => {
                    const dipakai = cek.rincian.find((r) => r.kunci === x.kunci)?.nilai || 0;
                    const habis = x.sisa <= 0;
                    return (
                      <tr key={x.kunci} className={`border-b border-indigo-100 ${dipakai ? "bg-blue-50/60" : ""}`}>
                        <td className="p-1.5 font-semibold text-slate-800">{ringkasKapal(x.kapal)}</td>
                        <td className="p-1.5 text-slate-700">{x.ma}{x.inv && <span className="ml-1 text-[9px] font-bold text-violet-800 bg-violet-100 rounded px-1">INV</span>}</td>
                        <td className="p-1.5 text-right tabular-nums text-slate-700">{rupiah(x.pagu)}</td>
                        <td className={`p-1.5 text-right tabular-nums font-bold ${habis ? "text-slate-400" : "text-emerald-700"}`}>{rupiah(Math.round(x.sisa))}</td>
                        <td className="p-1.5 text-right tabular-nums font-bold text-blue-800">{dipakai ? rupiah(Math.round(dipakai)) : "—"}</td>
                        <td className="p-1.5 text-right">
                          {p.onTarik && <button type="button" onClick={() => p.onTarik!(x)} className="text-[10px] font-bold text-indigo-700 hover:underline">＋ tarik</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-500 mt-1">“Tarik” membuat baris item dengan kapal &amp; Mata Anggaran sudah terisi — tinggal ketik barang/jasa dan harga.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
