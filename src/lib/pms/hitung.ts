/**
 * Penyusun daftar jatuh tempo seluruh armada.
 *
 * Dipisahkan dari layar karena dipakai dua tempat — beranda PMS dan halaman
 * rencana — dan dua tempat yang menghitung sendiri-sendiri cepat atau lambat
 * akan menampilkan dua angka berbeda untuk hal yang sama.
 */
import {
  Jatuh, Kekritisan, Peralatan, PmsKapal, RencanaKerja, StatusJatuh,
  URUT_KRITIS, URUT_STATUS, hitungJatuh,
} from "./types";
import type { PetaJam } from "./store";

export interface BarisJatuh {
  kapal: string;
  alat?: Peralatan;
  rencana: RencanaKerja;
  jatuh: Jatuh;
  kekritisan: Kekritisan;
  /** jam jalan terbaca saat ini, bila peralatannya berjam-meter */
  jam?: number;
}

export function daftarJatuh(list: PmsKapal[], jam: PetaJam, hariIni = new Date()): BarisJatuh[] {
  const out: BarisJatuh[] = [];
  for (const k of list) {
    const petaAlat = new Map((k.peralatan || []).map((p) => [p.tag, p]));
    for (const r of k.rencana || []) {
      if (!r.aktif) continue;
      const alat = petaAlat.get(r.tag);
      if (alat && !alat.aktif) continue;
      const jamKini = alat?.sumberJam ? jam[k.kapal]?.[alat.sumberJam] : undefined;
      out.push({
        kapal: k.kapal, alat, rencana: r, jam: jamKini,
        jatuh: hitungJatuh(r, jamKini, hariIni),
        kekritisan: alat?.kekritisan || "biasa",
      });
    }
  }
  // paling mendesak dulu; pada status yang sama, peralatan kritis didahulukan
  out.sort((a, b) =>
    URUT_STATUS[a.jatuh.status] - URUT_STATUS[b.jatuh.status]
    || URUT_KRITIS[a.kekritisan] - URUT_KRITIS[b.kekritisan]
    || (a.jatuh.sisa ?? 1e9) - (b.jatuh.sisa ?? 1e9)
    || a.kapal.localeCompare(b.kapal));
  return out;
}

export interface RingkasKapal {
  kapal: string;
  peralatan: number;
  rencana: number;
  terlambat: number;
  segera: number;
  aman: number;
  belum: number;
}

export function ringkasPerKapal(baris: BarisJatuh[], list: PmsKapal[]): RingkasKapal[] {
  const peta = new Map<string, RingkasKapal>();
  for (const k of list) {
    peta.set(k.kapal, {
      kapal: k.kapal,
      peralatan: (k.peralatan || []).filter((p) => p.aktif).length,
      rencana: (k.rencana || []).filter((r) => r.aktif).length,
      terlambat: 0, segera: 0, aman: 0, belum: 0,
    });
  }
  for (const b of baris) {
    const r = peta.get(b.kapal);
    if (r) r[b.jatuh.status] += 1;
  }
  return Array.from(peta.values()).sort((a, b) => b.terlambat - a.terlambat || b.segera - a.segera || a.kapal.localeCompare(b.kapal));
}

export const hitungStatus = (baris: BarisJatuh[]): Record<StatusJatuh, number> => ({
  terlambat: baris.filter((b) => b.jatuh.status === "terlambat").length,
  segera: baris.filter((b) => b.jatuh.status === "segera").length,
  aman: baris.filter((b) => b.jatuh.status === "aman").length,
  belum: baris.filter((b) => b.jatuh.status === "belum").length,
});
