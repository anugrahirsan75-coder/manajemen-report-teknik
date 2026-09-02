/**
 * Borang FLEET CERTIFICATE untuk Direksi — satu berkas Excel, satu lembar per kapal.
 *
 * Sebelumnya berkas ini disusun manual dengan skrip sekali pakai. Padahal isinya
 * selalu berasal dari dua sumber yang sudah dipegang aplikasi: lembar MUSTER
 * cabang (tanggal + tautan berkas) dan nomor sertifikat yang diketik kantor.
 * Jadi penyusunannya dipindah ke sini: sekali klik, angkanya selalu terhitung
 * ulang terhadap hari ini, dan tidak ada lagi berkas yang basi karena lupa
 * dibuat ulang.
 *
 * Kolom File Location menaut ke Google Drive cabang, bukan ke folder lokal —
 * berkasnya diteruskan ke Direksi dan unit lain, yang tidak memegang arsipnya.
 */
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { ambilSertifikat } from "@/lib/sertifikat/sumber";
import { Sertifikat, statusSert } from "@/lib/sertifikat/types";
import {
  BORANG, BUKAN_DOKUMEN, JENIS_BORANG, kunciNomor, masaBerlaku, namaArmada,
} from "@/lib/sertifikat/fleetBorang";
import { dbServer } from "@/lib/dbServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NAVY = "FF16357F";
const KEPALA = "FFDCE3EC";
const TUNGGU = "FFFFF7E0";      // sel nomor yang menunggu diisi tangan
const GARIS = "FF9AA4B2";
const MERAH = "FFB42318";
const HIJAU = "FF067647";

const KOLOM = [
  { h: "Fleet ID", w: 16 }, { h: "Fleet Name", w: 16 }, { h: "Document ID", w: 12 },
  { h: "Document Name", w: 32 }, { h: "Certificate Number", w: 30 }, { h: "Release Date", w: 13 },
  { h: "Expired Date", w: 13 }, { h: "Validity Periode", w: 16 },
  { h: "Status Certificate (Active/Expired)", w: 22 }, { h: "File Location", w: 46 },
];

const tepi = (): any => ({
  top: { style: "thin", color: { argb: GARIS } }, left: { style: "thin", color: { argb: GARIS } },
  bottom: { style: "thin", color: { argb: GARIS } }, right: { style: "thin", color: { argb: GARIS } },
});

/**
 * Tanggal untuk sel Excel, dibangun dalam UTC.
 *
 * Excel menyimpan tanggal sebagai angka hari; ExcelJS mengubah objek Date
 * memakai UTC. Kalau tanggalnya dibuat pada tengah malam waktu lokal (WIT),
 * hasilnya mundur sehari begitu ditulis — 22 Des terbaca 21 Des di berkas yang
 * dibaca Direksi.
 */
const tanggal = (iso: string) => {
  if (!iso) return null;
  const [y, b, h] = iso.split("-").map(Number);
  if (!y || !b || !h) return null;
  return new Date(Date.UTC(y, b - 1, h));
};

/** status yang dipakai borang: hanya Active / Expired, sifat permanen ada di Validity */
function statusBorang(s: Sertifikat): string {
  const st = statusSert(s);
  if (st === "permanen") return "Active";
  if (st === "kosong") return "";
  return st === "lewat" ? "Expired" : "Active";
}

function kepalaLembar(ws: ExcelJS.Worksheet, judul: string, ket: string, kolom = KOLOM) {
  ws.mergeCells(1, 1, 1, kolom.length);
  const j = ws.getCell(1, 1);
  j.value = judul;
  j.font = { name: "Calibri", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  j.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  j.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, kolom.length);
  const k = ws.getCell(2, 1);
  k.value = ket;
  k.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF475467" } };
  k.alignment = { horizontal: "center", vertical: "middle" };
}

