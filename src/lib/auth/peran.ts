/**
 * Peran akun.
 *
 * Dua kelompok memakai aplikasi ini: Teknik (pemilik seluruh menu) dan SCM
 * (hanya halaman pengadaan). Pembedanya BUKAN cookie penanda peran — cookie
 * bisa ditulis sendiri oleh peramban — melainkan NILAI token sesinya: token SCM
 * adalah sidik SHA-256 dari AUTH_TOKEN, jadi tak bisa dikarang tanpa mengetahui
 * AUTH_TOKEN, dan tak bisa dibalik menjadi AUTH_TOKEN oleh pemegang token SCM.
 *
 * Sengaja memakai Web Crypto (bukan modul "crypto" milik Node): berkas ini ikut
 * dimuat middleware, yang berjalan di runtime Edge dan tidak punya modul Node.
 *
 * Daftar akun tetap di env APP_USERS, dengan ruas ketiga sebagai peran:
 *   APP_USERS=admin:rahasia,teknik:rahasia2,scmtte:rahasia3:scm
 * Tanpa ruas ketiga, akun dianggap Teknik — seluruh akun lama tetap seperti dulu.
 */
export type Peran = "teknik" | "scm";

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

export async function tokenPeran(auth: string, peran: Peran): Promise<string> {
  if (peran === "teknik") return auth;
  const data = new TextEncoder().encode(`${auth}:scm`);
  return hex(await crypto.subtle.digest("SHA-256", data));
}

/** peran dari nilai cookie sesi; null bila tak cocok dengan token mana pun */
export async function peranDariToken(token: string | undefined, auth: string | undefined): Promise<Peran | null> {
  if (!token || !auth) return null;
  if (token === auth) return "teknik";
  return token === (await tokenPeran(auth, "scm")) ? "scm" : null;
}

/** cari akun di APP_USERS; kembalikan perannya bila cocok */
export function periksaAkun(daftar: string, user: string, pass: string): Peran | null {
  for (const baris of daftar.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [u, p, peran] = baris.split(":");
    if (u === user && p === pass) return (peran || "").trim().toLowerCase() === "scm" ? "scm" : "teknik";
  }
  return null;
}

/**
 * Halaman yang boleh dibuka akun SCM.
 *
 * /api/db ikut dibuka karena seluruh halaman memakai gerbang itu untuk membaca
 * Supabase; pembatasan isinya ada pada halaman SCM sendiri, yang hanya meminta
 * baris pengadaan dan proses SCM.
 */
export const bolehScm = (path: string) =>
  path.startsWith("/scm") || path.startsWith("/api/scm") || path.startsWith("/api/db")
  || path.startsWith("/api/auth") || path === "/";
