import { NextRequest, NextResponse } from "next/server";
import { extractJson } from "@/lib/sppbj/scanPrompt";
import { promptTabel, rapikanBaris } from "@/lib/surat/bacaSkema";
import { KolomTabel } from "@/lib/surat/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Membaca tabel lewat Ollama DI SISI SERVER.
 *
 * Jalur ini yang dipakai saat aplikasi dijalankan di laptop yang sama dengan
 * Ollama: servernya bicara ke 127.0.0.1 langsung, jadi tidak ada urusan izin
 * asal (CORS) sama sekali — cukup Ollama menyala. Saat aplikasi dibuka dari
 * Vercel, server jelas tak bisa menjangkau laptop; route ini menjawab 501 dan
 * halaman beralih menghubungi Ollama sendiri dari peramban.
 */
const HOST = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
const VISION_RE = /(vision|llava|minicpm-?v|moondream|bakllava|qwen2\.?5?-?vl|qwen2-vl|gemma3)/i;

const ukuranModel = (nama: string) => Number(/:(\d+(?:\.\d+)?)\s*b/i.exec(nama)?.[1] || 0);

async function daftarModel(): Promise<string[]> {
  const r = await fetch(`${HOST}/api/tags`, { cache: "no-store" });
  if (!r.ok) throw new Error(`tags ${r.status}`);
  return ((await r.json()).models || []).map((m: any) => m.name as string);
}

/** model terbesar yang cocok; untuk teks, model biasa didahulukan */
function pilihModel(semua: string[], perluVisi: boolean): string {
  const paksa = perluVisi ? process.env.OLLAMA_VISION_MODEL : process.env.OLLAMA_TEXT_MODEL;
  if (paksa) return paksa;
  const urut = (a: string[]) => a.sort((x, y) => ukuranModel(y) - ukuranModel(x));
  const layak = semua.filter((m) => !/embed/i.test(m));
  const bervisi = urut(layak.filter((m) => VISION_RE.test(m)));
  const biasa = urut(layak.filter((m) => !VISION_RE.test(m)));
  return perluVisi ? bervisi[0] || "" : biasa[0] || bervisi[0] || "";
}

export async function GET() {
  try {
    const semua = await daftarModel();
    return NextResponse.json({
      siap: true, host: HOST, model: pilihModel(semua, false),
      modelVisi: pilihModel(semua, true), models: semua,
    });
  } catch (e: any) {
    return NextResponse.json({ siap: false, host: HOST, error: e?.message || "Ollama tak terjangkau" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { mode, teks, gambar, kolom, konteks } = (await req.json()) as {
      mode: "teks" | "gambar";
      teks?: string;
      gambar?: { base64: string; mime: string };
      kolom: KolomTabel[];
      konteks?: string;
    };
    if (!Array.isArray(kolom) || !kolom.length) {
      return NextResponse.json({ error: "skema kolom kosong" }, { status: 400 });
    }

    const perluVisi = mode === "gambar";
    let model = "";
    try { model = pilihModel(await daftarModel(), perluVisi); }
    catch { return NextResponse.json({ error: "Ollama tak terjangkau dari server" }, { status: 501 }); }
    if (!model) {
      return NextResponse.json({
        error: perluVisi
          ? "Tak ada model bervisi di Ollama. Jalankan: ollama pull qwen2.5vl:7b"
          : "Tak ada model di Ollama. Jalankan: ollama pull qwen2.5:7b",
      }, { status: 501 });
    }

    const perintah = promptTabel(kolom, konteks || "", perluVisi ? "gambar" : "teks")
      + (teks ? `\n\nISI BERKAS:\n${teks.slice(0, 60_000)}` : "");

    const r = await fetch(`${HOST}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model, prompt: perintah, images: gambar?.base64 ? [gambar.base64] : undefined,
        stream: false, format: "json", options: { temperature: 0, num_ctx: 16384 },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ error: `Ollama ${r.status}: ${t.slice(0, 200)}` }, { status: 502 });
    }
    const d = await r.json();
    const json = extractJson(d?.response || "");
    if (!json) return NextResponse.json({ error: "Model tak membalas JSON valid" }, { status: 502 });

    const hasil = rapikanBaris(json, kolom);
    return NextResponse.json({ ...hasil, mesin: perluVisi ? "ollama-gambar" : "ollama-teks", model });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "gagal" }, { status: 500 });
  }
}
