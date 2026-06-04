import { SppbjRequest, SppbjItem, kapalUnik, tahunDari, hargaSpbjOf, bdLines, ketLines } from "./types";
import { tanggalIndo, rupiah } from "@/lib/format";
import { genWorkbook, buildSppbjEdits, Edit, openTpl, sheetXmlPath, applyEdits, saveZip } from "./fill";
import type PizZip from "pizzip";

const storLoc = (kapal: string) => kapal.replace(/KMP\.?/i, "").trim().toLowerCase();
const itemsKapal = (req: SppbjRequest, kapal: string) => req.items.filter((i) => i.kapal.trim() === kapal);
// No SPBJ = No Kontrak. Angka untuk BSTB/BAPP diambil dari grup angka pertama No.Kontrak.
const nomorSPBJ = (req: SppbjRequest) => (req.noKontrak?.match(/\d+/)?.[0]) || "";

// ---------- BSTB ----------
// kapal diberikan -> 1 kapal; kapal null -> semua item (sub-header per kapal di kolom B)
export function buildBstbEdits(req: SppbjRequest, kapal: string | null): Edit[] {
  const tahun = tahunDari(req.tanggal);
  const noNum = nomorSPBJ(req);
  const itemRow = (r: number, it: SppbjItem, no: number) => {
    const e: Edit[] = [
      { ref: `A${r}`, kind: "num", value: no },
      { ref: `B${r}`, kind: "str", value: it.nama },
      { ref: `E${r}`, kind: "str", value: it.spesifikasi || "" },
      { ref: `G${r}`, kind: "str", value: it.satuan },
      { ref: `H${r}`, kind: "num", value: it.jumlah },
      { ref: `I${r}`, kind: "str", value: rupiah(hargaSpbjOf(it)) },
      { ref: `J${r}`, kind: "str", value: "Baik" },
    ];
    return e;
  };
  const edits: Edit[] = [
    { ref: "C7", kind: "str", value: kapal ? (req.penerima?.[kapal] || `Nakhoda ${kapal}`) : "" },
    { ref: "C9", kind: "str", value: kapal ?? "Semua Kapal" },
    { ref: "H7", kind: "str", value: `${noNum}/BSTB-LOG//${tahun}` },
    { ref: "H9", kind: "str", value: req.tanggalSPBJ ? tanggalIndo(req.tanggalSPBJ) : "" },
    { ref: "C12", kind: "str", value: req.noKontrak ? `SPBJ No. ${req.noKontrak}` : "" },
  ];
  for (let r = 21; r <= 33; r++) ["A", "B", "E", "G", "H", "I", "J"].forEach((c) => edits.push({ ref: `${c}${r}`, kind: "clear" }));
  let r = 21, no = 1;
  const groups = kapal ? [{ kapal, items: itemsKapal(req, kapal) }] : kapalUnik(req.items).map((k) => ({ kapal: k, items: itemsKapal(req, k) }));
  for (const g of groups) {
    if (r > 33) break;
    if (!kapal) { edits.push({ ref: `B${r}`, kind: "str", value: g.kapal }); r++; } // sub-header kapal (mode semua)
    let prevKet = "";
    for (const it of g.items) {
      if (r > 33) break;
      if ((it.keterangan || "") !== prevKet) {
        for (const kl of ketLines(it)) { if (r > 33) break; edits.push({ ref: `B${r}`, kind: "str", value: kl }); r++; }
        prevKet = it.keterangan || "";
      }
      if (r > 33) break;
      itemRow(r, it, no).forEach((e) => edits.push(e));
      no++; r++;
      for (const bl of bdLines(it)) { if (r > 33) break; edits.push({ ref: `B${r}`, kind: "str", value: bl }); r++; }
    }
  }
  return edits;
}
export function fillBstb(req: SppbjRequest, kapal: string): Buffer {
  return genWorkbook([{ sheet: "BSTB", edits: buildBstbEdits(req, kapal) }]);
}

