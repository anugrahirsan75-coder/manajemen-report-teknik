/**
 * Formulir Permintaan Master Data — dibuat langsung sebagai PDF.
 *
 * Dokumen lain di modul ini lahir dari template Excel lalu dikonversi MS
 * Office. Jalur itu hanya hidup di laptop ber-Windows, sementara formulir
 * inilah satu-satunya yang ditandatangani, sehingga justru dia yang paling
 * perlu bisa diterbitkan dari mana saja — termasuk dari peladen.
 *
 * Maka bentuknya digambar sendiri di sini. Tata letaknya mengikuti borang
 * HP-107.00.01: kotak kop, lima baris isian, blok tanda tangan, lalu bidang
 * LEMBAR PENGESAHAN yang diisi pusat.
 */
import fs from "fs";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { MaterialRequest } from "./types";
import { kapalCostCenter } from "./db";
import { bulanTahun } from "@/lib/format";
import { ambilTtdPenuh } from "./ttdSumber";

const A4 = { l: 595.28, t: 841.89 };
const TEPI = 42;                       // jarak dari tepi kertas
const HITAM = rgb(0, 0, 0);
const GARIS = 0.8;

const ddmmyyyy = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

interface Alat {
  pdf: PDFDocument;
  hal: PDFPage;
  biasa: PDFFont;
  tebal: PDFFont;
  miring: PDFFont;
}

/** kotak bergaris; koordinat memakai sumbu y dari ATAS supaya sesuai borang */
function kotak(a: Alat, x: number, yAtas: number, lebar: number, tinggi: number) {
  a.hal.drawRectangle({
    x, y: A4.t - yAtas - tinggi, width: lebar, height: tinggi,
    borderColor: HITAM, borderWidth: GARIS,
  });
}

function garisH(a: Alat, x1: number, x2: number, yAtas: number) {
  a.hal.drawLine({ start: { x: x1, y: A4.t - yAtas }, end: { x: x2, y: A4.t - yAtas }, thickness: GARIS, color: HITAM });
}

function garisV(a: Alat, x: number, yAtas1: number, yAtas2: number) {
  a.hal.drawLine({ start: { x, y: A4.t - yAtas1 }, end: { x, y: A4.t - yAtas2 }, thickness: GARIS, color: HITAM });
}

type Gaya = { ukuran?: number; font?: "biasa" | "tebal" | "miring"; rata?: "kiri" | "tengah" | "kanan" };

function tulis(a: Alat, teks: string, x: number, yAtas: number, g: Gaya = {}) {
  const ukuran = g.ukuran ?? 9;
  const font = g.font === "tebal" ? a.tebal : g.font === "miring" ? a.miring : a.biasa;
  let px = x;
  if (g.rata && g.rata !== "kiri") {
    const w = font.widthOfTextAtSize(teks, ukuran);
    px = g.rata === "tengah" ? x - w / 2 : x - w;
  }
  a.hal.drawText(teks, { x: px, y: A4.t - yAtas - ukuran, size: ukuran, font, color: HITAM });
}

/** Penggal teks agar muat selebar kolom; dipakai kalimat panjang di borang. */
function penggal(font: PDFFont, teks: string, ukuran: number, lebar: number): string[] {
  const kata = teks.split(" ");
  const baris: string[] = [];
  let kini = "";
  for (const k of kata) {
    const coba = kini ? `${kini} ${k}` : k;
    if (font.widthOfTextAtSize(coba, ukuran) > lebar && kini) { baris.push(kini); kini = k; }
    else kini = coba;
  }
  if (kini) baris.push(kini);
  return baris;
}

async function sisipGambar(
  a: Alat, buf: Buffer, x: number, yAtas: number, lebar: number, tinggi: number, pekat = 1,
) {
  // jenisnya dibaca dari isi berkas: unggahan pemakai bisa saja JPEG, dan
  // embedPng atas berkas JPEG melempar galat yang menggagalkan seluruh dokumen
  const jpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const img = jpeg ? await a.pdf.embedJpg(buf) : await a.pdf.embedPng(buf);
  a.hal.drawImage(img, { x, y: A4.t - yAtas - tinggi, width: lebar, height: tinggi, opacity: pekat });
}

