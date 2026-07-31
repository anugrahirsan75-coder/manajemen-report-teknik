"use client";
/**
 * Ekspor satu rencana docking ke Excel, dengan susunan yang sama dengan berkas
 * kerja cabang selama ini supaya hasilnya tinggal dikirim:
 *
 *   REPAIR LIST      — kolom No · Docking Code · Sub Code · Uraian · Volume ·
 *                      Harga Satuan · Jumlah · Keterangan, dikelompokkan per
 *                      bagian, ditutup sub jumlah + PPN.
 *   PENUNJANG        — per kelompok Mata Anggaran (romawi), tiap kelompok
 *                      ditutup Sub Jumlah / PPN / Jumlah.
 *   KONTROL ANGGARAN — pagu RKA vs usulan vs yang berlaku.
 *   JADWAL           — seluruh tahapan dengan tanggal hasil hitungan.
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  RencanaDocking, ItemRl, nilaiRl, nilaiPenunjang, nilaiBerlaku,
  rekapPenunjang, totalRl, KELOMPOK_PENUNJANG, PPN_BAKU, ppnDari, STATUS_USULAN,
} from "./types";
import { susunJadwal, SIFAT_LABEL, namaFase } from "./tahapan";

const tipis = { style: "thin" as const };
const border = { top: tipis, bottom: tipis, left: tipis, right: tipis };
const uang = "#,##0";
const BIRU = "FFDCE6F1";

const judul = (ws: ExcelJS.Worksheet, baris: string[], lebarKolom: number) => {
  baris.forEach((t, i) => {
    const c = ws.getCell(i + 1, 1);
    c.value = t;
    c.font = { bold: i === 0, size: i === 0 ? 13 : 11 };
    ws.mergeCells(i + 1, 1, i + 1, lebarKolom);
    c.alignment = { horizontal: "center" };
  });
};

function kepala(ws: ExcelJS.Worksheet, baris: number, kolom: string[], lebar: number[]) {
  const row = ws.getRow(baris);
  kolom.forEach((v, i) => {
    const c = row.getCell(i + 1);
    c.value = v; c.font = { bold: true }; c.border = border;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BIRU } };
  });
  lebar.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  row.height = 26;
}

export async function unduhRencana(r: RencanaDocking) {
  const wb = new ExcelJS.Workbook();
  const ppn = r.ppn ?? PPN_BAKU;

  // ── 1. REPAIR LIST ─────────────────────────────────────────────────────────
  const rl = wb.addWorksheet("REPAIR LIST", { views: [{ state: "frozen", ySplit: 7 }] });
  judul(rl, ["REPAIR LIST DOCKING", r.kapal, `TAHUN ${r.tahun}${r.galangan ? " · " + r.galangan : ""}`], 8);
  kepala(rl, 5, ["No.", "Docking Code", "Sub Code", "Uraian Pekerjaan", "Volume", "Satuan", "Harga Satuan", "Jumlah"],
    [6, 14, 10, 62, 9, 10, 16, 18]);

  let b = 6;
  const tulisKelompok = (jenis: "dok" | "floating", labelJenis: string) => {
    const items = (r.rl || []).filter((x) => x.jenis === jenis);
    if (!items.length) return;
    const jl = rl.getRow(b++);
    jl.getCell(1).value = labelJenis;
    jl.getCell(1).font = { bold: true, size: 11 };
    rl.mergeCells(jl.number, 1, jl.number, 8);

    const grup = new Map<string, ItemRl[]>();
    items.forEach((x) => {
      const k = x.grup || x.kode || "(tanpa kelompok)";
      if (!grup.has(k)) grup.set(k, []);
      grup.get(k)!.push(x);
    });
    let no = 0;
    grup.forEach((list, nama) => {
      const g = rl.getRow(b++);
      g.getCell(1).value = nama;
      g.getCell(1).font = { bold: true };
      g.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
      rl.mergeCells(g.number, 1, g.number, 8);
      list.forEach((it) => {
        const row = rl.getRow(b++);
        row.getCell(1).value = ++no;
        row.getCell(2).value = it.kode;
        row.getCell(3).value = it.sub;
        row.getCell(4).value = it.uraian;
        row.getCell(5).value = it.vol || 0;
        row.getCell(6).value = it.satuan;
        row.getCell(7).value = it.harga || 0;
        row.getCell(8).value = nilaiRl(it);
        [7, 8].forEach((c) => (row.getCell(c).numFmt = uang));
        row.getCell(4).alignment = { wrapText: true, vertical: "top" };
        for (let c = 1; c <= 8; c++) row.getCell(c).border = border;
      });
    });
    const sub = items.reduce((s, x) => s + nilaiRl(x), 0);
    ([["Sub Jumlah", sub], [`PPN ${ppn}%`, ppnDari(sub, ppn)], ["Jumlah", sub + ppnDari(sub, ppn)]] as const)
      .forEach(([t, v]) => {
        const row = rl.getRow(b++);
        row.getCell(7).value = t; row.getCell(7).font = { bold: true }; row.getCell(7).alignment = { horizontal: "right" };
        row.getCell(8).value = v; row.getCell(8).numFmt = uang; row.getCell(8).font = { bold: true };
        row.getCell(7).border = border; row.getCell(8).border = border;
      });
    b++;
  };
  tulisKelompok("dok", "A. PEKERJAAN DI ATAS DOK (DOCKING REPAIR)");
  tulisKelompok("floating", "B. PEKERJAAN TERAPUNG (FLOATING REPAIR)");

  // ── 2. PENUNJANG DOCKING ───────────────────────────────────────────────────
  const pn = wb.addWorksheet("PENUNJANG", { views: [{ state: "frozen", ySplit: 6 }] });
  judul(pn, ["SARANA PENUNJANG DALAM RANGKA DOCKING", r.kapal, `TAHUN ${r.tahun}`], 7);
  kepala(pn, 5, ["No.", "Volume", "Satuan", "Uraian Barang / Jasa", "Spesifikasi", "Harga Satuan", "Jumlah"],
    [6, 9, 10, 52, 30, 16, 18]);

  let p = 6;
  rekapPenunjang(r).forEach((k) => {
    const items = (r.penunjang || []).filter((x) => x.kelompok === k.key);
    if (!items.length) return;
    const h = pn.getRow(p++);
    h.getCell(1).value = `${k.romawi}.`;
    h.getCell(2).value = `${k.nama.toUpperCase()} (M.A. ${k.ma})`;
    h.getCell(2).font = { bold: true };
    pn.mergeCells(h.number, 2, h.number, 7);

    const grup = new Map<string, typeof items>();
    items.forEach((x) => {
      const g = x.grup || "Lain-lain";
      if (!grup.has(g)) grup.set(g, [] as any);
      (grup.get(g) as any).push(x);
    });
    grup.forEach((list, nama) => {
      const g = pn.getRow(p++);
      g.getCell(2).value = nama; g.getCell(2).font = { bold: true, italic: true };
      let no = 0;
      list.forEach((it) => {
        const row = pn.getRow(p++);
        row.getCell(1).value = ++no;
        row.getCell(2).value = it.vol || 0;
        row.getCell(3).value = it.satuan;
        row.getCell(4).value = it.uraian;
        row.getCell(5).value = it.spek || "";
        row.getCell(6).value = it.harga || 0;
        row.getCell(7).value = nilaiPenunjang(it);
        [6, 7].forEach((c) => (row.getCell(c).numFmt = uang));
        for (let c = 1; c <= 7; c++) row.getCell(c).border = border;
      });
    });
    ([["Sub Jumlah", k.subJumlah], [`PPN ${ppn}%`, k.ppn], ["Jumlah", k.jumlah]] as const).forEach(([t, v]) => {
      const row = pn.getRow(p++);
      row.getCell(6).value = t; row.getCell(6).font = { bold: true }; row.getCell(6).alignment = { horizontal: "right" };
      row.getCell(7).value = v; row.getCell(7).numFmt = uang; row.getCell(7).font = { bold: true };
      row.getCell(6).border = border; row.getCell(7).border = border;
    });
    p++;
  });

  // ── 3. KONTROL ANGGARAN ────────────────────────────────────────────────────
  const ka = wb.addWorksheet("KONTROL ANGGARAN");
  judul(ka, ["KONTROL ANGGARAN BIAYA DOCKING", `${r.kapal} — TAHUN ${r.tahun}`], 5);
  kepala(ka, 4, ["Mata Anggaran", "Uraian", "Pagu RKA", "Usulan Cabang", "Berlaku"], [16, 44, 18, 18, 18]);
  let k = 5;
  const rlTot = totalRl(r);
  const rlSetuju = (r.rl || []).reduce((s, x) => s + nilaiBerlaku(x), 0);
  const baris: [string, string, number, number, number][] = [
    ["5010403003", "Kontrak galangan (Repair List)", 0, rlTot + ppnDari(rlTot, ppn), rlSetuju + ppnDari(rlSetuju, ppn)],
    ...rekapPenunjang(r).map((x) => {
      const setuju = (r.penunjang || []).filter((y) => y.kelompok === x.key).reduce((s, y) => s + nilaiBerlaku(y), 0);
      return [x.ma, `${x.romawi}. ${x.nama}`, x.pagu, x.jumlah, setuju + ppnDari(setuju, ppn)] as [string, string, number, number, number];
    }),
  ];
  baris.forEach((v) => {
    const row = ka.getRow(k++);
    v.forEach((x, i) => {
      const c = row.getCell(i + 1);
      c.value = x; c.border = border;
      if (i >= 2) c.numFmt = uang;
    });
  });
  const jml = ka.getRow(k++);
  jml.getCell(2).value = "JUMLAH"; jml.getCell(2).font = { bold: true };
  [3, 4, 5].forEach((c) => {
    jml.getCell(c).value = baris.reduce((s, v) => s + (v[c - 1] as number), 0);
    jml.getCell(c).numFmt = uang; jml.getCell(c).font = { bold: true }; jml.getCell(c).border = border;
  });

  // ── 4. JADWAL ──────────────────────────────────────────────────────────────
  const jd = wb.addWorksheet("JADWAL", { views: [{ state: "frozen", ySplit: 5 }] });
  judul(jd, ["PROYEKSI TAHAPAN DOCKING", `${r.kapal} — naik dok ${r.naikDok || "belum ditetapkan"}`], 7);
  kepala(jd, 4, ["Fase", "Uraian Tahapan", "Sifat", "Mulai", "Selesai", "PIC", "Status"], [26, 52, 12, 13, 13, 22, 12]);
  let j = 5;
  const selesai = r.tugasSelesai || {};
  susunJadwal(r.naikDok || "", r.lamaDocking || 21, r.jadwal || {}, r.tugasTambahan || []).forEach((t) => {
    const row = jd.getRow(j++);
    row.getCell(1).value = namaFase(t.fase);
    row.getCell(2).value = t.uraian;
    row.getCell(3).value = SIFAT_LABEL[t.sifat];
    row.getCell(4).value = t.mulaiTgl;
    row.getCell(5).value = t.selesaiTgl;
    row.getCell(6).value = t.pic.join(", ");
    row.getCell(7).value = selesai[t.id] ? "Selesai" : "";
    for (let c = 1; c <= 7; c++) row.getCell(c).border = border;
  });

  // ── 5. RINGKAS SUMBER HARGA (jejak audit) ──────────────────────────────────
  const sh = wb.addWorksheet("SUMBER HARGA");
  kepala(sh, 1, ["Bagian", "Uraian", "Harga Satuan", "Sumber", "Acuan", "Pembanding"], [14, 56, 16, 18, 22, 26]);
  let s = 2;
  (r.rl || []).forEach((it) => {
    const row = sh.getRow(s++);
    row.getCell(1).value = "Repair List";
    row.getCell(2).value = it.uraian;
    row.getCell(3).value = it.harga || 0; row.getCell(3).numFmt = uang;
    row.getCell(4).value = it.sumber || "-";
    row.getCell(5).value = it.refHarga || "";
    row.getCell(6).value = it.bandingHi ? `${it.bandingLo?.toLocaleString("id-ID")} – ${it.bandingHi.toLocaleString("id-ID")}` : "";
    row.getCell(7).value = STATUS_USULAN[it.status || "usulan"].label;
  });
  (r.penunjang || []).forEach((it) => {
    const row = sh.getRow(s++);
    row.getCell(1).value = KELOMPOK_PENUNJANG.find((x) => x.key === it.kelompok)?.romawi || it.kelompok;
    row.getCell(2).value = it.uraian;
    row.getCell(3).value = it.harga || 0; row.getCell(3).numFmt = uang;
    row.getCell(4).value = it.sumber || "-";
    row.getCell(5).value = it.refHarga || "";
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `Rencana_Docking_${r.kapal.replace(/[^\w]+/g, "_")}_${r.tahun}.xlsx`);
}
