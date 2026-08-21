"use client";
/**
 * Menyusun USULAN (rencana) bulanan dari RIWAYAT pengadaan, dengan kendali RKA.
 *
 * Menyusun Lampiran 3 selama ini berarti mengetik ulang barang yang itu-itu
 * juga: pelumas, majun, deterjen, saringan, lampu. Barangnya sudah pernah
 * dibeli berkali-kali dan tercatat rapi di SPPBJ — jadi yang masuk akal bukan
 * mengetik ulang, melainkan MEMILIH dari riwayat kapal itu sendiri.
 *
 * Dua hal yang dijawab modul ini:
 *
 *   1. APA yang biasanya dibeli kapal ini — beserta berapa kali muncul, kapan
 *      terakhir, dan harga terakhirnya. Barang yang muncul tiap bulan jelas
 *      lebih layak diusulkan daripada yang sekali pernah dibeli setahun lalu.
 *
 *   2. BERAPA yang boleh diusulkan — pagu RKA bulan itu dikurangi rencana kapal
 *      lain yang sudah tersimpan. Tanpa pengurangan itu tiap kapal akan menyusun
 *      seolah pagu sebulan miliknya sendiri, dan totalnya pasti jebol.
 *
 * Yang TIDAK dikerjakan di sini: mengubah dokumen. Modul ini hanya menghitung
 * dan mengusulkan; keputusan tetap di tangan yang menyusun.
 */
import { PengadaanRow } from "@/lib/anggaran/store";
import { maKey, paguTotal } from "@/lib/anggaran/types";
import { pecahKapal } from "@/lib/kapal/nama";
import { namaKapalPenuh } from "@/lib/anggaran/types";
import { bersihNamaItem } from "@/lib/harga/bersihNama";
import { tentukanKelompok } from "./penempatan";
import { RrDoc, bulanKe, totalPerMA } from "./types";

export interface Kandidat {
  /** sidik jari barang — dipakai sebagai kunci pilihan di layar */
  id: string;
  kunci: string;          // kelompok Lampiran 3: `${kode}|${judul}`
  kode: string;           // Mata Anggaran
  judul: string;          // judul kelompok
  deskripsi: string;
  spesifikasi: string;
  satuan: string;
  /** usulan bawaan: jumlah lazim & harga terakhir */
  jumlah: number;
  harga: number;
  hargaRata: number;
  /** berapa BULAN barang ini pernah dibeli (bukan berapa dokumen) */
  kali: number;
  bulanTerakhir: string;
  bulanMuncul: string[];
  contohDokumen: string;
}

const rapi = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

/** nilai satuan satu item pengadaan, sudah dibagi bila dipakai beberapa kapal */
const hargaSatuan = (it: any, adaFinal: boolean, bagi: number) =>
  ((adaFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0)) || 0) / (bagi || 1);

/**
 * Barang yang pernah dibeli kapal ini, dirangkum.
 *
 * Hanya pengadaan RUTIN dan hanya bulan-bulan SEBELUM bulan yang direncanakan —
 * memasukkan bulan yang sedang disusun akan membuat rencana bersandar pada
 * dokumen yang belum tentu jadi.
 */
