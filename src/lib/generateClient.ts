import { saveAs } from "file-saver";
import { ProjectData } from "./types";

export async function generateDoc(slug: string, format: "native" | "pdf", data: ProjectData) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, format, data }),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  await download(res, `dokumen.${format === "pdf" ? "pdf" : "bin"}`);
}

export async function generateAll(data: ProjectData) {
  const res = await fetch("/api/generate-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  await download(res, "swakelola.zip");
}

async function download(res: Response, fallback: string) {
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="([^"]+)"/);
  saveAs(blob, m ? decodeURIComponent(m[1]) : fallback);
}
