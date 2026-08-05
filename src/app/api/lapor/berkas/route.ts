/**
 * Unggah berkas kiriman ke Google Drive pemilik, lalu tempelkan tautannya ke
 * catatan kiriman.
 *
 * Berkas dikirim POTONGAN DEMI POTONGAN. Alasannya: satu permintaan ke hosting
 * aplikasi dibatasi ~4,5 MB, sementara laporan kapal biasa 5–20 MB. Peramban
 * memecah berkas, tiap potongan disimpan sementara oleh Apps Script, dan
 * potongan terakhir memicu penyatuan jadi satu berkas utuh di Drive.
 *
 * Supabase tetap hanya menerima catatan kecil: nama, ukuran, id & URL Drive.
 *
 * Terbuka tanpa login, tapi berkas hanya bisa menempel ke kiriman yang tokennya
 * cocok — token itu baru dibuat di /api/lapor/kirim dan hanya ada di peramban
 * pengirim.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbLapor, dbSiap } from "@/lib/lapor/db";
import { lajuTerlampaui, ipDari } from "@/lib/lapor/laju";
import { kenaliBerkas, namaAman, PESAN_JENIS_DITOLAK } from "@/lib/lapor/berkasJenis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;


const MAKS_BERKAS = 12;
/** panjang teks base64 maksimal per potongan — di bawah batas badan permintaan hosting */
const MAKS_POTONGAN = 3_200_000;
/**
 * Batas jumlah potongan diselaraskan dengan kemampuan Apps Script menyatukan
 * kembali (lihat BATAS_MB di docs/lapor-apps-script.gs). Angka yang lebih besar
 * hanya akan gagal di ujung, setelah ABK terlanjur mengunggah semuanya.
 */
const MAKS_TOTAL_POTONGAN = 18;
/**
 * Apps Script kadang lambat (penyatuan berkas besar). Batas ini menjaga agar
 * fungsi tidak menggantung sampai maxDuration habis: lebih baik menjawab
 * "coba lagi" yang bisa diulang peramban daripada mati tanpa jawaban.
 */
const TENGGANG_GAS_MS = 45_000;

/** galat yang layak dicoba lagi oleh peramban */
const jawabUlangi = (pesan: string, status = 502) =>
  NextResponse.json({ ok: false, error: pesan, retryable: true }, { status });

