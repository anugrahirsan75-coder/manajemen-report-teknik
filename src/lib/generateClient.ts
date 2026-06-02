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
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="([^"]+)"/);
  const name = m ? decodeURIComponent(m[1]) : `dokumen.${format === "pdf" ? "pdf" : "bin"}`;
  saveAs(blob, name);
}
