/**
 * TEMPLATE 8 — Permohonan Persetujuan Pekerjaan Tambahan Docking (addendum).
 *
 * Diminta ketika docking sudah berjalan dan muncul pekerjaan di luar kontrak
 * awal: memorandum BKI saat survey pengedokan, atau usulan Owner Surveyor.
 * Karena itu surat ini SELALU bersandar pada tiga hal — surat persetujuan
 * docking yang lama, memorandum BKI, dan surat Owner Surveyor — dan ketiganya
 * ditulis sebagai butir a, b, c.
 *
 * Tabelnya berbeda dari surat docking biasa: yang ditanya pusat bukan "berapa
 * usulan cabang", melainkan berapa yang SUDAH disetujui, berapa TAMBAHANNYA,
 * dan berapa jadinya. Kolom TOTAL karena itu tidak pernah diketik — selalu
 * dihitung dari persetujuan awal ditambah usulan tambah, supaya angka di surat
 * tak mungkin berbeda dari penjumlahannya sendiri (pada surat contoh, grand
 * total yang diketik tangan memang keliru ketik).
 */
import { DataSurat, TemplateSurat } from "../types";
import { KAPAL_SURAT, angkaRibuan, keAngka, namaKapalSurat, rupiahSurat, tanggalSurat } from "../format";
import { terbilangRupiah } from "../terbilang";
import {
  ButirSurat, PENUTUP_PERIKSA, WARNA, b, baris, bungkus, esc, i, suratBernomor, tabel, td, tdAngka, th,
} from "../htmlHelpers";
import { MATA_ANGGARAN } from "./dockingInvestasi";

interface BarisDasar { instansi: string; nomor: string; tanggal: string; perihal: string }
interface BarisTambah { kode: string; uraian: string; rka: string; awal: string; tambah: string }

const investasiKah = (kode: string) => /^1020604/.test((kode || "").trim());

const dasarIsi = (d: DataSurat): BarisDasar[] =>
  ((d.dasar as BarisDasar[]) || []).filter((r) => (r?.instansi || r?.nomor || r?.perihal || "").trim());

const rincianIsi = (d: DataSurat): BarisTambah[] =>
  ((d.rincian as BarisTambah[]) || []).filter((r) => (r?.kode || r?.uraian || "").trim());

/** semua angka dihitung ulang; tidak satu pun diambil dari ketikan */
export function hitungTambahan(d: DataSurat) {
  const isi = rincianIsi(d);
  const eksploitasi = isi.filter((r) => !investasiKah(r.kode));
  const investasi = isi.filter((r) => investasiKah(r.kode));
  const jumlah = (a: BarisTambah[], k: "rka" | "awal" | "tambah") => a.reduce((s, r) => s + keAngka(r[k]), 0);
  const total = (a: BarisTambah[]) => jumlah(a, "awal") + jumlah(a, "tambah");
  return {
    eksploitasi, investasi,
    ekRka: jumlah(eksploitasi, "rka"), ekAwal: jumlah(eksploitasi, "awal"),
    ekTambah: jumlah(eksploitasi, "tambah"), ekTotal: total(eksploitasi),
    invRka: jumlah(investasi, "rka"), invAwal: jumlah(investasi, "awal"),
    invTambah: jumlah(investasi, "tambah"), invTotal: total(investasi),
    semuaRka: jumlah(isi, "rka"), semuaAwal: jumlah(isi, "awal"),
    semuaTambah: jumlah(isi, "tambah"), semuaTotal: total(isi),
  };
}

