"use client";
/**
 * Permintaan & Laporan Kapal — sisi kantor.
 *
 * Menampilkan kiriman ABK dari halaman terbuka /lapor: siapa mengirim apa,
 * kapal mana, periode berapa, dan berkasnya (tersimpan di Google Drive, dibuka
 * lewat tautan). Ada matriks kelengkapan per kapal supaya kelihatan kapal mana
 * yang belum menyetor laporan bulan berjalan — itu yang dipakai untuk menimbang
 * kebutuhan kapal.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import {
  JENIS_LAPOR, KirimanLapor, STATUS_LAPOR, bulanIndo, labelJenis, singkatJenis,
  tautanWa, ukuranSingkat,
} from "@/lib/lapor/types";

const kelasStatus = (s: string) => STATUS_LAPOR.find((x) => x.id === s)?.kelas || "bg-slate-100 text-slate-700 ring-slate-200";
const labelStatus = (s: string) => STATUS_LAPOR.find((x) => x.id === s)?.label || s;
const waktuSingkat = (iso: string) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export default function PermintaanLaporanKapal() {
  const [baris, setBaris] = useState<KirimanLapor[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [kapal, setKapal] = useState("");
  const [jenis, setJenis] = useState("");
  const [status, setStatus] = useState("");
  const [periode, setPeriode] = useState("");
  const [cari, setCari] = useState("");
  const [buka, setBuka] = useState<KirimanLapor | null>(null);
  const [salin, setSalin] = useState("");

  const ambil = async () => {
    setMuat(true); setGalat("");
    try {
      const r = await fetch("/api/lapor/daftar", { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) setGalat(d.error || "Gagal memuat"); else setBaris(d.baris);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  };
  useEffect(() => { ambil(); }, []);

  const periodeAda = useMemo(
    () => Array.from(new Set(baris.map((b) => b.periode).filter(Boolean))).sort().reverse(),
    [baris]);

  const tampil = useMemo(() => baris.filter((b) => {
    if (kapal && b.kapal !== kapal) return false;
    if (jenis && b.jenis !== jenis) return false;
    if (status && b.status !== status) return false;
    if (periode && b.periode !== periode) return false;
    if (!cari) return true;
    const t = [b.kapal, b.pengirim, b.jabatan, b.catatan, labelJenis(b.jenis), ...b.berkas.map((x) => x.nama)].join(" ").toLowerCase();
    return cari.toLowerCase().split(/\s+/).filter(Boolean).every((k) => t.includes(k));
  }), [baris, kapal, jenis, status, periode, cari]);

  // matriks kelengkapan: kapal × jenis untuk satu periode
  const periodeMatriks = periode || periodeAda[0] || new Date().toISOString().slice(0, 7);
  const matriks = useMemo(() => {
    const peta = new Map<string, KirimanLapor[]>();
    baris.filter((b) => b.periode === periodeMatriks).forEach((b) => {
      const k = `${b.kapal}|${b.jenis}`;
      peta.set(k, [...(peta.get(k) || []), b]);
    });
    return peta;
  }, [baris, periodeMatriks]);

  const ubah = async (id: string, patch: Partial<KirimanLapor>) => {
    const r = await fetch("/api/lapor/daftar", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const d = await r.json();
    if (!d.ok) { setGalat(d.error || "Gagal menyimpan"); return; }
    setBaris((l) => l.map((x) => (x.id === id ? d.baris : x)));
    setBuka((x) => (x && x.id === id ? d.baris : x));
  };

  const hapus = async (b: KirimanLapor) => {
    if (!confirm(`Hapus catatan kiriman ${singkatJenis(b.jenis)} ${b.kapal} (${bulanIndo(b.periode)})?\n\nBerkas di Google Drive TIDAK ikut terhapus.`)) return;
    const r = await fetch(`/api/lapor/daftar?id=${b.id}`, { method: "DELETE" });
    const d = await r.json();
    if (!d.ok) { setGalat(d.error || "Gagal menghapus"); return; }
    setBaris((l) => l.filter((x) => x.id !== b.id));
    setBuka(null);
  };

  const tautanLapor = typeof window !== "undefined" ? `${window.location.origin}/lapor` : "/lapor";
  const salinTautan = async () => {
    try { await navigator.clipboard.writeText(tautanLapor); setSalin("Tautan disalin"); }
    catch { setSalin(tautanLapor); }
    setTimeout(() => setSalin(""), 4000);
  };

  const belum = KAPAL_ANGGARAN.filter((k) => !JENIS_LAPOR.some((j) => matriks.get(`${k}|${j.id}`)?.length));

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold asdp-text-gradient leading-tight">Permintaan &amp; Laporan Kapal</h1>
          <p className="text-sm text-slate-500">
            Kiriman ABK dari halaman terbuka · berkas tersimpan di Google Drive kantor
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={salinTautan} className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold px-4 py-2.5">
            🔗 Salin tautan untuk ABK
          </button>
          <Link href="/lapor" target="_blank" className="rounded-xl bg-white ring-1 ring-slate-300 hover:bg-slate-50 text-sm font-bold px-4 py-2.5">
            👁 Lihat halaman kirim
          </Link>
          <button onClick={ambil} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2.5">
            ⟳ Muat ulang
          </button>
        </div>
      </header>
      {salin && <div className="mb-4 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800 text-sm px-3 py-2">{salin}</div>}
      {galat && <div className="mb-4 rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-800 text-sm px-3 py-2">{galat}</div>}

      {/* ── matriks kelengkapan ───────────────────────────────────────────── */}
      <section className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-extrabold text-slate-800">Kelengkapan {bulanIndo(periodeMatriks)}</h2>
          <span className="text-xs text-slate-500">
            {KAPAL_ANGGARAN.length - belum.length} dari {KAPAL_ANGGARAN.length} kapal sudah mengirim
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Kapal</th>
                {JENIS_LAPOR.map((j) => <th key={j.id} className="py-2 px-2 text-center whitespace-nowrap">{j.ikon} {j.singkat}</th>)}
              </tr>
            </thead>
            <tbody>
              {KAPAL_ANGGARAN.map((k) => (
                <tr key={k} className="border-t border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-800 whitespace-nowrap">{k}</td>
                  {JENIS_LAPOR.map((j) => {
                    const isi = matriks.get(`${k}|${j.id}`) || [];
                    return (
                      <td key={j.id} className="py-2 px-2 text-center">
                        {isi.length ? (
                          <button onClick={() => setBuka(isi[0])}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 text-xs font-bold hover:bg-emerald-200">
                            ✓ {isi.length > 1 ? `${isi.length}×` : "ada"}
                          </button>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── saringan ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-3 mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama, catatan, berkas…"
          className="rounded-xl ring-1 ring-slate-300 px-3 py-2 text-sm lg:col-span-2" />
        <select value={kapal} onChange={(e) => setKapal(e.target.value)} className="rounded-xl ring-1 ring-slate-300 px-3 py-2 text-sm bg-white">
          <option value="">Semua kapal</option>
          {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="rounded-xl ring-1 ring-slate-300 px-3 py-2 text-sm bg-white">
          <option value="">Semua jenis</option>
          {JENIS_LAPOR.map((j) => <option key={j.id} value={j.id}>{j.singkat}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select value={periode} onChange={(e) => setPeriode(e.target.value)} className="rounded-xl ring-1 ring-slate-300 px-2 py-2 text-sm bg-white">
            <option value="">Semua bulan</option>
            {periodeAda.map((p) => <option key={p} value={p}>{bulanIndo(p)}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl ring-1 ring-slate-300 px-2 py-2 text-sm bg-white">
            <option value="">Semua status</option>
            {STATUS_LAPOR.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── daftar kiriman ────────────────────────────────────────────────── */}
      {muat ? (
        <p className="text-slate-500 py-10 text-center">Memuat…</p>
      ) : !tampil.length ? (
        <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-10 text-center text-slate-500">
          Belum ada kiriman{baris.length ? " yang cocok dengan saringan" : ""}.
          {!baris.length && <> Bagikan tautan <b>{tautanLapor}</b> ke ABK kapal.</>}
        </div>
      ) : (
        <div className="space-y-2">
          {tampil.map((b) => (
            <div key={b.id} className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-[220px] flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-slate-900">{b.kapal}</span>
                  <span className="text-xs rounded-lg bg-slate-100 text-slate-700 ring-1 ring-slate-200 px-2 py-0.5 font-semibold">
                    {singkatJenis(b.jenis)}
                  </span>
                  <span className={`text-xs rounded-lg ring-1 px-2 py-0.5 font-semibold ${kelasStatus(b.status)}`}>{labelStatus(b.status)}</span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">
                  {bulanIndo(b.periode)} · {b.pengirim}{b.jabatan ? ` (${b.jabatan})` : ""} · {waktuSingkat(b.dikirimPada)}
                </p>
                {b.catatan && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{b.catatan}</p>}
              </div>
              <div className="text-sm text-slate-600 whitespace-nowrap">📎 {b.berkas.length} berkas</div>
              <button onClick={() => setBuka(b)} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2">
                Buka
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── panel detail ──────────────────────────────────────────────────── */}
      {buka && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setBuka(null)}>
          <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">{labelJenis(buka.jenis)}</h3>
                <p className="text-sm text-slate-600">{buka.kapal} · {bulanIndo(buka.periode)}</p>
              </div>
              <button onClick={() => setBuka(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">Pengirim</span><div className="font-semibold">{buka.pengirim || "—"}{buka.jabatan ? ` · ${buka.jabatan}` : ""}</div></div>
                <div><span className="text-slate-500">Dikirim</span><div className="font-semibold">{waktuSingkat(buka.dikirimPada)}</div></div>
                <div>
                  <span className="text-slate-500">Kontak</span>
                  <div className="font-semibold">
                    {buka.kontak ? (
                      <a className="text-green-700 hover:underline" target="_blank" rel="noopener noreferrer"
                         href={`https://wa.me/${buka.kontak.replace(/\D/g, "").replace(/^0/, "62")}`}>{buka.kontak} 💬</a>
                    ) : "—"}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Status</span>
                  <select value={buka.status} onChange={(e) => ubah(buka.id, { status: e.target.value as any })}
                    className="mt-0.5 w-full rounded-lg ring-1 ring-slate-300 px-2 py-1.5 text-sm bg-white">
                    {STATUS_LAPOR.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {buka.catatan && (
                <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3 text-sm">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Catatan pengirim</div>
                  <p className="whitespace-pre-wrap">{buka.catatan}</p>
                </div>
              )}

              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Berkas di Google Drive</div>
                {!buka.berkas.length ? <p className="text-sm text-slate-500">Tidak ada berkas.</p> : (
                  <ul className="space-y-1.5">
                    {buka.berkas.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 bg-slate-50 ring-1 ring-slate-200 rounded-lg px-3 py-2 text-sm">
                        <span className="truncate flex-1">{f.nama}</span>
                        <span className="text-xs text-slate-500 shrink-0">{ukuranSingkat(f.ukuran)}</span>
                        <a href={f.url} target="_blank" rel="noopener noreferrer"
                           className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5">Buka</a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tindak lanjut (internal)</label>
                <textarea defaultValue={buka.tindakLanjut} rows={3}
                  onBlur={(e) => e.target.value !== buka.tindakLanjut && ubah(buka.id, { tindakLanjut: e.target.value })}
                  placeholder="Mis. sudah dibuatkan SPPBJ / menunggu anggaran / ditolak karena …"
                  className="mt-1 w-full rounded-xl ring-1 ring-slate-300 px-3 py-2 text-sm" />
                <p className="text-xs text-slate-400 mt-1">Tersimpan otomatis saat kotak ini ditinggalkan.</p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <a href={tautanWa(`Halo ${buka.pengirim}, ${labelJenis(buka.jenis)} ${buka.kapal} periode ${bulanIndo(buka.periode)} sudah kami terima.`)}
                   target="_blank" rel="noopener noreferrer"
                   className="rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2.5">💬 Balas lewat WA</a>
                <button onClick={() => hapus(buka)}
                  className="rounded-xl bg-white ring-1 ring-rose-300 text-rose-700 hover:bg-rose-50 text-sm font-bold px-4 py-2.5">
                  Hapus catatan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