function barisKepala(ws: ExcelJS.Worksheet, r: number, kolom = KOLOM) {
  kolom.forEach((c, i) => {
    const sel = ws.getCell(r, i + 1);
    sel.value = c.h;
    sel.font = { name: "Calibri", size: 9, bold: true };
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: KEPALA } };
    sel.border = tepi();
    sel.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    ws.getColumn(i + 1).width = c.w;
  });
  ws.getRow(r).height = 28;
  return r + 1;
}

function isiBaris(
  ws: ExcelJS.Worksheet, r: number,
  nilai: (string | Date | null)[],
  opsi: { nomorKosong?: boolean; taut?: string } = {},
) {
  nilai.forEach((v, i) => {
    const sel = ws.getCell(r, i + 1);
    sel.value = v as any;
    sel.font = { name: "Calibri", size: 10 };
    sel.border = tepi();
    sel.alignment = {
      horizontal: [2, 5, 6, 7, 8].includes(i) ? "center" : "left",
      vertical: "middle", wrapText: [3, 4, 9].includes(i),
    };
    if (i === 5 || i === 6) sel.numFmt = "DD-MMM-YY";
  });
  const st = ws.getCell(r, 9);
  if (st.value === "Expired") st.font = { name: "Calibri", size: 10, bold: true, color: { argb: MERAH } };
  else if (st.value === "Active") st.font = { name: "Calibri", size: 10, color: { argb: HIJAU } };
  else st.value = "—";

  if (opsi.nomorKosong) {
    ws.getCell(r, 5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TUNGGU } };
  }
  if (opsi.taut) {
    const sel = ws.getCell(r, 10);
    sel.value = { text: String(sel.value || "Buka berkas"), hyperlink: opsi.taut } as any;
    sel.font = { name: "Calibri", size: 10, color: { argb: NAVY }, underline: true };
  }
  return r + 1;
}

