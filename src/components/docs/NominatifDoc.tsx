"use client";

import { useStore } from "@/lib/store";
import { formatNomorSpk } from "@/lib/types";
import { tanggalIndo, rupiah } from "@/lib/format";
import DocToolbar from "@/components/DocToolbar";

const WP_NAMA = "PT ASDP INDONESIA FERRY CABANG TERNATE";
const WP_NPWP = "01.061.041.8-942.001";
const WP_ALAMAT = "JL. Pelabuhan Ferry, Bastiong Karance, Kota Ternate Selatan, Kota Ternate, Maluku Utara, 97719";

export default function NominatifDoc() {
  const { data: d } = useStore();
  const ket = `Insentif Swakelola ${formatNomorSpk(d)}`;
  const tJ = d.crew.reduce((s, c) => s + c.nilaiBruto, 0);
  const tP = d.crew.reduce((s, c) => s + c.pph21, 0);

  return (
    <>
      <DocToolbar title="05. Daftar Nominatif PPH 21" slug="nominatif" data={d} nativeKind="excel" />
      <div className="print-page landscape text-black">
        <div className="text-center font-bold text-[13pt] mb-3">DAFTAR NOMINATIF</div>
        <table className="text-[10pt] mb-4">
          <tbody>
            <tr><td className="font-bold pr-3">Nama Wajib Pajak</td><td>: {WP_NAMA}</td></tr>
            <tr><td className="font-bold pr-3">NPWP Kantor Pusat/Cabang</td><td>: {WP_NPWP}</td></tr>
            <tr><td className="font-bold pr-3 align-top">Alamat Kantor</td><td>: {WP_ALAMAT}</td></tr>
            <tr><td className="font-bold pr-3">Tahun pajak</td><td>: {d.tahun}</td></tr>
            <tr><td className="font-bold pr-3">No. Daftar Nominatif</td><td>: {d.noDafnom}</td></tr>
          </tbody>
        </table>

        <table className="doc-table text-[8pt]">
          <thead>
            <tr className="bg-blue-50 font-bold text-center">
              <td>No</td><td>Nama</td><td>NIK</td><td>CostCenter</td><td>Jabatan</td><td>Unit Kerja</td><td>NPWP/NIK</td><td>Tgl SPM</td><td>No SPM</td><td>Jenis</td><td>Jumlah (Rp)</td><td>Keterangan</td><td>Jumlah PPh</td>
            </tr>
          </thead>
          <tbody>
            {d.crew.map((c, i) => (
              <tr key={i}>
                <td className="text-center">{c.no}</td><td>{c.nama}</td><td className="text-center">{c.nik}</td><td className="text-center">{d.costCenter}</td>
                <td>{c.jabatan}</td><td className="text-center">{d.namaKapal}</td><td>{c.npwp}</td><td className="text-center">{tanggalIndo(d.tanggalSpm)}</td>
                <td className="text-center">{d.nomorSpm}</td><td className="text-center">Insentif</td><td className="text-right">{rupiah(c.nilaiBruto)}</td><td>{ket}</td><td className="text-right">{rupiah(c.pph21)}</td>
              </tr>
            ))}
            <tr className="font-bold bg-slate-100">
              <td colSpan={10} className="text-center">JUMLAH</td>
              <td className="text-right">{rupiah(tJ)}</td><td></td><td className="text-right">{rupiah(tP)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
