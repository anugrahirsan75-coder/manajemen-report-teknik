"use client";
/**
 * Monitor Sertifikat Kapal.
 *
 * Dipakai untuk memantau, bukan untuk membaca tabel. Maka susunannya:
 *   1. angka besar — berapa yang lewat & mendesak hari ini
 *   2. jadwal 6 bulan ke depan — kapan gelombang perpanjangan datang
 *   3. papan 13 kapal — mana yang paling bermasalah, sekali lihat
 *   4. daftar rinci — baru dibuka kalau memang mau menindaklanjuti
 *
 * Data diambil ulang sendiri tiap 10 menit supaya layar yang dibiarkan
 * terbuka di meja tidak menampilkan angka basi.
 *
 * Sumbernya lembar Google cabang; layar ini membacanya, tidak mengubahnya.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  STATUS_SERT, Sertifikat, StatusSertifikat, URL_LEMBAR,
  bobotStatus, statusSert, tanggalSert, teksSisa,
} from "@/lib/sertifikat/types";

const SELANG_MUAT = 10 * 60 * 1000;
const BULAN_PENDEK = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

type Nilai = { s: Sertifikat; st: StatusSertifikat };

const kunciBulan = (iso: string) => (iso || "").slice(0, 7);
const namaBulan = (kunci: string) => {
  const [y, m] = kunci.split("-");
  return `${BULAN_PENDEK[+m]} ${y?.slice(2)}`;
};

export default function MonitorSertifikat() {
  const [baris, setBaris] = useState<Sertifikat[]>([]);
  const [kapalAda, setKapalAda] = useState<string[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [diambil, setDiambil] = useState<Date | null>(null);

  const [kapal, setKapal] = useState("");
  const [status, setStatus] = useState("");
  const [bulan, setBulan] = useState("");
  const [cari, setCari] = useState("");
  const [semua, setSemua] = useState(false);
  const [detail, setDetail] = useState("");        // kapal yang dibuka rinciannya
  const [salin, setSalin] = useState("");

  const ambil = useCallback(async (segar = false) => {
    setMuat(true); setGalat("");
    try {
      const r = await fetch(`/api/sertifikat${segar ? "?segar=1" : ""}`, { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) { setGalat(d.error || "Gagal memuat"); return; }
      setBaris(d.baris); setKapalAda(d.kapal); setDiambil(new Date(d.diambilPada));
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);

  useEffect(() => { ambil(); }, [ambil]);
  // layar pantau sering dibiarkan terbuka — segarkan sendiri secara berkala
  useEffect(() => {
    const t = setInterval(() => ambil(true), SELANG_MUAT);
    return () => clearInterval(t);
  }, [ambil]);

  const berstatus: Nilai[] = useMemo(
    () => baris.map((s) => ({ s, st: statusSert(s) })), [baris]);

  const hitung = useMemo(() => {
    const h = { lewat: 0, kritis: 0, waspada: 0, aman: 0, permanen: 0, kosong: 0 };
    berstatus.forEach(({ st }) => h[st]++);
    return h;
  }, [berstatus]);

  const perluTindakan = hitung.lewat + hitung.kritis;
  const totalBerwaktu = hitung.lewat + hitung.kritis + hitung.waspada + hitung.aman;
  const persenAman = totalBerwaktu ? Math.round((hitung.aman / totalBerwaktu) * 100) : 0;

  // ── jadwal 6 bulan ke depan ──────────────────────────────────────────────
  const jadwal = useMemo(() => {
    const kini = new Date();
    const daftar: { kunci: string; jumlah: number; kritis: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(kini.getFullYear(), kini.getMonth() + i, 1);
      const kunci = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const isi = berstatus.filter(({ s }) => !s.permanen && kunciBulan(s.berlaku) === kunci);
      daftar.push({ kunci, jumlah: isi.length, kritis: isi.filter((x) => x.st !== "aman").length });
    }
    return daftar;
  }, [berstatus]);
  const puncakJadwal = Math.max(1, ...jadwal.map((j) => j.jumlah));

  // ── papan per kapal ──────────────────────────────────────────────────────
  const papan = useMemo(() => {
    const peta = new Map<string, Nilai[]>();
    berstatus.forEach((n) => peta.set(n.s.kapal, [...(peta.get(n.s.kapal) || []), n]));
    return (kapalAda.length ? kapalAda : Array.from(peta.keys())).map((k) => {
      const isi = peta.get(k) || [];
      const h = { lewat: 0, kritis: 0, waspada: 0, aman: 0 };
      isi.forEach(({ st }) => { if (st in h) (h as any)[st]++; });
      const berwaktu = h.lewat + h.kritis + h.waspada + h.aman;
      // Dua hal berbeda, jangan dicampur: yang JATUH TEMPO BERIKUTNYA (masih
      // bisa dijadwalkan) dan yang TERTUNGGAK PALING LAMA (sudah telat). Kalau
      // digabung jadi satu "terdekat", kapal dengan tunggakan lama tidak pernah
      // menampilkan tenggat berikutnya yang justru perlu disiapkan.
      const berwaktuAda = isi.filter(({ s }) => !s.permanen && s.sisaHari !== null);
      const berikutnya = berwaktuAda
        .filter(({ s }) => s.sisaHari! >= 0)
        .sort((a, b) => a.s.sisaHari! - b.s.sisaHari!)[0];
      const tertunggak = berwaktuAda
        .filter(({ s }) => s.sisaHari! < 0)
        .sort((a, b) => a.s.sisaHari! - b.s.sisaHari!)[0];
      return {
        kapal: k, ...h, total: isi.length, berwaktu, berikutnya, tertunggak,
        skor: h.lewat * 1000 + h.kritis * 10 + h.waspada,
        persenAman: berwaktu ? Math.round((h.aman / berwaktu) * 100) : 0,
      };
    }).sort((a, b) => b.skor - a.skor || a.kapal.localeCompare(b.kapal, "id"));
  }, [berstatus, kapalAda]);

  // ── daftar rinci ─────────────────────────────────────────────────────────
  const saringanAktif = !!(kapal || status || bulan || cari);
  const tampil = useMemo(() => {
    const kata = cari.toLowerCase().split(/\s+/).filter(Boolean);
    return berstatus
      .filter(({ s, st }) => {
        if (kapal && s.kapal !== kapal) return false;
        if (status && st !== status) return false;
        if (bulan && kunciBulan(s.berlaku) !== bulan) return false;
        if (kata.length) {
          const t = `${s.kapal} ${s.jenis} ${s.kelompok} ${s.berkasNama}`.toLowerCase();
          if (!kata.every((k) => t.includes(k))) return false;
        }
        if (!saringanAktif && !semua) return st === "lewat" || st === "kritis" || st === "waspada";
        return true;
      })
      .sort((a, b) =>
        bobotStatus[a.st] - bobotStatus[b.st]
        || (a.s.sisaHari ?? 99999) - (b.s.sisaHari ?? 99999)
        || a.s.kapal.localeCompare(b.s.kapal, "id"));
  }, [berstatus, kapal, status, bulan, cari, semua, saringanAktif]);

  const bersihkan = () => { setKapal(""); setStatus(""); setBulan(""); setCari(""); setSemua(false); };

  const isiDetail = useMemo(() => {
    if (!detail) return [];
    return berstatus
      .filter(({ s }) => s.kapal === detail)
      .sort((a, b) =>
        bobotStatus[a.st] - bobotStatus[b.st]
        || (a.s.sisaHari ?? 99999) - (b.s.sisaHari ?? 99999));
  }, [berstatus, detail]);

  /** salin ringkasan mendesak — biar bisa langsung ditempel ke WhatsApp grup */
  const salinMendesak = async (daftar: Nilai[], judul: string) => {
    const isi = daftar
      .filter(({ st }) => st === "lewat" || st === "kritis")
      .slice(0, 40)
      .map(({ s }) => `• ${s.kapal} — ${s.jenis} (${s.permanen ? "permanen" : tanggalSert(s.berlaku)}, ${teksSisa(s)})`)
      .join("\n");
    const teks = `${judul}\nPer ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}\n\n${isi || "Tidak ada yang mendesak."}`;
    try { await navigator.clipboard.writeText(teks); setSalin("Ringkasan disalin — tinggal tempel di WhatsApp"); }
    catch { setSalin("Peramban menolak menyalin. Buka daftarnya lalu salin manual."); }
    setTimeout(() => setSalin(""), 4000);
  };

  const kartuAngka: [StatusSertifikat, number, string][] = [
    ["lewat", hitung.lewat, "Kedaluwarsa"],
    ["kritis", hitung.kritis, "Habis ≤ 30 hari"],
    ["waspada", hitung.waspada, "Habis ≤ 90 hari"],
    ["aman", hitung.aman, "Masih aman"],
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      {/* ── kepala, menempel saat digulir ─────────────────────────────────── */}
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-4 pb-3 mb-4 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold asdp-text-gradient leading-tight">Monitor Sertifikat Kapal</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
              <span className={`inline-block w-2 h-2 rounded-full ${muat ? "bg-amber-400 animate-pulse" : "bg-emerald-500"}`} />
              {muat ? "Menyegarkan…" : diambil
                ? <>Terbarui {diambil.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · muat ulang sendiri tiap 10 menit</>
                : "Menunggu data"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => salinMendesak(berstatus, "SERTIFIKAT PERLU PERPANJANGAN — ARMADA TERNATE")}
              className="rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2.5">
              💬 Salin daftar mendesak
            </button>
            <a href={URL_LEMBAR} target="_blank" rel="noopener noreferrer"
               className="rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-300 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-bold px-4 py-2.5">
              📄 Lembar sumber
            </a>
            <button onClick={() => ambil(true)} disabled={muat}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold px-4 py-2.5">
              ⟳ Muat ulang
            </button>
          </div>
        </div>
      </div>

      {salin && <div className="mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm px-3 py-2">{salin}</div>}
      {galat && <div className="mb-4 rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-800 text-sm px-3 py-2">{galat}</div>}

      {/* ── keadaan hari ini ───────────────────────────────────────────────── */}
      <section className="grid lg:grid-cols-[1fr_auto] gap-3 mb-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kartuAngka.map(([st, n, judul]) => {
            const aktif = status === st;
            return (
              <button key={st} onClick={() => { setStatus(aktif ? "" : st); setSemua(false); }}
                className={`text-left rounded-2xl p-4 ring-1 transition relative overflow-hidden ${
                  aktif ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-slate-800"
                        : "bg-white dark:bg-slate-800 ring-slate-200 dark:ring-slate-700 hover:ring-slate-300 dark:hover:ring-slate-500"}`}>
                <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${STATUS_SERT[st].titik}`} />
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 pl-2">{judul}</div>
                <div className="text-4xl font-extrabold text-slate-900 dark:text-white mt-1 pl-2 tabular-nums">{n}</div>
                <div className="text-[11px] text-slate-400 pl-2 mt-0.5">{aktif ? "disaring — klik lagi untuk lepas" : "klik untuk saring"}</div>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 p-4 flex items-center gap-4 lg:w-64">
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" className="stroke-slate-200 dark:stroke-slate-700" />
              <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" strokeLinecap="round"
                className={persenAman >= 80 ? "stroke-emerald-500" : persenAman >= 60 ? "stroke-amber-400" : "stroke-rose-500"}
                strokeDasharray={`${(persenAman / 100) * 97.4} 97.4`} />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <span className="text-lg font-extrabold text-slate-800 dark:text-white tabular-nums">{persenAman}%</span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Kesehatan armada</div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              {perluTindakan > 0
                ? <><b className="text-rose-600 dark:text-rose-400">{perluTindakan}</b> dokumen perlu diurus sekarang</>
                : "Tidak ada yang mendesak"}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{totalBerwaktu} bermasa berlaku · {hitung.permanen} permanen</div>
          </div>
        </div>
      </section>

      {/* ── gelombang perpanjangan 6 bulan ─────────────────────────────────── */}
      <section className="rounded-2xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm p-4 mb-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-extrabold text-slate-800 dark:text-slate-100">Jatuh tempo 6 bulan ke depan</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">klik bulan untuk melihat isinya</span>
        </div>
        <div className="grid grid-cols-6 gap-2 items-end">
          {jadwal.map((j) => {
            const aktif = bulan === j.kunci;
            const tinggi = Math.max(8, Math.round((j.jumlah / puncakJadwal) * 76));
            return (
              <button key={j.kunci} onClick={() => { setBulan(aktif ? "" : j.kunci); setStatus(""); }}
                className="group flex flex-col items-center gap-1">
                <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">{j.jumlah}</span>
                <span style={{ height: tinggi }}
                  className={`w-full rounded-t-lg transition ${
                    aktif ? "bg-blue-600"
                      : j.kritis > 0 ? "bg-amber-400 group-hover:bg-amber-500"
                      : "bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400"}`} />
                <span className={`text-[11px] font-semibold ${aktif ? "text-blue-700 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"}`}>
                  {namaBulan(j.kunci)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── papan kapal ────────────────────────────────────────────────────── */}
      <section className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="font-extrabold text-slate-800 dark:text-slate-100">Papan armada</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">diurut dari yang paling perlu perhatian · klik kartu untuk rinciannya</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {papan.map((k) => {
            const gawat = k.lewat > 0;
            const dekat = k.kritis > 0;
            return (
              <button key={k.kapal} onClick={() => setDetail(k.kapal)}
                className={`text-left rounded-2xl p-4 ring-1 transition relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md ${
                  gawat ? "bg-rose-50 dark:bg-rose-950/30 ring-rose-200 dark:ring-rose-900"
                    : dekat ? "bg-amber-50 dark:bg-amber-950/20 ring-amber-200 dark:ring-amber-900"
                    : "bg-white dark:bg-slate-800 ring-slate-200 dark:ring-slate-700"}`}>
                <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${gawat ? "bg-rose-500" : dekat ? "bg-amber-400" : "bg-emerald-500"}`} />
                <div className="flex items-start justify-between gap-2 pl-2">
                  <div className="font-extrabold text-slate-900 dark:text-white truncate">{k.kapal}</div>
                  <span className="text-[11px] font-bold text-slate-400 shrink-0 tabular-nums">{k.total} dok</span>
                </div>

                <div className="flex gap-1.5 mt-2 pl-2 flex-wrap">
                  {k.lewat > 0 && <span className="rounded-lg bg-rose-600 text-white text-[11px] font-bold px-2 py-0.5">{k.lewat} lewat</span>}
                  {k.kritis > 0 && <span className="rounded-lg bg-orange-500 text-white text-[11px] font-bold px-2 py-0.5">{k.kritis} ≤30h</span>}
                  {k.waspada > 0 && <span className="rounded-lg bg-amber-200 text-amber-900 text-[11px] font-bold px-2 py-0.5">{k.waspada} ≤90h</span>}
                  {!k.lewat && !k.kritis && !k.waspada && <span className="rounded-lg bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2 py-0.5">semua aman</span>}
                </div>

                {/* bilah proporsi status */}
                <div className="flex h-1.5 rounded-full overflow-hidden mt-3 ml-2 bg-slate-200 dark:bg-slate-700">
                  {([["lewat", k.lewat], ["kritis", k.kritis], ["waspada", k.waspada], ["aman", k.aman]] as [StatusSertifikat, number][])
                    .map(([st, n]) => n > 0 && (
                      <span key={st} className={STATUS_SERT[st].titik} style={{ width: `${(n / Math.max(1, k.berwaktu)) * 100}%` }} />
                    ))}
                </div>

                <div className="mt-2 pl-2 space-y-0.5">
                  {k.tertunggak && (
                    <div className="text-xs text-rose-700 dark:text-rose-400 truncate">
                      Tertunggak: <b>{k.tertunggak.s.jenis}</b> · {teksSisa(k.tertunggak.s)}
                    </div>
                  )}
                  {k.berikutnya && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      Berikutnya: <b>{k.berikutnya.s.jenis}</b> · {teksSisa(k.berikutnya.s)}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── saringan + daftar ──────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm p-3 mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari sertifikat, kapal, berkas…"
            className="w-full rounded-xl ring-1 ring-slate-300 dark:ring-slate-600 dark:bg-slate-900 px-3 py-2 text-sm pr-8" />
          {cari && (
            <button onClick={() => setCari("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">✕</button>
          )}
        </div>
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
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="font-extrabold text-slate-800 dark:text-slate-100">
          {saringanAktif ? "Hasil saringan" : semua ? "Semua sertifikat" : "Perlu tindakan (habis ≤ 90 hari)"}
          <span className="ml-2 text-sm font-semibold text-slate-500 tabular-nums">{tampil.length} baris</span>
          {bulan && <span className="ml-2 text-sm font-semibold text-blue-700 dark:text-blue-400">· jatuh tempo {namaBulan(bulan)}</span>}
        </h2>
        <div className="flex gap-3">
          {saringanAktif && (
            <button onClick={bersihkan} className="text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline">
              Bersihkan saringan
            </button>
          )}
          {!saringanAktif && (
            <button onClick={() => setSemua(!semua)} className="text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline">
              {semua ? "Yang mendesak saja" : "Tampilkan semua"}
            </button>
          )}
        </div>
      </div>

      {muat && !baris.length ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : !tampil.length ? (
        <div className="rounded-2xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 p-10 text-center text-slate-500">
          {baris.length ? "Tidak ada yang cocok — berarti tidak ada yang mendesak." : "Belum ada data terbaca."}
        </div>
      ) : (
        <>
          {/* layar lebar: tabel */}
          <div className="hidden md:block rounded-2xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="sticky top-[84px] z-20 bg-slate-50 dark:bg-slate-900">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3">Kapal</th>
                  <th className="py-2.5 px-3">Sertifikat</th>
                  <th className="py-2.5 px-3">Berlaku sampai</th>
                  <th className="py-2.5 px-3">Sisa</th>
                  <th className="py-2.5 px-3 text-right">Berkas</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map(({ s, st }, i) => (
                  <tr key={`${s.kapal}-${s.jenis}-${i}`}
                    className="border-b border-slate-100 dark:border-slate-700/60 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <span className={`w-1.5 h-6 rounded-full ${STATUS_SERT[st].titik}`} />
                        <button onClick={() => setDetail(s.kapal)} className="font-bold text-slate-800 dark:text-slate-100 hover:underline">
                          {s.kapal}
                        </button>
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-800 dark:text-slate-100">{s.jenis}</div>
                      {s.kelompok && <div className="text-xs text-slate-400">{s.kelompok}</div>}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {s.permanen ? "Permanen" : tanggalSert(s.berlaku)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-lg ring-1 px-2 py-0.5 text-xs font-bold ${STATUS_SERT[st].kelas}`}>
                        {teksSisa(s)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {s.berkasUrl
                        ? <a href={s.berkasUrl} target="_blank" rel="noopener noreferrer"
                             className="text-blue-700 dark:text-blue-400 hover:underline font-semibold whitespace-nowrap">Buka ↗</a>
                        : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ponsel: kartu, biar tidak perlu geser ke samping */}
          <div className="md:hidden space-y-2">
            {tampil.map(({ s, st }, i) => (
              <div key={`${s.kapal}-${s.jenis}-${i}`}
                className="rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 p-3 relative overflow-hidden">
                <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${STATUS_SERT[st].titik}`} />
                <div className="pl-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-slate-800 dark:text-slate-100">{s.kapal}</div>
                    <span className={`shrink-0 rounded-lg ring-1 px-2 py-0.5 text-[11px] font-bold ${STATUS_SERT[st].kelas}`}>{teksSisa(s)}</span>
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-200 mt-0.5">{s.jenis}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {s.kelompok} · {s.permanen ? "Permanen" : tanggalSert(s.berlaku)}
                  </div>
                  {s.berkasUrl && (
                    <a href={s.berkasUrl} target="_blank" rel="noopener noreferrer"
                       className="inline-block mt-2 text-blue-700 dark:text-blue-400 font-semibold text-sm">Buka berkas ↗</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-slate-400 mt-4">
        Layar ini hanya membaca. Perubahan tanggal atau berkas dilakukan di lembar sumber,
        lalu tekan <b>Muat ulang</b>.
      </p>

      {/* ── rincian satu kapal ─────────────────────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setDetail("")}>
          <div className="bg-white dark:bg-slate-800 w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{detail}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isiDetail.length} dokumen · {isiDetail.filter((x) => x.st === "lewat").length} lewat ·{" "}
                  {isiDetail.filter((x) => x.st === "kritis").length} habis ≤ 30 hari
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => salinMendesak(isiDetail, `SERTIFIKAT PERLU PERPANJANGAN — ${detail}`)}
                  className="rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2">💬 Salin</button>
                <button onClick={() => setDetail("")} className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xl leading-none">✕</button>
              </div>
            </div>

            <div className="overflow-y-auto p-4 space-y-4">
              {Array.from(new Set(isiDetail.map(({ s }) => s.kelompok))).map((kel) => (
                <div key={kel}>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1.5">{kel || "Lainnya"}</div>
                  <div className="space-y-1.5">
                    {isiDetail.filter(({ s }) => s.kelompok === kel).map(({ s, st }, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 ring-1 ring-slate-200 dark:ring-slate-700 px-3 py-2">
                        <span className={`w-1.5 h-8 rounded-full shrink-0 ${STATUS_SERT[st].titik}`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{s.jenis}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {s.permanen ? "Permanen" : <>berlaku s.d. {tanggalSert(s.berlaku)}</>}
                            {s.terbit && <> · terbit {tanggalSert(s.terbit)}</>}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-lg ring-1 px-2 py-0.5 text-[11px] font-bold ${STATUS_SERT[st].kelas}`}>{teksSisa(s)}</span>
                        {s.berkasUrl && (
                          <a href={s.berkasUrl} target="_blank" rel="noopener noreferrer"
                             className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5">Buka</a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
