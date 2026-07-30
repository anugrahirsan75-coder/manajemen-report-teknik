"use client";
/**
 * Export Excel Rencana RKA — meniru layout berkas pusat:
 *   1. REKAPITULASI : baris = kelompok biaya (dengan kode M.A. akuntansi lama),
 *      kolom = 13 kapal + JUMLAH.
 *   2. Satu sheet per kapal: baris = kelompok, kolom = JAN..DES.
 *      Kelompok non-docking disebar rata 12 bulan; kelompok docking ditaruh
 *      di bulan rencana docking kapal itu (belum dipilih -> Desember).
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { RkaKapal, KELOMPOK_RKA, totalRka } from "./types";

const BLN = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
const tipis = { style: "thin" as const };
const border = { top: tipis, bottom: tipis, left: tipis, right: tipis };
const uang = "#,##0";

export async function exportRkaExcel(tahun: number, list: RkaKapal[]) {
  const wb = new ExcelJS.Workbook();
  const data = list.filter((d) => d.tahun === tahun).sort((a, b) => a.kapal.localeCompare(b.kapal));

  // ============ 1. REKAPITULASI ============
  const rk = wb.addWorksheet("REKAPITULASI", { views: [{ state: "frozen", xSplit: 2, ySplit: 4 }] });
  rk.getCell("A1").value = "REKAPITULASI RENCANA KERJA ANGGARAN PEMELIHARAAN KAPAL — CABANG TERNATE";
  rk.getCell("A2").value = `TAHUN ${tahun} (USULAN)`;
  ["A1", "A2"].forEach((c) => (rk.getCell(c).font = { bold: true, size: 12 }));
  const kepala = ["M.A.", "URAIAN", ...data.map((d) => d.kapal), "JUMLAH"];
  const rHead = rk.getRow(4);
  kepala.forEach((v, i) => {
    const c = rHead.getCell(i + 1);
    c.value = v; c.font = { bold: true }; c.border = border; c.alignment = { horizontal: "center", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };
  });
  rk.getColumn(1).width = 16; rk.getColumn(2).width = 38;
  data.forEach((_, i) => (rk.getColumn(i + 3).width = 16));
  rk.getColumn(data.length + 3).width = 18;

  let r = 5;
  for (const k of KELOMPOK_RKA) {
    const row = rk.getRow(r++);
    row.getCell(1).value = k.maLama;
    row.getCell(2).value = k.label;
    let jml = 0;
    data.forEach((d, i) => {
      const v = d.nilai?.[k.key] || 0; jml += v;
      const c = row.getCell(i + 3); c.value = v || null; c.numFmt = uang; c.border = border;
    });
    const cj = row.getCell(data.length + 3); cj.value = jml || null; cj.numFmt = uang; cj.font = { bold: true }; cj.border = border;
    row.getCell(1).border = border; row.getCell(2).border = border;
  }
  const tot = rk.getRow(r);
  tot.getCell(2).value = "TOTAL ANGGARAN BIAYA";
  let besar = 0;
  data.forEach((d, i) => {
    const v = totalRka(d); besar += v;
    const c = tot.getCell(i + 3); c.value = v; c.numFmt = uang; c.font = { bold: true }; c.border = border;
  });
  const cb = tot.getCell(data.length + 3); cb.value = besar; cb.numFmt = uang; cb.font = { bold: true }; cb.border = border;
  tot.getCell(2).font = { bold: true };
  tot.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } }));

  // ============ 2. sheet per kapal ============
  for (const d of data) {
    const ws = wb.addWorksheet(d.kapal.replace(/[\\/?*\[\]:]/g, "").slice(0, 28), { views: [{ state: "frozen", xSplit: 2, ySplit: 4 }] });
    ws.getCell("A1").value = `RENCANA KERJA ANGGARAN PEMELIHARAAN — ${d.kapal}`;
    ws.getCell("A2").value = `TAHUN ${tahun} (USULAN)${d.bulanDocking ? ` · rencana docking: ${BLN[d.bulanDocking - 1]}` : ""}`;
    ["A1", "A2"].forEach((c) => (ws.getCell(c).font = { bold: true, size: 12 }));
    const hd = ws.getRow(4);
    ["M.A.", "URAIAN", ...BLN, "JUMLAH"].forEach((v, i) => {
      const c = hd.getCell(i + 1);
      c.value = v; c.font = { bold: true }; c.border = border; c.alignment = { horizontal: "center" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };
    });
    ws.getColumn(1).width = 16; ws.getColumn(2).width = 38;
    for (let i = 0; i < 13; i++) ws.getColumn(i + 3).width = 14;

    const bulanDock = (d.bulanDocking && d.bulanDocking >= 1 && d.bulanDocking <= 12 ? d.bulanDocking : 12) - 1;
    let rr = 5;
    for (const k of KELOMPOK_RKA) {
      const v = d.nilai?.[k.key] || 0;
      const row = ws.getRow(rr++);
      row.getCell(1).value = k.maLama; row.getCell(2).value = k.label;
      row.getCell(1).border = border; row.getCell(2).border = border;
      for (let b = 0; b < 12; b++) {
        const c = row.getCell(b + 3);
        // docking jatuh di bulan docking; rutin disebar rata (sisa pembulatan ke Desember)
        const isi = !v ? 0
          : k.ikutDocking ? (b === bulanDock ? v : 0)
          : b < 11 ? Math.floor(v / 12) : v - Math.floor(v / 12) * 11;
        c.value = isi || null; c.numFmt = uang; c.border = border;
      }
      const cj = row.getCell(15); cj.value = v || null; cj.numFmt = uang; cj.font = { bold: true }; cj.border = border;
    }
    const tr = ws.getRow(rr);
    tr.getCell(2).value = "TOTAL"; tr.getCell(2).font = { bold: true };
    const HURUF = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];
    for (let b = 0; b < 12; b++) {
      const c = tr.getCell(b + 3);
      c.value = { formula: `SUM(${HURUF[b]}5:${HURUF[b]}${rr - 1})` };
      c.numFmt = uang; c.font = { bold: true }; c.border = border;
    }
    const tj = tr.getCell(15); tj.value = totalRka(d); tj.numFmt = uang; tj.font = { bold: true }; tj.border = border;
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `Rencana RKA ${tahun} — Kapal Ternate.xlsx`);
}
