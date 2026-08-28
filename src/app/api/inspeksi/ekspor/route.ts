/**
 * Rekap temuan inspeksi dalam bentuk Excel — untuk Manager Teknik dan
 * Marine Superintendent.
 *
 * Dua lembar: daftar temuan lengkap (bisa disaring sendiri di Excel) dan rekap
 * per kapal. Yang dihitung pada rekap bukan cuma "berapa temuan", melainkan
 * berapa yang LEWAT TENGGAT — angka itulah yang menentukan kapal mana yang
 * perlu didatangi lebih dulu.
 */
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { dbLapor } from "@/lib/lapor/db";
import {
  Temuan, labelBagian, labelStatus, labelTingkat, lewatTarget, umurHari,
} from "@/lib/inspeksi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEPALA = "FF16357F";

export async function GET(req: NextRequest) {
  const c = dbLapor();
  if (!c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const { data, error } = await c.from("projects")
    .select("id,nama_kapal,payload").filter("payload->>kind", "eq", "inspeksi_temuan");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const q = req.nextUrl.searchParams;
  const kapalSaring = q.get("kapal") || "";
  const bulan = q.get("bulan") || "";          // YYYY-MM
  const statusSaring = q.get("status") || "";

  const baris: Temuan[] = (data || [])
    .map((r: any) => ({ ...(r.payload as any), id: r.id } as Temuan))
    .filter((t) => (!kapalSaring || t.kapal === kapalSaring))
    .filter((t) => (!bulan || (t.tanggalInspeksi || "").startsWith(bulan)))
    .filter((t) => (!statusSaring || t.status === statusSaring))
    .sort((a, b) => (a.kapal || "").localeCompare(b.kapal || "")
      || (a.tanggalInspeksi || "").localeCompare(b.tanggalInspeksi || ""));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Manajemen Report Teknik ASDP Ternate";

  // ── lembar 1: daftar temuan ────────────────────────────────────────────────
  const ws = wb.addWorksheet("Temuan", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Kapal", key: "kapal", width: 20 },
    { header: "Tgl Inspeksi", key: "tgl", width: 13 },
    { header: "Inspektor", key: "inspektor", width: 20 },
    { header: "Bagian", key: "bagian", width: 13 },
    { header: "Komponen", key: "komponen", width: 30 },
    { header: "Uraian Temuan", key: "uraian", width: 48 },
    { header: "Tindakan/Rekomendasi", key: "tindakan", width: 34 },
    { header: "Klasifikasi", key: "tingkat", width: 12 },
    { header: "Target Selesai", key: "target", width: 13 },
    { header: "Umur (hari)", key: "umur", width: 11 },
    { header: "PJ", key: "pj", width: 10 },
    { header: "Status", key: "status", width: 20 },
    { header: "Lewat Tenggat", key: "lewat", width: 13 },
    { header: "Diverifikasi Oleh", key: "verif", width: 20 },
    { header: "Bukti", key: "bukti", width: 8 },
  ];
  baris.forEach((t) => ws.addRow({
    kapal: t.kapal, tgl: t.tanggalInspeksi, inspektor: t.inspektor,
    bagian: labelBagian(t.bagian), komponen: t.komponen, uraian: t.uraian,
    tindakan: t.tindakan, tingkat: labelTingkat(t.tingkat), target: t.targetSelesai,
    umur: umurHari(t), pj: t.penanggungJawab, status: labelStatus(t.status),
    lewat: lewatTarget(t) ? "YA" : "", verif: t.diverifikasiOleh,
    bukti: (t.bukti || []).length,
  }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: KEPALA } };
  ws.autoFilter = { from: "A1", to: "O1" };
  ws.eachRow((row, i) => {
    row.alignment = { vertical: "top", wrapText: i > 1 };
    if (i > 1 && row.getCell("lewat").value === "YA") {
      row.getCell("lewat").font = { bold: true, color: { argb: "FFB91C1C" } };
    }
  });

  // ── lembar 2: rekap per kapal ──────────────────────────────────────────────
  const rekap = wb.addWorksheet("Rekap per Kapal");
  rekap.columns = [
    { header: "Kapal", key: "kapal", width: 22 },
    { header: "Total Temuan", key: "total", width: 13 },
    { header: "Terbuka", key: "terbuka", width: 11 },
    { header: "Dikerjakan", key: "proses", width: 12 },
    { header: "Menunggu", key: "tunggu", width: 12 },
    { header: "Selesai", key: "selesai", width: 10 },
    { header: "Lewat Tenggat", key: "lewat", width: 14 },
    { header: "% Penutupan", key: "persen", width: 13 },
  ];
  const perKapal = new Map<string, Temuan[]>();
  baris.forEach((t) => perKapal.set(t.kapal, [...(perKapal.get(t.kapal) || []), t]));
  Array.from(perKapal.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([kapal, isi]) => {
    const n = (s: string) => isi.filter((t) => t.status === s).length;
    rekap.addRow({
      kapal, total: isi.length, terbuka: n("terbuka"), proses: n("proses"),
      tunggu: n("tunggu"), selesai: n("selesai"),
      lewat: isi.filter(lewatTarget).length,
      persen: isi.length ? Math.round((n("selesai") / isi.length) * 100) / 100 : 0,
    });
  });
  rekap.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  rekap.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: KEPALA } };
  rekap.getColumn("persen").numFmt = "0%";

  const buf = await wb.xlsx.writeBuffer();
  const nama = `Rekap Inspeksi${bulan ? ` ${bulan}` : ""}${kapalSaring ? ` ${kapalSaring}` : ""}.xlsx`;
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(nama)}"`,
      "Cache-Control": "no-store",
    },
  });
}
