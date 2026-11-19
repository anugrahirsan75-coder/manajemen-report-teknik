"use client";
/**
 * Penyimpanan Monitoring Permohonan Cabang — pola sama dengan Monitor Pekerjaan.
 *
 * Menumpang tabel `projects` dengan payload.kind = "permohonan_cabang"; baris
 * jenis lain tidak pernah dibaca maupun disentuh dari sini. Tanpa Supabase,
 * data jatuh ke salinan lokal peramban.
 *
 * Setiap simpanan langsung diteruskan ke spreadsheet "Kontrol Permohonan
 * Ternate 2026" lewat /api/permohonan-cabang/sync. Gagal menulis ke spreadsheet
 * tidak membatalkan simpanan di aplikasi; keadaannya dicatat di `sinkron` dan
 * bisa dikirim ulang dari halaman.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { KIND_PERMOHONAN, Permohonan, Sinkron, dariBarisSheet, dariPayload, keBarisSheet, kunciJudul, rapikan } from "./types";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { catatBackup } from "@/lib/backup/local";
import { beritahu } from "@/components/Konfirmasi";

const LS_KEY = "permohonan_cabang";
const LS_SHEET = "permohonan_cabang_sheet_url";

export interface HasilSync { ok: boolean; pesan: string; baris: Record<string, number>; sheetUrl?: string }

/** kirim baris ke spreadsheet; tidak pernah melempar */
export async function kirimKeSheet(items: Permohonan[]): Promise<HasilSync> {
  try {
    const res = await fetch("/api/permohonan-cabang/sync", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permohonan: items.map(keBarisSheet) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, pesan: data.error || `HTTP ${res.status}`, baris: {} };
    const baris: Record<string, number> = {};
    for (const r of data.hasil || []) if (r?.id && r?.baris) baris[r.id] = Number(r.baris);
    return { ok: true, pesan: "tersimpan di spreadsheet", baris, sheetUrl: data.sheetUrl || "" };
  } catch (e: any) {
    return { ok: false, pesan: e?.message || "gagal menghubungi server", baris: {} };
  }
}

interface Ctx {
  items: Permohonan[];
  loading: boolean;
  galat: string;
  sheetUrl: string;
  refresh: () => Promise<void>;
  /** simpan ke aplikasi lalu ke spreadsheet; true bila tersimpan di aplikasi */
  simpan: (p: Permohonan) => Promise<boolean>;
  hapus: (id: string) => Promise<void>;
  /** kirim ulang baris yang belum/gagal tersinkron (atau semua) */
  kirimUlang: (ids?: string[]) => Promise<HasilSync>;
  /** tarik isi spreadsheet ke aplikasi; balikan jumlah baru & diperbarui */
  tarik: () => Promise<{ ok: boolean; pesan: string }>;
  supabaseReady: boolean;
}
const C = createContext<Ctx | null>(null);

const lsBaca = (): Permohonan[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    return Array.isArray(raw) ? raw.map((r: any) => dariPayload(String(r.id), r)) : [];
  } catch { return []; }
};
const lsTulis = (items: Permohonan[]) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch { /* kuota penuh */ }
};

