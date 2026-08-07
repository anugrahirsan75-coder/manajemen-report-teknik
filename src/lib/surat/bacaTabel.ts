"use client";
/**
 * Mesin baca berkas untuk tabel surat.
 *
 * Satu berkas bisa datang dalam banyak rupa, dan tiap rupa punya jalur yang
 * paling akurat — bukan semuanya pantas dilempar ke OCR:
 *
 *   .xlsx/.xls/.csv  isinya sudah berupa angka pasti. Dibaca langsung di
 *                    peramban; kalau judul kolomnya terbaca, tabel jadi TANPA
 *                    AI sama sekali (hasilnya persis, dan berkas tak ke mana-mana).
 *   .pdf             kalau punya lapisan teks (PDF hasil cetak dari Excel/Word),
 *                    teksnya diambil apa adanya — jauh lebih tepat daripada
 *                    memotret halamannya. PDF pindaian barulah dirender jadi
 *                    gambar per halaman.
 *   gambar/foto      dikecilkan seperlunya lalu dibaca model bervisi.
 *
 * Untuk bagian yang butuh model: Gemini di server dulu, kalau kuncinya belum
 * diset barulah Ollama di laptop (lewat peramban, jadi isi berkas tidak lewat
 * Vercel). Semua hasil tetap ditampilkan untuk diperiksa sebelum masuk borang.
 */
import { KolomTabel } from "./types";
import { keRupiahBersih, keTanggalIso, promptTabel, rapikanBaris } from "./bacaSkema";
import { tabelBlokMA } from "./bacaBlokMA";
import { keAngka } from "./format";
import { extractJson } from "@/lib/sppbj/scanPrompt";
import { ollamaHost } from "@/lib/sppbj/scanAI";
import { bukaPdf } from "@/lib/pdfPeramban";

export type Mesin =
  | "berkas"          // dibaca langsung dari Excel/CSV, tanpa AI
  | "gemini-teks" | "gemini-gambar"
  | "ollama-teks" | "ollama-gambar";

export interface HasilBaca {
  baris: Record<string, string>[];
  mesin: Mesin;
  catatan: string[];
}

export interface Kemajuan { tahap: string; persen?: number }

export class TakAdaMesin extends Error {}

const NAMA_MESIN: Record<Mesin, string> = {
  "berkas": "dibaca langsung dari berkas (tanpa AI)",
  "gemini-teks": "AI cloud (Gemini) — dari teks berkas",
  "gemini-gambar": "AI cloud (Gemini) — dari gambar",
  "ollama-teks": "AI lokal (Ollama) — dari teks berkas",
  "ollama-gambar": "AI lokal (Ollama) — dari gambar",
};
export const namaMesin = (m: Mesin) => NAMA_MESIN[m] || m;

const ekstensi = (nama: string) => (nama.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "");
export const BERKAS_DITERIMA = ".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,image/*";

/* ══════════════════════════════════════════════════════════════════════════
   1. Excel & CSV — dibaca apa adanya
   ══════════════════════════════════════════════════════════════════════════ */

export interface Lembar { nama: string; matriks: string[][] }

/**
 * Tiap lembar dibaca SENDIRI-SENDIRI, tidak digabung jadi satu matriks.
 *
 * Berkas nyata seperti Repair List punya empat lembar: daftar pekerjaan yang
 * panjang, penunjang docking, lalu Kontrol Biaya yang justru jadi sumber surat.
 * Kalau semuanya ditumpuk, baris judul tabel yang dicari terkubur ratusan baris
 * di bawah dan tak pernah ketemu.
 */
async function lembarSpreadsheet(file: File): Promise<Lembar[]> {
  if (ekstensi(file.name) === "csv") return [{ nama: file.name, matriks: uraiCsv(await file.text()) }];

  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const keluar: Lembar[] = [];
  wb.eachSheet((ws) => {
    const matriks: string[][] = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      const baris: string[] = [];
      row.eachCell({ includeEmpty: true }, (sel, kol) => {
        baris[kol - 1] = selKeTeks(sel.value);
      });
      matriks.push(Array.from(baris, (v) => v ?? ""));
    });
    keluar.push({ nama: ws.name, matriks });
  });
  return keluar;
}

