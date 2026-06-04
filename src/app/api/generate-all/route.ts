import { NextRequest, NextResponse } from "next/server";
import PizZip from "pizzip";
import { ProjectData } from "@/lib/types";
import { META, ALL_SLUGS, buildNative, safeBase } from "@/lib/server/build";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { data } = (await req.json()) as { data: ProjectData };
    const zip = new PizZip();
    for (const slug of ALL_SLUGS) {
      const meta = META[slug];
      const buf = await buildNative(slug, data);
      const name = `${safeBase(`${meta.label} ${data.namaKapal} ${data.tahun}`)}.${meta.ext}`;
      zip.file(name, buf);
    }
    const out = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
    const zipName = safeBase(`Swakelola ${data.namaKapal} ${data.tahun}`) + ".zip";
    return new NextResponse(out as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(zipName)}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
