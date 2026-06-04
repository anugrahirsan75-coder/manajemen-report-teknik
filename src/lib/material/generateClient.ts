import { saveAs } from "file-saver";
import { MaterialRequest } from "./types";

export const MATERIAL_DOCS = [
  { slug: "pendaftaran", nama: "01. Template Pendaftaran Material (SAP)", ket: "HP-107.00.02 · per kapal + semua kapal", icon: "📋" },
  { slug: "formulir", nama: "02. Formulir Permintaan Master Data", ket: "Tanggal, periode, dept head/staf", icon: "🧾" },
  { slug: "penawaran_sc", nama: "03. Penawaran Suku Cadang", ket: "Item kategori Suku Cadang (ZSC)", icon: "⚙️" },
  { slug: "penawaran_umum", nama: "04. Penawaran Barang Umum", ket: "Item selain suku cadang", icon: "📦" },
];

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

export async function generateMaterial(slug: string, format: "native" | "pdf", req: MaterialRequest) {
  const res = await fetch("/api/material/generate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, format, req }),
  });
  await dl(res, `material.${format === "pdf" ? "pdf" : "xlsx"}`);
}

export async function generateMaterialAll(req: MaterialRequest) {
  const res = await fetch("/api/material/generate-all", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ req }),
  });
  await dl(res, "pengajuan-material.zip");
}
