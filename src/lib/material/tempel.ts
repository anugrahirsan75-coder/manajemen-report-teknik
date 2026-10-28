// Tempel satu blok Excel ke tabel Input Item Pengajuan.
//
// Berkas pengajuan kode material di cabang tidak berbentuk tabel rata. Kapal
// dan mesinnya ditulis sebagai BARIS JUDUL di kolom nama barang, bukan sebagai
// kolom tersendiri:
//
//     KMP BOBARA
//        ME YANMAR 6KYM-ETE
//     1  SEAT SUCTION VALVE   126613-11080  12  PCS  900.000  SC
//
// Karena itu tempelan tidak bisa dibaca baris per baris secara lepas: kapal dan
// mesin harus diturunkan dari baris judul terakhir ke setiap item di bawahnya.
//
// Urutan kolomnya pun berbeda-beda antarberkas, jadi kolom TIDAK dibaca
// berdasarkan posisi. Kalau baris judul ikut diblok, peta kolom diambil dari
// judulnya; kalau tidak, ditebak dari isinya (satuan dikenali dari kata
// satuannya, harga dari besar angkanya, dan seterusnya). Hasil bacanya
// dilaporkan ke pemakai supaya tebakan yang salah terlihat, bukan diam-diam
// menulis angka ke kolom yang bukan tempatnya.
import { KAPAL_DB } from "./db";
import { MaterialItem, emptyItem } from "./types";

export type Bidang =
  | "kapal" | "partNumber" | "nama" | "kode" | "namaMesin"
  | "satuan" | "qty" | "harga" | "spesifikasi";

