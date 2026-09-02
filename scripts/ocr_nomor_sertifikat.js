/**
 * OCR halaman sertifikat hasil pindai — dijalankan sekali, bukan bagian aplikasi.
 *
 * tesseract.js sudah ada di node_modules (dipakai layar SPPBJ), jadi tidak ada
 * pemasangan baru dan tidak ada berkas yang dikirim keluar: seluruh pengenalan
 * teks terjadi di mesin ini. Empat pekerja berjalan bersamaan karena satu
 * halaman memakan sekitar sebelas detik dan berkasnya ratusan.
 */
const fs = require("fs");
const path = require("path");
const { createWorker } = require("tesseract.js");

const KERJA = process.argv[2];
const PEKERJA = Number(process.argv[3] || 4);

async function main() {
  const siapan = JSON.parse(fs.readFileSync(path.join(KERJA, "siapan.json"), "utf8"));
  const tugas = siapan.ocr;
  const keluaran = path.join(KERJA, "hasil-ocr.jsonl");
  // lanjutkan dari yang sudah terbaca bila proses sebelumnya terputus
  const sudah = new Set();
  if (fs.existsSync(keluaran)) {
    for (const baris of fs.readFileSync(keluaran, "utf8").split("\n")) {
      if (!baris.trim()) continue;
      try { sudah.add(JSON.parse(baris).rel); } catch { /* baris rusak, ulangi */ }
    }
  }
  const sisa = tugas.filter((t) => !sudah.has(t.rel));
  console.log(`tugas=${tugas.length} sudah=${sudah.size} sisa=${sisa.length}`);

  const aliran = fs.createWriteStream(keluaran, { flags: "a" });
  let indeks = 0;
  let selesai = 0;

  async function jalan(nomorPekerja) {
    const worker = await createWorker("ind");
    while (true) {
      const i = indeks++;
      if (i >= sisa.length) break;
      const t = sisa[i];
      let teks = "";
      for (const gambar of t.gambar) {
        try {
          const { data } = await worker.recognize(gambar);
          teks += "\n" + data.text;
        } catch (e) {
          teks += `\n[GAGAL OCR: ${e.message}]`;
        }
        // halaman kedua hanya dibaca bila halaman pertama tidak memuat "no"
        if (/\bno\b|nomor|number/i.test(teks)) break;
      }
      aliran.write(JSON.stringify({ rel: t.rel, teks }) + "\n");
      selesai++;
      if (selesai % 10 === 0) console.log(`  ${selesai}/${sisa.length}`);
    }
    await worker.terminate();
  }

  await Promise.all(Array.from({ length: PEKERJA }, (_, n) => jalan(n)));
  aliran.end();
  console.log("selesai:", selesai);
}

main().catch((e) => { console.error(e); process.exit(1); });