export function kandidatDariRiwayat(
  pengadaan: PengadaanRow[],
  kapal: string,
  bulanTarget: string,
  bulanKeBelakang = 12,
): Kandidat[] {
  const batasAwal = bulanKe(bulanTarget, -Math.max(1, bulanKeBelakang));
  const peta = new Map<string, Kandidat & { totJumlah: number; totHarga: number; n: number }>();

  for (const p of pengadaan) {
    if (p.jenis !== "rutin") continue;
    const bulan = (p.tanggal || "").slice(0, 7);
    if (!bulan || bulan >= bulanTarget || bulan < batasAwal) continue;

    const arr: any[] = p.items || [];
    const adaFinal = arr.some((it) => (it.hargaSpbj || 0) > 0);
    const maDefault = (p.mataAnggaran || [])[0] || "";

    for (const it of arr) {
      const kapals = pecahKapal(it.kapal || "").map(namaKapalPenuh);
      if (!kapals.includes(kapal)) continue;
      const harga = hargaSatuan(it, adaFinal, kapals.length);
      if (!harga) continue;

      const kode = maKey((it.mataAnggaran || "").trim() || maDefault);
      const tempat = tentukanKelompok(kode, p.nama || "", it.nama || "", it.spesifikasi || "");
      if (!tempat.kunci) continue;

      /**
       * Nama barangnya dibersihkan lebih dulu. SPPBJ menulis judul pekerjaan
       * ("Pengadaan Majun Kapal KMP. TUNA Juli 2026"), sedangkan Lampiran 3
       * memuat nama BARANG — narasi yang ikut terbawa akan terbaca di dokumen
       * yang dikirim ke pusat. Sidik jarinya juga memakai nama bersih, jadi
       * barang sama yang ditulis berbeda-beda tiap bulan tetap terkumpul jadi satu.
       */
      const nama = bersihNamaItem(it.nama || "") || (it.nama || "").trim();
      const id = [kode, rapi(nama), rapi(it.spesifikasi), rapi(it.satuan)].join("|");
      const ada = peta.get(id);
      if (ada) {
        ada.n++;
        ada.totJumlah += it.jumlah || 0;
        ada.totHarga += harga;
        if (!ada.bulanMuncul.includes(bulan)) ada.bulanMuncul.push(bulan);
        if (bulan >= ada.bulanTerakhir) {
          ada.bulanTerakhir = bulan;
          ada.harga = Math.round(harga);              // harga TERAKHIR, bukan rata-rata
          ada.contohDokumen = `${p.sumber} ${p.nama}`;
        }
      } else {
        peta.set(id, {
          id, kunci: tempat.kunci, kode, judul: tempat.judul,
          deskripsi: nama || "(tanpa nama)",
          spesifikasi: it.spesifikasi || "",
          satuan: it.satuan || "",
          jumlah: it.jumlah || 1,
          harga: Math.round(harga),
          hargaRata: Math.round(harga),
          kali: 0, bulanTerakhir: bulan, bulanMuncul: [bulan],
          contohDokumen: `${p.sumber} ${p.nama}`,
          totJumlah: it.jumlah || 0, totHarga: harga, n: 1,
        });
      }
    }
  }

  return Array.from(peta.values()).map((k) => {
    const { totJumlah, totHarga, n, ...sisa } = k;
    return {
      ...sisa,
      kali: k.bulanMuncul.length,
      /** jumlah lazim: rata-rata pembelian, dibulatkan ke atas — kekurangan barang lebih mahal daripada kelebihan sedikit */
      jumlah: Math.max(1, Math.ceil(totJumlah / Math.max(1, n))),
      hargaRata: Math.round(totHarga / Math.max(1, n)),
      bulanMuncul: k.bulanMuncul.sort(),
    };
  }).sort((a, b) => b.kali - a.kali || b.bulanTerakhir.localeCompare(a.bulanTerakhir)
    || (b.jumlah * b.harga) - (a.jumlah * a.harga));
}

export const nilaiKandidat = (k: Pick<Kandidat, "jumlah" | "harga">) => (k.jumlah || 0) * (k.harga || 0);

/* ══════════════════════════════════════════════════════════════════════════
   Kendali RKA
   ══════════════════════════════════════════════════════════════════════════ */

export interface BarisKendali {
  kode: string;
  pagu: number;
  /** rencana kapal LAIN yang sudah tersimpan pada bulan itu */
  kapalLain: number;
  /** rencana kapal ini (dokumen yang sedang disusun) */
  kapalIni: number;
  /** yang sedang dipilih di layar susun, belum masuk dokumen */
  dipilih: number;
  sisa: number;
}

/** pagu rutin bulan itu per Mata Anggaran */
export function paguBulan(plafon: any[], bulan: string): Record<string, number> {
  const out: Record<string, number> = {};
  const p = (plafon || []).find((x: any) => x.bulan === bulan);
  (p?.rows || []).forEach((r: any) => {
    const k = maKey(r.ma);
    out[k] = (out[k] || 0) + paguTotal(r);
  });
  return out;
}

