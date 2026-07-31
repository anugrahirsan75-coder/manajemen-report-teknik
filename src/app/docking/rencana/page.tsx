"use client";
/**
 * Perencanaan Docking — menyusun rencana docking satu tahun penuh:
 * Repair List galangan, RAB penunjang per Mata Anggaran, dan jadwal tahapan
 * yang lahir sendiri dari tanggal naik dok.
 *
 * Bedanya dengan Monitoring Docking: halaman ini dipakai SEBELUM kapal naik
 * dok (menyusun & mengusulkan), monitoring dipakai SESUDAHnya (mencatat apa
 * yang terjadi). Keduanya memakai kapal & tahun yang sama sebagai kunci.
 */
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { rupiah, tanggalIndo } from "@/lib/format";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { ringkasKapal } from "@/lib/kapal/nama";
import { useRencanaDocking } from "@/lib/docking/rencana/store";
import { RencanaDocking, rencanaBaru, totalRencana } from "@/lib/docking/rencana/types";
import { susunJadwal, ringkasJadwal, selisihHari, hariIniLokal } from "@/lib/docking/rencana/tahapan";
import Editor from "./Editor";

export default function HalamanRencanaDocking() {
  const { list, loading, err, simpan, hapus, ready } = useRencanaDocking();
  const [tahun, setTahun] = useState<number>(new Date().getFullYear() + 1);
  const [edit, setEdit] = useState<RencanaDocking | null>(null);
  const hariIni = hariIniLokal();

  const tahunAda = useMemo(() => {
    const t = new Set<number>(list.map((x) => x.tahun));
    t.add(new Date().getFullYear()); t.add(new Date().getFullYear() + 1);
    return Array.from(t).sort((a, b) => b - a);
  }, [list]);

  const baris = useMemo(() => list.filter((x) => x.tahun === tahun), [list, tahun]);
  const belum = KAPAL_ANGGARAN.filter((k) => !baris.some((b) => b.kapal === k));

  const totalTahun = baris.reduce((s, r) => s + totalRencana(r).total, 0);
  const totalPagu = baris.reduce((s, r) => s + totalRencana(r).pagu, 0);

  if (edit) {
    return (
      <main className="max-w-6xl mx-auto px-5 py-8">
        <Editor awal={edit} kapalTersedia={KAPAL_ANGGARAN}
          onSimpan={async (r) => { await simpan(r); setEdit(r); }}
          onHapus={hapus}
          onTutup={() => setEdit(null)} />
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex flex-wrap items-center gap-4">
          <div className="bg-white rounded-2xl p-2 shadow-md shrink-0">
            <Image src="/logo-asdp.png" alt="ASDP" width={56} height={38} className="object-contain" />
          </div>
          <div className="flex-1 min-w-[15rem]">
            <h1 className="text-2xl font-extrabold asdp-text-gradient">Perencanaan Docking</h1>
            <p className="text-slate-500 text-sm">Repair List · RAB penunjang per Mata Anggaran · jadwal tahapan otomatis</p>
          </div>
          <select value={tahun} onChange={(e) => setTahun(+e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white">
            {tahunAda.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Link href="/docking" className="btn btn-ghost text-xs">📋 Monitoring Docking</Link>
        </div>
      </div>

      {!ready && (
        <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
          Supabase belum aktif — rencana tersimpan di peramban ini saja.
        </p>
      )}
      {err && <p className="mt-4 text-sm text-rose-800 bg-rose-50 ring-1 ring-rose-200 rounded-xl px-3 py-2">{err}</p>}

      <section className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Rencana tersusun" nilai={String(baris.length)} ket={`dari ${KAPAL_ANGGARAN.length} kapal`} />
        <Stat label="Total usulan" nilai={rupiah(totalTahun)} ket="galangan + penunjang, ber-PPN" />
        <Stat label="Pagu RKA terisi" nilai={totalPagu ? rupiah(totalPagu) : "—"}
          ket={totalPagu ? (totalTahun > totalPagu ? `usulan lebih ${rupiah(totalTahun - totalPagu)}` : `sisa ${rupiah(totalPagu - totalTahun)}`) : "belum diisi"}
          warna={totalPagu && totalTahun > totalPagu ? "text-rose-600" : "text-slate-800"} />
        <Stat label="Kapal belum direncanakan" nilai={String(belum.length)} ket={belum.slice(0, 3).map(ringkasKapal).join(" · ") || "semua sudah"} />
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <h2 className="font-bold text-slate-700 flex-1">Rencana docking {tahun}</h2>
        <button onClick={() => setEdit(rencanaBaru("", tahun))} className="btn btn-primary text-sm px-4">＋ Rencana baru</button>
      </div>

      {loading && !baris.length ? (
        <p className="mt-3 text-sm text-slate-400">Memuat…</p>
      ) : !baris.length ? (
        <div className="mt-3 text-center bg-white rounded-2xl ring-line elev-sm p-8">
          <p className="text-slate-400 text-sm">Belum ada rencana untuk {tahun}. Klik <b>＋ Rencana baru</b>,
            isi kapal dan rencana tanggal naik dok — jadwal tahapannya langsung tersusun.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {baris.map((r) => {
            const t = totalRencana(r);
            const jadwal = susunJadwal(r.naikDok || "", r.lamaDocking || 21, r.jadwal || {}, r.tugasTambahan || []);
            const rj = ringkasJadwal(jadwal, hariIni, r.tugasSelesai || {});
            const hari = r.naikDok ? selisihHari(hariIni, r.naikDok) : null;
            const lebih = t.pagu > 0 && t.total > t.pagu;
            return (
              <button key={r.id} onClick={() => setEdit(r)}
                className="w-full text-left bg-white rounded-2xl ring-line elev-sm p-4 hover:ring-[#1ca3dd] transition flex flex-wrap items-center gap-4">
                <div className="min-w-[11rem] flex-1">
                  <p className="font-bold text-slate-800">{r.kapal || "(kapal belum diisi)"}</p>
                  <p className="text-[11px] text-slate-500">
                    {r.naikDok ? `naik dok ${tanggalIndo(r.naikDok)} · ${r.lamaDocking || 21} hari` : "tanggal naik dok belum diisi"}
                    {r.galangan ? ` · ${r.galangan}` : ""}
                  </p>
                </div>

                <div className="w-28">
                  <p className="text-[10px] uppercase text-slate-400">Repair List</p>
                  <p className="text-sm font-semibold tabular-nums text-slate-700">{(r.rl || []).length} pekerjaan</p>
                </div>
                <div className="w-40">
                  <p className="text-[10px] uppercase text-slate-400">Usulan</p>
                  <p className={`text-sm font-semibold tabular-nums ${lebih ? "text-rose-600" : "text-slate-700"}`}>{rupiah(t.total)}</p>
                  {t.pagu > 0 && <p className="text-[10px] text-slate-400 tabular-nums">pagu {rupiah(t.pagu)}</p>}
                </div>
                <div className="w-36">
                  <p className="text-[10px] uppercase text-slate-400">Tahapan</p>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                    <div className={`h-full ${rj.telat ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${rj.pct}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {rj.pct}% · {rj.telat ? `${rj.telat} lewat tenggat` : `${rj.berjalan} berjalan`}
                  </p>
                </div>
                <div className="w-24 text-right">
                  {hari === null ? <span className="text-[11px] text-slate-400">—</span>
                    : hari > 0 ? <span className="text-[11px] font-semibold text-sky-700">{hari} hr lagi</span>
                    : hari === 0 ? <span className="text-[11px] font-semibold text-emerald-700">hari ini</span>
                    : <span className="text-[11px] text-slate-400">lewat {-hari} hr</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {belum.length > 0 && (
        <div className="mt-4 bg-white rounded-2xl ring-line elev-sm p-4">
          <p className="text-xs font-semibold text-slate-600 mb-2">Belum punya rencana {tahun}</p>
          <div className="flex flex-wrap gap-1.5">
            {belum.map((k) => (
              <button key={k} onClick={() => setEdit(rencanaBaru(k, tahun))}
                className="text-[11px] px-2.5 py-1 rounded-lg ring-1 ring-slate-200 hover:bg-slate-50 text-slate-600">
                ＋ {ringkasKapal(k)}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, nilai, ket, warna = "text-slate-800" }: { label: string; nilai: string; ket: string; warna?: string }) {
  return (
    <div className="bg-white rounded-2xl ring-line elev-sm p-4">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</p>
      <p className={`text-xl font-extrabold tabular-nums ${warna}`}>{nilai}</p>
      <p className="text-[10px] text-slate-400 truncate" title={ket}>{ket}</p>
    </div>
  );
}
