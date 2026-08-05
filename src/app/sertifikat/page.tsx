"use client";
/**
 * Monitor Sertifikat Kapal.
 *
 * Pertanyaan yang dijawab layar ini cuma satu: sertifikat mana yang sebentar
 * lagi habis, di kapal mana. Maka yang muncul lebih dulu bukan seluruh tabel,
 * melainkan daftar yang perlu ditindaklanjuti — diurut dari yang paling
 * mendesak. Tabel lengkap per kapal ada di bawahnya.
 *
 * Sumbernya lembar Google cabang; layar ini membacanya, tidak mengubahnya.
 */
import { useEffect, useMemo, useState } from "react";
import {
  STATUS_SERT, Sertifikat, StatusSertifikat, URL_LEMBAR,
  bobotStatus, statusSert, tanggalSert, teksSisa,
} from "@/lib/sertifikat/types";

const AMBANG = 90;   // "perlu tindakan" = habis dalam 90 hari atau sudah lewat

export default function MonitorSertifikat() {
  const [baris, setBaris] = useState<Sertifikat[]>([]);
  const [kapalAda, setKapalAda] = useState<string[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [diambil, setDiambil] = useState("");

  const [kapal, setKapal] = useState("");
  const [status, setStatus] = useState("");
  const [cari, setCari] = useState("");
  const [semua, setSemua] = useState(false);

  const ambil = async (segar = false) => {
    setMuat(true); setGalat("");
    try {
      const r = await fetch(`/api/sertifikat${segar ? "?segar=1" : ""}`, { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) { setGalat(d.error || "Gagal memuat"); return; }
      setBaris(d.baris); setKapalAda(d.kapal);
      setDiambil(new Date(d.diambilPada).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  };
  useEffect(() => { ambil(); }, []);

  const berstatus = useMemo(
    () => baris.map((s) => ({ s, st: statusSert(s) })),
    [baris]);

  const hitung = useMemo(() => {
    const h = { lewat: 0, kritis: 0, waspada: 0, aman: 0, permanen: 0, kosong: 0 };
    berstatus.forEach(({ st }) => h[st]++);
    return h;
  }, [berstatus]);

  const tampil = useMemo(() => {
    const kata = cari.toLowerCase().split(/\s+/).filter(Boolean);
    return berstatus
      .filter(({ s, st }) => {
        if (kapal && s.kapal !== kapal) return false;
        if (status && st !== status) return false;
        if (!semua && !kapal && !status && !cari) {
          // tampilan awal: hanya yang mendesak
          return st === "lewat" || st === "kritis" || st === "waspada";
        }
        if (!kata.length) return true;
        const t = `${s.kapal} ${s.jenis} ${s.kelompok} ${s.berkasNama}`.toLowerCase();
        return kata.every((k) => t.includes(k));
      })
      .sort((a, b) =>
        bobotStatus[a.st] - bobotStatus[b.st]
        || (a.s.sisaHari ?? 99999) - (b.s.sisaHari ?? 99999)
        || a.s.kapal.localeCompare(b.s.kapal, "id"));
  }, [berstatus, kapal, status, cari, semua]);

  // ringkasan per kapal untuk melihat kapal mana yang paling bermasalah
  const perKapal = useMemo(() => {
    const peta = new Map<string, { lewat: number; kritis: number; waspada: number; total: number }>();
    berstatus.forEach(({ s, st }) => {
      const p = peta.get(s.kapal) || { lewat: 0, kritis: 0, waspada: 0, total: 0 };
      p.total++;
      if (st === "lewat") p.lewat++;
      else if (st === "kritis") p.kritis++;
      else if (st === "waspada") p.waspada++;
      peta.set(s.kapal, p);
    });
    return (kapalAda.length ? kapalAda : Array.from(peta.keys()))
      .map((k) => ({ kapal: k, ...(peta.get(k) || { lewat: 0, kritis: 0, waspada: 0, total: 0 }) }))
      .sort((a, b) => (b.lewat * 100 + b.kritis * 10 + b.waspada) - (a.lewat * 100 + a.kritis * 10 + a.waspada)
        || a.kapal.localeCompare(b.kapal, "id"));
  }, [berstatus, kapalAda]);

  const saringanAktif = !!(kapal || status || cari);
  const bersihkan = () => { setKapal(""); setStatus(""); setCari(""); setSemua(false); };

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold asdp-text-gradient leading-tight">Monitor Sertifikat Kapal</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Dibaca dari lembar MUSTER cabang · sisa hari dihitung ulang hari ini
            {diambil && <> · dimuat {diambil}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={URL_LEMBAR} target="_blank" rel="noopener noreferrer"
             className="rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-300 dark:ring-slate-600 hover:bg-slate-50 text-sm font-bold px-4 py-2.5">
            📄 Buka lembar sumber
          </a>
          <button onClick={() => ambil(true)} disabled={muat}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold px-4 py-2.5">
            {muat ? "Memuat…" : "⟳ Muat ulang"}
          </button>
        </div>
      </header>

      {galat && (
        <div className="mb-4 rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-800 text-sm px-3 py-2">
          {galat}
        </div>
      )}

      {/* ── angka utama ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {([
          ["lewat", hitung.lewat, "Kedaluwarsa"],
          ["kritis", hitung.kritis, "Habis ≤ 30 hari"],
          ["waspada", hitung.waspada, "Habis ≤ 90 hari"],
          ["aman", hitung.aman, "Masih aman"],
        ] as [StatusSertifikat, number, string][]).map(([st, n, judul]) => (
          <button key={st} onClick={() => { setStatus(status === st ? "" : st); setSemua(false); }}
            className={`text-left rounded-2xl p-4 ring-1 transition ${
              status === st ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-slate-800" : "bg-white dark:bg-slate-800 ring-slate-200 dark:ring-slate-700 hover:ring-slate-300"}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_SERT[st].titik}`} />
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{judul}</span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{n}</div>
          </button>
        ))}
      </div>

      {/* ── ringkasan per kapal ─────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-extrabold text-slate-800 dark:text-slate-100">Keadaan per kapal</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">klik kapal untuk melihat sertifikatnya</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {perKapal.map((k) => {
            const perlu = k.lewat + k.kritis;
            return (
              <button key={k.kapal} onClick={() => { setKapal(kapal === k.kapal ? "" : k.kapal); setStatus(""); }}
                className={`text-left rounded-xl px-3 py-2.5 ring-1 transition ${
                  kapal === k.kapal
                    ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-slate-700"
                    : perlu
                      ? "bg-rose-50 dark:bg-rose-950/30 ring-rose-200 dark:ring-rose-900 hover:ring-rose-300"
                      : "bg-slate-50 dark:bg-slate-700/40 ring-slate-200 dark:ring-slate-600 hover:ring-slate-300"}`}>
                <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{k.kapal}</div>
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 flex flex-wrap gap-x-2">
                  {k.lewat > 0 && <span className="text-rose-700 dark:text-rose-400 font-bold">{k.lewat} lewat</span>}
                  {k.kritis > 0 && <span className="text-orange-700 dark:text-orange-400 font-bold">{k.kritis} ≤30h</span>}
                  {k.waspada > 0 && <span className="text-amber-700 dark:text-amber-400">{k.waspada} ≤90h</span>}
                  {!k.lewat && !k.kritis && !k.waspada && <span className="text-emerald-700 dark:text-emerald-400">aman semua</span>}
                  <span className="text-slate-400">· {k.total} dok.</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── saringan ────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm p-3 mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari sertifikat, kapal, berkas…"
          className="rounded-xl ring-1 ring-slate-300 dark:ring-slate-600 dark:bg-slate-900 px-3 py-2 text-sm lg:col-span-2" />
        <select value={kapal} onChange={(e) => setKapal(e.target.value)}
          className="rounded-xl ring-1 ring-slate-300 dark:ring-slate-600 dark:bg-slate-900 px-3 py-2 text-sm">
          <option value="">Semua kapal</option>
          {kapalAda.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl ring-1 ring-slate-300 dark:ring-slate-600 dark:bg-slate-900 px-3 py-2 text-sm">
          <option value="">Semua status</option>
          {(["lewat", "kritis", "waspada", "aman", "permanen", "kosong"] as StatusSertifikat[]).map((s) =>
            <option key={s} value={s}>{STATUS_SERT[s].label}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="font-extrabold text-slate-800 dark:text-slate-100">
          {saringanAktif ? "Hasil saringan" : semua ? "Semua sertifikat" : `Perlu tindakan (habis ≤ ${AMBANG} hari)`}
          <span className="ml-2 text-sm font-semibold text-slate-500">{tampil.length} baris</span>
        </h2>
        <div className="flex gap-2">
          {saringanAktif && (
            <button onClick={bersihkan} className="text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline">
              Bersihkan saringan
            </button>
          )}
          {!saringanAktif && (
            <button onClick={() => setSemua(!semua)} className="text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline">
              {semua ? `Tampilkan yang mendesak saja` : "Tampilkan semua sertifikat"}
            </button>
          )}
        </div>
      </div>

      {/* ── tabel ───────────────────────────────────────────────────────────── */}
      {muat && !baris.length ? (
        <p className="text-slate-500 py-10 text-center">Memuat lembar sertifikat…</p>
      ) : !tampil.length ? (
        <div className="rounded-2xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 p-10 text-center text-slate-500">
          {baris.length
            ? "Tidak ada sertifikat yang cocok — berarti tidak ada yang mendesak."
            : "Belum ada data terbaca."}
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2.5 px-3">Kapal</th>
                <th className="py-2.5 px-3">Sertifikat</th>
                <th className="py-2.5 px-3">Terbit</th>
                <th className="py-2.5 px-3">Berlaku sampai</th>
                <th className="py-2.5 px-3">Sisa</th>
                <th className="py-2.5 px-3">Berkas</th>
              </tr>
            </thead>
            <tbody>
              {tampil.map(({ s, st }, i) => (
                <tr key={`${s.kapal}-${s.jenis}-${i}`} className="border-b border-slate-100 dark:border-slate-700/60 last:border-0">
                  <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">{s.kapal}</td>
                  <td className="py-2.5 px-3">
                    <div className="text-slate-800 dark:text-slate-100">{s.jenis}</div>
                    {s.kelompok && <div className="text-xs text-slate-400">{s.kelompok}</div>}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{tanggalSert(s.terbit)}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {s.permanen ? "Permanen" : tanggalSert(s.berlaku)}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg ring-1 px-2 py-0.5 text-xs font-bold ${STATUS_SERT[st].kelas}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_SERT[st].titik}`} />
                      {teksSisa(s)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {s.berkasUrl ? (
                      <a href={s.berkasUrl} target="_blank" rel="noopener noreferrer"
                         className="text-blue-700 dark:text-blue-400 hover:underline font-semibold">
                        Buka berkas ↗
                      </a>
                    ) : s.berkasNama ? (
                      <span className="text-slate-400 text-xs">{s.berkasNama.slice(0, 40)}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-4">
        Layar ini hanya membaca. Perubahan tanggal atau berkas dilakukan di lembar sumber,
        lalu tekan <b>Muat ulang</b> di sini.
      </p>
    </main>
  );
}
