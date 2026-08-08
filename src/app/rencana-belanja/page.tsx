"use client";
/**
 * Rencana Belanja — menyusun rencana pemakaian pagu rutin sebelum SPPBJ dibuat.
 *
 * Cukup nama pengadaan, mata anggarannya, dan taksiran nilainya. Layar ini
 * menjawab satu pertanyaan: rencana ini masih muat atau tidak — dan muatnya
 * diukur terhadap pagu yang SUDAH DIKURANGI pemakaian berjalan, bukan pagu
 * kosong, karena bulan yang sudah banyak terpakai kalau tidak begitu akan
 * tampak lapang padahal tidak.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAnggaran } from "@/lib/anggaran/store";
import { realisasiRutin } from "@/lib/anggaran/store";
import { MATA_ANGGARAN, labelMA, maKey, paguTotal } from "@/lib/anggaran/types";
import { rupiah, bulanTahun } from "@/lib/format";
import {
  BarisRencana, RencanaBelanja, SimpananRencana, barisBaru, bulanRentang,
  hapusRencana, muatRencana, rencanaKosong, simpanRencana,
} from "@/lib/anggaran/rencanaBelanja";

const bulanIni = () => new Date().toISOString().slice(0, 7);

export default function RencanaBelanjaHal() {
  const { plafon, pengadaan, loading } = useAnggaran();
  const [daftar, setDaftar] = useState<SimpananRencana[]>([]);
  const [idAktif, setIdAktif] = useState<string | null>(null);
  const [isi, setIsi] = useState<RencanaBelanja>(() => rencanaKosong(bulanIni(), bulanIni()));
  const [muat, setMuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [belumSimpan, setBelumSimpan] = useState(false);

  const ambil = useCallback(async () => {
    setMuat(true); setGalat("");
    try {
      const d = await muatRencana();
      setDaftar(d);
      if (d[0]) { setIdAktif(d[0].id); setIsi(d[0].isi); }
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);
  useEffect(() => { void ambil(); }, [ambil]);

  const beritahu = (t: string) => { setPesan(t); window.setTimeout(() => setPesan(""), 3500); };
  const ubah = (patch: Partial<RencanaBelanja>) => { setIsi((x) => ({ ...x, ...patch })); setBelumSimpan(true); };

  const simpan = async () => {
    setSibuk(true); setGalat("");
    try {
      const id = await simpanRencana(idAktif, isi);
      setIdAktif(id); setBelumSimpan(false);
      setDaftar((l) => (l.some((x) => x.id === id) ? l.map((x) => (x.id === id ? { id, isi } : x)) : [{ id, isi }, ...l]));
      beritahu("Rencana tersimpan.");
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setSibuk(false); }
  };

  const buatBaru = () => {
    setIdAktif(null);
    setIsi(rencanaKosong(bulanIni(), bulanIni()));
    setBelumSimpan(false);
  };

  const buang = async () => {
    if (!idAktif || !confirm("Hapus rencana ini?")) return;
    await hapusRencana(idAktif);
    setDaftar((l) => l.filter((x) => x.id !== idAktif));
    buatBaru();
    beritahu("Rencana dihapus.");
  };

  /* ── pagu & pemakaian untuk rentang yang dipilih ─────────────────────── */
  const hitung = useMemo(() => {
    const bulan = bulanRentang(isi.dari, isi.sampai);

    const pagu: Record<string, number> = {};
    bulan.forEach((b) => {
      const p = plafon.find((x) => x.bulan === b);
      (p?.rows || []).forEach((r) => { pagu[maKey(r.ma)] = (pagu[maKey(r.ma)] || 0) + paguTotal(r); });
    });

    const pakai: Record<string, number> = {};
    bulan.forEach((b) => {
      const real = realisasiRutin(pengadaan, b);
      Object.entries(real.perKey).forEach(([k, v]) => { pakai[k] = (pakai[k] || 0) + v; });
    });

    const rencana: Record<string, number> = {};
    isi.baris.forEach((r) => { if (r.ma) rencana[maKey(r.ma)] = (rencana[maKey(r.ma)] || 0) + (r.nilai || 0); });

    const kunci = Array.from(new Set([...Object.keys(pagu), ...Object.keys(pakai), ...Object.keys(rencana)]));
    const pos = kunci.map((k) => {
      const p = pagu[k] || 0, t = pakai[k] || 0, r = rencana[k] || 0;
      return { ma: k, label: labelMA(k), pagu: p, pakai: t, rencana: r, sisa: p - t - r };
    }).sort((a, b) => (b.pagu + b.rencana) - (a.pagu + a.rencana));

    const jml = (f: (x: typeof pos[number]) => number) => pos.reduce((s, x) => s + f(x), 0);
    return {
      bulan, pos,
      pagu: jml((x) => x.pagu), pakai: jml((x) => x.pakai),
      rencana: jml((x) => x.rencana), sisa: jml((x) => x.sisa),
      lewat: pos.filter((x) => x.pagu > 0 && x.sisa < 0),
      tanpaPagu: pos.filter((x) => x.pagu === 0 && x.rencana > 0),
    };
  }, [isi, plafon, pengadaan]);

  /* ── baris rencana ───────────────────────────────────────────────────── */
  const setBaris = (id: string, patch: Partial<BarisRencana>) =>
    ubah({ baris: isi.baris.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const tambahBaris = (ma = "") => ubah({ baris: [...isi.baris, barisBaru(ma)] });
  const hapusBaris = (id: string) => ubah({ baris: isi.baris.filter((b) => b.id !== id) });

  const kelas = "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900";

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow flex flex-wrap items-center gap-4 rounded-3xl px-6 py-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl asdp-gradient text-2xl text-white shadow-md">🧮</div>
          <div className="min-w-0 flex-1">
            <h1 className="asdp-text-gradient text-2xl font-extrabold tracking-tight">Rencana Belanja</h1>
            <p className="text-sm text-slate-500">Susun rencana pemakaian pagu rutin sebelum SPPBJ dibuat — cukup nama dan taksiran nilainya.</p>
          </div>
          <Link href="/sppbj" className="btn btn-ghost text-xs">← Riwayat Pengadaan</Link>
          <button onClick={buatBaru} className="btn btn-ghost text-xs">＋ Rencana baru</button>
          <button onClick={simpan} disabled={sibuk} className="btn btn-primary text-xs disabled:opacity-50">
            {sibuk ? "Menyimpan…" : "💾 Simpan"}
          </button>
        </div>
      </header>

      {pesan && <div className="anim-in mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">✓ {pesan}</div>}
      {galat && <div className="anim-in mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{galat}</div>}
      {belumSimpan && <div className="anim-in mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">Ada perubahan yang belum disimpan.</div>}

      {/* ── periode & rencana tersimpan ───────────────────────────────── */}
      <section className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900/80 dark:ring-slate-700">
        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-600">Bulan awal</label>
          <input type="month" value={isi.dari} onChange={(e) => ubah({ dari: e.target.value })} className={kelas} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-600">Bulan akhir</label>
          <input type="month" value={isi.sampai} onChange={(e) => ubah({ sampai: e.target.value })} className={kelas} />
        </div>
        <p className="mb-1.5 text-[11px] text-slate-500">
          {hitung.bulan.length} bulan · {hitung.bulan.map((b) => bulanTahun(`${b}-01`)).join(", ")}
        </p>
        {daftar.length > 0 && (
          <div className="ml-auto flex items-end gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">Rencana tersimpan</label>
              <select value={idAktif || ""} onChange={(e) => {
                const d = daftar.find((x) => x.id === e.target.value);
                if (d) { setIdAktif(d.id); setIsi(d.isi); setBelumSimpan(false); }
              }} className={kelas}>
                <option value="">— rencana baru —</option>
                {daftar.map((d) => (
                  <option key={d.id} value={d.id}>
                    {bulanTahun(`${d.isi.dari}-01`)}{d.isi.sampai !== d.isi.dari ? ` – ${bulanTahun(`${d.isi.sampai}-01`)}` : ""} · {d.isi.baris.length} rencana
                  </option>
                ))}
              </select>
            </div>
            {idAktif && <button onClick={buang} className="btn btn-danger-soft text-xs">🗑</button>}
          </div>
        )}
      </section>

      {/* ── angka besar ───────────────────────────────────────────────── */}
      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kartu label="Pagu rutin" nilai={hitung.pagu} warna="text-slate-800" />
        <Kartu label="Sudah terpakai" nilai={hitung.pakai} warna="text-sky-700" sub="SPPBJ & Non PR PO yang sudah ada" />
        <Kartu label="Rencana" nilai={hitung.rencana} warna="text-indigo-700" sub={`${isi.baris.length} rencana pengadaan`} />
        <Kartu label="Sisa setelah rencana" nilai={hitung.sisa} warna={hitung.sisa < 0 ? "text-rose-700" : "text-emerald-700"}
          sub={hitung.sisa < 0 ? "rencana melewati pagu" : "masih tersedia"} />
      </section>

      {(hitung.lewat.length > 0 || hitung.tanpaPagu.length > 0) && (
        <div className="mt-3 space-y-2">
          {hitung.lewat.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <b>{hitung.lewat.length} mata anggaran melewati pagunya</b> setelah rencana ini dihitung:{" "}
              {hitung.lewat.map((x) => `${x.label} (${rupiah(Math.abs(x.sisa))} lebih)`).join(" · ")}
            </div>
          )}
          {hitung.tanpaPagu.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <b>{hitung.tanpaPagu.length} mata anggaran direncanakan tanpa pagu</b> pada bulan ini:{" "}
              {hitung.tanpaPagu.map((x) => x.label).join(" · ")}. Periksa pagunya di Dashboard Anggaran.
            </div>
          )}
        </div>
      )}

      {/* ── perbandingan per mata anggaran ────────────────────────────── */}
      <section className="mt-5">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Pagu vs rencana per Mata Anggaran</h2>
        <div className="mt-2 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2.5 text-left font-extrabold">Mata Anggaran</th>
                <th className="px-3 py-2.5 text-right font-extrabold">Pagu</th>
                <th className="px-3 py-2.5 text-right font-extrabold">Terpakai</th>
                <th className="px-3 py-2.5 text-right font-extrabold">Rencana</th>
                <th className="px-3 py-2.5 text-right font-extrabold">Sisa</th>
                <th className="w-40 px-3 py-2.5 text-left font-extrabold">Terserap + rencana</th>
              </tr>
            </thead>
            <tbody>
              {hitung.pos.map((x) => {
                const persen = x.pagu > 0 ? Math.round(((x.pakai + x.rencana) / x.pagu) * 100) : 0;
                const lewat = x.pagu > 0 && x.sisa < 0;
                return (
                  <tr key={x.ma} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2">
                      <span className="block text-[13px] font-semibold text-slate-800 dark:text-slate-100">{x.label}</span>
                      <span className="text-[10px] tabular-nums text-slate-400">{x.ma}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{x.pagu ? rupiah(x.pagu) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{x.pakai ? rupiah(x.pakai) : "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-indigo-700">{x.rencana ? rupiah(x.rencana) : "—"}</td>
                    <td className={`px-3 py-2 text-right font-bold tabular-nums ${lewat ? "text-rose-700" : "text-emerald-700"}`}>
                      {x.pagu ? rupiah(x.sisa) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                          <div className={`h-full ${lewat ? "bg-rose-500" : persen >= 95 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(100, persen)}%` }} />
                        </div>
                        <span className={`w-10 text-right text-[11px] font-bold tabular-nums ${lewat ? "text-rose-700" : "text-slate-600"}`}>
                          {x.pagu ? `${persen}%` : "—"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!hitung.pos.length && (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-400">
                  {loading ? "Memuat pagu…" : "Belum ada pagu maupun rencana pada bulan ini."}
                </td></tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 text-[12px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                <td className="px-3 py-2.5">Jumlah</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{rupiah(hitung.pagu)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{rupiah(hitung.pakai)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{rupiah(hitung.rencana)}</td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${hitung.sisa < 0 ? "text-rose-700" : "text-emerald-700"}`}>{rupiah(hitung.sisa)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ── daftar rencana ────────────────────────────────────────────── */}
      <section className="mt-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Daftar rencana pengadaan</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400">tambah cepat:</span>
            {MATA_ANGGARAN.slice(0, 6).map((m) => (
              <button key={m.kode} onClick={() => tambahBaris(m.kode)}
                className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-sky-100 hover:text-sky-800">
                ＋ {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="w-8 px-3 py-2.5 text-left font-extrabold">#</th>
                <th className="w-56 px-3 py-2.5 text-left font-extrabold">Mata Anggaran</th>
                <th className="px-3 py-2.5 text-left font-extrabold">Nama pengadaan</th>
                <th className="w-36 px-3 py-2.5 text-right font-extrabold">Estimasi nilai</th>
                <th className="w-44 px-3 py-2.5 text-left font-extrabold">Catatan</th>
                <th className="w-8 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {isi.baris.map((b, i) => (
                <tr key={b.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-1.5 text-xs text-slate-400 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-1.5">
                    <select value={b.ma} onChange={(e) => setBaris(b.id, { ma: e.target.value })} className={kelas}>
                      <option value="">— pilih —</option>
                      {MATA_ANGGARAN.map((m) => <option key={m.kode} value={m.kode}>{m.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={b.nama} onChange={(e) => setBaris(b.id, { nama: e.target.value })}
                      placeholder="mis. Pengadaan Alat Keselamatan KMP. Tuna" className={kelas} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={b.nilai ? b.nilai.toLocaleString("id-ID") : ""} inputMode="numeric" placeholder="0"
                      onChange={(e) => setBaris(b.id, { nilai: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })}
                      className={`${kelas} text-right tabular-nums`} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={b.catatan || ""} onChange={(e) => setBaris(b.id, { catatan: e.target.value })}
                      placeholder="opsional" className={kelas} />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <button onClick={() => hapusBaris(b.id)} className="rounded-lg px-2 py-1 text-sm text-rose-600 hover:bg-rose-50">✕</button>
                  </td>
                </tr>
              ))}
              {!isi.baris.length && (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-400">
                  Belum ada rencana. Tekan salah satu tombol “tambah cepat” di atas, atau tombol di bawah.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button onClick={() => tambahBaris()} className="btn btn-ghost text-xs">＋ Tambah baris</button>
          <button onClick={simpan} disabled={sibuk} className="btn btn-primary text-xs disabled:opacity-50">
            {sibuk ? "Menyimpan…" : "💾 Simpan rencana"}
          </button>
          <span className="text-[11px] text-slate-400">
            Rencana ini tidak menggerus pagu — yang menggerus tetap SPPBJ dan Non PR PO yang benar-benar terbit.
          </span>
        </div>
      </section>
    </main>
  );
}

function Kartu({ label, nilai, warna, sub }: { label: string; nilai: number; warna: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`text-xl font-extrabold tabular-nums ${warna}`}>{rupiah(nilai)}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}
