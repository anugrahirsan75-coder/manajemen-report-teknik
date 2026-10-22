/**
 * Permohonan Persetujuan Kebutuhan Suku Cadang Kapal — Cabang Ternate.
 *
 * Mengikuti surat yang sudah terbit, TN.205/00229/IV/ASDP-TTE/2026 tanggal
 * 01 April 2026 perihal Permohonan Kebutuhan Operasional Kapal: butir 1 berisi
 * daftar dasar sebagai sub-butir a, b, c; butir berikutnya mengajukan nilainya
 * beserta rincian; butir terakhir penutup. Tujuannya Direktur Teknik.
 *
 * TIGA HAL YANG MEMBEDAKANNYA DARI SURAT KEBUTUHAN OPERASIONAL.
 *
 * Pertama, butir 1 tidak hanya memuat permintaan kapal. Suku cadang diminta
 * karena ada yang tidak beres, jadi LAPORAN KETIDAKSESUAIAN ikut menjadi dasar
 * — tanpa itu surat ini hanya menyebut barang apa yang diminta, bukan kenapa.
 *
 * Kedua, butir 1 selalu dibuka dengan RKA Kapal Cabang Ternate tahun berjalan.
 * Baris itu TIDAK diketik dan tidak bisa lupa ditulis: ia dipasang sendiri dari
 * tahun pada borang. Permohonan belanja yang tidak menyebut dasar anggarannya
 * adalah permohonan yang akan ditanya balik di meja pertama.
 *
 * Ketiga, ada butir penjelasan tersendiri dari segi TEKNIK dan OPERASIONAL.
 * Surat kebutuhan operasional langsung meloncat dari daftar dasar ke angka;
 * untuk suku cadang itu tidak cukup, karena yang diputuskan pusat bukan sekadar
 * nilainya melainkan apakah kerusakannya memang menghambat kapal beroperasi.
 *
 * Seperti template lain di folder ini, seluruh angka dihitung ulang dari baris
 * rinciannya — tidak ada total yang diambil dari ketikan.
 */
import { DataSurat, TemplateSurat } from "../types";
import { KAPAL_SURAT, angkaRibuan, keAngka, namaKapalSurat, rupiahSurat, tanggalSurat } from "../format";
import { terbilangRupiah } from "../terbilang";
import {
  ButirSurat, PENUTUP_PERIKSA, WARNA, b, baris, bungkus, esc, i, suratBernomor,
  tabel, td, tdAngka, teksKaya, th,
} from "../htmlHelpers";
import { MATA_ANGGARAN } from "./dockingInvestasi";

interface BarisDasar { jenis: string; kapal: string; nomor: string; tanggal: string; perihal: string }
interface BarisRincian { kapal: string; barang: string; kode: string; nilai: string }

/** jenis dasar yang dipakai surat ini; yang lain boleh diketik sendiri */
const JENIS_DASAR = [
  "Surat Permintaan Pengadaan Barang/Jasa (SPPB/J-Kapal)",
  "Laporan Ketidaksesuaian",
  "Laporan Kerusakan",
  "Nota Dinas",
];

const dasarIsi = (d: DataSurat): BarisDasar[] =>
  ((d.dasar as BarisDasar[]) || []).filter((r) => (r?.jenis || r?.kapal || r?.nomor || "").trim());

const rincianIsi = (d: DataSurat): BarisRincian[] =>
  ((d.rincian as BarisRincian[]) || []).filter((r) => (r?.kapal || r?.barang || "").trim());

export const totalSukuCadang = (d: DataSurat): number =>
  rincianIsi(d).reduce((s, r) => s + keAngka(r.nilai), 0);

/** "Rencana Kerja dan Anggaran (RKA) Kapal Cabang Ternate Tahun 2026" */
const kalimatRka = (tahun: string) =>
  `Rencana Kerja dan Anggaran (RKA) Kapal Cabang Ternate Tahun ${esc(tahun)};`;

