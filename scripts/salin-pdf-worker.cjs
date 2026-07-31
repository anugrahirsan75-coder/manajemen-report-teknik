// Salin worker pdf.js ke /public supaya PDF bisa dibuka di peramban tanpa CDN
// luar — berkas kapal tidak boleh menyentuh internet. Dijalankan oleh postinstall.
const fs = require("fs");
const path = require("path");
const asal = path.join(__dirname, "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const tuju = path.join(__dirname, "..", "public", "pdf.worker.min.mjs");
if (!fs.existsSync(asal)) { console.warn("pdf.worker.min.mjs tak ditemukan — lewati"); process.exit(0); }
fs.copyFileSync(asal, tuju);
console.log("pdf worker disalin ke public/", (fs.statSync(tuju).size / 1024).toFixed(0) + " KB");
