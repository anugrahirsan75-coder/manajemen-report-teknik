"use client";
/**
 * Borang TF-101.00.11 "Persediaan Barang / Suku Cadang" untuk satu bulan.
 *
 * Bentuknya meniru lembar kertas yang selama ini dipindai kapal — kolom, urutan,
 * dan blok tanda tangannya sama — supaya yang membaca di kantor maupun auditor
 * tidak perlu belajar format baru. Bedanya hanya satu: semua angkanya hasil
 * hitungan dari catatan kejadian, jadi stok akhir selalu sama dengan
 * awal + terima − pakai.
 *
 * Koreksi cek fisik tidak punya kolom di borang aslinya. Daripada menambah
 * kolom yang tidak dikenal pembacanya, barang yang dikoreksi diberi tanda
 * bintang di stok akhirnya dan rinciannya ditulis di bawah tabel.
 */
import {
  akhirBulan, borangBulan, bulanIni, hariIni, namaBulan, tglPanjang,
  type LembarSC, type PenandaTanganSC,
} from "@/lib/portal/sukuCadang";

const jml = (n: number, satuan: string) => `${n.toLocaleString("id-ID")} ${satuan}`;

export function BorangBulanan({ lembar, periode, penandaTangan }: {
  lembar: Pick<LembarSC, "kapal" | "bagian" | "item" | "mutasi">;
  periode: string;
  penandaTangan: PenandaTanganSC;
}) {
  const baris = borangBulan(lembar, periode);
  /* kelompokkan per peralatan, urutan kemunculan pertama — seperti lembar aslinya */
  const urutPeralatan: string[] = [];
  baris.forEach((b) => { if (!urutPeralatan.includes(b.item.peralatan)) urutPeralatan.push(b.item.peralatan); });
  const tersusun = urutPeralatan.flatMap((p) => baris.filter((b) => b.item.peralatan === p));
  const dikoreksi = tersusun.filter((b) => b.koreksi !== 0);
  const tanggalTtd = periode === bulanIni() ? hariIni() : akhirBulan(periode);
  const namaKapal = lembar.kapal.replace(/^KMP\.?\s*/i, "KMP. ");

  const th = "border border-black px-1 py-0.5 text-center font-bold";
  const td = "border border-black px-1 py-0.5 align-middle";

  return (
    <div className="lembar-cetak print-page bg-white p-4 text-black" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 9mm; }
          .lembar-cetak { padding: 0 !important; }
          .lembar-cetak thead { display: table-header-group; }
          .lembar-cetak tr { break-inside: avoid; }
        }
      `}</style>

      {/* kepala borang */}
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          <tr>
            <td className="w-[22%] border border-black p-2 text-center" rowSpan={4}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-asdp.png" alt="ASDP" className="mx-auto h-10 object-contain" />
            </td>
            <td className="border border-black p-2 text-center text-[15px] font-bold leading-tight" rowSpan={4}>
              PERSEDIAAN BARANG/ SUKU<br />CADANG
            </td>
            <td className="w-[13%] border border-black px-2 font-bold">No. Dokumen</td>
            <td className="w-[17%] border border-black px-2 font-bold">: TF-101.00.11</td>
          </tr>
          <tr><td className="border border-black px-2 font-bold">Revisi</td><td className="border border-black px-2 font-bold">: 05</td></tr>
          <tr><td className="border border-black px-2 font-bold">Berlaku Efektif</td><td className="border border-black px-2 font-bold">: 25 April 2022</td></tr>
          <tr><td className="border border-black px-2 font-bold">Halaman</td><td className="border border-black px-2 font-bold">:</td></tr>
        </tbody>
      </table>

      <div className="mt-4 grid grid-cols-2 gap-y-1.5 text-[13px] font-bold">
        <p><span className="inline-block w-32">Nama Kapal</span>: {namaKapal}</p>
        <p><span className="inline-block w-32">Departemen</span>: {lembar.bagian === "mesin" ? "MESIN" : "DECK"}</p>
        <p><span className="inline-block w-32">Bulan / Tahun</span>: {namaBulan(periode).toUpperCase()}</p>
      </div>

      <table className="mt-3 w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className={th} rowSpan={2}>NO</th>
            <th className={th} rowSpan={2}>PERALATAN</th>
            <th className={th} rowSpan={2}>KODE BARANG/<br />PART NUMBER</th>
            <th className={th} rowSpan={2}>NAMA BARANG</th>
            <th className={th}>STOCK AWAL</th>
            <th className={th} colSpan={2}>PENERIMAAN</th>
            <th className={th} colSpan={2}>TERPAKAI</th>
            <th className={th}>STOCK AKHIR</th>
            <th className={th} colSpan={2}>STATUS</th>
          </tr>
          <tr>
            <th className={th}>Jumlah</th>
            <th className={th}>Jumlah</th>
            <th className={th}>Tgl</th>
            <th className={th}>Jumlah</th>
            <th className={th}>Tgl</th>
            <th className={th}>Jumlah</th>
            <th className={th}>Baru</th>
            <th className={th}>Bekas<br /><span className="text-[9px]">(Rekondisi)</span></th>
          </tr>
        </thead>
        <tbody>
          {tersusun.map((b, i) => {
            const pertama = i === 0 || tersusun[i - 1].item.peralatan !== b.item.peralatan;
            return (
              <tr key={b.item.id}>
                <td className={`${td} text-center`}>{i + 1}</td>
                <td className={`${td} font-semibold uppercase`}>{pertama ? b.item.peralatan : ""}</td>
                <td className={`${td} whitespace-nowrap text-center font-semibold`}>{b.item.partNumber}</td>
                <td className={td}>{b.item.nama.toUpperCase()}</td>
                <td className={`${td} whitespace-nowrap text-center`}>{jml(b.awal, b.item.satuan)}</td>
                <td className={`${td} text-center`}>{b.terima ? b.terima.toLocaleString("id-ID") : ""}</td>
                <td className={`${td} text-center`}>{b.tglTerima.join(", ")}</td>
                <td className={`${td} text-center`}>{b.pakai ? b.pakai.toLocaleString("id-ID") : ""}</td>
                <td className={`${td} text-center`}>{b.tglPakai.join(", ")}</td>
                <td className={`${td} whitespace-nowrap text-center font-semibold`}>
                  {jml(b.akhir, b.item.satuan)}{b.koreksi !== 0 ? " *" : ""}
                </td>
                <td className={`${td} text-center`}>{b.item.kondisi === "baru" ? "✓" : ""}</td>
                <td className={`${td} text-center`}>{b.item.kondisi === "bekas" ? "✓" : ""}</td>
              </tr>
            );
          })}
          {!tersusun.length && (
            <tr><td className={`${td} py-4 text-center italic`} colSpan={12}>Belum ada barang yang tercatat untuk bulan ini.</td></tr>
          )}
        </tbody>
      </table>

      {!!dikoreksi.length && (
        <div className="mt-2 text-[10.5px]">
          <p className="font-bold">* Koreksi hasil cek fisik bulan ini:</p>
          <p>{dikoreksi.map((b) => `${b.item.nama} (${b.item.partNumber || "-"}) ${b.koreksi > 0 ? "+" : ""}${b.koreksi} ${b.item.satuan}`).join("; ")}.</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 text-center text-[13px]" style={{ breakInside: "avoid" }}>
        <div>
          <p>&nbsp;</p>
          <p>Disetujui,</p>
          <p className="mt-16 font-bold underline">{penandaTangan.penyetuju || " ".repeat(30)}</p>
          <p className="font-bold">{penandaTangan.jabatanPenyetuju}</p>
        </div>
        <div>
          <p className="font-bold">{namaKapal}, {tglPanjang(tanggalTtd).toUpperCase()}</p>
          <p>Disusun,</p>
          <p className="mt-16 font-bold underline">{penandaTangan.penyusun || " ".repeat(30)}</p>
          <p className="font-bold">{penandaTangan.jabatanPenyusun}</p>
        </div>
      </div>
    </div>
  );
}
