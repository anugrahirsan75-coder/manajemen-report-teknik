/**
 * Simpanan suntingan Rekap Dokumentasi — di laptop, bukan di awan.
 *
 * Diminta begitu: basis datanya cukup di laptop sendiri. Suntingan ditulis ke
 * satu berkas JSON di dalam folder proyek, jadi tidak ada yang keluar ke
 * Supabase maupun Google Drive. Konsekuensinya jujur disebut ke layar: kalau
 * aplikasi ini dijalankan di Vercel, cakramnya hanya-baca dan penyimpanan
 * jatuh ke simpanan peramban.
 */
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BERKAS = path.join(process.cwd(), "data", "dokumentasi-ubahan.json");

async function baca(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await fs.readFile(BERKAS, "utf8"));
  } catch {
    return {};                       // belum pernah disimpan
  }
}

export async function GET() {
  return NextResponse.json({ ubahan: await baca(), berkas: BERKAS });
}

export async function POST(req: Request) {
  let isi: any;
  try {
    isi = await req.json();
  } catch {
    return NextResponse.json({ galat: "Isi permintaan bukan JSON." }, { status: 400 });
  }
  const ubahan = isi?.ubahan;
  if (!ubahan || typeof ubahan !== "object" || Array.isArray(ubahan)) {
    return NextResponse.json({ galat: "Medan 'ubahan' harus objek." }, { status: 400 });
  }
  try {
    await fs.mkdir(path.dirname(BERKAS), { recursive: true });
    // tulis ke berkas sementara lalu ganti nama: kalau proses mati di tengah
    // penulisan, berkas lama tetap utuh dan suntingan lama tidak hilang
    const tmp = BERKAS + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(ubahan, null, 1), "utf8");
    await fs.rename(tmp, BERKAS);
    return NextResponse.json({ ok: true, jumlah: Object.keys(ubahan).length, berkas: BERKAS });
  } catch (e: any) {
    return NextResponse.json(
      { galat: e?.message || String(e), berkas: BERKAS }, { status: 500 });
  }
}
