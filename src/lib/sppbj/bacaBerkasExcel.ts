/**
 * Bongkar berkas .xlsx/.xlsm menjadi BarisLembar, bentuk yang sama dengan
 * kiriman makro. Hanya untuk sisi server: nilai rumus diambil dari hasil yang
 * tersimpan di berkas, jadi berkasnya harus sudah pernah disimpan Excel.
 */
import ExcelJS from "exceljs";
import PizZip from "pizzip";
import { adalahSppbj } from "./dariExcel";
import type { BarisLembar, LembarExcel } from "./dariExcel";

const KOLOM_MAKS = 16;
const BARIS_MAKS = 400;
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus",
  "September", "Oktober", "November", "Desember"];

function isiSel(v: any): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return null;
  if (v instanceof Date) return `${v.getUTCDate()} ${BULAN[v.getUTCMonth()]} ${v.getUTCFullYear()}`;
  if (Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join("");
  if ("result" in v) return isiSel(v.result);
  if ("formula" in v || "sharedFormula" in v) return null;
  if ("text" in v) return isiSel(v.text);
  return null;
}

function tebal(sel: ExcelJS.Cell): boolean {
  if (sel.font?.bold) return true;
  const v: any = sel.value;
  return !!(v && Array.isArray(v.richText) && v.richText.some((t: any) => t.font?.bold));
}

/*
 * Gambar dan tombol tidak dibaca, jadi isinya dikosongkan sebelum ExcelJS memuat
 * berkas. ExcelJS gagal dengan "reading 'anchors'" pada bagian gambar yang tidak
 * ditulis persis seperti Excel, misalnya hasil pustaka lain. Rujukan ke bagian itu
 * dibiarkan karena ExcelJS mencarinya lewat relasi lembar.
 */
const GAMBAR_KOSONG = '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"/>';

function tanpaGambar(data: ArrayBuffer): ArrayBuffer {
  const zip = new PizZip(data);
  for (const nama of Object.keys(zip.files)) {
    if (/^xl\/drawings\/[^/]+\.xml$/.test(nama)) zip.file(nama, GAMBAR_KOSONG);
  }
  return zip.generate({ type: "arraybuffer" });
}

export async function bacaBerkasExcel(data: ArrayBuffer, berkas: string): Promise<LembarExcel[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(tanpaGambar(data) as any);
  const hasil: LembarExcel[] = [];
  for (const ws of wb.worksheets) {
    if (ws.state && ws.state !== "visible") continue;
    const baris: BarisLembar[] = [];
    const akhir = Math.min(ws.rowCount, BARIS_MAKS);
    for (let n = 1; n <= akhir; n++) {
      const r = ws.getRow(n);
      if (r.hidden) continue;
      const s: BarisLembar["s"] = {};
      let b = "";
      for (let c = 1; c <= KOLOM_MAKS; c++) {
        const sel = r.getCell(c);
        if (sel.type === ExcelJS.ValueType.Merge) continue;
        const isi = isiSel(sel.value);
        if (isi === null || isi === "") continue;
        const k = String.fromCharCode(64 + c);
        s[k] = isi;
        if (tebal(sel)) b += k;
      }
      if (!Object.keys(s).length) continue;
      if (Object.values(s).some((v) => /kerangka acuan kerja/i.test(String(v)))) break;
      baris.push({ n, s, b });
    }
    const lembar: LembarExcel = { nama: ws.name, berkas, baris };
    if (adalahSppbj(lembar)) hasil.push(lembar);
  }
  return hasil;
}
