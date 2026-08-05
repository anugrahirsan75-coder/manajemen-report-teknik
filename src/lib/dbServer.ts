/**
 * Sambungan basis data untuk kode SISI SERVER (route API).
 *
 * Memakai SUPABASE_SERVICE_ROLE_KEY bila tersedia — kunci itu tidak pernah
 * dikirim ke peramban, sehingga kebijakan RLS boleh ditutup rapat untuk `anon`
 * tanpa mematikan route mana pun. Selama env itu belum diisi, perilakunya sama
 * seperti sebelumnya (kunci anon).
 */
import { createClient } from "@supabase/supabase-js";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY_SERVER = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const KEY_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const dbSiap = () => Boolean(URL_SB && (KEY_SERVER || KEY_ANON));

export function dbServer() {
  if (!dbSiap()) return null;
  return createClient(URL_SB, KEY_SERVER || KEY_ANON, { auth: { persistSession: false } });
}