/**
 * Urutan lembar yang paling mungkin memuat tabelnya. Lembar dengan blok
 * "(M.A. …)" dan judul RKA jelas lebih menjanjikan daripada daftar pekerjaan
 * sepanjang dua ratus baris.
 */
function urutkanLembar(lembar: Lembar[]): Lembar[] {
  const skor = (l: Lembar) => {
    const teks = l.matriks.slice(0, 400).map((r) => r.join(" ")).join("\n");
    return (teks.match(/\(\s*M\.?\s*A\.?\s*\.?\s*\d{6,}/gi)?.length || 0) * 3
      + (/\brka\b/i.test(teks) ? 5 : 0)
      + (/kontrol\s+biaya|usulan\s+cabang/i.test(`${l.nama} ${teks}`) ? 5 : 0);
  };
  return [...lembar].map((l) => ({ l, s: skor(l) })).sort((a, b) => b.s - a.s).map((x) => x.l);
}

function selKeTeks(v: any): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v) return String(v.text);
    if ("result" in v) return selKeTeks(v.result);                 // sel rumus
    if ("richText" in v) return v.richText.map((r: any) => r.text).join("");
    if ("hyperlink" in v) return String(v.text || v.hyperlink);
  }
  return String(v);
}

/** pengurai CSV sederhana yang tetap menghormati tanda kutip dan koma di dalamnya */
function uraiCsv(teks: string): string[][] {
  const pemisah = (teks.split("\n")[0].match(/;/g) || []).length > (teks.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const keluar: string[][] = [];
  let baris: string[] = [];
  let sel = "";
  let dalamKutip = false;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (dalamKutip) {
      if (c === '"' && teks[i + 1] === '"') { sel += '"'; i++; }
      else if (c === '"') dalamKutip = false;
      else sel += c;
    } else if (c === '"') dalamKutip = true;
    else if (c === pemisah) { baris.push(sel); sel = ""; }
    else if (c === "\n") { baris.push(sel); keluar.push(baris); baris = []; sel = ""; }
    else if (c !== "\r") sel += c;
  }
  if (sel || baris.length) { baris.push(sel); keluar.push(baris); }
  return keluar;
}

/* ── mencocokkan judul kolom berkas dengan kolom borang ─────────────────── */

const bersih = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** kata kunci tambahan supaya judul yang beda sebutan tetap ketemu */
const SINONIM: Record<string, string[]> = {
  kode: ["kode", "ma", "m a", "mata anggaran", "akun", "gl"],
  uraian: ["uraian", "keterangan", "nama", "deskripsi", "pekerjaan", "mata anggaran"],
  rka: ["rka", "anggaran", "pagu", "budget"],
  cabang: ["usulan", "cabang", "usulan cabang", "realisasi"],
  nilai: ["nilai", "jumlah", "total", "biaya", "harga", "rp"],
  kapal: ["kapal", "kmp", "nama kapal", "armada"],
  nomor: ["nomor", "no surat", "no"],
  tanggal: ["tanggal", "tgl", "date"],
  perihal: ["perihal", "hal", "tentang"],
  instansi: ["dari", "instansi", "asal", "pengirim", "unit"],
};

const kataKolom = (k: KolomTabel) =>
  Array.from(new Set([bersih(k.label), bersih(k.id), ...(SINONIM[k.id] || []).map(bersih)])).filter(Boolean);

/** seberapa yakin sel ini adalah judul untuk kolom tsb (0 = tidak cocok) */
function skorJudul(sel: string, k: KolomTabel): number {
  const s = bersih(sel);
  if (!s) return 0;
  let skor = 0;
  for (const kata of kataKolom(k)) {
    if (s === kata) skor = Math.max(skor, 3);
    else if (s.includes(kata) || kata.includes(s)) skor = Math.max(skor, 2);
  }
  return skor;
}

interface PetaKolom { indeks: Record<string, number>; barisJudul: number; cocok: number }

