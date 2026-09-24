/**
 * Daftar pengingat untuk lonceng di sidebar.
 *
 * Lonceng terpasang di layout, jadi ia hidup di SETIAP halaman untuk SETIAP
 * pemakai dan menarik ulang tiap menit. Sebelumnya penarikan itu langsung ke
 * Supabase dari peramban, mengambil payload utuh tujuh kind sekaligus:
 * 1 MB sekali tarik, hanya untuk menghasilkan belasan baris pengingat.
 *
 * Satu orang membuka aplikasi delapan jam = 480 tarikan = ~480 MB sehari.
 * Itulah yang menghabiskan kuota Fast Origin Transfer Vercel pada 24 September
 * 2026 dan mem-pause seluruh situs.
 *
 * Sekarang penyusunannya di sini, dan yang menyeberang ke peramban hanya
 * hasilnya - beberapa kilobyte. Ditambah dua penahan:
 *
 *   s-maxage: CDN menjawab sendiri selama satu menit, fungsi tidak dipanggil.
 *   ETag: bila isinya tidak berubah, dibalas 304 tanpa badan sama sekali.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbServer } from "@/lib/dbServer";
import { KINDS, susun } from "@/lib/pengingat/susun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sidik(isi: unknown): string {
  const t = JSON.stringify(isi);
  let a = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    a ^= t.charCodeAt(i);
    a = Math.imul(a, 0x01000193);
  }
  return `W/"${(a >>> 0).toString(16)}-${t.length.toString(16)}"`;
}

export async function GET(req: NextRequest) {
  try {
    const c = dbServer();
    if (!c) return NextResponse.json({ ok: false, list: [], error: "Supabase belum siap" });

    const { data, error } = await c
      .from("projects").select("id,payload")
      .or(KINDS.map((k) => `payload->>kind.eq.${k}`).join(","));
    if (error) throw error;

    /*
     * Payload kiriman kapal membawa token pengirim. Token itu tidak ada
     * gunanya bagi lonceng dan tidak boleh ikut menyeberang ke peramban,
     * apalagi mengendap di localStorage komputer kantor.
     */
    const rows = (data || [])
      .map((r: { id: string; payload: Record<string, unknown> | null }) => {
        if (!r.payload) return null;
        const { token: _token, ...sisa } = r.payload;
        return { ...sisa, __rowId: r.id };
      })
      .filter(Boolean) as Record<string, unknown>[];

    const list = susun(rows);
    const etag = sidik(list);
    const kepala = {
      "Cache-Control": "private, s-maxage=60, stale-while-revalidate=120",
      ETag: etag,
    };
    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: kepala });
    }
    return NextResponse.json({ ok: true, list }, { headers: kepala });
  } catch (e: unknown) {
    const pesan = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, list: [], error: pesan }, { status: 500 });
  }
}
