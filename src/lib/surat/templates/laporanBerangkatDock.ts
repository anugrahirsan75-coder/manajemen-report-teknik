/**
 * TEMPLATE 16 — Laporan Pemberangkatan Kapal ke Galangan.
 *
 * Dikirim ke Direktur Teknik begitu kapal lepas tali menuju galangan: bukti
 * bahwa docking benar-benar dimulai dan sejak kapan jangka waktunya berjalan.
 * Pada ceklis audit docking ini butir 13 — surat pemberitahuan keberangkatan
 * kapal docking.
 *
 * Hari ditulis dari tanggalnya, bukan diketik. Surat cabang menyebut keduanya
 * sekaligus ("pada hari Jum'at tanggal 22 Mei 2026"), dan hari yang tidak cocok
 * dengan tanggalnya langsung terbaca sebagai surat yang disalin dari surat lain.
 */
import { DataSurat, TemplateSurat } from "../types";
import {
  DASAR_KOSONG, GALANGAN, KAPAL_SURAT, keAngka, namaHari, namaKapalSurat, tanggalSurat,
} from "../format";
import { terbilangAngka } from "../terbilang";
import { ButirSurat, kalimatDasar, b, bungkus, esc, suratBernomor } from "../htmlHelpers";

interface BarisDasar { instansi: string; nomor: string; tanggal: string; perihal: string }

const dasarIsi = (d: DataSurat): BarisDasar[] =>
  ((d.dasar as BarisDasar[]) || []).filter((r) => (r?.instansi || r?.nomor || r?.perihal || "").trim());

