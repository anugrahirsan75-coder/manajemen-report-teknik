import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { MaterialRequest } from "@/lib/material/types";
import { MATERIAL_FILLERS, MATERIAL_META } from "@/lib/material/fill";

export const runtime = "nodejs";
export const maxDuration = 120;

const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "");

function toPdf(input: string, output: string): Promise<void> {
  const script = path.join(process.cwd(), "scripts", "to-pdf.ps1");
  return new Promise((resolve, reject) => {
    const ps = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-In", input, "-Out", output]);
    let err = "";
    ps.stderr.on("data", (d) => (err += d.toString()));
    ps.on("close", (code) => (code === 0 && fs.existsSync(output) ? resolve() : reject(new Error("Konversi PDF gagal. " + err))));
  });
}

export async function POST(req: NextRequest) {
  try {
    const { slug, format, req: data } = (await req.json()) as { slug: string; format: "native" | "pdf"; req: MaterialRequest };
    const filler = MATERIAL_FILLERS[slug];
    const meta = MATERIAL_META[slug];
    if (!filler || !meta) return NextResponse.json({ error: "slug tidak dikenal" }, { status: 400 });

    const base = safe(`${meta.label} ${data.tanggal}`);
    const xlsx = await filler(data);

    if (format === "native") {
      return new NextResponse(xlsx as any, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(base)}.xlsx"`,
        },
      });
    }

    if (process.platform !== "win32" || process.env.DISABLE_OFFICE_PDF === "1") {
      return NextResponse.json({ error: "Generate PDF hanya tersedia di mode lokal (MS Office). Online pakai Excel lalu Save As PDF." }, { status: 501 });
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mat-"));
    const inF = path.join(dir, "d.xlsx");
    const outF = path.join(dir, "d.pdf");
    fs.writeFileSync(inF, xlsx);
    try {
      await toPdf(inF, outF);
      const pdf = fs.readFileSync(outF);
      return new NextResponse(pdf as any, {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${encodeURIComponent(base)}.pdf"` },
      });
    } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
