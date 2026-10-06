/**
 * TEMPLATE — Permohonan Persetujuan Pekerjaan ke Regional.
 *
 * Dipakai ketika nilai satu pekerjaan melampaui kewenangan cabang sehingga
 * pengadaannya tidak diproses di cabang, melainkan dimohonkan agar dikerjakan
 * oleh MRP Kantor Regional.
 *
 * Bedanya dengan surat pelimpahan wewenang — yang arahnya justru sebaliknya:
 *
 *   pelimpahan-wewenang   prosesnya dimohonkan TURUN ke cabang
 *   template ini          prosesnya dimohonkan DIKERJAKAN di regional
 *
 * Keduanya berangkat dari sebab yang sama (nilai di atas kewenangan cabang)
 * dan berdiri di atas Keputusan Direksi yang sama, jadi mudah tertukar. Yang
 * memisahkan: di sini objeknya pekerjaan apa saja — pelabuhan, bangunan,
 * fasilitas — bukan docking satu kapal, sehingga tidak ada isian kapal.
 *
 * Bentuknya mengikuti surat yang sudah terbit untuk Pekerjaan Perkerasan Beton
 * Depan Ruang Tunggu Pelabuhan Bastiong (TN.304/00667/IX/ASDP-TTE/2026).
 */
import { DataSurat, TemplateSurat } from "../types";
import { keAngka, rupiahSurat, tanggalSurat } from "../format";
import { terbilangRupiah } from "../terbilang";
import { ButirSurat, b, bungkus, esc, i, suratBernomor } from "../htmlHelpers";

interface BarisDasar { instansi: string; nomor: string; tanggal: string; perihal: string }

/**
 * Keputusan Direksi tentang Manajemen Rantai Pasok — dasar yang selalu ada.
 *
 * Nomornya sengaja TIDAK diisikan di sini. Dua surat cabang yang sudah terbit
 * menuliskannya berbeda (UM.201 dan UM.301) untuk keputusan yang tanggal dan
 * perihalnya sama, jadi salah satunya pasti salah ketik. Menyetel salah satu
 * sebagai bawaan berarti menyebarkan tebakan ke setiap surat berikutnya;
 * lebih baik nomornya disalin sekali dari keputusan aslinya.
 */
export const DASAR_BAKU: BarisDasar[] = [
  { instansi: "Surat Direktur Teknik dan Fasilitas", nomor: "", tanggal: "", perihal: "" },
  {
    instansi: "Keputusan Direksi",
    nomor: "",
    tanggal: "2026-07-01",
    perihal: "Manajemen Rantai Pasok di Lingkungan PT ASDP Indonesia Ferry (Persero)",
  },
];

/** Batas kewenangan cabang kelas A — di atas ini prosesnya naik ke regional. */
export const BATAS_KEWENANGAN = 150_000_000;

const dasarIsi = (d: DataSurat): BarisDasar[] =>
  ((d.dasar as BarisDasar[]) || []).filter((r) => (r?.instansi || r?.nomor || r?.perihal || "").trim());

