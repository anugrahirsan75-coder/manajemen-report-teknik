/**
 * Baca satu lembar SPPB/J dari Excel menjadi data pengadaan.
 *
 * Dipakai dua jalur yang isinya sama: tombol di dalam berkas Excel (makro
 * mengirim isi sel lembar yang sedang terbuka) dan unggah berkas lewat halaman
 * web (lib/sppbj/bacaBerkasExcel.ts membongkar .xlsx-nya). Keduanya berhenti di
 * bentuk BarisLembar, jadi aturan bacanya cukup ditulis sekali di server - dan
 * kalau aturan berubah, makro di berkas yang sudah tersebar tidak perlu diganti.
 *
 * Kenapa bukan uraikan() milik tempelTabel: lembar SPPB/J memakai sel gabungan
 * dan baris judul berlapis, dan satu-satunya pembeda judul dari rincian adalah
 * huruf tebal. Papan klip tidak membawa keterangan itu, makro dan berkas .xlsx
 * membawanya.
 *
 * Yang DITEBAK (kategori rekap, MA per item) selalu dilaporkan sebagai catatan.
 * Tebakan kategori diuji ke 275 pengadaan tersimpan dan benar 85%, cukup untuk
 * jadi usulan, tidak cukup untuk masuk diam-diam.
 */
import { DEPT_HEAD, KAPAL_LIST, MATA_ANGGARAN, STAF_TEKNIK } from "./db";
import { SppbjItem, SppbjRequest } from "./types";
import { bacaAngka } from "./tempelTabel";

export interface BarisLembar {
  /** nomor baris di Excel, dipakai menunjuk baris bermasalah */
  n: number;
  /** huruf kolom -> isi sel; hanya sel yang terisi */
  s: Record<string, string | number>;
  /** huruf-huruf kolom yang tebal */
  b?: string;
}

export interface LembarExcel {
  nama: string;
  berkas?: string;
  baris: BarisLembar[];
}

export interface PerMa { ma: string; item: number; nilai: number }

export interface HasilLembar {
  lembar: string;
  req: Partial<SppbjRequest> & { items: SppbjItem[] };
  /** menghalangi pengiriman */
  masalah: string[];
  /** perlu dilihat, tidak menghalangi */
  catatan: string[];
  kategoriTebakan: boolean;
  ringkas: { item: number; kapal: string[]; perMa: PerMa[]; jumlah: number; ppn: number; total: number };
}

const noKol = (k: string) => k.split("").reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
const urutKolom = (s: BarisLembar["s"]) => Object.keys(s).sort((a, b) => noKol(a) - noKol(b));
const teks = (v: unknown) => (v === undefined || v === null ? "" : String(v)).replace(/\s+/g, " ").trim();
const buangTitikDua = (t: string) => t.replace(/^[\s:]+/, "").trim();
const angka = (v: unknown) => (typeof v === "number" ? v : bacaAngka(teks(v)));
const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

/* ── kepala lembar ──────────────────────────────────────────────────────── */

/**
 * Nilai di sebelah sebuah label.
 *
 * Tiga lembar dalam satu berkas pun menulisnya berbeda: label dan nilainya di
 * dua sel ("No. SPPB/J" lalu ": 2000075208"), atau sekaligus di satu sel
 * ("Tanggal   :   Agustus 2026"). Keduanya dibaca sama.
 */
function nilaiLabel(baris: BarisLembar[], rx: RegExp): string {
  for (const r of baris) {
    const kol = urutKolom(r.s);
    for (let i = 0; i < kol.length; i++) {
      const t = teks(r.s[kol[i]]);
      const m = rx.exec(t);
      if (!m) continue;
      const sisa = buangTitikDua(t.slice(m[0].length));
      if (sisa) return sisa;
      for (let j = i + 1; j < kol.length; j++) {
        const u = buangTitikDua(teks(r.s[kol[j]]));
        if (u) return u;
      }
      return "";
    }
  }
  return "";
}

