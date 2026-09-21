/**
 * Sumber gambar tanda tangan dan stempel.
 *
 * Dua tempat, dengan urutan yang disengaja:
 *
 *  1. Peubah lingkungan (base64). Dipakai di Vercel. Nilainya disimpan di
 *     pengaturan proyek, bukan di dalam kode — repositori ini publik, dan
 *     tanda tangan yang sekali masuk riwayat git tidak bisa ditarik kembali.
 *  2. Berkas di data/ttd pada laptop. Dipakai saat bekerja lokal.
 *  3. Brankas tersandi di basis data. Diisi lewat halaman Kode Material,
 *     tanpa perlu membuka dasbor Vercel. Lihat ttdBrankas.ts.
 *
 * Urutannya disengaja: yang disetel sengaja oleh pengelola (env, lalu berkas
 * laptop) mengalahkan yang diunggah lewat layar. Kalau terbalik, sebuah
 * unggahan keliru diam-diam menggantikan tanda tangan yang sudah benar dan
 * tidak ada cara mengembalikannya selain menghapus unggahan itu.
 *
 * Kalau ketiganya kosong, dokumen tetap terbit dengan ruang tanda tangan
 * kosong — siap dicetak dan ditandatangani seperti biasa.
 */
import fs from "fs";
import path from "path";
import { ambilDariBrankas, brankasSiap, bukaSandi, isiBrankas } from "./ttdBrankas";

export type PeranTtd = "deptHead" | "stafTeknik" | "stempel";

const BERKAS: Record<PeranTtd, string> = {
  deptHead: "ttd-dept-head.png",
  stafTeknik: "ttd-staf-teknik.png",
  stempel: "stempel.png",
};

const ENV: Record<PeranTtd, string> = {
  deptHead: "TTD_DEPT_HEAD_B64",
  stafTeknik: "TTD_STAF_TEKNIK_B64",
  stempel: "STEMPEL_B64",
};

export const folderTtd = () => path.join(process.cwd(), "data", "ttd");

/** Buang awalan "data:image/png;base64," bila pemakai menempelkannya utuh. */
const bersihkanB64 = (s: string) => s.replace(/^data:image\/\w+;base64,/, "").replace(/\s+/g, "");

export function ambilTtd(peran: PeranTtd): Buffer | null {
  const dariEnv = process.env[ENV[peran]];
  if (dariEnv && dariEnv.trim()) {
    try {
      const buf = Buffer.from(bersihkanB64(dariEnv), "base64");
      if (buf.length > 100) return buf;
    } catch { /* isi env rusak — coba berkas lokal */ }
  }
  try {
    const buf = fs.readFileSync(path.join(folderTtd(), BERKAS[peran]));
    return buf.length > 100 ? buf : null;
  } catch {
    return null;
  }
}

export const adaTtd = (peran: PeranTtd) => !!ambilTtd(peran);

/** sumber lengkap termasuk brankas basis data — inilah yang dipakai saat membubuhkan */
export async function ambilTtdPenuh(peran: PeranTtd): Promise<Buffer | null> {
  return ambilTtd(peran) || (await ambilDariBrankas(peran));
}

export type AsalTtd = "env" | "berkas" | "brankas" | "tidak ada";

export interface StatusTtd {
  deptHead: boolean;
  stafTeknik: boolean;
  stempel: boolean;
  asal: Record<PeranTtd, AsalTtd>;
  /** gambar ada di brankas tapi tidak bisa dibuka — hampir selalu AUTH_TOKEN berganti */
  rusak: PeranTtd[];
  brankasSiap: boolean;
}

export async function statusTtd(): Promise<StatusTtd> {
  const isi = brankasSiap() ? await isiBrankas() : {};
  const peran: PeranTtd[] = ["deptHead", "stafTeknik", "stempel"];
  const asal = {} as Record<PeranTtd, AsalTtd>;
  const rusak: PeranTtd[] = [];

  for (const p of peran) {
    const e = process.env[ENV[p]];
    if (e && e.trim() && ambilTtd(p)) { asal[p] = "env"; continue; }
    if (ambilTtd(p)) { asal[p] = "berkas"; continue; }
    if (isi[p]) {
      // ada kotaknya, tapi belum tentu bisa dibuka — yang menentukan "ada"
      // adalah bisa-tidaknya dipakai, bukan ada-tidaknya baris di basis data
      if (bukaSandi(isi[p])) { asal[p] = "brankas"; continue; }
      rusak.push(p);
    }
    asal[p] = "tidak ada";
  }

  return {
    deptHead: asal.deptHead !== "tidak ada",
    stafTeknik: asal.stafTeknik !== "tidak ada",
    stempel: asal.stempel !== "tidak ada",
    asal, rusak, brankasSiap: brankasSiap(),
  };
}
