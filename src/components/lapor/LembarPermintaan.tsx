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
          {/*
            Lebar kolom dipasang lewat <colgroup>, bukan pada selnya. Pada sel,
            angka lebar itu lebar ISI — lapisan dalamnya (padding) ditambahkan di
            luar itu, sehingga kop membengkak melewati tepi kertas. Akibatnya
            bukan cuma kopnya: Chrome mengecilkan SELURUH halaman supaya muat,
            dan seisi borang ikut menyusut tiga persen. Itu yang membuat lembar
            ini tidak pernah sama dengan aslinya betapa pun ukurannya dibetulkan.
          */}
          <colgroup>
            <col style={{ width: "37.40mm" }} />
            <col style={{ width: "77.60mm" }} />
            <col style={{ width: "33.50mm" }} />
            <col style={{ width: "41.55mm" }} />
          </colgroup>
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
/*
 * Tepi lembar diambil dari cetakan aslinya, bukan dari tepi teks Word: garis
 * kiri tabel jatuh 12,7mm dari tepi kertas dan sisi kanannya 7,3mm — itu yang
 * terukur pada berkas PDF cabang, sesudah tabelnya menggantung ke kiri.
 */
.lp-lembar {
  width: 210mm; min-height: 297mm; box-sizing: border-box;
  padding: 7.7mm 7.3mm 6mm 12.7mm;
  background: #fff; color: #000;
  /*
   * FrutigerExt-Normal adalah huruf resmi borangnya, tetapi tidak terpasang di
   * komputer mana pun di cabang — Word menggantinya dengan huruf berkait, dan
   * ITULAH yang selama ini tercetak. Urutan ini menjaga dua-duanya: yang punya
   * hurufnya dapat aslinya, yang tidak dapat hasil yang sama dengan arsipnya.
   */
  font-family: "FrutigerExt-Normal", "Times New Roman", Times, serif;
  font-size: 10pt; line-height: 1.05;
}
.lp-lembar table { border-collapse: collapse; }
.lp-lembar p { margin: 0; }
/*
 * Word menulis sebagian sel sebagai <h1>..<h6> (sisa gaya "Heading" di
 * dokumennya), dan peramban memberi judul margin bawaan 2,3em. Satu baris
 * kepala tabel jadi setinggi empat baris, dan seluruh borang mulur ke bawah.
 * Di kertas, judul itu bukan judul — cuma teks tebal di dalam sel.
 */
.lp-lembar h1, .lp-lembar h2, .lp-lembar h3,
.lp-lembar h4, .lp-lembar h5, .lp-lembar h6 {
  margin: 0; font-size: inherit; font-weight: inherit; line-height: inherit;
}
.lp-badan table { width: 190.05mm; table-layout: fixed; }   /* kolomnya dikunci colgroup grid Word, dalam mm */
.lp-badan td { word-wrap: break-word; overflow-wrap: break-word; font-size: 10pt; line-height: 1.05; }
/* tinggi ruang tanda tangan: blok bawah 31,2mm pada cetakan asli — 6,65mm baris catatan + 5 x 4,9mm */
.lp-badan tr.lp-ttd td { height: 4.9mm; }
.lp-badan tr.lp-setuju td { height: 24.5mm; vertical-align: top; }
/* baris antara letterhead dan tabel barang: 3,85pt pada berkas asli */
.lp-badan tr.lp-antara td { height: 1.4mm; font-size: 1pt; line-height: 0; padding: 0; }

.lp-kop { width: 190.05mm; table-layout: fixed; margin-bottom: 4.2mm; }
.lp-kop td { border: 1pt solid #000; padding: 0 1.6mm; vertical-align: middle; line-height: 1.05; }
.lp-kop tr { height: 4.35mm; }
.lp-kop-logo { text-align: center; }
/*
 * Logo dibatasi TINGGINYA, bukan lebarnya: berkas logo di aplikasi lebih
 * jangkung daripada logo pada borang, dan mengunci lebarnya membuat gambar
 * setinggi 18mm — lebih tinggi dari seluruh kotak kop yang cuma 17,4mm.
 */
.lp-kop-logo img { height: 13mm; width: auto; display: inline-block; }
.lp-kop-judul { text-align: center; font-weight: bold; font-size: 11.5pt; line-height: 1.15; }
.lp-kop-label { font-size: 9.5pt; font-weight: bold; }
.lp-kop-isi { font-size: 9.5pt; font-weight: bold; }

.lp-footer { width: 190mm; margin-top: 3mm; font-size: 9pt; font-style: italic; text-align: center; }

@media screen and (max-width: 900px) { .lp-bingkai { overflow-x: auto; } }

@media print {
  @page { size: 210mm 297mm; margin: 0; }
  html, body { background: #fff !important; width: 210mm; }
  body * { visibility: hidden !important; }
  .lp-bingkai, .lp-bingkai * { visibility: visible !important; }
  .lp-bingkai { position: absolute; left: 0; top: 0; width: 210mm; display: block; }
  .lp-lembar { box-shadow: none !important; margin: 0; }
  .lp-badan tr { page-break-inside: avoid; }
}
`;
