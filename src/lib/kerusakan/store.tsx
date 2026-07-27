"use client";
/**
 * Penyimpanan Rekap Kerusakan Kapal.
 * 1 kejadian = 1 baris Supabase kind="kerusakan", supaya riwayat tiap kejadian berdiri
 * sendiri dan aman kalau diisi dari beberapa perangkat. Salinan lokal untuk offline.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { catatBackup } from "@/lib/backup/local";
import { Kerusakan } from "./types";

const LS = "kerusakan_kapal";

export function useKerusakan() {
  const ready = isSupabaseReady;
  const [list, setList] = useState<Kerusakan[]>([]);
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
        .filter("payload->>kind", "eq", "kerusakan").order("created_at", { ascending: false });
      const rows: Kerusakan[] = (data || []).map((r: any) => r.payload?.doc).filter((x: any) => x && x.id);
      rows.sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""));
      setList(rows);
      try { localStorage.setItem(LS, JSON.stringify(rows)); } catch {}
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const simpan = useCallback(async (k: Kerusakan) => {
    setErr("");
    const isi: Kerusakan = { ...k, diubahPada: new Date().toISOString() };
    setList((prev) => {
      const next = [isi, ...prev.filter((x) => x.id !== isi.id)]
        .sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""));
      try { localStorage.setItem(LS, JSON.stringify(next)); } catch {}
      return next;
    });
    if (!supabase) return;
    try {
      const { data: ex } = await supabase.from("projects").select("id")
        .filter("payload->>kind", "eq", "kerusakan").filter("payload->>docId", "eq", isi.id).limit(1);
      const payload = { kind: "kerusakan", docId: isi.id, doc: isi };
      const nama = `KERUSAKAN ${isi.kapal} — ${isi.tanggal}`;
      if (ex && ex[0]) await supabase.from("projects").update({ payload }).eq("id", ex[0].id);
      else await supabase.from("projects").insert({ nama_kapal: nama, tahun: +(isi.tanggal || "2026").slice(0, 4), payload });
      catatBackup("kerusakan", ex?.[0]?.id, payload, nama);
    } catch (e: any) { setErr(e?.message || String(e)); throw e; }
  }, []);

  const hapus = useCallback(async (id: string) => {
    setList((prev) => {
      const next = prev.filter((x) => x.id !== id);
      try { localStorage.setItem(LS, JSON.stringify(next)); } catch {}
      return next;
    });
    if (!supabase) return;
    const { data: ex } = await supabase.from("projects").select("id")
      .filter("payload->>kind", "eq", "kerusakan").filter("payload->>docId", "eq", id).limit(1);
    if (ex && ex[0]) await supabase.from("projects").delete().eq("id", ex[0].id);
  }, []);

  return { ready, loading, list, err, reload: load, simpan, hapus };
}
