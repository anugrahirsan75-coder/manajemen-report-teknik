/**
 * TEMPLATE 13 — Penunjukan Langsung DUA PAKET dalam satu surat.
 *
 * Sebagian permohonan cabang memuat dua pekerjaan sekaligus yang dikerjakan
 * dua pihak berbeda: docking di galangan, dan suku cadangnya dari sole agent.
 * Contoh yang dipakai sebagai acuan: UM.301/00668/X/ASDP-TTE/2025 — docking
 * KMP. Portlink VIII di PT. Dok Kelapa Dua Permai, sekaligus pengadaan suku
 * cadang mesin induk dari PT. Pioneer.
 *
 * Yang membedakannya dari surat penunjukan satu paket bukan hanya jumlah
 * vendornya, melainkan bentuk butir pertimbangannya: alasannya DIKELOMPOKKAN
 * per vendor (a. Galangan …, b. PT Pioneer …), karena yang dinilai memang dua
 * hal berbeda — kemampuan galangan menaikkan kapal, dan keaslian barang dari
 * agen tunggal.
 *
 * Paketnya bisa dipasangkan bebas dari tiga jenis yang lazim: docking,
 * rampdoor, dan pengadaan barang. Daftar pertimbangan tiap jenis sudah
 * disiapkan sendiri-sendiri, dan yang tidak dipakai disembunyikan dari borang.
 */
import { DataSurat, TemplateSurat } from "../types";
import { DASAR_KEPUTUSAN_DIREKSI, DASAR_KOSONG, GALANGAN, KAPAL_SURAT, angkaRibuan, keAngka, namaKapalSurat, rupiahSurat, tanggalSurat } from "../format";
import { terbilangRupiah } from "../terbilang";
import {
  ButirSurat, kalimatDasar, WARNA, b, baris, bungkus, esc, i, suratBernomor, tabel, td, tdAngka, th,
} from "../htmlHelpers";

interface BarisDasar { instansi: string; nomor: string; tanggal: string; perihal: string }
interface BarisUraian { uraian: string; nilai: string; vendor: string; keterangan: string }

/** tiga jenis pekerjaan yang biasa dipasangkan dalam satu permohonan */
export const JENIS_PAKET = ["Docking", "Rampdoor", "Pengadaan Barang"] as const;
type JenisPaket = (typeof JENIS_PAKET)[number];

/** kata yang dipakai di kalimat surat untuk tiap jenis paket */
const FRASA: Record<string, string> = {
  Docking: "pekerjaan docking",
  Rampdoor: "pekerjaan rampdoor",
  "Pengadaan Barang": "pengadaan barang",
};

const PERTIMBANGAN_DOCKING = [
  "Tersedianya dock space sesuai dengan jadwal docking kapal",
  "Galangan merupakan rekanan resmi PT. ASDP Indonesia Ferry (Persero) dan telah terdaftar di e-Procurement",
  "Harga keseluruhan pekerjaan docking masih terakomodir dalam nilai persetujuan Kantor Pusat",
  "Galangan sudah berpengalaman dalam melaksanakan pekerjaan docking repair kapal",
  "Memiliki sarana dan prasarana yang memadai dalam mendukung kelancaran pelaksanaan docking repair",
  "Ketersediaan material galangan supply dan tenaga kerja berpengalaman, sehingga pekerjaan tepat waktu",
  "Jarak dari lintasan ke galangan cukup dekat dibandingkan galangan di luar wilayah tersebut, sehingga menekan biaya BBM mobilisasi",
  "Fasilitas dock galangan sanggup menaikkan kapal sesuai bobot GT-nya",
];

const PERTIMBANGAN_RAMPDOOR = [
  "Vendor berpengalaman dalam pembuatan dan penggantian rampdoor kapal penyeberangan",
  "Vendor merupakan rekanan resmi PT. ASDP Indonesia Ferry (Persero) dan telah terdaftar di e-Procurement",
  "Tersedianya material plat dan konstruksi rampdoor di workshop vendor",
  "Memiliki juru las bersertifikat sesuai persyaratan klasifikasi BKI",
  "Harga penawaran pekerjaan rampdoor masih terakomodir dalam nilai persetujuan Kantor Pusat",
  "Sanggup menyelesaikan pekerjaan sesuai jadwal yang ditetapkan cabang",
];

const PERTIMBANGAN_BARANG = [
  "Merupakan agen tunggal (sole agent) penjualan suku cadang merk tersebut di Indonesia",
  "Ketersediaan suku cadang yang dibutuhkan",
  "Suku cadang yang disupply memiliki kualitas original dan dibuktikan dengan sertifikat COO/COM pada main part",
  "Vendor merupakan rekanan resmi PT. ASDP Indonesia Ferry (Persero) dan telah terdaftar di e-Procurement",
  "Harga penawaran masih terakomodir dalam nilai persetujuan Kantor Pusat",
  "Sanggup mengirimkan barang sesuai jadwal pelaksanaan pekerjaan",
];

