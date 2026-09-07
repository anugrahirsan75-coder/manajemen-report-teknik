/**
 * Rekap seluruh permintaan kapal satu bulan → satu berkas Excel.
 *
 * Sampai sekarang isi permintaan dibaca berkas demi berkas di layar, lalu
 * disalin tangan ke daftar kerja kantor. Tiga belas kapal dengan dua borang
 * masing-masing berarti dua puluh enam kali salin-tempel tiap bulan, dan tiap
 * salinan adalah kesempatan baru untuk salah angka.
 *
 * Yang dikirim ke sini adalah baris yang SUDAH tampil di layar — bukan
 * pembacaan ulang. Hasil bacaan tinggal di peramban (Supabase, sisi klien) dan
 * boleh disunting kantor sebelum dipakai; kalau server membacanya sendiri, yang
 * turun ke Excel adalah bacaan mentah, bukan yang sudah dibetulkan orang.
 *
 * Dua macam lembar:
 *  · REKAP    — semua kapal berurutan, untuk melihat kebutuhan sebulan sekaligus
 *  · per kapal— karena SPPBJ disusun per kapal, dan memotong-motong lembar
 *               gabungan adalah pekerjaan yang justru ingin dihapus di sini
 */
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BarisRekap {
  kapal: string;
  jenis: string;
  nama: string;
  spesifikasi: string;
  jumlah: string;
  satuan: string;
  keterangan: string;
  /** perkiraan harga satuan dari Database RAB; 0 bila tak ada pembanding */
  harga: number;
  /** false = kecocokan lemah, angkanya perlu diperiksa */
  yakin: boolean;
  pembanding: string;
  berkas: string;
  dikirim: string;
}

const BIRU = "FF16357F";
const KEPALA = [
  { t: "No", l: 5 },
  { t: "Kapal", l: 20 },
  { t: "Borang", l: 17 },
  { t: "Nama barang / pekerjaan", l: 40 },
  { t: "Spesifikasi / part number", l: 28 },
  { t: "Jumlah", l: 9 },
  { t: "Satuan", l: 9 },
  { t: "Keterangan", l: 26 },
  { t: "Est. satuan (Rp)", l: 16 },
  { t: "Est. total (Rp)", l: 16 },
  { t: "Pembanding RAB", l: 34 },
  { t: "Berkas asal", l: 30 },
  { t: "Dikirim", l: 16 },
];

