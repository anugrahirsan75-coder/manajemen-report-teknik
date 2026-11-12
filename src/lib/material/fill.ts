import path from "path";
import ExcelJS from "exceljs";
import { bubuhiFormulir } from "./ttd";
import { MaterialRequest, MaterialItem, itemKategori, itemPOText } from "./types";
import { KAPAL_DB, kapalByNama, kapalKode, kapalCostCenter, descByKode } from "./db";
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

/**
 * Kelompokkan item per kapal, urut KAPAL_DB lalu kapal lain menurut kemunculan.
 *
 * Nama kapal dicocokkan LONGGAR lewat kapalByNama (titik, huruf besar-kecil,
 * dan spasi diabaikan). Dulu dicocokkan huruf per huruf: item hasil tempel dari
 * Excel bertuliskan "KMP PORTLINK VIII" atau "KMP. Portlink VIII " tidak sama
 * dengan "KMP. PORTLINK VIII" di daftar, sehingga seluruh itemnya terbuang dan
 * Template Pendaftaran Material keluar kosong tanpa peringatan apa pun.
 *
 * Item yang kapalnya tidak dikenal tidak pernah dibuang — dikelompokkan di
 * belakang dengan nama apa adanya, supaya tetap terlihat dan bisa diperbaiki.
 */
function kelompokKapal(items: MaterialItem[], kosong: string): { kapal: string; items: MaterialItem[] }[] {
  const urut = KAPAL_DB.map((k) => k.nama);
  const peta = new Map<string, MaterialItem[]>();
  for (const it of items) {
    const nama = kapalByNama(it.kapal)?.nama || (it.kapal || "").trim() || kosong;
    peta.set(nama, [...(peta.get(nama) || []), it]);
  }
  const posisi = (n: string) => { const i = urut.indexOf(n); return i < 0 ? urut.length : i; };
  return Array.from(peta.keys())
    .sort((a, b) => posisi(a) - posisi(b))
    .map((kapal) => ({ kapal, items: peta.get(kapal)! }));
}

// Template Pendaftaran: item tanpa kapal masuk "SEMUA KAPAL" seperti isian bawaannya
const kapalGroups = (items: MaterialItem[]) => kelompokKapal(items, "SEMUA KAPAL");

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
  // tanda tangan dibubuhkan hanya bila diminta; tanpa itu dokumen terbit
  // dengan ruang tanda tangan kosong seperti sebelumnya
  if (req.bubuhiTtd) await bubuhiFormulir(wb, ws);
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

// urutan kapal utk SC: KAPAL_DB dulu, lalu kapal lain yg muncul (tak hilang)
const scGroups = (items: MaterialItem[]) => kelompokKapal(items, "(Tanpa Kapal)");

