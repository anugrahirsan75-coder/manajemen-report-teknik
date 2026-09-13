/**
 * TEMPLATE 14 — Persetujuan Tambahan Waktu (Hari) Docking.
 *
 * Satu-satunya surat pada berkas ini yang cabang KIRIM KE GALANGAN, bukan ke
 * pusat: galangan memohon perpanjangan waktu, cabang menyetujuinya dengan
 * catatan. Karena itu penutupnya "untuk dapat menjadi perhatian", bukan
 * memohon persetujuan siapa pun.
 *
 * Seluruh TANGGAL DIHITUNG, tidak diketik. Dari tanggal mulai pekerjaan dan
 * jangka waktu kontrak lahir batas kontrak; dari batas itu lahir tanggal mulai
 * tambahan; dari lamanya tambahan lahir tanggal berakhirnya. Surat acuan
 * (TN.101/00241/VI/ASDP-TTE/2026, KMP. Tuna) menyebut empat tanggal yang harus
 * saling cocok, dan mengetik keempatnya berarti membuka empat peluang meleset
 * sehari — sehari yang pada surat dendanya berubah jadi uang.
 *
 * Catatan a dan b selalu dibuat sendiri karena keduanya membawa tanggal hasil
 * hitungan. Sisanya berupa daftar centang: kalimatnya sama di tiap surat, dan
 * mengetiknya ulang hanya melahirkan kalimat berbeda untuk maksud yang sama.
 */
import { DataSurat, TemplateSurat } from "../types";
import {
  DASAR_KOSONG, GALANGAN, KAPAL_SURAT, akhirRentang, geserHari, keAngka,
  namaKapalSurat, tanggalSurat,
} from "../format";
import { terbilangAngka } from "../terbilang";
import {
  ButirSurat, kalimatDasar, PENUTUP_PERHATIAN, b, bungkus, esc, suratBernomor,
} from "../htmlHelpers";

interface BarisDasar { instansi: string; nomor: string; tanggal: string; perihal: string }

/**
 * Catatan baku yang menyertai persetujuan. Penanda {…} diisi saat surat dibuat;
 * baris yang ditambah sendiri oleh pengguna tidak punya penanda dan lewat apa
 * adanya.
 */
export const CATATAN_TAMBAH_HARI = [
  "Seluruh biaya general service yang diakibatkan oleh penambahan waktu selama {lamaTambah} menjadi tanggung jawab dari {galangan} dan pihak PT. ASDP Indonesia Ferry (Persero) Cabang Ternate dibebaskan dari biaya general service tersebut",
  "Pihak {galangan} akan dikenakan denda atas keterlambatan selama {lamaTambah} sesuai dengan pasal {pasalDenda} pada surat perjanjian nomor : {noSperj} tanggal {tglSperj}, yang mana nilai dari denda tersebut akan dipotong dari termin {terminPotong} docking",
  "Pembayaran termin {terminBayar} dari pekerjaan docking {kapal} akan dibayarkan 100% sesuai dengan pasal {pasalBayar} pada surat perjanjian nomor : {noSperj} tanggal {tglSperj} tentang Tata Cara Pembayaran",
  "Pihak galangan wajib menjaga mutu dan kualitas serta keselamatan kerja selama kapal masih melaksanakan pekerjaan docking di {galangan}",
  "Pihak galangan agar tetap berkoordinasi dengan Owner Surveyor dan Nakhoda {kapal} selama pekerjaan docking masih berlangsung",
  "Terkait dengan adanya penambahan waktu docking {kapal} selama {lamaTambah} akan dituangkan dalam sebuah Kesepakatan Bersama antara PT. ASDP Indonesia Ferry (Persero) dengan {galangan}",
];

const dasarIsi = (d: DataSurat): BarisDasar[] =>
  ((d.dasar as BarisDasar[]) || []).filter((r) => (r?.instansi || r?.nomor || r?.perihal || "").trim());

/** "5 (lima) hari" — bentuk yang dipakai di seluruh surat cabang */
const lamaHari = (n: number, satuan = "hari") => `${n} (${terbilangAngka(n)}) ${satuan}`;

/** semua tanggal diturunkan dari mulai pekerjaan + jangka waktu; tidak satu pun diketik */
export function hitungTambahHari(d: DataSurat) {
  const mulaiKontrak = String(d.mulaiKontrak || "");
  const jangka = keAngka(d.jangkaHari);
  const tambah = keAngka(d.hariTambah);
  const selesaiKontrak = jangka ? akhirRentang(mulaiKontrak, jangka) : "";
  const mulaiTambah = selesaiKontrak ? geserHari(selesaiKontrak, 1) : "";
  const selesaiTambah = mulaiTambah && tambah ? akhirRentang(mulaiTambah, tambah) : "";
  return { mulaiKontrak, jangka, tambah, selesaiKontrak, mulaiTambah, selesaiTambah };
}

