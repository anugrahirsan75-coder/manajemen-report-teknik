import { NextRequest, NextResponse } from "next/server";
import { buatExcelAnggaran, DataExport } from "@/lib/anggaran/excel";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as DataExport;
    const buf = await buatExcelAnggaran(data);
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Dashboard Anggaran.xlsx"',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
