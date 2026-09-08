/**
 * Sesi Portal Kapal — cookie yang menyebut kapal DAN bagiannya.
 *
 * Berbeda dari sesi kantor, di sini nilai cookienya harus membawa identitas:
 * satu berkas stok filter milik satu kapal, dan route harus tahu kapal mana
 * yang sedang menulis tanpa memercayai apa pun yang dikirim peramban. Karena
 * itu isinya ditandatangani HMAC dengan AUTH_TOKEN: isinya boleh dibaca siapa
 * saja, tetapi tidak bisa DIUBAH tanpa mengetahui AUTH_TOKEN — awak KMP. MAMING
 * tidak bisa menyunting cookienya menjadi KMP. TUNA.
 *
 * Memakai Web Crypto, bukan modul "crypto" Node: berkas ini ikut dimuat
 * middleware yang berjalan di runtime Edge.
 */
import type { BagianKapal } from "./types";

export interface SesiKapal {
  kapal: string;
  bagian: BagianKapal;
  nama: string;
  /** waktu terbit, milidetik */
  pada: number;
}

/** umur sesi — kapal berlayar berhari-hari, sesi sependek kantor hanya menyiksa */
export const UMUR_SESI_HARI = 30;

const enc = new TextEncoder();

const b64url = (s: string) =>
  btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const dariB64url = (s: string) =>
  decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function tanda(isi: string, auth: string): Promise<string> {
  const kunci = await crypto.subtle.importKey(
    "raw", enc.encode(`${auth}:portal-kapal`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", kunci, enc.encode(isi)));
}

export async function buatSesiKapal(s: Omit<SesiKapal, "pada">, auth: string): Promise<string> {
  const isi = b64url(JSON.stringify({ ...s, pada: Date.now() } satisfies SesiKapal));
  return `${isi}.${await tanda(isi, auth)}`;
}

/**
 * Baca cookie sesi. Mengembalikan null untuk apa pun yang tidak sah: tanda
 * tangan tidak cocok, bentuknya rusak, atau umurnya lewat.
 */
export async function bacaSesiKapal(token: string | undefined, auth: string | undefined): Promise<SesiKapal | null> {
  if (!token || !auth) return null;
  const [isi, sidik] = token.split(".");
  if (!isi || !sidik) return null;
  try {
    if ((await tanda(isi, auth)) !== sidik) return null;
    const s = JSON.parse(dariB64url(isi)) as SesiKapal;
    if (!s?.kapal || (s.bagian !== "deck" && s.bagian !== "mesin")) return null;
    if (Date.now() - (s.pada || 0) > UMUR_SESI_HARI * 86_400_000) return null;
    return s;
  } catch {
    return null;
  }
}

export const COOKIE_KAPAL = "mrt_kapal";
