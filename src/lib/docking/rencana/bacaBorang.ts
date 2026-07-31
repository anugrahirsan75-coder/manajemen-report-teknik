"use client";
/**
 * Membaca berkas permintaan kapal (PDF pindaian / foto) menjadi baris-baris
 * yang bisa dipakai menyusun Repair List.
 *
 * Alurnya: PDF diubah jadi gambar per halaman DI PERAMBAN, lalu tiap halaman
 * dibaca model bervisi di Ollama. Dua jalur seperti pemindai SPPBJ:
 * lewat server (saat aplikasi dijalankan di laptop) atau langsung dari peramban
 * (saat aplikasi dibuka dari Vercel). Dua-duanya berakhir di 127.0.0.1 — isi
 * dokumennya tidak keluar dari laptop.
 */
import { extractJson } from "@/lib/sppbj/scanPrompt";
import { ollamaHost } from "@/lib/sppbj/scanAI";
import { PROMPT_BORANG, HasilBorang, rapikanBorang, gabungHalaman } from "./borang";

export class OllamaBelumSiap extends Error {}

const VISION_RE = /(vision|llava|minicpm-?v|moondream|bakllava|qwen2\.?5?-?vl|qwen2-vl|gemma3)/i;

/** PDF -> gambar PNG per halaman, dikerjakan di peramban (pdf.js) */
export async function halamanPdf(file: Blob, skala = 2): Promise<string[]> {
  const pdfjs: any = await import("pdfjs-dist");
  // worker-nya disalin ke /public saat pemasangan (scripts/salin-pdf-worker.cjs)
  // — sengaja bukan dari CDN luar, supaya berkas kapal tetap tak menyentuh internet
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const buf = await file.arrayBuffer();
  const dok = await pdfjs.getDocument({ data: buf }).promise;
  const out: string[] = [];
  for (let i = 1; i <= dok.numPages; i++) {
    const hal = await dok.getPage(i);
    const vp = hal.getViewport({ scale: skala });
    const kanvas = document.createElement("canvas");
    kanvas.width = Math.floor(vp.width); kanvas.height = Math.floor(vp.height);
    const ctx = kanvas.getContext("2d")!;
    await hal.render({ canvasContext: ctx, viewport: vp }).promise;
    out.push(kanvas.toDataURL("image/png").split(",")[1] || "");
  }
  return out;
}

/** gambar apa pun (foto/JPG/PNG) -> base64 tanpa kepala data-url */
export const gambarKeBase64 = (file: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] || "");
    r.onerror = rej;
    r.readAsDataURL(file);
  });

async function bacaLewatServer(base64: string, model?: string): Promise<any> {
  const r = await fetch("/api/docking/baca-borang", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, model }),
  });
  if (r.status === 501) throw new OllamaBelumSiap((await r.json().catch(() => ({}))).error || "Ollama belum siap");
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `server ${r.status}`);
  return (await r.json()).hasil;
}

async function bacaLangsung(base64: string, minta?: string): Promise<any> {
  const t = await fetch(`${ollamaHost()}/api/tags`, { cache: "no-store" });
  if (!t.ok) throw new OllamaBelumSiap("Ollama tak terjangkau dari peramban");
  const ada: string[] = ((await t.json()).models || []).map((m: any) => String(m.name));
  const model = (minta && ada.includes(minta)) ? minta : ada.find((m) => VISION_RE.test(m));
  if (!model) throw new OllamaBelumSiap("Tak ada model vision. Jalankan: ollama pull qwen2.5vl:7b");
  const r = await fetch(`${ollamaHost()}/api/generate`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model, prompt: PROMPT_BORANG, images: [base64], stream: false,
      format: "json", options: { temperature: 0, num_ctx: 8192, num_predict: 4096 },
    }),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status}`);
  return extractJson((await r.json()).response || "");
}

/** jalur yang dipakai terakhir — ditampilkan supaya jelas ke mana gambarnya pergi */
export let jalurBaca: "server" | "peramban" | "" = "";

async function bacaSatu(base64: string, model?: string): Promise<any> {
  try { const h = await bacaLewatServer(base64, model); jalurBaca = "server"; return h; }
  catch (e) {
    if (!(e instanceof OllamaBelumSiap)) throw e;
    const h = await bacaLangsung(base64, model); jalurBaca = "peramban"; return h;
  }
}

export interface KemajuanBaca { halaman: number; total: number; }

/**
 * Model bervisi yang dipakai.
 *   teliti — qwen2.5vl:7b, bacaannya paling tepat. Bobotnya 6 GB, lebih besar
 *            dari memori kartu grafis, jadi sebagian jalan di prosesor:
 *            ± 9 menit per halaman.
 *   cepat  — qwen2.5vl:3b, muat penuh di kartu grafis (± 20 detik per halaman),
 *            cukup untuk Daftar Pekerjaan Docking, tapi sering keliru pada
 *            borang Permintaan Pengadaan yang berkolom banyak.
 */
export const MODEL_BACA = { teliti: "qwen2.5vl:7b", cepat: "qwen2.5vl:3b" } as const;
export type PilihModel = keyof typeof MODEL_BACA;

/**
 * Baca satu berkas (PDF berhalaman banyak atau satu gambar) sampai selesai.
 * Halaman dibaca satu per satu — model bervisi memakan memori kartu grafis,
 * membaca serentak justru membuat laptop tersendat.
 */
export async function bacaBorang(
  file: File,
  onMaju?: (k: KemajuanBaca) => void,
  opsi: { model?: PilihModel; dari?: number; sampai?: number } = {},
): Promise<HasilBorang> {
  const pdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
  let gambar = pdf ? await halamanPdf(file) : [await gambarKeBase64(file)];
  // rentang halaman: berkas RL kerap berisi lampiran/foto yang tak perlu dibaca
  const dari = Math.max(1, opsi.dari || 1);
  const sampai = Math.min(gambar.length, opsi.sampai || gambar.length);
  const geser = dari - 1;
  gambar = gambar.slice(geser, sampai);
  const nama = MODEL_BACA[opsi.model || "teliti"];
  const hasil: HasilBorang[] = [];
  for (let i = 0; i < gambar.length; i++) {
    onMaju?.({ halaman: i + 1 + geser, total: sampai });
    try { hasil.push(rapikanBorang(await bacaSatu(gambar[i], nama), i + 1 + geser)); }
    catch (e) {
      if (e instanceof OllamaBelumSiap && i === 0) throw e;   // gagal sejak awal -> hentikan
      // halaman yang gagal dilewati; sisanya tetap dibaca supaya kerja tak hangus
      hasil.push({ jenis: "", kapal: "", noSurat: "", tanggal: "", baris: [] });
    }
  }
  return gabungHalaman(hasil);
}
