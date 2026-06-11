import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import { NonprRequest, NonprItem, kapalUnikNonpr, tahunNonpr } from "./types";
import { penerimaBstb, vendorOf, Jabatan } from "./db";
import { bulanRomawi, tanggalIndo } from "@/lib/format";
import { applyEdits, sheetXmlPath, saveZip, esc, Edit } from "@/lib/sppbj/fill";

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

// ---------- SPPB ----------
function sppbEdits(req: NonprRequest): Edit[] {
  const e: Edit[] = [
    S("T6", nomorSPPB(req)),
    S("T7", tanggalIndo(req.tanggal)),
    S("F9", req.dasarPelimpahan || ""),
    S("F10", req.namaPengadaan || ""),
    S("F11", req.mataAnggaran || ""),
    S("R31", req.stafTeknik || "IRSAN ANUGRAH"),
  ];
  e.push(CL("D15"));
  for (let r = 16; r <= 22; r++) ["A", "B", "C", "D", "O", "R", "T"].forEach((c) => e.push(CL(`${c}${r}`)));
  let r = 16, no = 1;
  groupsOf(req).forEach((g, gi) => {
    if (gi === 0) e.push(S("D15", g.kapal));
    else { if (r > 22) throw new Error("Item/kapal melebihi kapasitas SPPB (band 16-22). Pecah jadi beberapa pengadaan."); e.push(S(`D${r}`, g.kapal)); r++; }
    for (const it of g.items) {
      if (r > 22) throw new Error("Item/kapal melebihi kapasitas SPPB (band 16-22). Pecah jadi beberapa pengadaan.");
      e.push(N(`A${r}`, no), N(`B${r}`, it.jumlah), S(`C${r}`, it.satuan), S(`D${r}`, it.nama), S(`O${r}`, it.spesifikasi || ""), N(`R${r}`, it.harga), F(`T${r}`, `R${r}*B${r}`));
      no++; r++;
    }
  });
  return e;
}

// ---------- spkh ----------
function spkhEdits(req: NonprRequest): Edit[] {
  const e: Edit[] = [];
  e.push(CL("E19"));
  for (let r = 20; r <= 24; r++) ["B", "C", "D", "E", "G", "H", "I", "J"].forEach((c) => e.push(CL(`${c}${r}`)));
  let r = 20, no = 1, first = 0, last = 0;
  groupsOf(req).forEach((g, gi) => {
    if (gi === 0) e.push(S("E19", g.kapal));
    else { if (r > 24) throw new Error("Item/kapal melebihi kapasitas spkh (band 20-24). Pecah jadi beberapa pengadaan."); e.push(S(`E${r}`, g.kapal)); r++; }
    for (const it of g.items) {
      if (r > 24) throw new Error("Item/kapal melebihi kapasitas spkh (band 20-24). Pecah jadi beberapa pengadaan.");
      const uraian = it.spesifikasi ? `${it.nama} - ${it.spesifikasi}` : it.nama;
      e.push(N(`B${r}`, no), S(`C${r}`, it.satuan), N(`D${r}`, it.jumlah), S(`E${r}`, uraian), N(`G${r}`, it.harga), F(`H${r}`, `G${r}*D${r}`), F(`I${r}`, `+G${r}`), F(`J${r}`, `I${r}*D${r}`));
      if (!first) first = r;
      last = r; no++; r++;
    }
  });
  if (first) { e.push(F("H25", `SUM(H${first}:H${last})`), F("J25", `SUM(J${first}:J${last})`)); }
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
function bstbEdits(req: NonprRequest, kapal: string, jabatan: Jabatan): Edit[] {
  const pen = penerimaBstb(kapal, jabatan);
  const e: Edit[] = [
    S("D6", pen.kepada), S("M6", nomorBPB(req)), S("D8", kapal), S("M8", tanggalIndo(req.tanggal)),
    S("D10", nomorSPPB(req)), S("B14", kapal), S("B32", pen.nama), S("B33", pen.kepada),
  ];
  for (let r = 15; r <= 19; r++) ["A", "B", "G", "H", "I", "K", "O"].forEach((c) => e.push(CL(`${c}${r}`)));
  let r = 15, no = 1;
  for (const it of itemsKapal(req, kapal)) {
    if (r > 19) throw new Error(`Item kapal ${kapal} melebihi kapasitas BSTB (maks 5).`);
    e.push(N(`A${r}`, no), S(`B${r}`, it.nama), S(`G${r}`, it.spesifikasi || ""), S(`H${r}`, it.satuan), N(`I${r}`, it.jumlah), N(`K${r}`, it.harga), S(`O${r}`, "Baik"));
    no++; r++;
  }
  return e;
}

const maxIdx = (zip: PizZip, re: RegExp) =>
  Math.max(0, ...Object.keys(zip.files).map((f) => { const m = f.match(re); return m ? +m[1] : 0; }));

// tambah worksheet baru dari XML (clone BSTB per kapal). Buang ref drawing biar tak butuh rels.
function addSheet(zip: PizZip, xml: string, sheetName: string) {
  const clean = xml.replace(/<drawing[^>]*\/>/g, "").replace(/<legacyDrawing[^>]*\/>/g, "");
  const sN = maxIdx(zip, /worksheets\/sheet(\d+)\.xml$/) + 1;
  zip.file(`xl/worksheets/sheet${sN}.xml`, clean);
  let ct = zip.file("[Content_Types].xml")!.asText();
  ct = ct.replace("</Types>", `<Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" PartName="/xl/worksheets/sheet${sN}.xml"/></Types>`);
  zip.file("[Content_Types].xml", ct);
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

  const d5p = "xl/drawings/drawing5.xml";
  const relsp = "xl/drawings/_rels/drawing5.xml.rels";
  const d5 = zip.file(d5p)!.asText();
  const allAnchors = (d5.match(/<xdr:oneCellAnchor>[\s\S]*?<\/xdr:oneCellAnchor>/g) || []);
  const picTpl = allAnchors.find((a) => a.includes("<xdr:pic>"));
  if (!picTpl) return;
  let body = d5.replace(picTpl, ""); // sisakan shape judul

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
export function fillNonpr(req: NonprRequest): Buffer {
  const zip = openTpl();
  const apply = (sheet: string, edits: Edit[]) => { const p = sheetXmlPath(zip, sheet); zip.file(p, applyEdits(zip.file(p)!.asText(), edits)); };
  apply("SPPB", sppbEdits(req));
  apply("spkh", spkhEdits(req));
  replaceVendor(zip, req);

  const kapals = kapalUnikNonpr(req.items);
  const jab = (k: string): Jabatan => (req.jabatanByKapal?.[k] === "Nakhoda" ? "Nakhoda" : "KKM");
  const bstbPath = sheetXmlPath(zip, "BSTB");
  const origBstb = zip.file(bstbPath)!.asText();
  if (kapals[0]) zip.file(bstbPath, applyEdits(origBstb, bstbEdits(req, kapals[0], jab(kapals[0]))));
  for (let i = 1; i < kapals.length; i++) {
    addSheet(zip, applyEdits(origBstb, bstbEdits(req, kapals[i], jab(kapals[i]))), `BSTB ${kapals[i].replace(/KMP\.?\s*/i, "")}`);
  }
  fillFotoRaw(zip, req);
  return saveZip(zip);
}
