"use client";
/**
 * Cetakan borang "PERMINTAAN PENGADAAN BARANG/JASA KAPAL" (HP-103.00.01 Rev.06).
 *
 * Ini bukan tafsiran bebas atas borangnya, melainkan salinan ukurannya: lebar
 * tiap kolom, tinggi baris, tepi kertas, dan susunan tanda tangan diambil dari
 * berkas Word yang dipakai kapal selama ini (kolom No 28,3pt · Jumlah 49,5pt ·
 * Satuan 45pt · Merk/Katalog 89,4pt · Uraian 326,5pt pada A4 tepi kiri 58pt).
 * Syaratnya memang begitu: hasil cetak digital harus bisa ditumpuk dengan
 * borang lama tanpa kelihatan bedanya, kalau tidak, orang kapal akan kembali
 * mengetik sendiri di Word.
 *
 * Yang dicetak SELALU seluruh borang, bukan bagian layar yang sedang terlihat:
 * saat mencetak, seluruh halaman lain disembunyikan lewat @media print.
 */
import { BARIS_CETAK_MINIMAL, FormulirPermintaan, tanggalIndo } from "@/lib/lapor/formulir";

/** 1pt = 0,3528mm — lebar kolom borang asli, apa adanya */
const KOLOM_MM = { no: 9.98, jumlah: 17.46, satuan: 15.88, merk: 31.54, uraian: 115.18 };
const LEBAR_MM = 190;

