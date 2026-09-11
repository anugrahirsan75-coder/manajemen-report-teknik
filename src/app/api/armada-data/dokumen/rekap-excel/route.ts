/**
 * Rekap Dokumen Kapal → satu berkas Excel.
 *
 * Layarnya sudah menjawab pertanyaan sehari-hari, tetapi rapat dan audit minta
 * lampiran yang bisa dipegang: siapa mengirim apa, kapan, dan golongan mana yang
 * kosong di armada. Tanpa berkas ini, jawabannya disalin tangan dari layar ke
 * lembar baru setiap kali diminta.
 *
 * Dibaca ULANG dari Supabase, bukan dikirim dari peramban. Berbeda dari rekap
 * permintaan — yang isinya boleh disunting kantor sebelum diekspor sehingga
 * layarlah yang otoritatif — catatan dokumen tidak pernah disunting di layar.
 * Membacanya ulang di sini berarti berkasnya tetap benar walau layar yang
 * meminta sudah lama terbuka.
 */
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { dbServer, dbSiap } from "@/lib/dbServer";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { JENIS_DOKUMEN, KIND_DOKUMEN, labelDokumen } from "@/lib/portal/dokumen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BIRU = "FF16357F";
const pendek = (k: string) => k.replace(/^KMP\.?\s*/i, "");
const asal = (oleh: string) => (/^kantor/i.test(oleh || "") ? "Kantor" : oleh ? "Kapal" : "—");

