import { saveAs } from "file-saver";
import { SppbjRequest } from "./types";

export async function generateSppbjDoc(doc: string, format: "native" | "pdf", req: SppbjRequest, kapal?: string) {
  const res = await fetch("/api/sppbj/generate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc, format, req, kapal }),
  });
  if (!res.ok) {
    let msg = res.statusText; try { msg = (await res.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="([^"]+)"/);
  saveAs(blob, m ? decodeURIComponent(m[1]) : `${doc}.${format === "pdf" ? "pdf" : "xlsx"}`);
}

export async function generateSppbjAll(req: SppbjRequest) {
  const res = await fetch("/api/sppbj/generate-all", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ req }),
  });
  if (!res.ok) { let m = res.statusText; try { m = (await res.json()).error ?? m; } catch {} throw new Error(m); }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="([^"]+)"/);
  saveAs(blob, m ? decodeURIComponent(m[1]) : "pengadaan.zip");
}

// kompat lama
export const generateSppbj = (format: "native" | "pdf", req: SppbjRequest) => generateSppbjDoc("sppbj", format, req);
