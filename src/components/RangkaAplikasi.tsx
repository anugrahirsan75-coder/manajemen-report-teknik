"use client";
/**
 * Rangka aplikasi: sidebar + lonceng pengingat.
 *
 * Halaman /monitoring (rekap pengadaan), /lapor (kiriman berkas dari ABK
 * kapal), /kinerja-anggaran (tautan lihat-saja untuk Direksi), dan /scm
 * (ruang kerja tim SCM, berpintu sendiri) berdiri DI LUAR kerangka aplikasi —
 * pemakainya
 * tak punya akses ke menu-menu di dalam aplikasi, jadi sidebar & lonceng
 * sengaja tidak dipasang di sana supaya tak menampilkan tautan yang ujungnya
 * hanya melempar ke halaman masuk.
 */
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function RangkaAplikasi({ sidebar, loneng, children }: {
  sidebar: ReactNode; loneng: ReactNode; children: ReactNode;
}) {
  const path = usePathname() || "";
  const terbuka = path.startsWith("/monitoring") || path.startsWith("/lapor")
    || path.startsWith("/kinerja-anggaran") || path.startsWith("/scm");

  if (terbuka) return <div className="min-h-screen">{children}</div>;

  return (
    <>
      <div className="md:flex min-h-screen">
        {sidebar}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
      {/* lonceng pengingat mengapung di kanan atas seluruh halaman aplikasi */}
      {loneng}
    </>
  );
}
