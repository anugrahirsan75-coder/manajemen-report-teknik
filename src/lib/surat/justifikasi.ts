/**
 * LAMPIRAN 2 — Justifikasi percepatan proses penerbitan SPB/J.
 *
 * Surat pelimpahan dan permohonan ke regional selalu melampirkan justifikasi
 * ini, dan selama ini diketik ulang setiap kali. Isinya sebetulnya sudah ada
 * seluruhnya di borang suratnya: kapal, tahun, nilai, dan tabel dasar
 * permohonan. Yang ditambahkan hanya dua hal yang tidak dipakai surat induknya
 * — tanggal rencana dockspace dan target hari docking.
 *
 * Keluarannya .docx, bukan PDF. Justifikasi kerap masih disunting sedikit
 * sebelum ditandatangani: satu kalimat alasan diganti, satu angka dikoreksi.
 * PDF memaksa kembali ke sini untuk perubahan sekecil itu.
 *
 * Bentuknya mengikuti justifikasi yang sudah terbit untuk KMP. Ngafi 2026 —
 * empat alinea, lalu blok tanda tangan dua kolom: "Mengetahui" di kiri,
 * "Pembuat" di kanan.
 */
import {
  AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell,
  TableRow, TextRun, WidthType, BorderStyle,
} from "docx";
import { DataSurat } from "./types";
import { keAngka, namaKapalSurat, rupiahSurat, tanggalSurat } from "./format";
import { terbilangRupiah } from "./terbilang";

export interface BarisDasarJustifikasi {
  instansi?: string;
  nomor?: string;
  tanggal?: string;
  perihal?: string;
}

export interface IsiJustifikasi {
  kapal: string;
  tahun: string;
  nilai: number;
  /** tanggal rencana kapal masuk dock (ISO) — dipakai di alinea pertama */
  tglDockspace: string;
  /** target hari docking, menentukan kalimat "keterbatasan waktu" */
  targetHari: string;
  dasar: BarisDasarJustifikasi[];
  cabang: string;
  tanggalSurat: string;
  mengetahuiNama: string;
  mengetahuiJabatan: string;
  pembuatNama: string;
  pembuatJabatan: string;
}

/** titik-titik isian, dipakai kalau datanya memang belum ada */
const ISIAN = "…………………";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
  "Agustus", "September", "Oktober", "November", "Desember"];