const keAngka = (v: string) => {
  const n = parseFloat(String(v || "").replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function tulisLembar(ws: ExcelJS.Worksheet, baris: BarisRekap[], judul: string, periodeLabel: string, denganKapal: boolean) {
  const kolom = denganKapal ? KEPALA : KEPALA.filter((k) => k.t !== "Kapal");
  ws.columns = kolom.map((k) => ({ width: k.l }));

  ws.mergeCells(1, 1, 1, kolom.length);
  const j = ws.getCell(1, 1);
  j.value = judul;
  j.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  j.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BIRU } };
  j.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, kolom.length);
  const s = ws.getCell(2, 1);
  s.value = `Periode ${periodeLabel} · ${baris.length} baris permintaan · disusun ${new Date().toLocaleString("id-ID")}`;
  s.font = { size: 10, italic: true, color: { argb: "FF475569" } };
  s.alignment = { indent: 1 };

  const barisKepala = ws.getRow(4);
  kolom.forEach((k, i) => {
    const sel = barisKepala.getCell(i + 1);
    sel.value = k.t;
    sel.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    sel.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    sel.border = { bottom: { style: "thin", color: { argb: "FF94A3B8" } } };
  });
  barisKepala.height = 30;

  let r = 5;
  let kapalSebelum = "";
  let total = 0;
  baris.forEach((b, i) => {
    /*
     * Garis pemisah tiap ganti kapal. Lembar gabungan tanpa pemisah menuntut
     * pembacanya menyusuri kolom kapal baris demi baris untuk tahu di mana satu
     * kapal berakhir — pekerjaan mata yang tidak perlu ada.
     */
    if (denganKapal && b.kapal !== kapalSebelum && i > 0) {
      ws.getRow(r).height = 6;
      r++;
    }
    kapalSebelum = b.kapal;

    const nilai = b.harga * (keAngka(b.jumlah) || 1);
    total += nilai;

    const isi: (string | number)[] = [
      i + 1,
      ...(denganKapal ? [b.kapal] : []),
      b.jenis,
      b.nama,
      b.spesifikasi,
      b.jumlah,
      b.satuan,
      b.keterangan,
      b.harga || "",
      nilai || "",
      b.pembanding,
      b.berkas,
      b.dikirim,
    ];
    const row = ws.getRow(r);
    isi.forEach((v, k) => {
      const sel = row.getCell(k + 1);
      sel.value = v;
      sel.font = { size: 10 };
      sel.alignment = { vertical: "top", wrapText: k >= 3 };
      sel.border = { bottom: { style: "hair", color: { argb: "FFCBD5E1" } } };
    });
    // dua kolom rupiah diberi format angka, bukan teks — supaya bisa dijumlah
    [kolom.length - 5, kolom.length - 4].forEach((k) => {
      row.getCell(k + 1).numFmt = "#,##0";
      row.getCell(k + 1).alignment = { horizontal: "right", vertical: "top" };
    });
    /*
     * Harga yang kecocokannya lemah diberi latar kuning, bukan dibuang.
     * "Kira-kira segini" masih berguna untuk menakar pagu; yang berbahaya
     * adalah angka ragu yang tampil sama pastinya dengan angka yang yakin.
     */
    if (b.harga && !b.yakin) {
      [kolom.length - 5, kolom.length - 4, kolom.length - 3].forEach((k) => {
        row.getCell(k + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      });
    }
    r++;
  });

  const rowTotal = ws.getRow(r + 1);
  rowTotal.getCell(1).value = "PERKIRAAN NILAI";
  ws.mergeCells(r + 1, 1, r + 1, kolom.length - 5);
  rowTotal.getCell(1).font = { bold: true, size: 11 };
  rowTotal.getCell(1).alignment = { horizontal: "right" };
  const selTotal = rowTotal.getCell(kolom.length - 3);
  selTotal.value = total || 0;
  selTotal.numFmt = "#,##0";
  selTotal.font = { bold: true, size: 11, color: { argb: BIRU } };
  selTotal.alignment = { horizontal: "right" };

  const catatan = ws.getRow(r + 3);
  catatan.getCell(1).value =
    "Estimasi harga berasal dari Database RAB dan bersifat perkiraan. Baris berlatar kuning kecocokannya lemah — periksa sebelum dipakai.";
  catatan.getCell(1).font = { size: 9, italic: true, color: { argb: "FF64748B" } };
  ws.mergeCells(r + 3, 1, r + 3, kolom.length);

  ws.views = [{ state: "frozen", ySplit: 4 }];
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(5, r - 1), column: kolom.length } };
}

/** nama tab Excel tidak boleh memuat : \ / ? * [ ] dan maksimal 31 huruf */
const namaTab = (s: string) => s.replace(/^KMP\.?\s*/i, "").replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "KAPAL";

export async function POST(req: NextRequest) {
  const { periodeLabel, baris } = (await req.json().catch(() => ({}))) as {
    periodeLabel?: string; baris?: BarisRekap[];
  };
  if (!Array.isArray(baris) || !baris.length) {
    return NextResponse.json({ ok: false, error: "Tidak ada baris permintaan untuk diunduh" }, { status: 400 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Manajemen Report Teknik ASDP Ternate";
  wb.created = new Date();

  const urut = [...baris].sort((a, b) =>
    a.kapal.localeCompare(b.kapal, "id") || a.jenis.localeCompare(b.jenis, "id"));

  tulisLembar(wb.addWorksheet("REKAP"), urut, "REKAP PERMINTAAN KAPAL — SELURUH ARMADA",
    periodeLabel || "", true);

  // satu lembar per kapal: SPPBJ disusun per kapal, jadi bentuk siap-pakainya
  // memang terpisah — bukan lembar gabungan yang harus dipotong-potong lagi
  Array.from(new Set(urut.map((b) => b.kapal))).forEach((kapal) => {
    const punya = urut.filter((b) => b.kapal === kapal);
    tulisLembar(wb.addWorksheet(namaTab(kapal)), punya, `PERMINTAAN ${kapal.toUpperCase()}`,
      periodeLabel || "", false);
  });

  const buf = await wb.xlsx.writeBuffer();
  const nama = `Rekap Permintaan Kapal - ${(periodeLabel || "").replace(/[^\w\s-]/g, "")}.xlsx`;
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nama}"`,
      "Cache-Control": "no-store",
    },
  });
}
