"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useKapalDb } from "@/lib/kapal/store";
import {
  Ship, GENERAL_FIELDS, DIM_FIELDS, ENGINE_FIELDS, GEARBOX_FIELDS, shipFilled,
  ShipGeneral, ShipDimension, ShipEngine, ShipGearbox, ShipFile,
} from "@/lib/kapal/types";
import { uploadInventaris, removeInventaris } from "@/lib/kapal/upload";

export default function ShipDatabasePage() {
  const { ships, loading, saving, lastSaved, supabaseReady, updateShip, saveAll } = useKapalDb();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return ships;
    return ships.filter((s) => (s.nama + " " + s.general.lintasan + " " + s.mainEngine.merk).toLowerCase().includes(n));
  }, [ships, q]);

  const lengkap = ships.filter((s) => shipFilled(s) >= 90).length;
  const open = ships.find((s) => s.id === openId) || null;

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      {/* HERO */}
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 relative overflow-hidden">
          <WaveDeco />
          <div className="flex items-center gap-4 relative">
            <div className="bg-white rounded-2xl p-2 shadow-md shrink-0"><Image src="/logo-asdp.png" alt="ASDP" width={56} height={38} className="object-contain" /></div>
            <div className="flex-1">
              <Link href="/dashboard" className="text-xs text-slate-500 hover:text-[#16357f]">‹ Dashboard</Link>
              <h1 className="text-2xl font-extrabold asdp-text-gradient flex items-center gap-2">⚓ Ship Database</h1>
              <p className="text-slate-500 text-sm">Data partikular armada ASDP Ternate — klik kartu untuk lihat &amp; edit spesifikasi.</p>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-1 text-right">
              <span className="text-3xl font-extrabold text-[#16357f]">{ships.length}</span>
              <span className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Kapal</span>
              <span className="text-[11px] text-slate-500">{lengkap} data lengkap</span>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kapal / lintasan / mesin…"
            className="text-sm border px-3 py-2 rounded-xl bg-white pl-8 w-72 focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/20 outline-none" />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
        </div>
        <span className="text-xs text-slate-400">{loading ? "memuat…" : `${filtered.length} kapal`}{lastSaved && <> · tersimpan {lastSaved}</>}</span>
      </div>

      {/* GRID */}
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((s, i) => (
          <ShipCard key={s.id} ship={s} onClick={() => setOpenId(s.id)} index={i} />
        ))}
        {filtered.length === 0 && <p className="col-span-full text-center text-slate-400 text-sm py-10">Tak ada kapal cocok.</p>}
      </div>

      {open && (
        <ShipModal
          ship={open}
          saving={saving}
          supabaseReady={supabaseReady}
          onClose={() => setOpenId(null)}
          onPersist={async (next) => { updateShip(next.id, next); await saveAll(ships.map((s) => (s.id === next.id ? next : s))); }}
          onSave={async (next) => { updateShip(next.id, next); await saveAll(ships.map((s) => (s.id === next.id ? next : s))); setOpenId(null); }}
        />
      )}
    </main>
  );
}