/** cari baris judul + kolom mana milik siapa */
function cariPeta(matriks: string[][], kolom: KolomTabel[]): PetaKolom {
  let terbaik: PetaKolom = { indeks: {}, barisJudul: -1, cocok: 0 };
  const batas = Math.min(matriks.length, 40);
  for (let r = 0; r < batas; r++) {
    const indeks: Record<string, number> = {};
    const terpakai = new Set<number>();
    let cocok = 0;
    kolom.forEach((k) => {
      let skorTerbaik = 0, kolomTerbaik = -1;
      matriks[r].forEach((sel, c) => {
        if (terpakai.has(c)) return;
        const s = skorJudul(sel, k);
        if (s > skorTerbaik) { skorTerbaik = s; kolomTerbaik = c; }
      });
      if (skorTerbaik >= 2 && kolomTerbaik >= 0) { indeks[k.id] = kolomTerbaik; terpakai.add(kolomTerbaik); cocok++; }
    });
    if (cocok > terbaik.cocok) terbaik = { indeks, barisJudul: r, cocok };
  }
  return terbaik;
}

const BARIS_REKAP = /^\s*(sub\s*total|total|jumlah|grand\s*total)\b/i;

/**
 * Coba susun tabel tanpa AI. Berhasil hanya kalau sebagian besar kolom borang
 * ketemu judulnya — kalau tidak, hasilnya akan asal-asalan dan lebih baik
 * diserahkan ke model.
 */
function tabelDariMatriks(matriks: string[][], kolom: KolomTabel[]): HasilTabel | null {
  const peta = cariPeta(matriks, kolom);
  const cukup = peta.cocok >= Math.max(2, Math.ceil(kolom.length * 0.6));
  if (!cukup) return null;

  const baris: Record<string, string>[] = [];
  const catatan: string[] = [];
  let kosongBerturut = 0;

  for (let r = peta.barisJudul + 1; r < matriks.length; r++) {
    const sumber = matriks[r] || [];
    const isi: Record<string, string> = {};
    kolom.forEach((k) => {
      const c = peta.indeks[k.id];
      const mentah = c === undefined ? "" : (sumber[c] ?? "");
      isi[k.id] = k.jenis === "rupiah" ? keRupiahBersih(mentah)
        : k.jenis === "tanggal" ? keTanggalIso(mentah)
          : String(mentah).replace(/\s+/g, " ").trim();
    });

    if (Object.values(isi).every((v) => !v)) {
      // dua baris kosong berturut-turut biasanya tanda tabelnya sudah habis
      if (++kosongBerturut >= 2 && baris.length) break;
      continue;
    }
    kosongBerturut = 0;

    const teksGabung = kolom.filter((k) => k.jenis === "teks").map((k) => isi[k.id]).join(" ");
    if (BARIS_REKAP.test(teksGabung)) { catatan.push(`Baris rekap dilewati: “${teksGabung.slice(0, 40)}”.`); continue; }
    baris.push(isi);
  }

  if (!baris.length) return null;
  const takKetemu = kolom.filter((k) => peta.indeks[k.id] === undefined).map((k) => k.label);
  if (takKetemu.length) catatan.push(`Kolom ${takKetemu.join(", ")} tak ditemukan judulnya di berkas — isi sendiri.`);
  return { baris, catatan };
}

/**
 * Apakah hasil baca-langsung ini layak dipakai?
 *
 * Berkas nyata sering memakai judul bertingkat dan sel gabungan. Pencocokan
 * judul kolom tetap "berhasil" di berkas seperti itu, tapi hasilnya kacau:
 * baris nomor kolom ikut terbaca sebagai data, dan nilai sel gabungan terulang
 * di banyak baris. Lebih baik hasil begitu dibuang dan berkasnya diserahkan ke
 * AI daripada ditempelkan ke surat.
 */
function hasilMasukAkal(baris: Record<string, string>[], kolom: KolomTabel[]): boolean {
  const rupiah = kolom.filter((k) => k.jenis === "rupiah");
  if (!rupiah.length || baris.length < 2) return true;

  const berisi = baris.filter((r) => rupiah.some((k) => keAngka(r[k.id]) > 0));
  if (berisi.length < baris.length * 0.6) return false;         // terlalu banyak baris tanpa angka

  // nilai sel gabungan yang terulang: satu angka yang sama di seperempat baris
  for (const k of rupiah) {
    const nilai = berisi.map((r) => keAngka(r[k.id])).filter((n) => n > 0);
    const hitung = new Map<number, number>();
    nilai.forEach((n) => hitung.set(n, (hitung.get(n) || 0) + 1));
    const terbanyak = Math.max(0, ...Array.from(hitung.values()));
    if (nilai.length >= 6 && terbanyak > nilai.length * 0.25) return false;
  }
  return true;
}