const BULAN: Record<string, number> = {
  jan: 1, feb: 2, peb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  agu: 8, ags: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, nop: 11, des: 12, dec: 12,
};
const dua = (n: number) => String(n).padStart(2, "0");

/** "03 November 2026", "20 Febuari 2026", "03/11/2026", atau "Agustus 2026" */
export function bacaTanggal(t: string): { iso: string; lengkap: boolean } | null {
  const a = /(\d{1,2})[\s/.-]+([a-z]{3,})[\s/.-]+(\d{4})/i.exec(t);
  if (a && BULAN[a[2].slice(0, 3).toLowerCase()]) {
    return { iso: `${a[3]}-${dua(BULAN[a[2].slice(0, 3).toLowerCase()])}-${dua(+a[1])}`, lengkap: true };
  }
  const b = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(t);
  if (b) return { iso: `${b[3]}-${dua(+b[2])}-${dua(+b[1])}`, lengkap: true };
  const c = /([a-z]{3,})\s+(\d{4})/i.exec(t);
  if (c && BULAN[c[1].slice(0, 3).toLowerCase()]) {
    return { iso: `${c[2]}-${dua(BULAN[c[1].slice(0, 3).toLowerCase()])}-01`, lengkap: false };
  }
  return null;
}

/** "5010403009 dan 5010403100" menjadi label baku yang dipakai seluruh aplikasi */
function bacaMa(t: string): { ma: string[]; asing: string[] } {
  const ma: string[] = [];
  const asing: string[] = [];
  for (const kode of t.match(/\b\d{10}\b/g) || []) {
    const baku = MATA_ANGGARAN.find((m) => m.startsWith(kode));
    if (!baku && !asing.includes(kode)) asing.push(kode);
    // kode di luar daftar tetap dipakai: pos seperti 5011099006 (Fumigasi) sah di
    // lembar dan sudah ada di data lama, hanya belum tercantum di daftar pilihan
    if (!ma.includes(baku || kode)) ma.push(baku || kode);
  }
  return { ma, asing };
}

/* ── kapal ──────────────────────────────────────────────────────────────── */

const kunciKapal = (s: string) =>
  s.toUpperCase().replace(/^(BUS AIR\s+)?(KMP|KMT|KM)\b\.?\s*/, "").replace(/[^A-Z0-9]/g, "");

/** kapal yang tersebut di dalam sebuah teks, dalam ejaan baku */
function kapalDalam(t: string): string {
  const u = ` ${t.toUpperCase().replace(/[^A-Z0-9]+/g, " ")} `;
  const urut = [...KAPAL_LIST].sort((a, b) => b.length - a.length);
  for (const k of urut) {
    const nama = k.replace(/^KMP\.\s*/, "").toUpperCase();
    if (u.includes(` ${nama} `)) return k;
  }
  return "";
}

const RX_KAPAL = /^(BUS AIR\s+)?(KMP|KMT|KM)\b\.?\s*\S/i;

/* ── mata anggaran per item ─────────────────────────────────────────────── */

/*
 * Lembar SPPB/J tidak menuliskan MA per item. Yang ada hanya deretan MA di
 * kepala ("5010403009 dan 5010403100") dan judul golongan ("ALAT KERJA DECK",
 * "ALAT KERJA MESIN"). Pola di bawah membaca golongan itu, HANYA di antara MA
 * yang memang disebut di kepala lembar. Kalau mau pasti, tulis kode MA-nya di
 * kolom sebelah kanan tabel pada baris judul atau baris item: kode yang tertulis
 * selalu mengalahkan tebakan.
 */
const POLA_MA: { kode: string[]; rx: RegExp }[] = [
  { kode: ["5010403100", "1020604010"], rx: /\b(mesin|me|ae|m\/e|a\/e|engine|gear\s*box|kelistrikan|listrik|suku\s*cadang|sc|pompa|generator|genset)\b/i },
  { kode: ["5010403003", "1020604003"], rx: /\b(lambung|hull|bawah\s*garis|konstruksi|ro-?ro|plat|pelat|badan\s*kapal)\b/i },
  { kode: ["5010403009", "1020604009"], rx: /\b(deck|dek|akomodasi|peralatan|perlengkapan|interior|kursi|keselamatan)\b/i },
];

