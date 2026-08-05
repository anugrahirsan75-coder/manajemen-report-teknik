/**
 * Pembatas laju sederhana per kunci (alamat IP atau id kiriman) untuk route
 * TERBUKA. Bukan pengganti kata sandi — gunanya menahan pengiriman borongan
 * dari satu sumber, supaya satu skrip tidak bisa membanjiri Drive & basis data.
 */
import type { NextRequest } from "next/server";

const JEJAK = new Map<string, number[]>();
const MAKS_KUNCI = 2000;

/** buang jejak yang sudah kedaluwarsa; dipanggil saat peta mulai besar */
function rapikan(jendelaMs: number) {
  const batas = Date.now() - jendelaMs;
  JEJAK.forEach((v: number[], k: string) => {
    const sisa = v.filter((t) => t > batas);
    if (sisa.length) JEJAK.set(k, sisa);
    else JEJAK.delete(k);
  });
}

export function lajuTerlampaui(kunci: string, batas: number, jendelaMs = 10 * 60 * 1000) {
  const kini = Date.now();
  const lama = (JEJAK.get(kunci) || []).filter((t) => kini - t < jendelaMs);
  lama.push(kini);
  JEJAK.set(kunci, lama);
  // Sebelumnya seluruh peta dikosongkan begitu melebihi 500 kunci — itu justru
  // menghapus hitungan penyerang bersama-sama dengan hitungan pengguna biasa.
  if (JEJAK.size > MAKS_KUNCI) rapikan(jendelaMs);
  return lama.length > batas;
}

export const ipDari = (req: NextRequest) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "tak-dikenal";
