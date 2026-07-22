/**
 * Backup penuh database Supabase -> folder di laptop. Tak perlu buka aplikasi.
 *
 *   node scripts/backup-supabase.cjs [folderTujuan]
 *   npm run backup
 *
 * Default folder: %USERPROFILE%\Documents\Backup-MRT
 * Hasil:
 *   <folder>/TERBARU.json              salinan terakhir seluruh tabel projects
 *   <folder>/snapshot/projects_<cap>.json   arsip bertanggal (retensi 60 file terbaru)
 *   <folder>/data/<jenis>/<judul>__<id>.json  1 file per data (mudah dicari manual)
 *   <folder>/berkas/...                unduhan file dari Storage bucket "foto" (foto & inventaris)
 */
const fs = require("fs");
const path = require("path");

const RETENSI = 60;

function envLokal() {
  const f = path.join(__dirname, "..", ".env.local");
  const out = {};
  if (fs.existsSync(f)) {
    for (const b of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      if (!b || b.startsWith("#") || !b.includes("=")) continue;
      const i = b.indexOf("=");
      out[b.slice(0, i).trim()] = b.slice(i + 1).trim();
    }
  }
  return { ...out, ...process.env };
}

const cap = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
const aman = (s) => String(s || "tanpa-nama").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);

async function ambilSemua(url, key) {
  const per = 1000;
  let dari = 0;
  const semua = [];
  for (;;) {
    const r = await fetch(`${url}/rest/v1/projects?select=*&order=created_at.desc`, {
      headers: { apikey: key, Authorization: "Bearer " + key, Range: `${dari}-${dari + per - 1}` },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
    const batch = await r.json();
    semua.push(...batch);
    if (batch.length < per) break;
    dari += per;
  }
  return semua;
}

// unduh isi bucket Storage (best effort — kalau gagal, backup data tetap jalan)
async function unduhBerkas(url, key, tujuan, bucket = "foto") {
  let n = 0, lewat = 0;
  async function telusur(prefix) {
    const r = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, sortBy: { column: "name", order: "asc" } }),
    });
    if (!r.ok) throw new Error(`list ${r.status}`);
    for (const it of await r.json()) {
      const jalur = prefix ? `${prefix}/${it.name}` : it.name;
      if (!it.id) { await telusur(jalur); continue; } // folder
      const tuj = path.join(tujuan, jalur.replace(/\//g, path.sep));
      if (fs.existsSync(tuj)) { lewat++; continue; }   // sudah ada -> tak diunduh ulang
      const f = await fetch(`${url}/storage/v1/object/public/${bucket}/${encodeURI(jalur)}`);
      if (!f.ok) continue;
      fs.mkdirSync(path.dirname(tuj), { recursive: true });
      fs.writeFileSync(tuj, Buffer.from(await f.arrayBuffer()));
      n++;
    }
  }
  await telusur("");
  return { baru: n, lewat };
}

(async () => {
  const env = envLokal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) { console.error("❌ NEXT_PUBLIC_SUPABASE_URL / ANON_KEY tidak ditemukan di .env.local"); process.exit(1); }

  const tujuan = process.argv[2] || path.join(process.env.USERPROFILE || process.env.HOME || ".", "Documents", "Backup-MRT");
  fs.mkdirSync(path.join(tujuan, "snapshot"), { recursive: true });

  console.log("Mengambil data dari Supabase…");
  const rows = await ambilSemua(url, key);
  const isi = JSON.stringify({ diambil: new Date().toISOString(), jumlah: rows.length, rows }, null, 2);

  const namaSnap = `projects_${cap()}.json`;
  fs.writeFileSync(path.join(tujuan, "snapshot", namaSnap), isi);
  fs.writeFileSync(path.join(tujuan, "TERBARU.json"), isi);

  // 1 file per data
  for (const r of rows) {
    const kind = (r.payload && r.payload.kind) || "swakelola";
    const dir = path.join(tujuan, "data", kind);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${aman(r.nama_kapal || kind)}__${String(r.id).slice(0, 8)}.json`),
      JSON.stringify({ kind, id: r.id, judul: r.nama_kapal, disimpan: r.created_at, payload: r.payload }, null, 2));
  }

  // retensi snapshot
  const snaps = fs.readdirSync(path.join(tujuan, "snapshot")).filter((f) => f.endsWith(".json")).sort();
  for (const f of snaps.slice(0, Math.max(0, snaps.length - RETENSI))) fs.unlinkSync(path.join(tujuan, "snapshot", f));

  let infoBerkas = "";
  let baru = 0, lewat = 0, gagal = 0;
  // (a) lewat listing bucket — jalan kalau kebijakan Storage mengizinkan
  try { const b = await unduhBerkas(url, key, path.join(tujuan, "berkas")); baru += b.baru; lewat += b.lewat; } catch { /* biasanya diblokir RLS, pakai cara (b) */ }
  // (b) dari URL publik yang tertanam di data (foto dokumentasi, file inventaris kapal)
  const urls = Array.from(new Set(isi.match(/https?:\/\/[^"\\\s]+\/storage\/v1\/object\/public\/[^"\\\s]+/g) || []));
  for (const u of urls) {
    try {
      const rel = decodeURIComponent(u.split("/object/public/")[1] || "").split("?")[0];
      if (!rel) continue;
      const tuj = path.join(tujuan, "berkas", rel.replace(/\//g, path.sep));
      if (fs.existsSync(tuj)) { lewat++; continue; }
      const f = await fetch(u);
      if (!f.ok) { gagal++; continue; }
      fs.mkdirSync(path.dirname(tuj), { recursive: true });
      fs.writeFileSync(tuj, Buffer.from(await f.arrayBuffer()));
      baru++;
    } catch { gagal++; }
  }
  infoBerkas = ` · berkas: ${baru} baru, ${lewat} sudah ada${gagal ? `, ${gagal} gagal` : ""}`;

  fs.writeFileSync(path.join(tujuan, "BACA-SAYA.txt"), [
    "BACKUP MANAJEMEN REPORT TEKNIK ASDP TERNATE",
    "",
    "TERBARU.json    : salinan seluruh database saat backup terakhir",
    "snapshot/       : arsip bertanggal (disimpan " + RETENSI + " terbaru)",
    "data/<jenis>/   : 1 file per data",
    "berkas/         : file dari Storage (foto dokumentasi, inventaris kapal)",
    "",
    "Pulihkan: node scripts/restore-supabase.cjs \"<file snapshot>\"  (tambah --tulis untuk benar-benar menulis)",
    `Backup terakhir: ${new Date().toLocaleString("id-ID")} — ${rows.length} data`,
  ].join("\n"));

  console.log(`✅ ${rows.length} data -> ${tujuan}${infoBerkas}`);
})().catch((e) => { console.error("❌ Gagal:", e.message); process.exit(1); });
