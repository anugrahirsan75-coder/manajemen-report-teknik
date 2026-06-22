// Generate src/lib/katalog/katalogSeed.json dari RAB_MASTER_Lengkap_v3.xlsx
// Jalankan: node scripts/gen-katalog-seed.cjs [path-xlsx]
// Sumber: sheet "KATALOG (Lookup)" (flat 470 item) + breakdown dari
//         "Jasa Ferry Detail" & "Barang Ferry Detail" (item Set 2 JS2-/BR2-).
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const XLSX = process.argv[2] || "RAB_MASTER_Lengkap_v3.xlsx";
const OUT = path.join("src", "lib", "katalog", "katalogSeed.json");

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
const num = (cell) => {
  const v = cellVal(cell);
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return isNaN(n) ? 0 : n;
};
const KODE_RE = /^(JS2|BR2|JS|BR)-[A-Z]+-\d+$/;

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);

  // 1) breakdown per kode dari sheet detail
  const breakdownByKode = {};
  for (const sheetName of ["Jasa Ferry Detail", "Barang Ferry Detail"]) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;
    let curKode = null;
    for (let r = 5; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const a = str(row.getCell(1));
      const b = str(row.getCell(2));
      if (KODE_RE.test(a)) { curKode = a; breakdownByKode[curKode] = []; continue; } // header item
      if (/^HARGA SATUAN/i.test(a)) { curKode = null; continue; }                    // penutup item
      if (a && a === b) { curKode = null; continue; }                                 // header kategori
      if (curKode && !a && b) {                                                       // baris komponen breakdown
        breakdownByKode[curKode].push(b);
      }
    }
  }

  // 2) item flat dari KATALOG (Lookup) baris 5-474
  const ws = wb.getWorksheet("KATALOG (Lookup)");
  const items = [];
  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const kode = str(row.getCell(1));
    if (!KODE_RE.test(kode)) continue;
    const jenis = str(row.getCell(2));
    const kategori = str(row.getCell(3));
    const nama = str(row.getCell(4));
    const spesifikasi = str(row.getCell(5));
    const satuan = str(row.getCell(6));
    const harga = num(row.getCell(7));
    const sumber = str(row.getCell(8)) || "Pasar";
    if (!nama) continue;
    const bd = breakdownByKode[kode] || [];
    items.push({ kode, jenis, kategori, nama, spesifikasi, satuan, harga, sumber, ...(bd.length ? { breakdown: bd } : {}) });
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), source: path.basename(XLSX), count: items.length, items }, null, 0));
  const withBd = items.filter((i) => i.breakdown).length;
  console.log(`OK -> ${OUT}\n  items: ${items.length} | dgn breakdown: ${withBd} | Riil: ${items.filter((i) => i.sumber === "Riil").length} | Pasar: ${items.filter((i) => i.sumber === "Pasar").length}`);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
