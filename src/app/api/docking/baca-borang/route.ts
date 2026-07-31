/**
 * Baca satu halaman borang kapal (TF-102.01.01 Daftar Pekerjaan Docking /
 * HP-103.00.01 Permintaan Pengadaan) memakai model bervisi di Ollama lokal.
 *
 * Route ini hanya terpakai bila aplikasi dijalankan di laptop yang sama dengan
 * Ollama. Saat aplikasi dibuka dari Vercel, perambanlah yang menghubungi Ollama
 * sendiri (lihat src/lib/docking/rencana/bacaBorang.ts) — gambarnya tidak
 * pernah menyentuh server.
 */
import { NextRequest, NextResponse } from "next/server";
import { extractJson } from "@/lib/sppbj/scanPrompt";
import { PROMPT_BORANG } from "@/lib/docking/rencana/borang";

export const runtime = "nodejs";
export const maxDuration = 300;

const HOST = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
const ENV_MODEL = process.env.OLLAMA_VISION_MODEL || "";
const VISION_RE = /(vision|llava|minicpm-?v|moondream|bakllava|qwen2\.?5?-?vl|qwen2-vl|gemma3)/i;

async function daftarModel(): Promise<string[]> {
  const r = await fetch(`${HOST}/api/tags`, { cache: "no-store" });
  if (!r.ok) throw new Error("tags " + r.status);
  return ((await r.json()).models || []).map((m: any) => m.name as string);
}
const pilihVision = (m: string[]) => ENV_MODEL || m.find((x) => VISION_RE.test(x)) || "";

export async function GET() {
  try {
    const models = await daftarModel();
    const model = pilihVision(models);
    return NextResponse.json({ available: true, host: HOST, model, hasVision: !!model, models });
  } catch (e: any) {
    return NextResponse.json({ available: false, host: HOST, error: e?.message || "Ollama tak terjangkau" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = (await req.json()) as { imageBase64: string };
    if (!imageBase64) return NextResponse.json({ error: "gambar kosong" }, { status: 400 });

    let model = ENV_MODEL;
    if (!model) {
      try { model = pilihVision(await daftarModel()); }
      catch { return NextResponse.json({ error: "Ollama tak terjangkau" }, { status: 501 }); }
    }
    if (!model) return NextResponse.json({ error: "Tak ada model vision. Jalankan: ollama pull qwen2.5vl:7b" }, { status: 501 });

    const res = await fetch(`${HOST}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model, prompt: PROMPT_BORANG, images: [imageBase64], stream: false,
        format: "json", options: { temperature: 0, num_ctx: 8192 },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ error: `Ollama ${res.status}: ${t.slice(0, 200)}` }, { status: 502 });
    }
    const d = await res.json();
    return NextResponse.json({ hasil: extractJson(d.response || ""), model });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "gagal membaca" }, { status: 500 });
  }
}
