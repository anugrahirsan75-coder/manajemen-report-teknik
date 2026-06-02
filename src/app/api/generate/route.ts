import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { ProjectData } from "@/lib/types";
import { fillSpkDocx } from "@/lib/server/fillSpk";
import { XLSX_FILLERS } from "@/lib/server/fillXlsx";

export const runtime = "nodejs";
export const maxDuration = 120;

const META: Record<string, { label: string; ext: "docx" | "xlsx" }> = {
  spk: { label: "01. SPK Swakelola", ext: "docx" },
  ba: { label: "02. BA Swakelola", ext: "xlsx" },
  perhitungan: { label: "03. Daftar Perhitungan", ext: "xlsx" },
  lampiran: { label: "04. Lampiran", ext: "xlsx" },
  nominatif: { label: "05. Daftar Nominatif PPH21", ext: "xlsx" },
  spkh: { label: "07. SPKH", ext: "xlsx" },
  dokumentasi: { label: "08. Dokumentasi", ext: "xlsx" },
};

async function buildNative(slug: string, data: ProjectData): Promise<Buffer> {
  if (slug === "spk") return fillSpkDocx(data);
  const filler = XLSX_FILLERS[slug];
  if (!filler) throw new Error("slug tidak dikenal: " + slug);
  return filler(data);
}

function convertToPdf(input: string, output: string): Promise<void> {
  const script = path.join(process.cwd(), "scripts", "to-pdf.ps1");
  return new Promise((resolve, reject) => {
    const ps = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-In", input, "-Out", output]);
    let err = "";
    ps.stderr.on("data", (d) => (err += d.toString()));
    ps.on("close", (code) => {
      if (code === 0 && fs.existsSync(output)) resolve();
      else reject(new Error("Konversi PDF gagal (Office COM). " + err));
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { slug, format, data } = (await req.json()) as { slug: string; format: "native" | "pdf"; data: ProjectData };
    const meta = META[slug];
    if (!meta) return NextResponse.json({ error: "slug tidak dikenal" }, { status: 400 });

    const baseName = `${meta.label} ${data.namaKapal} ${data.tahun}`.replace(/[\\/:*?"<>|]/g, "");
    const native = await buildNative(slug, data);

    if (format === "native") {
      const ct = meta.ext === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      return new NextResponse(native as any, {
        headers: {
          "Content-Type": ct,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(baseName)}.${meta.ext}"`,
        },
      });
    }

    // PDF via Office COM — hanya tersedia di Windows ber-Office (mode lokal), bukan Vercel/Linux
    if (process.platform !== "win32" || process.env.DISABLE_OFFICE_PDF === "1") {
      return NextResponse.json(
        { error: "Generate PDF hanya tersedia di mode lokal (PC ber-MS Office). Online: pakai Word/Excel lalu Save As PDF." },
        { status: 501 }
      );
    }

    // PDF via Office COM
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "swk-"));
    const inFile = path.join(dir, `doc.${meta.ext}`);
    const outFile = path.join(dir, "doc.pdf");
    fs.writeFileSync(inFile, native);
    try {
      await convertToPdf(inFile, outFile);
      const pdf = fs.readFileSync(outFile);
      return new NextResponse(pdf as any, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(baseName)}.pdf"`,
        },
      });
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