export function tanggalPanjang(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso || "").trim());
  if (!m) return "";
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}`;
}

/**
 * Cari butir dasar yang merupakan surat persetujuan dari Direktur Teknik.
 *
 * Alinea pertama justifikasi menyebut surat itu beserta nomor dan tanggalnya.
 * Dicari dari perihalnya, bukan dari urutannya: urutan butir berubah-ubah
 * antar surat, perihalnya tidak.
 */
export function cariPersetujuan(dasar: BarisDasarJustifikasi[]): BarisDasarJustifikasi | null {
  const cocok = (dasar || []).find((r) =>
    /persetujuan/i.test(r?.perihal || "") || /direktur teknik/i.test(r?.instansi || ""));
  return cocok || null;
}

export function kalimatJustifikasi(d: IsiJustifikasi): string[] {
  const kapal = d.kapal || ISIAN;
  const tahun = d.tahun || ISIAN;
  const p = cariPersetujuan(d.dasar);
  const nomorP = p?.nomor?.trim() || ISIAN;
  const tglP = tanggalSurat(p?.tanggal || "") || ISIAN;
  const dockspace = tanggalPanjang(d.tglDockspace) || ISIAN;
  const hari = String(d.targetHari || "").trim() || ISIAN;
  const cabang = d.cabang || "Cabang Ternate";

  const satu =
    `Sehubungan dengan surat persetujuan Biaya Docking dan Investasi ${kapal} `
    + `Tahun ${tahun} dari Direktur Teknik, nomor ${nomorP} Tanggal ${tglP} Perihal `
    + `Persetujuan Biaya Docking dan Investasi ${kapal} Tahun ${tahun}, serta `
    + `memperhatikan rencana dockspace ${kapal} yang dijadwalkan pada tanggal `
    + `${dockspace}, dipandang perlu dilakukan percepatan proses penerbitan Surat `
    + `Pemesanan Barang/Jasa Pekerjaan Docking dan Investasi dimaksud agar `
    + `pelaksanaan pekerjaan dapat segera dimulai dan berjalan sesuai jadwal yang `
    + `telah disepakati.`;

  const dua =
    `Mengingat keterbatasan waktu hari docking yang sudah ditetapkan (target ${hari} hari) `
    + `maka untuk menghindari keterlambatan hari docking yang dapat berdampak pada `
    + `mundurnya pengoperasian kapal dan terganggunya pelayanan kepada pengguna jasa, `
    + `maka proses pengadaan dan penerbitan Surat Pemesanan Barang/Jasa Pekerjaan `
    + `Docking dan Investasi ${kapal} Tahun ${tahun} kami mohon untuk dapat `
    + `dilaksanakan di ${cabang}.`;

  const tiga =
    `Pelaksanaan proses di tingkat cabang dimaksudkan untuk mempercepat penyelesaian `
    + `administrasi pengadaan, mempermudah koordinasi teknis secara langsung dengan `
    + `pihak galangan, serta mempercepat pengambilan keputusan di lapangan, sehingga `
    + `pelaksanaan Docking ${kapal} dapat segera dimulai dan diselesaikan tepat waktu `
    + `sesuai target yang telah ditetapkan.`;

  const empat = "Demikian justifikasi ini kami sampaikan untuk menjadi bahan proses lebih lanjut, terima kasih.";
  return [satu, dua, tiga, empat];
}

export function judulJustifikasi(d: IsiJustifikasi): string {
  return "JUSTIFIKASI PERCEPATAN PROSES PENERBITAN SURAT PEMESANAN BARANG/JASA "
    + `PEKERJAAN DOCKING DAN INVESTASI ${d.kapal || ISIAN} TAHUN ${d.tahun || ISIAN}`;
}

const TANPA_GARIS = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

const selTtd = (baris: Paragraph[]) =>
  new TableCell({ children: baris, width: { size: 50, type: WidthType.PERCENTAGE }, borders: TANPA_GARIS });

const tengah = (teks: string, tebal = false) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: teks, bold: tebal, font: "Arial", size: 22 })],
  });

export function dokumenJustifikasi(d: IsiJustifikasi): Document {
  const alinea = kalimatJustifikasi(d).map((t) =>
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 200, line: 276 },
      indent: { firstLine: 720 },
      children: [new TextRun({ text: t, font: "Arial", size: 22 })],
    }));

  /*
   * Blok tanda tangan dibuat sebagai tabel tanpa garis, bukan dengan tab.
   * Tab bergeser begitu nama atau jabatannya berganti panjang, dan dokumen
   * yang masih akan disunting pasti mengalami itu.
   */
  const ttd = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TANPA_GARIS,
    rows: [
      new TableRow({
        children: [
          selTtd([tengah("Mengetahui,")]),
          selTtd([tengah("Pembuat,")]),
        ],
      }),
      new TableRow({
        children: [
          selTtd([new Paragraph({ text: "" }), new Paragraph({ text: "" }), new Paragraph({ text: "" })]),
          selTtd([new Paragraph({ text: "" }), new Paragraph({ text: "" }), new Paragraph({ text: "" })]),
        ],
      }),
      new TableRow({
        children: [
          selTtd([tengah(d.mengetahuiNama || ISIAN, true), tengah(d.mengetahuiJabatan || "")]),
          selTtd([tengah(d.pembuatNama || ISIAN, true), tengah(d.pembuatJabatan || "")]),
        ],
      }),
    ],
  });

  return new Document({
    creator: "Manajemen Report Teknik ASDP Ternate",
    title: judulJustifikasi(d),
    sections: [{
      properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 400 },
          children: [new TextRun({
            text: judulJustifikasi(d), bold: true, underline: {}, font: "Arial", size: 24,
          })],
        }),
        ...alinea,
        new Paragraph({ text: "", spacing: { after: 200 } }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 200 },
          children: [new TextRun({
            text: `Ternate, ${tanggalPanjang(d.tanggalSurat) || ISIAN}`, font: "Arial", size: 22,
          })],
        }),
        ttd,
      ],
    }],
  });
}

/** Rakit isi justifikasi dari borang surat + kop-nya. */
export function isiDariSurat(d: DataSurat, kop: {
  tanggal: string; namaPenanda: string; jabatanPenanda: string;
}): IsiJustifikasi {
  return {
    kapal: namaKapalSurat(String(d.kapal || "")) || String(d.pekerjaan || ""),
    tahun: String(d.tahun || new Date().getFullYear()),
    nilai: keAngka(d.nilai),
    tglDockspace: String(d.tglDockspace || ""),
    targetHari: String(d.targetHari || ""),
    dasar: (d.dasar as BarisDasarJustifikasi[]) || [],
    cabang: "Cabang Ternate",
    tanggalSurat: kop.tanggal,
    mengetahuiNama: kop.namaPenanda,
    mengetahuiJabatan: kop.jabatanPenanda,
    pembuatNama: "Irsan Anugrah",
    pembuatJabatan: "Staf Fasilitas dan Armada Tingkat I",
  };
}

export async function unduhJustifikasi(isi: IsiJustifikasi, namaBerkas: string) {
  const blob = await Packer.toBlob(dokumenJustifikasi(isi));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaBerkas;
  a.click();
  URL.revokeObjectURL(url);
}

/** rupiah + terbilang, dipakai bila justifikasi perlu menyebut nilainya */
export const nilaiTerbilang = (n: number) =>
  n ? `${rupiahSurat(n)} (${terbilangRupiah(n)})` : ISIAN;