interface HasilTabel { baris: Record<string, string>[]; catatan: string[] }

/** matriks -> teks bertab, bahan untuk model kalau judulnya tak terbaca */
const matriksKeTeks = (m: string[][]) =>
  m.map((r) => r.map((s) => (s ?? "").replace(/\t/g, " ")).join("\t")).filter((b) => b.trim()).join("\n");

/* ══════════════════════════════════════════════════════════════════════════
   2. PDF — lapisan teks dulu, gambar belakangan
   ══════════════════════════════════════════════════════════════════════════ */

const muatPdf = (file: File) => bukaPdf(file);

/**
 * Teks PDF disusun ulang per baris memakai koordinat y, dan jarak antar-potong
 * yang lebar diganti tab. Tanpa itu, satu baris tabel akan menempel jadi satu
 * kalimat dan angkanya tak lagi jelas milik kolom mana.
 */
async function teksPdf(dok: any, lapor: (k: Kemajuan) => void): Promise<string> {
  const halaman: string[] = [];
  for (let i = 1; i <= dok.numPages; i++) {
    lapor({ tahap: `Membaca teks halaman ${i}/${dok.numPages}…`, persen: Math.round((i / dok.numPages) * 100) });
    const hal = await dok.getPage(i);
    const isi = await hal.getTextContent();
    const baris = new Map<number, { x: number; lebar: number; t: string }[]>();
    isi.items.forEach((it: any) => {
      const t = String(it.str ?? "");
      if (!t.trim()) return;
      const y = Math.round(it.transform[5] / 3) * 3;   // toleransi beda tinggi kecil
      if (!baris.has(y)) baris.set(y, []);
      baris.get(y)!.push({ x: it.transform[4], lebar: it.width || t.length * 4.5, t });
    });
    const urut = Array.from(baris.entries()).sort((a, b) => b[0] - a[0]);
    halaman.push(urut.map(([, potong]) => {
      const p = potong.sort((a, b) => a.x - b.x);
      /**
       * Jarak antar-potong yang menentukan sambungannya. Judul surat yang
       * dirapikan (justified) datang sebagai potongan PER HURUF, jadi menyisipkan
       * spasi di setiap sambungan akan mengubah "Surat Edaran" jadi
       * "S u r a t  E d a r a n" — dan angka pun ikut terpecah.
       */
      let keluar = "";
      let xAkhir = -1;
      p.forEach((s, idx) => {
        const jarak = s.x - xAkhir;
        if (idx && jarak > 12) keluar += "\t";                       // beda kolom
        else if (idx && jarak > 1.2 && !/\s$/.test(keluar) && !/^\s/.test(s.t)) keluar += " ";
        keluar += s.t;
        xAkhir = s.x + s.lebar;
      });
      return keluar;
    }).join("\n"));
  }
  return halaman.join("\n\n");
}

/**
 * Buang baris yang sebetulnya kop surat itu sendiri.
 *
 * Membaca daftar surat rujukan dari sebuah SURAT membuat model kerap ikut
 * memasukkan nomor surat yang sedang dibaca sebagai baris pertama. Nomornya ada
 * di kepala dokumen, jadi bisa dikenali dan dibuang tanpa menebak-nebak.
 */
function buangKopSurat(baris: Record<string, string>[], teks: string): { baris: Record<string, string>[]; dibuang: number } {
  const kepala = teks.split("\n").slice(0, 6).join("\n");
  const nomorSendiri = Array.from(kepala.matchAll(/Nomor\s*:?\s*([A-Z]{2,}[A-Z0-9./\-]{6,})/gi))
    .map((m) => m[1].toUpperCase().replace(/\s/g, ""));
  if (!nomorSendiri.length) return { baris, dibuang: 0 };
  const sisa = baris.filter((r) =>
    !Object.values(r).some((v) => nomorSendiri.includes(String(v).toUpperCase().replace(/\s/g, ""))));
  return { baris: sisa, dibuang: baris.length - sisa.length };
}

