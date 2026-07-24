"use client";
/** Kumpulkan data anggaran -> kirim ke API -> unduh berkas Excel. */
import { saveAs } from "file-saver";
import { PengadaanRow, realisasiRutin, realisasiDocking } from "./store";
import { posProgram, nilaiPerPos } from "./program";
import { PlafonRutin, PlafonDocking, PlafonProgram, KAPAL_ANGGARAN, maKey, jenisAnggaranOf, fullMA } from "./types";
import { ringkasKapal, pecahKapal } from "@/lib/kapal/nama";
import { tanggalIndo, bulanTahun } from "@/lib/format";

const BIRU = "FF16357F", ORANYE = "FFC2410C", INDIGO = "FF4338CA";

export interface SumberExport {
  plafon: PlafonRutin[];
  docking: PlafonDocking[];
  program: PlafonProgram[];
  pengadaan: PengadaanRow[];
  bulan: string;   // "YYYY-MM" untuk Rutin
  tahun: number;   // untuk Docking
  /** batasi ke satu sumber; kosong = semua */
  hanya?: "rutin" | "docking" | "lainnya";
}

export async function exportAnggaranExcel(s: SumberExport) {
  const bagian: any[] = [];

  // --- RUTIN (per Mata Anggaran, bulan terpilih) ---
  if (!s.hanya || s.hanya === "rutin") {
    const e = s.plafon.find((x) => x.bulan === s.bulan);
    const real = realisasiRutin(s.pengadaan, s.bulan);
    const baris = (e?.rows || []).map((r) => ({
      label: r.ma, pagu: r.nilai || 0, addendum: r.addendum || 0, pakai: real.perKey[maKey(r.ma)] || 0,
    }));
    // realisasi yang tak punya pagu tetap ditampilkan supaya angka tak hilang
    Object.entries(real.perKey).forEach(([k, v]) => {
      if (!baris.some((b) => maKey(b.label) === k)) baris.push({ label: fullMA(k), pagu: 0, addendum: 0, pakai: v });
    });
    bagian.push({ kunci: "rutin", judul: "Anggaran Rutin", periode: bulanTahun(s.bulan + "-01"), kolomLabel: "Mata Anggaran", warna: BIRU, baris });
  }

  // --- DOCKING (per kapal; tiap kapal juga dirinci per MA di baris sub) ---
  if (!s.hanya || s.hanya === "docking") {
    const baris: any[] = [];
    for (const kapal of KAPAL_ANGGARAN) {
      const e = s.docking.find((d) => d.kapal === kapal && d.tahun === s.tahun);
      if (!e) continue;
      const real = realisasiDocking(s.pengadaan, kapal, s.tahun);
      for (const r of e.rows || []) {
        const pagu = r.nilai || 0, add = r.addendum || 0, pakai = real.perKey[maKey(r.ma)] || 0;
        if (!pagu && !add && !pakai) continue;
        baris.push({ label: `${ringkasKapal(kapal)} — ${r.ma}`, sub: undefined, pagu, addendum: add, pakai });
      }
    }
    bagian.push({ kunci: "docking", judul: "Anggaran Docking", periode: `Tahun ${s.tahun}`, kolomLabel: "Kapal — Mata Anggaran", warna: ORANYE, baris });
  }

  // --- LAINNYA (per surat x pos) ---
  if (!s.hanya || s.hanya === "lainnya") {
    const baris: any[] = [];
    for (const pr of s.program) {
      const pos = posProgram(pr, s.pengadaan);
      const byKunci: Record<string, number> = {};
      (pr.rows || []).forEach((r) => {
        const kunci = `${r.kapal || "(umum)"}|${maKey(r.ma)}`;
        byKunci[kunci] = (byKunci[kunci] || 0) + (r.addendum || 0);
      });
      for (const x of pos) {
        if (!x.pagu && !x.pakai) continue;
        baris.push({
          label: `${ringkasKapal(x.kapal)} — ${x.ma}`,
          sub: pr.noSurat ? `${pr.nama} · No. ${pr.noSurat}` : pr.nama,
          pagu: x.pagu, addendum: 0, pakai: x.pakai,
        });
      }
    }
    bagian.push({ kunci: "lainnya", judul: "Persetujuan Biaya Lainnya", periode: `${s.program.length} surat persetujuan`, kolomLabel: "Kapal — Mata Anggaran", warna: INDIGO, baris });
  }

  // --- rincian pengadaan (bukti angka terpakai) ---
  const pengadaan = s.pengadaan
    .filter((x) => {
      const j = jenisAnggaranOf(x as any);
      if (s.hanya === "rutin") return j === "rutin" && (x.tanggal || "").slice(0, 7) === s.bulan;
      if (s.hanya === "docking") return j === "docking" && (x.tanggal || "").slice(0, 4) === String(s.tahun);
      if (s.hanya === "lainnya") return j === "lainnya";
      return true;
    })
    .map((x) => {
      const nilai = Object.values(nilaiPerPos(x as any)).reduce((t, v) => t + v, 0);
      const kapal = Array.from(new Set((x.items || []).flatMap((it: any) => pecahKapal(it.kapal || "")))).map(ringkasKapal).join(", ");
      return {
        tanggal: x.tanggal ? tanggalIndo(x.tanggal) : "-",
        jenis: jenisAnggaranOf(x as any).toUpperCase(),
        sumber: x.sumber,
        nama: x.nama,
        kapal: kapal || "-",
        mataAnggaran: (x.mataAnggaran || []).join(", ") || "-",
        nomor: (x as any).noSPPBJ || "-",
        nilai,
      };
    })
    .sort((a, b) => b.nilai - a.nilai);

  const body = { dicetak: tanggalIndo(new Date().toISOString().slice(0, 10)), bagian, pengadaan };
  const res = await fetch("/api/anggaran/export", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  const nama = s.hanya
    ? `Anggaran ${s.hanya === "rutin" ? "Rutin " + bulanTahun(s.bulan + "-01") : s.hanya === "docking" ? "Docking " + s.tahun : "Persetujuan Lainnya"}.xlsx`
    : `Dashboard Anggaran ${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(await res.blob(), nama);
}
