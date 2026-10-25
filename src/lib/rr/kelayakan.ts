/**
 * Penjaga isi usulan rencana — barang apa yang BOLEH diusulkan.
 *
 * KENAPA ADA. Penempatan kelompok (penempatan.ts) hanya menjawab "barang ini
 * masuk judul mana", bukan "barang ini pantas diusulkan atau tidak". Untuk
 * Mata Anggaran yang punya beberapa judul, salah tempat masih kelihatan dan
 * bisa dibetulkan. MA Pelumas judulnya cuma SATU, jadi apa pun yang pernah
 * terbukukan ke 5010303001 langsung lolos — air coolant, literan oli, sensor
 * tekanan oli, avometer, lampu kerja, sampai biosolar. Semuanya memang pernah
 * tercatat di sana, sebagian karena salah kode, dan mesin usulan hanya
 * mengulang apa yang pernah terjadi.
 *
 * ATURANNYA, dari yang paling keras:
 *
 *   1. Rencana bulanan hanya mengisi TIGA Mata Anggaran: Pelumas, Akomodasi,
 *      dan Permesinan. Selebihnya — mobilisasi pelumas, Kapal Ro-Ro,
 *      sertifikasi docking, fumigasi, mobilisasi kapal — memang selalu nol
 *      pada rencana yang sudah terbit, jadi tidak perlu diusulkan sama sekali.
 *   2. MOBILISASI tidak pernah diusulkan, apa pun Mata Anggarannya.
 *   3. BBM tidak pernah masuk rencana, Mata Anggaran mana pun. Yang dilarang
 *      BAHAN BAKARNYA; saringan, pompa, selang, dan rumah filter BBM tetap
 *      boleh — itu suku cadang, tempatnya di MA Permesinan.
 *   4. MA Pelumas hanya untuk OLI MESIN, dan hanya dua kekentalan: SAE 40 dan
 *      SAE 10. KMP. Kolorai satu-satunya pengecualian — mesinnya tempel dan
 *      memakai Yamalube, seperti pada rencana Oktober 2026 yang sudah terbit.
 *
 * ACUAN BENTUKNYA — RENCANA Oktober 2026.xlsx:
 *   USL MMG   · Kebutuhan Pelumas: "Meditrans SAE 40, PERTAMINA, 2 DRUM"
 *   USL KLRAI · Kebutuhan Pelumas: "Oli yamalube, Yamaha, 1 Box"
 * Dua-duanya SATU baris saja; sisi Pelumas memang sesederhana itu.
 *
 * Dipakai oleh KEDUA sumber kandidat (riwayat kapal dan database harga) serta
 * hasil pencarian manual. Ditaruh di satu berkas supaya aturannya tidak
 * tercecer: satu pintu yang lupa dipasangi saringan adalah pintu yang akan
 * dipakai orang.
 */

/** Mata Anggaran yang memang diisi rencana bulanan */
import { tentukanKelompok } from "./penempatan";

export const MA_PELUMAS = "5010303001";
export const MA_AKOMODASI = "5010403009";
export const MA_PERMESINAN = "5010403100";

export const MA_RENCANA: string[] = [MA_PELUMAS, MA_AKOMODASI, MA_PERMESINAN];

/** barang yang bentuknya mobilisasi/angkutan, bukan barangnya sendiri */
const MOBILISASI = /mobilisasi|mobilsasi|mobilisai|pengangkutan|angkutan|ongkos\s*kirim|ongkir|freight/i;

/**
 * Bahan bakar sebagai KOMODITAS. Kata "solar" dan "bahan bakar" juga muncul
 * pada nama suku cadang, jadi daftar ini tidak dipakai sendirian — lihat
 * SUKU_CADANG di bawah.
 */
const BBM = new RegExp([
  "\\bbbm\\b", "bio\\s*solar", "\\bb\\s*-?\\s*(?:30|35|40)\\b", "bahan\\s*bakar",
  "\\bsolar\\b", "bensin", "pertalite", "pertamax", "dexlite", "\\bpremium\\b",
  "\\bhsd\\b", "\\bmfo\\b", "\\bmdo\\b", "gas\\s*oil", "fuel\\s*oil", "minyak\\s*tanah",
].join("|"), "i");

/**
 * Penanda bahwa yang disebut adalah BENDA ATAU PEKERJAAN pada sistem bahan
 * bakar, bukan bahan bakarnya. "Rekondisi rumah filter bbm ME" adalah
 * pekerjaan permesinan yang sah; yang dilarang adalah membeli solarnya.
 */
const SUKU_CADANG = new RegExp([
  "filter", "saringan", "pompa", "selang", "hose", "tangki", "sensor", "injector",
  "nozzle", "katup", "valve", "pipa", "rumah", "ventilasi", "meter", "gauge",
  "level", "separator", "purifier", "rekondisi", "service", "servis", "perbaikan",
  "kalibrasi", "overhaul", "penggantian\\s+(?!oli)", "cleaning",
].join("|"), "i");

