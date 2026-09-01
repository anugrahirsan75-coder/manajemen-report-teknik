/**
 * Ikon garis untuk navigasi.
 *
 * Sidebar sebelumnya memakai emoji. Emoji ikut gaya font sistem: bentuknya
 * berbeda di tiap perangkat, warnanya tidak bisa diatur, dan ukurannya tidak
 * pernah benar-benar sejajar satu sama lain — deretannya terbaca seperti
 * tempelan, bukan seperti perangkat kerja.
 *
 * Ikon di sini digambar sendiri dengan satu aturan: kotak 24, garis 1,7,
 * ujung membulat, tanpa isian. Karena mewarisi currentColor, ikonnya ikut
 * berubah bersama keadaan menunya (aktif, redup, disorot) tanpa aset kedua.
 */
import type { ReactNode } from "react";

const JALUR: Record<string, ReactNode> = {
  grafik: <><path d="M4 20h16" /><path d="M7.5 20v-5.5" /><path d="M12 20V8" /><path d="M16.5 20v-8.5" /></>,
  kalender: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>,
  kalenderCentang: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /><path d="m9 15 2 2 4-4" /></>,
  nota: <><path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" /><path d="M9.5 8.5h5M9.5 12.5h5" /></>,
  kalkulator: <><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M8 7.5h8" /><path d="M8.5 12.5h.01M12 12.5h.01M15.5 12.5h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01" /></>,
  kunci: <><path d="M15.5 3.5a4.8 4.8 0 0 0-4.4 6.7L3.8 17.5a1.6 1.6 0 0 0 0 2.3l.4.4a1.6 1.6 0 0 0 2.3 0l7.3-7.3a4.8 4.8 0 0 0 6-6.2l-2.6 2.6-2.4-2.4z" /></>,
  folder: <><path d="M3.5 7.5a2 2 0 0 1 2-2h3.7l2 2H18.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></>,
  kaca: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  peringatan: <><path d="M12 4.2 3.6 19a1.2 1.2 0 0 0 1 1.8h14.8a1.2 1.2 0 0 0 1-1.8z" /><path d="M12 10v4M12 17.5h.01" /></>,
  sertifikat: <><path d="M7 3.5h6.5L18 8v5.5" /><path d="M18 8h-4.5V3.5" /><path d="M7 3.5A1.5 1.5 0 0 0 5.5 5v13A1.5 1.5 0 0 0 7 19.5h2" /><circle cx="15.5" cy="17" r="3" /><path d="m13.5 19.3-.5 3 2.5-1.3 2.5 1.3-.5-3" /></>,
  jangkar: <><circle cx="12" cy="5.5" r="2" /><path d="M12 7.5V21" /><path d="M8.5 10.5h7" /><path d="M4.5 14.5a7.5 7.5 0 0 0 15 0" /></>,
  kapal: <><path d="M3.5 17.5c1.8 0 1.8 1.6 3.6 1.6s1.8-1.6 3.6-1.6 1.8 1.6 3.6 1.6 1.8-1.6 3.6-1.6" /><path d="M5.5 15 7 9.5h10L18.5 15" /><path d="M9 9.5V6h6v3.5" /><path d="M12 6V3.2" /></>,
  sinyal: <><path d="M4.8 15.2a9 9 0 0 1 14.4 0" /><path d="M8 12.4a5.2 5.2 0 0 1 8 0" /><circle cx="12" cy="18.5" r="1.4" /></>,
  kotakMasuk: <><path d="M3.5 13h4.2l1.4 2.6h5.8L16.3 13h4.2" /><path d="M6 5h12l2.5 8v5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18v-5z" /></>,
  tabung: <><path d="M9.5 3h5" /><path d="M10.5 3v6.2l-4.6 7.6a2 2 0 0 0 1.7 3h8.8a2 2 0 0 0 1.7-3l-4.6-7.6V3" /><path d="M8 15.5h8" /></>,
  dokumen: <><path d="M7 3.5h7L18.5 8v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" /><path d="M13.5 3.5V8h5" /><path d="M8.5 13h7M8.5 16.5h4.5" /></>,
  dokumenTambah: <><path d="M7 3.5h7L18.5 8v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" /><path d="M13.5 3.5V8h5" /><path d="M12 12v5M9.5 14.5h5" /></>,
  kotak: <><path d="m12 3.2 7.8 4.4v8.8L12 20.8l-7.8-4.4V7.6z" /><path d="m4.2 7.6 7.8 4.4 7.8-4.4M12 12v8.8" /></>,
  basisData: <><ellipse cx="12" cy="5.8" rx="7.5" ry="2.8" /><path d="M4.5 5.8v12.4c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V5.8" /><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" /></>,
  dunia: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17" /><ellipse cx="12" cy="12" rx="4" ry="8.5" /></>,
  amplop: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4.5 7.5 7.5 5.2 7.5-5.2" /></>,
  gerigi: <><circle cx="12" cy="12" r="3.2" /><path d="M12 3v2.6M12 18.4V21M21 12h-2.6M5.6 12H3M18.4 5.6l-1.9 1.9M7.5 16.5l-1.9 1.9M18.4 18.4l-1.9-1.9M7.5 7.5 5.6 5.6" /></>,
  obeng: <><path d="m3.5 20.5 6-6" /><path d="m8.5 15.5 6.2-6.2-2-2 3-3 4.5 4.5-3 3-2-2-6.2 6.2z" /></>,
  meter: <><path d="M4 18a8.5 8.5 0 1 1 16 0" /><path d="m12 18 4-5" /><circle cx="12" cy="18" r="1.2" /></>,
  perisai: <><path d="m12 3.2 7.5 2.9v6c0 4.6-3.2 8.4-7.5 9.7-4.3-1.3-7.5-5.1-7.5-9.7v-6z" /><path d="m9 12.2 2.2 2.2 4-4.2" /></>,
  rumah: <><path d="m3.5 11 8.5-7 8.5 7" /><path d="M6.5 9.6V20h11V9.6" /></>,
  pensil: <><path d="M4 20h4L20.2 7.8a1.6 1.6 0 0 0 0-2.3l-1.7-1.7a1.6 1.6 0 0 0-2.3 0L4 16z" /><path d="m15 5.5 3.5 3.5" /></>,
  daftar: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" /></>,
  penggaris: <><path d="m3.6 15.6 12-12 4.8 4.8-12 12z" /><path d="m7 12.2 1.8 1.8M10 9.2l1.8 1.8M13 6.2 14.8 8" /></>,
  keluar: <><path d="M14.5 3.5H17A2.5 2.5 0 0 1 19.5 6v12a2.5 2.5 0 0 1-2.5 2.5h-2.5" /><path d="M10 12h9.5" /><path d="m13 8.5 3.5 3.5-3.5 3.5" /></>,
  bulan: <><path d="M20 13.5A8 8 0 1 1 10.5 4a6.6 6.6 0 0 0 9.5 9.5z" /></>,
  matahari: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3" /></>,
  chevron: <><path d="m9.5 5.5 6.5 6.5-6.5 6.5" /></>,
  silang: <><path d="m6 6 12 12M18 6 6 18" /></>,
  garisTiga: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
};

export function Ikon({ nama, className = "h-[18px] w-[18px]" }: { nama: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {JALUR[nama] || JALUR.dokumen}
    </svg>
  );
}
