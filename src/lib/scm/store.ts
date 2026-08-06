"use client";
/**
 * Penyimpanan proses SCM.
 *
 * Satu baris Supabase per pengadaan (payload.kind = "scm"), ditautkan ke SPPBJ
 * lewat sppbjId. Isi SPPBJ-nya sendiri TIDAK disalin ke sini: yang dicatat cuma
 * perjalanan dokumennya, supaya item dan harga tetap satu sumber di dokumen
 * aslinya dan tak pernah berbeda antara layar Teknik dan layar SCM.
 */
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { ProsesScm, TahapScm, Vendor } from "./types";
import seedVendor from "./vendorSeed.json";

export interface BarisScm { id: string; proses: ProsesScm }

const acak = () => globalThis.crypto?.randomUUID?.() ?? String(Math.random()).slice(2);

export async function muatProses(): Promise<BarisScm[]> {
  if (!isSupabaseReady || !supabase) return [];
  const { data, error } = await supabase.from("projects")
    .select("id,payload,created_at")
    .filter("payload->>kind", "eq", "scm")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({ id: r.id, proses: r.payload as ProsesScm }));
}

export async function simpanProses(id: string | null, proses: ProsesScm): Promise<string> {
  if (!supabase) throw new Error("Sumber data belum siap");
  if (id) {
    const { error } = await supabase.from("projects").update({ payload: proses }).eq("id", id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await supabase.from("projects")
    .insert({ nama_kapal: "PROSES SCM", tahun: new Date().getFullYear(), payload: proses })
    .select("id").single();
  if (error) throw new Error(error.message);
  return data!.id as string;
}

/** pindahkan ke tahap baru sambil mencatat jamnya — jejak inilah bahan analisa lama proses */
export function majuTahap(p: ProsesScm, tahap: TahapScm, oleh?: string, catatan?: string): ProsesScm {
  return {
    ...p, tahap,
    jejak: [...(p.jejak || []), { tahap, waktu: new Date().toISOString(), oleh, catatan }],
  };
}

export const prosesBaru = (sppbjId: string, oleh?: string): ProsesScm => ({
  kind: "scm", sppbjId, tahap: "masuk",
  jejak: [{ tahap: "masuk", waktu: new Date().toISOString(), oleh }],
});

/* ── vendor ─────────────────────────────────────────────────────────────── */

const KUNCI_VENDOR = "scm_vendor";

/** daftar vendor: dari Supabase bila sudah ada, kalau belum dari bawaan berkas SCM */
export async function muatVendor(): Promise<{ id: string | null; daftar: Vendor[] }> {
  if (!isSupabaseReady || !supabase) return { id: null, daftar: bawaanVendor() };
  const { data } = await supabase.from("projects").select("id,payload")
    .filter("payload->>kind", "eq", "vendor_scm").limit(1);
  const baris = (data || [])[0];
  if (baris?.payload?.daftar?.length) return { id: baris.id, daftar: baris.payload.daftar as Vendor[] };
  return { id: baris?.id || null, daftar: bawaanVendor() };
}

export async function simpanVendor(id: string | null, daftar: Vendor[]): Promise<string> {
  if (!supabase) throw new Error("Sumber data belum siap");
  const payload = { kind: "vendor_scm", daftar, diubah: new Date().toISOString() };
  if (id) {
    const { error } = await supabase.from("projects").update({ payload }).eq("id", id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await supabase.from("projects")
    .insert({ nama_kapal: "DATA VENDOR (SCM)", tahun: new Date().getFullYear(), payload })
    .select("id").single();
  if (error) throw new Error(error.message);
  return data!.id as string;
}

/** 40 vendor bawaan, disalin dari sheet DATA VENDOR milik SCM */
export function bawaanVendor(): Vendor[] {
  return (seedVendor as any[]).map((v) => ({
    id: `seed-${v.no}`, nama: v.nama, pimpinan: v.pimpinan, jabatan: v.jabatan || "Direktur",
    telepon: v.telepon || "", fax: v.fax || "", npwp: v.npwp || "",
    alamat: v.alamat || "", kota: v.kota || "", noVendor: v.noVendor || "",
  }));
}

export const vendorBaru = (): Vendor => ({
  id: acak(), nama: "", pimpinan: "", jabatan: "Direktur",
  telepon: "", fax: "", npwp: "", alamat: "", kota: "", noVendor: "",
});
