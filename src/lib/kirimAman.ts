"use client";
import { supabase } from "@/lib/supabase";
import { dataUrlKeBlob, unggahBlob } from "@/lib/fotoStorage";

/**
 * Penjaga ukuran badan permintaan saat menyimpan pengadaan ke Supabase.
 *
 * Penyimpanan mengirim SELURUH payload pengadaan dalam satu permintaan POST.
 * Selama foto dokumentasi tersimpan sebagai URL, payload itu kecil — beberapa
 * puluh kilobita sekalipun itemnya puluhan. Tetapi `uploadFoto` punya jalan
 * mundur: bila bucket "foto" belum ada atau aksesnya ditolak, foto disimpan
 * sebagai base64 DI DALAM payload. Satu foto terkompresi ±1024px kira-kira
 * 200-600 KB setelah jadi base64, dan lima foto sudah cukup membawa payload ke
 * kisaran megabita.
 *
 * Di situlah bedanya pengembangan dan produksi. Server lokal menerima badan
 * permintaan sebesar apa pun, jadi di laptop semuanya tampak baik. Di Vercel,
 * badan permintaan di atas 4,5 MB DITOLAK DI DEPAN, sebelum fungsi kita sempat
 * berjalan - sehingga tidak ada jawaban HTTP yang kembali dan peramban hanya
 * bisa berkata "TypeError: Failed to fetch". Pesan itu tidak menyebut ukuran,
 * tidak menyebut foto, dan karena itu terbaca seperti gangguan jaringan.
 *
 * Yang dilakukan modul ini, berurutan:
 *   1. foto base64 dicoba dinaikkan dulu ke Supabase Storage dan ditukar jadi
 *      URL - ini memperbaiki datanya, bukan sekadar mengecilkan kiriman;
 *   2. kalau masih kelewat besar, foto base64 yang tersisa dikeluarkan dari
 *      kiriman dan pemakainya DIBERI TAHU - lebih baik tersimpan tanpa foto
 *      daripada gagal tersimpan sama sekali;
 *   3. kalau tetap gagal, pesannya menyebut sebab dan ukurannya.
 */

/** Batas badan permintaan fungsi serverless Vercel. */
export const BATAS_VERCEL = 4.5 * 1024 * 1024;
/**
 * Ambang aman dipasang di bawah batas itu: JSON masih dibungkus kepala
 * permintaan, dan pengkodean UTF-8 bisa membuat satu aksara jadi lebih dari
 * satu bita. Menabrak batas persis sama saja dengan menyerahkan nasibnya pada
 * pembulatan.
 */
export const AMBANG_AMAN = 3.5 * 1024 * 1024;

export function ukuranJson(nilai: unknown): number {
  try {
    const teks = JSON.stringify(nilai) ?? "";
    return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(teks).length : teks.length;
  } catch {
    return 0;
  }
}

export function ukuranRapi(bita: number): string {
  if (bita >= 1024 * 1024) return (bita / 1024 / 1024).toFixed(1) + " MB";
  if (bita >= 1024) return Math.round(bita / 1024) + " KB";
  return bita + " B";
}

const adalahBase64 = (s: unknown) => typeof s === "string" && s.startsWith("data:");

/**
 * Naikkan foto base64 pada payload ke Storage, tukar jadi URL.
 *
 * Dikerjakan saat menyimpan, bukan hanya saat foto dipilih, karena pengadaan
 * lama bisa saja sudah terlanjur menyimpan base64 sewaktu bucketnya belum ada.
 * Yang gagal dinaikkan dibiarkan apa adanya - urusan ukurannya ditangani
 * langkah berikutnya.
 */
async function naikkanFoto<T extends { fotoDokumentasi?: string[] }>(payload: T): Promise<{ payload: T; naik: number }> {
  const foto = payload.fotoDokumentasi;
  if (!supabase || !Array.isArray(foto) || !foto.some(adalahBase64)) return { payload, naik: 0 };

  let naik = 0;
  const hasil = await Promise.all(foto.map(async (f) => {
    if (!adalahBase64(f)) return f;
    try {
      const url = await unggahBlob(dataUrlKeBlob(f));
      if (url) { naik += 1; return url; }
    } catch { /* biarkan tetap base64; ukurannya diurus di langkah berikut */ }
    return f;
  }));
  return { payload: { ...payload, fotoDokumentasi: hasil }, naik };
}

