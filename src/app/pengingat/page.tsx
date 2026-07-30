"use client";
/**
 * Pengingat / Outstanding Pekerjaan — satu daftar lintas modul, urut mendesak.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePengingat } from "@/lib/pengingat/store";
import { GAYA_TINGKAT, ringkasTingkat, teksSisa, TingkatPengingat } from "@/lib/pengingat/kumpul";
import { tanggalIndo } from "@/lib/format";

export default function PengingatPage() {
  const { ready, loading, list, waktu, muatUlang } = usePengingat();
  const [saring, setSaring] = useState<"" | TingkatPengingat>("");
  const [modul, setModul] = useState("");

  const modulList = useMemo(() => Array.from(new Set(list.map((p) => p.modul))).sort(), [list]);
  const tampil = list.filter((p) => (!saring || p.tingkat === saring) && (!modul || p.modul === modul));
  const r = ringkasTingkat(list);

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex flex-wrap items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 grid place-items-center text-2xl text-white shadow-md shrink-0">🔔</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold asdp-text-gradient tracking-tight">Pengingat Pekerjaan</h1>
            <p className="text-slate-500 text-sm">Outstanding lintas modul — tenggat Lampiran 3, termin docking, servis bengkel, kelas BKI, kerusakan</p>
          </div>
          <button onClick={muatUlang} className="btn btn-ghost text-xs">{loading ? "memeriksa…" : "↻ Periksa ulang"}</button>
        </div>
      </div>

      {!ready && (
        <p className="mt-5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
          Butuh Supabase (env) supaya pengingat bisa dibaca dari data bersama.
        </p>
      )}

      <section className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kartu label="Total outstanding" nilai={String(r.total)} bar="bg-slate-500" tint="text-slate-900" aktif={!saring} onClick={() => setSaring("")} />
        <Kartu label="Lewat tenggat" nilai={String(r.lewat)} bar="bg-red-500" tint="text-red-700" aktif={saring === "lewat"} onClick={() => setSaring(saring === "lewat" ? "" : "lewat")} />
        <Kartu label="Mendesak (≤3 hari)" nilai={String(r.mendesak)} bar="bg-amber-500" tint="text-amber-700" aktif={saring === "mendesak"} onClick={() => setSaring(saring === "mendesak" ? "" : "mendesak")} />
        <Kartu label="Segera (≤7 hari)" nilai={String(r.dekat)} bar="bg-sky-500" tint="text-sky-700" aktif={saring === "dekat"} onClick={() => setSaring(saring === "dekat" ? "" : "dekat")} />
      </section>

      {modulList.length > 1 && (
        <div className="mt-3 bg-white rounded-2xl ring-line elev-sm p-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500 font-semibold mr-1">Modul:</span>
          <button onClick={() => setModul("")}
            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition ${!modul ? "bg-slate-800 text-white border-slate-800" : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"}`}>
            Semua ({list.length})
          </button>
          {modulList.map((m) => {
            const n = list.filter((p) => p.modul === m).length;
            return (
              <button key={m} onClick={() => setModul(modul === m ? "" : m)}
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition ${modul === m ? "bg-slate-800 text-white border-slate-800" : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"}`}>
                {m} ({n})
              </button>
            );
          })}
        </div>
      )}

      <section className="mt-4 space-y-2.5">
        {!tampil.length ? (
          <p className="text-sm text-slate-500 text-center py-10 bg-white rounded-2xl ring-line">
            {loading ? "Memeriksa data…" : list.length ? "Tidak ada yang cocok dengan saringan ini."
              : "Tidak ada pekerjaan outstanding. Semua tenggat aman. 👍"}
          </p>
        ) : tampil.map((p) => {
          const g = GAYA_TINGKAT[p.tingkat];
          return (
            <Link key={p.id} href={p.href}
              className="block bg-white rounded-2xl ring-line elev-sm card-hover px-4 py-3.5 relative overflow-hidden">
              <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${g.bar}`} />
              <div className="pl-2.5 flex flex-wrap items-start gap-x-4 gap-y-1.5">
                <span className="text-xl shrink-0">{p.ikon}</span>
                <div className="flex-1 min-w-[14rem]">
                  <p className="font-bold text-slate-800 leading-snug">{p.judul}</p>
                  {p.rincian && <p className="text-[12px] text-slate-600 mt-0.5">{p.rincian}</p>}
                  <p className="text-[11px] text-slate-400 mt-0.5">{p.modul}</p>
                </div>
                {p.tenggat && (
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Tenggat</p>
                    <p className="text-xs font-semibold text-slate-700 tabular-nums">{tanggalIndo(p.tenggat)}</p>
                  </div>
                )}
                <div className="text-right min-w-[6.5rem]">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ring-1 ${g.chip}`}>{g.label}</span>
                  {p.sisaHari != null && (
                    <p className={`text-[11px] font-bold tabular-nums mt-1 ${p.sisaHari < 0 ? "text-red-700" : "text-slate-600"}`}>
                      {teksSisa(p.sisaHari)}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      {waktu && <p className="mt-4 text-[11px] text-slate-400 text-center">Terakhir diperiksa {waktu} · pengingat dihitung dari data modul, bukan disimpan tersendiri.</p>}
    </main>
  );
}

function Kartu({ label, nilai, bar, tint, aktif, onClick }: {
  label: string; nilai: string; bar: string; tint: string; aktif?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`relative bg-white rounded-2xl elev-sm pl-4 pr-3 py-3 overflow-hidden text-left transition ring-1 ${aktif ? "ring-[#1ca3dd]" : "ring-slate-200 hover:ring-slate-300"}`}>
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${bar}`} />
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold">{label}</p>
      <p className={`text-2xl font-extrabold leading-tight ${tint}`}>{nilai}</p>
    </button>
  );
}
