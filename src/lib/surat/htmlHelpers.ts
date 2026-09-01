/**
 * Pembangun HTML badan surat untuk editor e-office.
 *
 * ATURAN YANG TIDAK BOLEH DILANGGAR — editor e-office membuang blok <style> di
 * <head>, dan pernah membuat garis tabel hilang serta angka antar kolom menempel
 * jadi satu ("1.380.274.7961.466.529.390"). Maka:
 *   · tidak ada <style>, <head>, <html>, <body>, class, atau CSS eksternal;
 *   · seluruh gaya ditulis inline di tiap elemen;
 *   · atribut HTML lawas (border, cellpadding, bgcolor, align, width, <font>)
 *     tetap dipasang sebagai cadangan kalau CSS ikut dibuang.
 *
 * Semua fungsi di sini yang memasang gaya itu, jadi berkas template tidak perlu
 * mengulang string style panjang dan tidak mungkin lupa cadangannya.
 */

export const WARNA = {
  kepala: "#1F4E79",      // header tabel, teks putih
  subtotal: "#F4B183",    // sub total docking
  investasi: "#FFE699",   // sub total investasi
  total: "#FFFF00",       // grand total
  kepalaKuning: "#FFC000", // header tabel laporan rutin (teks hitam)
} as const;

/**
 * Ukuran huruf mengikuti hasil CETAK e-office, bukan tampilan layar: dengan
 * 11pt satu surat docking meluber ke halaman kedua hanya untuk kalimat
 * penutupnya. 10pt membuatnya selesai dalam satu halaman dan sepadan dengan
 * surat-surat lama cabang.
 */
export const UKURAN_ISI = "10pt";
export const UKURAN_TABEL = "8pt";

const GARIS = "border:1px solid #000000;padding:3px;word-wrap:break-word;";

