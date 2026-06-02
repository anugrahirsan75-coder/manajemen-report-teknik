"use client";

import { useStore } from "@/lib/store";
import { formatNomorSpk } from "@/lib/types";
import { tanggalIndo } from "@/lib/format";
import { pekerjaanMesinDinamis } from "@/lib/generators/pekerjaan";
import DocToolbar from "@/components/DocToolbar";

export default function LampiranDoc() {
  const { data: d } = useStore();
  const mesin = pekerjaanMesinDinamis(d);

  return (
    <>
      <DocToolbar title="04. Lampiran SPK" slug="lampiran" data={d} nativeKind="excel" />
      <div className="print-page text-black">
        <div className="flex justify-end mb-4">
          <table className="text-[11pt]">
            <tbody>
              <tr><td className="pr-2 font-bold">Lampiran SPK No.</td><td>: {formatNomorSpk(d)}</td></tr>
              <tr><td className="pr-2 font-bold">Tanggal</td><td>: {tanggalIndo(d.tanggalSelesai)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="text-center font-bold mb-4">PEKERJAAN SWAKELOLA {d.namaKapal}</div>

        <table className="doc-table text-[10pt]">
          <thead>
            <tr className="bg-blue-50 font-bold text-center"><td className="w-8">No</td><td>Uraian Pekerjaan</td><td className="w-12">Jumlah</td><td className="w-14">Satuan</td></tr>
          </thead>
          <tbody>
            <tr className="bg-slate-100 font-bold"><td colSpan={4}>I. PEKERJAAN SWAKELOLA DECK</td></tr>
            {d.pekerjaanDeck.map((it) => (
              <tr key={"d" + it.no}><td className="text-center">{it.no}</td><td>{it.uraian}</td><td className="text-center">{it.qty}</td><td className="text-center">{it.satuan}</td></tr>
            ))}
            <tr className="bg-slate-100 font-bold"><td colSpan={4}>II. PEKERJAAN SWAKELOLA MESIN</td></tr>
            {mesin.map((it) => (
              <tr key={"m" + it.no}><td className="text-center">{it.no}</td><td>{it.uraian}</td><td className="text-center">{it.qty}</td><td className="text-center">{it.satuan}</td></tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 mt-10 text-center">
          <div>
            <p>Nakhoda</p><p>{d.namaKapal}</p>
            <div className="h-20" />
            <p className="font-bold underline">{d.nakhoda}</p>
          </div>
          <div>
            <p>GENERAL MANAGER</p><p>PT. ASDP Indonesia Ferry (Persero)</p><p>Cabang Ternate</p>
            <div className="h-14" />
            <p className="font-bold underline">{d.generalManager}</p>
          </div>
        </div>
      </div>
    </>
  );
}