export const persetujuanRegional: TemplateSurat = {
  id: "persetujuan-regional",
  nama: "Permohonan Persetujuan Pekerjaan ke Regional",
  perihal: "Permohonan Pelaksanaan Pengadaan Barang/Jasa {jenisPekerjaan} {pekerjaan}",
  tujuan: "Executive Director Regional IV",
  deskripsi:
    "Nilai pekerjaan di atas kewenangan cabang, dimohonkan agar pengadaannya diproses oleh MRP Kantor Regional. "
    + "Terbilang nilainya ditulis sendiri dari angka yang diisi.",
  ikon: "🏗️",
  isian: [
    {
      id: "pekerjaan", label: "Nama pekerjaan", jenis: "teks", wajib: true,
      contoh: "Perkerasan Beton Depan Ruang Tunggu Pelabuhan Bastiong",
      petunjuk: "Tanpa kata “Pekerjaan” di depan — kata itu sudah ditulis sendiri oleh surat.",
    },
    {
      id: "jenisPekerjaan", label: "Jenis pekerjaan", jenis: "pilih",
      pilihan: ["Investasi", "Eksploitasi"], awal: "Investasi", bebas: true, kolomBorang: 2,
    },
    {
      id: "pemroses", label: "Unit yang diminta memproses", jenis: "pilih",
      pilihan: ["MRP Kantor Regional IV", "MRP Kantor Regional III", "MRP Kantor Pusat"],
      awal: "MRP Kantor Regional IV", bebas: true, kolomBorang: 2,
    },
    {
      id: "nilai", label: "Nilai atau pagu pekerjaan (termasuk PPN)", jenis: "rupiah", wajib: true, kolomBorang: 2,
      petunjuk: "Nilai inilah yang membuat prosesnya naik ke regional — harus di atas batas kewenangan cabang.",
    },
    {
      id: "ppn", label: "PPN (%)", jenis: "teks", awal: "11", kolomBorang: 2,
    },
    {
      id: "dasar", label: "Dasar permohonan (butir a, b)", jenis: "tabel", wajib: true,
      awal: DASAR_BAKU as unknown as Record<string, string>[],
      petunjuk:
        "Butir a: surat persetujuan pekerjaan dari Direktur Teknik dan Fasilitas. "
        + "Butir b: Keputusan Direksi tentang Manajemen Rantai Pasok — nomornya salin dari keputusan aslinya, "
        + "jangan dari surat lama (dua surat terbit menuliskannya berbeda).",
      bacaBerkas:
        "Daftar dasar permohonan yang ditulis sebagai butir a dan b pada surat lama. Tiap butir berbentuk "
        + "“Surat <pengirim>, No. <nomor>, tanggal <tanggal>, Perihal <perihal>”. Bagian antara kata “Surat” "
        + "dan kata “No.” adalah PENGIRIMNYA — masukkan ke kolom sumber.",
      kolom: [
        {
          id: "instansi", label: "Sumber / jenis dokumen", jenis: "teks", saran: [
            { nilai: "Surat Direktur Teknik dan Fasilitas", label: "Surat Direktur Teknik dan Fasilitas" },
            { nilai: "Keputusan Direksi", label: "Keputusan Direksi" },
            { nilai: "Surat Edaran", label: "Surat Edaran" },
          ],
        },
        { id: "nomor", label: "Nomor", jenis: "teks", lebar: "16rem" },
        { id: "tanggal", label: "Tanggal", jenis: "tanggal", lebar: "10rem" },
        { id: "perihal", label: "Perihal", jenis: "teks" },
      ],
    },
    {
      id: "lampiran", label: "Kalimat penutup butir 2", jenis: "teks",
      awal: "sebagaimana persetujuan terlampir",
      petunjuk: "Ditulis setelah besaran PPN. Kosongkan bila tidak ada lampiran.",
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const nilai = keAngka(d.nilai);
    if (nilai && nilai <= BATAS_KEWENANGAN) {
      pesan.push(
        `Nilai ${rupiahSurat(nilai)} masih di bawah batas kewenangan cabang (${rupiahSurat(BATAS_KEWENANGAN)}) — `
        + "kalau begitu pengadaannya bisa diproses di cabang dan surat ini tidak perlu. Periksa lagi nilainya.");
    }
    const isi = dasarIsi(d);
    if (isi.length < 2) {
      pesan.push("Dasar permohonan baru " + isi.length + " butir — surat ini biasanya memuat dua: "
        + "surat persetujuan dari Direktur Teknik dan Keputusan Direksi tentang Manajemen Rantai Pasok.");
    }
    isi.forEach((r, n) => {
      const huruf = String.fromCharCode(97 + n);
      if (!r.tanggal?.trim()) pesan.push(`Dasar butir ${huruf} belum punya tanggal.`);
      if (!r.nomor?.trim()) pesan.push(`Dasar butir ${huruf} belum punya nomor.`);
    });
    const adaPersetujuan = isi.some((r) => /persetujuan/i.test(r.perihal || ""));
    if (!adaPersetujuan) {
      pesan.push("Belum ada butir surat persetujuan dari Direktur Teknik — itu dasar yang paling ditanya.");
    }
    return pesan;
  },

  ringkasNilai: (d) => {
    const n = keAngka(d.nilai);
    return n ? { label: "Nilai / pagu pekerjaan", nilai: n } : null;
  },

  generate(d) {
    const pekerjaan = esc(String(d.pekerjaan || "").trim());
    const jenis = esc(String(d.jenisPekerjaan || "Investasi").trim());
    const pemroses = esc(String(d.pemroses || "MRP Kantor Regional IV").trim());
    const ppn = esc(String(d.ppn || "11").trim().replace(/%\s*$/, ""));
    const lampiran = esc(String(d.lampiran || "").trim().replace(/\.$/, ""));
    const nilai = keAngka(d.nilai);

    const butir: ButirSurat[] = [{
      teks: "Mendasari:",
      sub: dasarIsi(d).map((r) => {
        const tgl = tanggalSurat(String(r.tanggal || ""));
        return [
          esc(r.instansi || ""),
          r.nomor ? `No. ${b(esc(r.nomor))}` : "",
          tgl ? `tanggal ${esc(tgl)}` : "",
          r.perihal ? `Perihal ${esc(r.perihal)}` : "",
        ].filter(Boolean).join(", ") + ";";
      }),
    }];

    /*
     * Nilai boleh dikosongkan selagi surat masih disusun, jadi kalimatnya
     * dirakit tanpa angka ketimbang mencetak "Rp 0" yang terbaca sebagai
     * pekerjaan tanpa biaya.
     */
    const nilaiKalimat = nilai
      ? ` dengan nilai atau pagu pekerjaan sebesar ${b(rupiahSurat(nilai))} `
        + `${i(`(${terbilangRupiah(nilai)})`)} termasuk PPN ${ppn}%`
      : "";

    butir.push({
      teks: `Terkait butir 1 (satu) tersebut di atas, bersama ini kami mohon proses pengadaan `
        + `barang/jasa Pekerjaan ${jenis} ${b(`Pekerjaan ${pekerjaan}`)} dapat diproses oleh `
        + `${pemroses}${nilaiKalimat}${lampiran ? ` ${lampiran}` : ""}.`,
    });

    butir.push({
      teks: "Demikian kami sampaikan, atas perkenan dan kerjasama yang diberikan kami ucapkan terima kasih.",
    });
    return bungkus(suratBernomor(butir));
  },
};
