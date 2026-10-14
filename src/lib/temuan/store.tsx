"use client";
/**
 * Penyimpanan temuan kapal — mengikuti pola modul servis.
 *
 * Datanya menumpang tabel `projects` yang sama seperti modul lain, dibedakan
 * oleh payload.kind = "temuan". Tanpa Supabase, data jatuh ke salinan lokal
 * supaya cabang tetap bisa mencatat saat jaringan mati — temuan yang baru
 * ditemukan tidak boleh hilang hanya karena internet sedang putus.
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TemuanItem } from "./types";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { catatBackup } from "@/lib/backup/local";
import { beritahu } from "@/components/Konfirmasi";

const LS_KEY = "temuan_kapal";

interface Ctx {
  items: TemuanItem[];
  loading: boolean;
  galat: string;
  refresh: () => Promise<void>;
  simpan: (it: TemuanItem) => Promise<void>;
  hapus: (id: string) => Promise<void>;
  supabaseReady: boolean;
}
const C = createContext<Ctx | null>(null);

const lsBaca = (): TemuanItem[] => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
};
const lsTulis = (items: TemuanItem[]) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch { /* kuota penuh */ }
};

export function TemuanProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "";
  const [items, setItems] = useState<TemuanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [galat, setGalat] = useState("");

  const refresh = async () => {
    if (!supabase) { setItems(lsBaca()); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from("projects")
        .select("id,payload,created_at")
        .filter("payload->>kind", "eq", "temuan")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems((data ?? []).map((r: any) => ({ ...r.payload, id: r.id })));
    } catch (e: any) {
      // gagal memuat di latar tidak menyela dengan dialog — lihat modul servis
      console.error("[temuan] gagal memuat", e);
      setGalat(e?.message || "gagal memuat data temuan");
      setItems(lsBaca());
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (path.startsWith("/temuan")) void refresh();
    /* eslint-disable-next-line */
  }, [path]);

  const simpan = async (it: TemuanItem) => {
    const now = new Date().toISOString();
    const item: TemuanItem = { ...it, createdAt: it.createdAt || now, updatedAt: now };
    if (!supabase) {
      const cur = lsBaca();
      const i = cur.findIndex((x) => x.id === item.id);
      if (i >= 0) cur[i] = item; else cur.unshift(item);
      lsTulis(cur); setItems(cur); return;
    }
    const payload = { ...item, kind: "temuan" };
    const { error } = await supabase.from("projects").upsert({
      id: item.id, nama_kapal: item.kapal,
      tahun: parseInt((item.tglTemuan || "").slice(0, 4)) || null, payload,
    });
    if (error) { void beritahu("Gagal simpan: " + error.message); return; }
    catatBackup("temuan", item.id, payload, item.kapal);
    await refresh();
  };

  const hapus = async (id: string) => {
    if (!supabase) {
      const cur = lsBaca().filter((x) => x.id !== id);
      lsTulis(cur); setItems(cur); return;
    }
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { void beritahu("Gagal hapus: " + error.message); return; }
    await refresh();
  };

  return (
    <C.Provider value={{ items, loading, galat, refresh, simpan, hapus, supabaseReady: isSupabaseReady }}>
      {children}
    </C.Provider>
  );
}

export function useTemuan() {
  const c = useContext(C);
  if (!c) throw new Error("useTemuan harus di dalam TemuanProvider");
  return c;
}
