"use client";
/**
 * MONITORING PERMINTAAN KAPAL — keputusan kantor atas tiap permintaan kapal.
 *
 * Disusun seperti kotak masuk surat, bukan tumpukan barang:
 *  · Deck dan Mesin dipisah sejak awal.
 *  · Satu KARTU = satu permintaan (satu kiriman ABK / satu input kantor),
 *    diurutkan menurut tanggalnya. Barangnya ada di dalam kartu.
 *  · Langkah kerja: Perlu dinilai → Disetujui → Sedang diadakan → Selesai.
 *  · Menilai = satu klik Setuju / Tunda / Tolak; saran prioritas &
 *    klasifikasi dari mesin ikut terkunci saat diputuskan.
 *  · Kantor bisa menambah permintaan sendiri (WA, kertas, telepon) dan
 *    menambah barang yang terlewat pada permintaan yang sudah ada.
 * Tanpa angka rupiah di layar; taksiran hanya dibawa ke borang SPPBJ.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { titipkanKeSppbj } from "@/lib/lapor/bacaPermintaan";
import { KirimanLapor, bulanIndo } from "@/lib/lapor/types";
import { tanggalIndo } from "@/lib/format";
import { ringkasKapal } from "@/lib/kapal/nama";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { angkaRupiah } from "@/lib/permintaanMonitor/logika";
import {
  AWALAN_MANUAL, BATAS_MENGGANTUNG_HARI, BarisMonitor, KEPUTUSAN, KETERANGAN_CEPAT, KLASIFIKASI, Klasifikasi, PRIORITAS,
  PermohonanRingkas, Prioritas, TAHAP, Tahap,
} from "@/lib/permintaanMonitor/types";
import { BarangInput, Patch, taksirUntukSppbj, unduhExcel, useMonitorPermintaan } from "@/lib/permintaanMonitor/useMonitor";
import { beritahu, konfirmasi } from "@/components/Konfirmasi";

type Bagian = "mesin" | "deck";
type Langkah = "nilai" | "pusat" | "siap" | "proses" | "selesai" | "tunda";
type ModeUsul = "usul" | "setuju";

const LANGKAH: { id: Langkah; no: number; label: string; ket: string; tahap: Tahap[] }[] = [
  { id: "nilai", no: 1, label: "Perlu dinilai", ket: "Belum diputuskan kantor", tahap: ["baru", "menunggu"] },
  { id: "pusat", no: 2, label: "Usulan Pusat", ket: "Barang investasi: diusulkan ke Pusat, menunggu persetujuan / No. IO", tahap: ["usul", "pusat", "io"] },
  { id: "siap", no: 3, label: "Siap diadakan", ket: "Siap dibuatkan SPPBJ / dikirim dari stok", tahap: ["disetujui", "stok"] },
  { id: "proses", no: 4, label: "Sedang diadakan", ket: "Sudah SPPBJ / SPBJ / Non PR PO", tahap: ["sppbj", "spbj"] },
  { id: "selesai", no: 5, label: "Selesai", ket: "Pengadaan tuntas / diterima kapal", tahap: ["selesai"] },
  { id: "tunda", no: 0, label: "Ditunda / ditolak", ket: "", tahap: ["ditunda", "ditolak"] },
];
const langkahDari = (t: Tahap): Langkah => LANGKAH.find((l) => l.tahap.includes(t))?.id || "nilai";
const bagianDari = (jenis: string): Bagian => (String(jenis).endsWith("deck") ? "deck" : "mesin");
const urutPrioritas = (p: Prioritas) => (p === "urgent" ? 0 : p === "normal" ? 1 : 2);
const PER_HALAMAN = 25;

/** judul permintaan dari nama berkas ABK: "2026-08 - Permintaan Mesin - KMP. X - Permintaan filter ME - 20260804-143741.pdf" */
const judulBerkas = (nama: string) =>
  String(nama || "").replace(/\.[a-z0-9]+$/i, "").replace(/^\d{4}-\d{2}(-\d{2})?\s*-\s*[^-]+-\s*KMP\.?\s*[^-]+-\s*/i, "")
    .replace(/\s*-\s*\d{8}-\d{6}$/, "").trim() || nama;

const umurDari = (iso: string) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : 0);

interface Kartu {
  k: KirimanLapor;
  semua: BarisMonitor[];
  tampil: BarisMonitor[];
  belumTerbaca: number;
}

export default function Halaman() {
  return <Suspense fallback={<main className="p-8 text-sm text-slate-500">Memuat…</main>}><Monitoring /></Suspense>;
}

