/**
 * Data Monitor Sertifikat Kapal untuk layar di dalam aplikasi.
 *
 * Lembar sumbernya dibaca DI SISI SERVER lalu hasilnya sudah rapi saat sampai
 * ke peramban: berkas .xlsx-nya 1,2 MB dan tidak perlu diunduh ulang oleh tiap
 * pengguna. Hasil bacaan disimpan sebentar (30 menit); tombol muat ulang di
 * layar memaksa baca ulang lewat ?segar=1.
 */
import { NextRequest, NextResponse } from "next/server";
import { ambilSertifikat } from "@/lib/sertifikat/sumber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const segar = req.nextUrl.searchParams.get("segar") === "1";
  try {
    const hasil = await ambilSertifikat(segar);
    return NextResponse.json({ ok: true, ...hasil });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Gagal membaca lembar sertifikat" }, { status: 502 });
  }
}
