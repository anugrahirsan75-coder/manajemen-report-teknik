"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { Ship, SHIP_SEED, slugKapal, terapkanBKI } from "./types";
import { catatBackup } from "@/lib/backup/local";

const LS_KEY = "ship_db";

/*
 * Gabung per MEDAN, bukan per blok.
 *
 * Dulu catatan tersimpan menimpa seed seluruhnya, jadi satu catatan lama yang
 * ditulis waktu setengah kolomnya masih kosong akan menutupi data BKI yang baru
 * masuk — layarnya jadi kosong padahal datanya ada. Sekarang isian kantor tetap
 * menang, tetapi hanya di kolom yang benar-benar berisi.
 */
const gabungGrup = <T extends Record<string, any>>(dasar: T, atas: any): T => {
  if (!atas) return dasar;
  const out: any = { ...dasar };
  Object.keys(atas).forEach((k) => { if (String(atas[k] ?? "").trim()) out[k] = atas[k]; });
  return out as T;
};

function merge(saved: Ship[]): Ship[] {
  const byId: Record<string, Ship> = {};
  SHIP_SEED.forEach((s) => (byId[s.id] = s));
  saved.forEach((s) => {
    if (!s?.id) return;
    const d = byId[s.id] || s;
    byId[s.id] = terapkanBKI({
      ...d, ...s, id: s.id,
      general: gabungGrup(d.general, s.general),
      dimension: gabungGrup(d.dimension, s.dimension),
      mainEngine: gabungGrup(d.mainEngine, s.mainEngine),
      auxEngine: gabungGrup(d.auxEngine, s.auxEngine),
      gearbox: gabungGrup(d.gearbox || {}, s.gearbox),
      shaft: gabungGrup(d.shaft || {}, s.shaft),
      inventaris: s.inventaris || d.inventaris || [],
    });
  });
  return Object.values(byId).sort((a, b) => a.nama.localeCompare(b.nama));
}

/* Blok BKI tidak ikut disimpan: ia dipasang ulang dari bki.ts tiap kali dimuat. */
const tanpaBKI = (list: Ship[]): Ship[] => list.map(({ bki, ...s }) => s as Ship);

export function useKapalDb() {
  const [ships, setShips] = useState<Ship[]>(SHIP_SEED);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);

  // load: localStorage dulu (instan) lalu supabase (otoritatif)
  useEffect(() => {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) setShips(merge(JSON.parse(raw))); } catch {}
    (async () => {
      if (!supabase) return;
      setLoading(true);
      try {
        const { data } = await supabase.from("projects").select("id,payload").filter("payload->>kind", "eq", "kapal").limit(1);
        const row = (data || [])[0];
        if (row?.payload?.ships) { setRowId(row.id); setShips(merge(row.payload.ships)); }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const persistLocal = (list: Ship[]) => { try { localStorage.setItem(LS_KEY, JSON.stringify(tanpaBKI(list))); } catch {} };

  const updateShip = useCallback((id: string, next: Ship) => {
    setShips((prev) => { const list = prev.map((s) => (s.id === id ? next : s)); persistLocal(list); return list; });
  }, []);

  const saveAll = useCallback(async (list?: Ship[]) => {
    const data = list || ships;
    persistLocal(data);
    if (!supabase) { setLastSaved("Lokal " + new Date().toLocaleTimeString("id-ID")); return; }
    setSaving(true);
    try {
      const payload = { kind: "kapal", ships: tanpaBKI(data) };
      if (rowId) await supabase.from("projects").update({ payload }).eq("id", rowId);
      else {
        const { data: ins } = await supabase.from("projects").insert({ nama_kapal: "SHIP DATABASE (meta)", tahun: new Date().getFullYear(), payload }).select("id").single();
        if (ins?.id) setRowId(ins.id);
      }
      catatBackup("kapal", rowId || undefined, payload, "SHIP DATABASE (meta)");
      setLastSaved("Supabase " + new Date().toLocaleTimeString("id-ID"));
    } catch (e: any) {
      setLastSaved("Lokal (gagal sync)");
    } finally { setSaving(false); }
  }, [ships, rowId]);

  return { ships, loading, saving, lastSaved, supabaseReady: isSupabaseReady, updateShip, saveAll };
}

export { slugKapal };