export async function POST(req: NextRequest) {
  const gasUrl = process.env.LAPOR_GAS_URL;
  const gasSecret = process.env.LAPOR_GAS_SECRET || "";
  if (!gasUrl) {
    return NextResponse.json(
      { ok: false, error: "Penyimpanan berkas belum aktif. Deploy Apps Script lalu isi LAPOR_GAS_URL (lihat docs/lapor-apps-script.gs)." },
      { status: 501 });
  }
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const b = await req.json().catch(() => ({} as any));
  const { id, token, nama, mime, dataBase64, unggahId } = b as Record<string, string>;
  const idUnggah = String(unggahId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  const indeks = Number(b.indeks) || 0;
  const total = Number(b.total) || 1;

  if (!id || !token || !idUnggah) return NextResponse.json({ ok: false, error: "Kiriman tidak dikenali" }, { status: 400 });
  if (!dataBase64) return NextResponse.json({ ok: false, error: "Berkas kosong" }, { status: 400 });

  // Jenis berkas ditentukan dari ekstensi nama, bukan dari `file.type` peramban.
  // Ponsel sering melaporkan jenis kosong / octet-stream untuk berkas yang sah.
  const jenis = kenaliBerkas(String(nama || ""), String(mime || ""));
  if (!jenis) return NextResponse.json({ ok: false, error: PESAN_JENIS_DITOLAK }, { status: 400 });
  const namaBerkas = namaAman(String(nama || "berkas"), jenis.ext);

  if (dataBase64.length > MAKS_POTONGAN) {
    return NextResponse.json({ ok: false, error: "Potongan terlalu besar" }, { status: 413 });
  }
  if (total > MAKS_TOTAL_POTONGAN || indeks < 0 || indeks >= total) {
    return NextResponse.json({ ok: false, error: "Berkas terlalu besar untuk dikirim lewat halaman ini (maksimal 35 MB)" }, { status: 413 });
  }

  // Pembatas laju dihitung per kiriman, bukan per alamat IP saja: satu router
  // kapal dipakai banyak ABK sekaligus, dan satu berkas 30 MB memang butuh
  // belasan permintaan. Yang ditahan adalah pengulangan tak wajar pada satu
  // kiriman yang sama.
  if (lajuTerlampaui(`berkas:${id}`, 600, 30 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Terlalu banyak unggahan untuk kiriman ini. Buat kiriman baru." }, { status: 429 });
  }
  if (lajuTerlampaui(`ip:${ipDari(req)}`, 2000, 30 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Terlalu banyak unggahan dari jaringan ini. Coba lagi beberapa menit." }, { status: 429 });
  }

  const c = dbLapor()!;
  const { data: ada, error: e1 } = await c.from("projects").select("payload").eq("id", id).single();
  if (e1 || !ada) return NextResponse.json({ ok: false, error: "Kiriman tidak ditemukan" }, { status: 404 });
  const p: any = ada.payload || {};
  if (p.kind !== "lapor_kapal" || p.token !== token) {
    return NextResponse.json({ ok: false, error: "Kiriman tidak dikenali" }, { status: 403 });
  }
  // Peramban dapat tidak menerima respons walaupun server sudah selesai. Saat
  // unggahan yang sama dicoba ulang, kembalikan hasil lama tanpa membuat berkas
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
        ...(total === 1
          ? { dataBase64 }
          : { aksi: "potongan", unggahId: idUnggah, indeks, total, data: dataBase64 }),
        kapal: p.kapal, jenis: p.jenis, periode: p.periode,
        catatan: `${p.pengirim || ""}${p.jabatan ? ` (${p.jabatan})` : ""}`,
        namaBerkas, mime: jenis.mime,
      }),
      redirect: "follow",
      signal: AbortSignal.timeout(TENGGANG_GAS_MS),
    });
    const t = await res.text();
    try { hasil = JSON.parse(t); } catch {
      // Apps Script yang bermasalah menjawab halaman HTML. Jangan pernah
      // menampilkan potongan HTML itu ke ABK.
      hasil = { ok: false, sementara: res.status >= 500, error: "Google Drive belum menjawab dengan benar." };
    }
    if (!res.ok || hasil?.ok !== true) {
      let pesan = String(hasil?.error || `Google Drive menolak (${res.status})`);
      // Apps Script versi lama tidak mengenali aksi "potongan": yang keluar
      // justru "berkas kosong", pesan yang tidak menjelaskan apa pun kepada ABK.
      if (total > 1 && /berkas kosong/i.test(pesan)) {
        pesan = "Penyimpanan Drive masih memakai Apps Script versi lama sehingga berkas besar ditolak. "
          + "Terbitkan versi baru: Deploy > Kelola deployment > Versi baru.";
      }
      // Galat SEMENTARA (Drive sibuk, kuota sesaat, jawaban tak terbaca) harus
      // bisa diulang. Apps Script selalu menjawab HTTP 200, jadi statusnya tidak
      // bisa dipakai sebagai penanda — penandanya ada di isi jawaban.
      const bolehUlang = Boolean(hasil?.sementara)
        || res.status >= 500
        || /sibuk|timed out|timeout|sementara|terlalu banyak|try again|internal/i.test(pesan);
      return NextResponse.json({ ok: false, error: pesan, retryable: bolehUlang }, { status: 502 });
    }
  } catch (e: any) {
    const putus = e?.name === "TimeoutError" || e?.name === "AbortError";
    return jawabUlangi(putus
      ? "Google Drive terlalu lama menjawab. Coba lagi."
      : e?.message || "Gagal menghubungi Google Drive");
  }

  // potongan tengah: belum ada berkas jadi, tidak ada yang perlu dicatat
  if (total > 1 && !hasil.selesai) {
    return NextResponse.json({ ok: true, selesai: false, indeks, tersimpan: hasil.tersimpan ?? indeks + 1 });
  }

  // Jangan pernah membuat tombol "Buka" kosong. Respons sukses dari Drive wajib
  // membawa identitas dan tautan berkas yang dapat disimpan.
  if (!hasil.fileId || !hasil.url) {
    return jawabUlangi("Google Drive belum mengembalikan tautan berkas. Coba kirim ulang berkas ini.", 424);
  }

  // ── berkas utuh: catat tautannya (bukan berkasnya) ────────────────────────
  // Payload dibaca ULANG tepat sebelum menulis supaya perubahan yang masuk
  // sementara berkas diunggah (status/tindak lanjut dari kantor, atau berkas
  // lain dari kiriman yang sama) tidak tertimpa salinan lama.
  const { data: terbaru } = await c.from("projects").select("payload").eq("id", id).single();
  const pTerbaru: any = terbaru?.payload || p;
  const daftarLama = Array.isArray(pTerbaru.berkas) ? pTerbaru.berkas : [];
  if (daftarLama.some((f: any) => f.unggahId === idUnggah)) {
    const lama = daftarLama.find((f: any) => f.unggahId === idUnggah);
    return NextResponse.json({ ok: true, selesai: true, berkas: lama, jumlah: daftarLama.length });
  }

  const berkas = [...daftarLama, {
    nama: hasil.nama || namaBerkas, mime: jenis.mime,
    ukuran: hasil.ukuran || Math.round(dataBase64.length * 0.75),
    fileId: hasil.fileId, url: hasil.url, diunggahPada: new Date().toISOString(), unggahId: idUnggah,
  }];
  const { error: e2 } = await c.from("projects")
    .update({ payload: { ...pTerbaru, berkas, galatUnggah: "" } }).eq("id", id);
  if (e2) {
    console.error("lapor/berkas gagal catat:", e2.message);
    // Berkasnya SUDAH ada di Drive. Peramban boleh mengulang: penjaga unggahId
    // di atas mencegah berkas kedua terbentuk.
    return jawabUlangi("Berkas sudah masuk Drive tapi catatannya gagal disimpan. Tekan coba lagi.", 500);
  }

  return NextResponse.json({ ok: true, selesai: true, berkas: berkas[berkas.length - 1], jumlah: berkas.length });
}

