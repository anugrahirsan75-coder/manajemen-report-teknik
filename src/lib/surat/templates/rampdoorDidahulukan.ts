/**
 * Permohonan pekerjaan rampdoor dikerjakan terlebih dahulu — surat ke galangan.
 *
 * Rampdoor pembuatan baru makan waktu paling lama di antara seluruh pekerjaan
 * docking: pelatnya harus dipotong, dirakit, dan dilas jauh sebelum kapal naik
 * dok. Kalau menunggu negosiasi harga dan administrasi selesai lebih dulu,
 * pekerjaannya baru mulai saat kapal sudah di atas dok, dan hari dok terpakai
 * untuk menunggu bengkel — bukan untuk mengerjakan kapal.
 *
 * Karena itu surat ini meminta galangan memulai rampdoor-nya lebih dahulu,
 * dengan menyatakan terang-terangan bahwa negosiasi dan administrasinya
 * menyusul lewat Divisi MRP cabang. Pernyataan itu bagian penting isinya:
 * tanpa itu, surat ini terbaca seperti perintah kerja tanpa dasar harga.
 *
 * Dasar suratnya tiga: persetujuan Direktur Teknik, penawaran harga rampdoor
 * dari galangan, dan surat dock space. Ketiganya sudah ada sebelum surat ini
 * terbit, dan ketiganya yang membuat permintaan "kerjakan dulu" punya pijakan.
 */
import { DataSurat, TemplateSurat } from "../types";
import { DASAR_KOSONG, GALANGAN, KAPAL_SURAT, namaKapalSurat, tanggalSurat } from "../format";
import {
  ButirSurat, PENUTUP_KERJASAMA, b, bungkus, esc, kalimatDasar, suratBernomor,
} from "../htmlHelpers";

interface BarisDasar { instansi: string; nomor: string; tanggal: string; perihal: string }

/** bagian rampdoor yang diminta didahulukan — ikut disebut di kalimat permohonan */
const BAGIAN = ["Rampdoor Haluan", "Rampdoor Buritan", "Rampdoor Haluan dan Buritan"];

const dasarIsi = (d: DataSurat): BarisDasar[] =>
  ((d.dasar as BarisDasar[]) || []).filter((r) => (r?.instansi || r?.nomor || r?.perihal || "").trim());

