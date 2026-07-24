/**
 * Export Excel PER TIPE anggaran (Rutin / Docking / Persetujuan Lainnya).
 *
 * Susunan berjenjang supaya angka bisa ditelusuri sampai akarnya:
 *
 *   RINGKASAN            per grup (kapal / surat)         --klik--> sheet grup
 *     └ sheet per grup   per Mata Anggaran                --klik--> baris di RINCIAN
 *         └ RINCIAN      per ITEM pengadaan (nama barang, jumlah, harga satuan)
 *
 * Tiap tingkat memakai RUMUS, bukan angka mati:
 *   - Realisasi di sheet grup = SUMIFS ke sheet RINCIAN -> ubah/hapus item, semua ikut berubah
 *   - Ringkasan = SUM baris sheet grup
 *   Jadi angka di puncak selalu bisa dibuktikan oleh baris di bawahnya.
 */
import ExcelJS from "exceljs";

const TEAL = "FF14B8C4";
const ABU = "FFF1F5F9";
const GARIS = "FFCBD5E1";
const MERAH = "FFDC2626";
const KUNING = "FFD97706";
const HIJAU = "FF059669";
const UNGU = "FF6D28D9";
const LANGIT = "FFEFF6FF";

const RP = '#,##0;[Red]-#,##0;"–"';
const RP_ADD = '"+"#,##0;[Red]-#,##0;"–"';
const PCT = "0%";

export interface PosMA {
  ma: string;            // "5010403003 (Kapal Ro-Ro / Penyeberangan)"
  pagu: number;          // Persetujuan Pusat
  addendum: number;
}
export interface GrupAnggaran {
  nama: string;          // "KMP. BARONANG" / nama surat / "Juli 2026"
  pendek: string;        // untuk nama sheet
  noSurat?: string;
  noSuratAddendum?: string;
  pos: PosMA[];
}
export interface ItemRinci {
  grup: string;          // harus sama dgn GrupAnggaran.nama
  ma: string;            // harus sama dgn PosMA.ma
  tanggal: string;
  sumber: string;        // SPPBJ / Non PR PO
  nomor: string;
  pengadaan: string;
  item: string;
  spesifikasi: string;
  jumlah: number;
  satuan: string;
  harga: number;
  nilai: number;
}
export interface DataTipe {
  tipe: "rutin" | "docking" | "lainnya";
  judul: string;         // "Anggaran Docking"
  periode: string;       // "Tahun 2026"
  labelGrup: string;     // "Kapal" / "Surat Persetujuan" / "Periode"
  warna: string;         // ARGB
  dicetak: string;
  grup: GrupAnggaran[];
  rincian: ItemRinci[];
}