async function gambarPdf(dok: any, lapor: (k: Kemajuan) => void, maksHal = 8): Promise<string[]> {
  const keluar: string[] = [];
  const n = Math.min(dok.numPages, maksHal);
  for (let i = 1; i <= n; i++) {
    lapor({ tahap: `Menyiapkan gambar halaman ${i}/${n}…`, persen: Math.round((i / n) * 100) });
    const hal = await dok.getPage(i);
    const vp = hal.getViewport({ scale: 2 });
    const kanvas = document.createElement("canvas");
    kanvas.width = Math.floor(vp.width); kanvas.height = Math.floor(vp.height);
    await hal.render({ canvasContext: kanvas.getContext("2d")!, viewport: vp }).promise;
    keluar.push(kanvas.toDataURL("image/jpeg", 0.85).split(",")[1] || "");
  }
  return keluar;
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Gambar
   ══════════════════════════════════════════════════════════════════════════ */

/** foto kamera bisa 12 MP — dikecilkan supaya muat dikirim dan tetap terbaca */
async function gambarKeBase64(file: File, maksSisi = 2200): Promise<{ base64: string; mime: string }> {
  try {
    const bmp = await createImageBitmap(file);
    const skala = Math.min(1, maksSisi / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * skala), h = Math.round(bmp.height * skala);
    const kanvas = document.createElement("canvas");
    kanvas.width = w; kanvas.height = h;
    const ctx = kanvas.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return { base64: kanvas.toDataURL("image/jpeg", 0.88).split(",")[1] || "", mime: "image/jpeg" };
  } catch {
    // format yang tak bisa digambar peramban (mis. HEIC di sebagian mesin):
    // kirim apa adanya, biar modelnya yang mencoba
    const base64 = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1] || "");
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    return { base64, mime: file.type || "image/jpeg" };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   4. Mesin AI: Gemini (server) lalu Ollama (laptop)
   ══════════════════════════════════════════════════════════════════════════ */

class BelumSiap extends Error {}

async function keGemini(badan: any): Promise<HasilTabel> {
  const r = await fetch("/api/surat/baca-tabel", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badan),
  });
  if (r.status === 501) throw new BelumSiap("GEMINI_API_KEY belum diset");
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `server ${r.status}`);
  const d = await r.json();
  return { baris: d.baris || [], catatan: d.catatan || [] };
}

const VISION_RE = /(vision|llava|minicpm-?v|moondream|bakllava|qwen2\.?5?-?vl|qwen2-vl|gemma3)/i;

/** "qwen2.5vl:7b" -> 7; dipakai untuk memilih model terbesar yang ada */
const ukuranModel = (nama: string) => Number(/:(\d+(?:\.\d+)?)\s*b/i.exec(nama)?.[1] || 0);

async function modelOllama(perluVisi: boolean): Promise<string> {
  let r: Response;
  try {
    r = await fetch(`${ollamaHost()}/api/tags`, { cache: "no-store" });
  } catch (e: any) {
    /**
     * Kegagalan di sini WAJIB diterjemahkan, bukan dilempar apa adanya.
     *
     * fetch yang gagal menyambung hanya berkata "Failed to fetch", dan pesan itu
     * naik sampai ke layar tanpa menyebut Ollama sama sekali — pemakainya
     * mengira berkasnya yang gagal diambil. Sebab yang paling sering: halaman
     * dibuka lewat https (Vercel) sedangkan Ollama melayani http di laptop,
     * dan peramban memang melarang sambungan seperti itu.
     */
    const https = typeof location !== "undefined" && location.protocol === "https:";
    throw new BelumSiap(
      https
        ? `AI lokal tak bisa dihubungi dari halaman https (${ollamaHost()}). Peramban melarang halaman aman memanggil alamat http. Pakai AI cloud, atau buka aplikasi ini dari laptop tempat Ollama berjalan.`
        : `Ollama tak menjawab di ${ollamaHost()} (${e?.message || e}). Pastikan Ollama sedang berjalan.`,
    );
  }
  if (!r.ok) throw new BelumSiap(`Ollama menjawab ${r.status}`);
  const daftar: string[] = ((await r.json()).models || []).map((m: any) => m.name);
  /**
   * Model terbesar yang cocok, bukan yang kebetulan pertama di daftar. Beda
   * 3b dan 7b sangat terasa: yang kecil kerap mengembalikan kop surat sebagai
   * baris data. Untuk teks, model biasa didahulukan daripada model bervisi.
   */
  const urut = (a: string[]) => a.sort((x, y) => ukuranModel(y) - ukuranModel(x));
  const layak = daftar.filter((m) => !/embed/i.test(m));
  const bervisi = urut(layak.filter((m) => VISION_RE.test(m)));
  const biasa = urut(layak.filter((m) => !VISION_RE.test(m)));
  const pilih = perluVisi ? bervisi[0] : (biasa[0] || bervisi[0]);
  if (!pilih) {
    throw new BelumSiap(perluVisi
      ? "Tak ada model bervisi di Ollama. Jalankan: ollama pull qwen2.5vl:7b"
      : "Tak ada model di Ollama. Jalankan: ollama pull qwen2.5:7b");
  }
  return pilih;
}

