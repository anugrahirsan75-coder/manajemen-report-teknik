/**
 * Unggah berkas Laporan Docking ke folder Drive pemilik.
 *
 * Bedanya dengan /api/lapor/berkas: yang ini untuk ORANG KANTOR (di balik
 * login), tujuannya folder "Laporan Docking", dan tidak menempel ke catatan
 * kiriman mana pun — Drive-lah daftarnya. Potongan tetap dipakai karena satu
 * permintaan ke hosting dibatasi ~4,5 MB sedangkan laporan docking sering
 * puluhan MB.
 */
import { NextRequest, NextResponse } from "next/server";
import { kenaliBerkas, namaAman, PESAN_JENIS_DITOLAK } from "@/lib/lapor/berkasJenis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAKS_POTONGAN = 3_200_000;      // panjang base64 per potongan
const MAKS_TOTAL_POTONGAN = 18;       // selaras dengan BATAS_MB di Apps Script
const TENGGANG_GAS_MS = 45_000;

const ulangi = (pesan: string, status = 502) =>
  NextResponse.json({ ok: false, error: pesan, retryable: true }, { status });

export async function POST(req: NextRequest) {
  const gasUrl = process.env.LAPOR_GAS_URL;
  const secret = process.env.LAPOR_GAS_SECRET || "";
  if (!gasUrl || !secret) {
    return NextResponse.json({
      ok: false,
      error: "Penyimpanan Drive belum aktif. Isi LAPOR_GAS_URL & LAPOR_GAS_SECRET (lihat docs/LAPOR_KAPAL_SETUP.md).",
    }, { status: 501 });
  }

  const b = await req.json().catch(() => ({} as any));
  const { nama, mime, dataBase64, unggahId } = b as Record<string, string>;
  const idUnggah = String(unggahId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  const indeks = Number(b.indeks) || 0;
  const total = Number(b.total) || 1;
  const jalur: string[] = Array.isArray(b.jalur)
    ? b.jalur.map((s: any) => String(s || "").trim()).filter(Boolean).slice(0, 6)
    : [];

  if (!idUnggah) return NextResponse.json({ ok: false, error: "Unggahan tidak dikenali" }, { status: 400 });
  if (!dataBase64) return NextResponse.json({ ok: false, error: "Berkas kosong" }, { status: 400 });
  if (!jalur.length) return NextResponse.json({ ok: false, error: "Folder tujuan belum dipilih" }, { status: 400 });
  if (dataBase64.length > MAKS_POTONGAN) return NextResponse.json({ ok: false, error: "Potongan terlalu besar" }, { status: 413 });
  if (total > MAKS_TOTAL_POTONGAN) {
    return NextResponse.json({ ok: false, error: "Berkas terlalu besar untuk diunggah lewat aplikasi. Taruh langsung di Google Drive." }, { status: 413 });
  }

  const jenis = kenaliBerkas(String(nama || ""), String(mime || ""));
  if (!jenis) return NextResponse.json({ ok: false, error: PESAN_JENIS_DITOLAK }, { status: 400 });
  const namaBerkas = namaAman(String(nama || "berkas"), jenis.ext);

  try {
    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret, aksi: "potongan", akar: "docking", jalur,
        unggahId: idUnggah, indeks, total,
        dataBase64, namaBerkas, mime: jenis.mime,
        // penamaan bawaan Apps Script menambahi periode/jenis/kapal; di sini
        // nama aslinya yang dipakai supaya cocok dengan berkas di Drive
        periode: "", jenis: "", kapal: "", namaApaAdanya: true,
      }),
      signal: AbortSignal.timeout(TENGGANG_GAS_MS),
      cache: "no-store",
    });

    const teks = await res.text();
    let hasil: any;
    try { hasil = JSON.parse(teks); }
    catch { return ulangi("Google Drive menjawab tidak utuh. Coba lagi."); }

    if (!hasil?.ok) {
      const pesan = String(hasil?.error || "Gagal menyimpan ke Drive");
      return hasil?.sementara ? ulangi(pesan) : NextResponse.json({ ok: false, error: pesan }, { status: 502 });
    }
    if (!hasil.selesai) return NextResponse.json({ ok: true, selesai: false, indeks });

    return NextResponse.json({
      ok: true, selesai: true,
      berkas: { id: hasil.fileId, nama: hasil.nama || namaBerkas, url: hasil.url, ukuran: hasil.ukuran, mime: jenis.mime },
    });
  } catch (e: any) {
    const putus = e?.name === "TimeoutError";
    return ulangi(putus ? "Google Drive lambat menjawab. Potongan ini akan diulang." : (e?.message || "gagal"), putus ? 504 : 502);
  }
}