/** nama yang menandai pelumas mesin */
const NAMA_PELUMAS = /meditran|medistran|mediteran|oli\s*mesin|pelumas|lube\s*oil|engine\s*oil|lubricant/i;

/**
 * Hanya SAE 40 dan SAE 10 — bentuk "SAE 40", "SAE-40", "S-40", "S40".
 *
 * Dibatasi dua itu saja atas permintaan yang menyusun, dan memang itu yang
 * tercantum pada paketisasi pelumas: SAE 40 untuk seluruh kapal, SAE 10
 * sebagai cadangan. Kekentalan lain yang muncul di riwayat — SAE 30, SAE 20 —
 * tidak pernah benar-benar diadakan.
 */
const KEKENTALAN_BOLEH = /\b(?:sae|s)\s*-?\s*(?:40|10)\b/i;

/** kekentalan apa pun, dipakai untuk memberi alasan yang tepat saat menolak */
const KEKENTALAN_APA_PUN = /\b(?:sae|s)\s*-?\s*(?:10|15|20|30|40|50)\b/i;

/**
 * KMP. Kolorai memakai Yamalube.
 *
 * Kapalnya bermesin tempel, jadi pelumasnya bukan Meditran drum melainkan
 * Yamalube kemasan box — begitu pula pada rencana Oktober 2026 yang terbit.
 * Pengecualian ini SENGAJA diikat ke nama kapalnya: kalau dibiarkan berlaku
 * umum, Yamalube akan ikut terusul untuk kapal bermesin diesel.
 */
const YAMALUBE = /yamalube|yamaha\s*lube/i;
const KAPAL_YAMALUBE = /kolorai/i;

/**
 * Barang yang namanya memuat kata pelumas tetapi jelas bukan pelumas.
 * Jaring kedua: aturan kekentalan sudah menyaring sebagian besar, ini
 * menangkap sisanya tanpa perlu menunggu kejadian.
 */
const BUKAN_PELUMAS = new RegExp([
  "literan", "jerigen", "corong", "takaran", "coolant", "collant", "radiator",
  "braso", "super\\s*pel", "\\bpel\\b", "majun", "kain", "sensor", "filter",
  "saringan", "seal", "gasket", "selang", "pompa", "drum\\s*kosong", "gemuk",
  "grease", "avometer", "lampu", "\\bkerja\\b", "baterai", "batere",
].join("|"), "i");

export interface Kelayakan {
  boleh: boolean;
  /** kenapa ditolak — dipakai pada catatan di layar, kosong bila boleh */
  alasan: string;
}

const BOLEH: Kelayakan = { boleh: true, alasan: "" };

/**
 * Boleh diusulkan dalam rencana bulanan?
 *
 * @param kode  kode Mata Anggaran
 * @param nama  nama barang / jasa
 * @param spek  spesifikasi, ikut dibaca sebagai petunjuk
 * @param kapal nama kapal — menentukan pengecualian Yamalube
 */
export function bolehDiusulkan(kode: string, nama: string, spek = "", kapal = ""): Kelayakan {
  const teks = `${nama || ""} ${spek || ""}`.trim();
  if (!teks) return { boleh: false, alasan: "tanpa nama barang" };

  // 1. hanya tiga Mata Anggaran yang diisi rencana
  const ma = (kode || "").trim();
  if (!MA_RENCANA.includes(ma)) {
    return { boleh: false, alasan: "rencana hanya mengisi MA Pelumas, Akomodasi, dan Permesinan" };
  }

  // 2. mobilisasi — apa pun Mata Anggarannya
  if (MOBILISASI.test(teks)) {
    return { boleh: false, alasan: "mobilisasi tidak diusulkan dalam rencana" };
  }

  // 3. bahan bakar — apa pun Mata Anggarannya, kecuali yang jelas suku cadang
  if (BBM.test(teks) && !SUKU_CADANG.test(teks)) {
    return { boleh: false, alasan: "BBM tidak pernah masuk rencana" };
  }

  // 4. MA Pelumas: oli mesin SAE 40 / SAE 10, atau Yamalube khusus Kolorai
  if (ma === MA_PELUMAS) {
    if (YAMALUBE.test(teks)) {
      return KAPAL_YAMALUBE.test(kapal || "")
        ? BOLEH
        : { boleh: false, alasan: "Yamalube hanya untuk KMP. Kolorai" };
    }
    if (BUKAN_PELUMAS.test(teks)) {
      return { boleh: false, alasan: "bukan oli mesin — MA Pelumas hanya untuk oli mesin" };
    }
    if (!NAMA_PELUMAS.test(teks)) {
      return { boleh: false, alasan: "bukan oli mesin — MA Pelumas hanya untuk oli mesin" };
    }
    if (!KEKENTALAN_BOLEH.test(teks)) {
      return {
        boleh: false,
        alasan: KEKENTALAN_APA_PUN.test(teks)
          ? "MA Pelumas hanya SAE 40 atau SAE 10"
          : "oli tanpa kekentalan — MA Pelumas hanya SAE 40 atau SAE 10",
      };
    }
  }

  return BOLEH;
}

