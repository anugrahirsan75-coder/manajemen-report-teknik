import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import { NonprRequest, NonprItem, kapalUnikNonpr, tahunNonpr, ketLines, bdLines } from "./types";
import { penerimaBstb, vendorOf, Jabatan } from "./db";
import { bulanRomawi, tanggalIndo } from "@/lib/format";
import { applyEdits, sheetXmlPath, saveZip, esc, Edit } from "@/lib/sppbj/fill";
import { fotoToDataUrl } from "@/lib/server/foto";

// exceljs MERUSAK template ini -> WAJIB raw-XML (reuse engine sppbj).
const tplPath = path.join(process.cwd(), "templates", "nonpr", "nonpr.xlsx");
const openTpl = () => new PizZip(fs.readFileSync(tplPath));

const itemsKapal = (req: NonprRequest, kapal: string) => req.items.filter((i) => (i.kapal || "").trim() === kapal);
const nomorSPPB = (req: NonprRequest) => `${req.noSPPB || ""}/SPPB/TTE/${bulanRomawi(req.tanggal)}/ASDP-${tahunNonpr(req.tanggal)}`;
const nomorBPB = (req: NonprRequest) => `${req.noSPPB || ""}/BPB-TNK/TTE/${bulanRomawi(req.tanggal)}/ASDP-${tahunNonpr(req.tanggal)}`;
const groupsOf = (req: NonprRequest) => kapalUnikNonpr(req.items).map((k) => ({ kapal: k, items: itemsKapal(req, k) }));

const S = (ref: string, value: string): Edit => ({ ref, kind: "str", value });
const N = (ref: string, value: number): Edit => ({ ref, kind: "num", value });
const F = (ref: string, value: string): Edit => ({ ref, kind: "formula", value });
const CL = (ref: string): Edit => ({ ref, kind: "clear" });

// ---------- baris tabel (sumber tunggal utk hitung kebutuhan & tulis) ----------
type Line =
  | { t: "blank" }
  | { t: "kapal"; v: string }
  | { t: "ket"; v: string }
  | { t: "bd"; v: string }
  | { t: "item"; it: NonprItem; no: number };

// urutan baris SPPB & spkh (kapal[0] di luar band: D15/E19)
function bandLines(groups: { kapal: string; items: NonprItem[] }[]): Line[] {
  const out: Line[] = [];
  let no = 1;
  groups.forEach((g, gi) => {
    if (gi > 0) { out.push({ t: "blank" }, { t: "kapal", v: g.kapal }); } // spasi antar kapal
    let prevKet = "";
    for (const it of g.items) {
      if ((it.keterangan || "") !== prevKet) {
        for (const kl of ketLines(it)) out.push({ t: "ket", v: kl });
        prevKet = it.keterangan || "";
      }
      out.push({ t: "item", it, no: no++ });
      for (const bl of bdLines(it)) out.push({ t: "bd", v: bl });
    }
  });
  return out;
}

// urutan baris BSTB per kapal (tanpa header kapal — sudah di B14)
function bstbLines(items: NonprItem[]): Line[] {
  const out: Line[] = [];
  let no = 1, prevKet = "";
  for (const it of items) {
    if ((it.keterangan || "") !== prevKet) {
      for (const kl of ketLines(it)) out.push({ t: "ket", v: kl });
      prevKet = it.keterangan || "";
    }
    out.push({ t: "item", it, no: no++ });
    for (const bl of bdLines(it)) out.push({ t: "bd", v: bl });
  }
  return out;
}

