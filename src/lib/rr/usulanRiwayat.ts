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

      const id = [kode, rapi(it.nama), rapi(it.spesifikasi), rapi(it.satuan)].join("|");
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
          deskripsi: it.nama || "(tanpa nama)",
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
}

/**
 * Pilih kandidat sampai mendekati sisa pagu tiap Mata Anggaran.
 *
 * Urutannya bukan asal muat: barang yang paling sering dibeli dan paling baru
 * dibeli didahulukan, karena itulah kebutuhan yang paling mungkin berulang
 * bulan depan. Barang yang tak lagi muat DILEWATI, bukan menghentikan
 * pemilihan — satu barang mahal di tengah daftar tidak boleh mengubur
 * belasan barang kecil yang sebenarnya masih muat.
 *
 * Sisa pagu sengaja tidak dihabiskan sampai nol: batas bawaan 97% menyisakan
 * ruang untuk pembulatan harga dan ongkos kirim yang baru muncul di SPPBJ.
 */
export function isiOtomatis(
  kandidat: Kandidat[],
  sisaPerMA: Record<string, number>,
  opsi: { batasPersen?: number; sudahDipilih?: Set<string> } = {},
): HasilOtomatis {
  const batas = (opsi.batasPersen ?? 97) / 100;
  const pilih = new Set(opsi.sudahDipilih || []);
  const terpakai: Record<string, number> = {};

  // yang sudah dipilih sebelumnya tetap dihitung memakan pagu
  kandidat.forEach((k) => {
    if (pilih.has(k.id)) terpakai[k.kode] = (terpakai[k.kode] || 0) + nilaiKandidat(k);
  });

  for (const k of kandidat) {
    if (pilih.has(k.id)) continue;
    const langit = (sisaPerMA[k.kode] || 0) * batas;
    if (langit <= 0) continue;
    const nilai = nilaiKandidat(k);
    if (!nilai) continue;
    if ((terpakai[k.kode] || 0) + nilai > langit) continue;   // dilewati, bukan dihentikan
    pilih.add(k.id);
    terpakai[k.kode] = (terpakai[k.kode] || 0) + nilai;
  }

  const kurang = Object.entries(sisaPerMA)
    .map(([kode, sisa]) => ({ kode, sisa: sisa - (terpakai[kode] || 0) }))
    .filter((x) => x.sisa > 0 && (terpakai[x.kode] || 0) < x.sisa * 0.5);

  return { pilih, terpakai, kurang };
}