/**
 * Tempatkan ulang satu baris menurut aturan penempatan yang BERLAKU SEKARANG.
 *
 * Dokumen rencana menyimpan kelompoknya sendiri (`kunci`), jadi aturan
 * penempatan yang diperbaiki tidak menyentuh dokumen yang sudah ada: berkas
 * Excel-nya tetap mencetak lampu LED dan baut di bawah Suku Cadang, karena
 * di situlah mereka ditempatkan waktu disusun. Itu bukan bug pada aturannya,
 * melainkan pada tempat aturannya dipasang — dan berkas yang dikirim ke pusat
 * dibangun dari dokumen tersimpan, bukan dari aturannya.
 *
 * Kelompoknya hanya diubah kalau Mata Anggarannya tetap sama. Baris yang
 * dipindah tangan ke Mata Anggaran lain lewat tombol ⇄ adalah keputusan orang,
 * dan keputusan orang tidak dibatalkan oleh aturan otomatis.
 */
export function kunciTempatBaru(
  kunci: string, deskripsi: string, spesifikasi = "", harga = 0,
): string {
  const kode = (kunci || "").split("|")[0];
  if (!kode) return kunci;
  const tempat = tentukanKelompok(kode, "", deskripsi || "", spesifikasi || "", harga || 0);
  if (!tempat.kunci || tempat.kunci.split("|")[0] !== kode) return kunci;
  return tempat.kunci;
}

/**
 * Buang baris yang tidak layak dari dokumen yang SUDAH tersimpan.
 *
 * Saringan di atas bekerja saat menyusun, jadi draf yang terlanjur dibuat
 * sebelum aturan ini ada tetap memuat barangnya. Membersihkannya satu per
 * satu di layar berarti belasan kapal dikerjakan tangan; ini menyediakan
 * tombolnya.
 *
 * Yang dikembalikan dokumen BARU — kelompoknya tetap lengkap walau menjadi
 * kosong, karena berkas Lampiran 3 memang mencetak tiap judul berikut
 * totalnya, termasuk yang nol.
 */
export interface BarisDoc {
  deskripsi: string;
  spesifikasi?: string;
  harga?: number;
}

export function bersihkanDoc<
  D extends { kapal: string; kelompok: { kunci: string; items: BarisDoc[] }[] },
>(doc: D): { doc: D; dibuang: { nama: string; alasan: string }[]; dipindah: number } {
  const dibuang: { nama: string; alasan: string }[] = [];

  // tahap 1 — buang yang tidak layak, kumpulkan sisanya berikut tempat barunya
  const simpanan = new Map<string, BarisDoc[]>();
  (doc.kelompok || []).forEach((k) => {
    const kode = (k.kunci || "").split("|")[0];
    (k.items || []).forEach((it) => {
      const h = bolehDiusulkan(kode, it.deskripsi, it.spesifikasi || "", doc.kapal);
      if (!h.boleh) { dibuang.push({ nama: it.deskripsi, alasan: h.alasan }); return; }
      const tujuan = kunciTempatBaru(k.kunci, it.deskripsi, it.spesifikasi || "", it.harga || 0);
      simpanan.set(tujuan, [...(simpanan.get(tujuan) || []), it]);
    });
  });

  /*
   * Tahap 2 — rakit ulang memakai KERANGKA kelompok dokumen aslinya.
   *
   * Kelompok yang menjadi kosong tetap ada: berkas Lampiran 3 mencetak tiap
   * judul berikut totalnya, termasuk yang nol, dan judul yang hilang membuat
   * rekap Budget Control kehilangan baris penjumlahannya.
   */
  let dipindah = 0;
  const kelompok = (doc.kelompok || []).map((k) => {
    const isi = simpanan.get(k.kunci) || [];
    simpanan.delete(k.kunci);
    return { ...k, items: isi };
  });
  // baris yang tempat barunya belum ada di dokumen ini
  simpanan.forEach((isi, kunci) => kelompok.push({ kunci, items: isi }));
  // hitung berapa yang benar-benar berpindah judul
  (doc.kelompok || []).forEach((k) => {
    const sesudah = kelompok.find((x) => x.kunci === k.kunci)?.items || [];
    const nama = new Set(sesudah.map((x) => x.deskripsi));
    (k.items || []).forEach((it) => {
      if (!nama.has(it.deskripsi)
        && !dibuang.some((d) => d.nama === it.deskripsi)) dipindah++;
    });
  });

  return { doc: { ...doc, kelompok } as D, dibuang, dipindah };
}

/** saring sekumpulan kandidat sekaligus */
export function saringLayak<T extends { kode: string; deskripsi: string; spesifikasi?: string }>(
  isi: T[], kapal = "",
): T[] {
  return isi.filter((k) => bolehDiusulkan(k.kode, k.deskripsi, k.spesifikasi || "", kapal).boleh);
}