function tabelTambahan(d: DataSurat): string {
  const h = hitungTambahan(d);
  if (!h.eksploitasi.length && !h.investasi.length) return "";
  const tahun = esc(d.tahun || "");

  const kepala = baris([
    th("NO", { width: "5%" }),
    th("MATA ANGGARAN", { width: "31%" }),
    th(`RKA ${tahun}`, { width: "16%" }),
    th("PERSETUJUAN AWAL", { width: "16%" }),
    th("USULAN TAMBAH", { width: "16%" }),
    th("TOTAL", { width: "16%" }),
  ]);

  const isiBaris: string[] = [];

  /** satu kelompok: judul, baris mata anggaran, lalu subtotalnya */
  const kelompok = (judul: string, daftar: BarisTambah[], sub: {
    rka: number; awal: number; tambah: number; total: number; label: string;
  }) => {
    if (!daftar.length) return;
    isiBaris.push(baris([td(judul, { colspan: 6, tebal: true, bg: WARNA.subtotal })]));
    daftar.forEach((r, n) => {
      const nama = r.uraian || MATA_ANGGARAN.find((m) => m.kode === r.kode)?.uraian || "";
      isiBaris.push(baris([
        td(String(n + 1), { align: "center" }),
        td(`${esc(nama)}${r.kode ? `<br />(M.A. ${esc(r.kode)})` : ""}`),
        tdAngka(angkaRibuan(keAngka(r.rka))),
        tdAngka(angkaRibuan(keAngka(r.awal))),
        tdAngka(angkaRibuan(keAngka(r.tambah))),
        tdAngka(angkaRibuan(keAngka(r.awal) + keAngka(r.tambah))),
      ]));
    });
    isiBaris.push(baris([
      td(sub.label, { colspan: 2, align: "right", tebal: true, bg: WARNA.investasi }),
      tdAngka(angkaRibuan(sub.rka), { tebal: true, bg: WARNA.investasi }),
      tdAngka(angkaRibuan(sub.awal), { tebal: true, bg: WARNA.investasi }),
      tdAngka(angkaRibuan(sub.tambah), { tebal: true, bg: WARNA.investasi }),
      tdAngka(angkaRibuan(sub.total), { tebal: true, bg: WARNA.investasi }),
    ]));
  };

  kelompok("EKSPLOITASI", h.eksploitasi, {
    rka: h.ekRka, awal: h.ekAwal, tambah: h.ekTambah, total: h.ekTotal, label: "Total Eksploitasi (A)",
  });
  kelompok("INVESTASI", h.investasi, {
    rka: h.invRka, awal: h.invAwal, tambah: h.invTambah, total: h.invTotal, label: "Total Investasi (B)",
  });

  isiBaris.push(baris([
    td("GRAND TOTAL (A + B)", { colspan: 2, align: "right", tebal: true, bg: WARNA.total }),
    tdAngka(angkaRibuan(h.semuaRka), { tebal: true, bg: WARNA.total }),
    tdAngka(angkaRibuan(h.semuaAwal), { tebal: true, bg: WARNA.total }),
    tdAngka(angkaRibuan(h.semuaTambah), { tebal: true, bg: WARNA.total }),
    tdAngka(angkaRibuan(h.semuaTotal), { tebal: true, bg: WARNA.total }),
  ]));

  return tabel(isiBaris, kepala);
}

