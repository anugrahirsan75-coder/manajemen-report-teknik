import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Relay ke Apps Script Web App (webhook) yg menulis ke spreadsheet REKAP PJK KAPAL PERBULAN.
// Butuh env: REKAP_GAS_URL (URL /exec Apps Script) + REKAP_GAS_SECRET (token cocok dgn script).
// Tanpa env -> 501 (fitur belum aktif).
export async function POST(req: NextRequest) {
  const url = process.env.REKAP_GAS_URL;
  const secret = process.env.REKAP_GAS_SECRET || "";
  if (!url) return NextResponse.json({ error: "REKAP_GAS_URL belum diset (deploy Apps Script dulu)" }, { status: 501 });
  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows) || !rows.length) return NextResponse.json({ error: "rows kosong" }, { status: 400 });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, rows }),
      redirect: "follow", // Apps Script /exec balas via redirect
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
    if (!res.ok || data?.ok === false) {
      return NextResponse.json({ error: data?.error || `Apps Script ${res.status}`, detail: data }, { status: 502 });
    }
    return NextResponse.json({ ok: true, results: data.results || data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "gagal" }, { status: 500 });
  }
}
