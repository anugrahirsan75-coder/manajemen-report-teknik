import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// AI Vision (Google Gemini, free tier) untuk baca tabel screenshot -> JSON akurat.
// Butuh env GEMINI_API_KEY. Tanpa key -> 501 (client fallback ke OCR lokal tesseract).
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const PROMPT = `Kamu mengekstrak tabel item pengadaan kapal (Bahasa Indonesia) dari sebuah gambar/screenshot Excel.
Kolom tabel biasanya: No | Jumlah (qty) | Satuan | Nama Barang | Spesifikasi | Harga Satuan | Jumlah (total).
Aturan:
- Baris nama kapal (mis. "KMP. GORANGO" / "KMP GORANGO") = field "kapal" untuk SEMUA item di bawahnya sampai ketemu kapal lain.
- Baris sub-judul tanpa nomor sebelum item (mis. "MERK : CUMMINS", "MODEL : 6 BT5.9-GM83", "POWER : 113 HP, 1500 RPM", "ME, Merk : ...") = "keterangan" (header di ATAS item) — gabung beberapa baris dengan newline, taruh di item PERTAMA grup itu.
- Baris bernomor = satu item: jumlah (angka), satuan, nama (Nama Barang), spesifikasi (kolom Spesifikasi, mis. part number), harga (Harga Satuan, angka polos tanpa titik).
- Baris tanpa nomor SETELAH sebuah item (rincian seperti "a.Pompa", "Merk : EBARA", "Type : ...") = masuk array "breakdown" item tsb.
- "harga" = angka integer rupiah TANPA pemisah ribuan (mis. 1110000). Jika ragu, hitung dari kolom total / jumlah.
- Jangan mengarang. Kalau sel kosong, kosongkan ("").
Keluarkan HANYA JSON valid (tanpa teks lain) bentuk:
{"items":[{"kapal":"","keterangan":"","jumlah":1,"satuan":"","nama":"","spesifikasi":"","harga":0,"breakdown":[]}]}`;

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY belum diset" }, { status: 501 });
  try {
    const { imageBase64, mime } = (await req.json()) as { imageBase64: string; mime: string };
    if (!imageBase64) return NextResponse.json({ error: "gambar kosong" }, { status: 400 });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    const body = {
      contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime || "image/png", data: imageBase64 } }] }],
      generationConfig: { temperature: 0, response_mime_type: "application/json", maxOutputTokens: 8192 },
    };
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `Gemini ${res.status}: ${txt.slice(0, 200)}` }, { status: 502 });
    }
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
    const clean = text.replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(clean); } catch { return NextResponse.json({ error: "AI tak balas JSON valid" }, { status: 502 }); }
    const items = (parsed.items || parsed || []).map((r: any) => ({
      kapal: String(r.kapal || "").trim(),
      keterangan: String(r.keterangan || "").trim() || undefined,
      jumlah: Number(r.jumlah) || 1,
      satuan: String(r.satuan || "unit").trim() || "unit",
      nama: String(r.nama || "").trim(),
      spesifikasi: String(r.spesifikasi || "").trim(),
      harga: Math.round(Number(String(r.harga).replace(/[^\d]/g, "")) || 0),
      breakdown: Array.isArray(r.breakdown) ? r.breakdown.map((b: any) => String(b).trim()).filter(Boolean) : undefined,
    })).filter((r: any) => r.nama || r.kapal);
    return NextResponse.json({ items, engine: "ai" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "gagal" }, { status: 500 });
  }
}
