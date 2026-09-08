/**
 * Pembantu sisi server untuk Portal Kapal.
 *
 * Satu tempat untuk dua hal yang tidak boleh berbeda antar-route: cara membaca
 * identitas kapal dari cookie, dan cara mengambil-atau-membuat lembar datanya.
 * Kalau tiap route menulis versinya sendiri, cepat atau lambat satu di antaranya
 * lupa memeriksa bagian (deck/mesin) dan akun Deck bisa menulis stok filter.
 */
import { cookies } from "next/headers";
import { dbServer } from "@/lib/dbServer";
import { COOKIE_KAPAL, bacaSesiKapal, type SesiKapal } from "./sesi";
import { KIND_ALKES, KIND_STOK_FILTER, type BagianKapal } from "./types";

/** identitas kapal dari cookie; null bila tidak masuk atau tanda tangannya palsu */
export async function sesiKapal(): Promise<SesiKapal | null> {
  const token = cookies().get(COOKIE_KAPAL)?.value;
  return bacaSesiKapal(token, process.env.AUTH_TOKEN);
}

/**
 * Sesi yang WAJIB berbagian tertentu.
 *
 * Stok filter urusan kamar mesin, alkes urusan dek. Pemeriksaannya di sini,
 * bukan di halaman: halaman hanya menyembunyikan tombol, sedangkan yang menahan
 * penulisan harus server.
 */
export async function sesiBagian(bagian: BagianKapal): Promise<SesiKapal | null> {
  const s = await sesiKapal();
  return s && s.bagian === bagian ? s : null;
}

const KIND_LEMBAR: Record<"stok" | "alkes", string> = {
  stok: KIND_STOK_FILTER,
  alkes: KIND_ALKES,
};

/**
 * Ambil lembar data satu kapal, buat bila belum ada.
 *
 * Satu baris per kapal per jenis lembar — bukan satu baris per setoran. Yang
 * ditanya kantor selalu "berapa stoknya sekarang", dan menyusunnya ulang dari
 * tumpukan setoran bulanan berarti jawaban itu berbeda-beda tergantung siapa
 * yang menjumlahkan.
 */
export async function lembarKapal(jenis: "stok" | "alkes", kapal: string) {
  const c = dbServer();
  if (!c) return { c: null, id: "", payload: null as any };
  const kind = KIND_LEMBAR[jenis];
  const { data } = await c.from("projects")
    .select("id,payload")
    .filter("payload->>kind", "eq", kind)
    .filter("payload->>kapal", "eq", kapal)
    .limit(1);
  const ada = (data || [])[0];
  if (ada) return { c, id: ada.id as string, payload: (ada.payload || {}) as any };

  const kosong = jenis === "stok"
    ? { kind, kapal, filter: [], mesin: [], diperbaruiPada: "", olehAkun: "", riwayat: [] }
    : { kind, kapal, item: [], diperbaruiPada: "", olehAkun: "", riwayat: [] };
  const { data: baru } = await c.from("projects")
    .insert({ nama_kapal: kapal, tahun: new Date().getFullYear(), payload: kosong })
    .select("id").single();
  return { c, id: (baru?.id as string) || "", payload: kosong as any };
}

/** potong jejak supaya payload tidak menggelembung tanpa batas */
export const sambungJejak = (lama: unknown, baru: unknown) =>
  [...(Array.isArray(lama) ? lama : []), baru].slice(-100);
