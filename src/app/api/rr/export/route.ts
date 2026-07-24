import { NextRequest, NextResponse } from "next/server";
import { buatExcelRR, DataRR } from "@/lib/rr/excel";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as DataRR;
    const buf = await buatExcelRR(data);
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Lampiran3.xlsx"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
