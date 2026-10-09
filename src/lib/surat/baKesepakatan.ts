/**
 * BERITA ACARA KESEPAKATAN BERSAMA — pendamping surat Persetujuan Tambahan
 * Waktu (Hari) Docking.
 *
 * Suratnya sendiri menutup dengan catatan bahwa penambahan waktu itu "akan
 * dituangkan dalam sebuah Kesepakatan Bersama". Selama ini berita acaranya
 * diketik ulang dari berkas tahun lalu, padahal seluruh isinya sudah ada di
 * borang suratnya: kapal, tahun, galangan, perjanjian, rentang tambahan, pasal
 * denda, dan termin. Mengetiknya ulang hanya membuka peluang kedua dokumen
 * menyebut tanggal yang berbeda untuk peristiwa yang sama — dan keduanya
 * ditandatangani bersamaan.
 *
 * Keluarannya .docx, bukan PDF: berita acara ini masih dirundingkan dengan
 * galangan sebelum diteken, dan nilai termin kerap berubah di menit terakhir.
 *
 * Bentuknya mengikuti dua berita acara yang sudah terbit — KMP. Ariwangan 2026
 * (PT Klasaman Indah Raya) dan KMP. Tuna 2026 (PT Industri Kapal Indonesia) —
 * yang isinya sama persis kecuali pihak keduanya. Karena itu profil galangan
 * dipisah ke tabel sendiri, bukan ditulis di badan dokumen.
 *
 * Yang TIDAK dibuat: tanda tangan, stempel, dan meterai. Berkas ini draf tak
 * bertanda tangan untuk diteken basah oleh kedua pihak.
 */
import {
  AlignmentType, BorderStyle, Document, ImageRun, Packer, Paragraph, Table,
  TableCell, TableRow, TextRun, WidthType,
} from "docx";
import { DataSurat } from "./types";
import { keAngka, namaKapalSurat, rupiahSurat, tanggalSurat } from "./format";
import { terbilangAngka } from "./terbilang";
import { hitungTambahHari } from "./templates/tambahanHariDock";

const ISIAN = "…………………";
const HURUF = "Arial";
const UKURAN = 22;          // 11 pt
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
  "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export interface BarisDasarBa {
  instansi?: string;
  nomor?: string;
  tanggal?: string;
  perihal?: string;
}

/**
 * Profil galangan: jabatan penanda tangan pihak kedua, alamat badan usahanya,
 * dan logo yang dipasang di kanan atas.
 *
 * NAMA ORANGNYA SENGAJA TIDAK DISIMPAN DI SINI. Berkas ini ikut terbit ke
 * repositori publik, dan nama pejabat perusahaan lain tidak perlu ikut ke
 * sana — riwayat git tidak bisa dicabut. Namanya diketik di borang saat
 * berita acaranya dibuat, dan itu memang lebih benar: pejabat galangan
 * berganti, sedangkan nama yang tertanam di kode diam-diam tetap lama.
 *
 * Jabatan dan alamat tetap disimpan karena keduanya melekat pada perusahaan,
 * bukan pada orangnya, dan sudah tercetak di kop surat mereka sendiri.
 */
export interface ProfilGalangan {
  kode: string;        // dipakai pada nomor BA: BA.09/HK.204/ASDP-KIR/VII/2026
  jabatan: string;
  badan: string;       // kalimat "bertindak untuk dan atas nama …"
  logo: string;        // berkas di /public
}

export const PROFIL_GALANGAN: ProfilGalangan[] = [
  {
    kode: "IKI",
    jabatan: "General Manager PT Industri Kapal Indonesia (Persero) Unit Bitung",
    badan: "PT. Industri Kapal Indonesia (Persero), Jln. Samuel Languyu-Bitung",
    logo: "/galangan/logo-iki.png",
  },
  {
    kode: "KIR",
    jabatan: "Direktur Utama PT Klasaman Indah Raya",
    badan: "PT. Klasaman Indah Raya, Jl. Gurame No. 229, Kel. Klaligi, Kec. Sorong Manoi, Kota Sorong",
    logo: "/galangan/logo-kir.png",
  },
];

