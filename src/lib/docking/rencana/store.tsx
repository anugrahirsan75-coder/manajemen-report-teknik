"use client";
/**
 * Penyimpanan Perencanaan Docking — kind="docking_rencana", satu baris = satu
 * kapal x satu tahun. Pola sama dengan modul lain: localStorage dulu supaya
 * halaman langsung terisi, Supabase sebagai pemegang data sebenarnya.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { catatBackup } from "@/lib/backup/local";
import { RencanaDocking } from "./types";

const LS = "docking_rencana";
const KIND = "docking_rencana";

const bacaLokal = (): RencanaDocking[] => {
  try { const a = localStorage.getItem(LS); return a ? JSON.parse(a) : []; } catch { return []; }
};
const tulisLokal = (v: unknown) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };
const urut = (a: RencanaDocking, b: RencanaDocking) =>
  (b.tahun - a.tahun) || (a.naikDok || "9999").localeCompare(b.naikDok || "9999") || a.kapal.localeCompare(b.kapal);

export function useRencanaDocking() {
  const ready = isSupabaseReady;
  const [list, setList] = useState<RencanaDocking[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { setList(bacaLokal()); }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from("projects").select("id,payload")
        .filter("payload->>kind", "eq", KIND);
      if (error) throw error;
      const rows: RencanaDocking[] = (data || []).map((r: any) => r.payload?.doc).filter((x: any) => x?.id);
      rows.sort(urut);
      setList(rows); tulisLokal(rows);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const simpan = useCallback(async (r: RencanaDocking) => {
    setErr("");
    const doc: RencanaDocking = { ...r, diubahPada: new Date().toISOString() };
    setList((prev) => { const n = [doc, ...prev.filter((x) => x.id !== doc.id)].sort(urut); tulisLokal(n); return n; });
    if (!supabase) return;
    try {
      const { data: ex } = await supabase.from("projects").select("id")
        .filter("payload->>kind", "eq", KIND).filter("payload->>docId", "eq", doc.id).limit(1);
      const payload = { kind: KIND, docId: doc.id, doc };
      const nama = `RENCANA DOCKING ${doc.kapal} ${doc.tahun}`;
      if (ex && ex[0]) await supabase.from("projects").update({ payload }).eq("id", ex[0].id);
      else await supabase.from("projects").insert({ nama_kapal: nama, tahun: doc.tahun, payload });
      catatBackup(KIND, ex?.[0]?.id, payload, nama);
    } catch (e: any) { setErr(e?.message || String(e)); throw e; }
  }, []);

  const hapus = useCallback(async (id: string) => {
    setList((prev) => { const n = prev.filter((x) => x.id !== id); tulisLokal(n); return n; });
    if (!supabase) return;
    const { data: ex } = await supabase.from("projects").select("id")
      .filter("payload->>kind", "eq", KIND).filter("payload->>docId", "eq", id).limit(1);
    if (ex && ex[0]) await supabase.from("projects").delete().eq("id", ex[0].id);
  }, []);

  return { ready, loading, err, list, reload: load, simpan, hapus };
}
