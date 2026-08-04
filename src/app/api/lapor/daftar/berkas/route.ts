/**
 * Hapus satu dokumen kiriman dari Google Drive dan rekap internal.
 * Route berada di bawah /api/lapor/daftar, sehingga tetap dilindungi login.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { BerkasLapor } from "@/lib/lapor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY_SB = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function DELETE(req: NextRequest) {
  const gasUrl = process.env.LAPOR_GAS_URL;
  const gasSecret = process.env.LAPOR_GAS_SECRET || "";
  if (!gasUrl) {
    return NextResponse.json({ ok: false, error: "Penyimpanan Google Drive belum aktif." }, { status: 501 });
  }
  if (!URL_SB || !KEY_SB) {
    return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  }

  const { id, fileId } = await req.json().catch(() => ({} as Record<string, string>));
  if (!id || !fileId || String(fileId).length > 200) {
    return NextResponse.json({ ok: false, error: "Dokumen tidak dikenali" }, { status: 400 });
  }

  const c = createClient(URL_SB, KEY_SB);
  const { data: ada, error: e1 } = await c.from("projects").select("payload").eq("id", id).single();
  if (e1 || !ada) {
    return NextResponse.json({ ok: false, error: "Kiriman tidak ditemukan" }, { status: 404 });
  }
  const p: any = ada.payload || {};
  if (p.kind !== "lapor_kapal") {
    return NextResponse.json({ ok: false, error: "Bukan kiriman kapal" }, { status: 400 });
  }
  const berkasTercatat = (Array.isArray(p.berkas) ? p.berkas : []) as BerkasLapor[];
  if (!berkasTercatat.some((f) => f.fileId === fileId)) {
    return NextResponse.json({ ok: false, error: "Dokumen tidak tercatat pada kiriman ini" }, { status: 404 });
  }

  // Apps Script memverifikasi file masih berada di bawah ROOT_FOLDER_ID sebelum
  // memindahkannya ke Sampah. fileId dari klien tidak pernah langsung dipercaya.
  try {
    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: gasSecret, aksi: "hapus", fileId }),
      redirect: "follow",
      cache: "no-store",
    });
    const teks = await res.text();
    let hasil: any;
    try { hasil = JSON.parse(teks); } catch { hasil = { ok: false, error: teks.slice(0, 200) }; }
    if (!res.ok || hasil?.ok !== true) {
      const versiLama = hasil?.error === "berkas kosong";
      return NextResponse.json({
        ok: false,
        error: versiLama
          ? "Fitur hapus Google Drive belum aktif. Deploy ulang Apps Script dari docs/lapor-apps-script.gs."
          : hasil?.error || `Google Drive menolak (${res.status})`,
      }, { status: 502 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Gagal menghubungi Google Drive" }, { status: 502 });
  }

  // Ambil payload paling baru setelah operasi Drive agar unggahan yang mungkin
  // masuk bersamaan tidak tertimpa oleh salinan payload lama.
  const { data: terbaru, error: e2 } = await c.from("projects").select("payload").eq("id", id).single();
  if (e2 || !terbaru) {
    return NextResponse.json({ ok: false, error: "Dokumen terhapus dari Drive, tetapi rekap gagal diperbarui. Coba lagi." }, { status: 500 });
  }
  const payloadTerbaru: any = terbaru.payload || {};
  const berkas = ((Array.isArray(payloadTerbaru.berkas) ? payloadTerbaru.berkas : []) as BerkasLapor[])
    .filter((f) => f.fileId !== fileId);
  const { error: e3 } = await c.from("projects").update({ payload: { ...payloadTerbaru, berkas } }).eq("id", id);
  if (e3) {
    return NextResponse.json({ ok: false, error: "Dokumen terhapus dari Drive, tetapi rekap gagal diperbarui. Coba lagi." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, berkas });
}
