"use client";
import { supabase } from "@/lib/supabase";
import { ShipFile } from "./types";

const BUCKET = "foto"; // reuse bucket Public yang sudah ada (anon INSERT)

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/(^-|-$)/g, "");

/** Upload file inventaris kapal apa adanya (PDF/Excel/gambar) -> metadata + URL publik. */
export async function uploadInventaris(shipId: string, file: File): Promise<ShipFile> {
  if (!supabase) throw new Error("Supabase belum aktif — file inventaris butuh penyimpanan online.");
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const base = slug(file.name.replace(/\.[^.]+$/, "")) || "file";
  const path = `inventaris/${shipId}/${Date.now()}-${base}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { name: file.name, url: data.publicUrl, size: file.size, type: file.type || ext, path, uploadedAt: new Date().toISOString() };
}

/** Hapus file dari Storage (best-effort). */
export async function removeInventaris(f: ShipFile): Promise<void> {
  if (!supabase || !f.path) return;
  try { await supabase.storage.from(BUCKET).remove([f.path]); } catch { /* abaikan */ }
}
