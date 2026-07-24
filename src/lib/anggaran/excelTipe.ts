/**
 * Export Excel PER TIPE anggaran (Rutin / Docking / Persetujuan Lainnya).
 *
 * Susunan berjenjang supaya angka bisa ditelusuri sampai akarnya:
 *
 *   RINGKASAN            per grup (kapal / surat)      --klik--> sheet grup
 *     └ sheet per grup   per Mata Anggaran             --klik--> dokumen di RINCIAN
 *         └ DAFTAR       indeks semua SPPBJ/Non PR PO  --klik--> dokumen di RINCIAN
 *             └ RINCIAN  tiap SPPBJ ditulis sebagai DOKUMEN utuh (gaya Lampiran 2):
 *                        kop nomor/tanggal, dasar pelimpahan, tabel NO/JML/SAT/
 *                        NAMA BARANG/SPESIFIKASI/HARGA SATUAN/JUMLAH, TOTAL, ttd.
 *
 * Tiap tingkat memakai RUMUS, bukan angka mati:
 *   - Realisasi di sheet grup = SUMIFS ke kolom bantu sheet RINCIAN
 *   - Ringkasan = menunjuk baris TOTAL sheet grup
 *   Jadi angka di puncak selalu bisa dibuktikan oleh dokumen di bawahnya.
 *
 * Kolom bantu H/I/J di RINCIAN (Grup, Mata Anggaran, Nilai) sengaja disembunyikan —
 * itulah yang dibaca SUMIFS. Item yang dipakai bersama beberapa kapal tidak diberi
 * kolom bantu di barisnya, melainkan dibagi di tabel "PEMBAGIAN" paling bawah,
 * supaya tidak terhitung dua kali.
 */
import ExcelJS from "exceljs";

const TEAL = "FF14B8C4";
const ABU = "FFF1F5F9";
const GARIS = "FFCBD5E1";
const TINTA = "FF334155";
const MERAH = "FFDC2626";
const KUNING = "FFD97706";
const HIJAU = "FF059669";
const UNGU = "FF6D28D9";
const LANGIT = "FFEFF6FF";
const BIRU_LINK = "FF1D4ED8";

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
/** ke pos anggaran mana nilai item ini dihitung (biasanya 1; >1 = dipakai bersama) */
export interface PosItem { grup: string; ma: string; nilai: number }
export interface DokItem {
  jumlah: number; satuan: string; nama: string; spesifikasi: string;
  harga: number; nilai: number;
  keterangan?: string;   // baris tebal di atas item (seperti di dokumen asli)
  rincian?: string[];    // baris "- ..." di bawah item
  pos: PosItem[];
}
export interface BlokKapal { kapal: string; items: DokItem[] }
export interface Dokumen {
  grup: string;          // grup utama (utk indeks & urutan)
  sumber: string;        // SPPBJ / Non PR PO
  judul: string;         // "DAFTAR KEBUTUHAN PENGADAAN BARANG/JASA"
  nomor: string;
  tanggal: string;       // sudah diformat "16 Juli 2026"
  kotaTanggal: string;   // "Ternate, Juli 2026"
  noDRP?: string;
  dasar?: string;
  nama: string;          // nama pengadaan
  mataAnggaran: string[];
  vendor?: string;
  jenisAnggaran?: string;
  stafTeknik?: string;
  deptHead?: string;
  blok: BlokKapal[];
  total: number;         // nilai dokumen utuh
  dibebankan: number;    // bagian yang masuk anggaran tipe ini (bisa < total)
}
export interface DataTipe {
  tipe: "rutin" | "docking" | "lainnya";
  judul: string;         // "Anggaran Docking"
  periode: string;       // "Tahun 2026"
  labelGrup: string;     // "Kapal" / "Surat Persetujuan" / "Periode"
  warna: string;         // ARGB
  dicetak: string;
  grup: GrupAnggaran[];
  dokumen: Dokumen[];
}

