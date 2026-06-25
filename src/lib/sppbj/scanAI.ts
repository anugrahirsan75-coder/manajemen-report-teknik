"use client";
import { ParsedItem } from "./ocrTable";

const toBase64 = (file: Blob): Promise<{ base64: string; mime: string }> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); const base64 = s.split(",")[1] || ""; res({ base64, mime: file.type || "image/png" }); };
    r.onerror = rej;
    r.readAsDataURL(file);
  });

export class NoAIKeyError extends Error {}

/** Baca tabel via AI Vision (server Gemini). Lempar NoAIKeyError bila key belum diset (501). */
export async function scanWithAI(file: Blob): Promise<ParsedItem[]> {
  const { base64, mime } = await toBase64(file);
  const res = await fetch("/api/sppbj/scan-ai", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mime }),
  });
  if (res.status === 501) throw new NoAIKeyError("AI key belum diset");
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `AI ${res.status}`); }
  const data = await res.json();
  return (data.items || []) as ParsedItem[];
}
