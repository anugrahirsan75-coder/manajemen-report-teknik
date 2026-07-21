"use client";
// Preview dokumen (kertas A4) untuk pengadaan — SPPBJ & Non PR PO.
// Baca-saja: menyusun ulang isi tabel persis seperti yang ditulis ke template Excel
// (grup per kapal, baris keterangan di atas item, rincian "-" di bawah item).
import { Fragment, type ReactNode } from "react";
import { rupiah, tanggalIndo, bulanTahun } from "@/lib/format";

export interface PreviewItem {
  kapal: string; jumlah: number; satuan: string; nama: string; spesifikasi: string; harga: number;
  breakdown?: string[]; keterangan?: string;
}

export interface PreviewProps {
  jenis: "SPPBJ" | "Non PR PO";
  judul: string;              // judul dokumen di tengah
  nomor: string;              // No. SPPB/J atau No. SPPB
  tanggal: string;            // ISO
  noDRP?: string;
  dasarPelimpahan?: string;
  namaPengadaan: string;
  mataAnggaran: string[];
  jenisAnggaran?: string;     // Rutin / Docking
  vendor?: string;
  stafTeknik?: string;
  deptHead?: string;
  items: PreviewItem[];
}

const ketLines = (it: PreviewItem) => (it.keterangan || "").split("\n").map((s) => s.trim()).filter(Boolean);
const bdLines = (it: PreviewItem) => (it.breakdown || []).filter((b) => b.trim()).map((b) => `- ${b.trim().replace(/^[-•*]\s*/, "")}`);

/** kelompokkan item per kapal, urut kemunculan (sama dgn generator Excel) */
function grupKapal(items: PreviewItem[]) {
  const out: { kapal: string; items: PreviewItem[] }[] = [];
  for (const it of items) {
    const k = (it.kapal || "").trim() || "(tanpa kapal)";
    const g = out.find((x) => x.kapal === k);
    if (g) g.items.push(it); else out.push({ kapal: k, items: [it] });
  }
  return out;
}

export default function PreviewPengadaan(p: PreviewProps) {
  const groups = grupKapal(p.items);
  const total = p.items.reduce((s, it) => s + (it.harga || 0) * (it.jumlah || 0), 0);
  let no = 0;

  return (
    <div className="print-page text-black">
      {/* kepala dokumen */}
      <div className="flex items-start justify-between text-[10pt] mb-1">
        <div>
          <div>Nomor&nbsp;&nbsp;: <b>{p.nomor || "—"}</b></div>
          <div>Tanggal: {p.tanggal ? tanggalIndo(p.tanggal) : "—"}</div>
          {p.noDRP ? <div>No. DRP: {p.noDRP}</div> : null}
        </div>
        <div className="text-right">
          <div>Ternate, {p.tanggal ? bulanTahun(p.tanggal) : "—"}</div>
          <div className="text-[9pt]">{p.jenis}{p.jenisAnggaran ? ` · ${p.jenisAnggaran}` : ""}</div>
        </div>
      </div>

      <div className="text-center font-bold leading-tight my-3">
        <div className="text-[13pt] uppercase">{p.judul}</div>
        <div className="text-[11pt]">{p.namaPengadaan || "—"}</div>
      </div>

      {/* keterangan pokok */}
      <table className="text-[10pt] mb-3">
        <tbody>
          {p.dasarPelimpahan ? (
            <tr><td className="align-top pr-2 w-40">Dasar Pelimpahan</td><td className="align-top pr-1">:</td><td className="align-top">{p.dasarPelimpahan}</td></tr>
          ) : null}
          <tr><td className="align-top pr-2">Nama Pengadaan</td><td className="align-top pr-1">:</td><td className="align-top">{p.namaPengadaan || "—"}</td></tr>
          <tr><td className="align-top pr-2">Mata Anggaran</td><td className="align-top pr-1">:</td><td className="align-top">{p.mataAnggaran.filter(Boolean).join(", ") || "—"}</td></tr>
          {p.vendor ? <tr><td className="align-top pr-2">Vendor</td><td className="align-top pr-1">:</td><td className="align-top">{p.vendor}</td></tr> : null}
        </tbody>
      </table>

      {/* tabel item — susunan persis file Excel */}
      <table className="doc-table text-[10pt]">
        <thead>
          <tr className="bg-blue-50 font-bold text-center">
            <td className="w-8">NO.</td>
            <td className="w-12">JML</td>
            <td className="w-14">SAT.</td>
            <td>NAMA BARANG / JASA</td>
            <td className="w-40">SPESIFIKASI</td>
            <td className="w-28">HARGA SATUAN</td>
            <td className="w-28">JUMLAH</td>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) => {
            let prevKet = "";
            const baris: ReactNode[] = [];
            baris.push(
              <tr key={`k${gi}`}>
                <td colSpan={7} className="font-bold px-1 py-0.5 bg-slate-100">{g.kapal}</td>
              </tr>
            );
            for (const it of g.items) {
              if ((it.keterangan || "") !== prevKet) {
                ketLines(it).forEach((kl, i) => baris.push(
                  <tr key={`kt${gi}-${no}-${i}`}>
                    <td></td><td></td><td></td>
                    <td colSpan={4} className="px-1 py-0.5 font-bold">{kl}</td>
                  </tr>
                ));
                prevKet = it.keterangan || "";
              }
              no += 1;
              const n = no;
              baris.push(
                <tr key={`it${gi}-${n}`}>
                  <td className="text-center">{n}</td>
                  <td className="text-center">{it.jumlah}</td>
                  <td className="text-center">{it.satuan}</td>
                  <td className="px-1">{it.nama}</td>
                  <td className="px-1">{it.spesifikasi}</td>
                  <td className="text-right px-1">{it.harga ? rupiah(it.harga) : ""}</td>
                  <td className="text-right px-1">{it.harga ? rupiah(it.harga * it.jumlah) : ""}</td>
                </tr>
              );
              bdLines(it).forEach((bl, i) => baris.push(
                <tr key={`bd${gi}-${n}-${i}`}>
                  <td></td><td></td><td></td>
                  <td colSpan={4} className="px-1 py-0.5 text-[9pt]">{bl}</td>
                </tr>
              ));
            }
            return <Fragment key={`grp${gi}`}>{baris}</Fragment>;
          })}
          <tr className="font-bold bg-slate-100">
            <td colSpan={6} className="text-right px-2 py-1">TOTAL</td>
            <td className="text-right px-1 py-1">{rupiah(total)}</td>
          </tr>
        </tbody>
      </table>

      {/* tanda tangan */}
      <div className="grid grid-cols-2 mt-8 text-center text-[10pt]">
        <div>
          <p>Dibuat oleh,</p>
          <p>Staf Teknik</p>
          <div className="h-16" />
          <p className="font-bold underline">{p.stafTeknik || "—"}</p>
        </div>
        <div>
          <p>Mengetahui,</p>
          <p>Dept. Head Operasional dan Teknik</p>
          <div className="h-16" />
          <p className="font-bold underline">{p.deptHead || "—"}</p>
        </div>
      </div>
    </div>
  );
}
