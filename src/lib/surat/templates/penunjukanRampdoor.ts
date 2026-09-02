/**
 * TEMPLATE 12 — Penunjukan Langsung Vendor untuk PEKERJAAN RAMPDOOR.
 *
 * Rampdoor kerap dikerjakan bersamaan dengan docking, dan untuk hal itu surat
 * penunjukan galangan sudah menampungnya. Yang belum: rampdoor yang dikerjakan
 * SENDIRI, di luar jadwal docking — penggantian yang mendesak karena rampdoor
 * bocor atau engselnya patah, dan kapalnya tidak sedang naik dok.
 *
 * Surat seperti itu tidak boleh menyebut "Docking Repair" sama sekali: yang
 * dimohonkan bukan pekerjaan dok, dan mata anggarannya pun berbeda (investasi
 * rampdoor, bukan pemeliharaan docking). Karena itu jenisnya dipisah, bukan
 * dititipkan sebagai pilihan di surat docking.
 *
 * Kerangka isinya sama dengan surat penunjukan galangan — dasar hukum, tabel
 * evaluasi, pertimbangan, penutup — sehingga bagian yang sama dipakai ulang
 * dari templates/penunjukanLangsung.ts, tidak disalin.
 */
import { DataSurat, TemplateSurat } from "../types";
import { GALANGAN, KAPAL_SURAT, namaKapalSurat, rupiahSurat, tanggalSurat } from "../format";
import { terbilangRupiah } from "../terbilang";
import { ButirSurat, PENUTUP_PERSETUJUAN, b, bungkus, esc, i, suratBernomor } from "../htmlHelpers";
import { dasarIsi, evaluasiIsi, tabelEvaluasi } from "./penunjukanLangsung";

/** bagian rampdoor yang dikerjakan — ikut disebut di seluruh kalimat surat */
const BAGIAN = ["Rampdoor Haluan", "Rampdoor Buritan", "Rampdoor Haluan dan Buritan"];

/*
 * Jenis pekerjaan ditulis TANPA kata "rampdoor": kata itu sudah dibawa oleh
 * pilihan bagian. Kalau keduanya memuatnya, kalimat surat berbunyi "Pembuatan
 * Rampdoor Baru Rampdoor Haluan".
 */
const JENIS_PEKERJAAN = [
  "Pembuatan",
  "Pembuatan dan Pemasangan",
  "Penggantian",
  "Perbaikan",
];

/**
 * Alasan penunjukan untuk pekerjaan rampdoor.
 *
 * Berbeda dengan penunjukan galangan docking: di sini yang dinilai bukan dock
 * space dan lama sandar, melainkan kemampuan membuat konstruksi rampdoor —
 * pengalaman, material plat, juru las bersertifikat, dan kesanggupan mengukur
 * langsung di kapal yang sedang beroperasi.
 */
const PERTIMBANGAN_RAMPDOOR = [
  "Vendor memiliki pengalaman dalam pembuatan dan penggantian rampdoor kapal penyeberangan",
  "Vendor merupakan rekanan resmi PT. ASDP Indonesia Ferry (Persero) dan telah terdaftar di E-Procurement",
  "Tersedianya material plat dan konstruksi rampdoor di workshop vendor, sehingga pekerjaan tidak tertunda",
  "Memiliki juru las bersertifikat sesuai persyaratan klasifikasi BKI",
  "Sanggup melakukan pengukuran langsung di kapal sehingga rampdoor terpasang tanpa penyesuaian ulang",
  "Harga penawaran pekerjaan rampdoor competitive dibandingkan vendor lain",
  "Sanggup menyelesaikan pekerjaan sesuai jadwal yang ditetapkan cabang",
  "Lokasi workshop dekat dengan lintasan kapal, sehingga mobilisasi material dan pemasangan lebih cepat",
];

export const totalRampdoor = (d: DataSurat) =>
  evaluasiIsi(d).reduce((s, r) => s + (Number(String(r.nilai || "").replace(/[^\d]/g, "")) || 0), 0);

