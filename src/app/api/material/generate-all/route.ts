/**
 * Satu berkas ZIP berisi seluruh dokumen pengajuan kode material.
 *
 * Isinya campur bentuk, bukan seragam: Template Pendaftaran Material tetap
 * Excel karena pusat membacanya sebagai data, tiga dokumen lain menjadi PDF
 * karena dibaca dan ditandatangani orang. Lihat lib/material/formatDok.ts.
 *
 * Konversi PDF memakai MS Office di laptop yang menjalankan aplikasi. Bila
 * tidak tersedia (di peladen awan, atau Office tidak terpasang), dokumen itu
 * tetap dimasukkan sebagai Excel dan pemakainya diberi tahu lewat satu berkas
 * catatan di dalam ZIP — lebih baik daripada ZIP yang gagal seluruhnya.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import PizZip from "pizzip";
import { MaterialRequest } from "@/lib/material/types";
import { MATERIAL_FILLERS, MATERIAL_META } from "@/lib/material/fill";
import { formatDok } from "@/lib/material/formatDok";
import { officeAda, xlsxKePdf } from "@/lib/material/toPdf";

export const runtime = "nodejs";
export const maxDuration = 300;
const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "");

export async function POST(req: NextRequest) {
  try {
    const { req: data } = (await req.json()) as { req: MaterialRequest };
    const zip = new PizZip();
    const bisaPdf = officeAda();
    const gagal: string[] = [];

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mat-zip-"));
    try {
      for (const slug of Object.keys(MATERIAL_FILLERS)) {
        const label = safe(MATERIAL_META[slug].label);
        const xlsx = await MATERIAL_FILLERS[slug](data);
        if (formatDok(slug) === "xlsx" || !bisaPdf) {
          if (formatDok(slug) === "pdf") gagal.push(label);
          zip.file(`${label}.xlsx`, xlsx);
          continue;
        }
        const inF = path.join(dir, `${slug}.xlsx`);
        const outF = path.join(dir, `${slug}.pdf`);
        fs.writeFileSync(inF, xlsx);
        try {
          await xlsxKePdf(inF, outF);
          zip.file(`${label}.pdf`, fs.readFileSync(outF));
        } catch {
          // satu dokumen gagal dikonversi tidak boleh menjatuhkan seluruh ZIP
          gagal.push(label);
          zip.file(`${label}.xlsx`, xlsx);
        }
      }
    } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* sisa berkas sementara */ } }

    if (gagal.length) {
      zip.file("BACA - kenapa ada yang masih Excel.txt",
        "Dokumen berikut seharusnya PDF, tetapi konversinya tidak bisa dijalankan di sini:\n\n"
        + gagal.map((g) => "  - " + g).join("\n")
        + "\n\nPenyebab biasanya MS Office tidak tersedia (aplikasi sedang jalan di peladen, "
        + "bukan di laptop). Buka berkas Excel-nya lalu Save As PDF.\n");
    }

    const outBuf = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
    const name = safe(`Pengajuan Material ${data.tanggal}`) + ".zip";
    return new NextResponse(outBuf as any, {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"` },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
