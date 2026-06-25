"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useKapalDb } from "@/lib/kapal/store";
import { Ship, shipFilled } from "@/lib/kapal/types";

export default function ArmadaPage() {
  const { ships, loading } = useKapalDb();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return ships;
    return ships.filter((s) => (s.nama + " " + s.general.lintasan + " " + s.mainEngine.merk).toLowerCase().includes(n));
  }, [ships, q]);

  const lengkap = ships.filter((s) => shipFilled(s) >= 90).length;

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 relative overflow-hidden">
          <svg className="absolute -bottom-3 right-0 w-80 opacity-[0.06]" viewBox="0 0 200 60" fill="none"><path d="M0 40 Q25 20 50 40 T100 40 T150 40 T200 40" stroke="#16357f" strokeWidth="3"/><path d="M0 50 Q25 30 50 50 T100 50 T150 50 T200 50" stroke="#16357f" strokeWidth="3"/></svg>
          <div className="flex items-center gap-4 relative">
            <div className="bg-white rounded-2xl p-2 shadow-md shrink-0"><Image src="/logo-asdp.png" alt="ASDP" width={56} height={38} className="object-contain" /></div>
            <div className="flex-1">
              <Link href="/dashboard" className="text-xs text-slate-500 hover:text-[#16357f]">‹ Dashboard</Link>
              <h1 className="text-2xl font-extrabold asdp-text-gradient flex items-center gap-2">⚓ Profil Armada</h1>
              <p className="text-slate-500 text-sm">Galeri partikular kapal ASDP Ternate — tampilan ringkas &amp; profesional.</p>
            </div>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-3xl font-extrabold text-[#16357f]">{ships.length}</span>
              <span className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Kapal</span>
              <span className="text-[11px] text-slate-500">{lengkap} data lengkap</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kapal / lintasan / mesin…"
            className="text-sm border px-3 py-2 rounded-xl bg-white pl-8 w-72 focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/20 outline-none" />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
        </div>
        <Link href="/kapal" className="text-xs btn btn-ghost">✏️ Kelola Data (Ship Database)</Link>
      </div>

      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((s, i) => <ViewCard key={s.id} ship={s} index={i} />)}
        {!loading && filtered.length === 0 && <p className="col-span-full text-center text-slate-400 text-sm py-10">Tak ada kapal cocok.</p>}
      </div>
    </main>
  );
}

function ViewCard({ ship, index }: { ship: Ship; index: number }) {
  const pct = shipFilled(ship);
  const g = ship.general, d = ship.dimension;
  return (
    <Link href={`/armada/${ship.id}`} style={{ animationDelay: `${index * 40}ms` }}
      className="anim-in block bg-white rounded-2xl ring-line elev-sm card-hover overflow-hidden group">
      <div className="relative px-4 pt-4 pb-3 text-white" style={{ background: "linear-gradient(135deg,#16357f,#0e2456)" }}>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#7cc242] via-[#14b8c4] to-[#f5b301]" />
        <span className="absolute right-3 bottom-1 text-5xl opacity-[0.08] leading-none">⚓</span>
        <div className="flex items-start justify-between gap-2 relative">
          <div>
            <p className="font-extrabold leading-tight tracking-tight">{ship.nama}</p>
            <p className="text-white/60 text-[11px] mt-0.5 font-mono">{g.callSign || "—"} · IMO {g.imo || "—"}</p>
          </div>
          <Ring pct={pct} />
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5 mb-2">
          <Chip label="GT" value={d.gt} />
          <Chip label="Tahun" value={g.tahun} />
          <Chip label="ME" value={ship.mainEngine.merk} />
          {ship.inventaris?.length > 0 && <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 rounded-lg px-2 py-0.5 font-semibold">📄 {ship.inventaris.length}</span>}
        </div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">Lintasan</p>
        <p className="text-xs text-slate-600 line-clamp-2 min-h-[2rem]">{g.lintasan || <span className="text-slate-300">belum ada data lintasan</span>}</p>
        <p className="mt-2 text-[11px] text-[#1ca3dd] font-semibold group-hover:underline">Lihat profil →</p>
      </div>
    </Link>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 text-[11px] bg-slate-100 rounded-lg px-2 py-0.5">
      <span className="text-slate-400 font-medium">{label}</span>
      <span className="font-mono font-semibold text-slate-700">{value || "—"}</span>
    </span>
  );
}

function Ring({ pct }: { pct: number }) {
  const color = pct >= 90 ? "#7cc242" : pct >= 40 ? "#f5b301" : "#94a3b8";
  return (
    <div className="relative h-11 w-11 shrink-0 grid place-items-center">
      <svg className="h-11 w-11 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 97.4} 97.4`} />
      </svg>
      <span className="absolute text-[10px] font-bold text-white">{pct}%</span>
    </div>
  );
}
