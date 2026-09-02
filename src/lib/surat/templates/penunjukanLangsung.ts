/**
 * TEMPLATE 9 — Permohonan Persetujuan Penunjukan Langsung Vendor Docking.
 *
 * Dikirim ke Regional sebelum docking dimulai, ketika galangannya ditunjuk
 * langsung dan bukan dilelang. Isinya tiga hal berurutan: dasar hukum dan
 * surat-suratnya, hasil evaluasi vendor beserta nilai yang sudah disetujui
 * pusat, lalu alasan mengapa galangan itu yang dipilih.
 *
 * Daftar pertimbangan sengaja berupa pilihan yang bisa dicentang: alasan yang
 * dipakai cabang selalu berkisar pada tujuh hal yang sama (dock space, rekanan
 * terdaftar, harga bersaing, sarana, tenaga kerja, waktu kerja, jarak), dan
 * mengetiknya ulang tiap kapal hanya melahirkan kalimat yang berbeda-beda untuk
 * maksud yang sama.
 */
import { DataSurat, TemplateSurat } from "../types";
import { GALANGAN, KAPAL_SURAT, angkaRibuan, keAngka, namaKapalSurat, rupiahSurat, tanggalSurat } from "../format";
import { terbilangRupiah } from "../terbilang";
import {
  ButirSurat, PENUTUP_PERSETUJUAN, WARNA, b, baris, bungkus, esc, i, suratBernomor, tabel, td, tdAngka, th,
} from "../htmlHelpers";

export interface BarisDasar { instansi: string; nomor: string; tanggal: string; perihal: string }
export interface BarisEvaluasi { uraian: string; nilai: string; vendor: string; keterangan: string }

/** alasan yang benar-benar dipakai pada surat-surat cabang sebelumnya */
export const PERTIMBANGAN_GALANGAN = [
  "Tersedianya dock space sesuai jadwal docking",
  "Galangan merupakan rekanan resmi PT. ASDP Indonesia Ferry (Persero) dan sudah terdaftar di E-Procurement",
  "Harga satuan pekerjaan docking competitive dibandingkan galangan lain",
  "Memiliki sarana dan prasarana yang memadai dalam mendukung kelancaran dan kecepatan pelaksanaan docking",
  "Memiliki tenaga kerja (man power) yang profesional dalam pekerjaan docking",
  "Waktu kerja man power galangan lebih fleksibel (lembur pada malam hari dan hari libur) dibandingkan galangan lain",
  "Jarak dari lintasan ke galangan cukup dekat dibandingkan galangan lain",
  "Memiliki pengalaman dalam pekerjaan sejenis (mis. pembuatan rampdoor kapal)",
  "Tersedianya material galangan supply untuk pekerjaan yang dimohonkan",
];

export const dasarIsi = (d: DataSurat): BarisDasar[] =>
  ((d.dasar as BarisDasar[]) || []).filter((r) => (r?.instansi || r?.nomor || r?.perihal || "").trim());

export const evaluasiIsi = (d: DataSurat): BarisEvaluasi[] =>
  ((d.evaluasi as BarisEvaluasi[]) || []).filter((r) => (r?.uraian || r?.vendor || "").trim());

export const totalPenunjukan = (d: DataSurat) =>
  evaluasiIsi(d).reduce((s, r) => s + keAngka(r.nilai), 0);

export function tabelEvaluasi(d: DataSurat): string {
  const isi = evaluasiIsi(d);
  if (!isi.length) return "";

  const kepala = baris([
    th("Uraian", { width: "34%" }),
    th("Persetujuan Pusat (Rp.)", { width: "22%" }),
    th("Vendor Pelaksana", { width: "24%" }),
    th("Keterangan", { width: "20%" }),
  ]);

  const barisTabel = isi.map((r) => baris([
    td(esc(r.uraian)),
    tdAngka(angkaRibuan(keAngka(r.nilai))),
    td(esc(r.vendor)),
    td(esc(r.keterangan)),
  ]));

  // baris total hanya masuk akal bila pekerjaannya lebih dari satu mata anggaran
  if (isi.length > 1) {
    barisTabel.push(baris([
      td("TOTAL", { align: "right", tebal: true, bg: WARNA.total }),
      tdAngka(angkaRibuan(totalPenunjukan(d)), { tebal: true, bg: WARNA.total }),
      td("", { bg: WARNA.total }),
      td("", { bg: WARNA.total }),
    ]));
  }
  return tabel(barisTabel, kepala);
}

