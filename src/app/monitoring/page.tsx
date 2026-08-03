"use client";
/**
 * Monitoring Pengadaan Teknik — halaman TERBUKA, bisa dilihat siapa saja tanpa
 * login. Isinya rekap SPPBJ Pengadaan (SPPBJ Non PR PO sengaja tidak ikut).
 *
 * Datanya satu sumber dengan menu SPPBJ Pengadaan di dalam aplikasi: apa yang
 * diinput di sana langsung tampil di sini, dan sebaliknya.
 *
 * Karena terbuka, mengubah data menuntut kode ubah dan hanya menyentuh empat
 * hal: No. PR SAP, No. PO SAP, No. GR/SES, dan status. Menambah atau menghapus
 * pengadaan tetap hanya lewat aplikasi.
 */
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { rupiah, tanggalIndo } from "@/lib/format";
import PreviewPengadaan from "@/components/PreviewPengadaan";
import { unduhMonitoring } from "@/lib/monitoring/ekspor";

interface GrSesRekap { termin: number | null; nomor: string; tanggal: string }
interface Baris {
  id: string; nama: string; noPr: string; noPo: string; grSes: GrSesRekap[];
  jenis: "rutin" | "docking" | "lainnya"; kapal: string[]; tanggal: string;
  status: string; nilaiPr: number; nilaiSpbj: number; jumlahItem: number;
}

