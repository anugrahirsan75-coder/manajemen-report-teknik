/**
 * TEMPLATE 6 — Permohonan Nomor IO (Internal Order) untuk investasi.
 *
 * Surat ini selalu bersandar pada BANYAK surat persetujuan sekaligus (edaran
 * Group Head, persetujuan docking tiap kapal, persetujuan investasi tertentu).
 * Di surat lama daftar itu ditulis sebagai sub-poin a./b./c.; di sini tetap
 * berupa daftar — memang daftar dokumen — tetapi kalimat pengantarnya mengalir
 * dan tidak lagi memakai penomoran bertingkat.
 *
 * Rincian nilainya boleh dikosongkan: banyak surat cukup menyebut "sebagaimana
 * form terlampir" karena rinciannya dikirim sebagai lampiran terpisah.
 */
import { TemplateSurat } from "../types";
import { KAPAL_SURAT, NAMA_BULAN, angkaRibuan, keAngka, rupiahSurat, tanggalSurat } from "../format";
import { terbilangRupiah } from "../terbilang";
import {
  ButirSurat, PENUTUP_PERHATIAN, WARNA, b, baris, bungkus, esc, suratBernomor, tabel, td, tdAngka, th,
} from "../htmlHelpers";

interface BarisRujukan { instansi: string; nomor: string; tanggal: string; perihal: string }
interface BarisIo { kapal: string; ma: string; uraian: string; nilai: string }

/** mata anggaran investasi — yang lazim dimintakan nomor IO */
const MA_INVESTASI = [
  { nilai: "1020604008 (Investasi Kapal Ro-Ro / Penyeberangan)", label: "1020604008 — Investasi Kapal Ro-Ro / Penyeberangan" },
  { nilai: "1020604009 (Investasi Akomodasi, Peralatan & Perlengkapan Kapal)", label: "1020604009 — Investasi Akomodasi, Peralatan & Perlengkapan" },
  { nilai: "1020604010 (Investasi Permesinan & Kelistrikan Kapal)", label: "1020604010 — Investasi Permesinan & Kelistrikan" },
];

const rujukanIsi = (d: any): BarisRujukan[] =>
  ((d.rujukan as BarisRujukan[]) || []).filter((r) => (r?.nomor || r?.perihal || "").trim());

const ioIsi = (d: any): BarisIo[] =>
  ((d.rincian as BarisIo[]) || []).filter((r) => (r?.uraian || "").trim() && keAngka(r?.nilai));

export const totalIo = (d: any) => ioIsi(d).reduce((s, r) => s + keAngka(r.nilai), 0);

