/**
 * TEMPLATE 15 — Permohonan Modul Pembayaran Lain-Lain & Pengenaan Denda Docking.
 *
 * Dikirim ke Group Head Keuangan dan Perbendaharaan ketika galangan selesai
 * melewati jangka waktu kontrak: cabang menghitung dendanya, memotongnya dari
 * termin berikutnya, lalu meminta pembayaran termin itu lewat modul pembayaran
 * lain-lain.
 *
 * SETIAP ANGKA DIHITUNG ULANG, tidak satu pun diambil dari ketikan. Alasannya
 * ada pada surat acuannya sendiri (TN.101/00320/V/ASDP-TTE/2026, KMP. Gorango),
 * yang di dalam satu halaman menyebut tiga hal yang tak mungkin benar bersamaan:
 *
 *   · butir a menulis jangka waktu "15 hari kalender terhitung sejak serah
 *     terima kapal tanggal 13 Februari 2026 sampai dengan tanggal 08 Maret
 *     2026" — 15 hari sejak 13 Februari berakhir 27 Februari, dan 8 Maret
 *     justru tanggal Berita Acara selesainya, bukan batas kontraknya;
 *   · butir b menyebut keterlambatan 6 hari, tetapi dendanya dikenakan untuk
 *     7 hari, dan nilai rupiah yang tercetak memang 7 hari (1,4%);
 *   · Berita Acara serah terima pada butir 1 bertanggal 15 Februari, bukan 13.
 *
 * Dihitung dari tanggal serah terima yang benar (15 Februari + 15 hari inklusif
 * = 1 Maret, selesai 8 Maret), keterlambatannya memang 7 hari — angka yang
 * dipakai di tabel rupiahnya. Jadi yang keliru adalah kalimatnya, bukan uangnya.
 * Template ini menurunkan batas kontrak dan jumlah hari telat dari tanggal,
 * sehingga ketiganya tidak bisa lagi berselisih.
 */
import { DataSurat, TemplateSurat } from "../types";
import {
  DASAR_KOSONG, GALANGAN, KAPAL_SURAT, akhirRentang, angkaRibuan, keAngka, keDesimal,
  namaKapalSurat, persenSurat, rupiahSurat, selisihHari, tanggalSurat,
} from "../format";
import { terbilangAngka, terbilangRupiah } from "../terbilang";
import {
  ButirSurat, kalimatDasar, WARNA, b, baris, bungkus, esc, i, suratBernomor,
  tabel, td, tdAngka, th,
} from "../htmlHelpers";

interface BarisDasar { instansi: string; nomor: string; tanggal: string; perihal: string }

const dasarIsi = (d: DataSurat): BarisDasar[] =>
  ((d.dasar as BarisDasar[]) || []).filter((r) => (r?.instansi || r?.nomor || r?.perihal || "").trim());

const lamaHari = (n: number) => `${n} (${terbilangAngka(n)}) hari`;

/**
 * Seluruh perhitungan surat denda.
 *
 * `hariDenda` boleh dikosongkan: bila kosong dipakai jumlah keterlambatan hasil
 * hitungan. Diisi hanya bila kedua pihak bersepakat lain — dan bila isinya
 * berbeda dari hitungan, `periksa` menyebutkannya, bukan mendiamkannya.
 */
export function hitungDenda(d: DataSurat) {
  const mulaiKontrak = String(d.mulaiKontrak || "");
  const jangka = keAngka(d.jangkaHari);
  const tglSelesai = String(d.tglSelesai || "");
  const batasKontrak = jangka ? akhirRentang(mulaiKontrak, jangka) : "";

  const telat = batasKontrak && tglSelesai ? Math.max(0, selisihHari(batasKontrak, tglSelesai)) : 0;
  const diketik = keAngka(d.hariDenda);
  const hariDenda = diketik > 0 ? diketik : telat;

  const tarif = keDesimal(d.tarifDenda);
  const batasPersen = keDesimal(d.batasDenda);
  // 0,2 × 7 menghasilkan 1.4000000000000001 pada aritmetika pecahan biner;
  // dibulatkan di sini supaya nilai yang sama tidak muncul dua rupa di surat
  const persenTotal = Math.round(tarif * hariDenda * 1e6) / 1e6;

  const nilaiKontrak = keAngka(d.nilaiKontrak);
  const terminI = keAngka(d.terminI);
  const terminII = keAngka(d.terminII);

  const denda = Math.round((nilaiKontrak * persenTotal) / 100);
  return {
    mulaiKontrak, jangka, tglSelesai, batasKontrak, telat, hariDenda, diketik,
    tarif, batasPersen, persenTotal, nilaiKontrak, terminI, terminII, denda,
    sisa: nilaiKontrak - denda,
    bayarII: terminII - denda,
  };
}