export const penunjukanRampdoor: TemplateSurat = {
  id: "penunjukan-rampdoor",
  nama: "Permohonan Penunjukan Langsung Pekerjaan Rampdoor",
  perihal: "Permohonan Persetujuan Penunjukkan Langsung Pekerjaan {jenis} {bagian} {kapal} Tahun {tahun}"
    + " (mis. Pembuatan Rampdoor Haluan)",
  tujuan: "Executive Director Regional IV — Jakarta",
  deskripsi: "Pekerjaan rampdoor di luar docking: dasar hukum, tabel evaluasi vendor, dan pertimbangan penunjukan "
    + "yang menilai kemampuan membuat konstruksi rampdoor.",
  ikon: "🛗",
  isian: [
    { id: "kapal", label: "Kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun pekerjaan", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    {
      id: "jenis", label: "Jenis pekerjaan", jenis: "pilih", pilihan: JENIS_PEKERJAAN, bebas: true, wajib: true,
      awal: JENIS_PEKERJAAN[0], kolomBorang: 2,
    },
    {
      id: "bagian", label: "Bagian rampdoor", jenis: "pilih", pilihan: BAGIAN, bebas: true, wajib: true,
      awal: BAGIAN[0], kolomBorang: 2,
    },
    { id: "vendor", label: "Vendor / galangan yang ditunjuk", jenis: "pilih", pilihan: GALANGAN, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "kotaVendor", label: "Kota vendor", jenis: "teks", contoh: "Kota Bitung", kolomBorang: 2 },
    {
      id: "alasanMendesak", label: "Alasan pekerjaan tidak menunggu docking", jenis: "teks", kolomBorang: 2,
      contoh: "Rampdoor haluan mengalami keretakan konstruksi dan berisiko pada keselamatan bongkar muat",
      petunjuk: "Diisi bila rampdoor dikerjakan di luar jadwal docking — Regional selalu menanyakan alasannya.",
    },
    {
      id: "dasar", label: "Dasar permohonan", jenis: "tabel", wajib: true,
      petunjuk: "Dua butir yang biasa dipakai: Keputusan Direksi tentang kebijakan pengadaan, dan surat persetujuan "
        + "investasi rampdoor dari Direktur Teknik dan Fasilitas.",
      bacaBerkas:
        "Daftar dasar permohonan, ditulis sebagai butir a, b pada surat lama. Bentuknya: "
        + "“Keputusan Direksi … nomor: <nomor> tanggal <tanggal> tentang <perihal>” atau "
        + "“Surat Direktur Teknik dan Fasilitas Nomor : <nomor> Tanggal <tanggal> Perihal <perihal>”. "
        + "Bagian sebelum kata “nomor” adalah SUMBERNYA — masukkan ke kolom instansi.",
      kolom: [
        { id: "instansi", label: "Sumber / pengirim", jenis: "teks", saran: [
          { nilai: "Keputusan Direksi PT ASDP Indonesia Ferry (Persero)", label: "Keputusan Direksi PT ASDP" },
          { nilai: "Surat Direktur Teknik dan Fasilitas", label: "Surat Direktur Teknik dan Fasilitas" },
        ] },
        { id: "nomor", label: "Nomor", jenis: "teks", lebar: "14rem" },
        { id: "tanggal", label: "Tanggal", jenis: "tanggal", lebar: "10rem" },
        { id: "perihal", label: "Perihal / tentang", jenis: "teks" },
      ],
    },
    {
      id: "evaluasi", label: "Hasil evaluasi pekerjaan", jenis: "tabel", wajib: true,
      petunjuk: "Nilai yang ditulis adalah PERSETUJUAN PUSAT, bukan penawaran vendor.",
      bacaBerkas:
        "Tabel hasil evaluasi pekerjaan rampdoor. Tiap baris: uraian pekerjaan beserta mata anggarannya "
        + "(mis. “Investasi Rampdoor Haluan M.A. 1020604003”), nilai persetujuan pusat dalam rupiah, "
        + "nama vendor pelaksana, dan keterangannya.",
      kolom: [
        { id: "uraian", label: "Uraian pekerjaan", jenis: "teks", saran: [
          { nilai: "Investasi Rampdoor Haluan M.A. 1020604003", label: "Investasi Rampdoor Haluan M.A. 1020604003" },
          { nilai: "Investasi Rampdoor Buritan M.A. 1020604003", label: "Investasi Rampdoor Buritan M.A. 1020604003" },
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
      pilihan: PERTIMBANGAN_RAMPDOOR,
      awal: PERTIMBANGAN_RAMPDOOR,
      petunjuk: "Boleh menambah pertimbangan lain. Urutan centang menentukan urutan butir a, b, c di surat.",
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const ev = evaluasiIsi(d);
    if (!totalRampdoor(d)) pesan.push("Nilai persetujuan pusat masih nol — angka itu yang menjadi dasar penunjukan.");
    ev.forEach((r, n) => {
      if (!r.vendor?.trim()) pesan.push(`Baris evaluasi ke-${n + 1} belum menyebut vendor pelaksana.`);
    });
    /*
     * Uraian pekerjaan yang masih menyebut docking berarti barisnya disalin dari
     * surat docking — surat ini justru dipakai ketika pekerjaannya di luar dok.
     */
    if (ev.some((r) => /docking/i.test(r.uraian || ""))) {
      pesan.push("Ada uraian yang masih menyebut docking — surat ini untuk pekerjaan rampdoor di luar docking.");
    }
    dasarIsi(d).forEach((r, n) => {
      if (!r.tanggal?.trim()) pesan.push(`Dasar butir ${String.fromCharCode(97 + n)} belum punya tanggal.`);
    });
    return pesan;
  },

  ringkasNilai: (d) => {
    const t = totalRampdoor(d);
    return t ? { label: "Nilai pekerjaan rampdoor yang ditunjuklangsungkan", nilai: t } : null;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const tahun = esc(d.tahun || "");
    const vendor = esc(String(d.vendor || ""));
    const kota = esc(String(d.kotaVendor || "").trim());
    /*
     * Bila jenis pekerjaan diketik bebas dan kebetulan sudah memuat kata
     * "rampdoor", kata itu tidak diulang dari pilihan bagian.
     */
    const jenisKerja = String(d.jenis || "").trim();
    const bagian = String(d.bagian || "").trim();
    const pekerjaan = esc(
      /rampdoor/i.test(jenisKerja)
        ? jenisKerja
        : [jenisKerja, bagian].filter(Boolean).join(" "));
    const alasan = String(d.alasanMendesak || "").trim();
    const total = totalRampdoor(d);
    const pertimbangan = ((d.pertimbangan as string[]) || []).filter(Boolean);

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
        + `Pekerjaan ${b(pekerjaan)} ${b(esc(kapal))} tahun ${tahun} sebagai berikut :`,
      blok: tabelEvaluasi(d) || undefined,
    });

    butir.push({
      teks: `Terkait butir 1 (satu) di atas, bersama ini kami sampaikan `
        + `${b(`permohonan Persetujuan Penunjukkan Langsung Vendor untuk Pekerjaan ${pekerjaan} `
          + `${esc(kapal)} tahun ${tahun}`)} yang akan dilaksanakan oleh ${vendor}`
        + `${kota ? ` ${kota}` : ""}`
        + (total ? ` dengan nilai sebesar ${b(rupiahSurat(total))} (terbilang: ${i(terbilangRupiah(total))})` : "")
        + (alasan ? `. Pekerjaan ini tidak menunggu jadwal docking karena ${esc(alasan)}` : "")
        + `, dengan pertimbangan sebagai berikut :`,
      sub: pertimbangan.map((x, n) => `${esc(x)}${n === pertimbangan.length - 1 ? "." : ";"}`),
    });

    butir.push({ teks: PENUTUP_PERSETUJUAN });
    return bungkus(suratBernomor(butir));
  },
};
