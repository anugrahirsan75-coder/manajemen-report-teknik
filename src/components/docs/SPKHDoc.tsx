"use client";

import { useStore } from "@/lib/store";
import { tanggalIndo, rupiah } from "@/lib/format";
import DocToolbar from "@/components/DocToolbar";

export default function SPKHDoc() {
  const { data: d } = useStore();

  return (
    <>
      <DocToolbar title="07. Surat Pernyataan Kebenaran Harga" slug="spkh" data={d} nativeKind="excel" />
      <div className="print-page text-black">
        <div className="text-center font-bold leading-tight mb-1">
          <div className="text-[13pt]">SURAT PERNYATAAN KEBENARAN HARGA</div>
          <div className="text-[11pt]">DENGAN NILAI DIBAWAH Rp. 25 Juta</div>
        </div>
        <hr className="border-black my-3" />

        <p className="mb-2">Saya yang bertanda tangan dibawah ini :</p>
        <table className="mb-3 text-[11pt]">
          <tbody>
            <tr><td className="pr-3">Nama</td><td>: <b>{d.deptHeadOpsTeknik}</b></td></tr>
            <tr><td className="pr-3">Jabatan</td><td>: Dept. Head Operasional dan Teknik</td></tr>
            <tr><td className="pr-3">Nik</td><td>: {d.nikDeptHead}</td></tr>
          </tbody>
        </table>
        <p className="mb-4">Selanjutnya dinyatakan sebagai &quot;Pembuat Pernyataan&quot;. Dengan ini menyatakan dengan sebenar-benarnya bahwa harga yang tertera di bawah ini benar adanya :</p>

        <table className="doc-table text-[10pt]">
          <thead>
            <tr className="bg-blue-50 font-bold text-center">
              <td className="w-8">No</td><td className="w-12">Jml</td><td className="w-12">Sat</td><td>Uraian Barang / Spesifikasi</td><td>Harga Awal</td><td>Harga Negosiasi</td><td className="w-16">Ket</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-center">1</td><td className="text-center">1</td><td className="text-center">Ls</td>
              <td>Swakelola {d.namaKapal} Dalam Rangka Docking tahun {d.tahun}</td>
              <td className="text-right">{rupiah(d.biayaPekerjaan)}</td><td className="text-right">{rupiah(d.biayaPekerjaan)}</td><td></td>
            </tr>
            <tr className="font-bold bg-slate-100">
              <td colSpan={4} className="text-center">Jumlah Total</td>
              <td className="text-right">{rupiah(d.biayaPekerjaan)}</td><td className="text-right">{rupiah(d.biayaPekerjaan)}</td><td></td>
            </tr>
          </tbody>
        </table>

        <p className="mt-4 mb-6">Demikian Surat Pernyataan ini dibuat untuk digunakan sebagai pendukung pengadaan dan dijamin kebenarannya.</p>
        <p className="text-right">Ternate, {tanggalIndo(d.tanggalSelesai)}</p>
        <div className="grid grid-cols-2 mt-2 text-center">
          <div><p>Mengetahui,</p><p>Nakhoda {d.namaKapal}</p><div className="h-20" /><p className="font-bold underline">{d.nakhoda}</p></div>
          <div><p>Pembuat Pernyataan,</p><p>Dept. Head Operasional dan Teknik</p><div className="h-20" /><p className="font-bold underline">{d.deptHeadOpsTeknik}</p></div>
        </div>
      </div>
    </>
  );
}
