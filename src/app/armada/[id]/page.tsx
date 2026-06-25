"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useKapalDb } from "@/lib/kapal/store";
import {
  Ship, GENERAL_FIELDS, ENGINE_FIELDS, GEARBOX_FIELDS, shipFilled, ShipFile,
} from "@/lib/kapal/types";

export default function ArmadaDetail() {
  const { id } = useParams<{ id: string }>();
  const { ships, loading } = useKapalDb();
  const ship = ships.find((s) => s.id === id);

  if (loading && !ship) return <main className="max-w-5xl mx-auto px-5 py-16 text-center text-slate-400">Memuat…</main>;
  if (!ship) return (
    <main className="max-w-5xl mx-auto px-5 py-16 text-center">
      <p className="text-slate-400 mb-3">Kapal tak ditemukan.</p>
      <Link href="/armada" className="btn btn-primary">‹ Kembali ke Profil Armada</Link>
    </main>
  );

  const g = ship.general, d = ship.dimension;
  const pct = shipFilled(ship);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-5 py-6 print-area">
      <div className="no-print flex items-center justify-between mb-4">
        <Link href="/armada" className="text-sm text-slate-500 hover:text-[#16357f]">‹ Profil Armada</Link>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="btn btn-ghost text-xs">🖨️ Cetak</button>
          <Link href={`/kapal?open=${ship.id}`} className="btn btn-primary text-xs">✏️ Edit Data</Link>
        </div>
      </div>

      {/* HERO */}
      <div className="rounded-3xl overflow-hidden elev-lg anim-in relative text-white" style={{ background: "linear-gradient(135deg,#16357f 0%,#0e2456 70%)" }}>
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#7cc242] via-[#14b8c4] to-[#f5b301]" />
        <span className="absolute -right-6 -bottom-10 text-[12rem] leading-none opacity-[0.06] select-none">⚓</span>
        <div className="px-6 sm:px-9 py-7 relative">
          <p className="text-white/55 text-[11px] uppercase tracking-[0.25em] font-semibold">Vessel Particulars</p>
          <div className="flex flex-wrap items-end justify-between gap-4 mt-1">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{ship.nama}</h1>
              <p className="text-white/70 text-sm mt-1">{g.tipe || "Ferry Ro-Ro"} · {g.galangan || "—"}{g.tahun ? ` · ${g.tahun}` : ""}</p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative h-16 w-16 grid place-items-center">
                <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke={pct >= 90 ? "#7cc242" : "#f5b301"} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 97.4} 97.4`} />
                </svg>
                <span className="absolute text-xs font-bold">{pct}%</span>
              </div>
            </div>
          </div>
          {/* identity strip */}
          <div className="mt-5 flex flex-wrap gap-2">
            <Ident label="Call Sign" value={g.callSign} />
            <Ident label="IMO" value={g.imo} />
            <Ident label="Register BKI" value={g.registerBKI} />
            <Ident label="Bendera" value={g.bendera} />
            <Ident label="Pelabuhan" value={g.pelabuhanDaftar} />
          </div>
        </div>
      </div>

      {/* HIGHLIGHT STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
        <Stat label="GT" value={d.gt} unit="Ton" />
        <Stat label="LOA" value={d.loa} unit="m" />
        <Stat label="Lebar (B)" value={d.b} unit="m" />
        <Stat label="Daya ME" value={ship.mainEngine.ehp} unit="HP" />
      </div>

      {/* GENERAL */}
      <Card title="General Data" icon="📋">
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-0">
          {GENERAL_FIELDS.map((f) => <DT key={f.key} label={f.label} value={g[f.key]} wide={f.key === "lintasan"} />)}
        </dl>
      </Card>

      {/* DIMENSION + diagram */}
      <Card title="Main Dimension" icon="📐">
        <div className="grid md:grid-cols-[1fr_280px] gap-6 items-center">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-0">
            <DT label="GT" value={d.gt} unit="Ton" />
            <DT label="LOA" value={d.loa} unit="Meter" />
            <DT label="LBP" value={d.lbp} unit="Meter" />
            <DT label="Lebar (B)" value={d.b} unit="Meter" />
            <DT label="Tinggi (H)" value={d.h} unit="Meter" />
            <DT label="Sarat (T)" value={d.t} unit="Meter" />
          </dl>
          <ShipDiagram d={d} />
        </div>
      </Card>

      {/* MACHINERY */}
      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <EngineCard title="Main Engine" sub="Mesin Induk" fields={ENGINE_FIELDS} data={ship.mainEngine} accent="#16357f" />
        <EngineCard title="Auxiliary Engine" sub="Mesin Bantu" fields={ENGINE_FIELDS} data={ship.auxEngine} accent="#0e7490" />
        <EngineCard title="Gearbox" sub="Transmisi" fields={GEARBOX_FIELDS} data={ship.gearbox} accent="#b45309" />
      </div>

      {/* INVENTARIS */}
      <Card title="Daftar Inventaris" icon="🗂️">
        {ship.inventaris?.length ? (
          <div className="grid sm:grid-cols-2 gap-2.5">
            {ship.inventaris.map((f) => <FileCard key={f.url} f={f} />)}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Belum ada file inventaris. Tambah lewat <Link href={`/kapal?open=${ship.id}`} className="text-[#1ca3dd] underline">Edit Data</Link>.</p>
        )}
      </Card>

      <div className="no-print text-center mt-6">
        <Link href={`/kapal?open=${ship.id}`} className="btn btn-primary">✏️ Edit Data Kapal Ini</Link>
      </div>
    </main>
  );
}

/* ---- bits ---- */
function Ident({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/10 rounded-xl px-3 py-1.5 backdrop-blur-sm">
      <span className="block text-[9px] uppercase tracking-wide text-white/50 font-semibold">{label}</span>
      <span className="block text-sm font-mono font-semibold">{value || "—"}</span>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  const has = !!String(value || "").trim();
  return (
    <div className="bg-white rounded-2xl ring-line elev-sm p-4">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className={`text-2xl font-extrabold ${has ? "text-[#16357f]" : "text-slate-300"}`}>{has ? value : "—"}</span>
        {has && <span className="text-xs text-slate-400 font-medium">{unit}</span>}
      </p>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl ring-line elev-sm p-5 mt-4 anim-in">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-4 w-1.5 rounded-full bg-[#f5b301]" />
        <h2 className="text-base font-extrabold text-[#16357f]">{icon} {title}</h2>
      </div>
      {children}
    </section>
  );
}

function DT({ label, value, unit, wide }: { label: string; value: string; unit?: string; wide?: boolean }) {
  const has = !!String(value || "").trim();
  return (
    <div className={`flex items-baseline justify-between gap-3 py-2 border-b border-slate-100 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-[13px] text-slate-500 shrink-0">{label}</dt>
      <dd className={`text-[13px] font-semibold text-right ${has ? "text-slate-800" : "text-slate-300"}`}>{has ? value : "—"}{has && unit ? <span className="text-slate-400 font-normal text-[11px] ml-1">{unit}</span> : null}</dd>
    </div>
  );
}