export async function POST(req: NextRequest) {
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const f = (await req.json().catch(() => ({}))) as Record<string, string>;
  const c = dbServer()!;
  const { data, error } = await c.from("projects").select("id,payload")
    .filter("payload->>kind", "eq", KIND_DOKUMEN);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const cari = String(f.cari || "").trim().toLowerCase();
  const baris = (data || [])
    .map((r: any) => {
      const p = r.payload || {};
      return {
        kapal: p.kapal || "", jenis: p.jenis || "lainnya", judul: p.judul || "",
        tanggal: p.tanggal || "", nomor: p.nomor || "", catatan: p.catatan || "",
        olehAkun: p.olehAkun || "", dibuatPada: p.dibuatPada || "",
        berkas: (p.berkas || []) as any[],
      };
    })
    /* saringan yang sama persis dengan yang dipakai layar — berkas yang diunduh
       harus memuat apa yang sedang dilihat, bukan seluruh arsip */
    .filter((d) => !f.kapal || d.kapal === f.kapal)
    .filter((d) => !f.jenis || d.jenis === f.jenis)
    .filter((d) => !f.dari || !d.tanggal || d.tanggal >= f.dari)
    .filter((d) => !f.sampai || !d.tanggal || d.tanggal <= f.sampai)
    .filter((d) => !cari || `${d.judul} ${d.nomor} ${d.catatan} ${d.kapal}`.toLowerCase().includes(cari))
    .sort((a, b) => (b.tanggal || b.dibuatPada || "").localeCompare(a.tanggal || a.dibuatPada || ""));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Manajemen Report Teknik ASDP Ternate";
  wb.created = new Date();

  /* ── lembar 1: daftar ──────────────────────────────────────────────── */
  const ws = wb.addWorksheet("DAFTAR", { views: [{ state: "frozen", ySplit: 2 }] });
  ws.mergeCells("A1:H1");
  const judulSel = ws.getCell("A1");
  judulSel.value = `REKAP DOKUMEN KAPAL — ${baris.length} dokumen`
    + (f.kapal ? ` · ${f.kapal}` : "")
    + (f.jenis ? ` · ${labelDokumen(f.jenis)}` : "")
    + (f.dari || f.sampai ? ` · ${f.dari || "awal"} s/d ${f.sampai || "kini"}` : "");
  judulSel.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  judulSel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BIRU } };
  judulSel.alignment = { vertical: "middle" };
  ws.getRow(1).height = 22;

  const kepala = ["Tanggal", "Kapal", "Golongan", "Judul", "Nomor", "Keterangan", "Berkas", "Asal"];
  const barisKepala = ws.getRow(2);
  kepala.forEach((h, i) => {
    const sel = barisKepala.getCell(i + 1);
    sel.value = h;
    sel.font = { bold: true, size: 10 };
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EDF7" } };
    sel.border = { bottom: { style: "thin", color: { argb: "FFBFC9DD" } } };
  });
  ws.columns = [
    { width: 12 }, { width: 18 }, { width: 22 }, { width: 46 },
    { width: 18 }, { width: 40 }, { width: 34 }, { width: 9 },
  ];

  baris.forEach((d) => {
    const r = ws.addRow([
      d.tanggal || "", pendek(d.kapal), labelDokumen(d.jenis), d.judul, d.nomor, d.catatan,
      d.berkas.length ? d.berkas.map((b: any) => b.nama).join("\n") : "— unggahan terputus —",
      asal(d.olehAkun),
    ]);
    r.font = { size: 10 };
    r.alignment = { vertical: "top", wrapText: true };
    if (!d.berkas.length) {
      r.getCell(7).font = { size: 10, bold: true, color: { argb: "FF9A6700" } };
    }
  });
  ws.autoFilter = { from: "A2", to: `H${Math.max(2, baris.length + 2)}` };

  /* ── lembar 2: matriks kapal × golongan ────────────────────────────── */
  const wm = wb.addWorksheet("SEBARAN", { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }] });
  wm.mergeCells(1, 1, 1, JENIS_DOKUMEN.length + 2);
  const jm = wm.getCell("A1");
  jm.value = "SEBARAN GOLONGAN DOKUMEN PER KAPAL — kolom kosong berarti golongan itu belum pernah diarsipkan";
  jm.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  jm.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BIRU } };
  wm.getRow(1).height = 20;

  const km = wm.getRow(2);
  km.getCell(1).value = "Kapal";
  JENIS_DOKUMEN.forEach((j, i) => { km.getCell(i + 2).value = j.label; });
  km.getCell(JENIS_DOKUMEN.length + 2).value = "Total";
  km.eachCell((sel) => {
    sel.font = { bold: true, size: 9 };
    sel.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EDF7" } };
  });
  km.height = 34;
  wm.getColumn(1).width = 20;
  JENIS_DOKUMEN.forEach((_, i) => { wm.getColumn(i + 2).width = 13; });
  wm.getColumn(JENIS_DOKUMEN.length + 2).width = 9;

  const totalKolom = new Array(JENIS_DOKUMEN.length).fill(0);
  /* SELURUH armada disebut, termasuk yang nol. Daftar yang hanya memuat kapal
     yang mengirim akan membuat kapal yang diam lenyap dari halaman. */
  KAPAL_ANGGARAN.forEach((kapal) => {
    const punya = baris.filter((d) => d.kapal === kapal);
    const r = wm.addRow([
      pendek(kapal),
      ...JENIS_DOKUMEN.map((j, i) => {
        const n = punya.filter((d) => d.jenis === j.id).length;
        totalKolom[i] += n;
        return n || null;
      }),
      punya.length || null,
    ]);
    r.font = { size: 10 };
    r.getCell(1).font = { size: 10, bold: true };
    r.alignment = { horizontal: "center" };
    r.getCell(1).alignment = { horizontal: "left" };
    if (!punya.length) r.getCell(1).font = { size: 10, bold: true, color: { argb: "FFB42318" } };
  });

  const rt = wm.addRow(["ARMADA", ...totalKolom.map((n) => n || null), baris.length || null]);
  rt.font = { size: 10, bold: true };
  rt.alignment = { horizontal: "center" };
  rt.getCell(1).alignment = { horizontal: "left" };
  rt.eachCell((sel) => { sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F4FA" } }; });

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rekap-dokumen-kapal.xlsx"`,
    },
  });
}
