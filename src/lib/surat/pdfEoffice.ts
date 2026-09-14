/**
 * Cetak badan surat menjadi PDF berkop, meniru keluaran e-office.
 *
 * ANGKA TATA LETAKNYA DIUKUR DARI SURAT E-OFFICE YANG SUDAH TERBIT, bukan
 * ditaksir: posisi logo, tagline, garis kaki, dan tiap baris teks diambil dari
 * matriks penempatan di dalam berkas PDF-nya sendiri (Laporan Pemberangkatan
 * Kmp. Tuna, TN.101/[...]/IX/ASDP-TTE/2026). Menaksir dari gambar hasil render
 * meleset beberapa titik, dan logo yang bergeser dua milimeter langsung terlihat
 * bila surat ini disandingkan dengan surat asli.
 *
 * Hurufnya pun sama: e-office memakai DejaVu Sans Condensed (bawaan mPDF).
 * Helvetica bawaan jsPDF lebih lebar, sehingga baris yang di e-office cukup satu
 * baris bisa pecah jadi dua dan seluruh halaman bergeser. Tiga potongan huruf
 * itu disimpan di public/eoffice/font — sudah dipangkas ke Latin saja, 70 KB
 * bertiga — dan baru diunduh ketika tombol PDF ditekan.
 *
 * QR TANDA TANGAN TIDAK DISALIN. QR pada surat e-office yang sudah terbit adalah
 * catatan pengesahan milik satu surat — lihat naskahQrKonsep() di bawah. Yang
 * dibubuhkan di sini QR KONSEP: identitas berkas, tanpa baris persetujuan, dengan
 * keterangan "belum disahkan" di bawahnya. Pengesahan sungguhan terbit dari
 * e-office saat pejabatnya benar-benar menyetujui.
 */
import type { jsPDF as JsPdfTipe } from "jspdf";

/* ── ukuran & posisi, satuan titik (pt), sumbu Y dari BAWAH halaman ──────── */
const HAL = { lebar: 595.276, tinggi: 841.89 };

const LOGO = { x: 71.62, bawah: 762.79, lebar: 75, tinggi: 50 };
const TAGLINE = { x: 54.37, bawah: 8.84, lebar: 177.75, tinggi: 37.5 };
const GARIS = { x: 70.87, bawah: 1.71, lebar: 145.09, tinggi: 7.12 };

/** baris alamat di kaki surat: [teks, y, ukuran, warna, tebal, miring] */
const KAKI: [string, number, number, string, boolean, boolean][] = [
  ["PT ASDP Indonesia Ferry (Persero)", 96.0, 6, "#14357F", true, false],
  ["Ternate", 80.1, 6, "#222222", true, false],
  ["JL.KOM. PELABUHAN FERRY BASTIONG TERNATE SELATAN –", 72.1, 6, "#666666", false, true],
  ["MALUKU UTARA 9771", 64.2, 6, "#666666", false, true],
  ["tel :", 56.2, 6, "#666666", false, false],
  ["www.asdp.id", 48.2, 6, "#14357F", true, false],
];

const KEPALA = {
  y: 707.7, labelX: 71.62, titikX: 163.8, nilaiX: 169.5, lebarNilai: 165,
  kananX: 351.3, ythX: 338.2, ukuran: 7.5, spasi: 9, spasiBlok: 12,
};

const BADAN = {
  yMulai: 613.7, nomorX: 89, teksX: 101.6, subHurufX: 134, subTeksX: 146.6,
  kananX: 573.67, ukuran: 8.2, spasi: 14.85, ukuranTabel: 7,
};

/**
 * Blok tanda tangan.
 *
 * Dua angka ruang, dan keduanya diukur dari surat sungguhan:
 *
 * · TANPA QR — 59,4 titik, jarak jabatan ke nama pada surat konsep yang belum
 *   ditandatangani (Laporan Pemberangkatan Kmp. Tuna dan Kmp. Lema).
 * · DENGAN QR — QR-nya 75,01 titik persegi, duduk 2,17 titik di bawah garis
 *   dasar jabatan, dan namanya 15,82 titik di bawah QR; seluruhnya 93 titik.
 *   Diukur dari surat yang sudah disahkan (Surat Edaran SE.00023).
 *
 * Ruang 59,4 titik tidak cukup untuk QR seukuran itu — surat yang sudah
 * bertanda tangan memang memuainya. Jadi ruangnya ikut berubah, bukan QR-nya
 * yang dikecilkan: QR yang diperas jadi 42 titik masih terbaca mesin, tetapi
 * kelihatan jelas lebih kecil daripada surat aslinya.
 */
