"use client";
/**
 * Penyimpanan Monitoring Permintaan.
 *
 * Satu barang = satu baris kind="permintaan_eval", dicari lewat payload.kunci.
 * Satu baris per barang (bukan per berkas) supaya dua orang yang menilai
 * barang berbeda dari berkas yang sama tidak saling menimpa.
 */
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { EvalPermintaan, JejakEval, KIND_EVAL, Pengadaan } from "./types";

const HALAMAN = 1000;

/** ambil seluruh baris satu kind, berhalaman — PostgREST memotong di 1.000 baris */
async function semuaBaris(kind: string, kolom = "id,payload"): Promise<any[]> {
  if (!isSupabaseReady || !supabase) return [];
  const out: any[] = [];
  for (let dari = 0; ; dari += HALAMAN) {
    const { data, error } = await supabase.from("projects").select(kolom)
      .filter("payload->>kind", "eq", kind)
      .order("created_at", { ascending: true })
      .range(dari, dari + HALAMAN - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < HALAMAN) break;
  }
  return out;
}

export interface PetaEval { evals: Map<string, EvalPermintaan>; idBaris: Map<string, string> }

export async function muatEval(): Promise<PetaEval> {
  const evals = new Map<string, EvalPermintaan>();
  const idBaris = new Map<string, string>();
  const rows = await semuaBaris(KIND_EVAL);
  for (const r of rows) {
    const e = r.payload as EvalPermintaan;
    if (!e?.kunci) continue;
    const lama = evals.get(e.kunci);
    if (lama && (lama.diubahPada || "") > (e.diubahPada || "")) continue;
    evals.set(e.kunci, e); idBaris.set(e.kunci, r.id);
  }
  return { evals, idBaris };
}

/** simpan satu penilaian; mengembalikan id baris Supabase */
export async function simpanEval(id: string | null, e: EvalPermintaan): Promise<string> {
  if (!supabase) throw new Error("Sumber data belum siap");
  if (!id) {
    // baris bisa saja sudah dibuat perangkat lain sejak layar dimuat
    const { data: ada } = await supabase.from("projects").select("id")
      .filter("payload->>kind", "eq", KIND_EVAL).filter("payload->>kunci", "eq", e.kunci).limit(1);
    if (ada && ada[0]) id = ada[0].id as string;
  }
  if (id) {
    const { error } = await supabase.from("projects").update({ payload: e }).eq("id", id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await supabase.from("projects")
    .insert({
      nama_kapal: e.kapal || "PERMINTAAN KAPAL",
      tahun: Number((e.dikirimPada || e.periode || "").slice(0, 4)) || new Date().getFullYear(),
      payload: e,
    })
    .select("id").single();
  if (error) throw new Error(error.message);
  return data!.id as string;
}

/**
 * Pengadaan ringkas: SPPBJ, Non PR PO, dan tahap SCM-nya.
 * Hanya kolom yang dibutuhkan pencocokan — rincian harga dan vendor tidak ikut.
 */
export async function muatPengadaan(): Promise<Pengadaan[]> {
  /*
   * Kolom JSON dipilih satu per satu: payload SPPBJ bisa memuat foto, lampiran
   * dan teks KAK — ratusan KB per baris yang tidak dibutuhkan pencocokan.
   */
  const kolom = "id,nomor:payload->>noSPPBJ,pr:payload->>noPRSAP,nama:payload->>namaPengadaan,"
    + "tanggal:payload->>tanggal,status:payload->>status,items:payload->items";
  const [sppbj, nonpr, scm] = await Promise.all([
    semuaBaris("sppbj", kolom),
    semuaBaris("nonpr", "id,nomor:payload->>noSPPB,nama:payload->>namaPengadaan,tanggal:payload->>tanggal,items:payload->items"),
    semuaBaris("scm", "id,sppbjId:payload->>sppbjId,tahap:payload->>tahap"),
  ]);
  const tahap = new Map<string, string>();
  scm.forEach((r) => { if (r.sppbjId) tahap.set(r.sppbjId, r.tahap || ""); });
  const ringkasItem = (items: any[]) => (Array.isArray(items) ? items : []).map((i) => ({
    kapal: String(i?.kapal || ""), nama: String(i?.nama || ""), spesifikasi: String(i?.spesifikasi || ""),
  }));
  return [
    ...sppbj.map((r) => ({
      id: r.id, asal: "sppbj" as const, nomor: r.nomor || r.pr || "", nama: r.nama || "",
      tanggal: r.tanggal || "", status: r.status || "", tahapScm: tahap.get(r.id) || "", items: ringkasItem(r.items),
    })),
    ...nonpr.map((r) => ({
      id: r.id, asal: "nonpr" as const, nomor: r.nomor || "", nama: r.nama || "",
      tanggal: r.tanggal || "", status: "nonpr", tahapScm: "", items: ringkasItem(r.items),
    })),
  ];
}

/* ── nama penilai ─────────────────────────────────────────────────────────
 * Login aplikasi memakai akun bersama, jadi tak ada nama orang yang bisa
 * dibaca dari sesi. Nama diisi sekali dan diingat peramban; tiap perubahan
 * mencatatnya di jejak supaya tetap jelas siapa yang memutuskan apa.
 */
const KUNCI_NAMA = "permintaan_penilai";
export const namaPenilai = () => { try { return localStorage.getItem(KUNCI_NAMA) || ""; } catch { return ""; } };
export const ingatPenilai = (n: string) => { try { localStorage.setItem(KUNCI_NAMA, n.trim()); } catch { /* dimatikan */ } };

export const jejakBaru = (oleh: string, ubah: string): JejakEval => ({ pada: new Date().toISOString(), oleh, ubah });
