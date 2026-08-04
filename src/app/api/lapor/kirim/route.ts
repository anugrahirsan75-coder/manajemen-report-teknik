/**
 * Buka kiriman baru dari halaman terbuka /lapor (ABK kapal, tanpa login).
 *
 * Route ini hanya membuat CATATAN kiriman; berkasnya menyusul satu per satu
 * lewat /api/lapor/berkas. Dipisah supaya berkas besar tidak menumpuk dalam
 * satu permintaan — tiap unggahan berdiri sendiri dan bisa diulang kalau
 * sinyal kapal putus di tengah jalan.
 *
 * Kiriman mengembalikan `token` acak yang hanya dipegang pengirim. Token itu
 * syarat untuk menempelkan berkas ke kiriman, jadi orang lain tidak bisa
 * menyusupkan berkas ke kiriman kapal lain. Token tidak pernah ikut keluar di
 * daftar yang dibaca kantor.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { JENIS_LAPOR } from "@/lib/lapor/types";
import { lajuTerlampaui, ipDari } from "@/lib/lapor/laju";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY_SB = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const teks = (v: any, maks: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, maks);

export async function POST(req: NextRequest) {
  if (!URL_SB || !KEY_SB) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  if (lajuTerlampaui(ipDari(req), 15)) {
    return NextResponse.json(
      { ok: false, error: "Terlalu banyak kiriman dari perangkat ini. Coba lagi beberapa menit." },
      { status: 429 });
  }

  const b = await req.json().catch(() => ({} as any));

  const kapal = teks(b.kapal, 60);
  if (!KAPAL_ANGGARAN.includes(kapal)) {
    return NextResponse.json({ ok: false, error: "Kapal tidak dikenali" }, { status: 400 });
  }
  const jenis = teks(b.jenis, 40);
  if (!JENIS_LAPOR.some((j) => j.id === jenis)) {
    return NextResponse.json({ ok: false, error: "Jenis dokumen tidak dikenali" }, { status: 400 });
  }
  const periode = teks(b.periode, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periode)) {
    return NextResponse.json({ ok: false, error: "Periode harus bulan yang sah" }, { status: 400 });
  }
  const pengirim = teks(b.pengirim, 60);
  if (pengirim.length < 3) {
    return NextResponse.json({ ok: false, error: "Nama pengirim wajib diisi" }, { status: 400 });
  }

  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  const payload = {
    kind: "lapor_kapal",
    kapal, jenis, periode, pengirim,
    jabatan: teks(b.jabatan, 60),
    kontak: teks(b.kontak, 40),
    catatan: teks(b.catatan, 1000),
    berkas: [] as any[],
    dikirimPada: new Date().toISOString(),
    status: "baru",
    tindakLanjut: "",
    token,
  };

  const c = createClient(URL_SB, KEY_SB);
  const { data, error } = await c.from("projects")
    .insert({ nama_kapal: kapal, tahun: +periode.slice(0, 4), payload })
    .select("id").single();
  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message || "Gagal menyimpan" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id, token });
}