const TTD = {
  tengahX: 421.5,
  jarakJabatan: 36.6,
  tinggiRuang: 59.4,
  sisiQr: 75.01,
  jarakAtasQr: 2.17,
  jarakQrKeNama: 15.82,
  jarakTembusan: 35.7,
};

/** jarak garis dasar jabatan ke garis dasar nama */
const ruangTandaTangan = (adaQr: boolean) =>
  adaQr ? TTD.jarakAtasQr + TTD.sisiQr + TTD.jarakQrKeNama : TTD.tinggiRuang;
const TEMBUSAN = { x: 71.62, ukuran: 8.2, spasi: 11.55 };

/** batas bawah isi: di bawah ini sudah wilayah kaki surat */
const BATAS_BAWAH = 130;
/** halaman lanjutan mulai dari sini — mengikuti halaman 2 surat e-office */
const Y_HALAMAN_LANJUT = 804;

/*
 * Tiga wajah huruf didaftarkan dengan NAMA BERBEDA, bukan satu nama dengan tiga
 * gaya. jsPDF memakai nama itu apa adanya sebagai BaseFont di dalam PDF, jadi
 * satu nama untuk tiga potongan huruf yang berlainan membuat pembaca PDF
 * menyerah memilih dan jatuh ke huruf gantinya — seluruh surat berubah jadi
 * huruf berkait, meski potongan hurufnya sendiri sudah tertanam dengan benar.
 * Gejalanya menyesatkan: berkasnya terbit, ukurannya wajar, hanya hurufnya yang
 * salah.
 */
const HURUF = "DjvCond";
const HURUF_TEBAL = "DjvCondB";
const HURUF_MIRING = "DjvCondI";

const namaHuruf = (tebal: boolean, miring: boolean) =>
  tebal ? HURUF_TEBAL : miring ? HURUF_MIRING : HURUF;

/* ── pemuatan aset, dilakukan sekali per sesi ────────────────────────────── */
interface Aset { fontBiasa: string; fontTebal: string; fontMiring: string;
  logo: string; tagline: string; garis: string }
let asetTersimpan: Promise<Aset> | null = null;

const keBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let biner = "";
  // dipotong-potong: String.fromCharCode dengan puluhan ribu argumen sekaligus
  // melampaui batas tumpukan pemanggilan di beberapa peramban
  for (let i = 0; i < bytes.length; i += 8192) {
    biner += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)) as unknown as number[]);
  }
  return btoa(biner);
};

/**
 * Penanda versi aset. Dinaikkan bila berkas huruf atau gambar kop diganti:
 * peramban menyimpan keduanya, dan tanpa penanda ini huruf lama tetap dipakai
 * berhari-hari meski berkas di server sudah baru — pernah terjadi, dan gejalanya
 * membingungkan karena PDF-nya tetap terbit, hanya hurufnya yang salah.
 */
const VERSI_ASET = "2";

async function ambilBase64(alamat: string): Promise<string> {
  const r = await fetch(`${alamat}?v=${VERSI_ASET}`, { cache: "no-cache" });
  if (!r.ok) throw new Error(`Aset ${alamat} tidak ditemukan (${r.status}).`);
  const buf = await r.arrayBuffer();
  // berkas huruf yang tergantikan halaman masuk akan terbaca sebagai HTML
  if (buf.byteLength < 2048) throw new Error(`Aset ${alamat} terbaca tidak utuh (${buf.byteLength} bita).`);
  return keBase64(buf);
}

function muatAset(): Promise<Aset> {
  if (!asetTersimpan) {
    asetTersimpan = (async () => {
      const [fontBiasa, fontTebal, fontMiring, logo, tagline, garis] = await Promise.all([
        ambilBase64("/eoffice/font/DejaVuSansCondensed.ttf"),
        ambilBase64("/eoffice/font/DejaVuSansCondensed-Bold.ttf"),
        ambilBase64("/eoffice/font/DejaVuSansCondensed-Oblique.ttf"),
        ambilBase64("/eoffice/logo-asdp.jpg"),
        ambilBase64("/eoffice/tagline.jpg"),
        ambilBase64("/eoffice/garis.jpg"),
      ]);
      return { fontBiasa, fontTebal, fontMiring, logo, tagline, garis };
    })().catch((e) => { asetTersimpan = null; throw e; });
  }
  return asetTersimpan;
}

