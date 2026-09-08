/**
 * Masuk ke Portal Kapal.
 *
 * Terbuka tanpa sesi apa pun — memang inilah pintunya. Yang menjaganya: sandi
 * ber-sidik PBKDF2 di basis data, pembatas laju per alamat IP, dan jawaban gagal
 * yang selalu sama bunyinya. Menyebut "akun tidak ada" akan memberi tahu penebak
 * nama akun mana yang sudah benar, dan nama akun di sini bisa ditebak dari nama
 * kapal.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbServer, dbSiap } from "@/lib/dbServer";
import { ipDari, lajuTerlampaui } from "@/lib/lapor/laju";
import { cocokSandi } from "@/lib/portal/sandi";
import { COOKIE_KAPAL, UMUR_SESI_HARI, buatSesiKapal } from "@/lib/portal/sesi";
import { KIND_AKUN_KAPAL } from "@/lib/portal/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GAGAL = "Nama akun atau sandi salah.";

export async function POST(req: NextRequest) {
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const auth = process.env.AUTH_TOKEN;
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_TOKEN belum diset di server" }, { status: 500 });

  // sepuluh percobaan per sepuluh menit per IP — cukup untuk salah ketik di
  // ponsel yang papan tiknya sempit, jauh dari cukup untuk menebak sandi
  if (lajuTerlampaui(`portal-masuk:${ipDari(req)}`, 10)) {
    return NextResponse.json({ ok: false, error: "Terlalu banyak percobaan. Tunggu beberapa menit." }, { status: 429 });
  }

  const { nama, sandi } = (await req.json().catch(() => ({}))) as { nama?: string; sandi?: string };
  const cari = String(nama || "").trim().toLowerCase();
  if (!cari || !sandi) return NextResponse.json({ ok: false, error: GAGAL }, { status: 401 });

  const c = dbServer()!;
  const { data } = await c.from("projects")
    .select("id,payload")
    .filter("payload->>kind", "eq", KIND_AKUN_KAPAL)
    .filter("payload->>nama", "eq", cari)
    .limit(1);

  const baris = (data || [])[0];
  const p: any = baris?.payload || {};
  /*
   * Sandi tetap diperiksa walau akunnya tidak ada, memakai sidik palsu. Kalau
   * jawaban untuk akun tak dikenal datang seketika sementara akun yang ada
   * memakan 200 milidetik PBKDF2, selisih waktunya sendiri sudah memberitahu
   * penebak nama akun mana yang benar.
   */
  const cocok = await cocokSandi(String(sandi), p.sandi || { garam: "x", sidik: "0".repeat(64), putaran: 1 });
  if (!baris || !cocok || p.aktif === false) {
    return NextResponse.json({ ok: false, error: GAGAL }, { status: 401 });
  }

  const token = await buatSesiKapal({ kapal: p.kapal, bagian: p.bagian, nama: p.nama }, auth);
  const res = NextResponse.json({ ok: true, kapal: p.kapal, bagian: p.bagian, nama: p.nama });
  res.cookies.set(COOKIE_KAPAL, token, {
    httpOnly: true, sameSite: "lax", path: "/",
    maxAge: UMUR_SESI_HARI * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });

  // jejak masuk terakhir — kantor perlu tahu kapal mana yang portalnya benar-benar dipakai
  void c.from("projects").update({
    payload: { ...p, terakhirMasuk: new Date().toISOString() },
  }).eq("id", baris.id);

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_KAPAL, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
