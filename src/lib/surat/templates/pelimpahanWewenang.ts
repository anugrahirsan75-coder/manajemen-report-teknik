/**
 * TEMPLATE — Permohonan Pelimpahan Wewenang Proses Pengadaan Docking.
 *
 * Dipakai ketika nilai pekerjaan induk docking melampaui kewenangan cabang
 * (cabang kelas A dibatasi Rp 150 juta termasuk PPN), sehingga prosesnya harus
 * dimintakan turun ke cabang lewat Executive Director Regional.
 *
 * Dua butir dasar pertama SELALU sama pada tiap surat pelimpahan: Keputusan
 * Direksi tentang Manajemen Rantai Pasok dan Surat Edaran pelaksanaannya.
 * Keduanya karena itu sudah terisi sejak borang dibuka — bukan dikunci, karena
 * nomor keputusan bisa berganti bila terbit yang baru, tetapi tidak perlu
 * diketik ulang tiap kali. Butir c dan d memang berubah tiap kapal: surat
 * persetujuan docking dan justifikasi percepatannya.
 */
import { DataSurat, TemplateSurat } from "../types";
import { KAPAL_SURAT, keAngka, namaKapalSurat, rupiahSurat, tanggalSurat } from "../format";
import { terbilangRupiah } from "../terbilang";
import { ButirSurat, PENUTUP_PERSETUJUAN, b, bungkus, esc, i, suratBernomor } from "../htmlHelpers";

interface BarisDasar { instansi: string; nomor: string; tanggal: string; perihal: string }

/** Dua butir baku; ditulis di sini supaya tidak diketik ulang tiap surat. */
export const DASAR_BAKU: BarisDasar[] = [
  {
    instansi: "Surat Keputusan Direksi",
    nomor: "KD.114/UM.301/JKTHP/VII/ASDP-2026",
    tanggal: "2026-07-01",
    perihal: "Manajemen Rantai Pasok Di Lingkungan PT ASDP Indonesia Ferry (Persero)",
  },
  {
    instansi: "Surat Edaran",
    nomor: "SE.00014/UM.301/ASDP-2026",
    tanggal: "2026-07-08",
    perihal: "Pelaksanaan Kegiatan Manajemen Rantai Pasok Di Lingkungan PT ASDP Indonesia Ferry (Persero)",
  },
];

/** Batas kewenangan cabang kelas A — di atas ini pelimpahan harus dimohonkan. */
export const BATAS_KEWENANGAN = 150_000_000;

const dasarIsi = (d: DataSurat): BarisDasar[] =>
  ((d.dasar as BarisDasar[]) || []).filter((r) => (r?.instansi || r?.nomor || r?.perihal || "").trim());