export default function LembarPermintaan({ f }: { f: FormulirPermintaan }) {
  const isi = f.baris.filter((b) => b.uraian.trim());
  const kosong = Math.max(0, BARIS_CETAK_MINIMAL - isi.length);
  const atasan = f.bagian === "mesin" ? "Masinis I" : "Mualim I";

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
              <td className="lp-kop-judul" rowSpan={4}>PERMINTAAN PENGADAAN<br />BARANG/JASA KAPAL</td>
              <td className="lp-kop-label">No. Dokumen</td>
              <td className="lp-kop-isi">: HP-103.00.01</td>
            </tr>
            <tr><td className="lp-kop-label">Revisi</td><td className="lp-kop-isi">: 06</td></tr>
            <tr><td className="lp-kop-label">Berlaku Efektif</td><td className="lp-kop-isi">: 25 April 2024</td></tr>
            <tr><td className="lp-kop-label">Halaman</td><td className="lp-kop-isi">: 1 dari 1</td></tr>
          </tbody>
        </table>

        {/* ── kepala surat ───────────────────────────────────────────────── */}
        <table className="lp-tabel">
          <tbody>
            <tr>
              <td className="lp-l">Kepada</td><td className="lp-t">:</td>
              <td className="lp-v">Manager Teknik Cabang Ternate</td>
              <td className="lp-l2">No. SPPB/J</td><td className="lp-t">:</td>
              <td className="lp-v2">{f.noSurat || " "}</td>
            </tr>
            <tr>
              <td className="lp-l">Dari</td><td className="lp-t">:</td>
              <td className="lp-v">{f.kapal || "KMP."}</td>
              <td className="lp-l2">Tanggal</td><td className="lp-t">:</td>
              <td className="lp-v2">{tanggalIndo(f.tanggal) || " "}</td>
            </tr>
            <tr>
              <td className="lp-l">Dasar</td><td className="lp-t">:</td>
              <td className="lp-v" colSpan={4}>{f.dasar || " "}</td>
            </tr>
            <tr>
              <td className="lp-l">Tanggal dibutuhkan</td><td className="lp-t">:</td>
              <td className="lp-v" colSpan={4}>{f.tanggalDibutuhkan || "Segera"}</td>
            </tr>
          </tbody>
        </table>

        {/* ── daftar barang ──────────────────────────────────────────────── */}
        <table className="lp-barang">
          <colgroup>
            <col style={{ width: `${KOLOM_MM.no}mm` }} />
            <col style={{ width: `${KOLOM_MM.jumlah}mm` }} />
            <col style={{ width: `${KOLOM_MM.satuan}mm` }} />
            <col style={{ width: `${KOLOM_MM.merk}mm` }} />
            <col style={{ width: `${KOLOM_MM.uraian}mm` }} />
          </colgroup>
          <thead>
            <tr>
              <th>No</th><th>Jumlah</th><th>Satuan</th><th>Merk/Katalog</th>
              <th>Uraian / Spesifikasi Barang</th>
            </tr>
          </thead>
          <tbody>
            {isi.map((b, i) => (
              <tr key={b.id}>
                <td className="lp-tengah">{i + 1}</td>
                <td className="lp-tengah">{b.jumlah}</td>
                <td className="lp-tengah">{b.satuan}</td>
                <td>{b.merk}</td>
                <td>
                  {b.uraian}
                  {b.spesifikasi ? <span className="lp-spek"> — {b.spesifikasi}</span> : null}
                </td>
              </tr>
            ))}
            {/*
              Baris kosong dipertahankan sampai 21 baris seperti borang aslinya.
              Bukan hiasan: bagian bawah borang berisi kolom tanda tangan, dan
              kalau tabelnya menyusut mengikuti isi, tanda tangannya naik ke
              tengah halaman dan berkasnya tidak lagi seragam dengan yang lama.
            */}
            {Array.from({ length: kosong }).map((_, i) => (
              <tr key={`kosong-${i}`}>
                <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── catatan & tanda tangan ─────────────────────────────────────── */}
        <table className="lp-kaki">
          <tbody>
            <tr>
              <td className="lp-kaki-kiri">
                <div className="lp-kaki-judul">Catatan Peminta Barang &amp; Jasa :</div>
                <div className="lp-kaki-catatan">{f.catatan}</div>
              </td>
              <td className="lp-kaki-kanan">
                <div>{f.kapal}{f.kapal ? ", " : ""}{tanggalIndo(f.tanggal)}</div>
                <div>Peminta Barang,</div>
                <div className="lp-ttd" />
                <div className="lp-nama">{f.peminta || " "}</div>
                <div>({f.jabatanPeminta || " "})</div>
              </td>
            </tr>
            <tr>
              <td className="lp-setuju">Persetujuan, {f.nakhoda || " "} (Nakhoda)</td>
              <td className="lp-setuju lp-tengah">{f.masinis || " "} ({atasan})</td>
            </tr>
          </tbody>
        </table>

        <div className="lp-footer">Dilarang Mengcopy /Menyebarluaskan Tanpa Izin DPA</div>
      </div>
    </div>
  );
}

/*
 * Ukuran ditulis dalam milimeter, bukan piksel: yang dituju kertas, bukan layar.
 * Peramban ponsel mengecilkan lembarnya lewat transform di .lp-bingkai supaya
 * tetap terbaca di layar sempit, sementara cetakannya tetap ukuran penuh.
 */
const gaya = `
.lp-bingkai { display: flex; justify-content: center; }
.lp-lembar {
  width: 210mm; min-height: 297mm; box-sizing: border-box;
  padding: 14mm 4mm 12mm 20mm;
  background: #fff; color: #000;
  font-family: "Times New Roman", Times, serif; font-size: 10pt; line-height: 1.25;
}
.lp-lembar table { border-collapse: collapse; width: ${LEBAR_MM}mm; table-layout: fixed; }
.lp-lembar td, .lp-lembar th { border: 0.6pt solid #000; padding: 1mm 1.4mm; vertical-align: top; word-wrap: break-word; }

.lp-kop td { vertical-align: middle; }
.lp-kop-logo { width: 37mm; text-align: center; }
.lp-kop-logo img { width: 30mm; height: auto; display: inline-block; }
.lp-kop-judul {
  width: 78mm; text-align: center; font-family: Arial, Helvetica, sans-serif;
  font-weight: bold; font-size: 11pt; letter-spacing: 0.2pt;
}
.lp-kop-label { width: 33mm; font-family: Arial, Helvetica, sans-serif; font-size: 8pt; }
.lp-kop-isi { width: 42mm; font-family: Arial, Helvetica, sans-serif; font-size: 8pt; }

.lp-tabel { margin-top: 2mm; }
.lp-tabel td { border: 0; padding: 0.6mm 0; font-size: 10pt; }
.lp-l { width: 32mm; }
.lp-t { width: 4mm; }
.lp-v { width: 62mm; }
.lp-l2 { width: 26mm; }
.lp-v2 { width: 62mm; }

.lp-barang { margin-top: 2mm; }
.lp-barang th {
  text-align: center; font-family: Arial, Helvetica, sans-serif; font-size: 9pt;
  font-weight: bold; background: #fff; padding: 1.2mm 1mm;
}
.lp-barang td { height: 6.2mm; font-size: 10pt; }
.lp-tengah { text-align: center; }
.lp-spek { font-size: 9.5pt; }

.lp-kaki { margin-top: 0; }
.lp-kaki td { font-size: 10pt; }
.lp-kaki-kiri { width: 110mm; height: 32mm; }
.lp-kaki-kanan { width: 80mm; text-align: center; }
.lp-kaki-judul { font-size: 9.5pt; }
.lp-kaki-catatan { margin-top: 1mm; white-space: pre-wrap; }
.lp-ttd { height: 16mm; }
.lp-nama { font-weight: bold; text-decoration: underline; }
.lp-setuju { height: 8mm; }
.lp-footer { margin-top: 2mm; font-size: 7.5pt; font-style: italic; text-align: center; width: ${LEBAR_MM}mm; }

@media screen and (max-width: 900px) {
  .lp-bingkai { overflow-x: auto; }
}

@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  .lp-bingkai, .lp-bingkai * { visibility: visible !important; }
  .lp-bingkai { position: absolute; left: 0; top: 0; width: 100%; display: block; }
  .lp-lembar { box-shadow: none !important; margin: 0; }
  .lp-barang tr { page-break-inside: avoid; }
  .lp-kaki { page-break-inside: avoid; }
}
`;
