"use client";
// Kumpulkan dokumen Rencana/Realisasi lalu minta server membuat berkas Lampiran 3.
import { saveAs } from "file-saver";
import { SINGKATAN_KAPAL, KAPAL_ANGGARAN, PlafonRutin, RKA, maKey, paguTotal } from "@/lib/anggaran/types";
import { KELOMPOK_RR, MA_RR, kunciKelompok, RrDoc, bulanKe, namaBulan } from "./types";

/** nama penuh -> singkatan yang dipakai pusat (ARWNG, PL 8, ...) */
const singkatKapal = (penuh: string) => {
  const hit = Object.entries(SINGKATAN_KAPAL).find(([, v]) => v === penuh);
  return hit ? hit[0] : penuh.replace("KMP. ", "").slice(0, 8);
};

const lembar = (dok: RrDoc[], tipe: "rencana" | "realisasi", bulan: string) =>
  KAPAL_ANGGARAN.map((kapal) => {
    const d = dok.find((x) => x.tipe === tipe && x.bulan === bulan && x.kapal === kapal);
    return {
      kapal, singkat: singkatKapal(kapal),
      ppnPersen: d?.ppnPersen || 0,
      status: d?.status || "draf",
      dikirimPada: d?.dikirimPada,
      catatan: d?.catatan,
      kelompok: KELOMPOK_RR.map((k) => ({
        ma: k.ma, kode: k.kode, judul: k.judul,
        items: (d?.kelompok.find((x) => x.kunci === kunciKelompok(k))?.items || []).map((i) => ({
          deskripsi: i.deskripsi, spesifikasi: i.spesifikasi, jumlah: i.jumlah, satuan: i.satuan, harga: i.harga,
        })),
      })),
    };
  });

/** pagu rilis satu bulan per Mata Anggaran */
const paguBulan = (plafon: PlafonRutin[], bulan: string): Record<string, number> => {
  const out: Record<string, number> = {};
  (plafon || []).find((p) => p.bulan === bulan)?.rows?.forEach((r) => {
    out[maKey(r.ma)] = (out[maKey(r.ma)] || 0) + paguTotal(r);
  });
  return out;
};

/**
 * Bagikan pagu cabang ke tiap kapal menurut PORSI RKA kapal itu.
 *
 * Pusat merilis pagu per Mata Anggaran untuk satu cabang, bukan per kapal,
 * sedangkan Lampiran 3 disusun per kapal. Membagi rata sama saja mengarang;
 * membagi menurut RKA setidaknya memakai angka resmi yang sudah ada, dan
 * jumlah seluruh kapal tetap sama persis dengan pagu cabangnya.
 */
function bagiKeKapal(
  paguMA: Record<string, number>,
  rkaKapal: Record<string, Record<string, number>>,
): Record<string, Record<string, number>> {
  const totalMA: Record<string, number> = {};
  Object.values(rkaKapal).forEach((perMa) =>
    Object.entries(perMa).forEach(([kode, v]) => { totalMA[kode] = (totalMA[kode] || 0) + v; }));
  const out: Record<string, Record<string, number>> = {};
  Object.entries(rkaKapal).forEach(([kapal, perMa]) => {
    out[kapal] = {};
    Object.entries(perMa).forEach(([kode, v]) => {
      const t = totalMA[kode] || 0;
      if (!t || !paguMA[kode]) return;
      out[kapal][kode] = Math.round((paguMA[kode] * v) / t);
    });
  });
  return out;
}

export async function exportRrExcel(o: {
  bulanRencana: string; bulanRealisasi: string; dok: RrDoc[];
  rka?: RKA | null; plafon?: PlafonRutin[];
}) {
  const rkaKapal = o.rka?.bulananKapal?.[o.bulanRencana] || {};
  const paguIni = paguBulan(o.plafon || [], o.bulanRencana);
  const paguLalu = paguBulan(o.plafon || [], bulanKe(o.bulanRencana, -1));
  const adaRka = Object.keys(rkaKapal).length > 0;

  const body = {
    bulanRencana: namaBulan(o.bulanRencana),
    bulanRealisasi: namaBulan(o.bulanRealisasi),
    judul: `RENCANA ${namaBulan(o.bulanRencana)} & REALISASI ${namaBulan(o.bulanRealisasi)}`,
    dicetak: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
    maUrut: MA_RR,
    usulan: lembar(o.dok, "rencana", o.bulanRencana),
    realisasi: lembar(o.dok, "realisasi", o.bulanRealisasi),
    rkaKapal,
    rkacKapal: adaRka ? bagiKeKapal(paguIni, rkaKapal) : {},
    persetujuanLaluKapal: adaRka ? bagiKeKapal(paguLalu, rkaKapal) : {},
    sumberPagu: adaRka
      ? `Kolom RKA diambil dari RKA rutin ${namaBulan(o.bulanRencana)} per kapal (docking tidak termasuk). `
        + `Kolom RKAC BULAN INI dan PERSETUJUAN BULAN LALU berasal dari pagu rilis pusat `
        + `${Object.keys(paguIni).length ? namaBulan(o.bulanRencana) : "(belum rilis)"} dan `
        + `${Object.keys(paguLalu).length ? namaBulan(bulanKe(o.bulanRencana, -1)) : "(belum rilis)"}; `
        + `pusat merilis pagu per Mata Anggaran untuk satu cabang, jadi angkanya dibagi ke tiap kapal `
        + `menurut porsi RKA kapal itu — jumlah seluruh kapal tetap sama dengan pagu cabangnya.`
      : `Kolom RKA belum bisa diisi: RKA per kapal untuk ${namaBulan(o.bulanRencana)} belum ada di Dashboard Anggaran.`,
  };
  const res = await fetch("/api/rr/export", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  saveAs(await res.blob(), `${body.judul}.xlsx`.replace(/[\\/:*?"<>|]/g, "-"));
}