// ---------- BAPP ----------
export function buildBappEdits(req: SppbjRequest): Edit[] {
  const tahun = tahunDari(req.tanggal);

  const edits: Edit[] = [
    { ref: "C6", kind: "str", value: req.vendor || "" },
    { ref: "L6", kind: "str", value: `${nomorSPBJ(req)}/BAPPB//${tahun}` },
    { ref: "C7", kind: "str", value: req.noKontrak || "" },
    { ref: "C8", kind: "str", value: req.tanggalKontrak ? tanggalIndo(req.tanggalKontrak) : "" },
    { ref: "L7", kind: "str", value: req.tanggalBAPP ? tanggalIndo(req.tanggalBAPP) : "" },
  ];
  // tabel item 14-30 (grup per kapal): B kapal header, lalu item A,B,G,H,I,J,L
  for (let r = 14; r <= 30; r++) ["A", "B", "G", "H", "I", "J", "L"].forEach((c) => edits.push({ ref: `${c}${r}`, kind: "clear" }));
  let r = 14, no = 1;
  for (const kapal of kapalUnik(req.items)) {
    if (r > 30) break;
    edits.push({ ref: `B${r}`, kind: "str", value: kapal });
    r++;
    let prevKet = "";
    for (const it of itemsKapal(req, kapal)) {
      if (r > 30) break;
      if ((it.keterangan || "") !== prevKet) {
        for (const kl of ketLines(it)) { if (r > 30) break; edits.push({ ref: `B${r}`, kind: "str", value: kl }); r++; }
        prevKet = it.keterangan || "";
      }
      if (r > 30) break;
      edits.push({ ref: `A${r}`, kind: "num", value: no });
      edits.push({ ref: `B${r}`, kind: "str", value: it.nama });
      edits.push({ ref: `G${r}`, kind: "str", value: it.spesifikasi || "" });
      edits.push({ ref: `H${r}`, kind: "str", value: it.satuan });
      edits.push({ ref: `I${r}`, kind: "num", value: it.jumlah });
      edits.push({ ref: `J${r}`, kind: "str", value: rupiah(hargaSpbjOf(it) * it.jumlah) });
      edits.push({ ref: `L${r}`, kind: "str", value: "SELESAI" });
      no++; r++;
      for (const bl of bdLines(it)) { if (r > 30) break; edits.push({ ref: `B${r}`, kind: "str", value: bl }); r++; }
    }
  }
  return edits;
}
export function fillBapp(req: SppbjRequest): Buffer {
  return genWorkbook([{ sheet: "BAPP", edits: buildBappEdits(req) }]);
}

// ---------- FORMAT SAP ----------
// tanggal + 30 hari -> "dd.mm.yyyy"
function plus30Dot(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso); d.setDate(d.getDate() + 30);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function buildSapEdits(req: SppbjRequest): Edit[] {
  const jasa = (req.jenisPengadaan ?? (/jasa/i.test(req.namaPengadaan) ? "jasa" : "barang")) === "jasa";
  const dDate = plus30Dot(req.tanggal);
  const matl = req.matlGroup || "";
  const edits: Edit[] = [];
  const allCols = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q"];
  for (let r = 4; r <= 40; r++) allCols.forEach((c) => edits.push({ ref: `${c}${r}`, kind: "clear" }));
  let r = 4, no = 1;
  for (const it of req.items) {
    if (r > 40) break;
    edits.push({ ref: `B${r}`, kind: "num", value: no });
    edits.push({ ref: `D${r}`, kind: "str", value: "K" });
    edits.push({ ref: `E${r}`, kind: "str", value: jasa ? "D" : "" });
    edits.push({ ref: `G${r}`, kind: "str", value: it.nama });
    edits.push({ ref: `H${r}`, kind: "num", value: it.jumlah });
    edits.push({ ref: `I${r}`, kind: "str", value: it.satuan });
    edits.push({ ref: `J${r}`, kind: "str", value: "D" });
    edits.push({ ref: `K${r}`, kind: "str", value: dDate });
    edits.push({ ref: `L${r}`, kind: "str", value: matl });
    edits.push({ ref: `M${r}`, kind: "str", value: "520" });
    edits.push({ ref: `N${r}`, kind: "str", value: storLoc(it.kapal) });
    edits.push({ ref: `O${r}`, kind: "str", value: "B61" });
    edits.push({ ref: `P${r}`, kind: "num", value: 1 });
    edits.push({ ref: `Q${r}`, kind: "num", value: Math.round(it.harga / 100) });
    no++; r++;
  }
  return edits;
}

export function fillFormatSap(req: SppbjRequest): Buffer {
  return genWorkbook([{ sheet: "FORMAT SAP", edits: buildSapEdits(req) }]);
}

// ---------- FASE 1: 1 file Excel berisi sheet SPPBJ + FORMAT SAP ----------
export function fillFase1(req: SppbjRequest): Buffer {
  return genWorkbook([
    { sheet: "SPPBJ", edits: buildSppbjEdits(req) },
    { sheet: "FORMAT SAP", edits: buildSapEdits(req) },
  ]);
}