export async function GET() {
  const { baris: semua, kapal: daftarKapal, diambilPada } = await ambilSertifikat(false);
  const baris = semua.filter((s) => !BUKAN_DOKUMEN.has(s.jenis));

  const peta = new Map<string, Map<string, Sertifikat>>();
  baris.forEach((s) => {
    if (!peta.has(s.kapal)) peta.set(s.kapal, new Map());
    peta.get(s.kapal)!.set(s.jenis, s);
  });

  // nomor sertifikat yang sudah diketik kantor — boleh kosong, bukan penghalang
  let nomorTersimpan: Record<string, Record<string, string>> = {};
  try {
    const c = dbServer();
    if (c) {
      const { data } = await c.from("projects")
        .select("nama_kapal,payload").filter("payload->>kind", "eq", "sertifikat_nomor");
      (data || []).forEach((r: any) => {
        const k = r.payload?.kapal || r.nama_kapal || "";
        if (k) nomorTersimpan[k] = r.payload?.nomor || {};
      });
    }
  } catch { /* tanpa basis data pun borangnya tetap terbit, kolom nomornya kosong */ }

  const hariIni = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const wb = new ExcelJS.Workbook();
  wb.creator = "Manajemen Report Teknik ASDP Ternate";
  wb.created = new Date();

  const rekap: { urut: number; kapal: string; nama: string; terisi: number; aktif: number;
                 lewat: number; tanpa: number; berkas: number; bernomor: number; lain: number }[] = [];

  // ── satu lembar per kapal ────────────────────────────────────────────────
  daftarKapal.forEach((kapal, i) => {
    const isi = peta.get(kapal) || new Map<string, Sertifikat>();
    const nama = namaArmada(kapal);
    const nomorKapal = nomorTersimpan[kapal] || {};
    const ws = wb.addWorksheet(`${String(i + 1).padStart(2, "0")} ${nama}`.slice(0, 31));

    kepalaLembar(ws, `FLEET CERTIFICATE — KMP. ${nama.toUpperCase()}`,
      `PT ASDP Indonesia Ferry (Persero) Cabang Ternate · data per ${hariIni} · sumber: lembar MUSTER cabang`);
    let r = barisKepala(ws, 3);
    ws.views = [{ state: "frozen", ySplit: 3 }];

    let terisi = 0, aktif = 0, lewat = 0, tanpa = 0, berkas = 0, bernomor = 0;

    BORANG.forEach((b) => {
      const s = b.padanan ? isi.get(b.padanan) : undefined;
      const no = s ? (nomorKapal[kunciNomor(b.kode, b.padanan || "")] || "") : "";
      if (no) bernomor++;
      if (s?.berkasUrl) berkas++;

      const st = s ? statusBorang(s) : "";
      if (s) {
        terisi++;
        if (st === "Expired") lewat++; else if (st === "Active") aktif++;
      } else tanpa++;

      r = isiBaris(ws, r, [
        nama.toUpperCase(), nama, b.kode, b.nama, no,
        s ? tanggal(s.terbit) : null, s ? tanggal(s.berlaku) : null,
        s ? masaBerlaku(s.terbit, s.berlaku, s.permanen) : "",
        st, s?.berkasUrl ? (s.berkasNama || "Buka berkas") : (s ? "berkas tidak ada di lembar sumber" : ""),
      ], { nomorKosong: !!s?.berkasUrl && !no, taut: s?.berkasUrl || undefined });
    });

    // ── dokumen MUSTER di luar borang ─────────────────────────────────────
    const lain = baris.filter((s) => s.kapal === kapal && !JENIS_BORANG.has(s.jenis));
    r += 1;
    ws.mergeCells(r, 1, r, KOLOM.length);
    const jl = ws.getCell(r, 1);
    jl.value = "DOKUMEN LAIN DI LEMBAR MUSTER (di luar 21 baris borang)";
    jl.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    jl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    jl.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(r).height = 22;
    r = barisKepala(ws, r + 1);

    lain.forEach((s, n) => {
      r = isiBaris(ws, r, [
        nama.toUpperCase(), nama, `LAIN/${String(n + 1).padStart(3, "0")}`, s.jenis, "",
        tanggal(s.terbit), tanggal(s.berlaku), masaBerlaku(s.terbit, s.berlaku, s.permanen),
        statusBorang(s), s.berkasUrl ? (s.berkasNama || "Buka berkas") : "tidak ada berkas di lembar sumber",
      ], { taut: s.berkasUrl || undefined });
    });

    ws.pageSetup = {
      orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    };
    rekap.push({ urut: i + 1, kapal, nama, terisi, aktif, lewat, tanpa, berkas, bernomor, lain: lain.length });
  });

  // ── lembar rekap, ditaruh paling depan ──────────────────────────────────
  const kol2 = [
    { h: "No", w: 5 }, { h: "Fleet ID", w: 18 }, { h: "Fleet Name", w: 18 },
    { h: "Dokumen borang", w: 16 }, { h: "Active", w: 9 }, { h: "Expired", w: 9 },
    { h: "Belum ada data", w: 15 }, { h: "Berkas tertaut", w: 14 },
    { h: "Nomor terisi", w: 13 }, { h: "Dokumen lain", w: 13 },
  ];
  const ws2 = wb.addWorksheet("REKAP ARMADA");
  kepalaLembar(ws2, "REKAP ARMADA — FLEET CERTIFICATE",
    `${daftarKapal.length} kapal · ${BORANG.length} dokumen borang per kapal · data per ${hariIni}`, kol2);
  let r2 = barisKepala(ws2, 3, kol2);
  rekap.forEach((x) => {
    [x.urut, x.nama.toUpperCase(), x.nama, `${x.terisi} / ${BORANG.length}`,
      x.aktif, x.lewat, x.tanpa, x.berkas, x.bernomor, x.lain].forEach((v, i) => {
      const sel = ws2.getCell(r2, i + 1);
      sel.value = v as any;
      sel.font = { name: "Calibri", size: 10, bold: i === 2 };
      sel.border = tepi();
      sel.alignment = { horizontal: i === 2 || i === 1 ? "left" : "center", vertical: "middle" };
    });
    if (x.lewat) ws2.getCell(r2, 6).font = { name: "Calibri", size: 10, bold: true, color: { argb: MERAH } };
    r2++;
  });
  ws2.views = [{ state: "frozen", ySplit: 3 }];
  wb.worksheets.splice(wb.worksheets.indexOf(ws2), 1);
  wb.worksheets.unshift(ws2);

  // ── catatan ─────────────────────────────────────────────────────────────
  const kol3 = [
    { h: "Document ID", w: 13 }, { h: "Document Name", w: 26 },
    { h: "Baris sumber di lembar MUSTER", w: 52 }, { h: "Keterangan", w: 60 },
  ];
  const ws3 = wb.addWorksheet("CATATAN");
  kepalaLembar(ws3, "CATATAN PEMETAAN DATA",
    "Dibaca lebih dulu sebelum berkas diteruskan — menjelaskan asal tiap isian dan kolom yang kosong", kol3);
  let r3 = barisKepala(ws3, 3, kol3);
  BORANG.forEach((b) => {
    [b.kode, b.nama, b.padanan || "—", b.catatan || "Diambil langsung dari baris tersebut"].forEach((v, i) => {
      const sel = ws3.getCell(r3, i + 1);
      sel.value = v;
      sel.font = { name: "Calibri", size: 10 };
      sel.border = tepi();
      sel.alignment = { vertical: "middle", wrapText: i >= 1 };
    });
    r3++;
  });

  const totalNomor = rekap.reduce((a, x) => a + x.bernomor, 0);
  const totalBerkas = rekap.reduce((a, x) => a + x.berkas, 0);
  const umum: [string, string][] = [
    ["Certificate Number", `Diketik di aplikasi pada panel dokumen halaman Sertifikat lalu tersimpan (${totalNomor} dari ${totalBerkas} berkas). `
      + "Lembar MUSTER tidak menyimpan nomor sertifikat; nomornya ada di dalam tiap berkas. "
      + "Sel berlatar kuning berarti berkasnya ada tetapi nomornya belum diketik."],
    ["Fleet ID", "Diisi nama kapal."],
    ["Status Certificate", `Dihitung ulang terhadap tanggal ${hariIni}, bukan disalin dari kolom lembar; `
      + "kolom sisa hari di lembar sumber ikut basi bila lembarnya tidak dibuka."],
    ["Validity Periode", "Selisih tanggal terbit dan tanggal berakhir, dibulatkan ke bulan terdekat."],
    ["File Location", "Menaut ke berkas di Google Drive cabang, sehingga berkas Excel ini bisa diteruskan sendirian."],
    ["Dokumen lain", "Blok kedua di tiap lembar kapal: dokumen di lembar cabang yang di luar 21 baris borang."],
  ];
  r3 += 1;
  ws3.getCell(r3, 1).value = "CATATAN UMUM";
  ws3.getCell(r3, 1).font = { name: "Calibri", size: 10, bold: true };
  r3++;
  umum.forEach(([judul, teks]) => {
    ws3.getCell(r3, 1).value = judul;
    ws3.getCell(r3, 1).font = { name: "Calibri", size: 10, bold: true };
    ws3.getCell(r3, 1).border = tepi();
    ws3.mergeCells(r3, 2, r3, 4);
    const sel = ws3.getCell(r3, 2);
    sel.value = teks;
    sel.font = { name: "Calibri", size: 10 };
    sel.alignment = { vertical: "middle", wrapText: true };
    for (let c = 1; c <= 4; c++) ws3.getCell(r3, c).border = tepi();
    ws3.getRow(r3).height = 34;
    r3++;
  });

  const buf = await wb.xlsx.writeBuffer();
  const stempel = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="FLEET CERTIFICATE - ARMADA TERNATE ${stempel}.xlsx"`,
      "X-Diambil-Pada": String(diambilPada || ""),
    },
  });
}
