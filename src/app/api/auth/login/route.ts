import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// verifikasi user:pass dari env APP_USERS, set cookie sesi = AUTH_TOKEN
export async function POST(req: NextRequest) {
  const { user, pass } = (await req.json().catch(() => ({}))) as { user?: string; pass?: string };
  const list = (process.env.APP_USERS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = list.some((u) => {
    const i = u.indexOf(":");
    return i > 0 && u.slice(0, i) === user && u.slice(i + 1) === pass;
  });
  if (!ok) return NextResponse.json({ error: "User atau password salah" }, { status: 401 });
  const token = process.env.AUTH_TOKEN;
  if (!token) return NextResponse.json({ error: "AUTH_TOKEN belum diset di server" }, { status: 500 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("mrt_session", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  return res;
}
