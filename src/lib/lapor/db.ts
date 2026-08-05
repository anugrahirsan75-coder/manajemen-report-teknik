/**
 * Sambungan basis data untuk route Lapor Kapal.
 *
 * Kunci `anon` ikut terkirim ke peramban (namanya NEXT_PUBLIC_), jadi siapa pun
 * yang membuka halaman bisa membacanya. Selama kebijakan RLS tabel `projects`
 * masih "anon boleh apa saja", kunci itu = akses penuh ke seluruh data — gerbang
 * login praktis bisa dilewati lewat REST Supabase.
 *
 * Route di sini memakai SUPABASE_SERVICE_ROLE_KEY bila tersedia. Kunci itu hanya
 * hidup di server dan tidak pernah dikirim ke peramban, sehingga RLS bisa
 * dikunci rapat tanpa membuat fitur ini berhenti bekerja. Selama env itu belum
 * diisi, perilakunya sama seperti sebelumnya (kunci anon).
 * Langkah mengunci ada di docs/LAPOR_KAPAL_SETUP.md.
 */
import { createClient } from "@supabase/supabase-js";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY_SERVER = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const KEY_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const dbSiap = () => Boolean(URL_SB && (KEY_SERVER || KEY_ANON));

export function dbLapor() {
  if (!dbSiap()) return null;
  return createClient(URL_SB, KEY_SERVER || KEY_ANON, { auth: { persistSession: false } });
}
