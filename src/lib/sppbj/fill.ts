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

// KAK point B "Lingkup Pelaksanaan...": template (Google) sudah berisi nomor B71-76 (1-6)
// + teks point 2-6 statis di C72-76 (merged C:G). Point 1 (C71) = nama pengadaan otomatis.
// Section C-H di bawahnya statis dari template — JANGAN diutak-atik.
function kakPointEdits(namaPengadaan: string): Edit[] {
  return [{ ref: "C71", kind: "str", value: namaPengadaan || "" }];
}


// ---------- INSERT BARIS raw-XML (band dinamis) ----------
// Sisip `count` baris baru mulai `atRow` (geser semua >= atRow): row/cell refs, merge,
// formula sheet ini, formula lintas-sheet (Sheet!A1) di sheet lain + definedNames, anchor drawing.
// Baris baru kloning style dari `styleRow` (nilai dibuang, style/border ikut).
export function insertRowsRaw(zip: PizZip, sheetName: string, atRow: number, count: number, styleRow: number) {
  if (count <= 0) return;
  const p = sheetXmlPath(zip, sheetName);
  let xml = zip.file(p)!.asText();
  const sh = (n: number) => (n >= atRow ? n + count : n);

  // template baris utk kloning (ambil SEBELUM digeser)
  const tplMatch = xml.match(new RegExp(`<row r="${styleRow}"[^>]*?/>`)) ||
    xml.match(new RegExp(`<row r="${styleRow}"[^>]*>[\\s\\S]*?</row>`));
  const tplRow = tplMatch ? tplMatch[0] : `<row r="${styleRow}"/>`;

  // geser row + cell + merge + formula sheet ini
  xml = xml.replace(/<row r="(\d+)"/g, (_, n) => `<row r="${sh(+n)}"`);
  xml = xml.replace(/<c r="([A-Z]+)(\d+)"/g, (_, c, n) => `<c r="${c}${sh(+n)}"`);
  xml = xml.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g,
    (_, c1, r1, c2, r2) => `<mergeCell ref="${c1}${sh(+r1)}:${c2}${sh(+r2)}"`);
  xml = xml.replace(/<f([^>]*)>([^<]*)<\/f>/g, (_, attrs, f) => {
    const nf = f.replace(/(?<![A-Z0-9_!$])(\$?[A-Z]{1,3}\$?)(\d+)(?!\()/g, (s: string, col: string, n: string) => col + sh(+n));
    return `<f${attrs}>${nf}</f>`;
  });

  // baris baru kloning style (nilai kosong, s= dipertahankan)
  let news = "";
  for (let i = 0; i < count; i++) {
    const rn = atRow + i;
    let row = tplRow.replace(/<row r="\d+"/, `<row r="${rn}"`);
    row = row.replace(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g, (_, c, attrs) => {
      const sAttr = (attrs.match(/ s="\d+"/) || [""])[0];
      return `<c r="${c}${rn}"${sAttr}/>`;
    });
    news += row;
  }
  const allRows = Array.from(xml.matchAll(/<row r="(\d+)"/g));
  const after = allRows.find((r) => +r[1] >= atRow + count);
  if (after) xml = xml.replace(new RegExp(`<row r="${after[1]}"`), `${news}<row r="${after[1]}"`);
  else xml = xml.replace("</sheetData>", `${news}</sheetData>`);
  zip.file(p, xml);

  // ref lintas-sheet di sheet lain + definedNames workbook (mis. spkh: =SPPB!R31)
  const qre = new RegExp(`(${sheetName}!\\$?[A-Z]{1,3}\\$?)(\\d+)`, "g");
  for (const f of Object.keys(zip.files)) {
    if (f === p) continue;
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(f) || f === "xl/workbook.xml") {
      const x = zip.file(f)!.asText();
      const nx = x.replace(qre, (_, pre, n) => pre + sh(+n));
      if (nx !== x) zip.file(f, nx);
    }
  }

  // anchor drawing sheet ini (xdr:row 0-based)
  const rels = zip.file(p.replace("worksheets/", "worksheets/_rels/") + ".rels")?.asText();
  const dt = rels?.match(/Target="\.\.\/drawings\/(drawing\d+\.xml)"/)?.[1];
  if (dt) {
    let dx = zip.file(`xl/drawings/${dt}`)!.asText();
    dx = dx.replace(/<xdr:row>(\d+)<\/xdr:row>/g, (_, n) => `<xdr:row>${+n >= atRow - 1 ? +n + count : +n}</xdr:row>`);
    zip.file(`xl/drawings/${dt}`, dx);
  }
}

/**
 * Berapa baris yang sebenarnya dibutuhkan tabel item.
 *
 * Template hanya menyediakan sejumlah baris tetap. Sebelum ini, item yang
 * melebihi jatah itu DIBUANG diam-diam — dokumen tampak wajar padahal isinya
 * kurang. Hitungan ini dipakai untuk menyisipkan barisnya lebih dulu.
 */
export function butuhBaris(
  groups: { kapal: string; items: SppbjItem[] }[],
  o: { headerKapal?: boolean; spasiAntarKapal?: boolean } = {},
): number {
  let n = 0;
  groups.forEach((g, gi) => {
    if (o.spasiAntarKapal && gi > 0) n++;
    if (o.headerKapal) n++;
    let prevKet = "";
    for (const it of g.items) {
      if ((it.keterangan || "") !== prevKet) { n += ketLines(it).length; prevKet = it.keterangan || ""; }
      n += 1 + bdLines(it).length;
    }
  });
  return n;
}

/**
 * Pastikan band `first..last` cukup menampung `butuh` baris; kalau kurang,
 * baris disisipkan pada akhir band sehingga baris penutup (jumlah, PPN, tanda
 * tangan) ikut bergeser turun beserta rumusnya. Mengembalikan baris akhir baru.
 */
export function pastikanBaris(
  zip: PizZip, sheet: string, first: number, last: number, butuh: number, styleRow: number,
): number {
  const tambah = Math.max(0, butuh - (last - first + 1));
  if (tambah > 0) insertRowsRaw(zip, sheet, last, tambah, styleRow);
  return last + tambah;
}

/** seperti genWorkbook, tapi zip boleh disiapkan dulu (mis. menyisipkan baris) */
export function genWorkbookSiap(siap: (zip: PizZip) => { sheet: string; edits: Edit[] }[]): Buffer {
  const zip = openTpl();
  for (const p of siap(zip)) {
    const sp = sheetXmlPath(zip, p.sheet);
    zip.file(sp, applyEdits(zip.file(sp)!.asText(), p.edits));
  }
  return saveZip(zip);
}

export function buildSppbjEdits(req: SppbjRequest, akhirTabel = 35): Edit[] {
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
    ...tableEdits(17, akhirTabel, groups, true),
    ...kakPointEdits(req.namaPengadaan),
  ];
  return edits;
}

export function fillSppbj(req: SppbjRequest): Buffer {
  return genWorkbookSiap((zip) => {
    const groups = groupByKapal(req.items);
    const butuh = butuhBaris(groups, { headerKapal: true, spasiAntarKapal: true });
    const akhir = pastikanBaris(zip, "SPPBJ", 17, 35, butuh, 30);
    return [{ sheet: "SPPBJ", edits: buildSppbjEdits(req, akhir) }];
  });
}
