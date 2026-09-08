"use client";
/**
 * Kirim berkas dari dalam portal.
 *
 * Halaman /lapor yang sudah ada TIDAK ditulis ulang di sini. Jalur unggahnya —
 * potongan demi potongan, lanjut setelah putus, penjaga salinan ganda — sudah
 * teruji berbulan-bulan di jaringan kapal, dan menulis jalur kedua berarti
 * menguji ulang semuanya dari nol demi tampilan yang sedikit lebih rapi.
 *
 * Jadi borang itu dipasang apa adanya di dalam bingkai, dengan portal tetap
 * mengelilinginya: yang mengirim tahu ia masih berada di akun kapalnya, dan
 * sesudah selesai tinggal menekan Beranda untuk melihat kirimannya tercatat.
 */
import Link from "next/link";
import { RangkaPortal, useAku } from "@/components/portal/Rangka";

export default function KirimDariPortal() {
  const { aku } = useAku();
  const mesin = aku?.bagian === "mesin";

  return (
    <RangkaPortal aku={aku}>
      <h1 className="mb-1 text-[17px] font-black text-slate-900 dark:text-white">Kirim berkas ke kantor</h1>
      <p className="mb-3 text-[11.5px] leading-relaxed text-slate-500">
        Pilih kapal <b>{aku?.kapal || "—"}</b> dan borang{" "}
        <b>{mesin ? "Permintaan Mesin atau Laporan Mesin" : "Permintaan Deck atau Laporan Deck"}</b> pada borang di bawah.
        Sesudah terkirim, buka <Link href="/portal" className="font-bold text-[#16357f] underline">Beranda</Link> untuk
        memastikan berkasnya tercatat — kalau tidak muncul, unggahannya belum sampai dan perlu diulang.
      </p>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        {/*
          Borang aslinya dipasang di dalam bingkai, bukan disalin. Satu jalur
          unggah, satu tempat memperbaikinya kalau ada yang perlu diperbaiki.
        */}
        <iframe src="/lapor" title="Borang kiriman kapal" className="h-[70vh] w-full border-0" />
      </div>

      <p className="mt-2 px-1 text-[11px] text-slate-400">
        Borang di atas adalah halaman kiriman yang sama dengan tautan terbuka yang biasa dibagikan kantor.
      </p>
    </RangkaPortal>
  );
}
