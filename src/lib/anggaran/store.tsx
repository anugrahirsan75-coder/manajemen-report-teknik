"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { RKA, RREntry, PlafonRutin, PlafonDocking, PlafonProgram, maKey, namaKapalPenuh, jenisAnggaranOf } from "./types";
import { pecahKapal } from "@/lib/kapal/nama";
import { catatBackup } from "@/lib/backup/local";

const LS_RKA = "anggaran_rka";
const LS_RR = "anggaran_rr";
const LS_PLAFON = "anggaran_plafon";
const LS_DOCK = "anggaran_docking";
const LS_PROG = "anggaran_program";

export interface PengadaanRow {
  id: string;
  sumber: "SPPBJ" | "Non PR PO";
  nama: string;
  tanggal: string;
  mataAnggaran: string[]; // label2
  kategoriRekap: string;  // "RUTIN" / "DOCKING(BIAYA)" / ...
  jenis: "rutin" | "docking" | "lainnya"; // klasifikasi anti-overlap
  programId?: string;     // tautan ke Persetujuan Biaya Lainnya
  items: any[];           // {kapal,jumlah,harga,hargaSpbj?}
}

function rowsFromProjects(data: any[]): PengadaanRow[] {
  return (data || []).map((r) => {
    const p = r.payload || {};
    const sumber = p.kind === "nonpr" ? "Non PR PO" : "SPPBJ";
    const ma = Array.isArray(p.mataAnggaran) ? p.mataAnggaran : p.mataAnggaran ? [p.mataAnggaran] : [];
    return { id: r.id, sumber, nama: r.nama_kapal || p.namaPengadaan || "(tanpa nama)", tanggal: p.tanggal || "", mataAnggaran: ma, kategoriRekap: p.kategoriRekap || "", jenis: jenisAnggaranOf(p), programId: p.programId || undefined, items: p.items || [] } as PengadaanRow;
  });
}

// nilai pengadaan: final (SPBJ) bila ada, else estimasi
export function nilaiPengadaan(items: any[]): number {
  const arr = items || [];
  const hasFinal = arr.some((it) => (it.hargaSpbj || 0) > 0);
  return arr.reduce((s, it) => s + (hasFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0)) * (it.jumlah || 0), 0);
}

// Pecah nilai pengadaan per Mata Anggaran ITEM (it.mataAnggaran; kosong = ikut MA pertama pengadaan).
// filterKapal opsional: hanya item milik kapal itu (dipakai Kendali Docking).
// useFinal=false -> pakai harga estimasi saja (dipakai KPI/penyerapan dashboard).
export function nilaiPerMA(p: { items?: any[]; mataAnggaran?: string[] }, filterKapal?: string, useFinal = true): Record<string, number> {
  const arr = p.items || [];
  const hasFinal = useFinal && arr.some((it) => (it.hargaSpbj || 0) > 0);
  const maDefault = (p.mataAnggaran || [])[0] || "";
  const out: Record<string, number> = {};
  for (const it of arr) {
    if (filterKapal && namaKapalPenuh(it.kapal || "") !== filterKapal) continue;
    const ma = (it.mataAnggaran || "").trim() || maDefault;
    const v = (hasFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0)) * (it.jumlah || 0);
    if (v) out[ma] = (out[ma] || 0) + v;
  }
  return out;
}

// Pecah nilai pengadaan per KAPAL (dari kolom kapal tiap item).
// Item yang menyebut >1 kapal dibagi RATA ke kapal2 itu (biar total tetap pas, tak dobel).
export function nilaiPerKapal(p: { items?: any[] }, useFinal = true): Record<string, number> {
  const arr = p.items || [];
  const hasFinal = useFinal && arr.some((it) => (it.hargaSpbj || 0) > 0);
  const out: Record<string, number> = {};
  for (const it of arr) {
    const v = (hasFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0)) * (it.jumlah || 0);
    if (!v) continue;
    const ks = pecahKapal(it.kapal || "");
    if (!ks.length) { out[TANPA_KAPAL] = (out[TANPA_KAPAL] || 0) + v; continue; }
    const bagi = v / ks.length;
    for (const k of ks) out[k] = (out[k] || 0) + bagi;
  }
  return out;
}
export const TANPA_KAPAL = "(tanpa kapal)";

