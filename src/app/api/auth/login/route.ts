import { NextRequest, NextResponse } from "next/server";
import { periksaAkun, tokenPeran } from "@/lib/auth/peran";

export const runtime = "nodejs";

/**
 * Verifikasi user:pass dari env APP_USERS lalu pasang cookie sesi.
 *
 * Nilai cookienya berbeda menurut peran: Teknik memakai AUTH_TOKEN apa adanya,
 * SCM memakai turunannya. Dengan begitu peran melekat pada token — akun SCM tak
 * bisa menjangkau menu Teknik hanya dengan menyunting cookie di peramban.
 */
export async function POST(req: NextRequest) {
  const { user, pass } = (await req.json().catch(() => ({}))) as { user?: string; pass?: string };
  const peran = periksaAkun(process.env.APP_USERS || "", String(user || ""), String(pass || ""));
  if (!peran) return NextResponse.json({ error: "User atau password salah" }, { status: 401 });
  const auth = process.env.AUTH_TOKEN;
  if (!auth) return NextResponse.json({ error: "AUTH_TOKEN belum diset di server" }, { status: 500 });
  const token = await tokenPeran(auth, peran);
  const res = NextResponse.json({ ok: true, peran });
  res.cookies.set("mrt_session", token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
    // di produksi cookie hanya boleh melewati sambungan terenkripsi
    secure: process.env.NODE_ENV === "production",
  });
  // penanda peran untuk TAMPILAN saja (menu mana yang muncul). Bukan penjaga
  // akses — yang menjaga adalah nilai token di atas, diperiksa middleware.
  res.cookies.set("mrt_peran", peran, {
    httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
