/**
 * Bundel seluruh kodingan aplikasi menjadi 1 ZIP saat build (prebuild).
 *
 * Hasil: public/backup/source.zip + source-manifest.json. Karena berada di
 * public/, file bisa diambil aplikasi yang sedang berjalan — dan tetap DI
 * BELAKANG gerbang login (middleware hanya mengecualikan /login, /api/auth,
 * aset _next, favicon, logo — /backup/* tidak dikecualikan).
 *
 * Dipakai halaman Backup Data: tombol "Backup Kodingan" menyalin ZIP ini ke
 * folder backup di laptop, sehingga backup pengguna berisi DATA sekaligus
 * SELURUH KODE untuk membangun ulang aplikasinya.
 */
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");

const AKAR = path.join(__dirname, "..");
const TUJUAN = path.join(AKAR, "public", "backup");

// yang ikut dibundel: seluruh kode + konfigurasi + dokumen — CUKUP untuk
// npm install && npm run build dari nol.
const FOLDER = ["src", "docs", "scripts"];
const BERKAS_AKAR = [
  "package.json", "package-lock.json", "tsconfig.json",
  "next.config.mjs", "next.config.js", "tailwind.config.ts", "tailwind.config.js",
  "postcss.config.mjs", "postcss.config.js", ".gitignore", "README.md",
];
// jangan pernah ikut: rahasia & artefak
const TOLAK = /(^|[\\/])(node_modules|\.next|\.git|Penyusunan RKA|output|public[\\/]backup)([\\/]|$)|\.env/;

function kumpul(dir, dasar, keluar) {
  for (const nama of fs.readdirSync(dir)) {
    const p = path.join(dir, nama);
    const rel = path.relative(dasar, p).replace(/\\/g, "/");
    if (TOLAK.test(p)) continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) kumpul(p, dasar, keluar);
    else keluar.push({ rel, p, bytes: st.size });
  }
}

function main() {
  const daftar = [];
  for (const f of FOLDER) {
    const p = path.join(AKAR, f);
    if (fs.existsSync(p)) kumpul(p, AKAR, daftar);
  }
  for (const f of BERKAS_AKAR) {
    const p = path.join(AKAR, f);
    if (fs.existsSync(p)) daftar.push({ rel: f, p, bytes: fs.statSync(p).size });
  }

  const zip = new PizZip();
  let totalBytes = 0;
  for (const { rel, p, bytes } of daftar) {
    zip.file(rel, fs.readFileSync(p));
    totalBytes += bytes;
  }

  // jejak git bila ada (Vercel menyertakan VERCEL_GIT_COMMIT_SHA)
  let commit = process.env.VERCEL_GIT_COMMIT_SHA || "";
  if (!commit) {
    try { commit = require("child_process").execSync("git rev-parse HEAD", { cwd: AKAR }).toString().trim(); } catch {}
  }

  const manifest = {
    aplikasi: "Manajemen Report Teknik ASDP Ternate",
    dibuat: new Date().toISOString(),
    commit: commit || "(di luar git)",
    jumlahBerkas: daftar.length,
    ukuranSumber: totalBytes,
    isi: FOLDER.concat(BERKAS_AKAR.filter((f) => fs.existsSync(path.join(AKAR, f)))),
    caraBangunUlang: [
      "1. Ekstrak source.zip ke folder kosong",
      "2. npm install",
      "3. Salin .env.local (Supabase URL+anon key, AUTH_TOKEN, APP_USERS) — TIDAK ikut di ZIP, sengaja",
      "4. npm run dev  (atau npm run build && npm start)",
      "Arsitektur, logika & keamanan dijelaskan di docs/ARSITEKTUR.md di dalam ZIP ini.",
    ],
  };
  zip.file("MANIFEST.json", JSON.stringify(manifest, null, 2));

  const isiZip = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
  fs.mkdirSync(TUJUAN, { recursive: true });
  fs.writeFileSync(path.join(TUJUAN, "source.zip"), isiZip);
  fs.writeFileSync(path.join(TUJUAN, "source-manifest.json"),
    JSON.stringify({ ...manifest, ukuranZip: isiZip.length }, null, 2));
  console.log(`[bundle-source] ${daftar.length} berkas · ${(totalBytes / 1048576).toFixed(1)} MB -> source.zip ${(isiZip.length / 1048576).toFixed(1)} MB (commit ${String(commit).slice(0, 7)})`);
}

main();
