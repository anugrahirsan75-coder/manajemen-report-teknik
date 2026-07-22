"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { ServisItem } from "./types";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { catatBackup } from "@/lib/backup/local";

const LS_KEY = "servis_items";

interface Ctx {
  items: ServisItem[];
  loading: boolean;
  refresh: () => Promise<void>;
  saveItem: (it: ServisItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  editing: ServisItem | null;
  setEditing: (it: ServisItem | null) => void;
  supabaseReady: boolean;
}
const C = createContext<Ctx | null>(null);

const lsRead = (): ServisItem[] => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } };
const lsWrite = (items: ServisItem[]) => { try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {} };

export function ServisProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ServisItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ServisItem | null>(null);

  const refresh = async () => {
    if (!supabase) { setItems(lsRead()); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from("projects").select("id,payload,created_at")
        .filter("payload->>kind", "eq", "servis").order("created_at", { ascending: false });
      if (error) throw error;
      setItems((data ?? []).map((r: any) => ({ ...r.payload, id: r.id })));
    } catch (e: any) {
      alert("Gagal muat data servis: " + e.message);
      setItems(lsRead());
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const saveItem = async (it: ServisItem) => {
    const now = new Date().toISOString();
    const item = { ...it, createdAt: it.createdAt || now, updatedAt: now };
    if (!supabase) {
      const cur = lsRead();
      const idx = cur.findIndex((x) => x.id === item.id);
      if (idx >= 0) cur[idx] = item; else cur.unshift(item);
      lsWrite(cur); setItems(cur); return;
    }
    const payload = { ...item, kind: "servis" };
    const { error } = await supabase.from("projects").upsert({
      id: item.id, nama_kapal: item.namaBarang,
      tahun: parseInt((item.tanggalKirim || "").slice(0, 4)) || null, payload,
    });
    if (error) { alert("Gagal simpan: " + error.message); return; }
    catatBackup("servis", item.id, payload, item.namaBarang);
    await refresh();
  };

  const deleteItem = async (id: string) => {
    if (!supabase) { const cur = lsRead().filter((x) => x.id !== id); lsWrite(cur); setItems(cur); return; }
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { alert("Gagal hapus: " + error.message); return; }
    await refresh();
  };

  return <C.Provider value={{ items, loading, refresh, saveItem, deleteItem, editing, setEditing, supabaseReady: isSupabaseReady }}>{children}</C.Provider>;
}

export function useServis() {
  const c = useContext(C);
  if (!c) throw new Error("useServis harus di dalam ServisProvider");
  return c;
}