const amanSheet = (s: string) => (s || "Sheet").replace(/[\\/*?:\[\]]/g, "-").slice(0, 31);
const qq = (s: string) => (s || "").replace(/"/g, '""');

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

const gayaTautan = (cell: ExcelJS.Cell, teks: string, tujuan: string, ukuran = 9) => {
  cell.value = { text: teks, hyperlink: tujuan };
  cell.font = { name: "Calibri", size: ukuran, bold: true, color: { argb: BIRU_LINK }, underline: true };
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
  d.grup.forEach((g) => {
    let n = amanSheet(g.pendek || g.nama);
    let k = 2;
    while (Array.from(namaSheet.values()).includes(n)) n = amanSheet(`${g.pendek} ${k++}`);
    namaSheet.set(g.nama, n);
  });
  const refSheet = (grup: string) => {
    const sn = namaSheet.get(grup);
    return sn ? `#'${sn}'!A6` : "#RINGKASAN!A6";
  };

  // =========================================================================
  // 1) SHEET RINCIAN — tiap SPPBJ/Non PR PO sebagai DOKUMEN utuh (gaya Lampiran 2)
  //    Dibuat DULU supaya nomor barisnya bisa ditautkan dari sheet lain.
  // =========================================================================
  const wr = wb.addWorksheet("RINCIAN", {
    pageSetup: {
      paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.5, right: 0.4, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });
  wr.columns = [
    { width: 5.5 },   // A NO.
    { width: 7 },     // B JML
    { width: 8 },     // C SAT.
    { width: 44 },    // D NAMA BARANG / JASA
    { width: 32 },    // E SPESIFIKASI
    { width: 16 },    // F HARGA SATUAN
    { width: 18 },    // G JUMLAH
    { width: 24 },    // H (bantu) Grup
    { width: 38 },    // I (bantu) Mata Anggaran
    { width: 16 },    // J (bantu) Nilai
  ];
  [8, 9, 10].forEach((c) => (wr.getColumn(c).hidden = true));

  kop(wr, `Rincian ${d.judul}`, `${d.periode} · dicetak ${d.dicetak} · tiap SPPBJ / Non PR PO ditulis utuh seperti dokumen aslinya. Inilah dasar angka Realisasi di sheet lain.`, 7, TEAL);

  const dokumen = [...d.dokumen].sort((a, b) =>
    a.grup.localeCompare(b.grup) || a.tanggal.localeCompare(b.tanggal) || a.nomor.localeCompare(b.nomor));

  const barisDok: number[] = [];                 // baris awal tiap dokumen
  const barisPos = new Map<string, number>();    // `${grup}|${ma}` -> baris dokumen pertama yg memuatnya
  const pembagian: PosItem[] = [];               // item dipakai bersama -> dibagi di bawah

  let r = 5;
  dokumen.forEach((dok, di) => {
    const rs = r;
    barisDok.push(rs);
    if (di > 0) wr.getRow(rs).addPageBreak();

    // ---- baris navigasi (bukan bagian dokumen resmi, memudahkan lompat balik)
    const nav = wr.getRow(r);
    gayaTautan(nav.getCell(1), "‹ RINGKASAN", "#RINGKASAN!A6");
    gayaTautan(nav.getCell(4), `‹ ${d.labelGrup}: ${dok.grup}`, refSheet(dok.grup));
    gayaTautan(nav.getCell(6), "‹ DAFTAR PENGADAAN", `#DAFTAR!A${7 + di}`);
    nav.getCell(7).value = `Dokumen ${di + 1} dari ${dokumen.length}`;
    nav.getCell(7).font = { name: "Calibri", size: 8, italic: true, color: { argb: "FF94A3B8" } };
    nav.getCell(7).alignment = { horizontal: "right" };
    nav.height = 16;
    r++;

    // ---- kop dokumen
    const tulisKiri = (teks: string, tebal = false) => {
      wr.mergeCells(r, 1, r, 4);
      const c = wr.getCell(r, 1);
      c.value = teks;
      c.font = { name: "Calibri", size: 10, bold: tebal };
      c.alignment = { vertical: "middle" };
      wr.getRow(r).height = 15;
    };
    const tulisKanan = (baris: number, teks: string, kecil = false) => {
      wr.mergeCells(baris, 6, baris, 7);
      const c = wr.getCell(baris, 6);
      c.value = teks;
      c.font = { name: "Calibri", size: kecil ? 9 : 10, color: { argb: kecil ? "FF64748B" : TINTA } };
      c.alignment = { vertical: "middle", horizontal: "right" };
    };
    tulisKiri(`Nomor  : ${dok.nomor || "—"}`, true);
    tulisKanan(r, dok.kotaTanggal);
    r++;
    tulisKiri(`Tanggal: ${dok.tanggal || "—"}`);
    tulisKanan(r, [dok.sumber, dok.jenisAnggaran].filter(Boolean).join(" · "), true);
    r++;
    tulisKiri(`No. DRP: ${dok.noDRP || "Tanpa DRP"}`);
    r++;

    // ---- judul dokumen
    r++;
    wr.mergeCells(r, 1, r, 7);
    const j1 = wr.getCell(r, 1);
    j1.value = dok.judul.toUpperCase();
    j1.font = { name: "Calibri", size: 13, bold: true };
    j1.alignment = { horizontal: "center", vertical: "middle" };
    wr.getRow(r).height = 20;
    r++;
    wr.mergeCells(r, 1, r, 7);
    const j2 = wr.getCell(r, 1);
    j2.value = dok.nama || "—";
    j2.font = { name: "Calibri", size: 11, bold: true };
    j2.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    wr.getRow(r).height = 18;
    r += 2;

    // ---- keterangan pokok
    const ket = (label: string, isi: string) => {
      wr.mergeCells(r, 1, r, 3);
      wr.mergeCells(r, 4, r, 7);
      const a = wr.getCell(r, 1);
      a.value = label;
      a.font = { name: "Calibri", size: 10 };
      const b = wr.getCell(r, 4);
      b.value = `: ${isi || "—"}`;
      b.font = { name: "Calibri", size: 10 };
      b.alignment = { vertical: "middle", wrapText: true };
      wr.getRow(r).height = 15;
      r++;
    };
    if (dok.dasar) ket("Dasar Pelimpahan", dok.dasar);
    ket("Nama Pengadaan", dok.nama);
    ket("Mata Anggaran", dok.mataAnggaran.filter(Boolean).join(", "));
    if (dok.vendor) ket("Vendor", dok.vendor);
    r++;

    // ---- tabel item
    const rHead = r;
    const kepala = ["NO.", "JML", "SAT.", "NAMA BARANG / JASA", "SPESIFIKASI", "HARGA SATUAN", "JUMLAH"];
    const hr = wr.getRow(r);
    kepala.forEach((t, i) => {
      const c = hr.getCell(i + 1);
      c.value = t;
      c.font = { name: "Calibri", size: 10, bold: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LANGIT } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });
    hr.height = 26;
    r++;

    const rItem1 = r;
    let no = 0;
    const kotak = (baris: number, sampai = 7) => {
      for (let c = 1; c <= sampai; c++) {
        wr.getCell(baris, c).border = { top: { style: "hair", color: { argb: GARIS } }, left: { style: "thin" }, bottom: { style: "hair", color: { argb: GARIS } }, right: { style: "thin" } };
      }
    };

    for (const blok of dok.blok) {
      // sub-judul kapal
      wr.mergeCells(r, 1, r, 7);
      const k = wr.getCell(r, 1);
      k.value = blok.kapal;
      k.font = { name: "Calibri", size: 10, bold: true };
      k.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
      k.alignment = { vertical: "middle" };
      kotak(r);
      wr.getRow(r).height = 17;
      r++;

      let ketSebelum = "";
      for (const it of blok.items) {
        if ((it.keterangan || "") !== ketSebelum) {
          (it.keterangan || "").split("\n").map((s) => s.trim()).filter(Boolean).forEach((kl) => {
            wr.mergeCells(r, 4, r, 7);
            const c = wr.getCell(r, 4);
            c.value = kl;
            c.font = { name: "Calibri", size: 10, bold: true };
            c.alignment = { vertical: "middle", wrapText: true };
            kotak(r);
            wr.getRow(r).height = 15;
            r++;
          });
          ketSebelum = it.keterangan || "";
        }
        no++;
        const row = wr.getRow(r);
        row.getCell(1).value = no;
        row.getCell(2).value = it.jumlah || null;
        row.getCell(3).value = it.satuan || "";
        row.getCell(4).value = it.nama || "—";
        row.getCell(5).value = it.spesifikasi || "";
        row.getCell(6).value = it.harga || null;
        row.getCell(7).value = it.harga ? { formula: `B${r}*F${r}` } : (it.nilai || null);
        [1, 2, 3].forEach((c) => (row.getCell(c).alignment = { horizontal: "center", vertical: "middle" }));
        [4, 5].forEach((c) => (row.getCell(c).alignment = { vertical: "middle", wrapText: true }));
        gayaAngka(row.getCell(6));
        gayaAngka(row.getCell(7));
        row.font = { name: "Calibri", size: 10 };
        kotak(r);
        // tinggi mengikuti teks terpanjang supaya nama barang/spesifikasi tak terpotong
        const barisTeks = Math.max(1, Math.ceil((it.nama || "").length / 48), Math.ceil((it.spesifikasi || "").length / 36));
        row.height = 15 * Math.min(barisTeks, 6) + 2;
        // kolom bantu: hanya bila item ini jatuh ke SATU pos (dipakai bersama -> tabel PEMBAGIAN).
        // Nilainya tetap rumus terhadap kolom JUMLAH; bila item dibagi dgn kapal lain yang
        // di luar berkas ini, yang dibebankan hanya porsinya — bukan nilai penuh.
        const porsi = (p: PosItem) => (it.nilai ? p.nilai / it.nilai : 1);
        if (it.pos.length === 1) {
          const f = porsi(it.pos[0]);
          row.getCell(8).value = it.pos[0].grup;
          row.getCell(9).value = it.pos[0].ma;
          row.getCell(10).value = { formula: Math.abs(f - 1) < 1e-9 ? `G${r}` : `G${r}*${f.toFixed(8)}` };
        } else if (it.pos.length > 1) {
          it.pos.forEach((p) => pembagian.push({ ...p, baris: r, porsi: porsi(p) } as any));
        }
        r++;

        (it.rincian || []).filter((b) => b.trim()).forEach((b) => {
          wr.mergeCells(r, 4, r, 7);
          const c = wr.getCell(r, 4);
          c.value = `- ${b.trim().replace(/^[-•*]\s*/, "")}`;
          c.font = { name: "Calibri", size: 9, color: { argb: TINTA } };
          c.alignment = { vertical: "middle", wrapText: true };
          kotak(r);
          wr.getRow(r).height = 14;
          r++;
        });
      }
    }

    // ---- TOTAL dokumen
    const rTot = r;
    wr.mergeCells(rTot, 1, rTot, 6);
    const tl = wr.getCell(rTot, 1);
    tl.value = "TOTAL";
    tl.font = { name: "Calibri", size: 11, bold: true };
    tl.alignment = { horizontal: "right", vertical: "middle" };
    tl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
    const tv = wr.getCell(rTot, 7);
    tv.value = rItem1 <= rTot - 1 ? { formula: `SUM(G${rItem1}:G${rTot - 1})` } : dok.total;
    gayaAngka(tv, true);
    tv.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
    for (let c = 1; c <= 7; c++) {
      wr.getCell(rTot, c).border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "double" }, right: { style: "thin" } };
    }
    wr.getRow(rTot).height = 20;
    r++;

    // ---- tanda tangan (seperti dokumen asli)
    r++;
    const ttdBaris = (kiri: string, kanan: string, tebal = false, garisBawah = false) => {
      wr.mergeCells(r, 1, r, 3);
      wr.mergeCells(r, 5, r, 7);
      const a = wr.getCell(r, 1), b = wr.getCell(r, 5);
      a.value = kiri; b.value = kanan;
      [a, b].forEach((c) => {
        c.font = { name: "Calibri", size: 10, bold: tebal, underline: garisBawah };
        c.alignment = { horizontal: "center", vertical: "middle" };
      });
      wr.getRow(r).height = 15;
      r++;
    };
    ttdBaris("Dibuat oleh,", "Mengetahui,");
    ttdBaris("Staf Teknik", "Dept. Head Operasional dan Teknik");
    wr.getRow(r).height = 34; r++;
    ttdBaris(dok.stafTeknik || "—", dok.deptHead || "—", true, true);
    r += 2;
  });

  // ---- tabel PEMBAGIAN (item lintas kapal) — supaya tidak terhitung dua kali
  if (pembagian.length) {
    r++;
    wr.mergeCells(r, 1, r, 7);
    const h = wr.getCell(r, 1);
    h.value = "PEMBAGIAN NILAI ITEM YANG DIPAKAI BERSAMA BEBERAPA KAPAL";
    h.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    h.alignment = { horizontal: "center", vertical: "middle" };
    wr.getRow(r).height = 20;
    r++;
    const hd = wr.getRow(r);
    ["Kapal / Grup", "", "", "Mata Anggaran", "", "", "Nilai dibebankan"].forEach((t, i) => {
      const c = hd.getCell(i + 1);
      c.value = t;
      c.font = { name: "Calibri", size: 9, bold: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LANGIT } };
    });
    wr.mergeCells(r, 1, r, 3);
    wr.mergeCells(r, 4, r, 6);
    r++;
    for (const p of pembagian as any[]) {
      wr.mergeCells(r, 1, r, 3);
      wr.mergeCells(r, 4, r, 6);
      wr.getCell(r, 1).value = p.grup;
      wr.getCell(r, 4).value = p.ma;
      // tetap rumus ke baris itemnya, jadi kalau harga item diubah pembagiannya ikut
      wr.getCell(r, 7).value = p.baris ? { formula: `G${p.baris}*${(p.porsi ?? 1).toFixed(8)}` } : Math.round(p.nilai);
      gayaAngka(wr.getCell(r, 7));
      [1, 4].forEach((c) => (wr.getCell(r, c).font = { name: "Calibri", size: 9 }));
      wr.getCell(r, 8).value = p.grup;
      wr.getCell(r, 9).value = p.ma;
      wr.getCell(r, 10).value = { formula: `G${r}` };
      r++;
    }
  }
  const rAkhir = Math.max(r, 6);

  if (!dokumen.length) {
    wr.getCell(5, 1).value = "Belum ada pengadaan tercatat pada tipe anggaran ini.";
    wr.getCell(5, 1).font = { italic: true, color: { argb: "FF64748B" } };
  }

  // baris dokumen pertama yang memuat tiap pos (utk tautan dari sheet grup)
  dokumen.forEach((dok, di) => {
    for (const blok of dok.blok) {
      for (const it of blok.items) {
        for (const p of it.pos) {
          const kunci = `${p.grup}|${p.ma}`;
          if (!barisPos.has(kunci)) barisPos.set(kunci, barisDok[di]);
        }
      }
    }
  });

  // =========================================================================
  // 2) SHEET DAFTAR — indeks semua dokumen, tiap baris melompat ke dokumennya
  // =========================================================================
  const wd = wb.addWorksheet("DAFTAR", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  wd.columns = [{ width: 5 }, { width: 13 }, { width: 11 }, { width: 16 }, { width: 42 }, { width: 20 }, { width: 30 }, { width: 16 }, { width: 17 }, { width: 13 }];
  kop(wd, `Daftar Pengadaan — ${d.judul}`, `${d.periode} · ${dokumen.length} dokumen · klik "buka →" untuk melihat SPPBJ/Non PR PO itu utuh di sheet RINCIAN`, 10, TEAL);
  judulKolom(wd, 6, ["No", "Tanggal", "Sumber", "Nomor", "Nama Pengadaan", d.labelGrup, "Mata Anggaran", "Nilai Dokumen", `Dibebankan ke ${d.judul}`, "Dokumen"], TEAL, 1);

  dokumen.forEach((dok, i) => {
    const rr = 7 + i;
    const row = wd.getRow(rr);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = dok.tanggal || "–";
    row.getCell(3).value = dok.sumber;
    row.getCell(4).value = dok.nomor || "–";
    row.getCell(5).value = dok.nama;
    gayaTautan(row.getCell(6), dok.grup, refSheet(dok.grup), 10);
    row.getCell(7).value = dok.mataAnggaran.filter(Boolean).join(", ") || "–";
    row.getCell(8).value = Math.round(dok.total);
    row.getCell(9).value = Math.round(dok.dibebankan);
    gayaAngka(row.getCell(8));
    gayaAngka(row.getCell(9), true);
    // dokumen yang tak seluruhnya masuk anggaran ini -> ditandai, bukan disembunyikan
    if (Math.round(dok.dibebankan) !== Math.round(dok.total)) {
      row.getCell(9).font = { name: "Calibri", size: 10, bold: true, color: { argb: KUNING } };
      row.getCell(9).note = "Sebagian item dokumen ini di luar anggaran yang diexport (kapal/pos lain), jadi yang dihitung hanya bagian ini.";
    }
    gayaTautan(row.getCell(10), "buka →", `#RINCIAN!A${barisDok[i]}`);
    row.getCell(10).alignment = { horizontal: "center", vertical: "middle" };
    [1, 2, 3, 4].forEach((c) => (row.getCell(c).alignment = { horizontal: "center", vertical: "middle" }));
    [5, 7].forEach((c) => (row.getCell(c).alignment = { vertical: "middle", wrapText: true }));
    row.font = { name: "Calibri", size: 10 };
    row.getCell(7).font = { name: "Calibri", size: 9, color: { argb: "FF475569" } };
    row.height = 20;
    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
      cell.border = { bottom: { style: "hair", color: { argb: GARIS } } };
    }
  });
  if (dokumen.length) {
    const rt = 7 + dokumen.length;
    const t = wd.getRow(rt);
    t.getCell(7).value = "TOTAL";
    t.getCell(7).alignment = { horizontal: "right" };
    t.getCell(8).value = { formula: `SUM(H7:H${rt - 1})` };
    t.getCell(9).value = { formula: `SUM(I7:I${rt - 1})` };
    gayaAngka(t.getCell(8), true);
    gayaAngka(t.getCell(9), true);
    for (let c = 1; c <= 10; c++) {
      t.getCell(c).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      t.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    }
    t.height = 22;
    wd.autoFilter = { from: { row: 6, column: 1 }, to: { row: rt - 1, column: 10 } };

    // pengingat: angka yang harus sama dengan RINGKASAN adalah kolom "Dibebankan"
    const rc = rt + 2;
    wd.mergeCells(rc, 1, rc + 1, 10);
    const ck = wd.getCell(rc, 1);
    ck.value =
      `Kolom "Nilai Dokumen" = nilai SPPBJ/Non PR PO seutuhnya. Kolom "Dibebankan ke ${d.judul}" = bagian yang masuk pagu yang diexport di berkas ini — ` +
      `dokumen yang juga memuat item kapal/pos lain nilainya lebih besar dari yang dibebankan (ditandai kuning).\n` +
      `TOTAL kolom "Dibebankan" inilah yang harus sama dengan Realisasi di sheet RINGKASAN.`;
    ck.font = { name: "Calibri", size: 9, color: { argb: "FF1E3A8A" } };
    ck.alignment = { wrapText: true, vertical: "top" };
    ck.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LANGIT } };
    wd.getRow(rc).height = 26;
    wd.getRow(rc + 1).height = 22;
  }

  // =========================================================================
  // 3) SHEET PER GRUP — per Mata Anggaran, Realisasi = SUMIFS ke RINCIAN
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
    kop(ws, g.nama, `${d.judul} · ${d.periode}${infoSurat ? " · " + infoSurat : ""} · Realisasi diambil otomatis (SUMIFS) dari dokumen di sheet RINCIAN`, 9, d.warna);

    const back = ws.getRow(4);
    gayaTautan(back.getCell(1), "‹ kembali ke RINGKASAN", "#RINGKASAN!A6");
    gayaTautan(back.getCell(2), "lihat DAFTAR pengadaan →", "#DAFTAR!A6");

    judulKolom(ws, 6, ["Mata Anggaran", "Persetujuan Pusat", "Addendum", "Total Persetujuan", "Realisasi", "Sisa", "Terserap", "Status", "Dokumen"], d.warna);

    const r0 = 7;
    g.pos.forEach((pos, i) => {
      const rr = r0 + i;
      const row = ws.getRow(rr);
      row.getCell(1).value = pos.ma;
      row.getCell(2).value = pos.pagu;
      row.getCell(3).value = pos.addendum || 0;
      row.getCell(4).value = { formula: `B${rr}+C${rr}` };
      // Realisasi = jumlah nilai item di RINCIAN yang grup & MA-nya cocok (kolom bantu H/I/J)
      row.getCell(5).value = dokumen.length
        ? { formula: `SUMIFS(RINCIAN!$J$5:$J$${rAkhir},RINCIAN!$H$5:$H$${rAkhir},"${qq(g.nama)}",RINCIAN!$I$5:$I$${rAkhir},$A${rr})` }
        : 0;
      row.getCell(6).value = { formula: `D${rr}-E${rr}` };
      row.getCell(7).value = { formula: `IF(D${rr}=0,0,E${rr}/D${rr})` };
      row.getCell(8).value = { formula: `IF(D${rr}=0,"–",IF(G${rr}>1,"OVERBUDGET",IF(G${rr}>=0.8,"WASPADA","AMAN")))` };

      const barisTuju = barisPos.get(`${g.nama}|${pos.ma}`);
      const link = row.getCell(9);
      if (barisTuju) gayaTautan(link, "lihat dokumen →", `#RINCIAN!A${barisTuju}`);
      else {
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
  // 4) SHEET RINGKASAN — per grup, angkanya menunjuk baris TOTAL sheet grup
  // =========================================================================
  const ws = wb.addWorksheet("RINGKASAN", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  ws.columns = [{ width: 30 }, { width: 26 }, { width: 18 }, { width: 15 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 11 }, { width: 13 }];
  kop(ws, d.judul, `${d.periode} · dicetak ${d.dicetak} · klik nama ${d.labelGrup.toLowerCase()} untuk membuka rinciannya`, 9, d.warna);

  const navR = ws.getRow(5);
  gayaTautan(navR.getCell(1), "DAFTAR PENGADAAN →", "#DAFTAR!A6", 10);
  gayaTautan(navR.getCell(2), "DOKUMEN LENGKAP (RINCIAN) →", "#RINCIAN!A5", 10);

  judulKolom(ws, 6, [d.labelGrup, "Keterangan Surat", "Persetujuan Pusat", "Addendum", "Total Persetujuan", "Realisasi", "Sisa", "Terserap", "Status"], d.warna, 2);

  const g0 = 7;
  d.grup.forEach((g, i) => {
    const rr = g0 + i;
    const info = ringkasGrup[i];
    const row = ws.getRow(rr);
    const sheetRef = `'${info.sheet}'`;
    gayaTautan(row.getCell(1), g.nama, `#${sheetRef}!A6`, 11);
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
  ws.mergeCells(rN, 1, rN + 2, 9);
  const n = ws.getCell(rN, 1);
  n.value =
    `CARA MENELUSURI ANGKA (4 tingkat):\n` +
    `  1. RINGKASAN — per ${d.labelGrup.toLowerCase()}. Klik namanya → sheet ${d.labelGrup.toLowerCase()} (per Mata Anggaran).\n` +
    `  2. Sheet ${d.labelGrup.toLowerCase()} — klik "lihat dokumen →" pada satu Mata Anggaran → melompat ke SPPBJ/Non PR PO pertama yang membebani pos itu.\n` +
    `  3. DAFTAR — indeks seluruh ${dokumen.length} pengadaan; klik "buka →" untuk membuka dokumennya.\n` +
    `  4. RINCIAN — tiap SPPBJ ditulis utuh seperti dokumen aslinya (nomor, dasar pelimpahan, tabel barang, TOTAL, tanda tangan), 1 dokumen = 1 halaman cetak.\n` +
    `Realisasi tiap Mata Anggaran = SUMIFS atas kolom bantu di RINCIAN, dan angka di RINGKASAN menunjuk baris TOTAL sheet grup — ubah satu item, seluruh tingkat ikut menyesuaikan.`;
  n.font = { name: "Calibri", size: 9, color: { argb: "FF1E3A8A" } };
  n.alignment = { wrapText: true, vertical: "top" };
  n.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LANGIT } };
  [rN, rN + 1, rN + 2].forEach((x) => (ws.getRow(x).height = 30));

  // urutan tab: RINGKASAN → sheet grup → DAFTAR → RINCIAN
  const urut = ["RINGKASAN", ...ringkasGrup.map((x) => x.sheet), "DAFTAR", "RINCIAN"];
  urut.forEach((nm, i) => { const sh: any = wb.getWorksheet(nm); if (sh) sh.orderNo = i + 1; });
  wb.views = [{ activeTab: 0, x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, visibility: "visible" }];

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
