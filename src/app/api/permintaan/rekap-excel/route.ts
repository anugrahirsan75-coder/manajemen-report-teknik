import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

/**
 * Rekap Monitoring Permintaan Kapal → Excel, untuk rapat & laporan ke GM.
 *
 * Yang dikirim ke sini adalah baris yang SUDAH tampil di layar (dengan
 * saringannya), bukan pembacaan ulang database: penilaian dan status disusun
 * di peramban, dan berkasnya harus sama persis dengan yang dilihat orang.
 *
 * Tiga lembar:
 *  · RINGKASAN    — per kapal: terbuka, urgent, menggantung, jumlah barang mesin & deck
 *  · PERLU TINDAKAN — urgent yang belum diproses, diurutkan dari yang paling lama
 *  · RINCIAN      — seluruh barang beserta penilaian, status dan pranala berkas
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BarisXls {
  kapal: string; jenis: string; dikirim: string; umur: number; nama: string; spesifikasi: string;
  jumlah: string; satuan: string; sumber: string; prioritas: string; klasifikasi: string; keputusan: string;
  status: string; pengadaan: string; catatan: string; pic: string; dimintaUlang: number; lk: boolean;
  menggantung: boolean; berkasUrl: string; urgent: boolean;
}
interface KapalXls {
  kapal: string; total: number; terbuka: number; belum: number; urgent: number; menggantung: number;
  proses: number; selesai: number; mesin: number; deck: number;
}

const BIRU = "FF16357F";
const tipis = { style: "hair" as const, color: { argb: "FFCBD5E1" } };

function judul(ws: ExcelJS.Worksheet, teks: string, sub: string, lebar: number) {
  ws.mergeCells(1, 1, 1, lebar);
  const j = ws.getCell(1, 1);
  j.value = teks;
  j.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  j.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BIRU } };
  j.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 26;
  ws.mergeCells(2, 1, 2, lebar);
  const s = ws.getCell(2, 1);
  s.value = sub;
  s.font = { size: 10, italic: true, color: { argb: "FF475569" } };
  s.alignment = { indent: 1, wrapText: true };
  ws.getRow(2).height = 28;
}

function kepala(ws: ExcelJS.Worksheet, r: number, kolom: { t: string; l: number }[]) {
  ws.columns = kolom.map((k) => ({ width: k.l }));
  const row = ws.getRow(r);
  kolom.forEach((k, i) => {
    const c = row.getCell(i + 1);
    c.value = k.t;
    c.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  row.height = 30;
  ws.views = [{ state: "frozen", ySplit: r }];
}

const WARNA_STATUS: Record<string, string> = {
  "Belum dievaluasi": "FFF1F5F9", "Menunggu keputusan": "FFFEF3C7", "Disetujui — belum SPPBJ": "FFFFEDD5",
  "Kirim dari stok": "FFECFCCB", "Ditunda": "FFE2E8F0", "SPPBJ dibuat": "FFE0F2FE", "SPBJ / sedang diadakan": "FFE0E7FF",
  "Selesai": "FFD1FAE5", "Ditolak": "FFFFE4E6",
};

function rincian(ws: ExcelJS.Worksheet, baris: BarisXls[], mulai: number) {
  const kol = [
    { t: "No", l: 5 }, { t: "Kapal", l: 18 }, { t: "Borang", l: 12 }, { t: "Diminta", l: 11 }, { t: "Umur (hari)", l: 8 },
    { t: "Barang", l: 36 }, { t: "Spesifikasi", l: 24 }, { t: "Jumlah", l: 9 }, { t: "Sumber", l: 13 },
    { t: "Prioritas", l: 11 }, { t: "Klasifikasi", l: 12 }, { t: "Keputusan", l: 10 }, { t: "Status", l: 20 },
    { t: "Pengadaan", l: 20 }, { t: "Catatan kantor", l: 30 }, { t: "PIC", l: 12 }, { t: "Tanda", l: 18 }, { t: "Berkas", l: 9 },
  ];
  kepala(ws, mulai, kol);
  baris.forEach((b, i) => {
    const r = ws.getRow(mulai + 1 + i);
    const tanda = [b.menggantung ? "MENGGANTUNG" : "", b.dimintaUlang ? `diminta ulang ${b.dimintaUlang}×` : "", b.lk ? "ada LK" : ""]
      .filter(Boolean).join(" · ");
    const isi: (string | number)[] = [
      i + 1, b.kapal, b.jenis, b.dikirim, b.umur, b.nama, b.spesifikasi, `${b.jumlah} ${b.satuan}`.trim(), b.sumber || "",
      b.prioritas, b.klasifikasi, b.keputusan, b.status, b.pengadaan, b.catatan, b.pic, tanda, "",
    ];
    isi.forEach((v, k) => {
      const c = r.getCell(k + 1);
      c.value = v;
      c.font = { size: 10, bold: k === 9 && b.urgent, color: k === 16 && b.menggantung ? { argb: "FFB91C1C" } : undefined };
      c.alignment = { vertical: "top", wrapText: [5, 6, 13, 14, 16].includes(k) };
      c.border = { bottom: tipis };
    });
    const st = WARNA_STATUS[b.status];
    if (st) r.getCell(13).fill = { type: "pattern", pattern: "solid", fgColor: { argb: st } };
    if (b.berkasUrl) {
      const c = r.getCell(18);
      c.value = { text: "Buka", hyperlink: b.berkasUrl };
      c.font = { size: 10, color: { argb: "FF1D4ED8" }, underline: true };
    }
  });
  ws.autoFilter = { from: { row: mulai, column: 1 }, to: { row: mulai + baris.length, column: kol.length } };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const baris: BarisXls[] = Array.isArray(body?.baris) ? body.baris : [];
    const kapal: KapalXls[] = Array.isArray(body?.kapal) ? body.kapal : [];
    const label: string = String(body?.label || "Semua periode");
    if (!baris.length) return NextResponse.json({ ok: false, error: "Tidak ada baris untuk direkap" }, { status: 400 });

    const wb = new ExcelJS.Workbook();
    wb.creator = "Otomatisasi Dokumen Teknik ASDP Ternate";
    const sub = `${label} · ${baris.length} barang · disusun ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jayapura" })} WIT`;

    /* ── RINGKASAN ── */
    const wr = wb.addWorksheet("Ringkasan");
    judul(wr, "MONITORING PERMINTAAN KAPAL — CABANG TERNATE", sub, 10);
    kepala(wr, 4, [
      { t: "Kapal", l: 20 }, { t: "Total barang", l: 10 }, { t: "Terbuka", l: 9 }, { t: "Belum dievaluasi", l: 11 },
      { t: "Urgent terbuka", l: 10 }, { t: "Urgent menggantung", l: 12 }, { t: "Proses pengadaan", l: 11 }, { t: "Selesai", l: 9 },
      { t: "Barang mesin", l: 10 }, { t: "Barang deck", l: 10 },
    ]);
    const jum = { total: 0, terbuka: 0, belum: 0, urgent: 0, menggantung: 0, proses: 0, selesai: 0, mesin: 0, deck: 0 };
    kapal.forEach((k, i) => {
      const r = wr.getRow(5 + i);
      const v = [k.kapal, k.total, k.terbuka, k.belum, k.urgent, k.menggantung, k.proses, k.selesai, k.mesin, k.deck];
      v.forEach((x, c) => {
        const sel = r.getCell(c + 1);
        sel.value = x; sel.font = { size: 10, bold: c === 5 && k.menggantung > 0, color: c === 5 && k.menggantung > 0 ? { argb: "FFB91C1C" } : undefined };
        sel.border = { bottom: tipis };
      });
      (Object.keys(jum) as (keyof typeof jum)[]).forEach((x) => { jum[x] += Number((k as any)[x]) || 0; });
    });
    const rt = wr.getRow(5 + kapal.length);
    ["JUMLAH", jum.total, jum.terbuka, jum.belum, jum.urgent, jum.menggantung, jum.proses, jum.selesai, jum.mesin, jum.deck]
      .forEach((x, c) => {
        const sel = rt.getCell(c + 1);
        sel.value = x; sel.font = { size: 10, bold: true };
        sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
      });
    const ket = wr.getRow(7 + kapal.length);
    ket.getCell(1).value = "Urgent menggantung = barang urgent yang lebih dari 7 hari belum masuk pengadaan. "
      + "Rincian diurutkan menurut tanggal permintaan, terbaru di atas.";
    ket.getCell(1).font = { size: 9, italic: true, color: { argb: "FF64748B" } };
    wr.mergeCells(7 + kapal.length, 1, 7 + kapal.length, 10);

    /* ── PERLU TINDAKAN ── */
    const urgent = baris
      .filter((b) => b.urgent && !["Selesai", "Ditolak", "SPPBJ dibuat", "SPBJ / sedang diadakan"].includes(b.status))
      .sort((a, b) => b.umur - a.umur);
    const wu = wb.addWorksheet("Perlu Tindakan");
    judul(wu, "URGENT YANG BELUM MASUK PENGADAAN", `${urgent.length} barang · diurutkan dari yang paling lama menunggu`, 18);
    rincian(wu, urgent, 4);

    /* ── RINCIAN ── */
    const wd = wb.addWorksheet("Rincian");
    judul(wd, "RINCIAN SELURUH BARANG PERMINTAAN", sub, 18);
    rincian(wd, baris, 4);

    const buf = await wb.xlsx.writeBuffer();
    const nama = `Monitoring Permintaan Kapal - ${label}.xlsx`.replace(/[\\/:*?"<>|]/g, "-");
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nama)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "gagal" }, { status: 500 });
  }
}
