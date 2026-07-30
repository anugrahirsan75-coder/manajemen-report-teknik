"use client";
/**
 * Lonceng pengingat mengapung di sudut kanan atas aplikasi.
 *
 * z-index dipilih 45/46: di atas isi halaman & bilah atas ponsel (z-40),
 * tetapi DI BAWAH seluruh dialog (drawer z-50, pratinjau z-120, konfirmasi
 * z-150) supaya lonceng tak pernah menutupi jendela yang sedang dibuka.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePengingat } from "@/lib/pengingat/store";
import { GAYA_TINGKAT, ringkasTingkat, teksSisa } from "@/lib/pengingat/kumpul";

export default function LonengPengingat() {
  const { list, loading, waktu, muatUlang } = usePengingat();
  const [buka, setBuka] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
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
  if (!siap) return null;

  const isi = (
    <>
      <button ref={btn} onClick={() => setBuka((v) => !v)}
        title={mendesak ? `${mendesak} pekerjaan mendesak — klik untuk melihat` : "Pengingat pekerjaan"}
        aria-label={`Pengingat pekerjaan${r.total ? `, ${r.total} hal` : ""}`}
        className="no-print fixed top-3 right-4 z-[45] h-11 w-11 grid place-items-center rounded-full bg-white ring-1 ring-slate-300 shadow-lg hover:ring-[#1ca3dd] hover:shadow-xl transition">
        <span className="text-lg leading-none">🔔</span>
        {r.total > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 grid place-items-center rounded-full text-[10px] font-extrabold text-white ring-2 ring-white ${mendesak ? "bg-red-500" : "bg-sky-500"}`}>
            {r.total > 99 ? "99+" : r.total}
          </span>
        )}
      </button>

      {buka && (
        <div ref={panel}
          className="no-print fixed top-16 right-4 z-[46] w-[min(24rem,calc(100vw-2rem))] bg-white rounded-2xl ring-1 ring-slate-300 shadow-2xl overflow-hidden"
          style={{ animation: "popIn 0.14s ease-out both" }}>
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <span className="font-extrabold text-slate-800 text-sm">Outstanding pekerjaan</span>
            <span className="text-[11px] text-slate-500">{r.total} hal</span>
            <button onClick={muatUlang} title="Periksa ulang" className="ml-auto text-[11px] font-bold text-[#1ca3dd] hover:text-[#16357f]">
              {loading ? "…" : "↻"}
            </button>
            <button onClick={() => setBuka(false)} title="Tutup" className="text-slate-400 hover:text-slate-700 text-sm">✕</button>
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
              <div className="max-h-[22rem] overflow-auto divide-y divide-slate-100">
                {list.slice(0, 8).map((p) => (
                  <Link key={p.id} href={p.href} onClick={() => setBuka(false)}
                    className="block px-4 py-2.5 hover:bg-slate-50 transition">
                    <div className="flex items-start gap-2">
                      <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${GAYA_TINGKAT[p.tingkat].bar}`} />
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
            <Link href="/pengingat" onClick={() => setBuka(false)} className="btn btn-primary text-xs">
              Lihat semua ({r.total})
            </Link>
            {waktu && <span className="ml-auto text-[10px] text-slate-400">diperiksa {waktu}</span>}
          </div>
        </div>
      )}
    </>
  );

  return createPortal(isi, document.body);
}
