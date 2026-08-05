import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Klien Supabase untuk seluruh aplikasi.
 *
 * DI PERAMBAN, permintaan tidak lagi ditujukan langsung ke Supabase melainkan ke
 * /api/db — gerbang data yang berada di balik login dan memakai kunci server.
 * Alasannya: kunci `anon` ikut terkirim ke setiap pengunjung, jadi selama
 * peramban yang memegangnya, siapa pun bisa menyalin kunci itu lalu memanggil
 * REST Supabase sendiri tanpa perlu login. Lewat gerbang, kunci tersebut tidak
 * dibutuhkan sama sekali di sisi peramban.
 *
 * DI SERVER (route API, pembacaan katalog), sambungannya tetap langsung dengan
 * kunci server bila tersedia.
 *
 * Bentuk pemakaiannya tidak berubah: `supabase.from("projects")…` tetap sama,
 * hanya alamat tujuannya yang berpindah.
 */

const urlAsli = process.env.NEXT_PUBLIC_SUPABASE_URL;
const kunciAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const kunciServer = process.env.SUPABASE_SERVICE_ROLE_KEY;

const belumDiisi = !urlAsli || urlAsli.includes("YOUR_PROJECT");

function buat(): SupabaseClient | null {
  if (belumDiisi) return null;                 // env kosong -> app tetap jalan pakai localStorage

  if (typeof window !== "undefined") {
    // Kunci di sini hanya pelengkap bentuk permintaan; gerbang /api/db
    // menggantinya dengan kunci server sebelum diteruskan ke Supabase.
    return createClient(`${window.location.origin}/api/db`, kunciAnon || "lewat-gerbang", {
      auth: { persistSession: false },
    });
  }

  if (!kunciServer && !kunciAnon) return null;
  return createClient(urlAsli!, kunciServer || kunciAnon!, { auth: { persistSession: false } });
}

export const supabase: SupabaseClient | null = buat();

export const isSupabaseReady = !belumDiisi;
