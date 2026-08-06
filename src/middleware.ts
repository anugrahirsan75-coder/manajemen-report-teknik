import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { bolehScm, peranDariToken } from "@/lib/auth/peran";

// Gerbang login: semua route butuh cookie sesi valid, kecuali /login & /api/auth.
export async function middleware(req: NextRequest) {
  const token = req.cookies.get("mrt_session")?.value;
  const expected = process.env.AUTH_TOKEN;
  // expected harus diisi (env) — kalau kosong, semua diarahkan ke login (aman, bukan bypass)
  const peran = await peranDariToken(token, expected);
  if (peran === "teknik") return NextResponse.next();
  if (peran === "scm") {
    // Akun SCM hanya boleh di halaman pengadaannya sendiri. Dibatasi di sini,
    // bukan sekadar disembunyikan dari menu.
    if (bolehScm(req.nextUrl.pathname)) return NextResponse.next();
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Akun SCM tidak berhak atas data ini." }, { status: 403 });
    }
    const ke = req.nextUrl.clone();
    ke.pathname = "/scm";
    ke.search = "";
    return NextResponse.redirect(ke);
  }
  // Permintaan data (fetch dari halaman dalam aplikasi) harus dijawab 401 JSON.
  // Mengembalikan halaman /login membuat pemanggilnya gagal mengurai JSON dan
  // layar tampak "rusak" padahal sesinya hanya habis.
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Sesi habis. Masuk ulang untuk melanjutkan." }, { status: 401 });
  }
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
  //  · /kinerja-anggaran + api/publik/anggaran — tautan LIHAT SAJA untuk Direksi.
  //    Route-nya hanya melayani GET dan isinya sudah dipangkas di server (tanpa
  //    vendor, nomor kontrak, foto, catatan), jadi tak ada yang bisa diubah
  //    maupun digali lebih dalam dari halaman terbuka ini.
  matcher: ["/((?!login|monitoring|lapor(?:$|/)|kinerja-anggaran(?:$|/)|api/auth|api/monitoring|api/publik/|api/lapor/(?:kirim|berkas|gagal)(?:$|/)|_next/static|_next/image|favicon.ico|logo-asdp.png).*)"],
};
