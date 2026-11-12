"use client";
/**
 * Halaman cetak borang TF-101.00.11 — hanya borangnya, tanpa menu dan tombol.
 *
 * Dibuka di tab sendiri lalu langsung memanggil dialog cetak. Di ponsel itu
 * berarti "Simpan sebagai PDF" yang hasilnya bisa dikirim atau dicetak di
 * kantor; mencetak dari halaman isian ikut membawa menu bawah, kartu ringkasan,
 * dan tombol-tombol ke kertasnya.
 */
import { useEffect, useState } from "react";
import { BorangBulanan } from "./BorangBulanan";
import { PENANDA_TANGAN_AWAL, namaBulan, type LembarSC } from "@/lib/portal/sukuCadang";

export function HalamanCetak({ sumber, periode }: { sumber: string; periode: string }) {
  const [lembar, setLembar] = useState<LembarSC | null>(null);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    void fetch(sumber, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) throw new Error(d.error || "Gagal memuat");
        setLembar(d.lembar || d);
      })
      .catch((e) => setGalat(e?.message || String(e)));
  }, [sumber]);

  useEffect(() => {
    if (!lembar) return;
    document.title = `TF-101.00.11 ${lembar.kapal} ${lembar.bagian === "mesin" ? "Mesin" : "Deck"} ${namaBulan(periode)}`;
    /* beri waktu logo termuat sebelum dialog cetak terbuka */
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, [lembar, periode]);

  if (galat) return <p className="p-6 text-[13px] text-rose-700">{galat}</p>;
  if (!lembar) return <p className="p-6 text-[13px] text-slate-500">Menyiapkan borang…</p>;
  return (
    <div className="min-h-screen bg-white">
      <p className="p-3 text-[12px] text-slate-500 print:hidden">
        Dialog cetak terbuka otomatis. Pilih <b>Simpan sebagai PDF</b> untuk mendapatkan berkasnya, atau
        <button onClick={() => window.print()} className="ml-1 font-bold text-[#16357f] underline">buka lagi</button>.
      </p>
      <BorangBulanan lembar={lembar} periode={periode}
        penandaTangan={lembar.penandaTangan || PENANDA_TANGAN_AWAL(lembar.bagian)} />
    </div>
  );
}
