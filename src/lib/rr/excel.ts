/**
 * Export Excel "Lampiran 3" — Rencana (USL) & Realisasi (REAL) perawatan bulanan.
 *
 * Susunan mengikuti berkas resmi pusat:
 *   05. Budget Control Rutin   rekap semua kapal x Mata Anggaran (rumus ke lembar kapal)
 *   USL <KAPAL>                usulan program perawatan bulan rencana
 *   REAL <KAPAL>               realisasi bulan sebelumnya
 *
 * Angka di rekap TIDAK diketik: SUMIFS ke kolom Total lembar kapal, sehingga
 * memperbaiki satu item di lembar kapal langsung mengubah rekapnya.
 */
import ExcelJS from "exceljs";

const BIRU = "FF16357F";
const HIJAU = "FF047857";
const ABU = "FFF1F5F9";
const GARIS = "FFCBD5E1";
const LANGIT = "FFEFF6FF";
const RP = '#,##0;[Red]-#,##0;"–"';

export interface XItem { deskripsi: string; spesifikasi: string; jumlah: number; satuan: string; harga: number }
export interface XKelompok { ma: string; kode: string; judul: string; items: XItem[] }
export interface XLembar {
  kapal: string; singkat: string; ppnPersen: number;
  status: string; dikirimPada?: string; catatan?: string;
  kelompok: XKelompok[];
}
export interface DataRR {
  bulanRencana: string;       // "Juli 2026"
  bulanRealisasi: string;     // "Juni 2026"
  judul: string;              // "RENCANA JULI 2026 & REALISASI JUNI 2026"
  dicetak: string;
  maUrut: { kode: string; ma: string }[];
  usulan: XLembar[];
  realisasi: XLembar[];
}