export const permohonanIO: TemplateSurat = {
  id: "permohonan-io",
  nama: "Permohonan Nomor IO (Internal Order)",
  perihal: "Permohonan Nomor IO Investasi {jenisInvestasi} Cabang Ternate {bulan} {tahun}",
  tujuan: "Group Head Perencanaan dan Pengendalian Keuangan — Jakarta",
  deskripsi: "Pengajuan nomor IO untuk pencatatan investasi di SAP, dengan daftar surat dasar yang bisa banyak.",
  ikon: "🔢",
  isian: [
    { id: "jenisInvestasi", label: "Investasi untuk", jenis: "teks", wajib: true,
      awal: "Kapal Ro-Ro, Permesinan dan Akomodasi Kapal",
      petunjuk: "Ditulis apa adanya di kalimat permohonan dan pada perihal." },
    { id: "bulan", label: "Bulan pengajuan", jenis: "pilih", pilihan: NAMA_BULAN, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    {
      id: "rujukan", label: "Surat yang menjadi dasar", jenis: "tabel", wajib: true,
      petunjuk: "Boleh sebanyak yang diperlukan — tiap baris menjadi satu butir daftar di surat.",
      bacaBerkas:
        "Daftar surat yang menjadi dasar permohonan, sering ditulis sebagai butir a, b, c pada surat lama. "
        + "Tiap butir berbentuk kalimat: “Surat <pengirim> Nomor : <nomor> tanggal <tanggal> perihal <perihal>”. "
        + "Bagian antara kata “Surat” dan kata “Nomor” adalah PENGIRIMNYA — masukkan ke kolom instansi "
        + "(mis. jabatan seperti Direktur Teknik dan Fasilitas, atau nama unit). Nomornya bergaya "
        + "KU.3/00524/VII/ASDP-TTE/2026 atau TN.101/03644/VI/ASDP-2026.",
      kolom: [
        { id: "instansi", label: "Surat dari", jenis: "teks", saran: [
          { nilai: "Group Head Perencanaan dan Pengendalian Keuangan", label: "Group Head Perencanaan dan Pengendalian Keuangan" },
          { nilai: "Direktur Teknik dan Fasilitas PT. ASDP Indonesia Ferry (Persero)", label: "Direktur Teknik dan Fasilitas PT. ASDP Indonesia Ferry (Persero)" },
        ] },
        { id: "nomor", label: "Nomor surat", jenis: "teks", lebar: "14rem" },
        { id: "tanggal", label: "Tanggal", jenis: "tanggal", lebar: "10rem" },
        { id: "perihal", label: "Perihal", jenis: "teks" },
      ],
    },
    {
      id: "rincian", label: "Rincian investasi (boleh dikosongkan)", jenis: "tabel",
      petunjuk: "Bila dikosongkan, surat menyebut “sebagaimana form terlampir” seperti surat lama.",
      bacaBerkas:
        "Rincian investasi per kapal yang dimintakan nomor IO. Tiap baris: nama kapal (diawali KMP.), "
        + "kode mata anggaran investasi berawalan 1020604, uraian pekerjaan/barang investasinya, dan nilai rupiahnya. "
        + "Biasanya berasal dari form lampiran permohonan IO. Lewati baris Total.",
      kolom: [
        { id: "kapal", label: "Kapal", jenis: "teks", lebar: "12rem", saran: KAPAL_SURAT.map((k) => ({ nilai: k, label: k })) },
        { id: "ma", label: "Mata Anggaran", jenis: "teks", saran: MA_INVESTASI },
        { id: "uraian", label: "Uraian investasi", jenis: "teks" },
        { id: "nilai", label: "Nilai", jenis: "rupiah", lebar: "10rem" },
      ],
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const r = rujukanIsi(d);
    r.forEach((x, i) => {
      if (!x.nomor?.trim()) pesan.push(`Surat dasar baris ${i + 1} belum punya nomor.`);
      if (!x.tanggal?.trim()) pesan.push(`Surat dasar baris ${i + 1} belum punya tanggal.`);
    });
    const kembar = r.map((x) => (x.nomor || "").trim().toLowerCase())
      .filter((v, i, a) => v && a.indexOf(v) !== i);
    if (kembar.length) pesan.push(`Nomor surat ditulis dua kali: ${Array.from(new Set(kembar)).join(", ")}.`);
    return pesan;
  },

  ringkasNilai: (d) => (totalIo(d) ? { label: "Total investasi dimohonkan", nilai: totalIo(d) } : null),

  generate(d) {
    const bagian: string[] = [];
    const rujuk = rujukanIsi(d);
    const rincian = ioIsi(d);
    const total = totalIo(d);

    /*
     * Butir 1 selalu ditutup dengan dasar yang sama: pengaplikasian SAP. Itu
     * yang membuat permohonan nomor IO punya alasan — tanpa SAP tidak ada
     * nomor IO yang perlu diminta — dan pada surat-surat cabang yang sudah
     * terbit ia memang selalu berdiri sebagai butir terakhir.
     */
    const dasar = rujuk.map((r) => {
      const tgl = tanggalSurat(String(r.tanggal || ""));
      return `Surat ${esc(r.instansi || "")} Nomor ${b(esc(r.nomor || ""))}`
        + (tgl ? ` tanggal ${esc(tgl)}` : "")
        + (r.perihal ? ` perihal ${esc(r.perihal)}` : "") + ";";
    });
    dasar.push("Pengaplikasian System Analysis and Product (SAP) pada proses bisnis "
      + "PT. ASDP Indonesia Ferry (Persero);");

    const permohonan =
      `Terkait butir 1 (satu) di atas, guna kelancaran dalam pencatatan pada SAP, bersama ini kami `
      + `mengajukan ${b(`permohonan nomor IO (Internal Order) untuk investasi ${esc(String(d.jenisInvestasi || ""))} `
        + `Cabang Ternate ${esc(String(d.bulan || ""))} ${esc(String(d.tahun || ""))}`)}`;

    const butir: ButirSurat[] = [{ teks: "Mendasari dan Menindaklanjuti :", sub: dasar }];

    if (rincian.length) {
      const kepala = baris([
        th("No", { width: "5%" }),
        th("KAPAL", { width: "18%" }),
        th("MATA ANGGARAN", { width: "27%" }),
        th("URAIAN INVESTASI", { width: "32%" }),
        th("NILAI", { width: "18%" }),
      ]);
      const isi = rincian.map((r, i) => baris([
        td(String(i + 1), { align: "center", width: "5%" }),
        td(esc(r.kapal || "-"), { width: "18%" }),
        td(esc(r.ma || "-"), { width: "27%" }),
        td(esc(r.uraian), { width: "32%" }),
        tdAngka(angkaRibuan(keAngka(r.nilai)), { width: "18%" }),
      ]));
      isi.push(baris([
        td("TOTAL", { colspan: 4, align: "right", tebal: true, bg: WARNA.total }),
        tdAngka(angkaRibuan(total), { tebal: true, bg: WARNA.total }),
      ]));
      butir.push({ teks: `${permohonan}, dengan rincian sebagai berikut:`, blok: tabel(isi, kepala) });
      butir.push({
        teks: `Nilai keseluruhan yang dimohonkan sebesar ${b(rupiahSurat(total))} `
          + `(terbilang: <i>${terbilangRupiah(total)}</i>).`,
      });
    } else {
      butir.push({ teks: `${permohonan} sebagaimana form terlampir.` });
    }

    butir.push({ teks: PENUTUP_PERHATIAN });
    bagian.push(suratBernomor(butir));
    return bungkus(bagian.join(""));
  },
};