/**
 * Ollama LEWAT SERVER. Dipakai saat aplikasi dijalankan di laptop yang sama
 * dengan Ollama: yang menghubungi 127.0.0.1 adalah servernya, jadi izin asal
 * (CORS) tidak pernah jadi soal — cukup Ollama menyala.
 */
async function keOllamaServer(badan: any): Promise<HasilTabel> {
  const r = await fetch("/api/surat/baca-tabel-ollama", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badan),
  });
  if (r.status === 501) throw new BelumSiap((await r.json().catch(() => ({}))).error || "Ollama tak terjangkau dari server");
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `server ${r.status}`);
  const d = await r.json();
  return { baris: d.baris || [], catatan: d.catatan || [] };
}

/** Ollama LANGSUNG DARI PERAMBAN. Dipakai saat aplikasi dibuka dari Vercel. */
async function keOllamaPeramban(perintah: string, gambar: string[] | undefined, kolom: KolomTabel[]): Promise<HasilTabel> {
  const model = await modelOllama(!!gambar?.length);
  let r: Response;
  try {
    r = await fetch(`${ollamaHost()}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model, prompt: perintah, images: gambar, stream: false,
        format: "json", options: { temperature: 0, num_ctx: 16384 },
      }),
    });
  } catch (e: any) {
    // gagal sebelum ada balasan = Ollama menolak asal situsnya, atau tak menyala
    throw new BelumSiap(`Peramban tak bisa menghubungi Ollama di ${ollamaHost()} (${e?.message || e}). ${PETUNJUK_ORIGIN}`);
  }
  if (r.status === 403) throw new BelumSiap(`Ollama menolak permintaan dari halaman ini (403). ${PETUNJUK_ORIGIN}`);
  if (!r.ok) throw new Error(`Ollama ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return rapikanBaris(extractJson(d.response || ""), kolom);
}

export const PETUNJUK_ORIGIN =
  "Izinkan asal situsnya di Ollama: setx OLLAMA_ORIGINS \"*\" lalu tutup Ollama dari baki sistem dan buka lagi.";

export type PilihanMesin = "otomatis" | "ollama" | "gemini";

/** satu potong sumber (teks atau satu gambar) -> baris */
async function bacaSatu(
  kolom: KolomTabel[], konteks: string,
  sumber: { teks?: string; gambar?: { base64: string; mime: string } },
  pilihan: PilihanMesin = "otomatis",
): Promise<{ hasil: HasilTabel; mesin: Mesin }> {
  const mode = sumber.gambar ? "gambar" : "teks";
  const badan = { mode, teks: sumber.teks, gambar: sumber.gambar, kolom, konteks };
  const sebab: string[] = [];

  /** urutan mesin: yang dipilih pengguna lebih dulu, sisanya jadi cadangan */
  const urutan: ("gemini" | "ollama")[] =
    pilihan === "ollama" ? ["ollama", "gemini"]
      : pilihan === "gemini" ? ["gemini", "ollama"]
        : ["gemini", "ollama"];

  for (const mesin of urutan) {
    if (mesin === "gemini") {
      try {
        return { hasil: await keGemini(badan), mesin: mode === "gambar" ? "gemini-gambar" : "gemini-teks" };
      } catch (e) {
        if (!(e instanceof BelumSiap)) throw e;
        sebab.push(`AI cloud: ${(e as Error).message}`);
      }
      continue;
    }

    // Ollama: server dulu (tanpa CORS), baru peramban (saat dibuka dari Vercel)
    try {
      return { hasil: await keOllamaServer(badan), mesin: mode === "gambar" ? "ollama-gambar" : "ollama-teks" };
    } catch (e) {
      if (!(e instanceof BelumSiap)) throw e;
      sebab.push(`Ollama lewat server: ${(e as Error).message}`);
    }
    try {
      const perintah = promptTabel(kolom, konteks, mode)
        + (sumber.teks ? `\n\nISI BERKAS:\n${sumber.teks.slice(0, 60_000)}` : "");
      const hasil = await keOllamaPeramban(perintah, sumber.gambar ? [sumber.gambar.base64] : undefined, kolom);
      return { hasil, mesin: mode === "gambar" ? "ollama-gambar" : "ollama-teks" };
    } catch (e) {
      if (!(e instanceof BelumSiap)) throw e;
      sebab.push((e as Error).message);
    }
  }

  throw new TakAdaMesin(`Belum ada mesin pembaca yang siap.\n• ${sebab.join("\n• ")}`);
}

/* ══════════════════════════════════════════════════════════════════════════
   5. Pintu masuk
   ══════════════════════════════════════════════════════════════════════════ */

export interface OpsiBaca {
  /** mesin AI yang didahulukan; "otomatis" = cloud dulu, lalu Ollama */
  mesin?: PilihanMesin;
  /** lewati pembacaan langsung Excel dan langsung serahkan ke AI */
  paksaAI?: boolean;
}

export async function bacaBerkasTabel(
  file: File,
  kolom: KolomTabel[],
  konteks = "",
  lapor: (k: Kemajuan) => void = () => {},
  opsi: OpsiBaca = {},
): Promise<HasilBaca> {
  const ext = ekstensi(file.name);
  const catatan: string[] = [];
  const pilihan = opsi.mesin || "otomatis";

  // ── Excel / CSV ────────────────────────────────────────────────────────
  if (["xlsx", "xls", "csv"].includes(ext)) {
    lapor({ tahap: "Membuka berkas…" });
    const lembar = urutkanLembar(await lembarSpreadsheet(file));
    const banyakLembar = lembar.length > 1;

    if (!opsi.paksaAI) {
      // bentuk baku "Kontrol Biaya Docking" dulu — paling tepat karena dikenali utuh
      for (const l of lembar) {
        const blok = tabelBlokMA(l.matriks, kolom);
        if (blok) {
          if (banyakLembar) blok.catatan.push(`Dibaca dari lembar “${l.nama}”.`);
          return { ...blok, mesin: "berkas" };
        }
      }
      for (const l of lembar) {
        const langsung = tabelDariMatriks(l.matriks, kolom);
        if (!langsung) continue;
        if (hasilMasukAkal(langsung.baris, kolom)) {
          if (banyakLembar) langsung.catatan.push(`Dibaca dari lembar “${l.nama}”.`);
          return { ...langsung, mesin: "berkas" };
        }
        catatan.push(`Lembar “${l.nama}” terbaca kacau (judul bertingkat / sel gabungan), jadi dibuang.`);
      }
      if (!catatan.length) catatan.push("Judul kolom di berkas tidak dikenali, jadi isinya dibaca AI.");
    }

    lapor({ tahap: "Menyerahkan isi berkas ke AI…" });
    // lembar yang paling menjanjikan saja yang dikirim: satu berkas bisa ribuan baris
    const pilihLembar = lembar[0];
    if (banyakLembar) catatan.push(`Yang dikirim ke AI hanya lembar “${pilihLembar.nama}”.`);
    const { hasil, mesin } = await bacaSatu(kolom, konteks, { teks: matriksKeTeks(pilihLembar.matriks) }, pilihan);
    return { baris: hasil.baris, mesin, catatan: [...catatan, ...hasil.catatan] };
  }

  // ── PDF ────────────────────────────────────────────────────────────────
  if (ext === "pdf") {
    lapor({ tahap: "Membuka PDF…" });
    const dok = await muatPdf(file);
    const teks = await teksPdf(dok, lapor);
    if (teks.replace(/\s/g, "").length >= 200) {
      lapor({ tahap: "Menyusun tabel dari teks PDF…" });
      const { hasil, mesin } = await bacaSatu(kolom, konteks, { teks }, pilihan);
      const bersihKop = buangKopSurat(hasil.baris, teks);
      if (bersihKop.dibuang) catatan.push(`${bersihKop.dibuang} baris dibuang karena isinya kop surat berkas itu sendiri.`);
      if (bersihKop.baris.length) return { baris: bersihKop.baris, mesin, catatan: [...catatan, ...hasil.catatan] };
      catatan.push("Teks PDF tidak menghasilkan baris — halamannya dibaca sebagai gambar.");
    } else {
      catatan.push("PDF ini hasil pindaian (tanpa lapisan teks), jadi dibaca sebagai gambar.");
    }

    const gambar = await gambarPdf(dok, lapor);
    if (dok.numPages > gambar.length) catatan.push(`Hanya ${gambar.length} halaman pertama yang dibaca dari ${dok.numPages}.`);
    const semua: Record<string, string>[] = [];
    let mesinDipakai: Mesin = "gemini-gambar";
    for (let i = 0; i < gambar.length; i++) {
      lapor({ tahap: `Membaca halaman ${i + 1}/${gambar.length}…`, persen: Math.round(((i + 1) / gambar.length) * 100) });
      const { hasil, mesin } = await bacaSatu(kolom, konteks, { gambar: { base64: gambar[i], mime: "image/jpeg" } }, pilihan);
      semua.push(...hasil.baris);
      catatan.push(...hasil.catatan);
      mesinDipakai = mesin;
    }
    return { baris: semua, mesin: mesinDipakai, catatan };
  }

  // ── gambar / foto ──────────────────────────────────────────────────────
  lapor({ tahap: "Menyiapkan gambar…" });
  const gambar = await gambarKeBase64(file);
  lapor({ tahap: "Membaca gambar…" });
  const { hasil, mesin } = await bacaSatu(kolom, konteks, { gambar }, pilihan);
  return { baris: hasil.baris, mesin, catatan: [...catatan, ...hasil.catatan] };
}

export interface KesiapanMesin {
  gemini: boolean;
  /** model Ollama yang akan dipakai, kosong bila tak terjangkau */
  ollama: string;
  ollamaVisi: string;
  /** lewat mana Ollama terjangkau */
  jalur: "server" | "peramban" | "";
  host: string;
  galat: string;
}

/** dipakai layar untuk memberi tahu mesin mana yang siap sebelum berkas dipilih */
export async function periksaMesin(): Promise<KesiapanMesin> {
  let gemini = false;
  try { gemini = !!(await (await fetch("/api/surat/baca-tabel", { cache: "no-store" })).json()).siap; } catch { /* server tak menjawab */ }

  // 1) lewat server — berlaku saat aplikasi dijalankan di laptop
  try {
    const d = await (await fetch("/api/surat/baca-tabel-ollama", { cache: "no-store" })).json();
    if (d?.siap && d.model) {
      return { gemini, ollama: d.model, ollamaVisi: d.modelVisi || "", jalur: "server", host: d.host || "", galat: "" };
    }
  } catch { /* rute tak ada / server tak menjawab */ }

  // 2) langsung dari peramban — berlaku saat aplikasi dibuka dari Vercel
  try {
    const model = await modelOllama(false);
    let visi = "";
    try { visi = await modelOllama(true); } catch { /* belum ada model bervisi */ }
    return { gemini, ollama: model, ollamaVisi: visi, jalur: "peramban", host: ollamaHost(), galat: "" };
  } catch (e: any) {
    return { gemini, ollama: "", ollamaVisi: "", jalur: "", host: ollamaHost(), galat: e?.message || "Ollama tak terjangkau" };
  }
}

export { ollamaHost, setOllamaHost } from "@/lib/sppbj/scanAI";