const PERTIMBANGAN: Record<string, string[]> = {
  Docking: PERTIMBANGAN_DOCKING,
  Rampdoor: PERTIMBANGAN_RAMPDOOR,
  "Pengadaan Barang": PERTIMBANGAN_BARANG,
};

const dasarIsi = (d: DataSurat): BarisDasar[] =>
  ((d.dasar as BarisDasar[]) || []).filter((r) => (r?.instansi || r?.nomor || r?.perihal || "").trim());

const uraianIsi = (d: DataSurat): BarisUraian[] =>
  ((d.uraian as BarisUraian[]) || []).filter((r) => (r?.uraian || r?.vendor || "").trim());

export const totalGabungan = (d: DataSurat) =>
  uraianIsi(d).reduce((s, r) => s + keAngka(r.nilai), 0);

/** paket ke-n dipakai bila jenisnya dipilih — dipakai juga untuk menyembunyikan isian */
const paketBerjenis = (d: DataSurat, jenis: JenisPaket) =>
  String(d.paket1Jenis || "") === jenis || String(d.paket2Jenis || "") === jenis;

function tabelUraian(d: DataSurat): string {
  const isi = uraianIsi(d);
  if (!isi.length) return "";

  const kepala = baris([
    th("Uraian Pekerjaan / Barang", { width: "36%" }),
    th("Persetujuan Pusat (Rp.)", { width: "20%" }),
    th("Vendor Pelaksana", { width: "24%" }),
    th("Keterangan", { width: "20%" }),
  ]);

  const isiBaris = isi.map((r) => baris([
    td(esc(r.uraian)),
    tdAngka(angkaRibuan(keAngka(r.nilai))),
    td(esc(r.vendor)),
    td(esc(r.keterangan)),
  ]));

  if (isi.length > 1) {
    isiBaris.push(baris([
      td("TOTAL", { align: "right", tebal: true, bg: WARNA.total }),
      tdAngka(angkaRibuan(totalGabungan(d)), { tebal: true, bg: WARNA.total }),
      td("", { bg: WARNA.total }),
      td("", { bg: WARNA.total }),
    ]));
  }
  return tabel(isiBaris, kepala);
}

/** satu blok pertimbangan milik satu vendor: nama vendor lalu alasannya menjorok */
function blokVendor(nama: string, alasan: string[]): string {
  if (!nama.trim() && !alasan.length) return "";
  return `<div style="margin:0 0 8px 0;">`
    + `<div style="font-weight:bold;margin:0 0 4px 0;">${esc(nama)}</div>`
    + `<ul style="list-style-type:disc;margin:0 0 6px 0;padding-left:26px;">`
    + alasan.map((x, n) => `<li style="margin:0 0 4px 0;text-align:justify;">`
      + `${esc(x)}${n === alasan.length - 1 ? "." : ";"}</li>`).join("")
    + `</ul></div>`;
}

const isianPaket = (n: 1 | 2) => {
  const p = `paket${n}`;
  return [
    {
      id: `${p}Jenis`, label: `Paket ${n} — jenis pekerjaan`, jenis: "pilih" as const,
      pilihan: [...JENIS_PAKET], wajib: true, kolomBorang: 2 as const,
      awal: n === 1 ? "Docking" : "Pengadaan Barang",
    },
    {
      id: `${p}Vendor`, label: `Paket ${n} — vendor pelaksana`, jenis: "pilih" as const,
      pilihan: GALANGAN, bebas: true, wajib: true, kolomBorang: 2 as const,
      contoh: n === 1 ? "PT. Dok Kelapa Dua Permai - Bitung" : "PT. Pioneer",
    },
    {
      id: `${p}Uraian`, label: `Paket ${n} — uraian singkat`, jenis: "teks" as const, kolomBorang: 2 as const,
      contoh: n === 1 ? "Docking tahunan" : "Suku Cadang Mesin Induk",
      petunjuk: "Dipakai pada kalimat permohonan, mis. “pekerjaan docking dan pengadaan investasi suku cadang mesin induk”.",
    },
  ];
};

