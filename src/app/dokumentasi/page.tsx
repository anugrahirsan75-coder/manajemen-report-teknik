"use client";
/**
 * Rekap Dokumentasi Pekerjaan — 745 folder foto di arsip laptop.
 *
 * Layar ini menjawab dua hal yang sebelumnya hanya bisa dijawab dengan
 * membuka folder satu per satu: pekerjaan apa saja yang sudah ada fotonya,
 * dan mana yang fotonya sebenarnya milik kapal lain.
 *
 * Klasifikasi bidang ditebak mesin dari nama folder dan nama berkas, jadi
 * pasti ada yang meleset — karena itu tiap baris bisa dibetulkan dan ditandai
 * sudah diperiksa, dan hasilnya tersimpan di laptop ini juga.
 */
import { useEffect, useMemo, useState } from "react";
import {
  AKAR_ARSIP, BIDANG_PILIHAN, DISUSUN, ItemDokumentasi, SEED, UbahanDokumentasi,
  cocokTeks, gabung,
} from "@/lib/dokumentasi/types";
import { Ikon } from "@/components/ikon";
import { beritahu } from "@/components/Konfirmasi";

const ringkas = (k: string) => k.replace(/^KMP\.?\s*/i, "") || "(umum/cabang)";
const BATAS = 200;