function tabelDenda(d: DataSurat): string {
  const h = hitungDenda(d);
  if (!h.nilaiKontrak) return "";

  const kepala = baris([
    th("NO", { width: "8%" }),
    th("URAIAN", { width: "62%" }),
    th("NOMINAL (Rp.)", { width: "30%" }),
  ]);

  const isi: [string, string, number, boolean?][] = [
    ["a.", "Nilai Kontrak", h.nilaiKontrak],
    ["b.", `Denda keterlambatan sebesar ${persenSurat(h.tarif)}% per hari untuk ${lamaHari(h.hariDenda)}`, h.denda],
    ["c.", "Sisa nilai pekerjaan (a - b)", h.sisa],
    ["d.", "Nilai yang sudah terbayar (Termin I)", h.terminI],
    ["e.", "Nilai pembayaran kedua (Termin II) sesuai kontrak", h.terminII],
    ["f.", "Nilai yang akan dibayarkan pada pembayaran kedua (Termin II - Denda)", h.bayarII, true],
  ];

  return tabel(isi.map(([no, uraian, nilai, tonjol]) => baris([
    td(no, { align: "center", bg: tonjol ? WARNA.total : undefined }),
    td(esc(uraian), { bg: tonjol ? WARNA.total : undefined, tebal: tonjol }),
    tdAngka(angkaRibuan(nilai), { bg: tonjol ? WARNA.total : undefined, tebal: tonjol }),
  ])), kepala);
}

