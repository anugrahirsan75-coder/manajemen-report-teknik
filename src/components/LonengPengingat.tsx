"use client";
/**
 * Lonceng pengingat di sidebar: jumlah pekerjaan outstanding + daftar ringkas.
 * Isi lengkapnya di /pengingat — di sini hanya 6 teratas yang paling mendesak.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePengingat } from "@/lib/pengingat/store";
import { GAYA_TINGKAT, ringkasTingkat, teksSisa } from "@/lib/pengingat/kumpul";

export default function LonengPengingat({ onNavigate }: { onNavigate?: () => void }) {
  const { list, loading, waktu, muatUlang } = usePengingat();
  const [buka, setBuka] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [siap, setSiap] = useState(false);
  useEffect(() => setSiap(true), []);

  useEffect(() => {
    if (!buka) return;
    const luar = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setBuka(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setBuka(false); };
    document.addEventListener("mousedown", luar);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", luar); document.removeEventListener("keydown", esc); };
  }, [buka]);

  const r = ringkasTingkat(list);
  const mendesak = r.lewat + r.mendesak;

  const toggle = () => {
    const b = btn.current?.getBoundingClientRect();
    if (b) setPos({ top: Math.min(b.top, window.innerHeight - 460), left: b.right + 8 });
    setBuka((v) => !v);
  };

  const isiPanel = (
    <div ref={panel} style={{ top: pos.top, left: pos.left, width: 380 }}
      className="fixed z-[210] bg-white rounded-2xl ring-1 ring-slate-300 shadow-2xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <span className="font-extrabold text-slate-800 text-sm">Outstanding pekerjaan</span>
        <span className="text-[11px] text-slate-500">{r.total} hal</span>
        <button onClick={muatUlang} className="ml-auto text-[11px] font-bold text-[#1ca3dd] hover:text-[#16357f]">
          {loading ? "…" : "↻"}
        </button>
      </div>

      {r.total === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500 text-center">
          {loading ? "Memeriksa…" : "Tidak ada yang lewat tenggat. 👍"}
        </p>
      ) : (
        <>
          <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b border-slate-100">
            {r.lewat > 0 && <span className={`text-[10px] font-bold px-2 py-0.5 rounded ring-1 ${GAYA_TINGKAT.lewat.chip}`}>{r.lewat} lewat tenggat</span>}
            {r.mendesak > 0 && <span className={`text-[10px] font-bold px-2 py-0.5 rounded ring-1 ${GAYA_TINGKAT.mendesak.chip}`}>{r.mendesak} mendesak</span>}
            {r.dekat > 0 && <span className={`text-[10px] font-bold px-2 py-0.5 rounded ring-1 ${GAYA_TINGKAT.dekat.chip}`}>{r.dekat} segera</span>}
          </div>
          <div className="max-h-[19rem] overflow-auto divide-y divide-slate-100">
            {list.slice(0, 6).map((p) => (
              <Link key={p.id} href={p.href} onClick={() => { setBuka(false); onNavigate?.(); }}
                className="block px-4 py-2.5 hover:bg-slate-50 transition">
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${GAYA_TINGKAT[p.tingkat].bar}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-slate-800 leading-snug">{p.ikon} {p.judul}</p>
                    {p.rincian && <p className="text-[11px] text-slate-500 truncate">{p.rincian}</p>}
                    <p className="text-[10px] text-slate-400">{p.modul}{p.sisaHari != null ? ` · ${teksSisa(p.sisaHari)}` : ""}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
        <Link href="/pengingat" onClick={() => { setBuka(false); onNavigate?.(); }} className="btn btn-primary text-xs">
          Lihat semua ({r.total})
        </Link>
        {waktu && <span className="ml-auto text-[10px] text-slate-400">diperiksa {waktu}</span>}
      </div>
    </div>
  );

  return (
    <>
      <button ref={btn} onClick={toggle}
        title={mendesak ? `${mendesak} pekerjaan mendesak` : "Pengingat pekerjaan"}
        className="relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-white/80 hover:bg-white/10 transition">
        <span className="relative grid place-items-center h-8 w-8 rounded-lg bg-white/5 text-base shrink-0">
          🔔
          {r.total > 0 && (
            <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full text-[10px] font-extrabold text-white ${mendesak ? "bg-red-500" : "bg-sky-500"}`}>
              {r.total > 99 ? "99+" : r.total}
            </span>
          )}
        </span>
        <span className="min-w-0 leading-tight text-left">
          <span className="block text-sm font-semibold">Pengingat</span>
          <span className="block text-[10px] text-white/45 truncate">
            {r.total ? `${r.lewat} lewat · ${r.mendesak} mendesak` : loading ? "memeriksa…" : "semua beres"}
          </span>
        </span>
      </button>
      {siap && buka ? createPortal(isiPanel, document.body) : null}
    </>
  );
}
