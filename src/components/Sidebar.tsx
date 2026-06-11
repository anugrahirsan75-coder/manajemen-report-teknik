"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  };
  return (
    <button onClick={toggle} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/80 hover:bg-white/10 transition">
      <span className="text-base">{dark ? "☀️" : "🌙"}</span>
      {dark ? "Mode Terang" : "Mode Gelap"}
    </button>
  );
}

const SWAKELOLA_SUB = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/isi-data", label: "Isi Data", icon: "✏️" },
  { href: "/distribusi", label: "Perhitungan Swakelola", icon: "📐" },
];

const MATERIAL_SUB = [
  { href: "/material", label: "Dashboard", icon: "🏠" },
  { href: "/material/cek", label: "Cek Kode Material", icon: "🔎" },
  { href: "/material/isi", label: "Input Item", icon: "✏️" },
];

const SPPBJ_SUB = [
  { href: "/sppbj", label: "Riwayat Pengadaan", icon: "🏠" },
  { href: "/sppbj/isi", label: "Input / Edit", icon: "✏️" },
];

const NONPR_SUB = [
  { href: "/nonpr", label: "Riwayat", icon: "🏠" },
  { href: "/nonpr/isi", label: "Input / Edit", icon: "✏️" },
];

function Tool({ active, href, icon, label, sub, onNavigate, path }: any) {
  return (
    <div className={`rounded-xl ${active ? "bg-white/10" : ""}`}>
      <Link href={href} onClick={onNavigate}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${active ? "text-white" : "text-white/80 hover:bg-white/5"}`}>
        <span className="text-lg">{icon}</span> {label}
      </Link>
      {active && (
        <div className="pb-2 pl-3">
          {sub.map((s: any) => {
            const a = ["/", "/material", "/sppbj", "/nonpr"].includes(s.href) ? path === s.href : path.startsWith(s.href);
            return (
              <Link key={s.href} href={s.href} onClick={onNavigate}
                className={`flex items-center gap-2 pl-4 pr-3 py-1.5 rounded-lg text-[13px] transition border-l-2 ${a ? "text-white border-white" : "text-white/60 border-white/15 hover:text-white"}`}>
                <span className="text-xs">{s.icon}</span> {s.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const materialActive = path.startsWith("/material");
  const sppbjActive = path.startsWith("/sppbj");
  const nonprActive = path.startsWith("/nonpr");
  const swakelolaActive = !materialActive && !sppbjActive && !nonprActive && (path === "/" || path.startsWith("/isi-data") || path.startsWith("/dokumen") || path.startsWith("/distribusi"));

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-xl p-1.5 shadow shrink-0">
            <Image src="/logo-asdp.png" alt="ASDP" width={40} height={28} className="object-contain" />
          </div>
          <div className="leading-tight">
            <p className="text-white font-bold text-sm">Otomatisasi Dokumen</p>
            <p className="text-white/70 text-xs">Teknik ASDP</p>
          </div>
        </div>
      </div>

      {/* Tools */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold px-2 mb-2">Tools</p>

        <Tool active={swakelolaActive} href="/" icon="⚓" label="Generator Swakelola" sub={SWAKELOLA_SUB} onNavigate={onNavigate} path={path} />
        <div className="h-1" />
        <Tool active={materialActive} href="/material" icon="📦" label="Pengajuan Kode Material" sub={MATERIAL_SUB} onNavigate={onNavigate} path={path} />
        <div className="h-1" />
        <Tool active={sppbjActive} href="/sppbj" icon="📑" label="SPPBJ Pengadaan" sub={SPPBJ_SUB} onNavigate={onNavigate} path={path} />
        <div className="h-1" />
        <Tool active={nonprActive} href="/nonpr" icon="🧾" label="SPPBJ Non PR PO" sub={NONPR_SUB} onNavigate={onNavigate} path={path} />
      </nav>

      <div className="px-3 pt-2 border-t border-white/10">
        <ThemeToggle />
      </div>
      <div className="px-4 py-3 text-[10px] text-white/40 leading-relaxed">
        PT. ASDP Indonesia Ferry (Persero)
        <br />Dibuat oleh <span className="text-white/70 font-medium">Irsan Anugrah</span>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Topbar mobile */}
      <div className="no-print md:hidden sticky top-0 z-40 flex items-center gap-3 px-4 py-3 asdp-gradient text-white shadow">
        <button onClick={() => setOpen(true)} aria-label="Menu" className="text-xl">☰</button>
        <span className="font-bold text-sm">Otomatisasi Dokumen Teknik ASDP</span>
      </div>

      {/* Sidebar desktop */}
      <aside className="no-print hidden md:flex w-64 shrink-0 sticky top-0 h-screen flex-col" style={{ background: "linear-gradient(180deg,#16357f,#0e2456)" }}>
        <NavContent />
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="no-print md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 flex flex-col shadow-xl" style={{ background: "linear-gradient(180deg,#16357f,#0e2456)" }}>
            <NavContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
