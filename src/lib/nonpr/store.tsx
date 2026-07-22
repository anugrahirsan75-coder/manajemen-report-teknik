"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { NonprRequest, NonprItem, emptyNonprItem, newNonprDraft } from "./types";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { catatBackup } from "@/lib/backup/local";

const LS_KEY = "nonpr_request";

interface Ctx {
  req: NonprRequest;
  update: (patch: Partial<NonprRequest>) => void;
  setItem: (id: string, patch: Partial<NonprItem>) => void;
  addItem: (kapal?: string) => void;
  delItem: (id: string) => void;
  setItems: (items: NonprItem[]) => void;
  saveRemote: () => Promise<void>;
  listRemote: () => Promise<any[]>;
  deleteRemote: (id: string) => Promise<void>;
  loadById: (row: any) => void;
  newDraft: () => void;
  supabaseReady: boolean;
  saving: boolean;
  lastSaved: string | null;
}
const C = createContext<Ctx | null>(null);

export function NonprProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<NonprRequest>(newNonprDraft);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) setReq({ ...newNonprDraft(), ...JSON.parse(raw) }); } catch {}
  }, []);
  const persist = (r: NonprRequest) => { try { localStorage.setItem(LS_KEY, JSON.stringify(r)); } catch {} };

  const update = (patch: Partial<NonprRequest>) => setReq((p) => { const n = { ...p, ...patch }; persist(n); return n; });
  const setItem = (id: string, patch: Partial<NonprItem>) => setReq((p) => { const n = { ...p, items: p.items.map((it) => it.id === id ? { ...it, ...patch } : it) }; persist(n); return n; });
  const addItem = (kapal = "") => setReq((p) => { const n = { ...p, items: [...p.items, emptyNonprItem(kapal)] }; persist(n); return n; });
  const delItem = (id: string) => setReq((p) => { const n = { ...p, items: p.items.filter((it) => it.id !== id) }; persist(n); return n; });
  const setItems = (items: NonprItem[]) => setReq((p) => { const n = { ...p, items }; persist(n); return n; });

  const saveRemote = async () => {
    if (!supabase) { persist(req); setLastSaved("Lokal " + new Date().toLocaleTimeString("id-ID")); return; }
    setSaving(true);
    try {
      const payload = { ...req, kind: "nonpr" };
      const { data: row, error } = await supabase.from("projects")
        .upsert({ id: req.id ?? undefined, nama_kapal: req.namaPengadaan, tahun: parseInt(req.tanggal.slice(0, 4)) || null, payload })
        .select().single();
      if (error) throw error;
      if (row?.id) update({ id: row.id });
      catatBackup("nonpr", row?.id ?? req.id, payload, req.namaPengadaan);
      setLastSaved("Supabase " + new Date().toLocaleTimeString("id-ID"));
    } catch (e: any) {
      alert("Gagal simpan: " + e.message + "\nData tersimpan lokal.");
      persist(req);
    } finally { setSaving(false); }
  };

  const listRemote = async (): Promise<any[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from("projects").select("id,nama_kapal,payload,created_at")
      .filter("payload->>kind", "eq", "nonpr").order("created_at", { ascending: false });
    if (error) { alert("Gagal muat riwayat: " + error.message); return []; }
    return (data ?? []).map((r: any) => ({ id: r.id, nama_pengadaan: r.nama_kapal, payload: r.payload, created_at: r.created_at }));
  };
  const deleteRemote = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) alert("Gagal hapus: " + error.message);
  };
  const loadById = (row: any) => { const n = { ...newNonprDraft(), ...row.payload, id: row.id }; if (!Array.isArray(n.items)) n.items = []; setReq(n); persist(n); };
  const newDraft = () => { const n = newNonprDraft(); setReq(n); persist(n); };

  return <C.Provider value={{ req, update, setItem, addItem, delItem, setItems, saveRemote, listRemote, deleteRemote, loadById, newDraft, supabaseReady: isSupabaseReady, saving, lastSaved }}>{children}</C.Provider>;
}

export function useNonpr() {
  const c = useContext(C);
  if (!c) throw new Error("useNonpr harus di dalam NonprProvider");
  return c;
}
