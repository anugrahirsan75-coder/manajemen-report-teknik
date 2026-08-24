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
  /** dari mana barang ini datang — menentukan urutan dan lencana di layar */
  asal: "kapal" | "armada" | "db";
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
  /**
   * Sertakan juga barang milik KAPAL LAIN. Riwayat satu kapal kerap cuma
   * puluhan barang — tak cukup untuk menyusun usulan sebulan, apalagi setelah
   * dibagi per Mata Anggaran. Armada memakai barang yang sebagian besar sama,
   * jadi riwayat kapal lain adalah bahan yang sah; asalnya tetap ditandai
   * supaya yang menyusun tahu itu bukan kebiasaan kapal ini sendiri.
   */
  semuaKapal = false,
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
      const milikKapal = kapals.includes(kapal);
      if (!milikKapal && !semuaKapal) continue;
      const harga = hargaSatuan(it, adaFinal, kapals.length);
      if (!harga) continue;

      const kode = maKey((it.mataAnggaran || "").trim() || maDefault);
      /**
       * Nama pengadaan SENGAJA tidak diikutkan. Pada tarikan realisasi, judul
       * dokumen memang penentu terbaik — satu paket satu maksud. Tapi di sini
       * barangnya dilepas dari dokumennya untuk diusulkan ulang, dan pengadaan
       * rutin bernama "Paketisasi Perawatan ... Mesin" membuat SEISI dokumen
       * jatuh ke Cleaning — bearing pun tercatat alat kebersihan, dan kelompok
       * Service serta Suku Cadang selalu kosong di Lampiran 3.
       */
      const tempat = tentukanKelompok(kode, "", it.nama || "", it.spesifikasi || "");
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
        // barang yang juga pernah dibeli kapal ini naik pangkat jadi "kapal":
        // kebiasaan kapal sendiri lebih kuat daripada kebiasaan armada
        if (milikKapal) { ada.asal = "kapal"; ada.kali = ada.kali; }
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
          asal: milikKapal ? "kapal" : "armada",
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
  }).sort((a, b) => (a.asal === b.asal ? 0 : a.asal === "kapal" ? -1 : 1)
    || b.kali - a.kali || b.bulanTerakhir.localeCompare(a.bulanTerakhir)
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
  /** berapa persen jatah tiap Mata Anggaran akhirnya terisi */
  capai: Record<string, number>;
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
  /**
   * Berapa persen jatah boleh dilewati bila itu justru MENDEKATKAN total ke
   * jatah. Riwayat pelumas satu kapal cuma "Meditrans SAE 40" seharga 6,05 juta
   * sedangkan jatahnya 11,75 juta: satu drum berhenti di 52%, dua drum 103%.
   * Berhenti di 52% jauh lebih meleset daripada lewat 3%.
   */
  toleransiPersen?: number;
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
  const batas = (opsi.batasPersen ?? 99.5) / 100;
  const pilih = new Set(opsi.sudahDipilih || []);
  const jumlahSaran: Record<string, number> = {};
  const terpakai: Record<string, number> = {};
  const acak = pengacak(opsi.benih ?? 1);
  const hindari = opsi.hindari || new Set<string>();

  const jumlahAkhir = (k: Kandidat) => jumlahSaran[k.id] ?? k.jumlah;
  kandidat.forEach((k) => {
    if (pilih.has(k.id)) terpakai[k.kode] = (terpakai[k.kode] || 0) + jumlahAkhir(k) * (k.harga || 0);
  });

  /** jumlah kebiasaan, digeser sedikit bila variasi dinyalakan */
  const jumlahAwal = (k: Kandidat) => {
    if (!opsi.variasiJumlah) return Math.max(1, k.jumlah || 1);
    return Math.max(1, Math.round((k.jumlah || 1) * (0.8 + acak() * 0.4)));   // 80%–120%
  };

  /** urutan pemilihan: sering & baru dibeli didahulukan, diacak bila variasi menyala */
  /** riwayat kapal sendiri paling dipercaya, lalu armada, terakhir database harga */
  const bobotAsal = (k: Kandidat) => (k.asal === "kapal" ? 1 : k.asal === "armada" ? 0.6 : 0.35);

  const urutkan = (isi: Kandidat[]) => (opsi.acak
    ? isi.map((k) => ({
      k, skor: (k.kali + 1) * bobotAsal(k) * (hindari.has(sidikNama(k.deskripsi)) ? 0.45 : 1) * (0.65 + acak() * 0.7),
    })).sort((a, b) => b.skor - a.skor).map((x) => x.k)
    : [...isi].sort((a, b) => bobotAsal(b) - bobotAsal(a)));

  /**
   * Boleh menambah satu satuan lagi? Ya bila hasilnya lebih dekat ke jatah
   * daripada berhenti sekarang, DAN tidak melewati langit toleransi.
   */
  const lebihDekat = (dipakai: number, harga: number, target: number, langit: number) => {
    const sesudah = dipakai + harga;
    return sesudah <= langit && Math.abs(target - sesudah) < Math.abs(target - dipakai);
  };

  const perMA = new Map<string, Kandidat[]>();
  kandidat.forEach((k) => perMA.set(k.kode, [...(perMA.get(k.kode) || []), k]));

  perMA.forEach((isiMA, kode) => {
    const jatah = sisaPerMA[kode] || 0;
    const target = jatah * batas;
    const langitLuar = jatah * (1 + (opsi.toleransiPersen ?? 5) / 100);
    if (target <= 0) return;

    /**
     * Tahap 0 — satu barang untuk TIAP KELOMPOK lebih dulu.
     *
     * Lampiran 3 memecah satu Mata Anggaran ke beberapa judul kebutuhan
     * (cleaning / service / suku cadang / lain-lain), dan usulan yang seluruh
     * nilainya menumpuk di satu judul terbaca asal-asalan. Sebelum pagu
     * direbutkan bebas, tiap kelompok yang punya kandidat diberi satu barang —
     * sesudah itu barulah sisanya diisi menurut peringkat.
     */
    const perKelompok = new Map<string, Kandidat[]>();
    isiMA.forEach((k) => perKelompok.set(k.kunci, [...(perKelompok.get(k.kunci) || []), k]));
    perKelompok.forEach((isiKel) => {
      if (isiKel.some((k) => pilih.has(k.id))) return;     // kelompok ini sudah terwakili
      const k = urutkan(isiKel).find((x) => x.harga > 0
        && x.harga <= target - (terpakai[kode] || 0));
      if (!k) return;
      const jml = Math.min(jumlahAwal(k), Math.floor((target - (terpakai[kode] || 0)) / k.harga));
      if (jml < 1) return;
      pilih.add(k.id);
      if (jml !== k.jumlah) jumlahSaran[k.id] = jml;
      terpakai[kode] = (terpakai[kode] || 0) + jml * k.harga;
    });

    /**
     * Tahap 1 — masukkan barang satu per satu.
     *
     * Barang yang jumlah kebiasaannya tak muat TIDAK dilewati begitu saja,
     * melainkan dikurangi jumlahnya sampai muat. Riwayat pelumas satu kapal
     * kerap cuma satu jenis ("Meditrans SAE 40, 2 drum"); kalau dua drum tak
     * muat lalu barangnya dibuang, Mata Anggaran itu berakhir 0% padahal satu
     * drum jelas muat.
     */
    urutkan(isiMA).forEach((k) => {
      if (pilih.has(k.id) || !k.harga) return;
      const dipakai = terpakai[kode] || 0;
      const ruang = target - dipakai;
      let jml = Math.min(jumlahAwal(k), Math.floor(ruang / k.harga));
      // satu satuan pun tak muat: masih boleh diambil bila justru mendekatkan
      // total ke jatah dan tidak melewati batas toleransi
      if (jml < 1) jml = lebihDekat(dipakai, k.harga, target, langitLuar) ? 1 : 0;
      if (jml < 1) return;
      pilih.add(k.id);
      if (jml !== k.jumlah) jumlahSaran[k.id] = jml;
      terpakai[kode] = dipakai + jml * k.harga;
    });

    /**
     * Tahap 2 — habiskan sisa jatah dengan menambah jumlah barang yang sudah
     * terpilih, termurah dulu. Tanpa tahap ini, jatah berhenti di angka yang
     * kebetulan pas dengan barang terakhir yang muat — pada uji nyata baru 67%
     * dari jatah, dan yang menyusun harus menambal sendiri sisanya.
     *
     * Batas kewajaran: paling banyak tiga kali jumlah kebiasaannya. Usulan yang
     * benar bukan usulan yang menghabiskan pagu dengan satu barang ditumpuk
     * dua puluh kali.
     */
    const terpilihMA = isiMA.filter((k) => pilih.has(k.id) && k.harga > 0)
      .sort((a, b) => a.harga - b.harga);
    let aman = 0;
    while (aman++ < 2000) {
      const dipakai = terpakai[kode] || 0;
      const layak = (k: Kandidat) => jumlahAkhir(k) < Math.max(3, (k.jumlah || 1) * 3)
        && (k.harga <= target - dipakai || lebihDekat(dipakai, k.harga, target, langitLuar));
      const bisa = terpilihMA.find(layak);
      if (!bisa) break;
      jumlahSaran[bisa.id] = jumlahAkhir(bisa) + 1;
      terpakai[kode] = dipakai + bisa.harga;
    }
  });

  const capai: Record<string, number> = {};
  Object.entries(sisaPerMA).forEach(([kode, jatah]) => {
    capai[kode] = jatah > 0 ? Math.round(((terpakai[kode] || 0) / jatah) * 100) : 0;
  });
  const kurang = Object.entries(sisaPerMA)
    .map(([kode, sisa]) => ({ kode, sisa: sisa - (terpakai[kode] || 0) }))
    .filter((x) => x.sisa > 0 && (capai[x.kode] || 0) < 80);

  return { pilih, terpakai, kurang, jumlahSaran, capai };
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
