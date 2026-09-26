/**
 * TEMPLATE 22 — Permohonan Pelimpahan Proses Pengadaan SEKALIGUS Penunjukan
 * Langsung Vendor.
 *
 * Gabungan dua surat yang selama ini dikirim terpisah, dan memang sering
 * dimohonkan bersamaan: nilai pekerjaannya melampaui kewenangan cabang
 * (sehingga prosesnya harus dimintakan turun ke cabang), dan galangannya
 * ditunjuk langsung tanpa lelang. Dua permohonan itu berdiri di atas dasar yang
 * sama dan tabel evaluasi yang sama — dipecah menjadi dua surat berarti
 * mengetik dasar dan tabelnya dua kali, dan Regional membacanya dua kali pula.
 *
 * Kedua surat aslinya TETAP ADA dan tidak diubah: yang ini dipakai bila
 * keduanya dimohonkan sekalian, yang lama dipakai bila hanya salah satunya.
 *
 * Susunan butirnya mengikuti urutan orang membacanya:
 *   1. dasar  →  2. hasil evaluasi  →  3. pelimpahan  →  4. penunjukan langsung
 *
 * Pelimpahan diletakkan LEBIH DULU daripada penunjukan karena itu yang
 * menentukan: tanpa prosesnya turun ke cabang, penunjukan vendornya tidak ada
 * artinya untuk dimohonkan ke cabang.
 */
import { DataSurat, TemplateSurat } from "../types";
import { GALANGAN, KAPAL_SURAT, keAngka, namaKapalSurat, rupiahSurat, tanggalSurat } from "../format";
import { terbilangRupiah } from "../terbilang";
import { ButirSurat, PENUTUP_PERSETUJUAN, b, bungkus, esc, i, kalimatDasar, suratBernomor } from "../htmlHelpers";
import { BATAS_KEWENANGAN, DASAR_BAKU } from "./pelimpahanWewenang";
import {
  PERTIMBANGAN_GALANGAN, dasarIsi, evaluasiIsi, tabelEvaluasi, totalPenunjukan,
} from "./penunjukanLangsung";

