import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import { SppbjRequest, SppbjItem, kapalUnik, bdLines, ketLines } from "./types";
import { bulanTahun } from "@/lib/format";

const tplPath = path.join(process.cwd(), "templates", "sppbj", "sppbj.xlsx");

export const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function openTpl(): PizZip { return new PizZip(fs.readFileSync(tplPath)); }

export function saveZip(zip: PizZip): Buffer {
  const wbPath = "xl/workbook.xml";
  let wbx = zip.file(wbPath)!.asText();
  if (!/fullCalcOnLoad/.test(wbx)) {
    if (/<calcPr[^>]*\/>/.test(wbx)) wbx = wbx.replace(/<calcPr([^>]*)\/>/, '<calcPr$1 fullCalcOnLoad="1"/>');
    else wbx = wbx.replace(/<\/workbook>/, '<calcPr fullCalcOnLoad="1"/></workbook>');
    zip.file(wbPath, wbx);
  }
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

export type Edit =
  | { ref: string; kind: "str"; value: string }
  | { ref: string; kind: "num"; value: number }
  | { ref: string; kind: "formula"; value: string }
  | { ref: string; kind: "clear" };

// cari path xml worksheet berdasarkan nama sheet
export function sheetXmlPath(zip: PizZip, name: string): string {
  const wb = zip.file("xl/workbook.xml")!.asText();
  const rels = zip.file("xl/_rels/workbook.xml.rels")!.asText();
  const m = wb.match(new RegExp(`<sheet[^>]*name="${name}"[^>]*r:id="([^"]+)"`));
  if (!m) throw new Error(`sheet ${name} tidak ditemukan`);
  const rid = m[1];
  const rm = rels.match(new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"`));
  if (!rm) throw new Error(`rel ${rid} tidak ditemukan`);
  return "xl/" + rm[1].replace(/^\/?xl\//, "");
}

function buildCell(ref: string, sAttr: string, e: Edit): string {
  const s = sAttr ? ` s="${sAttr}"` : "";
  if (e.kind === "clear") return `<c r="${ref}"${s}/>`;
  if (e.kind === "num") return `<c r="${ref}"${s}><v>${e.value}</v></c>`;
  if (e.kind === "formula") return `<c r="${ref}"${s}><f>${esc(e.value)}</f></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(e.value)}</t></is></c>`;
}

function colNum(ref: string): number {
  const m = ref.match(/^([A-Z]+)/)![1];
  let n = 0; for (let i = 0; i < m.length; i++) n = n * 26 + (m.charCodeAt(i) - 64);
  return n;
}

// row-aware: rebuild tiap <row> yang diedit, cell terurut kolom (valid utk Excel)
export function applyEdits(xml: string, edits: Edit[]): string {
  const byRow = new Map<number, Edit[]>();
  for (const e of edits) {
    const rn = parseInt(e.ref.replace(/[A-Z]+/, ""), 10);
    if (!byRow.has(rn)) byRow.set(rn, []);
    byRow.get(rn)!.push(e);
  }

  for (const [rn, rowEdits] of Array.from(byRow.entries()).sort((a, b) => a[0] - b[0])) {
    const rowRe = new RegExp(`<row r="${rn}"([^>]*?)(?:/>|>([\\s\\S]*?)</row>)`);
    const m = xml.match(rowRe);
    // kumpulkan cell existing
    const cells = new Map<string, string>(); // ref -> cellXml
    const styleOf = new Map<string, string>();
    if (m && m[2]) {
      const cellRe = /<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g;
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(m[2]))) {
        cells.set(cm[1], cm[0]);
        const s = cm[2].match(/ s="(\d+)"/); if (s) styleOf.set(cm[1], s[1]);
      }
    }
    // terapkan edit
    for (const e of rowEdits) {
      const s = styleOf.get(e.ref) || "";
      cells.set(e.ref, buildCell(e.ref, s, e));
    }
    // susun terurut kolom
    const ordered = Array.from(cells.entries()).sort((a, b) => colNum(a[0]) - colNum(b[0]));
    const inner = ordered.map((x) => x[1]).join("");
    const colsNums = ordered.map((x) => colNum(x[0]));
    const spans = colsNums.length ? `${Math.min(...colsNums)}:${Math.max(...colsNums)}` : "1:1";

    if (m) {
      let attrs = m[1] || "";
      attrs = /spans="/.test(attrs) ? attrs.replace(/spans="[^"]*"/, `spans="${spans}"`) : `${attrs} spans="${spans}"`;
      xml = xml.replace(rowRe, `<row r="${rn}"${attrs}>${inner}</row>`);
    } else {
      // buat row baru, sisipkan urut di <sheetData>
      const newRow = `<row r="${rn}" spans="${spans}">${inner}</row>`;
      const allRows = Array.from(xml.matchAll(/<row r="(\d+)"/g));
      const after = allRows.find((r) => parseInt(r[1], 10) > rn);
      if (after) xml = xml.replace(new RegExp(`<row r="${after[1]}"`), `${newRow}<row r="${after[1]}"`);
      else xml = xml.replace("</sheetData>", `${newRow}</sheetData>`);
    }
  }
  return xml;
}

function groupByKapal(items: SppbjItem[]) {
  return kapalUnik(items).map((k) => ({ kapal: k, items: items.filter((i) => i.kapal.trim() === k) }));
}

// bangun edit untuk tabel (SPPBJ withHarga=true rows17-35; KAK false rows73-90)
function tableEdits(first: number, last: number, groups: { kapal: string; items: SppbjItem[] }[], withHarga: boolean): Edit[] {
  const edits: Edit[] = [];
  // clear semua dulu
  for (let r = first; r <= last; r++) ["A", "B", "C", "D", "E", "F", "G"].forEach((c) => edits.push({ ref: `${c}${r}`, kind: "clear" }));
  let r = first, no = 1;
  groups.forEach((g, gi) => {
    if (r > last) return;
    if (gi > 0) r++; // spasi 1 baris antar kapal
    if (r > last) return;
    edits.push({ ref: `D${r}`, kind: "str", value: g.kapal });
    r++;
    let prevKet = "";
    for (const it of g.items) {
      if (r > last) break;
      // header keterangan (di atas item) saat berganti
      if ((it.keterangan || "") !== prevKet) {
        for (const kl of ketLines(it)) { if (r > last) break; edits.push({ ref: `D${r}`, kind: "str", value: kl }); r++; }
        prevKet = it.keterangan || "";
      }
      if (r > last) break;
      edits.push({ ref: `A${r}`, kind: "num", value: no });
      edits.push({ ref: `B${r}`, kind: "num", value: it.jumlah });
      edits.push({ ref: `C${r}`, kind: "str", value: it.satuan });
      edits.push({ ref: `D${r}`, kind: "str", value: it.nama });
      edits.push({ ref: `E${r}`, kind: "str", value: it.spesifikasi || "" });
      if (withHarga) {
        edits.push({ ref: `F${r}`, kind: "num", value: it.harga });
        edits.push({ ref: `G${r}`, kind: "formula", value: `F${r}*B${r}` });
      }
      no++; r++;
      // rincian breakdown -> baris baru (kolom nama saja)
      for (const bl of bdLines(it)) { if (r > last) break; edits.push({ ref: `D${r}`, kind: "str", value: bl }); r++; }
    }
  });
  return edits;
}

// terapkan beberapa set edit ke beberapa sheet dalam 1 workbook
export function genWorkbook(parts: { sheet: string; edits: Edit[] }[]): Buffer {
  const zip = openTpl();
  for (const p of parts) {
    const sp = sheetXmlPath(zip, p.sheet);
    zip.file(sp, applyEdits(zip.file(sp)!.asText(), p.edits));
  }
  return saveZip(zip);
}

export function buildSppbjEdits(req: SppbjRequest): Edit[] {
  const bt = bulanTahun(req.tanggal);
  const groups = groupByKapal(req.items);

  const edits: Edit[] = [
    { ref: "G7", kind: "str", value: req.noSPPBJ || "" },
    { ref: "G8", kind: "str", value: `      ${bt}` },
    { ref: "G9", kind: "str", value: req.noDRP || "" },
    { ref: "D11", kind: "str", value: req.dasarPelimpahan },
    { ref: "D12", kind: "str", value: req.namaPengadaan },
    { ref: "D13", kind: "str", value: req.mataAnggaran.join(", ") },
    { ref: "E45", kind: "str", value: req.stafTeknik },
    { ref: "E52", kind: "str", value: req.deptHead },
    ...tableEdits(17, 35, groups, true),
    ...tableEdits(73, 90, groups, false),
  ];
  return edits;
}

export function fillSppbj(req: SppbjRequest): Buffer {
  return genWorkbook([{ sheet: "SPPBJ", edits: buildSppbjEdits(req) }]);
}
