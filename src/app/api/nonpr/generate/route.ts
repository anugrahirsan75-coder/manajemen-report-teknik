import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { NonprRequest } from "@/lib/nonpr/types";
import { fillNonpr } from "@/lib/nonpr/fill";

export const runtime = "nodejs";
export const maxDuration = 120;
const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "");

function toPdf(input: string, output: string): Promise<void> {
  const script = path.join(process.cwd(), "scripts", "to-pdf.ps1");
  return new Promise((resolve, reject) => {
    const ps = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-In", input, "-Out", output]);
    let err = ""; ps.stderr.on("data", (d) => (err += d.toString()));
    ps.on("close", (code) => (code === 0 && fs.existsSync(output) ? resolve() : reject(new Error("Konversi PDF gagal. " + err))));
  });
}

export async function POST(req: NextRequest) {
  try {
    const { format = "native", req: data } = (await req.json()) as { format?: "native" | "pdf"; req: NonprRequest };
    const base = safe(`SPPBJ Non PR PO ${data.namaPengadaan} ${data.tanggal}`).slice(0, 90);
    const xlsx = await fillNonpr(data);

    if (format === "native") {
      return new NextResponse(xlsx as any, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(base)}.xlsx"`,
        },
      });
    }
    if (process.platform !== "win32" || process.env.DISABLE_OFFICE_PDF === "1") {
      return NextResponse.json({ error: "PDF hanya di mode lokal (MS Office)." }, { status: 501 });
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nonpr-"));
    const inF = path.join(dir, "d.xlsx"), outF = path.join(dir, "d.pdf");
    fs.writeFileSync(inF, xlsx);
    try {
      await toPdf(inF, outF);
      return new NextResponse(fs.readFileSync(outF) as any, {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${encodeURIComponent(base)}.pdf"` },
      });
    } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