/**
 * Satu baris dasar menjadi satu kalimat sub-butir.
 *
 * Memakai kata "tentang", bukan "perihal", mengikuti surat kebutuhan
 * operasional yang sudah terbit. Bagian yang kosong dibuang, bukan dicetak
 * sebagai "nomor : " yang menggantung.
 */
const kalimatDasarKapal = (r: BarisDasar): string => [
  esc(r.jenis || ""),
  r.kapal ? esc(namaKapalSurat(String(r.kapal))) : "",
  r.nomor ? `nomor : ${b(esc(r.nomor))}` : "",
  tanggalSurat(String(r.tanggal || "")) ? `tanggal ${esc(tanggalSurat(String(r.tanggal || "")))}` : "",
  r.perihal ? `tentang ${esc(r.perihal)}` : "",
].filter(Boolean).join(" ") + ";";

/**
 * Sel mata anggaran: uraiannya di atas, kodenya di bawah dalam kurung.
 *
 * Kode yang tidak ada di daftar tetap dicetak apa adanya — daftar mata
 * anggaran bisa bertambah lebih dulu di SAP daripada di aplikasi ini, dan
 * menelan kode yang tidak dikenal akan menghilangkannya dari surat.
 */
const selMataAnggaran = (kode: string): string => {
  const k = (kode || "").trim();
  if (!k) return "";
  const uraian = MATA_ANGGARAN.find((m) => m.kode === k)?.uraian || "";
  return `${uraian ? `${esc(uraian)}<br />` : ""}(M.A. ${esc(k)})`;
};

function tabelRincian(d: DataSurat): string {
  const isi = rincianIsi(d);
  if (!isi.length) return "";

  const kepala = baris([
    th("NO", { width: "5%" }),
    th("KAPAL", { width: "18%" }),
    th("URAIAN KEBUTUHAN SUKU CADANG", { width: "39%" }),
    th("MATA ANGGARAN", { width: "20%" }),
    th("NILAI (Rp)", { width: "18%" }),
  ]);

  const isiBaris = isi.map((r, n) => baris([
    td(String(n + 1), { align: "center" }),
    td(esc(namaKapalSurat(String(r.kapal || "")))),
    td(esc(r.barang || "")),
    td(selMataAnggaran(r.kode)),
    tdAngka(angkaRibuan(keAngka(r.nilai))),
  ]));

  isiBaris.push(baris([
    td("TOTAL", { colspan: 4, align: "right", tebal: true, bg: WARNA.total }),
    tdAngka(angkaRibuan(totalSukuCadang(d)), { tebal: true, bg: WARNA.total }),
  ]));

  return tabel(isiBaris, kepala);
}

