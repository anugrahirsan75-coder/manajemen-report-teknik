import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import { Edit, applyEdits, insertRowsRaw, saveZip, sheetXmlPath } from "@/lib/sppbj/fill";

/**
 * Berkas pengadaan SCM — 12 sheet sekaligus.
 *
 * Dibuat dengan MENGISI berkas milik tim SCM sendiri, bukan menyusun ulang dari
 * nol. Alasannya bukan hemat tenaga: berkas itu memuat nomor dokumen mutu
 * (HP-103.00.02 dan seterusnya), kop, garis, dan rumus antar-sheet yang sudah
 * dipakai bertahun-tahun. Menyusun ulang berarti mempertaruhkan semua itu pada
 * ingatan; mengisinya berarti hasilnya memang berkas yang sama.
 *
 * Sheet DATA adalah papan kendalinya — dokumen lain menarik isinya dari sana.
 * Karena itu yang diisi terutama DATA, ditambah tabel item pada sheet yang
 * memang memuat daftar barang.
 */

const tplPath = () => path.join(process.cwd(), "templates", "scm", "pengadaan-scm.xlsx");

export interface ItemScm {
  kapal: string;
  keterangan?: string;
  nama: string;
  spesifikasi?: string;
  jumlah: number;
  satuan: string;
  harga: number;        // harga penawaran (satuan)
  hargaNego?: number;   // harga setelah negosiasi (satuan)
}

export interface DataScm {
  namaPengadaan: string;
  noSppbj: string;
  tglSppbj: string;          // ISO
  user: string;              // "Divisi Teknik"
  items: ItemScm[];

  noInisiasi: string;
  tglInisiasi: string;

  vendor: {
    nama: string; pimpinan: string; jabatan: string;
    telepon?: string; fax?: string; npwp?: string; alamat?: string; kota?: string;
  };
  noPenawaran: string;
  tglPenawaran: string;

  tglNego: string; jamNego: string;
  tglBahp: string; jamBahp: string;
  tglSpbj: string; hariPenyerahan: number;
  lokasi: string;            // "Ternate"
}

/* ── bantu ──────────────────────────────────────────────────────────────── */

/** tanggal Excel: hari sejak 1899-12-30, supaya sel bertipe tanggal tetap tanggal */
function serialTanggal(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return Math.round((t - Date.UTC(1899, 11, 30)) / 86_400_000);
}

const tgl = (ref: string, iso: string): Edit[] => {
  const s = serialTanggal(iso);
  return s === null ? [] : [{ ref, kind: "num", value: s }];
};

const teks = (ref: string, v: string | undefined): Edit => ({ ref, kind: "str", value: String(v ?? "") });

/** baris tabel: judul kelompok (kapal / keterangan) atau satu item */
type BarisTabel =
  | { jenis: "judul"; teks: string }
  | { jenis: "item"; no: number; it: ItemScm };

/**
 * Susunan baris tabel sama untuk semua sheet: nama kapal jadi judul, lalu
 * keterangan kelompok (mis. "AE, Merk : Cummins 6BT 5.9"), lalu itemnya.
 * Dibuat sekali di sini supaya nomor urut dan urutan barisnya identik di SPPBJ,
 * DKP, LAMPIRAN NEGO, dan SPBJ BARU — kalau berbeda, dokumen-dokumen itu tak
 * lagi bisa dibaca berdampingan.
 */
function susunBaris(items: ItemScm[]): BarisTabel[] {
  const kapal: string[] = [];
  items.forEach((i) => { const k = (i.kapal || "").trim(); if (k && !kapal.includes(k)) kapal.push(k); });
  if (!kapal.length) kapal.push("");

  const out: BarisTabel[] = [];
  let no = 1;
  kapal.forEach((k) => {
    const isi = items.filter((i) => (i.kapal || "").trim() === k);
    if (k) out.push({ jenis: "judul", teks: k });
    let ketSebelum = "";
    isi.forEach((it) => {
      const ket = (it.keterangan || "").trim();
      if (ket && ket !== ketSebelum) {
        ket.split(/\r?\n/).filter(Boolean).forEach((b) => out.push({ jenis: "judul", teks: b }));
        ketSebelum = ket;
      }
      out.push({ jenis: "item", no: no++, it });
    });
  });
  return out;
}

