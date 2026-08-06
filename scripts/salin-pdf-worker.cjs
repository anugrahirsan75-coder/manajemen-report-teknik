/**
 * Salin pustaka pdf.js ke /public.
 *
 * Dua berkas disalin: pustakanya (pdf.min.mjs) dan worker-nya
 * (pdf.worker.min.mjs). Keduanya dimuat halaman dari berkas sendiri, bukan CDN
 * luar, karena yang diurai adalah dokumen kapal: tak boleh ada permintaan ke
 * internet saat berkasnya dibuka.
 *
 * Pustakanya ikut disalin karena pdf.js dimuat sebagai modul ES asli oleh
 * peramban (lihat lib/pdfPeramban.ts) — dibundel webpack, berkas .mjs ini gagal
 * dimuat dengan "Object.defineProperty called on non-object".
 */
const fs = require("fs");
const path = require("path");

const akar = path.join(__dirname, "..");
const berkas = ["pdf.min.mjs", "pdf.worker.min.mjs"];

for (const nama of berkas) {
  const asal = path.join(akar, "node_modules", "pdfjs-dist", "build", nama);
  const tujuan = path.join(akar, "public", nama);
  if (!fs.existsSync(asal)) {
    console.warn(`${nama} tak ditemukan — lewati (jalankan npm install dulu)`);
    continue;
  }
  fs.copyFileSync(asal, tujuan);
  console.log(`disalin: ${(fs.statSync(tujuan).size / 1024).toFixed(0)} KB -> public/${nama}`);
}
