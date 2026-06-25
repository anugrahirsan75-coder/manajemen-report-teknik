"use client";
import { ParsedItem } from "./ocrTable";

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
/** Ollama lokal. Lempar NoOllamaError bila tak terjangkau / tak ada model vision. */
export const scanWithOllama = (file: Blob) => postScan("/api/sppbj/scan-ollama", file);

/** Cek apakah Ollama + model vision tersedia (utk pilih default engine). */
export async function probeOllama(): Promise<{ available: boolean; model: string }> {
  try {
    const r = await fetch("/api/sppbj/scan-ollama", { cache: "no-store" });
    const d = await r.json();
    return { available: !!d.available && !!d.hasVision, model: d.model || "" };
  } catch { return { available: false, model: "" }; }
}
