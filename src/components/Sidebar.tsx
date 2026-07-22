"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

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

const SERVIS_SUB = [
  { href: "/servis", label: "Monitoring", icon: "🏠" },
  { href: "/servis/isi", label: "Input Barang", icon: "✏️" },
];

function Tool({ active, href, icon, label, sub, onNavigate, path }: any) {
  return (
    <div className={`rounded-xl transition ${active ? "bg-white/[0.07] ring-1 ring-white/10 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]" : ""}`}>
      <Link href={href} onClick={onNavigate}
        className={`relative flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-sm font-semibold transition ${active ? "text-white" : "text-white/75 hover:bg-white/5 hover:text-white"}`}>
        {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-gradient-to-b from-[#7cc242] via-[#14b8c4] to-[#1ca3dd]" />}
        <span className={`grid place-items-center h-8 w-8 rounded-lg text-base shrink-0 transition ${active ? "bg-white/15 shadow-inner" : "bg-white/5"}`}>{icon}</span>
        <span className="truncate">{label}</span>
      </Link>
      {active && (
        <div className="pb-2 pl-3.5 pr-1.5 anim-in">
          {sub.map((s: any) => {
            const a = ["/", "/material", "/sppbj", "/nonpr", "/servis"].includes(s.href) ? path === s.href : path.startsWith(s.href);
            return (
              <Link key={s.href} href={s.href} onClick={onNavigate}
                className={`flex items-center gap-2 pl-3.5 pr-3 py-1.5 rounded-lg text-[13px] transition border-l-2 ${a ? "text-white border-[#14b8c4] bg-white/5 font-medium" : "text-white/55 border-white/10 hover:text-white hover:border-white/30"}`}>
                <span className="text-xs opacity-90">{s.icon}</span> {s.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[10px] uppercase tracking-[0.15em] text-white/35 font-bold px-2 mb-1.5 mt-5 first:mt-1">{children}</p>;
}

function NavLink({ href, icon, label, desc, active, onNavigate }: { href: string; icon: string; label: string; desc?: string; active: boolean; onNavigate?: () => void }) {
  return (
    <Link href={href} onClick={onNavigate}
      className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition ${active ? "text-white bg-white/[0.07] ring-1 ring-white/10" : "text-white/75 hover:bg-white/5 hover:text-white"}`}>
      {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-gradient-to-b from-[#7cc242] via-[#14b8c4] to-[#1ca3dd]" />}
      <span className={`grid place-items-center h-8 w-8 rounded-lg text-base shrink-0 ${active ? "bg-white/15 shadow-inner" : "bg-white/5"}`}>{icon}</span>
      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-semibold truncate">{label}</span>
        {desc && <span className="block text-[10px] text-white/45 truncate">{desc}</span>}
      </span>
    </Link>
  );
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const materialActive = path.startsWith("/material");
  const sppbjActive = path.startsWith("/sppbj");
  const nonprActive = path.startsWith("/nonpr");
  const servisActive = path.startsWith("/servis");
  const swakelolaActive = !materialActive && !sppbjActive && !nonprActive && !servisActive && (path === "/" || path.startsWith("/isi-data") || path.startsWith("/dokumen") || path.startsWith("/distribusi"));

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-xl p-1.5 shadow-lg shrink-0 ring-1 ring-white/20">
            <Image src="/logo-asdp.png" alt="ASDP" width={40} height={28} className="object-contain" />
          </div>
          <div className="leading-tight">
            <p className="text-white font-extrabold text-sm tracking-tight">Manajemen Report</p>
            <p className="text-white/60 text-xs">Teknik ASDP · Ternate</p>
          </div>
        </div>
      </div>

      {/* Navigasi */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        <SectionLabel>Ringkasan</SectionLabel>
        <NavLink href="/dashboard" icon="📊" label="Dashboard Anggaran" desc="Penyerapan, pagu & rincian" active={path.startsWith("/dashboard")} onNavigate={onNavigate} />

        <SectionLabel>Data Kapal</SectionLabel>
        <NavLink href="/armada" icon="⚓" label="Profil Armada" desc="Lihat spesifikasi & inventaris" active={path.startsWith("/armada")} onNavigate={onNavigate} />
        <NavLink href="/kapal" icon="🚢" label="Ship Database" desc="Isi & edit data kapal" active={path.startsWith("/kapal")} onNavigate={onNavigate} />

        <SectionLabel>Tools Pekerjaan</SectionLabel>
        <Tool active={swakelolaActive} href="/" icon="⚙️" label="Generator Swakelola" sub={SWAKELOLA_SUB} onNavigate={onNavigate} path={path} />
        <div className="h-1" />
        <Tool active={materialActive} href="/material" icon="📦" label="Pengajuan Kode Material" sub={MATERIAL_SUB} onNavigate={onNavigate} path={path} />
        <div className="h-1" />
        <Tool active={sppbjActive} href="/sppbj" icon="📑" label="SPPBJ Pengadaan" sub={SPPBJ_SUB} onNavigate={onNavigate} path={path} />
        <div className="h-1" />
        <Tool active={nonprActive} href="/nonpr" icon="🧾" label="SPPBJ Non PR PO" sub={NONPR_SUB} onNavigate={onNavigate} path={path} />
        <div className="h-1" />
        <Tool active={servisActive} href="/servis" icon="🔧" label="Monitoring Servis" sub={SERVIS_SUB} onNavigate={onNavigate} path={path} />

        <SectionLabel>Pengaman Data</SectionLabel>
        <NavLink href="/admin" icon="🧮" label="Panel Admin" desc="Total data & kuota Supabase" active={path.startsWith("/admin")} onNavigate={onNavigate} />
        <NavLink href="/backup" icon="🛡️" label="Backup Data" desc="Salinan otomatis ke laptop" active={path.startsWith("/backup")} onNavigate={onNavigate} />
      </nav>

      <div className="px-3 pt-2 border-t border-white/10 space-y-1">
        <ThemeToggle />
        <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/80 hover:bg-white/10 transition">
          <span className="text-base">🚪</span> Keluar
        </button>
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
  const path = usePathname();
  if (path === "/login") return null; // halaman login tanpa sidebar

  return (
    <>
      {/* Topbar mobile */}
      <div className="no-print md:hidden sticky top-0 z-40 flex items-center gap-3 px-4 py-3 asdp-gradient text-white shadow">
        <button onClick={() => setOpen(true)} aria-label="Menu" className="text-xl">☰</button>
        <span className="font-bold text-sm">Manajemen Report Teknik ASDP Ternate</span>
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
