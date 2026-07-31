"use client";
/**
 * Ekspor format PUSAT (Smartsheet) — susunan kolomnya meniru persis berkas
 * "01. Docking Repair _ Repair List.xlsx" yang diunduh dari Smartsheet pusat
 * (contoh: KMP. TUNA 2025), supaya hasil unduhan tinggal disalin/diunggah:
 *
 *   25 kolom: Cabang · Regional · Kapal · Klasifikasi · Mata Anggaran · Sub ·
 *   Deskripsi · 4 kolom Usulan Cabang (Jumlah/Satuan/Harga/Total) · SD Cabang ·
 *   4 kolom Evaluasi Pusat · Keterangan · 4 kolom Usulan Adendum · 4 kolom
 *   Evaluasi Adendum.
 *
 * Baris-barisnya juga meniru polanya: baris TOTAL di atas, lalu tiap bagian
 * dibuka baris romawi (Sub = I/II/III + subtotal), item bernomor per bagian,
 * dan Klasifikasi ditulis "GS - General Service" / "OM - Owner Matter" /
 * "CM - Class Matter". Kolom Evaluasi Pusat & Adendum dibiarkan kosong —
 * itu diisi pusat, bukan cabang.
 *
 * Sheet kedua "02. Penunjang Docking" memakai 10 kolom seperti berkas
 * "KEBUTUHAN CAT DOCKING" dari Smartsheet.
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { RencanaDocking, ItemRl, nilaiRl, nilaiPenunjang, rekapPenunjang, PPN_BAKU, ppnDari } from "./types";

const CABANG = "TERNATE";
const REGIONAL = "IV";

const KLAS: Record<string, string> = {
  GS: "GS - General Service",
  OM: "OM - Owner Matter",
  CM: "CM - Class Matter",
};

/** klasifikasi Smartsheet sebuah baris RL — dari Docking Code & kelompoknya */
function klasifikasi(it: ItemRl): string {
  const grup = (it.grup || "").toUpperCase();
  if (/GENERAL SERVICE|DOCKING\s*&\s*UNDOCKING|DOCKAGE/.test(grup)) return KLAS.GS;
  if ((it.kode || "").toUpperCase().startsWith("CM")) return KLAS.CM;
  return KLAS.OM;
}

const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

