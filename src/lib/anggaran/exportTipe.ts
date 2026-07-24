"use client";
/**
 * Kumpulkan data 1 TIPE anggaran (Rutin / Docking / Lainnya) sampai tingkat DOKUMEN,
 * lalu kirim ke API pembuat Excel berjenjang.
 *
 * Tiap SPPBJ / Non PR PO dikirim utuh (kop, dasar pelimpahan, grup per kapal, item,
 * keterangan, rincian "-", tanda tangan) supaya di Excel bisa ditulis persis seperti
 * dokumen aslinya — bukan sekadar baris tabel.
 *
 * Kunci penautan: label Mata Anggaran pada sheet grup HARUS sama persis dengan
 * kolom bantu di sheet RINCIAN — karena SUMIFS mencocokkan teksnya.
 */
import { saveAs } from "file-saver";
import { PengadaanRow } from "./store";
import { posProgram } from "./program";
import {
  PlafonRutin, PlafonDocking, PlafonProgram, KAPAL_ANGGARAN, MATA_ANGGARAN, maKey, fullMA,
  namaKapalPenuh, jenisAnggaranOf,
} from "./types";
import { ringkasKapal, pecahKapal } from "@/lib/kapal/nama";
import { fullNoKontrak } from "@/lib/sppbj/types";
import { tanggalIndo, bulanTahun } from "@/lib/format";

const WARNA = { rutin: "FF16357F", docking: "FFC2410C", lainnya: "FF4338CA" } as const;

/**
 * Label Mata Anggaran yang dipakai SERAGAM di sheet grup & kolom bantu RINCIAN.
 * Pakai nama resmi dari master; kalau kodenya tak ada di master, pertahankan teks aslinya
 * (jangan sampai jadi "5010103004 (5010103004)").
 */
function labelMA(teks: string): string {
  const kode = maKey(teks);
  if (!kode) return (teks || "").trim() || "(tanpa Mata Anggaran)";
  const dikenal = MATA_ANGGARAN.some((m) => m.kode === kode);
  if (dikenal) return fullMA(kode);
  let asli = (teks || "").replace(kode, "").trim();
  if (asli.startsWith("(") && asli.endsWith(")")) asli = asli.slice(1, -1);
  asli = asli.trim();
  return asli ? `${kode} (${asli})` : kode;
}

export interface OpsiExportTipe {
  tipe: "rutin" | "docking" | "lainnya";
  plafon: PlafonRutin[];
  docking: PlafonDocking[];
  program: PlafonProgram[];
  pengadaan: PengadaanRow[];
  bulan: string;  // "YYYY-MM" (Rutin)
  tahun: number;  // (Docking)
}

interface PosItem { grup: string; ma: string; nilai: number }
interface DokItem {
  jumlah: number; satuan: string; nama: string; spesifikasi: string;
  harga: number; nilai: number; keterangan?: string; rincian?: string[]; pos: PosItem[];
}

/** kelompokkan item per kapal, urut kemunculan (sama dgn preview & template Excel) */
function grupKapal(items: DokItem[], kapalItem: string[]) {
  const out: { kapal: string; items: DokItem[] }[] = [];
  items.forEach((it, i) => {
    const k = (kapalItem[i] || "").trim() || "(tanpa kapal)";
    const g = out.find((x) => x.kapal === k);
    if (g) g.items.push(it); else out.push({ kapal: k, items: [it] });
  });
  return out;
}

/**
 * Susun 1 pengadaan jadi DOKUMEN.
 * `posDari(kapalTeks, maTeks, nilai)` menentukan ke pos anggaran mana nilai item dibebankan
 * (dikembalikan kosong bila item itu di luar cakupan tipe/grup yang diexport).
 */
