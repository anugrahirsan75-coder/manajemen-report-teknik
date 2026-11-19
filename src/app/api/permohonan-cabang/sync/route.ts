import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Relay Monitoring Permohonan Cabang ke spreadsheet "Kontrol Permohonan Ternate 2026"
// lewat Apps Script webhook REKAP yang sama (env REKAP_GAS_URL + REKAP_GAS_SECRET).
//   { permohonan: BarisSheet[] } -> tulis/ubah baris (kunci = kolom ID APLIKASI)
//   { tarik: true }               -> baca semua baris spreadsheet
// Apps Script versi lama tidak mengenal kedua perintah ini; jawabannya tanpa
// kunci `permohonan` sehingga dilaporkan sebagai "belum diperbarui".
export async function POST(req: NextRequest) {
  const url = process.env.REKAP_GAS_URL;
  const secret = process.env.REKAP_GAS_SECRET || "";
  if (!url) return NextResponse.json({ error: "REKAP_GAS_URL belum diset (deploy Apps Script dulu)" }, { status: 501 });
  try {
    const body = await req.json();
    const tarik = body?.tarik === true;
    const permohonan = Array.isArray(body?.permohonan) ? body.permohonan.slice(0, 500) : [];
    if (!tarik && !permohonan.length) return NextResponse.json({ error: "data kosong" }, { status: 400 });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tarik ? { secret, tarikPermohonan: true } : { secret, permohonan }),
      redirect: "follow", // Apps Script /exec membalas lewat redirect
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = null; }
    if (!data) return NextResponse.json({ error: `Apps Script ${res.status}: jawaban bukan JSON` }, { status: 502 });
    if (!res.ok || data.ok === false) {
      return NextResponse.json({ error: data.error || `Apps Script ${res.status}` }, { status: 502 });
    }
    if (!data.permohonan) {
      return NextResponse.json({
        error: "Apps Script belum diperbarui ke versi yang mengenal Kontrol Permohonan — tempel kode terbaru lalu Deploy → Kelola deployment → Versi baru.",
      }, { status: 409 });
    }
    const p = data.permohonan;
    return NextResponse.json({
      ok: true,
      sheetUrl: p.url || "",
      hasil: Array.isArray(p.hasil) ? p.hasil : [],
      baris: Array.isArray(p.baris) ? p.baris : [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "gagal" }, { status: 500 });
  }
}
