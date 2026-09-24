"use client";
/**
 * Dokumen Kapal — sisi KANTOR dari Portal Kapal.
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
import UnggahDokumenKantor from "@/components/kapal/UnggahDokumenKantor";
import RekapDokumen from "@/components/kapal/RekapDokumen";
import KartuDokumen, { DokumenTampil } from "@/components/kapal/KartuDokumen";
import PenampilDokumen from "@/components/kapal/PenampilDokumen";
import { GOLONGAN_ARSIP, golonganArsip as golonganDokumen } from "@/lib/portal/dokumen";
import { bulanIndo } from "@/lib/lapor/types";

/**
 * Kelompokkan dokumen per golongan, urut sesuai daftar golongan resmi.
 *
 * Golongan yang tidak dikenal (data lama, atau id yang sudah dihapus dari
 * daftar) TIDAK dibuang - dia ditaruh paling bawah apa adanya. Dokumen yang
 * hilang dari layar karena golongannya tidak dikenali adalah cara paling
 * halus untuk kehilangan arsip: tidak ada pesan galat, tidak ada yang sadar.
 */
function kelompokGolongan(daftar: any[]) {
  const urutan = new Map(GOLONGAN_ARSIP.map((j, i) => [j.id, i]));
  const wadah = new Map<string, any[]>();
  daftar.forEach((d) => {
    const id = d.jenis || "lainnya";
    if (!wadah.has(id)) wadah.set(id, []);
    wadah.get(id)!.push(d);
  });

  // Array.from, bukan sebaran [...map]: target TypeScript proyek ini di bawah
  // es2015, dan menyebar iterator Map di sana ditolak compiler (TS2802).
  return Array.from(wadah.entries())
    .sort((a, b) => (urutan.get(a[0]) ?? 999) - (urutan.get(b[0]) ?? 999))
    .map(([id, isi]) => {
      const j = golonganDokumen(id);
      return {
        id,
        label: j?.label || id,
        ikon: j?.ikon || "📄",
        warna: j?.warna || "bg-slate-100 text-slate-700 ring-slate-200",
        isi,
      };
    });
}

/**
 * Kluster tanggal: satu rumpun per BULAN, terbaru di atas.
 *
 * Arsip kapal dibaca per bulan, bukan per hari — pertanyaannya selalu
 * "Agustus kemarin kapal ini kirim apa saja", karena bulan adalah satuan
 * tagihan borangnya. Dokumen tak rutin ikut jatuh ke bulan kejadiannya, jadi
 * berita acara kerusakan muncul persis di samping laporan mesin bulan itu.
 *
 * Yang tanggalnya kosong TIDAK dibuang — ditaruh paling bawah sebagai
 * "Tanpa tanggal". Baris yang hilang dari layar karena datanya kurang rapi
 * adalah cara paling halus untuk kehilangan arsip.
 */
function kelompokBulan(daftar: any[]) {
  const wadah = new Map<string, any[]>();
  daftar.forEach((d) => {
    const t = String(d.tanggal || "");
    const kunci = /^\d{4}-\d{2}/.test(t) ? t.slice(0, 7) : "";
    if (!wadah.has(kunci)) wadah.set(kunci, []);
    wadah.get(kunci)!.push(d);
  });
  return Array.from(wadah.entries())
    .sort((x, y) => (x[0] ? (y[0] ? y[0].localeCompare(x[0]) : -1) : 1))
    .map(([kunci, isi]) => ({
      kunci: kunci || "tanpa",
      label: kunci ? bulanIndo(kunci) : "Tanpa tanggal",
      isi: isi.slice().sort((m, n) =>
        (n.tanggal || n.dibuatPada || "").localeCompare(m.tanggal || m.dibuatPada || "")),
    }));
}

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
  dokumen: {
    jumlah: number; berkas: number; tanpaBerkas: number; terbaru: string; daftar: any[];
    /* kiriman borang bulanan — larik terpisah dari `daftar`, lihat catatan di
       src/app/api/armada-data/route.ts */
    borang: any[]; jumlahBorang: number; berkasBorang: number;
  };
}