export const rampdoorDidahulukan: TemplateSurat = {
  id: "rampdoor-didahulukan",
  nama: "Permohonan Pekerjaan Rampdoor Didahulukan",
  perihal: "Permohonan Pelaksanaan Pekerjaan {bagian} {kapal} Tahun {tahun} Terlebih Dahulu",
  tujuan: "General Manager {galangan} — {kotaGalangan}",
  deskripsi: "Surat ke galangan agar rampdoor dikerjakan lebih dulu supaya tidak memakan hari dok, "
    + "dengan negosiasi dan administrasi menyusul lewat Divisi MRP cabang.",
  ikon: "🛗",
  isian: [
    { id: "kapal", label: "Kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    {
      id: "tahun", label: "Tahun docking", jenis: "angka", wajib: true, kolomBorang: 2,
      awal: String(new Date().getFullYear()),
    },
    {
      id: "galangan", label: "Galangan yang dituju", jenis: "pilih", pilihan: GALANGAN, bebas: true, wajib: true,
      petunjuk: "Surat dialamatkan ke “General Manager ‹galangan›”.",
    },
    {
      id: "kotaGalangan", label: "Kota galangan", jenis: "pilih", pilihan: ["Bitung", "Sorong", "Makassar", "Surabaya"],
      bebas: true, wajib: true, kolomBorang: 2,
      petunjuk: "Mengisi baris “Di--” di bawah nama tujuan.",
    },
    {
      id: "bagian", label: "Bagian rampdoor", jenis: "pilih", pilihan: BAGIAN, bebas: true, wajib: true,
      awal: BAGIAN[2], kolomBorang: 2,
    },
    {
      id: "dasar", label: "Dasar permohonan", jenis: "tabel", wajib: true,
      awal: [
        { instansi: "Surat Persetujuan Direktur Teknik", nomor: "", tanggal: "", perihal: "" },
        { instansi: "Surat Penawaran Harga dari Galangan", nomor: "", tanggal: "", perihal: "Penawaran Harga Pekerjaan Rampdoor" },
        { instansi: "Surat Dock Space dari Galangan", nomor: "", tanggal: "", perihal: "Ketersediaan Dock Space" },
        DASAR_KOSONG,
      ],
      petunjuk: "Tiga butir yang biasa dipakai: persetujuan Direktur Teknik, penawaran harga rampdoor "
        + "dari galangan, dan surat dock space.",
      bacaBerkas:
        "Daftar dasar permohonan, ditulis sebagai butir a, b, c pada surat lama. Bentuknya: "
        + "“Surat Persetujuan Direktur Teknik nomor : <nomor> tanggal <tanggal>”, "
        + "“Surat Penawaran Harga dari Galangan <nama> nomor : <nomor> tanggal <tanggal>”, atau "
        + "“Surat Dock Space nomor : <nomor> tanggal <tanggal>”. "
        + "Bagian sebelum kata “nomor” adalah SUMBERNYA — masukkan ke kolom instansi.",
      kolom: [
        { id: "instansi", label: "Sumber / pengirim", jenis: "teks", saran: [
          { nilai: "Surat Persetujuan Direktur Teknik", label: "Persetujuan Direktur Teknik" },
          { nilai: "Surat Penawaran Harga dari Galangan", label: "Penawaran harga rampdoor" },
          { nilai: "Surat Dock Space dari Galangan", label: "Dock Space" },
        ] },
        { id: "nomor", label: "Nomor", jenis: "teks", lebar: "14rem" },
        { id: "tanggal", label: "Tanggal", jenis: "tanggal", lebar: "10rem" },
        { id: "perihal", label: "Perihal / keterangan", jenis: "teks" },
      ],
    },
    {
      id: "divisiAdm", label: "Divisi yang menyusulkan negosiasi & administrasi", jenis: "teks",
      awal: "Divisi Manajemen Rantai Pasok (MRP) Cabang Ternate", wajib: true,
      petunjuk: "Disebut terang-terangan pada surat: pekerjaan dimulai lebih dahulu, harga dan "
        + "administrasinya menyusul lewat divisi ini.",
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const baris = dasarIsi(d);
    const punya = (pola: RegExp) => baris.some((r) => pola.test(`${r.instansi || ""} ${r.perihal || ""}`));

    if (!punya(/persetujuan|direktur teknik/i)) {
      pesan.push("Persetujuan Direktur Teknik belum ada di daftar dasar — tanpa itu, permintaan "
        + "mendahulukan pekerjaan tidak punya pijakan.");
    }
    if (!punya(/penawaran|harga/i)) {
      pesan.push("Penawaran harga rampdoor belum ada di daftar dasar. Surat ini meminta pekerjaan "
        + "dimulai sebelum negosiasi, jadi penawarannya justru harus sudah ada.");
    }
    if (!punya(/dock\s*space/i)) {
      pesan.push("Surat Dock Space belum ada di daftar dasar — galangan perlu rujukan jadwal kapal "
        + "naik dok untuk mengatur urutan kerjanya.");
    }
    baris.forEach((r, n) => {
      if (!r.tanggal?.trim()) pesan.push(`Dasar butir ${String.fromCharCode(97 + n)} belum punya tanggal.`);
      if (!r.nomor?.trim()) pesan.push(`Dasar butir ${String.fromCharCode(97 + n)} belum punya nomor.`);
    });
    return pesan;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const tahun = esc(d.tahun || "");
    const bagian = esc(d.bagian || "");
    const galangan = esc(d.galangan || "");
    const divisi = esc(d.divisiAdm || "");

    const butir: ButirSurat[] = [{
      teks: "Memperhatikan dan mendasari :",
      sub: dasarIsi(d).map((r) => kalimatDasar(r, tanggalSurat(String(r.tanggal || "")))),
    }];

    butir.push({
      teks: `Terkait butir 1 (satu) tersebut di atas, guna kelancaran pelaksanaan Docking `
        + `${esc(kapal)} Tahun ${tahun}, bersama ini kami mohon kiranya pekerjaan `
        + `${b(`${bagian} ${esc(kapal)}`)} dapat ${b("dikerjakan terlebih dahulu")}.`,
    });

    /*
     * Kalimat administrasi berdiri sebagai butir sendiri, bukan ekor kalimat
     * permohonan. Ia menjawab pertanyaan yang pasti muncul di galangan -
     * "harganya bagaimana?" - dan jawaban itu tidak boleh terbaca sebagai
     * tempelan.
     */
    butir.push({
      teks: `Adapun proses negosiasi dan administrasi atas pekerjaan dimaksud akan dilakukan oleh `
        + `${divisi} pada kesempatan pertama.`,
    });

    butir.push({ teks: PENUTUP_KERJASAMA });
    return bungkus(suratBernomor(butir));
  },
};