export const penunjukanGabungan: TemplateSurat = {
  id: "penunjukan-gabungan",
  nama: "Permohonan Penunjukan Langsung Dua Paket (Gabungan)",
  perihal: "Permohonan Persetujuan Penunjukan Langsung {paket 1} dan {paket 2} {kapal} Tahun {tahun}",
  tujuan: "Executive Director Regional IV — Jakarta",
  deskripsi: "Satu surat untuk dua pekerjaan dan dua vendor sekaligus — docking, rampdoor, atau pengadaan barang "
    + "dipasangkan bebas; pertimbangannya dikelompokkan per vendor.",
  ikon: "🔗",
  isian: [
    { id: "kapal", label: "Kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun pekerjaan", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    ...isianPaket(1),
    ...isianPaket(2),
    {
      id: "dasar", label: "Dasar permohonan", jenis: "tabel", wajib: true,
      awal: [DASAR_KEPUTUSAN_DIREKSI, DASAR_KOSONG],
      petunjuk: "Tiga butir yang biasa dipakai: Keputusan Direksi tentang kebijakan pengadaan, surat persetujuan "
        + "pelaksanaan dari Direktur Teknik, dan surat dock space dari galangan.",
      bacaBerkas:
        "Daftar dasar permohonan, ditulis sebagai butir a, b, c pada surat lama. Bagian sebelum kata “nomor” "
        + "adalah SUMBERNYA — masukkan ke kolom instansi.",
      kolom: [
        { id: "instansi", label: "Sumber / pengirim", jenis: "teks", saran: [
          { nilai: "Keputusan Direksi PT ASDP Indonesia Ferry (Persero)", label: "Keputusan Direksi PT ASDP" },
          { nilai: "Surat Direktur Teknik dan Fasilitas", label: "Surat Direktur Teknik dan Fasilitas" },
          { nilai: "Surat dari Galangan", label: "Surat dari Galangan" },
        ] },
        { id: "nomor", label: "Nomor", jenis: "teks", lebar: "14rem" },
        { id: "tanggal", label: "Tanggal", jenis: "tanggal", lebar: "10rem" },
        { id: "perihal", label: "Perihal / tentang", jenis: "teks" },
      ],
    },
    {
      id: "uraian", label: "Uraian pekerjaan dan barang", jenis: "tabel", wajib: true,
      petunjuk: "Satu tabel untuk kedua paket. Kolom vendor yang membedakan pekerjaan siapa.",
      bacaBerkas:
        "Tabel uraian: pekerjaan atau barang beserta mata anggarannya, nilai persetujuan pusat dalam rupiah, "
        + "vendor pelaksana, dan keterangan.",
      kolom: [
        { id: "uraian", label: "Uraian", jenis: "teks", saran: [
          { nilai: "Docking Repair M.A. 5010403003", label: "Docking Repair M.A. 5010403003" },
          { nilai: "Investasi Rampdoor Haluan M.A. 1020604003", label: "Investasi Rampdoor Haluan M.A. 1020604003" },
          { nilai: "Investasi Suku Cadang Mesin Induk M.A. 1020604010", label: "Investasi Suku Cadang ME M.A. 1020604010" },
        ] },
        { id: "nilai", label: "Persetujuan pusat", jenis: "rupiah", lebar: "10rem" },
        { id: "vendor", label: "Vendor pelaksana", jenis: "teks", saran: GALANGAN.map((g) => ({ nilai: g, label: g })) },
        { id: "keterangan", label: "Keterangan", jenis: "teks", saran: [
          { nilai: "Telah terdaftar di E-Procurement", label: "Telah terdaftar di E-Procurement" },
        ] },
      ],
    },
    {
      id: "pertimbanganDocking", label: "Pertimbangan — paket docking", jenis: "daftar-centang",
      pilihan: PERTIMBANGAN_DOCKING, awal: PERTIMBANGAN_DOCKING,
      tampilBila: (d) => paketBerjenis(d, "Docking"),
      petunjuk: "Muncul karena salah satu paket berjenis Docking. Butir ini akan tampil di bawah nama vendornya.",
    },
    {
      id: "pertimbanganRampdoor", label: "Pertimbangan — paket rampdoor", jenis: "daftar-centang",
      pilihan: PERTIMBANGAN_RAMPDOOR, awal: PERTIMBANGAN_RAMPDOOR,
      tampilBila: (d) => paketBerjenis(d, "Rampdoor"),
      petunjuk: "Muncul karena salah satu paket berjenis Rampdoor.",
    },
    {
      id: "pertimbanganBarang", label: "Pertimbangan — paket pengadaan barang", jenis: "daftar-centang",
      pilihan: PERTIMBANGAN_BARANG, awal: PERTIMBANGAN_BARANG,
      tampilBila: (d) => paketBerjenis(d, "Pengadaan Barang"),
      petunjuk: "Muncul karena salah satu paket berjenis Pengadaan Barang.",
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    if (String(d.paket1Jenis || "") === String(d.paket2Jenis || "")) {
      pesan.push("Kedua paket berjenis sama — untuk satu jenis pekerjaan gunakan surat penunjukan satu paket.");
    }
    const v1 = String(d.paket1Vendor || "").trim();
    const v2 = String(d.paket2Vendor || "").trim();
    if (v1 && v2 && v1.toLowerCase() === v2.toLowerCase()) {
      pesan.push("Kedua paket menyebut vendor yang sama — periksa lagi, surat ini untuk dua pihak berbeda.");
    }
    if (!totalGabungan(d)) pesan.push("Nilai persetujuan pusat masih nol.");
    /*
     * Tiap vendor yang dimohonkan harus muncul di tabel uraian; kalau tidak,
     * Regional tidak bisa tahu paket mana yang bernilai berapa.
     */
    const daftarVendor = uraianIsi(d).map((r) => (r.vendor || "").toLowerCase());
    [v1, v2].filter(Boolean).forEach((v) => {
      if (!daftarVendor.some((x) => x.includes(v.toLowerCase().slice(0, 10)))) {
        pesan.push(`Vendor "${v}" belum muncul di tabel uraian.`);
      }
    });
    dasarIsi(d).forEach((r, n) => {
      if (!r.tanggal?.trim()) pesan.push(`Dasar butir ${String.fromCharCode(97 + n)} belum punya tanggal.`);
    });
    return pesan;
  },

  ringkasNilai: (d) => {
    const t = totalGabungan(d);
    return t ? { label: "Nilai kedua paket yang ditunjuklangsungkan", nilai: t } : null;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const tahun = esc(d.tahun || "");
    const total = totalGabungan(d);

    const paket = ([1, 2] as const).map((n) => {
      const jenis = String(d[`paket${n}Jenis`] || "") as JenisPaket;
      const daftar = jenis === "Docking" ? (d.pertimbanganDocking as string[])
        : jenis === "Rampdoor" ? (d.pertimbanganRampdoor as string[])
          : (d.pertimbanganBarang as string[]);
      return {
        jenis,
        vendor: String(d[`paket${n}Vendor`] || "").trim(),
        uraian: String(d[`paket${n}Uraian`] || "").trim(),
        alasan: (daftar || PERTIMBANGAN[jenis] || []).filter(Boolean),
      };
    });

    /*
     * "pekerjaan docking tahunan dan pengadaan investasi suku cadang mesin induk"
     *
     * Kata "barang" dilepas bila uraiannya sudah menyebut jenis barangnya
     * (investasi, suku cadang) — surat terbit menulis "pengadaan investasi
     * Suku Cadang Mesin Induk", bukan "pengadaan barang investasi …".
     */
    const frasaPaket = paket
      .map((p) => {
        let awalan = FRASA[p.jenis] || "pekerjaan";
        if (p.jenis === "Pengadaan Barang" && /^(investasi|suku cadang|spare)/i.test(p.uraian)) {
          awalan = "pengadaan";
        }
        return [awalan, p.uraian].filter(Boolean).join(" ");
      })
      .filter(Boolean).join(" dan ");

    const butir: ButirSurat[] = [{
      teks: "Berdasarkan :",
      sub: dasarIsi(d).map((r) => kalimatDasar(r, tanggalSurat(String(r.tanggal || "")))),
    }];

    butir.push({
      teks: `Terkait butir 1 (satu) tersebut di atas, bersama ini kami mengajukan `
        + `${b(`Permohonan Persetujuan Penunjukan Langsung ${frasaPaket} ${esc(kapal)} tahun ${tahun}`)}`
        + (total ? ` dengan nilai keseluruhan sebesar ${b(rupiahSurat(total))} (terbilang: ${i(terbilangRupiah(total))})` : "")
        + `, dengan uraian sebagai berikut :`,
      blok: tabelUraian(d) || undefined,
    });

    /*
     * Pertimbangan dikelompokkan per vendor. Bentuk ini yang dipakai surat
     * terbit: pembacanya menilai dua pihak yang berbeda, jadi alasannya tidak
     * boleh tercampur dalam satu daftar panjang.
     */
    butir.push({
      teks: `Adapun sebagai bahan pertimbangan dalam pemilihan vendor pelaksana ${frasaPaket} `
        + `${esc(kapal)} tahun ${tahun} antara lain :`,
      blok: paket.map((p) => blokVendor(p.vendor || p.jenis, p.alasan)).filter(Boolean).join("") || undefined,
    });

    butir.push({ teks: "Demikian usulan ini kami sampaikan, atas persetujuannya diucapkan terimakasih." });
    return bungkus(suratBernomor(butir));
  },
};