export default function RekapDokumentasi() {
  const [ubahan, setUbahan] = useState<Record<string, UbahanDokumentasi>>({});
  const [simpanan, setSimpanan] = useState<"laptop" | "peramban" | "memuat">("memuat");
  const [berkasDb, setBerkasDb] = useState("");
  const [cari, setCari] = useState("");
  const [kapal, setKapal] = useState("");
  const [tahun, setTahun] = useState("");
  const [bidang, setBidang] = useState("");
  const [hanyaSalinan, setHanyaSalinan] = useState(false);
  const [sunting, setSunting] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  // muat suntingan: utamakan berkas di laptop, peramban hanya cadangan
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/dokumentasi");
        if (r.ok) {
          const j = await r.json();
          setUbahan(j.ubahan || {});
          setBerkasDb(j.berkas || "");
          setSimpanan("laptop");
          return;
        }
      } catch { /* server lokal tak ada — pakai simpanan peramban */ }
      try {
        const a = localStorage.getItem("dokumentasi_ubahan");
        if (a) setUbahan(JSON.parse(a));
      } catch { /* simpanan peramban rusak */ }
      setSimpanan("peramban");
    })();
  }, []);

  const data = useMemo(() => gabung(SEED, ubahan), [ubahan]);

  const daftarKapal = useMemo(
    () => Array.from(new Set(SEED.map((s) => s.kapal))).sort(), []);
  const daftarTahun = useMemo(
    () => Array.from(new Set(SEED.map((s) => s.tahun))).sort(), []);
  const daftarBidang = useMemo(
    () => Array.from(new Set(data.map((s) => s.bidang))).sort(), [data]);

  const tersaring = useMemo(() => {
    const q = cocokTeks(cari);
    return data.filter((d) => {
      if (kapal && d.kapal !== kapal) return false;
      if (tahun && d.tahun !== tahun) return false;
      if (bidang && d.bidang !== bidang) return false;
      if (hanyaSalinan && !d.catatan) return false;
      if (!q) return true;
      return cocokTeks(`${d.pekerjaan} ${d.folder} ${d.bidang} ${d.proses} ${d.kapal}`).includes(q);
    });
  }, [data, cari, kapal, tahun, bidang, hanyaSalinan]);

  const jumlah = useMemo(() => ({
    folder: tersaring.length,
    foto: tersaring.reduce((s, d) => s + d.foto, 0),
    video: tersaring.reduce((s, d) => s + d.video, 0),
    gb: tersaring.reduce((s, d) => s + d.mb, 0) / 1000,
    salinan: tersaring.filter((d) => d.catatan.startsWith("SALINAN")).length,
    diperiksa: tersaring.filter((d) => (d as any).diperiksa).length,
  }), [tersaring]);

  const simpan = async (next: Record<string, UbahanDokumentasi>) => {
    setUbahan(next);
    try { localStorage.setItem("dokumentasi_ubahan", JSON.stringify(next)); } catch { /* kuota */ }
    setSibuk(true);
    try {
      const r = await fetch("/api/dokumentasi", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ubahan: next }),
      });
      setSimpanan(r.ok ? "laptop" : "peramban");
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        await beritahu("Tersimpan di peramban saja — berkas di laptop gagal ditulis: "
          + (j?.galat || r.status));
      }
    } catch {
      setSimpanan("peramban");
    } finally { setSibuk(false); }
  };

  const setBaris = (folder: string, p: UbahanDokumentasi) =>
    simpan({ ...ubahan, [folder]: { ...(ubahan[folder] || {}), ...p } });

  const bukaFolder = async (folder: string) => {
    try {
      const r = await fetch("/api/dokumentasi/buka", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        await beritahu("Tak bisa membuka folder: " + (j?.galat || r.status));
      }
    } catch (e: any) {
      await beritahu("Tak bisa membuka folder: " + (e?.message ?? e));
    }
  };

  const salinJalur = async (folder: string) => {
    try { await navigator.clipboard.writeText(`${AKAR_ARSIP}\\${folder}`); }
    catch { await beritahu("Gagal menyalin."); }
  };

  return (
    <main className="max-w-[92rem] mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-5 flex items-center gap-4">
          <span className="bg-white rounded-2xl p-3 shadow-md shrink-0 text-[#16357f]"><Ikon nama="folder" className="w-6 h-6" /></span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold asdp-text-gradient">Rekap Dokumentasi Pekerjaan</h1>
            <p className="text-slate-500 text-sm">
              {SEED.length} folder foto di arsip laptop · disusun {DISUSUN} · akar {AKAR_ARSIP}
            </p>
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
            simpanan === "laptop" ? "bg-emerald-100 text-emerald-700"
              : simpanan === "peramban" ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-500"}`}
            title={berkasDb || "suntingan tersimpan di peramban"}>
            {simpanan === "laptop" ? "💾 tersimpan di laptop"
              : simpanan === "peramban" ? "⚠ tersimpan di peramban" : "memuat…"}
          </span>
        </div>
      </div>

      {/* saringan */}
      <div className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[16rem]">
          <input value={cari} onChange={(e) => setCari(e.target.value)}
            placeholder="cari pekerjaan / folder / bidang…"
            className="w-full text-sm border rounded-lg pl-8 pr-3 py-2 focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/20 outline-none" />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"><Ikon nama="kaca" className="w-4 h-4" /></span>
        </div>
        <select value={kapal} onChange={(e) => setKapal(e.target.value)} className="text-xs border rounded-lg px-2 py-2 bg-white">
          <option value="">Semua kapal</option>
          {daftarKapal.map((k) => <option key={k} value={k}>{ringkas(k)}</option>)}
        </select>
        <select value={tahun} onChange={(e) => setTahun(e.target.value)} className="text-xs border rounded-lg px-2 py-2 bg-white">
          <option value="">Semua tahun</option>
          {daftarTahun.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={bidang} onChange={(e) => setBidang(e.target.value)} className="text-xs border rounded-lg px-2 py-2 bg-white max-w-[15rem]">
          <option value="">Semua bidang</option>
          {daftarBidang.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={hanyaSalinan} onChange={(e) => setHanyaSalinan(e.target.checked)} />
          hanya yang bermasalah
        </label>
        {(cari || kapal || tahun || bidang || hanyaSalinan) && (
          <button onClick={() => { setCari(""); setKapal(""); setTahun(""); setBidang(""); setHanyaSalinan(false); }}
            className="text-xs text-slate-500 underline">reset</button>
        )}
      </div>

      {/* angka */}
      <div className="mt-3 grid grid-cols-3 lg:grid-cols-6 gap-2">
        {([["Folder", jumlah.folder.toLocaleString("id-ID")],
           ["Foto", jumlah.foto.toLocaleString("id-ID")],
           ["Video", jumlah.video.toLocaleString("id-ID")],
           ["Ukuran", jumlah.gb.toFixed(1) + " GB"],
           ["Bermasalah", jumlah.salinan.toLocaleString("id-ID")],
           ["Sudah diperiksa", jumlah.diperiksa.toLocaleString("id-ID")]] as const).map(([l, v]) => (
          <div key={l} className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{l}</p>
            <p className="text-base font-bold text-slate-900">{v}</p>
          </div>
        ))}
      </div>

      {/* tabel */}
      <div className="mt-3 rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden">
        <div className="px-4 py-2 border-b bg-slate-50 text-[11px] text-slate-500">
          {tersaring.length > BATAS
            ? `${BATAS} teratas ditampilkan dari ${tersaring.length.toLocaleString("id-ID")} — persempit dengan saringan`
            : `${tersaring.length.toLocaleString("id-ID")} folder`}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-600 sticky top-0">
              <tr>
                <th className="p-2 w-14 text-center">Tahun</th>
                <th className="p-2 text-left w-32">Kapal</th>
                <th className="p-2 text-left w-48">Bidang Pekerjaan</th>
                <th className="p-2 text-left">Pekerjaan</th>
                <th className="p-2 text-left w-36">Proses</th>
                <th className="p-2 text-center w-14">Foto</th>
                <th className="p-2 text-center w-24">Tanggal</th>
                <th className="p-2 text-left w-44">Catatan</th>
                <th className="p-2 text-center w-28">Folder</th>
              </tr>
            </thead>
            <tbody>
              {tersaring.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-slate-400">Tak ada yang cocok saringan.</td></tr>
              )}
              {tersaring.slice(0, BATAS).map((d) => {
                const aktif = sunting === d.folder;
                const diperiksa = !!(d as any).diperiksa;
                return (
                  <tr key={d.folder} className={`border-b align-top ${diperiksa ? "bg-emerald-50/40" : ""}`}>
                    <td className="p-2 text-center text-slate-500">{d.tahun}</td>
                    <td className="p-2 text-slate-700">{ringkas(d.kapal)}</td>
                    <td className="p-2">
                      {aktif ? (
                        <select value={d.bidang} onChange={(e) => setBaris(d.folder, { bidang: e.target.value })}
                          className="w-full text-[11px] border rounded px-1 py-1">
                          {Array.from(new Set([...BIDANG_PILIHAN, d.bidang])).map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      ) : (
                        <button onClick={() => setSunting(d.folder)} title="Klik untuk membetulkan klasifikasi"
                          className={`text-left hover:underline ${
                            d.bidang.startsWith("Belum terinci") ? "text-amber-700" : "text-slate-800 font-semibold"}`}>
                          {d.bidang}
                        </button>
                      )}
                    </td>
                    <td className="p-2 text-slate-700">{d.pekerjaan}</td>
                    <td className="p-2 text-slate-500">{d.proses}</td>
                    <td className="p-2 text-center font-semibold text-slate-700">
                      {d.foto}{d.video ? ` +${d.video}▶` : ""}
                    </td>
                    <td className="p-2 text-center text-slate-500 text-[10px]">
                      {d.dari}{d.sampai !== d.dari ? ` → ${d.sampai}` : ""}
                    </td>
                    <td className={`p-2 text-[10px] ${d.catatan.startsWith("SALINAN") ? "text-red-700 font-semibold" : "text-slate-400"}`}>
                      {d.catatan}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => bukaFolder(d.folder)} title={`${AKAR_ARSIP}\\${d.folder}`}
                          className="text-[10px] px-1.5 py-1 rounded border border-slate-300 hover:bg-slate-50">📂 buka</button>
                        <button onClick={() => salinJalur(d.folder)} title="Salin alamat folder"
                          className="text-slate-400 hover:text-slate-700"><Ikon nama="salin" className="w-3 h-3" /></button>
                        <button onClick={() => setBaris(d.folder, { diperiksa: !diperiksa })} disabled={sibuk}
                          title={diperiksa ? "Batalkan tanda diperiksa" : "Tandai sudah diperiksa"}
                          className={`text-[10px] px-1.5 py-1 rounded border ${
                            diperiksa ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                                      : "border-slate-300 hover:bg-slate-50"}`}>✓</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
        Yang tersimpan di aplikasi hanya keterangan folder — fotonya tetap di arsip laptop dan
        tidak diunggah ke mana pun. Klasifikasi bidang ditebak dari nama folder dan nama berkas,
        jadi wajar ada yang meleset: klik nama bidangnya untuk membetulkan, lalu tandai ✓ bila
        sudah diperiksa. Suntingan ditulis ke berkas di folder proyek{berkasDb ? ` (${berkasDb})` : ""}.
      </p>
    </main>
  );
}
