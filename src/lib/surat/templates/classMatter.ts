/**
 * TEMPLATE 3 — Permohonan Pekerjaan Klass Matter (UT/NDT/Vacuum Test) ke BKI.
 *
 * Bentuknya mengikuti surat cabang yang sudah terbit
 * (TN.101/00417/VI/ASDP-TTE/2026, KMP. Ariwangan): daftar pekerjaan berdiri
 * sebagai butir a, b, c, BUKAN dirangkai jadi satu kalimat mengalir. Versi
 * pertama merangkainya, dan itu keliru untuk surat ini — BKI membaca daftar
 * pekerjaan sebagai daftar perintah kerja, satu baris satu pekerjaan, lalu
 * mencentangnya saat dikerjakan. Kalimat panjang membuat pekerjaan yang
 * terlewat tidak kelihatan.
 */
import { DataSurat, TemplateSurat } from "../types";
import { GALANGAN, JENIS_SURVEY, KAPAL_SURAT, namaKapalSurat, tanggalSurat } from "../format";
import { ButirSurat, b, bungkus, esc, suratBernomor } from "../htmlHelpers";

export const PEKERJAAN_KLASS = [
  "Pengukuran Ketebalan Plat (Ultrasonic Test)",
  "Non Destructive Test (NDT) Engsel Rampdoor Haluan dan Buritan",
  "Non Destructive Test (NDT) Shaft Propeller PS/SB",
  "Vacuum Test Pengelasan",
  "Megger Test",
];

export const classMatter: TemplateSurat = {
  id: "class-matter",
  nama: "Permohonan Pekerjaan Klass Matter (BKI)",
  perihal: "Permohonan Pelaksanaan Pekerjaan Klass Matter {kapal} Dalam Rangka Docking Tahun {tahun}",
  tujuan: "Kepala Cabang PT. Biro Klasifikasi Indonesia (Persero) — cabang terdekat galangan",
  deskripsi: "Permintaan UT, NDT, vacuum test, dan megger test ke BKI; pekerjaannya berdiri sebagai butir a, b, c.",
  ikon: "🔬",
  isian: [
    { id: "kapal", label: "Nama kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun docking", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    { id: "jenisSurvey", label: "Jenis survey", jenis: "pilih", pilihan: JENIS_SURVEY, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "galangan", label: "Galangan", jenis: "pilih", pilihan: GALANGAN, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "kotaGalangan", label: "Kota galangan", jenis: "teks", contoh: "Kota Sorong", kolomBorang: 2 },
    {
      id: "pekerjaan", label: "Pekerjaan yang dimohonkan", jenis: "daftar-centang", wajib: true,
      pilihan: PEKERJAAN_KLASS,
      petunjuk: "Boleh menambah pekerjaan lain. Urutan centang menentukan urutan butir a, b, c di surat.",
    },
    { id: "tanggalMulai", label: "Mulai pelaksanaan", jenis: "tanggal", wajib: true, kolomBorang: 2 },
    { id: "namaOs", label: "Nama Owner Surveyor", jenis: "teks", wajib: true, contoh: "Ali Payapo", kolomBorang: 2 },
    { id: "hpOs", label: "No. HP Owner Surveyor", jenis: "teks", wajib: true, contoh: "+62 822-4804-0500", kolomBorang: 2 },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const daftar = (d.pekerjaan as string[]) || [];
    if (daftar.length === 1) pesan.push("Hanya satu pekerjaan dipilih — pastikan memang hanya itu yang dimohonkan.");
    /*
     * Tanggal mulai sebelum surat dibuat berarti BKI diminta mengerjakan
     * sesuatu yang jadwalnya sudah lewat; pada surat asli jaraknya dua hari
     * sesudah surat, dan itu memang batas wajarnya.
     */
    const mulai = String(d.tanggalMulai || "");
    if (mulai && mulai < new Date().toISOString().slice(0, 10)) {
      pesan.push("Tanggal mulai pelaksanaan sudah lewat — periksa lagi sebelum surat dikirim.");
    }
    return pesan;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const galangan = esc(String(d.galangan || ""));
    const kota = esc(String(d.kotaGalangan || "").trim());
    const daftar = ((d.pekerjaan as string[]) || []).filter(Boolean);

    const butir: ButirSurat[] = [
      {
        teks: `Sehubungan dengan Pelaksanaan ${b(esc(d.jenisSurvey || ""))} ${b(esc(kapal))} `
          + `tahun ${esc(d.tahun || "")} di Galangan ${galangan}${kota ? ` ${kota}` : ""}.`,
      },
      {
        teks: `Terkait butir 1 (satu) tersebut di atas, bersama ini kami sampaikan `
          + `${b(`surat permohonan pelaksanaan pekerjaan Klass Matter untuk ${esc(kapal)}`)} antara lain :`,
        // titik koma di tiap butir, titik pada butir terakhir — seperti surat aslinya
        sub: daftar.map((x, n) => `${esc(x)}${n === daftar.length - 1 ? "." : ";"}`),
      },
      {
        teks: `Adapun pelaksanaan pekerjaan dimaksud kiranya dapat dilakukan mulai tanggal `
          + `${b(esc(tanggalSurat(String(d.tanggalMulai || ""))))} dengan berkordinasi ke Owner Surveyor `
          + `${esc(kapal)} Sdr. ${esc(d.namaOs || "")} (HP ${esc(d.hpOs || "")}). Adapun terkait dengan biaya `
          + `yang timbul dari pekerjaan dimaksud kiranya dapat ditagihkan kepada kami PT. ASDP Indonesia Ferry `
          + `(Persero) Cabang Ternate dengan melampirkan record hasil pekerjaan dan bukti pendukung lainnya.`,
      },
      { teks: "Demikian kami sampaikan, atas kerjasamanya diucapkan terimakasih." },
    ];
    return bungkus(suratBernomor(butir));
  },
};
