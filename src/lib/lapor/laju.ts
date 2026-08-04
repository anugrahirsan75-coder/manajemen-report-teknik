/**
 * Pembatas laju sederhana per alamat IP untuk route TERBUKA (tanpa login).
 * Bukan pengganti kata sandi — gunanya menahan pengiriman borongan dari satu
 * sumber, supaya satu skrip tidak bisa membanjiri Drive & basis data.
 */
import type { NextRequest } from "next/server";

const JEJAK = new Map<string, number[]>();

export function lajuTerlampaui(kunci: string, batas: number, jendelaMs = 10 * 60 * 1000) {
  const kini = Date.now();
  const lama = (JEJAK.get(kunci) || []).filter((t) => kini - t < jendelaMs);
  lama.push(kini);
  JEJAK.set(kunci, lama);
  if (JEJAK.size > 500) JEJAK.clear(); // jaga-jaga agar tidak menumpuk
  return lama.length > batas;
}

export const ipDari = (req: NextRequest) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "tak-dikenal";