export async function pdfFormulir(req: MaterialRequest): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const hal = pdf.addPage([A4.l, A4.t]);
  const a: Alat = {
    pdf, hal,
    biasa: await pdf.embedFont(StandardFonts.Helvetica),
    tebal: await pdf.embedFont(StandardFonts.HelveticaBold),
    miring: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };

  const kiri = TEPI;
  const kanan = A4.l - TEPI;
  const lebar = kanan - kiri;

  // ── kop: logo | judul | kotak nomor dokumen ──────────────────────────
  const kopAtas = 40;
  const kopTinggi = 58;
  const xJudul = kiri + 120;
  const xDok = kanan - 230;
  kotak(a, kiri, kopAtas, lebar, kopTinggi);
  garisV(a, xJudul, kopAtas, kopAtas + kopTinggi);
  garisV(a, xDok, kopAtas, kopAtas + kopTinggi);

  try {
    const logo = fs.readFileSync(path.join(process.cwd(), "public", "logo-asdp.png"));
    await sisipGambar(a, logo, kiri + 22, kopAtas + 12, 76, 34);
  } catch { /* tanpa logo pun borangnya sah */ }

  const judul = "FORMULIR PERMINTAAN PEMBUATAN MASTER DATA KODE MATERIAL BARANG";
  const barisJudul = penggal(a.tebal, judul, 10, xDok - xJudul - 16);
  barisJudul.forEach((b, i) =>
    tulis(a, b, (xJudul + xDok) / 2, kopAtas + 12 + i * 13, { ukuran: 10, font: "tebal", rata: "tengah" }));

  const dok: [string, string][] = [
    ["No. Dokumen", "HP-107.00.01"], ["Revisi", "00"],
    ["Berlaku Efektif", ""], ["Halaman", "1 dari 1"],
  ];
  const tinggiBaris = kopTinggi / 4;
  dok.forEach(([k, v], i) => {
    const y = kopAtas + i * tinggiBaris;
    if (i) garisH(a, xDok, kanan, y);
    tulis(a, k, xDok + 6, y + 4.5, { ukuran: 8, font: "tebal" });
    tulis(a, ":", xDok + 92, y + 4.5, { ukuran: 8, font: "tebal" });
    tulis(a, v, xDok + 100, y + 4.5, { ukuran: 8, font: "tebal" });
  });

  // ── badan borang ─────────────────────────────────────────────────────
  const badanAtas = kopAtas + kopTinggi;
  const badanTinggi = 296;
  kotak(a, kiri, badanAtas, lebar, badanTinggi);

  let y = badanAtas + 18;
  tulis(a, "Mohon dapat dilakukan proses pembuatan master data kode material barang sebagai berikut :", kiri + 14, y);

  const cc = Array.from(new Set(req.items.map((i) => kapalCostCenter(i.kapal)).filter(Boolean))).join(", ");
  const isian: [string, string][] = [
    ["Jenis Item", "Stock / Non Stock / Asset *"],
    ["Nama Pekerjaan / Uraian", `${req.judulFormulir} ${bulanTahun(req.tanggal)}`],
    ["Cost Center", cc],
    ["Unit Kerja", "Ternate"],
    ["Lokasi", "Kantor Pusat / Regional / Cabang *"],
  ];
  y += 22;
  isian.forEach(([k, v], i) => {
    const yb = y + i * 15;
    tulis(a, k, kiri + 14, yb);
    tulis(a, ":", kiri + 136, yb);
    // baris pertama memang dicetak miring pada borang aslinya
    tulis(a, v, kiri + 146, yb, i === 0 ? { font: "miring" } : {});
  });

  y += isian.length * 15 + 14;
  tulis(a, "Berikut terlampir format (template) pembuatan master data item barang/jasa di SAP, untuk dapat diproses lebih lanjut di SAP.",
    kiri + 14, y, { ukuran: 8.5 });

  // ── blok tanda tangan ────────────────────────────────────────────────
  const xKolom2 = kiri + lebar * 0.55;
  y += 34;
  tulis(a, `Ternate, ${ddmmyyyy(req.tanggal)}`, kanan - 16, y, { font: "miring", rata: "kanan" });
  y += 18;
  tulis(a, "Diperiksa dan Disetujui Oleh,", kiri + 90, y, { rata: "tengah" });
  tulis(a, "Dibuat Oleh,", xKolom2 + 70, y, { rata: "tengah" });

  /*
   * Nama dicetak DULU, tanda tangan dan stempel di atasnya.
   *
   * Di kertas, urutannya memang begitu: lembar tercetak lebih dulu, lalu
   * ditandatangani dan distempel. Versi sebelumnya menggambar tanda tangan
   * lebih dulu sehingga nama tercetak menimpa tinta — susunan yang tidak
   * pernah terjadi pada lembar sungguhan dan langsung terasa janggal saat
   * dibandingkan dengan hasil pindaian.
   */
  const yNama = y + 82;
  const xNamaKiri = kiri + 90;
  const xNamaKanan = xKolom2 + 70;
  tulis(a, req.deptHead, xNamaKiri, yNama, { rata: "tengah" });
  tulis(a, "Dept Head Operasional dan Teknik", xNamaKiri, yNama + 13, { font: "tebal", rata: "tengah" });
  tulis(a, req.stafTeknik, xNamaKanan, yNama, { rata: "tengah" });
  tulis(a, "Staf Teknik Armada dan Fasilitas", xNamaKanan, yNama + 13, { font: "tebal", rata: "tengah" });

  if (req.bubuhiTtd) {
    const [cap, dept, staf] = await Promise.all([
      ambilTtdPenuh("stempel"), ambilTtdPenuh("deptHead"), ambilTtdPenuh("stafTeknik"),
    ]);

    /*
     * Letaknya mengikuti lembar yang sudah ditandatangani basah: tanda tangan
     * duduk di ATAS nama dan ujung bawahnya melewati baris nama sedikit,
     * bukan berhenti rapi di atasnya. Stempel MENIMPA tanda tangan Dept.
     * Head — begitu stempel dibubuhkan di atas kertas — dan bisa begitu di
     * sini karena ketiga berkasnya berlatar tembus pandang (stempel 79%
     * tembus), jadi yang di bawah tetap terbaca. Urutan gambarnya pasti di
     * pdf-lib: yang digambar belakangan ada di atas.
     */
    const lebarDept = 132;
    const tinggiDept = 86;
    if (dept) {
      await sisipGambar(a, dept, xNamaKiri - lebarDept / 2 + 6, yNama - tinggiDept + 12, lebarDept, tinggiDept);
    }
    const lebarStaf = 56;
    const tinggiStaf = 86;
    if (staf) {
      await sisipGambar(a, staf, xNamaKanan - lebarStaf / 2, yNama - tinggiStaf + 14, lebarStaf, tinggiStaf);
    }
    // sedikit dipudarkan: tinta stempel di kertas tidak pernah sepekat cetakan,
    // dan tanpa itu lingkarannya tampak seperti tempelan gambar
    const sisiCap = 78;
    if (cap) {
      // digeser sedikit ke kiri-bawah dari titik tengah nama: itu tempat
      // stempel jatuh kalau dibubuhkan orang, dan cukup rendah supaya tidak
      // menabrak baris "Diperiksa dan Disetujui Oleh," di atasnya
      await sisipGambar(a, cap, xNamaKiri - sisiCap / 2 - 20, yNama - sisiCap + 21, sisiCap, sisiCap, 0.88);
    }
  }

  // ── lembar pengesahan (diisi pusat) ──────────────────────────────────
  const sahAtas = badanAtas + badanTinggi;
  const sahTinggi = 190;
  kotak(a, kiri, sahAtas, lebar, sahTinggi);
  garisH(a, kiri, kanan, sahAtas + 20);
  tulis(a, "LEMBAR PENGESAHAN", (kiri + kanan) / 2, sahAtas + 6, { font: "tebal", rata: "tengah" });

  // dipenggal, bukan dikecilkan: kalimatnya panjang dan kalau dibiarkan
  // satu baris ia menembus garis tepi kanan
  penggal(a.biasa, "Keputusan : Dapat / Tidak dapat* diproses untuk pembuatan master data kode material barang "
    + "sesuai data di atas dan template SAP terlampir.", 8, lebar - 30)
    .forEach((b, i) => tulis(a, b, kiri + 14, sahAtas + 34 + i * 11, { ukuran: 8 }));
  tulis(a, "…….........., ..…/…...../…......", kanan - 16, sahAtas + 62, { rata: "kanan" });

  tulis(a, "Disetujui oleh,", kiri + 90, sahAtas + 86, { rata: "tengah" });
  tulis(a, "Disetujui oleh,", xKolom2 + 70, sahAtas + 86, { rata: "tengah" });
  tulis(a, "…….............................................", kiri + 90, sahAtas + 150, { rata: "tengah" });
  tulis(a, "…….............................................", kiri + 90, sahAtas + 162, { rata: "tengah" });
  tulis(a, "…................................", xKolom2 + 70, sahAtas + 150, { rata: "tengah" });
  tulis(a, "…….....................................", xKolom2 + 70, sahAtas + 162, { rata: "tengah" });
  tulis(a, "*) coret yang tidak perlu", kanan - 20, sahAtas + 174, { ukuran: 8, rata: "kanan" });

  return Buffer.from(await pdf.save());
}
