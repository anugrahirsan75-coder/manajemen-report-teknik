"use client";
/**
 * Impor temuan CIC 2026 ke basis data cabang.
 *
 * 48 temuan lima kapal dipanen dari laporan CIC KSOP: tiga laporan dibaca
 * mesin dari lapisan teksnya, dua laporan lain berupa pindaian dan disalin
 * dengan dibaca. Hasilnya dibekukan sebagai seed supaya tidak perlu diketik
 * ulang oleh siapa pun.
 *
 * IMPOR INI AMAN DIULANG. Setiap temuan dikenali dari sidik jarinya — kapal
 * ditambah deskripsi, dinormalkan — dan yang sudah ada dilewati. Tanpa itu,
 * menekan tombol dua kali menghasilkan 96 baris, dan yang menyadarinya baru
 * orang yang menghitung tunggakan sebulan kemudian.
 *
 * Yang DIISI hanya kolom milik pemeriksa: deskripsi, kategori, referensi,
 * jatuh tempo, dan tindakan yang diminta. Kolom tindak lanjut — penanggung
 * jawab, target, proses — dibiarkan kosong karena itu keputusan cabang.
 */
import { TemuanItem, temuanKosong } from "./types";
import mentah from "./seedCic2026.json";

interface BarisSeed {
  kapal: string;
  deskripsi: string;
  kategori: string;
  penerbit: string;
  sumber: string;
  referensi: string;
  tglTemuan: string;
  jatuhTempo: string;
  prioritas: string;
  rencanaTindakLanjut: string;
}

export const SEED_CIC_2026 = mentah as BarisSeed[];

/** sidik jari satu temuan; dipakai untuk menolak ganda */
export const sidik = (kapal: string, deskripsi: string) =>
  `${kapal}|${deskripsi}`.toLowerCase().replace(/[^a-z0-9|]+/g, " ").trim();

export interface HasilImpor {
  dibuat: TemuanItem[];
  dilewati: number;
}

/**
 * Susun temuan baru dari seed, tanpa yang sudah ada di `sudahAda`.
 *
 * Tidak menyentuh basis data sendiri — pemanggilnya yang menyimpan, supaya
 * fungsi ini bisa diuji tanpa jaringan.
 */
export function siapkanImpor(sudahAda: TemuanItem[]): HasilImpor {
  const punya = new Set(sudahAda.map((t) => sidik(t.kapal, t.deskripsi)));
  const dibuat: TemuanItem[] = [];
  let dilewati = 0;

  for (const b of SEED_CIC_2026) {
    if (punya.has(sidik(b.kapal, b.deskripsi))) { dilewati += 1; continue; }
    dibuat.push({
      ...temuanKosong(),
      kapal: b.kapal,
      deskripsi: b.deskripsi,
      kategori: b.kategori,
      penerbit: b.penerbit,
      sumber: b.sumber,
      referensi: b.referensi,
      tglTemuan: b.tglTemuan,
      jatuhTempo: b.jatuhTempo,
      prioritas: b.prioritas,
      rencanaTindakLanjut: b.rencanaTindakLanjut,
      status: "open",
    });
    // temuan dalam satu kelompok impor pun bisa kembar; dicegah di sini juga
    punya.add(sidik(b.kapal, b.deskripsi));
  }
  return { dibuat, dilewati };
}
