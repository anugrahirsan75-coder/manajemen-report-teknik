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

/*
 * fetch yang TIDAK PERNAH disinggahi.
 *
 * Next.js menambal fetch global dengan singgahan datanya sendiri. supabase-js
 * memakai fetch global itu, jadi satu jawaban Supabase bisa dibekukan lalu
 * dipakai ulang berjam-jam — dan route yang membaca data kapal mulai menjawab
 * keadaan lama dengan yakin. Ini bukan galat yang kelihatan: halamannya memuat
 * dengan mulus, angkanya masuk akal, hanya saja itu angka kemarin. Dokumen yang
 * baru diunggah kapal tampak tidak pernah sampai.
 *
 * "force-dynamic" pada route tidak menyelamatkan: yang disinggahi permintaan ke
 * Supabase-nya, bukan penggambaran halamannya.
 */
const fetchSegar: typeof fetch = (masukan, awalan) =>
  fetch(masukan, { ...awalan, cache: "no-store" });

export function dbServer() {
  if (!dbSiap()) return null;
  return createClient(URL_SB, KEY_SERVER || KEY_ANON, {
    auth: { persistSession: false },
    global: { fetch: fetchSegar },
  });
}
