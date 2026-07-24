"use client";
/**
 * Pengingat tenggat Rencana & Realisasi, ditempel di Dashboard.
 * Muncul hanya bila memang perlu ditindak: tenggat sudah dekat/lewat DAN masih ada
 * kapal yang belum ditandai terkirim. Kalau semua beres, tak menambah kebisingan.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { useRR } from "@/lib/rr/store";
import { bulanRealisasiAktif, namaBulan, periodeAktif, statusTenggat, tenggatDoc, TipeRR } from "@/lib/rr/types";

const GAYA: Record<string, string> = {
  lewat: "bg-rose-50 text-rose-800 ring-rose-300",
  mendesak: "bg-orange-50 text-orange-800 ring-orange-300",
  dekat: "bg-amber-50 text-amber-800 ring-amber-200",
};

export default function PengingatRR() {
  const { dok } = useRR();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);
  if (!now) return null;

  const periode = periodeAktif(now);
  const bulanReal = bulanRealisasiAktif(now);

  const belum = (tipe: TipeRR, bulan: string) =>
    KAPAL_ANGGARAN.filter((k) => !dok.some((d) => d.tipe === tipe && d.bulan === bulan && d.kapal === k && d.status === "terkirim")).length;

  const daftar = [
    { tipe: "rencana" as TipeRR, bulan: periode.mulai, judul: `Rencana ${periode.label}`, st: statusTenggat(periode.tenggat, now), belum: belum("rencana", periode.mulai) },
    { tipe: "realisasi" as TipeRR, bulan: bulanReal, judul: `Realisasi ${namaBulan(bulanReal)}`, st: statusTenggat(tenggatDoc("realisasi", bulanReal), now), belum: belum("realisasi", bulanReal) },
  ].filter((x) => x.belum > 0 && x.st.tingkat !== "aman");

  if (!daftar.length) return null;

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {daftar.map((x) => (
        <Link key={x.tipe} href="/rencana"
          className={`rounded-2xl px-4 py-3 ring-1 flex items-center gap-3 transition hover:brightness-95 ${GAYA[x.st.tingkat]}`}>
          <span className="text-xl">{x.st.tingkat === "lewat" ? "⚠️" : "⏳"}</span>
          <div className="min-w-0">
            <p className="font-extrabold text-sm truncate">{x.judul} — {x.belum} kapal belum dikirim</p>
            <p className="text-[11px] font-semibold">{x.st.teks} · klik untuk mengisi</p>
          </div>
          <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/70 shrink-0">
            {x.st.tingkat === "lewat" ? "LEWAT" : x.st.sisaHari <= 1 ? "HARI INI" : `H-${x.st.sisaHari}`}
          </span>
        </Link>
      ))}
    </div>
  );
}
