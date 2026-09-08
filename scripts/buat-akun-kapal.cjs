/**
 * Buatkan 26 akun Portal Kapal sekaligus — 13 kapal x (Deck, Mesin).
 *
 * Sama persis dengan yang dikerjakan tombol di halaman /akun-kapal, hanya saja
 * dijalankan dari baris perintah supaya seluruh sandinya bisa dicetak sekali
 * dalam satu daftar rapi yang tinggal disalin ke WhatsApp tiap kapal.
 *
 * Akun yang SUDAH ada tidak disentuh: skrip ini boleh dijalankan berulang, dan
 * kapal yang sudah memakai portalnya tidak akan kehilangan sandinya karena
 * seseorang menjalankan perintah ini dua kali.
 *
 * Sandi hanya tercetak DI SINI, sekali. Yang tersimpan di basis data cuma
 * sidik PBKDF2-nya — sesudah jendela ini ditutup, tidak ada seorang pun,
 * termasuk kantor, yang bisa membacanya lagi.
 *
 *   node scripts/buat-akun-kapal.cjs
 */
const fs = require("fs");
const path = require("path");
const { webcrypto } = require("crypto");

const AKAR = path.resolve(__dirname, "..");

// ── env ─────────────────────────────────────────────────────────────────────
const env = {};
fs.readFileSync(path.join(AKAR, ".env.local"), "utf8").split(/\r?\n/).forEach((b) => {
  const m = /^([A-Z_0-9]+)=(.*)$/.exec(b.trim());
  if (m) env[m[1]] = m[2];
});
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KUNCI = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_SB || !KUNCI) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / kunci Supabase tidak ada di .env.local");
  process.exit(1);
}

// ── daftar kapal: dibaca dari sumber yang dipakai aplikasi, bukan disalin ───
const sumberKapal = fs.readFileSync(path.join(AKAR, "src/lib/anggaran/types.ts"), "utf8");
const blok = /export const KAPAL_ANGGARAN = \[([\s\S]*?)\];/.exec(sumberKapal);
if (!blok) { console.error("KAPAL_ANGGARAN tidak terbaca dari src/lib/anggaran/types.ts"); process.exit(1); }
const KAPAL = Array.from(blok[1].matchAll(/"([^"]+)"/g)).map((m) => m[1]);

const BAGIAN = ["deck", "mesin"];
const namaAkun = (kapal, bagian) =>
  `${kapal.replace(/^KMP\.?\s*/i, "").replace(/[^A-Za-z0-9]/g, "").toLowerCase()}${bagian}`;

// ── sandi: sama persis dengan src/lib/portal/sandi.ts ──────────────────────
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

/** huruf yang tidak tertukar saat didikte lewat telepon: tanpa 0/O dan 1/I/l */
function sandiAwal(panjang = 10) {
  const huruf = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(webcrypto.getRandomValues(new Uint8Array(panjang)))
    .map((n) => huruf[n % huruf.length]).join("");
}

// ── Supabase REST ──────────────────────────────────────────────────────────
const kepala = { apikey: KUNCI, Authorization: `Bearer ${KUNCI}`, "Content-Type": "application/json" };

async function adaAkun() {
  const r = await fetch(`${URL_SB}/rest/v1/projects?select=payload&payload->>kind=eq.akun_kapal&limit=200`, { headers: kepala });
  if (!r.ok) throw new Error(`baca akun gagal: ${r.status} ${(await r.text()).slice(0, 160)}`);
  return new Set((await r.json()).map((x) => (x.payload || {}).nama));
}

async function simpanAkun(baris) {
  const r = await fetch(`${URL_SB}/rest/v1/projects`, {
    method: "POST", headers: { ...kepala, Prefer: "return=minimal" }, body: JSON.stringify(baris),
  });
  if (!r.ok) throw new Error(`simpan akun gagal: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

(async () => {
  const sudah = await adaAkun();
  const kini = new Date().toISOString();
  const tahun = new Date().getFullYear();

  const baris = [];
  const cetak = [];
  for (const kapal of KAPAL) {
    for (const bagian of BAGIAN) {
      const nama = namaAkun(kapal, bagian);
      if (sudah.has(nama)) { cetak.push({ kapal, bagian, nama, sandi: "(sudah ada — tidak diubah)" }); continue; }
      const sandi = sandiAwal();
      baris.push({
        nama_kapal: kapal, tahun,
        payload: {
          kind: "akun_kapal", kapal, bagian, nama,
          sandi: await buatSandi(sandi),
          aktif: true, dibuatPada: kini, sandiDiubahPada: kini, terakhirMasuk: "", catatan: "",
        },
      });
      cetak.push({ kapal, bagian, nama, sandi });
    }
  }

  if (baris.length) await simpanAkun(baris);

  console.log(`\n${baris.length} akun baru dibuat, ${cetak.length - baris.length} sudah ada sebelumnya.\n`);
  console.log("=".repeat(74));
  console.log("AKUN PORTAL KAPAL — PT ASDP CABANG TERNATE");
  console.log("Alamat portal: https://manajemen-report-teknik.vercel.app/portal");
  console.log("=".repeat(74));
  let kapalSebelum = "";
  cetak.forEach((c) => {
    if (c.kapal !== kapalSebelum) { console.log(`\n${c.kapal}`); kapalSebelum = c.kapal; }
    console.log(`  ${c.bagian.toUpperCase().padEnd(6)} ${c.nama.padEnd(22)} ${c.sandi}`);
  });
  console.log("\n" + "=".repeat(74));
  console.log("Sandi di atas TIDAK tersimpan di mana pun selain di layar ini.");
  console.log("Bagikan ke tiap kapal sekarang; yang lupa harus diatur ulang dari /akun-kapal.");
})().catch((e) => { console.error("GAGAL:", e.message); process.exit(1); });
