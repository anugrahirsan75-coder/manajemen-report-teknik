/**
 * Rekap Awak Kapal & Penanda Tangan.
 *
 * Yang dicatat di sini NAMA dan JABATAN penanda tangan, bukan gambar tanda
 * tangannya. Kumpulan potongan tanda tangan per orang yang sudah dibersihkan
 * sama saja dengan stempel siap tempel: sekali ada, tanda tangan seseorang
 * bisa muncul di dokumen yang tak pernah ia tandatangani. Yang memang
 * dibutuhkan saat menyusun BA, SPPBJ, dan laporan adalah namanya — siapa
 * Nakhoda dan KKM kapal ini saat dokumen dibuat — dan itulah yang disimpan.
 */

export interface Awak {
  nama: string;
  jabatan: string;
  /** nomor induk karyawan; awalan KKP_ untuk tenaga alih daya */
  nik?: string;
  /** sertifikat kepelautan, mis. ANT-III / ATT-IV */
  coc?: string;
  /** terhitung mulai tanggal penempatan (ISO) */
  tmt?: string;
  catatan?: string;
}

export interface KapalAwak {
  kapal: string;
  awak: Awak[];
  /** dari mana daftar ini berasal, supaya bisa ditelusuri saat diragukan */
  sumber?: string;
  diubahPada?: string;
}

/** Jabatan yang tanda tangannya muncul di dokumen teknik. */
export const JABATAN_PENANDA = [
  "NAKHODA", "MUALIM I", "KKM/MASINIS I", "KKM / MASINIS I", "PJS KKM", "MASINIS II",
];

export const JABATAN_UMUM = [
  "NAKHODA", "MUALIM I", "MUALIM II", "MUALIM III", "KKM/MASINIS I", "MASINIS II",
  "MASINIS III", "MASINIS IV", "MANDOR MESIN", "SERANG", "JURU MUDI", "JURU MINYAK",
  "KELASI", "JURU MASAK",
];

export const rapiJabatan = (j: string) =>
  (j || "").toUpperCase().replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();

/** kunci padat untuk membandingkan jabatan: "KKM / MASINIS I" = "KKM/MASINIS I" */
const padat = (j: string) => rapiJabatan(j).replace(/[\s/]/g, "");

/**
 * Urutan tampil: pejabat kapal dulu, baru awak lain — sesuai susunan daftar SDM.
 *
 * Kecocokan harus sama persis lebih dulu. Dengan awalan saja, "MUALIM II"
 * terbaca sebagai "MUALIM I" dan Mualim II naik ke urutan Mualim I.
 */
const URUT = JABATAN_UMUM.map(padat);
export const urutanJabatan = (j: string) => {
  const k = padat(j);
  const sama = URUT.indexOf(k);
  if (sama !== -1) return sama;
  const mirip = URUT.findIndex((u) => k.startsWith(u) && !/^[IV]+$/.test(k.slice(u.length)));
  return mirip === -1 ? 99 : mirip;
};

/** Penanda tangan utama kapal: yang namanya dipakai di BA dan laporan. */
export function penandaUtama(k: KapalAwak | undefined) {
  const cari = (...kunci: string[]) =>
    (k?.awak || []).find((a) => kunci.some((x) => padat(a.jabatan) === padat(x)));
  return {
    nakhoda: cari("NAKHODA"),
    kkm: cari("KKM/MASINIS I", "KKM/MASINIS II", "PJS KKM", "KKM"),
    mualim1: cari("MUALIM I"),
    masinis2: cari("MASINIS II"),
  };
}

export const awakBaru = (): Awak => ({ nama: "", jabatan: "", nik: "", coc: "", tmt: "" });
