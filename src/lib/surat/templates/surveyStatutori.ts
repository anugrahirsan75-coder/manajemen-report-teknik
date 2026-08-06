/**
 * TEMPLATE 4 — Permohonan Survey Statutori dalam rangka Docking (ke KSOP).
 *
 * Spesifikasi kapal ditulis sebagai tabel dua kolom TANPA garis, mengikuti
 * bentuk surat lama. cellpadding tetap dipasang supaya label dan nilainya tidak
 * menempel bila editor e-office membuang gaya.
 */
import { TemplateSurat } from "../types";
import { GALANGAN, KAPAL_SURAT, namaKapalSurat, tanggalSurat } from "../format";
import { SALAM, b, bungkus, esc, p, tabelData } from "../htmlHelpers";

export const surveyStatutori: TemplateSurat = {
  id: "survey-statutori",
  nama: "Permohonan Survey Statutori (KSOP)",
  perihal: "Permohonan Survey Statutori Dalam Rangka Docking KMP. {kapal} Tahun {tahun}",
  tujuan: "Kepala Kantor KSOP",
  deskripsi: "Permohonan survey statutori ke KSOP, dengan tabel spesifikasi kapal tanpa garis.",
  ikon: "🛡️",
  isian: [
    { id: "kapal", label: "Nama kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun docking", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    { id: "galangan", label: "Galangan", jenis: "pilih", pilihan: GALANGAN, bebas: true, wajib: true },
    { id: "nakhoda", label: "Nakhoda", jenis: "teks", wajib: true, contoh: "Sarpudin Sanduan", kolomBorang: 2 },
    { id: "bendera", label: "Bendera", jenis: "teks", awal: "Indonesia", kolomBorang: 2 },
    { id: "isiKotor", label: "Isi kotor (GT)", jenis: "teks", wajib: true, contoh: "380 GT", kolomBorang: 2 },
    { id: "pemilik", label: "Pemilik / Agen", jenis: "teks", awal: "PT. ASDP Indonesia Ferry (Persero)", kolomBorang: 2 },
    { id: "tempat", label: "Tempat pelaksanaan", jenis: "teks", wajib: true, contoh: "Klasaman Indah Raya – Sorong", kolomBorang: 2 },
    { id: "tanggal", label: "Pada tanggal", jenis: "tanggal", wajib: true, kolomBorang: 2 },
    { id: "catatanTanggal", label: "Keterangan tanggal", jenis: "teks", awal: "atau disesuaikan", petunjuk: "Ditempel setelah tanggal, boleh dikosongkan.", kolomBorang: 2 },
    { id: "keperluan", label: "Untuk keperluan", jenis: "teks", awal: "Survey Statutoria (Docking)", wajib: true, kolomBorang: 2 },
  ],

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const tahun = esc(d.tahun || "");
    const galangan = esc(d.galangan || "");
    const tgl = [tanggalSurat(String(d.tanggal || "")), String(d.catatanTanggal || "").trim()]
      .filter(Boolean).join(" ");

    const bagian: string[] = [];
    bagian.push(p(SALAM));
    bagian.push(p(
      `Memperhatikan dan mendasari Undang-Undang RI Nomor 17 Tahun 2008 tentang Pelayaran Pasal 216, `
      + `serta proses pelaksanaan Docking ${b(esc(kapal))} Tahun ${tahun} di Galangan ${galangan}.`,
    ));
    bagian.push(p(
      `Sehubungan dengan hal tersebut di atas, bersama ini kami mengajukan `
      + `${b(`permohonan Survey Statutori dalam rangka pelaksanaan Docking ${esc(kapal)} Tahun ${tahun}`)} `
      + `di Galangan ${galangan}, dengan spesifikasi kapal sebagai berikut:`,
    ));
    bagian.push(tabelData([
      ["Nama Kapal", esc(kapal)],
      ["Nakhoda", esc(d.nakhoda || "")],
      ["Bendera", esc(d.bendera || "Indonesia")],
      ["Isi Kotor", esc(d.isiKotor || "")],
      ["Pemilik Agen", esc(d.pemilik || "PT. ASDP Indonesia Ferry (Persero)")],
      ["Tempat Pelaksanaan", esc(d.tempat || "")],
      ["Pada Tanggal", esc(tgl)],
      ["Untuk Keperluan", esc(d.keperluan || "")],
    ]));
    bagian.push(`<p style="margin:0 0 10px 0;">&nbsp;</p>`);
    bagian.push(p("Demikian kami sampaikan sebagai permohonan, atas kerja samanya diucapkan terima kasih."));
    return bungkus(bagian.join("\n"));
  },
};