// ---------- INSERT BARIS raw-XML (band dinamis) ----------
// Sisip `count` baris baru mulai `atRow` (geser semua >= atRow): row/cell refs, merge,
// formula sheet ini, formula lintas-sheet (Sheet!A1) di sheet lain + definedNames, anchor drawing.
// Baris baru kloning style dari `styleRow` (nilai dibuang, style/border ikut).
function insertRowsRaw(zip: PizZip, sheetName: string, atRow: number, count: number, styleRow: number) {
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

// ---------- SPPB ----------
function sppbEdits(req: NonprRequest, lines: Line[], bandEnd: number): Edit[] {
  const e: Edit[] = [
    S("T6", nomorSPPB(req)),
    S("T7", tanggalIndo(req.tanggal)),
    S("F9", req.dasarPelimpahan || ""),
    S("F10", req.namaPengadaan || ""),
    S("F11", req.mataAnggaran || ""),
    // stafTeknik R31 ditulis terpisah (sppbStafEdit) karena barisnya geser saat band meluas
  ];
  e.push(CL("D15"));
  for (let r = 16; r <= bandEnd; r++) ["A", "B", "C", "D", "O", "R", "T"].forEach((c) => e.push(CL(`${c}${r}`)));
  const groups = groupsOf(req);
  if (groups[0]) e.push(S("D15", groups[0].kapal));
  let r = 16;
  for (const ln of lines) {
    if (ln.t === "blank") { r++; continue; }
    if (ln.t === "kapal" || ln.t === "ket" || ln.t === "bd") { e.push(S(`D${r}`, ln.v)); r++; continue; }
    const it = ln.it;
    e.push(N(`A${r}`, ln.no), N(`B${r}`, it.jumlah), S(`C${r}`, it.satuan), S(`D${r}`, it.nama), S(`O${r}`, it.spesifikasi || ""), N(`R${r}`, it.harga), F(`T${r}`, `R${r}*B${r}`));
    r++;
  }
  return e;
}

// catatan: TTD stafTeknik di R31 GESER kalau band SPPB diperluas → tulis SETELAH insert pakai posisi baru
function sppbStafEdit(req: NonprRequest, extra: number): Edit {
  return S(`R${31 + extra}`, req.stafTeknik || "IRSAN ANUGRAH");
}

// ---------- spkh ----------
function spkhEdits(req: NonprRequest, lines: Line[], bandEnd: number): Edit[] {
  const e: Edit[] = [];
  e.push(CL("E19"));
  for (let r = 20; r <= bandEnd; r++) ["B", "C", "D", "E", "G", "H", "I", "J"].forEach((c) => e.push(CL(`${c}${r}`)));
  const groups = groupsOf(req);
  if (groups[0]) e.push(S("E19", groups[0].kapal));
  let r = 20;
  for (const ln of lines) {
    if (ln.t === "blank") { r++; continue; }
    if (ln.t === "kapal" || ln.t === "ket" || ln.t === "bd") { e.push(S(`E${r}`, ln.v)); r++; continue; }
    const it = ln.it;
    const uraian = it.spesifikasi ? `${it.nama} - ${it.spesifikasi}` : it.nama;
    e.push(N(`B${r}`, ln.no), S(`C${r}`, it.satuan), N(`D${r}`, it.jumlah), S(`E${r}`, uraian), N(`G${r}`, it.harga), F(`H${r}`, `G${r}*D${r}`), F(`I${r}`, `+G${r}`), F(`J${r}`, `I${r}*D${r}`));
    r++;
  }
  // total: formula template SUM(H20:H24)/J sudah auto-meluas saat insert -> tak perlu override
  return e;
}

// ganti nama vendor + telp pada narasi spkh (richtext di sharedStrings.xml)
function replaceVendor(zip: PizZip, req: NonprRequest) {
  const v = vendorOf(req.vendor);
  if (!v) return;
  const p = "xl/sharedStrings.xml";
  const f = zip.file(p); if (!f) return;
  let xml = f.asText();
  xml = xml.split(esc("CV. Multi Karya Jasa")).join(esc(v.nama));
  xml = xml.split("082153148837").join(esc(v.telp));
  zip.file(p, xml);
}

// ---------- BSTB (per kapal) ----------
function bstbEdits(req: NonprRequest, kapal: string, jabatan: Jabatan, lines: Line[], bandEnd: number): Edit[] {
  const pen = penerimaBstb(kapal, jabatan);
  const e: Edit[] = [
    S("D6", pen.kepada), S("M6", nomorBPB(req)), S("D8", kapal), S("M8", tanggalIndo(req.tanggal)),
    S("D10", nomorSPPB(req)), S("B14", kapal),
  ];
  for (let r = 15; r <= bandEnd; r++) ["A", "B", "G", "H", "I", "K", "O"].forEach((c) => e.push(CL(`${c}${r}`)));
  let r = 15;
  for (const ln of lines) {
    if (ln.t === "blank") { r++; continue; }
    if (ln.t === "kapal" || ln.t === "ket" || ln.t === "bd") { e.push(S(`B${r}`, ln.v)); r++; continue; }
    const it = ln.it;
    e.push(N(`A${r}`, ln.no), S(`B${r}`, it.nama), S(`G${r}`, it.spesifikasi || ""), S(`H${r}`, it.satuan), N(`I${r}`, it.jumlah), N(`K${r}`, it.harga), S(`O${r}`, "Baik"));
    r++;
  }
  return e;
}

// TTD penerima B32/B33 GESER kalau band BSTB diperluas
function bstbTtdEdits(kapal: string, jabatan: Jabatan, extra: number): Edit[] {
  const pen = penerimaBstb(kapal, jabatan);
  return [S(`B${32 + extra}`, pen.nama), S(`B${33 + extra}`, pen.kepada)];
}

const maxIdx = (zip: PizZip, re: RegExp) =>
  Math.max(0, ...Object.keys(zip.files).map((f) => { const m = f.match(re); return m ? +m[1] : 0; }));

// tambah worksheet baru dari XML (clone BSTB per kapal) + clone drawing (logo ASDP) miliknya.
function addSheet(zip: PizZip, srcSheetPath: string, xml: string, sheetName: string) {
  const sN = maxIdx(zip, /worksheets\/sheet(\d+)\.xml$/) + 1;
  let ct = zip.file("[Content_Types].xml")!.asText();

  // clone rels sheet sumber; drawing di-remap ke salinan baru biar logo ikut
  const srcRelsPath = srcSheetPath.replace("worksheets/", "worksheets/_rels/") + ".rels";
  const srcRels = zip.file(srcRelsPath)?.asText();
  if (srcRels) {
    let rels = srcRels;
    const drawName = srcRels.match(/Target="\.\.\/drawings\/(drawing\d+)\.xml"/)?.[1];
    if (drawName) {
      const dN = maxIdx(zip, /drawings\/drawing(\d+)\.xml$/) + 1;
      zip.file(`xl/drawings/drawing${dN}.xml`, zip.file(`xl/drawings/${drawName}.xml`)!.asText());
      const drawRels = zip.file(`xl/drawings/_rels/${drawName}.xml.rels`)?.asText();
      if (drawRels) zip.file(`xl/drawings/_rels/drawing${dN}.xml.rels`, drawRels); // media dipakai bersama
      rels = rels.replace(`Target="../drawings/${drawName}.xml"`, `Target="../drawings/drawing${dN}.xml"`);
      ct = ct.replace("</Types>", `<Override ContentType="application/vnd.openxmlformats-officedocument.drawing+xml" PartName="/xl/drawings/drawing${dN}.xml"/></Types>`);
    }
    zip.file(`xl/worksheets/_rels/sheet${sN}.xml.rels`, rels);
    zip.file(`xl/worksheets/sheet${sN}.xml`, xml);
  } else {
    // tak ada rels sumber -> buang ref drawing biar tak rusak
    zip.file(`xl/worksheets/sheet${sN}.xml`, xml.replace(/<drawing[^>]*\/>/g, "").replace(/<legacyDrawing[^>]*\/>/g, ""));
  }
  ct = ct.replace("</Types>", `<Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" PartName="/xl/worksheets/sheet${sN}.xml"/></Types>`);
  zip.file("[Content_Types].xml", ct);

  // workbook rels
  let rels = zip.file("xl/_rels/workbook.xml.rels")!.asText();
  const rid = Math.max(0, ...Array.from(rels.matchAll(/Id="rId(\d+)"/g)).map((m) => +m[1])) + 1;
  rels = rels.replace("</Relationships>", `<Relationship Id="rId${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sN}.xml"/></Relationships>`);
  zip.file("xl/_rels/workbook.xml.rels", rels);
  let wb = zip.file("xl/workbook.xml")!.asText();
  const sid = Math.max(0, ...Array.from(wb.matchAll(/sheetId="(\d+)"/g)).map((m) => +m[1])) + 1;
  const nm = esc(sheetName.replace(/[\\/?*[\]:]/g, "").slice(0, 31));
  wb = wb.replace("</sheets>", `<sheet name="${nm}" sheetId="${sid}" r:id="rId${rid}"/></sheets>`);
  zip.file("xl/workbook.xml", wb);
}

// ---------- Foto (sheet Foto) ----------
// Template Foto: drawing5.xml berisi 1 shape judul + 1 pic anchor (image2.jpg). Kita
// rebuild pic anchor per foto user (maks 2), repoint rels -> media baru. Nol struktur baru.
function fillFotoRaw(zip: PizZip, req: NonprRequest) {
  const fotos = (req.fotoDokumentasi || []).slice(0, 2)
    .map((u) => { const m = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(u || ""); return m ? { ext: /jpe?g/i.test(m[1]) ? "jpg" : m[1].toLowerCase(), buf: Buffer.from(m[2], "base64") } : null; })
    .filter(Boolean) as { ext: string; buf: Buffer }[];
  if (!fotos.length) return;

  // drawing milik sheet Foto (cari via rels, jangan hardcode — bisa berubah)
  const fotoPath = sheetXmlPath(zip, "Foto");
  const fotoRels = zip.file(fotoPath.replace("worksheets/", "worksheets/_rels/") + ".rels")?.asText();
  const dname = fotoRels?.match(/Target="\.\.\/drawings\/(drawing\d+)\.xml"/)?.[1];
  if (!dname) return;
  const d5p = `xl/drawings/${dname}.xml`;
  const relsp = `xl/drawings/_rels/${dname}.xml.rels`;
  const d5 = zip.file(d5p)!.asText();
  const allAnchors = (d5.match(/<xdr:oneCellAnchor>[\s\S]*?<\/xdr:oneCellAnchor>/g) || []);
  const picTpl = allAnchors.find((a) => a.includes("<xdr:pic>"));
  if (!picTpl) return;
  const body = d5.replace(picTpl, ""); // sisakan shape judul

  let relRels = "", anchors = "";
  fotos.forEach((fo, i) => {
    const rid = `rIdFoto${i + 1}`;
    const fname = `imageFoto${i + 1}.${fo.ext}`;
    zip.file(`xl/media/${fname}`, fo.buf as any);
    relRels += `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${fname}"/>`;
    let a = picTpl.replace(/r:embed="[^"]+"/, `r:embed="${rid}"`).replace(/name="[^"]*"/, `name="${fname}"`);
    a = a.replace(/(<xdr:from><xdr:col>\d+<\/xdr:col><xdr:colOff>\d+<\/xdr:colOff><xdr:row>)\d+(<\/xdr:row>)/, `$1${2 + i * 18}$2`);
    anchors += a;
  });
  zip.file(d5p, body.replace("</xdr:wsDr>", `${anchors}</xdr:wsDr>`));
  zip.file(relsp, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relRels}</Relationships>`);

  let ct = zip.file("[Content_Types].xml")!.asText();
  for (const fo of fotos) {
    if (!new RegExp(`Extension="${fo.ext}"`, "i").test(ct)) {
      ct = ct.replace(/<Types ([^>]*)>/, `<Types $1><Default Extension="${fo.ext}" ContentType="image/${fo.ext === "jpg" ? "jpeg" : fo.ext}"/>`);
    }
  }
  zip.file("[Content_Types].xml", ct);
}

// ---------- ORKESTRASI ----------
export async function fillNonpr(req: NonprRequest): Promise<Buffer> {
  // foto bisa URL Supabase Storage -> konversi ke data URL utk embed raw-XML
  if (req.fotoDokumentasi?.length) {
    const resolved = await Promise.all(req.fotoDokumentasi.map(fotoToDataUrl));
    req = { ...req, fotoDokumentasi: resolved.filter(Boolean) };
  }
  const zip = openTpl();
  const apply = (sheet: string, edits: Edit[]) => { const p = sheetXmlPath(zip, sheet); zip.file(p, applyEdits(zip.file(p)!.asText(), edits)); };

  const groups = groupsOf(req);
  const lines = bandLines(groups);
  const kapals = kapalUnikNonpr(req.items);
  const jab = (k: string): Jabatan => (req.jabatanByKapal?.[k] === "Nakhoda" ? "Nakhoda" : "KKM");
  const perKapalLines = new Map(kapals.map((k) => [k, bstbLines(itemsKapal(req, k))]));

  // band dinamis: SPPB 16-22 (7), spkh 20-24 (5), BSTB 15-19 (5) -> insert kalau kurang
  const sppbExtra = Math.max(0, lines.length - 7);
  const spkhExtra = Math.max(0, lines.length - 5);
  const bstbExtra = Math.max(0, ...Array.from(perKapalLines.values()).map((l) => l.length - 5));
  insertRowsRaw(zip, "SPPB", 22, sppbExtra, 16);
  insertRowsRaw(zip, "spkh", 24, spkhExtra, 20);
  insertRowsRaw(zip, "BSTB", 19, bstbExtra, 15);

  apply("SPPB", [...sppbEdits(req, lines, 22 + sppbExtra), sppbStafEdit(req, sppbExtra)]);
  apply("spkh", spkhEdits(req, lines, 24 + spkhExtra));
  replaceVendor(zip, req);

  const bstbPath = sheetXmlPath(zip, "BSTB");
  const origBstb = zip.file(bstbPath)!.asText();
  const bstbBand = 19 + bstbExtra;
  if (kapals[0]) {
    zip.file(bstbPath, applyEdits(origBstb, [
      ...bstbEdits(req, kapals[0], jab(kapals[0]), perKapalLines.get(kapals[0])!, bstbBand),
      ...bstbTtdEdits(kapals[0], jab(kapals[0]), bstbExtra),
    ]));
  }
  for (let i = 1; i < kapals.length; i++) {
    addSheet(zip, bstbPath, applyEdits(origBstb, [
      ...bstbEdits(req, kapals[i], jab(kapals[i]), perKapalLines.get(kapals[i])!, bstbBand),
      ...bstbTtdEdits(kapals[i], jab(kapals[i]), bstbExtra),
    ]), `BSTB ${kapals[i].replace(/KMP\.?\s*/i, "")}`);
  }
  fillFotoRaw(zip, req);
  return saveZip(zip);
}
