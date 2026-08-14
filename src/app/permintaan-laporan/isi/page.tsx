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

const kunci = (fileId: string, i: number) => `${fileId}|${i}`;

const waktuSingkat = (iso: string) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

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
  const [sisaSaja, setSisaSaja] = useState(false);
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [sibukBerkas, setSibukBerkas] = useState("");
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

  /** hasil baru dari juru baca ikut tampil tanpa perlu muat ulang halaman */
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
    if (sisaSaja && e.bacaan?.status === "selesai") return false;
    if (!cari.trim()) return true;
    const teks = [
      e.kiriman.kapal, e.berkas.nama, e.kiriman.pengirim,
      ...(e.bacaan?.baris || []).map((b) => `${b.nama} ${b.spesifikasi} ${b.keterangan}`),
    ].join(" ").toLowerCase();
    return cari.toLowerCase().split(/\s+/).filter(Boolean).every((k) => teks.includes(k));
  }), [entri, kapal, periode, cari, sisaSaja]);

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

  /* ── pilihan & keberangkatan ke SPPBJ ──────────────────────────────────── */

  const alih = (fileId: string, i: number) =>
    setPilih((s) => { const n = new Set(s); const k = kunci(fileId, i); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const alihSemua = (e: Entri) => {
    const semua = (e.bacaan?.baris || []).map((_, i) => kunci(e.berkas.fileId, i));
    const penuh = semua.every((k) => pilih.has(k));
    setPilih((s) => {
      const n = new Set(s);
      semua.forEach((k) => (penuh ? n.delete(k) : n.add(k)));
      return n;
    });
  };

  const terpilih = useMemo(() => {
    const keluar: { kapal: string; baris: BarisPermintaan; asal: string }[] = [];
    entri.forEach((e) => (e.bacaan?.baris || []).forEach((b, i) => {
      if (pilih.has(kunci(e.berkas.fileId, i))) keluar.push({ kapal: e.kiriman.kapal, baris: b, asal: e.berkas.nama });
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">🧾 Isi Permintaan Kapal</h1>
          <p className="text-xs text-slate-500">
            Daftar barang hasil bacaan borang ABK — tersimpan, jadi tampil seketika di perangkat mana pun.
          </p>
        </div>
        <Link href="/permintaan-laporan" className="btn btn-ghost text-xs">← Kiriman & berkas</Link>
        <button onClick={() => { void ambil(); }} className="btn btn-ghost text-xs">↻ Muat ulang</button>
      </div>

      {/* ── keadaan mesin baca ──────────────────────────────────────────── */}
      <section className={`mt-4 rounded-2xl px-4 py-3 text-xs ring-1 ${
        jb.siap ? "bg-emerald-50 text-emerald-900 ring-emerald-200" : "bg-amber-50 text-amber-900 ring-amber-200"}`}>
        {jb.siap ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">🤖 AI lokal siap — {jb.mesin} (lewat {jb.jalur})</span>
            <span className="text-emerald-800/70">
              {jb.jalan ? `Sedang membaca ${jb.sedang} · ${jb.tahap}` : "Kiriman baru dibaca sendiri di latar belakang."}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => { void putaran(); }} disabled={jb.jalan}
                className="rounded-lg bg-white px-2.5 py-1 font-bold ring-1 ring-emerald-300 disabled:opacity-50">
                Periksa sekarang
              </button>
              <button onClick={() => nyalakanJuruBaca(!jb.aktif)}
                className="rounded-lg bg-white px-2.5 py-1 font-bold ring-1 ring-emerald-300">
                {jb.aktif ? "Jeda" : "Lanjutkan"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="font-bold">Perangkat ini tidak membaca berkas.</p>
            <p className="mt-0.5 text-amber-800/80">
              {jb.galat || "AI lokal tak terjangkau dari sini."} Hasil yang sudah dibaca laptop ber-Ollama tetap
              tampil lengkap di bawah — yang belum terbaca akan terbaca sendiri begitu aplikasi dibuka dari laptop itu
              (lewat <b>http://localhost:3001</b>, bukan alamat Vercel; peramban melarang halaman https memanggil Ollama yang melayani http).
            </p>
          </div>
        )}
      </section>

      {galat && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{galat}</p>}

      {/* ── angka ringkas ───────────────────────────────────────────────── */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Angka label="Berkas terbaca" nilai={jml.terbaca} warna="text-emerald-700" />
        <Angka label="Barang terbaca" nilai={jml.barang} warna="text-slate-800" />
        <Angka label="Belum terbaca" nilai={jml.belum} warna="text-amber-700" />
        <Angka label="Gagal dibaca" nilai={jml.gagal} warna="text-rose-700" />
      </section>

      {/* ── saringan ────────────────────────────────────────────────────── */}
      <section className="mt-4 flex flex-wrap items-center gap-2">
        <select value={kapal} onChange={(e) => setKapal(e.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900">
          <option value="">Semua kapal</option>
          {daftarKapal.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={periode} onChange={(e) => setPeriode(e.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900">
          <option value="">Semua periode</option>
          {daftarPeriode.map((p) => <option key={p} value={p}>{bulanIndo(p)}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={sisaSaja} onChange={(e) => setSisaSaja(e.target.checked)} />
          hanya yang belum terbaca
        </label>
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari barang / kapal / berkas…"
          className="ml-auto w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900" />
      </section>

      {/* ── daftar ──────────────────────────────────────────────────────── */}
      <section className="mt-4 space-y-3 pb-24">
        {muat && <p className="py-10 text-center text-sm text-slate-400">Memuat…</p>}
        {!muat && !tampil.length && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-400">
            Tidak ada berkas permintaan pada saringan ini.
          </p>
        )}
        {tampil.map((e) => (
          <KartuBerkas key={e.berkas.fileId} e={e} pilih={pilih} alih={alih} alihSemua={alihSemua}
            ubahBaris={ubahBaris} hapusBaris={hapusBaris}
            bacaUlang={bacaUlang} bisaBaca={jb.siap} sibuk={sibukBerkas === e.berkas.fileId} />
        ))}
      </section>

      {/* ── bilah pilihan ───────────────────────────────────────────────── */}
      {terpilih.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              <b className="text-slate-900 dark:text-white">{terpilih.length} barang</b> terpilih
              {kapalTerpilih.length === 1
                ? <span className="text-slate-400"> · {kapalTerpilih[0]}</span>
                : <span className="text-rose-600"> · dari {kapalTerpilih.length} kapal — SPPBJ dibuat per kapal</span>}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setPilih(new Set())} className="btn btn-ghost text-xs">Bersihkan</button>
              <button onClick={salin} className="btn btn-ghost text-xs">⧉ Salin daftar</button>
              <button onClick={keSppbj} disabled={kapalTerpilih.length !== 1} className="btn btn-primary text-xs disabled:opacity-40">
                ➜ Buat SPPBJ dari {terpilih.length} barang
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Angka({ label, nilai, warna }: { label: string; nilai: number; warna: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-extrabold tabular-nums ${warna}`}>{nilai}</p>
    </div>
  );
}

/* ── satu berkas + isinya ────────────────────────────────────────────────── */
function KartuBerkas({ e, pilih, alih, alihSemua, ubahBaris, hapusBaris, bacaUlang, bisaBaca, sibuk }: {
  e: Entri;
  pilih: Set<string>;
  alih: (fileId: string, i: number) => void;
  alihSemua: (e: Entri) => void;
  ubahBaris: (e: Entri, i: number, k: keyof BarisPermintaan, v: string) => void;
  hapusBaris: (e: Entri, i: number) => void;
  bacaUlang: (e: Entri) => void;
  bisaBaca: boolean;
  sibuk: boolean;
}) {
  const b = e.bacaan;
  const status = sibuk ? "proses" : (b?.status || "belum");
  const lencana =
    status === "selesai" ? { t: `${b!.baris.length} barang`, k: "bg-emerald-100 text-emerald-800 ring-emerald-200" }
      : status === "proses" ? { t: "sedang dibaca…", k: "bg-sky-100 text-sky-800 ring-sky-200" }
        : status === "gagal" ? { t: "gagal dibaca", k: "bg-rose-100 text-rose-700 ring-rose-200" }
          : { t: "belum dibaca", k: "bg-slate-100 text-slate-600 ring-slate-200" };

  return (
    <article className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
            {e.kiriman.kapal} <span className="text-slate-400">· {singkatJenis(e.kiriman.jenis)}</span>
          </p>
          <p className="truncate text-[11px] text-slate-400">
            {e.berkas.nama} · {bulanIndo(e.kiriman.periode)} · dikirim {waktuSingkat(e.kiriman.dikirimPada)}
            {b?.mesin && <> · dibaca {b.mesin}</>}
            {b?.disunting && <> · <span className="text-amber-600">sudah dikoreksi</span></>}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${lencana.k}`}>{lencana.t}</span>
        <a href={e.berkas.url} target="_blank" rel="noreferrer" className="btn btn-ghost text-[11px]">Buka berkas</a>
        {bisaBaca && (
          <button onClick={() => bacaUlang(e)} disabled={sibuk} className="btn btn-ghost text-[11px] disabled:opacity-40">
            {sibuk ? "Membaca…" : b ? "Baca ulang" : "Baca sekarang"}
          </button>
        )}
      </header>

      {b?.galat && <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">{b.galat}</p>}

      {!!b?.baris.length && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="w-9 px-2 py-2">
                  <input type="checkbox" onChange={() => alihSemua(e)}
                    checked={b.baris.every((_, i) => pilih.has(kunci(e.berkas.fileId, i)))} />
                </th>
                <th className="px-2 py-2 text-left font-extrabold">Nama barang</th>
                <th className="px-2 py-2 text-left font-extrabold">Spesifikasi</th>
                <th className="w-16 px-2 py-2 text-left font-extrabold">Jumlah</th>
                <th className="w-20 px-2 py-2 text-left font-extrabold">Satuan</th>
                <th className="px-2 py-2 text-left font-extrabold">Keterangan</th>
                <th className="w-8 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {b.baris.map((r, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1 text-center">
                    <input type="checkbox" checked={pilih.has(kunci(e.berkas.fileId, i))}
                      onChange={() => alih(e.berkas.fileId, i)} />
                  </td>
                  {(["nama", "spesifikasi", "jumlah", "satuan", "keterangan"] as const).map((k) => (
                    <td key={k} className="px-2 py-1">
                      <input value={r[k] || ""} onChange={(ev) => ubahBaris(e, i, k, ev.target.value)}
                        className={`w-full rounded border border-transparent bg-transparent px-1.5 py-1 hover:border-slate-200 focus:border-sky-400 focus:bg-white dark:focus:bg-slate-950 ${
                          k === "jumlah" ? "text-center tabular-nums" : ""}`} />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center">
                    <button onClick={() => hapusBaris(e, i)} className="text-rose-300 hover:text-rose-600">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