export const pekerjaanTambahan: TemplateSurat = {
  id: "pekerjaan-tambahan",
  nama: "Permohonan Pekerjaan Tambahan Docking",
  perihal: "Permohonan Persetujuan Pekerjaan Tambahan Docking {kapal} Tahun {tahun}",
  tujuan: "Direktur Teknik — Jakarta",
  deskripsi: "Addendum docking: pekerjaan di luar kontrak awal (memorandum BKI / usulan Owner Surveyor), dengan tabel persetujuan awal, tambahan, dan totalnya.",
  ikon: "➕",
  isian: [
    { id: "kapal", label: "Kapal", jenis: "pilih", pilihan: KAPAL_SURAT, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun docking", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    {
      id: "dasar", label: "Dasar permohonan", jenis: "tabel", wajib: true,
      petunjuk: "Tiga butir yang biasa dipakai: surat persetujuan docking, memorandum BKI saat survey pengedokan, "
        + "dan surat Owner Surveyor. Nomor boleh dikosongkan (memorandum BKI biasanya tanpa nomor).",
      bacaBerkas:
        "Daftar dasar permohonan, ditulis sebagai butir a, b, c pada surat lama. Bentuknya: "
        + "“Surat <pengirim> nomor : <nomor> tanggal <tanggal> perihal <perihal>”, atau untuk memorandum: "
        + "“Memorandum BKI pada survey Pengedokan <kapal> tanggal <tanggal>”. Bagian antara kata “Surat”/“dari” "
        + "dan kata “nomor” adalah PENGIRIMNYA — masukkan ke kolom instansi.",
      kolom: [
        { id: "instansi", label: "Sumber / pengirim", jenis: "teks", saran: [
          { nilai: "Surat Direktur Teknik dan Fasilitas PT. ASDP Indonesia Ferry (Persero)", label: "Surat Direktur Teknik dan Fasilitas" },
          { nilai: "Memorandum BKI pada survey Pengedokan", label: "Memorandum BKI (survey pengedokan)" },
          { nilai: "Surat dari Owner Surveyor", label: "Surat dari Owner Surveyor" },
        ] },
        { id: "nomor", label: "Nomor surat", jenis: "teks", lebar: "14rem" },
        { id: "tanggal", label: "Tanggal", jenis: "tanggal", lebar: "10rem" },
        { id: "perihal", label: "Perihal / keterangan", jenis: "teks" },
      ],
    },
    {
      id: "rincian", label: "Rincian per mata anggaran", jenis: "tabel", wajib: true,
      petunjuk: "Kolom TOTAL tidak diisi — dihitung sendiri dari persetujuan awal + usulan tambah. "
        + "Mata anggaran berkode 1020604… otomatis masuk kelompok INVESTASI.",
      bacaBerkas:
        "Tabel rincian pekerjaan tambahan per mata anggaran. Tiap baris: nama mata anggaran beserta kodenya "
        + "(mis. 5010403003, 1020604010), nilai RKA, nilai persetujuan awal, dan nilai usulan tambah. "
        + "Lewati baris Total Eksploitasi, Total Investasi, dan Grand Total — semuanya dihitung ulang.",
      kolom: [
        { id: "kode", label: "Kode M.A.", jenis: "teks", lebar: "10rem",
          saran: MATA_ANGGARAN.map((m) => ({ nilai: m.kode, label: `${m.kode} — ${m.uraian}` })) },
        { id: "uraian", label: "Uraian mata anggaran", jenis: "teks",
          saran: MATA_ANGGARAN.map((m) => ({ nilai: m.uraian, label: m.uraian })) },
        { id: "rka", label: "RKA", jenis: "rupiah", lebar: "9rem" },
        { id: "awal", label: "Persetujuan awal", jenis: "rupiah", lebar: "9rem" },
        { id: "tambah", label: "Usulan tambah", jenis: "rupiah", lebar: "9rem" },
      ],
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const h = hitungTambahan(d);
    if (!h.semuaTambah) pesan.push("Nilai usulan tambah masih nol — surat ini justru memohonkan nilai itu.");
    rincianIsi(d).forEach((r, n) => {
      if (!r.kode?.trim()) pesan.push(`Baris rincian ke-${n + 1} belum punya kode mata anggaran (penentu kelompok Eksploitasi/Investasi).`);
      if (keAngka(r.awal) + keAngka(r.tambah) > keAngka(r.rka) && keAngka(r.rka) > 0) {
        pesan.push(`Baris ke-${n + 1}: total (persetujuan awal + tambahan) melebihi RKA — pastikan angkanya benar.`);
      }
    });
    dasarIsi(d).forEach((r, n) => {
      if (!r.tanggal?.trim()) pesan.push(`Dasar butir ${String.fromCharCode(97 + n)} belum punya tanggal.`);
    });
    return pesan;
  },

  ringkasNilai: (d) => {
    const t = hitungTambahan(d).semuaTambah;
    return t ? { label: "Nilai pekerjaan tambahan dimohonkan", nilai: t } : null;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const tahun = esc(d.tahun || "");
    const h = hitungTambahan(d);

    const butir: ButirSurat[] = [{
      teks: "Berdasarkan :",
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
      teks: `Terkait butir 1 (satu) tersebut di atas, bersama ini kami mengajukan `
        + `${b(`permohonan persetujuan pekerjaan tambahan Docking ${esc(kapal)} tahun ${tahun}`)} `
        + `dengan nilai sebesar ${b(rupiahSurat(h.semuaTambah))} `
        + `(terbilang: ${i(terbilangRupiah(h.semuaTambah))}), dengan rincian sebagai berikut :`,
      blok: tabelTambahan(d) || undefined,
    });

    butir.push({ teks: PENUTUP_PERIKSA });
    return bungkus(suratBernomor(butir));
  },
};
