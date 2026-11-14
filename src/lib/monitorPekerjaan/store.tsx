"use client";
/**
 * Penyimpanan Monitor Pekerjaan — mengikuti pola modul Temuan.
 *
 * Menumpang tabel `projects` dengan payload.kind = "monitor_pekerjaan"; baris
 * jenis lain tidak pernah dibaca maupun disentuh dari sini. Tanpa Supabase,
 * data jatuh ke salinan lokal peramban supaya halaman tetap bisa dipakai.
 *
 * Penyedianya dipasang di halaman /monitor-pekerjaan sendiri, bukan di rangka
 * aplikasi: tidak ada halaman lain yang membutuhkan daftar ini, jadi tak perlu
 * ikut dimuat di setiap halaman.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { KIND_MONITOR, Pekerjaan, dariPayload, rapikan } from "./types";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { catatBackup } from "@/lib/backup/local";
import { beritahu } from "@/components/Konfirmasi";

const LS_KEY = "monitor_pekerjaan";

interface Ctx {
  items: Pekerjaan[];
  loading: boolean;
  galat: string;
  refresh: () => Promise<void>;
  /** true bila tersimpan */
  simpan: (p: Pekerjaan) => Promise<boolean>;
  hapus: (id: string) => Promise<void>;
  supabaseReady: boolean;
}
const C = createContext<Ctx | null>(null);

const lsBaca = (): Pekerjaan[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    return Array.isArray(raw) ? raw.map((r: any) => dariPayload(String(r.id), r)) : [];
  } catch { return []; }
};
const lsTulis = (items: Pekerjaan[]) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch { /* kuota penuh */ }
};

export function MonitorPekerjaanProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Pekerjaan[]>([]);
  const [loading, setLoading] = useState(false);
  const [galat, setGalat] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase) { setItems(lsBaca()); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from("projects")
        .select("id,payload,created_at")
        .filter("payload->>kind", "eq", KIND_MONITOR)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems((data ?? []).map((r: any) => dariPayload(r.id, r.payload)));
      setGalat("");
    } catch (e: any) {
      console.error("[monitor-pekerjaan] gagal memuat", e);
      setGalat(e?.message || "gagal memuat daftar pekerjaan");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const simpan = async (p: Pekerjaan): Promise<boolean> => {
    const now = new Date().toISOString();
    const item: Pekerjaan = { ...rapikan(p), createdAt: p.createdAt || now, updatedAt: now };
    if (!supabase) {
      const cur = lsBaca();
      const i = cur.findIndex((x) => x.id === item.id);
      if (i >= 0) cur[i] = item; else cur.unshift(item);
      lsTulis(cur); setItems(cur); return true;
    }
    const payload = { ...item, kind: KIND_MONITOR };
    const tahun = parseInt((item.tenggat || item.tglMulai || now).slice(0, 4)) || null;
    const { error } = await supabase.from("projects").upsert({
      id: item.id, nama_kapal: item.judul, tahun, payload,
    });
    if (error) { void beritahu("Gagal simpan: " + error.message); return false; }
    catatBackup(KIND_MONITOR, item.id, payload, item.judul);
    // pasang langsung di daftar supaya tidak menunggu muat ulang penuh
    setItems((cur) => {
      const i = cur.findIndex((x) => x.id === item.id);
      if (i < 0) return [item, ...cur];
      const baru = cur.slice(); baru[i] = item; return baru;
    });
    return true;
  };

  const hapus = async (id: string) => {
    if (!supabase) {
      const cur = lsBaca().filter((x) => x.id !== id);
      lsTulis(cur); setItems(cur); return;
    }
    // penjaga: hanya baris berjenis monitor_pekerjaan yang boleh terhapus dari sini
    const { error } = await supabase.from("projects").delete()
      .eq("id", id).filter("payload->>kind", "eq", KIND_MONITOR);
    if (error) { void beritahu("Gagal hapus: " + error.message); return; }
    setItems((cur) => cur.filter((x) => x.id !== id));
  };

  return (
    <C.Provider value={{ items, loading, galat, refresh, simpan, hapus, supabaseReady: isSupabaseReady }}>
      {children}
    </C.Provider>
  );
}

export function useMonitorPekerjaan() {
  const c = useContext(C);
  if (!c) throw new Error("useMonitorPekerjaan harus di dalam MonitorPekerjaanProvider");
  return c;
}

/* ── nama pemakai peramban ini ───────────────────────────────────────────── */

const LS_NAMA = "monitor_pekerjaan:nama";
export const NAMA_BAWAAN = "Irsan";

/**
 * Nama pemakai untuk isian Pemilik bawaan dan saringan "Pekerjaan saya".
 *
 * Akun aplikasi dipakai bersama satu bagian, jadi sesi masuk tidak membawa
 * nama orangnya. Nama disimpan per peramban — tiap laptop atau HP diisi sekali.
 */
export function useNamaSaya(): [string, (n: string) => void] {
  const [nama, setNama] = useState(NAMA_BAWAAN);
  useEffect(() => {
    try { const n = localStorage.getItem(LS_NAMA); if (n) setNama(n); } catch { /* mode penyamaran */ }
  }, []);
  const ganti = (n: string) => {
    const bersih = n.trim() || NAMA_BAWAAN;
    setNama(bersih);
    try { localStorage.setItem(LS_NAMA, bersih); } catch { /* mode penyamaran */ }
  };
  return [nama, ganti];
}