/* ── potongan teks bergaya ───────────────────────────────────────────────── */
interface Potong { teks: string; tebal: boolean; miring: boolean }
interface Penggal { teks: string; tebal: boolean; miring: boolean; lebar: number }
/** satu kata; boleh berisi beberapa penggal bila gayanya berubah di tengah kata */
interface Kata { penggal: Penggal[]; lebar: number }
interface Baris { kata: Kata[]; lebarKata: number; jumlahSela: number; terakhir: boolean }

/** kumpulkan teks satu elemen menjadi potongan bergaya, blok anak diabaikan */
function potongan(node: Node, tebal = false, miring = false): Potong[] {
  if (node.nodeType === 3) {
    const t = (node.nodeValue || "").replace(/\s+/g, " ");
    return t ? [{ teks: t, tebal, miring }] : [];
  }
  if (node.nodeType !== 1) return [];
  const el = node as HTMLElement;
  const nama = el.tagName.toLowerCase();
  if (nama === "ol" || nama === "ul" || nama === "table") return [];
  const t2 = tebal || nama === "b" || nama === "strong"
    || /font-weight\s*:\s*(bold|[6-9]00)/i.test(el.getAttribute("style") || "");
  const m2 = miring || nama === "i" || nama === "em";
  const hasil: Potong[] = [];
  el.childNodes.forEach((anak) => hasil.push(...potongan(anak, t2, m2)));
  return hasil;
}

const rapikan = (p: Potong[]): Potong[] => {
  const gabung: Potong[] = [];
  p.forEach((x) => {
    const akhir = gabung[gabung.length - 1];
    if (akhir && akhir.tebal === x.tebal && akhir.miring === x.miring) akhir.teks += x.teks;
    else gabung.push({ ...x });
  });
  if (gabung.length) {
    gabung[0].teks = gabung[0].teks.replace(/^\s+/, "");
    gabung[gabung.length - 1].teks = gabung[gabung.length - 1].teks.replace(/\s+$/, "");
  }
  return gabung.filter((x) => x.teks);
};

/**
 * Kata dikumpulkan MELINTASI batas gaya, bukan per potongan.
 *
 * Kalimat "…selama <b>15 (lima belas) hari</b>." berhenti tebal tepat sebelum
 * titiknya. Bila tiap potongan dipecah sendiri-sendiri, titik itu menjadi kata
 * tersendiri dan tercetak sebagai "hari ." — satu spasi yang tidak pernah
 * diketik siapa pun. Jadi satu kata boleh terdiri dari beberapa penggal dengan
 * gaya berbeda, dan spasi hanya lahir dari spasi yang memang ada di teksnya.
 */
function ukurKata(doc: JsPdfTipe, potong: Potong[], ukuran: number): { kata: Kata[]; sela: number } {
  doc.setFontSize(ukuran);
  const kata: Kata[] = [];
  let penggal: Penggal[] = [];

  const tutup = () => {
    if (!penggal.length) return;
    kata.push({ penggal, lebar: penggal.reduce((s, x) => s + x.lebar, 0) });
    penggal = [];
  };

  potong.forEach((p) => {
    doc.setFont(namaHuruf(p.tebal, p.miring), "normal");
    p.teks.split(" ").forEach((bagian, i) => {
      if (i > 0) tutup();                       // spasi asli memisahkan kata
      if (!bagian) return;
      penggal.push({ teks: bagian, tebal: p.tebal, miring: p.miring, lebar: doc.getTextWidth(bagian) });
    });
  });
  tutup();

  doc.setFont(HURUF, "normal");
  return { kata, sela: doc.getTextWidth(" ") };
}

/** pemenggal baris sendiri: jsPDF tidak bisa merata-kanankan teks bercampur tebal */
function susunBaris(doc: JsPdfTipe, potong: Potong[], lebar: number, ukuran: number): Baris[] {
  const { kata, sela } = ukurKata(doc, potong, ukuran);
  const baris: Baris[] = [];
  let kini: Kata[] = [];
  let lebarKini = 0;
  kata.forEach((k) => {
    const tambah = kini.length ? sela + k.lebar : k.lebar;
    if (kini.length && lebarKini + tambah > lebar) {
      baris.push({ kata: kini, lebarKata: lebarKini - (kini.length - 1) * sela, jumlahSela: kini.length - 1, terakhir: false });
      kini = [k]; lebarKini = k.lebar;
    } else { kini.push(k); lebarKini += tambah; }
  });
  if (kini.length) baris.push({ kata: kini, lebarKata: lebarKini - (kini.length - 1) * sela, jumlahSela: kini.length - 1, terakhir: true });
  if (baris.length) baris[baris.length - 1].terakhir = true;
  return baris.map((b, i) => ({ ...b, terakhir: i === baris.length - 1 }));
}

