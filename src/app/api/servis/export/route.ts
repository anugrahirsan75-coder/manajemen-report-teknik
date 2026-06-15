import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { ServisItem, SERVIS_STATUS_LABEL, lamaHari } from "@/lib/servis/types";
import { tanggalIndo } from "@/lib/format";
import { resolveFotoBuffer } from "@/lib/server/foto";

export const runtime = "nodejs";
export const maxDuration = 60;

const BLUE = "FF16357F";
const thin = { style: "thin" as const, color: { argb: "FF94A3B8" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

const STATUS_FILL: Record<string, string> = {
  di_bengkel: "FFFDE68A", selesai: "FFBFDBFE", kembali: "FFBBF7D0", tidak_layak: "FFFECACA",
};

export async function POST(req: NextRequest) {
  try {
    const { items } = (await req.json()) as { items: ServisItem[] };
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Monitoring", { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });

    const COLS = [
      { h: "No", w: 5 }, { h: "Nama Barang", w: 28 }, { h: "Jenis", w: 16 }, { h: "Kapal", w: 20 },
      { h: "Bengkel", w: 22 }, { h: "Kerusakan", w: 30 }, { h: "Tgl Kirim", w: 15 }, { h: "Estimasi", w: 15 },
      { h: "Tgl Kembali", w: 15 }, { h: "Lama (hari)", w: 11 }, { h: "Status", w: 20 }, { h: "Biaya (Rp)", w: 15 }, { h: "Catatan", w: 25 },
      { h: "Foto", w: 24 },
    ];
    const FOTO_COL = COLS.length; // 1-based kolom Foto (N)
    COLS.forEach((c, i) => (ws.getColumn(i + 1).width = c.w));

    // judul
    ws.mergeCells("A1:N1");
    const t = ws.getCell("A1");
    t.value = "MONITORING BARANG SERVIS BENGKEL — PT. ASDP INDONESIA FERRY (PERSERO) CABANG TERNATE";
    t.font = { bold: true, size: 13, color: { argb: BLUE } };
    t.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 24;
    ws.mergeCells("A2:N2");
    ws.getCell("A2").value = `Dicetak ${tanggalIndo(new Date().toISOString().slice(0, 10))} · ${items.length} barang`;
    ws.getCell("A2").font = { size: 9, color: { argb: "FF64748B" } };
    ws.getCell("A2").alignment = { horizontal: "center" };

    // header
    const hr = ws.getRow(4);
    COLS.forEach((c, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = c.h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = border;
    });
    hr.height = 20;

    // data
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const r = ws.getRow(5 + i);
      const vals: (string | number)[] = [
        i + 1, it.namaBarang, it.jenis || "", it.kapal, it.bengkel || "", it.kerusakan || "",
        it.tanggalKirim ? tanggalIndo(it.tanggalKirim) : "", it.tanggalEstimasi ? tanggalIndo(it.tanggalEstimasi) : "",
        it.tanggalKembali ? tanggalIndo(it.tanggalKembali) : "", lamaHari(it),
        SERVIS_STATUS_LABEL[it.status] ?? it.status, it.biaya || 0, it.catatan || "",
      ];
      vals.forEach((v, ci) => {
        const cell = r.getCell(ci + 1);
        cell.value = v;
        cell.font = { size: 10 };
        cell.border = border;
        cell.alignment = { vertical: "top", wrapText: ci === 1 || ci === 5 || ci === 12, horizontal: ci === 0 || ci === 9 ? "center" : ci === 11 ? "right" : "left" };
        if (ci === 11) cell.numFmt = "#,##0";
        if (ci === 10) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[it.status] || "FFFFFFFF" } };
      });

      // kolom Foto: embed gambar DALAM cell (maks 3 thumbnail berjajar)
      const fc = r.getCell(FOTO_COL);
      fc.border = border;
      fc.alignment = { horizontal: "center", vertical: "middle" };
      const fotos = (it.foto || []).slice(0, 3);
      const rowIdx0 = 4 + i; // 0-based baris data (1-based 5+i)
      if (fotos.length) {
        r.height = 56;
        for (let fi = 0; fi < fotos.length; fi++) {
          const resolved = await resolveFotoBuffer(fotos[fi]); // base64 ATAU URL Storage
          if (!resolved) continue;
          const imgId = wb.addImage({ buffer: resolved.buf as any, extension: resolved.ext });
          ws.addImage(imgId, {
            tl: { col: (FOTO_COL - 1) + 0.04 + fi * 0.33, row: rowIdx0 + 0.1 } as any,
            ext: { width: 58, height: 50 },
          });
        }
      } else {
        fc.value = "-";
        fc.font = { size: 10, color: { argb: "FF94A3B8" } };
      }
    }

    // total biaya
    const tr = ws.getRow(5 + items.length);
    tr.getCell(11).value = "TOTAL BIAYA";
    tr.getCell(11).font = { bold: true, size: 10 };
    tr.getCell(12).value = items.reduce((s, i) => s + (i.biaya || 0), 0);
    tr.getCell(12).numFmt = "#,##0";
    tr.getCell(12).font = { bold: true, size: 10 };
    tr.getCell(12).alignment = { horizontal: "right" };
    [11, 12].forEach((c) => (tr.getCell(c).border = border));

    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    return new NextResponse(buf as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="monitoring-servis.xlsx"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
