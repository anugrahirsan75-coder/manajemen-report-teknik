/**
 * TEMPLATE 23 — Permohonan Persetujuan Pelaksanaan Sea Trial dan Compasseren (KSOP).
 *
 * Diajukan sesudah pekerjaan docking selesai, sebelum kapal diuji berlayar.
 * Bentuknya mengikuti surat KMP. Pulau Sagori 2026: dua butir bernomor, lalu
 * tabel data kapal tanpa garis.
 *
 * KSOP yang dituju adalah KSOP tempat GALANGANNYA berada, bukan KSOP cabang
 * pemilik kapal — kapal Ternate yang docking di Sorong mengajukan ke KSOP
 * Sorong, karena yang menyetujui olah gerak adalah syahbandar perairan tempat
 * uji coba itu dilakukan.
 */
import { TemplateSurat } from "../types";
import { GALANGAN, KAPAL_SURAT, namaKapalSurat, tanggalSurat } from "../format";
import { ButirSurat, b, bungkus, esc, suratBernomor, tabelData } from "../htmlHelpers";

/** Hari dalam seminggu dari tanggal ISO, untuk kalimat "pada hari Senin tanggal ...". */
const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function hariDari(iso: string): string {
  const s = String(iso || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  /*
   * Tanggalnya dibaca sebagai waktu UTC, bukan waktu setempat.
   *
   * new Date("2026-10-05") memang menghasilkan tengah malam UTC, tetapi
   * getDay() membacanya kembali menurut zona waktu mesin. Di zona di sebelah
   * barat Greenwich itu masih tanggal 4, dan surat akan menyebut hari yang
   * salah tanpa ada yang menyadarinya - nomor tanggalnya tetap benar.
   */
  const d = new Date(s + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? "" : NAMA_HARI[d.getUTCDay()];
}

export const seaTrialCompasseren: TemplateSurat = {
  id: "sea-trial-compasseren",
  nama: "Permohonan Sea Trial & Compasseren (KSOP)",
  perihal: "Permohonan Persetujuan Pelaksanaan Sea Trial dan Compasseren {kapal} Tahun {tahun}",
  tujuan: "Kepala KSOP",
  deskripsi: "Permohonan olah gerak sea trial dan compasseren sesudah docking selesai, dengan tabel data kapal.",
  ikon: "🧭",
  isian: [
    { id: "kapal", label: "Nama kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun docking", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    { id: "galangan", label: "Galangan", jenis: "pilih", pilihan: GALANGAN, bebas: true, wajib: true },
    { id: "ksop", label: "KSOP yang dituju", jenis: "teks", wajib: true, contoh: "Kepala KSOP Kelas I Sorong", kolomBorang: 2 },
    { id: "kotaKsop", label: "Kota KSOP", jenis: "teks", wajib: true, contoh: "SORONG", kolomBorang: 2 },
    { id: "tanggal", label: "Tanggal pelaksanaan", jenis: "tanggal", wajib: true, kolomBorang: 2 },
    { id: "lokasi", label: "Lokasi sea trial", jenis: "teks", wajib: true, contoh: "Perairan sekitar Galangan Klasaman Indah Raya", kolomBorang: 2 },
    { id: "callSign", label: "Call sign", jenis: "teks", contoh: "YBPJ2", kolomBorang: 2 },
    { id: "imo", label: "No. IMO", jenis: "teks", contoh: "9816983", kolomBorang: 2 },
    { id: "bendera", label: "Bendera", jenis: "teks", awal: "Indonesia", kolomBorang: 2 },
    { id: "tipe", label: "Tipe kapal", jenis: "teks", awal: "Ferry Ro-Ro", kolomBorang: 2 },
    { id: "grt", label: "GRT", jenis: "teks", wajib: true, contoh: "589", kolomBorang: 2 },
    { id: "nakhoda", label: "Nakhoda", jenis: "teks", wajib: true, contoh: "Yondi U Sakti", kolomBorang: 2 },
    { id: "perusahaan", label: "Perusahaan", jenis: "teks", awal: "PT. ASDP Indonesia Ferry (Persero)" },
  ],

  periksa(d) {
    const pesan: string[] = [];
    /*
     * Sea trial tidak boleh dimohonkan untuk tanggal yang sudah lewat.
     *
     * Suratnya meminta PERSETUJUAN olah gerak; tanggal yang sudah berlalu
     * berarti kapalnya berlayar lebih dulu baru izinnya diurus. Ini kekeliruan
     * yang tidak kelihatan dari surat jadinya, karena tanggalnya tetap tercetak
     * rapi lengkap dengan nama harinya.
     */
    const tgl = String(d.tanggal || "").trim();
    if (tgl) {
      const hariIni = new Date().toISOString().slice(0, 10);
      if (tgl < hariIni) pesan.push(`Tanggal pelaksanaan (${tgl}) sudah lewat — periksa lagi tanggalnya.`);
    }
    const grt = String(d.grt || "").replace(/[^\d]/g, "");
    if (grt && Number(grt) > 0 && Number(grt) < 50) {
      pesan.push("GRT terbaca di bawah 50 — pastikan yang diisi tonase kotor, bukan tonase bersih.");
    }
    return pesan;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const tahun = esc(d.tahun || "");
    const galangan = esc(d.galangan || "");
    const hari = hariDari(String(d.tanggal || ""));
    const tgl = tanggalSurat(String(d.tanggal || ""));
    const kapan = [hari ? `hari ${hari}` : "", tgl ? `tanggal ${tgl}` : ""].filter(Boolean).join(" ");

    const butir: ButirSurat[] = [
      {
        teks: `Sehubungan dengan telah selesainya pelaksanaan docking ${b(esc(kapal))} Tahun ${tahun} `
          + `di galangan ${galangan}.`,
      },
      {
        teks: `Terkait butir 1 (satu) tersebut di atas, bersama ini kami mengajukan permohonan persetujuan `
          + `${b("Pelaksanaan Olah Gerak Sea Trial dan Compasseren")} Kapal ${esc(kapal)}`
          + (kapan ? ` pada ${kapan}` : "")
          + `, dengan data kapal sebagai berikut:`,
        blok: tabelData([
          ["Nama Kapal", esc(kapal)],
          ["Call Sign", esc(d.callSign || "")],
          ["No IMO", esc(d.imo || "")],
          ["Bendera", esc(d.bendera || "Indonesia")],
          ["Type Kapal", esc(d.tipe || "Ferry Ro-Ro")],
          ["GRT", esc(d.grt || "")],
          ["Nakhoda", esc(d.nakhoda || "")],
          ["Perusahaan", esc(d.perusahaan || "PT. ASDP Indonesia Ferry (Persero)")],
          ["Lokasi Sea Trial", esc(d.lokasi || "")],
        ]),
      },
      { teks: "Demikian permohonan ini kami ajukan, atas persetujuan dan kerjasamanya diucapkan terima kasih." },
    ];
    return bungkus(suratBernomor(butir));
  },
};
