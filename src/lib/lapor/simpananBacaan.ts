"use client";
/**
 * Simpanan hasil bacaan permintaan kapal — sisi peramban.
 *
 * Membaca borang tulisan tangan dengan AI lokal memakan waktu satu sampai tiga
 * menit per berkas. Selama hasilnya tidak disimpan, ongkos itu dibayar ULANG
 * setiap kali orang membuka kiriman yang sama — dan hanya bisa dibayar di
 * laptop yang punya Ollama. Dengan hasilnya tersimpan, pembacaan cukup sekali:
 * dari ponsel atau dari Vercel isinya langsung tampil, tanpa AI sama sekali.
 *
 * Satu baris Supabase per BERKAS (payload.kind = "bacaan-berkas"), bukan per
 * kiriman: satu kiriman kerap memuat tujuh lembar foto, dan tiap lembar berhasil
 * atau gagal sendiri-sendiri.
 *
 * Bentuk datanya sendiri ada di bacaanTypes.ts — dipakai bersama dengan juru
 * baca sisi server, supaya keduanya tak pernah punya aturan yang berbeda.
 */
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { BacaanBerkas, KIND_BACAAN, KIND_STATUS, StatusJuruBaca } from "./bacaanTypes";

export type { BacaanBerkas, StatusBacaan, StatusJuruBaca } from "./bacaanTypes";
export {
  VERSI_BACAAN, KIND_BACAAN, KIND_STATUS, KLAIM_KEDALUWARSA_MENIT, DENYUT_BASI_MENIT,
  bacaanBaru, bisaDibaca, denyutSegar, klaimMenggantung, perluDibaca,
} from "./bacaanTypes";

export interface BarisBacaan { id: string; bacaan: BacaanBerkas }

/** identitas perangkat ini, dipakai untuk klaim antrean */
export function idPerangkat(): string {
  try {
    const k = "juru_baca_perangkat";
    let v = localStorage.getItem(k);
    if (!v) {
      v = `${navigator.platform || "perangkat"}-${String(Math.random()).slice(2, 8)}`;
      localStorage.setItem(k, v);
    }
    return v;
  } catch { return "perangkat"; }
}

/**
 * Seluruh bacaan, dipetakan per fileId.
 *
 * Bila satu berkas sempat tercatat dua kali (dua pembaca mengklaim di detik
 * yang sama), yang dipakai adalah yang paling baru dan yang lama dibuang —
 * kalau dibiarkan, layar akan menampilkan barang yang sama dua kali.
 */
export async function muatBacaan(): Promise<Map<string, BarisBacaan>> {
  const peta = new Map<string, BarisBacaan>();
  if (!isSupabaseReady || !supabase) return peta;
  const { data, error } = await supabase.from("projects")
    .select("id,payload,created_at")
    .filter("payload->>kind", "eq", KIND_BACAAN)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const kembar: string[] = [];
  (data || []).forEach((r: any) => {
    const b = r.payload as BacaanBerkas;
    if (!b?.fileId) return;
    const lama = peta.get(b.fileId);
    if (lama) {
      const pilihBaru = (b.waktu || "") >= (lama.bacaan.waktu || "");
      kembar.push(pilihBaru ? lama.id : r.id);
      if (!pilihBaru) return;
    }
    peta.set(b.fileId, { id: r.id, bacaan: b });
  });
  if (kembar.length) void supabase.from("projects").delete().in("id", kembar);
  return peta;
}

/** denyut juru baca di laptop — supaya layar mana pun tahu ia sedang bekerja atau mati */
export async function muatStatusJuruBaca(): Promise<StatusJuruBaca | null> {
  if (!isSupabaseReady || !supabase) return null;
  const { data } = await supabase.from("projects").select("payload")
    .filter("payload->>kind", "eq", KIND_STATUS).limit(1);
  return ((data || [])[0]?.payload as StatusJuruBaca) || null;
}

export async function simpanBacaan(id: string | null, bacaan: BacaanBerkas): Promise<string> {
  if (!supabase) throw new Error("Sumber data belum siap");
  if (id) {
    const { error } = await supabase.from("projects").update({ payload: bacaan }).eq("id", id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await supabase.from("projects")
    .insert({
      nama_kapal: bacaan.kapal || "PERMINTAAN KAPAL",
      tahun: Number((bacaan.periode || "").slice(0, 4)) || new Date().getFullYear(),
      payload: bacaan,
    })
    .select("id").single();
  if (error) throw new Error(error.message);
  return data!.id as string;
}

export async function hapusBacaan(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