/** tata letak tabel item pada satu sheet */
interface TataTabel {
  sheet: string;
  awal: number;            // baris pertama tabel
  akhir: number;           // baris terakhir yang tersedia di template
  gayaBaris: number;       // baris contoh untuk gaya saat menyisipkan
  kolomJudul: string;      // kolom tempat judul kelompok ditulis
  kolom: {
    no?: string; jumlah?: string; satuan?: string; nama: string; spesifikasi?: string;
    harga?: string; jumlahHarga?: string;       // harga penawaran
    hargaNego?: string; jumlahNego?: string;    // harga setelah nego
  };
  pakaiNego?: boolean;     // tulis kolom harga nego
  hanyaNego?: boolean;     // hanya harga nego (SPBJ BARU)
  tanpaHarga?: boolean;    // DKP: harga dikosongkan, diisi vendor
}

const TATA: TataTabel[] = [
  {
    sheet: "SPPBJ", awal: 17, akhir: 55, gayaBaris: 30, kolomJudul: "E",
    kolom: { no: "B", jumlah: "C", satuan: "D", nama: "E", spesifikasi: "F", harga: "G", jumlahHarga: "H" },
  },
  {
    sheet: "DKP", awal: 10, akhir: 47, gayaBaris: 20, kolomJudul: "E",
    kolom: { no: "B", jumlah: "C", satuan: "D", nama: "E", spesifikasi: "F", harga: "G", jumlahHarga: "H" },
    tanpaHarga: true,
  },
  {
    sheet: "LAMPIRAN NEGO", awal: 17, akhir: 55, gayaBaris: 30, kolomJudul: "D",
    kolom: {
      no: "A", jumlah: "B", satuan: "C", nama: "D", spesifikasi: "E",
      harga: "F", jumlahHarga: "G", hargaNego: "H", jumlahNego: "I",
    },
    pakaiNego: true,
  },
  {
    sheet: "SPBJ BARU", awal: 33, akhir: 72, gayaBaris: 40, kolomJudul: "B",
    kolom: { no: "A", nama: "B", spesifikasi: "H", jumlah: "I", satuan: "J", hargaNego: "K", jumlahNego: "L" },
    hanyaNego: true,
  },
];

const KOLOM_BERSIH = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

function editTabel(t: TataTabel, baris: BarisTabel[], akhir: number): Edit[] {
  const e: Edit[] = [];
  for (let r = t.awal; r <= akhir; r++) KOLOM_BERSIH.forEach((c) => e.push({ ref: `${c}${r}`, kind: "clear" }));

  let r = t.awal;
  for (const b of baris) {
    if (r > akhir) break;
    if (b.jenis === "judul") { e.push(teks(`${t.kolomJudul}${r}`, b.teks)); r++; continue; }

    const { it, no } = b;
    const k = t.kolom;
    if (k.no) e.push({ ref: `${k.no}${r}`, kind: "num", value: no });
    if (k.jumlah) e.push({ ref: `${k.jumlah}${r}`, kind: "num", value: it.jumlah });
    if (k.satuan) e.push(teks(`${k.satuan}${r}`, it.satuan));
    e.push(teks(`${k.nama}${r}`, it.nama));
    if (k.spesifikasi) e.push(teks(`${k.spesifikasi}${r}`, it.spesifikasi || ""));

    if (!t.tanpaHarga && !t.hanyaNego && k.harga && k.jumlahHarga) {
      e.push({ ref: `${k.harga}${r}`, kind: "num", value: it.harga });
      e.push({ ref: `${k.jumlahHarga}${r}`, kind: "formula", value: `${k.harga}${r}*${k.jumlah}${r}` });
    }
    if ((t.pakaiNego || t.hanyaNego) && k.hargaNego && k.jumlahNego) {
      // harga nego ditulis sebagai ANGKA, bukan rumus "penawaran x 95%".
      // Potongannya sering tidak rata — beberapa baris tak bergerak sama sekali —
      // dan rumus rata akan diam-diam mengarang angka yang tak pernah disepakati.
      e.push({ ref: `${k.hargaNego}${r}`, kind: "num", value: it.hargaNego ?? it.harga });
      e.push({ ref: `${k.jumlahNego}${r}`, kind: "formula", value: `${k.hargaNego}${r}*${k.jumlah || k.no}${r}` });
    }
    r++;
  }
  return e;
}

/* ── sheet DATA: papan kendali ──────────────────────────────────────────── */

