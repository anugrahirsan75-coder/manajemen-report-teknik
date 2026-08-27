/**
 * TEMPLATE 8 — Permohonan Bantuan Pengurusan Pembebasan (Exemption)
 * Persyaratan Damage Stability.
 *
 * Surat ini bersandar pada aturan dan surat-surat sebelumnya, lalu menyodorkan
 * DUA blok data: identitas kapal dan bahan pertimbangan lintasan. Yang
 * menentukan diterima tidaknya permohonan justru blok kedua — jarak ke dermaga
 * dan daratan terdekat serta keterlindungan geografisnya — jadi keduanya dibuat
 * sebagai isian tersendiri, bukan satu kotak teks bebas yang gampang tertinggal
 * salah satu barisnya.
 *
 * Jarak ke dermaga terdekat dihitung sendiri (setengah jarak lintasan) mengikuti
 * cara surat lama, tetapi tetap boleh ditimpa: ada lintasan yang dermaga
 * antaranya tidak persis di tengah.
 */
import { DataSurat, TemplateSurat } from "../types";
import { GALANGAN, KAPAL_SURAT, namaKapalSurat, tanggalSurat } from "../format";
import {
  ButirSurat, PENUTUP_SAMPAI, b, bungkus, esc, suratBernomor, tabelData, teksKaya,
} from "../htmlHelpers";

interface BarisDasar { instansi: string; nomor: string; tanggal: string; perihal: string }
interface BarisTimbang { label: string; isi: string }

const dasarIsi = (d: DataSurat): BarisDasar[] =>
  ((d.dasar as BarisDasar[]) || []).filter((r) => (r?.perihal || r?.nomor || "").trim());

const timbangIsi = (d: DataSurat): BarisTimbang[] =>
  ((d.pertimbangan as BarisTimbang[]) || []).filter((r) => (r?.label || "").trim());

/**
 * Angka jarak dari isian bebas ("30,34 mile" -> 30.34).
 *
 * Diambil angka PERTAMA saja: isian jarak boleh memuat rincian per ruas
 * ("137,30 mile, dengan rincian: - Bastiong–Moti 27,74 mile …"), dan yang
 * berlaku sebagai jarak lintasan adalah angka di depannya.
 */
const keJarak = (v: unknown): number => {
  const c = String(v ?? "").match(/\d+(?:[.,]\d+)?/);
  const n = Number((c?.[0] || "").replace(",", "."));
  return isFinite(n) ? n : 0;
};

const angkaId = (n: number) =>
  n.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** setengah jarak lintasan — dermaga terdekat saat kapal berada di tengah lintasan */
export const dermagaTerdekat = (d: DataSurat): string => {
  const manual = String(d.jarakDermaga || "").trim();
  if (manual) return manual;
  const j = keJarak(d.jarakLintasan);
  return j ? `${angkaId(j)} mile : 2 = ${angkaId(j / 2)} mile` : "";
};

