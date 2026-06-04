import path from "path";
import ExcelJS from "exceljs";
import { MaterialRequest, MaterialItem, itemKategori, itemPOText } from "./types";
import { KAPAL_DB, kapalKode, kapalCostCenter, descByKode } from "./db";
import { bulanTahun, bulanRomawi, rupiah, terbilangRupiah } from "@/lib/format";

const tpl = (n: string) => path.join(process.cwd(), "templates", "material", n);

async function load(name: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tpl(name));
  return wb;
}
async function out(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const set = (ws: ExcelJS.Worksheet, addr: string, v: any) => { ws.getCell(addr).value = v; };
const ddmmyyyy = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

// replace teks di cell string ATAU richText (multi-run)
function replaceRich(cell: ExcelJS.Cell, pairs: [RegExp, string][]) {
  const v: any = cell.value;
  if (typeof v === "string") {
    let s = v; pairs.forEach(([re, r]) => (s = s.replace(re, r))); cell.value = s;
  } else if (v && v.richText) {
    v.richText.forEach((run: any) => pairs.forEach(([re, r]) => (run.text = run.text.replace(re, r))));
    cell.value = { richText: v.richText };
  }
}

function applyFit(ws: ExcelJS.Worksheet, fitH = 0) {
  ws.pageSetup = { ...ws.pageSetup, fitToPage: true, fitToWidth: 1, fitToHeight: fitH, horizontalCentered: true };
}

// urutan kapal: SEMUA KAPAL dulu, lalu sesuai KAPAL_DB; hanya yang punya item
function kapalGroups(items: MaterialItem[]): { kapal: string; items: MaterialItem[] }[] {
  const order = KAPAL_DB.map((k) => k.nama);
  const groups: { kapal: string; items: MaterialItem[] }[] = [];
  for (const nama of order) {
    const its = items.filter((i) => i.kapal === nama);
    if (its.length) groups.push({ kapal: nama, items: its });
  }
  return groups;
}

// ---------- 1. Template Pendaftaran Material (SAP) ----------
export async function fillPendaftaran(req: MaterialRequest): Promise<Buffer> {
  const wb = await load("1_pendaftaran.xlsx");
  const ws = wb.getWorksheet("Template Material")!;
  const COLS = ["A", "E", "F", "G", "H", "I", "J", "N", "O", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB"];
  const styleItem: Record<string, any> = {};
  const styleHead = ws.getCell("J12").style; // header kapal
  const styleMesin = ws.getCell("F26").style; // sub-header nama mesin
  COLS.forEach((c) => (styleItem[c] = ws.getCell(`${c}13`).style));

  // bersihkan area data lama (row 12..400)
  for (let r = 12; r <= 400; r++) {
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").concat(["AA", "AB"]).forEach((c) => { ws.getCell(`${c}${r}`).value = null; });
  }

  let r = 12;
  const writeItem = (it: MaterialItem, kapal: string) => {
    const row: Record<string, any> = {
      A: "Create Code Material", E: it.partNumber || "", F: it.nama, G: it.satuan, H: "PC",
      I: it.kode, J: itemPOText(it), N: "520", O: kapalKode(kapal), T: "520",
      U: "001", V: "", W: "C", X: "2", Y: "2002", Z: "V", AA: "1", AB: it.harga,
    };
    COLS.forEach((c) => { const cell = ws.getCell(`${c}${r}`); cell.value = row[c]; cell.style = styleItem[c]; });
    r++;
  };

  for (const g of kapalGroups(req.items)) {
    ws.getCell(`J${r}`).value = g.kapal; ws.getCell(`J${r}`).style = styleHead; r++;

    const sc = g.items.filter((i) => itemKategori(i) === "SC");
    const umum = g.items.filter((i) => itemKategori(i) === "UMUM");

    // suku cadang: dikelompokkan per nama mesin (sub-header) urut kemunculan
    const order: string[] = [];
    const byMesin: Record<string, MaterialItem[]> = {};
    for (const it of sc) {
      const key = it.namaMesin?.trim() || "(Tanpa Mesin)";
      if (!byMesin[key]) { byMesin[key] = []; order.push(key); }
      byMesin[key].push(it);
    }
    for (const mesin of order) {
      if (mesin !== "(Tanpa Mesin)") { ws.getCell(`F${r}`).value = mesin; ws.getCell(`F${r}`).style = styleMesin; r++; }
      byMesin[mesin].forEach((it) => writeItem(it, g.kapal));
    }
    // barang umum: tanpa sub-header mesin
    umum.forEach((it) => writeItem(it, g.kapal));
  }
  return out(wb);
}

// ---------- 2. Formulir Permintaan Master Data ----------
export async function fillFormulir(req: MaterialRequest): Promise<Buffer> {
  const wb = await load("2_formulir.xlsx");
  const ws = wb.getWorksheet("Form")!;
  set(ws, "D9", `${req.judulFormulir} ${bulanTahun(req.tanggal)}`);
  const ccs = Array.from(new Set(req.items.map((i) => kapalCostCenter(i.kapal)).filter(Boolean)));
  set(ws, "D10", ccs.join(", "));
  set(ws, "H17", `Ternate, ${ddmmyyyy(req.tanggal)}`);
  set(ws, "B23", req.deptHead);
  set(ws, "G23", req.stafTeknik);
  return out(wb);
}

// isi baris penawaran generik (kembalikan total nilai)
function fillPenawaranRows(ws: ExcelJS.Worksheet, items: MaterialItem[], firstRow: number, lastRow: number, specFn?: (it: MaterialItem) => string) {
  const styleByCol: Record<string, any> = {};
  ["B", "C", "D", "E", "F", "G", "H"].forEach((c) => (styleByCol[c] = ws.getCell(`${c}${firstRow}`).style));
  const spec = specFn ?? ((it: MaterialItem) => it.spesifikasi || "");
  let total = 0;
  for (let i = 0; i < lastRow - firstRow + 1; i++) {
    const r = firstRow + i;
    const it = items[i];
    const map: Record<string, any> = it
      ? { B: i + 1, C: it.qty, D: it.satuan, E: it.nama, F: spec(it), G: it.harga, H: { formula: `G${r}*C${r}` } }
      : { B: null, C: null, D: null, E: null, F: null, G: null, H: null };
    ["B", "C", "D", "E", "F", "G", "H"].forEach((c) => { const cell = ws.getCell(`${c}${r}`); cell.value = map[c]; if (it) cell.style = styleByCol[c]; });
    if (it) total += it.harga * it.qty;
  }
  return total;
}

// ---------- 3. Penawaran Suku Cadang ----------
export async function fillPenawaranSC(req: MaterialRequest): Promise<Buffer> {
  const wb = await load("3_penawaran_sc.xlsx");
  const ws = wb.getWorksheet("Table 1")!;
  const items = req.items.filter((i) => itemKategori(i) === "SC");
  // No surat di blok B2
  const noBaru = `CTT/E/${req.noPenawaran}/${bulanRomawi(req.tanggal)}/${req.tanggal.slice(0, 4)}`;
  replaceRich(ws.getCell("B2"), [
    [/CTT\/E\/[^\n\/]*\/[IVX]+\/\d{4}/g, noBaru],
    [/Pengadaan Suku Cadang KMP\.[^\n]*?Tahun \d{4}/g, `${req.judulSC} ${bulanTahun(req.tanggal)}`],
  ]);
  // kolom Spesifikasi = part number item suku cadang
  fillPenawaranRows(ws, items, 4, 15, (it) => it.partNumber || "");
  applyFit(ws, 1);
  return out(wb);
}

// ---------- 4. Penawaran Barang Umum ----------
export async function fillPenawaranUmum(req: MaterialRequest): Promise<Buffer> {
  const wb = await load("4_penawaran_umum.xlsx");
  const ws = wb.getWorksheet("Table 1")!;
  const items = req.items.filter((i) => itemKategori(i) === "UMUM");
  set(ws, "E2", `${req.judulUmum} ${bulanTahun(req.tanggal)}`);
  const total = fillPenawaranRows(ws, items, 6, 31);
  const grand = Math.round(total * 1.11);
  set(ws, "B35", `Terbilang :\n${terbilangRupiah(grand).toUpperCase()}`);
  replaceRich(ws.getCell("A36"), [[/Ternate,[^\n]*/, `Ternate, ${ddmmyyyy(req.tanggal)}`]]);
  applyFit(ws, 1);
  return out(wb);
}

export const MATERIAL_FILLERS: Record<string, (r: MaterialRequest) => Promise<Buffer>> = {
  pendaftaran: fillPendaftaran,
  formulir: fillFormulir,
  penawaran_sc: fillPenawaranSC,
  penawaran_umum: fillPenawaranUmum,
};

export const MATERIAL_META: Record<string, { label: string }> = {
  pendaftaran: { label: "01. Template Pendaftaran Material SAP" },
  formulir: { label: "02. Formulir Permintaan Master Data" },
  penawaran_sc: { label: "03. Penawaran Suku Cadang" },
  penawaran_umum: { label: "04. Penawaran Barang Umum" },
};