/* ── mesin penggambar ────────────────────────────────────────────────────── */
class Kanvas {
  y = BADAN.yMulai;
  /**
   * Garis dasar baris terakhir yang benar-benar tercetak.
   *
   * Jarak ke blok tanda tangan pada surat asli diukur dari baris terakhir
   * badan surat (405,8 ke 369,2 — 36,6 titik). Memakai `y` biasa membuat
   * jaraknya ikut menghitung baris kosong antar butir, dan tanda tangan
   * turun dua baris dari tempat seharusnya.
   */
  baselineAkhir = BADAN.yMulai;
  constructor(public doc: JsPdfTipe, public aset: Aset) {}

  atas = (y: number) => HAL.tinggi - y;

  perabot() {
    const d = this.doc;
    d.addImage(this.aset.logo, "JPEG", LOGO.x, this.atas(LOGO.bawah + LOGO.tinggi), LOGO.lebar, LOGO.tinggi);
    d.addImage(this.aset.tagline, "JPEG", TAGLINE.x, this.atas(TAGLINE.bawah + TAGLINE.tinggi), TAGLINE.lebar, TAGLINE.tinggi);
    d.addImage(this.aset.garis, "JPEG", GARIS.x, this.atas(GARIS.bawah + GARIS.tinggi), GARIS.lebar, GARIS.tinggi);
    KAKI.forEach(([teks, y, ukuran, warna, tebal, miring]) => {
      d.setFont(namaHuruf(tebal, miring), "normal");
      d.setFontSize(ukuran);
      d.setTextColor(warna);
      d.text(teks, GARIS.x, this.atas(y));
    });
    d.setTextColor("#000000");
    d.setFont(HURUF, "normal");
  }

  halamanBaru() {
    this.doc.addPage();
    this.perabot();
    this.y = Y_HALAMAN_LANJUT;
  }

  /** pastikan masih muat; kalau tidak, pindah halaman */
  muat(tinggi: number) {
    if (this.y - tinggi < BATAS_BAWAH) this.halamanBaru();
  }

  /** satu baris teks bergaya; rata kanan-kiri kecuali baris terakhir */
  gambarBaris(baris: Baris, x: number, lebar: number, ukuran: number, ratakan: boolean) {
    const d = this.doc;
    d.setFontSize(ukuran);
    const selaDasar = (() => { d.setFont(HURUF, "normal"); return d.getTextWidth(" "); })();
    const sela = ratakan && !baris.terakhir && baris.jumlahSela > 0
      ? (lebar - baris.lebarKata) / baris.jumlahSela
      : selaDasar;
    let kx = x;
    baris.kata.forEach((k) => {
      k.penggal.forEach((g) => {
        d.setFont(namaHuruf(g.tebal, g.miring), "normal");
        d.text(g.teks, kx, this.atas(this.y));
        kx += g.lebar;
      });
      kx += sela;
    });
    d.setFont(HURUF, "normal");
  }

  /** paragraf mengalir: menurunkan y, memotong halaman bila perlu */
  paragraf(potong: Potong[], x: number, lebar: number, opsi: {
    ukuran?: number; spasi?: number; ratakan?: boolean; awalan?: { teks: string; x: number };
  } = {}) {
    const ukuran = opsi.ukuran ?? BADAN.ukuran;
    const spasi = opsi.spasi ?? BADAN.spasi;
    /*
     * RATA KIRI, bukan rata kanan-kiri.
     *
     * Surat e-office yang jadi acuan terlihat seperti rata kanan-kiri, tetapi
     * tepi kanan tiap barisnya diukur berbeda-beda — 519, 557, 520, lalu 567
     * titik pada satu surat yang sama. Kalau benar diratakan, semuanya akan
     * berhenti di titik yang persis sama. Jadi barisnya memang rata kiri, dan
     * celah lebar yang sesekali tampak berasal dari spasi ganda pada teks yang
     * diketik, bukan dari perataan.
     *
     * Memaksakan rata kanan-kiri di sini menghasilkan "sungai" putih di tengah
     * paragraf — persis yang membuat keluaran pertama terlihat berantakan.
     */
    const ratakan = opsi.ratakan ?? false;
    const baris = susunBaris(this.doc, rapikan(potong), lebar, ukuran);
    baris.forEach((b, i) => {
      this.muat(spasi);
      if (i === 0 && opsi.awalan) {
        this.doc.setFont(HURUF, "normal");
        this.doc.setFontSize(ukuran);
        this.doc.text(opsi.awalan.teks, opsi.awalan.x, this.atas(this.y));
      }
      this.gambarBaris(b, x, lebar, ukuran, ratakan);
      this.baselineAkhir = this.y;
      this.y -= spasi;
    });
    if (!baris.length) this.y -= spasi;
  }
}

