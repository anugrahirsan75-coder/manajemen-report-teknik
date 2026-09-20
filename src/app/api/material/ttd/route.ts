/**
 * Keadaan berkas tanda tangan di laptop ini.
 *
 * Layar perlu tahu apakah berkasnya ada sebelum menawarkan pilihan membubuhkan
 * tanda tangan — kalau tidak, pemakai mencentangnya, dokumen terbit tanpa
 * tanda tangan, dan tak ada yang memberi tahu kenapa.
 *
 * Yang dikembalikan hanya ADA atau TIDAK, bukan gambarnya.
 */
import { NextResponse } from "next/server";
import { folderTtd, statusTtd } from "@/lib/material/ttd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ...statusTtd(), folder: folderTtd() });
}
