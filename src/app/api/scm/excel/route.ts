import { NextRequest, NextResponse } from "next/server";
import { DataScm, buatExcelScm } from "@/lib/scm/excel";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Berkas pengadaan SCM (12 sheet) — dibangun di server karena templatenya
 * berupa berkas 2 MB di dalam proyek, dan tak ada gunanya mengirimnya ke
 * peramban hanya untuk diisi lalu dikirim balik.
 */
export async function POST(req: NextRequest) {
  try {
    const d = (await req.json()) as DataScm;
    if (!d?.items?.length) {
      return NextResponse.json({ error: "Pengadaan ini belum punya item" }, { status: 400 });
    }
    const buf = buatExcelScm(d);
    const nama = `${d.namaPengadaan || "Pengadaan"}`.replace(/[\\/:*?"<>|]/g, "-").slice(0, 90);
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nama}.xlsx"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "gagal menyusun berkas" }, { status: 500 });
  }
}