/**
 * Cocokkan nama galangan pada borang ke profilnya.
 *
 * Dicocokkan lewat kata cirinya, bukan nama persis: borang menulis "PT.
 * Industri Kapal Indonesia (Persero) Kota Bitung" sedangkan berita acaranya
 * "Unit Bitung", dan pencocokan mentah akan gagal pada keduanya.
 */
export function profilGalangan(nama: string): ProfilGalangan | null {
  const t = (nama || "").toLowerCase();
  if (/industri\s*kapal|(^|\W)iki(\W|$)/.test(t)) return PROFIL_GALANGAN[0];
  if (/klasaman/.test(t)) return PROFIL_GALANGAN[1];
  return null;
}

export interface IsiBaKesepakatan {
  kapal: string;
  tahun: string;
  galangan: string;
  /** nomor berita acara; kosong berarti belum terbit */
  noBa: string;
  /** tanggal berita acara (ISO) — dipakai di kalimat pembuka dan blok tanda tangan */
  tglBa: string;
  /** surat persetujuan dari cabang: berita acara ini menyebutnya pada butir 2 */
  noSuratGm: string;
  tglSuratGm: string;
  noSperj: string;
  tglSperj: string;
  mulaiKontrak: string;
  jangkaHari: string;
  hariTambah: string;
  pasalDenda: string;
  pasalBayar: string;
  terminPotong: string;
  terminBayar: string;
  /** nilai termin yang dibayarkan 100%, termasuk PPN */
  nilaiTermin: number;
  /** tanggal rekomendasi BKI atas pengedokan — butir pertimbangan, boleh kosong */
  tglBki: string;
  dasar: BarisDasarBa[];
  /** pihak kedua; kosong berarti ikut profil galangan */
  namaKedua: string;
  jabatanKedua: string;
  /** pihak pertama, dari kop surat */
  namaPertama: string;
  jabatanPertama: string;
}

