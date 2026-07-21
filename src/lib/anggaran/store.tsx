"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { RKA, RREntry, PlafonRutin, maKey } from "./types";

const LS_RKA = "anggaran_rka";
const LS_RR = "anggaran_rr";
const LS_PLAFON = "anggaran_plafon";

export interface PengadaanRow {
  id: string;
  sumber: "SPPBJ" | "Non PR PO";
  nama: string;
  tanggal: string;
  mataAnggaran: string[]; // label2
  kategoriRekap: string;  // "RUTIN" / "DOCKING(BIAYA)" / ...
  items: any[];           // {kapal,jumlah,harga,hargaSpbj?}
}

function rowsFromProjects(data: any[]): PengadaanRow[] {
  return (data || []).map((r) => {
    const p = r.payload || {};
    const sumber = p.kind === "nonpr" ? "Non PR PO" : "SPPBJ";
    const ma = Array.isArray(p.mataAnggaran) ? p.mataAnggaran : p.mataAnggaran ? [p.mataAnggaran] : [];
    return { id: r.id, sumber, nama: r.nama_kapal || p.namaPengadaan || "(tanpa nama)", tanggal: p.tanggal || "", mataAnggaran: ma, kategoriRekap: p.kategoriRekap || "", items: p.items || [] } as PengadaanRow;
  });
}

// nilai pengadaan: final (SPBJ) bila ada, else estimasi
export function nilaiPengadaan(items: any[]): number {
  const arr = items || [];
  const hasFinal = arr.some((it) => (it.hargaSpbj || 0) > 0);
  return arr.reduce((s, it) => s + (hasFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0)) * (it.jumlah || 0), 0);
}

export interface RealisasiItem { id: string; nama: string; ma: string; nilai: number; key: string; sumber: string; tanggal: string }
// realisasi RUTIN per kunci MA utk 1 bulan ("YYYY-MM") — SPPBJ + Non PR PO
export function realisasiRutin(rows: PengadaanRow[], bulan: string) {
  const perKey: Record<string, number> = {};
  const list: RealisasiItem[] = [];
  for (const p of rows) {
    // rutin = RUTIN atau TANPA kategori. DOCKING/INVESTASI dikecualikan (punya budget sendiri).
    if (/docking|investasi/i.test(p.kategoriRekap || "")) continue;
    if ((p.tanggal || "").slice(0, 7) !== bulan) continue;
    const nilai = nilaiPengadaan(p.items);
    if (nilai <= 0) continue;
    const ma = (p.mataAnggaran || [])[0] || "";
    const key = maKey(ma);
    perKey[key] = (perKey[key] || 0) + nilai;
    list.push({ id: p.id, nama: p.nama, ma, nilai, key, sumber: p.sumber, tanggal: p.tanggal });
  }
  list.sort((a, b) => b.nilai - a.nilai);
  const total = Object.values(perKey).reduce((s, v) => s + v, 0);
  return { perKey, list, total };
}

export function useAnggaran() {
  const ready = isSupabaseReady;
  const [pengadaan, setPengadaan] = useState<PengadaanRow[]>([]);
  const [rka, setRka] = useState<RKA>({ tahun: new Date().getFullYear(), nilai: {} });
  const [rr, setRr] = useState<RREntry[]>([]);
  const [plafon, setPlafon] = useState<PlafonRutin[]>([]);
  const [loading, setLoading] = useState(false);

  // muat lokal dulu (offline-ready)
  useEffect(() => {
    try { const a = localStorage.getItem(LS_RKA); if (a) setRka(JSON.parse(a)); } catch {}
    try { const b = localStorage.getItem(LS_RR); if (b) setRr(JSON.parse(b)); } catch {}
    try { const c = localStorage.getItem(LS_PLAFON); if (c) setPlafon(JSON.parse(c)); } catch {}
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data } = await supabase.from("projects").select("id,nama_kapal,payload,created_at")
        .or("payload->>kind.eq.sppbj,payload->>kind.eq.nonpr").order("created_at", { ascending: false });
      setPengadaan(rowsFromProjects(data || []));
      // RKA + RR dari supabase (kind=anggaran)
      const { data: meta } = await supabase.from("projects").select("id,payload").filter("payload->>kind", "eq", "anggaran");
      const m = (meta || [])[0]?.payload;
      if (m?.rka) setRka(m.rka);
      if (Array.isArray(m?.rr)) setRr(m.rr);
      if (Array.isArray(m?.plafon)) setPlafon(m.plafon);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  // simpan RKA + RR + Plafon (lokal + supabase 1 row kind=anggaran)
  const persist = useCallback(async (nextRka: RKA, nextRr: RREntry[], nextPlafon: PlafonRutin[]) => {
    try {
      localStorage.setItem(LS_RKA, JSON.stringify(nextRka));
      localStorage.setItem(LS_RR, JSON.stringify(nextRr));
      localStorage.setItem(LS_PLAFON, JSON.stringify(nextPlafon));
    } catch {}
    if (!supabase) return;
    const { data: ex } = await supabase.from("projects").select("id").filter("payload->>kind", "eq", "anggaran").limit(1);
    const payload = { kind: "anggaran", rka: nextRka, rr: nextRr, plafon: nextPlafon };
    if (ex && ex[0]) await supabase.from("projects").update({ payload }).eq("id", ex[0].id);
    else await supabase.from("projects").insert({ nama_kapal: "ANGGARAN (meta)", tahun: nextRka.tahun, payload });
  }, []);

  const saveRka = useCallback(async (next: RKA) => { setRka(next); await persist(next, rr, plafon); }, [rr, plafon, persist]);
  const saveRr = useCallback(async (next: RREntry[]) => { setRr(next); await persist(rka, next, plafon); }, [rka, plafon, persist]);
  const savePlafon = useCallback(async (next: PlafonRutin[]) => { setPlafon(next); await persist(rka, rr, next); }, [rka, rr, persist]);

  return { ready, loading, pengadaan, rka, rr, plafon, reload: load, saveRka, saveRr, savePlafon };
}
