import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { bolehScm, peranDariToken, tokenPeran } from "@/lib/auth/peran";

// Gerbang login: semua route butuh cookie sesi valid, kecuali /login & /api/auth.
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const expected = process.env.AUTH_TOKEN;
  const token = req.cookies.get("mrt_session")?.value;
  const scmCookie = req.cookies.get("mrt_scm")?.value;

  /**
   * Halaman SCM punya PINTUNYA SENDIRI.
   *
   * Dipakai orang lain (tim SCM), jadi sandinya terpisah — akun Teknik yang
   * sudah masuk pun tetap harus mengetiknya, dan sebaliknya membuka SCM tidak
   * membuka apa pun di sisi Teknik. Cookienya juga berbeda supaya dua sesi itu
   * tidak saling mengusir.
   */
  const scmSah = !!expected && !!scmCookie && scmCookie === (await tokenPeran(expected, "scm"));
  if (path.startsWith("/scm") || path.startsWith("/api/scm")) {
    if (path.startsWith("/scm/masuk") || path.startsWith("/api/scm/masuk")) return NextResponse.next();
    if (scmSah) return NextResponse.next();
    if (path.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Sesi SCM habis. Masuk ulang." }, { status: 401 });
    }
    const ke = req.nextUrl.clone();
    ke.pathname = "/scm/masuk";
    ke.search = `?dari=${encodeURIComponent(path)}`;
    return NextResponse.redirect(ke);
  }
  // halaman SCM membaca datanya lewat gerbang /api/db — dibuka untuk sesi SCM saja
  if (scmSah && path.startsWith("/api/db")) return NextResponse.next();

  // expected harus diisi (env) — kalau kosong, semua diarahkan ke login (aman, bukan bypass)
  const peran = await peranDariToken(token, expected);
  if (peran === "teknik") return NextResponse.next();
  if (peran === "scm") {
    // Akun SCM yang masuk lewat login utama tetap dikurung di halaman pengadaan.
    if (bolehScm(path)) return NextResponse.next();
    if (path.startsWith("/api/")) {
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
  if (path.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Sesi habis. Masuk ulang untuk melanjutkan." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", path + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // lindungi semua KECUALI: /login, /api/auth/*, aset next, favicon, logo
  // Kelompok yang SENGAJA terbuka, route API-nya sendiri yang membatasi:
  //  · /monitoring + api/monitoring — rekap pengadaan untuk dilihat orang banyak.
  //  · /lapor + api/lapor/kirim + api/lapor/berkas — ABK kapal mengirim berkas
  //    tanpa akun. Perhatikan: HANYA dua route api/lapor itu yang dibuka;
  //    api/lapor/daftar (isi seluruh kiriman, dipakai kantor) tetap terkunci.
  //  · /uji-permintaan + api/uji-permintaan/(cari|kirim) — borang permintaan
  //    digital yang masih DIUJI COBA, sengaja dipisah dari /lapor supaya
  //    percobaan tidak mengganggu jalur yang sedang dipakai. Route "cari"
  //    menjawab TANPA HARGA: halamannya terbuka, dan harga pengadaan tidak ada
  //    urusannya dengan borang permintaan kapal.
  //  · /layar-sertifikat + api/publik/sertifikat — papan monitor untuk layar
  //    di ruang kantor. Layar itu tidak bisa login, jadi halamannya harus
  //    terbuka; sebagai gantinya route-nya melayani GET saja dan isinya sudah
  //    dipangkas di server: tanpa tautan Drive dan tanpa nama berkas arsip.
  //  · /kinerja-anggaran + api/publik/anggaran — tautan LIHAT SAJA untuk Direksi.
  //    Route-nya hanya melayani GET dan isinya sudah dipangkas di server (tanpa
  //    vendor, nomor kontrak, foto, catatan), jadi tak ada yang bisa diubah
  //    maupun digali lebih dalam dari halaman terbuka ini.
  /**
   * Berkas statis di /public TIDAK dilewatkan gerbang ini.
   *
   * Dulu hanya logo-asdp.png yang dikecualikan, sehingga foto latar
   * (/bg-port.jpg) dijawab 307 ke /login setiap kali diminta tanpa sesi yang
   * sah — dan peramban menyimpan pengalihan itu. Akibatnya latar belakang
   * aplikasi hilang sampai singgahan dibersihkan, sementara logonya tetap
   * ada: gejala yang tak masuk akal bagi pemakainya.
   *
   * Gambar, font, dan skrip statis memang bukan rahasia — yang dijaga adalah
   * DATA, dan itu tetap lewat sini. Pengecualiannya sengaja dibatasi berkas di
   * AKAR ([^/]+): kalau ditulis .* maka /api/db/apa-saja.png akan ikut lolos,
   * dan gerbangnya bisa dilewati hanya dengan menambahkan akhiran nama.
   */
  matcher: ["/((?!login|monitoring|lapor(?:$|/)|uji-permintaan(?:$|/)|kinerja-anggaran(?:$|/)|layar-sertifikat(?:$|/)|api/auth|api/monitoring|api/publik/|api/lapor/(?:kirim|berkas|gagal)(?:$|/)|api/uji-permintaan/(?:cari|kirim)(?:$|/)|_next/static|_next/image|favicon.ico|[^/]+\.(?:png|jpe?g|svg|webp|gif|ico|mjs|css|woff2?)$).*)"],
};