export function PermohonanCabangProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Permohonan[]>([]);
  const [loading, setLoading] = useState(false);
  const [galat, setGalat] = useState("");
  const [sheetUrl, setSheetUrlState] = useState("");

  // URL spreadsheet baru diketahui dari jawaban Apps Script; diingat di peramban
  // supaya tombol "Buka spreadsheet" tetap ada setelah halaman dimuat ulang
  useEffect(() => {
    try { const u = localStorage.getItem(LS_SHEET); if (u && u.startsWith("https://")) setSheetUrlState(u); } catch { /* abaikan */ }
  }, []);
  const setSheetUrl = useCallback((u: string) => {
    setSheetUrlState(u);
    try { localStorage.setItem(LS_SHEET, u); } catch { /* abaikan */ }
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) { setItems(lsBaca()); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from("projects")
        .select("id,payload,created_at")
        .filter("payload->>kind", "eq", KIND_PERMOHONAN)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems((data ?? []).map((r: any) => dariPayload(r.id, r.payload)));
      setGalat("");
    } catch (e: any) {
      console.error("[permohonan-cabang] gagal memuat", e);
      setGalat(e?.message || "gagal memuat daftar permohonan");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /** tulis ke basis data saja (tanpa spreadsheet) */
  const tulisDb = async (list: Permohonan[]): Promise<boolean> => {
    if (!list.length) return true;
    if (!supabase) {
      const cur = lsBaca();
      for (const it of list) {
        const i = cur.findIndex((x) => x.id === it.id);
        if (i >= 0) cur[i] = it; else cur.unshift(it);
      }
      lsTulis(cur); setItems(cur); return true;
    }
    const rows = list.map((it) => ({
      id: it.id, nama_kapal: it.judul,
      tahun: parseInt((it.tglPengajuan || new Date().toISOString()).slice(0, 4)) || null,
      payload: { ...it, kind: KIND_PERMOHONAN },
    }));
    const { error } = await supabase.from("projects").upsert(rows);
    if (error) { void beritahu("Gagal simpan: " + error.message); return false; }
    for (const it of list) catatBackup(KIND_PERMOHONAN, it.id, { ...it, kind: KIND_PERMOHONAN }, it.judul);
    setItems((cur) => {
      const baru = cur.slice();
      for (const it of list) {
        const i = baru.findIndex((x) => x.id === it.id);
        if (i < 0) baru.unshift(it); else baru[i] = it;
      }
      return baru;
    });
    return true;
  };

  /** kirim ke spreadsheet lalu catat hasilnya di tiap item */
  const sinkronkan = async (list: Permohonan[]): Promise<HasilSync> => {
    const h = await kirimKeSheet(list);
    if (h.sheetUrl) setSheetUrl(h.sheetUrl);
    const waktu = new Date().toISOString();
    const dicatat = list.map((it) => {
      const s: Sinkron = h.ok
        ? { ok: !!h.baris[it.id], pesan: h.baris[it.id] ? h.pesan : "tidak ada balasan untuk baris ini", baris: h.baris[it.id], waktu }
        : { ok: false, pesan: h.pesan, waktu };
      return { ...it, sinkron: s };
    });
    await tulisDb(dicatat);
    return h;
  };

  const simpan = async (p: Permohonan): Promise<boolean> => {
    const now = new Date().toISOString();
    const item: Permohonan = { ...rapikan(p), createdAt: p.createdAt || now, updatedAt: now };
    if (!(await tulisDb([item]))) return false;
    const h = await sinkronkan([item]);
    if (!h.ok) void beritahu("Tersimpan di aplikasi, tetapi belum masuk spreadsheet: " + h.pesan);
    return true;
  };

  const hapus = async (id: string) => {
    if (!supabase) {
      const cur = lsBaca().filter((x) => x.id !== id);
      lsTulis(cur); setItems(cur); return;
    }
    // penjaga: hanya baris berjenis permohonan_cabang yang boleh terhapus dari sini
    const { error } = await supabase.from("projects").delete()
      .eq("id", id).filter("payload->>kind", "eq", KIND_PERMOHONAN);
    if (error) { void beritahu("Gagal hapus: " + error.message); return; }
    setItems((cur) => cur.filter((x) => x.id !== id));
  };

  const kirimUlang = async (ids?: string[]) => {
    const list = ids ? items.filter((x) => ids.includes(x.id)) : items;
    if (!list.length) return { ok: true, pesan: "tidak ada yang dikirim", baris: {} };
    return sinkronkan(list);
  };

  const tarik = async () => {
    let data: any;
    try {
      const res = await fetch("/api/permohonan-cabang/sync", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tarik: true }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, pesan: data.error || `HTTP ${res.status}` };
    } catch (e: any) { return { ok: false, pesan: e?.message || "gagal menghubungi server" }; }
    if (data.sheetUrl) setSheetUrl(data.sheetUrl);
    const baris: any[] = Array.isArray(data.baris) ? data.baris : [];
    const byId = new Map(items.map((x) => [x.id, x]));
    const byJudul = new Map(items.map((x) => [kunciJudul(x.judul), x]));
    const masuk: Permohonan[] = [];
    let baru = 0, ubah = 0;
    const now = new Date().toISOString();
    for (const b of baris) {
      if (!String(b?.judul || "").trim()) continue;
      const lama = (b.id && byId.get(b.id)) || byJudul.get(kunciJudul(b.judul));
      const p = dariBarisSheet(b, lama?.id);
      // isian khusus aplikasi yang tak punya kolom di spreadsheet tetap dipertahankan
      const gabung: Permohonan = {
        ...p, kapal: lama?.kapal || [], nomorSurat: p.nomorSurat || lama?.nomorSurat || "",
        createdAt: lama?.createdAt || now, updatedAt: now,
        sinkron: { ok: true, pesan: "ditarik dari spreadsheet", baris: Number(b.baris) || undefined, waktu: now },
      };
      if (lama) ubah++; else baru++;
      masuk.push(gabung);
    }
    if (!(await tulisDb(masuk))) return { ok: false, pesan: "gagal menyimpan hasil tarikan" };
    // tulis balik ID APLIKASI ke baris yang belum punya, supaya simpanan berikutnya mengenai baris yang sama
    const tanpaId = masuk.filter((p) => !baris.find((b) => b.id === p.id));
    if (tanpaId.length) await sinkronkan(tanpaId);
    return { ok: true, pesan: `${baris.length} baris dibaca — ${baru} baru, ${ubah} diperbarui` };
  };

  return (
    <C.Provider value={{ items, loading, galat, sheetUrl, refresh, simpan, hapus, kirimUlang, tarik, supabaseReady: isSupabaseReady }}>
      {children}
    </C.Provider>
  );
}

export function usePermohonanCabang() {
  const c = useContext(C);
  if (!c) throw new Error("usePermohonanCabang harus di dalam PermohonanCabangProvider");
  return c;
}
