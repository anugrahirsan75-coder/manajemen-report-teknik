"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { ProjectData } from "./types";
import { sampleData } from "./sampleData";
import { supabase, isSupabaseReady } from "./supabase";
import { beritahu } from "@/components/Konfirmasi";

const LS_KEY = "swakelola_project";

/** satu baris rekap pekerjaan swakelola yang pernah disimpan */
export interface ProyekRingkas {
  id: string;
  namaKapal: string;
  tahun: number;
  nomorSpk: string;
  nilai: number;
  tanggalMulai: string;
  tanggalSelesai: string;
  jmlCrew: number;
  jmlPekerjaan: number;
  jmlFoto: number;
  dibuatPada: string;
}

interface StoreCtx {
  data: ProjectData;
  setData: (d: ProjectData) => void;
  update: (patch: Partial<ProjectData>) => void;
  saving: boolean;
  saveRemote: () => Promise<void>;
  loadRemote: () => Promise<void>;
  listProyek: () => Promise<ProyekRingkas[]>;
  bukaProyek: (id: string) => Promise<void>;
  hapusProyek: (id: string) => Promise<void>;
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
      void beritahu("Gagal simpan ke Supabase: " + e.message + "\nData tersimpan lokal.");
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
      void beritahu("Gagal load: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ---- rekap pekerjaan swakelola yang pernah disimpan ----
  // Baris swakelola = baris projects TANPA payload.kind (modul lain selalu memberi kind).
  const listProyek = async (): Promise<ProyekRingkas[]> => {
    if (!supabase) return [];
    const { data: rows, error } = await supabase
      .from("projects").select("id,nama_kapal,tahun,created_at,payload")
      .filter("payload->>kind", "is", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (rows || []).map((r: any) => {
      const p = r.payload || {};
      return {
        id: r.id,
        namaKapal: p.namaKapal || r.nama_kapal || "(tanpa kapal)",
        tahun: p.tahun || r.tahun || 0,
        nomorSpk: p.nomorSpk || "",
        nilai: p.biayaPekerjaan || p.distribusi?.nilaiSwakelola || 0,
        tanggalMulai: p.tanggalMulai || "",
        tanggalSelesai: p.tanggalSelesai || "",
        jmlCrew: (p.crew || []).length,
        jmlPekerjaan: (p.pekerjaanDeck || []).length + (p.pekerjaanMesin || []).length,
        jmlFoto: (p.fotoDok || []).length,
        dibuatPada: r.created_at || "",
      };
    });
  };

  const bukaProyek = async (id: string) => {
    if (!supabase) return;
    setSaving(true);
    try {
      const { data: row, error } = await supabase.from("projects").select("id,payload").eq("id", id).single();
      if (error) throw error;
      if (row?.payload) setData({ ...sampleData, ...row.payload, id: row.id });
    } finally { setSaving(false); }
  };

  const hapusProyek = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
    // kalau yang dihapus sedang dibuka, lepaskan id-nya supaya simpan berikutnya bikin baris baru
    if (data.id === id) update({ id: undefined });
  };

  return (
    <Ctx.Provider value={{ data, setData, update, saving, saveRemote, loadRemote, listProyek, bukaProyek, hapusProyek, supabaseReady: isSupabaseReady, lastSaved }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore harus di dalam StoreProvider");
  return c;
}
