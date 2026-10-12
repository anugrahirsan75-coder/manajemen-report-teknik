/**
 * Kuota Google Drive untuk Panel Admin.
 *
 * Aplikasi ini menyimpan dokumen kapal sebagai TAUTAN Drive, bukan unggahan
 * sendiri — jadi pemakaian ruangnya tidak terlihat di mana pun: Supabase hanya
 * memuat tautannya, dan Drive-nya baru ketahuan penuh saat unggahan mulai
 * ditolak. Yang dibaca di sini angka resmi dari Drive sendiri.
 *
 * KREDENSIAL TIDAK PERNAH SAMPAI KE PERAMBAN. Penyegaran token dan panggilan
 * Drive dikerjakan di server; yang dikirim ke halaman admin hanya angkanya.
 *
 * Dipakai OAuth refresh token milik akun yang Drive-nya mau dilihat, bukan
 * service account: service account punya Drive-nya sendiri yang hampir selalu
 * kosong, sehingga yang tampil bukan ruang yang sebenarnya dipakai cabang.
 *
 * Tiga medan yang perlu diisi di Vercel (Project → Settings → Environment
 * Variables), atau di .env.local untuk mesin sendiri:
 *
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_OAUTH_REFRESH_TOKEN     cakupan: drive.metadata.readonly
 *
 * Selama ketiganya belum ada, rute ini TIDAK gagal — ia menjawab
 * { tersambung: false } berikut sebabnya, supaya panel admin bisa menampilkan
 * keterangan "belum tersambung" alih-alih kotak galat merah.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ABOUT_URL = "https://www.googleapis.com/drive/v3/about"
  + "?fields=storageQuota,user(emailAddress,displayName)";

interface JawabKuota {
  tersambung: boolean;
  sebab?: string;
  email?: string;
  nama?: string;
  /** byte; null berarti ruang tak terbatas (Workspace tanpa batas) */
  batas: number | null;
  pakai: number;
  pakaiDrive: number;
  pakaiSampah: number;
  diambil: string;
}

const kosong = (sebab: string): JawabKuota => ({
  tersambung: false, sebab, batas: null, pakai: 0, pakaiDrive: 0,
  pakaiSampah: 0, diambil: new Date().toISOString(),
});

/** Tukar refresh token jadi access token berumur pendek. */
async function ambilAkses(id: string, rahasia: string, segar: string): Promise<string> {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id, client_secret: rahasia,
      refresh_token: segar, grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    /*
     * Pesan galat Google disalin apa adanya, tetapi hanya medan "error" dan
     * "error_description" — badan jawabannya kadang memuat kembali sebagian
     * permintaan, dan itu berarti rahasia klien ikut tercetak di log.
     */
    throw new Error(`token ditolak (${r.status}): ${j.error || "tidak diketahui"}`
      + (j.error_description ? ` — ${j.error_description}` : ""));
  }
  return j.access_token as string;
}

export async function GET() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
  const rahasia = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
  const segar = process.env.GOOGLE_OAUTH_REFRESH_TOKEN || "";

  const hilang = [
    !id && "GOOGLE_OAUTH_CLIENT_ID",
    !rahasia && "GOOGLE_OAUTH_CLIENT_SECRET",
    !segar && "GOOGLE_OAUTH_REFRESH_TOKEN",
  ].filter(Boolean);
  if (hilang.length) {
    return NextResponse.json(kosong(`Belum diatur: ${hilang.join(", ")}.`));
  }

  try {
    const akses = await ambilAkses(id, rahasia, segar);
    const r = await fetch(ABOUT_URL, {
      headers: { Authorization: `Bearer ${akses}` },
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(`Drive menolak (${r.status}): ${j?.error?.message || "tidak diketahui"}`);
    }
    const q = j.storageQuota || {};
    const angka = (v: unknown) => (v === undefined || v === null ? 0 : Number(v) || 0);
    return NextResponse.json({
      tersambung: true,
      email: j.user?.emailAddress || "",
      nama: j.user?.displayName || "",
      // Workspace tanpa batas tidak mengirim "limit" sama sekali
      batas: q.limit === undefined ? null : angka(q.limit),
      pakai: angka(q.usage),
      pakaiDrive: angka(q.usageInDrive),
      pakaiSampah: angka(q.usageInDriveTrash),
      diambil: new Date().toISOString(),
    } satisfies JawabKuota);
  } catch (e: any) {
    return NextResponse.json(kosong(String(e?.message || e)));
  }
}