export const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** pembungkus wajib seluruh badan surat */
export const bungkus = (isi: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:${UKURAN_ISI};line-height:1.45;color:#000000;">\n${isi}\n</div>`;

export const p = (isi: string, rata: "justify" | "left" | "center" = "justify") =>
  `<p style="margin:0 0 8px 0;text-align:${rata};font-size:${UKURAN_ISI};">${isi}</p>`;

export const b = (isi: string) => `<b>${isi}</b>`;
export const i = (isi: string) => `<i>${isi}</i>`;

interface OpsiSel {
  align?: "left" | "center" | "right";
  bg?: string;
  putih?: boolean;
  tebal?: boolean;
  miring?: boolean;
  colspan?: number;
  rowspan?: number;
  width?: string;
  valign?: "top" | "middle";
}

function atributSel(o: OpsiSel) {
  const a: string[] = [];
  if (o.align) a.push(`align="${o.align}"`);
  if (o.valign) a.push(`valign="${o.valign}"`);
  if (o.bg) a.push(`bgcolor="${o.bg}"`);
  if (o.colspan) a.push(`colspan="${o.colspan}"`);
  if (o.rowspan) a.push(`rowspan="${o.rowspan}"`);
  if (o.width) a.push(`width="${o.width}"`);
  return a.length ? " " + a.join(" ") : "";
}

function gayaSel(o: OpsiSel) {
  let g = GARIS;
  if (o.align) g += `text-align:${o.align};`;
  if (o.valign) g += `vertical-align:${o.valign};`;
  if (o.bg) g += `background-color:${o.bg};`;
  if (o.width) g += `width:${o.width};`;
  if (o.putih) g += "color:#FFFFFF;";
  if (o.tebal) g += "font-weight:bold;";
  if (o.miring) g += "font-style:italic;";
  return g;
}

function isiSel(isi: string, o: OpsiSel) {
  let t = isi === "" ? "&nbsp;" : isi;
  if (o.tebal) t = `<b>${t}</b>`;
  if (o.miring) t = `<i>${t}</i>`;
  // <font> sengaja dipakai: kalau editor membuang style, teks header tetap putih
  if (o.putih) t = `<font color="#FFFFFF">${t}</font>`;
  return t;
}

/** sel isi tabel */
export const td = (isi: string, o: OpsiSel = {}) =>
  `<td${atributSel(o)} style="${gayaSel(o)}">${isiSel(isi, o)}</td>`;

/** sel angka — selalu rata kanan, dengan atribut lawas ikut terpasang */
export const tdAngka = (isi: string, o: OpsiSel = {}) =>
  td(isi, { ...o, align: "right" });

/** sel kepala tabel */
export const th = (isi: string, o: OpsiSel = {}) => {
  const opsi: OpsiSel = { align: "center", bg: WARNA.kepala, putih: true, tebal: true, valign: "middle", ...o };
  return `<th${atributSel(opsi)} style="${gayaSel(opsi)}">${isiSel(isi, opsi)}</th>`;
};

export const baris = (sel: string[]) => `<tr>${sel.join("")}</tr>`;

/**
 * Tabel bergaris — bentuk yang dipakai untuk rincian anggaran.
 *
 * Baris kepala dipisah ke <thead> supaya ikut tercetak ulang bila tabel jatuh ke
 * halaman berikutnya. table-layout:fixed menahan lebar kolom mengikuti angka
 * width yang diberikan; tanpa itu uraian panjang melebarkan kolomnya sendiri dan
 * kolom terakhir terdorong keluar batas kertas.
 */
export const tabel = (isiBaris: string[], kepala?: string) =>
  `<table border="1" cellspacing="0" cellpadding="3" bordercolor="#000000" width="100%" `
  + `style="border-collapse:collapse;table-layout:fixed;width:100%;font-size:${UKURAN_TABEL};font-family:Arial,Helvetica,sans-serif;color:#000000;">\n`
  + (kepala
      ? `<thead>${kepala}</thead>\n<tbody>\n${isiBaris.join("\n")}\n</tbody>`
      : isiBaris.join("\n"))
  + `\n</table>`;

/**
 * Tabel data tanpa garis (spesifikasi kapal): dua kolom dengan pemisah titik dua.
 * cellpadding tetap dipasang supaya nilai tidak menempel ke labelnya bila CSS
 * dibuang editor.
 */
export const tabelData = (pasangan: [string, string][], lebarKiri = "160px") =>
  `<table border="0" cellspacing="0" cellpadding="3" width="100%" `
  + `style="border-collapse:collapse;font-size:${UKURAN_ISI};font-family:Arial,Helvetica,sans-serif;color:#000000;">\n`
  + pasangan.map(([kiri, kanan]) =>
      `<tr>`
      + `<td width="${lebarKiri}" valign="top" style="width:${lebarKiri};vertical-align:top;padding:3px;">${esc(kiri)}</td>`
      + `<td width="14" valign="top" style="width:14px;vertical-align:top;padding:3px;">:</td>`
      + `<td valign="top" style="vertical-align:top;padding:3px;">${kanan}</td>`
      + `</tr>`).join("\n")
  + `\n</table>`;

/**
 * Teks bebas yang boleh berpoin, dipakai di dalam sel tabel data.
 *
 * Baris berawalan "-" (atau • * ·) jadi butir bulat, baris berawalan "1." jadi
 * butir bernomor, sisanya tetap baris biasa. Nilai satu baris tanpa penanda
 * keluar apa adanya — surat yang sudah jadi tidak berubah sedikit pun
 * bentuknya, jadi ini aman dipasang pada isian yang sudah dipakai.
 *
 * Alasan adanya: rincian jarak antar-ruas dan daftar pelindung alami pernah
 * ditulis berderet dalam satu paragraf panjang, dan pembacanya harus menghitung
 * sendiri ada berapa ruas.
 */
const TANDA_BULAT = /^\s*[-–—•*·]\s+/;
const TANDA_NOMOR = /^\s*\(?\d+[.)]\s+/;

export function teksKaya(v: unknown): string {
  const baris = String(v ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const berpoin = baris.some((x) => TANDA_BULAT.test(x) || TANDA_NOMOR.test(x));
  if (!berpoin) return baris.length > 1
    ? baris.map((x) => `<div style="margin:0 0 3px 0;">${esc(x)}</div>`).join("\n")
    : esc(baris[0] ?? "");

  const keping: string[] = [];
  let kumpul: string[] = [];
  let jenis: "bulat" | "nomor" | "" = "";
  const tutup = () => {
    if (!kumpul.length) return;
    const tag = jenis === "nomor" ? "ol" : "ul";
    const gaya = jenis === "nomor" ? "decimal" : "disc";
    keping.push(
      `<${tag} style="list-style-type:${gaya};margin:0 0 4px 0;padding-left:20px;">\n`
      + kumpul.map((x) => `<li style="margin:0 0 2px 0;">${esc(x)}</li>`).join("\n")
      + `\n</${tag}>`);
    kumpul = []; jenis = "";
  };
  baris.forEach((t) => {
    const j = TANDA_BULAT.test(t) ? "bulat" : TANDA_NOMOR.test(t) ? "nomor" : "";
    if (!j) { tutup(); keping.push(`<div style="margin:0 0 3px 0;">${esc(t)}</div>`); return; }
    if (jenis && jenis !== j) tutup();
    jenis = j;
    kumpul.push(t.replace(j === "bulat" ? TANDA_BULAT : TANDA_NOMOR, ""));
  });
  tutup();
  return keping.join("\n");
}

/**
 * BADAN SURAT BERNOMOR — bentuk baku surat cabang.
 *
 * Surat keluar Ternate tidak memakai salam pembuka: isinya langsung berupa
 * butir bernomor 1, 2, 3, dengan rincian dokumen sebagai sub-butir a, b, c.
 * Contoh yang dipakai sebagai acuan (KU.3/00751/XII/ASDP-TTE/2024):
 *
 *   1. Mendasari dan Menindaklanjuti :
 *      a. Surat Direktur Teknik ... Nomor : ... tanggal ... perihal ...;
 *      b. Pengaplikasian System Analysis and Product (SAP) ...;
 *   2. Terkait butir 1 (satu) di atas, ... bersama ini kami mengajukan ...
 *   3. Demikian kami sampaikan, atas perhatian dan kerjasamanya diucapkan terimakasih.
 *
 * Penomorannya dipasang lewat atribut lawas type="1" dan type="a", BUKAN lewat
 * list-style CSS: editor e-office rutin membuang gaya, dan surat bernomor yang
 * kehilangan nomornya berubah jadi paragraf tak beraturan.
 *
 * Butir yang membawa tabel/blok memutus daftarnya, lalu penomoran disambung
 * dengan atribut start. Tabel di dalam <li> ikut terbawa penomoran dan kolom
 * terakhirnya keluar dari batas kertas.
 *
 * Blok yang lepas dari daftar itu tetap DIGESER sejauh indentasi daftarnya,
 * supaya tepi kirinya segaris dengan kalimat butir di atasnya. Dibiarkan rata
 * kiri halaman, tabelnya menonjol keluar melewati nomor butir dan surat
 * terbaca seperti dua dokumen yang ditempel jadi satu.
 */
export interface ButirSurat {
  teks: string;
  /** rincian a, b, c — dipakai untuk daftar surat dasar */
  sub?: string[];
  /** tabel atau blok HTML lain yang menyusul di bawah butir ini */
  blok?: string;
}

/** indentasi daftar bernomor, dipakai ulang supaya blok lepas tetap segaris */
const INDEN_DAFTAR = "26px";
const GAYA_OL = `margin:0 0 8px 0;padding-left:${INDEN_DAFTAR};font-size:${UKURAN_ISI};`;
const GAYA_LI = "margin:0 0 6px 0;text-align:justify;";

const daftarSub = (sub: string[]) =>
  `<ol type="a" style="${GAYA_OL}list-style-type:lower-alpha;margin-top:4px;">`
  + sub.map((x) => `<li style="${GAYA_LI}">${x}</li>`).join("")
  + "</ol>";

export function suratBernomor(butir: ButirSurat[]): string {
  const keping: string[] = [];
  let kumpul: string[] = [];
  let mulai = 1;

  const tutup = () => {
    if (!kumpul.length) return;
    keping.push(
      `<ol type="1" start="${mulai}" style="${GAYA_OL}list-style-type:decimal;">`
      + kumpul.join("") + "</ol>");
    mulai += kumpul.length;
    kumpul = [];
  };

  butir.filter((x) => x && (x.teks || x.blok)).forEach((x) => {
    kumpul.push(`<li style="${GAYA_LI}">${x.teks}${x.sub?.length ? daftarSub(x.sub) : ""}</li>`);
    // butir bertabel memutus daftar: tabel di dalam <li> ikut terdorong
    // indentasi dan kolom terakhirnya keluar dari batas kertas
    if (x.blok) {
      tutup();
      keping.push(`<div style="margin:0 0 8px ${INDEN_DAFTAR};">${x.blok}</div>`);
    }
  });
  tutup();
  return keping.join("");
}

/** daftar berbutir bulat kosong, dipakai pada surat perpanjangan sertifikat */
export const daftarButir = (butir: string[]) =>
  `<ul style="list-style-type:circle;margin:0 0 8px 0;padding-left:26px;font-size:${UKURAN_ISI};">\n`
  + butir.map((x) => `<li style="margin:0 0 4px 0;">${x}</li>`).join("\n")
  + `\n</ul>`;

/**
 * Penutup permohonan yang ditujukan ke Direktur Teknik.
 *
 * Usulan docking dan investasi dialamatkan ke Direktur Teknik, bukan ke pejabat
 * mana pun yang kebetulan menerima suratnya; sapaan "Bapak/Ibu" yang netral
 * justru terbaca seperti surat edaran. Mengikuti surat yang sudah terbit.
 */
export const PENUTUP_PERMOHONAN_DIRTEK =
  "Demikian permohonan ini kami sampaikan. Besar harapan kami agar permohonan dimaksud dapat "
  + "memperoleh persetujuan. Atas perhatian dan kerja sama Bapak Direktur Teknik, kami ucapkan terima kasih.";

export const PENUTUP_PERMOHONAN =
  "Demikian permohonan ini kami sampaikan. Besar harapan kami agar permohonan dimaksud dapat "
  + "memperoleh persetujuan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.";

export const PENUTUP_SAMPAI =
  "Demikian kami sampaikan, atas perhatiannya diucapkan terima kasih.";

/** penutup baku surat cabang, mengikuti surat yang sudah terbit */
export const PENUTUP_PERHATIAN =
  "Demikian kami sampaikan, atas perhatian dan kerjasamanya diucapkan terimakasih.";

/** penutup surat yang memohon persetujuan Direksi (mis. addendum docking) */
export const PENUTUP_PERIKSA =
  "Demikian kami sampaikan untuk menjadi periksa, atas persetujuan Direksi diucapkan terimakasih.";

/** penutup surat permohonan ke Regional (mis. penunjukan langsung vendor) */
export const PENUTUP_PERSETUJUAN =
  "Demikian kami sampaikan, atas persetujuannya diucapkan terima kasih.";

export const PENUTUP_KERJASAMA =
  "Demikian kami sampaikan, atas kerja samanya diucapkan terima kasih.";

export const LAMPIRAN =
  "Sebagai bahan pertimbangan, bersama ini kami lampirkan dokumen persyaratan sesuai dengan "
  + "ketentuan yang berlaku.";


