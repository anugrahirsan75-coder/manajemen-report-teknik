import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

// Usulan update harga Riil ke RAB master: kumpulan harga final SPPBJ per kode katalog.
// App tidak menulis ke RAB; file ini ditinjau & dimasukkan manual oleh pemilik.
interface Row {
  kode: string; nama: string; kategori: string; sumberLama: string;
  hargaHspk: number; hargaAktual: number; satuan: string;
  tanggal: string; noSpbj: string; vendor: string; pengadaan: string;
}

export async function POST(req: NextRequest) {
  try {
    const { rows } = (await req.json()) as { rows: Row[] };
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Usulan Harga Riil", { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });

    const COLS = [
      { h: "Kode Katalog", w: 14 }, { h: "Nama Item", w: 34 }, { h: "Kategori", w: 20 }, { h: "Satuan", w: 8 },
      { h: "Sumber Lama", w: 11 }, { h: "Harga HSPK (lama)", w: 16 }, { h: "Harga Aktual SPPBJ", w: 17 },
      { h: "Selisih", w: 14 }, { h: "%", w: 8 }, { h: "Tanggal", w: 12 }, { h: "No. SPBJ", w: 14 },
      { h: "Vendor", w: 22 }, { h: "Pengadaan", w: 30 }, { h: "Sumber Baru", w: 11 },
    ];
    COLS.forEach((c, i) => (ws.getColumn(i + 1).width = c.w));

    const lastCol = String.fromCharCode(64 + COLS.length); // N
    ws.mergeCells(`A1:${lastCol}1`);
    const t = ws.getCell("A1");
    t.value = "USULAN UPDATE HARGA RIIL — dari realisasi SPPBJ Pengadaan (tinjau sebelum masuk RAB master)";
    t.font = { bold: true, size: 13, color: { argb: "FF16357F" } };
    t.alignment = { horizontal: "center" };
    ws.getRow(1).height = 24;
    ws.mergeCells(`A2:${lastCol}2`);
    const sub = ws.getCell("A2");
    sub.value = `Dibuat ${new Date().toLocaleString("id-ID")} · ${rows.length} item · harga pre-PPN · "Sumber Baru"=Riil setelah diverifikasi`;
    sub.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
    sub.alignment = { horizontal: "center" };

    const hr = ws.getRow(3);
    COLS.forEach((c, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = c.h;
      cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16357F" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
    hr.height = 28;

    const RP = '#,##0;[Red]-#,##0';
    rows.forEach((r, idx) => {
      const selisih = (r.hargaAktual || 0) - (r.hargaHspk || 0);
      const pct = r.hargaHspk ? selisih / r.hargaHspk : 0;
      const row = ws.getRow(4 + idx);
      const vals = [r.kode, r.nama, r.kategori, r.satuan, r.sumberLama, r.hargaHspk, r.hargaAktual, selisih, pct, r.tanggal, r.noSpbj, r.vendor, r.pengadaan, "Riil"];
      vals.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v as any;
        cell.font = { size: 9 };
        cell.alignment = { vertical: "middle", wrapText: i === 1 || i === 12 };
        cell.border = { top: { style: "hair" }, bottom: { style: "hair" }, left: { style: "hair" }, right: { style: "hair" } };
        if (i === 5 || i === 6 || i === 7) cell.numFmt = RP;
        if (i === 8) cell.numFmt = "0.0%";
      });
      // warnai selisih
      const sc = row.getCell(8);
      sc.font = { size: 9, bold: true, color: { argb: selisih > 0 ? "FFB91C1C" : selisih < 0 ? "FF047857" : "FF64748B" } };
      // sumber baru hijau
      row.getCell(14).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
    });

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Usulan_Harga_Riil_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "gagal" }, { status: 500 });
  }
}
