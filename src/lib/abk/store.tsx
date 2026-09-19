"use client";
/**
 * Penyimpanan Rekap Awak Kapal.
 *
 * Satu baris Supabase per KAPAL (kind="abk", docId = nama kapal), bukan satu
 * baris per orang: daftar awak selalu dibaca dan diubah sebagai satu susunan
 * utuh, dan memecahnya per orang membuat satu kali simpan jadi puluhan tulis.
 *
 * Daftar bibit dari berkas SDM dipakai selama kapal itu belum pernah disimpan,
 * jadi layarnya sudah terisi sejak pertama dibuka tanpa menimpa suntingan yang
 * sudah ada di server.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { catatBackup } from "@/lib/backup/local";
import bibit from "./seed.json";
import { KapalAwak, urutanJabatan } from "./types";

const LS = "abk_kapal";

const SEED: KapalAwak[] = ((bibit as any).kapal || []).map((k: any) => ({
  kapal: String(k.kapal || "").trim(),
  sumber: (bibit as any).sumber,
  awak: (k.awak || []) as KapalAwak["awak"],
}));

export const abkBibit = (): KapalAwak[] => SEED;

const urut = (k: KapalAwak): KapalAwak => ({
  ...k,
  awak: [...(k.awak || [])].sort(
    (a, b) => urutanJabatan(a.jabatan) - urutanJabatan(b.jabatan) || a.nama.localeCompare(b.nama),
  ),
});

export function useAbk() {
  const ready = isSupabaseReady;
  const [list, setList] = useState<KapalAwak[]>(SEED.map(urut));
  const [loading, setLoading] = useState(false);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    try {
      const a = localStorage.getItem(LS);
      if (a) setList((JSON.parse(a) as KapalAwak[]).map(urut));
    } catch { /* simpanan lokal rusak — pakai bibit */ }
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from("projects").select("id,payload")
        .filter("payload->>kind", "eq", "abk");
      if (error) { setGalat(error.message); return; }
      setGalat("");
      const server: KapalAwak[] = (data || []).map((r: any) => r.payload?.doc).filter((x: any) => x?.kapal);
      // kapal yang belum pernah disimpan tetap memakai daftar bibit
      const gabung = SEED.map((s) => server.find((x) => x.kapal === s.kapal) || s)
        .concat(server.filter((x) => !SEED.some((s) => s.kapal === x.kapal)));
      const rapi = gabung.map(urut);
      setList(rapi);
      try { localStorage.setItem(LS, JSON.stringify(rapi)); } catch { /* kuota penuh */ }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const simpan = useCallback(async (k: KapalAwak) => {
    setGalat("");
    const isi = urut({ ...k, diubahPada: new Date().toISOString() });
    setList((prev) => {
      const next = prev.some((x) => x.kapal === isi.kapal)
        ? prev.map((x) => (x.kapal === isi.kapal ? isi : x))
        : [...prev, isi];
      try { localStorage.setItem(LS, JSON.stringify(next)); } catch { /* kuota penuh */ }
      return next;
    });
    if (!supabase) return;
    try {
      const { data: ex } = await supabase.from("projects").select("id")
        .filter("payload->>kind", "eq", "abk").filter("payload->>docId", "eq", isi.kapal).limit(1);
      const payload = { kind: "abk", docId: isi.kapal, doc: isi };
      const nama = `ABK ${isi.kapal}`;
      if (ex && ex[0]) await supabase.from("projects").update({ payload }).eq("id", ex[0].id);
      else await supabase.from("projects").insert({ nama_kapal: nama, tahun: new Date().getFullYear(), payload });
      catatBackup("abk", ex?.[0]?.id, payload, nama);
    } catch (e: any) { setGalat(e?.message || String(e)); throw e; }
  }, []);

  return { ready, list, loading, galat, reload: load, simpan };
}
