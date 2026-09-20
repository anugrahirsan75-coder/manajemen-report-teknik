"use client";
/**
 * Penyimpanan PMS: satu baris Supabase per KAPAL (kind="pms").
 *
 * Satu baris per kapal, bukan per peralatan. Layar selalu membaca dan menyimpan
 * satu kapal sebagai kesatuan — daftar peralatan beserta rencananya — dan
 * memecahnya per butir akan mengubah satu kali simpan menjadi puluhan tulis
 * yang bisa selesai setengah jalan.
 *
 * Jam jalan mesin TIDAK disimpan di sini. Angkanya milik kapal, dikirim ABK
 * lewat Portal Kapal, dan dibaca apa adanya dari sana. Menyalinnya ke PMS
 * berarti dua angka jam yang sama-sama mengaku benar.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { catatBackup } from "@/lib/backup/local";
import { PmsKapal } from "./types";

const LS = "pms_kapal";
const KIND = "pms";

/**
 * Ubah apa pun yang dilempar Supabase menjadi satu kalimat yang bisa dibaca.
 *
 * PostgrestError bukan Error: ia objek biasa, jadi `String(e)` menghasilkan
 * "[object Object]" — pesan yang tidak menolong siapa pun yang sedang
 * kehilangan data.
 */
function bacaGalat(e: any): string {
  if (!e) return "Penyebabnya tidak terbaca.";
  if (typeof e === "string") return e;
  // e.error: bentuk yang dipakai gerbang /api/db ("Sesi habis…")
  const bagian = [e.message, typeof e.error === "string" ? e.error : null, e.details, e.hint].filter(Boolean);
  if (bagian.length) return bagian.join(" — ") + (e.code ? ` (kode ${e.code})` : "");
  try { return JSON.stringify(e); } catch { return String(e); }
}

/** jam jalan per kapal → { nama mesin: jam } */
export type PetaJam = Record<string, Record<string, number>>;

export function usePms() {
  const ready = isSupabaseReady;
  const [list, setList] = useState<PmsKapal[]>([]);
  const [jam, setJam] = useState<PetaJam>({});
  const [loading, setLoading] = useState(false);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    try {
      const a = localStorage.getItem(LS);
      if (a) setList(JSON.parse(a));
    } catch { /* simpanan lokal rusak — mulai kosong */ }
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from("projects").select("id,payload")
        .filter("payload->>kind", "eq", KIND);
      if (error) { setGalat(bacaGalat(error)); return; }
      setGalat("");
      const rows: PmsKapal[] = (data || []).map((r: any) => r.payload?.doc).filter((x: any) => x?.kapal);
      setList(rows);
      try { localStorage.setItem(LS, JSON.stringify(rows)); } catch { /* kuota penuh */ }
    } finally { setLoading(false); }
  }, []);

  /** jam jalan diambil dari data yang dikirim kapal lewat Portal */
  const muatJam = useCallback(async () => {
    try {
      const r = await fetch("/api/armada-data");
      if (!r.ok) return;
      const j = await r.json();
      const peta: PetaJam = {};
      for (const a of j.armada || []) {
        const per: Record<string, number> = {};
        for (const m of a?.stok?.mesin || []) {
          const nama = String(m.mesin || "").trim();
          if (nama) per[nama] = Number(m.jam) || 0;
        }
        peta[a.kapal] = per;
      }
      setJam(peta);
    } catch { /* jam jalan opsional — rencana kalender tetap jalan */ }
  }, []);

  useEffect(() => { if (ready) { load(); muatJam(); } }, [ready, load, muatJam]);

  const simpan = useCallback(async (doc: PmsKapal) => {
    setGalat("");
    const isi: PmsKapal = { ...doc, diubahPada: new Date().toISOString() };
    setList((prev) => {
      const next = prev.some((x) => x.kapal === isi.kapal)
        ? prev.map((x) => (x.kapal === isi.kapal ? isi : x))
        : [...prev, isi];
      try { localStorage.setItem(LS, JSON.stringify(next)); } catch { /* kuota penuh */ }
      return next;
    });
    if (!supabase) return;
    try {
      // Kalau pencarian baris lama gagal, JANGAN teruskan: ex yang kosong akan
      // dibaca sebagai "belum ada", lalu kapal yang sama ditulis dua kali.
      const { data: ex, error: eCari } = await supabase.from("projects").select("id")
        .filter("payload->>kind", "eq", KIND).filter("payload->>docId", "eq", isi.kapal).limit(1);
      if (eCari) throw eCari;
      const payload = { kind: KIND, docId: isi.kapal, doc: isi };
      const nama = `PMS ${isi.kapal}`;
      // Kegagalan tulis WAJIB diteriakkan. Catatan perawatan yang diam-diam
      // hanya mendarat di localStorage akan tampak tersimpan di satu komputer
      // dan hilang di komputer lain — dan orang baru menyadarinya ketika
      // riwayat pekerjaan diperlukan.
      const res = ex && ex[0]
        ? await supabase.from("projects").update({ payload }).eq("id", ex[0].id)
        : await supabase.from("projects").insert({ nama_kapal: nama, tahun: new Date().getFullYear(), payload });
      if (res.error) throw res.error;
      catatBackup("pms", ex?.[0]?.id, payload, nama);
    } catch (e: any) {
      const pesan = bacaGalat(e);
      setGalat(pesan);
      throw new Error(pesan);   // pemanggil menampilkan pesannya apa adanya
    }
  }, []);

  return { ready, list, jam, loading, galat, reload: load, simpan };
}
