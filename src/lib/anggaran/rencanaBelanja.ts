"use client";
/**
 * Rencana penggunaan pagu rutin.
 *
 * Sebelum SPPBJ dibuat, kantor perlu tahu dulu: pagu bulan ini mau dipakai
 * untuk apa saja, dan apakah rencananya masih muat. Yang disimpan di sini
 * sengaja RINGAN — nama pengadaan, mata anggarannya, dan taksiran nilainya.
 * Bukan dokumen, bukan item, bukan harga satuan: begitu rencananya jadi, yang
 * berlaku adalah SPPBJ-nya sendiri.
 *
 * Pembandingnya tiga lapis, dan urutannya penting:
 *   pagu       — persetujuan yang berlaku untuk bulan-bulan yang dipilih
 *   terpakai   — SPPBJ & Non PR PO yang sudah ada pada bulan itu
 *   rencana    — yang ditulis di sini, belum jadi dokumen apa pun
 * Sisa yang benar = pagu − terpakai − rencana. Membandingkan rencana dengan
 * pagu saja akan membuat bulan yang sudah banyak terpakai tampak masih lapang.
 */
import { supabase, isSupabaseReady } from "@/lib/supabase";

export interface BarisRencana {
  id: string;
  /** kode mata anggaran (mis. 5010403009) */
  ma: string;
  nama: string;
  nilai: number;
  catatan?: string;
  /** ditandai selesai bila SPPBJ-nya sudah dibuat */
  sudahJadi?: boolean;
}

export interface RencanaBelanja {
  kind: "rencana_belanja";
  /** rentang bulan yang direncanakan, "YYYY-MM" */
  dari: string;
  sampai: string;
  baris: BarisRencana[];
  catatan?: string;
  diubah: string;
}

export interface SimpananRencana { id: string; isi: RencanaBelanja }

const acak = () => globalThis.crypto?.randomUUID?.() ?? String(Math.random()).slice(2);

export const barisBaru = (ma = ""): BarisRencana => ({ id: acak(), ma, nama: "", nilai: 0 });

export const rencanaKosong = (dari: string, sampai: string): RencanaBelanja => ({
  kind: "rencana_belanja", dari, sampai, baris: [], diubah: new Date().toISOString(),
});

/** seluruh rencana yang tersimpan, terbaru dulu */
export async function muatRencana(): Promise<SimpananRencana[]> {
  if (!isSupabaseReady || !supabase) return [];
  const { data, error } = await supabase.from("projects")
    .select("id,payload,created_at")
    .filter("payload->>kind", "eq", "rencana_belanja")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({ id: r.id, isi: r.payload as RencanaBelanja }));
}

export async function simpanRencana(id: string | null, isi: RencanaBelanja): Promise<string> {
  if (!supabase) throw new Error("Sumber data belum siap");
  const payload = { ...isi, diubah: new Date().toISOString() };
  if (id) {
    const { error } = await supabase.from("projects").update({ payload }).eq("id", id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await supabase.from("projects")
    .insert({ nama_kapal: `RENCANA BELANJA ${isi.dari}`, tahun: Number(isi.dari.slice(0, 4)) || null, payload })
    .select("id").single();
  if (error) throw new Error(error.message);
  return data!.id as string;
}

export async function hapusRencana(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** daftar "YYYY-MM" dari awal sampai akhir (inklusif) */
export function bulanRentang(dari: string, sampai: string): string[] {
  if (!dari) return [];
  const [y0, m0] = dari.split("-").map(Number);
  const [y1, m1] = (sampai || dari).split("-").map(Number);
  if (!y0 || !m0 || !y1 || !m1) return [dari];
  const out: string[] = [];
  let y = y0, m = m0;
  for (let i = 0; i < 36; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (y === y1 && m === m1) break;
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
