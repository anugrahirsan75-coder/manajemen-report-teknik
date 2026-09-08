/**
 * Sandi akun kapal — disimpan sebagai sidik, tidak pernah sebagai teks.
 *
 * Sandi ini dipegang berpindah-pindah tangan di kapal dan hampir pasti dipakai
 * ulang di tempat lain oleh pemiliknya. Menyimpannya apa adanya berarti satu
 * kebocoran basis data menjadi kebocoran akun-akun lain milik orang yang sama.
 *
 * PBKDF2-SHA256 lewat Web Crypto, bukan scrypt milik Node: route yang memakainya
 * berjalan di Node, tetapi memakai Web Crypto membuat berkas ini tetap bisa
 * dipindah ke mana pun tanpa ditulis ulang. 210.000 putaran mengikuti anjuran
 * OWASP 2023 untuk PBKDF2-SHA256.
 */
const PUTARAN = 210_000;
const enc = new TextEncoder();

const hex = (b: ArrayBuffer | Uint8Array) =>
  Array.from(b instanceof Uint8Array ? b : new Uint8Array(b))
    .map((x) => x.toString(16).padStart(2, "0")).join("");

async function turunkan(sandi: string, garam: string): Promise<string> {
  const kunci = await crypto.subtle.importKey("raw", enc.encode(sandi), "PBKDF2", false, ["deriveBits"]);
  const bit = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(garam), iterations: PUTARAN, hash: "SHA-256" }, kunci, 256);
  return hex(bit);
}

export interface SandiTersimpan { garam: string; sidik: string; putaran: number }

export async function buatSandi(sandi: string): Promise<SandiTersimpan> {
  const garam = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { garam, sidik: await turunkan(sandi, garam), putaran: PUTARAN };
}

/**
 * Cocokkan sandi. Perbandingannya menelusuri SELURUH panjang sidik apa pun
 * hasilnya — berhenti di huruf pertama yang berbeda akan membocorkan berapa
 * banyak huruf awal yang sudah benar lewat selisih waktu jawaban.
 */
export async function cocokSandi(sandi: string, tersimpan: SandiTersimpan | undefined): Promise<boolean> {
  if (!tersimpan?.garam || !tersimpan?.sidik) return false;
  const uji = await turunkan(sandi, tersimpan.garam);
  if (uji.length !== tersimpan.sidik.length) return false;
  let beda = 0;
  for (let i = 0; i < uji.length; i++) beda |= uji.charCodeAt(i) ^ tersimpan.sidik.charCodeAt(i);
  return beda === 0;
}

/**
 * Sandi awal yang bisa dibacakan lewat telepon.
 *
 * Tanpa huruf/angka yang tertukar saat didikte di sambungan buruk: 0/O, 1/I/l.
 * Sandi yang salah ketik tiga kali di kapal berakhir dengan telepon ke kantor,
 * dan itu ongkos yang jauh lebih besar daripada dua huruf yang dibuang di sini.
 */
export function sandiAwal(panjang = 10): string {
  const huruf = "abcdefghjkmnpqrstuvwxyz23456789";
  const acak = crypto.getRandomValues(new Uint8Array(panjang));
  return Array.from(acak).map((n) => huruf[n % huruf.length]).join("");
}
