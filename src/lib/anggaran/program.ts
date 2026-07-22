"use client";
/**
 * Jembatan Persetujuan Biaya Lainnya <-> pembuatan SPPBJ / Non PR PO.
 * Satu sumber kebenaran untuk: pos pagu (kapal x Mata Anggaran), sisa, dan
 * pengecekan pemakaian sebuah pengadaan terhadap pagu surat persetujuan.
 */
import { PlafonProgram, maKey, namaKapalPenuh, fullMA, isMaInvestasi } from "./types";
import { PengadaanRow } from "./store";
import { pecahKapal } from "@/lib/kapal/nama";

export interface PosProgram {
  kunci: string;   // `${kapal}|${kodeMA}`
  kapal: string;   // nama kapal penuh, "(umum)" bila baris tanpa kapal
  ma: string;      // label MA seperti ditulis di surat
  pagu: number;    // evaluasi pusat + addendum
  pakai: number;   // realisasi pengadaan lain (di luar pengadaan yang sedang dibuat)
  sisa: number;
  inv: boolean;
}

const kunciPos = (kapal: string, ma: string) => `${namaKapalPenuh(kapal || "") || "(umum)"}|${maKey(ma)}`;

/** Nilai sebuah pengadaan dipecah per pos (kapal x MA). Item multi-kapal dibagi rata. */
export function nilaiPerPos(p: { items?: any[]; mataAnggaran?: string[] | string }): Record<string, number> {
  const arr = p.items || [];
  const maDefault = (Array.isArray(p.mataAnggaran) ? p.mataAnggaran[0] : p.mataAnggaran) || "";
  const hasFinal = arr.some((it: any) => (it.hargaSpbj || 0) > 0);
  const out: Record<string, number> = {};
  for (const it of arr) {
    const v = (hasFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0)) * (it.jumlah || 0);
    if (!v) continue;
    const ma = (it.mataAnggaran || "").trim() || maDefault;
    const ks = pecahKapal(it.kapal || "");
    const bagi = ks.length ? v / ks.length : v;
    for (const k of ks.length ? ks : [""]) out[kunciPos(k, ma)] = (out[kunciPos(k, ma)] || 0) + bagi;
  }
  return out;
}

/**
 * Daftar pos pagu sebuah surat persetujuan + sisanya.
 * abaikanId = id pengadaan yang sedang dibuat/diedit (biar tak menghitung dirinya sendiri).
 */
export function posProgram(prog: PlafonProgram | undefined, pengadaan: PengadaanRow[], abaikanId?: string): PosProgram[] {
  if (!prog) return [];
  const by: Record<string, PosProgram> = {};
  for (const r of prog.rows || []) {
    const kunci = kunciPos(r.kapal, r.ma);
    const kode = maKey(r.ma);
    by[kunci] = {
      kunci, kapal: namaKapalPenuh(r.kapal || "") || "(umum)", ma: r.ma || fullMA(kode),
      pagu: (by[kunci]?.pagu || 0) + (r.nilai || 0) + (r.addendum || 0),
      pakai: 0, sisa: 0, inv: isMaInvestasi(kode),
    };
  }
  for (const p of pengadaan) {
    if (p.programId !== prog.id) continue;
    if (abaikanId && p.id === abaikanId) continue;
    for (const [kunci, v] of Object.entries(nilaiPerPos(p))) {
      if (!by[kunci]) {
        const [kapal, kode] = kunci.split("|");
        by[kunci] = { kunci, kapal, ma: fullMA(kode), pagu: 0, pakai: 0, sisa: 0, inv: isMaInvestasi(kode) };
      }
      by[kunci].pakai += v;
    }
  }
  return Object.values(by)
    .map((x) => ({ ...x, sisa: x.pagu - x.pakai }))
    .sort((a, b) => (a.inv === b.inv ? a.kapal.localeCompare(b.kapal) : a.inv ? 1 : -1));
}

export interface CekPos { pos: PosProgram | null; kunci: string; kapal: string; ma: string; nilai: number; sisa: number; lebih: number }
/** Cek pemakaian pengadaan yang sedang dibuat terhadap pos pagu. */
export function cekPemakaian(pos: PosProgram[], req: { items?: any[]; mataAnggaran?: string[] | string }): {
  rincian: CekPos[]; totalDipakai: number; totalSisa: number; over: CekPos[]; tanpaPos: CekPos[];
} {
  const per = nilaiPerPos(req);
  const map: Record<string, PosProgram> = {};
  pos.forEach((p) => { map[p.kunci] = p; });
  const rincian: CekPos[] = Object.entries(per).map(([kunci, nilai]) => {
    const p = map[kunci] || null;
    const [kapal, kode] = kunci.split("|");
    const sisa = p ? p.sisa : 0;
    return { pos: p, kunci, kapal, ma: p?.ma || fullMA(kode), nilai, sisa, lebih: Math.max(0, nilai - sisa) };
  }).sort((a, b) => b.nilai - a.nilai);
  return {
    rincian,
    totalDipakai: rincian.reduce((s, r) => s + r.nilai, 0),
    totalSisa: pos.reduce((s, p) => s + p.sisa, 0),
    over: rincian.filter((r) => r.pos && r.lebih > 0),
    tanpaPos: rincian.filter((r) => !r.pos),
  };
}
