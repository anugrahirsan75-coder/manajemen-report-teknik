"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { SppbjRequest, SppbjItem, emptySppbjItem } from "./types";
import { DEPT_HEAD, STAF_TEKNIK } from "./db";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { catatBackup } from "@/lib/backup/local";

const LS_KEY = "sppbj_request";

function defaultReq(): SppbjRequest {
  return {
    status: "menunggu_spbj",
    tanggal: new Date().toISOString().slice(0, 10),
    noSPPBJ: "",
    namaPengadaan: "Jasa Perbaikan Akomodasi Kapal Ternate",
    dasarPelimpahan: "Persetujuan Rutin Kapal",
    mataAnggaran: ["5010403009 (Akomodasi, Peralatan & Perlengkapan Kapal)"],
    noDRP: "",
    stafTeknik: STAF_TEKNIK[0],
    deptHead: DEPT_HEAD,
    items: [
      { ...emptySppbjItem("KMP. LEMA"), jumlah: 1, satuan: "unit", nama: "Ganti Kunci + Hendle (lengkap set)", harga: 550000 },
      { ...emptySppbjItem("KMP. TUNA"), jumlah: 20, satuan: "m", nama: "Pasang Kaca Flim Riben", harga: 235000 },
    ],
  };
}

interface Ctx {
  req: SppbjRequest;
  update: (patch: Partial<SppbjRequest>) => void;
  setItem: (id: string, patch: Partial<SppbjItem>) => void;
  addItem: (kapal?: string) => void;
  delItem: (id: string) => void;
  setItems: (items: SppbjItem[]) => void;
  saveRemote: () => Promise<void>;
  loadRemote: () => Promise<void>;
  listRemote: () => Promise<any[]>;
  deleteRemote: (id: string) => Promise<void>;
  loadById: (row: any) => void;
  newDraft: () => void;
  supabaseReady: boolean;
  saving: boolean;
  lastSaved: string | null;
}
const C = createContext<Ctx | null>(null);

export function SppbjProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<SppbjRequest>(defaultReq);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) setReq({ ...defaultReq(), ...JSON.parse(raw) }); } catch {}
  }, []);
  const persist = (r: SppbjRequest) => { try { localStorage.setItem(LS_KEY, JSON.stringify(r)); } catch {} };

  const update = (patch: Partial<SppbjRequest>) => setReq((p) => { const n = { ...p, ...patch }; persist(n); return n; });
  const setItem = (id: string, patch: Partial<SppbjItem>) => setReq((p) => { const n = { ...p, items: p.items.map((it) => it.id === id ? { ...it, ...patch } : it) }; persist(n); return n; });
  const addItem = (kapal = "") => setReq((p) => { const n = { ...p, items: [...p.items, emptySppbjItem(kapal)] }; persist(n); return n; });
  const delItem = (id: string) => setReq((p) => { const n = { ...p, items: p.items.filter((it) => it.id !== id) }; persist(n); return n; });
  const setItems = (items: SppbjItem[]) => setReq((p) => { const n = { ...p, items }; persist(n); return n; });

  // Pakai tabel `projects` yang sudah ada (tag kind=sppbj) — tanpa perlu buat tabel baru.
  const saveRemote = async () => {
    if (!supabase) { persist(req); setLastSaved("Lokal " + new Date().toLocaleTimeString("id-ID")); return; }
    setSaving(true);
    try {
      const payload = { ...req, kind: "sppbj" };
      const { data: row, error } = await supabase.from("projects")
        .upsert({ id: req.id ?? undefined, nama_kapal: req.namaPengadaan, tahun: parseInt(req.tanggal.slice(0, 4)) || null, payload })
        .select().single();
      if (error) throw error;
      if (row?.id) update({ id: row.id });
      catatBackup("sppbj", row?.id ?? req.id, payload, req.namaPengadaan);
      setLastSaved("Supabase " + new Date().toLocaleTimeString("id-ID"));
    } catch (e: any) {
      alert("Gagal simpan: " + e.message + "\nData tersimpan lokal.");
      persist(req);
    } finally { setSaving(false); }
  };

  const loadRemote = async () => {
    const list = await listRemote();
    if (list[0]) loadById(list[0]);
  };

  const listRemote = async (): Promise<any[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from("projects").select("id,nama_kapal,payload,created_at")
      .filter("payload->>kind", "eq", "sppbj").order("created_at", { ascending: false });
    if (error) { alert("Gagal muat riwayat: " + error.message); return []; }
    return (data ?? []).map((r: any) => ({ id: r.id, nama_pengadaan: r.nama_kapal, status: r.payload?.status, payload: r.payload, created_at: r.created_at }));
  };
  const deleteRemote = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) alert("Gagal hapus: " + error.message);
  };
  const loadById = (row: any) => { const n = { ...defaultReq(), ...row.payload, id: row.id }; if (!Array.isArray(n.items)) n.items = []; setReq(n); persist(n); };
  const newDraft = () => { const n = defaultReq(); setReq(n); persist(n); };

  return <C.Provider value={{ req, update, setItem, addItem, delItem, setItems, saveRemote, loadRemote, listRemote, deleteRemote, loadById, newDraft, supabaseReady: isSupabaseReady, saving, lastSaved }}>{children}</C.Provider>;
}

export function useSppbj() {
  const c = useContext(C);
  if (!c) throw new Error("useSppbj harus di dalam SppbjProvider");
  return c;
}
