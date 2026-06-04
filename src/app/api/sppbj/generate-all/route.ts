import { NextRequest, NextResponse } from "next/server";
import PizZip from "pizzip";
import { SppbjRequest, kapalUnik } from "@/lib/sppbj/types";
import { fillFase1, fillBstb, fillBapp } from "@/lib/sppbj/fill2";

export const runtime = "nodejs";
export const maxDuration = 120;
const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim();

export async function POST(req: NextRequest) {
  try {
    const { req: data } = (await req.json()) as { req: SppbjRequest };
    const folder = safe(`${data.namaPengadaan} ${data.tanggal}`).slice(0, 80);
    const zip = new PizZip();

    zip.file(`${folder}/01 SPPBJ + KAK + FORMAT SAP.xlsx`, fillFase1(data));
    if (data.status !== "menunggu_spbj") {
      for (const kapal of kapalUnik(data.items)) {
        zip.file(`${folder}/BSTB - ${safe(kapal)}.xlsx`, fillBstb(data, kapal));
      }
      zip.file(`${folder}/BAPP.xlsx`, fillBapp(data));
    }

    const out = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
    const name = safe(`Pengadaan ${data.namaPengadaan} ${data.tanggal}`).slice(0, 90) + ".zip";
    return new NextResponse(out as any, {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"` },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
