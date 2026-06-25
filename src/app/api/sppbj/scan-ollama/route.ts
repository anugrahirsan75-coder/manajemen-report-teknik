import { NextRequest, NextResponse } from "next/server";
import { SCAN_PROMPT, normalizeItems, extractJson } from "@/lib/sppbj/scanPrompt";

export const runtime = "nodejs";
export const maxDuration = 300;

// AI Vision LOKAL via Ollama (gratis, privat — gambar tak keluar ke cloud).
// Hanya jalan saat app di-host di mesin yg bisa akses Ollama (lokal). Di Vercel -> tak terjangkau.
const HOST = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
const ENV_MODEL = process.env.OLLAMA_VISION_MODEL || "";
const VISION_RE = /(vision|llava|minicpm-?v|moondream|bakllava|qwen2\.?5?-?vl|qwen2-vl|gemma3)/i;

async function listModels(): Promise<string[]> {
  const r = await fetch(`${HOST}/api/tags`, { cache: "no-store" });
  if (!r.ok) throw new Error("tags " + r.status);
  const d = await r.json();
  return (d.models || []).map((m: any) => m.name as string);
}
const pickVision = (models: string[]) => ENV_MODEL || models.find((m) => VISION_RE.test(m)) || "";

// GET -> cek ketersediaan Ollama + model vision
export async function GET() {
  try {
    const models = await listModels();
    const model = pickVision(models);
    return NextResponse.json({ available: true, host: HOST, model, hasVision: !!model, models });
  } catch (e: any) {
    return NextResponse.json({ available: false, host: HOST, error: e?.message || "Ollama tak terjangkau" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mime } = (await req.json()) as { imageBase64: string; mime: string };
    if (!imageBase64) return NextResponse.json({ error: "gambar kosong" }, { status: 400 });

    let model = ENV_MODEL;
    if (!model) { try { model = pickVision(await listModels()); } catch { return NextResponse.json({ error: "Ollama tak terjangkau" }, { status: 501 }); } }
    if (!model) return NextResponse.json({ error: "Tak ada model vision di Ollama. Jalankan: ollama pull llama3.2-vision" }, { status: 501 });

    const res = await fetch(`${HOST}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: SCAN_PROMPT, images: [imageBase64], stream: false, format: "json", options: { temperature: 0, num_ctx: 8192 } }),
    });
    if (!res.ok) { const t = await res.text(); return NextResponse.json({ error: `Ollama ${res.status}: ${t.slice(0, 200)}` }, { status: 502 }); }
    const data = await res.json();
    const parsed = extractJson(data?.response || "");
    if (!parsed) return NextResponse.json({ error: "Model tak balas JSON valid" }, { status: 502 });
    return NextResponse.json({ items: normalizeItems(parsed), engine: "ollama", model });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "gagal" }, { status: 500 });
  }
}