const rapi = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const kunci = (s: unknown) => rapi(s).toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const judulKunci = (s: unknown) => rapi(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Sel yang isinya setara kosong. Di berkas aslinya "-" dipakai sebagai tanda belum ada. */
const kosong = (s: unknown) => {
  const t = rapi(s);
  return !t || t === "-" || t === "--" || t === "—" || /^(n\/a|na|nihil)$/i.test(t);
};

/**
 * Angka dari ketikan Excel: "900000", "900.000", "Rp 2.750.000,00", "2,5".
 * Pemisah desimalnya ditentukan dari tanda yang paling kanan, bukan dari
 * kebiasaan satu negara — sel Excel bisa datang dengan format mana pun.
 */
export function keAngka(v: unknown): number {
  let t = rapi(v).replace(/[^\d,.-]/g, "");
  if (!t) return 0;
  const titik = t.lastIndexOf("."), koma = t.lastIndexOf(",");
  if (titik >= 0 && koma >= 0) {
    if (koma > titik) t = t.replace(/\./g, "").replace(",", ".");
    else t = t.replace(/,/g, "");
  } else if (koma >= 0) {
    t = /,\d{3}(,|$)/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  } else if (titik >= 0) {
    t = /\.\d{3}(\.|$)/.test(t) ? t.replace(/\./g, "") : t;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

// --------------------------- peta kolom dari baris judul -------------------

interface Kolom { label: string; bidang: Bidang | null }

/**
 * Judul kolom yang pernah dipakai, diurutkan dari yang paling khusus.
 *
 * Urutannya menentukan hasil, dan dua pasang mudah tertukar:
 *   · "Harga Satuan (Rp)" mengandung kata "satuan" — maka harga diuji lebih
 *     dulu, dan pola satuan dipatok persis;
 *   · "Kode Material" adalah nomor material SAP sepuluh angka, BUKAN kolom
 *     Kode di layar ini (B0xxxx). Memetakannya akan membuat kategori SC/UMUM
 *     salah seluruhnya, jadi kolom itu sengaja dilewati.
 */
const PETA_JUDUL: { re: RegExp; bidang: Bidang | null; label: string }[] = [
  { re: /^(no|nomor|urut|urutan)$/, bidang: null, label: "No" },
  { re: /kapal|vessel/, bidang: "kapal", label: "Kapal" },
  { re: /mesin|engine|merk|tipe|type/, bidang: "namaMesin", label: "Nama Mesin" },
  { re: /part (number|no)|no part|partno|part$/, bidang: "partNumber", label: "Part Number" },
  { re: /harga|price|nilai/, bidang: "harga", label: "Harga Satuan" },
  { re: /^(satuan|sat|unit|uom)$/, bidang: "satuan", label: "Satuan" },
  { re: /kuantiti|kuantitas|^qty$|^volume$|^jml$/, bidang: "qty", label: "Kuantiti" },
  { re: /^jumlah$/, bidang: "qty", label: "Jumlah" },
  { re: /kategori/, bidang: null, label: "Kategori" },
  { re: /kode material|material code|no material/, bidang: null, label: "Kode Material (SAP)" },
  { re: /^kode|^kd /, bidang: "kode", label: "Kode" },
  { re: /description|deskripsi|keterangan/, bidang: null, label: "Deskripsi" },
  { re: /purchase order|po text/, bidang: null, label: "PO Text" },
  { re: /spesifikasi|^spek|^spec/, bidang: "spesifikasi", label: "Spesifikasi" },
  { re: /status|sumber/, bidang: null, label: "Status/Sumber" },
  { re: /nama|barang|uraian|material|item/, bidang: "nama", label: "Nama Barang" },
];

function cocokJudul(sel: string): Kolom | null {
  const t = judulKunci(sel);
  if (!t) return null;
  for (const p of PETA_JUDUL) if (p.re.test(t)) return { label: p.label, bidang: p.bidang };
  return null;
}

/** Baris judul: dua sel atau lebih dikenali sebagai nama kolom, dan tak ada sel berupa angka. */
function petaDariJudul(cells: string[]): Kolom[] | null {
  const hasil = cells.map(cocokJudul);
  const kenal = hasil.filter(Boolean).length;
  const adaAngka = cells.some((c) => !kosong(c) && /^[\d.,]+$/.test(rapi(c)));
  if (kenal < 2 || adaAngka) return null;
  return hasil.map((h) => h || { label: "", bidang: null });
}

// --------------------------- peta kolom dari isi --------------------------

const SATUAN = new Set([
  "PC", "PCS", "PIECE", "SET", "UNIT", "BH", "BUAH", "LTR", "LITER", "L", "KG", "GR",
  "M", "METER", "MTR", "M1", "M2", "M3", "ROLL", "RL", "BOX", "DUS", "PAK", "PACK",
  "PAIL", "DRUM", "JRG", "JERIGEN", "LBR", "LEMBAR", "BTL", "BOTOL", "KLG", "KALENG",
  "SAK", "ZAK", "TABUNG", "BATANG", "BTG", "EA", "RIM", "PASANG", "PSG", "TITIK", "LS",
]);

const berkapal = (t: string) =>
  /^(kmp|km|kmc|mv|ms)\b/i.test(rapi(t)) || KAPAL_DB.some((k) => kunci(k.nama) === kunci(t));

/**
 * Tebak peran tiap kolom dari isinya, dipakai bila baris judul tidak ikut diblok.
 *
 * Diputuskan dari yang paling khas ke yang paling umum. Kolom nomor urut diuji
 * SEBELUM kuantiti: keduanya berisi angka kecil, dan tanpa urutan itu nomor
 * urut akan terbaca sebagai kuantiti.
 */
function petaDariIsi(grid: string[][]): Kolom[] {
  const lebar = Math.max(1, ...grid.map((r) => r.length));
  const kol: (Kolom | null)[] = Array(lebar).fill(null);
  const isi: string[][] = [];
  for (let c = 0; c < lebar; c++) isi.push(grid.map((r) => r[c] ?? "").filter((v) => !kosong(v)));

  const bagian = (c: number, uji: (v: string) => boolean) =>
    isi[c].length ? isi[c].filter(uji).length / isi[c].length : 0;
  const angka = (c: number) => isi[c].filter((v) => /^[\d.,]+$/.test(rapi(v))).map(keAngka);

  for (let c = 0; c < lebar; c++) {
    if (!isi[c].length) continue;
    if (bagian(c, (v) => SATUAN.has(kunci(v).replace(/ /g, ""))) >= 0.5) {
      kol[c] = { label: "Satuan", bidang: "satuan" };
    }
  }
  // nomor urut: bilangan bulat yang naik terus dan dimulai dari angka kecil
  for (let c = 0; c < lebar; c++) {
    if (kol[c] || !isi[c].length) continue;
    const a = angka(c);
    if (a.length !== isi[c].length || a.length < 2) continue;
    const bulat = a.every((n) => Number.isInteger(n));
    const naik = a.every((n, i) => i === 0 || n > a[i - 1]);
    if (bulat && naik && a[0] <= 3 && a[a.length - 1] <= 999) kol[c] = { label: "No", bidang: null };
  }
  for (let c = 0; c < lebar; c++) {
    if (kol[c] || !isi[c].length) continue;
    const a = angka(c);
    if (a.length / isi[c].length < 0.6) continue;
    // Nomor material SAP ("2000005419") juga berupa angka besar, dan kalau
    // terbaca sebagai harga ia akan masuk ke kolom rupiah. Angka bulat
    // sembilan digit ke atas diperlakukan sebagai nomor, bukan uang — harga
    // satuan barang kapal tidak pernah sampai ratusan juta per unit.
    if (a.every((n) => Number.isInteger(n) && Math.abs(n) >= 100_000_000)) {
      kol[c] = { label: "Nomor", bidang: null };
      continue;
    }
    const urut = [...a].sort((x, y) => x - y);
    const tengah = urut[Math.floor(urut.length / 2)] || 0;
    if (tengah >= 50_000) kol[c] = { label: "Harga Satuan", bidang: "harga" };
  }
  for (let c = 0; c < lebar; c++) {
    if (kol[c] || !isi[c].length) continue;
    const a = angka(c);
    if (a.length / isi[c].length >= 0.6 && Math.max(...a) < 1000) {
      kol[c] = { label: "Kuantiti", bidang: "qty" };
    }
  }
  for (let c = 0; c < lebar; c++) {
    if (kol[c] || !isi[c].length) continue;
    if (bagian(c, berkapal) >= 0.4) kol[c] = { label: "Kapal", bidang: "kapal" };
    else if (bagian(c, (v) => /^B0\d{4}$/i.test(rapi(v))) >= 0.4) kol[c] = { label: "Kode", bidang: "kode" };
  }
  // sisa kolom teks: yang tulisannya paling panjang adalah nama barang,
  // sisanya yang mengandung angka diperlakukan sebagai part number
  const sisa = kol.map((k, c) => (k || !isi[c].length ? -1 : c)).filter((c) => c >= 0);
  if (sisa.length) {
    const panjang = (c: number) => isi[c].reduce((s, v) => s + rapi(v).length, 0) / isi[c].length;
    const namaKol = sisa.reduce((a, b) => (panjang(b) > panjang(a) ? b : a));
    kol[namaKol] = { label: "Nama Barang", bidang: "nama" };
    for (const c of sisa) {
      if (kol[c]) continue;
      kol[c] = /\d/.test(isi[c].join(""))
        ? { label: "Part Number", bidang: "partNumber" }
        : { label: "", bidang: null };
    }
  }
  return kol.map((k) => k || { label: "", bidang: null });
}

// --------------------------- baris judul kapal & mesin --------------------

/**
 * Pecah baris judul mesin menjadi jenis (ME/AE) dan nama mesinnya.
 *
 * Bentuknya bermacam-macam di berkas yang sama:
 *   "ME YANMAR 6KYM-ETE"            -> ME, "YANMAR 6KYM-ETE"
 *   "AE PERKINS SABRE 6TG2AM"       -> AE, "PERKINS SABRE 6TG2AM"
 *   "SUKU CADANG ME"                -> ME, namanya belum disebut
 *   "MERK/TYPE : MITSUBISHI S6R2"   -> jenis ikut baris sebelumnya
 *
 * Jenisnya dipakai mengisi kolom Kode: mesin induk B02007, mesin bantu B02008.
 * Nama mesin saja tidak cukup — kolom Purchase Order Text dirangkai dari
 * "ME/AE : nama mesin", dan ME/AE-nya diambil dari kodenya.
 */
export function bacaJudulMesin(mentah: string): { nama: string; jenis: "ME" | "AE" | "" } {
  const t = rapi(mentah);
  const merk = /(?:merk|merek|type|tipe)\s*[/\\]?\s*(?:type|tipe)?\s*[:-]\s*(.+)$/i.exec(t);
  if (merk) return { nama: rapi(merk[1]), jenis: "" };

  const m = /\b(m\/?e|a\/?e|mesin\s+induk|mesin\s+bantu|main\s+engine|aux(?:iliary)?|genset)\b/i.exec(t);
  let jenis: "ME" | "AE" | "" = "";
  if (m) {
    const w = m[1].toLowerCase().replace(/[\s/]+/g, "");
    jenis = (w === "me" || w === "mesininduk" || w === "mainengine") ? "ME" : "AE";
  }
  const nama = t
    .replace(/^(suku\s+cadang|sc|spare\s*parts?)\b/i, "")
    .replace(/\b(m\/?e|a\/?e|mesin\s+induk|mesin\s+bantu|main\s+engine|aux(?:iliary)?)\b/i, "")
    .replace(/^[\s:.-]+|[\s:.-]+$/g, "");
  return { nama: rapi(nama), jenis };
}

const KODE_MESIN: Record<"ME" | "AE", string> = { ME: "B02007", AE: "B02008" };

/** Nama kapal dibakukan ke ejaan di daftar kapal ("KMP BOBARA" -> "KMP. BOBARA"). */
function bakukanKapal(t: string): string {
  const k = KAPAL_DB.find((x) => kunci(x.nama) === kunci(t));
  return k ? k.nama : rapi(t).toUpperCase();
}

// --------------------------- perakitan ------------------------------------

export interface LaporanTempel {
  items: MaterialItem[];
  kolom: Kolom[];
  sumberPeta: "judul" | "isi";
  kapal: string[];
  judulMesin: number;
  dilewati: number;
  catatan: string[];
}

export function pisahGrid(teks: string): string[][] {
  return teks.replace(/\r/g, "").replace(/\n+$/, "").split("\n").map((r) => r.split("\t"));
}

/**
 * Baca satu tempelan Excel menjadi daftar item.
 *
 * Mengembalikan null bila yang ditempel bukan blok sel, atau tak satu kolom pun
 * dikenali — satu kata yang ditempel ke satu kolom harus tetap berperilaku
 * seperti tempelan biasa.
 */
export function tempelExcel(teks: string): LaporanTempel | null {
  if (!teks || (!teks.includes("\t") && !teks.includes("\n"))) return null;
  const grid = pisahGrid(teks);
  if (!grid.length) return null;

  let kolom: Kolom[] | null = null;
  let sumberPeta: "judul" | "isi" = "isi";
  const data: string[][] = [];
  for (const baris of grid) {
    if (!kolom) {
      const p = petaDariJudul(baris);
      if (p) { kolom = p; sumberPeta = "judul"; continue; }
    }
    data.push(baris);
  }
  if (!kolom) kolom = petaDariIsi(data);
  /*
   * Satu kolom saja bukan blok yang perlu dibaca pintar — menempel sederet
   * nama ke kolom Part Number harus tetap jatuh ke kolom yang diklik, bukan
   * dipindahkan ke kolom Nama Barang karena isinya "kelihatan seperti nama".
   */
  if (kolom.filter((k) => k.bidang).length < 2) return null;

  const peta = kolom;
  const idx = (b: Bidang) => peta.findIndex((k) => k.bidang === b);
  const ambil = (r: string[], i: number) => (i >= 0 ? rapi(r[i]) : "");
  const catatan: string[] = [];

  /*
   * Satu bidang hanya boleh punya satu kolom, dan yang dipakai adalah kolom
   * PERTAMA. Dua hal berbeda sama-sama membuat bidang terpakai dua kali:
   * kolom "Jumlah" di sebelah "Kuantiti" sebenarnya total harga, dan dalam
   * mode tebakan dua kolom angka besar bisa sama-sama terbaca sebagai harga.
   * Tanpa penyaringan ini yang terbaca belum tentu yang pertama, dan total
   * harga bisa mendarat di kolom Qty.
   */
  const terpakai = new Set<Bidang>();
  peta.forEach((k, i) => {
    if (!k.bidang) return;
    if (terpakai.has(k.bidang)) {
      catatan.push(`Kolom "${k.label || "kolom " + (i + 1)}" dilewati (bidangnya sudah terisi kolom sebelumnya).`);
      peta[i] = { label: k.label, bidang: null };
      return;
    }
    terpakai.add(k.bidang);
  });

  const iNama = idx("nama"), iKapal = idx("kapal"), iMesin = idx("namaMesin");
  const items: MaterialItem[] = [];
  const kapalTerbaca: string[] = [];
  let kapalKini = "", mesinKini = "";
  let jenisKini: "ME" | "AE" | "" = "";
  let judulMesin = 0, dilewati = 0;

  for (const baris of data) {
    const terisi = baris.filter((c) => !kosong(c));
    if (!terisi.length) continue;

    /*
     * Baris judul kapal atau mesin.
     *
     * Sel kosong saja tidak cukup untuk mengenalinya. Baris item pun bisa
     * berisi nama tanpa part, satuan, atau harga — dan kalau baris semacam itu
     * ikut dibaca sebagai judul, itemnya hilang tanpa jejak. Karena itu
     * tulisannya harus benar-benar berbunyi seperti judul: nama kapal, awalan
     * ME/AE/SUKU CADANG/MERK, atau ditulis menjorok ke dalam. Indentasi itu
     * petunjuk aslinya — di berkas pengajuan, judul mesin diketik dengan tiga
     * spasi di depan, dan spasi itulah yang membedakannya dari nama barang.
     */
    const mentahSel = (iNama >= 0 ? baris[iNama] : undefined) ?? (terisi.length === 1 ? terisi[0] : "");
    const namaSel = rapi(mentahSel);
    const menjorok = /^\s{2,}\S/.test(String(mentahSel ?? ""));
    const tanpaAngka = [idx("partNumber"), idx("satuan"), idx("qty"), idx("harga")]
      .every((i) => i < 0 || kosong(baris[i] ?? ""));
    const berbunyiMesin = /^(m\/?e|a\/?e|suku\s+cadang|sc|spare\s*parts?|merk|merek|type|tipe)\b/i.test(namaSel);
    const selJudul = namaSel && !/^[\d.,]+$/.test(namaSel) && tanpaAngka &&
      (berkapal(namaSel) || berbunyiMesin || menjorok) ? namaSel : "";
    if (selJudul) {
      if (berkapal(selJudul)) {
        kapalKini = bakukanKapal(selJudul);
        mesinKini = ""; jenisKini = "";
        if (!kapalTerbaca.includes(kapalKini)) kapalTerbaca.push(kapalKini);
      } else {
        const m = bacaJudulMesin(selJudul);
        if (m.nama) mesinKini = m.nama;
        if (m.jenis) jenisKini = m.jenis;
        judulMesin++;
      }
      continue;
    }

    const nama = ambil(baris, iNama);
    const part = ambil(baris, idx("partNumber"));
    if (kosong(nama) && kosong(part)) { dilewati++; continue; }

    const kapalBaris = ambil(baris, iKapal);
    const it = emptyItem(kapalBaris ? bakukanKapal(kapalBaris) : (kapalKini || "SEMUA KAPAL"));
    if (!kosong(nama)) it.nama = nama;
    if (!kosong(part)) it.partNumber = part;

    const satuan = ambil(baris, idx("satuan"));
    if (!kosong(satuan)) it.satuan = satuan.toUpperCase();
    const iQty = idx("qty");
    if (iQty >= 0 && !kosong(baris[iQty] ?? "")) it.qty = keAngka(baris[iQty]) || 1;
    const iHarga = idx("harga");
    if (iHarga >= 0) it.harga = keAngka(baris[iHarga]);
    const spek = ambil(baris, idx("spesifikasi"));
    if (!kosong(spek)) it.spesifikasi = spek;

    const mesinBaris = ambil(baris, iMesin);
    it.namaMesin = !kosong(mesinBaris) ? mesinBaris : mesinKini;

    const kodeBaris = ambil(baris, idx("kode"));
    if (/^B0\d{4}$/i.test(kodeBaris)) it.kode = kodeBaris.toUpperCase();
    else if (jenisKini) it.kode = KODE_MESIN[jenisKini];

    items.push(it);
  }

  if (!items.length) return null;

  if (peta.some((k) => k.label === "Kode Material (SAP)")) {
    catatan.push("Kolom Kode Material (SAP) dilewati — kolom Kode di layar ini memakai kode anggaran B0xxxx.");
  }
  if (items.some((i) => i.kode === "B02007" || i.kode === "B02008")) {
    catatan.push("Kode diisi dari judul mesin: ME → B02007 (SC Mesin Induk), AE → B02008 (SC Mesin Bantu).");
  }
  if (sumberPeta === "isi") {
    const dipakai = peta.filter((k) => k.bidang).map((k) => k.label).join(" · ");
    catatan.push(`Baris judul tidak ikut diblok, kolom ditebak dari isinya: ${dipakai || "—"}.`);
  }

  return { items, kolom: peta, sumberPeta, kapal: kapalTerbaca, judulMesin, dilewati, catatan };
}
