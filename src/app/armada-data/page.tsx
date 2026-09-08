"use client";
/**
 * Data Isian Kapal — sisi KANTOR dari Portal Kapal.
 *
 * Yang dikerjakan halaman ini satu hal: menjawab "kapal mana yang perlu
 * disiapkan barangnya" sebelum kapal itu memintanya. Stok filter yang menipis
 * dan obat yang mendekati kedaluwarsa dua-duanya berakhir sebagai pengadaan;
 * bedanya, kalau terbaca dari sini, ia dibelanjakan pada waktu biasa — bukan
 * sebagai permintaan mendesak yang tibanya selalu terlambat.
 *
 * Kapal yang BELUM PERNAH mengisi ditampilkan menyala. Daftar yang hanya memuat
 * kapal rajin akan membuat kapal yang diam menghilang dari layar, dan diam
 * justru keadaan yang paling perlu ditindaklanjuti.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Ikon } from "@/components/ikon";
import { NADA_ALKES, sisaHariAlkes, tingkatAlkes } from "@/lib/portal/types";

interface DataKapal {
  kapal: string;
  stok: {
    adaIsi: boolean; diperbaruiPada: string; olehAkun: string;
    jenis: number; totalLembar: number; menipis: number; gantiDekat: number;
    filter: any[]; mesin: any[];
  };
  alkes: {
    adaIsi: boolean; diperbaruiPada: string; olehAkun: string;
    butir: number; lewat: number; kritis: number; waspada: number; menipis: number;
    item: any[];
  };
}

const waktu = (iso: string) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "belum pernah";

const pendek = (k: string) => k.replace(/^KMP\.?\s*/i, "");

