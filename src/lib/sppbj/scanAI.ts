"use client";
import { ParsedItem } from "./ocrTable";
import { SCAN_PROMPT, extractJson, normalizeItems } from "./scanPrompt";

const toBase64 = (file: Blob): Promise<{ base64: string; mime: string }> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); const base64 = s.split(",")[1] || ""; res({ base64, mime: file.type || "image/png" }); };
    r.onerror = rej;
    r.readAsDataURL(file);
  });

export class NoAIKeyError extends Error {}     // Gemini key belum diset
export class NoOllamaError extends Error {}     // Ollama tak terjangkau / tak ada model vision


async function postScan(endpoint: string, file: Blob): Promise<ParsedItem[]> {
  const { base64, mime } = await toBase64(file);
  const res = await fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mime }),
  });
  if (res.status === 501) {
    const e = await res.json().catch(() => ({}));
    if (endpoint.includes("ollama")) throw new NoOllamaError(e.error || "Ollama tak siap");
    throw new NoAIKeyError(e.error || "AI key belum diset");
  }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `${res.status}`); }
  const data = await res.json();
  return (data.items || []) as ParsedItem[];
}

/** Gemini cloud. Lempar NoAIKeyError bila key belum diset. */
export const scanWithAI = (file: Blob) => postScan("/api/sppbj/scan-ai", file);

// ─────────────────────────────────────────────────────────────────────────────
// Ollama: dua jalur, isi gambarnya tetap tidak pernah keluar dari laptop.
//
//   1. LEWAT SERVER — dipakai saat aplikasi dijalankan di laptop itu sendiri
//      (localhost). Route /api/sppbj/scan-ollama yang menghubungi Ollama.
//   2. LANGSUNG DARI PERAMBAN — dipakai saat aplikasi dibuka dari Vercel.
//      Server Vercel jelas tak bisa menjangkau Ollama di laptop, tapi PERAMBAN
//      di laptop itu bisa. Jadi gambarnya dikirim dari tab ke 127.0.0.1, tidak
//      menyentuh Vercel sama sekali.
//
// Jalur 2 menuntut Ollama mengizinkan asal (origin) situsnya — bawaan Ollama
// hanya menerima localhost, selain itu dijawab 403. Lihat docs/OLLAMA.md.
// ─────────────────────────────────────────────────────────────────────────────

const LS_HOST = "ollama_host";
export const ollamaHost = () => {
  try { return (localStorage.getItem(LS_HOST) || "").replace(/\/$/, "") || "http://127.0.0.1:11434"; }
  catch { return "http://127.0.0.1:11434"; }
};
export const setOllamaHost = (v: string) => { try { localStorage.setItem(LS_HOST, v.replace(/\/$/, "")); } catch {} };

const VISION_RE = /(vision|llava|minicpm-?v|moondream|bakllava|qwen2\.?5?-?vl|qwen2-vl|gemma3)/i;
const pilihVision = (models: string[]) => models.find((m) => VISION_RE.test(m)) || "";

/** tanya Ollama langsung dari peramban — dipakai saat aplikasi dibuka dari Vercel */
async function tagsLangsung(): Promise<string[]> {
  const r = await fetch(`${ollamaHost()}/api/tags`, { cache: "no-store" });
  if (!r.ok) throw new Error("Ollama menjawab " + r.status);
  const d = await r.json();
  return (d.models || []).map((m: any) => m.name as string);
}

async function scanLangsung(file: Blob): Promise<ParsedItem[]> {
  const model = pilihVision(await tagsLangsung());
  if (!model) throw new NoOllamaError("Tak ada model vision di Ollama. Jalankan: ollama pull qwen2.5vl:7b");
  const { base64 } = await toBase64(file);
  const r = await fetch(`${ollamaHost()}/api/generate`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model, prompt: SCAN_PROMPT, images: [base64], stream: false,
      format: "json", options: { temperature: 0, num_ctx: 8192 },
    }),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return normalizeItems(extractJson(d.response || "")) as ParsedItem[];
}

/** jalur yang terakhir berhasil dipakai — ditampilkan di layar supaya jelas */
export let jalurOllama: "server" | "peramban" | "" = "";

/**
 * Ollama lokal. Coba lewat server dulu (kalau app dijalankan di laptop),
 * kalau tak terjangkau baru peramban yang menghubungi Ollama sendiri.
 */
export async function scanWithOllama(file: Blob): Promise<ParsedItem[]> {
  try {
    const hasil = await postScan("/api/sppbj/scan-ollama", file);
    jalurOllama = "server";
    return hasil;
  } catch (e) {
    if (!(e instanceof NoOllamaError)) throw e;
    const hasil = await scanLangsung(file);   // lempar apa adanya bila gagal juga
    jalurOllama = "peramban";
    return hasil;
  }
}

/** Cek apakah Ollama + model vision tersedia (utk pilih default engine). */
export async function probeOllama(): Promise<{ available: boolean; model: string; jalur: "server" | "peramban" | "" }> {
  try {
    const r = await fetch("/api/sppbj/scan-ollama", { cache: "no-store" });
    const d = await r.json();
    if (d.available && d.hasVision) return { available: true, model: d.model || "", jalur: "server" };
  } catch { /* aplikasi tak dijalankan di laptop — coba jalur peramban */ }
  try {
    const model = pilihVision(await tagsLangsung());
    if (model) return { available: true, model, jalur: "peramban" };
  } catch { /* Ollama mati / belum diizinkan */ }
  return { available: false, model: "", jalur: "" };
}