export interface HasilSiap<T> {
  payload: T;
  bita: number;
  naik: number;
  dibuang: number;
  catatan: string;
}

/**
 * Siapkan payload supaya muat dikirim. Mengembalikan payload yang sudah aman
 * berikut catatan untuk ditampilkan ke pemakai bila ada yang berubah.
 */
export async function siapkanPayload<T extends { fotoDokumentasi?: string[] }>(asal: T): Promise<HasilSiap<T>> {
  const { payload: naikin, naik } = await naikkanFoto(asal);
  let payload = naikin;
  let bita = ukuranJson(payload);
  let dibuang = 0;
  let catatan = "";

  if (bita > AMBANG_AMAN) {
    const sisa = (payload.fotoDokumentasi || []).filter((f) => !adalahBase64(f));
    dibuang = (payload.fotoDokumentasi || []).length - sisa.length;
    if (dibuang) {
      payload = { ...payload, fotoDokumentasi: sisa };
      const sebelum = bita;
      bita = ukuranJson(payload);
      catatan = `${dibuang} foto tidak ikut tersimpan ke server. Kirimannya ${ukuranRapi(sebelum)}, ` +
        `sudah melewati ambang aman ${ukuranRapi(AMBANG_AMAN)} dan mendekati batas keras ` +
        `${ukuranRapi(BATAS_VERCEL)} yang membuat server menolak tanpa memberi jawaban. ` +
        `Fotonya masih ada di peramban ini. Agar foto ikut tersimpan, buat bucket ` +
        `"foto" di Supabase Storage lalu simpan ulang.`;
    }
  }
  return { payload, bita, naik, dibuang, catatan };
}

/**
 * Terjemahkan kegagalan simpan jadi kalimat yang menyebut sebabnya.
 *
 * "Failed to fetch" adalah satu-satunya hal yang bisa dikatakan peramban saat
 * permintaan tidak pernah sampai pada jawaban - entah karena jaringan putus,
 * sesi berakhir, atau badan permintaan ditolak di depan. Tanpa diterjemahkan,
 * ketiganya terbaca sama oleh pemakainya.
 */
export function pesanGagal(e: any, bita: number): string {
  const kasar = String(e?.message || e || "gagal");
  if (/failed to fetch|networkerror|load failed/i.test(kasar)) {
    if (bita > AMBANG_AMAN) {
      return `Kiriman terlalu besar (${ukuranRapi(bita)}). Server menolak sebelum sempat menjawab. ` +
        `Kurangi foto dokumentasi, atau buat bucket "foto" di Supabase Storage supaya foto ` +
        `tersimpan sebagai tautan, bukan ikut di dalam data.`;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "Perangkat sedang tanpa jaringan. Data tersimpan lokal dan bisa disimpan ulang nanti.";
    }
    return `Sambungan ke server terputus sebelum ada jawaban (kiriman ${ukuranRapi(bita)}). ` +
      `Coba simpan ulang; bila berulang, periksa sesi login — mungkin sudah berakhir.`;
  }
  if (/jwt|unauthor|401/i.test(kasar)) return "Sesi login sudah berakhir. Masuk ulang, lalu simpan lagi.";
  if (/payload too large|413/i.test(kasar)) {
    return `Kiriman ditolak karena terlalu besar (${ukuranRapi(bita)}). Kurangi foto dokumentasi.`;
  }
  return kasar;
}

/**
 * Jalankan sekali, ulangi satu kali bila yang terjadi gangguan jaringan.
 *
 * Diulang HANYA untuk kegagalan jaringan. Kesalahan dari Supabase - hak akses,
 * data tidak sah - akan gagal lagi dengan cara yang sama, dan mengulanginya
 * cuma menunda pesan yang perlu dibaca pemakainya.
 */
export async function coba2x<T>(kerja: () => Promise<T>): Promise<T> {
  try {
    return await kerja();
  } catch (e: any) {
    if (!/failed to fetch|networkerror|load failed/i.test(String(e?.message || e))) throw e;
    await new Promise((r) => setTimeout(r, 800));
    return await kerja();
  }
}
