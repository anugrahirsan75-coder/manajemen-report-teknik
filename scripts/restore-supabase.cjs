/**
 * Pulihkan data dari file backup ke Supabase.
 *
 *   node scripts/restore-supabase.cjs "<file .json>"            -> UJI COBA (tak menulis apa pun)
 *   node scripts/restore-supabase.cjs "<file .json>" --tulis    -> benar-benar menulis
 *   ... --hanya=sppbj        batasi ke satu jenis data
 *
 * Menulis pakai upsert berdasarkan id: data yang sudah ada ditimpa versi backup,
 * data yang hilang dibuat lagi. Data yang ADA di server tapi TIDAK ada di backup
 * TIDAK dihapus (aman — pemulihan tak pernah menghapus).
 */
const fs = require("fs");
const path = require("path");

function envLokal() {
  const f = path.join(__dirname, "..", ".env.local");
  const out = {};
  if (fs.existsSync(f)) for (const b of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    if (!b || b.startsWith("#") || !b.includes("=")) continue;
    const i = b.indexOf("="); out[b.slice(0, i).trim()] = b.slice(i + 1).trim();
  }
  return { ...out, ...process.env };
}

(async () => {
  const berkas = process.argv[2];
  const tulis = process.argv.includes("--tulis");
  const hanya = (process.argv.find((a) => a.startsWith("--hanya=")) || "").split("=")[1];
  if (!berkas || !fs.existsSync(berkas)) { console.error("Pakai: node scripts/restore-supabase.cjs \"<file backup .json>\" [--tulis] [--hanya=sppbj]"); process.exit(1); }

  const env = envLokal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) { console.error("❌ Kredensial Supabase tak ditemukan di .env.local"); process.exit(1); }

  const isi = JSON.parse(fs.readFileSync(berkas, "utf8"));
  let rows = Array.isArray(isi) ? isi : isi.rows || (isi.payload ? [isi] : []);
  if (hanya) rows = rows.filter((r) => ((r.payload && r.payload.kind) || "swakelola") === hanya);
  if (!rows.length) { console.error("Tidak ada data di file itu."); process.exit(1); }

  const perJenis = rows.reduce((a, r) => { const k = (r.payload && r.payload.kind) || "swakelola"; a[k] = (a[k] || 0) + 1; return a; }, {});
  console.log(`File   : ${berkas}`);
  console.log(`Diambil: ${isi.diambil || "-"}`);
  console.log(`Data   : ${rows.length} —`, perJenis);

  if (!tulis) { console.log("\nUJI COBA. Tidak ada yang ditulis. Tambahkan --tulis untuk memulihkan sungguhan."); return; }

  const paket = rows.map((r) => ({ id: r.id, nama_kapal: r.nama_kapal, tahun: r.tahun ?? null, payload: r.payload }));
  let ok = 0;
  for (let i = 0; i < paket.length; i += 100) {
    const bagian = paket.slice(i, i + 100);
    const res = await fetch(`${url}/rest/v1/projects?on_conflict=id`, {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(bagian),
    });
    if (!res.ok) { console.error(`❌ Gagal pada bagian ${i}: HTTP ${res.status} ${await res.text()}`); process.exit(1); }
    ok += bagian.length;
    console.log(`  …${ok}/${paket.length}`);
  }
  console.log(`✅ ${ok} data dipulihkan ke Supabase.`);
})().catch((e) => { console.error("❌ Gagal:", e.message); process.exit(1); });
