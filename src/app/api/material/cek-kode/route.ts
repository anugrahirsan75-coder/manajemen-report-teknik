import { NextRequest, NextResponse } from "next/server";
import { cekKode, syncDb, dbMeta, CekInput } from "@/lib/material/kodeCheck";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { items?: CekInput[]; refresh?: boolean; action?: string };
    if (body.action === "sync") {
      return NextResponse.json({ meta: await syncDb() });
    }
    const results = await cekKode(body.items || [], { refresh: body.refresh });
    return NextResponse.json({ results, meta: dbMeta() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
