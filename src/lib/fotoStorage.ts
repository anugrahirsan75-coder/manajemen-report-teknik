"use client";
import { supabase } from "@/lib/supabase";

// Kompres foto (canvas, maks 1024px, jpeg 0.72) -> {blob, dataUrl}.
export async function compressFoto(file: File, maxDim = 1024, q = 0.72): Promise<{ blob: Blob; dataUrl: string }> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL("image/jpeg", q);
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b || new Blob()), "image/jpeg", q));
  return { blob, dataUrl };
}

// Upload foto ke Supabase Storage bucket "foto" -> kembalikan URL publik.
// HYBRID: kalau bucket belum ada / gagal / Supabase mati -> fallback base64 dataUrl (perilaku lama).
const BUCKET = "foto";
export async function uploadFoto(file: File): Promise<string> {
  const { blob, dataUrl } = await compressFoto(file);
  if (!supabase) return dataUrl;
  try {
    const name = `${new Date().toISOString().slice(0, 7)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(name, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
    return data.publicUrl || dataUrl;
  } catch {
    return dataUrl; // bucket belum dibuat / akses gagal -> simpan base64 (tetap jalan)
  }
}