export async function unduhSmartsheet(r: RencanaDocking) {
  const wb = new ExcelJS.Workbook();
  const ppn = r.ppn ?? PPN_BAKU;
  const tipis = { style: "thin" as const };
  const border = { top: tipis, bottom: tipis, left: tipis, right: tipis };
  const uang = "#,##0";

  // ── Sheet 1: Docking Repair / Repair List (25 kolom) ───────────────────────
  const ws = wb.addWorksheet("01. Docking Repair _ Repair Lis", { views: [{ state: "frozen", ySplit: 1 }] });
  const KOLOM = [
    "Cabang", "Regional", "Kapal", "Klasifikasi", "Mata Anggaran", "Sub", "Deskripsi",
    "Jumlah Usulan Cabang", "Satuan Usulan Cabang", "Harga Satuan Usulan Cabang", "Total Usulan Cabang",
    "SD Cabang",
    "Jumlah Evaluasi Pusat", "Satuan Evaluasi Pusat", "Harga Satuan Evaluasi Pusat", "Total Evaluasi Pusat",
    "Keterangan",
    "Jumlah Usulan Adendum", "Satuan Usulan Adendum", "Harga Satuan Usulan Addendum", "Total Usulan Adendum",
    "Jumlah Evaluasi Addendum", "Satuan Evaluasi Adendum", "Harga Satuan Evaluasi Adendum", "Total Evaluasi Adendum",
  ];
  const hr = ws.getRow(1);
  KOLOM.forEach((v, i) => {
    const c = hr.getCell(i + 1);
    c.value = v; c.font = { bold: true }; c.border = border;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };
  });
  hr.height = 30;
  const lebar = [10, 9, 16, 20, 22, 6, 60, 9, 9, 14, 15, 11, 9, 9, 14, 15, 18, 9, 9, 14, 15, 9, 9, 14, 15];
  lebar.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  // baris per bagian, urutan kemunculan grup — hanya RL Docking (format pusat)
  const items = (r.rl || []).filter((x) => x.jenis === "dok");
  const grup = new Map<string, ItemRl[]>();
  items.forEach((x) => {
    const k = x.grup || x.kode || "LAIN-LAIN";
    if (!grup.has(k)) grup.set(k, []);
    grup.get(k)!.push(x);
  });

  const MA_RORO = "Kapal RO-RO/Penyeberangan\nM.A : 5010403003";
  let b = 2;
  const totalSemua = items.reduce((s, x) => s + nilaiRl(x), 0);
  const identitas = (row: ExcelJS.Row) => {
    row.getCell(1).value = CABANG; row.getCell(2).value = REGIONAL; row.getCell(3).value = r.kapal;
  };

  // baris TOTAL paling atas — persis berkas contoh
  {
    const row = ws.getRow(b++);
    identitas(row);
    row.getCell(5).value = MA_RORO;
    row.getCell(7).value = "TOTAL DOCKING REPAIR";
    row.getCell(7).font = { bold: true };
    row.getCell(11).value = totalSemua; row.getCell(11).numFmt = uang; row.getCell(11).font = { bold: true };
  }

  let ke = 0;
  grup.forEach((list, nama) => {
    const rom = ROMAWI[ke++] || String(ke);
    const sect = ws.getRow(b++);
    identitas(sect);
    sect.getCell(5).value = MA_RORO;
    sect.getCell(6).value = rom;
    sect.getCell(7).value = nama.toUpperCase();
    sect.getCell(7).font = { bold: true };
    sect.getCell(11).value = list.reduce((s, x) => s + nilaiRl(x), 0);
    sect.getCell(11).numFmt = uang; sect.getCell(11).font = { bold: true };

    let no = 0;
    list.forEach((it) => {
      const row = ws.getRow(b++);
      identitas(row);
      row.getCell(4).value = klasifikasi(it);
      row.getCell(6).value = String(++no);
      row.getCell(7).value = it.uraian;
      row.getCell(7).alignment = { wrapText: true, vertical: "top" };
      row.getCell(8).value = it.vol || 0;
      row.getCell(9).value = it.satuan;
      row.getCell(10).value = it.harga || 0; row.getCell(10).numFmt = uang;
      row.getCell(11).value = nilaiRl(it); row.getCell(11).numFmt = uang;
      if (it.ket) row.getCell(17).value = it.ket;
    });
  });
  for (let i = 2; i < b; i++) for (let c = 1; c <= 25; c++) ws.getRow(i).getCell(c).border = border;

  // ── Sheet 2: Penunjang Docking (10 kolom) ─────────────────────────────────
  const pn = wb.addWorksheet("02. Penunjang Docking");
  const KOLOM2 = ["Cabang", "Regional", "Kapal", "Sub", "Deskripsi", "Spesifikasi",
    "Jumlah Usulan Cabang", "Satuan Usulan Cabang", "Harga Satuan Usulan Cabang", "Total Usulan Cabang"];
  const h2 = pn.getRow(1);
  KOLOM2.forEach((v, i) => {
    const c = h2.getCell(i + 1);
    c.value = v; c.font = { bold: true }; c.border = border;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };
  });
  [10, 9, 16, 6, 50, 30, 9, 9, 14, 15].forEach((w, i) => (pn.getColumn(i + 1).width = w));

  let p = 2;
  rekapPenunjang(r).forEach((k) => {
    const list = (r.penunjang || []).filter((x) => x.kelompok === k.key);
    if (!list.length) return;
    const sect = pn.getRow(p++);
    sect.getCell(1).value = CABANG; sect.getCell(2).value = REGIONAL; sect.getCell(3).value = r.kapal;
    sect.getCell(4).value = k.romawi;
    sect.getCell(5).value = `${k.nama.toUpperCase()} (M.A. ${k.ma})`;
    sect.getCell(5).font = { bold: true };
    sect.getCell(10).value = k.subJumlah; sect.getCell(10).numFmt = uang; sect.getCell(10).font = { bold: true };
    let no = 0;
    list.forEach((it) => {
      const row = pn.getRow(p++);
      row.getCell(1).value = CABANG; row.getCell(2).value = REGIONAL; row.getCell(3).value = r.kapal;
      row.getCell(4).value = String(++no);
      row.getCell(5).value = it.uraian;
      row.getCell(6).value = it.spek || "";
      row.getCell(7).value = it.vol || 0;
      row.getCell(8).value = it.satuan;
      row.getCell(9).value = it.harga || 0; row.getCell(9).numFmt = uang;
      row.getCell(10).value = nilaiPenunjang(it); row.getCell(10).numFmt = uang;
    });
    const pp = pn.getRow(p++);
    pp.getCell(5).value = `PPN ${ppn}%`;
    pp.getCell(10).value = ppnDari(k.subJumlah, ppn); pp.getCell(10).numFmt = uang;
    const jm = pn.getRow(p++);
    jm.getCell(5).value = "Jumlah"; jm.getCell(5).font = { bold: true };
    jm.getCell(10).value = k.jumlah; jm.getCell(10).numFmt = uang; jm.getCell(10).font = { bold: true };
  });
  for (let i = 2; i < p; i++) for (let c = 1; c <= 10; c++) pn.getRow(i).getCell(c).border = border;

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `Smartsheet_${r.kapal.replace(/[^\w]+/g, "_")}_${r.tahun}.xlsx`);
}