function editData(d: DataScm): Edit[] {
  const e: Edit[] = [
    teks("C6", d.user || "Divisi Teknik"),
    teks("C15", d.noInisiasi),
    ...tgl("C17", d.tglInisiasi),

    // Vendor ditulis sebagai NILAI, bukan dibiarkan VLOOKUP ke nomor urut di
    // sheet DATA VENDOR: urutan baris di sana bisa berubah kapan saja, dan
    // dokumen yang sudah terbit tidak boleh ikut berubah karenanya.
    teks("C18", d.vendor.nama),
    teks("C19", d.vendor.pimpinan),
    teks("C20", d.vendor.telepon || ""),
    teks("C21", d.vendor.fax || ""),
    teks("C22", d.vendor.kota || ""),
    teks("C60", d.vendor.jabatan || "Direktur"),
    teks("C61", d.vendor.alamat || ""),
    teks("C62", d.vendor.kota || ""),
    teks("C63", d.vendor.npwp || ""),

    teks("C26", d.noPenawaran),
    ...tgl("C27", d.tglPenawaran),

    ...tgl("C33", d.tglNego),
    teks("C34", d.jamNego || "14.00 WIT"),

    ...tgl("C46", d.tglBahp),
    teks("C47", d.jamBahp || "15.00 WIT"),

    ...tgl("C56", d.tglSpbj),
    teks("C57", d.lokasi || "Ternate"),
    ...tgl("D66", d.tglSpbj),
  ];
  const mulai = serialTanggal(d.tglSpbj);
  if (mulai !== null) e.push({ ref: "D67", kind: "num", value: mulai + (d.hariPenyerahan || 7) });
  return e;
}

/** SPPBJ: kepala dokumen selain tabelnya */
const editKepalaSppbj = (d: DataScm): Edit[] => [
  teks("H7", d.noSppbj),
  teks("H8", tanggalPanjang(d.tglSppbj)),
  teks("E12", d.namaPengadaan),
];

/** JADWAL: tujuh tahap, mengikuti tanggal inisiasi sampai tanggal SPBJ */
function editJadwal(d: DataScm): Edit[] {
  const a = serialTanggal(d.tglInisiasi);
  const nego = serialTanggal(d.tglNego) ?? a;
  const spbj = serialTanggal(d.tglSpbj) ?? nego;
  if (a === null) return [];
  const baris: [number, number][] = [
    [a, a], [a, a], [a, a],
    [a, nego ?? a], [nego ?? a, nego ?? a], [nego ?? a, nego ?? a], [spbj ?? a, spbj ?? a],
  ];
  const e: Edit[] = [];
  baris.forEach(([m, s], i) => {
    e.push({ ref: `E${14 + i}`, kind: "num", value: m });
    e.push({ ref: `F${14 + i}`, kind: "num", value: s });
  });
  return e;
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function tanggalPanjang(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}` : "";
}

/* ── pintu masuk ────────────────────────────────────────────────────────── */

export function buatExcelScm(d: DataScm): Buffer {
  const zip = new PizZip(fs.readFileSync(tplPath()));
  const baris = susunBaris(d.items);

  const bagian: { sheet: string; edits: Edit[] }[] = [];

  for (const t of TATA) {
    // sisipkan baris bila daftarnya lebih panjang dari kapasitas template,
    // supaya baris jumlah/PPN/tanda tangan ikut turun beserta rumusnya
    const muat = t.akhir - t.awal + 1;
    const kurang = Math.max(0, baris.length - muat);
    if (kurang > 0) insertRowsRaw(zip, t.sheet, t.akhir, kurang, t.gayaBaris);
    bagian.push({ sheet: t.sheet, edits: editTabel(t, baris, t.akhir + kurang) });
  }

  bagian.push({ sheet: "DATA", edits: editData(d) });
  bagian.push({ sheet: "SPPBJ", edits: editKepalaSppbj(d) });
  bagian.push({ sheet: "JADWAL", edits: editJadwal(d) });

  // satu sheet bisa disebut lebih dari sekali (tabel & kepala) — gabung dulu,
  // karena tiap penulisan mengganti seluruh isi XML-nya
  const gabung = new Map<string, Edit[]>();
  bagian.forEach((b) => gabung.set(b.sheet, [...(gabung.get(b.sheet) || []), ...b.edits]));

  gabung.forEach((edits, sheet) => {
    const p = sheetXmlPath(zip, sheet);
    zip.file(p, applyEdits(zip.file(p)!.asText(), edits));
  });

  return saveZip(zip);
}
