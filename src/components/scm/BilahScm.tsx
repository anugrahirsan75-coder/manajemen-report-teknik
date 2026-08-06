"use client";
/**
 * Bilah halaman SCM.
 *
 * Dipakai bersama oleh seluruh halaman SCM supaya bilahnya tidak ditulis dua
 * kali — begitu ada menu baru, satu berkas ini saja yang berubah.
 */
import { usePathname } from "next/navigation";

export default function BilahScm({ aksi }: { aksi?: React.ReactNode }) {
  const path = usePathname() || "";
  const keluar = async () => {
    await fetch("/api/scm/masuk", { method: "DELETE" });
    window.location.href = "/scm/masuk";
  };
  const tautan = (href: string, isi: string, aktif: boolean) => (
    <a href={href} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
      aktif ? "bg-white text-slate-800" : "bg-white/15 text-white hover:bg-white/25"}`}>{isi}</a>
  );

  return (
    <header className="asdp-gradient sticky top-0 z-30 shadow-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-lg">📦</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold leading-tight text-white">Pengadaan — SCM</p>
          <p className="text-[11px] text-white/70">PT ASDP Indonesia Ferry (Persero) — Cabang Ternate</p>
        </div>
        {tautan("/scm", "📋 Antrean", path === "/scm")}
        {tautan("/scm/rekap", "📈 Rekap", path.startsWith("/scm/rekap"))}
        {tautan("/scm/vendor", "🏢 Data Vendor", path.startsWith("/scm/vendor"))}
        {aksi}
        <button onClick={keluar} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/20">
          Keluar
        </button>
      </div>
    </header>
  );
}