export const pelimpahanWewenang: TemplateSurat = {
  id: "pelimpahan-wewenang",
  nama: "Permohonan Pelimpahan Wewenang Pengadaan Docking",
  perihal: "Permohonan Pelimpahan Wewenang Proses Pengadaan Pekerjaan Docking {kapal} Tahun {tahun}",
  tujuan: "Executive Director Regional IV — Makassar",
  deskripsi:
    "Nilai pekerjaan induk docking di atas kewenangan cabang, dimohonkan agar prosesnya dilaksanakan di Cabang Ternate. "
    + "Dua butir dasar pertama (KD Manajemen Rantai Pasok dan Surat Edarannya) sudah terisi.",
  ikon: "🤝",
  isian: [
    { id: "kapal", label: "Kapal", jenis: "pilih", pilihan: KAPAL_SURAT, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun docking", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    {
      id: "nilai", label: "Estimasi nilai pekerjaan induk (termasuk PPN)", jenis: "rupiah", wajib: true, kolomBorang: 2,
      petunjuk: "Nilai inilah yang membuat pelimpahan perlu dimohonkan — harus di atas batas kewenangan cabang.",
    },
    {
      id: "kelas", label: "Kelas cabang", jenis: "pilih", pilihan: ["A", "B", "C"], awal: "A", kolomBorang: 2,
      petunjuk: "Menentukan kalimat “di luar kewenangan cabang kelas …”.",
    },
    {
      id: "dasar", label: "Dasar permohonan (butir a, b, c, d)", jenis: "tabel", wajib: true,
      awal: DASAR_BAKU as unknown as Record<string, string>[],
      petunjuk:
        "Butir a dan b sudah terisi — keduanya baku untuk semua surat pelimpahan. "
        + "Lengkapi butir c (surat persetujuan docking dari Direktur Teknik) dan d (justifikasi percepatan).",
      bacaBerkas:
        "Daftar dasar permohonan yang ditulis sebagai butir a, b, c, d pada surat lama. Tiap butir berbentuk "
        + "“Surat <pengirim> Nomor : <nomor> Tanggal <tanggal> tentang/perihal <perihal>”. Bagian antara kata "
        + "“Surat” dan kata “Nomor” adalah PENGIRIMNYA — masukkan ke kolom sumber. Butir justifikasi biasanya "
        + "tanpa nomor, cukup tanggal.",
      kolom: [
        {
          id: "instansi", label: "Sumber / jenis dokumen", jenis: "teks", saran: [
            { nilai: "Surat Keputusan Direksi", label: "Surat Keputusan Direksi" },
            { nilai: "Surat Edaran", label: "Surat Edaran" },
            { nilai: "Surat Direktur Teknik", label: "Surat Direktur Teknik" },
            { nilai: "Justifikasi Percepatan Proses Penerbitan Kontrak Induk", label: "Justifikasi Percepatan (tanpa nomor)" },
          ],
        },
        { id: "nomor", label: "Nomor", jenis: "teks", lebar: "16rem" },
        { id: "tanggal", label: "Tanggal", jenis: "tanggal", lebar: "10rem" },
        { id: "perihal", label: "Tentang / perihal", jenis: "teks" },
      ],
    },
    {
      id: "alasan", label: "Alasan pelimpahan", jenis: "textarea", wajib: true,
      awal: "pekerjaan tersebut bersifat mendesak dan membutuhkan koordinasi teknis secara langsung "
        + "dengan pihak penyuplai dan user cabang dengan justifikasi percepatan sebagaimana terlampir",
      petunjuk: "Disambung setelah kata “mengingat”. Tulis tanpa huruf besar di awal dan tanpa titik.",
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const nilai = keAngka(d.nilai);
    if (nilai && nilai <= BATAS_KEWENANGAN) {
      pesan.push(
        `Nilai ${rupiahSurat(nilai)} masih di bawah batas kewenangan cabang (${rupiahSurat(BATAS_KEWENANGAN)}) — `
        + "kalau begitu pelimpahan tidak perlu dimohonkan. Periksa lagi nilainya.");
    }
    const isi = dasarIsi(d);
    if (isi.length < 3) {
      pesan.push("Dasar permohonan baru " + isi.length + " butir — surat pelimpahan biasanya memuat empat: "
        + "KD Rantai Pasok, Surat Edaran, persetujuan docking, dan justifikasi percepatan.");
    }
    isi.forEach((r, n) => {
      if (!r.tanggal?.trim()) {
        pesan.push(`Dasar butir ${String.fromCharCode(97 + n)} belum punya tanggal.`);
      }
    });
    const adaPersetujuan = isi.some((r) => /persetujuan docking|persetujuan pekerjaan docking/i.test(r.perihal || ""));
    if (!adaPersetujuan) {
      pesan.push("Belum ada butir surat persetujuan docking dari Direktur Teknik — itu dasar yang paling ditanya.");
    }
    return pesan;
  },

  ringkasNilai: (d) => {
    const n = keAngka(d.nilai);
    return n ? { label: "Estimasi nilai pekerjaan induk", nilai: n } : null;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const tahun = esc(d.tahun || "");
    const nilai = keAngka(d.nilai);
    const kelas = esc(String(d.kelas || "A"));
    const alasan = esc(String(d.alasan || "").trim().replace(/\.$/, ""));

    const butir: ButirSurat[] = [{
      teks: "Mendasari dan menindaklanjuti :",
      sub: dasarIsi(d).map((r) => {
        const tgl = tanggalSurat(String(r.tanggal || ""));
        return [
          esc(r.instansi || ""),
          r.nomor ? `Nomor : ${b(esc(r.nomor))}` : "",
          tgl ? `tanggal ${esc(tgl)}` : "",
          r.perihal ? `tentang ${esc(r.perihal)}` : "",
        ].filter(Boolean).join(" ") + ";";
      }),
    }];

    // Kalau nilainya diisi, sebut angkanya lalu terangkan kenapa melampaui
    // kewenangan; kalau dikosongkan, pakai kalimat surat aslinya yang hanya
    // menyebut ambang batasnya.
    const nilaiKalimat = nilai
      ? `dengan estimasi nilai pekerjaan induk sebesar ${b(rupiahSurat(nilai))} `
        + `(terbilang: ${i(terbilangRupiah(nilai))}), lebih dari ${b(rupiahSurat(BATAS_KEWENANGAN))} `
        + `termasuk PPN sehingga di luar kewenangan cabang kelas ${kelas}`
      : `dengan estimasi nilai pekerjaan induk lebih dari ${b(rupiahSurat(BATAS_KEWENANGAN))} `
        + `termasuk PPN (di luar kewenangan cabang kelas ${kelas})`;

    butir.push({
      teks: `Sehubungan dengan butir 1 (satu) diatas, bersama ini kami sampaikan `
        + `${b(`permohonan persetujuan pelimpahan pengadaan Pekerjaan Docking ${esc(kapal)} Tahun ${tahun}`)} `
        + `${nilaiKalimat}, agar dapat dilaksanakan/diproses di Cabang Ternate`
        + (alasan ? `, mengingat ${alasan}` : "") + ".",
    });

    butir.push({ teks: PENUTUP_PERSETUJUAN });
    return bungkus(suratBernomor(butir));
  },
};