/* ── tabel ───────────────────────────────────────────────────────────────── */
const angkaPersen = (v: string | null): number | null => {
  const m = /^(\d+(?:\.\d+)?)%$/.exec((v || "").trim());
  return m ? Number(m[1]) / 100 : null;
};

/** isi satu sel dipipihkan jadi baris teks; daftar di dalam sel jadi baris sendiri */
function isiSel(sel: HTMLElement): Potong[][] {
  const blok = Array.from(sel.children).filter((c) =>
    ["ul", "ol", "div", "p", "table"].includes(c.tagName.toLowerCase()));
  if (!blok.length) return [rapikan(potongan(sel))];
  const hasil: Potong[][] = [];
  const langsung = rapikan(potongan(sel));
  if (langsung.length) hasil.push(langsung);
  blok.forEach((bl) => {
    const nama = bl.tagName.toLowerCase();
    if (nama === "ul" || nama === "ol") {
      Array.from(bl.children).forEach((li, i) => {
        const awalan = nama === "ul" ? "• " : `${i + 1}. `;
        const p = rapikan(potongan(li));
        hasil.push([{ teks: awalan, tebal: false, miring: false }, ...p]);
      });
    } else hasil.push(rapikan(potongan(bl as HTMLElement)));
  });
  return hasil.filter((x) => x.length);
}

function gambarTabel(k: Kanvas, tabel: HTMLTableElement, x: number, lebarTotal: number) {
  const d = k.doc;
  const semuaBaris = Array.from(tabel.querySelectorAll("tr"));
  if (!semuaBaris.length) return;
  const bergaris = (tabel.getAttribute("border") || "1") !== "0";
  const ukuran = BADAN.ukuranTabel;
  const spasi = ukuran * 1.25;
  const isi = 3;

  // lebar kolom diambil dari atribut width baris pertama; sisanya dibagi rata
  const kepala = Array.from(semuaBaris[0].children) as HTMLElement[];
  const bagian = kepala.map((c) => angkaPersen(c.getAttribute("width")));
  const adaAngka = bagian.filter((b): b is number => b !== null);
  const sisa = Math.max(0, 1 - adaAngka.reduce((s, v) => s + v, 0));
  const kosong = bagian.filter((b) => b === null).length;
  const lebarKolom = bagian.map((b) => (b !== null ? b : kosong ? sisa / kosong : 1 / bagian.length) * lebarTotal);

  const gambarBarisTabel = (tr: HTMLTableRowElement) => {
    const sel = Array.from(tr.children) as HTMLElement[];
    // tinggi baris ditentukan sel paling panjang, jadi diukur dulu semuanya
    let kolom = 0;
    const siap = sel.map((s) => {
      const rentang = Number(s.getAttribute("colspan") || 1);
      const kiri = lebarKolom.slice(0, kolom).reduce((a, b) => a + b, 0);
      const lebar = lebarKolom.slice(kolom, kolom + rentang).reduce((a, b) => a + b, 0)
        || lebarTotal / sel.length;
      kolom += rentang;
      const potong = isiSel(s);
      const baris = potong.flatMap((p) => susunBaris(d, p, Math.max(8, lebar - isi * 2), ukuran));
      return { s, kiri, lebar, baris };
    });
    const tinggi = Math.max(spasi + isi * 2, Math.max(...siap.map((c) => c.baris.length)) * spasi + isi * 2);
    k.muat(tinggi);
    const atas = k.atas(k.y);

    siap.forEach((c) => {
      const warna = c.s.getAttribute("bgcolor");
      if (warna) { d.setFillColor(warna); d.rect(x + c.kiri, atas, c.lebar, tinggi, "F"); }
      if (bergaris) {
        d.setDrawColor("#000000"); d.setLineWidth(0.5);
        d.rect(x + c.kiri, atas, c.lebar, tinggi, "S");
      }
      const putih = /color\s*:\s*#FFFFFF/i.test(c.s.getAttribute("style") || "")
        || c.s.querySelector('font[color="#FFFFFF"]') !== null;
      d.setTextColor(putih ? "#FFFFFF" : "#000000");
      const rata = (c.s.getAttribute("align") || (c.s.tagName.toLowerCase() === "th" ? "center" : "left"));
      let yBaris = k.y - isi - ukuran * 0.85;
      c.baris.forEach((b) => {
        const lebarIsi = b.lebarKata + b.jumlahSela * (() => { d.setFont(HURUF, "normal"); d.setFontSize(ukuran); return d.getTextWidth(" "); })();
        const kiriTeks = rata === "center" ? x + c.kiri + (c.lebar - lebarIsi) / 2
          : rata === "right" ? x + c.kiri + c.lebar - isi - lebarIsi
          : x + c.kiri + isi;
        const simpan = k.y; k.y = yBaris;
        k.gambarBaris(b, kiriTeks, c.lebar - isi * 2, ukuran, false);
        k.y = simpan;
        yBaris -= spasi;
      });
      d.setTextColor("#000000");
    });
    k.y -= tinggi;
    k.baselineAkhir = k.y;
  };

  semuaBaris.forEach((tr) => gambarBarisTabel(tr as HTMLTableRowElement));
  k.y -= BADAN.spasi * 0.4;
}