export const exemptionStability: TemplateSurat = {
  id: "exemption-stability",
  nama: "Permohonan Exemption Damage Stability",
  perihal: "Permohonan Bantuan Pengurusan Pembebasan (Exemption) Persyaratan Damage Stability KMP. {kapal}",
  tujuan: "Group Head Optimasi dan Manajemen Armada — Jakarta",
  deskripsi: "Pembebasan damage stability pasca docking, lengkap dengan data kapal dan pertimbangan lintasan.",
  ikon: "⚖️",
  isian: [
    { id: "kapal", label: "Nama kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "tahunDocking", label: "Tahun docking", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    { id: "noRegister", label: "No. Register", jenis: "teks", wajib: true, contoh: "15588", kolomBorang: 2 },
    { id: "noIMO", label: "No. IMO", jenis: "teks", wajib: true, contoh: "8677055", kolomBorang: 2 },
    { id: "callSign", label: "Call Sign", jenis: "teks", wajib: true, contoh: "POAK", kolomBorang: 2 },
    { id: "grossTon", label: "Gross Ton", jenis: "teks", wajib: true, contoh: "598 GT", kolomBorang: 2 },
    { id: "lintasan", label: "Lintasan", jenis: "teks", wajib: true, contoh: "Tobelo – Daruba", kolomBorang: 2 },
    {
      id: "jarakLintasan", label: "Jarak lintasan", jenis: "poin", wajib: true,
      contoh: "137,30 mile, dengan rincian:\n- Bastiong–Moti : 27,74 mile\n- Moti–Makian : 7,83 mile",
      petunjuk: "Dipakai dua kali: pada data kapal dan pada perhitungan jarak ke dermaga terdekat. "
        + "Yang dihitung adalah angka pertama, jadi rincian per ruas boleh ditulis di bawahnya.",
    },
    {
      id: "jarakDermaga", label: "Jarak ke dermaga terdekat", jenis: "poin", kolomBorang: 2,
      petunjuk: "Dikosongkan = dihitung sendiri, setengah jarak lintasan seperti surat lama.",
    },
    {
      id: "jarakDaratan", label: "Jarak ke daratan terdekat", jenis: "poin", wajib: true,
      contoh: "4,00 – 6,00 mile, dengan rincian:\n- Daratan Pulau Moti : 4,00 mile\n- Desa Hafo : 6,00 mile",
    },
    {
      id: "geografis", label: "Geografis pelayaran", jenis: "poin", wajib: true,
      contoh: "Pelayaran terlindungi oleh daratan Pantai Desa Dodowo (Kabupaten Halmahera Utara) dan Daratan Desa Marimoi (Kabupaten Halmahera Timur)",
      petunjuk: "Keterlindungan inilah yang paling menentukan diterimanya permohonan.",
    },
    {
      id: "statusDocking", label: "Status docking", jenis: "pilih", wajib: true, bebas: true, kolomBorang: 2,
      awal: "Selesai pelaksanaan Docking Spesial Survey (SS)",
      pilihan: [
        "Selesai pelaksanaan Docking Spesial Survey (SS)",
        "Selesai pelaksanaan Docking Intermediate Survey (IS)",
        "Selesai pelaksanaan Docking Annual Survey (AS)",
        "Sedang dalam pelaksanaan docking",
      ],
    },
    { id: "galangan", label: "Galangan", jenis: "pilih", pilihan: GALANGAN, bebas: true, wajib: true, kolomBorang: 2 },
    {
      id: "petaLintasan", label: "Peta lintasan", jenis: "teks", awal: "Terlampir", kolomBorang: 2,
      petunjuk: "Ditulis apa adanya pada baris terakhir bahan pertimbangan.",
    },
    {
      id: "dasar", label: "Dasar dan rujukan surat", jenis: "tabel", wajib: true,
      petunjuk: "Aturan maupun surat. Baris yang tak punya nomor ditulis sebagai dasar tanpa nomor — mis. memorandum klasifikasi.",
      bacaBerkas:
        "Daftar aturan dan surat yang menjadi dasar permohonan, biasanya ditulis sebagai butir a, b, c pada surat lama. "
        + "Tiap butir memuat instansi atau penerbitnya, nomor surat/peraturan, tanggal, dan perihalnya. Contoh bentuk: "
        + "“Surat PJ. VP Survey Biro Klasifikasi Indonesia nomor A.03107/SV.201/KI-26 tanggal 13 Juli 2026 perihal …”.",
      awal: [
        { instansi: "Peraturan Menteri Perhubungan RI", nomor: "PM 44 Tahun 2021", tanggal: "", perihal: "Stabilitas Kapal" },
        { instansi: "Memorandum Badan Klasifikasi atas Kapal PT ASDP Indonesia Ferry (Persero)", nomor: "", tanggal: "", perihal: "pemenuhan damage stability kapal yang dibangun sebelum 1 Juli 2021" },
      ],
      kolom: [
        { id: "instansi", label: "Penerbit / instansi", jenis: "teks", saran: [
          { nilai: "Peraturan Menteri Perhubungan RI", label: "Peraturan Menteri Perhubungan RI" },
          { nilai: "Surat PJ. VP Survey Biro Klasifikasi Indonesia", label: "Surat PJ. VP Survey Biro Klasifikasi Indonesia" },
          { nilai: "Surat PGS. General Manager Cabang Ternate", label: "Surat PGS. General Manager Cabang Ternate" },
          { nilai: "Memorandum Badan Klasifikasi atas Kapal PT ASDP Indonesia Ferry (Persero)", label: "Memorandum Badan Klasifikasi" },
        ] },
        { id: "nomor", label: "Nomor", jenis: "teks", lebar: "13rem" },
        { id: "tanggal", label: "Tanggal", jenis: "tanggal", lebar: "10rem" },
        { id: "perihal", label: "Perihal / tentang", jenis: "teks" },
      ],
    },
    {
      id: "pertimbangan", label: "Bahan pertimbangan tambahan", jenis: "tabel",
      petunjuk: "Baris data kapal dan lintasan sudah ditulis sendiri oleh surat. Tabel ini untuk tambahan di luar itu.",
      bacaBerkas: "Daftar bahan pertimbangan berbentuk “label : isi”, mis. kondisi perairan, jam operasional, atau catatan lain.",
      kolom: [
        { id: "label", label: "Keterangan", jenis: "teks", lebar: "16rem" },
        { id: "isi", label: "Isi", jenis: "teks" },
      ],
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    dasarIsi(d).forEach((r, idx) => {
      if (!r.instansi?.trim()) pesan.push(`Dasar baris ${idx + 1} belum menyebut penerbitnya.`);
    });
    const j = keJarak(d.jarakLintasan);
    const dt = keJarak(d.jarakDaratan);
    if (j && dt && dt > j) {
      pesan.push(
        `Jarak ke daratan terdekat (${angkaId(dt)} mile) lebih jauh daripada jarak lintasannya sendiri `
        + `(${angkaId(j)} mile). Periksa lagi — angka inilah yang dinilai penerima surat.`,
      );
    }
    return pesan;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const bagian: string[] = [];

    const butir: ButirSurat[] = [{
      teks: "Memperhatikan dan mendasari hal-hal sebagai berikut :",
      sub: dasarIsi(d).map((r) => {
        const tgl = tanggalSurat(String(r.tanggal || ""));
        return [
          esc(r.instansi || ""),
          r.nomor ? `nomor ${b(esc(r.nomor))}` : "",
          tgl ? `tanggal ${esc(tgl)}` : "",
          r.perihal ? `perihal ${esc(r.perihal)}` : "",
        ].filter(Boolean).join(" ") + ";";
      }),
    }];

    butir.push({
      teks: `Terkait butir 1 (satu) di atas, dan dalam rangka pengurusan surat-surat kapal pasca `
        + `selesainya pelaksanaan docking tahun ${esc(String(d.tahunDocking || new Date().getFullYear()))}, `
        + `bersama ini kami mengajukan `
        + `${b("permohonan bantuan pengurusan pembebasan (exemption) persyaratan damage stability")} `
        + `untuk kapal sebagai berikut:`,
      blok: tabelData([
        ["Nama Kapal", esc(kapal)],
        ["No. Register", esc(d.noRegister)],
        ["No. IMO", esc(d.noIMO)],
        ["Call Sign", esc(d.callSign)],
        ["Gross Ton", esc(d.grossTon)],
        ["Lintasan", esc(d.lintasan)],
        ["Jarak Lintasan", teksKaya(d.jarakLintasan)],
      ]),
    });

    butir.push({
      teks: "Adapun sebagai bahan pertimbangan, bersama ini dapat kami sampaikan antara lain:",
      blok: tabelData([
        ["Lintasan Operasional Kapal", esc(d.lintasan)],
        ["Jarak Lintasan Kapal", teksKaya(d.jarakLintasan)],
        ["Jarak ke Dermaga Terdekat", teksKaya(dermagaTerdekat(d))],
        ["Jarak ke Daratan Terdekat", teksKaya(d.jarakDaratan)],
        ["Geografis Pelayaran", teksKaya(d.geografis)],
        ["Status Docking", esc(d.statusDocking)],
        ["Nama Galangan", esc(d.galangan)],
        ...timbangIsi(d).map((r) => [r.label, teksKaya(r.isi)] as [string, string]),
        ["Peta Lintasan", esc(d.petaLintasan || "Terlampir")],
      ]),
    });

    butir.push({ teks: PENUTUP_SAMPAI });
    bagian.push(suratBernomor(butir));
    return bungkus(bagian.join(""));
  },
};
