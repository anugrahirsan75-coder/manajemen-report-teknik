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

/** seluruh sel jadi matriks teks; sel Excel bertipe angka/tanggal ikut dirapikan */
async function matriksSpreadsheet(file: File): Promise<string[][]> {
  if (ekstensi(file.name) === "csv") return uraiCsv(await file.text());

  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const keluar: string[][] = [];
  wb.eachSheet((ws) => {
    ws.eachRow({ includeEmpty: true }, (row) => {
      const baris: string[] = [];
      row.eachCell({ includeEmpty: true }, (sel, kol) => {
        baris[kol - 1] = selKeTeks(sel.value);
      });
      keluar.push(Array.from(baris, (v) => v ?? ""));
    });
    keluar.push([]);   // pemisah antar-lembar
  });
  return keluar;
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
  const r = await fetch(`${ollamaHost()}/api/tags`, { cache: "no-store" });
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

async function keOllama(perintah: string, gambar: string[] | undefined, kolom: KolomTabel[]): Promise<HasilTabel> {
  const model = await modelOllama(!!gambar?.length);
  const r = await fetch(`${ollamaHost()}/api/generate`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model, prompt: perintah, images: gambar, stream: false,
      format: "json", options: { temperature: 0, num_ctx: 8192 },
    }),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return rapikanBaris(extractJson(d.response || ""), kolom);
}

/** satu potong sumber (teks atau satu gambar) -> baris, dengan urutan mesin tetap */
async function bacaSatu(
  kolom: KolomTabel[], konteks: string,
  sumber: { teks?: string; gambar?: { base64: string; mime: string } },
): Promise<{ hasil: HasilTabel; mesin: Mesin }> {
  const mode = sumber.gambar ? "gambar" : "teks";
  try {
    const hasil = await keGemini({ mode, teks: sumber.teks, gambar: sumber.gambar, kolom, konteks });
    return { hasil, mesin: mode === "gambar" ? "gemini-gambar" : "gemini-teks" };
  } catch (e) {
    if (!(e instanceof BelumSiap)) throw e;
  }
  try {
    const perintah = promptTabel(kolom, konteks, mode)
      + (sumber.teks ? `\n\nISI BERKAS:\n${sumber.teks.slice(0, 40_000)}` : "");
    const hasil = await keOllama(perintah, sumber.gambar ? [sumber.gambar.base64] : undefined, kolom);
    return { hasil, mesin: mode === "gambar" ? "ollama-gambar" : "ollama-teks" };
  } catch (e) {
    if (e instanceof BelumSiap) {
      throw new TakAdaMesin(
        `Belum ada mesin pembaca yang siap (${(e as Error).message}). `
        + "Isi GEMINI_API_KEY di server, atau nyalakan Ollama di laptop.",
      );
    }
    throw e;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   5. Pintu masuk
   ══════════════════════════════════════════════════════════════════════════ */

export async function bacaBerkasTabel(
  file: File,
  kolom: KolomTabel[],
  konteks = "",
  lapor: (k: Kemajuan) => void = () => {},
): Promise<HasilBaca> {
  const ext = ekstensi(file.name);
  const catatan: string[] = [];

  // ── Excel / CSV ────────────────────────────────────────────────────────
  if (["xlsx", "xls", "csv"].includes(ext)) {
    lapor({ tahap: "Membuka berkas…" });
    const matriks = await matriksSpreadsheet(file);
    const langsung = tabelDariMatriks(matriks, kolom);
    if (langsung) return { ...langsung, mesin: "berkas" };

    catatan.push("Judul kolom di berkas tidak dikenali, jadi isinya dibaca AI.");
    lapor({ tahap: "Judul kolom tak dikenali — meminta bantuan AI…" });
    const { hasil, mesin } = await bacaSatu(kolom, konteks, { teks: matriksKeTeks(matriks) });
    return { baris: hasil.baris, mesin, catatan: [...catatan, ...hasil.catatan] };
  }

  // ── PDF ────────────────────────────────────────────────────────────────
  if (ext === "pdf") {
    lapor({ tahap: "Membuka PDF…" });
    const dok = await muatPdf(file);
    const teks = await teksPdf(dok, lapor);
    if (teks.replace(/\s/g, "").length >= 200) {
      lapor({ tahap: "Menyusun tabel dari teks PDF…" });
      const { hasil, mesin } = await bacaSatu(kolom, konteks, { teks });
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
      const { hasil, mesin } = await bacaSatu(kolom, konteks, { gambar: { base64: gambar[i], mime: "image/jpeg" } });
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
  const { hasil, mesin } = await bacaSatu(kolom, konteks, { gambar });
  return { baris: hasil.baris, mesin, catatan: [...catatan, ...hasil.catatan] };
}

/** dipakai layar untuk memberi tahu mesin mana yang siap sebelum berkas dipilih */
export async function periksaMesin(): Promise<{ gemini: boolean; ollama: string }> {
  let gemini = false;
  try { gemini = !!(await (await fetch("/api/surat/baca-tabel", { cache: "no-store" })).json()).siap; } catch { /* server tak menjawab */ }
  let ollama = "";
  try { ollama = await modelOllama(false); } catch { /* Ollama mati */ }
  return { gemini, ollama };
}