export const tambahanHariDock: TemplateSurat = {
  id: "tambahan-hari-dock",
  nama: "Persetujuan Tambahan Waktu (Hari) Docking",
  perihal: "Persetujuan Tambahan Waktu (Hari) Docking {kapal} Tahun {tahun}",
  tujuan: "General Manager galangan pelaksana docking",
  deskripsi: "Jawaban cabang atas permohonan perpanjangan waktu dari galangan: batas kontrak dan rentang tambahannya dihitung sendiri, disertai catatan baku soal general service, denda, dan termin.",
  ikon: "🗓️",
  isian: [
    { id: "kapal", label: "Kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun docking", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    {
      id: "galangan", label: "Galangan pelaksana", jenis: "pilih", pilihan: GALANGAN, bebas: true, wajib: true,
      petunjuk: "Nama ini dipakai berulang di dalam catatan — tulis lengkap seperti pada surat perjanjian.",
    },
    {
      id: "dasar", label: "Dasar persetujuan", jenis: "tabel", wajib: true,
      awal: [
        { instansi: "Surat perjanjian docking", nomor: "", tanggal: "", perihal: "" },
        { instansi: "Surat dari Galangan", nomor: "", tanggal: "", perihal: "Permohonan Tambahan Waktu Docking" },
        { instansi: "Berita Acara mulai pekerjaan Docking", nomor: "", tanggal: "", perihal: "" },
        DASAR_KOSONG,
      ],
      petunjuk: "Tiga butir yang biasa dipakai: surat perjanjian docking, surat permohonan tambahan waktu dari "
        + "galangan, dan Berita Acara mulai pekerjaan.",
      bacaBerkas:
        "Daftar dasar persetujuan, ditulis sebagai butir a, b, c pada surat lama. Bentuknya: "
        + "“Surat perjanjian docking <kapal> nomor : <nomor> tanggal <tanggal>”, "
        + "“Surat dari Galangan <nama> nomor : <nomor> tanggal <tanggal> perihal Permohonan Tambahan Waktu Docking”, "
        + "atau “Berita Acara mulai pekerjaan Docking <kapal> nomor : <nomor> tanggal <tanggal>”. "
        + "Bagian sebelum kata “nomor” adalah SUMBERNYA — masukkan ke kolom instansi.",
      kolom: [
        { id: "instansi", label: "Sumber / pengirim", jenis: "teks", saran: [
          { nilai: "Surat perjanjian docking", label: "Surat perjanjian docking" },
          { nilai: "Surat dari Galangan", label: "Surat dari Galangan" },
          { nilai: "Berita Acara mulai pekerjaan Docking", label: "Berita Acara mulai pekerjaan Docking" },
          { nilai: "Berita Acara Serah Terima Kapal", label: "Berita Acara Serah Terima Kapal" },
        ] },
        { id: "nomor", label: "Nomor", jenis: "teks", lebar: "14rem" },
        { id: "tanggal", label: "Tanggal", jenis: "tanggal", lebar: "10rem" },
        { id: "perihal", label: "Perihal / keterangan", jenis: "teks" },
      ],
    },
    {
      id: "noSperj", label: "Nomor surat perjanjian", jenis: "teks", wajib: true, kolomBorang: 2,
      contoh: "Sperj.09/UM.301/TTE/ASDP-2026",
    },
    { id: "tglSperj", label: "Tanggal surat perjanjian", jenis: "tanggal", wajib: true, kolomBorang: 2 },
    {
      id: "mulaiKontrak", label: "Mulai pekerjaan (TMT)", jenis: "tanggal", wajib: true, kolomBorang: 2,
      petunjuk: "Tanggal awal jangka waktu menurut perjanjian — batas kontrak dihitung dari sini.",
    },
    {
      id: "jangkaHari", label: "Jangka waktu kontrak (hari)", jenis: "angka", wajib: true, awal: "15", kolomBorang: 2,
      petunjuk: "Dihitung inklusif: 15 hari terhitung 24 Mei berakhir 7 Juni, bukan 8 Juni.",
    },
    {
      id: "hariTambah", label: "Tambahan waktu disetujui (hari)", jenis: "angka", wajib: true, awal: "5", kolomBorang: 2,
      petunjuk: "Tanggal mulai dan berakhirnya tambahan dihitung sendiri, menyambung batas kontrak.",
    },
    { id: "pasalDenda", label: "Pasal denda pada perjanjian", jenis: "teks", awal: "12", kolomBorang: 2 },
    { id: "pasalBayar", label: "Pasal tata cara pembayaran", jenis: "teks", awal: "6", kolomBorang: 2 },
    { id: "terminPotong", label: "Termin pemotongan denda", jenis: "teks", awal: "ke-3 (pelunasan)", kolomBorang: 2 },
    { id: "terminBayar", label: "Termin dibayarkan 100%", jenis: "teks", awal: "ke-II (dua)", kolomBorang: 2 },
    {
      id: "catatan", label: "Catatan yang menyertai persetujuan", jenis: "daftar-centang",
      pilihan: CATATAN_TAMBAH_HARI, awal: CATATAN_TAMBAH_HARI,
      petunjuk: "Dua catatan pertama surat — jangka waktu kontrak dan rentang tambahannya — tidak ada di daftar ini; "
        + "keduanya selalu dibuat sendiri dari tanggal hasil hitungan. Penanda dalam kurung kurawal diisi otomatis.",
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const h = hitungTambahHari(d);
    if (!h.mulaiKontrak) pesan.push("Tanggal mulai pekerjaan belum diisi — seluruh tanggal pada surat ini dihitung darinya.");
    if (h.jangka <= 0) pesan.push("Jangka waktu kontrak masih nol hari.");
    if (h.tambah <= 0) pesan.push("Tambahan waktu masih nol hari — surat ini justru menyetujui tambahan itu.");
    if (h.tambah > 14) pesan.push(`Tambahan ${h.tambah} hari tergolong panjang — pastikan angkanya benar sebelum surat terbit.`);

    const noSperj = String(d.noSperj || "").trim();
    if (noSperj && !dasarIsi(d).some((r) => (r.nomor || "").trim() === noSperj)) {
      pesan.push(`Nomor perjanjian ${noSperj} belum muncul di daftar dasar — surat menyebutnya pada catatan, `
        + "jadi sebaiknya ada juga sebagai butir a.");
    }
    dasarIsi(d).forEach((r, n) => {
      if (!r.tanggal?.trim()) pesan.push(`Dasar butir ${String.fromCharCode(97 + n)} belum punya tanggal.`);
    });
    return pesan;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const tahun = esc(d.tahun || "");
    const galangan = String(d.galangan || "");
    const h = hitungTambahHari(d);
    const lamaTambah = lamaHari(h.tambah);

    const isiPenanda = (t: string) => t
      .replace(/\{lamaTambah\}/g, lamaTambah)
      .replace(/\{galangan\}/g, galangan)
      .replace(/\{kapal\}/g, kapal)
      .replace(/\{pasalDenda\}/g, String(d.pasalDenda || ""))
      .replace(/\{pasalBayar\}/g, String(d.pasalBayar || ""))
      .replace(/\{noSperj\}/g, String(d.noSperj || ""))
      .replace(/\{tglSperj\}/g, tanggalSurat(String(d.tglSperj || "")))
      .replace(/\{terminPotong\}/g, String(d.terminPotong || ""))
      .replace(/\{terminBayar\}/g, String(d.terminBayar || ""));

    const butir: ButirSurat[] = [{
      teks: "Memperhatikan dan mendasari :",
      sub: dasarIsi(d).map((r) => kalimatDasar(r, tanggalSurat(String(r.tanggal || "")))),
    }];

    // dua catatan pertama membawa tanggal hasil hitungan, jadi selalu dibuat sendiri
    const catatan: string[] = [
      `Jangka waktu pekerjaan docking ${esc(kapal)} sesuai surat perjanjian adalah `
        + `${b(esc(lamaHari(h.jangka)))} atau TMT. ${esc(tanggalSurat(h.mulaiKontrak))} `
        + `s/d ${esc(tanggalSurat(h.selesaiKontrak))};`,
      `Penambahan waktu ${esc(kapal)} disetujui selama ${b(esc(lamaTambah))} kalender terhitung sejak tanggal `
        + `${b(esc(tanggalSurat(h.mulaiTambah)))} s/d ${b(esc(tanggalSurat(h.selesaiTambah)))};`,
    ];
    ((d.catatan as string[]) || [])
      .filter((x) => (x || "").trim())
      .forEach((x) => catatan.push(esc(isiPenanda(x)) + ";"));

    butir.push({
      teks: `Memperhatikan butir 1 (satu) tersebut di atas, pada prinsipnya permohonan tambahan waktu docking `
        + `${esc(kapal)} tahun ${tahun} selama ${b(esc(lamaTambah))} kalender `
        + `${b("dapat kami setujui")}, dengan beberapa catatan antara lain :`,
      sub: catatan,
    });

    butir.push({ teks: PENUTUP_PERHATIAN });
    return bungkus(suratBernomor(butir));
  },
};
