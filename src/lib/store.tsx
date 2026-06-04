"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { ProjectData } from "./types";
import { sampleData } from "./sampleData";
import { supabase, isSupabaseReady } from "./supabase";

const LS_KEY = "swakelola_project";

interface StoreCtx {
  data: ProjectData;
  setData: (d: ProjectData) => void;
  update: (patch: Partial<ProjectData>) => void;
  saving: boolean;
  saveRemote: () => Promise<void>;
  loadRemote: () => Promise<void>;
  supabaseReady: boolean;
  lastSaved: string | null;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setDataState] = useState<ProjectData>(sampleData);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // load dari localStorage saat mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setDataState({ ...sampleData, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const persistLocal = (d: ProjectData) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(d));
    } catch {}
  };

  const setData = (d: ProjectData) => {
    setDataState(d);
    persistLocal(d);
  };

  const update = (patch: Partial<ProjectData>) => {
    setDataState((prev) => {
      const next = { ...prev, ...patch };
      persistLocal(next);
      return next;
    });
  };

  const saveRemote = async () => {
    if (!supabase) {
      persistLocal(data);
      setLastSaved("Lokal " + new Date().toLocaleTimeString("id-ID"));
      return;
    }
    setSaving(true);
    try {
      const payload = { id: data.id ?? undefined, nama_kapal: data.namaKapal, tahun: data.tahun, payload: data };
      const { data: row, error } = await supabase
        .from("projects")
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      if (row?.id) update({ id: row.id });
      setLastSaved("Supabase " + new Date().toLocaleTimeString("id-ID"));
    } catch (e: any) {
      alert("Gagal simpan ke Supabase: " + e.message + "\nData tersimpan lokal.");
      persistLocal(data);
    } finally {
      setSaving(false);
    }
  };

  const loadRemote = async () => {
    if (!supabase) return;
    setSaving(true);
    try {
      const { data: rows, error } = await supabase
        .from("projects")
        .select("*")
        .filter("payload->>kind", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      if (rows && rows[0]?.payload) setData({ ...rows[0].payload, id: rows[0].id });
    } catch (e: any) {
      alert("Gagal load: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Ctx.Provider value={{ data, setData, update, saving, saveRemote, loadRemote, supabaseReady: isSupabaseReady, lastSaved }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore harus di dalam StoreProvider");
  return c;
}
