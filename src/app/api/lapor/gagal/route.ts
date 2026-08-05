/**
 * Catat sebab kegagalan unggahan pada kirimannya sendiri.
 *
 * Selama ini kiriman yang berkasnya gagal naik hanya tampak sebagai baris
 * kosong di kantor — tidak ada yang tahu apakah sinyalnya putus, berkasnya
 * ditolak, atau Drive yang bermasalah, sehingga ABK disuruh "coba lagi" tanpa
 * arah. Route ini menyimpan pesan galat terakhir supaya sebabnya terlihat.
 *
 * Terbuka tanpa login (dipanggil halaman ABK), tapi hanya bisa menyentuh
 * kiriman yang tokennya cocok, dan hanya menulis satu medan teks pendek.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbLapor, dbSiap } from "@/lib/lapor/db";
import { lajuTerlampaui, ipDari } from "@/lib/lapor/laju";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export async function POST(req: NextRequest) {
  if (!dbSiap()) return NextResponse.json({ ok: false }, { status: 503 });
  if (lajuTerlampaui(`gagal:${ipDari(req)}`, 120)) return NextResponse.json({ ok: false }, { status: 429 });

  const { id, token, pesan } = await req.json().catch(() => ({} as any));
  if (!id || !token) return NextResponse.json({ ok: false }, { status: 400 });

  const c = dbLapor()!;
  const { data: ada } = await c.from("projects").select("payload").eq("id", id).single();
  const p: any = ada?.payload;
  if (!p || p.kind !== "lapor_kapal" || p.token !== token) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const galatUnggah = String(pesan || "").replace(/\s+/g, " ").trim().slice(0, 300);
  const { error } = await c.from("projects")
    .update({ payload: { ...p, galatUnggah, galatPada: new Date().toISOString() } })
    .eq("id", id);
  if (error) {
    console.error("lapor/gagal:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