/**
 * Pembanding yang dipakai layar: pagu rilis bila sudah ada, kalau belum RKA.
 *
 * Rencana disusun JAUH sebelum pagu bulan itu dirilis pusat — rencana September
 * & Oktober ditulis paling lambat 22 Agustus, sedangkan rilisnya belum tentu
 * turun. Tanpa cadangan ini, layar kendali kosong justru pada bulan yang sedang
 * disusun, dan penyusunnya kehilangan satu-satunya pembanding yang dia punya.
 */
export function paguPembanding(
  plafon: any[], rka: { bulanan?: Record<string, Record<string, number>> } | null, bulan: string,
): { nilai: Record<string, number>; sumber: "rilis" | "rka" | "kosong" } {
  const rilis = paguBulan(plafon, bulan);
  if (Object.values(rilis).some((v) => v > 0)) return { nilai: rilis, sumber: "rilis" };
  const dariRka = (rka?.bulanan || {})[bulan] || {};
  if (Object.values(dariRka).some((v) => v > 0)) return { nilai: { ...dariRka }, sumber: "rka" };
  return { nilai: {}, sumber: "kosong" };
}

/** total rencana yang sudah tersimpan pada bulan itu, per MA — kapal tertentu bisa dikecualikan */
export function rencanaTersimpan(dok: RrDoc[], bulan: string, kecualiKapal?: string): Record<string, number> {
  const out: Record<string, number> = {};
  (dok || [])
    .filter((d) => d.tipe === "rencana" && d.bulan === bulan && d.kapal !== kecualiKapal)
    .forEach((d) => Object.entries(totalPerMA(d)).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; }));
  return out;
}

export function susunKendali(
  pagu: Record<string, number>,
  kapalLain: Record<string, number>,
  kapalIni: Record<string, number>,
  dipilih: Record<string, number>,
): BarisKendali[] {
  const kunci = Array.from(new Set([
    ...Object.keys(pagu), ...Object.keys(kapalLain), ...Object.keys(kapalIni), ...Object.keys(dipilih),
  ]));
  return kunci.map((kode) => {
    const p = pagu[kode] || 0, l = kapalLain[kode] || 0, i = kapalIni[kode] || 0, d = dipilih[kode] || 0;
    return { kode, pagu: p, kapalLain: l, kapalIni: i, dipilih: d, sisa: p - l - i - d };
  }).sort((a, b) => b.pagu - a.pagu || b.sisa - a.sisa);
}

/* ══════════════════════════════════════════════════════════════════════════
   Isi otomatis
   ══════════════════════════════════════════════════════════════════════════ */

export interface HasilOtomatis {
  pilih: Set<string>;
  terpakai: Record<string, number>;
  /** MA yang pagunya masih jauh dari terisi setelah seluruh kandidat dicoba */
  kurang: { kode: string; sisa: number }[];
  /** jumlah yang disarankan berbeda dari kebiasaan, dipakai layar untuk menampilkannya */
  jumlahSaran: Record<string, number>;
}

export interface OpsiOtomatis {
  batasPersen?: number;
  sudahDipilih?: Set<string>;
  /** susunan berbeda tiap kali diacak; tanpa ini hasilnya selalu daftar yang sama persis */
  acak?: boolean;
  /** benih keacakan — angka sama menghasilkan susunan sama, jadi bisa diulang */
  benih?: number;
  /** sidik nama barang yang dipakai rencana bulan sebelumnya (dari bersihNamaItem) */
  hindari?: Set<string>;
  /** jumlah ikut divariasikan ±20% supaya angkanya tak persis sama tiap bulan */
  variasiJumlah?: boolean;
}

