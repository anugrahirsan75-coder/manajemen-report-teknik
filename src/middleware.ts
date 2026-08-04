import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Gerbang login: semua route butuh cookie sesi valid, kecuali /login & /api/auth.
export function middleware(req: NextRequest) {
  const token = req.cookies.get("mrt_session")?.value;
  const expected = process.env.AUTH_TOKEN;
  // expected harus diisi (env) — kalau kosong, semua diarahkan ke login (aman, bukan bypass)
  if (expected && token && token === expected) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // lindungi semua KECUALI: /login, /api/auth/*, aset next, favicon, logo
  // Dua kelompok SENGAJA terbuka, route API-nya sendiri yang membatasi:
  //  · /monitoring + api/monitoring — rekap pengadaan untuk dilihat orang banyak.
  //  · /lapor + api/lapor/kirim + api/lapor/berkas — ABK kapal mengirim berkas
  //    tanpa akun. Perhatikan: HANYA dua route api/lapor itu yang dibuka;
  //    api/lapor/daftar (isi seluruh kiriman, dipakai kantor) tetap terkunci.
  matcher: ["/((?!login|monitoring|lapor(?:$|/)|api/auth|api/monitoring|api/lapor/kirim|api/lapor/berkas|_next/static|_next/image|favicon.ico|logo-asdp.png).*)"],
};
