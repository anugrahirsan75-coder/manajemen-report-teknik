/**
 * TEMPLATE 2 — Laporan Realisasi Perawatan Rutin Kapal (bulanan).
 *
 * Tabelnya per kapal dengan dua kolom nilai; baris TOTAL dihitung ulang dari
 * isian, tidak pernah diketik. Di berkas lama pernah ada total yang tidak sama
 * dengan penjumlahan kolomnya, jadi di sini disediakan kolom pembanding yang
 * memunculkan peringatan bila berbeda.
 */
import { DataSurat, TemplateSurat } from "../types";
import { KAPAL_SURAT, NAMA_BULAN, angkaRibuan, keAngka, rupiahSurat } from "../format";
import { terbilangRupiah } from "../terbilang";
import {
  PENUTUP_SAMPAI, SALAM, WARNA, b, baris, bungkus, esc, i, p, tabel, td, tdAngka, th,
} from "../htmlHelpers";

interface BarisKapal { kapal: string; rka: string; cabang: string }

const isiBaris = (d: DataSurat): BarisKapal[] =>
  ((d.tabel as BarisKapal[]) || []).filter((r) => (r?.kapal || "").trim());

export function hitungRutin(d: DataSurat) {
  const isi = isiBaris(d);
  return {
    isi,
    totalRka: isi.reduce((s, r) => s + keAngka(r.rka), 0),
    totalCabang: isi.reduce((s, r) => s + keAngka(r.cabang), 0),
  };
}

export const realisasiRutin: TemplateSurat = {
  id: "realisasi-rutin",
  nama: "Laporan Realisasi Perawatan Rutin Kapal",
  perihal: "Laporan Realisasi Perawatan Kapal Bulan {bulanRealisasi} dan Rencana Perawatan Kapal Bulan {bulanRencana} Cabang Ternate",
  tujuan: "Direktur Teknik dan Fasilitas — Jakarta",
  deskripsi: "Laporan bulanan per kapal; total dan terbilang dihitung otomatis dari tabel.",
  ikon: "🗓️",
  isian: [
    { id: "tahunRka", label: "Tahun RKA", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    { id: "bulanRealisasi", label: "Bulan realisasi", jenis: "pilih", pilihan: NAMA_BULAN, wajib: true, kolomBorang: 2 },
    { id: "tahunRealisasi", label: "Tahun realisasi", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    { id: "bulanRencana", label: "Bulan rencana", jenis: "pilih", pilihan: NAMA_BULAN, wajib: true, kolomBorang: 2 },
    { id: "tahunRencana", label: "Tahun rencana", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    { id: "bulanKolomRka", label: "Bulan pada judul kolom RKA", jenis: "pilih", pilihan: NAMA_BULAN, wajib: true, petunjuk: "Dipakai di kepala tabel: “USULAN RKA {bulan} TAHUN {tahun}”.", kolomBorang: 2 },
    {
      id: "tabel", label: "Rincian per kapal", jenis: "tabel", wajib: true,
      kolom: [
        { id: "kapal", label: "Nama kapal", jenis: "teks", saran: KAPAL_SURAT.map((k) => ({ nilai: k, label: k })) },
        { id: "rka", label: "Usulan RKA", jenis: "rupiah", lebar: "10rem" },
        { id: "cabang", label: "Usulan Cabang", jenis: "rupiah", lebar: "10rem" },
      ],
    },
    { id: "periksaTotal", label: "Total pembanding (opsional)", jenis: "rupiah", petunjuk: "Peringatan muncul bila berbeda dengan hasil hitung.", kolomBorang: 2 },
  ],

  periksa(d) {
    const h = hitungRutin(d);
    const pesan: string[] = [];
    const banding = keAngka(d.periksaTotal);
    if (banding && banding !== h.totalCabang) {
      pesan.push(`Total pembanding ${rupiahSurat(banding)} tidak sama dengan hasil hitung ${rupiahSurat(h.totalCabang)} `
        + `(selisih ${rupiahSurat(Math.abs(banding - h.totalCabang))}).`);
    }
    const kembar = h.isi.map((r) => r.kapal.trim().toLowerCase())
      .filter((v, idx, a) => v && a.indexOf(v) !== idx);
    if (kembar.length) pesan.push(`Ada kapal yang ditulis dua kali: ${Array.from(new Set(kembar)).join(", ")}.`);
    return pesan;
  },

  ringkasNilai: (d) => ({ label: "Total usulan cabang", nilai: hitungRutin(d).totalCabang }),

  generate(d) {
    const h = hitungRutin(d);
    const bagian: string[] = [];

    bagian.push(p(SALAM));
    bagian.push(p(`Berdasarkan Usulan Rencana Kerja dan Anggaran (RKA) Pemeliharaan Cabang Ternate Tahun ${esc(d.tahunRka || "")}.`));
    bagian.push(p(
      `Sehubungan dengan hal tersebut di atas, bersama ini kami sampaikan `
      + `${b(`laporan realisasi perawatan rutin kapal bulan ${esc(d.bulanRealisasi || "")} Tahun ${esc(d.tahunRealisasi || "")}`)} `
      + `dan ${b(`rencana perawatan kapal bulan ${esc(d.bulanRencana || "")} Tahun ${esc(d.tahunRencana || "")}`)} `
      + `Cabang Ternate dengan nilai sebesar ${b(rupiahSurat(h.totalCabang))} `
      + `(terbilang: ${i(terbilangRupiah(h.totalCabang))}), dengan rincian sebagai berikut:`,
    ));

    if (h.isi.length) {
      const gaya = { bg: WARNA.kepalaKuning, putih: false, tebal: true, align: "center" as const };
      // kepala dipisah supaya tercetak ulang bila daftar kapal jatuh ke halaman berikutnya
      const kepala = baris([
        th("NO", { ...gaya, width: "6%" }),
        th("NAMA KAPAL", { ...gaya, width: "40%" }),
        th(`USULAN RKA ${String(d.bulanKolomRka || "").toUpperCase()} TAHUN ${esc(d.tahunRka || "")}`, { ...gaya, width: "27%" }),
        th("USULAN CABANG", { ...gaya, width: "27%" }),
      ]);
      const barisTabel: string[] = [
        ...h.isi.map((r, idx) => baris([
          td(String(idx + 1), { align: "center", width: "6%" }),
          td(esc(r.kapal), { width: "40%" }),
          tdAngka(angkaRibuan(keAngka(r.rka)), { width: "27%" }),
          tdAngka(angkaRibuan(keAngka(r.cabang)), { width: "27%" }),
        ])),
        baris([
          td("TOTAL", { colspan: 2, align: "right", tebal: true }),
          tdAngka(angkaRibuan(h.totalRka), { tebal: true }),
          tdAngka(angkaRibuan(h.totalCabang), { tebal: true }),
        ]),
      ];
      bagian.push(tabel(barisTabel, kepala));
    }

    bagian.push(p(PENUTUP_SAMPAI));
    return bungkus(bagian.join("\n"));
  },
};
