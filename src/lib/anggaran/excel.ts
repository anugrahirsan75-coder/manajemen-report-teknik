/**
 * Export Excel Dashboard Anggaran — dirancang untuk dipakai & diedit, bukan sekadar dump.
 *
 * Prinsip:
 * - RUMUS HIDUP: Pagu Total, Sisa, Serapan, dan baris TOTAL memakai formula. Ubah angka pagu
 *   atau realisasi -> seluruh kolom turunan ikut berubah sendiri.
 * - Data bar + warna status otomatis (conditional formatting), bukan warna yang ditempel manual.
 * - Kop berwarna gaya ASDP, freeze pane, autofilter, kolom pas, print setup siap cetak.
 * - Sheet "Ringkasan" + satu sheet per sumber anggaran + sheet "Rincian Pengadaan" sebagai bukti.
 */
import ExcelJS from "exceljs";

// palet ASDP
const BIRU = "FF16357F";
const TEAL = "FF14B8C4";
const LANGIT = "FFE8F4FB";
const ABU = "FFF1F5F9";
const GARIS = "FFCBD5E1";
const HIJAU = "FF059669";
const KUNING = "FFD97706";
const MERAH = "FFDC2626";
const UNGU = "FF6D28D9";

const RP = '#,##0;[Red]-#,##0;"–"';           // 0 tampil sebagai strip
const RP_ADD = '"+"#,##0;[Red]-#,##0;"–"';    // addendum selalu bertanda +
const PCT = '0%';

export interface BarisAnggaran {
  label: string;          // kapal / surat / mata anggaran
  sub?: string;           // nomor surat dsb
  pagu: number;
  addendum: number;
  pakai: number;
}
export interface BagianAnggaran {
  kunci: string;
  judul: string;          // "Anggaran Docking"
  periode: string;        // "Tahun 2026"
  kolomLabel: string;     // "Kapal"
  warna: string;          // ARGB kop
  baris: BarisAnggaran[];
}
export interface PengadaanExcel {
  tanggal: string; jenis: string; sumber: string; nama: string;
  kapal: string; mataAnggaran: string; nomor: string; nilai: number;
}
export interface DataExport {
  dicetak: string;        // "24 Juli 2026"
  bagian: BagianAnggaran[];
  pengadaan: PengadaanExcel[];
}

/** kop 3 baris ala dokumen resmi */
function kop(ws: ExcelJS.Worksheet, judul: string, sub: string, lebarKolom: number, warna: string) {
  ws.mergeCells(1, 1, 1, lebarKolom);
  const j = ws.getCell(1, 1);
  j.value = "PT ASDP INDONESIA FERRY (PERSERO) — CABANG TERNATE";
  j.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  j.fill = { type: "pattern", pattern: "solid", fgColor: { argb: warna } };
  j.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 22;

  ws.mergeCells(2, 1, 2, lebarKolom);
  const t = ws.getCell(2, 1);
  t.value = judul.toUpperCase();
  t.font = { name: "Calibri", size: 14, bold: true, color: { argb: warna } };
  t.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 26;

  ws.mergeCells(3, 1, 3, lebarKolom);
  const s = ws.getCell(3, 1);
  s.value = sub;
  s.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF64748B" } };
  s.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(3).height = 16;
}

function judulKolom(ws: ExcelJS.Worksheet, baris: number, kolom: string[], warna: string) {
  const r = ws.getRow(baris);
  kolom.forEach((teks, i) => {
    const c = r.getCell(i + 1);
    c.value = teks;
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: warna } };
    c.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center", wrapText: true };
    c.border = { top: { style: "thin", color: { argb: warna } }, bottom: { style: "medium", color: { argb: warna } } };
  });
  r.height = 30;
}

