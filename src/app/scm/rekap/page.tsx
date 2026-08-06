"use client";
/**
 * Rekap & analisa proses pengadaan SCM.
 *
 * Pertanyaan yang selalu muncul di rapat bukan "sudah sampai mana" melainkan
 * "kenapa lama". Halaman ini menjawabnya dengan angka: berapa hari rata-rata
 * tiap tahap memakan waktu, tahap mana yang paling sering menahan, dan
 * pengadaan mana yang sedang tertahan paling lama.
 *
 * Rata-rata dihitung dari tahap yang SUDAH selesai dilewati saja. Menghitung
 * tahap yang sedang berjalan akan menurunkan angkanya terus-menerus hanya
 * karena ada pekerjaan baru masuk hari ini.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import BilahScm from "@/components/scm/BilahScm";
import { useSppbj } from "@/lib/sppbj/store";
import { totalSppbj } from "@/lib/sppbj/types";
import { rupiah, tanggalIndo } from "@/lib/format";
import { BarisScm, muatProses } from "@/lib/scm/store";
import {
  LABEL_TAHAP, TahapScm, URUT_TAHAP, WAJAR_HARI, WARNA_TAHAP,
  lamaPerTahap, mulaiTahap, tertahan, totalHari, umurTahap,
} from "@/lib/scm/types";

export default function RekapScm() {
  const { listRemote } = useSppbj();
  const [sppbj, setSppbj] = useState<any[]>([]);
  const [proses, setProses] = useState<BarisScm[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");

  const ambil = useCallback(async () => {
    setMuat(true); setGalat("");
    try {
      const [a, b] = await Promise.all([listRemote(), muatProses()]);
      setSppbj(a || []); setProses(b);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, [listRemote]);

  useEffect(() => { void ambil(); }, [ambil]);

  const data = useMemo(() => {
    const petaSppbj = new Map(sppbj.map((r) => [r.id, r]));
    const baris = proses.map((b) => {
      const r = petaSppbj.get(b.proses.sppbjId);
      const item = r?.payload?.items || [];
      const nego = (b.proses.itemNego || []).reduce((s, x) => {
        const it = item[x.idx];
        return s + (x.hargaNego || 0) * (Number(it?.jumlah) || 0);
      }, 0);
      return {
        id: b.id,
        nama: r?.nama_pengadaan || "(pengadaan terhapus)",
        nomor: r?.payload?.noSPPBJ || "-",
        tanggal: r?.payload?.tanggal || "",
        proses: b.proses,
        nilaiAwal: totalSppbj(item),
        nilaiNego: nego,
        lama: lamaPerTahap(b.proses),
      };
    });

    // rata-rata per tahap, hanya dari tahap yang sudah DILEWATI
    const kumpul: Record<string, number[]> = {};
    baris.forEach((x) => {
      const j = x.proses.jejak || [];
      x.lama.forEach((l, i) => {
        if (i < j.length - 1) (kumpul[l.tahap] = kumpul[l.tahap] || []).push(l.hari);
      });
    });
    const perTahap = URUT_TAHAP.filter((t) => t !== "selesai").map((t) => {
      const arr = kumpul[t] || [];
      const rata = arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0;
      return {
        tahap: t, jumlah: arr.length, rata,
        terlama: arr.length ? Math.max(...arr) : 0,
        wajar: WAJAR_HARI[t],
        sedangDi: baris.filter((x) => x.proses.tahap === t).length,
      };
    });

    const selesai = baris.filter((x) => x.proses.tahap === "selesai");
    const berjalan = baris.filter((x) => x.proses.tahap !== "selesai");
    return {
      baris, perTahap, selesai, berjalan,
      rataTuntas: selesai.length
        ? Math.round(selesai.reduce((s, x) => s + totalHari(x.proses), 0) / selesai.length)
        : 0,
      hemat: baris.reduce((s, x) => s + (x.nilaiNego ? x.nilaiAwal - x.nilaiNego : 0), 0),
      macet: berjalan.filter((x) => tertahan(x.proses)).sort((a, b) => umurTahap(b.proses) - umurTahap(a.proses)),
    };
  }, [sppbj, proses]);

  const puncak = Math.max(1, ...data.perTahap.map((t) => t.rata));

  return (
    <div className="min-h-screen bg-slate-100">
      <BilahScm aksi={
        <button onClick={ambil} disabled={muat}
          className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25 disabled:opacity-50">
          {muat ? "Memuat…" : "↻ Muat ulang"}
        </button>
      } />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-lg font-extrabold text-slate-800">Rekap &amp; lama proses</h1>
        <p className="text-sm text-slate-500">Berapa hari tiap tahap memakan waktu, dan di mana pengadaan tertahan.</p>

        {galat && <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{galat}</div>}
        {muat && <p className="py-10 text-center text-sm text-slate-400">Memuat…</p>}

        {!muat && (
          <>
            <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Angka label="Sedang berjalan" nilai={String(data.berjalan.length)} />
              <Angka label="Tertahan" nilai={String(data.macet.length)} warna="text-rose-700" sub="melewati lama wajar tahapnya" />
              <Angka label="Selesai" nilai={String(data.selesai.length)} warna="text-emerald-700"
                sub={data.rataTuntas ? `rata-rata ${data.rataTuntas} hari` : undefined} />
              <Angka label="Turun harga" nilai={rupiah(data.hemat)} warna="text-sky-800" sub="selisih penawaran vs nego" />
            </section>

            {/* lama tiap tahap */}
            <section className="mt-6">
              <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Lama tiap tahap</h2>
              <p className="mb-2 text-[11px] text-slate-400">
                Dihitung dari tahap yang sudah selesai dilewati. Batang merah berarti rata-ratanya melewati lama wajar.
              </p>
              <div className="space-y-1.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                {data.perTahap.map((t) => {
                  const lewat = t.rata > t.wajar;
                  return (
                    <div key={t.tahap} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-[11px] font-bold text-slate-600">{LABEL_TAHAP[t.tahap]}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full ${lewat ? "bg-rose-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, (t.rata / puncak) * 100)}%` }} />
                      </div>
                      <span className={`w-20 shrink-0 text-right text-[11px] font-bold tabular-nums ${lewat ? "text-rose-700" : "text-slate-700"}`}>
                        {t.jumlah ? `${t.rata.toFixed(1)} hari` : "—"}
                      </span>
                      <span className="w-32 shrink-0 text-right text-[10px] text-slate-400">
                        {t.jumlah ? `${t.jumlah} kali · terlama ${t.terlama}h` : "belum ada data"}
                        {t.sedangDi > 0 && ` · ${t.sedangDi} di sini`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* yang tertahan */}
            {data.macet.length > 0 && (
              <section className="mt-6">
                <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Sedang tertahan</h2>
                <div className="mt-2 space-y-2">
                  {data.macet.map((x) => (
                    <div key={x.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-rose-200">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-1 ${WARNA_TAHAP[x.proses.tahap]}`}>
                        {LABEL_TAHAP[x.proses.tahap]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-800">{x.nama}</span>
                        <span className="text-[11px] text-slate-500">
                          {x.nomor} · sejak {mulaiTahap(x.proses) ? tanggalIndo(mulaiTahap(x.proses).slice(0, 10)) : "—"}
                          {x.proses.catatan ? ` · ${x.proses.catatan}` : ""}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-lg font-extrabold text-rose-700">{umurTahap(x.proses)} hari</span>
                        <span className="text-[10px] text-slate-400">wajar {WAJAR_HARI[x.proses.tahap]} hari</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* daftar lengkap */}
            <section className="mt-6">
              <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Semua pengadaan di SCM</h2>
              <div className="mt-2 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <table className="w-full min-w-[56rem] text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-extrabold">Pengadaan</th>
                      <th className="px-3 py-2.5 text-left font-extrabold">Tahap</th>
                      <th className="px-3 py-2.5 text-right font-extrabold">Nilai SPPBJ</th>
                      <th className="px-3 py-2.5 text-right font-extrabold">Setelah nego</th>
                      <th className="px-3 py-2.5 text-right font-extrabold">Turun</th>
                      <th className="px-3 py-2.5 text-right font-extrabold">Hari di SCM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.baris.map((x) => (
                      <tr key={x.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <span className="block text-[13px] font-semibold text-slate-800">{x.nama}</span>
                          <span className="text-[10px] text-slate-400">{x.nomor} · SPPBJ {x.tanggal ? tanggalIndo(x.tanggal) : "—"}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-1 ${WARNA_TAHAP[x.proses.tahap]}`}>
                            {LABEL_TAHAP[x.proses.tahap]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{rupiah(x.nilaiAwal)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">
                          {x.nilaiNego ? rupiah(x.nilaiNego) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                          {x.nilaiNego ? rupiah(x.nilaiAwal - x.nilaiNego) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums font-bold ${tertahan(x.proses) ? "text-rose-700" : "text-slate-700"}`}>
                          {totalHari(x.proses)}
                        </td>
                      </tr>
                    ))}
                    {!data.baris.length && (
                      <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-400">
                        Belum ada pengadaan yang diterima di SCM.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Angka({ label, nilai, warna, sub }: { label: string; nilai: string; warna?: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`text-xl font-extrabold tabular-nums ${warna || "text-slate-800"}`}>{nilai}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}
