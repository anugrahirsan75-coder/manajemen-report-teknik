/**
 * Pembaca lembar "MUSTER" sertifikat kapal — SERVER SAJA (jangan diimpor dari
 * komponen klien: memakai exceljs dan menarik berkas 1,2 MB).
 *
 * Lembarnya diunduh sebagai .xlsx, bukan CSV, karena kolom "FILE SERTIFIKAT"
 * menyimpan TAUTAN Google Drive di dalam sel — CSV hanya memberi teksnya dan
 * tautan berkasnya hilang.
 *
 * Bentuk lembar (tab MUSTER):
 *   baris 6  : nama kapal, tergabung tiap 4 kolom mulai kolom 3
 *   baris 7  : TERBIT · BERLAKU SAMPAI DENGAN · SISA HARI · FILE SERTIFIKAT
 *   baris 9+ : baris kelompok (kolom A berisi huruf, tanggalnya kosong) diselingi
 *              baris sertifikat (kolom A berisi nomor)
 */
import ExcelJS from "exceljs";
import { Sertifikat } from "./types";
import { namaKapalPenuh } from "@/lib/anggaran/types";

const ID_LEMBAR = "1gXk2f_QVsxgca_zKnQoLnVEe7ta3P8Ep";
const urlUnduh = () =>
  process.env.SERTIFIKAT_XLSX_URL ||
  `https://docs.google.com/spreadsheets/d/${ID_LEMBAR}/export?format=xlsx`;

const KOL_AWAL = 3;      // kolom pertama blok kapal
const LEBAR_BLOK = 4;    // terbit · berlaku · sisa hari · berkas
const BARIS_KAPAL = 6;
const BARIS_AWAL = 9;

/** ambil teks sel apa pun: rumus, teks kaya, tanggal, angka */
function teks(sel: ExcelJS.Cell): string {
  let v: any = sel.value;
  if (v == null) return "";
  if (typeof v === "object" && "result" in v) v = v.result;      // sel rumus
  if (v == null) return "";
  if (v instanceof Date) return isoDari(v);
  if (typeof v === "object" && Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join("");
  if (typeof v === "object" && "text" in v) return String(v.text);
  return String(v).trim();
}

/**
 * Tanggal di lembar ini campur: sebagian sel tanggal asli, sebagian teks
 * "16-Jun-26" dengan nama bulan Indonesia. Keduanya harus terbaca, kalau tidak
 * sertifikat yang diketik manual ikut hilang dari pemantauan.
 */
const BULAN_ID: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  agu: 8, ags: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};

const isoDari = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

/**
 * Sel tanggal yang dikosongkan di Excel terbaca sebagai 30 Des 1899 (titik nol
 * penanggalan Excel). Kalau dibiarkan, dokumen tanpa tanggal muncul sebagai
 * "kedaluwarsa 46 ribu hari" dan menutupi sertifikat yang benar-benar mendesak.
 */
const TAHUN_MASUK_AKAL = 1990;

function keIso(t: string): string {
  const s = (t || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})[-/\s]([A-Za-z]{3,})[-/\s](\d{2,4})$/.exec(s);
  if (m) {
    const bl = BULAN_ID[m[2].slice(0, 3).toLowerCase()];
    if (!bl) return "";
    let th = +m[3];
    // tahun dua angka: "93" itu 1993, "26" itu 2026
    if (th < 100) th += th < 50 ? 2000 : 1900;
    return `${th}-${String(bl).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : isoDari(d);
}

/** buang tanggal yang jelas bukan tanggal sungguhan */
const isoSah = (iso: string) => (iso && +iso.slice(0, 4) >= TAHUN_MASUK_AKAL ? iso : "");

const permanenkah = (t: string) => /permanen|permanent|selamanya|tetap/i.test(t);

/** selisih hari dari hari ini (waktu diabaikan supaya tidak meleset sehari) */
function sisaHariDari(iso: string): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const kini = new Date();
  const hariIni = Date.UTC(kini.getFullYear(), kini.getMonth(), kini.getDate());
  return Math.round((target - hariIni) / 86_400_000);
}

function tautanSel(sel: ExcelJS.Cell): string {
  const l: any = (sel as any).hyperlink || (sel.value as any)?.hyperlink;
  const url = typeof l === "string" ? l : l?.target || "";
  // Drive menulis tautannya sebagai /open?id=… — bentuk /file/d/…/view lebih
  // enak dibuka di ponsel karena langsung ke pratinjau berkas
  const m = /[?&]id=([A-Za-z0-9_-]+)/.exec(url);
  return m ? `https://drive.google.com/file/d/${m[1]}/view` : url;
}

