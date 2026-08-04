/**
 * Unggah berkas kiriman ke Google Drive pemilik, lalu tempelkan tautannya ke
 * catatan kiriman.
 *
 * Berkas dikirim POTONGAN DEMI POTONGAN. Alasannya: satu permintaan ke hosting
 * aplikasi dibatasi ~4,5 MB, sementara laporan kapal biasa 5–20 MB. Sebelum ini
 * berkas sebesar itu ditolak oleh hosting sebelum kodenya jalan, dan pengirim
 * hanya melihat galat yang tidak jelas. Sekarang peramban memecah berkas, tiap
 * potongan dilempar ke Apps Script untuk disimpan sementara, dan potongan
 * terakhir memicu penyatuan jadi satu berkas utuh di Drive.
 *
 * Supabase tetap hanya menerima catatan kecil: nama, ukuran, id & URL Drive.
 *
 * Terbuka tanpa login, tapi berkas hanya bisa menempel ke kiriman yang tokennya
 * cocok — token itu baru dibuat di /api/lapor/kirim dan hanya ada di peramban
 * pengirim.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { lajuTerlampaui, ipDari } from "@/lib/lapor/laju";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY_SB = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** jenis berkas yang diterima — di luar ini ditolak sebelum menyentuh Drive */
const MIME_SAH = new Set([
  "application/pdf",
  "image/jpeg", "image/png", "image/webp", "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const MAKS_BERKAS = 12;
/** panjang teks base64 maksimal per potongan — di bawah batas badan permintaan hosting */
const MAKS_POTONGAN = 3_200_000;
/** 50 MB berkas asli ≈ 67 MB base64 ≈ 24 potongan */
const MAKS_TOTAL_POTONGAN = 26;

export async function POST(req: NextRequest) {
  const gasUrl = process.env.LAPOR_GAS_URL;
  const gasSecret = process.env.LAPOR_GAS_SECRET || "";
  if (!gasUrl) {
    return NextResponse.json(
      { ok: false, error: "Penyimpanan berkas belum aktif. Deploy Apps Script lalu isi LAPOR_GAS_URL (lihat docs/lapor-apps-script.gs)." },
      { status: 501 });
  }
  if (!URL_SB || !KEY_SB) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  if (lajuTerlampaui(`berkas:${ipDari(req)}`, 400)) {
    return NextResponse.json({ ok: false, error: "Terlalu banyak unggahan. Coba lagi beberapa menit." }, { status: 429 });
  }

  const b = await req.json().catch(() => ({} as any));
  const { id, token, nama, mime, dataBase64, unggahId } = b as Record<string, string>;
  const idUnggah = String(unggahId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  const indeks = Number(b.indeks) || 0;
  const total = Number(b.total) || 1;

  if (!id || !token || !idUnggah) return NextResponse.json({ ok: false, error: "Kiriman tidak dikenali" }, { status: 400 });
  if (!dataBase64) return NextResponse.json({ ok: false, error: "Berkas kosong" }, { status: 400 });
  if (!MIME_SAH.has(String(mime))) {
    return NextResponse.json({ ok: false, error: "Jenis berkas tidak didukung (pakai PDF, foto, Word, atau Excel)" }, { status: 400 });
  }
  if (dataBase64.length > MAKS_POTONGAN) {
    return NextResponse.json({ ok: false, error: "Potongan terlalu besar" }, { status: 413 });
  }
  if (total > MAKS_TOTAL_POTONGAN || indeks < 0 || indeks >= total) {
    return NextResponse.json({ ok: false, error: "Berkas lebih dari 50 MB" }, { status: 413 });
  }

  const c = createClient(URL_SB, KEY_SB);
  const { data: ada, error: e1 } = await c.from("projects").select("payload").eq("id", id).single();
  if (e1 || !ada) return NextResponse.json({ ok: false, error: "Kiriman tidak ditemukan" }, { status: 404 });
  const p: any = ada.payload || {};
  if (p.kind !== "lapor_kapal" || p.token !== token) {
    return NextResponse.json({ ok: false, error: "Kiriman tidak dikenali" }, { status: 403 });
  }
  // Peramban dapat tidak menerima respons walaupun server sudah selesai. Saat
  // potongan yang sama dicoba ulang, kembalikan hasil lama tanpa membuat file
  // Google Drive kedua.
  const sudahAda = (p.berkas || []).find((f: any) => f.unggahId === idUnggah);
  if (sudahAda) {
    return NextResponse.json({ ok: true, selesai: true, berkas: sudahAda, jumlah: (p.berkas || []).length });
  }
  if ((p.berkas || []).length >= MAKS_BERKAS) {
    return NextResponse.json({ ok: false, error: `Maksimal ${MAKS_BERKAS} berkas per kiriman` }, { status: 400 });
  }

  // ── lempar potongan ke Drive lewat Apps Script ────────────────────────────
  let hasil: any;
  try {
    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: gasSecret,
        // Berkas yang muat dalam satu potongan dikirim dengan cara lama, supaya
        // Apps Script versi lama (yang belum kenal potongan) tetap melayaninya.
        // Hanya berkas besar yang menuntut Apps Script versi baru.
        ...(total === 1
          ? { dataBase64 }
          : { aksi: "potongan", unggahId: idUnggah, indeks, total, data: dataBase64 }),
        kapal: p.kapal, jenis: p.jenis, periode: p.periode,
        catatan: `${p.pengirim || ""}${p.jabatan ? ` (${p.jabatan})` : ""}`,
        namaBerkas: nama || "berkas", mime,
      }),
      redirect: "follow", // Apps Script /exec menjawab lewat redirect
    });
    const t = await res.text();
    try { hasil = JSON.parse(t); } catch { hasil = { ok: false, error: t.slice(0, 200) }; }
    if (!res.ok || hasil?.ok !== true) {
      return NextResponse.json({
        ok: false,
        error: hasil?.error || `Google Drive menolak (${res.status})`,
        retryable: res.status >= 500,
      }, { status: 502 });
    }
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e?.message || "Gagal menghubungi Google Drive",
      retryable: true,
    }, { status: 502 });
  }

  // potongan tengah: belum ada berkas jadi, tidak ada yang perlu dicatat
  if (total > 1 && !hasil.selesai) return NextResponse.json({ ok: true, selesai: false, indeks });

  // Jangan pernah membuat tombol "Buka" kosong. Respons sukses dari Drive wajib
  // membawa identitas dan tautan berkas yang dapat disimpan.
  if (!hasil.fileId || !hasil.url) {
    return NextResponse.json({
      ok: false,
      error: "Google Drive belum mengembalikan tautan berkas. Coba kirim ulang berkas ini.",
      retryable: false,
    }, { status: 424 });
  }

  // ── berkas utuh: catat tautannya (bukan berkasnya) ────────────────────────
  const berkas = [...(p.berkas || []), {
    nama: hasil.nama || nama, mime, ukuran: hasil.ukuran || Math.round(dataBase64.length * 0.75),
    fileId: hasil.fileId, url: hasil.url, diunggahPada: new Date().toISOString(), unggahId: idUnggah,
  }];
  const { error: e2 } = await c.from("projects").update({ payload: { ...p, berkas } }).eq("id", id);
  if (e2) return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });

  return NextResponse.json({ ok: true, selesai: true, berkas: berkas[berkas.length - 1], jumlah: berkas.length });
}