const waktu = (iso: string) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "belum pernah";

const pendek = (k: string) => k.replace(/^KMP\.?\s*/i, "");

export default function DataIsianKapal() {
  const [armada, setArmada] = useState<DataKapal[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  /* dokumen jadi tampilan bawaan: itu yang paling sering dicari dari layar ini */
  const [rupa, setRupa] = useState<"stok" | "alkes" | "dokumen">("dokumen");
  /** kapan jawaban terakhir sampai — supaya halaman basi bisa dikenali */
  const [dimuatPada, setDimuatPada] = useState<Date | null>(null);
  const [buka, setBuka] = useState("");
  /*
   * Borang unggah kantor. Isinya nama kapal yang sedang dituju — "" berarti
   * tertutup, sedangkan tanda hubung berarti terbuka tanpa kapal terpilih
   * (dibuka dari tombol di kepala halaman, kapalnya dipilih di dalam borang).
   */
  const [unggah, setUnggah] = useState<string | null>(null);
  /* daftar per kapal menjawab "kapal ini kirim apa"; rekap menjawab "armada ini
     kurang apa" — dua pertanyaan berbeda yang tak muat di satu tabel */
  const [rekap, setRekap] = useState(false);
  /** dokumen yang sedang dibuka berkasnya, beserta berkas keberapa */
  const [lihat, setLihat] = useState<{ d: DokumenTampil; kapal: string; ke: number } | null>(null);
  /** pencarian di dalam satu kapal yang barisnya sedang terbuka */
  const [cariDok, setCariDok] = useState("");
  /* dikelompokkan per golongan, atau datar urut tanggal. Bawaannya
     berkelompok: yang dicari orang kantor hampir selalu "mana bukti
     drill-nya", bukan "apa yang terakhir masuk". */
  const [kelompokDok, setKelompokDok] = useState(true);
  /* borang bulanan ikut ditampilkan bersama arsip. Bawaannya IKUT: itu isi
     arsip kapal yang paling banyak, dan menyembunyikannya membuat kapal yang
     rajin mengirim borang terlihat seolah tidak pernah mengirim apa pun. */
  const [ikutBorang, setIkutBorang] = useState(true);
  const [kabar, setKabar] = useState("");

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

  /**
   * Hapus CATATAN dokumen; berkasnya tetap di Google Drive.
   *
   * Dipakai membereskan salah unggah dari kantor. Berkas aslinya sengaja tidak
   * ikut dihapus — satu salah pencet di layar kantor tidak boleh melenyapkan
   * dokumen kapal yang mungkin tidak ada salinannya di tempat lain.
   */
  const hapusDokumen = useCallback(async (id: string, judul: string) => {
    if (!window.confirm(`Hapus catatan "${judul}"?\n\nBerkasnya TETAP ada di Google Drive — yang hilang hanya catatannya di sini.`)) return;
    try {
      const r = await fetch(`/api/armada-data/dokumen?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Gagal menghapus");
      await ambil();
    } catch (e: any) { setGalat(e?.message || String(e)); }
  }, [ambil]);

  const jumlah = useMemo(() => ({
    stokKosong: armada.filter((a) => !a.stok.adaIsi).length,
    menipis: armada.reduce((n, a) => n + a.stok.menipis, 0),
    gantiDekat: armada.reduce((n, a) => n + a.stok.gantiDekat, 0),
    alkesKosong: armada.filter((a) => !a.alkes.adaIsi).length,
    lewat: armada.reduce((n, a) => n + a.alkes.lewat, 0),
    kritis: armada.reduce((n, a) => n + a.alkes.kritis, 0),
    dokKosong: armada.filter((a) => !a.dokumen?.jumlah).length,
    dokumen: armada.reduce((n, a) => n + (a.dokumen?.jumlah || 0), 0),
    dokBerkas: armada.reduce((n, a) => n + (a.dokumen?.berkas || 0), 0),
    dokPutus: armada.reduce((n, a) => n + (a.dokumen?.tanpaBerkas || 0), 0),
  }), [armada]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#16357f] text-white">
            <Ikon nama="kapal" className="h-5 w-5" />
          </span>
          <div className="min-w-[16rem] flex-1">
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Dokumen Kapal</h1>
            <p className="text-[11.5px] text-slate-500">
              Arsip berkas kapal di luar borang bulanan — plus stok filter dan alat kesehatan.
              Diisi awak lewat Portal Kapal, atau diunggah sendiri dari kantor.
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className={`h-1.5 w-1.5 rounded-full ${muat ? "animate-pulse bg-sky-500" : "bg-emerald-500"}`} />
              {muat ? "Menyegarkan…" : dimuatPada
                ? `Data per ${dimuatPada.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · menyegarkan sendiri tiap menit`
                : "Menunggu data"}
            </p>
          </div>
          <div className="flex overflow-hidden rounded-xl ring-1 ring-slate-300 dark:ring-slate-700">
            {([["dokumen", "Dokumen"], ["stok", "Stok Filter"], ["alkes", "Alat Kesehatan"]] as const).map(([id, l]) => (
              <button key={id} onClick={() => { setRupa(id); setBuka(""); }}
                className={`px-3 py-2 text-[11.5px] font-bold transition ${
                  rupa === id ? "bg-[#16357f] text-white" : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300"}`}>
                {l}
              </button>
            ))}
          </div>
          {rupa === "dokumen" && (
            <div className="flex overflow-hidden rounded-xl ring-1 ring-slate-300 dark:ring-slate-700">
              {([[false, "Per Kapal"], [true, "Rekap"]] as const).map(([id, l]) => (
                <button key={l} onClick={() => setRekap(id)}
                  className={`px-3 py-2 text-[11.5px] font-bold transition ${
                    rekap === id ? "bg-slate-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300"}`}>
                  {l}
                </button>
              ))}
            </div>
          )}
          {rupa === "dokumen" && (
            <button onClick={() => setUnggah("")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11.5px] font-bold text-white transition hover:bg-emerald-700">
              ⬆️ Unggah dokumen
            </button>
          )}
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
            : rupa === "alkes"
            ? [
              ["Kapal belum mengisi", jumlah.alkesKosong, "text-rose-700"],
              ["Alkes kedaluwarsa", jumlah.lewat, "text-rose-700"],
              ["Habis ≤ 30 hari", jumlah.kritis, "text-orange-700"],
              ["Kapal sudah mengisi", armada.length - jumlah.alkesKosong, "text-emerald-700"],
            ]
            : [
              ["Dokumen tersimpan", jumlah.dokumen, "text-[#16357f]"],
              ["Berkas di Drive", jumlah.dokBerkas, "text-emerald-700"],
              ["Unggahan terputus", jumlah.dokPutus, "text-amber-700"],
              ["Kapal belum mengunggah", jumlah.dokKosong, "text-rose-700"],
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
      {kabar && (
        <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800 ring-1 ring-emerald-200">{kabar}</p>
      )}

      {unggah !== null && (
        <UnggahDokumenKantor
          kapalAwal={unggah || undefined}
          onTutup={() => setUnggah(null)}
          onSelesai={(pesan) => { setKabar(pesan); window.setTimeout(() => setKabar(""), 6000); void ambil(); }}
        />
      )}

      {rupa === "dokumen" && rekap ? <RekapDokumen armada={armada} /> : (
      <ul className="space-y-2.5">
        {armada.map((a) => {
          const dok = a.dokumen || { jumlah: 0, berkas: 0, tanpaBerkas: 0, terbaru: "", daftar: [], borang: [], jumlahBorang: 0, berkasBorang: 0 };
          /* kapal yang cuma mengirim borang TIDAK lagi ditandai "belum ada
             dokumen": borangnya kini terbaca dari layar ini juga */
          const d = rupa === "stok" ? a.stok : rupa === "alkes" ? a.alkes
            : { adaIsi: dok.jumlah + dok.jumlahBorang > 0, diperbaruiPada: dok.terbaru, olehAkun: "" };
          const perhatian = rupa === "stok"
            ? a.stok.menipis + a.stok.gantiDekat
            : rupa === "alkes" ? a.alkes.lewat + a.alkes.kritis
            : dok.tanpaBerkas;
          const terbuka = buka === a.kapal;

          return (
            <li key={a.kapal} className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 dark:bg-slate-900 ${
              !d.adaIsi ? "ring-rose-300 dark:ring-rose-900" : perhatian ? "ring-amber-300 dark:ring-amber-900" : "ring-slate-200 dark:ring-slate-800"}`}>
              <button onClick={() => { setBuka(terbuka ? "" : a.kapal); setCariDok(""); }}
                className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <span className="min-w-[10rem] text-[15px] font-black tracking-tight text-slate-900 dark:text-white">
                  {pendek(a.kapal)}
                </span>

                {!d.adaIsi ? (
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-black text-rose-800 ring-1 ring-rose-300">
                    {rupa === "dokumen" ? "BELUM ADA DOKUMEN" : "BELUM PERNAH DIISI"}
                  </span>
                ) : rupa === "dokumen" ? (
                  <span className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{dok.jumlah} dokumen</span>
                    <span className="text-slate-500">{dok.berkas} berkas</span>
                    {!!dok.jumlahBorang && (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                        + {dok.jumlahBorang} borang
                      </span>
                    )}
                    {!!dok.tanpaBerkas && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-800">{dok.tanpaBerkas} unggahan putus</span>}
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

              {terbuka && (d.adaIsi || rupa === "dokumen") && (
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                  {rupa === "dokumen" ? (() => {
                    const k = cariDok.trim().toLowerCase();
                    /*
                     * ARSIP DAN BORANG DISATUKAN DI SINI, bukan di server.
                     *
                     * Di layar ini pertanyaannya "kapal ini pernah kirim apa
                     * saja" - dan pemisahan arsip lawan borang cuma nyata di
                     * dalam basis data. Penyatuannya ditaruh di peramban supaya
                     * Rekap Dokumen dan berkas Excel-nya tetap membaca `daftar`
                     * yang artinya tidak berubah.
                     */
                    const semua = ikutBorang ? dok.daftar.concat(dok.borang || []) : dok.daftar;
                    const tampil = semua.filter((x: any) =>
                      !k || `${x.judul} ${x.nomor} ${x.catatan} ${golonganDokumen(x.jenis)?.label || ""}`.toLowerCase().includes(k));
                    const kartu = (x: any) => (
                      <KartuDokumen key={x.id} d={x as DokumenTampil}
                        onLihat={(dd, ke) => setLihat({ d: dd, kapal: a.kapal, ke })}
                        /* borang dihapus dari layar Permintaan & Laporan, bukan
                           dari sini: yang dihapus di sana ikut riwayat status
                           dan tagihan bulanannya, yang dihapus di sini tidak */
                        onHapus={x.sumber === "borang" ? undefined : (dd) => hapusDokumen(dd.id, dd.judul)} />
                    );
                    return (
                    <>
                    <div className="mb-2.5 flex flex-wrap items-center gap-2">
                      <button onClick={() => setUnggah(a.kapal)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-emerald-700">
                        &#11014;&#65039; Unggah dokumen
                      </button>
                      {semua.length > 3 && (
                        <input value={cariDok} onChange={(e) => setCariDok(e.target.value)}
                          placeholder="Cari judul / nomor / golongan&#8230;"
                          className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[#16357f] dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
                      )}
                      <button onClick={() => setKelompokDok(!kelompokDok)}
                        title={kelompokDok ? "Tampilkan datar di dalam tiap bulan" : "Kelompokkan per golongan di dalam tiap bulan"}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-slate-600 transition hover:border-[#16357f] hover:text-[#16357f] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                        {kelompokDok ? "\u25a6 Per golongan" : "\u2261 Urut tanggal"}
                      </button>
                      {!!dok.jumlahBorang && (
                        <button onClick={() => setIkutBorang(!ikutBorang)}
                          title={ikutBorang ? "Sembunyikan kiriman borang bulanan" : "Tampilkan kiriman borang bulanan"}
                          className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold ring-1 transition ${
                            ikutBorang
                              ? "bg-violet-100 text-violet-800 ring-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800"
                              : "bg-white text-slate-500 ring-slate-300 hover:text-violet-700 dark:bg-slate-900 dark:ring-slate-600"}`}>
                          {ikutBorang ? "\u2713" : "\u25cb"} Borang bulanan
                        </button>
                      )}
                      <span className="text-[11.5px] text-slate-500">
                        {k
                          ? `${tampil.length} dari ${semua.length} catatan`
                          : `${dok.jumlah} dokumen${ikutBorang && dok.jumlahBorang ? ` + ${dok.jumlahBorang} borang` : ""} \u00b7 ${dok.berkas + (ikutBorang ? dok.berkasBorang : 0)} berkas`}
                      </span>
                    </div>

                    {!tampil.length ? (
                      <p className="rounded-xl bg-white px-4 py-8 text-center text-[12.5px] text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                        {semua.length
                          ? "Tidak ada yang cocok dengan pencarian."
                          : "Belum ada apa pun dari kapal ini \u2014 belum ada borang bulanan, belum ada berita acara, temuan, atau salinan sertifikat."}
                      </p>
                    ) : (
                      /* KLUSTER BULAN DI LUAR, GOLONGAN DI DALAM.
                         Urutannya sengaja begitu: arsip ditelusuri dengan
                         pertanyaan berwaktu ("Agustus kemarin apa saja"), dan
                         golongan baru berguna sesudah bulannya dipersempit.
                         Dibalik - golongan di luar, bulan di dalam - layarnya
                         jadi belasan daftar panjang yang tiap-tiapnya harus
                         digulung sendiri untuk menjawab satu pertanyaan. */
                      <div className="space-y-4">
                        {kelompokBulan(tampil).map(({ kunci, label, isi }) => (
                          <section key={kunci}>
                            <div className="mb-2 flex items-center gap-2">
                              <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11.5px] font-black uppercase tracking-wide text-white dark:bg-slate-700">
                                {label}
                              </span>
                              <span className="text-[11px] font-bold text-slate-400">{isi.length} catatan</span>
                              <span className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
                            </div>

                            {!kelompokDok ? (
                              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                                {isi.map(kartu)}
                              </div>
                            ) : (
                              /* URUTAN GOLONGAN MENGIKUTI GOLONGAN_ARSIP, BUKAN
                                 JUMLAHNYA. Kalau diurut dari yang terbanyak,
                                 letak "Bukti Perawatan" berpindah-pindah antar
                                 bulan dan orang harus membaca ulang tiap kali
                                 turun satu rumpun. Urutan tetap membuat matanya
                                 hafal, dan golongan yang KOSONG jadi terasa -
                                 itu justru yang perlu ditindaklanjuti. */
                              <div className="space-y-2.5 border-l-2 border-slate-200 pl-3 dark:border-slate-700">
                                {kelompokGolongan(isi).map(({ id, label: gl, ikon, warna, isi: gi }) => (
                                  <div key={id}>
                                    <div className="mb-1.5 flex items-center gap-2">
                                      <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-black ring-1 ${warna}`}>
                                        {ikon} {gl}
                                      </span>
                                      <span className="text-[11px] font-bold text-slate-400">{gi.length}</span>
                                    </div>
                                    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                                      {gi.map(kartu)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </section>
                        ))}
                      </div>
                    )}
                    </>
                    );
                  })() : rupa === "stok" ? (
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
      )}

      {lihat && (
        <PenampilDokumen
          judul={lihat.d.judul}
          kapal={lihat.kapal}
          golongan={golonganDokumen(lihat.d.jenis)?.label || lihat.d.jenis}
          berkas={lihat.d.berkas}
          mulai={lihat.ke}
          onTutup={() => setLihat(null)}
        />
      )}

      {muat && !armada.length && (
        <p className="rounded-2xl bg-white px-4 py-10 text-center text-[13px] text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900">Memuat…</p>
      )}
    </main>
  );
}
