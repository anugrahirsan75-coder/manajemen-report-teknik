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
import { Ikon } from "@/components/ikon";
import { useJuruBaca } from "@/components/lapor/PilJuruBaca";
import { BarisPermintaan, keJumlah, titipkanKeSppbj } from "@/lib/lapor/bacaPermintaan";
import { bacaSekarang, nyalakanJuruBaca, putaran } from "@/lib/lapor/juruBaca";
import {
  BacaanBerkas, BarisBacaan, StatusJuruBaca, denyutSegar, muatBacaan, muatStatusJuruBaca, simpanBacaan,
} from "@/lib/lapor/simpananBacaan";
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

/** "2 menit lalu" — umur denyut laptop, dipakai untuk menilai ia hidup atau tidak */
const umurDenyut = (s: { waktu?: string } | null): string => {
  if (!s?.waktu) return "belum pernah";
  const menit = Math.max(0, Math.round((Date.now() - new Date(s.waktu).getTime()) / 60000));
  return menit < 1 ? "barusan" : menit < 60 ? `${menit} menit lalu`
    : `${Math.round(menit / 60)} jam lalu`;
};

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
  /** berkas yang sedang dibuka di panel kanan */
  const [berkasAktif, setBerkasAktif] = useState("");
  /** foto scan ditampilkan berdampingan dengan tabelnya */
  const [lihatFoto, setLihatFoto] = useState(true);
  const [denyut, setDenyut] = useState<StatusJuruBaca | null>(null);
  const jadwalSimpan = useRef<Map<string, number>>(new Map());

  const ambil = useCallback(async () => {
    setGalat("");
    try {
      const [r, p, s] = await Promise.all([
        fetch("/api/lapor/daftar", { cache: "no-store" }), muatBacaan(), muatStatusJuruBaca().catch(() => null),
      ]);
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal memuat kiriman");
      setKiriman((d.baris as KirimanLapor[]).filter((k) => k.jenis.startsWith("permintaan")));
      setPeta(p); setDenyut(s);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);

  useEffect(() => { void ambil(); }, [ambil]);

  /**
   * Selama masih ada yang belum terbaca, layar menyegarkan dirinya tiap 20
   * detik. Tanpa itu orang harus menekan Muat ulang berkali-kali untuk melihat
   * apakah laptop di kantor sudah sampai ke berkasnya — dan menekan tombol
   * untuk menunggu sesuatu yang memang butuh menit adalah kerja sia-sia.
   */
  useEffect(() => {
    const t = window.setInterval(() => {
      void muatStatusJuruBaca().then(setDenyut).catch(() => { /* jaringan sesaat */ });
      void muatBacaan().then(setPeta).catch(() => { /* biarkan tampilan lama */ });
    }, 20_000);
    return () => window.clearInterval(t);
  }, []);

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
  /** laptop kantor berdenyut = ada yang membaca, walau layar ini tak bisa */
  const hidup = denyutSegar(denyut);

  /*
   * Berkas yang dibuka mengikuti daftar yang sedang tampil. Kalau saringan
   * berubah dan berkas yang dibuka ikut tersaring keluar, panel kanan pindah
   * ke berkas pertama — bukan menjadi kosong tanpa sebab yang terlihat.
   */
  const entriAktif = useMemo(
    () => tampil.find((e) => e.berkas.fileId === berkasAktif) || tampil[0] || null,
    [tampil, berkasAktif]);
  useEffect(() => {
    if (entriAktif && entriAktif.berkas.fileId !== berkasAktif) setBerkasAktif(entriAktif.berkas.fileId);
  }, [entriAktif, berkasAktif]);

  return (
    /*
     * Latar rata: halaman ini penuh angka dan nama barang, dan foto pelabuhan
     * yang menembus di belakang kartu membuat mata bekerja dua kali.
     */
    <div className="min-h-screen bg-[#f4f5f7] dark:bg-slate-950">
      <main className="mx-auto max-w-[104rem] px-4 py-5">
        {/* ── kepala ────────────────────────────────────────────────────── */}
        <header className="mb-4 rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-4 px-4 py-3.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#16357f] text-white">
              <Ikon nama="kotakMasuk" className="h-5 w-5" />
            </div>
            <div className="min-w-[18rem] flex-1">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Isi Permintaan Kapal</h1>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Barang yang diminta ABK, sudah dibaca dan tersimpan — cocokkan dengan fotonya, pilih, lalu berangkatkan ke SPPBJ.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/permintaan-laporan"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                ← Kiriman &amp; berkas
              </Link>
              {jb.siap && (
                <button onClick={() => { void putaran(); }} disabled={jb.jalan}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                  {jb.jalan ? "Juru Baca bekerja…" : "Periksa berkas baru"}
                </button>
              )}
              <button onClick={() => { void ambil(); }} disabled={muat}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#16357f] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#12296a] disabled:opacity-50">
                <Ikon nama="segarkan" className={`h-3.5 w-3.5 ${muat ? "animate-spin" : ""}`} /> {muat ? "Memuat" : "Muat ulang"}
              </button>
            </div>
          </div>

          {/* satu baris keadaan: siapa yang membaca + empat angka pokok */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11.5px] dark:border-slate-700 dark:bg-slate-800/50">
            <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
              <span className={`h-1.5 w-1.5 rounded-full ${
                jb.siap ? "bg-emerald-500" : hidup ? "animate-pulse bg-sky-500" : "bg-slate-400"}`} />
              {jb.siap
                ? `Juru Baca menyala — ${jb.mesin}`
                : hidup
                  ? `Laptop kantor sedang membaca${denyut?.mesin ? ` — ${denyut.mesin}` : ""}`
                  : "Tidak ada yang membaca saat ini"}
            </span>
            <span className="text-slate-500">
              {(jb.jalan && jb.sedang) || (denyut?.jalan && denyut.sedang)
                ? `${namaPendek(jb.sedang || denyut?.sedang || "")} · ${jb.tahap || denyut?.tahap || "membaca…"}`
                : (jb.antre || denyut?.antre)
                  ? `${jb.antre || denyut?.antre} berkas di antrean`
                  : "Antrean kosong"}
            </span>
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
              <span><b className="text-slate-900 dark:text-white">{jml.terbaca}</b>/{entri.length} berkas terbaca</span>
              <span><b className="text-slate-900 dark:text-white">{jml.barang}</b> barang siap</span>
              {jml.belum > 0 && <span className="text-amber-700 dark:text-amber-400">{jml.belum} belum terbaca</span>}
              {jml.gagal > 0 && <span className="font-semibold text-rose-700 dark:text-rose-400">{jml.gagal} gagal dibaca</span>}
            </span>
            {jb.siap ? (
              <button onClick={() => nyalakanJuruBaca(!jb.aktif)}
                className="ml-auto rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                {jb.aktif ? "Jeda" : "Lanjutkan"}
              </button>
            ) : !hidup ? (
              <button onClick={() => setBuktiGalat((v) => !v)}
                className="ml-auto rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                {buktiGalat ? "Tutup" : "Kenapa?"}
              </button>
            ) : null}
          </div>

          {buktiGalat && !hidup && !jb.siap && (
            <div className="border-t border-slate-200 px-4 py-3 text-[11.5px] leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <p>
                AI lokal (Ollama) hidup di laptop kantor dan melayani alamat <b>http</b>. Peramban melarang halaman
                <b> https</b> seperti Vercel memanggil alamat http, jadi pembacaan tidak mungkin terjadi dari layar ini —
                siapa pun yang membukanya.
              </p>
              <p className="mt-1.5">
                Yang membaca adalah <b>server aplikasi di laptop itu sendiri</b> (port 3001, dijaga watchdog). Kalau
                laptopnya mati, nyalakan lalu jalankan <code>buka-aplikasi.vbs</code> sekali.
                {denyut && <> Denyut terakhir {umurDenyut(denyut)}.</>}
              </p>
              {jb.galat && <p className="mt-1.5 text-slate-500">Pesan mesin di perangkat ini: {jb.galat}</p>}
            </div>
          )}
        </header>

        {galat && (
          <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {galat}
          </p>
        )}

        {/* ── dua panel: daftar berkas | isi berkas ─────────────────────── */}
        <div className="grid gap-4 pb-24 lg:grid-cols-[21rem_1fr]">
          {/* ── kiri: daftar berkas ───────────────────────────────────── */}
          <aside className="rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-200 p-3 dark:border-slate-700">
              <div className="relative">
                <Ikon nama="kaca" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari barang, kapal, atau berkas…"
                  className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-2.5 text-[12.5px] outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900" />
              </div>
              <div className="mt-2 flex rounded-md border border-slate-200 p-0.5 dark:border-slate-700">
                {([["semua", "Semua"], ["terbaca", "Terbaca"], ["belum", "Belum"], ["gagal", "Gagal"]] as const).map(([id, l]) => (
                  <button key={id} onClick={() => setSaring(id)}
                    className={`flex-1 rounded px-2 py-1 text-[11px] font-semibold transition ${
                      saring === id ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select value={kapal} onChange={(e) => setKapal(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11.5px] dark:border-slate-600 dark:bg-slate-900">
                  <option value="">Semua kapal</option>
                  {daftarKapal.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <select value={periode} onChange={(e) => setPeriode(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11.5px] dark:border-slate-600 dark:bg-slate-900">
                  <option value="">Semua periode</option>
                  {daftarPeriode.map((p) => <option key={p} value={p}>{bulanIndo(p)}</option>)}
                </select>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>{tampil.length} berkas ditampilkan</span>
                {saringanAktif && (
                  <button onClick={() => { setKapal(""); setPeriode(""); setCari(""); setSaring("semua"); }}
                    className="font-semibold text-slate-600 underline-offset-2 hover:underline">Reset saringan</button>
                )}
              </div>
            </div>

            <div className="max-h-[calc(100vh-19rem)] overflow-y-auto">
              {muat && [0, 1, 2].map((i) => (
                <div key={i} className="m-3 h-12 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              ))}
              {!muat && !grup.length && (
                <p className="px-4 py-10 text-center text-[12px] text-slate-500">
                  {saringanAktif ? "Tidak ada berkas yang cocok — longgarkan saringannya." : "Belum ada kiriman permintaan dari ABK."}
                </p>
              )}
              {grup.map(([namaKapal, daftar]) => {
                const barang = daftar.reduce((n, e) => n + (e.bacaan?.baris.length || 0), 0);
                const kunciSemua = daftar.flatMap((e) => (e.bacaan?.baris || []).map((_, i) => kunci(e.berkas.fileId, i)));
                const semuaTerpilih = !!kunciSemua.length && kunciSemua.every((k) => pilih.has(k));
                return (
                  <div key={namaKapal}>
                    <div className="sticky top-0 z-10 flex items-center gap-2 border-y border-slate-200 bg-gradient-to-r from-[#16357f]/[0.10] via-[#14b8c4]/[0.07] to-transparent px-3 py-1.5 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800">
                      <span className="flex-1 truncate text-[11px] font-bold uppercase tracking-[0.1em] text-[#16357f] dark:text-slate-200">
                        {namaKapal}
                      </span>
                      <span className="text-[10.5px] tabular-nums text-slate-500">{daftar.length} berkas · {barang} barang</span>
                      {!!kunciSemua.length && (
                        <button onClick={() => alihBanyak(daftar)}
                          className="rounded border border-slate-300 bg-white px-1.5 text-[10.5px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                          {semuaTerpilih ? "Batal" : "Pilih"}
                        </button>
                      )}
                    </div>
                    {daftar.map((e) => {
                      const st = statusEntri(e, sibukBerkas === e.berkas.fileId);
                      const aktif = entriAktif?.berkas.fileId === e.berkas.fileId;
                      const jumlah = e.bacaan?.baris.length || 0;
                      const terpilihDiBerkas = (e.bacaan?.baris || [])
                        .filter((_, i) => pilih.has(kunci(e.berkas.fileId, i))).length;
                      const nada = nadaJenis(e.kiriman.jenis);
                      return (
                        <button key={e.berkas.fileId} onClick={() => setBerkasAktif(e.berkas.fileId)}
                          className={`relative flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left transition dark:border-slate-800 ${
                            aktif
                              ? "bg-gradient-to-r from-[#16357f]/[0.10] to-transparent"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}>
                          {aktif && <span className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-[#7cc242] via-[#14b8c4] to-[#1ca3dd]" />}
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            st === "selesai" ? nada.titik : st === "proses" ? "animate-pulse bg-sky-500"
                              : st === "gagal" ? "bg-rose-500" : "bg-slate-300"}`} />
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-[12px] ${aktif ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-700 dark:text-slate-200"}`}>
                              {namaPendek(e.berkas.nama)}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-slate-500">
                              <span className={`shrink-0 rounded border px-1 py-px text-[9.5px] font-bold tracking-wide ${nada.pil}`}>
                                {nada.singkat}
                              </span>
                              <span className="truncate">{bulanIndo(e.kiriman.periode)} · {waktuSingkat(e.kiriman.dikirimPada)}</span>
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className={`block text-[11px] font-semibold tabular-nums ${jumlah ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}`}>
                              {jumlah || "—"}
                            </span>
                            {terpilihDiBerkas > 0 && (
                              <span className="block text-[10px] font-bold text-[#16357f] dark:text-sky-400">{terpilihDiBerkas} dipilih</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* ── kanan: isi berkas terpilih ────────────────────────────── */}
          <section className="rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
            {!entriAktif ? (
              <p className="px-4 py-20 text-center text-[12.5px] text-slate-500">
                Pilih satu berkas di panel kiri untuk melihat isinya.
              </p>
            ) : (
              <IsiBerkas
                e={entriAktif}
                pilih={pilih}
                lihatFoto={lihatFoto}
                setLihatFoto={setLihatFoto}
                alih={alih}
                alihBanyak={alihBanyak}
                ubahBaris={ubahBaris}
                hapusBaris={hapusBaris}
                tambahBaris={tambahBaris}
                bacaUlang={bacaUlang}
                bisaBaca={jb.siap}
                sibuk={sibukBerkas === entriAktif.berkas.fileId}
              />
            )}
          </section>
        </div>

        {/* ── bilah pilihan ─────────────────────────────────────────────── */}
        {terpilih.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-300 bg-white/97 px-4 py-2.5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/97">
            <div className="mx-auto flex max-w-[104rem] flex-wrap items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#16357f] text-[13px] font-bold text-white tabular-nums">
                {terpilih.length}
              </span>
              <div className="min-w-[12rem] flex-1">
                <p className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100">{terpilih.length} barang terpilih</p>
                <p className="text-[11px] text-slate-500">
                  {kapalTerpilih.length === 1
                    ? kapalTerpilih[0]
                    : <span className="font-semibold text-rose-600">Terpilih dari {kapalTerpilih.length} kapal — satu SPPBJ hanya untuk satu kapal.</span>}
                </p>
              </div>
              <button onClick={() => setPilih(new Set())}
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
                Bersihkan
              </button>
              <button onClick={salin}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
                <Ikon nama="salin" className="h-3.5 w-3.5" /> Salin daftar
              </button>
              <button onClick={keSppbj} disabled={kapalTerpilih.length !== 1}
                className="rounded-md bg-[#16357f] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#12296a] disabled:opacity-40">
                Buat SPPBJ →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ── isi satu berkas: keterangan, foto scan, dan tabel barangnya ────────── */
/**
 * Warna per jenis permintaan.
 *
 * Deck dan mesin diproses dua orang berbeda dan berujung ke dua SPPBJ yang
 * berbeda pula; memberi keduanya warna sendiri membuat salah ambil berkas
 * ketahuan sebelum barangnya terpilih.
 */
function nadaJenis(jenis: string) {
  const j = (jenis || "").toLowerCase();
  if (j.includes("mesin")) {
    return {
      // satu kata saja: di daftar berkas, "PERMINTAAN MESIN" memakan satu baris
      // sendiri dan mengurangi jumlah berkas yang terlihat sekaligus
      singkat: "MESIN", titik: "bg-[#F2784B]",
      pil: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
    };
  }
  if (j.includes("deck")) {
    return {
      singkat: "DECK", titik: "bg-[#1A7B7E]",
      pil: "border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
    };
  }
  if (j.includes("laporan")) {
    return {
      singkat: "LAPORAN", titik: "bg-[#8B6DB5]",
      pil: "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
    };
  }
  return {
    singkat: "LAIN", titik: "bg-slate-400",
    pil: "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
}

function IsiBerkas({ e, pilih, lihatFoto, setLihatFoto, alih, alihBanyak, ubahBaris, hapusBaris, tambahBaris, bacaUlang, bisaBaca, sibuk }: {
  e: Entri;
  pilih: Set<string>;
  lihatFoto: boolean;
  setLihatFoto: (v: boolean) => void;
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
    status === "selesai" ? { t: `${b!.baris.length} barang terbaca`, k: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" }
      : status === "proses" ? { t: "sedang dibaca…", k: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300" }
        : status === "gagal" ? { t: "gagal dibaca", k: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300" }
          : { t: "belum dibaca", k: "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300" };

  /*
   * Fotonya diambil lewat server aplikasi, bukan disematkan dari Drive.
   *
   * Berkas kiriman ABK tinggal di Drive yang tidak dibagikan: menyematkan
   * tautan Drive hanya berhasil bila yang membuka kebetulan sedang login ke
   * akun pemiliknya — di layar kantor hasilnya kotak kosong. Route
   * /api/lapor/isi mengambilkan berkasnya lewat Apps Script dan menyajikannya
   * dari alamat kita sendiri, jadi selalu tampil bagi siapa pun yang sudah
   * masuk ke aplikasi.
   */
  const alamatSemat = `/api/lapor/isi?fileId=${encodeURIComponent(e.berkas.fileId)}`;

  /*
   * Berkasnya diambil lebih dulu, bukan langsung dipasang sebagai src.
   *
   * Route /api/lapor/isi menjawab JSON ketika gagal — Apps Script versi lama,
   * berkas terhapus, jaringan putus. Kalau alamat itu dipasang langsung ke
   * bingkai, JSON galat itulah yang tergambar sebagai teks mentah di tempat
   * fotonya. Dengan mengambilnya sendiri, kegagalan bisa dijelaskan dengan
   * kalimat dan diberi jalan keluar.
   */
  const [foto, setFoto] = useState<{ url: string; mime: string } | null>(null);
  const [fotoGalat, setFotoGalat] = useState("");
  const [fotoMuat, setFotoMuat] = useState(false);
  /** dinaikkan untuk memaksa pengambilan ulang tanpa berpindah berkas */
  const [ulang, setUlang] = useState(0);

  useEffect(() => {
    if (!lihatFoto) return;
    let batal = false;
    let objek = "";
    setFoto(null); setFotoGalat(""); setFotoMuat(true);

    /*
     * Apps Script sesekali menjawab halaman HTML alih-alih JSON ketika sedang
     * sibuk melayani unggahan ABK. Kegagalan seperti itu hilang sendiri pada
     * percobaan berikutnya, jadi sekali diulang dulu sebelum menyerah —
     * memunculkan pesan galat untuk gangguan sesaat hanya membuat orang
     * mengira berkasnya rusak.
     */
    const ambilBerkas = async (percobaan = 0): Promise<void> => {
      try {
        const r = await fetch(alamatSemat, { cache: "no-store" });
        const jenisIsi = r.headers.get("content-type") || "";
        if (!r.ok || jenisIsi.includes("application/json")) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d?.error || `Berkas tidak bisa diambil (kode ${r.status}).`);
        }
        const blob = await r.blob();
        if (batal) return;
        objek = URL.createObjectURL(blob);
        setFoto({ url: objek, mime: blob.type || jenisIsi });
      } catch (err: any) {
        if (batal) return;
        if (percobaan < 1) {
          await new Promise((s) => setTimeout(s, 1500));
          if (!batal) return ambilBerkas(percobaan + 1);
          return;
        }
        setFotoGalat(err?.message || "Berkas gagal diambil.");
      }
    };

    ambilBerkas().finally(() => { if (!batal) setFotoMuat(false); });

    return () => {
      batal = true;
      if (objek) URL.revokeObjectURL(objek);
    };
  }, [alamatSemat, lihatFoto, ulang]);

  return (
    <div className="flex h-full flex-col">
      {/* kepala berkas */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <span className={`shrink-0 rounded border px-2 py-0.5 text-[11px] font-semibold ${lencana.k}`}>{lencana.t}</span>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${nadaJenis(e.kiriman.jenis).pil}`}>
          {singkatJenis(e.kiriman.jenis)}
        </span>
        <div className="min-w-[14rem] flex-1">
          <p className="truncate text-[13px] font-bold text-slate-900 dark:text-white">{e.kiriman.kapal}</p>
          <p className="truncate text-[11px] text-slate-500">
            {namaPendek(e.berkas.nama)} · {singkatJenis(e.kiriman.jenis)} · {bulanIndo(e.kiriman.periode)}
            {" "}· dikirim {waktuSingkat(e.kiriman.dikirimPada)}
            {b?.mesin && <> · dibaca {b.mesin}</>}
            {b?.disunting && <> · <span className="font-semibold text-amber-600">dikoreksi manual</span></>}
          </p>
        </div>
        <button onClick={() => setLihatFoto(!lihatFoto)}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-600 dark:text-slate-200">
          {lihatFoto ? "Sembunyikan foto" : "Tampilkan foto"}
        </button>
        <a href={alamatSemat} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-600 dark:text-slate-200">
          Buka berkas <Ikon nama="keluarTaut" className="h-3 w-3" />
        </a>
        {bisaBaca && (
          <button onClick={() => bacaUlang(e)} disabled={sibuk}
            className="rounded-md bg-[#16357f] px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-[#12296a] disabled:opacity-40">
            {sibuk ? "Membaca…" : b ? "Baca ulang" : "Baca sekarang"}
          </button>
        )}
      </div>

      {b?.galat && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11.5px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          {b.galat}
        </p>
      )}

      <div className={`flex-1 ${lihatFoto ? "grid gap-0 xl:grid-cols-[minmax(0,1fr)_20rem]" : ""}`}>
        {/* tabel barang */}
        <div className="min-w-0 overflow-x-auto">
          {!b?.baris.length ? (
            <p className="px-4 py-16 text-center text-[12.5px] text-slate-500">
              {status === "gagal"
                ? "Berkas ini gagal dibaca — buka fotonya, lalu ketik barangnya lewat “Tambah baris”."
                : status === "proses" ? "Sedang dibaca…" : "Belum dibaca. Isinya muncul di sini begitu selesai."}
            </p>
          ) : (
            <table className="w-full min-w-[34rem] text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-gradient-to-r from-[#16357f]/[0.07] to-[#14b8c4]/[0.05] dark:bg-slate-800/80">
                <tr className="border-b border-slate-200 text-[10.5px] uppercase tracking-[0.08em] text-slate-500 dark:border-slate-700">
                  <th className="w-9 px-2 py-2">
                    <input type="checkbox" className="accent-[#16357f]"
                      checked={b.baris.every((_, i) => pilih.has(kunci(e.berkas.fileId, i)))}
                      onChange={() => alihBanyak([e])} />
                  </th>
                  <th className="px-2 py-2 text-left font-bold">Nama barang</th>
                  <th className="w-40 px-2 py-2 text-left font-bold">Spesifikasi</th>
                  <th className="w-14 px-2 py-2 text-center font-bold">Jml</th>
                  <th className="w-20 px-2 py-2 text-left font-bold">Satuan</th>
                  <th className="w-36 px-2 py-2 text-left font-bold">Keterangan</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {b.baris.map((r, i) => {
                  const dipilih = pilih.has(kunci(e.berkas.fileId, i));
                  return (
                    <tr key={i} className={`border-b border-slate-100 transition dark:border-slate-800 ${
                      dipilih ? "bg-[#16357f]/[0.06] dark:bg-sky-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                      <td className="px-2 py-1 text-center">
                        <input type="checkbox" className="accent-[#16357f]" checked={dipilih}
                          onChange={() => alih(e.berkas.fileId, i)} />
                      </td>
                      {(["nama", "spesifikasi", "jumlah", "satuan", "keterangan"] as const).map((k) => (
                        <td key={k} className="px-1 py-0.5">
                          <input value={r[k] || ""} placeholder="—"
                            onChange={(ev) => ubahBaris(e, i, k, ev.target.value)}
                            className={`w-full rounded border border-transparent bg-transparent px-1.5 py-1 outline-none placeholder:text-slate-300 hover:border-slate-300 focus:border-slate-500 focus:bg-white dark:hover:border-slate-600 dark:focus:bg-slate-950 ${
                              k === "nama" ? "font-semibold text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"} ${
                              k === "jumlah" ? "text-center tabular-nums" : ""}`} />
                        </td>
                      ))}
                      <td className="px-1 py-0.5 text-center">
                        <button onClick={() => hapusBaris(e, i)} title="Hapus baris"
                          className="rounded px-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <button onClick={() => tambahBaris(e)}
            className="m-3 rounded-md border border-dashed border-slate-300 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600">
            + Tambah baris yang terlewat
          </button>
        </div>

        {/* foto scan, berdampingan dengan tabelnya */}
        {lihatFoto && (
          <div className="border-t border-slate-200 p-3 dark:border-slate-700 xl:border-l xl:border-t-0">
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-500">Foto / scan asli</p>
            <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              {fotoMuat ? (
                <div className="grid h-[26rem] place-items-center text-[12px] text-slate-500 xl:h-[calc(100vh-24rem)]">
                  Mengambil berkas dari Drive…
                </div>
              ) : fotoGalat ? (
                <div className="flex h-[26rem] flex-col justify-center gap-3 px-4 text-center xl:h-[calc(100vh-24rem)]">
                  <p className="text-[12.5px] font-bold text-rose-700 dark:text-rose-400">Berkas tidak bisa ditampilkan</p>
                  <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">{fotoGalat}</p>
                  <span className="mx-auto flex flex-wrap items-center justify-center gap-2">
                    <button onClick={() => setUlang((n) => n + 1)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#16357f] px-3 py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-[#12296a]">
                      <Ikon nama="segarkan" className="h-3.5 w-3.5" /> Coba lagi
                    </button>
                    <a href={e.berkas.url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-[11.5px] font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
                      Buka di Drive <Ikon nama="keluarTaut" className="h-3 w-3" />
                    </a>
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Hasil bacaan di sebelah tetap bisa dikoreksi walau fotonya gagal tampil.
                  </p>
                </div>
              ) : foto?.mime.startsWith("image/") ? (
                <img src={foto.url} alt={`Scan ${namaPendek(e.berkas.nama)}`}
                  className="max-h-[26rem] w-full object-contain xl:max-h-[calc(100vh-24rem)]" />
              ) : foto ? (
                <iframe src={foto.url} title={`Scan ${namaPendek(e.berkas.nama)}`}
                  className="h-[26rem] w-full xl:h-[calc(100vh-24rem)]" />
              ) : null}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Bandingkan langsung dengan tabel di sebelah. Kolom yang keliru bisa diperbaiki di tempat —
              perubahannya tersimpan sendiri.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
