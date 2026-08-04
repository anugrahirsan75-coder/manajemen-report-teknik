/**
 * Unggah SATU berkas kiriman ke Google Drive pemilik, lalu tempelkan tautannya
 * ke catatan kiriman.
 *
 * Berkas dilempar ke Apps Script (docs/lapor-apps-script.gs) yang menulis ke
 * folder Drive. Supabase hanya menerima catatan kecil: nama, ukuran, id & URL
 * Drive. Dengan begitu penyimpanan Supabase tidak ikut terpakai sama sekali.
 *
 * Terbuka tanpa login, tapi berkas hanya bisa menempel ke kiriman yang
 * tokennya cocok — token itu baru dibuat di /api/lapor/kirim dan hanya ada di
 * peramban pengirim.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { lajuTerlampaui, ipDari } from "@/lib/lapor/laju";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY_SB = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** jenis berkas yang diterima — di luar ini ditolak sebelum menyentuh Drive */
const MIME_SAH = new Set([
  "application/pdf",
  "image/jpeg", "image/png", "image/webp", "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const BATAS_BYTE = 12 * 1024 * 1024;
const MAKS_BERKAS = 12;

export async function POST(req: NextRequest) {
  const gasUrl = process.env.LAPOR_GAS_URL;
  const gasSecret = process.env.LAPOR_GAS_SECRET || "";
  if (!gasUrl) {
    return NextResponse.json(
      { ok: false, error: "Penyimpanan berkas belum aktif. Deploy Apps Script lalu isi LAPOR_GAS_URL (lihat docs/lapor-apps-script.gs)." },
      { status: 501 });
  }
  if (!URL_SB || !KEY_SB) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  if (lajuTerlampaui(`berkas:${ipDari(req)}`, 60)) {
    return NextResponse.json({ ok: false, error: "Terlalu banyak unggahan. Coba lagi beberapa menit." }, { status: 429 });
  }

  const b = await req.json().catch(() => ({} as any));
  const { id, token, nama, mime, dataBase64 } = b as Record<string, string>;
  if (!id || !token) return NextResponse.json({ ok: false, error: "Kiriman tidak dikenali" }, { status: 400 });
  if (!dataBase64) return NextResponse.json({ ok: false, error: "Berkas kosong" }, { status: 400 });
  if (!MIME_SAH.has(String(mime))) {
    return NextResponse.json({ ok: false, error: "Jenis berkas tidak didukung (pakai PDF, foto, Word, atau Excel)" }, { status: 400 });
  }
  const ukuran = Math.round(dataBase64.length * 0.75);
  if (ukuran > BATAS_BYTE) {
    return NextResponse.json({ ok: false, error: "Berkas lebih dari 12 MB" }, { status: 413 });
  }

  const c = createClient(URL_SB, KEY_SB);
  const { data: ada, error: e1 } = await c.from("projects").select("payload").eq("id", id).single();
  if (e1 || !ada) return NextResponse.json({ ok: false, error: "Kiriman tidak ditemukan" }, { status: 404 });
  const p: any = ada.payload || {};
  if (p.kind !== "lapor_kapal" || p.token !== token) {
    return NextResponse.json({ ok: false, error: "Kiriman tidak dikenali" }, { status: 403 });
  }
  if ((p.berkas || []).length >= MAKS_BERKAS) {
    return NextResponse.json({ ok: false, error: `Maksimal ${MAKS_BERKAS} berkas per kiriman` }, { status: 400 });
  }

  // ── kirim ke Drive lewat Apps Script ──────────────────────────────────────
  let hasil: any;
  try {
    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: gasSecret,
        kapal: p.kapal, jenis: p.jenis, periode: p.periode,
        catatan: `${p.pengirim || ""}${p.jabatan ? ` (${p.jabatan})` : ""}`,
        namaBerkas: nama || "berkas", mime, dataBase64,
      }),
      redirect: "follow", // Apps Script /exec menjawab lewat redirect
    });
    const t = await res.text();
    try { hasil = JSON.parse(t); } catch { hasil = { ok: false, error: t.slice(0, 200) }; }
    if (!res.ok || hasil?.ok === false) {
      return NextResponse.json({ ok: false, error: hasil?.error || `Google Drive menolak (${res.status})` }, { status: 502 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Gagal menghubungi Google Drive" }, { status: 502 });
  }

  // ── catat tautannya (bukan berkasnya) ─────────────────────────────────────
  const berkas = [...(p.berkas || []), {
    nama: hasil.nama || nama, mime, ukuran: hasil.ukuran || ukuran,
    fileId: hasil.fileId, url: hasil.url, diunggahPada: new Date().toISOString(),
  }];
  const { error: e2 } = await c.from("projects").update({ payload: { ...p, berkas } }).eq("id", id);
  if (e2) return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });

  return NextResponse.json({ ok: true, berkas: berkas[berkas.length - 1], jumlah: berkas.length });
}
