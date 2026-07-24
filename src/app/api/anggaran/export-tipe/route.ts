import { NextRequest, NextResponse } from "next/server";
import { buatExcelTipe, DataTipe } from "@/lib/anggaran/excelTipe";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as DataTipe;
    const buf = await buatExcelTipe(data);
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${(data.judul || "Anggaran").replace(/[^\w\s-]/g, "")}.xlsx"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
