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
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import {
  BerkasLapor, JENIS_LAPOR, KirimanLapor, STATUS_LAPOR, bulanIndo, labelJenis, singkatJenis,
  tautanWa, ukuranSingkat,
} from "@/lib/lapor/types";
import { konfirmasi } from "@/components/Konfirmasi";

const kelasStatus = (s: string) => STATUS_LAPOR.find((x) => x.id === s)?.kelas || "bg-slate-100 text-slate-700 ring-slate-200";
const labelStatus = (s: string) => STATUS_LAPOR.find((x) => x.id === s)?.label || s;
const waktuSingkat = (iso: string) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

function IsiPermintaanLaporanKapal() {
  const [baris, setBaris] = useState<KirimanLapor[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [kapal, setKapal] = useState("");
  const [jenis, setJenis] = useState("");
  const [status, setStatus] = useState("");
  const [periode, setPeriode] = useState("");
  const [cari, setCari] = useState("");
  const [buka, setBuka] = useState<KirimanLapor | null>(null);
  const [hapusBerkasId, setHapusBerkasId] = useState("");
  const [salin, setSalin] = useState("");
  const sp = useSearchParams();

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

  /**
   * Periode rekap punya state sendiri dan bawaannya BULAN BERJALAN. Sebelumnya
   * ia mengekor periode terbaru di data, sehingga satu ABK yang salah memilih
   * bulan membuat seluruh armada tampak belum menyetor.
   */
  const [periodeRekap, setPeriodeRekap] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const periodeMatriks = periodeRekap;

  // Kelengkapan diukur dari BERKAS yang sampai, bukan dari adanya catatan
  // kiriman. Kiriman yang berkasnya gagal naik tidak boleh tampil hijau —
  // itu justru membuat kantor mengira dokumen sudah ada padahal Drive kosong.
  const matriks = useMemo(() => {
    const peta = new Map<string, KirimanLapor[]>();
    baris.filter((b) => b.periode === periodeMatriks && b.berkas.length > 0).forEach((b) => {
      const k = `${b.kapal}|${b.jenis}`;
      peta.set(k, [...(peta.get(k) || []), b]);
    });
    return peta;
  }, [baris, periodeMatriks]);

  /** kiriman yang catatannya ada tapi berkasnya tidak pernah sampai */
  const gagalKirim = useMemo(
    () => baris.filter((b) => b.periode === periodeMatriks && b.berkas.length === 0),
    [baris, periodeMatriks]);

  const ubah = async (id: string, patch: Partial<KirimanLapor>) => {
    let d: any;
    try {
      const r = await fetch("/api/lapor/daftar", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      d = await r.json();
    } catch (e: any) {
      // Tanpa ini, catatan tindak lanjut hilang diam-diam saat jaringan putus.
      setGalat(e?.message || "Perubahan gagal disimpan. Periksa koneksi lalu ulangi.");
      return;
    }
    if (!d.ok) { setGalat(d.error || "Gagal menyimpan"); return; }
    setBaris((l) => l.map((x) => (x.id === id ? d.baris : x)));
    setBuka((x) => (x && x.id === id ? d.baris : x));
    window.dispatchEvent(new Event("pengingat:muat-ulang"));
  };

  const bukaKiriman = (b: KirimanLapor) => {
    setBuka(b);
    if (b.status === "baru") void ubah(b.id, { status: "dibaca" });
  };

  // Klik notifikasi lonceng membawa pengguna langsung ke kiriman yang tepat.
  // Alamatnya dibaca lewat useSearchParams supaya tetap bekerja ketika petugas
  // SUDAH berada di halaman ini — window.location tidak memicu efek apa pun
  // saat Next hanya mengganti query tanpa memuat ulang halaman.
  useEffect(() => {
    const id = sp.get("buka");
    if (!id) return;
    const ditemukan = baris.find((b) => b.id === id);
    if (!ditemukan) return;
    window.history.replaceState({}, "", window.location.pathname);
    bukaKiriman(ditemukan);
    // URL dibersihkan sebelum status diperbarui, sehingga efek tidak berulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baris, sp]);

  const hapus = async (b: KirimanLapor) => {
    if (!(await konfirmasi({
      nada: "bahaya", ikon: "🗂️", judul: "Hapus catatan kiriman?",
      pesan: `${singkatJenis(b.jenis)} · ${b.kapal} · ${bulanIndo(b.periode)}`,
      rincian: ["Catatan kiriman akan dihapus dari rekap kantor.", "Berkas di Google Drive tidak ikut terhapus."],
      tombolYa: "Hapus catatan",
    }))) return;
    let d: any;
    try {
      const r = await fetch(`/api/lapor/daftar?id=${b.id}`, { method: "DELETE" });
      d = await r.json();
    } catch (e: any) {
      setGalat(e?.message || "Kiriman gagal dihapus. Periksa koneksi lalu ulangi.");
      return;
    }
    if (!d.ok) { setGalat(d.error || "Gagal menghapus"); return; }
    setBaris((l) => l.filter((x) => x.id !== b.id));
    setBuka(null);
  };

  const hapusDokumen = async (b: KirimanLapor, f: BerkasLapor) => {
    if (!(await konfirmasi({
      nada: "bahaya", ikon: "🗑️", judul: "Hapus dokumen dari Google Drive?",
      pesan: f.nama,
      rincian: [
        `${singkatJenis(b.jenis)} · ${b.kapal} · ${bulanIndo(b.periode)}`,
        `Ukuran dokumen ${ukuranSingkat(f.ukuran)}.`,
      ],
      tegasan: "Dokumen akan dipindahkan ke Sampah Google Drive dan dihapus dari rekap ini.",
      tombolYa: "Hapus dokumen",
    }))) return;

    setHapusBerkasId(f.fileId);
    setGalat("");
    try {
      const r = await fetch("/api/lapor/daftar/berkas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, fileId: f.fileId }),
      });
      const d = await r.json();
      if (!d.ok) { setGalat(d.error || "Gagal menghapus dokumen"); return; }
      setBaris((l) => l.map((x) => (x.id === b.id ? { ...x, berkas: d.berkas } : x)));
      setBuka((x) => (x?.id === b.id ? { ...x, berkas: d.berkas } : x));
    } catch (e: any) {
      setGalat(e?.message || "Gagal menghapus dokumen");
    } finally {
      setHapusBerkasId("");
    }
  };

  const tautanLapor = typeof window !== "undefined" ? `${window.location.origin}/lapor` : "/lapor";
  const salinTautan = async () => {
    try { await navigator.clipboard.writeText(tautanLapor); setSalin("Tautan disalin"); }
    catch { setSalin(tautanLapor); }
    setTimeout(() => setSalin(""), 4000);
  };

  const ringkas = useMemo(() => {
    const kiriman = baris.filter((b) => b.periode === periodeMatriks);
    let kapalMengirim = 0;
    let kapalLengkap = 0;
    let slotTerisi = 0;
    for (const k of KAPAL_ANGGARAN) {
      const isi = JENIS_LAPOR.filter((j) => matriks.get(`${k}|${j.id}`)?.length).length;
      if (isi > 0) kapalMengirim++;
      if (isi === JENIS_LAPOR.length) kapalLengkap++;
      slotTerisi += isi;
    }
    const totalSlot = KAPAL_ANGGARAN.length * JENIS_LAPOR.length;
    return {
      kiriman: kiriman.length,
      kapalMengirim,
      kapalLengkap,
      slotTerisi,
      totalSlot,
      persen: totalSlot ? Math.round((slotTerisi / totalSlot) * 100) : 0,
      berkas: kiriman.reduce((s, b) => s + b.berkas.length, 0),
    };
  }, [baris, matriks, periodeMatriks]);
  const jumlahBaru = baris.filter((b) => b.status === "baru").length;

  const saringanAktif = !!(cari || kapal || jenis || status || periode);
  const bersihkanSaringan = () => { setCari(""); setKapal(""); setJenis(""); setStatus(""); setPeriode(""); };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="asdp-gradient mb-5 rounded-[1.75rem] p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow flex flex-wrap items-center gap-4 rounded-[calc(1.75rem-1.5px)] px-5 py-5 sm:px-6">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-800 text-2xl text-white shadow-lg shadow-sky-900/20">📨</div>
          <div className="min-w-[16rem] flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-sky-800 ring-1 ring-sky-200">Pusat Laporan Armada</span>
              <span className="text-[10px] font-medium text-slate-400">Google Drive tersinkron</span>
              {jumlahBaru > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-extrabold text-rose-700 ring-1 ring-rose-200">● {jumlahBaru} KIRIMAN BARU</span>}
            </div>
            <h1 className="text-2xl font-extrabold asdp-text-gradient leading-tight">Permintaan &amp; Laporan Kapal</h1>
            <p className="mt-0.5 text-sm text-slate-500">Pantau kelengkapan kiriman ABK, tindak lanjut, dan berkas kapal dalam satu rekap.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={salinTautan} className="btn bg-slate-900 text-xs text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600">
              🔗 Salin tautan ABK
            </button>
            <Link href="/lapor" target="_blank" className="btn btn-ghost text-xs">👁 Halaman kirim</Link>
            <button onClick={ambil} disabled={muat} className="btn btn-primary text-xs disabled:opacity-50">
              {muat ? "Memuat…" : "⟳ Muat ulang"}
            </button>
          </div>
        </div>
      </header>
      {salin && <div className="anim-in mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">✓ {salin}</div>}
      {galat && <div className="anim-in mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{galat}</div>}
      {jumlahBaru > 0 && (
        <button onClick={() => { setStatus("baru"); window.setTimeout(() => document.getElementById("daftar-kiriman")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }} className="anim-in mb-4 flex w-full flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-emerald-800 dark:bg-emerald-950/35">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-emerald-500 text-lg text-white shadow-sm">
            📨<span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[8px] font-extrabold text-white ring-2 ring-emerald-50">{jumlahBaru}</span>
          </span>
          <span className="flex-1">
            <span className="block text-xs font-extrabold text-emerald-900 dark:text-emerald-200">Ada {jumlahBaru} kiriman kapal baru</span>
            <span className="block text-[10px] text-emerald-700 dark:text-emerald-400">Buka kiriman untuk menandainya sudah dibaca dan menindaklanjuti berkas.</span>
          </span>
          <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">LIHAT SEKARANG →</span>
        </button>
      )}

      {/* ── matriks kelengkapan ───────────────────────────────────────────── */}
      <section className="mb-5 overflow-hidden rounded-3xl bg-white elev-md ring-line anim-in dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-sky-50/70 px-4 py-4 sm:px-5 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#16357f] text-sm text-white shadow-sm">✓</span>
                <div>
                  <h2 className="font-extrabold text-slate-900">Rekap Kelengkapan Armada</h2>
                  <p className="text-[11px] text-slate-500">Empat dokumen wajib untuk setiap kapal dan periode laporan.</p>
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 shadow-sm dark:bg-slate-800 dark:ring-slate-700">
              <span className="text-slate-400">Periode</span>
              <select value={periodeMatriks} onChange={(e) => setPeriodeRekap(e.target.value)} className="bg-transparent font-bold text-[#16357f] outline-none dark:text-sky-300">
                {(periodeAda.includes(periodeMatriks) ? periodeAda : [periodeMatriks, ...periodeAda])
                  .map((p) => <option key={p} value={p}>{bulanIndo(p)}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiRekap ikon="🚢" label="Kapal Mengirim" nilai={`${ringkas.kapalMengirim}/${KAPAL_ANGGARAN.length}`} ket={`${ringkas.kapalLengkap} kapal lengkap`} warna="sky" />
            <KpiRekap ikon="✓" label="Dokumen Diterima" nilai={`${ringkas.slotTerisi}/${ringkas.totalSlot}`} ket={`${ringkas.persen}% kelengkapan`} warna="emerald" />
            <KpiRekap ikon="📨" label="Kiriman Masuk" nilai={String(ringkas.kiriman)} ket={bulanIndo(periodeMatriks)} warna="indigo" />
            <KpiRekap ikon="📎" label="Berkas Drive" nilai={String(ringkas.berkas)} ket="lampiran tersimpan" warna="amber" />
          </div>

          {gagalKirim.length > 0 && (
        <button
          onClick={() => { setStatus(""); setPeriode(periodeMatriks); setCari(""); setKapal(""); setJenis(""); }}
          className="anim-in mb-4 flex w-full flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-left shadow-sm transition hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950/30">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500 text-lg text-white">⚠</span>
          <span className="flex-1">
            <span className="block text-xs font-extrabold text-amber-900 dark:text-amber-200">
              {gagalKirim.length} kiriman {bulanIndo(periodeMatriks)} tidak membawa berkas
            </span>
            <span className="block text-[10px] text-amber-800 dark:text-amber-300">
              Unggahan ABK putus di tengah jalan. Kiriman ini TIDAK dihitung sebagai dokumen diterima.
              {gagalKirim[0]?.galatUnggah ? ` Sebab terakhir: ${gagalKirim[0].galatUnggah}` : ""}
            </span>
          </span>
          <span className="text-[10px] font-extrabold text-amber-800 dark:text-amber-300">LIHAT →</span>
        </button>
      )}

      <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 ring-1 ring-inset ring-slate-300/60 dark:bg-slate-700 dark:ring-slate-600">
              <div className="h-full rounded-full bg-gradient-to-r from-[#14b8c4] via-[#1ca3dd] to-[#16357f] transition-all duration-500" style={{ width: `${ringkas.persen}%` }} />
            </div>
            <span className="min-w-[5.5rem] text-right text-[10px] font-bold tabular-nums text-slate-600 dark:text-slate-300">{ringkas.slotTerisi} dari {ringkas.totalSlot} slot</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[68rem] border-separate border-spacing-0 text-sm">
            <thead className="bg-slate-100/90 text-[10px] font-extrabold uppercase tracking-[0.09em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="sticky left-0 z-10 min-w-[12rem] border-b border-slate-200 bg-slate-100 px-4 py-3 text-left dark:border-slate-700 dark:bg-slate-800">Kapal</th>
                <th className="w-28 border-b border-slate-200 px-3 py-3 text-left dark:border-slate-700">Progres</th>
                {JENIS_LAPOR.map((j) => <th key={j.id} className="min-w-[11rem] border-b border-slate-200 px-3 py-3 text-center dark:border-slate-700"><span className="mr-1">{j.ikon}</span>{j.singkat}</th>)}
              </tr>
            </thead>
            <tbody>
              {KAPAL_ANGGARAN.map((k, index) => {
                const jumlahIsi = JENIS_LAPOR.filter((j) => matriks.get(`${k}|${j.id}`)?.length).length;
                const lengkap = jumlahIsi === JENIS_LAPOR.length;
                return (
                  <tr key={k} className="group hover:bg-sky-50/60 dark:hover:bg-sky-950/25">
                    <td className={`sticky left-0 z-[5] border-b border-slate-100 px-4 py-2.5 font-bold text-slate-800 group-hover:bg-sky-50 dark:border-slate-800 dark:text-slate-100 dark:group-hover:bg-sky-950 ${index % 2 ? "bg-slate-50/95 dark:bg-slate-900" : "bg-white dark:bg-slate-900"}`}>
                      <span className="mr-2 text-[10px] font-medium tabular-nums text-slate-400">{String(index + 1).padStart(2, "0")}</span>{k}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div className={`h-full rounded-full ${lengkap ? "bg-emerald-500" : jumlahIsi ? "bg-sky-500" : "bg-slate-300 dark:bg-slate-600"}`} style={{ width: `${(jumlahIsi / JENIS_LAPOR.length) * 100}%` }} />
                        </div>
                        <span className={`w-7 text-right text-[10px] font-extrabold tabular-nums ${lengkap ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500"}`}>{jumlahIsi}/4</span>
                      </div>
                    </td>
                    {JENIS_LAPOR.map((j) => {
                      const isi = matriks.get(`${k}|${j.id}`) || [];
                      const adaBaru = isi.some((x) => x.status === "baru");
                      const utama = isi.find((x) => x.status === "baru") || isi[0];
                      return (
                        <td key={j.id} className="border-b border-slate-100 px-3 py-2 text-center dark:border-slate-800">
                          {isi.length ? (
                            <button onClick={() => bukaKiriman(utama)}
                              className={`relative inline-flex min-w-[6.5rem] items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold ring-1 transition hover:-translate-y-0.5 hover:shadow-sm ${adaBaru ? "bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-800" : "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800"}`}>
                              <span className={`grid h-4 w-4 place-items-center rounded-full text-[9px] text-white ${adaBaru ? "bg-rose-500" : "bg-emerald-500"}`}>{adaBaru ? "!" : "✓"}</span>
                              {adaBaru ? "Baru" : isi.length > 1 ? `${isi.length} kiriman` : "Diterima"}
                              {adaBaru && <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />}
                            </button>
                          ) : (
                            <span className="inline-flex min-w-[6.5rem] items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" /> Belum
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 px-4 py-3 text-[10px] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <span><b className="text-slate-700 dark:text-slate-200">Diterima</b> dapat diklik untuk membuka kiriman terbaru pada slot tersebut.</span>
          <span className={`rounded-full px-2 py-0.5 font-bold ring-1 ${ringkas.kapalLengkap === KAPAL_ANGGARAN.length ? "bg-emerald-100 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>
            {KAPAL_ANGGARAN.length - ringkas.kapalLengkap} kapal belum lengkap
          </span>
        </div>
      </section>

      {/* ── saringan ──────────────────────────────────────────────────────── */}
      <section id="daftar-kiriman" className="mb-4 scroll-mt-4 rounded-2xl bg-white p-3 elev-sm ring-line dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">Daftar Kiriman</h2>
            <p className="text-[10px] text-slate-500">Telusuri kiriman, berkas, status, dan tindak lanjut ABK.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:ring-sky-800">{tampil.length} dari {baris.length} kiriman</span>
            {saringanAktif && <button onClick={bersihkanSaringan} className="text-[10px] font-bold text-slate-500 hover:text-rose-600">✕ Reset filter</button>}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-12">
          <label className="relative lg:col-span-4">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">⌕</span>
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama, catatan, atau berkas…"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700" />
          </label>
          <select value={kapal} onChange={(e) => setKapal(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm lg:col-span-2 dark:border-slate-700">
            <option value="">Semua kapal</option>
            {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm lg:col-span-2 dark:border-slate-700">
            <option value="">Semua jenis</option>
            {JENIS_LAPOR.map((j) => <option key={j.id} value={j.id}>{j.singkat}</option>)}
          </select>
          <select value={periode} onChange={(e) => setPeriode(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm lg:col-span-2 dark:border-slate-700">
            <option value="">Semua bulan</option>
            {periodeAda.map((p) => <option key={p} value={p}>{bulanIndo(p)}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm lg:col-span-2 dark:border-slate-700">
            <option value="">Semua status</option>
            {STATUS_LAPOR.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </section>

      {/* ── daftar kiriman ────────────────────────────────────────────────── */}
      {muat ? (
        <div className="grid gap-2" aria-label="Memuat daftar kiriman">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/75 ring-1 ring-slate-200 dark:bg-slate-900/75 dark:ring-slate-800" />)}
        </div>
      ) : !tampil.length ? (
        <div className="rounded-3xl bg-white p-10 text-center elev-sm ring-line dark:bg-slate-900">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-xl dark:bg-slate-800">📭</div>
          <p className="mt-3 font-bold text-slate-700">Belum ada kiriman{baris.length ? " yang cocok" : ""}</p>
          <p className="mt-1 text-xs text-slate-500">
            {baris.length ? "Ubah atau reset filter untuk melihat data lainnya." : "Bagikan tautan pengiriman kepada ABK kapal untuk mulai menerima laporan."}
          </p>
          {saringanAktif && <button onClick={bersihkanSaringan} className="btn btn-ghost mt-3 text-xs">Reset filter</button>}
        </div>
      ) : (
        <div className="grid gap-2.5 stagger">
          {tampil.map((b) => {
            const metaJenis = JENIS_LAPOR.find((j) => j.id === b.jenis);
            return (
              <article key={b.id} className="group relative overflow-hidden rounded-2xl bg-white p-4 elev-sm ring-line transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900">
                <span className={`absolute inset-y-0 left-0 w-1 ${b.status === "selesai" ? "bg-emerald-500" : b.status === "baru" ? "bg-rose-500" : b.status === "ditindaklanjuti" ? "bg-amber-500" : "bg-slate-300"}`} />
                <div className="flex flex-wrap items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">{metaJenis?.ikon || "📄"}</div>
                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-slate-900">{b.kapal}</h3>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">{singkatJenis(b.jenis)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${kelasStatus(b.status)}`}>{labelStatus(b.status)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">📅 {bulanIndo(b.periode)}</span>
                      <span>👤 {b.pengirim}{b.jabatan ? ` · ${b.jabatan}` : ""}</span>
                      <span>🕘 {waktuSingkat(b.dikirimPada)}</span>
                    </div>
                    {b.catatan && <p className="mt-1.5 line-clamp-1 text-xs text-slate-500">{b.catatan}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ring-1 ${
                      b.berkas.length
                        ? "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                        : "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900"}`}>
                      {b.berkas.length ? `📎 ${b.berkas.length} berkas` : "⚠ belum ada berkas"}
                    </span>
                    <button onClick={() => bukaKiriman(b)} className="btn btn-primary text-xs">Buka detail →</button>
                  </div>
                </div>
              </article>
            );
          })}
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
                {!buka.berkas.length ? (
                  <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900">
                    <b>Belum ada berkas yang sampai.</b> Unggahan ABK terputus sebelum selesai.
                    {buka.galatUnggah && <span className="mt-1 block text-xs">Sebab terakhir: {buka.galatUnggah}</span>}
                    <span className="mt-1 block text-xs">Minta pengirim membuka kembali tautan Lapor Kapal dan menekan kirim ulang.</span>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {buka.berkas.map((f) => (
                      <li key={f.fileId} className="flex items-center gap-2 bg-slate-50 ring-1 ring-slate-200 rounded-lg px-3 py-2 text-sm">
                        <span className="truncate flex-1">{f.nama}</span>
                        <span className="text-xs text-slate-500 shrink-0">{ukuranSingkat(f.ukuran)}</span>
                        <a href={f.url} target="_blank" rel="noopener noreferrer"
                           className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5">Buka</a>
                        <button type="button" onClick={() => hapusDokumen(buka, f)}
                          disabled={Boolean(hapusBerkasId)}
                          aria-label={`Hapus dokumen ${f.nama}`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50 hover:ring-rose-300 disabled:cursor-wait disabled:opacity-50">
                          {hapusBerkasId === f.fileId ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-rose-200 border-t-rose-600" aria-hidden="true" />
                          ) : (
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          {hapusBerkasId === f.fileId ? "Menghapus…" : "Hapus"}
                        </button>
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
                {/* tautanWa() menuju nomor KANTOR — untuk membalas pengirim, yang
                    dipakai harus nomornya sendiri. Kalau tidak ada, tombolnya
                    tidak ditampilkan daripada menelepon diri sendiri. */}
                {buka.kontak && (
                  <a href={`https://wa.me/${buka.kontak.replace(/\D/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(`Halo ${buka.pengirim}, ${labelJenis(buka.jenis)} ${buka.kapal} periode ${bulanIndo(buka.periode)} sudah kami terima.`)}`}
                     target="_blank" rel="noopener noreferrer"
                     className="rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2.5">💬 Balas ke pengirim</a>
                )}
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

function KpiRekap({ ikon, label, nilai, ket, warna }: {
  ikon: string; label: string; nilai: string; ket: string; warna: "sky" | "emerald" | "indigo" | "amber";
}) {
  const tema = {
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  }[warna];
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/85 px-3 py-2.5 ring-1 ring-slate-200 shadow-sm dark:bg-slate-800/80 dark:ring-slate-700">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-black ${tema}`}>{ikon}</span>
      <div className="min-w-0">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.11em] text-slate-400">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <strong className="text-lg font-extrabold leading-none tabular-nums text-slate-900">{nilai}</strong>
          <span className="truncate text-[9px] text-slate-400">{ket}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * useSearchParams menuntut batas Suspense saat halaman dirender di server.
 */
export default function PermintaanLaporanKapal() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-7xl px-4 py-10 text-slate-500">Memuat…</main>}>
      <IsiPermintaanLaporanKapal />
    </Suspense>
  );
}
