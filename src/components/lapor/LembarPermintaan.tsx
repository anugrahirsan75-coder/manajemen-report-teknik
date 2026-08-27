"use client";
/**
 * Cetakan borang "PERMINTAAN PENGADAAN BARANG/JASA KAPAL" (HP-103.00.01 Rev.06).
 *
 * Isi lembarnya BUKAN tiruan: tabelnya adalah markup Word cabang apa adanya
 * (lib/lapor/borangTemplate.ts, hasil ekspor berkas aslinya), sehingga lebar
 * tiap sel, garis utuh untuk bingkai, garis titik-titik untuk pemisah antar
 * barang, dan tinggi tiap baris datang dari sumbernya sendiri. Percobaan
 * pertama meniru ukuran itu dengan tangan dan hasilnya "mirip tapi tidak sama"
 * — dan mirip saja tidak cukup untuk berkas yang harus setumpuk dengan arsip.
 *
 * Yang dibangun di berkas ini hanya dua hal yang memang tidak ikut terekspor
 * Word: kop dokumen (di berkas asli letaknya pada header halaman) dan catatan
 * kaki. Keduanya memakai ukuran dari berkas yang sama: kolom kop 106/220/95/118
 * pt, kertas A4 dengan tepi kiri 58pt sementara tabelnya menggantung 17,7pt ke
 * kiri dari tepi itu.
 *
 * Saat mencetak, seluruh halaman lain disembunyikan lewat @media print.
 */
import { FormulirPermintaan } from "@/lib/lapor/formulir";
import { isiBorang } from "@/lib/lapor/borangIsi";

export default function LembarPermintaan({ f }: { f: FormulirPermintaan }) {
  return (
    <div className="lp-bingkai">
      <style>{gaya}</style>
      <div className="lp-lembar">
        {/* ── kop dokumen: tabel 4x4, kolom 106/220/95/118 pt ───────────── */}
        <table className="lp-kop">
          <tbody>
            <tr>
              <td className="lp-kop-logo" rowSpan={4}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-asdp.png" alt="ASDP" />
              </td>
              <td className="lp-kop-judul" rowSpan={4}>PERMINTAAN PENGADAAN BARANG/JASA KAPAL</td>
              <td className="lp-kop-label">No. Dokumen</td>
              <td className="lp-kop-isi">: HP-103.00.01</td>
            </tr>
            <tr><td className="lp-kop-label">Revisi</td><td className="lp-kop-isi">: 06</td></tr>
            <tr><td className="lp-kop-label">Berlaku Efektif</td><td className="lp-kop-isi">: 25 April 2024</td></tr>
            <tr><td className="lp-kop-label">Halaman</td><td className="lp-kop-isi">: 1 dari 1</td></tr>
          </tbody>
        </table>

        {/* badan borang — markup asli dari berkas Word, penandanya sudah diisi */}
        <div className="lp-badan" dangerouslySetInnerHTML={{ __html: isiBorang(f) }} />

        <div className="lp-footer">Dilarang Mengcopy /Menyebarluaskan Tanpa Izin DPA</div>
      </div>
    </div>
  );
}

/*
 * Ukuran ditulis dalam milimeter dan point — yang dituju kertas, bukan layar.
 * Tepi kiri lembar 14,2mm: tepi teks berkas aslinya 58pt (20,5mm) sementara
 * tabelnya menggantung 17,7pt (6,2mm) ke kiri dari situ.
 */
const gaya = `
.lp-bingkai { display: flex; justify-content: center; }
.lp-lembar {
  width: 210mm; min-height: 297mm; box-sizing: border-box;
  padding: 12mm 5.8mm 12mm 14.2mm;
  background: #fff; color: #000;
  font-family: "FrutigerExt-Normal", Arial, Helvetica, sans-serif;
  font-size: 10pt; line-height: 1.15;
}
.lp-lembar table { border-collapse: collapse; }
.lp-lembar p { margin: 0; }
.lp-badan table { width: 190mm; }   /* lebar kolom datang dari baris pengunci Word, bukan dari table-layout */
.lp-badan td { word-wrap: break-word; overflow-wrap: break-word; font-size: 10pt; }

.lp-kop { width: 190mm; table-layout: fixed; margin-bottom: 2mm; }
.lp-kop td { border: 1pt solid #000; padding: 1mm 1.4mm; vertical-align: middle; }
.lp-kop-logo { width: 37.4mm; text-align: center; }
.lp-kop-logo img { width: 30mm; height: auto; display: inline-block; }
.lp-kop-judul { width: 77.6mm; text-align: center; font-weight: bold; font-size: 12pt; }
.lp-kop-label { width: 33.5mm; font-size: 9pt; }
.lp-kop-isi { width: 41.6mm; font-size: 9pt; }

.lp-footer { width: 190mm; margin-top: 2mm; font-size: 7.5pt; font-style: italic; text-align: center; }

@media screen and (max-width: 900px) { .lp-bingkai { overflow-x: auto; } }

@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  .lp-bingkai, .lp-bingkai * { visibility: visible !important; }
  .lp-bingkai { position: absolute; left: 0; top: 0; width: 100%; display: block; }
  .lp-lembar { box-shadow: none !important; margin: 0; }
  .lp-badan tr { page-break-inside: avoid; }
}
`;
