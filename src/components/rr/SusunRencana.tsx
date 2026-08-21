"use client";
/**
 * Susun usulan bulanan dari riwayat pengadaan kapal, dengan kendali RKA.
 *
 * Bentuk layarnya menuruti cara orang menyusunnya: pertama melihat SISA PAGU
 * (berapa yang boleh diusulkan), baru memilih barang. Karena itu papan pagu
 * berada di atas dan ikut bergerak tiap kali satu barang dicentang — bukan
 * angka yang baru muncul setelah semuanya terlanjur dipilih.
 *
 * Yang dipilih di sini BELUM masuk dokumen; penambahan terjadi sekali, saat
 * tombol di kaki ditekan.
 */
import { useEffect, useMemo, useState } from "react";
import { rupiah } from "@/lib/format";
import { labelMA } from "@/lib/anggaran/types";
import { namaBulan } from "@/lib/rr/types";
import {
  BarisKendali, Kandidat, isiOtomatis, nilaiKandidat, susunKendali,
} from "@/lib/rr/usulanRiwayat";

export interface PilihanUsulan {
  kandidat: Kandidat;
  jumlah: number;
  harga: number;
}

export default function SusunRencana({
  buka, tutup, bulan, kapal, kandidat, pagu, kapalLain, kapalIni, kapalBelum, dipakaiBulanLalu, tambah,
}: {
  buka: boolean;
  tutup: () => void;
  bulan: string;
  kapal: string;
  kandidat: Kandidat[];
  pagu: Record<string, number>;
  kapalLain: Record<string, number>;
  kapalIni: Record<string, number>;
  /** kapal yang usulannya belum terisi bulan ini, termasuk kapal ini — dasar pembagian jatah */
  kapalBelum: number;
  /** nama barang yang dipakai rencana bulan lalu — diberi penalti supaya usulan tak jadi salinan */
  dipakaiBulanLalu?: Set<string>;
  tambah: (pilihan: PilihanUsulan[]) => void;
}) {
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [ubahan, setUbahan] = useState<Record<string, { jumlah?: number; harga?: number }>>({});
  const [cari, setCari] = useState("");
  /**
   * Pagu itu milik CABANG, bukan milik satu kapal. Tanpa pembagian, isi otomatis
   * satu kapal bisa menghabiskan pagu sebulan seluruh armada — dan kapal
   * berikutnya menemukan pagunya sudah habis padahal belum menyusun apa pun.
   */
  const [modeJatah, setModeJatah] = useState<"rata" | "penuh">("rata");
  /**
   * Variasi menyala secara bawaan. Usulan yang tiap bulan sama persis — barang
   * sama, jumlah sama, urutan sama — terbaca sebagai salinan bulan lalu, bukan
   * sebagai perencanaan. Benihnya disimpan supaya susunan yang sama bisa
   * ditampilkan ulang, dan tombol Acak ulang menggantinya.
   */
  const [variasi, setVariasi] = useState(true);
  const [benih, setBenih] = useState(1);
  const [maSaring, setMaSaring] = useState("");
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    if (!buka) return;
    setPilih(new Set()); setUbahan({}); setCari(""); setMaSaring(""); setPesan(""); setModeJatah("rata");
    setVariasi(true);
    // benih diturunkan dari bulan & kapal: membuka layar yang sama dua kali
    // memberi susunan yang sama, tapi kapal lain tetap dapat susunan berbeda
    setBenih(Array.from(`${bulan}|${kapal}`).reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7));
  }, [buka, bulan, kapal]);

  const pembagi = modeJatah === "rata" ? Math.max(1, kapalBelum) : 1;

  /** kandidat setelah suntingan jumlah/harga di layar ini */
  const denganUbahan = useMemo(() => kandidat.map((k) => ({
    ...k,
    jumlah: ubahan[k.id]?.jumlah ?? k.jumlah,
    harga: ubahan[k.id]?.harga ?? k.harga,
  })), [kandidat, ubahan]);

  const dipilihPerMA = useMemo(() => {
    const out: Record<string, number> = {};
    denganUbahan.forEach((k) => {
      if (pilih.has(k.id)) out[k.kode] = (out[k.kode] || 0) + nilaiKandidat(k);
    });
    return out;
  }, [denganUbahan, pilih]);

  const kendali: BarisKendali[] = useMemo(
    () => susunKendali(pagu, kapalLain, kapalIni, dipilihPerMA),
    [pagu, kapalLain, kapalIni, dipilihPerMA]);

  const total = useMemo(() => {
    const j = (f: (b: BarisKendali) => number) => kendali.reduce((s, b) => s + f(b), 0);
    return {
      pagu: j((b) => b.pagu), kapalLain: j((b) => b.kapalLain),
      kapalIni: j((b) => b.kapalIni), dipilih: j((b) => b.dipilih), sisa: j((b) => b.sisa),
    };
  }, [kendali]);

  const tampil = useMemo(() => denganUbahan.filter((k) => {
    if (maSaring && k.kode !== maSaring) return false;
    if (!cari.trim()) return true;
    const t = `${k.deskripsi} ${k.spesifikasi} ${k.judul}`.toLowerCase();
    return cari.toLowerCase().split(/\s+/).filter(Boolean).every((x) => t.includes(x));
  }), [denganUbahan, cari, maSaring]);

  const daftarMA = useMemo(
    () => Array.from(new Set(kandidat.map((k) => k.kode))).sort(), [kandidat]);

  if (!buka) return null;

  const alih = (id: string) =>
    setPilih((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const otomatis = () => {
    /** jatah kapal ini = (pagu − rencana kapal lain − isi dokumen ini) dibagi kapal yang belum menyusun */
    const sisa: Record<string, number> = {};
    kendali.forEach((b) => { sisa[b.kode] = Math.max(0, (b.pagu - b.kapalLain - b.kapalIni) / pembagi); });
    const h = isiOtomatis(denganUbahan, sisa, {
      sudahDipilih: pilih, acak: variasi, benih, variasiJumlah: variasi, hindari: dipakaiBulanLalu,
    });
    setPilih(h.pilih);
    // jumlah hasil variasi ikut dipasang, bukan cuma dipakai menghitung —
    // kalau tidak, nilai di layar akan beda dengan yang barusan dihitung
    if (Object.keys(h.jumlahSaran).length) {
      setUbahan((u) => {
        const n = { ...u };
        Object.entries(h.jumlahSaran).forEach(([id, jml]) => { n[id] = { ...n[id], jumlah: jml }; });
        return n;
      });
    }
    const kurang = h.kurang.filter((x) => x.sisa > 0);
    setPesan(
      `${h.pilih.size} barang terpilih senilai ${rupiah(Object.values(h.terpakai).reduce((s, v) => s + v, 0))}`
      + (modeJatah === "rata" ? ` (jatah ${kapal.replace("KMP. ", "")}: sisa pagu dibagi ${pembagi} kapal)` : "")
      + (variasi ? " · susunan divariasikan, tekan Acak ulang untuk kombinasi lain." : ".")
      + (kurang.length
        ? ` Riwayat belum cukup untuk memenuhi ${kurang.map((k) => labelMA(k.kode)).join(", ")} — sisanya diketik sendiri.`
        : ""));
  };

  const kirim = () => {
    const isi = denganUbahan.filter((k) => pilih.has(k.id))
      .map((k) => ({ kandidat: k, jumlah: k.jumlah, harga: k.harga }));
    if (!isi.length) return;
    tambah(isi);
  };

  const jumlahDipilih = pilih.size;
  const lewatPagu = kendali.filter((b) => b.pagu > 0 && b.sisa < 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-auto bg-black/50 p-3" onMouseDown={tutup}>
      <div className="my-4 w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}>

        {/* ── kepala ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 border-b bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="min-w-[14rem] flex-1">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100">🧩 Susun usulan dari riwayat — {kapal}</h3>
            <p className="text-[11px] text-slate-500">
              {namaBulan(bulan)} · barang diambil dari SPPBJ kapal ini pada bulan-bulan sebelumnya, dikendalikan pagu RKA
            </p>
          </div>
          <button onClick={tutup} className="text-xl leading-none text-slate-400 hover:text-slate-700">✕</button>
        </div>

        {/* ── kendali pagu ───────────────────────────────────────────── */}
        <div className="border-b bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Kendali RKA {namaBulan(bulan)}</span>
            <span className="text-[11px] text-slate-500">
              Pagu <b className="tabular-nums text-slate-700 dark:text-slate-200">{rupiah(total.pagu)}</b>
              {" · "}kapal lain <b className="tabular-nums">{rupiah(total.kapalLain)}</b>
              {" · "}dokumen ini <b className="tabular-nums">{rupiah(total.kapalIni)}</b>
              {" · "}dipilih <b className="tabular-nums text-indigo-700">{rupiah(total.dipilih)}</b>
              {" · "}sisa <b className={`tabular-nums ${total.sisa < 0 ? "text-rose-700" : "text-emerald-700"}`}>{rupiah(total.sisa)}</b>
            </span>
            <label className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500">
              Jatah kapal ini
              <select value={modeJatah} onChange={(e) => setModeJatah(e.target.value as "rata" | "penuh")}
                className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                <option value="rata">bagi rata — {Math.max(1, kapalBelum)} kapal belum menyusun</option>
                <option value="penuh">seluruh sisa pagu</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
              title="Susunan & jumlah divariasikan, dan barang bulan lalu diberi penalti — supaya usulan tak tampak seperti salinan">
              <input type="checkbox" className="accent-indigo-600" checked={variasi}
                onChange={(e) => setVariasi(e.target.checked)} />
              Variasi
            </label>
            <button onClick={otomatis}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700">
              ⚡ Isi otomatis mendekati jatah
            </button>
            {variasi && (
              <button onClick={() => { setBenih((b) => (b * 1664525 + 1013904223) >>> 0); setPilih(new Set()); setUbahan({}); setPesan("Benih diganti — tekan Isi otomatis untuk kombinasi baru."); }}
                title="Ganti kombinasi: barang dan jumlah yang terpilih akan berbeda"
                className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-300 hover:bg-indigo-50 dark:bg-slate-800 dark:ring-indigo-800">
                🎲 Acak ulang
              </button>
            )}
            {jumlahDipilih > 0 && (
              <button onClick={() => { setPilih(new Set()); setPesan(""); }}
                className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                Bersihkan pilihan
              </button>
            )}
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {kendali.filter((b) => b.pagu > 0 || b.dipilih > 0 || b.kapalIni > 0).map((b) => {
              const dipakai = b.kapalLain + b.kapalIni + b.dipilih;
              const persen = b.pagu > 0 ? Math.min(100, Math.round((dipakai / b.pagu) * 100)) : 0;
              const lewat = b.pagu > 0 && dipakai > b.pagu;
              return (
                <button key={b.kode} onClick={() => setMaSaring(maSaring === b.kode ? "" : b.kode)}
                  className={`rounded-xl px-3 py-2 text-left ring-1 transition ${
                    maSaring === b.kode ? "bg-indigo-50 ring-indigo-300 dark:bg-indigo-950/40" : "bg-slate-50 ring-slate-200 hover:bg-white dark:bg-slate-800 dark:ring-slate-700"}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">{labelMA(b.kode)}</span>
                    <span className={`shrink-0 text-[10px] font-extrabold tabular-nums ${lewat ? "text-rose-600" : "text-slate-400"}`}>{persen}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className={`h-full ${lewat ? "bg-rose-500" : "bg-indigo-500"}`} style={{ width: `${persen}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] tabular-nums text-slate-500">
                    sisa {rupiah(b.sisa)} <span className="text-slate-400">dari {rupiah(b.pagu)}</span>
                    {pembagi > 1 && (
                      <span className="text-indigo-600"> · jatah {rupiah(Math.max(0, (b.pagu - b.kapalLain - b.kapalIni) / pembagi))}</span>
                    )}
                  </p>
                </button>
              );
            })}
          </div>
          {!Object.keys(pagu).length && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800 ring-1 ring-amber-200">
              Pagu {namaBulan(bulan)} belum ada di Dashboard Anggaran — kendali RKA tak bisa dihitung, tapi barangnya
              tetap bisa dipilih dari riwayat.
            </p>
          )}
        </div>

        {/* ── saringan ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50 px-5 py-2 dark:border-slate-700 dark:bg-slate-800">
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari barang…"
            className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-900" />
          <select value={maSaring} onChange={(e) => setMaSaring(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900">
            <option value="">Semua Mata Anggaran</option>
            {daftarMA.map((k) => <option key={k} value={k}>{labelMA(k)}</option>)}
          </select>
          <span className="text-[11px] text-slate-500">{tampil.length} barang di riwayat</span>
          {pesan && <span className="text-[11px] font-semibold text-indigo-700">{pesan}</span>}
        </div>

        {/* ── daftar kandidat ────────────────────────────────────────── */}
        <div className="max-h-[42vh] overflow-auto">
          {!tampil.length ? (
            <p className="px-5 py-12 text-center text-sm text-slate-400">
              Belum ada riwayat pengadaan rutin untuk kapal ini pada 12 bulan terakhir.
            </p>
          ) : (
            <table className="w-full min-w-[54rem] text-xs">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-slate-500 shadow-sm dark:bg-slate-900">
                <tr>
                  <th className="w-9 px-2 py-2" />
                  <th className="px-2 py-2 text-left font-extrabold">Barang</th>
                  <th className="w-44 px-2 py-2 text-left font-extrabold">Kelompok</th>
                  <th className="w-20 px-2 py-2 text-center font-extrabold">Riwayat</th>
                  <th className="w-16 px-2 py-2 text-center font-extrabold">Jml</th>
                  <th className="w-28 px-2 py-2 text-right font-extrabold">Harga</th>
                  <th className="w-28 px-2 py-2 text-right font-extrabold">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((k) => {
                  const dipilih = pilih.has(k.id);
                  return (
                    <tr key={k.id} className={`border-t border-slate-100 dark:border-slate-800 ${dipilih ? "bg-indigo-50/60 dark:bg-indigo-950/30" : ""}`}>
                      <td className="px-2 py-1.5 text-center">
                        <input type="checkbox" className="accent-indigo-600" checked={dipilih} onChange={() => alih(k.id)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{k.deskripsi}</p>
                        {k.spesifikasi && <p className="text-[10px] text-slate-400">{k.spesifikasi}</p>}
                      </td>
                      <td className="px-2 py-1.5 text-[10px] text-slate-500">{k.judul}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {k.kali}×
                        </span>
                        <p className="text-[9px] text-slate-400">akhir {namaBulan(k.bulanTerakhir).slice(0, 3)}</p>
                      </td>
                      <td className="px-1 py-1.5">
                        <input value={k.jumlah} inputMode="numeric"
                          onChange={(e) => setUbahan((u) => ({ ...u, [k.id]: { ...u[k.id], jumlah: Number(e.target.value.replace(/\D/g, "")) || 0 } }))}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-center tabular-nums dark:border-slate-700 dark:bg-slate-900" />
                      </td>
                      <td className="px-1 py-1.5">
                        <input value={k.harga.toLocaleString("id-ID")} inputMode="numeric"
                          onChange={(e) => setUbahan((u) => ({ ...u, [k.id]: { ...u[k.id], harga: Number(e.target.value.replace(/\D/g, "")) || 0 } }))}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-right tabular-nums dark:border-slate-700 dark:bg-slate-900" />
                      </td>
                      <td className="px-2 py-1.5 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">
                        {rupiah(nilaiKandidat(k))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── kaki ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 border-t bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
          {lewatPagu.length > 0 && (
            <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 ring-1 ring-rose-200">
              ⚠ Melewati pagu: {lewatPagu.map((b) => labelMA(b.kode)).join(", ")}
            </span>
          )}
          <button onClick={tutup} className="btn btn-ghost text-xs">Batal</button>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[11px] text-slate-500">
              {jumlahDipilih} barang · <b className="tabular-nums text-slate-800 dark:text-slate-100">{rupiah(total.dipilih)}</b>
            </span>
            <button onClick={kirim} disabled={!jumlahDipilih}
              className="btn btn-primary text-xs disabled:opacity-40">
              ➜ Tambahkan ke usulan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
