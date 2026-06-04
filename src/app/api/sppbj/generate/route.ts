import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { SppbjRequest } from "@/lib/sppbj/types";
import { fillSppbj } from "@/lib/sppbj/fill";
import { fillBstb, fillBapp, fillFormatSap, fillFase1, fillLengkap } from "@/lib/sppbj/fill2";

export const runtime = "nodejs";
export const maxDuration = 120;
const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "");

const SHEET: Record<string, string> = { sppbj: "SPPBJ", bstb: "BSTB", bapp: "BAPP", sap: "FORMAT SAP", fase1: "SPPBJ", lengkap: "SPPBJ" };

async function buildXlsx(doc: string, req: SppbjRequest, kapal?: string): Promise<Buffer> {
  if (doc === "sppbj") return fillSppbj(req);
  if (doc === "fase1") return fillFase1(req);
  if (doc === "lengkap") return fillLengkap(req);
  if (doc === "bstb") return fillBstb(req, kapal || (req.items[0]?.kapal ?? ""));
  if (doc === "bapp") return fillBapp(req);
  if (doc === "sap") return fillFormatSap(req);
  throw new Error("doc tidak dikenal: " + doc);
}

function toPdf(input: string, output: string, sheet: string): Promise<void> {
  const script = path.join(process.cwd(), "scripts", "to-pdf.ps1");
  return new Promise((resolve, reject) => {
    const ps = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-In", input, "-Out", output, "-Sheet", sheet]);
    let err = ""; ps.stderr.on("data", (d) => (err += d.toString()));
    ps.on("close", (code) => (code === 0 && fs.existsSync(output) ? resolve() : reject(new Error("Konversi PDF gagal. " + err))));
  });
}

export async function POST(req: NextRequest) {
  try {
    const { doc = "sppbj", format, req: data, kapal } = (await req.json()) as { doc?: string; format: "native" | "pdf"; req: SppbjRequest; kapal?: string };
    const sheet = SHEET[doc];
    if (!sheet) return NextResponse.json({ error: "doc tidak dikenal" }, { status: 400 });

    const label = doc === "bstb" ? `BSTB ${kapal || ""}` : doc.toUpperCase();
    const base = safe(`${label} ${data.namaPengadaan} ${data.tanggal}`).slice(0, 90);
    const xlsx = await buildXlsx(doc, data, kapal);

    if (format === "native") {
      return new NextResponse(xlsx as any, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(base)}.xlsx"`,
        },
      });
    }
    if (process.platform !== "win32" || process.env.DISABLE_OFFICE_PDF === "1") {
      return NextResponse.json({ error: "PDF hanya di mode lokal (MS Office). Online pakai Excel lalu Save As PDF." }, { status: 501 });
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sppbj-"));
    const inF = path.join(dir, "d.xlsx"), outF = path.join(dir, "d.pdf");
    fs.writeFileSync(inF, xlsx);
    try {
      await toPdf(inF, outF, sheet);
      return new NextResponse(fs.readFileSync(outF) as any, {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${encodeURIComponent(base)}.pdf"` },
      });
    } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
