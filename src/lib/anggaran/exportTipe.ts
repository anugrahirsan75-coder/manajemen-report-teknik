"use client";
/**
 * Kumpulkan data 1 TIPE anggaran (Rutin / Docking / Lainnya) sampai tingkat ITEM,
 * lalu kirim ke API pembuat Excel berjenjang.
 *
 * Kunci penautan: label Mata Anggaran pada sheet grup HARUS sama persis dengan
 * kolom "Mata Anggaran" di sheet RINCIAN — karena SUMIFS mencocokkan teksnya.
 */
import { saveAs } from "file-saver";
import { PengadaanRow, realisasiDocking } from "./store";
import { posProgram } from "./program";
import {
  PlafonRutin, PlafonDocking, PlafonProgram, KAPAL_ANGGARAN, MATA_ANGGARAN, maKey, fullMA,
  namaKapalPenuh, jenisAnggaranOf,
} from "./types";
import { ringkasKapal, pecahKapal } from "@/lib/kapal/nama";
import { tanggalIndo, bulanTahun } from "@/lib/format";

const WARNA = { rutin: "FF16357F", docking: "FFC2410C", lainnya: "FF4338CA" } as const;

/**
 * Label Mata Anggaran yang dipakai SERAGAM di sheet grup & RINCIAN (kunci SUMIFS).
 * Pakai nama resmi dari master; kalau kodenya tak ada di master, pertahankan teks aslinya
 * (jangan sampai jadi "5010103004 (5010103004)").
 */
function labelMA(teks: string): string {
  const kode = maKey(teks);
  if (!kode) return (teks || "").trim() || "(tanpa Mata Anggaran)";
  const dikenal = MATA_ANGGARAN.some((m) => m.kode === kode);
  if (dikenal) return fullMA(kode);
  // kode di luar master (mis. 5010103004 Insentif) -> pertahankan keterangan aslinya
  let asli = (teks || "").replace(kode, "").trim();
  // buang sepasang kurung terluar bila ada, jangan sentuh kurung di dalam teks
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

/** pecah 1 pengadaan jadi baris item; item multi-kapal dibagi rata */
function itemPengadaan(p: PengadaanRow) {
  const maDefault = (p.mataAnggaran || [])[0] || "";
  const arr = p.items || [];
  const adaFinal = arr.some((it: any) => (it.hargaSpbj || 0) > 0);
  const out: {
    kapal: string; maLabel: string; kodeMa: string;
    item: string; spesifikasi: string; jumlah: number; satuan: string; harga: number; nilai: number;
  }[] = [];
  for (const it of arr as any[]) {
    const harga = adaFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0);
    const nilai = harga * (it.jumlah || 0);
    if (!nilai) continue;
    const maTeks = (it.mataAnggaran || "").trim() || maDefault;
    const kode = maKey(maTeks);
    const kapals = pecahKapal(it.kapal || "");
    const bagi = kapals.length > 1 ? kapals.length : 1;
    for (const k of kapals.length ? kapals : [""]) {
      out.push({
        kapal: namaKapalPenuh(k),
        maLabel: labelMA(maTeks),
        kodeMa: kode,
        item: it.nama || "",
        spesifikasi: it.spesifikasi || "",
        jumlah: bagi > 1 ? 0 : (it.jumlah || 0),   // dibagi -> jumlah tak bermakna, biar nilai yg dipakai
        satuan: bagi > 1 ? "" : (it.satuan || ""),
        harga: bagi > 1 ? 0 : harga,
        nilai: nilai / bagi,
      });
    }
  }
  return out;
}

