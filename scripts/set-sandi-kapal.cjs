/**
 * Setel sandi seluruh akun Portal Kapal menjadi pola yang mudah diingat:
 * <nama akun>123 — "lompadeck123", "lompamesin123", dan seterusnya.
 *
 * Diminta kantor supaya awak kapal tidak perlu menghafal sandi acak dan tidak
 * menelepon kantor tiap kali lupa. Ongkosnya jelas dan sengaja diterima: sandi
 * ini bisa ditebak siapa pun yang tahu nama kapalnya, sedangkan portalnya
 * terbuka di internet. Yang bisa dilihat penebak terbatas pada satu kapal —
 * kirimannya sendiri, stok filter, alkes — dan tiap akun tetap terkurung pada
 * kapalnya oleh cookie bertanda tangan.
 *
 * Sandinya tetap disimpan sebagai sidik PBKDF2, bukan teks: pola yang mudah
 * ditebak bukan alasan untuk menyimpannya apa adanya, karena banyak orang
 * memakai ulang sandi yang sama di tempat lain.
 *
 *   node scripts/set-sandi-kapal.cjs           → hanya menampilkan rencananya
 *   node scripts/set-sandi-kapal.cjs --tulis   → benar-benar menyetelnya
 */
const fs = require("fs");
const path = require("path");
const { webcrypto } = require("crypto");

const AKAR = path.resolve(__dirname, "..");
const TULIS = process.argv.includes("--tulis");

const env = {};
fs.readFileSync(path.join(AKAR, ".env.local"), "utf8").split(/\r?\n/).forEach((b) => {
  const m = /^([A-Z_0-9]+)=(.*)$/.exec(b.trim());
  if (m) env[m[1]] = m[2];
});
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KUNCI = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_SB || !KUNCI) { console.error("env Supabase tidak lengkap"); process.exit(1); }

const PUTARAN = 210_000;
const enc = new TextEncoder();
const hex = (b) => Array.from(b instanceof Uint8Array ? b : new Uint8Array(b))
  .map((x) => x.toString(16).padStart(2, "0")).join("");

async function buatSandi(sandi) {
  const garam = hex(webcrypto.getRandomValues(new Uint8Array(16)));
  const kunci = await webcrypto.subtle.importKey("raw", enc.encode(sandi), "PBKDF2", false, ["deriveBits"]);
  const bit = await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(garam), iterations: PUTARAN, hash: "SHA-256" }, kunci, 256);
  return { garam, sidik: hex(bit), putaran: PUTARAN };
}

const kepala = { apikey: KUNCI, Authorization: `Bearer ${KUNCI}`, "Content-Type": "application/json" };

(async () => {
  const r = await fetch(`${URL_SB}/rest/v1/projects?select=id,payload&payload->>kind=eq.akun_kapal&limit=200`, { headers: kepala });
  if (!r.ok) throw new Error(`baca akun gagal: ${r.status}`);
  const akun = await r.json();
  if (!akun.length) { console.error("Belum ada akun kapal. Jalankan scripts/buat-akun-kapal.cjs dulu."); process.exit(1); }

  akun.sort((a, b) => String(a.payload.kapal).localeCompare(String(b.payload.kapal), "id")
    || String(a.payload.bagian).localeCompare(String(b.payload.bagian)));

  const kini = new Date().toISOString();
  let kapalSebelum = "";
  for (const a of akun) {
    const p = a.payload || {};
    const sandi = `${p.nama}123`;
    if (TULIS) {
      const res = await fetch(`${URL_SB}/rest/v1/projects?id=eq.${a.id}`, {
        method: "PATCH", headers: { ...kepala, Prefer: "return=minimal" },
        body: JSON.stringify({ payload: { ...p, sandi: await buatSandi(sandi), sandiDiubahPada: kini } }),
      });
      if (!res.ok) throw new Error(`setel ${p.nama} gagal: ${res.status} ${(await res.text()).slice(0, 160)}`);
    }
    if (p.kapal !== kapalSebelum) { console.log(`\n${p.kapal}`); kapalSebelum = p.kapal; }
    console.log(`  ${String(p.bagian).toUpperCase().padEnd(6)} ${String(p.nama).padEnd(22)} ${sandi}`);
  }

  console.log(`\n${akun.length} akun ${TULIS ? "SUDAH disetel" : "akan disetel (jalankan ulang dengan --tulis)"}.`);
})().catch((e) => { console.error("GAGAL:", e.message); process.exit(1); });
