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
/**
 * Jenis kiriman yang boleh menempelkan berkas lewat route ini.
 *
 * "permintaan_uji" adalah borang permintaan digital yang masih diuji coba, dan
 * "inspeksi_temuan" adalah bukti perbaikan temuan Marine Superintendent.
 * Keduanya memakai jalur unggah yang sama persis — potongan, lanjut setelah putus,
 * penjaga salinan ganda — karena menulis jalur kedua berarti menguji ulang
 * semua yang sudah terbukti di sini. Yang dipisah hanya folder Drive-nya.
 */
const KIND_DILAYANI = ["lapor_kapal", "permintaan_uji", "inspeksi_temuan"];
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

/**
 * Catat satu berkas pada kirimannya — SATU pintu untuk dua jalur: unggahan yang
 * selesai normal, dan berkas yang ditemukan sudah utuh di Drive saat peramban
 * bertanya "sampai mana".
 *
 * Payload dibaca ULANG tepat sebelum ditulis supaya perubahan yang masuk selagi
 * berkas diunggah (status dari kantor, atau berkas lain dari kiriman yang sama)
 * tidak tertimpa salinan lama. unggahId menjaga agar percobaan ulang tidak
 * membuat baris kedua untuk berkas yang sama.
 */
async function catatBerkas(c: any, id: string, berkasBaru: Record<string, any>) {
  const { data: terbaru } = await c.from("projects").select("payload").eq("id", id).single();
  const p: any = terbaru?.payload || {};
  const daftar: any[] = Array.isArray(p.berkas) ? p.berkas : [];
  const lama = daftar.find((f) => f.unggahId && f.unggahId === berkasBaru.unggahId);
  if (lama) return { berkas: lama, jumlah: daftar.length, baru: false };

  const berkas = [...daftar, berkasBaru];
  const { error } = await c.from("projects")
    .update({ payload: { ...p, berkas, galatUnggah: "" } }).eq("id", id);
  if (error) throw new Error(error.message);
  return { berkas: berkasBaru, jumlah: berkas.length, baru: true };
}

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
  /**
   * Label bebas dari pemanggil. Dipakai bukti temuan inspeksi untuk menandai
   * mana foto kondisi awal dan mana hasil perbaikan — penutupan temuan
   * mensyaratkan yang kedua, jadi bedanya harus ikut tercatat saat diunggah.
   */
  const jenisBerkas = ["sebelum", "sesudah"].includes(String(b?.jenis)) ? String(b.jenis) : "";
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
  if (e1 || !ada) {
    return NextResponse.json({ ok: false, hilang: true, error: "Kiriman tidak ditemukan" }, { status: 404 });
  }
  const p: any = ada.payload || {};
  if (!KIND_DILAYANI.includes(p.kind) || p.token !== token) {
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
        /*
         * SELALU lewat jalur potongan, termasuk berkas yang muat sekali kirim.
         *
         * Jalur lama (dataBase64 polos) tidak mengenal unggahId, jadi tidak
         * punya penjaga pengulangan sama sekali: satu foto yang dikirim ulang
         * karena jawabannya hilang di jalan menjadi dua berkas di Drive. Itulah
         * asal salinan berlipat pada KMP. MAMING 4 Agustus 2026 — semua
         * berkasnya di bawah satu potongan. Jalur potongan mencatat penanda
         * hasil, sehingga pengulangan dijawab dengan berkas yang sudah ada.
         */
        aksi: "potongan", unggahId: idUnggah, indeks, total, data: dataBase64,
        kapal: p.kapal, jenis: p.jenis, periode: p.periode,
        // borang uji coba menyebut foldernya sendiri, jadi berkas percobaan
        // tidak pernah tercampur dengan arsip laporan kapal yang asli
        ...(Array.isArray(p.jalurDrive) && p.jalurDrive.length ? { jalur: p.jalurDrive } : {}),
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
      if (/berkas kosong/i.test(pesan)) {
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
  try {
    const dicatat = await catatBerkas(c, id, {
      nama: hasil.nama || namaBerkas, mime: jenis.mime,
      ukuran: hasil.ukuran || Math.round(dataBase64.length * 0.75),
      fileId: hasil.fileId, url: hasil.url, diunggahPada: new Date().toISOString(), unggahId: idUnggah,
      ...(jenisBerkas ? { jenis: jenisBerkas } : {}),
    });
    return NextResponse.json({ ok: true, selesai: true, berkas: dicatat.berkas, jumlah: dicatat.jumlah });
  } catch (e: any) {
    console.error("lapor/berkas gagal catat:", e?.message);
    // Berkasnya SUDAH ada di Drive. Peramban boleh mengulang: penjaga unggahId
    // di dalam catatBerkas mencegah berkas kedua terbentuk, dan pertanyaan
    // "sampai mana" pun kini ikut menambalkan catatannya.
    return jawabUlangi("Berkas sudah masuk Drive tapi catatannya gagal disimpan. Tekan coba lagi.", 500);
  }
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
  if (!id || !token) return NextResponse.json({ ok: false }, { status: 400 });

  const c = dbLapor()!;
  const { data: ada } = await c.from("projects").select("payload").eq("id", id).single();
  const p: any = ada?.payload;
  /*
   * Kiriman yang catatannya sudah dihapus kantor harus dibedakan dari galat
   * jaringan. Tanpa pembedaan ini, halaman ABK mengulang selamanya ke kiriman
   * yang tak akan pernah ada lagi — dan berkas yang di tangan ABK terlihat
   * "sedang dikirim" itu tidak akan pernah sampai ke mana pun.
   */
  if (!p || !KIND_DILAYANI.includes(p.kind)) {
    return NextResponse.json({ ok: false, hilang: true, error: "Kiriman tidak ditemukan" }, { status: 404 });
  }
  if (p.token !== token) return NextResponse.json({ ok: false }, { status: 403 });

  /*
   * Tanpa unggahId: berapa berkas yang BENAR-BENAR tercatat pada kiriman ini.
   * Halaman ABK memakainya sebagai bukti penutup — selama ini yang dilihat ABK
   * hanya laporan dari ponselnya sendiri, padahal justru catatan di kantor yang
   * menentukan berkas itu dianggap sampai atau tidak.
   */
  if (!unggahId) {
    const daftar = Array.isArray(p.berkas) ? p.berkas : [];
    return NextResponse.json({
      ok: true, jumlah: daftar.length,
      nama: daftar.map((f: any) => f.nama).slice(0, 12),
    });
  }

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

    /*
     * Berkasnya SUDAH utuh di Drive, tapi catatannya belum ada di kiriman ini.
     * Inilah lubang yang membuat berkas "hilang": jawaban unggahan terakhir tak
     * sampai ke ponsel (jaringan kapal putus tepat saat Drive menyatukan
     * berkas), lalu pertanyaan "sampai mana" ini dijawab "sudah selesai" —
     * dan dulu jawabannya berhenti di situ. Berkasnya ada di Drive, kantor
     * melihat kiriman kosong, dan tak ada satu pun yang tahu.
     *
     * Sekarang penemuan itu langsung dicatat, sama persis seperti jalur unggah.
     */
    if (d.selesai && d.hasil?.fileId && d.hasil?.url) {
      const dicatat = await catatBerkas(c, id, {
        nama: d.hasil.nama || "berkas", mime: d.hasil.mime || "application/octet-stream",
        ukuran: Number(d.hasil.ukuran) || 0, fileId: d.hasil.fileId, url: d.hasil.url,
        diunggahPada: new Date().toISOString(), unggahId,
      });
      return NextResponse.json({ ok: true, selesai: true, hasil: dicatat.berkas, jumlah: dicatat.jumlah });
    }
    return NextResponse.json({ ok: true, selesai: !!d.selesai, hasil: d.hasil || null, potongan: d.potongan || [] });
  } catch {
    // gagal bertanya bukan alasan gagal kirim — anggap belum ada yang masuk
    return NextResponse.json({ ok: true, potongan: [] });
  }
}
