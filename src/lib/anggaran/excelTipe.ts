/**
 * Export Excel PER TIPE anggaran (Rutin / Docking / Persetujuan Lainnya).
 *
 * Satu pengadaan = SATU SHEET (tidak digabung), dan tiap tingkat ditarik dgn RUMUS:
 *
 *   RINGKASAN              per grup (kapal/surat)      --klik--> sheet grup
 *     └ sheet grup         BUDGET CONTROL gaya Lampiran 2:
 *                          Mata Anggaran (Persetujuan Awal + Addendum = Total Persetujuan)
 *                          lalu baris PEKERJAAN = tiap pengadaan yang membebaninya
 *                                                  --klik--> sheet dokumennya
 *     └ DAFTAR             indeks semua dokumen        --klik--> sheet dokumennya
 *     └ PEMBEBANAN         buku pembebanan: dokumen x kapal x Mata Anggaran (dasar angka)
 *     └ sheet per dokumen  SPPBJ/Non PR PO ditulis utuh spt dokumen aslinya
 *
 * Rantai angka: item di sheet dokumen -> PEMBEBANAN (SUMIFS ke sheet dokumen itu)
 *               -> baris Pekerjaan di sheet grup -> TOTAL MA -> RINGKASAN.
 * Ubah satu harga di sheet dokumen, seluruh tingkat ikut menyesuaikan.
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
  pagu: number;          // Persetujuan Awal (Persetujuan Pusat pertama)
  addendum: number;      // tambahan yang disetujui
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
  judul: string;
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
  dibebankan: number;    // bagian yang masuk anggaran tipe ini
}
export interface DataTipe {
  tipe: "rutin" | "docking" | "lainnya";
  judul: string;
  periode: string;
  labelGrup: string;     // "Kapal" / "Surat Persetujuan" / "Periode"
  warna: string;
  dicetak: string;
  grup: GrupAnggaran[];
  dokumen: Dokumen[];
}

const amanSheet = (s: string) => (s || "Sheet").replace(/[\\/*?:\[\]']/g, "-").slice(0, 31).trim();
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

/** warna status & serapan otomatis */
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

  const dipakai = new Set<string>();
  const namaUnik = (usul: string) => {
    let n = amanSheet(usul) || "Sheet";
    let k = 2;
    while (dipakai.has(n.toLowerCase())) n = amanSheet(`${usul.slice(0, 27)} ${k++}`);
    dipakai.add(n.toLowerCase());
    return n;
  };

  const namaSheet = new Map<string, string>();   // nama grup -> nama sheet
  d.grup.forEach((g) => namaSheet.set(g.nama, namaUnik(g.pendek || g.nama)));
  ["RINGKASAN", "DAFTAR", "PEMBEBANAN"].forEach((x) => dipakai.add(x.toLowerCase()));
  const refGrup = (grup: string) => {
    const sn = namaSheet.get(grup);
    return sn ? `#'${sn}'!A6` : "#RINGKASAN!A6";
  };

  const dokumen = [...d.dokumen].sort((a, b) =>
    a.grup.localeCompare(b.grup) || a.tanggal.localeCompare(b.tanggal) || a.nomor.localeCompare(b.nomor));

  // nama sheet tiap dokumen: "01. Cleaning Tank Deck Mesin"
  const sheetDok = dokumen.map((dok, i) => {
    const inti = (dok.nama || dok.nomor || "Pengadaan")
      .replace(/^(Kebutuhan|Pengadaan|Jasa)\s+/i, "")
      .replace(/\s+(Tahun\s+)?20\d\d$/i, "");
    return namaUnik(`${String(i + 1).padStart(2, "0")}. ${inti}`);
  });

  // =========================================================================
  // 1) SHEET PER DOKUMEN — SPPBJ/Non PR PO ditulis utuh (gaya dokumen asli)
  //    Kolom bantu H/I/J (Grup, Mata Anggaran, Nilai) disembunyikan: dasar SUMIFS.
  // =========================================================================
  dokumen.forEach((dok, di) => {
    const wr = wb.addWorksheet(sheetDok[di], {
      pageSetup: {
        paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.5, right: 0.4, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 },
      },
    });
    wr.columns = [
      { width: 5.5 }, { width: 7 }, { width: 8 }, { width: 44 }, { width: 32 }, { width: 16 }, { width: 18 },
      { width: 24 }, { width: 38 }, { width: 16 },
    ];
    [8, 9, 10].forEach((c) => (wr.getColumn(c).hidden = true));

    let r = 1;
    // ---- baris navigasi
    const nav = wr.getRow(r);
    gayaTautan(nav.getCell(1), "‹ RINGKASAN", "#RINGKASAN!A6");
    gayaTautan(nav.getCell(4), `‹ ${d.labelGrup}: ${dok.grup}`, refGrup(dok.grup));
    gayaTautan(nav.getCell(6), "‹ DAFTAR PENGADAAN", `#DAFTAR!A${7 + di}`);
    nav.getCell(7).value = `Dokumen ${di + 1} dari ${dokumen.length}`;
    nav.getCell(7).font = { name: "Calibri", size: 8, italic: true, color: { argb: "FF94A3B8" } };
    nav.getCell(7).alignment = { horizontal: "right" };
    nav.height = 16;
    r += 2;

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
    r += 2;

    // ---- judul dokumen
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
    wr.views = [{ state: "frozen", ySplit: r }];
    r++;

    const rItem1 = r;
    let no = 0;
    const kotak = (baris: number) => {
      for (let c = 1; c <= 7; c++) {
        wr.getCell(baris, c).border = { top: { style: "hair", color: { argb: GARIS } }, left: { style: "thin" }, bottom: { style: "hair", color: { argb: GARIS } }, right: { style: "thin" } };
      }
    };
    const pembagianDok: { grup: string; ma: string; baris: number; porsi: number }[] = [];

    for (const blok of dok.blok) {
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
        const barisTeks = Math.max(1, Math.ceil((it.nama || "").length / 48), Math.ceil((it.spesifikasi || "").length / 36));
        row.height = 15 * Math.min(barisTeks, 6) + 2;

        const porsi = (p: PosItem) => (it.nilai ? p.nilai / it.nilai : 1);
        if (it.pos.length === 1) {
          const f = porsi(it.pos[0]);
          row.getCell(8).value = it.pos[0].grup;
          row.getCell(9).value = it.pos[0].ma;
          row.getCell(10).value = { formula: Math.abs(f - 1) < 1e-9 ? `G${r}` : `G${r}*${f.toFixed(8)}` };
        } else if (it.pos.length > 1) {
          it.pos.forEach((p) => pembagianDok.push({ grup: p.grup, ma: p.ma, baris: r, porsi: porsi(p) }));
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
    r += 2;

    // ---- tanda tangan
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

    // ---- item yang dipakai bersama beberapa kapal: dibagi di sini, sekali saja
    if (pembagianDok.length) {
      wr.mergeCells(r, 1, r, 7);
      const h = wr.getCell(r, 1);
      h.value = "PEMBAGIAN ITEM YANG DIPAKAI BERSAMA BEBERAPA KAPAL";
      h.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
      h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
      h.alignment = { horizontal: "center", vertical: "middle" };
      wr.getRow(r).height = 18;
      r++;
      for (const p of pembagianDok) {
        wr.mergeCells(r, 1, r, 3);
        wr.mergeCells(r, 4, r, 6);
        wr.getCell(r, 1).value = p.grup;
        wr.getCell(r, 4).value = p.ma;
        wr.getCell(r, 7).value = { formula: `G${p.baris}*${p.porsi.toFixed(8)}` };
        gayaAngka(wr.getCell(r, 7));
        [1, 4].forEach((c) => (wr.getCell(r, c).font = { name: "Calibri", size: 9 }));
        wr.getCell(r, 8).value = p.grup;
        wr.getCell(r, 9).value = p.ma;
        wr.getCell(r, 10).value = { formula: `G${r}` };
        r++;
      }
    }
    (wr as any).__akhir = r;
  });

  const akhirDok = (i: number) => ((wb.getWorksheet(sheetDok[i]) as any)?.__akhir ?? 200) as number;

  // =========================================================================
  // 2) PEMBEBANAN — 1 baris per (dokumen x grup x Mata Anggaran); dasar semua angka
  // =========================================================================
  const wp = wb.addWorksheet("PEMBEBANAN", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  wp.columns = [{ width: 5 }, { width: 26 }, { width: 40 }, { width: 40 }, { width: 16 }, { width: 18 }, { width: 14 }];
  kop(wp, "Buku Pembebanan Anggaran", `${d.judul} · ${d.periode} · setiap baris = bagian satu dokumen yang membebani satu Mata Anggaran. Nilainya dihitung langsung dari sheet dokumennya (SUMIFS), bukan diketik ulang.`, 7, TEAL);
  judulKolom(wp, 6, ["No", d.labelGrup, "Mata Anggaran", "Pengadaan (dokumen)", "Nomor", "Nilai Dibebankan", "Dokumen"], TEAL, 2);

  interface BarisBeban { grup: string; ma: string; di: number; baris: number }
  const beban: BarisBeban[] = [];
  {
    let rp = 7;
    let n = 0;
    dokumen.forEach((dok, di) => {
      // pasangan grup|ma yang disentuh dokumen ini
      const pasang = new Map<string, { grup: string; ma: string }>();
      dok.blok.forEach((b) => b.items.forEach((it) => it.pos.forEach((p) => pasang.set(`${p.grup}|${p.ma}`, { grup: p.grup, ma: p.ma }))));
      for (const { grup, ma } of Array.from(pasang.values())) {
        const sn = sheetDok[di];
        const row = wp.getRow(rp);
        row.getCell(1).value = ++n;
        row.getCell(2).value = grup;
        row.getCell(3).value = ma;
        row.getCell(4).value = dok.nama;
        row.getCell(5).value = dok.nomor || "–";
        row.getCell(6).value = {
          formula: `SUMIFS('${sn}'!$J$1:$J$${akhirDok(di)},'${sn}'!$H$1:$H$${akhirDok(di)},$B${rp},'${sn}'!$I$1:$I$${akhirDok(di)},$C${rp})`,
        };
        gayaAngka(row.getCell(6), true);
        gayaTautan(row.getCell(7), "buka →", `#'${sn}'!A1`);
        row.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
        [2, 3, 4].forEach((c) => (row.getCell(c).alignment = { vertical: "middle", wrapText: true }));
        row.font = { name: "Calibri", size: 9 };
        row.height = 20;
        for (let c = 1; c <= 7; c++) {
          const cell = row.getCell(c);
          if (n % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
          cell.border = { bottom: { style: "hair", color: { argb: GARIS } } };
        }
        beban.push({ grup, ma, di, baris: rp });
        rp++;
      }
    });
    if (n) {
      const t = wp.getRow(rp);
      t.getCell(5).value = "TOTAL";
      t.getCell(5).alignment = { horizontal: "right" };
      t.getCell(6).value = { formula: `SUM(F7:F${rp - 1})` };
      gayaAngka(t.getCell(6), true);
      for (let c = 1; c <= 7; c++) {
        t.getCell(c).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
        t.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
      }
      t.height = 22;
      wp.autoFilter = { from: { row: 6, column: 1 }, to: { row: rp - 1, column: 7 } };
    } else {
      wp.getCell(7, 2).value = "Belum ada pengadaan tercatat pada tipe anggaran ini.";
      wp.getCell(7, 2).font = { italic: true, color: { argb: "FF64748B" } };
    }
  }

  // =========================================================================
  // 3) SHEET DAFTAR — indeks dokumen
  // =========================================================================
  const wd = wb.addWorksheet("DAFTAR", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  wd.columns = [{ width: 5 }, { width: 13 }, { width: 11 }, { width: 16 }, { width: 42 }, { width: 20 }, { width: 30 }, { width: 16 }, { width: 17 }, { width: 15 }];
  kop(wd, `Daftar Pengadaan — ${d.judul}`, `${d.periode} · ${dokumen.length} dokumen · tiap pengadaan punya SHEET SENDIRI; klik "buka sheet →"`, 10, TEAL);
  judulKolom(wd, 6, ["No", "Tanggal", "Sumber", "Nomor", "Nama Pengadaan", d.labelGrup, "Mata Anggaran", "Nilai Dokumen", `Dibebankan ke ${d.judul}`, "Sheet"], TEAL, 1);

  dokumen.forEach((dok, i) => {
    const rr = 7 + i;
    const row = wd.getRow(rr);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = dok.tanggal || "–";
    row.getCell(3).value = dok.sumber;
    row.getCell(4).value = dok.nomor || "–";
    row.getCell(5).value = dok.nama;
    gayaTautan(row.getCell(6), dok.grup, refGrup(dok.grup), 10);
    row.getCell(7).value = dok.mataAnggaran.filter(Boolean).join(", ") || "–";
    row.getCell(8).value = Math.round(dok.total);
    const barisBeban = beban.filter((b) => b.di === i).map((b) => `PEMBEBANAN!F${b.baris}`);
    row.getCell(9).value = barisBeban.length ? { formula: barisBeban.join("+") } : Math.round(dok.dibebankan);
    gayaAngka(row.getCell(8));
    gayaAngka(row.getCell(9), true);
    if (Math.round(dok.dibebankan) !== Math.round(dok.total)) {
      row.getCell(9).font = { name: "Calibri", size: 10, bold: true, color: { argb: KUNING } };
      row.getCell(9).note = "Sebagian item dokumen ini di luar anggaran yang diexport (kapal/pos lain), jadi yang dihitung hanya bagian ini.";
    }
    gayaTautan(row.getCell(10), "buka sheet →", `#'${sheetDok[i]}'!A1`);
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

    const rc = rt + 2;
    wd.mergeCells(rc, 1, rc + 1, 10);
    const ck = wd.getCell(rc, 1);
    ck.value =
      `Kolom "Nilai Dokumen" = nilai SPPBJ/Non PR PO seutuhnya. Kolom "Dibebankan ke ${d.judul}" = bagian yang masuk pagu berkas ini — ` +
      `dokumen yang juga memuat kapal/pos lain nilainya lebih besar dari yang dibebankan (ditandai kuning).\n` +
      `TOTAL kolom "Dibebankan" = Realisasi di sheet RINGKASAN = TOTAL sheet PEMBEBANAN.`;
    ck.font = { name: "Calibri", size: 9, color: { argb: "FF1E3A8A" } };
    ck.alignment = { wrapText: true, vertical: "top" };
    ck.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LANGIT } };
    wd.getRow(rc).height = 26;
    wd.getRow(rc + 1).height = 22;
  }

  // =========================================================================
  // 4) SHEET PER GRUP — BUDGET CONTROL gaya Lampiran 2
  //    Mata Anggaran (Persetujuan Awal + Addendum = Total Persetujuan)
  //    lalu baris PEKERJAAN = dokumen yang membebani pos itu
  // =========================================================================
  const ringkasGrup: { nama: string; sheet: string; barisTotal: number }[] = [];

  for (const g of d.grup) {
    const sn = namaSheet.get(g.nama)!;
    const ws = wb.addWorksheet(sn, {
      views: [{ state: "frozen", ySplit: 6 }],
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 } },
    });
    ws.columns = [{ width: 4.5 }, { width: 44 }, { width: 17 }, { width: 15 }, { width: 18 }, { width: 18 }, { width: 17 }, { width: 10 }, { width: 12 }, { width: 14 }];

    const infoSurat = [g.noSurat ? `No. Surat ${g.noSurat}` : "", g.noSuratAddendum ? `Addendum ${g.noSuratAddendum}` : ""].filter(Boolean).join(" · ");
    kop(ws, `Budget Control — ${g.nama}`, `${d.judul} · ${d.periode}${infoSurat ? " · " + infoSurat : ""} · baris tebal = Mata Anggaran, di bawahnya pekerjaan/pengadaan yang membebaninya (klik untuk membuka dokumennya)`, 10, d.warna);

    const back = ws.getRow(4);
    gayaTautan(back.getCell(2), "‹ RINGKASAN", "#RINGKASAN!A6");
    gayaTautan(back.getCell(5), "DAFTAR pengadaan →", "#DAFTAR!A6");
    gayaTautan(back.getCell(7), "buku PEMBEBANAN →", "#PEMBEBANAN!A6");

    judulKolom(ws, 6, ["No", "Mata Anggaran / Pekerjaan", "Persetujuan Awal", "Addendum", "Total Persetujuan", "Realisasi", "Sisa", "Terserap", "Status", "Dokumen"], d.warna, 2);

    let rr = 7;
    const barisMA: number[] = [];
    g.pos.forEach((pos, i) => {
      const rMA = rr;
      barisMA.push(rMA);
      const kerja = beban.filter((b) => b.grup === g.nama && b.ma === pos.ma);

      const row = ws.getRow(rMA);
      row.getCell(1).value = i + 1;
      row.getCell(2).value = pos.ma;
      row.getCell(3).value = pos.pagu;
      row.getCell(4).value = pos.addendum || 0;
      row.getCell(5).value = { formula: `C${rMA}+D${rMA}` };
      // Realisasi MA = jumlah baris pekerjaan di bawahnya (diisi setelah barisnya dibuat)
      row.getCell(7).value = { formula: `E${rMA}-F${rMA}` };
      row.getCell(8).value = { formula: `IF(E${rMA}=0,0,F${rMA}/E${rMA})` };
      row.getCell(9).value = { formula: `IF(E${rMA}=0,"–",IF(H${rMA}>1,"OVERBUDGET",IF(H${rMA}>=0.8,"WASPADA","AMAN")))` };
      row.getCell(10).value = kerja.length ? `${kerja.length} dokumen` : "—";
      row.getCell(10).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(10).font = { name: "Calibri", size: 9, color: { argb: kerja.length ? TINTA : "FF94A3B8" } };
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(2).font = { name: "Calibri", size: 10, bold: true };
      row.getCell(2).alignment = { vertical: "middle", wrapText: true };
      for (let c = 3; c <= 7; c++) gayaAngka(row.getCell(c), true);
      row.getCell(4).numFmt = RP_ADD;
      row.getCell(4).font = { name: "Calibri", size: 10, bold: true, color: { argb: UNGU } };
      row.getCell(8).numFmt = PCT;
      row.getCell(8).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(8).font = { bold: true };
      row.getCell(9).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(9).font = { name: "Calibri", size: 9, bold: true };
      row.height = 22;
      for (let c = 1; c <= 10; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LANGIT } };
        cell.border = { top: { style: "thin", color: { argb: GARIS } }, bottom: { style: "hair", color: { argb: GARIS } } };
      }
      rr++;

      // baris pekerjaan (dokumen yang membebani pos ini)
      const r1 = rr;
      kerja.forEach((b, k) => {
        const dok = dokumen[b.di];
        const rk = ws.getRow(rr);
        rk.getCell(1).value = `${i + 1}.${k + 1}`;
        rk.getCell(2).value = `   ${dok.nama}`;
        rk.getCell(6).value = { formula: `PEMBEBANAN!F${b.baris}` };
        gayaAngka(rk.getCell(6));
        rk.getCell(7).value = dok.tanggal;
        rk.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
        rk.getCell(7).font = { name: "Calibri", size: 9, color: { argb: "FF64748B" } };
        rk.getCell(8).value = dok.sumber;
        rk.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
        rk.getCell(8).font = { name: "Calibri", size: 8, color: { argb: "FF64748B" } };
        rk.getCell(9).value = dok.nomor || "–";
        rk.getCell(9).alignment = { horizontal: "center", vertical: "middle" };
        rk.getCell(9).font = { name: "Calibri", size: 8, color: { argb: "FF64748B" } };
        gayaTautan(rk.getCell(10), "buka →", `#'${sheetDok[b.di]}'!A1`);
        rk.getCell(10).alignment = { horizontal: "center", vertical: "middle" };
        rk.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
        rk.getCell(1).font = { name: "Calibri", size: 8, color: { argb: "FF94A3B8" } };
        rk.getCell(2).font = { name: "Calibri", size: 9, color: { argb: TINTA } };
        rk.getCell(2).alignment = { vertical: "middle", wrapText: true };
        rk.height = 17;
        for (let c = 1; c <= 10; c++) rk.getCell(c).border = { bottom: { style: "hair", color: { argb: GARIS } } };
        rr++;
      });
      // Realisasi MA = SUM baris pekerjaan (kalau tak ada pekerjaan -> 0)
      ws.getCell(rMA, 6).value = kerja.length ? { formula: `SUM(F${r1}:F${rr - 1})` } : 0;
      gayaAngka(ws.getCell(rMA, 6), true);
    });

    const rT = rr;
    const t = ws.getRow(rT);
    t.getCell(2).value = "TOTAL";
    (["C", "D", "E", "F", "G"] as const).forEach((col, i) => {
      const c = i + 3;
      // hanya baris Mata Anggaran yang dijumlah (baris pekerjaan sudah masuk di dalamnya)
      t.getCell(c).value = barisMA.length ? { formula: barisMA.map((b) => `${col}${b}`).join("+") } : 0;
      gayaAngka(t.getCell(c), true);
    });
    t.getCell(4).numFmt = RP_ADD;
    t.getCell(8).value = { formula: `IF(E${rT}=0,0,F${rT}/E${rT})` };
    t.getCell(8).numFmt = PCT;
    t.getCell(8).alignment = { horizontal: "center" };
    for (let c = 1; c <= 10; c++) {
      t.getCell(c).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      t.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: d.warna } };
    }
    t.height = 24;

    if (barisMA.length) {
      warnaStatus(ws, "H", "I", 7, rT - 1, 2);
      ws.addConditionalFormatting({ ref: `F7:F${rT - 1}`, rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], color: { argb: TEAL } } as any] });
    }
    ringkasGrup.push({ nama: g.nama, sheet: sn, barisTotal: rT });
  }

  // =========================================================================
  // 5) SHEET RINGKASAN
  // =========================================================================
  const ws = wb.addWorksheet("RINGKASAN", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  ws.columns = [{ width: 30 }, { width: 26 }, { width: 18 }, { width: 15 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 11 }, { width: 13 }];
  kop(ws, d.judul, `${d.periode} · dicetak ${d.dicetak} · klik nama ${d.labelGrup.toLowerCase()} untuk membuka Budget Control-nya`, 9, d.warna);

  const navR = ws.getRow(5);
  gayaTautan(navR.getCell(1), "DAFTAR PENGADAAN →", "#DAFTAR!A6", 10);
  gayaTautan(navR.getCell(2), "BUKU PEMBEBANAN →", "#PEMBEBANAN!A6", 10);

  judulKolom(ws, 6, [d.labelGrup, "Keterangan Surat", "Persetujuan Awal", "Addendum", "Total Persetujuan", "Realisasi", "Sisa", "Terserap", "Status"], d.warna, 2);

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
    row.getCell(3).value = { formula: `${sheetRef}!C${info.barisTotal}` };
    row.getCell(4).value = { formula: `${sheetRef}!D${info.barisTotal}` };
    row.getCell(5).value = { formula: `${sheetRef}!E${info.barisTotal}` };
    row.getCell(6).value = { formula: `${sheetRef}!F${info.barisTotal}` };
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

  const rN = gT + 2;
  ws.mergeCells(rN, 1, rN + 2, 9);
  const n = ws.getCell(rN, 1);
  n.value =
    `SUSUNAN BERKAS — satu pengadaan satu sheet, tidak dicampur:\n` +
    `  1. RINGKASAN (halaman ini) — per ${d.labelGrup.toLowerCase()}. Klik namanya → Budget Control ${d.labelGrup.toLowerCase()} itu.\n` +
    `  2. Sheet ${d.labelGrup.toLowerCase()} — gaya Lampiran 2: tiap Mata Anggaran punya Persetujuan Awal + Addendum = Total Persetujuan, lalu daftar pekerjaan/pengadaan yang membebaninya; klik "buka →" untuk melihat dokumennya.\n` +
    `  3. DAFTAR — indeks ${dokumen.length} pengadaan.  4. PEMBEBANAN — buku pembebanan (dokumen × Mata Anggaran), dasar semua angka.\n` +
    `  5. Sheet 01..${String(dokumen.length).padStart(2, "0")} — tiap SPPBJ/Non PR PO utuh seperti dokumen aslinya, siap cetak 1 halaman.\n` +
    `Realisasi tiap Mata Anggaran = jumlah baris pekerjaannya; tiap pekerjaan = SUMIFS ke sheet dokumennya. Ubah satu harga di sheet dokumen → semua tingkat ikut berubah.`;
  n.font = { name: "Calibri", size: 9, color: { argb: "FF1E3A8A" } };
  n.alignment = { wrapText: true, vertical: "top" };
  n.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LANGIT } };
  [rN, rN + 1, rN + 2].forEach((x) => (ws.getRow(x).height = 32));

  // urutan tab: RINGKASAN → sheet grup → DAFTAR → PEMBEBANAN → sheet dokumen
  const urut = ["RINGKASAN", ...ringkasGrup.map((x) => x.sheet), "DAFTAR", "PEMBEBANAN", ...sheetDok];
  urut.forEach((nm, i) => { const sh: any = wb.getWorksheet(nm); if (sh) sh.orderNo = i + 1; });
  wb.views = [{ activeTab: 0, x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, visibility: "visible" }];

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
