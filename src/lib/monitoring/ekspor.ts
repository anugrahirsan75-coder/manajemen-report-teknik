"use client";
/**
 * Ekspor Excel halaman Monitoring Pengadaan Teknik.
 *
 * Dua lembar, sengaja saling melengkapi:
 *   REKAP        — satu baris per pengadaan, seperti tabel di layar.
 *   RINCIAN ITEM — satu baris per item, lengkap dengan induk pengadaannya,
 *                  jadi bisa langsung disaring/dijumlah di Excel.
 *
 * Yang dijaga di sini: tak ada yang terpotong. Uraian panjang dibiarkan utuh
 * dengan pembungkus baris, lebar kolom dihitung dari isi terpanjang (dibatasi
 * wajar supaya tetap terbaca), dan tinggi baris dibiarkan menyesuaikan.
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export interface ItemEkspor {
  kapal: string; nama: string; spesifikasi: string; keterangan: string;
  breakdown: string[]; jumlah: number; satuan: string; harga: number; hargaSpbj: number;
}
export interface BarisEkspor {
  id: string; nama: string; noPr: string; noPo: string;
  grSes: { termin: number | null; nomor: string; tanggal: string }[];
  jenis: string; kapal: string[]; tanggal: string; status: string;
  mataAnggaran: string[]; dasarPelimpahan: string; items: ItemEkspor[];
}

const JENIS: Record<string, string> = { rutin: "Rutin", docking: "Docking", lainnya: "Lainnya" };
const STATUS: Record<string, string> = {
  menunggu_spbj: "Menunggu SPBJ", spbj_terbit: "SPBJ Terbit", selesai: "Selesai",
};
const ROM = ["", "I", "II", "III"];
const uang = "#,##0";
const tipis = { style: "thin" as const };
const garis = { top: tipis, bottom: tipis, left: tipis, right: tipis };

const tglIndo = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  const bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
    "Agustus", "September", "Oktober", "November", "Desember"];
  return `${d || 1} ${bulan[m - 1]} ${y}`;
};
/** nama dari sumbernya kerap berspasi ganda / berspasi di depan */
const rapi = (v: string) => (v || "").replace(/\s+/g, " ").trim();

const grTeks = (g: BarisEkspor["grSes"]) =>
  g.map((x) => `${x.termin ? ROM[x.termin] + ". " : ""}${x.nomor}${x.tanggal ? ` (${tglIndo(x.tanggal)})` : ""}`).join("\n");

/** lebar kolom mengikuti isi terpanjang, dibatasi agar tabel tetap terbaca */
function setelLebar(ws: ExcelJS.Worksheet, min: number[], maks: number[], mulaiBaris = 1) {
  // ditelusuri per NOMOR kolom, bukan lewat ws.columns — larik itu bisa tak
  // sejajar dengan kolom sebenarnya sehingga lebarnya meleset satu posisi
  for (let i = 1; i <= min.length; i++) {
    const kol = ws.getColumn(i);
    let panjang = min[i - 1] || 10;
    kol.eachCell?.({ includeEmpty: false }, (sel, nomorBaris) => {
      if (nomorBaris < mulaiBaris) return;   // judul halaman tak menentukan lebar kolom
      const isi: any = sel.value;
      const teks = isi == null ? "" : String(isi?.formula ?? isi);
      // uraian bisa berbaris banyak — yang menentukan lebar adalah baris terpanjang
      const baris = teks.split("\n").reduce((a, b) => (b.length > a.length ? b : a), "");
      panjang = Math.max(panjang, baris.length + 2);
    });
    kol.width = Math.min(panjang, maks[i - 1] || 60);
  }
}

function kepala(ws: ExcelJS.Worksheet, baris: number, kolom: string[]) {
  const r = ws.getRow(baris);
  kolom.forEach((v, i) => {
    const c = r.getCell(i + 1);
    c.value = v;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16357F" } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = garis;
  });
  r.height = 26;
}

