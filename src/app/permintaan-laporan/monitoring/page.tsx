"use client";
/**
 * MONITORING PERMINTAAN KAPAL — keputusan kantor atas tiap barang yang diminta.
 *
 * Dibuat supaya TIDAK berbelit:
 *  1. Deck dan Mesin dipisah sejak awal — dua tab, dua tumpukan kerja.
 *  2. Alurnya bertahap seperti antrean: Perlu dinilai → Disetujui (siap
 *     diadakan) → Sedang diadakan → Selesai. Satu tahap tampil sekaligus.
 *  3. Kapal dipilih di kolom kiri; tabel hanya memuat barang kapal itu.
 *  4. Menilai = satu klik Setuju / Tunda / Tolak. Prioritas dan klasifikasi
 *     sudah disarankan mesin dan ikut terkunci saat diputuskan; ubah hanya
 *     bila sarannya keliru.
 * Status pengadaan berjalan sendiri dari SPPBJ / Non PR PO / SCM.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { titipkanKeSppbj } from "@/lib/lapor/bacaPermintaan";
import { bulanIndo } from "@/lib/lapor/types";
import { rupiah, tanggalIndo } from "@/lib/format";
import { ringkasKapal } from "@/lib/kapal/nama";
import { angkaRupiah, nilaiBarang } from "@/lib/permintaanMonitor/logika";
import {
  BATAS_MENGGANTUNG_HARI, BarisMonitor, KEPUTUSAN, KLASIFIKASI, Klasifikasi, PRIORITAS, Prioritas, TAHAP, Tahap,
} from "@/lib/permintaanMonitor/types";
import { Patch, unduhExcel, useMonitorPermintaan } from "@/lib/permintaanMonitor/useMonitor";
import { beritahu, konfirmasi } from "@/components/Konfirmasi";

type Bagian = "mesin" | "deck";
type Langkah = "nilai" | "siap" | "proses" | "selesai" | "tunda";

const LANGKAH: { id: Langkah; no: string; label: string; ket: string; tahap: Tahap[] }[] = [
  { id: "nilai", no: "1", label: "Perlu dinilai", ket: "Belum diputuskan kantor", tahap: ["baru", "menunggu"] },
  { id: "siap", no: "2", label: "Disetujui", ket: "Siap dibuatkan SPPBJ / dikirim dari stok", tahap: ["disetujui", "stok"] },
  { id: "proses", no: "3", label: "Sedang diadakan", ket: "Sudah SPPBJ / SPBJ / Non PR PO", tahap: ["sppbj", "spbj"] },
  { id: "selesai", no: "4", label: "Selesai", ket: "Pengadaan tuntas / diterima kapal", tahap: ["selesai"] },
  { id: "tunda", no: "—", label: "Ditunda / ditolak", ket: "", tahap: ["ditunda", "ditolak"] },
];
const langkahDari = (t: Tahap): Langkah => LANGKAH.find((l) => l.tahap.includes(t))?.id || "nilai";
const bagianDari = (jenis: string): Bagian => (jenis.endsWith("deck") ? "deck" : "mesin");

const rpSingkat = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)} M` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} jt`
    : n >= 1e3 ? `${Math.round(n / 1e3)} rb` : n ? String(Math.round(n)) : "—";
const urutPrioritas = (p: Prioritas) => (p === "urgent" ? 0 : p === "normal" ? 1 : 2);

export default function Halaman() {
  return <Suspense fallback={<main className="p-8 text-sm text-slate-500">Memuat…</main>}><Monitoring /></Suspense>;
}

function Monitoring() {
  const router = useRouter();
  const sp = useSearchParams();
  const m = useMonitorPermintaan();
  const [bagian, setBagian] = useState<Bagian>("mesin");
  const [langkah, setLangkah] = useState<Langkah>("nilai");
  const [kapal, setKapal] = useState<string>("");       // "" = belum dipilih → otomatis kapal teratas; "*" = semua
  const [hanyaGantung, setHanyaGantung] = useState(false);
  const [bulan, setBulan] = useState("");
  const [cari, setCari] = useState("");
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState("");
  const [unduh, setUnduh] = useState(false);

  /* tautan dari lonceng & dashboard: ?bagian=deck&saring=menggantung&kapal=KMP. X */
  useEffect(() => {
    const b = sp.get("bagian"); if (b === "deck" || b === "mesin") setBagian(b);
    const s = sp.get("saring");
    if (s === "menggantung") { setHanyaGantung(true); setLangkah("nilai"); }
    if (s === "belum" || s === "perlu") setLangkah("nilai");
    if (s === "proses") setLangkah("proses");
    const k = sp.get("kapal"); if (k) setKapal(k);
  }, [sp]);

  /* pilihan dikosongkan setiap pindah tab — barang terpilih yang tak terlihat membingungkan */
  useEffect(() => { setPilih(new Set()); }, [bagian, langkah, kapal]);

  const daftarBulan = useMemo(
    () => Array.from(new Set(m.baris.map((b) => (b.dikirimPada || "").slice(0, 7)).filter(Boolean))).sort().reverse(), [m.baris]);

  /* saringan dasar: bulan & pencarian */
  const dasar = useMemo(() => m.baris.filter((b) => {
    if (bulan && !(b.dikirimPada || "").startsWith(bulan)) return false;
    if (cari.trim()) {
      const t = `${b.nama} ${b.spesifikasi} ${b.keterangan} ${b.ev?.catatan || ""} ${b.pengadaan?.nomor || ""}`.toLowerCase();
      if (!cari.toLowerCase().split(/\s+/).filter(Boolean).every((k) => t.includes(k))) return false;
    }
    return true;
  }), [m.baris, bulan, cari]);

  /* angka di tab bagian & langkah */
  const hitBagian = useMemo(() => {
    const h = { mesin: { nilai: 0, gantung: 0 }, deck: { nilai: 0, gantung: 0 } };
    dasar.forEach((b) => {
      const g = h[bagianDari(b.jenis)];
      if (langkahDari(b.tahap) === "nilai") g.nilai++;
      if (b.menggantung) g.gantung++;
    });
    return h;
  }, [dasar]);

  const diBagian = useMemo(() => dasar.filter((b) => bagianDari(b.jenis) === bagian), [dasar, bagian]);
  const hitLangkah = useMemo(() => {
    const h = Object.fromEntries(LANGKAH.map((l) => [l.id, 0])) as Record<Langkah, number>;
    diBagian.forEach((b) => { h[langkahDari(b.tahap)]++; });
    return h;
  }, [diBagian]);
  const gantungBagian = diBagian.filter((b) => b.menggantung).length;

  const diLangkah = useMemo(() => diBagian.filter((b) =>
    (hanyaGantung ? b.menggantung : langkahDari(b.tahap) === langkah)), [diBagian, langkah, hanyaGantung]);

  /* kolom kiri: kapal dengan jumlah barang di tahap ini */
  const daftarKapal = useMemo(() => {
    const g = new Map<string, { n: number; urgent: number; gantung: number; nilai: number }>();
    diLangkah.forEach((b) => {
      const x = g.get(b.kapal) || { n: 0, urgent: 0, gantung: 0, nilai: 0 };
      x.n++; if (b.prioritas === "urgent") x.urgent++; if (b.menggantung) x.gantung++;
      x.nilai += nilaiBarang(b, m.harga);
      g.set(b.kapal, x);
    });
    return Array.from(g.entries()).sort((a, b) =>
      b[1].gantung - a[1].gantung || b[1].urgent - a[1].urgent || b[1].n - a[1].n);
  }, [diLangkah, m.harga]);

  const kapalAktif = kapal === "*" ? "*" : daftarKapal.some(([k]) => k === kapal) ? kapal : (daftarKapal[0]?.[0] || "");

  const tampil = useMemo(() => diLangkah
    .filter((b) => kapalAktif === "*" || b.kapal === kapalAktif)
    .sort((a, b) => a.kapal.localeCompare(b.kapal, "id") * (kapalAktif === "*" ? 1 : 0)
      || Number(b.menggantung) - Number(a.menggantung)
      || urutPrioritas(a.prioritas) - urutPrioritas(b.prioritas)
      || b.umurHari - a.umurHari), [diLangkah, kapalAktif]);

  const terpilih = useMemo(() => tampil.filter((b) => pilih.has(b.kunci)), [tampil, pilih]);
  const nilaiTampil = tampil.reduce((s, b) => s + nilaiBarang(b, m.harga), 0);
  const nilaiPilih = terpilih.reduce((s, b) => s + nilaiBarang(b, m.harga), 0);

  const alih = (k: string) => setPilih((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const semuaDipilih = tampil.length > 0 && tampil.every((b) => pilih.has(b.kunci));
  const alihSemua = () => setPilih(semuaDipilih ? new Set() : new Set(tampil.map((b) => b.kunci)));

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
  const kembalikan = async (d: BarisMonitor[]) => {
    if (!d.length || !(await pastikanNama())) return;
    m.terapkan(d, { keputusan: "", diterima: "" }); setPilih(new Set());
  };
  const diterima = async (d: BarisMonitor[]) => {
    if (!d.length || !(await pastikanNama())) return;
    m.terapkan(d, { diterima: new Date().toISOString().slice(0, 10) }); setPilih(new Set());
  };

  const keSppbj = async () => {
    const kp = Array.from(new Set(terpilih.map((b) => b.kapal)));
    if (kp.length !== 1) { void beritahu("Satu SPPBJ untuk satu kapal. Pilih barang dari satu kapal saja."); return; }
    if (!(await pastikanNama())) return;
    const baris = terpilih.map((b) => ({
      nama: b.nama, spesifikasi: b.spesifikasi, jumlah: b.jumlah, satuan: b.satuan, keterangan: b.keterangan,
      hargaSatuan: angkaRupiah(b.hargaManual) || m.harga[b.kunci] || 0,
    }));
    if (!titipkanKeSppbj(kp[0], baris, `Permintaan ${bagian} — ${kp[0]}`)) return;
    setPilih(new Set());
    router.push("/sppbj/isi?dari=permintaan");
  };

  const ekspor = async () => {
    if (!diBagian.length || unduh) return;
    setUnduh(true);
    try {
      const judul = [bagian === "mesin" ? "Mesin" : "Deck", bulan ? bulanIndo(bulan) : ""].filter(Boolean).join(" - ");
      await unduhExcel(diBagian, m.harga, judul);
    } catch (e: any) { void beritahu(e?.message || String(e)); }
    finally { setUnduh(false); }
  };

  const brsDetail = detail ? m.baris.find((b) => b.kunci === detail) || null : null;
  const namaBagian = bagian === "mesin" ? "Mesin" : "Deck";

  return (
    <main className="max-w-[1400px] mx-auto px-5 py-6 pb-32">
      {/* kepala */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 grid place-items-center text-xl text-white shadow-md">📋</div>
        <div className="flex-1 min-w-[240px]">
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Monitoring Permintaan Kapal</h1>
          <p className="text-slate-500 text-xs">Nilai permintaan kapal, lalu pantau sampai barangnya diterima kapal.</p>
        </div>
        <label className="text-[11px] text-slate-600 flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 ring-1 ring-slate-200">
          Penilai
          <input value={m.penilai} onChange={(e) => m.gantiPenilai(e.target.value)} placeholder="nama Anda"
            className="text-xs w-28 focus:outline-none font-semibold" />
        </label>
        <Link href="/permintaan-laporan/manajemen" className="btn btn-ghost text-xs">📊 Dashboard</Link>
        <button onClick={ekspor} disabled={!diBagian.length || unduh} className="btn btn-ghost text-xs disabled:opacity-50">
          {unduh ? "Menyusun…" : `⬇ Excel ${namaBagian}`}
        </button>
        <button onClick={() => void m.muatUlang()} className="btn btn-ghost text-xs">↻</button>
      </div>

      {m.galat && <p className="mt-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{m.galat}</p>}

      {/* 1. Deck / Mesin */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {(["mesin", "deck"] as Bagian[]).map((b) => (
          <button key={b} onClick={() => { setBagian(b); setKapal(""); setHanyaGantung(false); }}
            className={`rounded-2xl px-5 py-3 text-left transition ring-2 ${bagian === b
              ? "bg-slate-900 text-white ring-slate-900 shadow-lg" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-400"}`}>
            <p className="text-lg font-extrabold">{b === "mesin" ? "⚙️ Permintaan Mesin" : "🛳️ Permintaan Deck"}</p>
            <p className={`text-xs ${bagian === b ? "text-slate-300" : "text-slate-500"}`}>
              {hitBagian[b].nilai} perlu dinilai
              {hitBagian[b].gantung > 0 && <span className={`ml-2 font-bold ${bagian === b ? "text-red-300" : "text-red-600"}`}>· ⏰ {hitBagian[b].gantung} urgent tertahan</span>}
            </p>
          </button>
        ))}
      </div>

      {/* 2. Langkah */}
      <div className="mt-3 flex flex-wrap items-stretch gap-2">
        {LANGKAH.map((l, i) => {
          const aktif = !hanyaGantung && langkah === l.id;
          return (
            <Fragment2 key={l.id}>
              {i > 0 && i < 4 && <span className="self-center text-slate-300 text-lg">›</span>}
              <button onClick={() => { setLangkah(l.id); setHanyaGantung(false); setKapal(""); }} title={l.ket}
                className={`rounded-xl px-3 py-2 text-left transition ring-1 ${l.id === "tunda" ? "ml-auto" : ""} ${aktif
                  ? "bg-sky-600 text-white ring-sky-600" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-400"}`}>
                <span className={`text-[10px] font-bold ${aktif ? "text-sky-100" : "text-slate-400"}`}>{l.no === "—" ? "" : `LANGKAH ${l.no}`}</span>
                <span className="block text-sm font-bold leading-tight">{l.label} <span className={aktif ? "text-sky-100" : "text-slate-400"}>{hitLangkah[l.id]}</span></span>
              </button>
            </Fragment2>
          );
        })}
      </div>

      {/* peringatan urgent tertahan */}
      {gantungBagian > 0 && (
        <button onClick={() => { setHanyaGantung(!hanyaGantung); setKapal(""); }}
          className={`mt-3 w-full text-left rounded-xl px-4 py-2.5 text-sm font-semibold transition ${hanyaGantung
            ? "bg-red-600 text-white" : "bg-red-50 text-red-800 ring-1 ring-red-200 hover:bg-red-100"}`}>
          ⏰ {gantungBagian} barang <b>urgent</b> {namaBagian.toLowerCase()} sudah lebih dari {BATAS_MENGGANTUNG_HARI} hari belum diproses
          <span className="float-right text-xs font-bold underline">{hanyaGantung ? "kembali ke semua" : "tampilkan saja ini"}</span>
        </button>
      )}

      {/* 3. Kapal | barang */}
      <div className="mt-3 grid md:grid-cols-[230px_1fr] gap-3 items-start">
        <aside className="bg-white rounded-2xl ring-line elev-sm p-2 md:sticky md:top-4">
          <p className="px-2 pt-1 pb-2 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Kapal</p>
          {m.muat ? <p className="px-2 pb-2 text-xs text-slate-400">Memuat…</p> : !daftarKapal.length ? (
            <p className="px-2 pb-2 text-xs text-slate-400">Kosong.</p>
          ) : (
            <>
              {daftarKapal.map(([k, x]) => (
                <button key={k} onClick={() => setKapal(k)}
                  className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${kapalAktif === k ? "bg-sky-50 ring-1 ring-sky-300 font-bold text-sky-900" : "hover:bg-slate-50 text-slate-700"}`}>
                  <span className="flex-1 truncate">{ringkasKapal(k)}</span>
                  {x.gantung > 0 && <span className="text-[10px] font-bold text-white bg-red-600 rounded px-1">⏰{x.gantung}</span>}
                  {x.urgent > 0 && x.gantung === 0 && <span className="text-[10px] font-bold text-rose-700">●{x.urgent}</span>}
                  <span className="tabular-nums text-slate-500 w-7 text-right">{x.n}</span>
                </button>
              ))}
              <button onClick={() => setKapal("*")}
                className={`mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs border-t border-slate-100 ${kapalAktif === "*" ? "bg-sky-50 font-bold text-sky-900" : "text-slate-500 hover:bg-slate-50"}`}>
                Semua kapal <span className="float-right tabular-nums">{diLangkah.length}</span>
              </button>
            </>
          )}
        </aside>

        <section className="bg-white rounded-2xl ring-line elev-sm overflow-hidden min-w-0">
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <h2 className="font-extrabold text-slate-800">{kapalAktif === "*" ? "Semua kapal" : kapalAktif || "—"}</h2>
            <span className="text-[11px] text-slate-500">{tampil.length} barang · taksiran Rp{rpSingkat(nilaiTampil)}</span>
            <div className="ml-auto flex items-center gap-2">
              <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔍 cari barang…"
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 w-44" />
              <select value={bulan} onChange={(e) => setBulan(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                <option value="">Semua bulan</option>
                {daftarBulan.map((b) => <option key={b} value={b}>{bulanIndo(b)}</option>)}
              </select>
            </div>
          </div>

          {m.muat ? <p className="p-6 text-sm text-slate-500">Memuat permintaan, penilaian dan SPPBJ…</p> : !tampil.length ? (
            <p className="p-8 text-center text-sm text-slate-500">Tidak ada barang di sini. 👍</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">
                  <tr className="border-b border-slate-100">
                    <th className="p-2 w-8"><input type="checkbox" checked={semuaDipilih} onChange={alihSemua} className="h-4 w-4" title="Pilih semua" /></th>
                    <th className="p-2 text-left">Barang</th>
                    <th className="p-2 text-left w-28">Diminta</th>
                    <th className="p-2 text-right w-24">Taksiran</th>
                    <th className="p-2 text-left w-[200px]">Prioritas · Klasifikasi</th>
                    <th className="p-2 text-left w-[190px]">{langkah === "nilai" && !hanyaGantung ? "Keputusan" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((b, i) => (
                    <Fragment2 key={b.kunci}>
                      {kapalAktif === "*" && (i === 0 || tampil[i - 1].kapal !== b.kapal) && (
                        <tr><td colSpan={6} className="px-3 pt-3 pb-1 text-[11px] font-extrabold text-slate-700 bg-slate-50 border-y border-slate-100">{b.kapal}</td></tr>
                      )}
                      <Baris b={b} dipilih={pilih.has(b.kunci)} alih={() => alih(b.kunci)} nilai={nilaiBarang(b, m.harga)}
                        modeNilai={langkahDari(b.tahap) === "nilai"} buka={() => setDetail(b.kunci)}
                        ubah={(p) => void ubah([b], p)} putus={(k) => void putus([b], k)} diterima={() => void diterima([b])} />
                    </Fragment2>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* bilah aksi untuk barang terpilih — isinya mengikuti langkah */}
      {terpilih.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex flex-wrap items-center gap-2 max-w-[95vw]">
          <span className="text-xs font-bold">{terpilih.length} barang · Rp{rpSingkat(nilaiPilih)}</span>
          <span className="w-px h-5 bg-white/20" />
          {terpilih.some((b) => langkahDari(b.tahap) === "nilai") && (
            <>
              <button onClick={() => void putus(terpilih, "setuju")} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400">✓ Setujui</button>
              <button onClick={() => void putus(terpilih, "tunda")} className="text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">Tunda</button>
              <button onClick={() => void putus(terpilih, "tolak")} className="text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">Tolak</button>
              <select defaultValue="" onChange={(e) => { if (e.target.value) void ubah(terpilih, { prioritas: e.target.value as Prioritas }); e.target.value = ""; }}
                className="text-[11px] bg-white/10 rounded-lg px-1.5 py-1.5">
                <option value="" className="text-slate-800">Ubah prioritas…</option>
                {PRIORITAS.map((p) => <option key={p.id} value={p.id} className="text-slate-800">{p.ikon} {p.label}</option>)}
              </select>
              <select defaultValue="" onChange={(e) => { if (e.target.value) void ubah(terpilih, { klasifikasi: e.target.value as Klasifikasi }); e.target.value = ""; }}
                className="text-[11px] bg-white/10 rounded-lg px-1.5 py-1.5">
                <option value="" className="text-slate-800">Ubah klasifikasi…</option>
                {KLASIFIKASI.map((k) => <option key={k.id} value={k.id} className="text-slate-800">{k.label}</option>)}
              </select>
            </>
          )}
          {terpilih.some((b) => langkahDari(b.tahap) === "siap") && (
            <button onClick={() => void keSppbj()} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400">→ Buat SPPBJ</button>
          )}
          {terpilih.some((b) => ["siap", "proses"].includes(langkahDari(b.tahap))) && (
            <button onClick={() => void diterima(terpilih)} className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500">Sudah diterima kapal</button>
          )}
          {terpilih.some((b) => ["siap", "tunda", "selesai"].includes(langkahDari(b.tahap))) && (
            <button onClick={async () => { if (await konfirmasi("Kembalikan barang terpilih ke 'Perlu dinilai'?")) void kembalikan(terpilih); }}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">↺ Nilai ulang</button>
          )}
          <button onClick={() => setPilih(new Set())} className="text-xs px-2 py-1.5 rounded-lg hover:bg-white/10">✕</button>
        </div>
      )}

      {brsDetail && <Detail b={brsDetail} tutup={() => setDetail("")} ubah={(p) => void ubah([brsDetail], p)}
        pengadaan={m.pengadaan.filter((p) => p.items.some((i) => ringkasKapal(i.kapal).toUpperCase() === ringkasKapal(brsDetail.kapal).toUpperCase()))}
        nilai={nilaiBarang(brsDetail, m.harga)} />}
    </main>
  );
}

/* ── komponen kecil ──────────────────────────────────────────────────────── */

function Fragment2({ children }: { children: React.ReactNode }) { return <>{children}</>; }

function Lencana({ kelas, children, judul }: { kelas: string; children: React.ReactNode; judul?: string }) {
  return <span title={judul} className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ring-1 whitespace-nowrap ${kelas}`}>{children}</span>;
}

/** pilihan ringkas berbentuk pil; saran mesin tampil putus-putus sampai dikonfirmasi */
function Pil<T extends string>({ nilai, saran, daftar, ubah }: {
  nilai: T | ""; saran: T; daftar: { id: T; label: string; kelas: string; ikon?: string }[]; ubah: (v: T) => void;
}) {
  const efektif = (nilai || saran) as T;
  const def = daftar.find((x) => x.id === efektif);
  return (
    <select value={efektif} onChange={(e) => ubah(e.target.value as T)} title={nilai ? "" : "Saran mesin — ikut terkunci saat diputuskan"}
      className={`text-[11px] font-bold rounded-full pl-2 pr-1 py-0.5 ring-1 ${def?.kelas || "bg-white ring-slate-300"} ${nilai ? "" : "border border-dashed border-current opacity-75"}`}>
      {daftar.map((x) => <option key={x.id} value={x.id}>{x.ikon ? `${x.ikon} ` : ""}{x.label}</option>)}
    </select>
  );
}

function Baris({ b, dipilih, alih, nilai, modeNilai, buka, ubah, putus, diterima }: {
  b: BarisMonitor; dipilih: boolean; alih: () => void; nilai: number; modeNilai: boolean; buka: () => void;
  ubah: (p: Patch) => void; putus: (k: "setuju" | "tunda" | "tolak") => void; diterima: () => void;
}) {
  const t = TAHAP[b.tahap];
  return (
    <tr className={`border-b border-slate-100 last:border-0 align-top ${b.menggantung ? "bg-red-50/60" : dipilih ? "bg-sky-50/70" : "hover:bg-slate-50/70"}`}>
      <td className="p-2"><input type="checkbox" checked={dipilih} onChange={alih} className="h-4 w-4" /></td>
      <td className="p-2">
        <button onClick={buka} className="font-semibold text-slate-900 text-left hover:underline" title="Buka rincian, catatan & riwayat">{b.nama}</button>
        <span className="text-slate-500"> · {b.jumlah || "—"} {b.satuan}</span>
        {b.spesifikasi && <p className="text-[11px] text-slate-500">{b.spesifikasi}</p>}
        {(b.menggantung || b.dimintaUlang > 0 || b.adaLk) && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {b.menggantung && <Lencana kelas="bg-red-600 text-white ring-red-700" judul="Urgent belum masuk pengadaan">⏰ tertahan {b.umurHari} hari</Lencana>}
            {b.dimintaUlang > 0 && <Lencana kelas="bg-amber-100 text-amber-800 ring-amber-300" judul="Sudah pernah diminta dan belum diproses">🔁 diminta ulang</Lencana>}
            {b.adaLk && <Lencana kelas="bg-orange-100 text-orange-800 ring-orange-300" judul="Kiriman disertai laporan ketidaksesuaian">📄 ada LK</Lencana>}
          </div>
        )}
        {b.ev?.catatan && <p className="text-[11px] italic text-slate-600 mt-0.5">“{b.ev.catatan}”</p>}
      </td>
      <td className="p-2 text-[11px] text-slate-600 whitespace-nowrap">
        {b.dikirimPada ? tanggalIndo(b.dikirimPada.slice(0, 10)) : "—"}
        <p className="text-slate-400">{b.umurHari} hari lalu{b.berkasUrl && <> · <a href={b.berkasUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">PDF ↗</a></>}</p>
      </td>
      <td className="p-2 text-right tabular-nums text-[11px] text-slate-700">{nilai ? rupiah(nilai) : <span className="text-slate-300">—</span>}</td>
      <td className="p-2">
        <div className="flex flex-wrap gap-1">
          <Pil<Prioritas> nilai={b.ev?.prioritas || ""} saran={b.saranPrioritas} daftar={PRIORITAS} ubah={(v) => ubah({ prioritas: v })} />
          <Pil<Klasifikasi> nilai={b.ev?.klasifikasi || ""} saran={b.saranKlasifikasi} daftar={KLASIFIKASI} ubah={(v) => ubah({ klasifikasi: v })} />
        </div>
      </td>
      <td className="p-2">
        {modeNilai ? (
          <div className="flex gap-1">
            <button onClick={() => putus("setuju")} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500">Setuju</button>
            <button onClick={() => putus("tunda")} className="text-[11px] px-2 py-1 rounded-lg ring-1 ring-slate-300 text-slate-600 hover:bg-slate-100">Tunda</button>
            <button onClick={() => putus("tolak")} className="text-[11px] px-2 py-1 rounded-lg ring-1 ring-rose-200 text-rose-700 hover:bg-rose-50">Tolak</button>
          </div>
        ) : (
          <div className="space-y-0.5">
            <Lencana kelas={t.kelas}>{t.label}</Lencana>
            {b.pengadaan && (
              <p className="text-[10px] text-slate-600 truncate max-w-[180px]" title={b.pengadaan.nama}>
                {b.pengadaan.asal === "nonpr" ? "Non PR PO" : "SPPBJ"} {b.pengadaan.nomor}{b.pengadaan.tahapScm ? ` · SCM ${b.pengadaan.tahapScm}` : ""}
              </p>
            )}
            {b.ev?.diterima && <p className="text-[10px] text-emerald-700">diterima {tanggalIndo(b.ev.diterima)}</p>}
            {(b.tahap === "disetujui" || b.tahap === "stok" || b.tahap === "sppbj" || b.tahap === "spbj") && (
              <button onClick={diterima} className="text-[10px] font-bold text-emerald-700 hover:underline">✓ sudah diterima kapal</button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

function Detail({ b, tutup, ubah, pengadaan, nilai }: {
  b: BarisMonitor; tutup: () => void; nilai: number; ubah: (p: Patch) => void;
  pengadaan: ReturnType<typeof useMonitorPermintaan>["pengadaan"];
}) {
  const [catatan, setCatatan] = useState(b.ev?.catatan || "");
  const [pic, setPic] = useState(b.ev?.pic || "");
  const urut = [...pengadaan].sort((x, y) => (y.tanggal || "").localeCompare(x.tanggal || "")).slice(0, 60);
  const simpan = () => {
    const p: Patch = {};
    if (catatan !== (b.ev?.catatan || "")) p.catatan = catatan;
    if (pic !== (b.ev?.pic || "")) p.pic = pic;
    if (Object.keys(p).length) ubah(p);
    tutup();
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 grid place-items-center p-4" onClick={simpan}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{b.kapal} · {b.jenis.endsWith("deck") ? "Deck" : "Mesin"} · {TAHAP[b.tahap].label}</p>
            <h2 className="text-lg font-extrabold text-slate-900">{b.nama}</h2>
            <p className="text-xs text-slate-600">{b.spesifikasi} {b.spesifikasi ? "·" : ""} {b.jumlah} {b.satuan} · taksiran Rp{rupiah(nilai)}</p>
          </div>
          <button onClick={simpan} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <p><span className="text-slate-500">Dikirim</span><br /><b>{b.dikirimPada ? tanggalIndo(b.dikirimPada.slice(0, 10)) : "—"}</b> ({b.umurHari} hari) oleh {b.pengirim || "ABK"}</p>
            <p><span className="text-slate-500">Berkas</span><br />{b.berkasUrl ? <a href={b.berkasUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline break-all">{b.berkasNama} ↗</a> : b.berkasNama}</p>
            {b.keterangan && <p className="sm:col-span-2"><span className="text-slate-500">Keterangan dari kapal</span><br />{b.keterangan}</p>}
            {b.catatanKapal && <p className="sm:col-span-2"><span className="text-slate-500">Catatan pengirim</span><br />{b.catatanKapal}</p>}
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
          <label className="block text-xs"><span className="text-slate-500 font-bold">Catatan kantor</span>
            <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} placeholder="mis. tunggu pagu Desember / ambil dari stok KMP Lema"
              className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-1.5" />
          </label>
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
          <div className="text-right"><button onClick={simpan} className="btn btn-primary text-xs px-4 py-2">Simpan & tutup</button></div>
        </div>
      </div>
    </div>
  );
}