export interface RealisasiKapal { kapal: string; nilai: number; pengadaan: RealisasiItem[] }
/** Serapan RUTIN per KAPAL untuk 1 bulan ("YYYY-MM") — SPPBJ + Non PR PO. */
export function realisasiRutinKapal(rows: PengadaanRow[], bulan: string) {
  const per: Record<string, RealisasiKapal> = {};
  for (const p of rows) {
    if (p.jenis !== "rutin") continue;
    if ((p.tanggal || "").slice(0, 7) !== bulan) continue;
    const maDefault = (p.mataAnggaran || [])[0] || "";
    for (const [kapal, v] of Object.entries(nilaiPerKapal(p))) {
      if (!per[kapal]) per[kapal] = { kapal, nilai: 0, pengadaan: [] };
      per[kapal].nilai += v;
      per[kapal].pengadaan.push({ id: p.id, nama: p.nama, ma: maDefault, nilai: v, key: kapal, sumber: p.sumber, tanggal: p.tanggal });
    }
  }
  const list = Object.values(per).sort((a, b) => b.nilai - a.nilai);
  list.forEach((k) => k.pengadaan.sort((a, b) => b.nilai - a.nilai));
  return { list, total: list.reduce((s, k) => s + k.nilai, 0) };
}

export interface RealisasiItem { id: string; nama: string; ma: string; nilai: number; key: string; sumber: string; tanggal: string }
// realisasi RUTIN per kunci MA utk 1 bulan ("YYYY-MM") — SPPBJ + Non PR PO
export function realisasiRutin(rows: PengadaanRow[], bulan: string) {
  const perKey: Record<string, number> = {};
  const list: RealisasiItem[] = [];
  for (const p of rows) {
    // RUTIN = SPPBJ + Non PR PO ber-jenis rutin (docking dikecualikan). Anti-overlap: tepat 1 bucket.
    if (p.jenis !== "rutin") continue;
    if ((p.tanggal || "").slice(0, 7) !== bulan) continue;
    for (const [ma, v] of Object.entries(nilaiPerMA(p))) {
      const key = maKey(ma);
      perKey[key] = (perKey[key] || 0) + v;
      list.push({ id: p.id, nama: p.nama, ma, nilai: v, key, sumber: p.sumber, tanggal: p.tanggal });
    }
  }
  list.sort((a, b) => b.nilai - a.nilai);
  const total = Object.values(perKey).reduce((s, v) => s + v, 0);
  return { perKey, list, total };
}

// realisasi DOCKING per kunci MA utk 1 kapal + tahun (SPPBJ + Non PR PO, kategori DOCKING).
// Nilai item-level: hanya item milik kapal itu (namaKapalPenuh) yang dihitung.
export function realisasiDocking(rows: PengadaanRow[], kapal: string, tahun: number) {
  const perKey: Record<string, number> = {};
  const list: RealisasiItem[] = [];
  for (const p of rows) {
    if (p.jenis !== "docking") continue;
    if (parseInt((p.tanggal || "").slice(0, 4), 10) !== tahun) continue;
    for (const [ma, v] of Object.entries(nilaiPerMA(p, kapal))) {
      const key = maKey(ma);
      perKey[key] = (perKey[key] || 0) + v;
      list.push({ id: p.id, nama: p.nama, ma, nilai: v, key, sumber: p.sumber, tanggal: p.tanggal });
    }
  }
  list.sort((a, b) => b.nilai - a.nilai);
  return { perKey, list, total: Object.values(perKey).reduce((s, v) => s + v, 0) };
}


/** Realisasi 1 program Persetujuan Lainnya: per (kapal + Mata Anggaran). */
export function realisasiProgram(rows: PengadaanRow[], programId: string) {
  const perKunci: Record<string, number> = {};   // `${kapal}|${maKey}`
  const list: RealisasiItem[] = [];
  for (const p of rows) {
    if (p.programId !== programId) continue;
    const maDefault = (p.mataAnggaran || [])[0] || "";
    const arr = p.items || [];
    const hasFinal = arr.some((it: any) => (it.hargaSpbj || 0) > 0);
    for (const it of arr) {
      const v = (hasFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0)) * (it.jumlah || 0);
      if (!v) continue;
      const ma = (it.mataAnggaran || "").trim() || maDefault;
      const ks = pecahKapal(it.kapal || "");
      const bagi = ks.length ? v / ks.length : v;
      for (const k of (ks.length ? ks : [TANPA_KAPAL])) {
        const kunci = `${k}|${maKey(ma)}`;
        perKunci[kunci] = (perKunci[kunci] || 0) + bagi;
        list.push({ id: p.id, nama: p.nama, ma, nilai: bagi, key: kunci, sumber: p.sumber, tanggal: p.tanggal });
      }
    }
  }
  list.sort((a, b) => b.nilai - a.nilai);
  return { perKunci, list, total: Object.values(perKunci).reduce((s, v) => s + v, 0) };
}