function tebakMaItem(teksGolongan: string, ma: string[]): string {
  const cocok = ma.filter((m) => POLA_MA.some((p) => p.kode.includes(m.slice(0, 10)) && p.rx.test(teksGolongan)));
  return cocok.length === 1 ? cocok[0] : "";
}

/* ── kategori rekap ─────────────────────────────────────────────────────── */

function tebakKategori(nama: string, dasar: string, ma: string[]): string {
  const t = `${nama} ${dasar}`.toLowerCase();
  const investasi = ma.some((m) => m.startsWith("10206"));
  if (/docking/.test(t)) return investasi ? "DOCKING (INVESTASI)" : "DOCKING(BIAYA)";
  if (investasi || /investasi/.test(t)) return "INVESTASI DILUAR DOCKING";
  if (/rutin/.test(t)) return "RUTIN";
  return "";
}

const jenisDariKategori = (k: string): SppbjRequest["jenisAnggaran"] =>
  /^docking/i.test(k) ? "Docking" : /^rutin/i.test(k) ? "Rutin" : k ? "Lainnya" : undefined;

/* ── tabel ──────────────────────────────────────────────────────────────── */

interface KolomTabel {
  jumlah: string; satuan: string; nama: string[]; spek: string;
  harga: string; total: string; akhir: number;
}

function petaKolom(baris: BarisLembar[], iJudul: number): KolomTabel | null {
  const r = baris[iJudul];
  const bawah = baris[iJudul + 1];
  const cari = (b: BarisLembar | undefined, rx: RegExp) =>
    (b ? urutKolom(b.s).find((k) => rx.test(teks(b.s[k]))) : "") || "";
  const jumlah = cari(r, /^jumlah$/i);
  const satuan = cari(r, /^satuan$/i);
  const kolNama = cari(r, /^nama\s*barang/i);
  const spek = cari(r, /^spesifikasi/i);
  const harga = cari(bawah, /^harga\s*satuan/i) || cari(r, /harga\s*satuan|^estimasi\s*harga/i);
  const total = cari(bawah, /^jumlah$/i);
  if (!jumlah || !kolNama || !harga) return null;
  // sel "Nama Barang" digabung melebar; teks itemnya bisa di lajur mana pun di dalamnya
  const batas = noKol(spek || harga);
  const nama: string[] = [];
  for (let i = noKol(kolNama); i < batas; i++) nama.push(String.fromCharCode(64 + i));
  return { jumlah, satuan, nama, spek, harga, total, akhir: noKol(total || harga) };
}

/** Berkas pengadaan juga memuat DKP, HPS, dan lampiran; hanya borang ini yang dibaca. */
export const adalahSppbj = (lembar: LembarExcel) =>
  lembar.baris.slice(0, 12).some((r) =>
    Object.values(r.s).some((v) => /permintaan\s+pengadaan\s+barang/i.test(teks(v))));

