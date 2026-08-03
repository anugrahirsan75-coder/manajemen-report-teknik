"use client";
/**
 * Ekspor Excel SATU pengadaan dari halaman Monitoring Pengadaan Teknik.
 *
 * Satu lembar: kepala dokumen (nomor, tanggal, nomor SAP, mata anggaran, dasar
 * pelimpahan) lalu tabel itemnya, dikelompokkan per kapal seperti dokumen
 * aslinya, ditutup baris jumlah.
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

const grTeks = (g: DokSatu["grSes"]) =>
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

// ─────────────────────────────────────────────────────────────────────────────

export interface DokSatu {
  namaPengadaan: string; nomor: string; noPr: string; noPo: string; tanggal: string;
  dasarPelimpahan: string; mataAnggaran: string[];
  grSes: { termin: number | null; nomor: string; tanggal: string }[];
  items: ItemEkspor[];
}

/**
 * Ekspor SATU pengadaan — satu lembar berisi kepala dokumen lalu tabel itemnya,
 * susunannya mengikuti pratinjau di layar supaya yang terunduh sama dengan yang
 * dilihat. Item dikelompokkan per kapal seperti dokumen aslinya.
 */
export async function unduhSatuPengadaan(dok: DokSatu, jenis: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Monitoring Pengadaan Teknik — ASDP Ternate";
  const ws = wb.addWorksheet("RINCIAN", { views: [{ state: "frozen", ySplit: 12 }] });

  const judul = (baris: number, teks: string, tebal = false, ukuran = 11) => {
    const c = ws.getCell(baris, 1);
    c.value = teks;
    c.font = { bold: tebal, size: ukuran };
  };
  judul(1, "DAFTAR KEBUTUHAN PENGADAAN BARANG/JASA", true, 14);
  judul(2, "PT. ASDP Indonesia Ferry (Persero) — Cabang Ternate");
  judul(3, rapi(dok.namaPengadaan), true, 12);

  const info: [string, string][] = [
    ["Nomor", dok.nomor || dok.noPr],
    ["Tanggal", tglIndo(dok.tanggal)],
    ["Jenis Anggaran", jenis],
    ["No. PR SAP", dok.noPr],
    ["No. PO SAP", dok.noPo || "—"],
    ["No. GR / SES", grTeks(dok.grSes) || "—"],
    ["Mata Anggaran", dok.mataAnggaran.join(", ")],
    ["Dasar Pelimpahan", dok.dasarPelimpahan],
  ];
  info.forEach(([k, v], i) => {
    const r = ws.getRow(5 + i);
    r.getCell(1).value = k;
    r.getCell(1).font = { bold: true };
    r.getCell(2).value = v;
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
    ws.mergeCells(5 + i, 2, 5 + i, 7);
  });

  const KOL = ["No.", "Kapal / Kelompok", "Nama Barang / Jasa", "Spesifikasi",
    "Jml", "Sat.", "Harga Satuan (PR)", "Jumlah (PR)", "Harga Satuan (SPBJ)", "Jumlah (SPBJ)"];
  kepala(ws, 14, KOL);

  let b = 15, no = 0, totalPr = 0, totalSpbj = 0;
  let kapalBerjalan = "";
  dok.items.forEach((it) => {
    // sub-judul per kapal, seperti pengelompokan pada dokumen aslinya
    if (it.kapal && it.kapal !== kapalBerjalan) {
      kapalBerjalan = it.kapal;
      const g = ws.getRow(b++);
      g.getCell(2).value = it.kapal;
      g.getCell(2).font = { bold: true };
      g.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      for (let c = 1; c <= KOL.length; c++) g.getCell(c).border = garis;
    }
    const final = it.hargaSpbj > 0 ? it.hargaSpbj : 0;
    totalPr += it.harga * it.jumlah;
    totalSpbj += (final || it.harga) * it.jumlah;
    const r = ws.getRow(b++);
    const uraian = [rapi(it.nama), ...it.breakdown.map((x) => `- ${x}`)].join("\n");
    r.values = [
      ++no, rapi(it.keterangan), uraian, rapi(it.spesifikasi),
      it.jumlah, it.satuan,
      it.harga, it.harga * it.jumlah,
      final || null, final ? final * it.jumlah : null,
    ];
    [7, 8, 9, 10].forEach((c) => (r.getCell(c).numFmt = uang));
    r.alignment = { vertical: "top", wrapText: true };
    for (let c = 1; c <= KOL.length; c++) r.getCell(c).border = garis;
  });

  const adaFinal = dok.items.some((it) => it.hargaSpbj > 0);
  const jml = ws.getRow(b++);
  jml.getCell(6).value = "JUMLAH";
  jml.getCell(8).value = totalPr;
  if (adaFinal) jml.getCell(10).value = totalSpbj;
  [8, 10].forEach((c) => { jml.getCell(c).numFmt = uang; });
  for (let c = 1; c <= KOL.length; c++) {
    jml.getCell(c).font = { bold: true };
    jml.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF7" } };
    jml.getCell(c).border = garis;
  }

  setelLebar(ws, [6, 22, 34, 20, 7, 8, 17, 17, 17, 17],
    [7, 34, 62, 40, 9, 12, 19, 19, 19, 19], 14);

  const buf = await wb.xlsx.writeBuffer();
  const nama = rapi(dok.namaPengadaan).replace(/[^\w]+/g, "_").slice(0, 60) || "Pengadaan";
  saveAs(new Blob([buf]), `${nama}.xlsx`);
}