export const sukuCadangKapal: TemplateSurat = {
  id: "suku-cadang-kapal",
  nama: "Permohonan Persetujuan Kebutuhan Suku Cadang Kapal",
  perihal: "Permohonan Persetujuan Kebutuhan Suku Cadang Kapal Cabang Ternate Tahun {tahun}",
  tujuan: "Direktur Teknik — Jakarta",
  deskripsi:
    "Permintaan suku cadang dari kapal beserta laporan ketidaksesuaiannya, dijelaskan dari segi teknik "
    + "dan operasional. Butir 1 otomatis dibuka dengan RKA Kapal Ternate tahun berjalan.",
  ikon: "⚙️",
  isian: [
    {
      id: "tahun", label: "Tahun anggaran (RKA)", jenis: "angka", wajib: true,
      awal: String(new Date().getFullYear()), kolomBorang: 2,
      petunjuk: "Dipakai pada perihal dan pada butir 1.a — \"RKA Kapal Cabang Ternate Tahun ….\".",
    },
    {
      id: "dasar", label: "Permintaan kapal & laporan ketidaksesuaian", jenis: "tabel", wajib: true,
      petunjuk:
        "Satu baris untuk satu surat. RKA Kapal Cabang Ternate TIDAK perlu ditulis di sini — "
        + "ia dipasang sendiri sebagai butir 1.a dari tahun anggaran di atas.",
      bacaBerkas:
        "Daftar surat yang menjadi dasar permohonan, ditulis sebagai butir a, b, c. Bentuknya: "
        + "“Surat Permintaan Pengadaan Barang/Jasa (SPPB/J-Kapal) Kmp. <kapal> nomor : <nomor> "
        + "tanggal <tanggal> tentang <perihal>”, atau “Laporan Ketidaksesuaian Kmp. <kapal> nomor : …”. "
        + "Nama kapal masuk kolom kapal, jenis suratnya masuk kolom jenis. Lewati baris RKA.",
      kolom: [
        {
          id: "jenis", label: "Jenis dokumen", jenis: "teks",
          saran: JENIS_DASAR.map((x) => ({ nilai: x, label: x })),
        },
        {
          id: "kapal", label: "Kapal", jenis: "teks", lebar: "11rem",
          saran: KAPAL_SURAT.map((x) => ({ nilai: x, label: x })),
        },
        { id: "nomor", label: "Nomor surat", jenis: "teks", lebar: "14rem" },
        { id: "tanggal", label: "Tanggal", jenis: "tanggal", lebar: "10rem" },
        { id: "perihal", label: "Tentang / keterangan", jenis: "teks" },
      ],
    },
    {
      id: "teknik", label: "Penjelasan segi teknik", jenis: "poin", wajib: true,
      petunjuk: "Baris berawalan \"-\" menjadi butir. Jelaskan kondisi komponennya, bukan nama barangnya.",
      contoh: "- Injection pump mesin bantu mengalami kebocoran sehingga tekanan bahan bakar tidak tercapai.",
    },
    {
      id: "operasional", label: "Penjelasan segi operasional", jenis: "poin", wajib: true,
      petunjuk: "Akibatnya pada pelayanan lintasan: jadwal, kecepatan, atau kesiapan kapal.",
      contoh: "- Kapal hanya dapat beroperasi dengan satu mesin bantu, sehingga jadwal lintasan terganggu.",
    },
    {
      id: "rincian", label: "Rincian kebutuhan suku cadang", jenis: "tabel", wajib: true,
      petunjuk: "Kolom TOTAL tidak diisi — dihitung sendiri dari baris-baris di atasnya.",
      bacaBerkas:
        "Tabel kebutuhan suku cadang. Tiap baris: nama kapal, uraian suku cadang beserta jumlahnya, "
        + "kode mata anggaran bila ada (mis. 5010403100), dan nilainya dalam rupiah. "
        + "Lewati baris Total — dihitung ulang.",
      kolom: [
        {
          id: "kapal", label: "Kapal", jenis: "teks", lebar: "11rem",
          saran: KAPAL_SURAT.map((x) => ({ nilai: x, label: x })),
        },
        /*
         * Kolomnya bernama "barang", bukan "uraian".
         *
         * Borang tabel punya aturan lama: memilih kode mata anggaran ikut
         * mengisi kolom bernama "uraian", karena pada surat docking kolom itu
         * memang uraian mata anggarannya. Di sini "uraian" berarti nama suku
         * cadangnya, jadi nama kolom yang sama akan membuat nama barang yang
         * sudah diketik terhapus diam-diam begitu kode M.A. dipilih.
         */
        { id: "barang", label: "Uraian suku cadang", jenis: "teks" },
        {
          id: "kode", label: "Kode M.A.", jenis: "teks", lebar: "10rem",
          saran: MATA_ANGGARAN.map((m) => ({ nilai: m.kode, label: `${m.kode} — ${m.uraian}` })),
        },
        { id: "nilai", label: "Nilai", jenis: "rupiah", lebar: "9rem" },
      ],
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const total = totalSukuCadang(d);
    if (!total) pesan.push("Nilai kebutuhan masih nol — surat ini justru memohonkan nilai itu.");

    dasarIsi(d).forEach((r, n) => {
      const huruf = String.fromCharCode(98 + n);   // a dipakai RKA
      if (!r.tanggal?.trim()) pesan.push(`Dasar butir ${huruf} belum punya tanggal.`);
      if (!r.kapal?.trim()) pesan.push(`Dasar butir ${huruf} belum menyebut kapal.`);
    });

    /*
     * Pemeriksaan silang yang menjadi alasan surat ini dibuat di aplikasi.
     *
     * Kapal yang suku cadangnya dimintakan tetapi tidak punya surat permintaan
     * pada butir 1 adalah kapal yang permohonannya tidak berdasar — dan itu
     * tidak akan terlihat dengan membaca ulang suratnya, karena kedua daftar
     * berada di halaman yang berbeda.
     */
    const kunci = (v: string) => namaKapalSurat(String(v || "")).toUpperCase().replace(/\s+/g, " ").trim();
    const adaDasar = new Set(dasarIsi(d).map((r) => kunci(r.kapal)));
    const kurang = Array.from(new Set(
      rincianIsi(d).map((r) => kunci(r.kapal)).filter((k) => k && !adaDasar.has(k))));
    kurang.forEach((k) => pesan.push(
      `${k} ada di rincian tetapi tidak punya surat permintaan pada butir 1 — tambahkan dasarnya.`));

    /*
     * Laporan ketidaksesuaian sengaja hanya diingatkan, bukan diwajibkan:
     * ada suku cadang yang diminta sebagai persediaan rutin, bukan karena
     * sesuatu rusak.
     */
    const adaLks = dasarIsi(d).some((r) => /ketidaksesuaian|kerusakan/i.test(r.jenis || ""));
    if (!adaLks && dasarIsi(d).length) {
      pesan.push("Belum ada Laporan Ketidaksesuaian pada butir 1 — abaikan bila kebutuhannya memang rutin.");
    }
    return pesan;
  },

  ringkasNilai: (d) => {
    const t = totalSukuCadang(d);
    return t ? { label: "Nilai kebutuhan suku cadang dimohonkan", nilai: t } : null;
  },

  generate(d) {
    const tahun = String(d.tahun || "");
    const total = totalSukuCadang(d);

    const butir: ButirSurat[] = [];

    // ── butir 1: RKA lebih dulu, baru permintaan kapal & laporannya ───────
    butir.push({
      teks: "Memperhatikan dan mendasari :",
      sub: [kalimatRka(tahun), ...dasarIsi(d).map(kalimatDasarKapal)],
    });

    // ── butir 2: kenapa dibutuhkan, dari dua sisi ─────────────────────────
    butir.push({
      teks: "Terkait butir 1 (satu) tersebut di atas, kebutuhan suku cadang dimaksud dapat kami "
        + "jelaskan sebagai berikut :",
      sub: [
        `${b("Dari segi teknik")} :<br />${teksKaya(d.teknik)}`,
        `${b("Dari segi operasional")} :<br />${teksKaya(d.operasional)}`,
      ],
    });

    // ── butir 3: nilainya, dengan rinciannya ──────────────────────────────
    butir.push({
      teks: "Berdasarkan butir 1 (satu) dan butir 2 (dua) tersebut di atas, bersama ini kami mengajukan "
        + `${b(`permohonan persetujuan kebutuhan suku cadang kapal Cabang Ternate Tahun ${esc(tahun)}`)} `
        + `dengan nilai sebesar ${b(rupiahSurat(total))} `
        + `(terbilang : ${i(terbilangRupiah(total))}), dengan rincian sebagai berikut :`,
      blok: tabelRincian(d) || undefined,
    });

    butir.push({ teks: PENUTUP_PERIKSA });
    return bungkus(suratBernomor(butir));
  },
};
