"use client";
/**
 * Penyimpanan Monitoring Docking.
 *   kind="docking_jadwal"  -> 1 baris = 1 kapal x 1 tahun (milestone + berita acara)
 *   kind="kelas_bki"       -> 1 baris = 1 survey kelas (kapal x tahun x jenis)
 * Dipisah supaya riwayat kelas tetap utuh walau jadwal dockingnya dihapus.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { catatBackup } from "@/lib/backup/local";
import { DockingJadwal, KelasBki } from "./types";

const LS_DOK = "docking_jadwal";
const LS_KLS = "kelas_bki";

function bacaLokal<T>(k: string): T[] {
  try { const a = localStorage.getItem(k); return a ? JSON.parse(a) : []; } catch { return []; }
}
function tulisLokal(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

export function useDocking() {
  const ready = isSupabaseReady;
  const [jadwal, setJadwal] = useState<DockingJadwal[]>([]);
  const [kelas, setKelas] = useState<KelasBki[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setJadwal(bacaLokal<DockingJadwal>(LS_DOK));
    setKelas(bacaLokal<KelasBki>(LS_KLS));
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        supabase.from("projects").select("id,payload").filter("payload->>kind", "eq", "docking_jadwal"),
        supabase.from("projects").select("id,payload").filter("payload->>kind", "eq", "kelas_bki"),
      ]);
      const dj: DockingJadwal[] = (a.data || []).map((r: any) => r.payload?.doc).filter((x: any) => x?.id);
      const kb: KelasBki[] = (b.data || []).map((r: any) => r.payload?.doc).filter((x: any) => x?.id);
      dj.sort((x, y) => (y.tahun - x.tahun) || x.kapal.localeCompare(y.kapal));
      kb.sort((x, y) => (y.tahun - x.tahun) || x.kapal.localeCompare(y.kapal));
      setJadwal(dj); setKelas(kb);
      tulisLokal(LS_DOK, dj); tulisLokal(LS_KLS, kb);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** simpan 1 dokumen (jadwal / kelas) — pola upsert per docId seperti modul lain */
  const simpanUmum = useCallback(async <T extends { id: string; kapal: string; tahun: number }>(
    kind: "docking_jadwal" | "kelas_bki", isi: T, setter: (f: (p: T[]) => T[]) => void, ls: string,
  ) => {
    setErr("");
    const doc = { ...isi, diubahPada: new Date().toISOString() };
    setter((prev) => {
      const next = [doc, ...prev.filter((x) => x.id !== doc.id)]
        .sort((a, b) => (b.tahun - a.tahun) || a.kapal.localeCompare(b.kapal));
      tulisLokal(ls, next);
      return next;
    });
    if (!supabase) return;
    try {
      const { data: ex } = await supabase.from("projects").select("id")
        .filter("payload->>kind", "eq", kind).filter("payload->>docId", "eq", doc.id).limit(1);
      const payload = { kind, docId: doc.id, doc };
      const nama = `${kind === "kelas_bki" ? "KELAS" : "DOCKING"} ${doc.kapal} ${doc.tahun}`;
      if (ex && ex[0]) await supabase.from("projects").update({ payload }).eq("id", ex[0].id);
      else await supabase.from("projects").insert({ nama_kapal: nama, tahun: doc.tahun, payload });
      catatBackup(kind, ex?.[0]?.id, payload, nama);
    } catch (e: any) { setErr(e?.message || String(e)); throw e; }
  }, []);

  const simpanJadwal = useCallback((d: DockingJadwal) =>
    simpanUmum("docking_jadwal", d, setJadwal as any, LS_DOK), [simpanUmum]);
  const simpanKelas = useCallback((k: KelasBki) =>
    simpanUmum("kelas_bki", k, setKelas as any, LS_KLS), [simpanUmum]);

  const hapusUmum = useCallback(async (kind: string, id: string,
    setter: (f: (p: any[]) => any[]) => void, ls: string) => {
    setter((prev) => { const n = prev.filter((x) => x.id !== id); tulisLokal(ls, n); return n; });
    if (!supabase) return;
    const { data: ex } = await supabase.from("projects").select("id")
      .filter("payload->>kind", "eq", kind).filter("payload->>docId", "eq", id).limit(1);
    if (ex && ex[0]) await supabase.from("projects").delete().eq("id", ex[0].id);
  }, []);

  const hapusJadwal = useCallback((id: string) => hapusUmum("docking_jadwal", id, setJadwal as any, LS_DOK), [hapusUmum]);
  const hapusKelas = useCallback((id: string) => hapusUmum("kelas_bki", id, setKelas as any, LS_KLS), [hapusUmum]);

  return { ready, loading, err, jadwal, kelas, reload: load, simpanJadwal, simpanKelas, hapusJadwal, hapusKelas };
}
