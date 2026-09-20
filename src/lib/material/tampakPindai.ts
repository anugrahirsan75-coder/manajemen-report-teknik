/**
 * Ubah PDF hasil cetak menjadi PDF yang tampak seperti lembar hasil pindaian.
 *
 * Pekerjaan gambarnya dilakukan skrip Python (scripts/tampak-pindai.py) karena
 * pustaka gambar yang dibutuhkan sudah ada di laptop ini, sementara di sisi
 * Node harus ditambah paket baru hanya demi satu fitur.
 *
 * Kalau Python tidak ada, dokumen tetap terbit — tajam, tanpa efek pindaian —
 * dan pemakainya diberi tahu. Menggagalkan ekspor gara-gara efek tampilan
 * berarti menahan pekerjaan demi hal yang bukan isinya.
 */
import { spawn, spawnSync } from "child_process";
import fs from "fs";
import path from "path";

/** Penerjemah Python pertama yang benar-benar bisa memuat pustaka gambarnya. */
export function penerjemahPython(): { perintah: string; awalan: string[] } | null {
  const calon: { perintah: string; awalan: string[] }[] = [
    { perintah: "py", awalan: ["-3"] },
    { perintah: "python", awalan: [] },
    { perintah: "python3", awalan: [] },
  ];
  for (const c of calon) {
    try {
      const uji = spawnSync(c.perintah, [...c.awalan, "-c", "import fitz, PIL"], { timeout: 20000 });
      if (uji.status === 0) return c;
    } catch { /* penerjemah ini tidak ada — coba berikutnya */ }
  }
  return null;
}

export const bisaPindai = () => process.platform === "win32" && !!penerjemahPython();

export function keTampakPindai(masuk: string, keluar: string): Promise<void> {
  const py = penerjemahPython();
  if (!py) return Promise.reject(new Error("Python dengan PyMuPDF dan Pillow tidak ditemukan di laptop ini."));
  const skrip = path.join(process.cwd(), "scripts", "tampak-pindai.py");
  return new Promise((resolve, reject) => {
    const ps = spawn(py.perintah, [...py.awalan, skrip, "--in", masuk, "--out", keluar]);
    let galat = "";
    ps.stderr.on("data", (d) => (galat += d.toString()));
    ps.on("close", (kode) =>
      kode === 0 && fs.existsSync(keluar)
        ? resolve()
        : reject(new Error("Efek pindaian gagal. " + galat)));
  });
}
