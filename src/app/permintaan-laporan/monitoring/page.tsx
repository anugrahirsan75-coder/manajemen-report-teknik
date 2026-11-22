"use client";
/**
 * MONITORING PERMINTAAN KAPAL — keputusan kantor atas tiap barang yang diminta.
 *
 * Isi permintaan sudah dipecah Juru Baca menjadi baris barang. Di sini tiap
 * barang dinilai dengan TIGA pilihan saja — prioritas, klasifikasi, keputusan —
 * dan statusnya berjalan sendiri dari SPPBJ / Non PR PO / SCM yang tersimpan.
 *
 * Supaya tidak berbelit:
 *  · Mesin menyarankan prioritas & klasifikasi; orang tinggal mengonfirmasi.
 *  · Pilih banyak barang sekaligus, tetapkan sekali klik.
 *  · Saringan siap pakai: "Perlu tindakan", "Urgent menggantung", dst.
 *  · Barang yang diminta ulang dan yang disertai LK ditandai.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { titipkanKeSppbj } from "@/lib/lapor/bacaPermintaan";
import { bulanIndo, singkatJenis } from "@/lib/lapor/types";
import { rupiah, tanggalIndo } from "@/lib/format";
import { ringkasKapal } from "@/lib/kapal/nama";
import { angkaRupiah, nilaiBarang, ringkas } from "@/lib/permintaanMonitor/logika";
import {
  BATAS_MENGGANTUNG_HARI, BarisMonitor, KEPUTUSAN, KLASIFIKASI, Keputusan, Klasifikasi, PRIORITAS, Prioritas, TAHAP,
  TAHAP_BELUM_PROSES,
} from "@/lib/permintaanMonitor/types";
import { unduhExcel, useMonitorPermintaan } from "@/lib/permintaanMonitor/useMonitor";
import { beritahu, konfirmasi } from "@/components/Konfirmasi";

type Saring = "perlu" | "menggantung" | "urgent" | "belum" | "setuju" | "proses" | "selesai" | "tunda" | "semua";

const SARING: { id: Saring; label: string; ket: string }[] = [
  { id: "perlu", label: "Perlu tindakan", ket: "Belum dievaluasi, menunggu keputusan, atau disetujui tapi belum SPPBJ" },
  { id: "menggantung", label: `⏰ Urgent > ${BATAS_MENGGANTUNG_HARI} hari`, ket: "Urgent yang belum masuk pengadaan" },
  { id: "urgent", label: "🔴 Urgent terbuka", ket: "Semua barang urgent yang belum selesai" },
  { id: "belum", label: "Belum dievaluasi", ket: "Belum disentuh kantor" },
  { id: "setuju", label: "Disetujui, belum SPPBJ", ket: "Sudah diputuskan, tinggal diadakan" },
  { id: "proses", label: "Proses pengadaan", ket: "Sudah SPPBJ / SPBJ / Non PR PO" },
  { id: "selesai", label: "Selesai", ket: "Pengadaan selesai atau diterima kapal" },
  { id: "tunda", label: "Ditunda / ditolak", ket: "" },
  { id: "semua", label: "Semua", ket: "" },
];

function lolosSaring(b: BarisMonitor, s: Saring) {
  switch (s) {
    case "perlu": return TAHAP_BELUM_PROSES.includes(b.tahap);
    case "menggantung": return b.menggantung;
    case "urgent": return b.prioritas === "urgent" && b.tahap !== "selesai" && b.tahap !== "ditolak";
    case "belum": return b.tahap === "baru";
    case "setuju": return b.tahap === "disetujui" || b.tahap === "stok";
    case "proses": return b.tahap === "sppbj" || b.tahap === "spbj";
    case "selesai": return b.tahap === "selesai";
    case "tunda": return b.tahap === "ditunda" || b.tahap === "ditolak";
    default: return true;
  }
}

const bulanDari = (iso: string) => (iso || "").slice(0, 7);
const rupiahSingkat = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1e9).toFixed(2)} M` : n >= 1_000_000 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} jt`
    : n >= 1000 ? `${Math.round(n / 1000)} rb` : n ? String(Math.round(n)) : "—";

export default function Halaman() {
  return <Suspense fallback={<main className="p-8 text-sm text-slate-500">Memuat…</main>}><MonitoringPermintaan /></Suspense>;
}

function MonitoringPermintaan() {
  const router = useRouter();
  const sp = useSearchParams();
  const m = useMonitorPermintaan();
  const [saring, setSaring] = useState<Saring>("perlu");
  const [kapal, setKapal] = useState("");
  const [bulan, setBulan] = useState("");
  const [bagian, setBagian] = useState("");
  const [cari, setCari] = useState("");
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [buka, setBuka] = useState<Set<string> | null>(null);
  const [detail, setDetail] = useState<string>("");
  const [unduh, setUnduh] = useState(false);

  useEffect(() => {
    const s = sp.get("saring") as Saring | null;
    if (s && SARING.some((x) => x.id === s)) setSaring(s);
    const k = sp.get("kapal"); if (k) setKapal(k);
  }, [sp]);

  const daftarKapal = useMemo(() => Array.from(new Set(m.baris.map((b) => b.kapal))).sort(), [m.baris]);
  const daftarBulan = useMemo(
    () => Array.from(new Set(m.baris.map((b) => bulanDari(b.dikirimPada)).filter(Boolean))).sort().reverse(), [m.baris]);

  /* saringan selain status — dipakai juga untuk menghitung angka di tombol status */
  const dasar = useMemo(() => m.baris.filter((b) => {
    if (kapal && b.kapal !== kapal) return false;
    if (bulan && bulanDari(b.dikirimPada) !== bulan) return false;
    if (bagian && !b.jenis.endsWith(bagian)) return false;
    if (cari.trim()) {
      const t = `${b.nama} ${b.spesifikasi} ${b.keterangan} ${b.ev?.catatan || ""} ${b.pengadaan?.nomor || ""}`.toLowerCase();
      if (!cari.toLowerCase().split(/\s+/).filter(Boolean).every((k) => t.includes(k))) return false;
    }
    return true;
  }), [m.baris, kapal, bulan, bagian, cari]);

  const tampil = useMemo(() => dasar.filter((b) => lolosSaring(b, saring))
    .sort((a, b) => (Number(b.menggantung) - Number(a.menggantung))
      || ((a.prioritas === "urgent" ? 0 : a.prioritas === "normal" ? 1 : 2) - (b.prioritas === "urgent" ? 0 : b.prioritas === "normal" ? 1 : 2))
      || b.umurHari - a.umurHari), [dasar, saring]);

  const hitung = useMemo(() => Object.fromEntries(SARING.map((s) => [s.id, dasar.filter((b) => lolosSaring(b, s.id)).length])) as Record<Saring, number>, [dasar]);

  const grup = useMemo(() => {
    const g = new Map<string, BarisMonitor[]>();
    tampil.forEach((b) => g.set(b.kapal, [...(g.get(b.kapal) || []), b]));
    return Array.from(g.entries()).sort((a, b) =>
      b[1].filter((x) => x.menggantung).length - a[1].filter((x) => x.menggantung).length
      || b[1].filter((x) => x.prioritas === "urgent").length - a[1].filter((x) => x.prioritas === "urgent").length
      || a[0].localeCompare(b[0], "id"));
  }, [tampil]);

  /* grup yang terbuka: bawaan = kapal dengan barang urgent, atau semua bila sedikit */
  const terbuka = useMemo(() => {
    if (buka) return buka;
    if (tampil.length <= 80) return new Set(grup.map(([k]) => k));
    return new Set(grup.filter(([, d]) => d.some((x) => x.prioritas === "urgent")).map(([k]) => k));
  }, [buka, grup, tampil.length]);
  const alihGrup = (k: string) => setBuka(() => { const n = new Set(terbuka); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const r = m.ringkasan;
  const terpilih = useMemo(() => m.baris.filter((b) => pilih.has(b.kunci)), [m.baris, pilih]);
  const nilaiPilih = terpilih.reduce((s, b) => s + nilaiBarang(b, m.harga), 0);
  const kapalPilih = Array.from(new Set(terpilih.map((b) => b.kapal)));

  const alih = (k: string) => setPilih((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const alihBanyak = (d: BarisMonitor[]) => setPilih((s) => {
    const n = new Set(s); const penuh = d.every((b) => n.has(b.kunci));
    d.forEach((b) => (penuh ? n.delete(b.kunci) : n.add(b.kunci))); return n;
  });

  const pastikanNama = async () => {
    if (m.penilai) return true;
    const n = window.prompt("Nama Anda (dicatat di riwayat keputusan, diingat di peramban ini):", "");
    if (!n?.trim()) { void beritahu("Isi nama dulu supaya riwayat keputusan jelas siapa yang memutuskan."); return false; }
    m.gantiPenilai(n.trim()); return true;
  };

  const ubah = async (d: BarisMonitor[], patch: Parameters<typeof m.terapkan>[1]) => {
    if (!(await pastikanNama())) return;
    m.terapkan(d, patch);
  };

  const keSppbj = async () => {
    if (kapalPilih.length !== 1) { void beritahu("Satu SPPBJ untuk satu kapal. Pilih barang dari satu kapal saja."); return; }
    if (!(await pastikanNama())) return;
    const baris = terpilih.map((b) => ({
      nama: b.nama, spesifikasi: b.spesifikasi, jumlah: b.jumlah, satuan: b.satuan, keterangan: b.keterangan,
      hargaSatuan: angkaRupiah(b.hargaManual) || m.harga[b.kunci] || 0,
    }));
    const tolak = terpilih.filter((b) => b.ev?.keputusan === "tolak").length;
    if (tolak && !(await konfirmasi(`${tolak} barang terpilih berstatus DITOLAK. Tetap dimasukkan ke SPPBJ?`))) return;
    m.terapkan(terpilih.filter((b) => !b.ev?.keputusan), { keputusan: "setuju" });
    if (!titipkanKeSppbj(kapalPilih[0], baris, `Permintaan kapal — ${kapalPilih[0]}`)) return;
    setPilih(new Set());
    router.push("/sppbj/isi?dari=permintaan");
  };

  const ekspor = async () => {
    if (!tampil.length || unduh) return;
    setUnduh(true);
    try {
      const judul = [kapal ? ringkasKapal(kapal) : "", bulan ? bulanIndo(bulan) : "", SARING.find((s) => s.id === saring)?.label.replace(/[⏰🔴]\s*/g, "") || ""]
        .filter(Boolean).join(" - ") || "Semua";
      await unduhExcel(tampil, m.harga, judul);
    } catch (e: any) { void beritahu(e?.message || String(e)); }
    finally { setUnduh(false); }
  };

  const brsDetail = detail ? m.baris.find((b) => b.kunci === detail) || null : null;

  return (
    <main className="max-w-[1400px] mx-auto px-5 py-8 pb-32">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex flex-wrap items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 grid place-items-center text-2xl text-white shadow-md shrink-0">📋</div>
          <div className="flex-1 min-w-[260px]">
            <h1 className="text-2xl font-extrabold asdp-text-gradient tracking-tight">Monitoring Permintaan Kapal</h1>
            <p className="text-slate-500 text-sm">Evaluasi tiap barang yang diminta kapal — prioritas, klasifikasi, keputusan — dan pantau sampai diterima kapal.</p>
          </div>
          <label className="text-[11px] text-slate-600 flex items-center gap-1.5 bg-white/70 rounded-lg px-2 py-1 ring-1 ring-slate-200">
            Penilai
            <input value={m.penilai} onChange={(e) => m.gantiPenilai(e.target.value)} placeholder="nama Anda"
              className="text-xs border-0 bg-transparent w-28 focus:outline-none font-semibold" />
          </label>
          <Link href="/permintaan-laporan/manajemen" className="btn btn-primary text-xs px-4 py-2">📊 Dashboard Manajemen</Link>
          <button onClick={ekspor} disabled={!tampil.length || unduh} className="btn btn-ghost text-xs disabled:opacity-50">
            {unduh ? "Menyusun…" : "⬇ Excel"}
          </button>
          <button onClick={() => void m.muatUlang()} className="btn btn-ghost text-xs">↻ Muat ulang</button>
        </div>
      </div>

      {m.galat && <p className="mt-4 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{m.galat}</p>}

      <section className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kartu label="Barang terbuka" nilai={String(r.terbuka)} sub={`dari ${r.total} barang diminta`} bar="bg-slate-500" tint="text-slate-900"
          aktif={saring === "semua"} klik={() => setSaring("semua")} />
        <Kartu label="Belum dievaluasi" nilai={String(r.belumDievaluasi)} bar="bg-slate-400" tint="text-slate-700"
          aktif={saring === "belum"} klik={() => setSaring("belum")} />
        <Kartu label="Urgent terbuka" nilai={String(r.urgentTerbuka)} bar="bg-rose-500" tint="text-rose-700"
          aktif={saring === "urgent"} klik={() => setSaring("urgent")} />
        <Kartu label={`Urgent > ${BATAS_MENGGANTUNG_HARI} hari`} nilai={String(r.menggantung)} sub="belum masuk pengadaan" bar="bg-red-600"
          tint={r.menggantung ? "text-red-700" : "text-slate-400"} aktif={saring === "menggantung"} klik={() => setSaring("menggantung")} />
        <Kartu label="Disetujui, belum SPPBJ" nilai={String(r.disetujuiBelumSppbj)} bar="bg-orange-500" tint="text-orange-700"
          aktif={saring === "setuju"} klik={() => setSaring("setuju")} />
        <Kartu label="Nilai terbuka" nilai={`Rp${rupiahSingkat(r.nilaiTerbuka)}`}
          sub={`rutin ${rupiahSingkat(r.nilaiPerKlasifikasi.rutin)} · biaya ${rupiahSingkat(r.nilaiPerKlasifikasi.biaya)} · inv ${rupiahSingkat(r.nilaiPerKlasifikasi.investasi)}`}
          bar="bg-indigo-500" tint="text-indigo-700" />
      </section>

      {/* saringan */}
      <div className="mt-3 bg-white rounded-2xl ring-line elev-sm p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari barang / catatan / no. SPPBJ…"
              className="text-xs border border-slate-300 rounded-lg pl-7 pr-3 py-1.5 w-64" />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
          </div>
          <select value={kapal} onChange={(e) => setKapal(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
            <option value="">Semua kapal</option>
            {daftarKapal.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={bulan} onChange={(e) => setBulan(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
            <option value="">Semua bulan kirim</option>
            {daftarBulan.map((b) => <option key={b} value={b}>{bulanIndo(b)}</option>)}
          </select>
          <select value={bagian} onChange={(e) => setBagian(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
            <option value="">Deck & mesin</option>
            <option value="deck">Deck</option>
            <option value="mesin">Mesin</option>
          </select>
          <span className="ml-auto text-[11px] text-slate-500">
            {m.muat ? "Memuat…" : `${tampil.length} barang tampil`}{m.sibukSimpan ? " · menyimpan…" : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SARING.map((s) => (
            <button key={s.id} title={s.ket} onClick={() => setSaring(s.id)}
              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition ${saring === s.id
                ? "bg-slate-800 text-white border-slate-800" : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"}`}>
              {s.label} <span className="opacity-70">{hitung[s.id] ?? 0}</span>
            </button>
          ))}
          <button onClick={() => setBuka(new Set(grup.map(([k]) => k)))} className="ml-auto text-[11px] text-slate-600 hover:underline">Buka semua</button>
          <button onClick={() => setBuka(new Set())} className="text-[11px] text-slate-600 hover:underline">Tutup semua</button>
        </div>
      </div>

      {/* tabel per kapal */}
      <div className="mt-3 space-y-3">
        {m.muat ? (
          <p className="bg-white rounded-2xl ring-line p-6 text-sm text-slate-500">Memuat kiriman, hasil baca, penilaian dan SPPBJ…</p>
        ) : !grup.length ? (
          <div className="bg-white rounded-2xl ring-line p-8 text-center text-sm text-slate-500">
            Tidak ada barang pada saringan ini.
            {!m.baris.length && <p className="mt-2 text-xs">Barang muncul di sini setelah berkas permintaan dibaca Juru Baca (menu Isi permintaan).</p>}
          </div>
        ) : grup.map(([kp, d]) => {
          const rk = ringkas(d, m.harga);
          const ok = terbuka.has(kp);
          const semuaPilih = d.every((b) => pilih.has(b.kunci));
          return (
            <section key={kp} className="bg-white rounded-2xl ring-line elev-sm overflow-hidden">
              <header className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <input type="checkbox" checked={semuaPilih} onChange={() => alihBanyak(d)} className="h-4 w-4" title="Pilih semua barang kapal ini" />
                <button onClick={() => alihGrup(kp)} className="flex items-center gap-2 font-extrabold text-slate-800">
                  <span className="text-slate-400 text-xs">{ok ? "▾" : "▸"}</span>{kp}
                </button>
                <span className="text-[11px] text-slate-500">{d.length} barang</span>
                {rk.urgentTerbuka > 0 && <Lencana kelas="bg-rose-100 text-rose-800 ring-rose-300">🔴 {rk.urgentTerbuka} urgent</Lencana>}
                {rk.menggantung > 0 && <Lencana kelas="bg-red-600 text-white ring-red-700">⏰ {rk.menggantung} menggantung</Lencana>}
                {rk.belumDievaluasi > 0 && <Lencana kelas="bg-slate-100 text-slate-700 ring-slate-300">{rk.belumDievaluasi} belum dinilai</Lencana>}
                <span className="ml-auto text-[11px] text-slate-600">taksiran terbuka <b>Rp{rupiah(rk.nilaiTerbuka)}</b></span>
                <button onClick={async () => { if (await pastikanNama()) m.terimaSaran(d); }}
                  className="text-[11px] font-bold text-sky-700 hover:underline" title="Konfirmasi saran prioritas & klasifikasi untuk barang yang belum dinilai">
                  ✓ Terima saran
                </button>
              </header>
              {ok && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase tracking-wide text-slate-500 font-bold bg-white">
                      <tr className="border-b border-slate-100">
                        <th className="p-2 w-7" />
                        <th className="p-2 text-left min-w-[220px]">Barang</th>
                        <th className="p-2 text-left w-28">Diminta</th>
                        <th className="p-2 text-right w-24">Taksiran</th>
                        <th className="p-2 text-left w-28">Prioritas</th>
                        <th className="p-2 text-left w-28">Klasifikasi</th>
                        <th className="p-2 text-left w-24">Keputusan</th>
                        <th className="p-2 text-left w-40">Status</th>
                        <th className="p-2 text-left min-w-[160px]">Catatan kantor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.map((b) => (
                        <Baris key={b.kunci} b={b} dipilih={pilih.has(b.kunci)} alih={() => alih(b.kunci)}
                          nilai={nilaiBarang(b, m.harga)} ubah={(p) => void ubah([b], p)} buka={() => setDetail(b.kunci)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* bilah aksi massal */}
      {terpilih.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex flex-wrap items-center gap-2 max-w-[95vw]">
          <span className="text-xs font-bold">{terpilih.length} barang · Rp{rupiahSingkat(nilaiPilih)}{kapalPilih.length > 1 ? ` · ${kapalPilih.length} kapal` : ""}</span>
          <span className="w-px h-5 bg-white/20" />
          <button onClick={async () => { if (await pastikanNama()) m.terimaSaran(terpilih); }} className="text-[11px] font-bold px-2 py-1 rounded bg-white/10 hover:bg-white/20">✓ Terima saran</button>
          {PRIORITAS.map((p) => (
            <button key={p.id} onClick={() => void ubah(terpilih, { prioritas: p.id })} className="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20">{p.ikon} {p.label}</button>
          ))}
          <span className="w-px h-5 bg-white/20" />
          <select onChange={(e) => { if (e.target.value) void ubah(terpilih, { klasifikasi: e.target.value as Klasifikasi }); e.target.value = ""; }}
            defaultValue="" className="text-[11px] bg-white/10 rounded px-1.5 py-1 text-white">
            <option value="" className="text-slate-800">Klasifikasi…</option>
            {KLASIFIKASI.map((k) => <option key={k.id} value={k.id} className="text-slate-800">{k.label}</option>)}
          </select>
          {KEPUTUSAN.map((k) => (
            <button key={k.id} onClick={() => void ubah(terpilih, { keputusan: k.id })} className="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20">{k.label}</button>
          ))}
          <span className="w-px h-5 bg-white/20" />
          <button onClick={() => void keSppbj()} disabled={kapalPilih.length !== 1}
            title={kapalPilih.length !== 1 ? "SPPBJ dibuat per kapal — pilih barang dari satu kapal" : "Isi borang SPPBJ dengan barang terpilih"}
            className="text-[11px] font-bold px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 disabled:opacity-40">→ Buat SPPBJ</button>
          <button onClick={() => void ubah(terpilih, { diterima: new Date().toISOString().slice(0, 10) })}
            className="text-[11px] px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500">Diterima kapal</button>
          <button onClick={() => setPilih(new Set())} className="text-[11px] px-2 py-1 rounded hover:bg-white/10">✕</button>
        </div>
      )}

      {brsDetail && <Detail b={brsDetail} tutup={() => setDetail("")} ubah={(p) => void ubah([brsDetail], p)}
        pengadaan={m.pengadaan.filter((p) => p.items.some((i) => ringkasKapal(i.kapal).toUpperCase() === ringkasKapal(brsDetail.kapal).toUpperCase()))}
        nilai={nilaiBarang(brsDetail, m.harga)} />}
    </main>
  );
}

/* ── komponen kecil ──────────────────────────────────────────────────────── */

function Kartu({ label, nilai, sub, tint, bar, aktif, klik }: {
  label: string; nilai: string; sub?: string; tint: string; bar: string; aktif?: boolean; klik?: () => void;
}) {
  return (
    <button onClick={klik} disabled={!klik}
      className={`relative text-left bg-white rounded-2xl ring-line elev-sm pl-4 pr-3 py-3 overflow-hidden transition ${klik ? "hover:elev-md cursor-pointer" : "cursor-default"} ${aktif ? "ring-2 ring-slate-800" : ""}`}>
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${bar}`} />
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold">{label}</p>
      <p className={`text-2xl font-extrabold tabular-nums leading-tight ${tint}`}>{nilai}</p>
      {sub ? <p className="text-[10px] text-slate-500 truncate">{sub}</p> : null}
    </button>
  );
}

function Lencana({ kelas, children, judul }: { kelas: string; children: React.ReactNode; judul?: string }) {
  return <span title={judul} className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ring-1 whitespace-nowrap ${kelas}`}>{children}</span>;
}

function Pilihan<T extends string>({ nilai, saran, daftar, ubah }: {
  nilai: T | ""; saran?: T; daftar: { id: T; label: string; kelas: string; ikon?: string }[]; ubah: (v: T) => void;
}) {
  const efektif = (nilai || saran || "") as T | "";
  const def = daftar.find((x) => x.id === efektif);
  const isSaran = !nilai && !!saran;
  return (
    <div className="flex flex-col gap-0.5">
      <select value={efektif} onChange={(e) => ubah(e.target.value as T)}
        className={`text-[11px] font-bold rounded-md px-1 py-1 ring-1 border-0 ${def ? def.kelas : "bg-white ring-slate-300 text-slate-500"} ${isSaran ? "opacity-70 ring-dashed border border-dashed" : ""}`}>
        {!efektif && <option value="">—</option>}
        {daftar.map((x) => <option key={x.id} value={x.id}>{x.ikon ? `${x.ikon} ` : ""}{x.label}</option>)}
      </select>
      {isSaran && (
        <button onClick={() => ubah(saran!)} className="text-[9px] text-sky-700 hover:underline text-left">saran mesin · konfirmasi</button>
      )}
    </div>
  );
}

function StatusSel({ b }: { b: BarisMonitor }) {
  const t = TAHAP[b.tahap];
  return (
    <div className="space-y-0.5">
      <Lencana kelas={t.kelas}>{t.label}</Lencana>
      {b.pengadaan && (
        <p className="text-[10px] text-slate-600">
          {b.pengadaan.asal === "nonpr" ? "Non PR PO" : "SPPBJ"} {b.pengadaan.nomor || ""}
          <span className="block text-slate-500 truncate max-w-[180px]" title={b.pengadaan.nama}>{b.pengadaan.nama}</span>
          {b.pengadaan.tahapScm ? ` · SCM: ${b.pengadaan.tahapScm}` : ""}
          {b.pengadaanOtomatis && <span className="text-slate-400"> · cocok otomatis</span>}
        </p>
      )}
      {b.ev?.diterima && <p className="text-[10px] text-emerald-700">diterima {tanggalIndo(b.ev.diterima)}</p>}
    </div>
  );
}

function Baris({ b, dipilih, alih, nilai, ubah, buka }: {
  b: BarisMonitor; dipilih: boolean; alih: () => void; nilai: number;
  ubah: (p: Parameters<ReturnType<typeof useMonitorPermintaan>["terapkan"]>[1]) => void; buka: () => void;
}) {
  const [catatan, setCatatan] = useState(b.ev?.catatan || "");
  useEffect(() => { setCatatan(b.ev?.catatan || ""); }, [b.ev?.catatan]);
  return (
    <tr className={`border-b border-slate-100 last:border-0 align-top ${b.menggantung ? "bg-red-50/60" : dipilih ? "bg-sky-50/70" : "hover:bg-slate-50/70"}`}>
      <td className="p-2"><input type="checkbox" checked={dipilih} onChange={alih} className="h-4 w-4" /></td>
      <td className="p-2">
        <button onClick={buka} className="font-semibold text-slate-900 text-left hover:underline">{b.nama}</button>
        {b.spesifikasi && <p className="text-[11px] text-slate-500">{b.spesifikasi}</p>}
        <p className="text-[11px] text-slate-600">{b.jumlah || "—"} {b.satuan}</p>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {b.menggantung && <Lencana kelas="bg-red-600 text-white ring-red-700" judul="Urgent belum masuk pengadaan">⏰ {b.umurHari} hari</Lencana>}
          {b.dimintaUlang > 0 && <Lencana kelas="bg-amber-100 text-amber-800 ring-amber-300" judul="Barang mirip sudah diminta di kiriman sebelumnya (60 hari)">🔁 diminta ulang {b.dimintaUlang}×</Lencana>}
          {b.adaLk && <Lencana kelas="bg-orange-100 text-orange-800 ring-orange-300" judul="Kiriman disertai laporan ketidaksesuaian / kerusakan">📄 ada LK</Lencana>}
        </div>
      </td>
      <td className="p-2 text-[11px] text-slate-600 whitespace-nowrap">
        {b.dikirimPada ? tanggalIndo(b.dikirimPada.slice(0, 10)) : "—"}
        <p className="text-slate-400">{b.umurHari} hari · {singkatJenis(b.jenis)}</p>
        {b.berkasUrl && <a href={b.berkasUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">berkas ↗</a>}
      </td>
      <td className="p-2 text-right tabular-nums text-[11px]">{nilai ? rupiah(nilai) : <span className="text-slate-400">—</span>}</td>
      <td className="p-2"><Pilihan<Prioritas> nilai={b.ev?.prioritas || ""} saran={b.saranPrioritas} daftar={PRIORITAS} ubah={(v) => ubah({ prioritas: v })} /></td>
      <td className="p-2"><Pilihan<Klasifikasi> nilai={b.ev?.klasifikasi || ""} saran={b.saranKlasifikasi} daftar={KLASIFIKASI} ubah={(v) => ubah({ klasifikasi: v })} /></td>
      <td className="p-2"><Pilihan<Keputusan> nilai={b.ev?.keputusan || ""} daftar={KEPUTUSAN} ubah={(v) => ubah({ keputusan: v })} /></td>
      <td className="p-2"><StatusSel b={b} /></td>
      <td className="p-2">
        <textarea value={catatan} rows={1} placeholder="catatan…" onChange={(e) => setCatatan(e.target.value)}
          onBlur={() => { if (catatan !== (b.ev?.catatan || "")) ubah({ catatan }); }}
          className="w-full text-[11px] border border-slate-200 rounded-md px-1.5 py-1 resize-y min-h-[28px]" />
        {b.ev?.pic && <p className="text-[10px] text-slate-500">PIC: {b.ev.pic}</p>}
      </td>
    </tr>
  );
}

function Detail({ b, tutup, ubah, pengadaan, nilai }: {
  b: BarisMonitor; tutup: () => void; nilai: number;
  ubah: (p: Parameters<ReturnType<typeof useMonitorPermintaan>["terapkan"]>[1]) => void;
  pengadaan: ReturnType<typeof useMonitorPermintaan>["pengadaan"];
}) {
  const [pic, setPic] = useState(b.ev?.pic || "");
  const [diterima, setDiterima] = useState(b.ev?.diterima || "");
  const urut = [...pengadaan].sort((x, y) => (y.tanggal || "").localeCompare(x.tanggal || "")).slice(0, 60);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 grid place-items-center p-4" onClick={tutup}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{b.kapal} · {singkatJenis(b.jenis)}</p>
            <h2 className="text-lg font-extrabold text-slate-900">{b.nama}</h2>
            <p className="text-xs text-slate-600">{b.spesifikasi} {b.spesifikasi ? "·" : ""} {b.jumlah} {b.satuan} · taksiran Rp{rupiah(nilai)}</p>
          </div>
          <button onClick={tutup} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <p><span className="text-slate-500">Dikirim</span><br /><b>{b.dikirimPada ? tanggalIndo(b.dikirimPada.slice(0, 10)) : "—"}</b> ({b.umurHari} hari) oleh {b.pengirim || "ABK"}</p>
            <p><span className="text-slate-500">Berkas</span><br />{b.berkasUrl ? <a href={b.berkasUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline break-all">{b.berkasNama} ↗</a> : b.berkasNama}</p>
            {b.keterangan && <p className="sm:col-span-2"><span className="text-slate-500">Keterangan dari kapal</span><br />{b.keterangan}</p>}
            {b.catatanKapal && <p className="sm:col-span-2"><span className="text-slate-500">Catatan pengirim</span><br />{b.catatanKapal}</p>}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-xs"><span className="text-slate-500 font-bold">PIC</span>
              <input value={pic} onChange={(e) => setPic(e.target.value)} onBlur={() => pic !== (b.ev?.pic || "") && ubah({ pic })}
                placeholder="mis. KKM / Staf Teknik" className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-1.5" />
            </label>
            <label className="text-xs"><span className="text-slate-500 font-bold">Diterima kapal</span>
              <input type="date" value={diterima} onChange={(e) => { setDiterima(e.target.value); ubah({ diterima: e.target.value }); }}
                className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-1.5" />
            </label>
            <label className="text-xs"><span className="text-slate-500 font-bold">Tautan pengadaan</span>
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
        </div>
      </div>
    </div>
  );
}