export function bacaLembar(lembar: LembarExcel): HasilLembar {
  const masalah: string[] = [];
  const catatan: string[] = [];
  const baris = lembar.baris;

  if (!adalahSppbj(lembar)) {
    masalah.push(`Lembar "${lembar.nama}" bukan borang SPPB/J (judul PERMINTAAN PENGADAAN BARANG/JASA tidak ada).`);
  }

  const iJudul = baris.findIndex((r) => {
    const isi = Object.values(r.s).map((v) => teks(v));
    return isi.some((t) => /^no\.?$/i.test(t)) && isi.some((t) => /^jumlah$/i.test(t))
      && isi.some((t) => /^nama\s*barang/i.test(t));
  });
  const kepala = iJudul >= 0 ? baris.slice(0, iJudul) : baris;

  const namaPengadaan = nilaiLabel(kepala, /^nama\s*pengadaan\b/i);
  const dasarPelimpahan = nilaiLabel(kepala, /^dasar\s*pelimpahan\b/i);
  const noSPPBJ = nilaiLabel(kepala, /^no\.?\s*sppb\s*\/?\s*j\b/i);
  const noDRP = nilaiLabel(kepala, /^no\.?\s*drp\b/i);
  const teksTanggal = nilaiLabel(kepala, /^tanggal(?!\s*dibutuhkan)\b/i);
  const teksMa = nilaiLabel(kepala, /^mata\s*anggaran\b/i);

  const { ma, asing } = bacaMa(teksMa);
  if (!namaPengadaan) masalah.push("Nama Pengadaan kosong.");
  if (!ma.length) masalah.push(`Mata Anggaran tidak terbaca${teksMa ? ` ("${teksMa.slice(0, 40)}")` : ""}. Tulis kodenya, mis. 5010403100.`);
  if (asing.length) catatan.push(`Kode MA belum ada di daftar pilihan aplikasi: ${asing.join(", ")}.`);

  const tgl = bacaTanggal(teksTanggal);
  if (!tgl) masalah.push(`Tanggal tidak terbaca${teksTanggal ? ` ("${teksTanggal.slice(0, 30)}")` : ""}.`);
  else if (!tgl.lengkap) catatan.push("Tanggal tanpa hari; dipakai tanggal 1.");
  if (!noSPPBJ) catatan.push("No. SPPB/J kosong; belum bisa masuk rekap sampai nomornya ada.");

  const items: SppbjItem[] = [];
  let lembarJumlah: number | undefined;
  const kapalNama = kapalDalam(namaPengadaan);
  let tanpaKapal = 0;

  const kolom = iJudul >= 0 ? petaKolom(baris, iJudul) : null;
  if (!kolom) masalah.push("Tabel item tidak ketemu (judul No / Jumlah / Nama Barang / Harga Satuan).");

  if (kolom) {
    const kodeMaBaris = (r: BarisLembar) => {
      for (const k of urutKolom(r.s)) {
        if (noKol(k) <= kolom.akhir) continue;
        const kode = /\b(501\d{7}|10206\d{5})\b/.exec(teks(r.s[k]))?.[1];
        const baku = kode && ma.find((m) => m.startsWith(kode));
        if (baku) return baku;
      }
      return "";
    };

    let kapal = "";
    let judul: string[] = [];
    let maJudul = "";
    let sesudahItem = false;
    let tersambung = false;       // baris ini menempel langsung di bawah item
    let terakhir: SppbjItem | null = null;

    for (let i = iJudul + 1; i < baris.length; i++) {
      const r = baris[i];
      const isiBaris = Object.values(r.s).map((v) => teks(v));

      // baris penutup "Jumlah Rp": kolom totalnya berisi jumlah seluruh item
      if (kolom.total && r.s[kolom.total] !== undefined && isiBaris.some((t) => /^jumlah\s*(rp|:)/i.test(t))) {
        lembarJumlah = angka(r.s[kolom.total]);
        break;
      }
      if (isiBaris.some((t) => /^(catatan peminta|dibuat oleh|kerangka acuan)/i.test(t))) break;
      if (isiBaris.some((t) => /^harga\s*satuan/i.test(t))) continue;

      const nama = kolom.nama.map((k) => teks(r.s[k])).find(Boolean) || "";
      const qty = angka(r.s[kolom.jumlah]);
      const harga = angka(r.s[kolom.harga]);
      const total = kolom.total ? angka(r.s[kolom.total]) : 0;
      const tebal = kolom.nama.some((k) => (r.b || "").includes(k));
      if (r.n !== baris[i - 1].n + 1) tersambung = false;

      if (!nama) {
        if (qty > 0 || harga > 0 || total > 0) catatan.push(`Baris ${r.n} punya angka tapi tanpa nama barang; dilewati.`);
        tersambung = false;
        continue;
      }

      /*
       * Baris kapal dan judul golongan kadang membawa subtotal di kolom harga
       * ("KMP. BARONANG" dengan 6.495.000 di sebelahnya). Yang menandai item
       * adalah kuantitasnya; tanpa kuantitas, angka di baris tebal atau baris
       * kapal adalah subtotal. Kalau dibaca sebagai item, nilainya terhitung dua
       * kali.
       */
      const barisKapal = RX_KAPAL.test(nama) && nama.split(" ").length <= 5 && !qty;
      if (qty > 0 || ((harga > 0 || total > 0) && !tebal && !barisKapal)) {
        if (!qty) catatan.push(`Baris ${r.n} (${nama.slice(0, 30)}): kuantiti kosong, dianggap 1.`);
        const hargaSatuan = harga || (total && qty ? total / qty : total);
        const it: SppbjItem = {
          id: globalThis.crypto?.randomUUID?.() ?? String(Math.random()),
          kapal: kapal || kapalNama,
          jumlah: qty || 1,
          satuan: teks(kolom.satuan ? r.s[kolom.satuan] : "") || "unit",
          nama,
          spesifikasi: teks(kolom.spek ? r.s[kolom.spek] : ""),
          harga: hargaSatuan,
        };
        if (judul.length) it.keterangan = judul.join("\n");
        if (ma.length > 1) {
          const dipilih = kodeMaBaris(r) || maJudul || tebakMaItem(judul.join(" ") || nama, ma);
          if (dipilih) it.mataAnggaran = dipilih;
        }
        if (!hargaSatuan) catatan.push(`Baris ${r.n} (${nama.slice(0, 30)}): harga satuan kosong.`);
        if (total && Math.abs(it.jumlah * hargaSatuan - total) > 1) {
          catatan.push(`Baris ${r.n} (${nama.slice(0, 30)}): jumlah x harga tidak sama dengan kolom Jumlah.`);
        }
        if (!it.kapal) tanpaKapal++;
        items.push(it);
        terakhir = it;
        sesudahItem = true;
        tersambung = true;
        continue;
      }

      // baris tanpa angka: nama kapal, judul golongan, atau rincian item di atasnya
      if (barisKapal) {
        kapal = kapalDalam(nama) || (kunciKapal(nama) ? nama : "");
        judul = [];
        maJudul = "";
        sesudahItem = false;
        terakhir = null;
        tersambung = false;
        continue;
      }
      if (!tebal && terakhir && tersambung && nama !== nama.toUpperCase()) {
        terakhir.breakdown = [...(terakhir.breakdown || []), nama];
        continue;
      }
      if (sesudahItem) { judul = []; maJudul = ""; sesudahItem = false; }
      judul.push(nama);
      maJudul = kodeMaBaris(r) || maJudul;
      terakhir = null;
      tersambung = false;
    }
  }

  if (kolom && !items.length) masalah.push("Tidak ada baris item yang terbaca.");
  if (tanpaKapal) catatan.push(`${tanpaKapal} item belum punya kapal; tulis baris nama kapal di atas item.`);

  const jumlah = items.reduce((s, i) => s + i.jumlah * i.harga, 0);
  const ppn = Math.round(jumlah * 0.11);
  if (lembarJumlah !== undefined && Math.abs(lembarJumlah - jumlah) > 1) {
    catatan.unshift(`PERIKSA: jumlah item ${rupiah(jumlah)} tidak sama dengan "Jumlah Rp" di lembar ${rupiah(lembarJumlah)}.`);
  }

  const perMa: PerMa[] = [];
  if (ma.length > 1) {
    const tanpa = items.filter((i) => !i.mataAnggaran).length;
    if (tanpa) catatan.push(`${tanpa} item tak terbaca MA-nya, ikut MA pertama (${ma[0].slice(0, 10)}).`);
    for (const m of ma) {
      const isi = items.filter((i) => (i.mataAnggaran || ma[0]) === m);
      perMa.push({ ma: m, item: isi.length, nilai: isi.reduce((s, i) => s + i.jumlah * i.harga, 0) });
    }
  } else if (ma.length === 1) {
    perMa.push({ ma: ma[0], item: items.length, nilai: jumlah });
    /*
     * Pembagian MA hanya bisa dibaca kalau tertulis di lembar. Pengadaan yang di
     * aplikasi dipecah 2-3 MA tetapi lembarnya menulis satu saja tidak punya
     * jejak pembagian sama sekali, jadi yang bisa dilakukan di sini hanya
     * mengingatkan kalau judul golongannya menyebut pos lain.
     */
    const kodeIni = ma[0].slice(0, 10);
    const famili = kodeIni.slice(0, 3);
    const posLain = new Set<string>();
    for (const it of items) {
      const j = it.keterangan;
      if (!j || POLA_MA.some((p) => p.kode.includes(kodeIni) && p.rx.test(j))) continue;
      for (const p of POLA_MA) {
        const lain = p.kode.find((k) => k.startsWith(famili));
        if (lain && p.rx.test(j)) posLain.add(lain);
      }
    }
    if (posLain.size) {
      catatan.push(`Judul golongan menyebut pos ${Array.from(posLain).join(", ")}, lembar hanya menulis ${kodeIni}. Kalau MA-nya dipecah, tulis semua kodenya di baris Mata Anggaran.`);
    }
  }

  const kategori = tebakKategori(namaPengadaan, dasarPelimpahan, ma);
  if (!kategori) catatan.push("Kategori rekap tak bisa ditebak; pilih di aplikasi.");

  const kapalUnik: string[] = [];
  for (const it of items) if (it.kapal && !kapalUnik.includes(it.kapal)) kapalUnik.push(it.kapal);

  return {
    lembar: lembar.nama,
    req: {
      status: "menunggu_spbj",
      tanggal: tgl?.iso || "",
      noSPPBJ,
      namaPengadaan,
      dasarPelimpahan,
      mataAnggaran: ma,
      noDRP,
      kategoriRekap: kategori || undefined,
      jenisAnggaran: jenisDariKategori(kategori),
      jenisPengadaan: /jasa/i.test(namaPengadaan) ? "jasa" : "barang",
      stafTeknik: STAF_TEKNIK[0],
      deptHead: DEPT_HEAD,
      items,
    },
    masalah,
    catatan,
    kategoriTebakan: !!kategori,
    ringkas: { item: items.length, kapal: kapalUnik, perMa, jumlah, ppn, total: jumlah + ppn },
  };
}

