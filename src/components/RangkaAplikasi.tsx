"use client";
/**
 * Rangka aplikasi: sidebar + lonceng pengingat.
 *
 * Halaman /monitoring (rekap pengadaan), /lapor (kiriman berkas dari ABK
 * kapal), /kinerja-anggaran (tautan lihat-saja untuk Direksi),
 * /layar-sertifikat (papan monitor yang menyala sendiri di layar ruang
 * kantor), dan /scm
 * (ruang kerja tim SCM, berpintu sendiri) berdiri DI LUAR kerangka aplikasi —
 * pemakainya
 * tak punya akses ke menu-menu di dalam aplikasi, jadi sidebar & lonceng
 * sengaja tidak dipasang di sana supaya tak menampilkan tautan yang ujungnya
 * hanya melempar ke halaman masuk.
 */
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import PilJuruBaca from "@/components/lapor/PilJuruBaca";

export default function RangkaAplikasi({ sidebar, loneng, children }: {
  sidebar: ReactNode; loneng: ReactNode; children: ReactNode;
}) {
  const path = usePathname() || "";
  const terbuka = path.startsWith("/monitoring") || path.startsWith("/lapor")
    || path.startsWith("/uji-permintaan")
    || path.startsWith("/kinerja-anggaran") || path.startsWith("/layar-sertifikat")
    || path.startsWith("/scm");

  if (terbuka) return <div className="min-h-screen">{children}</div>;

  return (
    <>
      <div className="md:flex min-h-screen">
        {sidebar}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
      {/* lonceng pengingat mengapung di kanan atas seluruh halaman aplikasi */}
      {loneng}
      {/*
        Juru Baca dipasang di rangka, bukan di halaman permintaan — supaya
        membuka aplikasi di halaman mana pun dari laptop ber-Ollama sudah cukup
        membuat kiriman ABK terbaca. Orang kantor jarang membuka halaman
        permintaan lebih dulu, dan bacaan yang menunggu dibuka bukan bacaan
        yang siap dipakai.
      */}
      <PilJuruBaca />
    </>
  );
}
