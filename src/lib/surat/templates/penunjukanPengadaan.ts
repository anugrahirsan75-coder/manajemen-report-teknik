/**
 * TEMPLATE 11 — Permohonan Penunjukan Langsung Vendor untuk PENGADAAN BARANG.
 *
 * Berbeda dari penunjukan langsung galangan (docking): yang ini dikirim ke
 * Regional ketika satu barang tidak bisa dilelang — biasanya karena tipenya
 * sudah discontinued, hanya satu vendor yang sanggup menyediakan, atau
 * barangnya bekas pakai yang harus lolos uji dulu. Contoh yang dipakai sebagai
 * acuan: pengadaan crankshaft bekas mesin induk KMP. Pulau Sagori 2025
 * (TN.204/00586/IX/ASDP-TTE/2025).
 *
 * Susunannya mengikuti surat terbit:
 *   1. Memperhatikan dan mendasari — Keputusan Direksi + surat persetujuan pusat
 *   2. Permohonan + tabel uraian barang yang diadakan
 *   3. Bahan pertimbangan mengapa vendor itu yang ditunjuk (butir a, b, c …)
 *   4. Penutup
 *
 * Daftar pertimbangan dibuat sebagai pilihan bercentang karena alasannya selalu
 * berkisar pada hal yang sama; yang berubah hanya nama vendor, nomor penawaran,
 * dan jenis barangnya. Butir yang menyebut nomor penawaran dibiarkan sebagai
 * isian tersendiri supaya tidak diketik ulang di dalam kalimat.
 */
import { DataSurat, TemplateSurat } from "../types";
import { DASAR_KEPUTUSAN_DIREKSI, DASAR_KOSONG, KAPAL_SURAT, angkaRibuan, keAngka, namaKapalSurat, rupiahSurat, tanggalSurat } from "../format";
import { terbilangRupiah } from "../terbilang";
import {
  ButirSurat, kalimatDasar, PENUTUP_PERTIMBANGAN, WARNA, b, baris, bungkus, esc, i, suratBernomor, tabel, td, tdAngka, th,
} from "../htmlHelpers";

interface BarisDasar { instansi: string; nomor: string; tanggal: string; perihal: string }
interface BarisUraian { uraian: string; jumlah: string; nilai: string; keterangan: string }

/** alasan yang benar-benar dipakai pada surat penunjukan pengadaan cabang */
const PERTIMBANGAN = [
  "Barang yang dibutuhkan telah discontinued dari pabrikan, sehingga pengadaan barang baru tidak memungkinkan lagi",
  "Telah dilakukan perbandingan (pro-con) atas penawaran beberapa vendor sebagaimana terlampir",
  "Barang yang ditawarkan dilengkapi laporan kondisi (condition report) yang menyatakan kondisinya masih baik dan standar",
  "Vendor telah berpengalaman dalam pengadaan barang sejenis yang sudah discontinued, sehingga mutu barang lebih terjamin",
  "Vendor memberikan jaminan garansi atas barang yang disediakan",
  "Vendor telah terdaftar sebagai rekanan resmi PT ASDP Indonesia Ferry (Persero) dan terdaftar di E-Procurement",
  "Barang akan dilakukan pengujian oleh BKI sebagai jaminan bahwa barang masih layak dan masih standar",
  "Barang telah tersedia (ready stock) di workshop vendor, sehingga proses pengadaan dan pengiriman ke Ternate tepat waktu",
];

const dasarIsi = (d: DataSurat): BarisDasar[] =>
  ((d.dasar as BarisDasar[]) || []).filter((r) => (r?.instansi || r?.nomor || r?.perihal || "").trim());

const uraianIsi = (d: DataSurat): BarisUraian[] =>
  ((d.uraian as BarisUraian[]) || []).filter((r) => (r?.uraian || r?.nilai || "").trim());

export const totalPengadaan = (d: DataSurat) =>
  uraianIsi(d).reduce((s, r) => s + keAngka(r.nilai), 0);

function tabelUraian(d: DataSurat): string {
  const isi = uraianIsi(d);
  if (!isi.length) return "";

  const kepala = baris([
    th("Uraian Barang", { width: "44%" }),
    th("Jumlah", { width: "12%" }),
    th("Nilai Penawaran (Rp.)", { width: "22%" }),
    th("Keterangan", { width: "22%" }),
  ]);

  const isiBaris = isi.map((r) => baris([
    td(esc(r.uraian)),
    td(esc(r.jumlah), { align: "center" }),
    tdAngka(angkaRibuan(keAngka(r.nilai))),
    td(esc(r.keterangan)),
  ]));

  // total hanya ditampilkan bila barangnya lebih dari satu baris
  if (isi.length > 1) {
    isiBaris.push(baris([
      td("TOTAL", { align: "right", tebal: true, bg: WARNA.total }),
      td("", { bg: WARNA.total }),
      tdAngka(angkaRibuan(totalPengadaan(d)), { tebal: true, bg: WARNA.total }),
      td("", { bg: WARNA.total }),
    ]));
  }
  return tabel(isiBaris, kepala);
}

