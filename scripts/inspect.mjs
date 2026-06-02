import ExcelJS from "exceljs";

function colLetter(n) { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

const files = process.argv.slice(2);
for (const f of files) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(`templates/${f}`);
  console.log(`\n##### ${f} #####`);
  wb.eachSheet((ws) => {
    console.log(`--- "${ws.name}" rows=${ws.rowCount} cols=${ws.columnCount} imgs=${(ws.getImages?.() ?? []).length}`);
    const merges = Object.keys(ws._merges || {});
    // set of non-master merged cells to skip
    const skip = new Set();
    const masterOf = {};
    for (const m of Object.values(ws._merges || {})) {
      const tl = m.tl; // top-left address
      // m.model: {top,left,bottom,right}
      const mdl = m.model;
      for (let r = mdl.top; r <= mdl.bottom; r++)
        for (let c = mdl.left; c <= mdl.right; c++) {
          const addr = colLetter(c) + r;
          if (addr !== tl) skip.add(addr);
        }
      masterOf[tl] = `${tl}:${colLetter(mdl.right)}${mdl.bottom}`;
    }
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (skip.has(cell.address)) return;
        let v = cell.value;
        if (v && typeof v === "object" && "richText" in v) v = v.richText.map((r) => r.text).join("");
        if (v && typeof v === "object" && "result" in v) v = `=${cell.formula}`;
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          const mg = masterOf[cell.address] ? ` [${masterOf[cell.address]}]` : "";
          console.log(`${cell.address}${mg}\t${JSON.stringify(String(v))}`);
        }
      });
    });
  });
}
