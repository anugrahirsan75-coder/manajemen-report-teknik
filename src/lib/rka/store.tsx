"use client";
/**
 * Penyimpanan Rencana RKA: kind="rka_usulan", 1 baris = 1 kapal x 1 tahun RKA.
 * Pola sama dengan modul docking/kerusakan (localStorage -> Supabase, upsert per docId).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { catatBackup } from "@/lib/backup/local";
import { RkaKapal } from "./types";

const LS = "rka_usulan";

export function useRka() {
  const ready = isSupabaseReady;
  const [list, setList] = useState<RkaKapal[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    try { const a = localStorage.getItem(LS); if (a) setList(JSON.parse(a)); } catch {}
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data } = await supabase.from("projects").select("id,payload")
        .filter("payload->>kind", "eq", "rka_usulan");
      const rows: RkaKapal[] = (data || []).map((r: any) => r.payload?.doc).filter((x: any) => x?.id);
      rows.sort((a, b) => (b.tahun - a.tahun) || a.kapal.localeCompare(b.kapal));
      setList(rows);
      try { localStorage.setItem(LS, JSON.stringify(rows)); } catch {}
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const simpan = useCallback(async (d: RkaKapal) => {
    setErr("");
    const doc: RkaKapal = { ...d, diubahPada: new Date().toISOString() };
    setList((prev) => {
      const next = [doc, ...prev.filter((x) => x.id !== doc.id)]
        .sort((a, b) => (b.tahun - a.tahun) || a.kapal.localeCompare(b.kapal));
      try { localStorage.setItem(LS, JSON.stringify(next)); } catch {}
      return next;
    });
    if (!supabase) return;
    try {
      const { data: ex } = await supabase.from("projects").select("id")
        .filter("payload->>kind", "eq", "rka_usulan").filter("payload->>docId", "eq", doc.id).limit(1);
      const payload = { kind: "rka_usulan", docId: doc.id, doc };
      const nama = `RKA ${doc.tahun} ${doc.kapal}`;
      if (ex && ex[0]) await supabase.from("projects").update({ payload }).eq("id", ex[0].id);
      else await supabase.from("projects").insert({ nama_kapal: nama, tahun: doc.tahun, payload });
      catatBackup("rka_usulan", ex?.[0]?.id, payload, nama);
    } catch (e: any) { setErr(e?.message || String(e)); throw e; }
  }, []);

  const hapus = useCallback(async (id: string) => {
    setList((prev) => { const n = prev.filter((x) => x.id !== id); try { localStorage.setItem(LS, JSON.stringify(n)); } catch {} return n; });
    if (!supabase) return;
    const { data: ex } = await supabase.from("projects").select("id")
      .filter("payload->>kind", "eq", "rka_usulan").filter("payload->>docId", "eq", id).limit(1);
    if (ex && ex[0]) await supabase.from("projects").delete().eq("id", ex[0].id);
  }, []);

  return { ready, loading, err, list, reload: load, simpan, hapus };
}