export const penunjukanPengadaan: TemplateSurat = {
  id: "penunjukan-pengadaan",
  nama: "Permohonan Penunjukan Langsung Pengadaan Barang",
  perihal: "Permohonan Persetujuan Penunjukan Langsung Vendor Dalam Rangka Pengadaan {barang} {kapal}",
  tujuan: "Senior General Manager Regional IV — Jakarta",
  deskripsi: "Pengadaan barang tanpa lelang (mis. suku cadang discontinued atau bekas pakai): dasar, tabel barang, "
    + "dan bahan pertimbangan penunjukan vendor.",
  ikon: "🔩",
  isian: [
    { id: "kapal", label: "Kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    {
      id: "barang", label: "Barang yang diadakan", jenis: "teks", wajib: true, kolomBorang: 2,
      contoh: "Crankshaft Second Hand Mesin Induk Kanan",
      petunjuk: "Ditulis sebagaimana akan muncul di perihal surat.",
    },
    {
      id: "vendor", label: "Vendor yang ditunjuk", jenis: "teks", wajib: true, kolomBorang: 2,
      contoh: "PT Global Trading",
    },
    {
      id: "solAgent", label: "Sole agent / pabrikan (bila barang discontinued)", jenis: "teks", kolomBorang: 2,
      contoh: "PT. Pioneer selaku sole agent mesin merk Yanmar",
      petunjuk: "Diisi bila alasan penunjukan adalah barang sudah tidak diproduksi. Kosongkan bila tidak relevan.",
    },
    {
      id: "penawaranNomor", label: "Nomor penawaran vendor", jenis: "teks", kolomBorang: 2,
      contoh: "878/ASDP/BUS-02/0825",
    },
    { id: "penawaranTanggal", label: "Tanggal penawaran vendor", jenis: "tanggal", kolomBorang: 2 },
    {
      id: "garansi", label: "Garansi yang diberikan vendor", jenis: "teks", kolomBorang: 2,
      contoh: "2.500 jam pemakaian",
    },
    {
      id: "dasar", label: "Dasar permohonan", jenis: "tabel", wajib: true,
      awal: [DASAR_KEPUTUSAN_DIREKSI, DASAR_KOSONG],
      petunjuk: "Dua butir yang biasa dipakai: Keputusan Direksi tentang kebijakan pengadaan, dan surat persetujuan "
        + "investasi/pengadaan dari Direktur Teknik dan Fasilitas.",
      bacaBerkas:
        "Daftar dasar permohonan, ditulis sebagai butir a, b pada surat lama. Bentuknya: "
        + "“Keputusan Direksi PT ASDP Indonesia Ferry (Persero) nomor: <nomor> tanggal <tanggal> tentang <perihal>”, "
        + "atau “Surat Persetujuan Direktur Teknik Dan Fasilitas … nomor : <nomor> tanggal <tanggal> perihal <perihal>”. "
        + "Bagian sebelum kata “nomor” adalah SUMBERNYA — masukkan ke kolom instansi.",
      kolom: [
        { id: "instansi", label: "Sumber / pengirim", jenis: "teks", saran: [
          { nilai: "Keputusan Direksi PT ASDP Indonesia Ferry (Persero)", label: "Keputusan Direksi PT ASDP" },
          { nilai: "Surat Persetujuan Direktur Teknik dan Fasilitas PT ASDP Indonesia Ferry (Persero)",
            label: "Surat Persetujuan Direktur Teknik" },
        ] },
        { id: "nomor", label: "Nomor", jenis: "teks", lebar: "14rem" },
        { id: "tanggal", label: "Tanggal", jenis: "tanggal", lebar: "10rem" },
        { id: "perihal", label: "Perihal / tentang", jenis: "teks" },
      ],
    },
    {
      id: "uraian", label: "Uraian barang yang diadakan", jenis: "tabel",
      petunjuk: "Nilai yang ditulis adalah penawaran vendor yang dimohonkan persetujuannya.",
      bacaBerkas:
        "Tabel uraian barang: nama barang beserta spesifikasi/tipe mesinnya, jumlah (mis. “1 Unit”), "
        + "nilai penawaran dalam rupiah, dan keterangan (mis. “Termasuk pengiriman sampai Ternate”).",
      kolom: [
        { id: "uraian", label: "Uraian barang", jenis: "teks" },
        { id: "jumlah", label: "Jumlah", jenis: "teks", lebar: "7rem", saran: [
          { nilai: "1 Unit", label: "1 Unit" }, { nilai: "1 Set", label: "1 Set" },
        ] },
        { id: "nilai", label: "Nilai penawaran", jenis: "rupiah", lebar: "10rem" },
        { id: "keterangan", label: "Keterangan", jenis: "teks", saran: [
          { nilai: "Termasuk pengiriman sampai Ternate", label: "Termasuk pengiriman sampai Ternate" },
          { nilai: "Belum termasuk PPN", label: "Belum termasuk PPN" },
        ] },
      ],
    },
    {
      id: "pertimbangan", label: "Bahan pertimbangan penunjukan", jenis: "daftar-centang", wajib: true,
      pilihan: PERTIMBANGAN,
      awal: PERTIMBANGAN,
      petunjuk: "Boleh menambah pertimbangan lain. Urutan centang menentukan urutan butir a, b, c di surat. "
        + "Butir yang menyebut sole agent, nomor penawaran, dan garansi akan dilengkapi sendiri dari isian di atas.",
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    if (!uraianIsi(d).length) {
      pesan.push("Tabel uraian barang masih kosong — Regional menilai permohonan dari barang dan nilainya.");
    }
    if (!totalPengadaan(d)) pesan.push("Nilai penawaran masih nol.");
    dasarIsi(d).forEach((r, n) => {
      if (!r.tanggal?.trim()) pesan.push(`Dasar butir ${String.fromCharCode(97 + n)} belum punya tanggal.`);
    });
    /*
     * Surat penunjukan langsung berdiri di atas persetujuan pusat. Tanpa butir
     * itu, permohonannya kehilangan dasar dan hampir pasti dikembalikan.
     */
    const adaPersetujuan = dasarIsi(d).some((r) =>
      `${r.instansi} ${r.perihal}`.toLowerCase().includes("persetujuan"));
    if (dasarIsi(d).length && !adaPersetujuan) {
      pesan.push("Belum ada surat persetujuan pusat pada dasar permohonan — biasanya surat Direktur Teknik dan Fasilitas.");
    }
    if (!String(d.vendor || "").trim()) pesan.push("Vendor yang ditunjuk belum diisi.");
    return pesan;
  },

  ringkasNilai: (d) => {
    const t = totalPengadaan(d);
    return t ? { label: "Nilai pengadaan yang ditunjuklangsungkan", nilai: t } : null;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const barang = esc(String(d.barang || "barang").trim());
    const vendor = esc(String(d.vendor || "").trim());
    const total = totalPengadaan(d);
    const pertimbangan = ((d.pertimbangan as string[]) || []).filter(Boolean);

    const solAgent = String(d.solAgent || "").trim();
    const noPenawaran = String(d.penawaranNomor || "").trim();
    const tglPenawaran = tanggalSurat(String(d.penawaranTanggal || ""));
    const garansi = String(d.garansi || "").trim();

    /*
     * Butir pertimbangan dilengkapi dengan keterangan yang sudah diisi di
     * borang. Kalimatnya tetap kalimat yang dicentang; yang ditambahkan hanya
     * bagian yang memang berbeda tiap surat, supaya tidak ada yang mengetik
     * nomor penawaran dua kali.
     */
    const lengkapi = (teks: string): string => {
      let hasil = esc(teks);
      if (/discontinued dari pabrikan/i.test(teks) && solAgent) {
        hasil += `, sesuai keterangan ${esc(solAgent)}`;
      }
      if (/condition report|laporan kondisi/i.test(teks) && (noPenawaran || tglPenawaran)) {
        hasil += ` (surat penawaran ${vendor ? `${vendor} ` : ""}`
          + `${noPenawaran ? `nomor ${b(esc(noPenawaran))}` : ""}`
          + `${noPenawaran && tglPenawaran ? " " : ""}`
          + `${tglPenawaran ? `tanggal ${esc(tglPenawaran)}` : ""})`;
      }
      if (/garansi/i.test(teks) && garansi) hasil += ` selama ${b(esc(garansi))}`;
      return hasil;
    };

    const butir: ButirSurat[] = [{
      teks: "Memperhatikan dan mendasari :",
      sub: dasarIsi(d).map((r) => kalimatDasar(r, tanggalSurat(String(r.tanggal || "")))),
    }];

    butir.push({
      teks: `Terkait butir 1 (satu) tersebut di atas, bersama ini kami mengajukan `
        + `${b(`permohonan persetujuan penunjukan langsung vendor untuk pekerjaan pengadaan ${barang} ${esc(kapal)}`)}`
        + (total ? ` dengan nilai sebesar ${b(rupiahSurat(total))} (terbilang: ${i(terbilangRupiah(total))})` : "")
        + `, dengan uraian sebagai berikut :`,
      blok: tabelUraian(d) || undefined,
    });

    butir.push({
      teks: `Adapun sebagai bahan pertimbangan penunjukan langsung pengadaan ${barang} ${esc(kapal)} tersebut `
        + `${vendor ? `ke ${b(vendor)}` : "ke vendor dimaksud"}, antara lain :`,
      sub: pertimbangan.map((x, n) => `${lengkapi(x)}${n === pertimbangan.length - 1 ? "." : ";"}`),
    });

    butir.push({ teks: PENUTUP_PERTIMBANGAN });
    return bungkus(suratBernomor(butir));
  },
};
