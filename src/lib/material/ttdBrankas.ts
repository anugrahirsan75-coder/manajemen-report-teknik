/**
 * Brankas tanda tangan — sumber ketiga, dipakai saat aplikasi jalan di Vercel.
 *
 * Masalah yang diselesaikan: di laptop, gambar tanda tangan diambil dari
 * data/ttd; di Vercel folder itu tidak ada dan berkasnya tidak boleh ikut ke
 * repositori karena repositori ini publik. Jalan keluar sebelumnya adalah
 * menempelkan base64 ke Environment Variables Vercel — benar secara keamanan,
 * tetapi menuntut pemakai membuka dasbor Vercel tiap kali tanda tangan
 * berganti, dan selama itu belum dikerjakan fiturnya mati.
 *
 * Maka gambarnya disimpan di basis data yang sudah dipakai aplikasi ini, TAPI
 * DISANDIKAN lebih dulu. Alasannya penting: kunci `anon` Supabase ikut terkirim
 * ke setiap peramban, dan siapa pun yang menyalinnya bisa membaca tabel
 * `projects` langsung lewat REST. Tanda tangan orang dan stempel cabang adalah
 * bahan pemalsuan; menyimpannya apa adanya di sana sama saja menerbitkannya.
 *
 * Penyandiannya AES-256-GCM dengan kunci yang DITURUNKAN dari AUTH_TOKEN —
 * peubah lingkungan yang sudah pasti ada (login aplikasi memakainya) dan tidak
 * pernah keluar dari sisi server. Yang tersimpan di basis data hanya sandi;
 * tanpa AUTH_TOKEN isinya tidak berarti apa-apa.
 *
 * Akibat yang harus diketahui: kalau AUTH_TOKEN diganti, gambar lama tidak
 * bisa dibuka lagi dan harus diunggah ulang. Itu disengaja — kunci yang bisa
 * diganti tanpa memutus apa pun berarti ia tidak benar-benar mengunci.
 */
import crypto from "crypto";
import { dbServer, dbSiap } from "@/lib/dbServer";

export type PeranTtd = "deptHead" | "stafTeknik" | "stempel";

export const KIND_TTD = "ttd_arsip";
const DOC_ID = "material";

/** batas ukuran satu gambar — tanda tangan yang sehat jauh di bawah ini */
export const BATAS_GAMBAR = 1_500_000;

export interface KotakSandi {
  v: 1;
  iv: string;
  tag: string;
  data: string;
  ukuran: number;
  jenis: string;
  pada: string;
  oleh?: string;
}

export type IsiBrankas = Partial<Record<PeranTtd, KotakSandi>>;

function kunci(): Buffer | null {
  const auth = process.env.AUTH_TOKEN;
  if (!auth) return null;
  // garam tetap: kuncinya harus sama di tiap proses serverless, dan yang
  // dirahasiakan memang AUTH_TOKEN-nya, bukan garamnya
  return crypto.scryptSync(auth, "ttd-material-v1", 32);
}

export function brankasSiap() {
  return dbSiap() && !!process.env.AUTH_TOKEN;
}

export function sandikan(buf: Buffer, jenis: string, oleh?: string): KotakSandi {
  const k = kunci();
  if (!k) throw new Error("AUTH_TOKEN belum diisi, gambar tidak bisa disandikan");
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([c.update(buf), c.final()]);
  return {
    v: 1,
    iv: iv.toString("base64"),
    tag: c.getAuthTag().toString("base64"),
    data: data.toString("base64"),
    ukuran: buf.length,
    jenis,
    pada: new Date().toISOString(),
    oleh,
  };
}

/** null bila kuncinya tidak cocok atau isinya rusak — bukan lempar galat */
export function bukaSandi(kotak: KotakSandi | undefined): Buffer | null {
  if (!kotak?.data) return null;
  const k = kunci();
  if (!k) return null;
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(kotak.iv, "base64"));
    d.setAuthTag(Buffer.from(kotak.tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(kotak.data, "base64")), d.final()]);
  } catch {
    // tanda paling lazim: AUTH_TOKEN berganti sesudah gambarnya diunggah
    return null;
  }
}

async function barisBrankas() {
  const c = dbServer();
  if (!c) return { c: null, id: "", isi: {} as IsiBrankas };
  const { data, error } = await c.from("projects").select("id,payload")
    .filter("payload->>kind", "eq", KIND_TTD).filter("payload->>docId", "eq", DOC_ID).limit(1);
  if (error) throw error;
  const ada = (data || [])[0];
  return { c, id: (ada?.id as string) || "", isi: (((ada?.payload as any)?.doc) || {}) as IsiBrankas };
}

export async function isiBrankas(): Promise<IsiBrankas> {
  if (!brankasSiap()) return {};
  try { return (await barisBrankas()).isi; } catch { return {}; }
}

export async function ambilDariBrankas(peran: PeranTtd): Promise<Buffer | null> {
  const isi = await isiBrankas();
  return bukaSandi(isi[peran]);
}

export async function simpanKeBrankas(peran: PeranTtd, buf: Buffer, jenis: string, oleh?: string) {
  if (!dbSiap()) throw new Error("Sumber data belum siap");
  const { c, id, isi } = await barisBrankas();
  if (!c) throw new Error("Sumber data belum siap");
  const doc: IsiBrankas = { ...isi, [peran]: sandikan(buf, jenis, oleh) };
  const payload = { kind: KIND_TTD, docId: DOC_ID, doc };
  const res = id
    ? await c.from("projects").update({ payload }).eq("id", id)
    : await c.from("projects").insert({ nama_kapal: "Tanda Tangan Kode Material", tahun: new Date().getFullYear(), payload });
  if (res.error) throw res.error;
}

export async function hapusDariBrankas(peran: PeranTtd) {
  if (!dbSiap()) throw new Error("Sumber data belum siap");
  const { c, id, isi } = await barisBrankas();
  if (!c || !id) return;
  const doc: IsiBrankas = { ...isi };
  delete doc[peran];
  const { error } = await c.from("projects").update({ payload: { kind: KIND_TTD, docId: DOC_ID, doc } }).eq("id", id);
  if (error) throw error;
}

/**
 * Kenali jenis gambar dari isinya, bukan dari nama berkas atau dari apa yang
 * diakui peramban. Keduanya dikirim pemakai dan keduanya bisa keliru — dan
 * pdf-lib hanya sanggup menyisipkan PNG atau JPEG, jadi berkas lain lebih baik
 * ditolak di pintu daripada menghasilkan dokumen yang gagal terbit.
 */
export function jenisGambar(buf: Buffer): "image/png" | "image/jpeg" | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  return null;
}