const amanSheet = (s: string) => (s || "Sheet").replace(/[\\/*?:\[\]']/g, "-").slice(0, 31).trim();

function kop(ws: ExcelJS.Worksheet, judul: string, sub: string, lebar: number, warna: string) {
  ws.mergeCells(1, 1, 1, lebar);
  const a = ws.getCell(1, 1);
  a.value = "PT ASDP INDONESIA FERRY (PERSERO) — CABANG TERNATE";
  a.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  a.fill = { type: "pattern", pattern: "solid", fgColor: { argb: warna } };
  a.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 22;
  ws.mergeCells(2, 1, 2, lebar);
  const b = ws.getCell(2, 1);
  b.value = judul.toUpperCase();
  b.font = { name: "Calibri", size: 13, bold: true, color: { argb: warna } };
  b.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 24;
  ws.mergeCells(3, 1, 3, lebar);
  const c = ws.getCell(3, 1);
  c.value = sub;
  c.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF64748B" } };
  c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.getRow(3).height = 16;
}

const angka = (cell: ExcelJS.Cell, tebal = false) => {
  cell.numFmt = RP;
  cell.alignment = { vertical: "middle", horizontal: "right" };
  cell.font = { name: "Calibri", size: 10, bold: tebal };
};
const tautan = (cell: ExcelJS.Cell, teks: string, tujuan: string, ukuran = 9) => {
  cell.value = { text: teks, hyperlink: tujuan };
  cell.font = { name: "Calibri", size: ukuran, bold: true, color: { argb: "FF1D4ED8" }, underline: true };
};

/** satu lembar kapal (USL / REAL) — mengembalikan nama sheetnya */
function lembarKapal(wb: ExcelJS.Workbook, l: XLembar, tipe: "USL" | "REAL", periode: string, warna: string): string {
  const nama = amanSheet(`${tipe} ${l.singkat}`);
  const ws = wb.addWorksheet(nama, {
    views: [{ state: "frozen", ySplit: 7 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  ws.columns = [{ width: 42 }, { width: 6 }, { width: 40 }, { width: 30 }, { width: 9 }, { width: 10 }, { width: 15 }, { width: 16 }];

  kop(ws, `${tipe === "USL" ? "Usulan Program Perawatan" : "Realisasi Perawatan"} — ${l.kapal}`,
    `${periode} · Cabang TERNATE · Regional IV${l.catatan ? " · " + l.catatan : ""}`, 8, warna);
  tautan(ws.getCell(4, 1), "‹ kembali ke Budget Control Rutin", "#'05. Budget Control Rutin'!A6");
  ws.getCell(4, 8).value = l.status === "terkirim" ? `TERKIRIM ${l.dikirimPada ? new Date(l.dikirimPada).toLocaleDateString("id-ID") : ""}` : "DRAF";
  ws.getCell(4, 8).font = { name: "Calibri", size: 9, bold: true, color: { argb: l.status === "terkirim" ? HIJAU : "FFB45309" } };
  ws.getCell(4, 8).alignment = { horizontal: "right" };

  const kepala = ["Mata Anggaran", "Sub", "Deskripsi", "Spesifikasi", "Jumlah", "Satuan", "Harga Satuan", "Total"];
  const hr = ws.getRow(6);
  kepala.forEach((t, i) => {
    const c = hr.getCell(i + 1);
    c.value = t;
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: warna } };
    c.alignment = { horizontal: i > 3 ? "center" : "left", vertical: "middle", wrapText: true };
  });
  hr.height = 26;

  let r = 7;
  const barisTotalKelompok: number[] = [];
  for (const k of l.kelompok) {
    const rJudul = r;
    const row = ws.getRow(r);
    row.getCell(1).value = k.ma;
    row.getCell(2).value = 1;
    row.getCell(3).value = k.judul;
    row.getCell(2).alignment = { horizontal: "center" };
    [1, 3].forEach((c) => (row.getCell(c).font = { name: "Calibri", size: 10, bold: true }));
    row.getCell(1).alignment = { vertical: "middle", wrapText: true };
    row.height = 18;
    for (let c = 1; c <= 8; c++) row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LANGIT } };
    r++;

    const rItem1 = r;
    k.items.forEach((it, i) => {
      const ri = ws.getRow(r);
      ri.getCell(2).value = i + 1;
      ri.getCell(3).value = it.deskripsi;
      ri.getCell(4).value = it.spesifikasi;
      ri.getCell(5).value = it.jumlah || null;
      ri.getCell(6).value = it.satuan;
      ri.getCell(7).value = it.harga || null;
      ri.getCell(8).value = { formula: `E${r}*G${r}` };
      [2, 5, 6].forEach((c) => (ri.getCell(c).alignment = { horizontal: "center", vertical: "middle" }));
      [3, 4].forEach((c) => (ri.getCell(c).alignment = { vertical: "middle", wrapText: true }));
      angka(ri.getCell(7));
      angka(ri.getCell(8));
      ri.font = { name: "Calibri", size: 10 };
      ri.height = 16;
      for (let c = 1; c <= 8; c++) ri.getCell(c).border = { bottom: { style: "hair", color: { argb: GARIS } } };
      r++;
    });
    const rItemAkhir = r - 1;

    // PPN & Total kelompok (persis susunan berkas pusat)
    const rp = ws.getRow(r);
    rp.getCell(3).value = `PPN ${l.ppnPersen || 0}%`;
    rp.getCell(8).value = k.items.length
      ? { formula: `SUM(H${rItem1}:H${rItemAkhir})*${(l.ppnPersen || 0) / 100}` } : 0;
    angka(rp.getCell(8));
    rp.getCell(3).font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF64748B" } };
    r++;
    const rt = ws.getRow(r);
    rt.getCell(3).value = "Total";
    rt.getCell(8).value = k.items.length
      ? { formula: `SUM(H${rItem1}:H${rItemAkhir})+H${r - 1}` } : 0;
    angka(rt.getCell(8), true);
    rt.getCell(3).font = { name: "Calibri", size: 10, bold: true };
    for (let c = 1; c <= 8; c++) rt.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
    barisTotalKelompok.push(r);
    // total kelompok juga ditaruh di baris judul (dibaca rekap lewat SUMIFS kolom A)
    ws.getCell(rJudul, 8).value = { formula: `H${r}` };
    angka(ws.getCell(rJudul, 8), true);
    r++;

    const ri = ws.getRow(r);
    ri.getCell(1).value = "insert diatas ini";
    ri.getCell(1).font = { name: "Calibri", size: 8, italic: true, color: { argb: "FFCBD5E1" } };
    r += 2;
  }

  const rTot = r;
  const t = ws.getRow(rTot);
  t.getCell(3).value = `TOTAL ${tipe === "USL" ? "USULAN" : "REALISASI"} ${l.kapal}`;
  t.getCell(8).value = barisTotalKelompok.length ? { formula: barisTotalKelompok.map((b) => `H${b}`).join("+") } : 0;
  angka(t.getCell(8), true);
  for (let c = 1; c <= 8; c++) {
    t.getCell(c).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    t.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: warna } };
  }
  t.height = 22;
  return nama;
}

