"use client";
/**
 * Pil kecil status Juru Baca, mengapung di pojok kanan bawah.
 *
 * Muncul HANYA di perangkat yang benar-benar bisa membaca (laptop dengan
 * Ollama menyala). Di ponsel atau saat aplikasi dibuka dari Vercel ia diam
 * sepenuhnya — memberi tahu "AI lokal tak terjangkau" di layar yang memang tak
 * pernah bisa membaca hanya jadi gangguan tetap.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  KeadaanJuruBaca, keadaanJuruBaca, langgananJuruBaca, mulaiJuruBaca, nyalakanJuruBaca,
} from "@/lib/lapor/juruBaca";

export function useJuruBaca(): KeadaanJuruBaca {
  const [k, setK] = useState<KeadaanJuruBaca>(keadaanJuruBaca);
  useEffect(() => {
    mulaiJuruBaca();
    return langgananJuruBaca(setK);
  }, []);
  return k;
}

export default function PilJuruBaca() {
  const k = useJuruBaca();
  const [tutup, setTutup] = useState(false);

  if (tutup || !k.siap) return null;
  const sibuk = k.jalan && !!k.sedang;
  if (!sibuk && !k.antre && !k.selesai) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-[22rem] rounded-2xl bg-slate-900/95 px-3.5 py-2.5 text-white shadow-xl ring-1 ring-white/10">
      <div className="flex items-center gap-2">
        <span className={`text-base ${sibuk ? "animate-pulse" : ""}`}>🤖</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold">
            Juru Baca {sibuk ? `— ${k.antre} berkas menunggu` : "— selesai"}
          </p>
          <p className="truncate text-[10px] text-white/60">
            {sibuk ? `${k.sedang} · ${k.tahap || "membaca…"}` : `${k.selesai} berkas terbaca lewat ${k.mesin}`}
          </p>
        </div>
        <Link href="/permintaan-laporan/isi"
          className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold hover:bg-white/20">
          Lihat
        </Link>
        <button onClick={() => { nyalakanJuruBaca(false); setTutup(true); }}
          title="Hentikan sampai halaman dimuat ulang"
          className="shrink-0 text-white/40 hover:text-white">✕</button>
      </div>
    </div>
  );
}
