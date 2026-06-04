import { ProjectData } from "@/lib/types";
import { fillSpkDocx } from "./fillSpk";
import { XLSX_FILLERS } from "./fillXlsx";

export const META: Record<string, { label: string; ext: "docx" | "xlsx" }> = {
  spk: { label: "01. SPK Swakelola", ext: "docx" },
  ba: { label: "02. BA Swakelola", ext: "xlsx" },
  perhitungan: { label: "03. Daftar Perhitungan", ext: "xlsx" },
  lampiran: { label: "04. Lampiran", ext: "xlsx" },
  nominatif: { label: "05. Daftar Nominatif PPH21", ext: "xlsx" },
  spkh: { label: "07. SPKH", ext: "xlsx" },
  dokumentasi: { label: "08. Dokumentasi", ext: "xlsx" },
};

export const ALL_SLUGS = Object.keys(META);

export async function buildNative(slug: string, data: ProjectData): Promise<Buffer> {
  if (slug === "spk") return fillSpkDocx(data);
  const filler = XLSX_FILLERS[slug];
  if (!filler) throw new Error("slug tidak dikenal: " + slug);
  return filler(data);
}

export function safeBase(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "");
}
