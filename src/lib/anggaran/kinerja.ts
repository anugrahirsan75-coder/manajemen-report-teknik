"use client";
/**
 * Perhitungan halaman Kinerja Anggaran (tautan Direksi).
 *
 * Angkanya TIDAK dihitung ulang dengan rumus sendiri: seluruhnya memakai
 * fungsi yang sama dengan Dashboard Anggaran di dalam aplikasi
 * (realisasiRutin, realisasiDocking, realisasiProgram, posProgram). Kalau
 * dihitung sendiri, cepat atau lambat kedua layar akan berbeda angkanya — dan
 * yang dibaca Direksi justru yang tak bisa dikoreksi siapa pun.
 */
import {
  PengadaanRow, realisasiRutin, realisasiDocking, realisasiProgram,
} from "./store";
import { posProgram } from "./program";
import {
  PlafonRutin, PlafonDocking, PlafonProgram, KAPAL_ANGGARAN, jenisAnggaranOf, maKey, labelMA, paguProgram,
} from "./types";
import { rutinRentang } from "./rka2026";
import { pecahKapal } from "@/lib/kapal/nama";

export interface DataMentah {
  pengadaan: any[];
  plafon: PlafonRutin[];
  docking: PlafonDocking[];
  program: PlafonProgram[];
  diperbarui: string;
}

/** bentuk baris pengadaan yang dipakai fungsi-fungsi hitung di store */
export function keBarisPengadaan(p: any): PengadaanRow {
  return {
    id: p.id, sumber: p.sumber, nama: p.nama, tanggal: p.tanggal || "",
    mataAnggaran: p.mataAnggaran || [], kategoriRekap: p.kategoriRekap || "",
    jenis: jenisAnggaranOf(p), programId: p.programId, items: p.items || [],
    stok: !!p.stok,
  };
}

export interface BarisBulan { bulan: string; pagu: number; pakai: number }
export interface BarisPos { label: string; pagu: number; pakai: number; ket?: string }
export interface BarisKapal { kapal: string; rutin: number; docking: number; lainnya: number; total: number }

export interface Kinerja {
  tahun: number;
  perBulan: BarisBulan[];
  rutin: { pagu: number; pakai: number; perMa: BarisPos[]; rka: number };
  docking: { pagu: number; pakai: number; perKapal: BarisPos[] };
  lainnya: { pagu: number; pakai: number; perSurat: BarisPos[] };
  kapal: BarisKapal[];
  perhatian: BarisPos[];
}

const bulanYm = (tahun: number) =>
  Array.from({ length: 12 }, (_, i) => `${tahun}-${String(i + 1).padStart(2, "0")}`);