/* ── badan surat ─────────────────────────────────────────────────────────── */
function gambarBadan(k: Kanvas, html: string) {
  const dok = new DOMParser().parseFromString(`<div id="akar">${html}</div>`, "text/html");
  const akar = dok.getElementById("akar")!;
  // pembungkus tunggal dari bungkus(): masuk satu tingkat
  const isi = akar.children.length === 1 && akar.children[0].tagName.toLowerCase() === "div"
    ? (akar.children[0] as HTMLElement) : akar;

  const lebarButir = BADAN.kananX - BADAN.teksX;
  const lebarSub = BADAN.kananX - BADAN.subTeksX;

  Array.from(isi.children).forEach((anak) => {
    const el = anak as HTMLElement;
    const nama = el.tagName.toLowerCase();

    if (nama === "ol") {
      const mulai = Number(el.getAttribute("start") || 1);
      Array.from(el.children).forEach((liEl, i) => {
        const li = liEl as HTMLElement;
        k.paragraf(potongan(li), BADAN.teksX, lebarButir, {
          awalan: { teks: `${mulai + i}.`, x: BADAN.nomorX },
        });
        const sub = li.querySelector(":scope > ol");
        if (sub) {
          Array.from(sub.children).forEach((subLi, j) => {
            k.paragraf(potongan(subLi as HTMLElement), BADAN.subTeksX, lebarSub, {
              awalan: { teks: `${String.fromCharCode(97 + j)}.`, x: BADAN.subHurufX },
            });
          });
        }
        k.y -= BADAN.spasi;   // satu baris kosong antar butir
      });
      return;
    }

    if (nama === "ul") {
      Array.from(el.children).forEach((li) => {
        k.paragraf(potongan(li as HTMLElement), BADAN.subTeksX, lebarSub, {
          awalan: { teks: "•", x: BADAN.subHurufX },
        });
      });
      k.y -= BADAN.spasi * 0.5;
      return;
    }

    if (nama === "table") { gambarTabel(k, el as HTMLTableElement, BADAN.teksX, lebarButir); return; }

    if (nama === "div") {
      const tabel = el.querySelector("table");
      if (tabel) { gambarTabel(k, tabel as HTMLTableElement, BADAN.teksX, lebarButir); return; }
    }

    const potong = rapikan(potongan(el));
    if (potong.length) { k.paragraf(potong, BADAN.teksX, lebarButir); k.y -= BADAN.spasi * 0.3; }
  });
}

/* ── kepala surat ────────────────────────────────────────────────────────── */
export interface KopSurat {
  nomor: string;
  tanggal: string;           // sudah dalam bentuk "13 September 2026"
  perihal: string;
  tujuanJabatan: string;
  tujuanKota: string;
  penandaJabatan: string;
  penandaNama: string;
  tembusan: string[];
  /** gambar QR konsep di ruang tanda tangan (lihat buatQrKonsep) */
  qrKonsep: boolean;
}

/**
 * QR untuk surat KONSEP — penanda berkas, bukan tanda tangan.
 *
 * QR pada surat e-office yang sudah terbit berisi catatan pengesahan:
 *
 *     ID: TTD10198153430681902052026080123
 *     ApprovedBy: GENERAL MANAGER TERNATE (MUSHAR USMAN)
 *     Nomor Surat: SE.00023/PA.111/ASDP-TTE/2026
 *     Tanggal Surat: 2026/05/02 07:48:50
 *
 * Nomor TTD, nama penyetuju, nomor surat, dan detik persetujuannya menunjuk
 * pada SATU surat. Menyalinnya ke surat lain — atau menerbitkan yang baru atas
 * nama orang yang sama — membuat surat itu menyatakan persetujuan yang tidak
 * pernah diberikan. Pengesahan sungguhan hanya boleh lahir dari e-office pada
 * saat pejabatnya benar-benar menyetujui.
 *
 * Yang dibuat di sini karena itu tidak memuat baris ApprovedBy sama sekali.
 * Isinya identitas berkas konsep: nomor surat yang dituju, perihal, tanggal
 * penyusunan, dan kepada siapa surat ini akan dimintakan tanda tangan —
 * berguna untuk menelusuri konsep yang beredar, dan tidak mengaku apa pun.
 */
