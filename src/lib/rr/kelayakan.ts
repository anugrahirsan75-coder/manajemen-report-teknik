/**
 * Penjaga isi usulan rencana — barang apa yang BOLEH diusulkan.
 *
 * KENAPA ADA. Penempatan kelompok (penempatan.ts) hanya menjawab "barang ini
 * masuk judul mana", bukan "barang ini pantas diusulkan atau tidak". Untuk
 * Mata Anggaran yang punya beberapa judul, salah tempat masih kelihatan dan
 * bisa dibetulkan. Untuk MA Pelumas yang judulnya cuma SATU, tidak ada yang
 * perlu ditebak — jadi apa pun yang pernah terbukukan ke 5010303001 langsung
 * lolos: air coolant, literan oli, sensor tekanan oli, braso, bahkan biosolar.
 * Semuanya memang pernah tercatat di sana, sebagian karena salah kode, dan
 * mesin usulan hanya mengulang apa yang pernah terjadi.
 *
 * TIGA ATURAN, dari yang paling keras:
 *
 *   1. MOBILISASI tidak pernah diusulkan dalam rencana — baik mobilisasi
 *      pelumas maupun mobilisasi BBM. MA 5010303002 karena itu selalu kosong.
 *   2. BBM tidak pernah masuk rencana, Mata Anggaran mana pun. Yang dilarang
 *      BAHAN BAKARNYA; saringan, pompa, selang, dan rumah filter BBM tetap
 *      boleh — itu suku cadang, dan tempatnya di MA Permesinan.
 *   3. MA Pelumas (5010303001) hanya untuk OLI MESIN, dikenali dari nama
 *      pelumasnya berikut angka kekentalannya (SAE 40, S-40, SAE 10, …).
 *      Barang yang sekadar bersinggungan dengan oli — literan, corong, sensor
 *      tekanan, filter — bukan pelumas dan tidak boleh ikut.
 *
 * Dipakai oleh KEDUA sumber kandidat (riwayat kapal dan database harga) serta
 * hasil pencarian manual. Ditaruh di satu berkas supaya aturannya tidak
 * tercecer: satu pintu yang lupa dipasangi saringan adalah pintu yang akan
 * dipakai orang.
 */

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
 * Angka kekentalan: SAE 40, SAE-40, S-40, S40.
 *
 * Diwajibkan, dan itu memang saringan yang paling berguna di sini: pelumas
 * mesin selalu disebut berikut kekentalannya, sedangkan barang yang cuma
 * bersinggungan dengan oli — "Literan Oli Uk 5 liter", "Sensor tekanan oli" —
 * tidak pernah punya angka itu.
 */
const KEKENTALAN = /\b(?:sae|s)\s*-?\s*(?:10|15|20|30|40|50)\b/i;

/**
 * Barang yang namanya memuat kata pelumas tetapi jelas bukan pelumas.
 * Dipasang sebagai jaring kedua: aturan kekentalan sudah menyaring sebagian
 * besar, ini menangkap sisanya tanpa perlu menunggu kejadian.
 */
const BUKAN_PELUMAS = new RegExp([
  "literan", "jerigen", "corong", "takaran", "coolant", "radiator", "braso",
  "super\\s*pel", "\\bpel\\b", "majun", "kain", "sensor", "filter", "saringan",
  "seal", "gasket", "selang", "pompa", "drum\\s*kosong", "gemuk", "grease",
].join("|"), "i");

/** kode Mata Anggaran pelumas */
export const MA_PELUMAS = "5010303001";
/** kode Mata Anggaran biaya mobilisasi pelumas — tidak pernah diusulkan */
export const MA_MOBILISASI_PELUMAS = "5010303002";

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
 */
export function bolehDiusulkan(kode: string, nama: string, spek = ""): Kelayakan {
  const teks = `${nama || ""} ${spek || ""}`.trim();
  if (!teks) return { boleh: false, alasan: "tanpa nama barang" };

  // 1. mobilisasi — apa pun Mata Anggarannya
  if (MOBILISASI.test(teks)) {
    return { boleh: false, alasan: "mobilisasi tidak diusulkan dalam rencana" };
  }
  if ((kode || "").trim() === MA_MOBILISASI_PELUMAS) {
    return { boleh: false, alasan: "biaya mobilisasi pelumas tidak diusulkan dalam rencana" };
  }

  // 2. bahan bakar — apa pun Mata Anggarannya, kecuali yang jelas suku cadang
  if (BBM.test(teks) && !SUKU_CADANG.test(teks)) {
    return { boleh: false, alasan: "BBM tidak pernah masuk rencana" };
  }

  // 3. MA Pelumas hanya untuk oli mesin
  if ((kode || "").trim() === MA_PELUMAS) {
    if (BUKAN_PELUMAS.test(teks)) {
      return { boleh: false, alasan: "bukan oli mesin — MA Pelumas hanya untuk oli mesin" };
    }
    if (!NAMA_PELUMAS.test(teks) || !KEKENTALAN.test(teks)) {
      return {
        boleh: false,
        alasan: "MA Pelumas hanya untuk oli mesin berikut kekentalannya (mis. Meditrans SAE 40)",
      };
    }
  }

  return BOLEH;
}

/** saring sekumpulan kandidat sekaligus */
export function saringLayak<T extends { kode: string; deskripsi: string; spesifikasi?: string }>(
  isi: T[],
): T[] {
  return isi.filter((k) => bolehDiusulkan(k.kode, k.deskripsi, k.spesifikasi || "").boleh);
}
