/**
 * Ekspor Nomor IO ke borang Excel resmi.
 *
 * Susunannya sengaja meniru berkas "FORM PERMINTAAN IO & ASSET" yang selama ini
 * dikirim ke Kantor Pusat — kepala dua tingkat, pita nama kapal, kolom pada
 * urutan yang sama. Kalau susunannya berbeda, berkas ini harus disusun ulang
 * dengan tangan sebelum dikirim, dan pekerjaan salin-tempel yang hendak dihapus
 * justru kembali.
 *
 * Lembar ASSET CLASS ikut disertakan seperti pada berkas aslinya: penerima di
 * pusat memakainya untuk memeriksa kode yang kita tulis.
 */
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { ASSET_CLASS, BarisIO, hitungBaris, labelAsset, namaPeriode } from "@/lib/io/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BIRU = "FF16357F";
const ABU = "FFE8EDF7";
const garis = { style: "thin" as const, color: { argb: "FFBFC9DD" } };
const kotak = { top: garis, left: garis, bottom: garis, right: garis };

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as { periode?: string; baris?: BarisIO[] };
  const periode = String(b.periode || "");
  const baris = Array.isArray(b.baris) ? b.baris : [];

  const wb = new ExcelJS.Workbook();
  wb.creator = "Manajemen Report Teknik ASDP Ternate";
  wb.created = new Date();

  const ws = wb.addWorksheet("FORM PERMINTAAN IO & ASSET", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.mergeCells("A2:E3");
  const kepala = ws.getCell("A2");
  kepala.value = `PT. ASDP INDONESIA FERRY (PERSERO) CABANG TERNATE\nPERMINTAAN NOMOR IO & ASSET — ${namaPeriode(periode).toUpperCase()}`;
  kepala.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  kepala.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BIRU } };
  kepala.alignment = { vertical: "middle", wrapText: true };

  /* kepala dua tingkat, sama seperti borang aslinya */
  const satu = [
    ["A", "NO."], ["B", "ASSET CLASS"], ["C", "DESKRIPSI ASET"], ["D", "SPESIFIKASI"],
    ["E", "COST CENTER"], ["N", "Nomor Asset Lama yang diganti"], ["O", "NO. ASSET SAP *"],
    ["P", "NO. IO SAP"],
  ] as const;
  satu.forEach(([kol, judul]) => {
    ws.mergeCells(`${kol}5:${kol}6`);
    ws.getCell(`${kol}5`).value = judul;
  });
  ws.mergeCells("F5:G5"); ws.getCell("F5").value = "QUANTITY";
  ws.mergeCells("H5:K5"); ws.getCell("H5").value = "HARGA";
  ws.mergeCells("L5:M5"); ws.getCell("L5").value = "Keterangan";
  [["F", "Unit"], ["G", "satuan"], ["H", "SATUAN"], ["I", "Total"], ["J", "PPN 11%"],
   ["K", "GRAND TOTAL"], ["L", "Lokasi"], ["M", "Ganti/Baru"]].forEach(([kol, judul]) => {
    ws.getCell(`${kol}6`).value = judul;
  });

  [5, 6].forEach((n) => {
    const r = ws.getRow(n);
    r.height = n === 5 ? 28 : 18;
    for (let i = 1; i <= 16; i++) {
      const sel = r.getCell(i);
      sel.font = { bold: true, size: 9 };
      sel.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
      sel.border = kotak;
    }
  });

  ws.columns = [
    { width: 6 }, { width: 14 }, { width: 44 }, { width: 26 }, { width: 16 },
    { width: 7 }, { width: 10 }, { width: 16 }, { width: 16 }, { width: 14 },
    { width: 18 }, { width: 18 }, { width: 12 }, { width: 18 }, { width: 16 }, { width: 16 },
  ];

  /* dikelompokkan per kapal; urutan kapal mengikuti kemunculannya di daftar */
  const urutKapal: string[] = [];
  baris.forEach((x) => { if (!urutKapal.includes(x.kapal)) urutKapal.push(x.kapal); });

  let jumlahGrand = 0;
  urutKapal.forEach((kapal) => {
    const pita = ws.addRow([]);
    pita.getCell(3).value = kapal.toUpperCase();
    pita.getCell(3).font = { bold: true, size: 11 };
    for (let i = 1; i <= 16; i++) {
      pita.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F4FA" } };
      pita.getCell(i).border = kotak;
    }

    baris.filter((x) => x.kapal === kapal).forEach((x, i) => {
      const h = hitungBaris(x);
      jumlahGrand += h.grand;
      const r = ws.addRow([
        i + 1, x.assetClass, x.deskripsi, x.spesifikasi, x.costCenter,
        Number(x.unit) || 0, x.satuan, Number(String(x.hargaSatuan).replace(/[^\d.-]/g, "")) || 0,
        h.total, h.ppn, h.grand, x.lokasi, x.gantiBaru, x.asetLama, x.noAsetSap, x.noIoSap,
      ]);
      r.font = { size: 10 };
      r.alignment = { vertical: "top", wrapText: true };
      for (let k = 1; k <= 16; k++) r.getCell(k).border = kotak;
      [8, 9, 10, 11].forEach((k) => { r.getCell(k).numFmt = '#,##0'; });
      /* keterangan kelas aset dititipkan sebagai catatan sel: kolomnya harus
         tetap berisi kode saja supaya terbaca sistem di pusat, tetapi yang
         memeriksa berkas ini tidak perlu membuka lembar acuan */
      const ket = labelAsset(x.assetClass);
      if (ket) r.getCell(2).note = ket;
      r.getCell(1).alignment = { horizontal: "center" };
      r.getCell(6).alignment = { horizontal: "center" };
      /* yang belum turun nomornya diberi warna: itu satu-satunya hal yang
         dicari saat berkas ini dibuka kembali bulan depan */
      if (!String(x.noIoSap || "").trim()) {
        r.getCell(16).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
      }
    });
  });

  if (baris.length) {
    const total = ws.addRow([]);
    total.getCell(3).value = "TOTAL SELURUH PERMINTAAN";
    total.getCell(11).value = jumlahGrand;
    total.getCell(11).numFmt = '#,##0';
    total.font = { bold: true, size: 11 };
    for (let i = 1; i <= 16; i++) {
      total.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
      total.getCell(i).border = kotak;
    }
  }

  /* lembar acuan, sama seperti berkas aslinya */
  const wa = wb.addWorksheet("ASSET CLASS");
  wa.columns = [{ width: 14 }, { width: 60 }];
  const ka = wa.addRow(["KODE", "KETERANGAN"]);
  ka.font = { bold: true };
  ka.eachCell((sel) => { sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } }; });
  ASSET_CLASS.forEach((a) => wa.addRow([a.kode, a.label]));

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="permintaan-nomor-io-${periode}.xlsx"`,
    },
  });
}