export const dendaDocking: TemplateSurat = {
  id: "denda-docking",
  nama: "Permohonan Pembayaran Lain-Lain & Pengenaan Denda Docking",
  perihal: "Permohonan Pembayaran Menggunakan Modul Pembayaran Lain - Lain dan Pengenaan Denda Atas Pekerjaan Docking {kapal} di {galangan}",
  tujuan: "Group Head Keuangan dan Perbendaharaan — Jakarta",
  deskripsi: "Denda keterlambatan galangan: jumlah hari telat dan nilai dendanya dihitung dari tanggal Berita Acara, lengkap dengan tabel potongan termin.",
  ikon: "⏱️",
  isian: [
    { id: "kapal", label: "Kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun docking", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    {
      id: "galangan", label: "Penyedia jasa (galangan)", jenis: "pilih", pilihan: GALANGAN, bebas: true, wajib: true,
      petunjuk: "Nama ini ikut masuk ke perihal dan disebut berulang di badan surat — tulis lengkap seperti pada perjanjian.",
    },
    {
      id: "dasar", label: "Dasar permohonan", jenis: "tabel", wajib: true,
      awal: [
        { instansi: "Surat Perjanjian", nomor: "", tanggal: "", perihal: "" },
        { instansi: "Berita Acara Serah Terima Kapal", nomor: "", tanggal: "", perihal: "" },
        { instansi: "Berita Acara Mulai Pekerjaan", nomor: "", tanggal: "", perihal: "" },
        { instansi: "Berita Acara Selesai Pekerjaan Docking", nomor: "", tanggal: "", perihal: "" },
        DASAR_KOSONG,
      ],
      petunjuk: "Empat butir yang biasa dipakai: surat perjanjian, Berita Acara serah terima kapal, "
        + "Berita Acara mulai pekerjaan, dan Berita Acara selesai pekerjaan.",
      bacaBerkas:
        "Daftar dasar permohonan, ditulis sebagai butir a, b, c, d pada surat lama. Bentuknya: "
        + "“Surat Perjanjian, Nomor : <nomor> tanggal <tanggal> perihal <perihal>” atau "
        + "“Berita Acara Selesai Pekerjaan Docking <kapal>, Nomor : <nomor> tanggal <tanggal>”. "
        + "Bagian sebelum kata “Nomor” adalah SUMBERNYA — masukkan ke kolom instansi.",
      kolom: [
        { id: "instansi", label: "Sumber / dokumen", jenis: "teks", saran: [
          { nilai: "Surat Perjanjian", label: "Surat Perjanjian" },
          { nilai: "Berita Acara Serah Terima Kapal", label: "Berita Acara Serah Terima Kapal" },
          { nilai: "Berita Acara Mulai Pekerjaan", label: "Berita Acara Mulai Pekerjaan" },
          { nilai: "Berita Acara Selesai Pekerjaan Docking", label: "Berita Acara Selesai Pekerjaan Docking" },
        ] },
        { id: "nomor", label: "Nomor", jenis: "teks", lebar: "14rem" },
        { id: "tanggal", label: "Tanggal", jenis: "tanggal", lebar: "10rem" },
        { id: "perihal", label: "Perihal / keterangan", jenis: "teks" },
      ],
    },
    {
      id: "mulaiKontrak", label: "Serah terima kapal (mulai jangka waktu)", jenis: "tanggal", wajib: true, kolomBorang: 2,
      petunjuk: "Ambil dari Berita Acara serah terima, bukan dari kalimat surat lama — batas kontrak dihitung dari sini.",
    },
    {
      id: "jangkaHari", label: "Jangka waktu kontrak (hari)", jenis: "angka", wajib: true, awal: "15", kolomBorang: 2,
      petunjuk: "Dihitung inklusif: 15 hari terhitung 15 Februari berakhir 1 Maret.",
    },
    {
      id: "tglSelesai", label: "Tanggal BA Selesai Pekerjaan", jenis: "tanggal", wajib: true, kolomBorang: 2,
      petunjuk: "Jumlah hari keterlambatan dihitung dari selisih tanggal ini dengan batas kontrak.",
    },
    {
      id: "hariDenda", label: "Hari yang dikenakan denda", jenis: "angka", kolomBorang: 2,
      petunjuk: "Kosongkan supaya memakai jumlah keterlambatan hasil hitungan. Isi hanya bila kedua pihak "
        + "bersepakat pada jumlah hari yang berbeda.",
    },
    { id: "pasalJangka", label: "Pasal jangka waktu", jenis: "teks", awal: "4", kolomBorang: 2 },
    { id: "pasalDenda", label: "Pasal denda dan sanksi", jenis: "teks", awal: "12", kolomBorang: 2 },
    { id: "tarifDenda", label: "Tarif denda per hari (%)", jenis: "teks", awal: "0,2", wajib: true, kolomBorang: 2 },
    {
      id: "batasDenda", label: "Batas maksimum denda (%)", jenis: "teks", awal: "5", kolomBorang: 2,
      petunjuk: "Dipakai sebagai pemeriksaan saja: bila tarif × hari melampauinya, surat memberi peringatan.",
    },
    { id: "nilaiKontrak", label: "Nilai kontrak", jenis: "rupiah", wajib: true, kolomBorang: 2 },
    { id: "terminI", label: "Sudah terbayar (Termin I)", jenis: "rupiah", kolomBorang: 2 },
    { id: "terminII", label: "Termin II sesuai kontrak", jenis: "rupiah", wajib: true, kolomBorang: 2 },
    { id: "terminDimohon", label: "Termin yang dimohonkan", jenis: "teks", awal: "II (dua)", kolomBorang: 2 },
    {
      id: "aplikasi", label: "Aplikasi pembayaran", jenis: "teks", awal: "FIDIAS", kolomBorang: 2,
      petunjuk: "Nama aplikasi tempat modul pembayaran lain - lain diajukan.",
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const h = hitungDenda(d);

    if (!h.mulaiKontrak) pesan.push("Tanggal serah terima kapal belum diisi — batas kontrak dan jumlah hari telat dihitung darinya.");
    if (h.jangka <= 0) pesan.push("Jangka waktu kontrak masih nol hari.");
    if (!h.tglSelesai) pesan.push("Tanggal Berita Acara selesai pekerjaan belum diisi.");
    if (h.batasKontrak && h.tglSelesai && h.telat <= 0) {
      pesan.push(`Pekerjaan selesai ${tanggalSurat(h.tglSelesai)}, masih di dalam batas kontrak `
        + `${tanggalSurat(h.batasKontrak)} — tidak ada dasar pengenaan denda.`);
    }
    if (h.diketik > 0 && h.telat > 0 && h.diketik !== h.telat) {
      pesan.push(`Hari denda diketik ${h.diketik}, sedangkan hitungan tanggal menghasilkan ${h.telat} hari `
        + `(batas kontrak ${tanggalSurat(h.batasKontrak)} → selesai ${tanggalSurat(h.tglSelesai)}). `
        + "Surat memakai angka yang diketik; pastikan itu memang kesepakatan kedua pihak.");
    }
    if (h.batasPersen > 0 && h.persenTotal > h.batasPersen) {
      pesan.push(`Denda ${persenSurat(h.persenTotal)}% melampaui batas maksimum ${persenSurat(h.batasPersen)}% `
        + "pada perjanjian — periksa kembali jumlah hari atau tarifnya.");
    }
    if (!h.nilaiKontrak) pesan.push("Nilai kontrak masih nol — seluruh angka pada tabel dihitung darinya.");
    if (h.bayarII < 0) {
      pesan.push("Denda lebih besar daripada Termin II, sehingga nilai yang dibayarkan menjadi negatif. "
        + "Pemotongan sebesar itu harus dibagi ke termin lain, bukan dituliskan apa adanya.");
    }
    if (h.nilaiKontrak && h.terminI && h.terminII) {
      const selisih = h.nilaiKontrak - (h.terminI + h.terminII);
      if (Math.abs(selisih) > 1000) {
        pesan.push(`Termin I + Termin II = ${rupiahSurat(h.terminI + h.terminII)}, sedangkan nilai kontrak `
          + `${rupiahSurat(h.nilaiKontrak)} — selisih ${rupiahSurat(Math.abs(selisih))}. `
          + "Bila memang ada termin ketiga, abaikan; bila tidak, salah satu angkanya keliru.");
      }
    }
    dasarIsi(d).forEach((r, n) => {
      if (!r.tanggal?.trim()) pesan.push(`Dasar butir ${String.fromCharCode(97 + n)} belum punya tanggal.`);
    });
    return pesan;
  },

  ringkasNilai: (d) => {
    const h = hitungDenda(d);
    return h.denda ? { label: "Denda keterlambatan dikenakan", nilai: h.denda } : null;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const tahun = esc(d.tahun || "");
    const galangan = esc(String(d.galangan || ""));
    const h = hitungDenda(d);

    const butir: ButirSurat[] = [{
      teks: "Mendasari :",
      sub: dasarIsi(d).map((r) => kalimatDasar(r, tanggalSurat(String(r.tanggal || "")))),
    }];

    const rincian: string[] = [
      `Merujuk pada pasal ${esc(d.pasalJangka || "")} Surat Perjanjian, perihal ${b("&quot;JANGKA WAKTU&quot;")}, `
        + `bahwasanya Jangka Waktu Pelaksanaan Pekerjaan adalah ${b(esc(lamaHari(h.jangka)))} kalender atau `
        + `terhitung sejak serah terima kapal tanggal ${esc(tanggalSurat(h.mulaiKontrak))} sampai dengan tanggal `
        + `${esc(tanggalSurat(h.batasKontrak))};`,
      `Merujuk pada pasal ${esc(d.pasalDenda || "")} Surat Perjanjian, perihal ${b("&quot;DENDA DAN SANKSI&quot;")}, `
        + `penyelesaian pekerjaan berdasarkan Berita Acara Selesai Pekerjaan yaitu tanggal `
        + `${b(esc(tanggalSurat(h.tglSelesai)))} bahwa pelaksanaan penyelesaian pekerjaan telah melampaui jangka `
        + "waktu yang telah ditetapkan pada dokumen perjanjian pekerjaan;",
      `Berdasarkan kondisi-kondisi tersebut di atas, penyedia jasa mengalami keterlambatan selama `
        + `${b(esc(lamaHari(h.telat)))} kalender. Maka dari itu kedua belah pihak menyepakati untuk mengenakan `
        + `denda sebesar ${b(`${persenSurat(h.tarif)}%`)} per hari untuk ${b(esc(lamaHari(h.hariDenda)))} dari `
        + `nilai pekerjaan kepada ${galangan} pada Pekerjaan Docking ${esc(kapal)} Tahun ${tahun};`,
      `Pembayaran denda dilakukan dengan mekanisme pemotongan nilai invoice/tagihan ${galangan} terdekat sejak `
        + `Berita Acara ini ditandatangani, dengan nilai potongan sejumlah denda ${b(`${persenSurat(h.persenTotal)}%`)} `
        + `untuk ${esc(lamaHari(h.hariDenda))} melalui sistem pembayaran PT. ASDP Indonesia Ferry (Persero);`,
      "Dengan adanya denda keterlambatan di atas, maka pembayaran pekerjaan akan dikurangi dengan nilai "
        + "keterlambatan tersebut, dengan rincian sebagai berikut :",
    ];

    butir.push({
      teks: "Sehubungan dengan butir 1 (satu) tersebut di atas, bersama ini kami sampaikan hal - hal sebagai berikut :",
      sub: rincian,
      blok: tabelDenda(d) || undefined,
    });

    butir.push({
      teks: `Mengacu pada butir 1 (satu) dan 2 (dua) tersebut di atas, untuk selanjutnya kami mengajukan `
        + `${b("permohonan penggunaan modul pembayaran lain - lain")} pada aplikasi ${esc(d.aplikasi || "")} untuk `
        + `pembayaran termin ${esc(d.terminDimohon || "")} sebesar ${b(rupiahSurat(h.bayarII))} `
        + `(terbilang: ${i(terbilangRupiah(h.bayarII))}) serta pengenaan denda sesuai dengan Perjanjian, `
        + "dengan rincian sebagaimana tersebut di atas.",
    });

    butir.push({ teks: "Demikian dapat kami sampaikan, atas bantuan dan kerjasamanya kami ucapkan terimakasih." });
    return bungkus(suratBernomor(butir));
  },
};
