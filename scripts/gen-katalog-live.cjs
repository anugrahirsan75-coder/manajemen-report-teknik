// Generate FILE LIVE katalog (format baku utk Google Sheet / gviz) dari RAB xlsx.
// Output: output/katalog/Katalog_Live.xlsx (2 sheet) + KATALOG.csv + BREAKDOWN.csv
// Jalankan: node scripts/gen-katalog-live.cjs [path-xlsx]
//
// Format baku (HARUS dipertahankan supaya parser app cocok):
//   Sheet "KATALOG"   : Kode | Jenis | Kategori | Nama | Spesifikasi | Satuan | Harga | Sumber
//   Sheet "BREAKDOWN" : Kode | Uraian | Volume | Satuan | HargaSatuan | Spesifikasi
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const XLSX = process.argv[2] || "RAB_MASTER_Lengkap_v3.xlsx";
const OUTDIR = path.join("output", "katalog");

const cellVal = (cell) => {
  let v = cell.value;
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.result !== undefined) v = v.result;
    else if (v.richText) v = v.richText.map((t) => t.text).join("");
    else if (v.text !== undefined) v = v.text;
  }
  return v == null ? "" : v;
};
const str = (cell) => String(cellVal(cell)).trim();
const num = (cell) => { const v = cellVal(cell); if (typeof v === "number") return v; const n = parseFloat(String(v).replace(/[^\d.-]/g, "")); return isNaN(n) ? 0 : n; };
const KODE_RE = /^(JS2|BR2|JS|BR)-[A-Z]+-\d+$/;
const csvCell = (v) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);

  // KATALOG flat
  const katWs = wb.getWorksheet("KATALOG (Lookup)");
  const katalog = [];
  for (let r = 5; r <= katWs.rowCount; r++) {
    const row = katWs.getRow(r);
    const kode = str(row.getCell(1));
    if (!KODE_RE.test(kode)) continue;
    const nama = str(row.getCell(4));
    if (!nama) continue;
    katalog.push([kode, str(row.getCell(2)), str(row.getCell(3)), nama, str(row.getCell(5)), str(row.getCell(6)), num(row.getCell(7)), str(row.getCell(8)) || "Pasar"]);
  }

  // BREAKDOWN dari 2 sheet detail (rinci: uraian, vol, sat, harga, spek)
  const breakdown = [];
  for (const sheetName of ["Jasa Ferry Detail", "Barang Ferry Detail"]) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;
    let curKode = null;
    for (let r = 5; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const a = str(row.getCell(1));
      const b = str(row.getCell(2));
      if (KODE_RE.test(a)) { curKode = a; continue; }
      if (/^HARGA SATUAN/i.test(a)) { curKode = null; continue; }
      if (a && a === b) { curKode = null; continue; }
      if (curKode && !a && b) {
        // B=uraian, C=vol, D=sat, E=spek, F=hargaSatuan
        breakdown.push([curKode, b, num(row.getCell(3)), str(row.getCell(4)), num(row.getCell(6)), str(row.getCell(5))]);
      }
    }
  }

  fs.mkdirSync(OUTDIR, { recursive: true });
  const KHEAD = ["Kode", "Jenis", "Kategori", "Nama", "Spesifikasi", "Satuan", "Harga", "Sumber"];
  const BHEAD = ["Kode", "Uraian", "Volume", "Satuan", "HargaSatuan", "Spesifikasi"];

  // CSV
  fs.writeFileSync(path.join(OUTDIR, "KATALOG.csv"), csv([KHEAD, ...katalog]), "utf8");
  fs.writeFileSync(path.join(OUTDIR, "BREAKDOWN.csv"), csv([BHEAD, ...breakdown]), "utf8");

  // XLSX 2 sheet (siap upload -> Open with Google Sheets)
  const out = new ExcelJS.Workbook();
  const styleHead = (ws) => { ws.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16357F" } }; }); ws.views = [{ state: "frozen", ySplit: 1 }]; };
  const ksheet = out.addWorksheet("KATALOG");
  ksheet.addRow(KHEAD); katalog.forEach((r) => ksheet.addRow(r));
  [14, 10, 22, 40, 34, 8, 14, 9].forEach((w, i) => (ksheet.getColumn(i + 1).width = w));
  ksheet.getColumn(7).numFmt = "#,##0";
  // warnai Sumber: Riil hijau, Pasar kuning
  for (let r = 2; r <= ksheet.rowCount; r++) { const c = ksheet.getCell(r, 8); c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.value === "Riil" ? "FFC6EFCE" : "FFFFF2CC" } }; }
  styleHead(ksheet);
  const bsheet = out.addWorksheet("BREAKDOWN");
  bsheet.addRow(BHEAD); breakdown.forEach((r) => bsheet.addRow(r));
  [14, 44, 9, 9, 14, 30].forEach((w, i) => (bsheet.getColumn(i + 1).width = w));
  bsheet.getColumn(5).numFmt = "#,##0";
  styleHead(bsheet);
  await out.xlsx.writeFile(path.join(OUTDIR, "Katalog_Live.xlsx"));

  console.log(`OK -> ${OUTDIR}/`);
  console.log(`  KATALOG  : ${katalog.length} item`);
  console.log(`  BREAKDOWN: ${breakdown.length} baris rincian (${new Set(breakdown.map((b) => b[0])).size} item)`);
  console.log(`  files: Katalog_Live.xlsx, KATALOG.csv, BREAKDOWN.csv`);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
