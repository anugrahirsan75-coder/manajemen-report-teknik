import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { ProjectData, formatNomorSpk } from "@/lib/types";
import { tanggalIndo, kalimatTanggal, terbilangRupiah } from "@/lib/format";

const tpl = (n: string) => path.join(process.cwd(), "templates", n);
const LOGO = path.join(process.cwd(), "templates", "logo_asdp.png");
const modeFull = (m: "GO" | "TO") => (m === "GO" ? "General Overhoul" : "Top Overhoul");

async function load(name: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tpl(name));
  return wb;
}
async function out(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer());
}
function set(ws: ExcelJS.Worksheet, addr: string, val: any) {
  ws.getCell(addr).value = val;
}
// paksa semua kolom muat 1 halaman lebar (hindari tumpah ke kanan) + center horizontal.
// fitH=0 -> tinggi bebas (boleh multi halaman ke bawah); fitH=1 -> muat 1 halaman penuh.
function applyFit(ws: ExcelJS.Worksheet, fitH = 0) {
  ws.pageSetup = {
    ...ws.pageSetup,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: fitH,
    horizontalCentered: true,
  };
}

// sisip logo ASDP di pojok kiri atas (untuk file yang logonya hilang saat export)
function addLogo(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, w = 130, h = 88) {
  const id = wb.addImage({ buffer: fs.readFileSync(LOGO) as any, extension: "png" });
  ws.addImage(id, { tl: { col: 0.2, row: 0.1 }, ext: { width: w, height: h } });
}

// ---------- 02 BA ----------
export async function fillBa(d: ProjectData): Promise<Buffer> {
  const wb = await load("02_ba.xlsx");
  const ws = wb.worksheets[0];
  set(ws, "A4", `SWAKELOLA ${d.namaKapal} DALAM RANGKA DOCKING ${d.tahun}`);
  set(ws, "A6",
    `Pada hari ini ${kalimatTanggal(d.tanggalSelesai)} berdasarkan Surat Perintah Kerja Pekerjaan Swakelola ${d.namaKapal} No. ${d.nomorSpk} SPK. /TN.101/ASDP-TTE/SWK/${d.tahun} Tanggal ${tanggalIndo(d.tanggalMulai)} telah diselesaikan pekerjaan Swakelola ${d.namaKapal} dalam rangka Docking tahun ${d.tahun}, sesuai bukti terlampir :`);
  set(ws, "B59", `${modeFull(d.mesinME)} Mesin Induk Kiri/Kanan`);
  set(ws, "B60", `M/E ${d.namaME}`);
  set(ws, "B61", `${modeFull(d.mesinAE)} Mesin Bantu Kiri/Kanan`);
  set(ws, "B62", `AE I dan II : ${d.namaAE}`);
  set(ws, "G70", `Bitung, ${tanggalIndo(d.tanggalSelesai)}`);
  set(ws, "A72", `KKM ${d.namaKapal}`);
  set(ws, "A76", d.kkm);
  set(ws, "G72", `Mualim I ${d.namaKapal}`);
  set(ws, "G76", d.muallimI);
  set(ws, "A79", `NAKHODA ${d.namaKapal}`);
  set(ws, "A83", d.nakhoda);
  set(ws, "F79", `OWNER SURVEYOR ${d.namaKapal}`);
  set(ws, "F83", d.ownerSurveyor);
  addLogo(wb, ws);
  applyFit(ws, 0);
  return out(wb);
}

// ---------- 04 Lampiran ----------
export async function fillLampiran(d: ProjectData): Promise<Buffer> {
  const wb = await load("04_lampiran.xlsx");
  const ws = wb.worksheets[0];
  set(ws, "E3", `: SPK. ${d.nomorSpk}/TN.101/ASDP-TTE/SWK/${d.tahun}`);
  set(ws, "E4", `: ${tanggalIndo(d.tanggalSelesai)}`);
  set(ws, "A6", `PEKERJAAN SWAKELOLA ${d.namaKapal}`);
  set(ws, "B52", `${modeFull(d.mesinME)} Mesin Induk Kiri/Kanan`);
  set(ws, "B53", d.namaME);
  set(ws, "B54", `${modeFull(d.mesinAE)} Mesin Bantu Kiri/Kanan`);
  set(ws, "B55", `AE I dan II : ${d.namaAE}`);
  set(ws, "A63", d.namaKapal);
  set(ws, "A68", d.nakhoda);
  set(ws, "E68", d.generalManager);
  addLogo(wb, ws);
  applyFit(ws, 0);
  return out(wb);
}

// ---------- 07 SPKH (logo sudah ada) ----------
export async function fillSpkh(d: ProjectData): Promise<Buffer> {
  const wb = await load("07_spkh.xlsx");
  const ws = wb.worksheets[0];
  set(ws, "C12", `: ${d.deptHeadOpsTeknik}`);
  set(ws, "C13", ": Dept. Head Operasional dan Teknik");
  set(ws, "C14", `:  ${d.nikDeptHead}`);
  set(ws, "A18", "1. Bahwa Pemberi Pernyataan menyatakan dengan sesungguhnya dan sejujur-jujurnya Bahwa harga yang tertera di Bawah ini benar adanya dan dapat");
  set(ws, "A19", "dikonfirmasi di ");
  set(ws, "C19", `NAKHODA ${d.namaKapal}`);
  set(ws, "E24", `Swakelola ${d.namaKapal} Dalam Rangka Docking`);
  set(ws, "G24", d.biayaPekerjaan);
  set(ws, "E25", `tahun ${d.tahun}`);
  set(ws, "J38", `: ${tanggalIndo(d.tanggalSelesai)}`);
  set(ws, "A40", `Nakhoda ${d.namaKapal}`);
  set(ws, "H40", "Dept. Head Operasional dan Teknik");
  set(ws, "A44", d.nakhoda);
  set(ws, "H44", d.deptHeadOpsTeknik);
  ws.pageSetup = { ...ws.pageSetup, orientation: "landscape" };
  applyFit(ws, 1); // landscape, muat 1 halaman penuh
  return out(wb);
}

