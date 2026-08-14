"use client";
/**
 * ISI PERMINTAAN KAPAL — daftar barang yang diminta ABK, sudah terbaca.
 *
 * Halaman ini TIDAK membaca apa-apa saat dibuka. Yang ditampilkan adalah hasil
 * yang sudah disimpan Juru Baca (lib/lapor/juruBaca) — jadi dari ponsel, dari
 * Vercel, atau dari laptop mana pun isinya langsung terbaca tanpa menunggu AI.
 *
 * Dari sini permintaan langsung berangkat ke SPPBJ: pilih barangnya, tekan
 * sekali, borang SPPBJ terisi. Koreksi yang diketik di layar ini ikut tersimpan
 * dan menandai bacaannya "sudah disunting", sehingga juru baca tak pernah
 * menimpanya dengan hasil AI lagi.
 *
 * Tata letaknya BERKELOMPOK PER KAPAL, bukan berderet per berkas. Satu kiriman
 * kerap tujuh lembar foto, dan yang dicari orang kantor adalah "apa saja yang
 * diminta Sagori bulan ini" — bukan "apa isi lembar keenam".
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useJuruBaca } from "@/components/lapor/PilJuruBaca";
import { BarisPermintaan, keJumlah, titipkanKeSppbj } from "@/lib/lapor/bacaPermintaan";
import { bacaSekarang, nyalakanJuruBaca, putaran } from "@/lib/lapor/juruBaca";
import { BacaanBerkas, BarisBacaan, muatBacaan, simpanBacaan } from "@/lib/lapor/simpananBacaan";
import { BerkasLapor, KirimanLapor, bulanIndo, singkatJenis } from "@/lib/lapor/types";

interface Entri {
  kiriman: KirimanLapor;
  berkas: BerkasLapor;
  id: string | null;
  bacaan: BacaanBerkas | null;
}

type Saring = "semua" | "terbaca" | "belum" | "gagal";

const kunci = (fileId: string, i: number) => `${fileId}|${i}`;

const waktuSingkat = (iso: string) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

/** nama berkas dari ABK panjang dan berulang; yang menolong cuma ekor pembedanya */
const namaPendek = (n: string) => {
  const tanpaExt = n.replace(/\.[a-z0-9]+$/i, "");
  return tanpaExt.length > 46 ? `…${tanpaExt.slice(-44)}` : tanpaExt;
};

const statusEntri = (e: Entri, sibuk: boolean) =>
  sibuk ? "proses" : (e.bacaan?.status || "belum");

