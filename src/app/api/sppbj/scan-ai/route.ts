import { NextRequest, NextResponse } from "next/server";
import { SCAN_PROMPT, normalizeItems, extractJson } from "@/lib/sppbj/scanPrompt";

export const runtime = "nodejs";
export const maxDuration = 60;

// AI Vision (Google Gemini, free tier) untuk baca tabel screenshot -> JSON akurat.
// Butuh env GEMINI_API_KEY. Tanpa key -> 501 (client fallback ke OCR lokal tesseract).
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY belum diset" }, { status: 501 });
  try {
    const { imageBase64, mime } = (await req.json()) as { imageBase64: string; mime: string };
    if (!imageBase64) return NextResponse.json({ error: "gambar kosong" }, { status: 400 });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    const body = {
      contents: [{ parts: [{ text: SCAN_PROMPT }, { inline_data: { mime_type: mime || "image/png", data: imageBase64 } }] }],
      generationConfig: { temperature: 0, response_mime_type: "application/json", maxOutputTokens: 8192 },
    };
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `Gemini ${res.status}: ${txt.slice(0, 200)}` }, { status: 502 });
    }
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
    const parsed = extractJson(text);
    if (!parsed) return NextResponse.json({ error: "AI tak balas JSON valid" }, { status: 502 });
    return NextResponse.json({ items: normalizeItems(parsed), engine: "ai" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "gagal" }, { status: 500 });
  }
}