/**
 * Sampai mana unggahan ini sudah masuk? Dipakai halaman ABK untuk MELANJUTKAN
 * berkas yang putus di tengah jalan alih-alih mengulang dari potongan pertama —
 * bedanya besar di jaringan kapal: berkas 20 MB tidak perlu naik dua kali.
 */
export async function GET(req: NextRequest) {
  const gasUrl = process.env.LAPOR_GAS_URL;
  if (!gasUrl || !dbSiap()) return NextResponse.json({ ok: false }, { status: 503 });

  const q = req.nextUrl.searchParams;
  const id = q.get("id") || "";
  const token = q.get("token") || "";
  const unggahId = (q.get("unggahId") || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  if (!id || !token || !unggahId) return NextResponse.json({ ok: false }, { status: 400 });

  const c = dbLapor()!;
  const { data: ada } = await c.from("projects").select("payload").eq("id", id).single();
  const p: any = ada?.payload;
  if (!p || p.kind !== "lapor_kapal" || p.token !== token) return NextResponse.json({ ok: false }, { status: 403 });

  const sudah = (p.berkas || []).find((f: any) => f.unggahId === unggahId);
  if (sudah) return NextResponse.json({ ok: true, selesai: true, hasil: sudah });

  try {
    const res = await fetch(gasUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.LAPOR_GAS_SECRET || "", aksi: "status", unggahId }),
      redirect: "follow", signal: AbortSignal.timeout(20_000),
    });
    const d = JSON.parse(await res.text());
    if (d?.ok !== true) return NextResponse.json({ ok: true, potongan: [] });
    return NextResponse.json({ ok: true, selesai: !!d.selesai, hasil: d.hasil || null, potongan: d.potongan || [] });
  } catch {
    // gagal bertanya bukan alasan gagal kirim — anggap belum ada yang masuk
    return NextResponse.json({ ok: true, potongan: [] });
  }
}
