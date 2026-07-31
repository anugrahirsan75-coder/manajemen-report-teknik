/**
 * Salin worker pdf.js ke /public.
 *
 * Halaman memuatnya dari /pdf.worker.min.mjs — sengaja dari berkas sendiri,
 * bukan CDN luar, karena yang diurai adalah dokumen kapal: tak boleh ada
 * permintaan ke internet saat berkasnya dibuka.
 */
const fs = require("fs");
const path = require("path");

const asal = path.join(__dirname, "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const tujuan = path.join(__dirname, "..", "public", "pdf.worker.min.mjs");

if (!fs.existsSync(asal)) {
  console.warn("pdf.worker.min.mjs tak ditemukan — lewati (jalankan npm install dulu)");
  process.exit(0);
}
fs.copyFileSync(asal, tujuan);
console.log(`pdf worker disalin: ${(fs.statSync(tujuan).size / 1024).toFixed(0)} KB -> public/pdf.worker.min.mjs`);
