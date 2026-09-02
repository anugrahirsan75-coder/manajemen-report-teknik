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
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  STATUS_SERT, Sertifikat, StatusSertifikat, URL_LEMBAR,
  bobotStatus, statusSert, tanggalSert, teksSisa,
} from "@/lib/sertifikat/types";

const SELANG_MUAT = 10 * 60 * 1000;
const BULAN_PENDEK = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

type Nilai = { s: Sertifikat; st: StatusSertifikat };

/**
 * Sisa masa berlaku dalam bentuk sesingkat mungkin.
 *
 * Sel matriks selebar ±6rem harus memuat tiga belas kolom di satu layar; teks
 * "Lewat 128 hari" memaksa sel melebar sampai papannya tidak lagi terbaca
 * sekaligus — padahal terbaca sekaligus itulah gunanya papan ini.
 */
const sisaRingkas = (s: Sertifikat) => {
  if (s.permanen) return "PERM";
  if (s.sisaHari === null) return "—";
  if (s.sisaHari < 0) return `${s.sisaHari}h`;
  if (s.sisaHari > 999) return `${Math.round(s.sisaHari / 365)}th`;
  return `${s.sisaHari}h`;
};

/** tanggal ringkas untuk sel: 15 Sep 26 */
const tanggalRingkas = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return BULAN_PENDEK[+m] ? `${+d} ${BULAN_PENDEK[+m]} ${y.slice(2)}` : iso;
};

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
  const [sel, setSel] = useState<Nilai | null>(null);  // satu sel matriks yang dibuka
  const [matriksPadat, setMatriksPadat] = useState(true);   // sembunyikan baris yang semua kapalnya aman
  const [ikutPermanen, setIkutPermanen] = useState(false);  // dokumen tanpa masa berlaku
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

  /**
   * Papan matriks: satu baris per JENIS dokumen, satu kolom per kapal.
   *
   * Papan armada di atas menjawab "kapal mana yang bermasalah". Yang tidak bisa
   * dijawabnya: "dokumen mana yang jatuh tempo serentak di banyak kapal" —
   * padahal justru itu yang menentukan antrean kerja. SKKP dan SNPP satu
   * angkatan biasanya habis di bulan yang sama, dan itu baru kelihatan kalau
   * seluruh armada dibaca dalam satu bidang, seperti lembar MUSTER aslinya.
   *
   * Urutan barisnya mengikuti urutan lembar sumber (SOLAS, MARPOL, Biro
   * Klasifikasi, …), bukan diurut ulang menurut kegentingan: petugas yang
   * terbiasa dengan lembarnya harus tetap menemukan barisnya di tempat yang
   * sama.
   */
  const matriks = useMemo(() => {
    const urut: { kelompok: string; jenis: string; no: string }[] = [];
    const sudah = new Set<string>();
    baris.forEach((s) => {
      const k = `${s.kelompok}|${s.jenis}`;
      if (sudah.has(k)) return;
      sudah.add(k);
      urut.push({ kelompok: s.kelompok, jenis: s.jenis, no: s.no });
    });

    const petaSel = new Map<string, Nilai>();
    berstatus.forEach((n) => petaSel.set(`${n.s.kapal}|${n.s.kelompok}|${n.s.jenis}`, n));

    const kapalKolom = kapalAda.length ? kapalAda : Array.from(new Set(baris.map((s) => s.kapal)));

    const barisMatriks = urut.map((u) => {
      const isi = kapalKolom.map((k) => petaSel.get(`${k}|${u.kelompok}|${u.jenis}`) || null);
      const h = { lewat: 0, kritis: 0, waspada: 0, aman: 0, permanen: 0, kosong: 0 };
      isi.forEach((n) => { if (n) h[n.st]++; });
      // baris permanen: seluruh isinya dokumen tanpa masa berlaku
      const semuaPermanen = h.permanen > 0 && h.lewat + h.kritis + h.waspada + h.aman === 0;
      return { ...u, isi, h, semuaPermanen, perlu: h.lewat + h.kritis + h.waspada };
    });

    return { kapalKolom, barisMatriks };
  }, [baris, berstatus, kapalAda]);

  /** baris yang benar-benar digambar, setelah dua saklar di kepala papan */
  const barisMatriksTampil = useMemo(() => matriks.barisMatriks.filter((b) => {
    if (!ikutPermanen && b.semuaPermanen) return false;
    if (matriksPadat && b.perlu === 0) return false;
    return true;
  }), [matriks, ikutPermanen, matriksPadat]);

  /** jumlah masalah per kapal — dipakai di kepala kolom */
  const masalahKapal = useMemo(() => {
    const peta = new Map<string, number>();
    berstatus.forEach(({ s, st }) => {
      if (st === "lewat" || st === "kritis") peta.set(s.kapal, (peta.get(s.kapal) || 0) + 1);
    });
    return peta;
  }, [berstatus]);

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

  const kartuAngka: { st: StatusSertifikat; nilai: number; judul: string; ket: string }[] = [
    { st: "lewat", nilai: hitung.lewat, judul: "Kedaluwarsa", ket: "harus segera diurus" },
    { st: "kritis", nilai: hitung.kritis, judul: "Habis ≤ 30 hari", ket: "siapkan perpanjangan" },
    { st: "waspada", nilai: hitung.waspada, judul: "Habis ≤ 90 hari", ket: "masuk antrean" },
    { st: "aman", nilai: hitung.aman, judul: "Masih aman", ket: "di atas 90 hari" },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      {/* ── kepala ──────────────────────────────────────────────────────── */}
      <header className="asdp-gradient mb-5 rounded-[1.75rem] p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow flex flex-wrap items-center gap-4 rounded-[calc(1.75rem-1.5px)] px-5 py-5 sm:px-6">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-800 text-2xl text-white shadow-lg shadow-sky-900/20">📜</div>
          <div className="min-w-[16rem] flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-sky-800 ring-1 ring-sky-200">Kelaiklautan Armada</span>
              <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${muat ? "animate-pulse bg-amber-400" : "bg-emerald-500"}`} />
                {muat ? "Menyegarkan…" : diambil ? `Terbarui ${diambil.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : "Menunggu data"}
              </span>
              {perluTindakan > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-extrabold text-rose-700 ring-1 ring-rose-200">● {perluTindakan} PERLU TINDAKAN</span>
              )}
            </div>
            <h1 className="asdp-text-gradient text-2xl font-extrabold leading-tight">Monitor Sertifikat Kapal</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Masa berlaku sertifikat 13 kapal, dihitung ulang hari ini dari lembar MUSTER cabang.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => salinMendesak(berstatus, "SERTIFIKAT PERLU PERPANJANGAN — ARMADA TERNATE")}
              className="btn bg-slate-900 text-xs text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600">
              💬 Salin daftar mendesak
            </button>
            <a href={URL_LEMBAR} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-xs">📄 Lembar sumber</a>
            <button onClick={() => ambil(true)} disabled={muat} className="btn btn-primary text-xs disabled:opacity-50">
              {muat ? "Memuat…" : "⟳ Muat ulang"}
            </button>
          </div>
        </div>
      </header>

      {salin && <div className="anim-in mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">✓ {salin}</div>}
      {galat && <div className="anim-in mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{galat}</div>}

      {/* ── keadaan hari ini ────────────────────────────────────────────── */}
      <section className="anim-in mb-5 rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/80 dark:ring-slate-700 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Keadaan hari ini</h2>
            <p className="text-xs text-slate-400">Klik angka untuk menyaring daftar di bawah.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
            {totalBerwaktu} bermasa berlaku · {hitung.permanen} permanen
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            {kartuAngka.map(({ st, nilai, judul, ket }) => {
              const aktif = status === st;
              return (
                <button key={st} onClick={() => { setStatus(aktif ? "" : st); setSemua(false); }}
                  className={`card-hover relative overflow-hidden rounded-2xl px-4 py-3 text-left ring-1 transition ${
                    aktif
                      ? "bg-slate-900 text-white ring-slate-900 dark:bg-slate-700"
                      : "bg-white ring-slate-200 hover:ring-slate-300 dark:bg-slate-800 dark:ring-slate-700"}`}>
                  <span className={`absolute inset-y-0 left-0 w-1 ${STATUS_SERT[st].titik}`} />
                  <p className={`pl-2 text-[9px] font-extrabold uppercase tracking-[0.13em] ${aktif ? "text-white/70" : "text-slate-400"}`}>{judul}</p>
                  <p className={`pl-2 text-3xl font-extrabold leading-none tabular-nums ${aktif ? "text-white" : "text-slate-900 dark:text-white"}`}>{nilai}</p>
                  <p className={`pl-2 pt-1 text-[10px] ${aktif ? "text-white/70" : "text-slate-400"}`}>{aktif ? "sedang disaring" : ket}</p>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700 lg:w-72">
            <div className="relative h-[4.5rem] w-[4.5rem] shrink-0">
              <svg viewBox="0 0 36 36" className="h-[4.5rem] w-[4.5rem] -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" className="stroke-slate-200 dark:stroke-slate-700" />
                <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" strokeLinecap="round"
                  className={persenAman >= 80 ? "stroke-emerald-500" : persenAman >= 60 ? "stroke-amber-400" : "stroke-rose-500"}
                  strokeDasharray={`${(persenAman / 100) * 97.4} 97.4`} />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <span className="text-lg font-extrabold tabular-nums text-slate-800 dark:text-white">{persenAman}%</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-slate-400">Kesehatan armada</p>
              <p className="mt-1 text-sm leading-snug text-slate-600 dark:text-slate-300">
                {perluTindakan > 0
                  ? <><b className="text-rose-600 dark:text-rose-400">{perluTindakan} dokumen</b> perlu diurus sekarang</>
                  : "Tidak ada yang mendesak"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── jadwal 6 bulan ──────────────────────────────────────────────── */}
      <section className="anim-in mb-5 rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/80 dark:ring-slate-700 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Jatuh tempo 6 bulan ke depan</h2>
            <p className="text-xs text-slate-400">Terlihat kapan gelombang perpanjangan datang. Klik bulan untuk melihat isinya.</p>
          </div>
          {bulan && (
            <button onClick={() => setBulan("")} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-400">
              Lepas saringan {namaBulan(bulan)}
            </button>
          )}
        </div>
        <div className="flex items-end gap-2 sm:gap-3">
          {jadwal.map((j) => {
            const aktif = bulan === j.kunci;
            const tinggi = Math.max(6, Math.round((j.jumlah / puncakJadwal) * 88));
            const mendesak = j.kritis > 0;
            return (
              <button key={j.kunci} onClick={() => { setBulan(aktif ? "" : j.kunci); setStatus(""); }}
                className="group flex flex-1 flex-col items-center gap-1.5">
                <span className={`text-xs font-extrabold tabular-nums ${aktif ? "text-blue-700 dark:text-blue-400" : "text-slate-600 dark:text-slate-300"}`}>{j.jumlah}</span>
                <span style={{ height: tinggi }}
                  className={`w-full rounded-lg transition ${
                    aktif ? "bg-gradient-to-t from-blue-700 to-sky-500"
                      : mendesak ? "bg-gradient-to-t from-amber-500 to-amber-300 group-hover:from-amber-600"
                      : "bg-gradient-to-t from-slate-300 to-slate-200 group-hover:from-slate-400 dark:from-slate-600 dark:to-slate-700"}`} />
                <span className={`text-[10px] font-bold ${aktif ? "text-blue-700 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"}`}>{namaBulan(j.kunci)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── papan matriks kapal x dokumen ───────────────────────────────── */}
      <section className="anim-in mb-5 rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/80 dark:ring-slate-700 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Papan dokumen armada</h2>
            <p className="text-xs text-slate-400">
              Seluruh kapal dan seluruh jenis dokumen dalam satu bidang, seperti lembar MUSTER — tapi berwarna menurut
              sisa hari. Klik sel untuk rincian dan berkasnya.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setMatriksPadat(!matriksPadat)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ring-1 transition ${
                matriksPadat
                  ? "bg-slate-900 text-white ring-slate-900 dark:bg-slate-700 dark:ring-slate-600"
                  : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600"}`}>
              {matriksPadat ? "Hanya baris bermasalah" : "Semua baris"}
            </button>
            <button onClick={() => setIkutPermanen(!ikutPermanen)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ring-1 transition ${
                ikutPermanen
                  ? "bg-slate-900 text-white ring-slate-900 dark:bg-slate-700 dark:ring-slate-600"
                  : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600"}`}>
              {ikutPermanen ? "Permanen ikut" : "Permanen disembunyikan"}
            </button>
          </div>
        </div>

        {!barisMatriksTampil.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <p className="text-2xl">{baris.length ? "🎉" : "⏳"}</p>
            <p className="mt-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
              {baris.length ? "Tidak ada baris bermasalah" : "Data belum terbaca"}
            </p>
            <p className="text-xs text-slate-400">
              {baris.length ? "Tekan “Semua baris” untuk melihat dokumen yang aman juga." : "Tekan Muat ulang untuk mencoba lagi."}
            </p>
          </div>
        ) : (
          <div className="overflow-auto rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700" style={{ maxHeight: "34rem" }}>
            <table className="border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  {/* pojok kiri-atas ikut membeku dua arah: tanpa itu nama dokumen
                      hilang begitu papan digulir ke kanan */}
                  <th className="sticky left-0 top-0 z-30 min-w-[15rem] border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                    Jenis dokumen
                  </th>
                  {matriks.kapalKolom.map((k) => {
                    const n = masalahKapal.get(k) || 0;
                    return (
                      <th key={k} className="sticky top-0 z-20 min-w-[6.5rem] border-b border-slate-200 bg-slate-100 px-1.5 py-2 dark:border-slate-700 dark:bg-slate-800">
                        <button onClick={() => setDetail(k)} className="w-full text-center">
                          <span className="block truncate text-[10px] font-extrabold uppercase tracking-wide text-slate-600 hover:text-sky-700 dark:text-slate-300">
                            {k.replace(/^KMP\.?\s*/i, "")}
                          </span>
                          <span className={`mt-0.5 inline-block rounded-full px-1.5 text-[9px] font-bold tabular-nums ${
                            n ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>
                            {n ? `${n} perlu` : "aman"}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {barisMatriksTampil.map((b, i) => {
                  const kelompokBaru = i === 0 || barisMatriksTampil[i - 1].kelompok !== b.kelompok;
                  return (
                    <Fragment key={`${b.kelompok}|${b.jenis}`}>
                      {kelompokBaru && (
                        <tr>
                          <td colSpan={matriks.kapalKolom.length + 1}
                            className="sticky left-0 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:bg-slate-800/60">
                            {b.kelompok || "Lainnya"}
                          </td>
                        </tr>
                      )}
                      <tr className="group">
                        <th scope="row"
                          className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-1.5 text-left align-middle group-hover:bg-sky-50/70 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-slate-800/70">
                          <button onClick={() => { setCari(b.jenis); setStatus(""); setBulan(""); }}
                            className="block w-full text-left">
                            <span className="flex items-start gap-1.5">
                              <span className="mt-0.5 w-4 shrink-0 text-[10px] font-bold tabular-nums text-slate-400">{b.no}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100" title={b.jenis}>{b.jenis}</span>
                                <span className="mt-0.5 flex flex-wrap gap-1">
                                  {b.h.lewat > 0 && <span className="rounded bg-rose-100 px-1 text-[9px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{b.h.lewat} lewat</span>}
                                  {b.h.kritis > 0 && <span className="rounded bg-orange-100 px-1 text-[9px] font-bold text-orange-800 dark:bg-orange-950/50 dark:text-orange-300">{b.h.kritis} ≤30h</span>}
                                  {b.h.waspada > 0 && <span className="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">{b.h.waspada} ≤90h</span>}
                                  {b.h.kosong > 0 && <span className="rounded bg-slate-100 px-1 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{b.h.kosong} kosong</span>}
                                </span>
                              </span>
                            </span>
                          </button>
                        </th>
                        {b.isi.map((n, j) => (
                          <td key={j} className="border-b border-slate-100 px-1 py-1 align-middle dark:border-slate-800">
                            {n ? (
                              <button onClick={() => setSel(n)}
                                title={`${n.s.kapal} · ${n.s.jenis}\n${n.s.permanen ? "Permanen" : `berlaku s.d. ${tanggalSert(n.s.berlaku)}`} · ${teksSisa(n.s)}`}
                                className={`w-full rounded-lg px-1.5 py-1.5 text-center ring-1 transition hover:-translate-y-0.5 hover:shadow-sm ${STATUS_SERT[n.st].kelas}`}>
                                <span className="block text-[12px] font-extrabold leading-none tabular-nums">{sisaRingkas(n.s)}</span>
                                <span className="mt-0.5 block truncate text-[9px] opacity-75">
                                  {n.s.permanen ? "tanpa tempo" : tanggalRingkas(n.s.berlaku) || "tanpa tanggal"}
                                </span>
                                {n.s.berkasUrl && <span className="mt-0.5 block text-[8px] opacity-60">📎</span>}
                              </button>
                            ) : (
                              <span className="block rounded-lg bg-slate-50 px-1.5 py-2.5 text-center text-[10px] text-slate-300 ring-1 ring-slate-100 dark:bg-slate-800/40 dark:text-slate-600 dark:ring-slate-800">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-slate-500">
          {(["lewat", "kritis", "waspada", "aman", "permanen", "kosong"] as StatusSertifikat[]).map((st) => (
            <span key={st} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_SERT[st].titik}`} />{STATUS_SERT[st].label}
            </span>
          ))}
          <span className="text-slate-400">📎 sel dengan berkas tersimpan · klik nama kapal untuk rincian kapal · klik nama dokumen untuk menyaring daftar</span>
        </div>
      </section>

      {/* ── papan armada ────────────────────────────────────────────────── */}
      <section className="anim-in mb-5 rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/80 dark:ring-slate-700 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Papan armada</h2>
            <p className="text-xs text-slate-400">Diurut dari yang paling perlu perhatian. Klik kartu untuk rinciannya.</p>
          </div>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {papan.map((k) => {
            const gawat = k.lewat > 0;
            const dekat = !gawat && k.kritis > 0;
            return (
              <button key={k.kapal} onClick={() => setDetail(k.kapal)}
                className="card-hover relative overflow-hidden rounded-2xl bg-white p-3.5 text-left ring-1 ring-slate-200 transition dark:bg-slate-800 dark:ring-slate-700">
                <span className={`absolute inset-y-0 left-0 w-1 ${gawat ? "bg-rose-500" : dekat ? "bg-amber-400" : "bg-emerald-500"}`} />
                <div className="flex items-start justify-between gap-2 pl-2">
                  <p className="truncate font-extrabold text-slate-900 dark:text-white">{k.kapal}</p>
                  <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500 dark:bg-slate-700 dark:text-slate-300">{k.total} dok</span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1 pl-2">
                  {k.lewat > 0 && <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900">{k.lewat} lewat</span>}
                  {k.kritis > 0 && <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900">{k.kritis} ≤30h</span>}
                  {k.waspada > 0 && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">{k.waspada} ≤90h</span>}
                  {!k.lewat && !k.kritis && !k.waspada && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">semua aman</span>}
                </div>

                <div className="mt-2.5 ml-2 flex h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  {([["lewat", k.lewat], ["kritis", k.kritis], ["waspada", k.waspada], ["aman", k.aman]] as [StatusSertifikat, number][])
                    .map(([st, n]) => n > 0 && (
                      <span key={st} className={STATUS_SERT[st].titik} style={{ width: `${(n / Math.max(1, k.berwaktu)) * 100}%` }} />
                    ))}
                </div>

                <dl className="mt-2.5 space-y-1 pl-2 text-[11px]">
                  {k.tertunggak && (
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 font-semibold text-rose-600 dark:text-rose-400">Tertunggak</dt>
                      <dd className="truncate text-slate-600 dark:text-slate-300">{k.tertunggak.s.jenis} · {teksSisa(k.tertunggak.s)}</dd>
                    </div>
                  )}
                  {k.berikutnya && (
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 font-semibold text-slate-500">Berikutnya</dt>
                      <dd className="truncate text-slate-600 dark:text-slate-300">{k.berikutnya.s.jenis} · {teksSisa(k.berikutnya.s)}</dd>
                    </div>
                  )}
                </dl>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── daftar rinci ────────────────────────────────────────────────── */}
      <section className="anim-in rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/80 dark:ring-slate-700 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">
              {saringanAktif ? "Hasil saringan" : semua ? "Semua sertifikat" : "Perlu tindakan"}
            </h2>
            <p className="text-xs text-slate-400">
              {tampil.length} baris
              {bulan && <> · jatuh tempo {namaBulan(bulan)}</>}
              {kapal && <> · {kapal}</>}
              {!saringanAktif && !semua && <> · sudah lewat atau habis dalam 90 hari</>}
            </p>
          </div>
          <div className="flex gap-3">
            {saringanAktif && (
              <button onClick={bersihkan} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-400">Bersihkan saringan</button>
            )}
            {!saringanAktif && (
              <button onClick={() => setSemua(!semua)} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-400">
                {semua ? "Yang mendesak saja" : "Tampilkan semua"}
              </button>
            )}
          </div>
        </div>

        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari sertifikat, kapal, berkas…"
              className="w-full rounded-xl border border-slate-300 bg-white px-8 py-2 text-sm outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900" />
            {cari && <button onClick={() => setCari("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">✕</button>}
          </div>
          <select value={kapal} onChange={(e) => setKapal(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">Semua kapal</option>
            {kapalAda.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">Semua status</option>
            {(["lewat", "kritis", "waspada", "aman", "permanen", "kosong"] as StatusSertifikat[]).map((s) =>
              <option key={s} value={s}>{STATUS_SERT[s].label}</option>)}
          </select>
        </div>

        {muat && !baris.length ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}
          </div>
        ) : !tampil.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <p className="text-3xl">🎉</p>
            <p className="mt-2 font-bold text-slate-700 dark:text-slate-200">
              {baris.length ? "Tidak ada yang cocok" : "Belum ada data terbaca"}
            </p>
            <p className="text-xs text-slate-400">{baris.length ? "Berarti tidak ada sertifikat yang mendesak pada saringan ini." : "Tekan Muat ulang untuk mencoba lagi."}</p>
          </div>
        ) : (
          <>
            {/* layar lebar */}
            <div className="hidden overflow-hidden rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700 md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr className="text-left text-[10px] uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-3 py-2.5 font-extrabold">Kapal</th>
                    <th className="px-3 py-2.5 font-extrabold">Sertifikat</th>
                    <th className="px-3 py-2.5 font-extrabold">Berlaku sampai</th>
                    <th className="px-3 py-2.5 font-extrabold">Sisa</th>
                    <th className="px-3 py-2.5 text-right font-extrabold">Berkas</th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map(({ s, st }, i) => (
                    <tr key={`${s.kapal}-${s.jenis}-${i}`}
                      className="border-t border-slate-100 transition hover:bg-sky-50/60 dark:border-slate-700/60 dark:hover:bg-slate-800/60">
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className={`h-6 w-1 rounded-full ${STATUS_SERT[st].titik}`} />
                          <button onClick={() => setDetail(s.kapal)} className="font-bold text-slate-800 hover:text-sky-700 hover:underline dark:text-slate-100">
                            {s.kapal}
                          </button>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-slate-800 dark:text-slate-100">{s.jenis}</p>
                        {s.kelompok && <p className="text-[10px] uppercase tracking-wide text-slate-400">{s.kelompok}</p>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        {s.permanen ? "Permanen" : tanggalSert(s.berlaku)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${STATUS_SERT[st].kelas}`}>
                          {teksSisa(s)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        {s.berkasUrl
                          ? <a href={s.berkasUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost px-2.5 py-1 text-[11px]">Buka ↗</a>
                          : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ponsel */}
            <div className="space-y-2 md:hidden">
              {tampil.map(({ s, st }, i) => (
                <div key={`${s.kapal}-${s.jenis}-${i}`}
                  className="relative overflow-hidden rounded-2xl bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                  <span className={`absolute inset-y-0 left-0 w-1 ${STATUS_SERT[st].titik}`} />
                  <div className="pl-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-slate-800 dark:text-slate-100">{s.kapal}</p>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ${STATUS_SERT[st].kelas}`}>{teksSisa(s)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{s.jenis}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {s.kelompok} · {s.permanen ? "Permanen" : tanggalSert(s.berlaku)}
                    </p>
                    {s.berkasUrl && (
                      <a href={s.berkasUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-2 px-2.5 py-1 text-[11px]">Buka berkas ↗</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="mt-3 text-[11px] text-slate-400">
          Layar ini hanya membaca. Perubahan tanggal atau berkas dilakukan di lembar sumber, lalu tekan Muat ulang.
        </p>
      </section>

      {/* ── rincian satu sel matriks ───────────────────────────────────── */}
      {sel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setSel(null)}>
          <div className="w-full rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{sel.s.kelompok || "Dokumen"}</p>
                <h3 className="truncate text-lg font-extrabold text-slate-900 dark:text-white">{sel.s.jenis}</h3>
                <p className="text-sm font-semibold text-slate-500">{sel.s.kapal}</p>
              </div>
              <button onClick={() => setSel(null)} className="text-xl leading-none text-slate-400 hover:text-slate-700 dark:hover:text-white">✕</button>
            </div>

            <div className={`mt-3 rounded-xl px-3 py-2.5 text-center ring-1 ${STATUS_SERT[sel.st].kelas}`}>
              <p className="text-xl font-extrabold leading-none">{teksSisa(sel.s)}</p>
              <p className="mt-1 text-[11px] opacity-80">{STATUS_SERT[sel.st].label}</p>
            </div>

            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Terbit</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">{tanggalSert(sel.s.terbit)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Berlaku sampai</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">{sel.s.permanen ? "Permanen" : tanggalSert(sel.s.berlaku)}</dd>
              </div>
              {sel.s.berkasNama && (
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-slate-500">Berkas</dt>
                  <dd className="truncate text-right text-[12px] text-slate-600 dark:text-slate-300" title={sel.s.berkasNama}>{sel.s.berkasNama}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              {sel.s.berkasUrl
                ? <a href={sel.s.berkasUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary flex-1 justify-center text-xs">📄 Buka berkas ↗</a>
                : <span className="flex-1 rounded-xl bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">Berkas belum ditautkan di lembar sumber</span>}
              <button onClick={() => { setDetail(sel.s.kapal); setSel(null); }} className="btn btn-ghost text-xs">Semua dokumen kapal ini</button>
            </div>
          </div>
        </div>
      )}

      {/* ── rincian satu kapal ──────────────────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setDetail("")}>
          <div className="flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:max-w-3xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{detail}</h3>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500">
                  <span>{isiDetail.length} dokumen</span>
                  <span className="text-rose-600 dark:text-rose-400">{isiDetail.filter((x) => x.st === "lewat").length} lewat</span>
                  <span className="text-orange-600 dark:text-orange-400">{isiDetail.filter((x) => x.st === "kritis").length} habis ≤ 30 hari</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => salinMendesak(isiDetail, `SERTIFIKAT PERLU PERPANJANGAN — ${detail}`)}
                  className="btn btn-success px-3 py-1.5 text-[11px]">💬 Salin</button>
                <button onClick={() => setDetail("")} className="text-xl leading-none text-slate-400 hover:text-slate-700 dark:hover:text-white">✕</button>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto p-4 sm:p-5">
              {Array.from(new Set(isiDetail.map(({ s }) => s.kelompok))).map((kel) => (
                <div key={kel}>
                  <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{kel || "Lainnya"}</p>
                  <div className="space-y-1.5">
                    {isiDetail.filter(({ s }) => s.kelompok === kel).map(({ s, st }, i) => (
                      <div key={i} className="flex items-center gap-3 overflow-hidden rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700">
                        <span className={`h-8 w-1 shrink-0 rounded-full ${STATUS_SERT[st].titik}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{s.jenis}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {s.permanen ? "Permanen" : <>berlaku s.d. {tanggalSert(s.berlaku)}</>}
                            {s.terbit && <> · terbit {tanggalSert(s.terbit)}</>}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ${STATUS_SERT[st].kelas}`}>{teksSisa(s)}</span>
                        {s.berkasUrl && (
                          <a href={s.berkasUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary shrink-0 px-2.5 py-1 text-[11px]">Buka</a>
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
