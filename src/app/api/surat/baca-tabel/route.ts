import { NextRequest, NextResponse } from "next/server";
import { extractJson } from "@/lib/sppbj/scanPrompt";
import { promptTabel, rapikanBaris } from "@/lib/surat/bacaSkema";
import { KolomTabel } from "@/lib/surat/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Membaca tabel dari berkas (gambar hasil pindaian, atau teks yang sudah
 * diambil di peramban dari Excel/PDF) menjadi baris borang surat.
 *
 * Kolom yang diminta dikirim dari halaman, jadi satu route ini melayani semua
 * template surat — tabel mata anggaran docking, daftar surat dasar IO, rincian
 * per kapal, dan tabel apa pun yang ditambahkan nanti.
 *
 * Tanpa GEMINI_API_KEY route menjawab 501; halaman lalu mencoba Ollama lokal.
 */
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const adaKunci = () => !!process.env.GEMINI_API_KEY;

export async function GET() {
  return NextResponse.json({ siap: adaKunci(), model: adaKunci() ? MODEL : "" });
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY belum diset" }, { status: 501 });

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

    const perintah = promptTabel(kolom, konteks || "", mode === "gambar" ? "gambar" : "teks");
    const parts: any[] = [{ text: perintah }];
    if (mode === "gambar") {
      if (!gambar?.base64) return NextResponse.json({ error: "gambar kosong" }, { status: 400 });
      parts.push({ inline_data: { mime_type: gambar.mime || "image/png", data: gambar.base64 } });
    } else {
      if (!teks?.trim()) return NextResponse.json({ error: "teks kosong" }, { status: 400 });
      parts.push({ text: `\n\nISI BERKAS:\n${teks.slice(0, 120_000)}` });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0, response_mime_type: "application/json", maxOutputTokens: 8192 },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ error: `Gemini ${res.status}: ${t.slice(0, 200)}` }, { status: 502 });
    }

    const data = await res.json();
    const balasan: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
    const json = extractJson(balasan);
    if (!json) return NextResponse.json({ error: "AI tak membalas JSON valid" }, { status: 502 });

    const hasil = rapikanBaris(json, kolom);
    return NextResponse.json({ ...hasil, mesin: mode === "gambar" ? "gemini-gambar" : "gemini-teks" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "gagal" }, { status: 500 });
  }
}
