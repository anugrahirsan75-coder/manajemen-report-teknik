/**
 * Daftar kiriman Permintaan & Laporan Kapal untuk DI DALAM aplikasi.
 * Route ini ada di balik gerbang login (middleware) — bukan halaman terbuka.
 *
 * Token kiriman sengaja dibuang sebelum data dikirim ke peramban: token itu
 * hanya urusan pengirim saat menempelkan berkas, tidak ada gunanya di kantor
 * dan tidak perlu ikut beredar.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { KirimanLapor, STATUS_LAPOR } from "@/lib/lapor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY_SB = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const sb = () => (URL_SB && KEY_SB ? createClient(URL_SB, KEY_SB) : null);

function keKiriman(row: any): KirimanLapor {
  const p = row.payload || {};
  return {
    id: row.id,
    kapal: p.kapal || row.nama_kapal || "",
    jenis: p.jenis,
    periode: p.periode || "",
    pengirim: p.pengirim || "",
    jabatan: p.jabatan || "",
    kontak: p.kontak || "",
    catatan: p.catatan || "",
    berkas: p.berkas || [],
    dikirimPada: p.dikirimPada || "",
    status: p.status || "baru",
    tindakLanjut: p.tindakLanjut || "",
  };
}

export async function GET() {
  const c = sb();
  if (!c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const { data, error } = await c.from("projects")
    .select("id,nama_kapal,payload")
    .filter("payload->>kind", "eq", "lapor_kapal");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  // terbaru di atas; id sebagai pemutus supaya urutan tidak berubah-ubah
  const baris = (data || []).map(keKiriman).sort((a, b) =>
    (b.dikirimPada || "").localeCompare(a.dikirimPada || "") || a.id.localeCompare(b.id));
  return NextResponse.json({ ok: true, baris });
}

/** ubah status / catatan tindak lanjut — hanya dari dalam aplikasi */
export async function PATCH(req: NextRequest) {
  const c = sb();
  if (!c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const { id, status, tindakLanjut } = await req.json().catch(() => ({} as any));
  if (!id) return NextResponse.json({ ok: false, error: "Kiriman tidak dikenali" }, { status: 400 });

  const { data: ada, error: e1 } = await c.from("projects").select("payload").eq("id", id).single();
  if (e1 || !ada) return NextResponse.json({ ok: false, error: "Kiriman tidak ditemukan" }, { status: 404 });
  const p: any = ada.payload || {};
  if (p.kind !== "lapor_kapal") return NextResponse.json({ ok: false, error: "Bukan kiriman kapal" }, { status: 400 });

  if (typeof status === "string" && STATUS_LAPOR.some((s) => s.id === status)) p.status = status;
  if (typeof tindakLanjut === "string") p.tindakLanjut = tindakLanjut.slice(0, 1000);

  const { error: e2 } = await c.from("projects").update({ payload: p }).eq("id", id);
  if (e2) return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });
  return NextResponse.json({ ok: true, baris: keKiriman({ id, nama_kapal: p.kapal, payload: p }) });
}

/**
 * Hapus catatan kiriman. Berkas di Google Drive TIDAK ikut terhapus — sengaja,
 * supaya salah pencet di sini tidak menghilangkan dokumen asli kapal. Kalau
 * berkasnya memang mau dibuang, hapus langsung dari folder Drive.
 */
export async function DELETE(req: NextRequest) {
  const c = sb();
  if (!c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Kiriman tidak dikenali" }, { status: 400 });
  const { data: ada } = await c.from("projects").select("payload").eq("id", id).single();
  if ((ada?.payload as any)?.kind !== "lapor_kapal") {
    return NextResponse.json({ ok: false, error: "Bukan kiriman kapal" }, { status: 400 });
  }
  const { error } = await c.from("projects").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