function dokumenDari(p: PengadaanRow, posDari: (kapal: string, ma: string, nilai: number) => PosItem[]) {
  const raw = p.raw || {};
  const arr: any[] = p.items || [];
  const adaFinal = arr.some((it) => (it.hargaSpbj || 0) > 0);
  const maDefault = (p.mataAnggaran || [])[0] || "";

  const dokItems: DokItem[] = [];
  const kapalItem: string[] = [];
  let total = 0;
  const semuaPos: PosItem[] = [];

  for (const it of arr) {
    const harga = adaFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0);
    const jumlah = it.jumlah || 0;
    const nilai = harga * jumlah;
    const pos = posDari((it.kapal || "").trim(), (it.mataAnggaran || "").trim() || maDefault, nilai);
    dokItems.push({
      jumlah, satuan: it.satuan || "", nama: it.nama || "", spesifikasi: it.spesifikasi || "",
      harga, nilai, keterangan: it.keterangan || "", rincian: it.breakdown || [], pos,
    });
    kapalItem.push(it.kapal || "");
    total += nilai;
    semuaPos.push(...pos);
  }
  if (!semuaPos.length) return null;   // tak menyentuh anggaran tipe ini

  // grup utama = yang paling besar nilainya (dipakai utk indeks & urutan sheet)
  const perGrup: Record<string, number> = {};
  semuaPos.forEach((x) => (perGrup[x.grup] = (perGrup[x.grup] || 0) + x.nilai));
  const grupUtama = Object.entries(perGrup).sort((a, b) => b[1] - a[1])[0][0];

  const sppbj = p.sumber === "SPPBJ";
  return {
    grup: grupUtama,
    sumber: p.sumber,
    judul: sppbj ? "Daftar Kebutuhan Pengadaan Barang/Jasa" : "Daftar Kebutuhan Pengadaan (Non PR PO)",
    nomor: (sppbj ? raw.noSPPBJ || fullNoKontrak(raw) : raw.noSPPB) || "",
    tanggal: p.tanggal ? tanggalIndo(p.tanggal) : "",
    kotaTanggal: `Ternate, ${p.tanggal ? bulanTahun(p.tanggal) : "—"}`,
    noDRP: raw.noDRP || "",
    dasar: raw.dasarPelimpahan || "",
    nama: p.nama,
    mataAnggaran: (p.mataAnggaran || []).filter(Boolean),
    vendor: raw.vendor || "",
    jenisAnggaran: raw.jenisAnggaran || "",
    stafTeknik: raw.stafTeknik || "",
    deptHead: raw.deptHead || "",
    blok: grupKapal(dokItems, kapalItem),
    total,
    dibebankan: semuaPos.reduce((s, x) => s + x.nilai, 0),
    _pos: semuaPos,
  };
}

