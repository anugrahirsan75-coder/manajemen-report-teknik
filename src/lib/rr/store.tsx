"use client";
/**
 * Penyimpanan Rencana & Realisasi bulanan.
 * 1 dokumen (tipe + bulan + kapal) = 1 baris Supabase kind="rr", supaya:
 *   - riwayat tiap kapal berdiri sendiri (aman kalau 2 orang mengisi kapal berbeda)
 *   - dokumen yang sudah "terkirim" tak ikut tertimpa saat kapal lain disimpan
 * Salinan lokal disimpan di localStorage agar tetap terbaca saat offline.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { catatBackup } from "@/lib/backup/local";
import { RrDoc, TipeRR } from "./types";

const LS = "rr_dokumen";

export const idDoc = (tipe: TipeRR, bulan: string, kapal: string) => `${tipe}|${bulan}|${kapal}`;

export function useRR() {
  const ready = isSupabaseReady;
  const [dok, setDok] = useState<RrDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [simpanErr, setSimpanErr] = useState("");

  useEffect(() => {
    try { const a = localStorage.getItem(LS); if (a) setDok(JSON.parse(a)); } catch {}
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data } = await supabase.from("projects").select("id,payload")
        .filter("payload->>kind", "eq", "rr").order("created_at", { ascending: false });
      const list: RrDoc[] = (data || []).map((r: any) => ({ ...(r.payload?.doc || {}), _row: r.id })) as any;
      const bersih = list.filter((x) => x && x.id);
      setDok(bersih);
      try { localStorage.setItem(LS, JSON.stringify(bersih)); } catch {}
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const simpan = useCallback(async (d: RrDoc) => {
    setSimpanErr("");
    const isi: RrDoc = { ...d, diubahPada: new Date().toISOString() };
    setDok((prev) => {
      const next = [...prev.filter((x) => x.id !== isi.id), isi];
      try { localStorage.setItem(LS, JSON.stringify(next)); } catch {}
      return next;
    });
    if (!supabase) return;
    try {
      const { data: ex } = await supabase.from("projects").select("id,payload")
        .filter("payload->>kind", "eq", "rr").filter("payload->>docId", "eq", isi.id).limit(1);
      const payload = { kind: "rr", docId: isi.id, doc: isi };
      const nama = `${isi.tipe === "rencana" ? "RENCANA" : "REALISASI"} ${isi.bulan} — ${isi.kapal}`;
      if (ex && ex[0]) await supabase.from("projects").update({ payload }).eq("id", ex[0].id);
      else await supabase.from("projects").insert({ nama_kapal: nama, tahun: +isi.bulan.slice(0, 4), payload });
      catatBackup("rr", ex?.[0]?.id, payload, nama);
    } catch (e: any) {
      setSimpanErr(e?.message || String(e));
      throw e;
    }
  }, []);

  const hapus = useCallback(async (id: string) => {
    setDok((prev) => {
      const next = prev.filter((x) => x.id !== id);
      try { localStorage.setItem(LS, JSON.stringify(next)); } catch {}
      return next;
    });
    if (!supabase) return;
    const { data: ex } = await supabase.from("projects").select("id")
      .filter("payload->>kind", "eq", "rr").filter("payload->>docId", "eq", id).limit(1);
    if (ex && ex[0]) await supabase.from("projects").delete().eq("id", ex[0].id);
  }, []);

  const cari = useCallback((tipe: TipeRR, bulan: string, kapal: string) =>
    dok.find((x) => x.tipe === tipe && x.bulan === bulan && x.kapal === kapal), [dok]);

  return { ready, loading, dok, simpanErr, reload: load, simpan, hapus, cari };
}