/*
 * Isinya sependek mungkin, dan itu bukan soal gaya.
 *
 * Ruang yang tersedia antara jabatan dan nama hanya 59,4 titik, jadi QR-nya
 * paling besar 42 titik — sekitar 1,5 cm. Muatan panjang memaksa QR memakai
 * banyak modul, dan pada ukuran itu tiap modul menyusut di bawah 0,3 mm:
 * kameranya tidak bisa lagi membacanya. Percobaan pertama memuat perihal
 * lengkap dan hasilnya memang gagal dipindai.
 *
 * Empat baris ini muat pada QR 37 modul — sekitar 0,4 mm per modul pada
 * 42 titik, cukup untuk dipindai dari cetakan.
 */
function naskahQrKonsep(kop: KopSurat): string {
  return [
    "KONSEP BELUM DISAHKAN",
    kop.nomor,
    kop.tanggal,
    `Untuk TTD: ${kop.penandaNama.toUpperCase()}`,
  ].join("\n");
}

async function buatQrKonsep(kop: KopSurat): Promise<string> {
  const QR = await import("qrcode");
  return QR.toDataURL(naskahQrKonsep(kop), {
    errorCorrectionLevel: "L",
    margin: 0,
    width: 512,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

function gambarKepala(k: Kanvas, kop: KopSurat) {
  const d = k.doc;
  d.setFontSize(KEPALA.ukuran);
  d.setFont(HURUF, "normal");

  const tulis = (teks: string, x: number, y: number, tebal = false) => {
    d.setFont(tebal ? HURUF_TEBAL : HURUF, "normal");
    d.text(teks, x, k.atas(y));
    d.setFont(HURUF, "normal");
  };

  // ── kolom kiri: Nomor & Perihal ──
  let yKiri = KEPALA.y;
  tulis("Nomor", KEPALA.labelX, yKiri);
  tulis(":", KEPALA.titikX, yKiri);
  tulis(kop.nomor, KEPALA.nilaiX, yKiri);

  yKiri -= KEPALA.spasiBlok;
  tulis("Perihal", KEPALA.labelX, yKiri);
  tulis(":", KEPALA.titikX, yKiri);
  const barisPerihal = susunBaris(d, [{ teks: kop.perihal, tebal: false, miring: false }],
    KEPALA.lebarNilai, KEPALA.ukuran);
  barisPerihal.forEach((b, i) => {
    const simpan = k.y; k.y = yKiri - i * KEPALA.spasi;
    k.gambarBaris(b, KEPALA.nilaiX, KEPALA.lebarNilai, KEPALA.ukuran, false);
    k.y = simpan;
  });
  yKiri -= (barisPerihal.length - 1) * KEPALA.spasi;

  // ── kolom kanan: tanggal & tujuan ──
  let yKanan = KEPALA.y;
  tulis(kop.tanggal, KEPALA.kananX, yKanan);
  yKanan -= KEPALA.spasiBlok;
  tulis("Kepada", KEPALA.kananX, yKanan);
  yKanan -= KEPALA.spasi;
  tulis("Yth.", KEPALA.ythX, yKanan);
  // jabatan tujuan selalu huruf besar, mengikuti surat cabang yang sudah terbit
  const barisTujuan = susunBaris(d, [{ teks: kop.tujuanJabatan.toUpperCase(), tebal: false, miring: false }],
    HAL.lebar - 45 - KEPALA.kananX, KEPALA.ukuran);
  barisTujuan.forEach((b, i) => {
    const simpan = k.y; k.y = yKanan - i * KEPALA.spasi;
    k.gambarBaris(b, KEPALA.kananX, HAL.lebar - 45 - KEPALA.kananX, KEPALA.ukuran, false);
    k.y = simpan;
  });
  yKanan -= (barisTujuan.length - 1) * KEPALA.spasi;
  yKanan -= 33;
  tulis("Di--", KEPALA.kananX, yKanan);
  yKanan -= KEPALA.spasiBlok;
  tulis(kop.tujuanKota.toUpperCase(), KEPALA.kananX, yKanan);

  k.y = Math.min(yKiri, yKanan) - 28;
}

/* ── tanda tangan & tembusan ─────────────────────────────────────────────── */
function gambarTandaTangan(k: Kanvas, kop: KopSurat, qrKonsep: string) {
  const d = k.doc;
  const ruang = ruangTandaTangan(!!qrKonsep);
  k.muat(TTD.jarakJabatan + ruang + 12 + kop.tembusan.length * TEMBUSAN.spasi + 24);

  k.y = Math.min(k.y, k.baselineAkhir - TTD.jarakJabatan);
  d.setFont(HURUF, "normal");
  d.setFontSize(BADAN.ukuran);
  const jabatan = kop.penandaJabatan.toUpperCase();
  d.text(jabatan, TTD.tengahX - d.getTextWidth(jabatan) / 2, k.atas(k.y));

  const yJabatan = k.y;
  k.y -= ruang;

  if (qrKonsep) {
    /*
     * Ukuran dan letaknya disalin dari surat e-office yang sudah disahkan,
     * bukan dikira-kira: 75,01 titik persegi, sisi atasnya 2,17 titik di bawah
     * garis dasar jabatan, dan titik tengahnya sejajar jabatan serta nama.
     *
     * Tanpa keterangan apa pun di bawahnya — mengikuti bentuk surat aslinya.
     * Penandanya ada di dalam sandi QR: baris pertamanya berbunyi KONSEP BELUM
     * DISAHKAN, dan tidak ada satu pun baris persetujuan di dalamnya.
     */
    d.addImage(qrKonsep, "PNG", TTD.tengahX - TTD.sisiQr / 2,
      k.atas(yJabatan - TTD.jarakAtasQr), TTD.sisiQr, TTD.sisiQr);
  }

  d.setFont(HURUF_TEBAL, "normal");
  d.setFontSize(BADAN.ukuran);
  d.text(kop.penandaNama.toUpperCase(),
    TTD.tengahX - d.getTextWidth(kop.penandaNama.toUpperCase()) / 2, k.atas(k.y));
  d.setFont(HURUF, "normal");

  const daftar = kop.tembusan.filter((x) => x.trim());
  if (!daftar.length) return;
  k.y -= TTD.jarakTembusan;
  d.setFontSize(TEMBUSAN.ukuran);
  d.setFont(HURUF_TEBAL, "normal");
  const judul = "Tembusan Yth. :";
  d.text(judul, TEMBUSAN.x, k.atas(k.y));
  d.setLineWidth(0.5);
  d.line(TEMBUSAN.x, k.atas(k.y) + 1.4, TEMBUSAN.x + d.getTextWidth(judul), k.atas(k.y) + 1.4);
  d.setFont(HURUF, "normal");
  daftar.forEach((t, i) => {
    k.y -= TEMBUSAN.spasi;
    k.muat(TEMBUSAN.spasi);
    d.text(`${i + 1}. ${t.trim()}`, TEMBUSAN.x, k.atas(k.y));
  });
}

/* ── pintu keluar ────────────────────────────────────────────────────────── */
export async function buatPdfEoffice(htmlBadan: string, kop: KopSurat): Promise<Blob> {
  const [{ jsPDF }, aset] = await Promise.all([import("jspdf"), muatAset()]);
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  doc.addFileToVFS("DejaVuSansCondensed.ttf", aset.fontBiasa);
  doc.addFont("DejaVuSansCondensed.ttf", HURUF, "normal");
  doc.addFileToVFS("DejaVuSansCondensed-Bold.ttf", aset.fontTebal);
  doc.addFont("DejaVuSansCondensed-Bold.ttf", HURUF_TEBAL, "normal");
  doc.addFileToVFS("DejaVuSansCondensed-Oblique.ttf", aset.fontMiring);
  doc.addFont("DejaVuSansCondensed-Oblique.ttf", HURUF_MIRING, "normal");
  doc.setFont(HURUF, "normal");

  const qr = kop.qrKonsep ? await buatQrKonsep(kop) : "";

  const k = new Kanvas(doc as unknown as JsPdfTipe, aset);
  k.perabot();
  gambarKepala(k, kop);
  gambarBadan(k, htmlBadan);
  gambarTandaTangan(k, kop, qr);

  return doc.output("blob");
}

export async function unduhPdfEoffice(htmlBadan: string, kop: KopSurat, namaBerkas: string) {
  const blob = await buatPdfEoffice(htmlBadan, kop);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaBerkas.endsWith(".pdf") ? namaBerkas : `${namaBerkas}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