export function hitungKinerja(d: DataMentah, tahun: number): Kinerja {
  const rows = (d.pengadaan || []).map(keBarisPengadaan);
  const bulanTahun = bulanYm(tahun);

  // ── RUTIN: per bulan, lalu per Mata Anggaran ────────────────────────────
  const perBulan: BarisBulan[] = bulanTahun.map((ym) => {
    const plaf = d.plafon.find((x) => x.bulan === ym);
    const pagu = (plaf?.rows || []).reduce((s, r) => s + (r.nilai || 0) + (r.addendum || 0), 0);
    return { bulan: ym, pagu, pakai: realisasiRutin(rows, ym).total };
  });

  const paguMa: Record<string, number> = {};
  const pakaiMa: Record<string, number> = {};
  bulanTahun.forEach((ym) => {
    const plaf = d.plafon.find((x) => x.bulan === ym);
    (plaf?.rows || []).forEach((r) => {
      const k = maKey(r.ma);
      paguMa[k] = (paguMa[k] || 0) + (r.nilai || 0) + (r.addendum || 0);
    });
    const real = realisasiRutin(rows, ym);
    Object.entries(real.perKey).forEach(([k, v]) => { pakaiMa[k] = (pakaiMa[k] || 0) + v; });
  });
  const perMa: BarisPos[] = Array.from(new Set([...Object.keys(paguMa), ...Object.keys(pakaiMa)]))
    .map((k) => ({ label: labelMA(k), pagu: paguMa[k] || 0, pakai: pakaiMa[k] || 0 }))
    .sort((a, b) => b.pakai - a.pakai);

  // RKA setahun sebagai pembanding kedua (pagu = persetujuan pusat per bulan)
  const rka = rutinRentang(bulanTahun).total;

  // ── DOCKING: per kapal ─────────────────────────────────────────────────
  const perKapalDock: BarisPos[] = [];
  KAPAL_ANGGARAN.forEach((kapal) => {
    const e = d.docking.find((x) => x.kapal === kapal && x.tahun === tahun);
    const pagu = (e?.rows || []).reduce((s, r) => s + (r.nilai || 0) + (r.addendum || 0), 0);
    const pakai = realisasiDocking(rows, kapal, tahun).total;
    if (!pagu && !pakai) return;
    perKapalDock.push({ label: kapal, pagu, pakai, ket: e?.noSurat });
  });
  perKapalDock.sort((a, b) => b.pakai - a.pakai);

  // ── LAINNYA: per surat persetujuan ─────────────────────────────────────
  const perSurat: BarisPos[] = (d.program || [])
    .filter((pr) => !pr.tahun || pr.tahun === tahun)
    .map((pr) => ({
      label: pr.nama || "(tanpa nama)",
      pagu: paguProgram(pr),
      pakai: realisasiProgram(rows, pr.id).total,
      ket: pr.noSurat,
    }))
    .sort((a, b) => b.pakai - a.pakai);

  // ── beban per KAPAL dari tiga sumber ───────────────────────────────────
  const kapalMap: Record<string, BarisKapal> = {};
  const tambah = (nama: string, jenis: "rutin" | "docking" | "lainnya", nilai: number) => {
    const k = nama || "(tanpa kapal)";
    kapalMap[k] = kapalMap[k] || { kapal: k, rutin: 0, docking: 0, lainnya: 0, total: 0 };
    kapalMap[k][jenis] += nilai;
    kapalMap[k].total += nilai;
  };
  rows.forEach((p) => {
    if (p.stok) return;
    if (!(p.tanggal || "").startsWith(String(tahun))) return;
    const adaFinal = (p.items || []).some((it: any) => (it.hargaSpbj || 0) > 0);
    (p.items || []).forEach((it: any) => {
      const nilai = (adaFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0)) * (it.jumlah || 0);
      if (!nilai) return;
      const j = (it.jenisAnggaran || "").toLowerCase();
      const jenis = (j === "rutin" || j === "docking" || j === "lainnya" ? j : p.jenis) as "rutin" | "docking" | "lainnya";
      const ks = pecahKapal(it.kapal || "");
      const daftar = ks.length ? ks : ["(tanpa kapal)"];
      daftar.forEach((k) => tambah(k, jenis, nilai / daftar.length));
    });
  });
  const kapal = Object.values(kapalMap).filter((k) => k.total > 0).sort((a, b) => b.total - a.total);

  // ── pos yang perlu diperhatikan (>= 95% pagu) ──────────────────────────
  const perhatian = [
    ...perMa.map((x) => ({ ...x, label: `Rutin · ${x.label}` })),
    ...perKapalDock.map((x) => ({ ...x, label: `Docking · ${x.label}` })),
    ...perSurat.map((x) => ({ ...x, label: `Lainnya · ${x.label}` })),
  ].filter((x) => x.pagu > 0 && x.pakai / x.pagu >= 0.95)
    .sort((a, b) => b.pakai / b.pagu - a.pakai / a.pagu);

  const jml = (a: BarisPos[], k: "pagu" | "pakai") => a.reduce((s, x) => s + x[k], 0);
  return {
    tahun, perBulan,
    rutin: { pagu: perBulan.reduce((s, b) => s + b.pagu, 0), pakai: perBulan.reduce((s, b) => s + b.pakai, 0), perMa, rka },
    docking: { pagu: jml(perKapalDock, "pagu"), pakai: jml(perKapalDock, "pakai"), perKapal: perKapalDock },
    lainnya: { pagu: jml(perSurat, "pagu"), pakai: jml(perSurat, "pakai"), perSurat },
    kapal, perhatian,
  };
}