export const pelimpahanPenunjukan: TemplateSurat = {
  id: "pelimpahan-penunjukan",
  nama: "Permohonan Pelimpahan + Penunjukan Langsung (satu surat)",
  perihal: "Permohonan Persetujuan Pelimpahan Proses Pengadaan dan Penunjukan Langsung Pekerjaan Docking {kapal} Tahun {tahun}",
  tujuan: "Executive Director Regional IV — {kotaTujuan}",
  deskripsi:
    "Dua permohonan dalam satu surat: prosesnya dimintakan turun ke cabang karena nilainya di atas kewenangan, "
    + "sekaligus persetujuan penunjukan galangan tanpa lelang. Dasar dan tabel evaluasinya cukup diketik sekali.",
  ikon: "🤝",
  isian: [
    { id: "kapal", label: "Kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun docking", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    {
      id: "kotaTujuan", label: "Kota Executive Director Regional IV", jenis: "pilih",
      pilihan: ["Makassar", "Jakarta"], awal: "Makassar", wajib: true, kolomBorang: 2,
      petunjuk: "Surat pelimpahan selama ini ke Makassar, surat penunjukan langsung ke Jakarta — "
        + "karena digabung, tujuannya dipilih sekali di sini.",
    },
    {
      id: "kelas", label: "Kelas cabang", jenis: "pilih", pilihan: ["A", "B", "C"], awal: "A", kolomBorang: 2,
      petunjuk: "Menentukan kalimat “di luar kewenangan cabang kelas …”.",
    },
    {
      id: "lingkup", label: "Pekerjaan investasi yang menyertai", jenis: "teks", kolomBorang: 2,
      contoh: "Investasi Rampdoor Haluan",
      petunjuk: "Kosongkan bila permohonannya docking saja. Bila diisi, ikut disebut pada tiap kalimat permohonan.",
    },
    { id: "galangan", label: "Galangan yang ditunjuk", jenis: "pilih", pilihan: GALANGAN, bebas: true, wajib: true },
    { id: "kotaGalangan", label: "Kota galangan", jenis: "teks", contoh: "Kota Bitung", kolomBorang: 2 },
    {
      id: "nilaiInduk", label: "Estimasi nilai pekerjaan induk (termasuk PPN)", jenis: "rupiah", kolomBorang: 2,
      petunjuk: "Nilai inilah yang membuat pelimpahan perlu dimohonkan — harus di atas batas kewenangan cabang. "
        + "Kosongkan bila hanya ingin menyebut ambang batasnya.",
    },
    {
      id: "dasar", label: "Dasar permohonan (butir a, b, c, …)", jenis: "tabel", wajib: true,
      awal: DASAR_BAKU as unknown as Record<string, string>[],
      petunjuk:
        "Butir a dan b sudah terisi — keduanya baku untuk permohonan pelimpahan. Lengkapi surat persetujuan "
        + "docking dari Direktur Teknik, justifikasi percepatan, dan surat dock space dari galangan.",
      bacaBerkas:
        "Daftar dasar permohonan yang ditulis sebagai butir a, b, c pada surat lama. Tiap butir berbentuk "
        + "“Surat <pengirim> Nomor : <nomor> Tanggal <tanggal> tentang/perihal <perihal>”. Bagian antara kata "
        + "“Surat” dan kata “Nomor” adalah PENGIRIMNYA — masukkan ke kolom sumber. Butir justifikasi biasanya "
        + "tanpa nomor, cukup tanggal.",
      kolom: [
        {
          id: "instansi", label: "Sumber / jenis dokumen", jenis: "teks", saran: [
            { nilai: "Surat Keputusan Direksi", label: "Surat Keputusan Direksi" },
            { nilai: "Surat Edaran", label: "Surat Edaran" },
            { nilai: "Surat Direktur Teknik", label: "Surat Direktur Teknik" },
            { nilai: "Surat Direktur Teknik dan Fasilitas", label: "Surat Direktur Teknik dan Fasilitas" },
            { nilai: "Surat dari Galangan", label: "Surat dari Galangan (dock space)" },
            { nilai: "Justifikasi Percepatan Proses Penerbitan Kontrak Induk", label: "Justifikasi Percepatan (tanpa nomor)" },
          ],
        },
        { id: "nomor", label: "Nomor", jenis: "teks", lebar: "16rem" },
        { id: "tanggal", label: "Tanggal", jenis: "tanggal", lebar: "10rem" },
        { id: "perihal", label: "Tentang / perihal", jenis: "teks" },
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
      id: "alasan", label: "Alasan pelimpahan", jenis: "textarea", wajib: true,
      awal: "pekerjaan tersebut bersifat mendesak dan membutuhkan koordinasi teknis secara langsung "
        + "dengan pihak penyuplai dan user cabang dengan justifikasi percepatan sebagaimana terlampir",
      petunjuk: "Disambung setelah kata “mengingat”. Tulis tanpa huruf besar di awal dan tanpa titik.",
    },
    {
      id: "pertimbangan", label: "Pertimbangan penunjukan galangan", jenis: "daftar-centang", wajib: true,
      pilihan: PERTIMBANGAN_GALANGAN,
      awal: PERTIMBANGAN_GALANGAN,
      petunjuk: "Boleh menambah pertimbangan lain. Urutan centang menentukan urutan butirnya di surat.",
    },
  ],

  periksa(d) {
    const pesan: string[] = [];

    /*
     * Nilai yang dipakai memeriksa kewenangan adalah nilai induk bila diisi,
     * selain itu total tabel evaluasi. Keduanya tidak selalu sama — induk
     * termasuk PPN, tabel evaluasi berisi persetujuan pusat per mata anggaran —
     * tetapi salah satunya harus melampaui batas, kalau tidak pelimpahannya
     * memang tidak perlu dimohonkan.
     */
    const induk = keAngka(d.nilaiInduk);
    const total = totalPenunjukan(d);
    const dipakai = induk || total;
    if (dipakai && dipakai <= BATAS_KEWENANGAN) {
      pesan.push(
        `Nilai ${rupiahSurat(dipakai)} masih di bawah batas kewenangan cabang (${rupiahSurat(BATAS_KEWENANGAN)}) — `
        + "kalau begitu pelimpahannya tidak perlu dimohonkan, cukup surat penunjukan langsung saja.");
    }
    if (!total) pesan.push("Nilai persetujuan pusat masih nol — angka itu yang menjadi dasar penunjukan.");

    const isi = dasarIsi(d);
    if (isi.length < 3) {
      pesan.push(`Dasar permohonan baru ${isi.length} butir — surat gabungan ini biasanya memuat lima: KD Rantai `
        + "Pasok, Surat Edaran, persetujuan docking, justifikasi percepatan, dan dock space galangan.");
    }
    isi.forEach((r, n) => {
      if (!r.tanggal?.trim()) pesan.push(`Dasar butir ${String.fromCharCode(97 + n)} belum punya tanggal.`);
    });
    if (!isi.some((r) => /persetujuan docking|persetujuan pekerjaan docking/i.test(r.perihal || ""))) {
      pesan.push("Belum ada butir surat persetujuan docking dari Direktur Teknik — itu dasar yang paling ditanya.");
    }

    const ev = evaluasiIsi(d);
    ev.forEach((r, n) => {
      if (!r.vendor?.trim()) pesan.push(`Baris evaluasi ke-${n + 1} belum menyebut vendor pelaksana.`);
    });
    const galangan = String(d.galangan || "").trim().toLowerCase();
    if (galangan && ev.length && !ev.some((r) => (r.vendor || "").trim().toLowerCase().includes(galangan.slice(0, 12)))) {
      pesan.push("Vendor pada tabel evaluasi berbeda dengan galangan yang dimohonkan — periksa lagi.");
    }
    return pesan;
  },

  ringkasNilai: (d) => {
    const n = keAngka(d.nilaiInduk) || totalPenunjukan(d);
    return n ? { label: "Nilai pekerjaan yang dimohonkan", nilai: n } : null;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const tahun = esc(d.tahun || "");
    const kelas = esc(String(d.kelas || "A"));
    const galangan = esc(String(d.galangan || ""));
    const kota = esc(String(d.kotaGalangan || "").trim());
    const alasan = esc(String(d.alasan || "").trim().replace(/\.$/, ""));
    const lingkup = esc(String(d.lingkup || "").trim());
    const pekerjaan = lingkup ? `Docking Repair dan ${lingkup}` : "Docking Repair";
    const induk = keAngka(d.nilaiInduk);
    const total = totalPenunjukan(d);
    const pertimbangan = ((d.pertimbangan as string[]) || []).filter(Boolean);

    const butir: ButirSurat[] = [{
      teks: "Mendasari dan menindaklanjuti :",
      sub: dasarIsi(d).map((r) => kalimatDasar(r, tanggalSurat(String(r.tanggal || "")))),
    }];

    butir.push({
      teks: `Terkait butir 1 (satu) di atas, bersama ini kami sampaikan hasil evaluasi `
        + `Pekerjaan ${pekerjaan} ${b(esc(kapal))} Tahun ${tahun} sebagai berikut :`,
      blok: tabelEvaluasi(d) || undefined,
    });

    // butir pelimpahan — nilainya disebut bila diisi, selain itu cukup ambangnya
    const nilaiKalimat = induk
      ? `dengan estimasi nilai pekerjaan induk sebesar ${b(rupiahSurat(induk))} `
        + `(terbilang: ${i(terbilangRupiah(induk))}), lebih dari ${b(rupiahSurat(BATAS_KEWENANGAN))} `
        + `termasuk PPN sehingga di luar kewenangan cabang kelas ${kelas}`
      : `dengan estimasi nilai pekerjaan induk lebih dari ${b(rupiahSurat(BATAS_KEWENANGAN))} `
        + `termasuk PPN (di luar kewenangan cabang kelas ${kelas})`;

    butir.push({
      teks: `Sehubungan dengan butir 1 (satu) dan 2 (dua) di atas, bersama ini kami sampaikan `
        + `${b(`permohonan persetujuan pelimpahan proses pengadaan Pekerjaan ${pekerjaan} ${esc(kapal)} Tahun ${tahun}`)} `
        + `${nilaiKalimat}, agar dapat dilaksanakan/diproses di Cabang Ternate`
        + (alasan ? `, mengingat ${alasan}` : "") + ".",
    });

    butir.push({
      teks: `Selanjutnya, bersama ini kami sampaikan pula `
        + `${b(`permohonan Persetujuan Penunjukan Langsung Vendor untuk Pekerjaan ${pekerjaan} ${esc(kapal)} Tahun ${tahun}`)} `
        + `yang akan dilaksanakan di galangan ${galangan}${kota ? ` ${kota}` : ""}`
        + (total ? ` dengan nilai sebesar ${b(rupiahSurat(total))} (terbilang: ${i(terbilangRupiah(total))})` : "")
        + `, dengan pertimbangan sebagai berikut :`,
      sub: pertimbangan.map((x, n) => `${esc(x)}${n === pertimbangan.length - 1 ? "." : ";"}`),
    });

    butir.push({ teks: PENUTUP_PERSETUJUAN });
    return bungkus(suratBernomor(butir));
  },
};