// ---------- 03 Perhitungan ----------
export async function fillPerhitungan(d: ProjectData): Promise<Buffer> {
  const wb = await load("03_perhitungan.xlsx");
  const ws = wb.worksheets[0];
  set(ws, "A5", `PEKERJAAN DOCKING ${d.namaKapal} TAHUN ${d.tahun}`);
  let totalBersih = 0;
  for (let i = 0; i < 21; i++) {
    const r = 12 + i * 2;
    const c = d.crew[i];
    if (c) {
      set(ws, `B${r}`, c.nama);
      set(ws, `C${r}`, c.jabatan);
      set(ws, `D${r}`, c.nilaiBruto);
      set(ws, `E${r}`, c.pph21);
      totalBersih += c.nilaiBruto - c.pph21;
    } else {
      set(ws, `B${r}`, null); set(ws, `C${r}`, null); set(ws, `D${r}`, null); set(ws, `E${r}`, null);
    }
  }
  set(ws, "A57", `Terbilang : #${terbilangRupiah(totalBersih)}#`);
  set(ws, "G58", `Ternate, ${tanggalIndo(d.tanggalSelesai)}`);
  set(ws, "D61", "Dept. Head Operasional dan Teknik");
  set(ws, "A67", d.generalManager);
  set(ws, "D67", d.deptHeadOpsTeknik);
  set(ws, "G67", d.stafTeknik);
  // file 03: tanpa logo (sesuai permintaan).
  // Layout: paksa muat 1 halaman (hindari tabel pecah & TTD terpotong) + center horizontal.
  ws.pageSetup = {
    ...ws.pageSetup,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    horizontalCentered: true,
    verticalCentered: false,
    margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.5, header: 0.3, footer: 0.3 },
  };
  // A4/A5 (judul) sudah rata tengah di template; A2 (PT. ASDP...) biarkan rata kiri spt aslinya
  return out(wb);
}

// ---------- 05 Nominatif ----------
export async function fillNominatif(d: ProjectData): Promise<Buffer> {
  const wb = await load("05_nominatif.xlsx");
  const ws = wb.worksheets[0];
  set(ws, "C8", `: ${d.tahun}`);
  set(ws, "C9", `:  ${d.noDafnom}`);
  const ket = `Insentif Swakelola ${formatNomorSpk(d)}`;
  for (let i = 0; i < 21; i++) {
    const r = 15 + i;
    const c = d.crew[i];
    if (c) {
      set(ws, `B${r}`, c.nama);
      set(ws, `C${r}`, c.nik);
      set(ws, `D${r}`, d.costCenter);
      set(ws, `E${r}`, c.jabatan);
      set(ws, `F${r}`, d.namaKapal);
      set(ws, `G${r}`, c.npwp);
      set(ws, `H${r}`, tanggalIndo(d.tanggalSpm));
      set(ws, `I${r}`, d.nomorSpm);
      set(ws, `J${r}`, "Insentif");
      set(ws, `K${r}`, c.nilaiBruto);
      set(ws, `N${r}`, ket);
      set(ws, `Q${r}`, c.pph21);
    } else {
      ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "N", "Q"].forEach((col) => set(ws, `${col}${r}`, null));
    }
  }
  addLogo(wb, ws);
  applyFit(ws, 0);
  return out(wb);
}

// ---------- 08 Dokumentasi (foto) ----------
export async function fillDokumentasi(d: ProjectData): Promise<Buffer> {
  const wb = await load("08_dokumentasi.xlsx");
  const deck = wb.getWorksheet("Deck") ?? wb.worksheets[0];
  const mesin = wb.getWorksheet("Mesin") ?? wb.worksheets[1];
  set(deck, "A1", `DOKUMENTASI PEKERJAAN SWAKELOLA DOCKING ${d.namaKapal} TAHUN ${d.tahun}`);

  const place = (ws: ExcelJS.Worksheet, fotos: typeof d.fotoDok) => {
    if (!ws) return;
    const perRow = 2, colW = 5, rowH = 14; // sel: 2 foto per baris
    fotos.forEach((f, idx) => {
      const m = f.dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/);
      if (!m) return;
      const ext = m[1].startsWith("jp") ? "jpeg" : "png";
      const id = wb.addImage({ base64: m[2], extension: ext as any });
      const gx = idx % perRow, gy = Math.floor(idx / perRow);
      const col = gx * colW + 0.3;
      const row = 3 + gy * rowH + 0.3;
      ws.addImage(id, { tl: { col, row }, ext: { width: 300, height: 200 } });
      const capRow = 3 + gy * rowH + 11;
      set(ws, `${String.fromCharCode(65 + gx * colW)}${capRow}`, f.caption || `${f.kategori} ${idx + 1}`);
    });
  };
  place(deck, d.fotoDok.filter((f) => f.kategori === "DECK"));
  place(mesin, d.fotoDok.filter((f) => f.kategori === "MESIN"));
  addLogo(wb, deck, 110, 74);
  return out(wb);
}

export const XLSX_FILLERS: Record<string, (d: ProjectData) => Promise<Buffer>> = {
  ba: fillBa,
  lampiran: fillLampiran,
  spkh: fillSpkh,
  perhitungan: fillPerhitungan,
  nominatif: fillNominatif,
  dokumentasi: fillDokumentasi,
};
