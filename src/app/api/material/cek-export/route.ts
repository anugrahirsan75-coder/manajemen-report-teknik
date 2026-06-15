import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

interface Row { no: number; nama: string; part: string; kategori: string; kode: string; desc: string; po: string; status: string; lainnya: string }

const STATUS_FILL: Record<string, string> = { ada: "FFD1FAE5", cek: "FFFEF3C7", "tidak ada": "FFFEE2E2" };

export async function POST(req: NextRequest) {
  try {
    const { rows } = (await req.json()) as { rows: Row[] };
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Cek Kode Material", { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });

    const COLS = [
      { h: "No", w: 5 }, { h: "Nama Barang", w: 28 }, { h: "Part Number", w: 18 }, { h: "Kategori", w: 10 },
      { h: "Kode Material", w: 16 }, { h: "Material Description", w: 30 }, { h: "Purchase Order Text", w: 30 },
      { h: "Status", w: 12 }, { h: "Kode/Deskripsi Lainnya", w: 30 },
    ];
    COLS.forEach((c, i) => (ws.getColumn(i + 1).width = c.w));

    ws.mergeCells("A1:I1");
    const t = ws.getCell("A1");
    t.value = "CEK KODE MATERIAL — PT. ASDP INDONESIA FERRY (PERSERO) CABANG TERNATE";
    t.font = { bold: true, size: 13, color: { argb: "FF16357F" } };
    t.alignment = { horizontal: "center" };
    ws.getRow(1).height = 24;
    ws.mergeCells("A2:I2");
    const sub = ws.getCell("A2");
    sub.value = `Dicetak ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} · ${rows.length} item`;
    sub.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
    sub.alignment = { horizontal: "center" };

    const hr = ws.getRow(4);
    COLS.forEach((c, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = c.h;
      cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16357F" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
    hr.height = 26;

    const border = { top: { style: "thin" as const }, bottom: { style: "thin" as const }, left: { style: "thin" as const }, right: { style: "thin" as const } };
    rows.forEach((r, i) => {
      const row = ws.getRow(5 + i);
      const vals = [r.no, r.nama, r.part, r.kategori, r.kode || "-", r.desc || "-", r.po || "-", r.status, r.lainnya || "-"];
      vals.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v as any;
        cell.font = { size: 10 };
        cell.border = border;
        cell.alignment = { vertical: "top", wrapText: ci === 1 || ci === 5 || ci === 6 || ci === 8, horizontal: ci === 0 || ci === 3 || ci === 7 ? "center" : "left" };
        if (ci === 7) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[r.status] || "FFFFFFFF" } };
      });
    });

    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    return new NextResponse(buf as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Cek Kode Material ${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