export async function unduhMonitoring(baris: BarisEkspor[], keterangan: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Monitoring Pengadaan Teknik — ASDP Ternate";

  // ── 1. REKAP ───────────────────────────────────────────────────────────────
  const rk = wb.addWorksheet("REKAP", { views: [{ state: "frozen", ySplit: 5 }] });
  rk.getCell("A1").value = "MONITORING PENGADAAN TEKNIK";
  rk.getCell("A2").value = "PT. ASDP Indonesia Ferry (Persero) — Cabang Ternate";
  rk.getCell("A3").value = keterangan;
  rk.getCell("A1").font = { bold: true, size: 14 };
  rk.getCell("A2").font = { size: 11 };
  rk.getCell("A3").font = { size: 10, italic: true, color: { argb: "FF64748B" } };

  const KOL = ["No", "Nama Pengadaan", "Kapal", "Jenis", "Tanggal", "No. PR SAP",
    "No. PO SAP", "No. GR / SES", "Jumlah Item", "Nilai sesuai PR", "Nilai sesuai SPBJ", "Status"];
  kepala(rk, 5, KOL);

  let b = 6;
  baris.forEach((x, i) => {
    const nilaiPr = x.items.reduce((s, it) => s + it.harga * it.jumlah, 0);
    const adaFinal = x.items.some((it) => it.hargaSpbj > 0);
    const nilaiSpbj = x.items.reduce((s, it) => s + (it.hargaSpbj > 0 ? it.hargaSpbj : it.harga) * it.jumlah, 0);
    const r = rk.getRow(b++);
    r.values = [
      i + 1, rapi(x.nama), x.kapal.join(", "), JENIS[x.jenis] || x.jenis, tglIndo(x.tanggal),
      x.noPr, x.noPo, grTeks(x.grSes), x.items.length,
      nilaiPr, adaFinal ? nilaiSpbj : null, STATUS[x.status] || x.status,
    ];
    [10, 11].forEach((c) => (r.getCell(c).numFmt = uang));
    r.alignment = { vertical: "top", wrapText: true };
    for (let c = 1; c <= KOL.length; c++) r.getCell(c).border = garis;
  });

  const jml = rk.getRow(b++);
  jml.getCell(2).value = `JUMLAH ${baris.length} pengadaan`;
  jml.getCell(10).value = { formula: `SUM(J6:J${b - 2})` };
  jml.getCell(11).value = { formula: `SUM(K6:K${b - 2})` };
  [10, 11].forEach((c) => { jml.getCell(c).numFmt = uang; });
  for (let c = 1; c <= KOL.length; c++) {
    jml.getCell(c).font = { bold: true };
    jml.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF7" } };
    jml.getCell(c).border = garis;
  }
  setelLebar(rk, [5, 30, 14, 9, 14, 14, 14, 16, 8, 17, 17, 15],
    [6, 62, 32, 12, 16, 20, 20, 28, 10, 20, 20, 16], 5);
  rk.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: KOL.length } };

  // ── 2. RINCIAN ITEM ────────────────────────────────────────────────────────
  const ri = wb.addWorksheet("RINCIAN ITEM", { views: [{ state: "frozen", ySplit: 1 }] });
  const KOL2 = ["No", "Nama Pengadaan", "No. PR SAP", "No. PO SAP", "Jenis", "Tanggal",
    "Kapal", "Kelompok / Keterangan", "Nama Barang / Jasa", "Spesifikasi", "Rincian",
    "Jumlah", "Satuan", "Harga Satuan (PR)", "Jumlah (PR)", "Harga Satuan (SPBJ)", "Jumlah (SPBJ)"];
  kepala(ri, 1, KOL2);

  let k = 2, no = 0;
  baris.forEach((x) => {
    x.items.forEach((it) => {
      const hargaFinal = it.hargaSpbj > 0 ? it.hargaSpbj : 0;
      const r = ri.getRow(k++);
      r.values = [
        ++no, rapi(x.nama), x.noPr, x.noPo, JENIS[x.jenis] || x.jenis, tglIndo(x.tanggal),
        it.kapal, rapi(it.keterangan), rapi(it.nama), rapi(it.spesifikasi), it.breakdown.join("\n"),
        it.jumlah, it.satuan,
        it.harga, it.harga * it.jumlah,
        hargaFinal || null, hargaFinal ? hargaFinal * it.jumlah : null,
      ];
      [14, 15, 16, 17].forEach((c) => (r.getCell(c).numFmt = uang));
      r.alignment = { vertical: "top", wrapText: true };
      for (let c = 1; c <= KOL2.length; c++) r.getCell(c).border = garis;
    });
  });
  setelLebar(ri, [6, 30, 14, 14, 9, 14, 14, 18, 30, 18, 18, 8, 9, 17, 17, 17, 17],
    [7, 55, 20, 20, 12, 16, 26, 36, 62, 42, 42, 10, 12, 19, 19, 19, 19]);
  ri.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: KOL2.length } };

  const buf = await wb.xlsx.writeBuffer();
  const cap = new Date().toISOString().slice(0, 10);
  saveAs(new Blob([buf]), `Monitoring_Pengadaan_Teknik_${cap}.xlsx`);
}
