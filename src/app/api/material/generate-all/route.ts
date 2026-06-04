import { NextRequest, NextResponse } from "next/server";
import PizZip from "pizzip";
import { MaterialRequest } from "@/lib/material/types";
import { MATERIAL_FILLERS, MATERIAL_META } from "@/lib/material/fill";

export const runtime = "nodejs";
export const maxDuration = 120;
const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "");

export async function POST(req: NextRequest) {
  try {
    const { req: data } = (await req.json()) as { req: MaterialRequest };
    const zip = new PizZip();
    for (const slug of Object.keys(MATERIAL_FILLERS)) {
      const buf = await MATERIAL_FILLERS[slug](data);
      zip.file(`${safe(MATERIAL_META[slug].label)}.xlsx`, buf);
    }
    const outBuf = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
    const name = safe(`Pengajuan Material ${data.tanggal}`) + ".zip";
    return new NextResponse(outBuf as any, {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"` },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
