/**
 * Lampiran Monitoring Permohonan Cabang → folder Drive "KONTROL PERMOHONAN CABANG".
 *
 * Lewat Apps Script REKAP yang sama dengan sinkron spreadsheet (REKAP_GAS_URL +
 * REKAP_GAS_SECRET), supaya pemakai cukup memperbarui satu skrip. Tiga bentuk:
 *   { aksi: "folder", nama }      → siapkan subfolder; nama tanpa nomor diberi
 *                                   nomor berikutnya ("17. ..."), nama bernomor
 *                                   dipakai apa adanya
 *   { aksi: "aturFolder", url }   → sekali saja, bila skrip tak bisa menemukan
 *                                   folder induknya sendiri
 *   potongan berkas               → { unggahId, indeks, total, jalur:[folder],
 *                                     nama, mime, dataBase64 }
 *
 * Folder INDUK tidak pernah dikirim dari sini kecuali lewat aturFolder; skrip
 * hanya menulis di bawah folder yang sudah ia simpan sendiri. Potongan dipakai
 * karena satu permintaan ke hosting dibatasi ~4,5 MB.
 */
import { NextRequest, NextResponse } from "next/server";
import { kenaliBerkas, namaAman, PESAN_JENIS_DITOLAK } from "@/lib/lapor/berkasJenis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAKS_POTONGAN = 3_200_000;      // panjang base64 per potongan
const MAKS_TOTAL_POTONGAN = 15;       // 15 × 2,25 MB ≈ 34 MB, di bawah P_BATAS_MB skrip
const TENGGANG_GAS_MS = 45_000;
const BELUM_DIPERBARUI =
  "Apps Script belum diperbarui ke versi yang bisa menerima lampiran — tempel kode terbaru lalu Deploy → Kelola deployment → Versi baru.";

const ulangi = (pesan: string, status = 502) =>
  NextResponse.json({ ok: false, error: pesan, retryable: true }, { status });

async function keGas(isi: Record<string, unknown>) {
  const url = process.env.REKAP_GAS_URL!;
  const secret = process.env.REKAP_GAS_SECRET || "";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, ...isi }),
    redirect: "follow",
    signal: AbortSignal.timeout(TENGGANG_GAS_MS),
    cache: "no-store",
  });
  const teks = await res.text();
  try { return JSON.parse(teks); } catch { return null; }
}

export async function POST(req: NextRequest) {
  if (!process.env.REKAP_GAS_URL) {
    return NextResponse.json({ ok: false, error: "REKAP_GAS_URL belum diset (deploy Apps Script dulu)" }, { status: 501 });
  }
  const b = await req.json().catch(() => ({} as any));

  try {
    /* ── siapkan folder / tetapkan folder induk ─────────────────────── */
    if (b?.aksi === "folder" || b?.aksi === "aturFolder") {
      const isi = b.aksi === "folder"
        ? { aksi: "folderPermohonan", nama: String(b.nama || "").slice(0, 160) }
        : { aksi: "aturFolderPermohonan", url: String(b.url || "").slice(0, 400) };
      const h = await keGas(isi);
      if (!h) return ulangi("Google Drive menjawab tidak utuh. Coba lagi.");
      if (h.jenis !== "lampiranPermohonan") {
        return NextResponse.json({ ok: false, error: h.ok === false ? (h.error || BELUM_DIPERBARUI) : BELUM_DIPERBARUI }, { status: 409 });
      }
      if (!h.ok) return NextResponse.json({ ok: false, error: h.error, perluFolder: !!h.perluFolder }, { status: h.perluFolder ? 409 : 502 });
      return NextResponse.json({ ok: true, folderNama: h.folderNama, folderUrl: h.folderUrl });
    }

    /* ── potongan berkas ─────────────────────────────────────────────── */
    const { nama, mime, dataBase64, unggahId } = b as Record<string, string>;
    const idUnggah = String(unggahId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
    const indeks = Number(b.indeks) || 0;
    const total = Number(b.total) || 1;
    const folder = Array.isArray(b.jalur) ? String(b.jalur[0] || "").trim() : "";

    if (!idUnggah) return NextResponse.json({ ok: false, error: "Unggahan tidak dikenali" }, { status: 400 });
    if (!dataBase64) return NextResponse.json({ ok: false, error: "Berkas kosong" }, { status: 400 });
    if (!folder) return NextResponse.json({ ok: false, error: "Folder lampiran belum disiapkan" }, { status: 400 });
    if (dataBase64.length > MAKS_POTONGAN) return NextResponse.json({ ok: false, error: "Potongan terlalu besar" }, { status: 413 });
    if (total > MAKS_TOTAL_POTONGAN) {
      return NextResponse.json({ ok: false, error: "Berkas lebih dari ±34 MB. Taruh langsung di folder Google Drive-nya." }, { status: 413 });
    }
    const jenis = kenaliBerkas(String(nama || ""), String(mime || ""));
    if (!jenis) return NextResponse.json({ ok: false, error: PESAN_JENIS_DITOLAK }, { status: 400 });

    const h = await keGas({
      aksi: "potonganPermohonan", folder, unggahId: idUnggah, indeks, total,
      data: dataBase64, namaBerkas: namaAman(String(nama || "berkas"), jenis.ext), mime: jenis.mime,
    });
    if (!h) return ulangi("Google Drive menjawab tidak utuh. Coba lagi.");
    if (h.jenis !== "lampiranPermohonan") return NextResponse.json({ ok: false, error: BELUM_DIPERBARUI }, { status: 409 });
    if (!h.ok) {
      const pesan = String(h.error || "Gagal menyimpan ke Drive");
      if (h.perluFolder) return NextResponse.json({ ok: false, error: pesan, perluFolder: true }, { status: 409 });
      return h.sementara ? ulangi(pesan) : NextResponse.json({ ok: false, error: pesan }, { status: 502 });
    }
    if (!h.selesai) return NextResponse.json({ ok: true, selesai: false, indeks });
    return NextResponse.json({
      ok: true, selesai: true,
      berkas: { id: h.fileId, nama: h.nama, url: h.url, ukuran: h.ukuran, mime: jenis.mime, folderUrl: h.folderUrl },
    });
  } catch (e: any) {
    const putus = e?.name === "TimeoutError";
    return ulangi(putus ? "Google Drive lambat menjawab. Potongan ini akan diulang." : (e?.message || "gagal"), putus ? 504 : 502);
  }
}
