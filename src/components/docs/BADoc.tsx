"use client";

import { useStore } from "@/lib/store";
import { formatNomorSpk } from "@/lib/types";
import { tanggalIndo } from "@/lib/format";
import { pekerjaanMesinDinamis } from "@/lib/generators/pekerjaan";
import DocToolbar from "@/components/DocToolbar";

export default function BADoc() {
  const { data: d } = useStore();
  const mesin = pekerjaanMesinDinamis(d);

  const SignBlock = ({ jab, nama }: { jab: string; nama: string }) => (
    <div className="text-center">
      <p>{jab}</p>
      <div className="h-16" />
      <p className="font-bold underline">{nama}</p>
    </div>
  );

  return (
    <>
      <DocToolbar title="02. Berita Acara Swakelola" slug="ba" data={d} nativeKind="excel" />
      <div className="print-page text-black">
        <div className="text-center font-bold leading-tight">
          <div className="text-[12pt]">PT. ASDP INDONESIA FERRY (PERSERO) — CABANG TERNATE</div>
          <div className="text-[13pt] mt-1">BERITA ACARA PENYELESAIAN PEKERJAAN SWAKELOLA</div>
        </div>
        <hr className="border-black border-t-2 my-3" />

        <p className="mb-2">Pada hari ini, {tanggalIndo(d.tanggalSelesai)}, telah dilaksanakan dan diselesaikan pekerjaan swakelola docking {d.namaKapal}.</p>
        <p className="mb-4">Berdasarkan Surat Perintah Kerja (SPK) Nomor <b>{formatNomorSpk(d)}</b> tanggal {tanggalIndo(d.tanggalMulai)}, dengan rincian pekerjaan sebagai berikut :</p>

        <table className="doc-table text-[10pt]">
          <thead>
            <tr className="bg-blue-50 font-bold text-center">
              <td className="w-8">NO</td><td>KETERANGAN / URAIAN</td><td className="w-12">JML</td><td className="w-14">SAT</td><td className="w-14">HASIL</td><td className="w-16">KET</td>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-slate-100 font-bold"><td colSpan={6}>I. PEKERJAAN SWAKELOLA DECK</td></tr>
            {d.pekerjaanDeck.map((it) => (
              <tr key={"d" + it.no}><td className="text-center">{it.no}</td><td>{it.uraian}</td><td className="text-center">{it.qty}</td><td className="text-center">{it.satuan}</td><td className="text-center">{it.hasil}</td><td className="text-center">{it.ket}</td></tr>
            ))}
            <tr className="bg-slate-100 font-bold"><td colSpan={6}>II. PEKERJAAN SWAKELOLA MESIN</td></tr>
            {mesin.map((it) => (
              <tr key={"m" + it.no}><td className="text-center">{it.no}</td><td>{it.uraian}</td><td className="text-center">{it.qty}</td><td className="text-center">{it.satuan}</td><td className="text-center">{it.hasil}</td><td className="text-center">{it.ket}</td></tr>
            ))}
          </tbody>
        </table>

        <p className="text-center mt-8 mb-6">{d.namaKapal}, {tanggalIndo(d.tanggalSelesai)}</p>
        <div className="grid grid-cols-2 gap-y-10">
          <SignBlock jab="Nakhoda" nama={d.nakhoda} />
          <SignBlock jab="KKM" nama={d.kkm} />
          <SignBlock jab="Owner Surveyor" nama={d.ownerSurveyor} />
          <SignBlock jab="Muallim I" nama={d.muallimI} />
        </div>
      </div>
    </>
  );
}