export interface HasilSertifikat {
  baris: Sertifikat[];
  kapal: string[];
  diambilPada: string;
}

/** Lembar berubah paling sering beberapa kali sehari; 30 menit sudah cukup segar. */
const UMUR_CACHE = 30 * 60 * 1000;
let simpanan: { pada: number; hasil: HasilSertifikat } | null = null;

export async function ambilSertifikat(segar = false): Promise<HasilSertifikat> {
  if (!segar && simpanan && Date.now() - simpanan.pada < UMUR_CACHE) return simpanan.hasil;

  const res = await fetch(urlUnduh(), { cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`Lembar sertifikat tidak terbaca (${res.status})`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());

  const ws = wb.getWorksheet("MUSTER") || wb.worksheets[0];
  if (!ws) throw new Error("Tab MUSTER tidak ditemukan di lembar sertifikat");

  // kapal dibaca dari kepala tabel, bukan dari daftar tetap — kalau cabang
  // menambah kapal, layarnya ikut tanpa perlu ubah kode
  const barisKapal = ws.getRow(BARIS_KAPAL);
  const blok: { kapal: string; kol: number }[] = [];
  for (let c = KOL_AWAL; c <= ws.columnCount; c += LEBAR_BLOK) {
    const nama = teks(barisKapal.getCell(c))
      .replace(/\s*TERBIT\s*$/i, "")
      .replace(/PORT\s+LINK/i, "PORTLINK")   // lembar menulis terpisah, armada resmi menyatu
      .replace(/\s+/g, " ")
      .trim();
    if (nama) blok.push({ kapal: namaKapalPenuh(nama), kol: c });
  }

  const baris: Sertifikat[] = [];
  let kelompok = "";
  for (let r = BARIS_AWAL; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const no = teks(row.getCell(1));
    const jenis = teks(row.getCell(2));
    if (!jenis) continue;

    // Baris kelompok dikenali dari kolom NO yang berisi HURUF (A, B, C, …) —
    // bukan sekadar "baris tanpa tanggal". Sertifikat yang kebetulan belum
    // terisi di semua kapal juga tanpa tanggal, dan kalau dipakai sebagai judul
    // kelompok, sertifikat di bawahnya ikut salah label.
    const adaIsi = blok.some((b2) => teks(row.getCell(b2.kol)) || teks(row.getCell(b2.kol + 1)));
    const judulKelompok = !adaIsi && (/^[A-Z]$/i.test(no) || (!no && jenis === jenis.toUpperCase()));
    if (judulKelompok) { kelompok = jenis; continue; }
    if (!adaIsi) continue;                       // sertifikat yang belum terisi di kapal mana pun

    for (const b of blok) {
      const terbit = isoSah(keIso(teks(row.getCell(b.kol))));
      const kasarBerlaku = teks(row.getCell(b.kol + 1));
      const permanen = permanenkah(kasarBerlaku);
      const berlaku = permanen ? "" : isoSah(keIso(kasarBerlaku));
      const selBerkas = row.getCell(b.kol + 3);
      const berkasNama = teks(selBerkas);
      if (!terbit && !berlaku && !permanen && !berkasNama) continue;   // sel kosong

      baris.push({
        kapal: b.kapal, kelompok, no, jenis,
        terbit, berlaku, permanen,
        sisaHari: permanen ? null : sisaHariDari(berlaku),
        berkasNama, berkasUrl: tautanSel(selBerkas),
      });
    }
  }

  const hasil: HasilSertifikat = {
    baris,
    kapal: blok.map((b) => b.kapal),
    diambilPada: new Date().toISOString(),
  };
  simpanan = { pada: Date.now(), hasil };
  return hasil;
}
