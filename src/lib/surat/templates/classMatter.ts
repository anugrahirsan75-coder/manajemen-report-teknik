/**
 * TEMPLATE 3 — Permohonan Pekerjaan Klass Matter (UT/NDT/Vacuum Test) ke BKI.
 *
 * Daftar pekerjaan pada surat lama berupa sub-poin a./b./c.; di sini dirangkai
 * jadi satu kalimat mengalir ("... antara lain A, B, serta C.").
 */
import { DataSurat, TemplateSurat } from "../types";
import { GALANGAN, JENIS_SURVEY, KAPAL_SURAT, namaKapalSurat, rangkai, tanggalSurat } from "../format";
import { PENUTUP_KERJASAMA, SALAM, b, bungkus, esc, p } from "../htmlHelpers";

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
  perihal: "Permohonan Pelaksanaan Pekerjaan Klass Matter KMP. {kapal} Dalam Rangka Docking Tahun {tahun}",
  tujuan: "Kepala Cabang PT. Biro Klasifikasi Indonesia (Persero)",
  deskripsi: "Permintaan UT, NDT, dan uji lain ke BKI; daftar pekerjaan dirangkai jadi kalimat.",
  ikon: "🔬",
  isian: [
    { id: "kapal", label: "Nama kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun docking", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    { id: "jenisSurvey", label: "Jenis survey", jenis: "pilih", pilihan: JENIS_SURVEY, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "galangan", label: "Galangan", jenis: "pilih", pilihan: GALANGAN, bebas: true, wajib: true, kolomBorang: 2 },
    {
      id: "pekerjaan", label: "Pekerjaan yang dimohonkan", jenis: "daftar-centang", wajib: true,
      pilihan: PEKERJAAN_KLASS,
      petunjuk: "Boleh menambah pekerjaan lain. Urutan centang menentukan urutan di kalimat surat.",
    },
    { id: "tanggalMulai", label: "Mulai pelaksanaan", jenis: "tanggal", wajib: true, kolomBorang: 2 },
    { id: "namaOs", label: "Nama Owner Surveyor", jenis: "teks", wajib: true, contoh: "Ali Payapo", kolomBorang: 2 },
    { id: "hpOs", label: "No. HP Owner Surveyor", jenis: "teks", wajib: true, contoh: "+62 822-4804-0500", kolomBorang: 2 },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const daftar = (d.pekerjaan as string[]) || [];
    if (daftar.length === 1) pesan.push("Hanya satu pekerjaan dipilih — pastikan memang hanya itu yang dimohonkan.");
    return pesan;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const daftar = ((d.pekerjaan as string[]) || []).map((x) => esc(x));
    const bagian: string[] = [];

    bagian.push(p(SALAM));
    bagian.push(p(
      `Sehubungan dengan pelaksanaan ${b(esc(d.jenisSurvey || ""))} ${b(esc(kapal))} Tahun ${esc(d.tahun || "")} `
      + `di Galangan ${esc(d.galangan || "")}.`,
    ));
    bagian.push(p(
      `Sehubungan dengan hal tersebut di atas, bersama ini kami sampaikan `
      + `${b(`permohonan pelaksanaan pekerjaan Klass Matter untuk ${esc(kapal)}`)}, antara lain `
      + `${rangkai(daftar)}.`,
    ));
    bagian.push(p(
      `Adapun pelaksanaan pekerjaan dimaksud kiranya dapat dilakukan mulai tanggal `
      + `${b(esc(tanggalSurat(String(d.tanggalMulai || ""))))} dengan berkoordinasi dengan Owner Surveyor `
      + `${esc(kapal)} Sdr. ${esc(d.namaOs || "")} (HP ${esc(d.hpOs || "")}). Terkait biaya yang timbul dari `
      + `pekerjaan dimaksud kiranya dapat ditagihkan kepada kami PT. ASDP Indonesia Ferry (Persero) Cabang `
      + `Ternate dengan melampirkan record hasil pekerjaan dan bukti pendukung lainnya.`,
    ));
    bagian.push(p(PENUTUP_KERJASAMA));
    return bungkus(bagian.join("\n"));
  },
};
