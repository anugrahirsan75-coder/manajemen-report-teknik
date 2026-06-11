import { saveAs } from "file-saver";
import { NonprRequest } from "./types";

async function dl(res: Response, fallback: string) {
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="([^"]+)"/);
  saveAs(blob, m ? decodeURIComponent(m[1]) : fallback);
}

export async function generateNonpr(format: "native" | "pdf", req: NonprRequest) {
  const res = await fetch("/api/nonpr/generate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format, req }),
  });
  await dl(res, `sppbj-non-pr-po.${format === "pdf" ? "pdf" : "xlsx"}`);
}
