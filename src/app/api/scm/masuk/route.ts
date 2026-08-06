import { NextRequest, NextResponse } from "next/server";
import { periksaAkun, tokenPeran } from "@/lib/auth/peran";

export const runtime = "nodejs";

/**
 * Pintu masuk halaman SCM — TERPISAH dari login aplikasi Teknik.
 *
 * Halaman pengadaan dipakai orang lain (tim SCM), jadi punya sandinya sendiri:
 * akun Teknik yang sudah masuk pun tetap harus mengetiknya. Cookienya juga
 * sendiri (mrt_scm), sehingga membukanya tidak mengusir sesi Teknik yang sedang
 * berjalan di tab lain, dan keluar dari SCM tidak mengeluarkan yang lain.
 *
 * Akunnya diambil dari APP_USERS yang beruas ketiga "scm".
 */
export async function POST(req: NextRequest) {
  const { user, pass } = (await req.json().catch(() => ({}))) as { user?: string; pass?: string };
  const peran = periksaAkun(process.env.APP_USERS || "", String(user || ""), String(pass || ""));
  if (peran !== "scm") {
    // akun Teknik sengaja DITOLAK di pintu ini: yang dicari bukan "siapa pun
    // yang punya akun", melainkan orang yang memang dibekali akun SCM.
    return NextResponse.json({ error: "Akun ini tidak berhak membuka halaman SCM" }, { status: 401 });
  }
  const auth = process.env.AUTH_TOKEN;
  if (!auth) return NextResponse.json({ error: "AUTH_TOKEN belum diset di server" }, { status: 500 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("mrt_scm", await tokenPeran(auth, "scm"), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

/** keluar dari halaman SCM saja */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("mrt_scm", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