// ---------- 3. Penawaran Suku Cadang ----------
// Dikelompokkan per KAPAL (header) + per MESIN (sub-header) + spasi 1 baris antar kapal,
// nomor item berurutan menerus. Total/PPn/Grand & penutup digeser mengikuti jumlah baris.
export async function fillPenawaranSC(req: MaterialRequest): Promise<Buffer> {
  const wb = await load("3_penawaran_sc.xlsx");
  const ws = wb.getWorksheet("Table 1")!;
  const items = req.items.filter((i) => itemKategori(i) === "SC");
  const noBaru = `CTT/E/${req.noPenawaran}/${bulanRomawi(req.tanggal)}/${req.tanggal.slice(0, 4)}`;
  replaceRich(ws.getCell("B2"), [
    [/CTT\/E\/[^\n\/]*\/[IVX]+\/\d{4}/g, noBaru],
    [/Pengadaan Suku Cadang KMP\.[^\n]*?Tahun \d{4}/g, `${req.judulSC} ${bulanTahun(req.tanggal)}`],
  ]);

  const COLS = ["B", "C", "D", "E", "F", "G", "H", "I"];
  const FIRST = 4;
  // tangkap style template SEBELUM diutak-atik
  const itemStyle: Record<string, any> = {};
  COLS.forEach((c) => (itemStyle[c] = ws.getCell(`${c}${FIRST}`).style));
  const styG = ws.getCell("G19").style;   // label total
  const styH = ws.getCell("H19").style;   // nilai total (H:I)
  const closeVal = ws.getCell("A22").value;
  const closeStyle = ws.getCell("A22").style;

  // lepas semua merge baris >=3 (kecuali header surat A1/B2), lalu kosongkan area
  for (const range of [...(ws.model.merges || [])]) {
    const top = parseInt(range.split(":")[0].replace(/[A-Z]+/, ""), 10);
    if (top >= 3 && range !== "B2") { try { ws.unMergeCells(range); } catch {} }
  }
  for (let r = FIRST; r <= 60; r++) {
    "ABCDEFGHI".split("").forEach((c) => { ws.getCell(`${c}${r}`).value = null; });
  }

  const styleRow = (r: number, extra?: (c: string, cell: ExcelJS.Cell) => void) =>
    COLS.forEach((c) => { const cell = ws.getCell(`${c}${r}`); cell.style = { ...itemStyle[c] }; extra?.(c, cell); });
  const mergeHI = (r: number) => { try { ws.mergeCells(`H${r}:I${r}`); } catch {} };

  let r = FIRST, no = 1, firstItem = 0, lastItem = 0;
  const groups = scGroups(items);
  groups.forEach((g, gi) => {
    // header KAPAL (B:I merged, bold, fill kuning muda)
    styleRow(r, (c, cell) => {
      cell.font = { ...(itemStyle[c].font || {}), bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
    });
    ws.getCell(`B${r}`).value = g.kapal;
    try { ws.mergeCells(`B${r}:I${r}`); } catch {}
    r++;

    // kelompok per mesin (sub-header) urut kemunculan
    const order: string[] = [];
    const byMesin: Record<string, MaterialItem[]> = {};
    for (const it of g.items) {
      const key = it.namaMesin?.trim() || "(Tanpa Mesin)";
      if (!byMesin[key]) { byMesin[key] = []; order.push(key); }
      byMesin[key].push(it);
    }
    for (const mesin of order) {
      if (mesin !== "(Tanpa Mesin)") {
        styleRow(r, (c, cell) => { if (c === "E") cell.font = { ...(itemStyle.E.font || {}), bold: true, italic: true }; });
        ws.getCell(`E${r}`).value = mesin;
        r++;
      }
      for (const it of byMesin[mesin]) {
        styleRow(r);
        ws.getCell(`B${r}`).value = no;
        ws.getCell(`C${r}`).value = it.qty;
        ws.getCell(`D${r}`).value = it.satuan;
        ws.getCell(`E${r}`).value = it.nama;
        ws.getCell(`F${r}`).value = it.partNumber || "";
        ws.getCell(`G${r}`).value = it.harga;
        ws.getCell(`H${r}`).value = { formula: `G${r}*C${r}` };
        mergeHI(r);
        if (!firstItem) firstItem = r;
        lastItem = r;
        no++; r++;
      }
    }
    if (gi < groups.length - 1) r++; // spasi 1 baris antar kapal
  });

  // blok Total / PPn / Grand Total (geser mengikuti) + penutup
  r++; // 1 baris jarak sebelum total
  const sumRange = firstItem ? `SUM(H${firstItem}:H${lastItem})` : "0";
  const totalRow = r;
  ws.getCell(`G${r}`).style = styG; ws.getCell(`G${r}`).value = "Total";
  ws.getCell(`H${r}`).style = styH; ws.getCell(`H${r}`).value = { formula: sumRange }; mergeHI(r); r++;
  const pphRow = r;
  ws.getCell(`G${r}`).style = styG; ws.getCell(`G${r}`).value = "PPn 11%";
  ws.getCell(`H${r}`).style = styH; ws.getCell(`H${r}`).value = { formula: `11%*H${totalRow}` }; mergeHI(r); r++;
  ws.getCell(`G${r}`).style = styG; ws.getCell(`G${r}`).value = "Grand Total";
  ws.getCell(`H${r}`).style = styH; ws.getCell(`H${r}`).value = { formula: `H${totalRow}+H${pphRow}` }; mergeHI(r); r++;

  r++; // jarak sebelum penutup
  ws.getCell(`A${r}`).value = closeVal as any;
  ws.getCell(`A${r}`).style = closeStyle;
  try { ws.mergeCells(`A${r}:I${r}`); } catch {}

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
