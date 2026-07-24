"use client";
// Kumpulkan dokumen Rencana/Realisasi lalu minta server membuat berkas Lampiran 3.
import { saveAs } from "file-saver";
import { SINGKATAN_KAPAL, KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { KELOMPOK_RR, MA_RR, kunciKelompok, RrDoc, namaBulan } from "./types";

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

export async function exportRrExcel(o: { bulanRencana: string; bulanRealisasi: string; dok: RrDoc[] }) {
  const body = {
    bulanRencana: namaBulan(o.bulanRencana),
    bulanRealisasi: namaBulan(o.bulanRealisasi),
    judul: `RENCANA ${namaBulan(o.bulanRencana)} & REALISASI ${namaBulan(o.bulanRealisasi)}`,
    dicetak: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
    maUrut: MA_RR,
    usulan: lembar(o.dok, "rencana", o.bulanRencana),
    realisasi: lembar(o.dok, "realisasi", o.bulanRealisasi),
  };
  const res = await fetch("/api/rr/export", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  saveAs(await res.blob(), `${body.judul}.xlsx`.replace(/[\\/:*?"<>|]/g, "-"));
}