export async function buatExcelRR(d: DataRR): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Manajemen Report Teknik ASDP Ternate";
  wb.created = new Date();

  // 1) rekap dulu (dibuat lebih awal agar jadi sheet pertama), diisi setelah lembar kapal jadi
  const wr = wb.addWorksheet("05. Budget Control Rutin", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  wr.columns = [{ width: 24 }, { width: 42 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 20 }, { width: 12 }];

  const sheetUsl = new Map<string, string>();
  const sheetReal = new Map<string, string>();
  d.usulan.forEach((l) => sheetUsl.set(l.kapal, lembarKapal(wb, l, "USL", `Rencana ${d.bulanRencana}`, BIRU)));
  d.realisasi.forEach((l) => sheetReal.set(l.kapal, lembarKapal(wb, l, "REAL", `Realisasi ${d.bulanRealisasi}`, HIJAU)));

  kop(wr, d.judul, `dicetak ${d.dicetak} · angka ditarik otomatis (SUMIFS) dari lembar USL/REAL tiap kapal — kolom RKA, RKAC & Persetujuan Bulan Lalu diisi manual sesuai rilis pusat`, 8, BIRU);
  const kepala = ["Kapal", "Mata Anggaran", "RKA", "RKAC BULAN INI", "PERSETUJUAN BULAN LALU", `REALISASI ${d.bulanRealisasi.toUpperCase()}`, `USULAN PROGRAM PERAWATAN ${d.bulanRencana.toUpperCase()}`, "Lembar"];
  const hr = wr.getRow(6);
  kepala.forEach((t, i) => {
    const c = hr.getCell(i + 1);
    c.value = t;
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BIRU } };
    c.alignment = { horizontal: i > 1 ? "center" : "left", vertical: "middle", wrapText: true };
  });
  hr.height = 34;

  let r = 7;
  const barisTotalKapal: number[] = [];
  const kapalSemua = Array.from(new Set([...d.usulan.map((x) => x.kapal), ...d.realisasi.map((x) => x.kapal)]));
  for (const kapal of kapalSemua) {
    const su = sheetUsl.get(kapal);
    const sr = sheetReal.get(kapal);
    const r1 = r;
    for (const m of d.maUrut) {
      const row = wr.getRow(r);
      row.getCell(1).value = kapal;
      row.getCell(2).value = m.ma;
      row.getCell(6).value = sr ? { formula: `SUMIFS('${sr}'!$H:$H,'${sr}'!$A:$A,$B${r})` } : 0;
      row.getCell(7).value = su ? { formula: `SUMIFS('${su}'!$H:$H,'${su}'!$A:$A,$B${r})` } : 0;
      [3, 4, 5, 6, 7].forEach((c) => angka(row.getCell(c)));
      row.getCell(1).font = { name: "Calibri", size: 9, color: { argb: "FF64748B" } };
      row.getCell(2).font = { name: "Calibri", size: 9 };
      row.getCell(2).alignment = { vertical: "middle", wrapText: true };
      row.height = 16;
      for (let c = 1; c <= 8; c++) row.getCell(c).border = { bottom: { style: "hair", color: { argb: GARIS } } };
      r++;
    }
    const rt = wr.getRow(r);
    rt.getCell(1).value = kapal;
    rt.getCell(2).value = "TOTAL";
    (["C", "D", "E", "F", "G"] as const).forEach((col, i) => {
      rt.getCell(i + 3).value = { formula: `SUM(${col}${r1}:${col}${r - 1})` };
      angka(rt.getCell(i + 3), true);
    });
    if (su) tautan(rt.getCell(8), "USL →", `#'${su}'!A6`);
    for (let c = 1; c <= 7; c++) {
      rt.getCell(c).font = { name: "Calibri", size: 10, bold: true };
      rt.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
    }
    rt.height = 18;
    barisTotalKapal.push(r);
    r += 1;
  }

  const rT = r;
  const t = wr.getRow(rT);
  t.getCell(2).value = "GRAND TOTAL";
  (["C", "D", "E", "F", "G"] as const).forEach((col, i) => {
    t.getCell(i + 3).value = barisTotalKapal.length ? { formula: barisTotalKapal.map((b) => `${col}${b}`).join("+") } : 0;
    angka(t.getCell(i + 3), true);
  });
  for (let c = 1; c <= 8; c++) {
    t.getCell(c).font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    t.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BIRU } };
  }
  t.height = 24;

  const rN = rT + 2;
  wr.mergeCells(rN, 1, rN + 1, 8);
  const n = wr.getCell(rN, 1);
  n.value =
    `Kolom REALISASI & USULAN ditarik otomatis dari lembar REAL/USL tiap kapal (SUMIFS pada baris Mata Anggaran) — memperbaiki satu item di lembar kapal langsung mengubah angka di sini.\n` +
    `Kolom RKA, RKAC BULAN INI, dan PERSETUJUAN BULAN LALU diisi manual mengikuti rilis budget dari kantor pusat (dirilis per 2 bulan).`;
  n.font = { name: "Calibri", size: 9, color: { argb: "FF1E3A8A" } };
  n.alignment = { wrapText: true, vertical: "top" };
  n.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LANGIT } };
  wr.getRow(rN).height = 26;
  wr.getRow(rN + 1).height = 22;

  const urut = ["05. Budget Control Rutin", ...Array.from(sheetUsl.values()), ...Array.from(sheetReal.values())];
  urut.forEach((nm, i) => { const sh: any = wb.getWorksheet(nm); if (sh) sh.orderNo = i + 1; });
  wb.views = [{ activeTab: 0, x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, visibility: "visible" }];

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