function EngineCard({ title, sub, fields, data, accent }: { title: string; sub: string; fields: { key: string; label: string }[]; data: any; accent: string }) {
  return (
    <section className="bg-white rounded-2xl ring-line elev-sm overflow-hidden anim-in">
      <div className="px-4 py-2.5 text-white" style={{ background: accent }}>
        <p className="font-bold text-sm leading-tight">{title}</p>
        <p className="text-white/60 text-[11px]">{sub}</p>
      </div>
      <dl className="px-4 py-2">
        {fields.map((f) => <DT key={f.key} label={f.label} value={data[f.key]} />)}
      </dl>
    </section>
  );
}

function FileCard({ f }: { f: ShipFile }) {
  const icon = /pdf/i.test((f.type || "") + f.name) ? "📕" : /xls|sheet|csv/i.test((f.type || "") + f.name) ? "📗" : /doc|word/i.test((f.type || "") + f.name) ? "📘" : /image|png|jpg|jpeg|webp/i.test((f.type || "") + f.name) ? "🖼️" : "📄";
  const size = f.size < 1024 * 1024 ? (f.size / 1024).toFixed(0) + " KB" : (f.size / 1024 / 1024).toFixed(1) + " MB";
  return (
    <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-slate-50 hover:bg-sky-50 rounded-xl px-3 py-2.5 ring-1 ring-slate-200 transition group">
      <span className="text-2xl shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-semibold text-[#16357f] truncate group-hover:underline">{f.name}</span>
        <span className="block text-[10px] text-slate-400">{size} · {new Date(f.uploadedAt).toLocaleDateString("id-ID")}</span>
      </span>
      <span className="text-[#1ca3dd] text-lg shrink-0">↗</span>
    </a>
  );
}

/* simple ship side-profile dengan dimensi */
function ShipDiagram({ d }: { d: { loa: string; b: string; h: string; t: string } }) {
  return (
    <div className="bg-slate-50 rounded-2xl ring-1 ring-slate-100 p-3">
      <svg viewBox="0 0 260 150" className="w-full">
        {/* waterline */}
        <line x1="6" y1="92" x2="254" y2="92" stroke="#9fd0e8" strokeWidth="2" strokeDasharray="4 4" />
        <text x="250" y="88" textAnchor="end" fontSize="8" fill="#64748b">garis air</text>
        {/* hull side */}
        <path d="M20 60 L220 60 L236 78 L210 110 L40 110 L20 88 Z" fill="#16357f" opacity="0.9" />
        {/* superstructure */}
        <rect x="60" y="42" width="120" height="18" rx="2" fill="#1ca3dd" />
        <rect x="150" y="30" width="34" height="14" rx="2" fill="#14b8c4" />
        {/* LOA dim */}
        <line x1="20" y1="124" x2="236" y2="124" stroke="#64748b" strokeWidth="1" />
        <line x1="20" y1="120" x2="20" y2="128" stroke="#64748b" strokeWidth="1" />
        <line x1="236" y1="120" x2="236" y2="128" stroke="#64748b" strokeWidth="1" />
        <text x="128" y="138" textAnchor="middle" fontSize="9" fill="#16357f" fontWeight="bold">LOA {d.loa || "—"} m</text>
        {/* T draft */}
        <line x1="232" y1="92" x2="232" y2="110" stroke="#0e7490" strokeWidth="1" />
        <text x="244" y="104" fontSize="8" fill="#0e7490">T {d.t || "—"}</text>
        {/* H height */}
        <text x="10" y="74" fontSize="8" fill="#64748b" transform="rotate(-90 10 74)">H {d.h || "—"} m</text>
        <text x="128" y="20" textAnchor="middle" fontSize="8" fill="#64748b">B (lebar) {d.b || "—"} m</text>
      </svg>
    </div>
  );
}