export async function exportTipeExcel(o: OpsiExportTipe) {
  const grup: any[] = [];
  const dokumen: any[] = [];
  let judul = "", periode = "", labelGrup = "";
  /** pos yang muncul di dokumen tapi belum ada di daftar pagu -> tetap ditampilkan (pagu 0) */
  const tambahPos = (namaGrup: string, ma: string) => {
    const g = grup.find((x) => x.nama === namaGrup);
    if (g && !g.pos.some((q: any) => q.ma === ma)) g.pos.push({ ma, pagu: 0, addendum: 0 });
  };

  // ================= DOCKING: grup = kapal, pos = Mata Anggaran =================
  if (o.tipe === "docking") {
    judul = "Anggaran Docking";
    periode = `Tahun ${o.tahun}`;
    labelGrup = "Kapal";

    for (const kapal of KAPAL_ANGGARAN) {
      const e = o.docking.find((x) => x.kapal === kapal && x.tahun === o.tahun);
      if (!e) continue;
      grup.push({
        nama: kapal, pendek: ringkasKapal(kapal), noSurat: e.noSurat, noSuratAddendum: e.noSuratAddendum,
        pos: (e.rows || []).map((x) => ({ ma: labelMA(x.ma), pagu: x.nilai || 0, addendum: x.addendum || 0 })),
      });
    }
    const dikenal = new Set(grup.map((g) => g.nama));

    for (const p of o.pengadaan) {
      if (jenisAnggaranOf(p as any) !== "docking") continue;
      if ((p.tanggal || "").slice(0, 4) !== String(o.tahun)) continue;
      const dok = dokumenDari(p, (kapalTeks, maTeks, nilai) => {
        if (!nilai) return [];
        const kapals = pecahKapal(kapalTeks);
        const bagi = kapals.length || 1;
        const ma = labelMA(maTeks);
        return (kapals.length ? kapals : [""])
          .map((k) => namaKapalPenuh(k))
          .filter((k) => dikenal.has(k))
          .map((k) => ({ grup: k, ma, nilai: nilai / bagi }));
      });
      if (dok) {
        dok._pos.forEach((x: PosItem) => tambahPos(x.grup, x.ma));
        dokumen.push(dok);
      }
    }
  }

  // ================= RUTIN: grup = bulan, pos = Mata Anggaran =================
  if (o.tipe === "rutin") {
    judul = "Anggaran Rutin";
    periode = bulanTahun(o.bulan + "-01");
    labelGrup = "Periode";
    const e = o.plafon.find((x) => x.bulan === o.bulan);
    grup.push({
      nama: periode, pendek: periode,
      pos: (e?.rows || []).map((x) => ({ ma: labelMA(x.ma), pagu: x.nilai || 0, addendum: x.addendum || 0 })),
    });

    for (const p of o.pengadaan) {
      if (jenisAnggaranOf(p as any) !== "rutin") continue;
      if ((p.tanggal || "").slice(0, 7) !== o.bulan) continue;
      const dok = dokumenDari(p, (_kapal, maTeks, nilai) =>
        nilai ? [{ grup: periode, ma: labelMA(maTeks), nilai }] : []);
      if (dok) {
        dok._pos.forEach((x: PosItem) => tambahPos(x.grup, x.ma));
        dokumen.push(dok);
      }
    }
  }

  // ============ LAINNYA: grup = surat, pos = "KAPAL — Mata Anggaran" ============
  if (o.tipe === "lainnya") {
    judul = "Persetujuan Biaya Lainnya";
    periode = `${o.program.length} surat persetujuan`;
    labelGrup = "Surat Persetujuan";

    for (const pr of o.program) {
      const nama = pr.nama || "(tanpa nama)";
      grup.push({
        nama, pendek: (pr.nama || "surat").slice(0, 28), noSurat: pr.noSurat,
        pos: posProgram(pr, o.pengadaan).map((x) => ({
          ma: `${ringkasKapal(x.kapal)} — ${labelMA(x.ma)}`, pagu: x.pagu, addendum: 0,
        })),
      });

      for (const p of o.pengadaan) {
        if (p.programId !== pr.id) continue;
        const dok = dokumenDari(p, (kapalTeks, maTeks, nilai) => {
          if (!nilai) return [];
          const kapals = pecahKapal(kapalTeks);
          const bagi = kapals.length || 1;
          const ma = labelMA(maTeks);
          return (kapals.length ? kapals : ["(umum)"]).map((k) => ({
            grup: nama, ma: `${ringkasKapal(namaKapalPenuh(k))} — ${ma}`, nilai: nilai / bagi,
          }));
        });
        if (dok) {
          dok._pos.forEach((x: PosItem) => tambahPos(x.grup, x.ma));
          dokumen.push(dok);
        }
      }
    }
  }

  dokumen.forEach((x) => delete x._pos);

  const body = {
    tipe: o.tipe, judul, periode, labelGrup, warna: WARNA[o.tipe],
    dicetak: tanggalIndo(new Date().toISOString().slice(0, 10)),
    grup, dokumen,
  };
  const res = await fetch("/api/anggaran/export-tipe", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  saveAs(await res.blob(), `${judul} — ${periode}.xlsx`.replace(/[\\/:*?"<>|]/g, "-"));
}