export function useAnggaran() {
  const ready = isSupabaseReady;
  const [pengadaan, setPengadaan] = useState<PengadaanRow[]>([]);
  const [rka, setRka] = useState<RKA>({ tahun: new Date().getFullYear(), nilai: {} });
  const [rr, setRr] = useState<RREntry[]>([]);
  const [plafon, setPlafon] = useState<PlafonRutin[]>([]);
  const [docking, setDocking] = useState<PlafonDocking[]>([]);
  const [program, setProgram] = useState<PlafonProgram[]>([]);
  const [loading, setLoading] = useState(false);

  // muat lokal dulu (offline-ready)
  useEffect(() => {
    try { const a = localStorage.getItem(LS_RKA); if (a) setRka(JSON.parse(a)); } catch {}
    try { const b = localStorage.getItem(LS_RR); if (b) setRr(JSON.parse(b)); } catch {}
    try { const c = localStorage.getItem(LS_PLAFON); if (c) setPlafon(JSON.parse(c)); } catch {}
    try { const e = localStorage.getItem(LS_DOCK); if (e) setDocking(JSON.parse(e)); } catch {}
    try { const f = localStorage.getItem(LS_PROG); if (f) setProgram(JSON.parse(f)); } catch {}
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
      if (Array.isArray(m?.docking)) setDocking(m.docking);
      if (Array.isArray(m?.program)) setProgram(m.program);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  // simpan RKA + RR + Plafon (lokal + supabase 1 row kind=anggaran)
  const persist = useCallback(async (nextRka: RKA, nextRr: RREntry[], nextPlafon: PlafonRutin[], nextDocking: PlafonDocking[], nextProgram: PlafonProgram[]) => {
    try {
      localStorage.setItem(LS_RKA, JSON.stringify(nextRka));
      localStorage.setItem(LS_RR, JSON.stringify(nextRr));
      localStorage.setItem(LS_PLAFON, JSON.stringify(nextPlafon));
      localStorage.setItem(LS_DOCK, JSON.stringify(nextDocking));
      localStorage.setItem(LS_PROG, JSON.stringify(nextProgram));
    } catch {}
    if (!supabase) return;
    const { data: ex } = await supabase.from("projects").select("id").filter("payload->>kind", "eq", "anggaran").limit(1);
    const payload = { kind: "anggaran", rka: nextRka, rr: nextRr, plafon: nextPlafon, docking: nextDocking, program: nextProgram };
    if (ex && ex[0]) await supabase.from("projects").update({ payload }).eq("id", ex[0].id);
    else await supabase.from("projects").insert({ nama_kapal: "ANGGARAN (meta)", tahun: nextRka.tahun, payload });
    catatBackup("anggaran", ex?.[0]?.id, payload, "ANGGARAN (meta)");
  }, []);

  const saveRka = useCallback(async (next: RKA) => { setRka(next); await persist(next, rr, plafon, docking, program); }, [rr, plafon, docking, program, persist]);
  const saveRr = useCallback(async (next: RREntry[]) => { setRr(next); await persist(rka, next, plafon, docking, program); }, [rka, plafon, docking, program, persist]);
  const savePlafon = useCallback(async (next: PlafonRutin[]) => { setPlafon(next); await persist(rka, rr, next, docking, program); }, [rka, rr, docking, program, persist]);
  const saveDocking = useCallback(async (next: PlafonDocking[]) => { setDocking(next); await persist(rka, rr, plafon, next, program); }, [rka, rr, plafon, program, persist]);
  const saveProgram = useCallback(async (next: PlafonProgram[]) => { setProgram(next); await persist(rka, rr, plafon, docking, next); }, [rka, rr, plafon, docking, persist]);

  return { ready, loading, pengadaan, rka, rr, plafon, docking, program, reload: load, saveRka, saveRr, savePlafon, saveDocking, saveProgram };
}
