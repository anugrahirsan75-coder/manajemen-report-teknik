"use client";
/**
 * DATABASE RAB — harga acuan barang & jasa hasil pemindaian berkas 2024-2026.
 *
 * Selama ini isinya cuma bisa dicapai lewat kotak pencarian kecil di layar lain,
 * padahal ini basis harga yang dipakai menyusun RAB dan usulan. Layar ini
 * membukanya utuh: bisa ditelusuri per jenis dan kategori, bukan hanya dicari
 * bila namanya sudah diketahui.
 *
 * BARANG dan JASA dipisah karena keduanya dibaca berbeda: barang dinilai dari
 * satuan dan spesifikasinya, jasa dari lingkup pekerjaannya. Suku cadang mesin
 * berdiri sendiri lagi — yang menentukan bukan namanya, melainkan merek mesin
 * dan part number-nya.
 *
 * Tiap baris bisa dibuka untuk melihat rinciannya: rentang harga, harga per
 * tahun, tren, dan berapa banyak berkas yang menjadi dasarnya. Satu harga yang
 * cuma muncul sekali tidak sama nilainya dengan harga yang muncul dua puluh kali.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { rupiah } from "@/lib/format";

interface Baris {
  kode: string; jenis: string; kategori: string; uraian: string; spek: string;
  satuan: string; n: number; lo: number; hi: number; median: number;
  h2024: number; h2025: number; h2026: number; tren: string; kapal: string;
}

const JENIS = [
  { id: "", label: "Semua", ikon: "📚" },
  { id: "B", label: "Barang", ikon: "📦" },
  { id: "J", label: "Jasa", ikon: "🔧" },
  { id: "S", label: "Suku Cadang Mesin", ikon: "⚙️" },
] as const;

const namaJenis = (j: string) => (j === "B" ? "Barang" : j === "J" ? "Jasa" : j === "S" ? "Suku Cadang" : j);

const WARNA_JENIS: Record<string, string> = {
  B: "bg-sky-100 text-sky-800 ring-sky-200",
  J: "bg-amber-100 text-amber-800 ring-amber-200",
  S: "bg-violet-100 text-violet-800 ring-violet-200",
};

export default function DatabaseRab() {
  const [jenis, setJenis] = useState<string>("");
  const [kategori, setKategori] = useState("");
  const [cari, setCari] = useState("");
  const [daftarKategori, setDaftarKategori] = useState<string[]>([]);
  const [baris, setBaris] = useState<Baris[]>([]);
  const [total, setTotal] = useState(0);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState<string | null>(null);
  const [halaman, setHalaman] = useState(0);

  const PER_HAL = 100;

  const ambil = useCallback(async () => {
    setMuat(true); setGalat("");
    try {
      /**
       * Dua jalur, sengaja: pencarian memakai /cari (semua kata harus ada,
       * diurutkan menurut kecocokan), penelusuran tanpa kata kunci memakai
       * /daftar (diurutkan menurut banyaknya data pembanding). Memaksa satu
       * jalur untuk keduanya membuat penelusuran mengembalikan barang acak.
       */
      const alamat = cari.trim().length >= 2
        ? `/api/harga/cari?q=${encodeURIComponent(cari)}&batas=60`
          + `${jenis ? `&jenis=${jenis}` : ""}${kategori ? `&kategori=${encodeURIComponent(kategori)}` : ""}`
        : `/api/harga/daftar?batas=${PER_HAL}&lewati=${halaman * PER_HAL}&minData=1`
          + `${jenis ? `&jenis=${jenis}` : ""}${kategori ? `&kategori=${encodeURIComponent(kategori)}` : ""}`;
      const r = await fetch(alamat, { cache: "no-store" });
      const d = await r.json();
      if (!d.ok && d.error) throw new Error(d.error);
      setBaris(d.hasil || []);
      setTotal(d.total || (d.hasil || []).length);
      if (d.kategori?.length) setDaftarKategori(d.kategori);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, [cari, jenis, kategori, halaman]);

  // pencarian ditunda supaya tiap huruf tak jadi satu permintaan ke indeks 60 ribu baris
  useEffect(() => {
    const t = window.setTimeout(() => { void ambil(); }, cari.trim() ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [ambil, cari]);

  useEffect(() => { setHalaman(0); }, [jenis, kategori, cari]);

  const ringkas = useMemo(() => {
    const b = { barang: 0, jasa: 0, suku: 0 };
    baris.forEach((x) => {
      if (x.jenis === "B") b.barang++; else if (x.jenis === "J") b.jasa++; else b.suku++;
    });
    return b;
  }, [baris]);

  const adaCari = cari.trim().length >= 2;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="asdp-gradient mb-5 rounded-[1.75rem] p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow flex flex-wrap items-center gap-4 rounded-[calc(1.75rem-1.5px)] px-5 py-5 sm:px-6">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 via-indigo-500 to-blue-800 text-2xl text-white shadow-lg shadow-indigo-900/20">🗃️</div>
          <div className="min-w-[16rem] flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-indigo-800 ring-1 ring-indigo-200">Harga Acuan</span>
              <span className="text-[10px] font-medium text-slate-400">hasil pemindaian berkas RAB 2024–2026</span>
            </div>
            <h1 className="asdp-text-gradient text-2xl font-extrabold leading-tight">Database RAB</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Barang, jasa, dan suku cadang beserta spesifikasi, satuan, dan rentang harganya — dasar penyusunan RAB & usulan.
            </p>
          </div>
          <Link href="/rencana" className="btn btn-ghost text-xs">📆 Rencana &amp; Realisasi</Link>
        </div>
      </header>

      {/* ── saringan ────────────────────────────────────────────────────── */}
      <section className="mb-4 rounded-2xl bg-white px-3 py-3 elev-sm ring-line dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800">
            {JENIS.map((j) => (
              <button key={j.id} onClick={() => setJenis(j.id)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition ${
                  jenis === j.id ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-700"}`}>
                {j.ikon} {j.label}
              </button>
            ))}
          </div>
          <select value={kategori} onChange={(e) => setKategori(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900">
            <option value="">Semua kategori</option>
            {daftarKategori.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <div className="relative ml-auto min-w-[16rem] flex-1 sm:flex-none">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
            <input value={cari} onChange={(e) => setCari(e.target.value)}
              placeholder="Cari barang / jasa — mis. filter oli, cat marine, service genset…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900" />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {muat ? "Memuat…" : adaCari
            ? `${baris.length} barang cocok dengan pencarian`
            : `${baris.length} dari ${total.toLocaleString("id-ID")} baris${kategori ? ` · ${kategori}` : ""}`}
          {" · "}<span className="text-slate-400">
            {ringkas.barang} barang · {ringkas.jasa} jasa · {ringkas.suku} suku cadang di halaman ini
          </span>
        </p>
      </section>

      {galat && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{galat}</p>}

      {/* ── daftar ──────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl bg-white elev-sm ring-line dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="w-20 px-3 py-2.5 text-left font-extrabold">Jenis</th>
                <th className="px-3 py-2.5 text-left font-extrabold">Uraian &amp; spesifikasi</th>
                <th className="w-44 px-3 py-2.5 text-left font-extrabold">Kategori</th>
                <th className="w-16 px-3 py-2.5 text-left font-extrabold">Satuan</th>
                <th className="w-14 px-3 py-2.5 text-center font-extrabold">Data</th>
                <th className="w-32 px-3 py-2.5 text-right font-extrabold">Harga acuan</th>
                <th className="w-24 px-3 py-2.5 text-right font-extrabold">Rentang</th>
              </tr>
            </thead>
            <tbody>
              {muat && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Memuat…</td></tr>
              )}
              {!muat && !baris.length && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">
                  {adaCari ? "Tak ada yang cocok. Coba kata lain." : "Tak ada data pada saringan ini."}
                </td></tr>
              )}
              {baris.map((b) => {
                const acuan = b.h2026 || b.h2025 || b.median || b.lo;
                const terbuka = buka === b.kode;
                return (
                  <>
                    <tr key={b.kode} onClick={() => setBuka(terbuka ? null : b.kode)}
                      className={`cursor-pointer border-t border-slate-100 row-hover dark:border-slate-800 ${terbuka ? "bg-indigo-50/60 dark:bg-indigo-950/30" : ""}`}>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1 ${WARNA_JENIS[b.jenis] || "bg-slate-100 text-slate-600 ring-slate-200"}`}>
                          {namaJenis(b.jenis)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{b.uraian}</p>
                        {b.spek && <p className="text-[10px] text-slate-400">{b.spek}</p>}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-slate-500">{b.kategori}</td>
                      <td className="px-3 py-2 text-[11px] text-slate-500">{b.satuan || "—"}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {b.n}×
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">{rupiah(acuan)}</td>
                      <td className="px-3 py-2 text-right text-[10px] tabular-nums text-slate-400">
                        {b.lo === b.hi ? "tetap" : `${rupiah(b.lo)}–${rupiah(b.hi)}`}
                      </td>
                    </tr>
                    {terbuka && (
                      <tr key={`${b.kode}-detail`} className="border-t border-indigo-100 bg-indigo-50/40 dark:border-indigo-900 dark:bg-indigo-950/20">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Rinci label="Kode" isi={b.kode} />
                            <Rinci label="Harga terendah" isi={rupiah(b.lo)} />
                            <Rinci label="Harga tengah (median)" isi={rupiah(b.median)} />
                            <Rinci label="Harga tertinggi" isi={rupiah(b.hi)} />
                            <Rinci label="Harga 2024" isi={b.h2024 ? rupiah(b.h2024) : "—"} />
                            <Rinci label="Harga 2025" isi={b.h2025 ? rupiah(b.h2025) : "—"} />
                            <Rinci label="Harga 2026" isi={b.h2026 ? rupiah(b.h2026) : "—"} />
                            <Rinci label="Tren harga" isi={b.tren || "—"} />
                            {b.spek && <div className="sm:col-span-2 lg:col-span-3">
                              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Spesifikasi / merek / part number</p>
                              <p className="text-xs text-slate-700 dark:text-slate-200">{b.spek}</p>
                            </div>}
                            {b.kapal && <Rinci label="Contoh kapal" isi={b.kapal} />}
                          </div>
                          <p className="mt-2 text-[10px] text-slate-500">
                            Harga acuan yang dipakai aplikasi: <b>{rupiah(acuan)}</b> — tahun berjalan bila ada,
                            kalau tidak harga tengah dari {b.n} data. Harga lama pada barang yang tak pernah dibeli lagi
                            memang tidak dipakai.
                          </p>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {!adaCari && total > PER_HAL && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <button onClick={() => setHalaman((h) => Math.max(0, h - 1))} disabled={halaman === 0}
              className="btn btn-ghost text-xs disabled:opacity-40">← Sebelumnya</button>
            <span className="text-[11px] text-slate-500">
              Halaman {halaman + 1} dari {Math.ceil(total / PER_HAL).toLocaleString("id-ID")}
            </span>
            <button onClick={() => setHalaman((h) => h + 1)} disabled={(halaman + 1) * PER_HAL >= total}
              className="btn btn-ghost text-xs disabled:opacity-40">Berikutnya →</button>
          </div>
        )}
      </section>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Nama barang sudah dibersihkan dari narasi berkas — nomor surat, kata “Pengadaan”, nama kapal, dan bulan dibuang,
        sehingga yang tersisa memang nama barangnya. Harga di sini <b>acuan</b>, bukan harga pasti: yang mengikat tetap
        penawaran vendor pada SPPBJ.
      </p>
    </main>
  );
}

function Rinci({ label, isi }: { label: string; isi: string }) {
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{isi}</p>
    </div>
  );
}
