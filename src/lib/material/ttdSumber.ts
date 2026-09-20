/**
 * Sumber gambar tanda tangan dan stempel.
 *
 * Dua tempat, dengan urutan yang disengaja:
 *
 *  1. Peubah lingkungan (base64). Dipakai di Vercel. Nilainya disimpan di
 *     pengaturan proyek, bukan di dalam kode — repositori ini publik, dan
 *     tanda tangan yang sekali masuk riwayat git tidak bisa ditarik kembali.
 *  2. Berkas di data/ttd pada laptop. Dipakai saat bekerja lokal.
 *
 * Kalau dua-duanya kosong, dokumen tetap terbit dengan ruang tanda tangan
 * kosong — siap dicetak dan ditandatangani seperti biasa.
 */
import fs from "fs";
import path from "path";

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

export function statusTtd() {
  const asal = (peran: PeranTtd): "env" | "berkas" | "tidak ada" => {
    const e = process.env[ENV[peran]];
    if (e && e.trim()) return "env";
    return adaTtd(peran) ? "berkas" : "tidak ada";
  };
  return {
    deptHead: adaTtd("deptHead"),
    stafTeknik: adaTtd("stafTeknik"),
    stempel: adaTtd("stempel"),
    asal: { deptHead: asal("deptHead"), stafTeknik: asal("stafTeknik"), stempel: asal("stempel") },
  };
}