const JENIS: Record<string, { label: string; kelas: string }> = {
  rutin: { label: "Rutin", kelas: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
  docking: { label: "Docking", kelas: "bg-amber-100 text-amber-800 ring-amber-200" },
  lainnya: { label: "Lainnya", kelas: "bg-indigo-100 text-indigo-700 ring-indigo-200" },
};
const STATUS: Record<string, { label: string; kelas: string }> = {
  menunggu_spbj: { label: "Menunggu SPBJ", kelas: "bg-amber-100 text-amber-700" },
  spbj_terbit: { label: "SPBJ Terbit", kelas: "bg-blue-100 text-blue-700" },
  selesai: { label: "Selesai", kelas: "bg-green-100 text-green-700" },
};
const ROM = ["", "I", "II", "III"];

export default function MonitoringPengadaan() {
  const [baris, setBaris] = useState<Baris[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [bolehUbah, setBolehUbah] = useState(false);

  const [cari, setCari] = useState("");
  const [jenis, setJenis] = useState("");
  const [status, setStatus] = useState("");
  const [bulan, setBulan] = useState("");
  const [ubah, setUbah] = useState<Baris | null>(null);
  const [lihat, setLihat] = useState<Baris | null>(null);
  const [unduh, setUnduh] = useState("");
  const [waktuMuat, setWaktuMuat] = useState("");

  const ambil = async () => {
    setMuat(true); setGalat("");
    try {
      const r = await fetch("/api/monitoring/pengadaan", { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) setGalat(d.error || "Gagal memuat");
      else {
        setBaris(d.baris); setBolehUbah(!!d.bolehUbah);
        setWaktuMuat(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
      }
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  };
  useEffect(() => { ambil(); }, []);

  // Ekspor mengambil jalur tersendiri yang membawa seluruh item — supaya
  // berkasnya utuh sampai rincian, bukan hanya yang tampak di layar.
  const ekspor = async () => {
    setUnduh("siap");
    try {
      const r = await fetch("/api/monitoring/pengadaan/ekspor", { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) { setUnduh("Gagal: " + (d.error || r.status)); return; }
      const pilih = new Set(tampil.map((x) => x.id));
      const isi = d.baris.filter((x: any) => pilih.has(x.id));
      await unduhMonitoring(isi, `${isi.length} pengadaan${saringanAktif ? " — " + labelSaringan : " (seluruhnya)"}`);
      setUnduh("");
    } catch (e: any) { setUnduh("Gagal: " + (e?.message || e)); }
  };

  const bulanAda = useMemo(
    () => Array.from(new Set(baris.map((b) => (b.tanggal || "").slice(0, 7)).filter(Boolean))).sort().reverse(),
    [baris],
  );

  const tampil = useMemo(() => baris.filter((b) => {
    if (jenis && b.jenis !== jenis) return false;
    if (status && b.status !== status) return false;
    if (bulan && (b.tanggal || "").slice(0, 7) !== bulan) return false;
    if (!cari) return true;
    const teks = [b.nama, b.noPr, b.noPo, ...b.kapal, ...b.grSes.map((g) => g.nomor)].join(" ").toLowerCase();
    return cari.toLowerCase().split(/\s+/).filter(Boolean).every((k) => teks.includes(k));
  }), [baris, cari, jenis, status, bulan]);

  const saringanAktif = !!(cari || jenis || status || bulan);
  const labelSaringan = [
    jenis && JENIS[jenis].label,
    status && STATUS[status].label,
    bulan && tanggalIndo(bulan + "-01").replace(/^\d+\s/, ""),
    cari && `"${cari}"`,
  ].filter(Boolean).join(" · ");
  const bersihkan = () => { setCari(""); setJenis(""); setStatus(""); setBulan(""); };

  const jml = {
    pr: tampil.reduce((s, b) => s + b.nilaiPr, 0),
    spbj: tampil.reduce((s, b) => s + (b.nilaiSpbj || 0), 0),
    adaPo: tampil.filter((b) => b.noPo).length,
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <header className="asdp-gradient rounded-3xl p-[1.5px] elev-lg">
        <div className="glass rounded-3xl px-6 py-5 flex flex-wrap items-center gap-4">
          <div className="bg-white rounded-2xl p-2 shadow-md shrink-0">
            <Image src="/logo-asdp.png" alt="ASDP" width={54} height={36} className="object-contain" />
          </div>
          <div className="flex-1 min-w-[16rem]">
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              PT. ASDP Indonesia Ferry (Persero) · Cabang Ternate
            </p>
            <h1 className="text-2xl font-extrabold asdp-text-gradient leading-tight">Monitoring Pengadaan Teknik</h1>
            <p className="text-slate-500 text-sm">
              Rekap SPPBJ Pengadaan — terbuka untuk umum, angkanya mengikuti aplikasi Manajemen Report Teknik
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
              ● DATA LANGSUNG
            </span>
            <span className="text-[10px] text-slate-400">diperbarui {waktuMuat || "…"}</span>
          </div>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kartu label="Pengadaan" nilai={String(tampil.length)} ket={`dari ${baris.length} seluruhnya`} />
        <Kartu label="Nilai sesuai PR" nilai={rupiah(jml.pr)} ket="usulan pengadaan" />
        <Kartu label="Nilai sesuai SPBJ" nilai={rupiah(jml.spbj)} ket="yang harga finalnya sudah diisi" warna="text-[#16357f]" />
        <Kartu label="Sudah ber-PO SAP" nilai={String(jml.adaPo)} ket={`${tampil.length - jml.adaPo} belum`} />
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input value={cari} onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama pengadaan / No. PR / No. PO / kapal…"
          className="flex-1 min-w-[15rem] text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white" />
        <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2 py-2 bg-white">
          <option value="">Semua jenis</option>
          {Object.entries(JENIS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2 py-2 bg-white">
          <option value="">Semua status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={bulan} onChange={(e) => setBulan(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2 py-2 bg-white">
          <option value="">Semua bulan</option>
          {bulanAda.map((b) => <option key={b} value={b}>{tanggalIndo(b + "-01").replace(/^\d+\s/, "")}</option>)}
        </select>
        <button onClick={ambil} className="btn btn-ghost text-xs">↻ Muat ulang</button>
        <button onClick={ekspor} disabled={unduh === "siap" || !tampil.length}
          className="btn btn-success text-xs disabled:opacity-50"
          title="Unduh Excel: lembar REKAP + lembar RINCIAN ITEM (seluruh item, tidak dipotong)">
          {unduh === "siap" ? "menyiapkan…" : "📊 Export Excel"}
        </button>
      </div>

      {saringanAktif && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-500">Saringan aktif:</span>
          <span className="font-semibold text-[#16357f] bg-sky-50 ring-1 ring-sky-200 rounded-full px-2 py-0.5">{labelSaringan}</span>
          <span className="text-slate-500">→ {tampil.length} dari {baris.length} pengadaan</span>
          <button onClick={bersihkan} className="text-slate-400 hover:text-slate-700 underline">bersihkan</button>
        </div>
      )}
      {unduh && unduh !== "siap" && (
        <p className="mt-2 text-xs text-rose-800 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">{unduh}</p>
      )}

      {galat && <p className="mt-3 text-sm text-rose-800 bg-rose-50 ring-1 ring-rose-200 rounded-xl px-3 py-2">{galat}</p>}

      {muat && !baris.length ? (
        <p className="mt-4 text-sm text-slate-400">Memuat…</p>
      ) : (
        <div className="mt-3 overflow-auto max-h-[70vh] bg-white rounded-2xl elev-md ring-line">
          <table className="w-full text-sm min-w-[72rem]">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600 font-bold sticky top-0 z-10 shadow-[0_1px_0_rgba(0,0,0,0.08)]">
              <tr className="border-b-2 border-slate-200">
                <th className="px-2 py-2.5 text-center w-8">No</th>
                <th className="px-2 py-2.5 text-left min-w-[15rem]">Nama Pengadaan</th>
                <th className="px-2 py-2.5 text-left w-24">Jenis</th>
                <th className="px-2 py-2.5 text-left w-28">No. PR SAP</th>
                <th className="px-2 py-2.5 text-left w-28">No. PO SAP</th>
                <th className="px-2 py-2.5 text-left w-32">No. GR / SES</th>
                <th className="px-2 py-2.5 text-right w-32">Nilai PR</th>
                <th className="px-2 py-2.5 text-right w-32">Nilai SPBJ</th>
                <th className="px-2 py-2.5 text-left w-28">Status</th>
                <th className="px-2 py-2.5 text-center w-24">Rincian</th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((b, i) => (
                <tr key={b.id} className="border-b border-slate-200 last:border-0 even:bg-slate-50/50 align-top hover:bg-sky-50/60 transition-colors">
                  <td className="px-2 py-2 text-center text-xs text-slate-400 tabular-nums">{i + 1}</td>
                  <td className="px-2 py-2">
                    <span className="block text-[12px] leading-[1.35] text-slate-800">{b.nama || "(tanpa nama)"}</span>
                    <span className="block text-[10px] text-slate-400">
                      {b.kapal.length ? b.kapal.join(" · ") : "tanpa kapal"}
                      {b.tanggal ? ` · ${tanggalIndo(b.tanggal)}` : ""}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${JENIS[b.jenis].kelas}`}>
                      {JENIS[b.jenis].label}
                    </span>
                  </td>
                  <td className="px-2 py-2 tabular-nums text-slate-700 break-words">{b.noPr || <span className="text-slate-300">—</span>}</td>
                  <td className="px-2 py-2 tabular-nums text-slate-700 break-words">{b.noPo || <span className="text-slate-300">—</span>}</td>
                  <td className="px-2 py-2">
                    {b.grSes.length ? b.grSes.map((g, k) => (
                      <span key={k} className="block text-[11px] tabular-nums text-slate-700">
                        {g.termin ? <b className="text-slate-500">{ROM[g.termin]} </b> : null}{g.nomor}
                      </span>
                    )) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-700">{rupiah(b.nilaiPr)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {b.nilaiSpbj ? <b className="text-[#16357f]">{rupiah(b.nilaiSpbj)}</b> : <span className="text-slate-300">belum</span>}
                  </td>
                  <td className="px-2 py-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS[b.status]?.kelas || STATUS.menunggu_spbj.kelas}`}>
                      {STATUS[b.status]?.label || b.status}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center whitespace-nowrap">
                    <button onClick={() => setLihat(b)} className="text-[11px] px-2 py-1 rounded-lg ring-1 ring-slate-200 hover:bg-slate-50"
                      title="Lihat rincian item pengadaan">👁 Lihat</button>
                    {bolehUbah && (
                      <button onClick={() => setUbah(b)} className="ml-1 text-[11px] text-[#1ca3dd] hover:underline">ubah</button>
                    )}
                  </td>
                </tr>
              ))}
              {!tampil.length && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-400">
                  Tak ada pengadaan pada saringan ini.
                </td></tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 font-bold sticky bottom-0 shadow-[0_-1px_0_rgba(0,0,0,0.08)]">
              <tr>
                <td className="px-2 py-2.5" colSpan={6}>JUMLAH {tampil.length} pengadaan</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{rupiah(jml.pr)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-[#16357f]">{rupiah(jml.spbj)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <footer className="mt-5 rounded-2xl ring-line bg-white/70 px-4 py-3">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          <b className="text-slate-700">Cara membaca:</b> <b>Nilai PR</b> = jumlah harga usulan tiap item.
          <b> Nilai SPBJ</b> = harga final setelah PO terbit — tampil setelah harga SPBJ-nya diisi di aplikasi,
          selama belum diisi tertulis &ldquo;belum&rdquo;. Tombol <b>👁 Lihat</b> membuka rincian item tiap pengadaan,
          <b> Export Excel</b> mengunduh rekap sekaligus seluruh rinciannya.
        </p>
        <p className="text-[11px] text-slate-400 mt-1.5">
          Halaman ini hanya memuat <b>SPPBJ Pengadaan</b> (SPPBJ Non PR PO tidak termasuk).
          Petugas teknik dapat mengubah nomor SAP lewat tombol <i>ubah</i>, atau masuk ke{" "}
          <a href="/login" className="text-[#1ca3dd] hover:underline">aplikasi Manajemen Report Teknik</a>{" "}
          untuk input lengkap.
        </p>
      </footer>

      {lihat && <DialogLihat baris={lihat} onTutup={() => setLihat(null)} />}

      {ubah && <DialogUbah baris={ubah} onTutup={() => setUbah(null)} onSelesai={(b) => {
        setBaris((p) => p.map((x) => (x.id === b.id ? b : x)));
        setUbah(null);
      }} />}
    </main>
  );
}

/**
 * Pratinjau rincian — memakai tampilan dokumen yang sama dengan di aplikasi,
 * tapi diisi dari jalur terbuka yang hanya membawa tabel itemnya. Vendor,
 * penerima BSTB, foto, dan nama penanda tangan tidak ikut ke sini.
 */
function DialogLihat({ baris, onTutup }: { baris: Baris; onTutup: () => void }) {
  const [dok, setDok] = useState<any>(null);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const r = await fetch(`/api/monitoring/pengadaan/${baris.id}`, { cache: "no-store" });
        const d = await r.json();
        if (batal) return;
        if (!d.ok) setGalat(d.error || "Gagal memuat rincian");
        else setDok(d.dok);
      } catch (e: any) { if (!batal) setGalat(e?.message || String(e)); }
    })();
    return () => { batal = true; };
  }, [baris.id]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 p-4 overflow-y-auto" onMouseDown={onTutup}>
      <div className="max-w-[210mm] mx-auto mb-2 flex flex-wrap items-center gap-2 no-print" onMouseDown={(e) => e.stopPropagation()}>
        <span className="text-white font-bold text-sm truncate flex-1">{baris.nama}</span>
        <button onClick={() => window.print()} className="btn btn-ghost text-xs">🖨️ Cetak</button>
        <button onClick={onTutup} className="btn btn-ghost text-xs">✕ Tutup</button>
      </div>
      <div className="w-fit mx-auto" onMouseDown={(e) => e.stopPropagation()}>
        {galat ? (
          <p className="bg-white rounded-xl px-4 py-3 text-sm text-rose-700">{galat}</p>
        ) : !dok ? (
          <p className="bg-white rounded-xl px-4 py-3 text-sm text-slate-500">Memuat rincian…</p>
        ) : (
          <PreviewPengadaan
            jenis="SPPBJ"
            judul="Daftar Kebutuhan Pengadaan Barang/Jasa"
            nomor={dok.nomor || dok.noPr}
            tanggal={dok.tanggal}
            noPRSAP={dok.noPr}
            noPOSAP={dok.noPo}
            grSes={dok.grSes}
            dasarPelimpahan={dok.dasarPelimpahan}
            namaPengadaan={dok.namaPengadaan}
            mataAnggaran={dok.mataAnggaran}
            jenisAnggaran={JENIS[baris.jenis].label}
            items={dok.items}
          />
        )}
      </div>
    </div>
  );
}

function Kartu({ label, nilai, ket, warna = "text-slate-800" }: { label: string; nilai: string; ket: string; warna?: string }) {
  return (
    <div className="bg-white rounded-2xl ring-line elev-sm p-4">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</p>
      <p className={`text-xl font-extrabold tabular-nums ${warna}`}>{nilai}</p>
      <p className="text-[10px] text-slate-400">{ket}</p>
    </div>
  );
}

/**
 * Pengubahan dari halaman terbuka: minta kode sekali, lalu diingat selama tab
 * masih dibuka. Yang boleh diubah hanya nomor-nomor SAP dan status — nilai
 * rupiah tetap ikut item di aplikasi supaya tak bisa dikarang dari luar.
 */
function DialogUbah({ baris, onTutup, onSelesai }: {
  baris: Baris; onTutup: () => void; onSelesai: (b: Baris) => void;
}) {
  const [kode, setKode] = useState(() => {
    try { return sessionStorage.getItem("monitor_kode") || ""; } catch { return ""; }
  });
  const [noPr, setNoPr] = useState(baris.noPr);
  const [noPo, setNoPo] = useState(baris.noPo);
  const [status, setStatus] = useState(baris.status);
  const [gr, setGr] = useState<GrSesRekap[]>(baris.grSes.length ? baris.grSes : [{ termin: null, nomor: "", tanggal: "" }]);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const simpan = async () => {
    setSibuk(true); setGalat("");
    try {
      const r = await fetch("/api/monitoring/pengadaan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: baris.id, kode, noPr, noPo, status, grSes: gr.filter((g) => g.nomor.trim()) }),
      });
      const d = await r.json();
      if (!d.ok) { setGalat(d.error || `Gagal (${r.status})`); return; }
      try { sessionStorage.setItem("monitor_kode", kode); } catch {}
      onSelesai({ ...baris, ...d.baris });
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setSibuk(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 p-4 overflow-y-auto" onClick={onTutup}>
      <div className="max-w-xl mx-auto my-8 bg-white rounded-2xl elev-lg ring-line overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800">Ubah nomor SAP</h3>
          <p className="text-xs text-slate-500 truncate" title={baris.nama}>{baris.nama}</p>
        </div>

        <div className="p-5 space-y-3">
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Kode ubah</span>
            <input type="password" value={kode} onChange={(e) => setKode(e.target.value)} autoFocus
              placeholder="minta ke Manajer Teknik"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-600">No. PR SAP</span>
              <input value={noPr} onChange={(e) => setNoPr(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-600">No. PO SAP</span>
              <input value={noPo} onChange={(e) => setNoPo(e.target.value)} placeholder="4500012345"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </label>
          </div>

          <div className="rounded-xl ring-1 ring-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-slate-700">No. GR / SES</span>
              <span className="text-[10px] text-slate-500">docking dibayar 3 termin</span>
              <span className="flex-1" />
              <button onClick={() => setGr((p) => [...p, { termin: null, nomor: "", tanggal: "" }])}
                className="btn btn-ghost text-[11px] py-1">＋ baris</button>
            </div>
            <div className="space-y-2">
              {gr.map((g, i) => (
                <div key={i} className="grid grid-cols-[4rem_1fr_9rem_2rem] gap-2 items-center">
                  <select value={g.termin ?? ""} onChange={(e) => setGr((p) => p.map((x, k) => k === i ? { ...x, termin: e.target.value ? +e.target.value : null } : x))}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white">
                    <option value="">—</option><option value="1">I</option><option value="2">II</option><option value="3">III</option>
                  </select>
                  <input value={g.nomor} placeholder="5000123456"
                    onChange={(e) => setGr((p) => p.map((x, k) => k === i ? { ...x, nomor: e.target.value } : x))}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm tabular-nums" />
                  <input type="date" value={g.tanggal || ""}
                    onChange={(e) => setGr((p) => p.map((x, k) => k === i ? { ...x, tanggal: e.target.value } : x))}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white" />
                  <button onClick={() => setGr((p) => p.filter((_, k) => k !== i))}
                    className="h-8 w-8 rounded-lg border border-slate-300 text-rose-600 hover:bg-rose-50 text-sm">✕</button>
                </div>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>

          <p className="text-[11px] text-slate-500">
            Nilai rupiah tidak diubah dari sini — angkanya mengikuti item di aplikasi supaya tetap bisa
            ditelusuri.
          </p>
          {galat && <p className="text-xs text-rose-800 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">{galat}</p>}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onTutup} className="btn btn-ghost text-xs">Batal</button>
          <button onClick={simpan} disabled={sibuk || !kode} className="btn btn-primary text-xs px-4 disabled:opacity-40">
            {sibuk ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
