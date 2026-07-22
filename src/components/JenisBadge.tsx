"use client";
/**
 * Badge jenis anggaran (Rutin / Docking / Lainnya) di daftar riwayat.
 * Untuk "Lainnya": diklik -> popover berisi surat persetujuan yang menaunginya
 * (nama, nomor, tanggal, pagu surat, serapan, dan nilai pengadaan ini).
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PlafonProgram, jenisAnggaranOf } from "@/lib/anggaran/types";
import { PengadaanRow } from "@/lib/anggaran/store";
import { posProgram, nilaiPerPos } from "@/lib/anggaran/program";
import { rupiah, tanggalIndo, bulanTahun } from "@/lib/format";

const GAYA = {
  rutin: "bg-emerald-100 text-emerald-700",
  docking: "bg-amber-100 text-amber-700",
  lainnya: "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300",
} as const;
const TEKS = { rutin: "Rutin", docking: "Docking", lainnya: "Lainnya" } as const;

export default function JenisBadge({ payload, program = [], pengadaan = [] }: {
  payload: any; program?: PlafonProgram[]; pengadaan?: PengadaanRow[];
}) {
  const jenis = jenisAnggaranOf(payload || {});
  const [buka, setBuka] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [siap, setSiap] = useState(false);
  useEffect(() => setSiap(true), []);

  useEffect(() => {
    if (!buka) return;
    const luar = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) setBuka(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setBuka(false); };
    document.addEventListener("mousedown", luar);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", luar); document.removeEventListener("keydown", esc); };
  }, [buka]);

  const prog = jenis === "lainnya" ? program.find((p) => p.id === payload?.programId) : undefined;
  const bisaKlik = jenis === "lainnya" || jenis === "docking" || jenis === "rutin";

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const tinggi = 260;
      setPos({
        top: window.innerHeight - r.bottom < tinggi && r.top > tinggi ? Math.max(8, r.top - tinggi - 6) : r.bottom + 6,
        left: Math.max(8, Math.min(r.left, window.innerWidth - 340)),
      });
    }
    setBuka((v) => !v);
  };

  const badge = (
    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${GAYA[jenis]}`}>
      {TEKS[jenis]}{bisaKlik && <span className="ml-0.5 opacity-70">▾</span>}
    </span>
  );
  if (!bisaKlik) return badge;

  // ringkasan surat persetujuan (khusus jenis Lainnya)
  const pagu = prog ? (prog.rows || []).reduce((s, r) => s + (r.nilai || 0) + (r.addendum || 0), 0) : 0;
  const daftarPos = prog ? posProgram(prog, pengadaan) : [];
  const terpakai = daftarPos.reduce((s, x) => s + x.pakai, 0);
  const pct = pagu ? Math.round((terpakai / pagu) * 100) : 0;
  const nilaiIni = Object.values(nilaiPerPos(payload || {})).reduce((s, v) => s + v, 0);

  const panel = (
    <div ref={panelRef} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}
      style={{ top: pos.top, left: pos.left, width: 328 }}
      className="fixed z-[200] bg-white rounded-xl ring-1 ring-slate-300 shadow-2xl overflow-hidden text-left">
      {jenis === "lainnya" ? (
        prog ? (
          <>
            <div className="px-3 py-2 bg-indigo-100 border-b border-indigo-200">
              <p className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-800">Persetujuan Biaya Lainnya</p>
              <p className="text-sm font-bold text-indigo-950 leading-tight">{prog.nama}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                {prog.noSurat ? <>No. <b>{prog.noSurat}</b></> : "tanpa nomor surat"}{prog.tanggal ? ` · ${tanggalIndo(prog.tanggal)}` : ""}
              </p>
            </div>
            <div className="p-3 space-y-1.5 text-[11px]">
              {prog.perihal && <p className="text-slate-600 leading-snug">{prog.perihal}</p>}
              {prog.ketRekap && <p className="text-slate-600">KET. rekap: <b className="text-slate-800">{prog.ketRekap}</b></p>}
              <div className="flex justify-between"><span className="text-slate-600">Pagu surat</span><b className="tabular-nums text-slate-900">{rupiah(pagu)}</b></div>
              <div className="flex justify-between"><span className="text-slate-600">Terpakai seluruh pengadaan</span><b className="tabular-nums text-blue-800">{rupiah(Math.round(terpakai))} ({pct}%)</b></div>
              <div className="flex justify-between"><span className="text-slate-600">Sisa</span><b className={`tabular-nums ${pagu - terpakai < 0 ? "text-red-700" : "text-emerald-700"}`}>{rupiah(Math.round(pagu - terpakai))}</b></div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="text-slate-600">Nilai pengadaan ini</span><b className="tabular-nums text-slate-900">{rupiah(Math.round(nilaiIni))}</b></div>
              <a href="/dashboard#lainnya" className="block text-center mt-2 btn btn-primary text-[11px] py-1.5">Lihat di Dashboard Anggaran →</a>
            </div>
          </>
        ) : (
          <div className="p-3 text-[11px] text-amber-800">
            <p className="font-bold mb-1">Surat persetujuan tak ditemukan</p>
            <p>Pengadaan ini bertanda <b>Lainnya</b> tetapi suratnya sudah dihapus / belum dipilih. Buka pengadaan → pilih ulang di <b>Kategori Rekap</b> atau panel Sumber Pagu.</p>
          </div>
        )
      ) : (
        <div className="p-3 text-[11px] text-slate-700">
          <p className="font-bold text-slate-900 mb-1">{jenis === "docking" ? "Kendali Anggaran Docking" : "Kendali Anggaran Rutin"}</p>
          <p className="leading-snug">
            {jenis === "docking"
              ? <>Serapan masuk ke pagu <b>Docking</b> kapal terkait tahun <b>{(payload?.tanggal || "").slice(0, 4) || "-"}</b>.</>
              : <>Serapan masuk ke pagu <b>Rutin</b> bulan <b>{payload?.tanggal ? bulanTahun(payload.tanggal) : "-"}</b>.</>}
          </p>
          <div className="flex justify-between mt-2 border-t border-slate-200 pt-1.5"><span className="text-slate-600">Nilai pengadaan ini</span><b className="tabular-nums text-slate-900">{rupiah(Math.round(nilaiIni))}</b></div>
          <a href="/dashboard" className="block text-center mt-2 btn btn-ghost text-[11px] py-1.5">Buka Dashboard Anggaran →</a>
        </div>
      )}
    </div>
  );

  return (
    <>
      <button ref={btnRef} type="button" onClick={toggle} onMouseDown={(e) => e.stopPropagation()}
        title={jenis === "lainnya" ? (prog ? `Persetujuan: ${prog.nama}` : "Surat persetujuan tak ditemukan") : "Lihat kendali anggarannya"}
        className="shrink-0 rounded hover:brightness-95 transition">
        {badge}
      </button>
      {buka && siap && createPortal(panel, document.body)}
    </>
  );
}