export const laporanBerangkatDock: TemplateSurat = {
  id: "laporan-berangkat-dock",
  nama: "Laporan Pemberangkatan Kapal ke Galangan",
  perihal: "Laporan Pemberangkatan {kapal} Ke Galangan {galangan} Dalam Rangka Pelaksanaan Docking Tahun {tahun}",
  tujuan: "Direktur Teknik — Jakarta",
  deskripsi: "Laporan kapal berangkat ke galangan: hari ditulis dari tanggalnya, lengkap dengan jam dan rencana lama docking. Butir 13 pada ceklis audit docking.",
  ikon: "🚢",
  isian: [
    { id: "kapal", label: "Kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun docking", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    { id: "galangan", label: "Galangan tujuan", jenis: "pilih", pilihan: GALANGAN, bebas: true, wajib: true },
    {
      id: "pembuka", label: "Kalimat pembuka butir 1", jenis: "pilih",
      pilihan: ["Berdasarkan :", "Memperhatikan dan mendasari :", "Mendasari :", "Menindaklanjuti :"],
      awal: "Berdasarkan :", bebas: true,
      petunjuk: "Surat cabang memakai keduanya — KMP. Lema “Berdasarkan”, KMP. Tuna “Memperhatikan dan mendasari”.",
    },
    {
      id: "dasar", label: "Dasar laporan", jenis: "tabel", wajib: true,
      awal: [
        { instansi: "Surat Direktur Teknik PT. ASDP Indonesia (Persero)", nomor: "", tanggal: "", perihal: "" },
        { instansi: "Surat Perintah Tugas", nomor: "", tanggal: "", perihal: "" },
        { instansi: "Surat dari PT. Industri Kapal Indonesia (Persero)", nomor: "", tanggal: "", perihal: "Dock Space Kapal PT. ASDP Indonesia Ferry (Persero) Cabang Ternate" },
        DASAR_KOSONG,
      ],
      petunjuk: "Tiga butir yang biasa dipakai: surat persetujuan docking dari pusat, Surat Perintah Tugas "
        + "pemberangkatan, dan surat dock space dari galangan.",
      bacaBerkas:
        "Daftar dasar laporan, ditulis sebagai butir a, b, c pada surat lama. Bentuknya: "
        + "“Surat Direktur Teknik PT. ASDP Indonesia (Persero) nomor : <nomor> tanggal <tanggal> perihal <perihal>”, "
        + "“Surat Perintah Tugas nomor : <nomor> tanggal <tanggal> tentang <perihal>”, atau "
        + "“Surat dari PT. Industri Kapal Indonesia (Persero) nomor : <nomor> tanggal <tanggal> perihal Dock Space”. "
        + "Bagian sebelum kata “nomor” adalah SUMBERNYA — masukkan ke kolom instansi.",
      kolom: [
        { id: "instansi", label: "Sumber / pengirim", jenis: "teks", saran: [
          { nilai: "Surat Direktur Teknik PT. ASDP Indonesia (Persero)", label: "Surat Direktur Teknik PT. ASDP" },
          { nilai: "Surat Perintah Tugas", label: "Surat Perintah Tugas" },
          { nilai: "Surat dari PT. Industri Kapal Indonesia (Persero)", label: "Surat dari Galangan (IKI)" },
        ] },
        { id: "nomor", label: "Nomor", jenis: "teks", lebar: "14rem" },
        { id: "tanggal", label: "Tanggal", jenis: "tanggal", lebar: "10rem" },
        { id: "perihal", label: "Perihal / tentang", jenis: "teks" },
      ],
    },
    {
      id: "pelabuhanAsal", label: "Berangkat dari", jenis: "teks", wajib: true,
      awal: "Pelabuhan Bastiong Ternate", kolomBorang: 2,
    },
    {
      id: "tglBerangkat", label: "Tanggal berangkat", jenis: "tanggal", wajib: true, kolomBorang: 2,
      petunjuk: "Nama harinya ditulis sendiri dari tanggal ini.",
    },
    {
      id: "jamBerangkat", label: "Pukul", jenis: "teks", wajib: true, contoh: "14.35", kolomBorang: 2,
    },
    {
      id: "zona", label: "Zona waktu", jenis: "pilih", pilihan: ["WIT", "WITA", "WIB"], awal: "WIT", kolomBorang: 2,
    },
    {
      id: "rencanaHari", label: "Rencana lama docking (hari)", jenis: "angka", wajib: true, awal: "15", kolomBorang: 2,
      petunjuk: "Sesuai jangka waktu pada surat perjanjian docking.",
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const hari = keAngka(d.rencanaHari);
    if (hari <= 0) pesan.push("Rencana lama docking masih nol hari.");
    if (!/^\d{1,2}[.:]\d{2}$/.test(String(d.jamBerangkat || "").trim())) {
      pesan.push("Jam keberangkatan sebaiknya ditulis seperti pada surat cabang: 14.35, bukan 2 siang.");
    }
    dasarIsi(d).forEach((r, n) => {
      if (!r.tanggal?.trim()) pesan.push(`Dasar butir ${String.fromCharCode(97 + n)} belum punya tanggal.`);
    });
    return pesan;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const tahun = esc(d.tahun || "");
    const galangan = esc(String(d.galangan || ""));
    const hari = namaHari(String(d.tglBerangkat || ""));
    const lama = keAngka(d.rencanaHari);

    const butir: ButirSurat[] = [{
      teks: esc(String(d.pembuka || "Berdasarkan :")),
      sub: dasarIsi(d).map((r) => kalimatDasar(r, tanggalSurat(String(r.tanggal || "")))),
    }];

    butir.push({
      teks: `Terkait butir 1 (satu) tersebut diatas, bersama ini dapat kami laporkan bahwa ${esc(kapal)} `
        + `${b("telah diberangkatkan")} dari ${esc(String(d.pelabuhanAsal || ""))} menuju Galangan ${galangan} `
        + `pada hari ${esc(hari)} tanggal ${b(esc(tanggalSurat(String(d.tglBerangkat || ""))))} pukul `
        + `${b(esc(String(d.jamBerangkat || "")))} ${esc(String(d.zona || "WIT"))} dalam rangka pelaksanaan `
        + `Docking tahun ${tahun}, dengan rencana pelaksanaan Docking selama `
        + `${b(`${lama} (${terbilangAngka(lama)}) hari`)}.`,
    });

    butir.push({ teks: "Demikian kami laporkan untuk menjadi periksa." });
    return bungkus(suratBernomor(butir));
  },
};
