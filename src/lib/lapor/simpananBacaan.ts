"use client";
/**
 * Simpanan hasil bacaan permintaan kapal.
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
 */
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { BarisPermintaan } from "./bacaPermintaan";

/**
 * Naikkan bila mesin baca diperbaiki dan seluruh berkas layak dibaca ulang.
 * Bacaan berversi lama tetap ditampilkan — hanya diantre ulang di belakang.
 */
export const VERSI_BACAAN = 1;

export type StatusBacaan = "proses" | "selesai" | "gagal";

export interface BacaanBerkas {
  kind: "bacaan-berkas";
  fileId: string;
  namaBerkas: string;
  kirimanId: string;
  kapal: string;
  jenis: string;
  periode: string;
  status: StatusBacaan;
  baris: BarisPermintaan[];
  mesin: string;
  catatan: string[];
  galat: string;
  /** perangkat yang mengerjakan — dipakai supaya dua laptop tidak membaca berkas yang sama */
  perangkat: string;
  waktu: string;
  versi: number;
  /**
   * Sudah dikoreksi orang. Juru baca TIDAK BOLEH menimpanya: hasil AI yang
   * salah angka sudah dibetulkan manusia, dan membaca ulang berarti
   * mengembalikan kesalahannya.
   */
  disunting?: boolean;
}

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
 * Bila satu berkas sempat tercatat dua kali (dua perangkat mengklaim di detik
 * yang sama), yang dipakai adalah yang paling baru dan yang lama dibuang —
 * kalau dibiarkan, layar akan menampilkan barang yang sama dua kali.
 */
export async function muatBacaan(): Promise<Map<string, BarisBacaan>> {
  const peta = new Map<string, BarisBacaan>();
  if (!isSupabaseReady || !supabase) return peta;
  const { data, error } = await supabase.from("projects")
    .select("id,payload,created_at")
    .filter("payload->>kind", "eq", "bacaan-berkas")
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

/** klaim yang menggantung: perangkat mati di tengah jalan tidak boleh mengunci berkas selamanya */
export const KLAIM_KEDALUWARSA_MENIT = 15;

export function klaimMenggantung(b: BacaanBerkas): boolean {
  if (b.status !== "proses") return false;
  const umur = (Date.now() - new Date(b.waktu || 0).getTime()) / 60000;
  return !isFinite(umur) || umur > KLAIM_KEDALUWARSA_MENIT;
}

/** apakah berkas ini masih perlu dibaca juru baca */
export function perluDibaca(ada: BacaanBerkas | undefined, aku: string): boolean {
  if (!ada) return true;
  if (ada.disunting) return false;                       // sudah dikoreksi orang
  if (ada.status === "selesai") return (ada.versi || 0) < VERSI_BACAAN;
  if (ada.status === "proses") return ada.perangkat === aku || klaimMenggantung(ada);
  return true;                                            // gagal — layak dicoba lagi
}

export const bacaanBaru = (
  fileId: string, namaBerkas: string, kiriman: { id: string; kapal: string; jenis: string; periode: string },
  perangkat: string,
): BacaanBerkas => ({
  kind: "bacaan-berkas", fileId, namaBerkas,
  kirimanId: kiriman.id, kapal: kiriman.kapal, jenis: kiriman.jenis, periode: kiriman.periode,
  status: "proses", baris: [], mesin: "", catatan: [], galat: "",
  perangkat, waktu: new Date().toISOString(), versi: VERSI_BACAAN,
});