/** pengacak berbenih (mulberry32) — hasilnya bisa diulang, tak seperti Math.random */
function pengacak(benih: number): () => number {
  let a = (benih || 1) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const sidikNama = (s: string) => bersihNamaItem(s).toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Pilih kandidat sampai mendekati sisa pagu tiap Mata Anggaran.
 *
 * Urutannya bukan asal muat: barang yang paling sering dan paling baru dibeli
 * didahulukan, karena itulah kebutuhan yang paling mungkin berulang bulan depan.
 *
 * VARIASI. Menyalin bulan lalu bulat-bulat memang paling cepat, tapi usulan yang
 * tiap bulan sama persis — barang sama, jumlah sama, urutan sama — terbaca
 * sebagai salinan, bukan sebagai perencanaan. Maka:
 *   · skor tiap barang dikalikan faktor acak 0,65–1,35, sehingga barang peringkat
 *     tengah punya peluang naik dan susunannya berbeda tiap kali diacak;
 *   · barang yang dipakai rencana BULAN LALU diberi penalti (bukan dilarang) —
 *     kebutuhan pokok seperti pelumas tetap boleh muncul lagi, hanya tidak
 *     mendominasi;
 *   · jumlahnya digeser ±20% dari kebiasaan.
 * Yang TIDAK ikut diacak: batas pagu. Berapa pun variasinya, total tetap tunduk
 * pada jatah tiap Mata Anggaran.
 *
 * Barang yang tak lagi muat DILEWATI, bukan menghentikan pemilihan — satu barang
 * mahal di tengah daftar tidak boleh mengubur belasan barang kecil yang masih muat.
 */
export function isiOtomatis(
  kandidat: Kandidat[],
  sisaPerMA: Record<string, number>,
  opsi: OpsiOtomatis = {},
): HasilOtomatis {
  const batas = (opsi.batasPersen ?? 97) / 100;
  const pilih = new Set(opsi.sudahDipilih || []);
  const terpakai: Record<string, number> = {};
  const jumlahSaran: Record<string, number> = {};
  const acak = pengacak(opsi.benih ?? 1);
  const hindari = opsi.hindari || new Set<string>();

  kandidat.forEach((k) => {
    if (pilih.has(k.id)) terpakai[k.kode] = (terpakai[k.kode] || 0) + nilaiKandidat(k);
  });

  /** jumlah yang disarankan: kebiasaan, digeser sedikit bila variasi dinyalakan */
  const jumlahUntuk = (k: Kandidat) => {
    if (!opsi.variasiJumlah) return k.jumlah;
    const geser = 0.8 + acak() * 0.4;                    // 80%–120%
    return Math.max(1, Math.round((k.jumlah || 1) * geser));
  };

  const urut = opsi.acak
    ? kandidat.map((k) => {
      const bobotUlang = hindari.has(sidikNama(k.deskripsi)) ? 0.45 : 1;
      const skor = (k.kali + 1) * bobotUlang * (0.65 + acak() * 0.7);
      return { k, skor };
    }).sort((a, b) => b.skor - a.skor).map((x) => x.k)
    : kandidat;

  for (const k of urut) {
    if (pilih.has(k.id)) continue;
    const langit = (sisaPerMA[k.kode] || 0) * batas;
    if (langit <= 0) continue;
    const jml = jumlahUntuk(k);
    const nilai = jml * (k.harga || 0);
    if (!nilai) continue;
    if ((terpakai[k.kode] || 0) + nilai > langit) continue;
    pilih.add(k.id);
    if (jml !== k.jumlah) jumlahSaran[k.id] = jml;
    terpakai[k.kode] = (terpakai[k.kode] || 0) + nilai;
  }

  const kurang = Object.entries(sisaPerMA)
    .map(([kode, sisa]) => ({ kode, sisa: sisa - (terpakai[kode] || 0) }))
    .filter((x) => x.sisa > 0 && (terpakai[x.kode] || 0) < x.sisa * 0.5);

  return { pilih, terpakai, kurang, jumlahSaran };
}

/** sidik nama barang yang dipakai rencana bulan tertentu — bahan penalti variasi */
export function namaDipakai(dok: RrDoc[], bulan: string, kapal: string): Set<string> {
  const out = new Set<string>();
  (dok || [])
    .filter((d) => d.tipe === "rencana" && d.bulan === bulan && d.kapal === kapal)
    .forEach((d) => (d.kelompok || []).forEach((g) => (g.items || []).forEach((i) => {
      const s = sidikNama(i.deskripsi || "");
      if (s) out.add(s);
    })));
  return out;
}
