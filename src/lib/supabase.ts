import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// null jika env belum diisi -> app tetap jalan pakai localStorage
export const supabase: SupabaseClient | null =
  url && key && !url.includes("YOUR_PROJECT") ? createClient(url, key) : null;

export const isSupabaseReady = !!supabase;