// ---------- LENGKAP: 1 file Excel; SPPBJ + FORMAT SAP + BAPP + BSTB (sheet per kapal) ----------
const maxIdx = (zip: PizZip, re: RegExp) =>
  Math.max(0, ...Object.keys(zip.files).map((f) => { const m = f.match(re); return m ? +m[1] : 0; }));

function cloneBstb(zip: PizZip, srcSheetXml: string, srcRelsXml: string, drawingXml: string, drawingRelsXml: string, ctOverride: { sheet: string; drawing: string }, edits: Edit[], sheetName: string) {
  const sN = maxIdx(zip, /worksheets\/sheet(\d+)\.xml$/) + 1;
  const dN = maxIdx(zip, /drawings\/drawing(\d+)\.xml$/) + 1;
  zip.file(`xl/worksheets/sheet${sN}.xml`, applyEdits(srcSheetXml, edits));
  zip.file(`xl/worksheets/_rels/sheet${sN}.xml.rels`, srcRelsXml.replace(/Target="\.\.\/drawings\/drawing\d+\.xml"/, `Target="../drawings/drawing${dN}.xml"`));
  zip.file(`xl/drawings/drawing${dN}.xml`, drawingXml);
  zip.file(`xl/drawings/_rels/drawing${dN}.xml.rels`, drawingRelsXml);

  // Content_Types
  let ct = zip.file("[Content_Types].xml")!.asText();
  const ovSheet = `<Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" PartName="/xl/worksheets/sheet${sN}.xml"/>`;
  const ovDraw = `<Override ContentType="application/vnd.openxmlformats-officedocument.drawing+xml" PartName="/xl/drawings/drawing${dN}.xml"/>`;
  ct = ct.replace("</Types>", `${ovSheet}${ovDraw}</Types>`);
  zip.file("[Content_Types].xml", ct);

  // workbook rels
  let rels = zip.file("xl/_rels/workbook.xml.rels")!.asText();
  const nextRId = Math.max(0, ...Array.from(rels.matchAll(/Id="rId(\d+)"/g)).map((m) => +m[1])) + 1;
  rels = rels.replace("</Relationships>", `<Relationship Id="rId${nextRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sN}.xml"/></Relationships>`);
  zip.file("xl/_rels/workbook.xml.rels", rels);

  // workbook.xml <sheet>
  let wb = zip.file("xl/workbook.xml")!.asText();
  const nextSheetId = Math.max(0, ...Array.from(wb.matchAll(/sheetId="(\d+)"/g)).map((m) => +m[1])) + 1;
  const name = sheetName.replace(/[\\/?*\[\]:]/g, "").slice(0, 31);
  wb = wb.replace("</sheets>", `<sheet state="visible" name="${name}" sheetId="${nextSheetId}" r:id="rId${nextRId}"/></sheets>`);
  zip.file("xl/workbook.xml", wb);
}

export function fillLengkap(req: SppbjRequest): Buffer {
  const zip = openTpl();
  const apply = (sheet: string, edits: Edit[]) => { const p = sheetXmlPath(zip, sheet); zip.file(p, applyEdits(zip.file(p)!.asText(), edits)); };
  apply("SPPBJ", buildSppbjEdits(req));
  apply("FORMAT SAP", buildSapEdits(req));
  apply("BAPP", buildBappEdits(req));

  const kapals = kapalUnik(req.items);
  const bstbPath = sheetXmlPath(zip, "BSTB");
  const origBstb = zip.file(bstbPath)!.asText();
  // sumber rels/drawing BSTB (utk kloning)
  const relsPath = bstbPath.replace("worksheets/", "worksheets/_rels/") + ".rels";
  const srcRels = zip.file(relsPath)?.asText() || "";
  const drawTarget = srcRels.match(/Target="\.\.\/drawings\/(drawing\d+\.xml)"/)?.[1];
  const drawPath = drawTarget ? `xl/drawings/${drawTarget}` : "";
  const drawXml = drawPath ? (zip.file(drawPath)?.asText() || "") : "";
  const drawRelsXml = drawPath ? (zip.file(drawPath.replace("drawings/", "drawings/_rels/") + ".rels")?.asText() || "") : "";

  // kapal pertama -> sheet BSTB asli
  zip.file(bstbPath, applyEdits(origBstb, buildBstbEdits(req, kapals[0] || null)));
  // kapal selanjutnya -> sheet baru hasil clone
  for (let i = 1; i < kapals.length; i++) {
    cloneBstb(zip, origBstb, srcRels, drawXml, drawRelsXml, { sheet: "", drawing: "" }, buildBstbEdits(req, kapals[i]), `BSTB ${kapals[i].replace(/KMP\.?\s*/i, "")}`);
  }
  return saveZip(zip);
}
