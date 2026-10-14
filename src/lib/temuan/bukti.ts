"use client";
/**
 * Unggah dokumen bukti pemenuhan temuan.
 *
 * Berbeda dari unggahan foto biasa: bukti pemenuhan sering berupa PDF —
 * berita acara, sertifikat, hasil uji — dan PDF TIDAK BOLEH dikompres jadi
 * JPEG. Modul foto yang ada memaksa semuanya lewat canvas; dipakai di sini,
 * sebuah berita acara akan berubah jadi gambar halaman pertamanya saja, dan
 * halaman dua sampai limanya hilang tanpa pemberitahuan.
 *
 * Foto tetap dikompres, karena foto bukti diambil dari ponsel dan kerap 5 MB
 * sekeping; PDF dan dokumen lain dinaikkan apa adanya.
 *
 * TIDAK ADA JALAN MUNDUR KE base64 di sini. Pada foto, jatuh ke base64 masuk
 * akal karena ukurannya kecil. Bukti bisa belasan megabita, dan menyimpannya
 * sebagai teks di dalam baris basis data akan menembus batas badan permintaan
 * — kegagalannya muncul sebagai "gagal simpan" yang tidak menyebut-nyebut
 * berkas, persis bug yang pernah membuat halaman SPPBJ berhenti menyimpan.
 * Kalau unggahan gagal, pengguna diberi tahu dan boleh menaut berkasnya dari
 * Drive sebagai gantinya.
 */
import { supabase } from "@/lib/supabase";
import { compressFoto } from "@/lib/fotoStorage";
import { BuktiTemuan } from "./types";

const BUCKET = "bukti";
/** batas yang diterima Supabase Storage pada paket gratis untuk satu berkas */
export const BATAS_BITA = 50 * 1024 * 1024;

export const JENIS_DITERIMA = [
  "application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic",
];

const acak = () => Math.random().toString(36).slice(2, 8);

export function ukuranRapi(b: number): string {
  if (!b) return "—";
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
  if (b >= 1024) return `${Math.round(b / 1024)} KB`;
  return `${b} B`;
}

export class GagalUnggah extends Error {}

/**
 * Naikkan satu berkas bukti; kembalikan catatan buktinya.
 *
 * Galat dilempar, bukan ditelan: pemanggilnya yang memutuskan mau menampilkan
 * pesan apa, dan temuan tidak boleh berpindah ke status CLOSED hanya karena
 * unggahan buktinya diam-diam gagal.
 */
export async function unggahBukti(berkas: File, catatan = ""): Promise<BuktiTemuan> {
  if (!supabase) {
    throw new GagalUnggah("Supabase belum tersambung — simpan dulu kredensialnya, "
      + "atau tautkan berkasnya dari Google Drive.");
  }
  if (berkas.size > BATAS_BITA) {
    throw new GagalUnggah(`Berkas ${ukuranRapi(berkas.size)} melebihi batas `
      + `${ukuranRapi(BATAS_BITA)}. Unggah ke Drive lalu tautkan di sini.`);
  }

  let isi: Blob = berkas;
  let ext = (berkas.name.split(".").pop() || "bin").toLowerCase();
  let tipe = berkas.type || "application/octet-stream";

  // foto dikecilkan; PDF dan lainnya naik apa adanya
  if (berkas.type.startsWith("image/") && berkas.type !== "image/heic") {
    try {
      const { blob } = await compressFoto(berkas, 1600, 0.8);
      isi = blob; ext = "jpg"; tipe = "image/jpeg";
    } catch {
      // gambar yang tak bisa dibaca canvas tetap dinaikkan dalam bentuk aslinya
    }
  }

  const nama = `${new Date().toISOString().slice(0, 7)}/${Date.now()}-${acak()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET)
    .upload(nama, isi, { contentType: tipe, upsert: false });
  if (error) {
    throw new GagalUnggah(`${error.message}. Bila bucket "${BUCKET}" belum ada, `
      + "buat dulu di Supabase → Storage, atau tautkan berkasnya dari Drive.");
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(nama);

  return {
    id: `${Date.now()}-${acak()}`,
    nama: berkas.name,
    url: data.publicUrl || "",
    jenis: "unggahan",
    bita: isi.size,
    diunggahPada: new Date().toISOString(),
    catatan,
  };
}

/** Bukti berupa tautan Drive — jalan keluar untuk berkas besar. */
export function buktiTautan(url: string, nama: string, catatan = ""): BuktiTemuan {
  return {
    id: `${Date.now()}-${acak()}`,
    nama: nama || url.replace(/^https?:\/\//, "").slice(0, 60),
    url, jenis: "tautan", bita: 0,
    diunggahPada: new Date().toISOString(), catatan,
  };
}