const tglPanjang = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso || "").trim());
  return m ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}` : "";
};

const awalBesar = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** "Senin tanggal enam bulan Juli tahun Dua ribu dua puluh enam (06-07-2026)" */
export function kalimatTanggal(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso || "").trim());
  if (!m) return ISIAN;
  const [th, bl, hr] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(th, bl - 1, hr));
  return `${HARI[d.getUTCDay()]} tanggal ${terbilangAngka(hr)} bulan ${BULAN[bl - 1]} `
    + `tahun ${awalBesar(terbilangAngka(th))} (${m[3]}-${m[2]}-${m[1]})`;
}

/** nomor BA yang disarankan bila belum diisi: bulan dan tahunnya ikut tanggalnya */
export function nomorBaSaran(kode: string, iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec((iso || "").trim());
  if (!m) return `BA.__/HK.204/ASDP-${kode}/__/____`;
  return `BA.__/HK.204/ASDP-${kode}/${ROMAWI[Number(m[2]) - 1]}/${m[1]}`;
}

const lamaHari = (n: number) => `${n} (${terbilangAngka(n)}) hari`;

/** butir dasar dicari lewat kata ciri pada sumbernya, bukan lewat urutannya */
const cariDasar = (dasar: BarisDasarBa[], pola: RegExp): BarisDasarBa | null =>
  (dasar || []).find((r) => pola.test(`${r?.instansi || ""} ${r?.perihal || ""}`)) || null;

const sebut = (r: BarisDasarBa | null) => {
  if (!r) return { nomor: ISIAN, tanggal: ISIAN };
  return {
    nomor: (r.nomor || "").trim() || ISIAN,
    tanggal: tglPanjang(String(r.tanggal || "")) || ISIAN,
  };
};

/** tujuh butir kesepakatan — isinya sama di tiap berita acara, angkanya saja berbeda */
export function butirKesepakatan(d: IsiBaKesepakatan): string[] {
  const h = hitungTambahHari({
    mulaiKontrak: d.mulaiKontrak, jangkaHari: d.jangkaHari, hariTambah: d.hariTambah,
  } as unknown as DataSurat);
  const kapal = d.kapal || ISIAN;
  const lama = lamaHari(h.tambah);
  const rentang = `sejak tanggal ${tglPanjang(h.mulaiTambah) || ISIAN} s/d ${tglPanjang(h.selesaiTambah) || ISIAN}`;
  const galangan = d.galangan || ISIAN;
  const sperj = `nomor : ${d.noSperj || ISIAN} tanggal ${tglPanjang(d.tglSperj) || ISIAN}`;
  const dariGalangan = sebut(cariDasar(d.dasar, /galangan/i));

  return [
    `Bahwa PIHAK KEDUA mengajukan permohonan penambahan hari docking ${kapal} selama ${lama} `
      + `${rentang} sesuai dengan surat dari Galangan nomor : ${dariGalangan.nomor} `
      + `tanggal ${dariGalangan.tanggal} perihal Penambahan hari docking ${kapal} Tahun ${d.tahun};`,
    `Bahwa PIHAK PERTAMA memberikan perpanjangan waktu hari docking ${kapal} selama ${lama} `
      + `${rentang} sesuai dengan surat General Manager PT. ASDP Indonesia Ferry (Persero) `
      + `Cabang Ternate nomor : ${d.noSuratGm || ISIAN} tanggal ${tglPanjang(d.tglSuratGm) || ISIAN} `
      + `perihal Persetujuan Tambahan hari Docking ${kapal} Tahun ${d.tahun};`,
    `Seluruh biaya general service yang diakibatkan oleh penambahan waktu selama ${lama} menjadi `
      + `tanggung jawab dari Galangan ${galangan} dan pihak PT. ASDP Indonesia Ferry (Persero) `
      + `Cabang Ternate dibebaskan dari biaya general service tersebut;`,
    `Bahwa PIHAK PERTAMA akan mengenakan denda kepada PIHAK KEDUA atas keterlambatan pekerjaan `
      + `selama ${lama} sesuai dengan pasal ${d.pasalDenda || ISIAN} pada surat perjanjian ${sperj}, `
      + `yang mana nilai dari denda tersebut akan dipotong dari termin ${d.terminPotong || ISIAN} docking;`,
    `Bahwa PIHAK KEDUA akan menerima pengenaan denda selama ${lama} sesuai ketentuan pasal `
      + `${d.pasalDenda || ISIAN} surat perjanjian ${sperj} yang akan dipotong pada saat pembayaran `
      + `termin ${d.terminPotong || ISIAN} docking ${kapal};`,
    `Pembayaran termin ${d.terminBayar || ISIAN} akan dibayarkan 100% sesuai dengan pasal `
      + `${d.pasalBayar || ISIAN} pada surat perjanjian ${sperj} tentang Tata Cara Pembayaran dengan `
      + `nilai sebesar ${d.nilaiTermin ? rupiahSurat(d.nilaiTermin) : ISIAN} (termasuk PPN 11%);`,
    `PARA PIHAK sepakat akan mengatur pengenaan denda tersebut dalam suatu Addendum Perjanjian `
      + `Docking ${kapal} tahun ${d.tahun}.`,
  ];
}

/**
 * Butir pertimbangan: dokumen yang mendasari kesepakatan.
 *
 * Disusun dari daftar dasar surat induknya supaya kedua dokumen menyebut
 * nomor dan tanggal yang sama persis. Rekomendasi BKI dan surat persetujuan
 * cabang ditambahkan di sini karena surat induknya tidak memakai keduanya.
 */
export function butirPertimbangan(d: IsiBaKesepakatan): string[] {
  const h = hitungTambahHari({
    mulaiKontrak: d.mulaiKontrak, jangkaHari: d.jangkaHari, hariTambah: d.hariTambah,
  } as unknown as DataSurat);
  const kapal = d.kapal || ISIAN;
  const daftar: string[] = [];

  daftar.push(`Surat perjanjian nomor : ${d.noSperj || ISIAN} tanggal ${tglPanjang(d.tglSperj) || ISIAN} `
    + `tentang Perjanjian pekerjaan docking ${kapal} tahun ${d.tahun} yang mana jangka waktu pekerjaan `
    + `adalah selama ${lamaHari(h.jangka)} (${tglPanjang(h.mulaiKontrak) || ISIAN} s/d `
    + `${tglPanjang(h.selesaiKontrak) || ISIAN});`);

  (d.dasar || [])
    .filter((r) => (r?.nomor || r?.instansi || "").trim())
    .filter((r) => !/perjanjian/i.test(`${r.instansi || ""}`))
    .forEach((r) => {
      const inti = (r.instansi || "Surat").trim();
      const hal = (r.perihal || "").trim();
      /*
       * Yang disebut setelah sumbernya bukan selalu nama kapal. Surat dari
       * galangan dikenali dari nama galangannya — "Surat dari Galangan KMP.
       * Ariwangan nomor …" menyebut kapal sebagai penerbit surat, padahal
       * penerbitnya galangan.
       */
      const milik = /galangan/i.test(inti) ? (d.galangan || "").trim() : kapal;
      daftar.push(`${inti}${milik ? ` ${milik}` : ""} nomor : ${(r.nomor || "").trim() || ISIAN} tanggal `
        + `${tglPanjang(String(r.tanggal || "")) || ISIAN}${hal ? ` perihal ${hal}` : ""};`);
    });

  if (d.tglBki) daftar.push(`Rekomendasi BKI atas pengedokan ${kapal} tanggal ${tglPanjang(d.tglBki)};`);

  daftar.push(`Surat General Manager PT. ASDP Indonesia Ferry (Persero) nomor : ${d.noSuratGm || ISIAN} `
    + `tanggal ${tglPanjang(d.tglSuratGm) || ISIAN} perihal Persetujuan Tambahan Hari Docking ${kapal} `
    + `Tahun ${d.tahun};`);

  daftar.push("Dengan Berita Acara Kesepakatan ini dibuat, maka segala sesuatu yang terkait dengan denda, "
    + "biaya pekerjaan tambahan/pengurangan maupun jangka waktu pelaksanaan pekerjaan akan dituangkan "
    + `dalam suatu addendum perjanjian docking ${kapal} yang akan ditandatangani oleh PARA PIHAK.`);
  return daftar;
}

/* ── perabot dokumen ───────────────────────────────────────────────────── */

const TANPA_GARIS = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

const teks = (t: string, opsi: { tebal?: boolean; miring?: boolean } = {}) =>
  new TextRun({ text: t, bold: opsi.tebal, italics: opsi.miring, font: HURUF, size: UKURAN });

const alinea = (t: string, opsi: { rata?: (typeof AlignmentType)[keyof typeof AlignmentType]; sesudah?: number } = {}) =>
  new Paragraph({
    alignment: opsi.rata || AlignmentType.JUSTIFIED,
    spacing: { after: opsi.sesudah ?? 120, line: 276 },
    children: [teks(t)],
  });

/** butir bernomor dengan gantungan — dibuat manual supaya nomornya pasti urut 1..n */
const butirNomor = (t: string, n: number) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 80, line: 276 },
    indent: { left: 850, hanging: 400 },
    children: [teks(`${n}.\t${t}`)],
  });

const barisPihak = (label: string, isi: string) =>
  new Paragraph({
    spacing: { after: 20, line: 276 },
    indent: { left: 1150, hanging: 450 },
    children: [teks(`${label}\t: ${isi}`)],
  });

const selKosong = (baris: Paragraph[]) =>
  new TableCell({ children: baris, width: { size: 50, type: WidthType.PERCENTAGE }, borders: TANPA_GARIS });

const tengah = (t: string, tebal = false, garisBawah = false) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: t, bold: tebal, font: HURUF, size: UKURAN,
      underline: garisBawah ? {} : undefined,
    })],
  });

/**
 * Kop dua logo: ASDP di kiri, galangan di kanan.
 *
 * Gambarnya diambil saat dokumen dirakit, bukan ditanam sebagai teks base64 di
 * berkas ini — logo galangan berganti mengikuti galangan yang dipilih, dan
 * menanam keduanya membuat berkas ini membawa logo yang tidak dipakai.
 */
async function ambilGambar(jalur: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(jalur);
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}

function selGambar(data: Uint8Array | null, lebar: number, tinggi: number, kanan = false) {
  const isi = data
    ? [new Paragraph({
      alignment: kanan ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [new ImageRun({ data, transformation: { width: lebar, height: tinggi } })],
    })]
    : [new Paragraph({ text: "" })];
  return new TableCell({ children: isi, width: { size: 50, type: WidthType.PERCENTAGE }, borders: TANPA_GARIS });
}

export async function dokumenBaKesepakatan(d: IsiBaKesepakatan): Promise<Document> {
  const profil = profilGalangan(d.galangan);
  // nama pihak kedua hanya dari borang; kalau belum diisi, keluar sebagai titik-titik
  const namaKedua = (d.namaKedua || "").trim() || ISIAN;
  const jabatanKedua = (d.jabatanKedua || "").trim() || profil?.jabatan || ISIAN;
  const badanKedua = profil?.badan || d.galangan || ISIAN;
  const kapal = d.kapal || ISIAN;

  const [logoAsdp, logoGalangan] = await Promise.all([
    ambilGambar("/logo-asdp.png"),
    profil ? ambilGambar(profil.logo) : Promise.resolve(null),
  ]);

  const kop = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TANPA_GARIS,
    rows: [new TableRow({
      children: [selGambar(logoAsdp, 120, 54), selGambar(logoGalangan, 70, 70, true)],
    })],
  });

  const ttd = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TANPA_GARIS,
    rows: [
      new TableRow({ children: [selKosong([tengah("PIHAK KEDUA")]), selKosong([tengah("PIHAK PERTAMA")])] }),
      /*
       * Lima baris kosong, bukan tiga: ruang ini harus memuat tanda tangan
       * basah, stempel perusahaan, dan meterai yang ditempel bertumpuk. Tiga
       * baris cukup untuk tanda tangan saja, dan meterainya jadi menimpa nama.
       */
      new TableRow({
        children: [
          selKosong(Array.from({ length: 5 }, () => new Paragraph({ text: "" }))),
          selKosong(Array.from({ length: 5 }, () => new Paragraph({ text: "" }))),
        ],
      }),
      new TableRow({
        children: [
          selKosong([tengah(namaKedua, true, true)]),
          selKosong([tengah(d.namaPertama || ISIAN, true, true)]),
        ],
      }),
    ],
  });

  const isi: (Paragraph | Table)[] = [
    kop,
    new Paragraph({ text: "", spacing: { after: 120 } }),
    tengah("BERITA ACARA KESEPAKATAN BERSAMA", true, true),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [teks(`Nomor : ${d.noBa || nomorBaSaran(profil?.kode || "____", d.tglBa)}`)],
    }),
    alinea(`Pada hari ini ${kalimatTanggal(d.tglBa)} kami yang bertandatangan dibawah ini :`, { sesudah: 180 }),

    barisPihak("1.  Nama", d.namaPertama || ISIAN),
    barisPihak("     Jabatan", d.jabatanPertama || "General Manager PT. ASDP Indonesia Ferry (Persero) Cabang Ternate"),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 180, line: 276 },
      indent: { left: 700 },
      children: [teks("Dalam hal ini bertindak untuk dan atas nama PT. ASDP Indonesia Ferry (Persero) "
        + "Cabang Ternate, Pelabuhan Bastiong Kecamatan Ternate-Maluku Utara, untuk selanjutnya "
        + "disebut sebagai PIHAK PERTAMA.")],
    }),

    barisPihak("2.  Nama", namaKedua),
    barisPihak("     Jabatan", jabatanKedua),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 180, line: 276 },
      indent: { left: 700 },
      children: [teks(`Dalam hal ini bertindak untuk dan atas nama ${badanKedua}, untuk selanjutnya `
        + "disebut sebagai PIHAK KEDUA.")],
    }),

    alinea("PIHAK PERTAMA dan PIHAK KEDUA yang selanjutnya disebut PARA PIHAK atau secara sendiri-sendiri "
      + "disebut sebagai PIHAK, dengan ini melakukan kesepakatan bersama dalam rangka pekerjaan Docking "
      + `${kapal} tahun ${d.tahun}, antara lain :`, { sesudah: 160 }),
    ...butirKesepakatan(d).map((t, i) => butirNomor(t, i + 1)),

    new Paragraph({ text: "", spacing: { after: 120 } }),
    alinea("Adapun kesepakatan bersama tersebut di atas dengan memperhatikan dan mempertimbangkan "
      + "beberapa factor antara lain :", { sesudah: 160 }),
    ...butirPertimbangan(d).map((t, i) => butirNomor(t, i + 1)),

    new Paragraph({ text: "", spacing: { after: 200 } }),
    alinea("Demikian berita acara kesepakatan bersama ini dibuat dengan sebenarnya untuk dipergunakan "
      + "sebagaimana mestinya.", { sesudah: 320 }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 200 },
      children: [teks(`Ternate, ${tglPanjang(d.tglBa) || ISIAN}`)],
    }),
    ttd,
  ];

  return new Document({
    creator: "Manajemen Report Teknik ASDP Ternate",
    title: `Berita Acara Kesepakatan Bersama Docking ${kapal} Tahun ${d.tahun}`,
    sections: [{
      properties: { page: { margin: { top: 1000, right: 1134, bottom: 1000, left: 1134 } } },
      children: isi,
    }],
  });
}

/** Rakit isi berita acara dari borang surat + kop-nya. */
export function isiBaDariSurat(d: DataSurat, kop: {
  nomor: string; tanggal: string; namaPenanda: string; jabatanPenanda: string;
}): IsiBaKesepakatan {
  return {
    kapal: namaKapalSurat(String(d.kapal || "")),
    tahun: String(d.tahun || new Date().getFullYear()),
    galangan: String(d.galangan || ""),
    noBa: String(d.noBa || ""),
    // berita acara diteken bersamaan dengan suratnya kecuali ditentukan lain
    tglBa: String(d.tglBa || kop.tanggal || ""),
    noSuratGm: String(d.noSuratGm || kop.nomor || ""),
    tglSuratGm: String(d.tglSuratGm || kop.tanggal || ""),
    noSperj: String(d.noSperj || ""),
    tglSperj: String(d.tglSperj || ""),
    mulaiKontrak: String(d.mulaiKontrak || ""),
    jangkaHari: String(d.jangkaHari || ""),
    hariTambah: String(d.hariTambah || ""),
    pasalDenda: String(d.pasalDenda || ""),
    pasalBayar: String(d.pasalBayar || ""),
    terminPotong: String(d.terminPotong || ""),
    terminBayar: String(d.terminBayar || ""),
    nilaiTermin: keAngka(d.nilaiTermin),
    tglBki: String(d.tglBki || ""),
    dasar: (d.dasar as BarisDasarBa[]) || [],
    namaKedua: String(d.namaKedua || ""),
    jabatanKedua: String(d.jabatanKedua || ""),
    namaPertama: kop.namaPenanda,
    jabatanPertama: kop.jabatanPenanda,
  };
}

export async function unduhBaKesepakatan(isi: IsiBaKesepakatan, namaBerkas: string) {
  const blob = await Packer.toBlob(await dokumenBaKesepakatan(isi));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaBerkas;
  a.click();
  URL.revokeObjectURL(url);
}

/** dipakai borang untuk menampilkan tanggal surat perjanjian apa adanya */
export const tanggalBa = (iso: string) => tanggalSurat(iso);
