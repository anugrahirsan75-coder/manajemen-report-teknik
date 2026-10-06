/**
 * TEMPLATE 24 — Permohonan Exhibitum Buku Jurnal Kapal (KSOP).
 *
 * Exhibitum adalah pengesahan buku jurnal oleh syahbandar: buku dibuka,
 * dihitung halamannya, lalu disahkan sebelum dipakai. Diajukan bersama surat
 * sea trial sesudah docking, karena buku jurnal yang baru harus sah sebelum
 * kapal beroperasi kembali.
 *
 * Bentuknya mengikuti surat KMP. Pulau Sagori 2026: tanpa butir bernomor,
 * data kapal sebagai tabel tanpa garis, lalu daftar bukunya sebagai tabel
 * bergaris. Lima buku baku dipasang sebagai nilai awal karena itulah yang
 * selalu diajukan; daftarnya tetap bisa ditambah atau dikurangi.
 */
import { TemplateSurat } from "../types";
import { KAPAL_SURAT, namaKapalSurat } from "../format";
import { bungkus, esc, p, tabel, tabelData, td, th, baris } from "../htmlHelpers";

const BUKU_BAKU = [
  { buku: "Buku Jurnal Dek", jumlah: "1 Buku" },
  { buku: "Buku Jurnal Mesin", jumlah: "1 Buku" },
  { buku: "Buku Jurnal Radio", jumlah: "1 Buku" },
  { buku: "Buku Jurnal Minyak (Oil Record Book)", jumlah: "1 Buku" },
  { buku: "Buku Jurnal Sampah (Garbage Record Book)", jumlah: "1 Buku" },
];

export const exhibitumJurnal: TemplateSurat = {
  id: "exhibitum-jurnal",
  nama: "Permohonan Exhibitum Buku Jurnal (KSOP)",
  perihal: "Permohonan Exhibitum Buku Jurnal {kapal}",
  tujuan: "Kepala KSOP",
  deskripsi: "Permohonan pengesahan buku jurnal dek, mesin, radio, minyak dan sampah ke KSOP.",
  ikon: "📓",
  isian: [
    { id: "kapal", label: "Nama kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "ksop", label: "KSOP yang dituju", jenis: "teks", wajib: true, contoh: "Kepala KSOP Kelas I Sorong", kolomBorang: 2 },
    { id: "kotaKsop", label: "Kota KSOP", jenis: "teks", wajib: true, contoh: "SORONG", kolomBorang: 2 },
    { id: "bendera", label: "Bendera", jenis: "teks", awal: "Indonesia", kolomBorang: 2 },
    { id: "gtLoa", label: "GT / LOA", jenis: "teks", wajib: true, contoh: "589 / 45,50 m", kolomBorang: 2 },
    { id: "nakhoda", label: "Nakhoda", jenis: "teks", wajib: true, contoh: "Yondi U Sakti", kolomBorang: 2 },
    { id: "kkm", label: "KKM", jenis: "teks", wajib: true, contoh: "Abdul Malik", kolomBorang: 2 },
    {
      id: "daftar",
      label: "Buku jurnal yang dimohonkan",
      jenis: "tabel",
      awal: BUKU_BAKU,
      bacaBerkas: false,
      kolom: [
        { id: "buku", label: "Buku Jurnal", jenis: "teks", lebar: "60%" },
        { id: "jumlah", label: "Jumlah", jenis: "teks", lebar: "20%" },
        { id: "keterangan", label: "Keterangan", jenis: "teks", lebar: "20%" },
      ],
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const isi = Array.isArray(d.daftar) ? d.daftar : [];
    if (!isi.filter((r: any) => String(r?.buku || "").trim()).length) {
      pesan.push("Daftar buku jurnal masih kosong — tanpa itu surat ini tidak menyebut apa yang dimohonkan.");
    }
    /*
     * Nakhoda dan KKM diperiksa terpisah, bukan sekadar lewat tanda wajib.
     *
     * Syahbandar mengesahkan buku jurnal atas nama kedua pejabat kapal itu;
     * surat yang salah satunya kosong akan dikembalikan dari loket, dan itu
     * baru ketahuan sesudah orangnya berangkat ke kantor KSOP.
     */
    if (!String(d.nakhoda || "").trim()) pesan.push("Nama Nakhoda belum diisi.");
    if (!String(d.kkm || "").trim()) pesan.push("Nama KKM belum diisi.");
    return pesan;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const isi = (Array.isArray(d.daftar) ? d.daftar : [])
      .filter((r: any) => String(r?.buku || "").trim());

    const kepala = baris([
      th("NO", { width: "8%" }),
      th("Buku Jurnal", { width: "52%" }),
      th("Jumlah", { width: "20%" }),
      th("Keterangan", { width: "20%" }),
    ]);
    const isiBaris = isi.map((r: any, n: number) => baris([
      td(String(n + 1), { align: "center" }),
      td(esc(r.buku)),
      td(esc(r.jumlah || "1 Buku"), { align: "center" }),
      // keterangan setiap baris memang selalu "Exhibitum" — itu yang dimohonkan;
      // tetap bisa ditimpa bila suatu saat ada buku yang statusnya berbeda
      td(esc(String(r.keterangan || "").trim() || "Exhibitum"), { align: "center" }),
    ]));

    const bagian = [
      p("Dengan hormat,"),
      p("Bersama ini kami sampaikan permohonan untuk di-<i>exhibitum</i> Buku Jurnal Kapal keagenan kami "
        + "dengan data sebagai berikut:"),
      tabelData([
        ["Nama Kapal", esc(kapal)],
        ["Bendera", esc(d.bendera || "Indonesia")],
        ["GT / LOA", esc(d.gtLoa || "")],
        ["Nakhoda", esc(d.nakhoda || "")],
        ["KKM", esc(d.kkm || "")],
      ]),
      p("Adapun buku jurnal sebagai berikut:"),
      tabel(isiBaris, kepala),
      p("Demikian permohonan ini disampaikan, atas perhatian dan kerjasamanya diucapkan terima kasih."),
    ];
    return bungkus(bagian.join(""));
  },
};