/* ---------- Kartu kapal ---------- */
function ShipCard({ ship, onClick, index }: { ship: Ship; onClick: () => void; index: number }) {
  const pct = shipFilled(ship);
  const g = ship.general, d = ship.dimension;
  return (
    <button onClick={onClick} style={{ animationDelay: `${index * 40}ms` }}
      className="anim-in text-left bg-white rounded-2xl ring-line elev-sm card-hover overflow-hidden group">
      {/* band atas */}
      <div className="relative px-4 pt-4 pb-3 text-white" style={{ background: "linear-gradient(135deg,#16357f,#0e2456)" }}>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#7cc242] via-[#14b8c4] to-[#f5b301]" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-extrabold leading-tight tracking-tight">{ship.nama}</p>
            <p className="text-white/60 text-[11px] mt-0.5 font-mono">{g.callSign || "—"} · IMO {g.imo || "—"}</p>
          </div>
          <Ring pct={pct} />
        </div>
      </div>
      {/* body */}
      <div className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5 mb-2">
          <Chip label="GT" value={d.gt} />
          <Chip label="Tahun" value={g.tahun} />
          <Chip label="ME" value={ship.mainEngine.merk} />
          {ship.inventaris?.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 rounded-lg px-2 py-0.5 font-semibold">📄 {ship.inventaris.length}</span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">Lintasan</p>
        <p className="text-xs text-slate-600 line-clamp-2 min-h-[2rem]">{g.lintasan || <span className="text-slate-300">belum ada data lintasan</span>}</p>
        <p className="mt-2 text-[11px] text-[#1ca3dd] font-semibold group-hover:underline">Lihat partikular →</p>
      </div>
    </button>
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
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 97.4} 97.4`} />
      </svg>
      <span className="absolute text-[10px] font-bold text-white">{pct}%</span>
    </div>
  );
}

function WaveDeco() {
  return (
    <svg className="absolute -bottom-2 right-0 w-72 opacity-[0.07] pointer-events-none" viewBox="0 0 200 60" fill="none">
      <path d="M0 40 Q25 20 50 40 T100 40 T150 40 T200 40" stroke="#16357f" strokeWidth="3" />
      <path d="M0 50 Q25 30 50 50 T100 50 T150 50 T200 50" stroke="#16357f" strokeWidth="3" />
    </svg>
  );
}

/* ---------- Modal vessel particulars (editable) ---------- */
function ShipModal({ ship, onClose, onSave, onPersist, saving, supabaseReady }: {
  ship: Ship; onClose: () => void; onSave: (s: Ship) => void; onPersist: (s: Ship) => Promise<void>; saving: boolean; supabaseReady: boolean;
}) {
  const [draft, setDraft] = useState<Ship>({ ...ship, inventaris: ship.inventaris || [], gearbox: ship.gearbox || { merk: "", type: "", ratio: "", serialStbd: "", serialPrsd: "" } });
  const [uploading, setUploading] = useState(false);
  useEffect(() => { setDraft({ ...ship, inventaris: ship.inventaris || [], gearbox: ship.gearbox || { merk: "", type: "", ratio: "", serialStbd: "", serialPrsd: "" } }); }, [ship]);
  const pct = shipFilled(draft);

  const setG = (k: keyof ShipGeneral, v: string) => setDraft((p) => ({ ...p, general: { ...p.general, [k]: v } }));
  const setD = (k: keyof ShipDimension, v: string) => setDraft((p) => ({ ...p, dimension: { ...p.dimension, [k]: v } }));
  const setME = (k: keyof ShipEngine, v: string) => setDraft((p) => ({ ...p, mainEngine: { ...p.mainEngine, [k]: v } }));
  const setAE = (k: keyof ShipEngine, v: string) => setDraft((p) => ({ ...p, auxEngine: { ...p.auxEngine, [k]: v } }));
  const setGB = (k: keyof ShipGearbox, v: string) => setDraft((p) => ({ ...p, gearbox: { ...p.gearbox, [k]: v } }));

  // upload file inventaris -> langsung simpan (biar tak hilang referensinya)
  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const added: ShipFile[] = [];
      for (const f of Array.from(files)) added.push(await uploadInventaris(draft.id, f));
      const next = { ...draft, inventaris: [...draft.inventaris, ...added] };
      setDraft(next); await onPersist(next);
    } catch (e: any) { alert("Gagal unggah: " + (e?.message || e)); }
    finally { setUploading(false); }
  };
  const onDeleteFile = async (f: ShipFile) => {
    if (!confirm(`Hapus file "${f.name}"?`)) return;
    await removeInventaris(f);
    const next = { ...draft, inventaris: draft.inventaris.filter((x) => x.url !== f.url) };
    setDraft(next); await onPersist(next);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-3 bg-black/50 overflow-auto" onMouseDown={onClose}>
      <div className="bg-white w-full max-w-3xl my-4 rounded-2xl shadow-2xl overflow-hidden" onMouseDown={(e) => e.stopPropagation()}
        style={{ backgroundImage: "linear-gradient(rgba(22,53,127,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(22,53,127,0.025) 1px,transparent 1px)", backgroundSize: "22px 22px" }}>
        {/* header */}
        <div className="px-6 py-4 text-white relative" style={{ background: "linear-gradient(135deg,#16357f,#0e2456)" }}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#7cc242] via-[#14b8c4] to-[#f5b301]" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-white/55 text-[11px] uppercase tracking-[0.2em] font-semibold">Vessel Particulars</p>
              <h2 className="text-2xl font-extrabold tracking-tight">{draft.nama}</h2>
              <p className="text-white/60 text-xs font-mono mt-0.5">Call Sign {draft.general.callSign || "—"} · IMO {draft.general.imo || "—"} · BKI {draft.general.registerBKI || "—"}</p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 90 ? "#7cc242" : "#f5b301" }} />
            </div>
            <span className="text-[11px] text-white/70 font-semibold">{pct}% lengkap</span>
          </div>
        </div>

        {/* body */}
        <div className="px-6 py-5 max-h-[64vh] overflow-auto">
          <SectionBand title="General Data" />
          <div className="grid sm:grid-cols-2 gap-x-6">
            {GENERAL_FIELDS.map((f) => (
              <Row key={f.key} label={f.label} value={draft.general[f.key]} onChange={(v) => setG(f.key, v)} wide={f.key === "lintasan"} />
            ))}
          </div>

          <SectionBand title="Main Dimension" />
          <div className="grid sm:grid-cols-2 gap-x-6">
            {DIM_FIELDS.map((f) => (
              <Row key={f.key} label={f.label} value={draft.dimension[f.key]} unit={f.unit} onChange={(v) => setD(f.key, v)} />
            ))}
          </div>

          <SectionBand title="Main Engine" sub="Mesin Induk" />
          <div className="grid sm:grid-cols-2 gap-x-6">
            {ENGINE_FIELDS.map((f) => (
              <Row key={f.key} label={f.label} value={draft.mainEngine[f.key]} onChange={(v) => setME(f.key, v)} />
            ))}
          </div>

          <SectionBand title="Auxiliary Engine" sub="Mesin Bantu" />
          <div className="grid sm:grid-cols-2 gap-x-6">
            {ENGINE_FIELDS.map((f) => (
              <Row key={f.key} label={f.label} value={draft.auxEngine[f.key]} onChange={(v) => setAE(f.key, v)} />
            ))}
          </div>

          <SectionBand title="Gearbox" sub="Transmisi" />
          <div className="grid sm:grid-cols-2 gap-x-6">
            {GEARBOX_FIELDS.map((f) => (
              <Row key={f.key} label={f.label} value={draft.gearbox[f.key]} onChange={(v) => setGB(f.key, v)} />
            ))}
          </div>

          <SectionBand title="Daftar Inventaris" sub="file — klik untuk buka" />
          <div className="space-y-1.5">
            {draft.inventaris.length === 0 && <p className="text-xs text-slate-400 py-1">Belum ada file inventaris. Unggah PDF / Excel / gambar di bawah.</p>}
            {draft.inventaris.map((f) => (
              <div key={f.url} className="flex items-center gap-2 bg-slate-50 hover:bg-sky-50 rounded-lg px-3 py-2 ring-1 ring-slate-100">
                <span className="text-lg shrink-0">{fileIcon(f)}</span>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium text-[#16357f] truncate hover:underline">{f.name}</span>
                  <span className="block text-[10px] text-slate-400">{fmtSize(f.size)} · {new Date(f.uploadedAt).toLocaleDateString("id-ID")}</span>
                </a>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-[11px] px-2 py-1 rounded-md border border-sky-300 text-sky-700 hover:bg-sky-100 shrink-0">Buka ↗</a>
                <button onClick={() => onDeleteFile(f)} title="Hapus file" className="text-red-400 hover:text-red-600 text-sm px-1 shrink-0">✕</button>
              </div>
            ))}
            <label className={`mt-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 text-sm cursor-pointer transition ${uploading ? "border-sky-300 bg-sky-50 text-sky-600" : "border-slate-300 text-slate-500 hover:border-[#1ca3dd] hover:bg-sky-50/50"}`}>
              <span>{uploading ? "⏳ Mengunggah…" : "⬆️ Unggah / Update File Inventaris"}</span>
              <input type="file" multiple accept=".pdf,.xlsx,.xls,.doc,.docx,.csv,image/*" className="hidden" disabled={uploading || !supabaseReady}
                onChange={(e) => { onUpload(e.target.files); e.target.value = ""; }} />
            </label>
            {!supabaseReady && <p className="text-[11px] text-amber-600">File inventaris butuh Supabase aktif (penyimpanan online).</p>}
          </div>
        </div>

        {/* footer */}
        <div className="px-6 py-3 border-t bg-slate-50 flex items-center gap-3">
          <span className="text-[11px] text-slate-400">{supabaseReady ? "Tersimpan ke server + lokal" : "Tersimpan lokal (Supabase off)"}</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="text-xs px-3 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-white">Tutup</button>
            <button onClick={() => onSave(draft)} disabled={saving} className="text-xs font-semibold px-4 py-2 rounded-lg asdp-gradient text-white disabled:opacity-50">
              {saving ? "Menyimpan…" : "💾 Simpan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtSize(b: number): string {
  if (!b) return "—";
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + " KB";
  return (b / 1024 / 1024).toFixed(1) + " MB";
}
function fileIcon(f: ShipFile): string {
  const n = (f.type || "") + " " + f.name.toLowerCase();
  if (/pdf/.test(n)) return "📕";
  if (/sheet|xls|csv/.test(n)) return "📗";
  if (/word|doc/.test(n)) return "📘";
  if (/image|png|jpg|jpeg|webp|gif/.test(n)) return "🖼️";
  return "📄";
}

function SectionBand({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-2 first:mt-0">
      <span className="h-3.5 w-1 rounded-full bg-[#f5b301]" />
      <h3 className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#16357f]">{title}</h3>
      {sub && <span className="text-[11px] text-slate-400 normal-case tracking-normal font-normal">· {sub}</span>}
      <span className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent ml-1" />
    </div>
  );
}

function Row({ label, value, onChange, unit, wide }: { label: string; value: string; onChange: (v: string) => void; unit?: string; wide?: boolean }) {
  return (
    <div className={`grid grid-cols-[140px_10px_1fr] items-center py-1 border-b border-dashed border-slate-200/70 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[12px] text-slate-500">{label}</span>
      <span className="text-slate-300 text-center">:</span>
      <div className="flex items-center gap-1.5">
        <input value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 font-mono text-[13px] text-slate-800 bg-transparent rounded px-1 py-0.5 outline-none focus:bg-sky-50 hover:bg-slate-50 transition placeholder:text-slate-300 placeholder:font-sans placeholder:not-italic"
          placeholder="—" />
        {unit && <span className="text-[11px] text-slate-400 shrink-0">{unit}</span>}
      </div>
    </div>
  );
}