const amanSheet = (s: string) => (s || "Sheet").replace(/[\\/*?:\[\]]/g, "-").slice(0, 31);

function kop(ws: ExcelJS.Worksheet, judul: string, sub: string, lebar: number, warna: string) {
  ws.mergeCells(1, 1, 1, lebar);
  const a = ws.getCell(1, 1);
  a.value = "PT ASDP INDONESIA FERRY (PERSERO) — CABANG TERNATE";
  a.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  a.fill = { type: "pattern", pattern: "solid", fgColor: { argb: warna } };
  a.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 22;

  ws.mergeCells(2, 1, 2, lebar);
  const b = ws.getCell(2, 1);
  b.value = judul.toUpperCase();
  b.font = { name: "Calibri", size: 14, bold: true, color: { argb: warna } };
  b.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 26;

  ws.mergeCells(3, 1, 3, lebar);
  const c = ws.getCell(3, 1);
  c.value = sub;
  c.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF64748B" } };
  c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.getRow(3).height = 16;
}

function judulKolom(ws: ExcelJS.Worksheet, baris: number, kolom: string[], warna: string, kiriSampai = 1) {
  const r = ws.getRow(baris);
  kolom.forEach((teks, i) => {
    const c = r.getCell(i + 1);
    c.value = teks;
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: warna } };
    c.alignment = { vertical: "middle", horizontal: i < kiriSampai ? "left" : "center", wrapText: true };
    c.border = { bottom: { style: "medium", color: { argb: warna } } };
  });
  r.height = 32;
}

const gayaAngka = (cell: ExcelJS.Cell, tebal = false) => {
  cell.numFmt = RP;
  cell.alignment = { vertical: "middle", horizontal: "right" };
  cell.font = { name: "Calibri", size: 10, bold: tebal };
};

/** warna status & serapan otomatis (dipakai di sheet grup & ringkasan) */
function warnaStatus(ws: ExcelJS.Worksheet, kolServapan: string, kolStatus: string, r1: number, r2: number, mulaiPrio = 10) {
  if (r2 < r1) return;
  ws.addConditionalFormatting({
    ref: `${kolServapan}${r1}:${kolServapan}${r2}`,
    rules: [
      { type: "cellIs", operator: "greaterThan", formulae: ["1"], priority: mulaiPrio, style: { font: { color: { argb: MERAH }, bold: true }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFEE2E2" } } } } as any,
      { type: "cellIs", operator: "greaterThanOrEqual", formulae: ["0.8"], priority: mulaiPrio + 1, style: { font: { color: { argb: KUNING }, bold: true }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFEF3C7" } } } } as any,
      { type: "cellIs", operator: "lessThan", formulae: ["0.8"], priority: mulaiPrio + 2, style: { font: { color: { argb: HIJAU }, bold: true } } } as any,
    ],
  });
  ws.addConditionalFormatting({
    ref: `${kolStatus}${r1}:${kolStatus}${r2}`,
    rules: [
      { type: "containsText", operator: "containsText", text: "OVERBUDGET", priority: mulaiPrio + 3, style: { font: { color: { argb: "FFFFFFFF" }, bold: true }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: MERAH } } } } as any,
      { type: "containsText", operator: "containsText", text: "WASPADA", priority: mulaiPrio + 4, style: { font: { color: { argb: "FF7C2D12" }, bold: true }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFDE68A" } } } } as any,
      { type: "containsText", operator: "containsText", text: "AMAN", priority: mulaiPrio + 5, style: { font: { color: { argb: "FF065F46" }, bold: true }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFD1FAE5" } } } } as any,
    ],
  });
}

export async function buatExcelTipe(d: DataTipe): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Manajemen Report Teknik ASDP Ternate";
  wb.created = new Date();

  const namaSheet = new Map<string, string>();   // nama grup -> nama sheet
  d.grup.forEach((g, i) => {
    let n = amanSheet(g.pendek || g.nama);
    let k = 2;
    while (Array.from(namaSheet.values()).includes(n)) n = amanSheet(`${g.pendek} ${k++}`);
    namaSheet.set(g.nama, n);
  });

  // =========================================================================
  // 1) SHEET RINCIAN — dibuat DULU supaya nomor barisnya bisa ditautkan
  // =========================================================================
  const wr = wb.addWorksheet("RINCIAN", {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  wr.columns = [
    { width: 18 }, { width: 34 }, { width: 12 }, { width: 11 }, { width: 14 },
    { width: 40 }, { width: 26 }, { width: 7 }, { width: 8 }, { width: 15 }, { width: 16 },
  ];
  kop(wr, `Rincian ${d.judul}`, `${d.periode} · dicetak ${d.dicetak} · setiap baris = 1 item pengadaan. Inilah dasar angka Realisasi di sheet lain.`, 11, TEAL);
  judulKolom(wr, 5, [d.labelGrup, "Mata Anggaran", "Tanggal", "Sumber", "Nomor", "Nama Pengadaan", "Item Barang/Jasa", "Jml", "Sat.", "Harga Satuan", "Nilai"], TEAL, 2);

  // urutkan per grup lalu per MA supaya bisa ditautkan per pos
  const rincian = [...d.rincian].sort((a, b) =>
    a.grup.localeCompare(b.grup) || a.ma.localeCompare(b.ma) || a.tanggal.localeCompare(b.tanggal));

  const barisPos = new Map<string, number>();  // `${grup}|${ma}` -> baris pertama di RINCIAN
  let r = 6;
  rincian.forEach((x, i) => {
    const kunci = `${x.grup}|${x.ma}`;
    if (!barisPos.has(kunci)) barisPos.set(kunci, r);
    const row = wr.getRow(r);
    row.getCell(1).value = x.grup;
    row.getCell(2).value = x.ma;
    row.getCell(3).value = x.tanggal;
    row.getCell(4).value = x.sumber;
    row.getCell(5).value = x.nomor || "–";
    row.getCell(6).value = x.pengadaan;
    row.getCell(7).value = x.item || "–";
    row.getCell(8).value = x.jumlah || null;
    row.getCell(9).value = x.satuan || "";
    row.getCell(10).value = x.harga || null;
    row.getCell(11).value = { formula: `IF(AND(H${r}<>"",J${r}<>""),H${r}*J${r},${Math.round(x.nilai)})` };
    [10, 11].forEach((c) => gayaAngka(row.getCell(c), c === 11));
    [1, 2].forEach((c) => (row.getCell(c).font = { name: "Calibri", size: 9, bold: c === 1 }));
    [3, 4, 5, 8, 9].forEach((c) => (row.getCell(c).alignment = { vertical: "middle", horizontal: "center" }));
    [6, 7].forEach((c) => (row.getCell(c).alignment = { vertical: "middle", wrapText: true }));
    row.font = { name: "Calibri", size: 10 };
    for (let c = 1; c <= 11; c++) {
      const cell = row.getCell(c);
      if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
      cell.border = { bottom: { style: "hair", color: { argb: GARIS } } };
    }
    row.height = 18;
    r++;
  });
  const rAkhirRinci = r - 1;
  if (rincian.length) {
    const t = wr.getRow(r);
    t.getCell(10).value = "TOTAL";
    t.getCell(11).value = { formula: `SUM(K6:K${rAkhirRinci})` };
    gayaAngka(t.getCell(11), true);
    t.getCell(10).alignment = { horizontal: "right" };
    for (let c = 1; c <= 11; c++) {
      t.getCell(c).font = { bold: true, color: { argb: "FFFFFFFF" } };
      t.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    }
    t.height = 22;
    wr.autoFilter = { from: { row: 5, column: 1 }, to: { row: rAkhirRinci, column: 11 } };
  } else {
    wr.getCell(6, 1).value = "Belum ada pengadaan tercatat pada tipe anggaran ini.";
    wr.getCell(6, 1).font = { italic: true, color: { argb: "FF64748B" } };
  }

  // =========================================================================
  // 2) SHEET PER GRUP — per Mata Anggaran, Realisasi = SUMIFS ke RINCIAN
  // =========================================================================
  const ringkasGrup: { nama: string; sheet: string; barisTotal: number }[] = [];

  for (const g of d.grup) {
    const sn = namaSheet.get(g.nama)!;
    const ws = wb.addWorksheet(sn, {
      views: [{ state: "frozen", ySplit: 6 }],
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 } },
    });
    ws.columns = [{ width: 46 }, { width: 18 }, { width: 15 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 11 }, { width: 13 }, { width: 14 }];

    const infoSurat = [g.noSurat ? `No. Surat ${g.noSurat}` : "", g.noSuratAddendum ? `Addendum ${g.noSuratAddendum}` : ""].filter(Boolean).join(" · ");
    kop(ws, g.nama, `${d.judul} · ${d.periode}${infoSurat ? " · " + infoSurat : ""} · Realisasi diambil otomatis (SUMIFS) dari sheet RINCIAN`, 9, d.warna);

    // tautan balik ke ringkasan
    const back = ws.getCell(4, 1);
    back.value = { text: "‹ kembali ke RINGKASAN", hyperlink: "#RINGKASAN!A5" };
    back.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF1D4ED8" }, underline: true };

    judulKolom(ws, 6, ["Mata Anggaran", "Persetujuan Pusat", "Addendum", "Total Persetujuan", "Realisasi", "Sisa", "Terserap", "Status", "Rincian"], d.warna);

    const r0 = 7;
    g.pos.forEach((pos, i) => {
      const rr = r0 + i;
      const row = ws.getRow(rr);
      row.getCell(1).value = pos.ma;
      row.getCell(2).value = pos.pagu;
      row.getCell(3).value = pos.addendum || 0;
      row.getCell(4).value = { formula: `B${rr}+C${rr}` };
      // Realisasi = jumlah nilai item di RINCIAN yang grup & MA-nya cocok
      row.getCell(5).value = rincian.length
        ? { formula: `SUMIFS(RINCIAN!$K$6:$K$${rAkhirRinci},RINCIAN!$A$6:$A$${rAkhirRinci},"${g.nama}",RINCIAN!$B$6:$B$${rAkhirRinci},$A${rr})` }
        : 0;
      row.getCell(6).value = { formula: `D${rr}-E${rr}` };
      row.getCell(7).value = { formula: `IF(D${rr}=0,0,E${rr}/D${rr})` };
      row.getCell(8).value = { formula: `IF(D${rr}=0,"–",IF(G${rr}>1,"OVERBUDGET",IF(G${rr}>=0.8,"WASPADA","AMAN")))` };

      const barisTuju = barisPos.get(`${g.nama}|${pos.ma}`);
      const link = row.getCell(9);
      if (barisTuju) {
        link.value = { text: "lihat item →", hyperlink: `#RINCIAN!A${barisTuju}` };
        link.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF1D4ED8" }, underline: true };
      } else {
        link.value = "—";
        link.font = { name: "Calibri", size: 9, color: { argb: "FF94A3B8" } };
      }
      link.alignment = { vertical: "middle", horizontal: "center" };

      row.getCell(1).font = { name: "Calibri", size: 10, bold: true };
      row.getCell(1).alignment = { vertical: "middle", wrapText: true };
      for (let c = 2; c <= 6; c++) gayaAngka(row.getCell(c), c === 5);
      row.getCell(3).numFmt = RP_ADD;
      row.getCell(3).font = { name: "Calibri", size: 10, bold: true, color: { argb: UNGU } };
      row.getCell(7).numFmt = PCT;
      row.getCell(7).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(7).font = { bold: true };
      row.getCell(8).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(8).font = { name: "Calibri", size: 9, bold: true };
      row.height = 22;
      for (let c = 1; c <= 9; c++) {
        const cell = row.getCell(c);
        if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
        cell.border = { bottom: { style: "hair", color: { argb: GARIS } } };
      }
    });

    const rT = r0 + g.pos.length;
    const t = ws.getRow(rT);
    t.getCell(1).value = "TOTAL";
    (["B", "C", "D", "E", "F"] as const).forEach((col, i) => {
      const c = i + 2;
      t.getCell(c).value = { formula: `SUM(${col}${r0}:${col}${rT - 1})` };
      gayaAngka(t.getCell(c), true);
    });
    t.getCell(3).numFmt = RP_ADD;
    t.getCell(7).value = { formula: `IF(D${rT}=0,0,E${rT}/D${rT})` };
    t.getCell(7).numFmt = PCT;
    t.getCell(7).alignment = { horizontal: "center" };
    for (let c = 1; c <= 9; c++) {
      t.getCell(c).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      t.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: d.warna } };
    }
    t.height = 24;

    if (g.pos.length) {
      ws.addConditionalFormatting({ ref: `E${r0}:E${rT - 1}`, rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], color: { argb: TEAL } } as any] });
      warnaStatus(ws, "G", "H", r0, rT - 1, 2);
    }
    ringkasGrup.push({ nama: g.nama, sheet: sn, barisTotal: rT });
  }

  // =========================================================================
  // 3) SHEET RINGKASAN — per grup, angkanya menunjuk baris TOTAL sheet grup
  // =========================================================================
  const ws = wb.addWorksheet("RINGKASAN", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  ws.columns = [{ width: 30 }, { width: 26 }, { width: 18 }, { width: 15 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 11 }, { width: 13 }];
  kop(ws, d.judul, `${d.periode} · dicetak ${d.dicetak} · klik nama ${d.labelGrup.toLowerCase()} untuk membuka rinciannya`, 9, d.warna);
  judulKolom(ws, 6, [d.labelGrup, "Keterangan Surat", "Persetujuan Pusat", "Addendum", "Total Persetujuan", "Realisasi", "Sisa", "Terserap", "Status"], d.warna, 2);

  const g0 = 7;
  d.grup.forEach((g, i) => {
    const rr = g0 + i;
    const info = ringkasGrup[i];
    const row = ws.getRow(rr);
    const sheetRef = `'${info.sheet}'`;
    row.getCell(1).value = { text: g.nama, hyperlink: `#${sheetRef}!A6` };
    row.getCell(1).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF1D4ED8" }, underline: true };
    row.getCell(2).value = [g.noSurat ? `No. ${g.noSurat}` : "", g.noSuratAddendum ? `Add. ${g.noSuratAddendum}` : ""].filter(Boolean).join(" · ") || "–";
    row.getCell(2).font = { name: "Calibri", size: 9, color: { argb: "FF475569" } };
    row.getCell(2).alignment = { vertical: "middle", wrapText: true };
    // tarik langsung dari baris TOTAL sheet grup -> tak mungkin beda dengan detailnya
    row.getCell(3).value = { formula: `${sheetRef}!B${info.barisTotal}` };
    row.getCell(4).value = { formula: `${sheetRef}!C${info.barisTotal}` };
    row.getCell(5).value = { formula: `${sheetRef}!D${info.barisTotal}` };
    row.getCell(6).value = { formula: `${sheetRef}!E${info.barisTotal}` };
    row.getCell(7).value = { formula: `E${rr}-F${rr}` };
    row.getCell(8).value = { formula: `IF(E${rr}=0,0,F${rr}/E${rr})` };
    row.getCell(9).value = { formula: `IF(E${rr}=0,"–",IF(H${rr}>1,"OVERBUDGET",IF(H${rr}>=0.8,"WASPADA","AMAN")))` };
    for (let c = 3; c <= 7; c++) gayaAngka(row.getCell(c), c === 6);
    row.getCell(4).numFmt = RP_ADD;
    row.getCell(4).font = { name: "Calibri", size: 10, bold: true, color: { argb: UNGU } };
    row.getCell(8).numFmt = PCT;
    row.getCell(8).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(8).font = { bold: true };
    row.getCell(9).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(9).font = { name: "Calibri", size: 9, bold: true };
    row.height = 24;
    for (let c = 1; c <= 9; c++) {
      const cell = row.getCell(c);
      if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
      cell.border = { bottom: { style: "hair", color: { argb: GARIS } } };
    }
  });

  const gT = g0 + d.grup.length;
  const tt = ws.getRow(gT);
  tt.getCell(1).value = "TOTAL";
  (["C", "D", "E", "F", "G"] as const).forEach((col, i) => {
    const c = i + 3;
    tt.getCell(c).value = { formula: `SUM(${col}${g0}:${col}${gT - 1})` };
    gayaAngka(tt.getCell(c), true);
  });
  tt.getCell(4).numFmt = RP_ADD;
  tt.getCell(8).value = { formula: `IF(E${gT}=0,0,F${gT}/E${gT})` };
  tt.getCell(8).numFmt = PCT;
  tt.getCell(8).alignment = { horizontal: "center" };
  for (let c = 1; c <= 9; c++) {
    tt.getCell(c).font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    tt.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: d.warna } };
  }
  tt.height = 26;
  if (d.grup.length) {
    ws.addConditionalFormatting({ ref: `F${g0}:F${gT - 1}`, rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], color: { argb: TEAL } } as any] });
    warnaStatus(ws, "H", "I", g0, gT - 1, 2);
  }

  // panduan telusur
  const rN = gT + 2;
  ws.mergeCells(rN, 1, rN + 1, 9);
  const n = ws.getCell(rN, 1);
  n.value =
    `CARA MENELUSURI ANGKA:  RINGKASAN (per ${d.labelGrup.toLowerCase()})  →  klik nama untuk membuka sheet-nya (per Mata Anggaran)  →  klik "lihat item →" untuk melompat ke sheet RINCIAN (per item pengadaan: nama barang, jumlah, harga satuan).\n` +
    `Angka Realisasi tiap Mata Anggaran = SUMIFS dari sheet RINCIAN, dan angka di RINGKASAN menunjuk baris TOTAL sheet grup — jadi bila satu item diubah/dihapus, seluruh tingkat ikut menyesuaikan dan tak mungkin berbeda.`;
  n.font = { name: "Calibri", size: 9, color: { argb: "FF1E3A8A" } };
  n.alignment = { wrapText: true, vertical: "top" };
  n.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LANGIT } };
  ws.getRow(rN).height = 30;
  ws.getRow(rN + 1).height = 24;

  // urutan tab: RINGKASAN dulu, sheet grup, RINCIAN paling belakang
  const urut = ["RINGKASAN", ...ringkasGrup.map((x) => x.sheet), "RINCIAN"];
  urut.forEach((nm, i) => { const sh: any = wb.getWorksheet(nm); if (sh) sh.orderNo = i + 1; });
  wb.views = [{ activeTab: 0, x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, visibility: "visible" }];

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