/** satu sheet kendali anggaran: A label | B pagu | C addendum | D total | E terpakai | F sisa | G serapan | H status */
function sheetBagian(wb: ExcelJS.Workbook, b: BagianAnggaran, dicetak: string) {
  const ws = wb.addWorksheet(b.judul.replace("Anggaran ", "").slice(0, 28), {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });
  ws.columns = [
    { width: 42 }, { width: 17 }, { width: 15 }, { width: 17 }, { width: 17 }, { width: 17 }, { width: 11 }, { width: 13 },
  ];
  kop(ws, b.judul, `${b.periode} · dicetak ${dicetak} · kolom Pagu Total, Sisa, Serapan memakai rumus — ubah angka Pagu/Terpakai, sisanya ikut menyesuaikan`, 8, b.warna);
  judulKolom(ws, 5, [b.kolomLabel, "Pagu Awal", "Addendum", "Pagu Total", "Terpakai", "Sisa", "Serapan", "Status"], b.warna);

  const r0 = 6;
  b.baris.forEach((x, i) => {
    const r = r0 + i;
    const row = ws.getRow(r);
    row.getCell(1).value = x.sub ? `${x.label}\n${x.sub}` : x.label;
    row.getCell(2).value = x.pagu;
    row.getCell(3).value = x.addendum || 0;
    row.getCell(4).value = { formula: `B${r}+C${r}` };
    row.getCell(5).value = Math.round(x.pakai);
    row.getCell(6).value = { formula: `D${r}-E${r}` };
    row.getCell(7).value = { formula: `IF(D${r}=0,0,E${r}/D${r})` };
    row.getCell(8).value = { formula: `IF(D${r}=0,"-",IF(G${r}>1,"OVERBUDGET",IF(G${r}>=0.8,"WASPADA","AMAN")))` };

    row.getCell(1).alignment = { vertical: "middle", wrapText: true };
    row.getCell(1).font = { name: "Calibri", size: 10, bold: true };
    for (let c = 2; c <= 6; c++) {
      const cell = row.getCell(c);
      cell.numFmt = RP;
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.font = { name: "Calibri", size: 10, ...(c === 5 ? { bold: true } : {}) };
    }
    row.getCell(3).numFmt = RP_ADD;
    row.getCell(3).font = { name: "Calibri", size: 10, bold: true, color: { argb: UNGU } };
    row.getCell(7).numFmt = PCT;
    row.getCell(7).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(7).font = { name: "Calibri", size: 10, bold: true };
    row.getCell(8).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(8).font = { name: "Calibri", size: 9, bold: true };
    row.height = x.sub ? 30 : 20;

    // zebra + garis tipis
    for (let c = 1; c <= 8; c++) {
      const cell = row.getCell(c);
      if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
      cell.border = { bottom: { style: "hair", color: { argb: GARIS } } };
    }
  });

  // baris TOTAL
  const rT = r0 + b.baris.length;
  const t = ws.getRow(rT);
  t.getCell(1).value = "TOTAL";
  for (const [c, f] of [[2, `SUM(B${r0}:B${rT - 1})`], [3, `SUM(C${r0}:C${rT - 1})`], [4, `SUM(D${r0}:D${rT - 1})`], [5, `SUM(E${r0}:E${rT - 1})`], [6, `SUM(F${r0}:F${rT - 1})`]] as [number, string][]) {
    t.getCell(c).value = { formula: f };
    t.getCell(c).numFmt = RP;
    t.getCell(c).alignment = { horizontal: "right" };
  }
  t.getCell(3).numFmt = RP_ADD;
  t.getCell(7).value = { formula: `IF(D${rT}=0,0,E${rT}/D${rT})` };
  t.getCell(7).numFmt = PCT;
  t.getCell(7).alignment = { horizontal: "center" };
  for (let c = 1; c <= 8; c++) {
    const cell = t.getCell(c);
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: b.warna } };
    cell.border = { top: { style: "medium", color: { argb: b.warna } } };
  }
  t.height = 22;

  if (b.baris.length) {
    // data bar pada kolom Terpakai + warna status otomatis
    ws.addConditionalFormatting({
      ref: `E${r0}:E${rT - 1}`,
      rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], color: { argb: TEAL } } as any],
    });
    ws.addConditionalFormatting({
      ref: `G${r0}:G${rT - 1}`,
      rules: [
        { type: "cellIs", operator: "greaterThan", formulae: ["1"], priority: 2, style: { font: { color: { argb: MERAH }, bold: true }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFEE2E2" } } } } as any,
        { type: "cellIs", operator: "greaterThanOrEqual", formulae: ["0.8"], priority: 3, style: { font: { color: { argb: KUNING }, bold: true }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFEF3C7" } } } } as any,
        { type: "cellIs", operator: "lessThan", formulae: ["0.8"], priority: 4, style: { font: { color: { argb: HIJAU }, bold: true } } } as any,
      ],
    });
    ws.addConditionalFormatting({
      ref: `H${r0}:H${rT - 1}`,
      rules: [
        { type: "containsText", operator: "containsText", text: "OVERBUDGET", priority: 5, style: { font: { color: { argb: "FFFFFFFF" }, bold: true }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: MERAH } } } } as any,
        { type: "containsText", operator: "containsText", text: "WASPADA", priority: 6, style: { font: { color: { argb: "FF7C2D12" }, bold: true }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFDE68A" } } } } as any,
        { type: "containsText", operator: "containsText", text: "AMAN", priority: 7, style: { font: { color: { argb: "FF065F46" }, bold: true }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFD1FAE5" } } } } as any,
      ],
    });
    ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: rT - 1, column: 8 } };
  }
  return { ws, rT };
}

export async function buatExcelAnggaran(d: DataExport): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Manajemen Report Teknik ASDP Ternate";
  wb.created = new Date();

  // ---------- 1) RINGKASAN ----------
  const ws = wb.addWorksheet("Ringkasan", {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });
  ws.columns = [{ width: 34 }, { width: 18 }, { width: 15 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 11 }, { width: 13 }];
  kop(ws, "Ringkasan Anggaran", `Dicetak ${d.dicetak} · seluruh sumber anggaran · angka turunan memakai rumus`, 8, BIRU);
  judulKolom(ws, 5, ["Sumber Anggaran", "Pagu Awal", "Addendum", "Pagu Total", "Terpakai", "Sisa", "Serapan", "Status"], BIRU);

  const r0 = 6;
  d.bagian.forEach((b, i) => {
    const r = r0 + i;
    const row = ws.getRow(r);
    const pagu = b.baris.reduce((s, x) => s + x.pagu, 0);
    const add = b.baris.reduce((s, x) => s + x.addendum, 0);
    const pakai = b.baris.reduce((s, x) => s + x.pakai, 0);
    row.getCell(1).value = `${b.judul}  (${b.periode})`;
    row.getCell(2).value = pagu;
    row.getCell(3).value = add;
    row.getCell(4).value = { formula: `B${r}+C${r}` };
    row.getCell(5).value = Math.round(pakai);
    row.getCell(6).value = { formula: `D${r}-E${r}` };
    row.getCell(7).value = { formula: `IF(D${r}=0,0,E${r}/D${r})` };
    row.getCell(8).value = { formula: `IF(D${r}=0,"-",IF(G${r}>1,"OVERBUDGET",IF(G${r}>=0.8,"WASPADA","AMAN")))` };
    row.getCell(1).font = { name: "Calibri", size: 11, bold: true, color: { argb: b.warna } };
    for (let c = 2; c <= 6; c++) { row.getCell(c).numFmt = RP; row.getCell(c).alignment = { horizontal: "right" }; }
    row.getCell(3).numFmt = RP_ADD; row.getCell(3).font = { bold: true, color: { argb: UNGU } };
    row.getCell(7).numFmt = PCT; row.getCell(7).alignment = { horizontal: "center" };
    row.getCell(7).font = { bold: true };
    row.getCell(8).alignment = { horizontal: "center" }; row.getCell(8).font = { size: 9, bold: true };
    row.height = 22;
    for (let c = 1; c <= 8; c++) row.getCell(c).border = { bottom: { style: "hair", color: { argb: GARIS } } };
  });
  const rT = r0 + d.bagian.length;
  const t = ws.getRow(rT);
  t.getCell(1).value = "TOTAL SELURUH ANGGARAN";
  [[2, "B"], [3, "C"], [4, "D"], [5, "E"], [6, "F"]].forEach(([c, col]) => {
    t.getCell(c as number).value = { formula: `SUM(${col}${r0}:${col}${rT - 1})` };
    t.getCell(c as number).numFmt = RP;
    t.getCell(c as number).alignment = { horizontal: "right" };
  });
  t.getCell(7).value = { formula: `IF(D${rT}=0,0,E${rT}/D${rT})` };
  t.getCell(7).numFmt = PCT; t.getCell(7).alignment = { horizontal: "center" };
  for (let c = 1; c <= 8; c++) {
    t.getCell(c).font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    t.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BIRU } };
  }
  t.height = 26;
  ws.addConditionalFormatting({ ref: `E${r0}:E${rT - 1}`, rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], color: { argb: TEAL } } as any] });

  // catatan pemakaian
  const rN = rT + 2;
  ws.mergeCells(rN, 1, rN, 8);
  const n = ws.getCell(rN, 1);
  n.value = "Cara pakai: kolom berlatar putih boleh diubah (Pagu Awal, Addendum, Terpakai). Kolom Pagu Total, Sisa, Serapan, Status, dan baris TOTAL terisi rumus — jangan ditimpa agar tetap terhitung otomatis. Warna status & batang biru muncul sendiri mengikuti angka.";
  n.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF475569" } };
  n.alignment = { wrapText: true, vertical: "top" };
  n.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LANGIT } };
  ws.getRow(rN).height = 32;

  // ---------- 2) SHEET PER SUMBER ----------
  d.bagian.forEach((b) => { if (b.baris.length) sheetBagian(wb, b, d.dicetak); });

  // ---------- 3) RINCIAN PENGADAAN (bukti angka terpakai) ----------
  if (d.pengadaan.length) {
    const wp = wb.addWorksheet("Rincian Pengadaan", {
      views: [{ state: "frozen", ySplit: 5 }],
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    });
    wp.columns = [{ width: 13 }, { width: 11 }, { width: 13 }, { width: 46 }, { width: 20 }, { width: 34 }, { width: 15 }, { width: 17 }];
    kop(wp, "Rincian Pengadaan", `Dasar angka "Terpakai" · dicetak ${d.dicetak}`, 8, TEAL);
    judulKolom(wp, 5, ["Tanggal", "Jenis", "Sumber", "Nama Pengadaan", "Kapal", "Mata Anggaran", "Nomor", "Nilai"], TEAL);
    d.pengadaan.forEach((x, i) => {
      const r = 6 + i;
      const row = wp.getRow(r);
      row.values = [x.tanggal, x.jenis, x.sumber, x.nama, x.kapal, x.mataAnggaran, x.nomor, Math.round(x.nilai)];
      row.getCell(8).numFmt = RP;
      row.getCell(8).font = { bold: true };
      row.getCell(2).alignment = { horizontal: "center" };
      for (let c = 1; c <= 8; c++) {
        const cell = row.getCell(c);
        cell.font = { name: "Calibri", size: 10, ...(c === 8 ? { bold: true } : {}) };
        cell.alignment = { ...cell.alignment, vertical: "middle", wrapText: c === 4 || c === 6 };
        if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
        cell.border = { bottom: { style: "hair", color: { argb: GARIS } } };
      }
      row.height = 18;
    });
    const rp = 6 + d.pengadaan.length;
    const tp = wp.getRow(rp);
    tp.getCell(7).value = "TOTAL";
    tp.getCell(8).value = { formula: `SUM(H6:H${rp - 1})` };
    tp.getCell(8).numFmt = RP;
    for (let c = 1; c <= 8; c++) {
      tp.getCell(c).font = { bold: true, color: { argb: "FFFFFFFF" } };
      tp.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    }
    tp.getCell(7).alignment = { horizontal: "right" };
    tp.height = 22;
    wp.autoFilter = { from: { row: 5, column: 1 }, to: { row: rp - 1, column: 8 } };
  }

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
