/*
 * Isi awal nomor sertifikat, dari hasil pembacaan berkas arsip.
 *
 * Nomor ini dibaca sekali dari PDF sertifikat (lapisan teks bila ada, selebihnya
 * OCR halaman pindaian). Hasilnya dituang ke basis data supaya borang FLEET
 * CERTIFICATE terbit dengan kolom nomor yang sudah terisi, dan kantor tinggal
 * melengkapi sisanya lewat panel di halaman Sertifikat.
 *
 * Jalankan sekali:  node scripts/seed-nomor-sertifikat.cjs <nomor.json>
 *
 * Bentuk <nomor.json>: { "nomor": { "01_KMP-X\\FDOC-007_....pdf": "AL.501/..." } }
 * — kunci berkasnya memuat kode FDOC, dan nama kapal diambil dari nama foldernya.
 */
const fs = require('fs');
const path = require('path');

const berkas = process.argv[2];
if (!berkas) {
  console.error('pakai: node scripts/seed-nomor-sertifikat.cjs <nomor.json>');
  process.exit(1);
}

// .env.local dibaca sendiri: skrip ini jalan di luar Next
const env = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(env)) {
  fs.readFileSync(env, 'utf8').split(/\r?\n/).forEach((baris) => {
    const m = baris.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const { createClient } = require('@supabase/supabase-js');
const { BORANG } = require('./_borang-sertifikat.cjs');

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KUNCI = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_SB || !KUNCI) { console.error('Kredensial Supabase belum ada di .env.local'); process.exit(1); }

const KIND = 'sertifikat_nomor';

/** "01_KMP-PORTLINK-VIII" -> "KMP. PORTLINK VIII" */
const kapalDariFolder = (f) =>
  f.replace(/^\d+_/, '').replace(/-/g, ' ').replace(/^KMP\s*/i, 'KMP. ').trim();

(async () => {
  const isi = JSON.parse(fs.readFileSync(berkas, 'utf8')).nomor || {};
  const perKapal = new Map();

  for (const [rel, nomor] of Object.entries(isi)) {
    const [folder, namaBerkas] = rel.split(/[\\/]/);
    const kode = (namaBerkas || '').split('_')[0].replace('-', '/');   // FDOC-007 -> FDOC/007
    const baris = BORANG.find((b) => b.kode === kode && b.padanan);
    if (!baris) continue;
    const kapal = kapalDariFolder(folder);
    if (!perKapal.has(kapal)) perKapal.set(kapal, {});
    perKapal.get(kapal)[`${baris.kode}|${baris.padanan}`] = nomor;

    // Izin stasiun radio mengisi dua baris borang: SIKR dan MMSI Certificate.
    // Nomornya sama karena dokumennya memang satu.
    if (baris.kode === 'FDOC/008') {
      const mmsi = BORANG.find((b) => b.kode === 'FDOC/019');
      if (mmsi && mmsi.padanan) perKapal.get(kapal)[`${mmsi.kode}|${mmsi.padanan}`] = nomor;
    }
  }

  const c = createClient(URL_SB, KUNCI, { auth: { persistSession: false } });
  let tulis = 0;

  for (const [kapal, peta] of perKapal) {
    const { data } = await c.from('projects')
      .select('id,payload').filter('payload->>kind', 'eq', KIND).eq('nama_kapal', kapal).limit(1);

    const lama = data?.[0]?.payload || {};
    // nomor yang sudah diketik kantor TIDAK ditimpa hasil bacaan mesin
    const gabung = { ...peta, ...(lama.nomor || {}) };
    const payload = { ...lama, kind: KIND, kapal, nomor: gabung, diisiMesinPada: new Date().toISOString() };

    const r = data?.[0]?.id
      ? await c.from('projects').update({ payload }).eq('id', data[0].id)
      : await c.from('projects').insert({ nama_kapal: kapal, tahun: new Date().getFullYear(), payload });

    if (r.error) { console.error(kapal, '->', r.error.message); continue; }
    tulis++;
    console.log(`${kapal}: ${Object.keys(gabung).length} nomor`);
  }

  console.log(`\nselesai · ${tulis} kapal tersimpan`);
})().catch((e) => { console.error(e); process.exit(1); });