/**
 * Gabungkan hasil baca ke catatan yang sudah tersimpan.
 *
 * Excel memegang isi usulan: tanggal, nomor, nama, dasar, MA, dan item. Selain
 * itu milik aplikasi dan tidak disentuh - status, vendor, PO, GR/SES, foto,
 * tautan surat persetujuan. Kategori yang sudah dipilih orang juga tidak
 * ditimpa tebakan. Item yang sama dipertahankan identitas dan harga finalnya.
 */
export function gabungKeTersimpan(lama: any, baru: HasilLembar["req"]): any {
  const kunci = (i: any) => [i.kapal, i.nama, i.spesifikasi].map((v) => teks(v).toLowerCase()).join("|");
  const sisa = new Map<string, any[]>();
  for (const it of lama.items || []) {
    const k = kunci(it);
    sisa.set(k, [...(sisa.get(k) || []), it]);
  }
  const items = baru.items.map((it) => {
    const c = sisa.get(kunci(it))?.shift();
    return c ? { ...c, ...it, id: c.id } : it;
  });
  return {
    ...lama,
    tanggal: baru.tanggal,
    noSPPBJ: baru.noSPPBJ || lama.noSPPBJ || "",
    namaPengadaan: baru.namaPengadaan,
    dasarPelimpahan: baru.dasarPelimpahan,
    mataAnggaran: baru.mataAnggaran,
    noDRP: baru.noDRP || lama.noDRP || "",
    kategoriRekap: lama.kategoriRekap || baru.kategoriRekap,
    jenisAnggaran: lama.jenisAnggaran || baru.jenisAnggaran,
    jenisPengadaan: lama.jenisPengadaan || baru.jenisPengadaan,
    items,
  };
}
