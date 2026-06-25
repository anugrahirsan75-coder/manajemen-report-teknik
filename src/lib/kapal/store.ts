"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { Ship, SHIP_SEED, slugKapal } from "./types";

const LS_KEY = "ship_db";

// gabung seed + tersimpan (by id) -> seed jadi default, edit menimpa
function merge(saved: Ship[]): Ship[] {
  const byId: Record<string, Ship> = {};
  SHIP_SEED.forEach((s) => (byId[s.id] = s));
  saved.forEach((s) => { if (s?.id) byId[s.id] = { ...byId[s.id], ...s, id: s.id }; });
  return Object.values(byId).sort((a, b) => a.nama.localeCompare(b.nama));
}

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

  const persistLocal = (list: Ship[]) => { try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {} };

  const updateShip = useCallback((id: string, next: Ship) => {
    setShips((prev) => { const list = prev.map((s) => (s.id === id ? next : s)); persistLocal(list); return list; });
  }, []);

  const saveAll = useCallback(async (list?: Ship[]) => {
    const data = list || ships;
    persistLocal(data);
    if (!supabase) { setLastSaved("Lokal " + new Date().toLocaleTimeString("id-ID")); return; }
    setSaving(true);
    try {
      const payload = { kind: "kapal", ships: data };
      if (rowId) await supabase.from("projects").update({ payload }).eq("id", rowId);
      else {
        const { data: ins } = await supabase.from("projects").insert({ nama_kapal: "SHIP DATABASE (meta)", tahun: new Date().getFullYear(), payload }).select("id").single();
        if (ins?.id) setRowId(ins.id);
      }
      setLastSaved("Supabase " + new Date().toLocaleTimeString("id-ID"));
    } catch (e: any) {
      setLastSaved("Lokal (gagal sync)");
    } finally { setSaving(false); }
  }, [ships, rowId]);

  return { ships, loading, saving, lastSaved, supabaseReady: isSupabaseReady, updateShip, saveAll };
}

export { slugKapal };