export default function IsiPermintaanKapal() {
  const router = useRouter();
  const jb = useJuruBaca();
  const [kiriman, setKiriman] = useState<KirimanLapor[]>([]);
  const [peta, setPeta] = useState<Map<string, BarisBacaan>>(new Map());
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [kapal, setKapal] = useState("");
  const [periode, setPeriode] = useState("");
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState<Saring>("semua");
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [tutupKapal, setTutupKapal] = useState<Set<string>>(new Set());
  const [sibukBerkas, setSibukBerkas] = useState("");
  const [buktiGalat, setBuktiGalat] = useState(false);
  const jadwalSimpan = useRef<Map<string, number>>(new Map());

  const ambil = useCallback(async () => {
    setGalat("");
    try {
      const [r, p] = await Promise.all([fetch("/api/lapor/daftar", { cache: "no-store" }), muatBacaan()]);
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal memuat kiriman");
      setKiriman((d.baris as KirimanLapor[]).filter((k) => k.jenis.startsWith("permintaan")));
      setPeta(p);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);

  useEffect(() => { void ambil(); }, [ambil]);

  /** hasil baru dari juru baca ikut tampil tanpa perlu memuat ulang halaman */
  useEffect(() => {
    if (!jb.selesai && !jb.gagal) return;
    void muatBacaan().then(setPeta).catch(() => { /* biarkan tampilan lama */ });
  }, [jb.selesai, jb.gagal]);

  const entri: Entri[] = useMemo(() => {
    const keluar: Entri[] = [];
    [...kiriman]
      .sort((a, b) => (b.dikirimPada || "").localeCompare(a.dikirimPada || ""))
      .forEach((k) => k.berkas.forEach((b) => {
        const ada = peta.get(b.fileId);
        keluar.push({ kiriman: k, berkas: b, id: ada?.id || null, bacaan: ada?.bacaan || null });
      }));
    return keluar;
  }, [kiriman, peta]);

  const daftarKapal = useMemo(
    () => Array.from(new Set(kiriman.map((k) => k.kapal))).sort(), [kiriman]);
  const daftarPeriode = useMemo(
    () => Array.from(new Set(kiriman.map((k) => k.periode).filter(Boolean))).sort().reverse(), [kiriman]);

  const tampil = useMemo(() => entri.filter((e) => {
    if (kapal && e.kiriman.kapal !== kapal) return false;
    if (periode && e.kiriman.periode !== periode) return false;
    const st = e.bacaan?.status || "belum";
    if (saring === "terbaca" && st !== "selesai") return false;
    if (saring === "gagal" && st !== "gagal") return false;
    if (saring === "belum" && (st === "selesai" || st === "gagal")) return false;
    if (!cari.trim()) return true;
    const teks = [
      e.kiriman.kapal, e.berkas.nama, e.kiriman.pengirim,
      ...(e.bacaan?.baris || []).map((b) => `${b.nama} ${b.spesifikasi} ${b.keterangan}`),
    ].join(" ").toLowerCase();
    return cari.toLowerCase().split(/\s+/).filter(Boolean).every((k) => teks.includes(k));
  }), [entri, kapal, periode, cari, saring]);

  /** dikelompokkan per kapal, kapal dengan kiriman terbaru di atas */
  const grup = useMemo(() => {
    const m = new Map<string, Entri[]>();
    tampil.forEach((e) => m.set(e.kiriman.kapal, [...(m.get(e.kiriman.kapal) || []), e]));
    return Array.from(m.entries());
  }, [tampil]);

  const jml = useMemo(() => {
    const b = { terbaca: 0, barang: 0, belum: 0, gagal: 0 };
    entri.forEach((e) => {
      if (e.bacaan?.status === "selesai") { b.terbaca++; b.barang += e.bacaan.baris.length; }
      else if (e.bacaan?.status === "gagal") b.gagal++;
      else b.belum++;
    });
    return b;
  }, [entri]);

  /* ── sunting & simpan ──────────────────────────────────────────────────── */

  /**
   * Simpanan ditunda sedetik: mengetik satu nama barang memicu belasan
   * perubahan, dan tiap perubahan yang langsung dikirim berarti belasan tulisan
   * ke basis data untuk satu koreksi.
   */
  const simpanNanti = (fileId: string, bacaan: BacaanBerkas, id: string | null) => {
    const lama = jadwalSimpan.current.get(fileId);
    if (lama) window.clearTimeout(lama);
    jadwalSimpan.current.set(fileId, window.setTimeout(() => {
      void simpanBacaan(id, bacaan)
        .then((idBaru) => setPeta((p) => {
          const n = new Map(p); n.set(fileId, { id: idBaru, bacaan }); return n;
        }))
        .catch((e) => setGalat(e?.message || String(e)));
    }, 1000));
  };

  const ubahBaris = (e: Entri, idx: number, k: keyof BarisPermintaan, v: string) => {
    if (!e.bacaan) return;
    const baris = e.bacaan.baris.map((b, i) => (i === idx ? { ...b, [k]: v } : b));
    const bacaan: BacaanBerkas = { ...e.bacaan, baris, disunting: true, waktu: new Date().toISOString() };
    setPeta((p) => { const n = new Map(p); n.set(e.berkas.fileId, { id: e.id || "", bacaan }); return n; });
    simpanNanti(e.berkas.fileId, bacaan, e.id);
  };

  const hapusBaris = (e: Entri, idx: number) => {
    if (!e.bacaan) return;
    const baris = e.bacaan.baris.filter((_, i) => i !== idx);
    const bacaan: BacaanBerkas = { ...e.bacaan, baris, disunting: true, waktu: new Date().toISOString() };
    setPeta((p) => { const n = new Map(p); n.set(e.berkas.fileId, { id: e.id || "", bacaan }); return n; });
    simpanNanti(e.berkas.fileId, bacaan, e.id);
    setPilih((s) => { const n = new Set(s); n.delete(kunci(e.berkas.fileId, idx)); return n; });
  };

  const tambahBaris = (e: Entri) => {
    if (!e.bacaan) return;
    const baris = [...e.bacaan.baris, { nama: "", spesifikasi: "", jumlah: "1", satuan: "pcs", keterangan: "" }];
    const bacaan: BacaanBerkas = { ...e.bacaan, baris, disunting: true, waktu: new Date().toISOString() };
    setPeta((p) => { const n = new Map(p); n.set(e.berkas.fileId, { id: e.id || "", bacaan }); return n; });
    simpanNanti(e.berkas.fileId, bacaan, e.id);
  };

  /* ── pilihan & keberangkatan ke SPPBJ ──────────────────────────────────── */

  const alih = (fileId: string, i: number) =>
    setPilih((s) => {
      const n = new Set(s); const k = kunci(fileId, i);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });

  const alihBanyak = (daftar: Entri[]) => {
    const semua = daftar.flatMap((e) => (e.bacaan?.baris || []).map((_, i) => kunci(e.berkas.fileId, i)));
    if (!semua.length) return;
    const penuh = semua.every((k) => pilih.has(k));
    setPilih((s) => {
      const n = new Set(s);
      semua.forEach((k) => (penuh ? n.delete(k) : n.add(k)));
      return n;
    });
  };

  const terpilih = useMemo(() => {
    const keluar: { kapal: string; baris: BarisPermintaan }[] = [];
    entri.forEach((e) => (e.bacaan?.baris || []).forEach((b, i) => {
      if (pilih.has(kunci(e.berkas.fileId, i))) keluar.push({ kapal: e.kiriman.kapal, baris: b });
    }));
    return keluar;
  }, [entri, pilih]);

  const kapalTerpilih = Array.from(new Set(terpilih.map((x) => x.kapal)));

  const keSppbj = () => {
    if (kapalTerpilih.length !== 1) return;
    const n = titipkanKeSppbj(kapalTerpilih[0], terpilih.map((x) => x.baris), `Permintaan kapal — ${kapalTerpilih[0]}`);
    if (n) router.push("/sppbj/isi?dari=permintaan");
  };

  const salin = () => navigator.clipboard?.writeText(
    terpilih.map((x, i) => `${i + 1}. ${x.baris.nama}${x.baris.spesifikasi ? ` (${x.baris.spesifikasi})` : ""} — ${keJumlah(x.baris.jumlah)} ${x.baris.satuan || "pcs"}`).join("\n"));

  const bacaUlang = async (e: Entri) => {
    setSibukBerkas(e.berkas.fileId); setGalat("");
    try {
      await bacaSekarang(e.berkas.fileId, e.berkas.nama, {
        id: e.kiriman.id, kapal: e.kiriman.kapal, jenis: e.kiriman.jenis, periode: e.kiriman.periode,
      });
      setPeta(await muatBacaan());
    } catch (err: any) { setGalat(err?.message || String(err)); }
    finally { setSibukBerkas(""); }
  };

  const saringanAktif = !!(kapal || periode || cari || saring !== "semua");

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      {/* ── kepala halaman ──────────────────────────────────────────────── */}
      <header className="asdp-gradient mb-5 rounded-[1.75rem] p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow flex flex-wrap items-center gap-4 rounded-[calc(1.75rem-1.5px)] px-5 py-5 sm:px-6">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-sky-800 text-2xl text-white shadow-lg shadow-teal-900/20">🧾</div>
          <div className="min-w-[16rem] flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-emerald-800 ring-1 ring-emerald-200">Hasil Bacaan Tersimpan</span>
              {jb.siap
                ? <span className="chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">● AI lokal siap</span>
                : <span className="chip bg-slate-100 text-slate-500 ring-1 ring-slate-200">○ perangkat ini tak membaca</span>}
              {jb.jalan && jb.sedang && <span className="text-[10px] font-medium text-sky-600">membaca {jb.antre} berkas lagi…</span>}
            </div>
            <h1 className="asdp-text-gradient text-2xl font-extrabold leading-tight">Isi Permintaan Kapal</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Barang yang diminta ABK, sudah dibaca dan tersimpan — pilih, lalu berangkatkan ke SPPBJ.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/permintaan-laporan" className="btn btn-ghost text-xs">← Kiriman &amp; berkas</Link>
            {jb.siap && (
              <button onClick={() => { void putaran(); }} disabled={jb.jalan} className="btn btn-ghost text-xs disabled:opacity-50">
                {jb.jalan ? "Juru Baca bekerja…" : "🤖 Periksa berkas baru"}
              </button>
            )}
            <button onClick={() => { void ambil(); }} disabled={muat} className="btn btn-primary text-xs disabled:opacity-50">
              {muat ? "Memuat…" : "⟳ Muat ulang"}
            </button>
          </div>
        </div>
      </header>

      {/* ── keadaan mesin baca ──────────────────────────────────────────── */}
      {jb.siap ? (
        <section className="anim-in mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500 text-lg text-white ${jb.jalan ? "animate-pulse" : ""}`}>🤖</span>
          <div className="min-w-[14rem] flex-1">
            <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
              Juru Baca menyala — {jb.mesin} (lewat {jb.jalur})
            </p>
            <p className="truncate text-[11px] text-emerald-700 dark:text-emerald-400">
              {jb.jalan && jb.sedang
                ? `${namaPendek(jb.sedang)} · ${jb.tahap || "membaca…"}`
                : "Berkas baru dari ABK dibaca sendiri di latar belakang, satu per satu."}
            </p>
          </div>
          <button onClick={() => nyalakanJuruBaca(!jb.aktif)}
            className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-extrabold text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-300">
            {jb.aktif ? "Jeda" : "Lanjutkan"}
          </button>
        </section>
      ) : (
        <section className="anim-in mb-4 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/25">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400 text-lg text-white">👁</span>
            <div className="min-w-[14rem] flex-1">
              <p className="text-xs font-extrabold text-amber-900 dark:text-amber-200">Mode lihat — perangkat ini tidak membaca berkas</p>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                Hasil yang sudah dibaca laptop ber-Ollama tetap tampil lengkap di bawah.
              </p>
            </div>
            <button onClick={() => setBuktiGalat((v) => !v)}
              className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-extrabold text-amber-800 ring-1 ring-amber-300 hover:bg-amber-50 dark:bg-slate-900 dark:text-amber-300">
              {buktiGalat ? "Tutup" : "Kenapa?"}
            </button>
          </div>
          {buktiGalat && (
            <div className="mt-3 rounded-xl bg-white/70 px-3 py-2.5 text-[11px] leading-relaxed text-amber-900 ring-1 ring-amber-200 dark:bg-slate-900/60 dark:text-amber-200">
              <p>
                Peramban melarang halaman <b>https</b> memanggil alamat <b>http</b>, dan Ollama melayani http di laptop.
                Jadi AI lokal hanya bisa dipakai bila aplikasi dibuka lewat <b>http://localhost:3001</b> di laptop itu —
                pintasannya <code>buka-aplikasi.vbs</code>.
              </p>
              {jb.galat && <p className="mt-1.5 text-amber-700/80">Pesan mesin: {jb.galat}</p>}
            </div>
          )}
        </section>
      )}

      {galat && <p className="anim-in mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{galat}</p>}

      {/* ── angka ringkas ───────────────────────────────────────────────── */}
      <section className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi ikon="📄" label="Berkas terbaca" nilai={jml.terbaca} ket={`dari ${entri.length} berkas`} warna="emerald" />
        <Kpi ikon="📦" label="Barang terbaca" nilai={jml.barang} ket="siap jadi SPPBJ" warna="sky" />
        <Kpi ikon="⏳" label="Belum terbaca" nilai={jml.belum} ket={jb.siap ? "sedang diantre" : "menunggu laptop ber-AI"} warna="amber" />
        <Kpi ikon="⚠" label="Gagal dibaca" nilai={jml.gagal} ket="perlu dibaca ulang / diketik" warna="rose" />
      </section>

      {/* ── saringan ────────────────────────────────────────────────────── */}
      <section className="mb-4 rounded-2xl bg-white px-3 py-3 elev-sm ring-line dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800">
            {([["semua", "Semua"], ["terbaca", "Terbaca"], ["belum", "Belum"], ["gagal", "Gagal"]] as const).map(([id, l]) => (
              <button key={id} onClick={() => setSaring(id)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition ${
                  saring === id ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-700"}`}>
                {l}
              </button>
            ))}
          </div>
          <select value={kapal} onChange={(e) => setKapal(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900">
            <option value="">Semua kapal</option>
            {daftarKapal.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={periode} onChange={(e) => setPeriode(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900">
            <option value="">Semua periode</option>
            {daftarPeriode.map((p) => <option key={p} value={p}>{bulanIndo(p)}</option>)}
          </select>
          <div className="relative ml-auto min-w-[15rem] flex-1 sm:flex-none">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari barang, kapal, atau berkas…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900" />
          </div>
          {saringanAktif && (
            <button onClick={() => { setKapal(""); setPeriode(""); setCari(""); setSaring("semua"); }}
              className="text-[11px] font-bold text-slate-500 hover:underline">Reset</button>
          )}
        </div>
      </section>

      {/* ── daftar per kapal ────────────────────────────────────────────── */}
      <section className="space-y-4 pb-28">
        {muat && [0, 1].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-3xl bg-white/70 ring-line dark:bg-slate-900/70" />
        ))}
        {!muat && !grup.length && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-4 py-14 text-center dark:bg-slate-900/60">
            <p className="text-3xl">🗂️</p>
            <p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-300">Tidak ada yang cocok</p>
            <p className="text-xs text-slate-400">
              {saringanAktif ? "Longgarkan saringannya." : "Kiriman permintaan dari ABK akan muncul di sini setelah terbaca."}
            </p>
          </div>
        )}

        {grup.map(([namaKapal, daftar]) => {
          const barang = daftar.reduce((n, e) => n + (e.bacaan?.baris.length || 0), 0);
          const belum = daftar.filter((e) => (e.bacaan?.status || "belum") === "belum").length;
          const tertutup = tutupKapal.has(namaKapal);
          const kunciSemua = daftar.flatMap((e) => (e.bacaan?.baris || []).map((_, i) => kunci(e.berkas.fileId, i)));
          const semuaTerpilih = !!kunciSemua.length && kunciSemua.every((k) => pilih.has(k));

          return (
            <article key={namaKapal} className="anim-in overflow-hidden rounded-3xl bg-white elev-md ring-line dark:bg-slate-900">
              <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-sky-50/60 px-4 py-3 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/25">
                <button onClick={() => setTutupKapal((s) => {
                  const n = new Set(s); if (n.has(namaKapal)) n.delete(namaKapal); else n.add(namaKapal); return n;
                })}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#16357f] text-sm text-white shadow-sm">
                  {tertutup ? "▸" : "▾"}
                </button>
                <div className="min-w-[12rem] flex-1">
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{namaKapal}</h2>
                  <p className="text-[11px] text-slate-500">
                    {daftar.length} berkas · <b className="text-slate-700 dark:text-slate-300">{barang} barang</b> terbaca
                    {belum > 0 && <span className="text-amber-600"> · {belum} belum terbaca</span>}
                  </p>
                </div>
                {!!kunciSemua.length && (
                  <button onClick={() => alihBanyak(daftar)}
                    className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                    {semuaTerpilih ? "Batal pilih semua" : `Pilih ${barang} barang`}
                  </button>
                )}
              </header>

              {!tertutup && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {daftar.map((e) => (
                    <BlokBerkas key={e.berkas.fileId} e={e} pilih={pilih} alih={alih} alihBanyak={alihBanyak}
                      ubahBaris={ubahBaris} hapusBaris={hapusBaris} tambahBaris={tambahBaris}
                      bacaUlang={bacaUlang} bisaBaca={jb.siap} sibuk={sibukBerkas === e.berkas.fileId} />
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </section>

      {/* ── bilah pilihan ───────────────────────────────────────────────── */}
      {terpilih.length > 0 && (
        <div className="anim-in fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_28px_rgba(15,23,42,0.10)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-sky-700 text-sm font-extrabold text-white">
              {terpilih.length}
            </span>
            <div className="min-w-[12rem] flex-1">
              <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                {terpilih.length} barang terpilih
              </p>
              <p className="text-[11px] text-slate-500">
                {kapalTerpilih.length === 1
                  ? kapalTerpilih[0]
                  : <span className="text-rose-600">Terpilih dari {kapalTerpilih.length} kapal — satu SPPBJ hanya untuk satu kapal.</span>}
              </p>
            </div>
            <button onClick={() => setPilih(new Set())} className="btn btn-ghost text-xs">Bersihkan</button>
            <button onClick={salin} className="btn btn-ghost text-xs">⧉ Salin daftar</button>
            <button onClick={keSppbj} disabled={kapalTerpilih.length !== 1} className="btn btn-primary text-xs disabled:opacity-40">
              ➜ Buat SPPBJ
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/* ── kartu angka ────────────────────────────────────────────────────────── */
const WARNA_KPI: Record<string, string> = {
  emerald: "from-emerald-400 to-emerald-600",
  sky: "from-sky-400 to-blue-700",
  amber: "from-amber-400 to-orange-500",
  rose: "from-rose-400 to-rose-600",
};

function Kpi({ ikon, label, nilai, ket, warna }: { ikon: string; label: string; nilai: number; ket: string; warna: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 elev-sm ring-line dark:bg-slate-900">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${WARNA_KPI[warna]} text-base text-white shadow-sm`}>{ikon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-xl font-extrabold leading-tight tabular-nums text-slate-800 dark:text-slate-100">{nilai}</p>
        <p className="truncate text-[10px] text-slate-400">{ket}</p>
      </div>
    </div>
  );
}

/* ── satu berkas + isinya ───────────────────────────────────────────────── */
function BlokBerkas({ e, pilih, alih, alihBanyak, ubahBaris, hapusBaris, tambahBaris, bacaUlang, bisaBaca, sibuk }: {
  e: Entri;
  pilih: Set<string>;
  alih: (fileId: string, i: number) => void;
  alihBanyak: (daftar: Entri[]) => void;
  ubahBaris: (e: Entri, i: number, k: keyof BarisPermintaan, v: string) => void;
  hapusBaris: (e: Entri, i: number) => void;
  tambahBaris: (e: Entri) => void;
  bacaUlang: (e: Entri) => void;
  bisaBaca: boolean;
  sibuk: boolean;
}) {
  const b = e.bacaan;
  const status = statusEntri(e, sibuk);
  const lencana =
    status === "selesai" ? { t: `${b!.baris.length} barang`, k: "bg-emerald-100 text-emerald-800 ring-emerald-200" }
      : status === "proses" ? { t: "sedang dibaca…", k: "bg-sky-100 text-sky-800 ring-sky-200" }
        : status === "gagal" ? { t: "gagal dibaca", k: "bg-rose-100 text-rose-700 ring-rose-200" }
          : { t: "belum dibaca", k: "bg-slate-100 text-slate-600 ring-slate-200" };
  const kosong = status !== "selesai";

  return (
    <div className={kosong ? "bg-slate-50/60 dark:bg-slate-900/40" : ""}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-1 ${lencana.k}`}>{lencana.t}</span>
        <div className="min-w-[12rem] flex-1">
          <p className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">{namaPendek(e.berkas.nama)}</p>
          <p className="truncate text-[10px] text-slate-400">
            {singkatJenis(e.kiriman.jenis)} · {bulanIndo(e.kiriman.periode)} · dikirim {waktuSingkat(e.kiriman.dikirimPada)}
            {b?.mesin && <> · {b.mesin}</>}
            {b?.disunting && <> · <span className="font-bold text-amber-600">dikoreksi manual</span></>}
          </p>
        </div>
        <a href={e.berkas.url} target="_blank" rel="noreferrer"
          className="rounded-lg px-2 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 dark:ring-slate-700">
          Lihat foto
        </a>
        {bisaBaca && (
          <button onClick={() => bacaUlang(e)} disabled={sibuk}
            className="rounded-lg px-2 py-1 text-[10px] font-bold text-sky-700 ring-1 ring-sky-200 hover:bg-sky-50 disabled:opacity-40 dark:text-sky-300 dark:ring-sky-800">
            {sibuk ? "Membaca…" : b ? "Baca ulang" : "Baca sekarang"}
          </button>
        )}
      </div>

      {b?.galat && <p className="px-4 pb-2 text-[10px] text-amber-700 dark:text-amber-400">⚠ {b.galat}</p>}

      {!!b?.baris.length && (
        <div className="overflow-x-auto px-2 pb-3">
          <table className="w-full min-w-[42rem] text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                <th className="w-9 px-2 py-1.5">
                  <input type="checkbox" className="accent-sky-600"
                    checked={b.baris.every((_, i) => pilih.has(kunci(e.berkas.fileId, i)))}
                    onChange={() => alihBanyak([e])} />
                </th>
                <th className="px-2 py-1.5 text-left font-extrabold">Nama barang</th>
                <th className="w-40 px-2 py-1.5 text-left font-extrabold">Spesifikasi</th>
                <th className="w-16 px-2 py-1.5 text-center font-extrabold">Jml</th>
                <th className="w-20 px-2 py-1.5 text-left font-extrabold">Satuan</th>
                <th className="w-40 px-2 py-1.5 text-left font-extrabold">Keterangan</th>
                <th className="w-8 px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {b.baris.map((r, i) => {
                const dipilih = pilih.has(kunci(e.berkas.fileId, i));
                return (
                  <tr key={i} className={`row-hover rounded-lg ${dipilih ? "bg-sky-50/70 dark:bg-sky-950/30" : i % 2 ? "bg-slate-50/50 dark:bg-slate-800/30" : ""}`}>
                    <td className="px-2 py-1 text-center">
                      <input type="checkbox" className="accent-sky-600" checked={dipilih}
                        onChange={() => alih(e.berkas.fileId, i)} />
                    </td>
                    {(["nama", "spesifikasi", "jumlah", "satuan", "keterangan"] as const).map((k) => (
                      <td key={k} className="px-1 py-1">
                        <input value={r[k] || ""} placeholder="—"
                          onChange={(ev) => ubahBaris(e, i, k, ev.target.value)}
                          className={`w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 outline-none placeholder:text-slate-300 hover:border-slate-200 focus:border-sky-400 focus:bg-white dark:hover:border-slate-700 dark:focus:bg-slate-950 ${
                            k === "nama" ? "font-semibold text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"} ${
                            k === "jumlah" ? "text-center tabular-nums" : ""}`} />
                      </td>
                    ))}
                    <td className="px-1 py-1 text-center">
                      <button onClick={() => hapusBaris(e, i)} title="Hapus baris"
                        className="rounded px-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button onClick={() => tambahBaris(e)}
            className="mt-1 px-2 text-[10px] font-bold text-slate-400 hover:text-sky-600">
            + Tambah baris yang terlewat
          </button>
        </div>
      )}
    </div>
  );
}