function Monitoring() {
  const router = useRouter();
  const sp = useSearchParams();
  const m = useMonitorPermintaan();
  const [bagian, setBagian] = useState<Bagian>("mesin");
  const [langkah, setLangkah] = useState<Langkah>("nilai");
  const [kapal, setKapal] = useState("");
  const [hanyaGantung, setHanyaGantung] = useState(false);
  const [bulan, setBulan] = useState("");
  const [cari, setCari] = useState("");
  const [terlamaDulu, setTerlamaDulu] = useState(false);
  const [batas, setBatas] = useState(PER_HALAMAN);
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState("");
  const [formBaru, setFormBaru] = useState(false);
  const [formTambah, setFormTambah] = useState<KirimanLapor | null>(null);
  const [unduh, setUnduh] = useState(false);
  const [sibukSppbj, setSibukSppbj] = useState(false);
  const [formUsul, setFormUsul] = useState<{ daftar: BarisMonitor[]; mode: ModeUsul } | null>(null);
  const [bukaBelumBaca, setBukaBelumBaca] = useState(false);

  /* tautan dari lonceng & dashboard: ?bagian=deck&saring=menggantung&kapal=KMP. X */
  useEffect(() => {
    const b = sp.get("bagian"); if (b === "deck" || b === "mesin") setBagian(b);
    const s = sp.get("saring");
    if (s === "menggantung") setHanyaGantung(true);
    if (s === "belum" || s === "perlu") setLangkah("nilai");
    if (s === "proses") setLangkah("proses");
    const k = sp.get("kapal"); if (k) setKapal(k);
  }, [sp]);

  useEffect(() => { setPilih(new Set()); setBatas(PER_HALAMAN); }, [bagian, langkah, kapal, hanyaGantung, bulan]);

  const daftarBulan = useMemo(
    () => Array.from(new Set(m.kiriman.map((k) => (k.dikirimPada || "").slice(0, 7)).filter(Boolean))).sort().reverse(), [m.kiriman]);

  /* barang per kiriman */
  const perKiriman = useMemo(() => {
    const g = new Map<string, BarisMonitor[]>();
    m.baris.forEach((b) => g.set(b.kirimanId, [...(g.get(b.kirimanId) || []), b]));
    return g;
  }, [m.baris]);

  const cocokCari = (b: BarisMonitor) => {
    if (!cari.trim()) return true;
    const t = `${b.nama} ${b.spesifikasi} ${b.keterangan} ${b.ev?.catatan || ""} ${b.pengadaan?.nomor || ""}`.toLowerCase();
    return cari.toLowerCase().split(/\s+/).filter(Boolean).every((k) => t.includes(k));
  };
  const lolosItem = (b: BarisMonitor) => (hanyaGantung ? b.menggantung : langkahDari(b.tahap) === langkah) && cocokCari(b);

  /* kartu permintaan untuk bagian ini — sebelum saringan kapal (dipakai menghitung chip kapal) */
  const kartuBagian = useMemo<Kartu[]>(() => m.kiriman
    .filter((k) => bagianDari(k.jenis) === bagian && (!bulan || (k.dikirimPada || "").startsWith(bulan)))
    .map((k) => {
      const semua = perKiriman.get(k.id) || [];
      const belumTerbaca = (k.berkas || []).filter((f) => m.statusBerkas.get(f.fileId) !== "selesai").length;
      const tampil = semua.filter(lolosItem)
        .sort((a, b) => Number(b.menggantung) - Number(a.menggantung) || urutPrioritas(a.prioritas) - urutPrioritas(b.prioritas));
      return { k, semua, tampil, belumTerbaca };
    })
    // kiriman yang belum terbaca sama sekali tetap tampil di langkah 1 — supaya tak terlupa
    .filter((x) => x.tampil.length > 0 || (langkah === "nilai" && !hanyaGantung && !cari && x.semua.length === 0 && x.belumTerbaca > 0)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [m.kiriman, perKiriman, m.statusBerkas, bagian, bulan, langkah, hanyaGantung, cari]);

  const chipKapal = useMemo(() => {
    const g = new Map<string, { n: number; gantung: number }>();
    kartuBagian.forEach((x) => {
      const c = g.get(x.k.kapal) || { n: 0, gantung: 0 };
      c.n += x.tampil.length || 0; c.gantung += x.tampil.filter((b) => b.menggantung).length;
      g.set(x.k.kapal, c);
    });
    return Array.from(g.entries()).sort((a, b) => b[1].gantung - a[1].gantung || a[0].localeCompare(b[0], "id"));
  }, [kartuBagian]);

  const kartu = useMemo(() => kartuBagian
    .filter((x) => !kapal || x.k.kapal === kapal)
    .sort((a, b) => (terlamaDulu ? 1 : -1) * (a.k.dikirimPada || "").localeCompare(b.k.dikirimPada || "")),
  [kartuBagian, kapal, terlamaDulu]);

  /* angka di tab bagian & langkah (mengikuti saringan bulan) */
  const hit = useMemo(() => {
    const h = {
      mesin: { nilai: 0, gantung: 0 }, deck: { nilai: 0, gantung: 0 },
      langkah: Object.fromEntries(LANGKAH.map((l) => [l.id, 0])) as Record<Langkah, number>, gantung: 0,
    };
    m.baris.forEach((b) => {
      if (bulan && !(b.dikirimPada || "").startsWith(bulan)) return;
      const g = h[bagianDari(b.jenis)];
      if (langkahDari(b.tahap) === "nilai") g.nilai++;
      if (b.menggantung) g.gantung++;
      if (bagianDari(b.jenis) === bagian && (!kapal || b.kapal === kapal)) {
        h.langkah[langkahDari(b.tahap)]++;
        if (b.menggantung) h.gantung++;
      }
    });
    return h;
  }, [m.baris, bulan, bagian, kapal]);

  /* kiriman yang belum terbaca sama sekali dipisah — kartu kosong di daftar utama hanya mengganggu */
  const kartuIsi = useMemo(() => kartu.filter((x) => x.tampil.length > 0), [kartu]);
  const belumBaca = useMemo(() => kartu.filter((x) => x.tampil.length === 0), [kartu]);
  const tampilSemua = useMemo(() => kartu.flatMap((x) => x.tampil), [kartu]);
  const terpilih = useMemo(() => tampilSemua.filter((b) => pilih.has(b.kunci)), [tampilSemua, pilih]);
  const alih = (k: string) => setPilih((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const alihBanyak = (d: BarisMonitor[]) => setPilih((s) => {
    const n = new Set(s); const penuh = d.every((b) => n.has(b.kunci));
    d.forEach((b) => (penuh ? n.delete(b.kunci) : n.add(b.kunci))); return n;
  });

  /* ── aksi ─────────────────────────────────────────────────────────────── */

  const pastikanNama = async () => {
    if (m.penilai.trim()) return true;
    const n = window.prompt("Nama Anda (dicatat di riwayat keputusan, diingat di peramban ini):", "");
    if (!n?.trim()) { void beritahu("Isi nama dulu supaya riwayat keputusan jelas siapa yang memutuskan."); return false; }
    m.gantiPenilai(n.trim()); return true;
  };
  const ubah = async (d: BarisMonitor[], patch: Patch) => { if (await pastikanNama()) m.terapkan(d, patch); };
  const putus = async (d: BarisMonitor[], k: "setuju" | "tunda" | "tolak") => {
    if (!d.length || !(await pastikanNama())) return;
    m.putuskan(d, k); setPilih(new Set());
  };
  const diterima = async (d: BarisMonitor[]) => {
    if (!d.length || !(await pastikanNama())) return;
    m.terapkan(d, { diterima: new Date().toISOString().slice(0, 10) }); setPilih(new Set());
  };
  const kembalikan = async (d: BarisMonitor[]) => {
    if (!d.length || !(await pastikanNama())) return;
    if (!(await konfirmasi(`Kembalikan ${d.length} barang ke "Perlu dinilai"?`))) return;
    m.terapkan(d, { keputusan: "", diterima: "" }); setPilih(new Set());
  };

  const keSppbj = async () => {
    const kp = Array.from(new Set(terpilih.map((b) => b.kapal)));
    if (kp.length !== 1) { void beritahu("Satu SPPBJ untuk satu kapal. Pilih barang dari satu kapal saja."); return; }
    if (!(await pastikanNama())) return;
    setSibukSppbj(true);
    try {
      const taksir = await taksirUntukSppbj(terpilih);
      const baris = terpilih.map((b) => ({
        nama: b.nama, spesifikasi: b.spesifikasi, jumlah: b.jumlah, satuan: b.satuan, keterangan: b.keterangan,
        hargaSatuan: angkaRupiah(b.hargaManual) || taksir[b.kunci] || 0,
      }));
      if (!titipkanKeSppbj(kp[0], baris, `Permintaan ${bagian} — ${kp[0]}`)) return;
      setPilih(new Set());
      router.push("/sppbj/isi?dari=permintaan");
    } finally { setSibukSppbj(false); }
  };

  const ekspor = async () => {
    const d = m.baris.filter((b) => bagianDari(b.jenis) === bagian && (!bulan || (b.dikirimPada || "").startsWith(bulan)));
    if (!d.length || unduh) return;
    setUnduh(true);
    try { await unduhExcel(d, [bagian === "mesin" ? "Mesin" : "Deck", bulan ? bulanIndo(bulan) : ""].filter(Boolean).join(" - ")); }
    catch (e: any) { void beritahu(e?.message || String(e)); }
    finally { setUnduh(false); }
  };

  /** form usulan Pusat: "usul" untuk yang belum diusulkan, "setuju" untuk mencatat persetujuan / No. IO */
  const bukaUsul = async (d: BarisMonitor[]) => {
    if (!d.length || !(await pastikanNama())) return;
    const usul = d.filter((b) => b.tahap === "usul");
    setFormUsul(usul.length ? { daftar: usul, mode: "usul" } : { daftar: d.filter((b) => b.tahap === "pusat" || b.tahap === "io"), mode: "setuju" });
  };

  /** daftar barang investasi yang perlu diusulkan — bahan surat usulan / borang IO ke Pusat */
  const unduhUsulan = () => {
    const d = m.baris.filter((b) => bagianDari(b.jenis) === bagian && b.tahap === "usul" && (!kapal || b.kapal === kapal))
      .sort((a, b) => a.kapal.localeCompare(b.kapal, "id") || (a.dikirimPada || "").localeCompare(b.dikirimPada || ""));
    if (!d.length) { void beritahu("Belum ada barang investasi yang perlu diusulkan."); return; }
    const kol = ["No", "Kapal", "Nama barang", "Spesifikasi", "Jumlah", "Satuan", "Vendor rencana", "Keterangan", "Tanggal permintaan", "Berkas"];
    const isi = d.map((b, i) => [i + 1, b.kapal, b.nama, b.spesifikasi, b.jumlah, b.satuan, b.ev?.vendor || "", b.ev?.catatan || "",
      b.dikirimPada ? tanggalIndo(b.dikirimPada.slice(0, 10)) : "", b.berkasUrl]);
    const csv = [kol, ...isi].map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `Usulan Investasi ${bagian === "mesin" ? "Mesin" : "Deck"}${kapal ? ` ${ringkasKapal(kapal)}` : ""}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const brsDetail = detail ? m.baris.find((b) => b.kunci === detail) || null : null;
  const namaBagian = bagian === "mesin" ? "mesin" : "deck";

  return (
    <main className="max-w-[1680px] mx-auto px-6 py-6 pb-32 text-[13px]">
      {/* ── kepala ── */}
      <header className="flex flex-wrap items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 grid place-items-center text-2xl text-white shadow-md">📋</div>
        <div className="flex-1 min-w-[260px]">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Monitoring Permintaan Kapal</h1>
          <p className="text-slate-500 text-sm">Nilai tiap permintaan kapal dan pantau sampai barangnya diterima kapal.</p>
        </div>
        <button onClick={async () => { if (await pastikanNama()) setFormBaru(true); }}
          className="rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2.5 shadow-sm">＋ Permintaan baru</button>
        <label className="text-xs text-slate-600 flex items-center gap-1.5 bg-white rounded-xl px-3 py-2 ring-1 ring-slate-200">
          Penilai
          <input value={m.penilai} onChange={(e) => m.gantiPenilai(e.target.value)} placeholder="nama Anda"
            className="w-28 focus:outline-none font-semibold text-slate-800" />
        </label>
        <Link href="/permintaan-laporan/manajemen" className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:ring-slate-400">📊 Dashboard</Link>
        <button onClick={ekspor} disabled={unduh} className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:ring-slate-400 disabled:opacity-50">
          {unduh ? "Menyusun…" : "⬇ Excel"}
        </button>
        <button onClick={() => void m.muatUlang()} title="Muat ulang" className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:ring-slate-400">↻</button>
      </header>

      {m.galat && <p className="mt-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{m.galat}</p>}

      {/* ── Mesin / Deck ── */}
      <div className="mt-5 grid grid-cols-2 gap-4">
        {(["mesin", "deck"] as Bagian[]).map((b) => {
          const aktif = bagian === b;
          return (
            <button key={b} onClick={() => { setBagian(b); setKapal(""); setHanyaGantung(false); }}
              className={`rounded-2xl px-6 py-4 text-left transition ring-2 flex items-center gap-4 ${aktif
                ? "bg-slate-900 text-white ring-slate-900 shadow-lg" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-400"}`}>
              <span className="text-3xl">{b === "mesin" ? "⚙️" : "🛳️"}</span>
              <span className="flex-1">
                <span className="block text-lg font-extrabold">Permintaan {b === "mesin" ? "Mesin" : "Deck"}</span>
                <span className={`text-sm ${aktif ? "text-slate-300" : "text-slate-500"}`}>{hit[b].nilai} barang perlu dinilai</span>
              </span>
              {hit[b].gantung > 0 && (
                <span className={`rounded-xl px-3 py-1.5 text-sm font-extrabold ${aktif ? "bg-red-500 text-white" : "bg-red-50 text-red-700 ring-1 ring-red-200"}`}>
                  ⏰ {hit[b].gantung} tertahan
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── bilah langkah & saringan (menempel saat digulir) ── */}
      <div className="sticky top-0 z-30 -mx-6 px-6 pt-3 pb-3 mt-3 bg-slate-50/90 backdrop-blur border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          {LANGKAH.map((l) => {
            const aktif = !hanyaGantung && langkah === l.id;
            return (
              <button key={l.id} onClick={() => { setLangkah(l.id); setHanyaGantung(false); }} title={l.ket}
                className={`flex items-center gap-2 rounded-xl pl-2 pr-3 py-2 transition ring-1 ${l.id === "tunda" ? "lg:ml-2" : ""} ${aktif
                  ? "bg-sky-600 text-white ring-sky-600 shadow-sm" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-400"}`}>
                {l.no > 0 && <span className={`h-6 w-6 rounded-full grid place-items-center text-xs font-extrabold ${aktif ? "bg-white text-sky-700" : "bg-slate-100 text-slate-500"}`}>{l.no}</span>}
                <span className="font-bold">{l.label}</span>
                <span className={`tabular-nums text-xs font-bold rounded-md px-1.5 ${aktif ? "bg-sky-500" : "bg-slate-100 text-slate-500"}`}>{hit.langkah[l.id]}</span>
              </button>
            );
          })}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔍 Cari barang…"
              className="border border-slate-300 rounded-xl px-3 py-2 w-52 bg-white" />
            <select value={bulan} onChange={(e) => setBulan(e.target.value)} className="border border-slate-300 rounded-xl px-2 py-2 bg-white">
              <option value="">Semua bulan</option>
              {daftarBulan.map((b) => <option key={b} value={b}>{bulanIndo(b)}</option>)}
            </select>
            {langkah === "pusat" && !hanyaGantung && (
              <button onClick={unduhUsulan} title="Daftar barang investasi yang belum diusulkan — bahan surat usulan ke Pusat"
                className="rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-3 py-2 font-semibold">⬇ Daftar usulan</button>
            )}
            <button onClick={() => setTerlamaDulu(!terlamaDulu)} className="border border-slate-300 rounded-xl px-3 py-2 bg-white font-semibold text-slate-700">
              {terlamaDulu ? "↑ Terlama dulu" : "↓ Terbaru dulu"}
            </button>
          </div>
        </div>
        {/* kapal */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Chip aktif={!kapal} klik={() => setKapal("")}>Semua kapal</Chip>
          {chipKapal.map(([k, c]) => (
            <Chip key={k} aktif={kapal === k} klik={() => setKapal(kapal === k ? "" : k)}>
              {ringkasKapal(k)} <span className="opacity-60 tabular-nums">{c.n}</span>
              {c.gantung > 0 && <span className="ml-1 rounded bg-red-600 text-white px-1 text-[10px] font-bold">⏰{c.gantung}</span>}
            </Chip>
          ))}
        </div>
      </div>

      {/* peringatan urgent tertahan */}
      {hit.gantung > 0 && (
        <button onClick={() => setHanyaGantung(!hanyaGantung)}
          className={`mt-3 w-full flex items-center gap-3 text-left rounded-2xl px-5 py-3 transition ${hanyaGantung
            ? "bg-red-600 text-white shadow" : "bg-red-50 text-red-800 ring-1 ring-red-200 hover:bg-red-100"}`}>
          <span className="text-xl">⏰</span>
          <span className="flex-1 font-semibold">{hit.gantung} barang <b>urgent</b> {namaBagian} sudah lebih dari {BATAS_MENGGANTUNG_HARI} hari belum diproses</span>
          <span className="text-xs font-bold underline">{hanyaGantung ? "kembali" : "tampilkan saja ini"}</span>
        </button>
      )}

      {/* ── kartu permintaan, urut tanggal ── */}
      <div className="mt-4 space-y-4">
        {m.muat ? (
          <p className="bg-white rounded-2xl ring-line p-8 text-slate-500">Memuat permintaan, penilaian dan SPPBJ…</p>
        ) : (
          <>
            {belumBaca.length > 0 && (
              <div className="bg-amber-50 ring-1 ring-amber-200 rounded-2xl overflow-hidden">
                <button onClick={() => setBukaBelumBaca(!bukaBelumBaca)} className="w-full flex items-center gap-3 px-5 py-3 text-left">
                  <span className="text-xl">⏳</span>
                  <span className="flex-1 font-semibold text-amber-900">
                    {belumBaca.length} permintaan {namaBagian} belum terbaca Juru Baca
                    <span className="block text-xs font-normal text-amber-800">Barangnya muncul otomatis setelah berkas dibaca. Bila mendesak, buka berkasnya atau isi sendiri lewat ＋ Barang.</span>
                  </span>
                  <span className="text-xs font-bold text-amber-900 underline">{bukaBelumBaca ? "tutup" : "lihat daftar"}</span>
                </button>
                {bukaBelumBaca && (
                  <ul className="border-t border-amber-200 divide-y divide-amber-100 bg-white">
                    {belumBaca.map(({ k }) => (
                      <li key={k.id} className="flex flex-wrap items-center gap-3 px-5 py-2">
                        <span className="w-24 text-xs font-bold text-slate-600 tabular-nums">{tanggalIndo((k.dikirimPada || "").slice(0, 10))}</span>
                        <span className="w-36 font-bold text-slate-800">{ringkasKapal(k.kapal)}</span>
                        <span className="flex-1 min-w-[200px] truncate text-slate-600" title={k.catatan}>{judulBerkas((k.berkas || [])[0]?.nama || "")}</span>
                        {(k.berkas || []).filter((f) => f.url).map((f, i, a) => (
                          <a key={f.fileId} href={f.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-sky-700 hover:underline">📄 {a.length > 1 ? `Berkas ${i + 1}` : "Berkas"}</a>
                        ))}
                        <button onClick={async () => { if (await pastikanNama()) setFormTambah(k); }}
                          className="text-xs font-bold rounded-lg ring-1 ring-sky-200 bg-sky-50 px-2.5 py-1 text-sky-800 hover:bg-sky-100">＋ Barang</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {!kartuIsi.length && (
              <div className="bg-white rounded-2xl ring-line p-10 text-center text-slate-500">
                <p className="text-3xl">✅</p>
                <p className="mt-2 font-semibold">Tidak ada barang {namaBagian} di langkah ini.</p>
              </div>
            )}
            {kartuIsi.slice(0, batas).map((x) => (
              <KartuPermintaan key={x.k.id} x={x} langkah={hanyaGantung ? "nilai" : langkah} pilih={pilih}
                alih={alih} alihBanyak={alihBanyak} buka={setDetail}
                ubah={(d, p) => void ubah(d, p)} putus={(d, k) => void putus(d, k)} diterima={(d) => void diterima(d)}
                tambah={async () => { if (await pastikanNama()) setFormTambah(x.k); }} usul={(d) => void bukaUsul(d)}
                hapusManual={async (b) => {
                  if (await konfirmasi(`Hapus "${b.nama}" dari input kantor?`)) void m.hapusBarangManual(b.fileId, b.indeks);
                }} />
            ))}
            {kartuIsi.length > batas && (
              <button onClick={() => setBatas(batas + PER_HALAMAN)}
                className="w-full rounded-2xl bg-white ring-1 ring-slate-200 py-3 font-semibold text-slate-700 hover:ring-slate-400">
                Tampilkan {Math.min(PER_HALAMAN, kartuIsi.length - batas)} permintaan berikutnya ({kartuIsi.length - batas} lagi)
              </button>
            )}
          </>
        )}
      </div>

      {/* ── bilah aksi barang terpilih ── */}
      {terpilih.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex flex-wrap items-center gap-2 max-w-[95vw]">
          <span className="font-bold">{terpilih.length} barang dipilih</span>
          <span className="w-px h-5 bg-white/20 mx-1" />
          {terpilih.some((b) => langkahDari(b.tahap) === "nilai") && (
            <>
              <button onClick={() => void putus(terpilih, "setuju")} className="font-bold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400">✓ Setujui</button>
              <button onClick={() => void putus(terpilih, "tunda")} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20">Tunda</button>
              <button onClick={() => void putus(terpilih, "tolak")} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20">Tolak</button>
              <select defaultValue="" onChange={(e) => { if (e.target.value) void ubah(terpilih, { prioritas: e.target.value as Prioritas }); e.target.value = ""; }}
                className="text-xs bg-white/10 rounded-xl px-2 py-2">
                <option value="" className="text-slate-800">Prioritas…</option>
                {PRIORITAS.map((p) => <option key={p.id} value={p.id} className="text-slate-800">{p.ikon} {p.label}</option>)}
              </select>
              <select defaultValue="" onChange={(e) => { if (e.target.value) void ubah(terpilih, { klasifikasi: e.target.value as Klasifikasi }); e.target.value = ""; }}
                className="text-xs bg-white/10 rounded-xl px-2 py-2">
                <option value="" className="text-slate-800">Klasifikasi…</option>
                {KLASIFIKASI.map((k) => <option key={k.id} value={k.id} className="text-slate-800">{k.label}</option>)}
              </select>
            </>
          )}
          {terpilih.some((b) => b.tahap === "usul") && (
            <button onClick={() => void bukaUsul(terpilih)} className="font-bold px-4 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500">🏛 Tandai diusulkan ke Pusat</button>
          )}
          {terpilih.some((b) => b.tahap === "pusat" || b.tahap === "io") && !terpilih.some((b) => b.tahap === "usul") && (
            <button onClick={() => void bukaUsul(terpilih)} className="font-bold px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500">✓ Persetujuan / No. IO terbit</button>
          )}
          {terpilih.some((b) => langkahDari(b.tahap) === "siap") && (
            <button onClick={() => void keSppbj()} disabled={sibukSppbj} className="font-bold px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-60">
              {sibukSppbj ? "Menyiapkan…" : "→ Buat SPPBJ"}
            </button>
          )}
          {terpilih.some((b) => ["siap", "proses"].includes(langkahDari(b.tahap))) && (
            <button onClick={() => void diterima(terpilih)} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500">Sudah diterima kapal</button>
          )}
          {terpilih.some((b) => ["pusat", "siap", "tunda", "selesai"].includes(langkahDari(b.tahap))) && (
            <button onClick={() => void kembalikan(terpilih)} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20">↺ Nilai ulang</button>
          )}
          <button onClick={() => setPilih(new Set())} className="px-2 py-2 rounded-xl hover:bg-white/10">✕</button>
        </div>
      )}

      {brsDetail && <Detail b={brsDetail} tutup={() => setDetail("")} ubah={(p) => void ubah([brsDetail], p)}
        vendor={m.vendor} permohonan={m.permohonan}
        pengadaan={m.pengadaan.filter((p) => p.items.some((i) => ringkasKapal(i.kapal).toUpperCase() === ringkasKapal(brsDetail.kapal).toUpperCase()))} />}

      {formUsul && formUsul.daftar.length > 0 && (
        <FormUsulan daftar={formUsul.daftar} mode={formUsul.mode} permohonan={m.permohonan} tutup={() => setFormUsul(null)}
          simpan={(p) => { m.terapkan(formUsul.daftar, p); setFormUsul(null); setPilih(new Set()); }} />
      )}

      {formBaru && (
        <FormBarang judul="Permintaan baru dari kantor" sub="Untuk permintaan yang datang lewat WhatsApp, kertas, atau telepon."
          awalKapal={kapal} awalBagian={bagian} lengkap tutup={() => setFormBaru(false)}
          simpan={async (isi) => {
            await m.buatPermintaan({ kapal: isi.kapal, jenis: isi.bagian === "deck" ? "permintaan_deck" : "permintaan_mesin",
              tanggal: isi.tanggal, nomor: isi.nomor, catatan: isi.catatan, baris: isi.baris });
            setBagian(isi.bagian); setLangkah("nilai"); setHanyaGantung(false); setFormBaru(false);
          }} />
      )}
      {formTambah && (
        <FormBarang judul={`Tambah barang — ${formTambah.kapal}`}
          sub={`Ke permintaan ${tanggalIndo((formTambah.dikirimPada || "").slice(0, 10))}. Barang ditandai "input kantor"; hasil baca berkas tidak diubah.`}
          awalKapal={formTambah.kapal} awalBagian={bagianDari(formTambah.jenis)} tutup={() => setFormTambah(null)}
          simpan={async (isi) => { await m.tambahBarang(formTambah, isi.baris); setFormTambah(null); }} />
      )}
    </main>
  );
}

/* ── kartu satu permintaan ───────────────────────────────────────────────── */

function KartuPermintaan({ x, langkah, pilih, alih, alihBanyak, buka, ubah, putus, diterima, tambah, hapusManual, usul }: {
  x: Kartu; langkah: Langkah; pilih: Set<string>;
  alih: (k: string) => void; alihBanyak: (d: BarisMonitor[]) => void; buka: (k: string) => void;
  ubah: (d: BarisMonitor[], p: Patch) => void; putus: (d: BarisMonitor[], k: "setuju" | "tunda" | "tolak") => void;
  diterima: (d: BarisMonitor[]) => void; tambah: () => void; hapusManual: (b: BarisMonitor) => void;
  usul: (d: BarisMonitor[]) => void;
}) {
  const { k, semua, tampil, belumTerbaca } = x;
  const manualSaja = k.id.startsWith("manual-");
  const berkasDrive = (k.berkas || []).filter((f) => f.url);
  const judul = manualSaja ? ((k.berkas || [])[0]?.nama || "Input kantor") : judulBerkas((k.berkas || [])[0]?.nama || "");
  const dinilai = semua.filter((b) => langkahDari(b.tahap) !== "nilai").length;
  const gantung = tampil.filter((b) => b.menggantung).length;
  const urgent = tampil.filter((b) => b.prioritas === "urgent").length;
  const semuaDipilih = tampil.length > 0 && tampil.every((b) => pilih.has(b.kunci));
  const umur = umurDari(k.dikirimPada);
  const tgl = (k.dikirimPada || "").slice(0, 10);

  return (
    <section className={`bg-white rounded-2xl ring-1 shadow-sm overflow-hidden ${gantung ? "ring-red-200" : "ring-slate-200"}`}>
      {/* kepala kartu */}
      <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="text-center w-16 shrink-0">
          <p className="text-2xl font-extrabold text-slate-800 leading-none">{tgl ? Number(tgl.slice(8, 10)) : "—"}</p>
          <p className="text-[11px] font-bold uppercase text-slate-500">{tgl ? new Date(tgl).toLocaleDateString("id-ID", { month: "short", year: "2-digit" }) : ""}</p>
        </div>
        <div className="flex-1 min-w-[260px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-extrabold text-slate-900">{k.kapal}</span>
            {manualSaja
              ? <span className="text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-violet-100 text-violet-800 ring-1 ring-violet-200">INPUT KANTOR</span>
              : <span className="text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-slate-100 text-slate-600 ring-1 ring-slate-200">KIRIMAN KAPAL</span>}
            {gantung > 0 && <span className="text-[11px] font-bold rounded-md px-1.5 py-0.5 bg-red-600 text-white">⏰ {gantung} tertahan</span>}
            {urgent > 0 && gantung === 0 && <span className="text-[11px] font-bold rounded-md px-1.5 py-0.5 bg-rose-100 text-rose-800 ring-1 ring-rose-200">🔴 {urgent} urgent</span>}
          </div>
          <p className="text-slate-600 truncate" title={judul}>{judul}</p>
          <p className="text-xs text-slate-400">{umur} hari lalu · {k.pengirim || "ABK"}{k.catatan ? ` · “${k.catatan.slice(0, 90)}”` : ""}</p>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          {semua.length > 0 && (
            <div className="w-36">
              <div className="flex justify-between text-[11px] text-slate-500"><span>dinilai</span><b className="tabular-nums text-slate-700">{dinilai}/{semua.length}</b></div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-0.5">
                <div className="h-full bg-emerald-500" style={{ width: `${(dinilai / semua.length) * 100}%` }} />
              </div>
            </div>
          )}
          {berkasDrive.map((f, i) => (
            <a key={f.fileId} href={f.url} target="_blank" rel="noreferrer" title={f.nama}
              className="text-xs font-semibold rounded-lg ring-1 ring-slate-200 px-2.5 py-1.5 text-sky-700 hover:bg-sky-50">📄 {berkasDrive.length > 1 ? `Berkas ${i + 1}` : "Berkas"}</a>
          ))}
          <button onClick={tambah} className="text-xs font-bold rounded-lg ring-1 ring-sky-200 bg-sky-50 px-2.5 py-1.5 text-sky-800 hover:bg-sky-100">＋ Barang</button>
          {langkah === "nilai" && tampil.length > 1 && (
            <button onClick={() => putus(tampil, "setuju")} title="Setujui semua barang di kartu ini sesuai saran prioritas & klasifikasi"
              className="text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5">✓ Setujui semua</button>
          )}
          {langkah === "pusat" && tampil.filter((b) => b.tahap === "usul").length > 1 && (
            <button onClick={() => usul(tampil.filter((b) => b.tahap === "usul"))} title="Catat semua barang investasi di kartu ini sebagai sudah diusulkan, dengan satu surat"
              className="text-xs font-bold rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-3 py-1.5">🏛 Usulkan semua</button>
          )}
        </div>
      </div>

      {belumTerbaca > 0 && (
        <p className="px-5 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-100">
          ⏳ {belumTerbaca} berkas belum terbaca Juru Baca{semua.length === 0 ? " — buka berkasnya, atau isi barangnya sendiri lewat ＋ Barang bila mendesak." : "."}
        </p>
      )}

      {tampil.length > 0 && (
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-11" /><col className="w-9" /><col /><col className="w-28" />
            <col className="w-36" /><col className="w-40" /><col className="w-64" />
          </colgroup>
          <thead className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
            <tr className="border-b border-slate-100">
              <th className="py-2 text-center"><input type="checkbox" checked={semuaDipilih} onChange={() => alihBanyak(tampil)} className="h-4 w-4" title="Pilih semua di kartu ini" /></th>
              <th className="py-2 text-left">No</th>
              <th className="py-2 text-left">Barang</th>
              <th className="py-2 text-left">Jumlah</th>
              <th className="py-2 text-left">Prioritas</th>
              <th className="py-2 text-left">Klasifikasi</th>
              <th className="py-2 text-left pr-4">{langkah === "nilai" ? "Keputusan" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {tampil.map((b, i) => (
              <BarisBarang key={b.kunci} b={b} no={i + 1} dipilih={pilih.has(b.kunci)} alih={() => alih(b.kunci)} buka={() => buka(b.kunci)}
                ubah={(p) => ubah([b], p)} putus={(kp) => putus([b], kp)} diterima={() => diterima([b])} usul={() => usul([b])}
                hapus={b.fileId.startsWith(AWALAN_MANUAL) ? () => hapusManual(b) : undefined} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function BarisBarang({ b, no, dipilih, alih, buka, ubah, putus, diterima, usul, hapus }: {
  b: BarisMonitor; no: number; dipilih: boolean; alih: () => void; buka: () => void;
  ubah: (p: Patch) => void; putus: (k: "setuju" | "tunda" | "tolak") => void; diterima: () => void; usul: () => void; hapus?: () => void;
}) {
  const t = TAHAP[b.tahap];
  const modeNilai = langkahDari(b.tahap) === "nilai";
  const modePusat = langkahDari(b.tahap) === "pusat";
  const ev = b.ev;
  return (
    <tr className={`border-b border-slate-100 last:border-0 align-top transition ${b.menggantung ? "bg-red-50/70" : dipilih ? "bg-sky-50" : "even:bg-slate-50/40 hover:bg-slate-50"}`}>
      <td className="py-2.5 text-center"><input type="checkbox" checked={dipilih} onChange={alih} className="h-4 w-4" /></td>
      <td className="py-2.5 text-slate-400 tabular-nums">{no}</td>
      <td className="py-2.5 pr-3">
        <button onClick={buka} className="font-semibold text-slate-900 text-left hover:text-sky-700" title="Rincian, catatan & riwayat">{b.nama}</button>
        {b.spesifikasi && <p className="text-xs text-slate-500">{b.spesifikasi}</p>}
        <div className="flex flex-wrap gap-1 mt-1">
          {b.fileId.startsWith(AWALAN_MANUAL) && <Tanda kelas="bg-violet-50 text-violet-700 ring-violet-200">input kantor</Tanda>}
          {b.menggantung && <Tanda kelas="bg-red-600 text-white ring-red-700">⏰ tertahan {b.umurHari} hari</Tanda>}
          {b.dimintaUlang > 0 && <Tanda kelas="bg-amber-50 text-amber-800 ring-amber-200">🔁 diminta ulang</Tanda>}
          {b.adaLk && <Tanda kelas="bg-orange-50 text-orange-800 ring-orange-200">📄 ada LK</Tanda>}
        </div>
        {(ev?.vendor || ev?.catatan || ev?.noIO || ev?.poSementara) && (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
            {ev?.vendor && <span>🏪 <b className="font-semibold">{ev.vendor}</b></span>}
            {ev?.noIO && <span>IO <b className="font-semibold">{ev.noIO}</b></span>}
            {ev?.poSementara && <span>PO Sementara <b className="font-semibold">{ev.poSementara}</b></span>}
            {ev?.catatan && <span className="italic">📝 {ev.catatan}</span>}
          </div>
        )}
      </td>
      <td className="py-2.5 text-slate-700 tabular-nums">{b.jumlah || "—"} <span className="text-slate-500">{b.satuan}</span></td>
      <td className="py-2.5 pr-2"><Pil<Prioritas> nilai={b.ev?.prioritas || ""} saran={b.saranPrioritas} daftar={PRIORITAS} ubah={(v) => ubah({ prioritas: v })} /></td>
      <td className="py-2.5 pr-2"><Pil<Klasifikasi> nilai={b.ev?.klasifikasi || ""} saran={b.saranKlasifikasi} daftar={KLASIFIKASI} ubah={(v) => ubah({ klasifikasi: v })} /></td>
      <td className="py-2.5 pr-4">
        {modeNilai ? (
          <div className="flex items-center gap-1.5">
            <button onClick={() => putus("setuju")} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500">Setuju</button>
            <button onClick={() => putus("tunda")} className="text-xs px-2.5 py-1.5 rounded-lg ring-1 ring-slate-300 text-slate-600 hover:bg-slate-100">Tunda</button>
            <button onClick={() => putus("tolak")} className="text-xs px-2.5 py-1.5 rounded-lg ring-1 ring-rose-200 text-rose-700 hover:bg-rose-50">Tolak</button>
            {hapus && <button onClick={hapus} title="Hapus barang input kantor" className="text-xs px-1.5 py-1.5 text-slate-400 hover:text-rose-600">🗑</button>}
          </div>
        ) : modePusat ? (
          <div className="space-y-1">
            <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md ring-1 ${t.kelas}`}>{t.label}</span>
            {(b.permohonan || ev?.usulNoSurat) && (
              <p className="text-[11px] text-slate-600 truncate" title={b.permohonan?.judul || ""}>
                Usulan {b.permohonan?.nomorSurat || ev?.usulNoSurat}{ev?.usulTgl ? ` · ${tanggalIndo(ev.usulTgl)}` : ""}
              </p>
            )}
            {(ev?.setujuNo || b.permohonan?.ketPersetujuan) && b.tahap === "io" && (
              <p className="text-[11px] text-slate-600 truncate">Persetujuan {ev?.setujuNo || b.permohonan?.ketPersetujuan}</p>
            )}
            <button onClick={usul} className={`text-xs font-bold px-3 py-1.5 rounded-lg text-white ${b.tahap === "usul" ? "bg-fuchsia-600 hover:bg-fuchsia-500" : "bg-violet-600 hover:bg-violet-500"}`}>
              {b.tahap === "usul" ? "🏛 Tandai diusulkan" : b.tahap === "pusat" ? "✓ Persetujuan terbit" : "Isi No. IO / PO Sementara"}
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md ring-1 ${t.kelas}`}>{t.label}</span>
            {b.pengadaan && (
              <p className="text-[11px] text-slate-600 truncate" title={b.pengadaan.nama}>
                {b.pengadaan.asal === "nonpr" ? "Non PR PO" : "SPPBJ"} {b.pengadaan.nomor}{b.pengadaan.tahapScm ? ` · SCM ${b.pengadaan.tahapScm}` : ""}
              </p>
            )}
            {b.ev?.diterima && <p className="text-[11px] text-emerald-700">diterima {tanggalIndo(b.ev.diterima)}</p>}
            {["disetujui", "stok", "sppbj", "spbj"].includes(b.tahap) && (
              <button onClick={diterima} className="text-[11px] font-bold text-emerald-700 hover:underline">✓ sudah diterima kapal</button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

/* ── komponen kecil ──────────────────────────────────────────────────────── */

function Chip({ aktif, klik, children }: { aktif: boolean; klik: () => void; children: React.ReactNode }) {
  return (
    <button onClick={klik} className={`text-xs font-semibold rounded-full px-3 py-1 ring-1 transition ${aktif
      ? "bg-slate-800 text-white ring-slate-800" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-400"}`}>{children}</button>
  );
}

function Tanda({ kelas, children }: { kelas: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md ring-1 whitespace-nowrap ${kelas}`}>{children}</span>;
}

/** pilihan ringkas berbentuk pil; saran mesin tampil putus-putus sampai diputuskan */
function Pil<T extends string>({ nilai, saran, daftar, ubah }: {
  nilai: T | ""; saran: T; daftar: { id: T; label: string; kelas: string; ikon?: string }[]; ubah: (v: T) => void;
}) {
  const efektif = (nilai || saran) as T;
  const def = daftar.find((x) => x.id === efektif);
  return (
    <select value={efektif} onChange={(e) => ubah(e.target.value as T)} title={nilai ? "" : "Saran mesin — ikut terkunci saat diputuskan"}
      className={`max-w-full text-xs font-bold rounded-full pl-2.5 pr-1 py-1 ring-1 ${def?.kelas || "bg-white ring-slate-300"} ${nilai ? "" : "border border-dashed border-current opacity-80"}`}>
      {daftar.map((x) => <option key={x.id} value={x.id}>{x.ikon ? `${x.ikon} ` : ""}{x.label}</option>)}
    </select>
  );
}

/* ── form input kantor ───────────────────────────────────────────────────── */

const barisKosong = (): BarangInput => ({ nama: "", spesifikasi: "", jumlah: "1", satuan: "pcs", keterangan: "" });

function FormBarang({ judul, sub, awalKapal, awalBagian, lengkap, tutup, simpan }: {
  judul: string; sub: string; awalKapal: string; awalBagian: Bagian; lengkap?: boolean; tutup: () => void;
  simpan: (isi: { kapal: string; bagian: Bagian; tanggal: string; nomor: string; catatan: string; baris: BarangInput[] }) => Promise<void>;
}) {
  const [kapal, setKapal] = useState(awalKapal || "");
  const [bagian, setBagian] = useState<Bagian>(awalBagian);
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [nomor, setNomor] = useState("");
  const [catatan, setCatatan] = useState("");
  const [baris, setBaris] = useState<BarangInput[]>([barisKosong()]);
  const [sibuk, setSibuk] = useState(false);
  const ubahBaris = (i: number, k: keyof BarangInput, v: string) => setBaris((d) => d.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const isi = baris.filter((x) => x.nama.trim());

  const kirim = async () => {
    if (lengkap && !kapal) { void beritahu("Pilih kapalnya dulu."); return; }
    if (!isi.length) { void beritahu("Isi minimal satu nama barang."); return; }
    if (isi.some((x) => !/\d/.test(x.jumlah))) { void beritahu("Jumlah tiap barang harus berupa angka."); return; }
    setSibuk(true);
    try { await simpan({ kapal, bagian, tanggal, nomor: nomor.trim(), catatan: catatan.trim(), baris: isi }); }
    catch (e: any) { void beritahu(e?.message || String(e)); }
    finally { setSibuk(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 grid place-items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start gap-3">
          <div className="flex-1"><h2 className="text-lg font-extrabold text-slate-900">{judul}</h2><p className="text-xs text-slate-500">{sub}</p></div>
          <button onClick={tutup} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          {lengkap && (
            <div className="grid sm:grid-cols-4 gap-3">
              <label className="sm:col-span-2"><span className="text-xs font-bold text-slate-500">Kapal</span>
                <select value={kapal} onChange={(e) => setKapal(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 bg-white">
                  <option value="">— pilih kapal —</option>
                  {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              <label><span className="text-xs font-bold text-slate-500">Bagian</span>
                <select value={bagian} onChange={(e) => setBagian(e.target.value as Bagian)} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 bg-white">
                  <option value="mesin">⚙️ Mesin</option><option value="deck">🛳️ Deck</option>
                </select>
              </label>
              <label><span className="text-xs font-bold text-slate-500">Tanggal permintaan</span>
                <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2" />
              </label>
              <label className="sm:col-span-2"><span className="text-xs font-bold text-slate-500">No. surat / sumber (opsional)</span>
                <input value={nomor} onChange={(e) => setNomor(e.target.value)} placeholder="mis. WA KKM 22 Nov / 015/M/LMA/XI/2026"
                  className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2" />
              </label>
              <label className="sm:col-span-2"><span className="text-xs font-bold text-slate-500">Keterangan (opsional)</span>
                <input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. untuk perbaikan pompa bilga"
                  className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2" />
              </label>
            </div>
          )}
          <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
            <table className="w-full table-fixed text-sm">
              <colgroup><col className="w-8" /><col /><col className="w-48" /><col className="w-20" /><col className="w-24" /><col className="w-44" /><col className="w-9" /></colgroup>
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                <tr><th className="p-2">#</th><th className="p-2 text-left">Nama barang *</th><th className="p-2 text-left">Spesifikasi / part no.</th>
                  <th className="p-2 text-left">Jumlah *</th><th className="p-2 text-left">Satuan</th><th className="p-2 text-left">Keterangan</th><th /></tr>
              </thead>
              <tbody>
                {baris.map((x, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="p-1.5 text-center text-slate-400">{i + 1}</td>
                    <td className="p-1.5"><input value={x.nama} onChange={(e) => ubahBaris(i, "nama", e.target.value)} placeholder="mis. Filter oli ME"
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5" autoFocus={i === baris.length - 1} /></td>
                    <td className="p-1.5"><input value={x.spesifikasi} onChange={(e) => ubahBaris(i, "spesifikasi", e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" /></td>
                    <td className="p-1.5"><input value={x.jumlah} onChange={(e) => ubahBaris(i, "jumlah", e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" /></td>
                    <td className="p-1.5"><input value={x.satuan} onChange={(e) => ubahBaris(i, "satuan", e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" /></td>
                    <td className="p-1.5"><input value={x.keterangan} onChange={(e) => ubahBaris(i, "keterangan", e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" /></td>
                    <td className="p-1.5 text-center">{baris.length > 1 && (
                      <button onClick={() => setBaris((d) => d.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600" title="Hapus baris">✕</button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setBaris((d) => [...d, barisKosong()])} className="w-full py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 border-t border-slate-100">＋ Tambah baris</button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="mr-auto text-xs text-slate-500">{isi.length} barang akan disimpan · masuk ke langkah "Perlu dinilai"</span>
            <button onClick={tutup} className="rounded-xl ring-1 ring-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
            <button onClick={() => void kirim()} disabled={sibuk} className="rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold px-5 py-2 disabled:opacity-60">
              {sibuk ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── rincian satu barang ─────────────────────────────────────────────────── */

function Detail({ b, tutup, ubah, pengadaan, vendor, permohonan }: {
  b: BarisMonitor; tutup: () => void; ubah: (p: Patch) => void;
  pengadaan: ReturnType<typeof useMonitorPermintaan>["pengadaan"];
  vendor: string[]; permohonan: PermohonanRingkas[];
}) {
  const ev = b.ev;
  const [catatan, setCatatan] = useState(ev?.catatan || "");
  const [pic, setPic] = useState(ev?.pic || "");
  const [vend, setVend] = useState(ev?.vendor || "");
  const [inv, setInv] = useState({
    usulNoSurat: ev?.usulNoSurat || "", usulTgl: ev?.usulTgl || "", setujuNo: ev?.setujuNo || "", setujuTgl: ev?.setujuTgl || "",
    noIO: ev?.noIO || "", poSementara: ev?.poSementara || "",
  });
  const investasi = (ev?.klasifikasi || b.saranKlasifikasi) === "investasi";
  const urut = [...pengadaan].sort((x, y) => (y.tanggal || "").localeCompare(x.tanggal || "")).slice(0, 60);
  const tambahKet = (t: string) => setCatatan((c) => (c.includes(t) ? c : c ? `${c}; ${t}` : t));
  const simpan = () => {
    const p: Patch = {};
    if (catatan !== (ev?.catatan || "")) p.catatan = catatan;
    if (pic !== (ev?.pic || "")) p.pic = pic;
    if (vend.trim() !== (ev?.vendor || "")) p.vendor = vend.trim();
    (Object.keys(inv) as (keyof typeof inv)[]).forEach((k) => { if (inv[k] !== ((ev?.[k] as string) || "")) (p as any)[k] = inv[k]; });
    if (investasi && !ev?.usulStatus && !ev?.permohonanId && inv.usulNoSurat) p.usulStatus = "diusulkan";
    if (investasi && (inv.setujuNo || inv.noIO) && (ev?.usulStatus || "") !== "disetujui" && !ev?.permohonanId) p.usulStatus = "disetujui";
    if (Object.keys(p).length) ubah(p);
    tutup();
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 grid place-items-center p-4" onClick={simpan}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{b.kapal} · {bagianDari(b.jenis) === "deck" ? "Deck" : "Mesin"} · {TAHAP[b.tahap].label}</p>
            <h2 className="text-lg font-extrabold text-slate-900">{b.nama}</h2>
            <p className="text-sm text-slate-600">{b.spesifikasi} {b.spesifikasi ? "·" : ""} {b.jumlah} {b.satuan}</p>
          </div>
          <button onClick={simpan} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <p><span className="text-slate-500">Diminta</span><br /><b>{b.dikirimPada ? tanggalIndo(b.dikirimPada.slice(0, 10)) : "—"}</b> ({b.umurHari} hari) · {b.pengirim || "ABK"}</p>
            <p><span className="text-slate-500">Berkas</span><br />{b.berkasUrl ? <a href={b.berkasUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline break-all">{judulBerkas(b.berkasNama)} ↗</a> : (b.berkasNama || "Input kantor")}</p>
            {b.keterangan && <p className="sm:col-span-2"><span className="text-slate-500">Keterangan dari kapal</span><br />{b.keterangan}</p>}
          </div>
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <label><span className="text-slate-500 font-bold">Prioritas</span>
              <select value={b.ev?.prioritas || b.saranPrioritas} onChange={(e) => ubah({ prioritas: e.target.value as Prioritas })}
                className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                {PRIORITAS.map((p) => <option key={p.id} value={p.id}>{p.ikon} {p.label}</option>)}
              </select>
            </label>
            <label><span className="text-slate-500 font-bold">Klasifikasi</span>
              <select value={b.ev?.klasifikasi || b.saranKlasifikasi} onChange={(e) => ubah({ klasifikasi: e.target.value as Klasifikasi })}
                className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                {KLASIFIKASI.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </label>
            <label><span className="text-slate-500 font-bold">Keputusan</span>
              <select value={b.ev?.keputusan || ""} onChange={(e) => ubah({ keputusan: e.target.value as "" | "setuju" | "tunda" | "tolak" })}
                className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                <option value="">— belum —</option>
                {KEPUTUSAN.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </label>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <label className="block"><span className="text-slate-500 font-bold">Vendor rencana</span> <span className="text-slate-400">(acuan awal)</span>
              <input value={vend} onChange={(e) => setVend(e.target.value)} list="daftar-vendor" placeholder="ketik / pilih vendor…"
                className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-1.5" />
              <datalist id="daftar-vendor">{vendor.map((v) => <option key={v} value={v} />)}</datalist>
            </label>
            <label className="block"><span className="text-slate-500 font-bold">Keterangan</span>
              <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} placeholder="mis. PO Sementara / tunggu pagu Desember"
                className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-1.5" />
            </label>
            <div className="sm:col-span-2 flex flex-wrap gap-1.5 -mt-1">
              {KETERANGAN_CEPAT.map((k) => (
                <button key={k} type="button" onClick={() => tambahKet(k)}
                  className="text-[11px] rounded-full ring-1 ring-slate-300 px-2.5 py-0.5 text-slate-600 hover:bg-slate-100">＋ {k}</button>
              ))}
            </div>
          </div>
          {investasi && (
            <div className="rounded-xl ring-1 ring-fuchsia-200 bg-fuchsia-50/50 p-3 space-y-2 text-xs">
              <p className="font-extrabold text-fuchsia-900">🏛 Usulan investasi ke Kantor Pusat <span className="font-semibold text-fuchsia-700">· {TAHAP[b.tahap].label}</span></p>
              <label className="block"><span className="text-slate-500 font-bold">Tautkan ke surat di Monitoring Permohonan Cabang</span>
                <select value={ev?.permohonanId || ""} onChange={(e) => ubah({ permohonanId: e.target.value })}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                  <option value="">— tidak ditautkan (isi manual di bawah) —</option>
                  {permohonan.map((p) => <option key={p.id} value={p.id}>[{p.status}] {p.nomorSurat || "tanpa nomor"} · {p.judul.slice(0, 60)}</option>)}
                </select>
                {ev?.permohonanId && <span className="block mt-1 text-fuchsia-800">Status mengikuti surat itu otomatis (Proses → Disetujui).</span>}
              </label>
              <div className="grid sm:grid-cols-2 gap-2">
                <Isian label="No. surat usulan" v={inv.usulNoSurat} ubah={(x) => setInv({ ...inv, usulNoSurat: x })} />
                <Isian label="Tgl usulan" tipe="date" v={inv.usulTgl} ubah={(x) => setInv({ ...inv, usulTgl: x })} />
                <Isian label="No. persetujuan Pusat" v={inv.setujuNo} ubah={(x) => setInv({ ...inv, setujuNo: x })} />
                <Isian label="Tgl persetujuan" tipe="date" v={inv.setujuTgl} ubah={(x) => setInv({ ...inv, setujuTgl: x })} />
                <Isian label="No. IO" v={inv.noIO} ubah={(x) => setInv({ ...inv, noIO: x })} />
                <Isian label="PO Sementara (bila belum ada IO)" v={inv.poSementara} ubah={(x) => setInv({ ...inv, poSementara: x })} />
              </div>
            </div>
          )}
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <label><span className="text-slate-500 font-bold">PIC</span>
              <input value={pic} onChange={(e) => setPic(e.target.value)} placeholder="mis. KKM / Staf Teknik" className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-1.5" />
            </label>
            <label><span className="text-slate-500 font-bold">Diterima kapal</span>
              <input type="date" value={b.ev?.diterima || ""} onChange={(e) => ubah({ diterima: e.target.value })}
                className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-1.5" />
            </label>
            <label><span className="text-slate-500 font-bold">Tautan pengadaan</span>
              <select value={b.ev?.tautPengadaan || ""} onChange={(e) => ubah({ tautPengadaan: e.target.value })}
                className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                <option value="">Otomatis{b.pengadaanOtomatis && b.pengadaan ? ` (${b.pengadaan.nomor || b.pengadaan.nama.slice(0, 20)})` : ""}</option>
                <option value="-">Jangan ditautkan</option>
                {urut.map((p) => <option key={p.id} value={p.id}>{p.asal === "nonpr" ? "NonPR" : "SPPBJ"} {p.nomor || "—"} · {p.tanggal} · {p.nama.slice(0, 40)}</option>)}
              </select>
            </label>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Riwayat keputusan</p>
            {b.ev?.jejak?.length ? (
              <ul className="text-xs space-y-1">
                {[...b.ev.jejak].reverse().map((j, i) => (
                  <li key={i} className="flex gap-2"><span className="text-slate-400 whitespace-nowrap">{new Date(j.pada).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    <b className="whitespace-nowrap">{j.oleh}</b><span className="text-slate-700">{j.ubah}</span></li>
                ))}
              </ul>
            ) : <p className="text-xs text-slate-400">Belum ada keputusan untuk barang ini.</p>}
          </div>
          <div className="text-right"><button onClick={simpan} className="rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold px-5 py-2">Simpan & tutup</button></div>
        </div>
      </div>
    </div>
  );
}

function Isian({ label, v, ubah, tipe }: { label: string; v: string; ubah: (x: string) => void; tipe?: string }) {
  return (
    <label className="block"><span className="text-slate-500 font-bold">{label}</span>
      <input type={tipe || "text"} value={v} onChange={(e) => ubah(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white" />
    </label>
  );
}

/* ── usulan investasi ke Kantor Pusat ────────────────────────────────────── */

function FormUsulan({ daftar, mode, permohonan, tutup, simpan }: {
  daftar: BarisMonitor[]; mode: ModeUsul; permohonan: PermohonanRingkas[]; tutup: () => void; simpan: (p: Patch) => void;
}) {
  const kini = new Date().toISOString().slice(0, 10);
  const [permohonanId, setPermohonanId] = useState("");
  const [noSurat, setNoSurat] = useState("");
  const [tgl, setTgl] = useState(kini);
  const [setujuNo, setSetujuNo] = useState("");
  const [setujuTgl, setSetujuTgl] = useState(kini);
  const [noIO, setNoIO] = useState("");
  const [po, setPo] = useState("");
  const pm = permohonan.find((p) => p.id === permohonanId);

  const kirim = () => {
    if (mode === "usul") {
      if (!permohonanId && !noSurat.trim()) { void beritahu("Isi nomor surat usulan, atau pilih suratnya dari Monitoring Permohonan Cabang."); return; }
      simpan({ usulStatus: "diusulkan", permohonanId, usulNoSurat: pm?.nomorSurat || noSurat.trim(), usulTgl: pm?.tglPengajuan || tgl });
    } else {
      if (!setujuNo.trim() && !noIO.trim() && !po.trim()) { void beritahu("Isi nomor persetujuan, No. IO, atau PO Sementara."); return; }
      simpan({ usulStatus: "disetujui", setujuNo: setujuNo.trim(), setujuTgl, noIO: noIO.trim(), poSementara: po.trim() });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 grid place-items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start gap-3">
          <div className="flex-1">
            <h2 className="text-lg font-extrabold text-slate-900">{mode === "usul" ? "🏛 Tandai diusulkan ke Kantor Pusat" : "✓ Persetujuan Pusat / No. IO terbit"}</h2>
            <p className="text-xs text-slate-500">{daftar.length} barang investasi · satu surat untuk semuanya</p>
          </div>
          <button onClick={tutup} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <ul className="max-h-36 overflow-y-auto rounded-xl ring-1 ring-slate-200 divide-y divide-slate-100 text-xs">
            {daftar.map((b) => (
              <li key={b.kunci} className="px-3 py-1.5 flex gap-2"><b className="w-28 shrink-0 text-slate-700">{ringkasKapal(b.kapal)}</b>
                <span className="flex-1 truncate">{b.nama}</span><span className="text-slate-500">{b.jumlah} {b.satuan}</span></li>
            ))}
          </ul>
          {mode === "usul" ? (
            <div className="space-y-3 text-xs">
              <label className="block"><span className="text-slate-500 font-bold">Surat di Monitoring Permohonan Cabang</span> <span className="text-slate-400">(disarankan)</span>
                <select value={permohonanId} onChange={(e) => setPermohonanId(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                  <option value="">— belum ada / isi manual —</option>
                  {permohonan.filter((p) => p.status !== "Ditolak").map((p) => (
                    <option key={p.id} value={p.id}>[{p.status}] {p.nomorSurat || "tanpa nomor"} · {p.judul.slice(0, 60)}</option>
                  ))}
                </select>
                <span className="block mt-1 text-slate-500">Bila ditautkan, barang ini otomatis pindah ke "Siap diadakan" saat surat itu ditandai Disetujui di modul Permohonan Cabang.</span>
              </label>
              {!permohonanId && (
                <div className="grid grid-cols-2 gap-2">
                  <Isian label="No. surat usulan" v={noSurat} ubah={setNoSurat} />
                  <Isian label="Tanggal usulan" tipe="date" v={tgl} ubah={setTgl} />
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Isian label="No. persetujuan Pusat" v={setujuNo} ubah={setSetujuNo} />
              <Isian label="Tgl persetujuan" tipe="date" v={setujuTgl} ubah={setSetujuTgl} />
              <Isian label="No. IO" v={noIO} ubah={setNoIO} />
              <Isian label="PO Sementara (bila IO belum ada)" v={po} ubah={setPo} />
              <p className="col-span-2 text-slate-500">Tanpa No. IO dan tanpa PO Sementara, barang menunggu di "Disetujui Pusat — menunggu No. IO". Dengan salah satunya, barang pindah ke "Siap diadakan".</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={tutup} className="rounded-xl ring-1 ring-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
            <button onClick={kirim} className={`rounded-xl text-white font-bold px-5 py-2 ${mode === "usul" ? "bg-fuchsia-600 hover:bg-fuchsia-500" : "bg-violet-600 hover:bg-violet-500"}`}>Simpan</button>
          </div>
        </div>
      </div>
    </div>
  );
}