export const penunjukanLangsung: TemplateSurat = {
  id: "penunjukan-langsung",
  nama: "Permohonan Penunjukan Langsung Vendor Docking",
  // {lingkup} hanya muncul bila pekerjaan investasinya diisi
  perihal: "Permohonan Persetujuan Penunjukkan Langsung Pekerjaan Docking dan {lingkup} {kapal} Tahun {tahun}",
  tujuan: "Executive Director Regional IV — Jakarta",
  deskripsi: "Penunjukan galangan tanpa lelang: dasar hukum, tabel evaluasi vendor, dan daftar pertimbangan yang tinggal dicentang.",
  ikon: "🏗️",
  isian: [
    { id: "kapal", label: "Kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun docking", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    {
      id: "lingkup", label: "Pekerjaan investasi yang menyertai", jenis: "teks", kolomBorang: 2,
      contoh: "Investasi Rampdoor Haluan",
      petunjuk: "Kosongkan bila permohonannya docking saja. Bila diisi, lingkup ini ikut disebut di perihal, "
        + "kalimat hasil evaluasi, dan kalimat permohonan.",
    },
    { id: "galangan", label: "Galangan yang ditunjuk", jenis: "pilih", pilihan: GALANGAN, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "kotaGalangan", label: "Kota galangan", jenis: "teks", contoh: "Kota Sorong", kolomBorang: 2 },
    {
      id: "dasar", label: "Dasar permohonan", jenis: "tabel", wajib: true,
      petunjuk: "Tiga butir yang biasa dipakai: Keputusan Direksi tentang kebijakan pengadaan, surat persetujuan "
        + "pelaksanaan docking, dan surat dock space dari galangan.",
      bacaBerkas:
        "Daftar dasar permohonan, ditulis sebagai butir a, b, c pada surat lama. Bentuknya: "
        + "“Keputusan Direksi … nomor : <nomor> tanggal <tanggal> tentang <perihal>”, "
        + "“Surat Direktur Teknik dan Fasilitas Nomor : <nomor> Tanggal <tanggal> Perihal <perihal>”, atau "
        + "“Surat dari Galangan <nama galangan> nomor : <nomor> tanggal <tanggal> perihal Dockspace …”. "
        + "Bagian sebelum kata “nomor” adalah SUMBERNYA — masukkan ke kolom instansi.",
      kolom: [
        { id: "instansi", label: "Sumber / pengirim", jenis: "teks", saran: [
          { nilai: "Keputusan Direksi PT ASDP Indonesia Ferry (Persero)", label: "Keputusan Direksi PT ASDP" },
          { nilai: "Surat Direktur Teknik dan Fasilitas", label: "Surat Direktur Teknik dan Fasilitas" },
          { nilai: "Surat dari Galangan", label: "Surat dari Galangan" },
        ] },
        { id: "nomor", label: "Nomor", jenis: "teks", lebar: "14rem" },
        { id: "tanggal", label: "Tanggal", jenis: "tanggal", lebar: "10rem" },
        { id: "perihal", label: "Perihal / tentang", jenis: "teks" },
      ],
    },
    {
      id: "evaluasi", label: "Hasil evaluasi pekerjaan", jenis: "tabel", wajib: true,
      petunjuk: "Nilai yang ditulis adalah PERSETUJUAN PUSAT, bukan penawaran galangan.",
      bacaBerkas:
        "Tabel hasil evaluasi pekerjaan docking. Tiap baris: uraian pekerjaan beserta mata anggarannya "
        + "(mis. “Docking Repair M.A. 5010403003”), nilai persetujuan pusat dalam rupiah, nama vendor/galangan "
        + "pelaksana, dan keterangannya (mis. “Telah terdaftar di E-Procurement”).",
      kolom: [
        { id: "uraian", label: "Uraian pekerjaan", jenis: "teks", saran: [
          { nilai: "Docking Repair M.A. 5010403003", label: "Docking Repair M.A. 5010403003" },
          { nilai: "Investasi M.A. 1020604008", label: "Investasi M.A. 1020604008" },
        ] },
        { id: "nilai", label: "Persetujuan pusat", jenis: "rupiah", lebar: "10rem" },
        { id: "vendor", label: "Vendor pelaksana", jenis: "teks", saran: GALANGAN.map((g) => ({ nilai: g, label: g })) },
        { id: "keterangan", label: "Keterangan", jenis: "teks", saran: [
          { nilai: "Telah terdaftar di E-Procurement", label: "Telah terdaftar di E-Procurement" },
        ] },
      ],
    },
    {
      id: "pertimbangan", label: "Pertimbangan penunjukan", jenis: "daftar-centang", wajib: true,
      pilihan: PERTIMBANGAN_GALANGAN,
      awal: PERTIMBANGAN_GALANGAN,
      petunjuk: "Boleh menambah pertimbangan lain. Urutan centang menentukan urutan butir a, b, c di surat.",
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const ev = evaluasiIsi(d);
    if (!totalPenunjukan(d)) pesan.push("Nilai persetujuan pusat masih nol — angka itu yang menjadi dasar penunjukan.");
    ev.forEach((r, n) => {
      if (!r.vendor?.trim()) pesan.push(`Baris evaluasi ke-${n + 1} belum menyebut vendor pelaksana.`);
    });
    /*
     * Vendor pada tabel evaluasi harus galangan yang sama dengan yang
     * dimohonkan. Pada surat contoh, butir evaluasinya masih menyebut kapal dan
     * tahun docking sebelumnya — sisa salinan yang lolos sampai terkirim.
     */
    const galangan = String(d.galangan || "").trim().toLowerCase();
    if (galangan && ev.length && !ev.some((r) => (r.vendor || "").trim().toLowerCase().includes(galangan.slice(0, 12)))) {
      pesan.push("Vendor pada tabel evaluasi berbeda dengan galangan yang dimohonkan — periksa lagi.");
    }
    dasarIsi(d).forEach((r, n) => {
      if (!r.tanggal?.trim()) pesan.push(`Dasar butir ${String.fromCharCode(97 + n)} belum punya tanggal.`);
    });
    return pesan;
  },

  ringkasNilai: (d) => {
    const t = totalPenunjukan(d);
    return t ? { label: "Nilai pekerjaan yang ditunjuklangsungkan", nilai: t } : null;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const tahun = esc(d.tahun || "");
    const galangan = esc(String(d.galangan || ""));
    const kota = esc(String(d.kotaGalangan || "").trim());
    const total = totalPenunjukan(d);
    const pertimbangan = ((d.pertimbangan as string[]) || []).filter(Boolean);
    /*
     * Sebagian docking dimohonkan bersama satu pekerjaan investasi (rampdoor,
     * permesinan). Kalau lingkup itu diisi, seluruh kalimat surat menyebut
     * "Docking Repair dan <lingkup>", persis seperti surat yang sudah terbit.
     */
    const lingkup = esc(String(d.lingkup || "").trim());
    const pekerjaan = lingkup ? `Docking Repair dan ${lingkup}` : "Docking Repair";

    const butir: ButirSurat[] = [{
      teks: "Mendasari :",
      sub: dasarIsi(d).map((r) => {
        const tgl = tanggalSurat(String(r.tanggal || ""));
        return [
          esc(r.instansi || ""),
          r.nomor ? `nomor : ${b(esc(r.nomor))}` : "",
          tgl ? `tanggal ${esc(tgl)}` : "",
          r.perihal ? `perihal ${esc(r.perihal)}` : "",
        ].filter(Boolean).join(" ") + ";";
      }),
    }];

    butir.push({
      teks: `Terkait butir 1 (satu) di atas, bersama ini kami sampaikan hasil evaluasi `
        + `Pekerjaan ${pekerjaan} ${b(esc(kapal))} tahun ${tahun} sebagai berikut :`,
      blok: tabelEvaluasi(d) || undefined,
    });

    butir.push({
      teks: `Terkait butir 1 (satu) di atas, bersama ini kami sampaikan `
        + `${b(`permohonan Persetujuan Penunjukkan Langsung Vendor untuk Pekerjaan ${pekerjaan} `
          + `${esc(kapal)} tahun ${tahun}`)} yang akan dilaksanakan di galangan ${galangan}`
        + `${kota ? ` ${kota}` : ""}`
        + (total ? ` dengan nilai sebesar ${b(rupiahSurat(total))} (terbilang: ${i(terbilangRupiah(total))})` : "")
        + `, dengan pertimbangan sebagai berikut :`,
      sub: pertimbangan.map((x, n) => `${esc(x)}${n === pertimbangan.length - 1 ? "." : ";"}`),
    });

    butir.push({ teks: PENUTUP_PERSETUJUAN });
    return bungkus(suratBernomor(butir));
  },
};
