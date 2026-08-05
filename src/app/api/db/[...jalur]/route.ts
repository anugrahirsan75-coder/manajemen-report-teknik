/**
 * Gerbang data: satu-satunya jalan peramban menyentuh Supabase.
 *
 * Sebelum ini tiap modul memanggil Supabase LANGSUNG dari peramban memakai
 * kunci `anon`. Kunci itu ikut terkirim ke setiap pengunjung — memang begitu
 * sifatnya — sehingga selama kebijakan RLS mengizinkan `anon` membaca dan
 * menulis, siapa pun yang membuka halaman bisa mengambil kuncinya lalu memanggil
 * REST Supabase sendiri. Gerbang login jadi tidak berarti banyak.
 *
 * Route ini ada DI BALIK gerbang login (middleware). Permintaan diteruskan ke
 * Supabase memakai kunci server yang tidak pernah dikirim ke peramban, sehingga
 * pintu untuk `anon` boleh ditutup rapat tanpa mematikan satu pun modul.
 *
 * Yang boleh lewat sengaja dipersempit: hanya tabel `projects` dan penyimpanan
 * berkas — bukan seluruh isi basis data.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KUNCI = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** hanya jalur inilah yang dilayani; sisanya ditolak */
function jalurBoleh(jalur: string) {
  if (jalur === "rest/v1/projects") return true;              // seluruh data aplikasi ada di sini
  if (jalur.startsWith("storage/v1/object/")) return true;    // foto & lampiran
  if (jalur.startsWith("storage/v1/bucket")) return true;     // pemeriksaan bucket saat unggah
  return false;
}

/** kepala yang perlu diteruskan apa adanya supaya perilaku PostgREST tetap sama */
const KEPALA_KE_SB = ["content-type", "prefer", "range", "accept", "accept-profile", "content-profile", "x-upsert", "cache-control"];
const KEPALA_KE_KLIEN = ["content-type", "content-range", "range-unit", "content-location", "preference-applied"];

async function teruskan(req: NextRequest, jalur: string[]) {
  if (!URL_SB || !KUNCI) {
    return NextResponse.json({ message: "Sumber data belum siap" }, { status: 503 });
  }
  const alamat = jalur.join("/");
  if (!jalurBoleh(alamat)) {
    return NextResponse.json({ message: "Jalur tidak dilayani" }, { status: 403 });
  }

  const tujuan = `${URL_SB.replace(/\/$/, "")}/${alamat}${req.nextUrl.search}`;
  const kepala = new Headers();
  req.headers.forEach((nilai, nama) => {
    if (KEPALA_KE_SB.includes(nama.toLowerCase())) kepala.set(nama, nilai);
  });
  // Kunci yang dipakai adalah kunci SERVER. Apa pun yang dikirim peramban
  // (apikey/Authorization) sengaja diabaikan — kalau tidak, penyerang bisa
  // menyodorkan kunci lain lewat gerbang ini.
  kepala.set("apikey", KUNCI);
  kepala.set("Authorization", `Bearer ${KUNCI}`);

  const adaBadan = !["GET", "HEAD"].includes(req.method);
  const jawab = await fetch(tujuan, {
    method: req.method,
    headers: kepala,
    body: adaBadan ? await req.arrayBuffer() : undefined,
    cache: "no-store",
    redirect: "follow",
  });

  const kepalaBalik = new Headers();
  jawab.headers.forEach((nilai, nama) => {
    if (KEPALA_KE_KLIEN.includes(nama.toLowerCase())) kepalaBalik.set(nama, nilai);
  });
  kepalaBalik.set("Cache-Control", "no-store");

  return new NextResponse(jawab.body, { status: jawab.status, headers: kepalaBalik });
}

type Ruas = { params: { jalur: string[] } };

export const GET = (req: NextRequest, { params }: Ruas) => teruskan(req, params.jalur);
export const POST = (req: NextRequest, { params }: Ruas) => teruskan(req, params.jalur);
export const PATCH = (req: NextRequest, { params }: Ruas) => teruskan(req, params.jalur);
export const PUT = (req: NextRequest, { params }: Ruas) => teruskan(req, params.jalur);
export const DELETE = (req: NextRequest, { params }: Ruas) => teruskan(req, params.jalur);
export const HEAD = (req: NextRequest, { params }: Ruas) => teruskan(req, params.jalur);
