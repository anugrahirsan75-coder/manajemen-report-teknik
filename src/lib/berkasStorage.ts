"use client";
/**
 * Unggah berkas dokumen (PDF/gambar/Word) ke Supabase Storage.
 *
 * Beda dengan fotoStorage: berkas TIDAK dikompres dan TIDAK punya jalan mundur
 * base64 — PDF berukuran ratusan KB akan menjebol localStorage dan membuat
 * dokumen lain ikut gagal tersimpan. Kalau Supabase mati, lebih jujur menolak
 * daripada menyimpan setengah-setengah.
 */
import { supabase } from "@/lib/supabase";

const BUCKET = "foto";           // bucket publik yang sudah ada
export const MAKS_BERKAS = 15 * 1024 * 1024;   // 15 MB

export class BerkasError extends Error {}

const bersih = (s: string) =>
  (s || "berkas").normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "_").slice(-80);

export async function unggahBerkas(file: File, folder = "berita-acara"): Promise<{ url: string; ukuran: number }> {
  if (!supabase) throw new BerkasError("Supabase belum aktif — berkas tak bisa diunggah dari perangkat ini.");
  if (file.size > MAKS_BERKAS) {
    throw new BerkasError(`Berkas ${(file.size / 1048576).toFixed(1)} MB melebihi batas ${MAKS_BERKAS / 1048576} MB.`);
  }
  const nama = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${bersih(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(nama, file, {
    contentType: file.type || "application/octet-stream", upsert: false,
  });
  if (error) throw new BerkasError(error.message || "Gagal mengunggah berkas.");
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(nama);
  if (!data?.publicUrl) throw new BerkasError("Berkas terunggah tetapi tautannya tak terbaca.");
  return { url: data.publicUrl, ukuran: file.size };
}

export const ukuranSingkat = (n?: number) =>
  !n ? "" : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
