// Regenerate seed DB kode material dari Google Sheet (gviz CSV) dgn parser BENAR
// (state machine — sel multi-baris tak memecah baris).
// Jalankan: node scripts/gen-material-seed.cjs
const fs = require("fs");
const path = require("path");

const SHEET_ID = "14WA01qxI5kwVfTKcnaVuCEqMZQFPo3ASdPrXcmxIths";
const GID = "1216282764";
const URL_ = process.env.MATERIAL_DB_CSV_URL || `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;
const OUT = path.join("src", "lib", "material", "kodeMaterialDb.json");
const C_MAT = 0, C_DESC = 3, C_GROUP = 6, C_PART = 17, C_PO = 18;

function parseCsvGrid(text) {
  const rows = []; let row = [], c = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else {
      if (ch === '"') q = true;
      else if (ch === ",") { row.push(c); c = ""; }
      else if (ch === "\n") { row.push(c); rows.push(row); row = []; c = ""; }
      else if (ch !== "\r") c += ch;
    }
  }
  if (c.length || row.length) { row.push(c); rows.push(row); }
  return rows;
}

(async () => {
  const res = await fetch(URL_);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const grid = parseCsvGrid(await res.text());
  const out = [];
  for (let i = 1; i < grid.length; i++) {
    const f = grid[i];
    const m = (f[C_MAT] || "").trim();
    if (!m) continue;
    out.push({ m, d: (f[C_DESC] || "").trim(), p: (f[C_PART] || "").trim(), g: (f[C_GROUP] || "").trim(), po: (f[C_PO] || "").trim() });
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`OK -> ${OUT} : ${out.length} baris (dgn part: ${out.filter((r) => r.p).length})`);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
