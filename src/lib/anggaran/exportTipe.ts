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
  namaKapalPenuh, jenisAnggaranOf, jenisItemOf, labelMA as labelMataAnggaran,
} from "./types";
import { rutinKapal } from "./rka2026";
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
  bulan: string;        // "YYYY-MM" — bulan awal (Rutin)
  /** bulan akhir bila yang diminta REKAP RENTANG; kosong = satu bulan saja */
  bulanAkhir?: string;
  tahun: number;        // (Docking)
}

/** daftar "YYYY-MM" dari awal sampai akhir (inklusif); urutan otomatis dibetulkan */
export function daftarBulan(dari: string, sampai: string): string[] {
  if (!dari) return [];
  const a = dari <= (sampai || dari) ? dari : sampai;
  const b = dari <= (sampai || dari) ? (sampai || dari) : dari;
  const out: string[] = [];
  const [y0, m0] = a.split("-").map(Number);
  const [y1, m1] = b.split("-").map(Number);
  if (!y0 || !m0 || !y1 || !m1) return [dari];
  let y = y0, m = m0;
  // batas aman 240 bulan supaya salah input tak membuat perulangan tak berujung
  for (let i = 0; i < 240; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (y === y1 && m === m1) break;
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return out;
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
function dokumenDari(
  p: PengadaanRow,
  posDari: (kapal: string, ma: string, nilai: number, it: any) => PosItem[],
) {
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
    const pos = posDari((it.kapal || "").trim(), (it.mataAnggaran || "").trim() || maDefault, nilai, it);
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

/** realisasi satu tipe, dipecah per kapal dan per Mata Anggaran */
function susunAnalisis(o: OpsiExportTipe) {
  const bulanRange = daftarBulan(o.bulan, o.bulanAkhir || o.bulan);
  const dalamCakupan = (p: PengadaanRow) => {
    if (p.stok) return false;
    if (o.tipe === "rutin") return bulanRange.includes((p.tanggal || "").slice(0, 7));
    return (p.tanggal || "").slice(0, 4) === String(o.tahun);
  };

  const perKapal: Record<string, number> = {};
  const perKapalMa: Record<string, Record<string, number>> = {};
  const perBulan: Record<string, number> = {};
  const perMa: Record<string, number> = {};
  const besar: { nama: string; tanggal: string; nilai: number; ma: string }[] = [];

  for (const p of o.pengadaan) {
    if (!dalamCakupan(p)) continue;
    const arr: any[] = p.items || [];
    const adaFinal = arr.some((it) => (it.hargaSpbj || 0) > 0);
    const maDefault = (p.mataAnggaran || [])[0] || "";
    let nilaiDok = 0;
    let maDok = "";
    for (const it of arr) {
      if (jenisItemOf(p.raw || {}, it).jenis !== o.tipe) continue;
      const nilai = (adaFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0)) * (it.jumlah || 0);
      if (!nilai) continue;
      const ma = labelMataAnggaran(maKey((it.mataAnggaran || "").trim() || maDefault));
      const kapals = pecahKapal((it.kapal || "").trim()).map((k) => namaKapalPenuh(k));
      const daftarKapal = kapals.length ? kapals : ["(tanpa kapal)"];
      for (const k of daftarKapal) {
        const bagian = nilai / daftarKapal.length;
        perKapal[k] = (perKapal[k] || 0) + bagian;
        perKapalMa[k] = perKapalMa[k] || {};
        perKapalMa[k][ma] = (perKapalMa[k][ma] || 0) + bagian;
      }
      perMa[ma] = (perMa[ma] || 0) + nilai;
      perBulan[(p.tanggal || "").slice(0, 7)] = (perBulan[(p.tanggal || "").slice(0, 7)] || 0) + nilai;
      nilaiDok += nilai;
      if (!maDok) maDok = ma;
    }
    if (nilaiDok) besar.push({ nama: p.nama, tanggal: p.tanggal || "", nilai: nilaiDok, ma: maDok });
  }
  besar.sort((a, b) => b.nilai - a.nilai);

  // RKA rutin per kapal untuk rentang bulan yang diexport (bulan docking dilewati,
  // sama seperti perhitungan di aplikasi)
  const rkaKapal: Record<string, number> = {};
  if (o.tipe === "rutin") {
    for (const kapal of KAPAL_ANGGARAN) {
      const pos = rutinKapal(kapal);
      let jml = 0;
      for (const [ma, arr] of Object.entries(pos)) {
        if (["5010403003", "5010302004", "5010302006", "5010318000"].includes(ma)) continue;
        const bulanDock = (pos["5010403003"] || []).findIndex((v) => v) + 1;
        bulanRange.forEach((ym) => {
          const bl = parseInt(ym.slice(5, 7), 10);
          if (bl === bulanDock) return;
          jml += (arr as number[])[bl - 1] || 0;
        });
      }
      if (jml) rkaKapal[kapal] = jml;
    }
  }

  const maUrut = Object.entries(perMa).sort((a, b) => b[1] - a[1]).map(([ma]) => ma).slice(0, 6);
  return {
    perBulan: bulanRange.map((b) => ({ bulan: b, nilai: perBulan[b] || 0 })),
    kapal: Object.keys({ ...perKapal, ...rkaKapal })
      .filter((k) => k !== "(tanpa kapal)")
      .map((k) => ({
        kapal: k, real: perKapal[k] || 0, rka: rkaKapal[k] || 0,
        pos: maUrut.map((ma) => perKapalMa[k]?.[ma] || 0),
      }))
      .sort((a, b) => b.real - a.real),
    kolomMa: maUrut,
    besar: besar.slice(0, 15),
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
      if (p.stok) continue;                    // persediaan tidak menggerus pagu
      if ((p.tanggal || "").slice(0, 4) !== String(o.tahun)) continue;
      const dok = dokumenDari(p, (kapalTeks, maTeks, nilai, it) => {
        if (!nilai || jenisItemOf(p.raw || {}, it).jenis !== "docking") return [];
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

  // ============ RUTIN: satu grup PER BULAN, pos = Mata Anggaran ============
  // Satu bulan maupun rentang bulan memakai jalur yang sama: rentang hanya
  // berarti lebih dari satu grup, jadi rekapnya tetap terpisah per bulan
  // sekaligus punya baris TOTAL keseluruhan.
  if (o.tipe === "rutin") {
    judul = "Anggaran Rutin";
    labelGrup = "Periode";
    const bulanRange = daftarBulan(o.bulan, o.bulanAkhir || o.bulan);
    periode = bulanRange.length > 1
      ? `${bulanTahun(bulanRange[0] + "-01")} – ${bulanTahun(bulanRange[bulanRange.length - 1] + "-01")} (${bulanRange.length} bulan)`
      : bulanTahun(o.bulan + "-01");

    const labelBulan: Record<string, string> = {};
    bulanRange.forEach((b) => {
      const nama = bulanTahun(b + "-01");
      labelBulan[b] = nama;
      const e = o.plafon.find((x) => x.bulan === b);
      grup.push({
        nama, pendek: nama,
        pos: (e?.rows || []).map((x) => ({ ma: labelMA(x.ma), pagu: x.nilai || 0, addendum: x.addendum || 0 })),
      });
    });

    for (const p of o.pengadaan) {
      // Barang yang masuk PERSEDIAAN tidak menggerus pagu — aturan yang sama
      // dipakai layar Kendali Anggaran. Tanpa ini angka berkas ekspor lebih
      // besar daripada angka di layar dan dua-duanya terlihat "benar".
      if (p.stok) continue;
      const bl = (p.tanggal || "").slice(0, 7);
      if (!labelBulan[bl]) continue;
      const dok = dokumenDari(p, (_kapal, maTeks, nilai, it) =>
        nilai && jenisItemOf(p.raw || {}, it).jenis === "rutin"
          ? [{ grup: labelBulan[bl], ma: labelMA(maTeks), nilai }] : []);
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
        if (p.stok || p.programId !== pr.id) continue;   // persediaan tidak menggerus pagu
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

  /**
   * Bahan sheet ANALISIS.
   *
   * Ringkasan & Budget Control menjawab "berapa"; bagian ini menjawab
   * "kapal mana, kenapa, dan bagaimana sampai Desember" — yang justru
   * ditanyakan saat rapat. Angkanya memakai aturan yang sama dengan layar
   * Kendali Anggaran, jadi tidak akan berbeda dengan yang dilihat di aplikasi.
   */
  const analisis = susunAnalisis(o);

  const body = {
    tipe: o.tipe, judul, periode, labelGrup, warna: WARNA[o.tipe], analisis,
    dicetak: tanggalIndo(new Date().toISOString().slice(0, 10)),
    grup, dokumen,
  };
  const res = await fetch("/api/anggaran/export-tipe", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  saveAs(await res.blob(), `${judul} — ${periode}.xlsx`.replace(/[\\/:*?"<>|]/g, "-"));
}