export async function exportTipeExcel(o: OpsiExportTipe) {
  const grup: any[] = [];
  const rincian: any[] = [];
  let judul = "", periode = "", labelGrup = "";

  const dasar = (p: PengadaanRow) => ({
    tanggal: p.tanggal ? tanggalIndo(p.tanggal) : "–",
    sumber: p.sumber,
    nomor: (p as any).noSPPBJ || "",
    pengadaan: p.nama,
  });

  // ================= DOCKING: grup = kapal, pos = Mata Anggaran =================
  if (o.tipe === "docking") {
    judul = "Anggaran Docking";
    periode = `Tahun ${o.tahun}`;
    labelGrup = "Kapal";

    for (const kapal of KAPAL_ANGGARAN) {
      const e = o.docking.find((d) => d.kapal === kapal && d.tahun === o.tahun);
      if (!e) continue;
      const real = realisasiDocking(o.pengadaan, kapal, o.tahun);
      const pos = (e.rows || []).map((r) => ({
        ma: labelMA(r.ma),
        pagu: r.nilai || 0,
        addendum: r.addendum || 0,
      }));
      // Mata Anggaran yang ada realisasinya tapi tak punya pagu -> tetap dimunculkan
      Object.keys(real.perKey).forEach((k) => {
        if (!pos.some((x) => maKey(x.ma) === k)) pos.push({ ma: labelMA(k), pagu: 0, addendum: 0 });
      });
      grup.push({ nama: kapal, pendek: ringkasKapal(kapal), noSurat: e.noSurat, noSuratAddendum: e.noSuratAddendum, pos });
    }
    const namaGrup = new Set(grup.map((g) => g.nama));
    for (const p of o.pengadaan) {
      if (jenisAnggaranOf(p as any) !== "docking") continue;
      if ((p.tanggal || "").slice(0, 4) !== String(o.tahun)) continue;
      for (const x of itemPengadaan(p)) {
        if (!namaGrup.has(x.kapal)) continue;
        rincian.push({ grup: x.kapal, ma: x.maLabel, ...dasar(p), item: x.item, spesifikasi: x.spesifikasi, jumlah: x.jumlah, satuan: x.satuan, harga: x.harga, nilai: x.nilai });
      }
    }
  }

  // ================= RUTIN: grup = bulan, pos = Mata Anggaran =================
  if (o.tipe === "rutin") {
    judul = "Anggaran Rutin";
    periode = bulanTahun(o.bulan + "-01");
    labelGrup = "Periode";
    const e = o.plafon.find((x) => x.bulan === o.bulan);
    const pos = (e?.rows || []).map((r) => ({ ma: labelMA(r.ma), pagu: r.nilai || 0, addendum: r.addendum || 0 }));
    const namaGrup = periode;

    for (const p of o.pengadaan) {
      if (jenisAnggaranOf(p as any) !== "rutin") continue;
      if ((p.tanggal || "").slice(0, 7) !== o.bulan) continue;
      for (const x of itemPengadaan(p)) {
        if (!pos.some((q) => maKey(q.ma) === x.kodeMa)) pos.push({ ma: x.maLabel, pagu: 0, addendum: 0 });
        rincian.push({
          grup: namaGrup, ma: x.maLabel, ...dasar(p),
          item: `${x.item}${x.kapal ? ` — ${ringkasKapal(x.kapal)}` : ""}`,
          spesifikasi: x.spesifikasi, jumlah: x.jumlah, satuan: x.satuan, harga: x.harga, nilai: x.nilai,
        });
      }
    }
    grup.push({ nama: namaGrup, pendek: periode.replace(/\s+/g, " "), pos });
  }

  // ============ LAINNYA: grup = surat, pos = "KAPAL — Mata Anggaran" ============
  if (o.tipe === "lainnya") {
    judul = "Persetujuan Biaya Lainnya";
    periode = `${o.program.length} surat persetujuan`;
    labelGrup = "Surat Persetujuan";

    for (const pr of o.program) {
      const posPagu = posProgram(pr, o.pengadaan);
      const pos = posPagu.map((x) => ({
        ma: `${ringkasKapal(x.kapal)} — ${labelMA(x.ma)}`,
        pagu: x.pagu, addendum: 0,
      }));
      grup.push({ nama: pr.nama || "(tanpa nama)", pendek: (pr.nama || "surat").slice(0, 28), noSurat: pr.noSurat, pos });

      for (const p of o.pengadaan) {
        if (p.programId !== pr.id) continue;
        for (const x of itemPengadaan(p)) {
          const label = `${ringkasKapal(x.kapal || "(umum)")} — ${x.maLabel}`;
          if (!pos.some((q) => q.ma === label)) pos.push({ ma: label, pagu: 0, addendum: 0 });
          rincian.push({ grup: pr.nama || "(tanpa nama)", ma: label, ...dasar(p), item: x.item, spesifikasi: x.spesifikasi, jumlah: x.jumlah, satuan: x.satuan, harga: x.harga, nilai: x.nilai });
        }
      }
    }
  }

  const body = {
    tipe: o.tipe, judul, periode, labelGrup, warna: WARNA[o.tipe],
    dicetak: tanggalIndo(new Date().toISOString().slice(0, 10)),
    grup, rincian,
  };
  const res = await fetch("/api/anggaran/export-tipe", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  saveAs(await res.blob(), `${judul} — ${periode}.xlsx`.replace(/[\\/:*?"<>|]/g, "-"));
}
