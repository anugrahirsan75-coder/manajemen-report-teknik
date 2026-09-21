/**
 * Keadaan dan pengelolaan gambar tanda tangan.
 *
 * GET    — apakah gambarnya ada, dan dari mana asalnya. Yang dikembalikan
 *          hanya ADA atau TIDAK; gambarnya sendiri tidak pernah keluar lewat
 *          route ini. Layar perlu tahu ini supaya pilihan membubuhkan tidak
 *          ditawarkan saat gambarnya belum ada — kalau tidak, pemakai
 *          mencentangnya, dokumen terbit polos, dan tak ada yang memberi tahu
 *          kenapa.
 * POST   — unggah satu gambar ke brankas tersandi (lihat ttdBrankas.ts).
 * DELETE — buang satu gambar dari brankas.
 *
 * Route ini berada di balik gerbang login kantor (middleware). Gerbang itu
 * yang menahan orang luar; di sini yang diperiksa adalah bentuk berkasnya.
 */
import { NextRequest, NextResponse } from "next/server";
import { folderTtd, statusTtd } from "@/lib/material/ttdSumber";
import {
  BATAS_GAMBAR, PeranTtd, brankasSiap, hapusDariBrankas, jenisGambar, simpanKeBrankas,
} from "@/lib/material/ttdBrankas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERAN: PeranTtd[] = ["deptHead", "stafTeknik", "stempel"];
const sahPeran = (v: unknown): v is PeranTtd => PERAN.includes(v as PeranTtd);

export async function GET() {
  return NextResponse.json({
    ...(await statusTtd()),
    folder: folderTtd(),
    diAwan: !!process.env.VERCEL,
  });
}

export async function POST(req: NextRequest) {
  if (!brankasSiap()) {
    return NextResponse.json(
      { ok: false, error: "Brankas belum bisa dipakai: AUTH_TOKEN atau sambungan basis data belum siap." },
      { status: 503 });
  }

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ ok: false, error: "Kiriman tidak terbaca" }, { status: 400 }); }

  const peran = String(form.get("peran") || "");
  if (!sahPeran(peran)) return NextResponse.json({ ok: false, error: "Peran tanda tangan tidak dikenal" }, { status: 400 });

  const berkas = form.get("berkas");
  if (!(berkas instanceof File)) return NextResponse.json({ ok: false, error: "Gambar belum dipilih" }, { status: 400 });
  if (berkas.size > BATAS_GAMBAR) {
    return NextResponse.json(
      { ok: false, error: `Gambar terlalu besar (${Math.round(berkas.size / 1024)} KB). Batasnya ${Math.round(BATAS_GAMBAR / 1024)} KB.` },
      { status: 413 });
  }

  const buf = Buffer.from(await berkas.arrayBuffer());
  const jenis = jenisGambar(buf);
  if (!jenis) {
    return NextResponse.json(
      { ok: false, error: "Berkasnya bukan PNG atau JPEG. PNG berlatar tembus pandang paling rapi hasilnya." },
      { status: 415 });
  }

  try {
    await simpanKeBrankas(peran, buf, jenis, String(form.get("oleh") || "") || undefined);
  } catch (e: any) {
    console.error("material/ttd unggah:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Gambar gagal disimpan. Coba lagi." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...(await statusTtd()) });
}

export async function DELETE(req: NextRequest) {
  const peran = new URL(req.url).searchParams.get("peran") || "";
  if (!sahPeran(peran)) return NextResponse.json({ ok: false, error: "Peran tanda tangan tidak dikenal" }, { status: 400 });
  try { await hapusDariBrankas(peran); }
  catch (e: any) {
    console.error("material/ttd hapus:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Gambar gagal dihapus. Coba lagi." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...(await statusTtd()) });
}