export default function DataIsianKapal() {
  const [armada, setArmada] = useState<DataKapal[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [rupa, setRupa] = useState<"stok" | "alkes">("stok");
  /** kapan jawaban terakhir sampai — supaya halaman basi bisa dikenali */
  const [dimuatPada, setDimuatPada] = useState<Date | null>(null);
  const [buka, setBuka] = useState("");

  const ambil = useCallback(async () => {
    setMuat(true); setGalat("");
    try {
      const r = await fetch("/api/armada-data", { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal memuat data");
      setArmada(d.armada || []);
      setDimuatPada(new Date());
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);

  useEffect(() => { void ambil(); }, [ambil]);

  /*
   * Halaman ini menyegarkan dirinya sendiri.
   *
   * Kapal mengisi portalnya kapan saja — sering justru di luar jam kantor —
   * sementara layar ini dibuka lalu ditinggal berjam-jam. Tanpa penyegaran,
   * yang terbaca adalah keadaan saat halaman dibuka: tiga belas kapal "belum
   * pernah diisi" padahal salah satunya baru saja mengirim. Daftar yang salah
   * karena basi lebih berbahaya daripada daftar yang kosong, sebab ia dipercaya.
   */
  useEffect(() => {
    const t = window.setInterval(() => { void ambil(); }, 60_000);
    // kembali ke tab ini = saat paling mungkin ada yang berubah selagi ditinggal
    const lihat = () => { if (document.visibilityState === "visible") void ambil(); };
    document.addEventListener("visibilitychange", lihat);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", lihat); };
  }, [ambil]);

  const jumlah = useMemo(() => ({
    stokKosong: armada.filter((a) => !a.stok.adaIsi).length,
    menipis: armada.reduce((n, a) => n + a.stok.menipis, 0),
    gantiDekat: armada.reduce((n, a) => n + a.stok.gantiDekat, 0),
    alkesKosong: armada.filter((a) => !a.alkes.adaIsi).length,
    lewat: armada.reduce((n, a) => n + a.alkes.lewat, 0),
    kritis: armada.reduce((n, a) => n + a.alkes.kritis, 0),
  }), [armada]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#16357f] text-white">
            <Ikon nama="kapal" className="h-5 w-5" />
          </span>
          <div className="min-w-[16rem] flex-1">
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Data Isian Kapal</h1>
            <p className="text-[11.5px] text-slate-500">
              Stok filter dan alat kesehatan yang diisi sendiri oleh awak lewat Portal Kapal.
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className={`h-1.5 w-1.5 rounded-full ${muat ? "animate-pulse bg-sky-500" : "bg-emerald-500"}`} />
              {muat ? "Menyegarkan…" : dimuatPada
                ? `Data per ${dimuatPada.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · menyegarkan sendiri tiap menit`
                : "Menunggu data"}
            </p>
          </div>
          <div className="flex overflow-hidden rounded-xl ring-1 ring-slate-300 dark:ring-slate-700">
            {([["stok", "Stok Filter"], ["alkes", "Alat Kesehatan"]] as const).map(([id, l]) => (
              <button key={id} onClick={() => { setRupa(id); setBuka(""); }}
                className={`px-3 py-2 text-[11.5px] font-bold transition ${
                  rupa === id ? "bg-[#16357f] text-white" : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300"}`}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={ambil} disabled={muat}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#16357f] px-3 py-2 text-[11.5px] font-bold text-white disabled:opacity-50">
            <Ikon nama="segarkan" className={`h-3.5 w-3.5 ${muat ? "animate-spin" : ""}`} /> Muat ulang
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {(rupa === "stok"
            ? [
              ["Kapal belum mengisi", jumlah.stokKosong, "text-rose-700"],
              ["Filter menipis", jumlah.menipis, "text-amber-700"],
              ["Ganti filter ≤ 50 jam", jumlah.gantiDekat, "text-orange-700"],
              ["Kapal sudah mengisi", armada.length - jumlah.stokKosong, "text-emerald-700"],
            ]
            : [
              ["Kapal belum mengisi", jumlah.alkesKosong, "text-rose-700"],
              ["Alkes kedaluwarsa", jumlah.lewat, "text-rose-700"],
              ["Habis ≤ 30 hari", jumlah.kritis, "text-orange-700"],
              ["Kapal sudah mengisi", armada.length - jumlah.alkesKosong, "text-emerald-700"],
            ]).map(([l, n, w]) => (
            <div key={String(l)} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700">
              <p className={`text-2xl font-black tabular-nums ${Number(n) ? String(w) : "text-slate-300"}`}>{String(n)}</p>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">{String(l)}</p>
            </div>
          ))}
        </div>
      </header>

      {galat && (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-800 ring-1 ring-rose-200">{galat}</p>
      )}

      <ul className="space-y-2.5">
        {armada.map((a) => {
          const d = rupa === "stok" ? a.stok : a.alkes;
          const perhatian = rupa === "stok"
            ? a.stok.menipis + a.stok.gantiDekat
            : a.alkes.lewat + a.alkes.kritis;
          const terbuka = buka === a.kapal;

          return (
            <li key={a.kapal} className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 dark:bg-slate-900 ${
              !d.adaIsi ? "ring-rose-300 dark:ring-rose-900" : perhatian ? "ring-amber-300 dark:ring-amber-900" : "ring-slate-200 dark:ring-slate-800"}`}>
              <button onClick={() => setBuka(terbuka ? "" : a.kapal)}
                className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <span className="min-w-[10rem] text-[15px] font-black tracking-tight text-slate-900 dark:text-white">
                  {pendek(a.kapal)}
                </span>

                {!d.adaIsi ? (
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-black text-rose-800 ring-1 ring-rose-300">
                    BELUM PERNAH DIISI
                  </span>
                ) : rupa === "stok" ? (
                  <span className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{a.stok.jenis} jenis filter</span>
                    <span className="text-slate-500">{a.stok.totalLembar} lembar</span>
                    {!!a.stok.menipis && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-800">{a.stok.menipis} menipis</span>}
                    {!!a.stok.gantiDekat && <span className="rounded bg-orange-100 px-1.5 py-0.5 font-bold text-orange-800">{a.stok.gantiDekat} mesin segera ganti</span>}
                  </span>
                ) : (
                  <span className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{a.alkes.butir} butir</span>
                    {!!a.alkes.lewat && <span className="rounded bg-rose-100 px-1.5 py-0.5 font-bold text-rose-800">{a.alkes.lewat} kedaluwarsa</span>}
                    {!!a.alkes.kritis && <span className="rounded bg-orange-100 px-1.5 py-0.5 font-bold text-orange-800">{a.alkes.kritis} ≤30 hari</span>}
                    {!!a.alkes.waspada && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-800">{a.alkes.waspada} ≤90 hari</span>}
                    {!!a.alkes.menipis && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-700">{a.alkes.menipis} menipis</span>}
                  </span>
                )}

                <span className="ml-auto text-right text-[11px] text-slate-500">
                  {d.adaIsi ? <>diisi {waktu(d.diperbaruiPada)}<br /><span className="text-slate-400">oleh {d.olehAkun || "—"}</span></> : "menunggu kapal"}
                </span>
                <span className="text-slate-400">{terbuka ? "▾" : "▸"}</span>
              </button>

              {terbuka && d.adaIsi && (
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                  {rupa === "stok" ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <h3 className="mb-1.5 text-[12px] font-black uppercase tracking-wide text-slate-600">Stok filter</h3>
                        <table className="w-full text-[12px]">
                          <thead className="text-[10.5px] uppercase text-slate-500">
                            <tr><th className="py-1 text-left">Mesin</th><th className="text-left">Jenis</th><th className="text-left">Part number</th><th className="text-right">Jml</th><th className="text-right">Min</th></tr>
                          </thead>
                          <tbody>
                            {a.stok.filter.map((f: any) => {
                              const kurang = Number(f.minimum) > 0 && Number(f.jumlah) <= Number(f.minimum);
                              return (
                                <tr key={f.id} className={`border-t border-slate-200 dark:border-slate-700 ${kurang ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}>
                                  <td className="py-1 font-semibold text-slate-700 dark:text-slate-200">{f.mesin}</td>
                                  <td className="text-slate-600 dark:text-slate-300">{f.jenis}</td>
                                  <td className="font-mono text-[11px] text-slate-600 dark:text-slate-300">{f.partNumber || "—"}</td>
                                  <td className={`text-right font-bold tabular-nums ${kurang ? "text-amber-800" : "text-slate-800 dark:text-slate-100"}`}>{f.jumlah} {f.satuan}</td>
                                  <td className="text-right tabular-nums text-slate-500">{f.minimum || "—"}</td>
                                </tr>
                              );
                            })}
                            {!a.stok.filter.length && <tr><td colSpan={5} className="py-3 text-center text-slate-500">Belum ada baris filter.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                      <div>
                        <h3 className="mb-1.5 text-[12px] font-black uppercase tracking-wide text-slate-600">Jam kerja mesin</h3>
                        <table className="w-full text-[12px]">
                          <thead className="text-[10.5px] uppercase text-slate-500">
                            <tr><th className="py-1 text-left">Mesin</th><th className="text-left">Merek / tipe</th><th className="text-right">Jam kini</th><th className="text-right">Sejak ganti</th><th className="text-right">Sisa</th></tr>
                          </thead>
                          <tbody>
                            {a.stok.mesin.map((m: any) => {
                              const jalan = Math.max(0, (Number(m.jam) || 0) - (Number(m.jamGantiTerakhir) || 0));
                              const sisa = Number(m.intervalJam) ? Number(m.intervalJam) - jalan : null;
                              const dekat = sisa !== null && sisa <= 50;
                              return (
                                <tr key={m.id} className={`border-t border-slate-200 dark:border-slate-700 ${dekat ? "bg-orange-50 dark:bg-orange-950/30" : ""}`}>
                                  <td className="py-1 font-semibold text-slate-700 dark:text-slate-200">{m.mesin}</td>
                                  <td className="text-slate-600 dark:text-slate-300">
                                    {[m.merek, m.tipe].filter(Boolean).join(" ") || <span className="text-slate-400">belum diisi</span>}
                                    {m.nomorSeri ? <span className="block text-[10.5px] text-slate-400">SN {m.nomorSeri}</span> : null}
                                  </td>
                                  <td className="text-right tabular-nums text-slate-700 dark:text-slate-200">{m.jam}</td>
                                  <td className="text-right tabular-nums text-slate-500">{jalan}</td>
                                  <td className={`text-right font-bold tabular-nums ${dekat ? "text-orange-800" : "text-slate-700 dark:text-slate-200"}`}>
                                    {sisa === null ? "—" : `${sisa} jam`}
                                  </td>
                                </tr>
                              );
                            })}
                            {!a.stok.mesin.length && <tr><td colSpan={5} className="py-3 text-center text-slate-500">Belum ada data jam mesin.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <table className="w-full text-[12px]">
                      <thead className="text-[10.5px] uppercase text-slate-500">
                        <tr>
                          <th className="py-1 text-left">Nama</th><th className="text-left">Golongan</th><th className="text-left">Letak</th>
                          <th className="text-right">Jml</th><th className="text-left">Kedaluwarsa</th><th className="text-left">Keadaan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...a.alkes.item]
                          .sort((x: any, y: any) => (sisaHariAlkes(x.kedaluwarsa) ?? 9e9) - (sisaHariAlkes(y.kedaluwarsa) ?? 9e9))
                          .map((b: any) => {
                            const t = tingkatAlkes(b.kedaluwarsa);
                            const sisa = sisaHariAlkes(b.kedaluwarsa);
                            return (
                              <tr key={b.id} className={`border-t border-slate-200 dark:border-slate-700 ${
                                t === "lewat" ? "bg-rose-50 dark:bg-rose-950/30" : t === "kritis" ? "bg-orange-50 dark:bg-orange-950/30" : ""}`}>
                                <td className="py-1 font-semibold text-slate-800 dark:text-slate-100">{b.nama}</td>
                                <td className="text-slate-600 dark:text-slate-300">{b.golongan}</td>
                                <td className="text-slate-500">{b.lokasi}</td>
                                <td className="text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">{b.jumlah} {b.satuan}</td>
                                <td className="tabular-nums text-slate-600 dark:text-slate-300">{b.kedaluwarsa || "—"}</td>
                                <td>
                                  <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ${NADA_ALKES[t].kelas}`}>
                                    {NADA_ALKES[t].label}{sisa !== null && t !== "aman" && t !== "tanpa" ? ` · ${sisa < 0 ? `lewat ${Math.abs(sisa)} hr` : `${sisa} hr`}` : ""}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        {!a.alkes.item.length && <tr><td colSpan={6} className="py-3 text-center text-slate-500">Belum ada butir alkes.</td></tr>}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {muat && !armada.length && (
        <p className="rounded-2xl bg-white px-4 py-10 text-center text-[13px] text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900">Memuat…</p>
      )}
    </main>
  );
}
