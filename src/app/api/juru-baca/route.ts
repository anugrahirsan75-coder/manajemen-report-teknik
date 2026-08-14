import { NextResponse } from "next/server";
import { putaranServer, statusTerakhir } from "@/lib/lapor/juruBacaServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** satu putaran bisa membaca puluhan berkas; batas ini hanya berlaku di awan */
export const maxDuration = 300;

/**
 * Kendali Juru Baca sisi server.
 *
 * GET  — keadaan terakhir di server ini (kosong di Vercel, karena di sana ia
 *        memang tidak dijadwalkan).
 * POST — jalankan satu putaran sekarang juga. Dipakai tombol "Periksa berkas
 *        baru" saat aplikasi dibuka dari laptop, dan oleh Scheduled Task bila
 *        suatu saat ingin dipicu dari luar.
 *
 * Route ini ada di balik login (middleware), jadi tak bisa dipicu orang luar.
 */
export async function GET() {
  return NextResponse.json({ ok: true, status: statusTerakhir(), lokal: !process.env.VERCEL });
}

export async function POST() {
  if (process.env.VERCEL) {
    return NextResponse.json({
      ok: false,
      error: "Server ini di awan, tak bisa menjangkau Ollama di laptop. Pembacaan dikerjakan server lokal (port 3001).",
    }, { status: 501 });
  }
  const status = await putaranServer();
  return NextResponse.json({ ok: true, status });
}
