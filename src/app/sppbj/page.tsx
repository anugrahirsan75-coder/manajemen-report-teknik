"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSppbj } from "@/lib/sppbj/store";
import { STATUS_LABEL, STATUS_COLOR, SppbjStatus, fullNoKontrak, GrSes, grSesBaru, nilaiGrEfektif, nilaiGrOtomatis } from "@/lib/sppbj/types";
import { tanggalIndo, bulanTahun, rupiah } from "@/lib/format";
import { getKatalog } from "@/lib/katalog/source";
import { buildRekapRow, sendToRekap, NoRekapConfigError } from "@/lib/sppbj/rekapSync";
import KapalCell, { kapalDariItems } from "@/components/KapalCell";
import PreviewModal from "@/components/PreviewModal";
import JenisBadge from "@/components/JenisBadge";
import { useAnggaran } from "@/lib/anggaran/store";
import { jenisAnggaranOf } from "@/lib/anggaran/types";
import { beritahu, konfirmasi } from "@/components/Konfirmasi";

export default function SppbjList() {
  const { listRemote, patchRemote, deleteRemote, loadById, newDraft, supabaseReady } = useSppbj();
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulan, setBulan] = useState(""); // "" = semua bulan, else "YYYY-MM"
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<any | null>(null); // baris yang sedang dilihat
  const [sapEdit, setSapEdit] = useState<any | null>(null); // baris yang sedang diisi No. PO / GR-SES
  const { program, pengadaan } = useAnggaran(); // utk isi popover badge jenis anggaran

  // daftar bulan unik dari tanggal SPPBJ (desc)
  const ym = (r: any): string => (r.payload?.tanggal || "").slice(0, 7);
  const bulanList = Array.from(new Set(rows.map(ym).filter(Boolean))).sort().reverse();

  // gabung field yang dicari (judul/nomor/kapal/status) -> normalisasi lowercase
  const matchTokens = (r: any, q: string): boolean => {
    if (!q) return true;
    const items: any[] = r.payload?.items || [];
    const gr: any[] = r.payload?.grSes || [];
    const hay = [
      r.nama_pengadaan, r.payload?.noSPPBJ, r.payload?.noKontrak, r.payload?.status,
      r.payload?.noPRSAP, r.payload?.noPOSAP, ...gr.map((g) => g.nomor),
      ...items.map((i) => i.kapal), ...items.map((i) => i.nama), ...kapalDariItems(items),
    ].filter(Boolean).join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
  };
  // saring per jenis anggaran (Rutin/Docking/Lainnya) — pakai aturan yang sama dgn Dashboard
  const [jenis, setJenis] = useState<"" | "rutin" | "docking" | "lainnya">("");
  const jenisOf = (r: any) => jenisAnggaranOf(r.payload || {});
  const filtered = rows.filter((r) => (!bulan || ym(r) === bulan) && (!jenis || jenisOf(r) === jenis) && matchTokens(r, query));
  const hitungJenis = (j: "rutin" | "docking" | "lainnya") =>
    rows.filter((r) => (!bulan || ym(r) === bulan) && jenisOf(r) === j && matchTokens(r, query)).length;

  const refresh = async () => { setLoading(true); setRows(await listRemote()); setLoading(false); };
  useEffect(() => { if (supabaseReady) refresh(); /* eslint-disable-next-line */ }, [supabaseReady]);

  const mulai = () => { newDraft(); router.push("/sppbj/isi"); };
  const buka = (r: any) => { loadById(r); router.push("/sppbj/detail"); };

  // Dibuka langsung dari Dashboard Anggaran: /sppbj?buka=<id> -> muat lalu lompat ke detailnya.
  // Query dibaca dari window (bukan useSearchParams) supaya halaman ini tak perlu Suspense.
  const [bukaId, setBukaId] = useState<string | null>(null);
  const [bukaGagal, setBukaGagal] = useState("");
  useEffect(() => { setBukaId(new URLSearchParams(window.location.search).get("buka")); }, []);
  useEffect(() => {
    if (!bukaId || loading || !rows.length) return;
    const r = rows.find((x) => x.id === bukaId);
    setBukaId(null);
    if (r) buka(r);
    else setBukaGagal("Pengadaan yang dituju tak ditemukan — mungkin sudah dihapus.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bukaId, rows, loading]);
  // simpan No. PO SAP / GR-SES dari daftar; baris lokal ikut diperbarui supaya
  // tabel tak perlu dimuat ulang seluruhnya
  const simpanSap = async (id: string, patch: { noPOSAP?: string; grSes?: GrSes[] }) => {
    await patchRemote(id, patch);
    setRows((p) => p.map((r) => (r.id === id ? { ...r, payload: { ...r.payload, ...patch } } : r)));
  };

  const hapus = async (id: string, nama: string) => {
    if (!(await konfirmasi({
      nada: "bahaya", judul: "Hapus pengadaan ini?", pesan: nama,
      tegasan: "Seluruh itemnya ikut terhapus dan tak bisa dikembalikan.", tombolYa: "Ya, hapus",
    }))) return;
    await deleteRemote(id); refresh();
  };

  // Sync ke spreadsheet REKAP PJK (semua pengadaan di filter -> tab bulan masing-masing)
  const [rekapBusy, setRekapBusy] = useState(false);
  const syncRekap = async () => {
    const rows = filtered.map((r) => buildRekapRow(r.payload)).filter((x) => x.nomorSppbj && x.month);
    if (!rows.length) { void beritahu("Tak ada pengadaan dgn No. PR SAP di filter ini. Isi No. PR SAP dulu."); return; }
    if (!(await konfirmasi({
      nada: "biasa", ikon: "📊",
      judul: `Kirim ${rows.length} pengadaan ke spreadsheet REKAP?`,
      pesan: "Tiap pengadaan masuk ke tab bulannya masing-masing; baris yang sudah ada akan diperbarui.",
      tegasan: "Pengadaan tanpa No. PR SAP dilewati.",
      tombolYa: `Kirim ${rows.length} baris`,
    }))) return;
    setRekapBusy(true);
    try {
      const r = await sendToRekap(rows);
      if (r.ok) void beritahu(`Terkirim ${r.results?.length || rows.length} baris ke rekap (per tab bulan).`);
      else void beritahu("Gagal kirim: " + r.error);
    } catch (e: any) {
      if (e instanceof NoRekapConfigError) void beritahu("Fitur rekap belum aktif.\nDeploy Apps Script + set REKAP_GAS_URL & REKAP_GAS_SECRET (lihat docs/rekap-apps-script.gs).");
      else void beritahu("Gagal: " + (e?.message || e));
    } finally { setRekapBusy(false); }
  };

  // Feedback loop: kumpulkan harga final SPPBJ per kode katalog -> Excel usulan update Riil ke RAB
  const [exporting, setExporting] = useState(false);
  const exportUsulan = async () => {
    setExporting(true);
    try {
      const list = await listRemote();
      const kat = await getKatalog();
      const byKode: Record<string, any> = {};
      kat.forEach((k) => { byKode[k.kode] = k; });
      const out: any[] = [];
      list.forEach((r: any) => {
        const p = r.payload || {};
        (p.items || []).forEach((it: any) => {
          const finalHarga = it.hargaSpbj && it.hargaSpbj > 0 ? it.hargaSpbj : 0;
          if (it.kodeKatalog && finalHarga > 0) {
            out.push({
              kode: it.kodeKatalog,
              nama: it.nama || byKode[it.kodeKatalog]?.nama || "",
              kategori: it.kategoriKatalog || byKode[it.kodeKatalog]?.kategori || "",
              satuan: it.satuan || byKode[it.kodeKatalog]?.satuan || "",
              sumberLama: it.sumberHarga || byKode[it.kodeKatalog]?.sumber || "",
              hargaHspk: byKode[it.kodeKatalog]?.harga ?? 0,
              hargaAktual: finalHarga,
              tanggal: p.tanggal || "",
              noSpbj: fullNoKontrak(p) || p.noSpbjNum || "",
              vendor: p.vendor || "",
              pengadaan: r.nama_pengadaan || p.namaPengadaan || "",
            });
          }
        });
      });
      if (!out.length) { void beritahu("Belum ada item ber-kode katalog dengan Harga SPBJ final.\nPilih item via 📚 Katalog di form, lalu isi Harga SPBJ (Fase 2)."); return; }
      const res = await fetch("/api/sppbj/usulan-harga-export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: out }) });
      if (!res.ok) { void beritahu("Gagal ekspor: " + res.status); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `Usulan_Harga_Riil_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click(); URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };

  const rekap = {
    total: filtered.length,
    menunggu: filtered.filter((r) => (r.status || "menunggu_spbj") === "menunggu_spbj").length,
    spbj: filtered.filter((r) => r.status === "spbj_terbit").length,
    selesai: filtered.filter((r) => r.status === "selesai").length,
  };

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex items-center gap-4">
          <div className="bg-white rounded-2xl p-2 shadow-md shrink-0"><Image src="/logo-asdp.png" alt="ASDP" width={56} height={38} className="object-contain" /></div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold asdp-text-gradient">SPPBJ Pengadaan</h1>
            <p className="text-slate-500 text-sm">Riwayat &amp; rekap pengadaan — klik untuk buka & generate dokumen</p>
          </div>
          <button onClick={mulai} className="btn btn-primary px-5 py-2.5 text-sm">＋ Mulai Pengadaan</button>
        </div>
      </div>

      {bukaId && <p className="mt-4 text-sm text-slate-600">Membuka pengadaan dari Dashboard…</p>}
      {bukaGagal && <p className="mt-4 text-sm text-rose-800 bg-rose-50 ring-1 ring-rose-200 rounded-xl px-3 py-2">{bukaGagal}</p>}

      {/* Rekap */}
      <section className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total" value={rekap.total} color="text-slate-800" />
        <Stat label="Menunggu SPBJ" value={rekap.menunggu} color="text-amber-600" />
        <Stat label="SPBJ Terbit" value={rekap.spbj} color="text-blue-600" />
        <Stat label="Selesai" value={rekap.selesai} color="text-green-600" />
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-slate-700">Riwayat Pengadaan</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari judul / nomor / kapal…"
              className="text-xs border px-3 py-1.5 rounded-lg bg-white pl-7 w-56 focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/20 outline-none" />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            {query && <button onClick={() => setQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs px-1">✕</button>}
          </div>
          {supabaseReady && (
            <select value={bulan} onChange={(e) => setBulan(e.target.value)}
              className="text-xs border px-2.5 py-1.5 rounded-lg bg-white">
              <option value="">Semua bulan</option>
              {bulanList.map((b) => <option key={b} value={b}>{bulanTahun(b + "-01")}</option>)}
            </select>
          )}
          {/* saring per jenis anggaran — warna sama dgn badge di tiap baris */}
          <div className="flex rounded-lg overflow-hidden ring-1 ring-slate-200 bg-white">
            {([["", "Semua", "text-slate-700", "bg-slate-700"],
               ["rutin", "Rutin", "text-emerald-700", "bg-emerald-600"],
               ["docking", "Docking", "text-amber-700", "bg-amber-500"],
               ["lainnya", "Lainnya", "text-indigo-700", "bg-indigo-600"]] as const).map(([v, l, tint, aktif]) => (
              <button key={v} onClick={() => setJenis(v as any)}
                title={v ? `Tampilkan hanya pengadaan ber-Jenis Anggaran ${l}` : "Tampilkan semua jenis"}
                className={`text-[11px] font-bold px-2.5 py-1.5 ${jenis === v ? `${aktif} text-white` : `${tint} hover:bg-slate-50`}`}>
                {l}{v ? ` ${hitungJenis(v as any)}` : ""}
              </button>
            ))}
          </div>
          <Link href="/dashboard" className="btn btn-ghost text-xs">📊 Dashboard Anggaran</Link>
          {supabaseReady && <button onClick={syncRekap} disabled={rekapBusy} className="btn btn-ghost text-xs" title="Kirim semua pengadaan (filter ini) ke spreadsheet REKAP PJK, per tab bulan">{rekapBusy ? "…" : "📊 Sync ke Rekap"}</button>}
          {supabaseReady && <button onClick={exportUsulan} disabled={exporting} className="btn btn-ghost text-xs" title="Excel usulan update harga Riil ke RAB master dari realisasi SPPBJ">{exporting ? "…" : "📤 Usulan Harga Riil"}</button>}
          {supabaseReady && <button onClick={refresh} className="btn btn-ghost text-xs">↻ Refresh</button>}
        </div>
      </div>

      {!supabaseReady ? (
        <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">Riwayat butuh Supabase (env). Mode lokal: pakai ＋ Mulai Pengadaan.</p>
      ) : loading ? (
        <p className="mt-3 text-sm text-slate-400">Memuat…</p>
      ) : rows.length === 0 ? (
        <div className="mt-3 text-center bg-white rounded-2xl ring-line elev-sm p-8">
          <p className="text-slate-400 text-sm">Belum ada pengadaan. Klik <b>＋ Mulai Pengadaan</b>.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-3 text-center bg-white rounded-2xl ring-line elev-sm p-8">
          <p className="text-slate-400 text-sm">
            {query
              ? <>Tak ada hasil untuk &quot;<b>{query}</b>&quot;. Coba kata lain atau hapus filter bulan.</>
              : <>Tak ada pengadaan di <b>{bulanTahun(bulan + "-01")}</b>. Ganti filter bulan.</>}
          </p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto bg-white rounded-2xl elev-md ring-line anim-in">
          <table className="w-full text-sm min-w-[68rem]">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600 font-bold">
              <tr className="border-b-2 border-slate-200">
                <th className="px-2 py-2.5 text-center w-8">No</th>
                <th className="px-2 py-2.5 text-left min-w-[14rem]">Judul SPPBJ</th>
                <th className="px-2 py-2.5 text-left w-32">Kapal</th>
                <th className="px-2 py-2.5 text-left w-28">Nomor</th>
                <th className="px-2 py-2.5 text-left w-24" title="Nomor PO SAP — terbit bersama SPBJ (Fase 2)">No. PO</th>
                <th className="px-2 py-2.5 text-left w-28" title="No. GR/SES di SAP. Pekerjaan bertermin (docking) punya 3 nomor dalam 1 SPPBJ.">GR / SES</th>
                <th className="px-2 py-2.5 text-left w-24">Tanggal</th>
                <th className="px-2 py-2.5 text-left w-28">Status</th>
                <th className="px-2 py-2.5 text-center w-40">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const st = (r.status as SppbjStatus) || "menunggu_spbj";
                const nomor = r.payload?.noSPPBJ || r.payload?.noKontrak || "-";
                const po = (r.payload?.noPOSAP || "").trim();
                const gr: GrSes[] = (r.payload?.grSes || []).filter((g: GrSes) => (g.nomor || "").trim());
                return (
                  <tr key={r.id} className="border-b border-slate-200 last:border-0 row-hover cursor-pointer align-middle even:bg-slate-50/50" onClick={() => buka(r)}>
                    <td className="px-2 py-2.5 text-center text-xs text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-start gap-2">
                        <JenisBadge payload={r.payload || {}} program={program} pengadaan={pengadaan} />
                        <span className="font-medium text-slate-800 leading-snug klip-2" title={r.nama_pengadaan || ""}>{r.nama_pengadaan || "(tanpa nama)"}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5"><KapalCell items={r.payload?.items || []} /></td>
                    <td className="px-2 py-2.5 text-slate-600 tabular-nums whitespace-nowrap">{nomor}</td>
                    <td className="px-2 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {po ? (
                        <button onClick={() => setSapEdit(r)} className="tabular-nums text-slate-700 hover:text-[#1ca3dd] hover:underline" title="Ubah No. PO SAP">{po}</button>
                      ) : (
                        <button onClick={() => setSapEdit(r)} className="text-[11px] text-slate-400 hover:text-[#1ca3dd]" title="Belum ada No. PO SAP — klik untuk isi">— isi</button>
                      )}
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setSapEdit(r)}
                        title={gr.length ? gr.map((g) => `${g.termin ? `Termin ${"I".repeat(g.termin)} · ` : ""}${g.nomor}`).join("\n") : "Belum ada No. GR/SES — klik untuk isi"}
                        className={`text-[11px] font-semibold px-2 py-1 rounded-lg ring-1 ${
                          gr.length > 1 ? "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100"
                            : gr.length === 1 ? "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-slate-100 tabular-nums font-normal"
                            : "text-slate-400 ring-slate-200 hover:bg-slate-50"}`}>
                        {gr.length > 1 ? `🧾 ${gr.length} termin` : gr.length === 1 ? gr[0].nomor : "— isi"}
                      </button>
                    </td>
                    <td className="px-2 py-2.5 text-slate-600 whitespace-nowrap">{r.payload?.tanggal ? tanggalIndo(r.payload.tanggal) : "-"}</td>
                    <td className="px-2 py-2.5"><span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[st] ?? STATUS_COLOR.menunggu_spbj}`}>{STATUS_LABEL[st] ?? r.status}</span></td>
                    <td className="px-2 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setPreview(r)} className="btn btn-ghost text-[11px] px-2 py-1" title="Lihat isi dokumen">👁</button>
                        <button onClick={() => buka(r)} className="btn btn-primary text-[11px] px-3 py-1">Buka</button>
                        <button onClick={() => hapus(r.id, r.nama_pengadaan)} className="btn btn-danger-soft text-[11px] px-2 py-1" title="Hapus">🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {preview && (
        <PreviewModal jenis="SPPBJ" payload={preview.payload} onTutup={() => setPreview(null)}
          onBuka={() => { const r = preview; setPreview(null); buka(r); }} />
      )}
      {sapEdit && (
        <SapModal baris={sapEdit} docking={jenisOf(sapEdit) === "docking"}
          onTutup={() => setSapEdit(null)}
          onBuka={() => { const r = sapEdit; setSapEdit(null); loadById(r); router.push("/sppbj/isi#spbj"); }}
          onSimpan={async (patch) => { await simpanSap(sapEdit.id, patch); setSapEdit(null); }} />
      )}
    </main>
  );
}

/**
 * Isi cepat No. PO SAP & No. GR/SES dari daftar — tanpa membuka seluruh form.
 *
 * Field-nya SAMA PERSIS dengan yang ada di form (Fase 2 — Data SPBJ / PO), bukan
 * salinan: isi dari luar (dialog ini) atau dari dalam (form), yang terbaca tetap
 * satu nilai. Untuk pekerjaan docking — 1 SPPBJ dibayar 3 termin — kerangka
 * Termin I/II/III disiapkan otomatis saat masih kosong, tinggal ditulis nomornya.
 */
function SapModal({ baris, docking, onTutup, onBuka, onSimpan }: {
  baris: any;
  docking: boolean;
  onTutup: () => void;
  onBuka: () => void;
  onSimpan: (patch: { noPOSAP: string; grSes: GrSes[] }) => Promise<void>;
}) {
  const p = baris.payload || {};
  const adaGr = (p.grSes || []).length > 0;
  const [po, setPo] = useState<string>(p.noPOSAP || "");
  // pekerjaan docking yang belum punya GR/SES langsung dapat 3 baris termin
  const [gr, setGr] = useState<GrSes[]>(() =>
    adaGr ? (p.grSes || []).map((g: GrSes) => ({ ...g }))
      : docking ? [1, 2, 3].map((t) => grSesBaru(t))
      : [grSesBaru()]);
  const disiapkan = !adaGr; // kerangka, belum pernah tersimpan
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const ubah = (id: string, patch: Partial<GrSes>) => setGr((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const total = gr.reduce((s, g) => s + nilaiGrEfektif(g, gr, p.items), 0);
  const bertermin = gr.some((g) => g.termin);

  const simpan = async () => {
    setSibuk(true); setGalat("");
    try {
      await onSimpan({ noPOSAP: po.trim(), grSes: gr.filter((g) => (g.nomor || "").trim() || g.termin) });
    } catch (e: any) { setGalat(e?.message || String(e)); setSibuk(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] p-4 overflow-y-auto" onClick={onTutup}>
      <div className="max-w-2xl mx-auto my-8 bg-white rounded-2xl elev-lg ring-line overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-start gap-3">
          <span className="h-9 w-9 rounded-xl asdp-gradient text-white grid place-items-center text-sm shrink-0">🧾</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 leading-tight">Nomor SAP pengadaan ini</h3>
            <p className="text-xs text-slate-500 truncate" title={baris.nama_pengadaan}>{baris.nama_pengadaan || "(tanpa nama)"}</p>
          </div>
          <button onClick={onTutup} className="text-slate-400 hover:text-slate-700 text-lg leading-none px-1">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-500">No. PR SAP</span>
              <input readOnly value={p.noPRSAP || p.noSPPBJ || "—"}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 tabular-nums" />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-500">No. PO SAP</span>
              <input value={po} onChange={(e) => setPo(e.target.value)} placeholder="45000xxxxx" autoFocus
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/20 outline-none" />
            </label>
          </div>
          <p className="text-[11px] text-slate-500 -mt-1">
            🔗 Kolom ini <b>sama</b> dengan yang di form <b>Fase 2 — Data SPBJ / PO</b>. Diisi dari sini atau
            dari dalam form, nilainya satu.
          </p>

          <div className="rounded-xl ring-1 ring-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700">No. GR / SES</span>
              <span className="text-[11px] text-slate-500">bukti penerimaan di SAP</span>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => setGr((l) => [...l, grSesBaru()])} className="btn btn-ghost text-xs">＋ Tambah nomor</button>
                <button onClick={() => setGr([1, 2, 3].map((t) => grSesBaru(t)))}
                  className="btn btn-primary text-xs"
                  title="Pekerjaan docking: 1 SPPBJ dibayar 3 termin — Termin I saat BA Naik Dok, II saat BA Selesai Pekerjaan, III saat BA Selesai Masa Pemeliharaan">
                  🛠️ Punya termin (3 nomor)
                </button>
              </div>
            </div>

            {disiapkan && gr.length > 0 && (
              <p className="mt-2 text-[11px] text-slate-500">
                {docking
                  ? <>Pengadaan ini <b>Docking</b> — 3 baris termin sudah disiapkan otomatis (I: BA Naik Dok · II: BA Selesai Pekerjaan · III: BA Selesai Masa Pemeliharaan). Tinggal isi nomornya; baris yang tak dipakai boleh dibuang.</>
                  : <>Satu baris disiapkan otomatis. Baris kosong tidak ikut tersimpan.</>}
              </p>
            )}

            {!gr.length ? (
              <p className="mt-2 text-[11px] text-slate-500">
                Belum ada. Pengadaan biasa cukup <b>satu</b> nomor. Untuk <b>Pekerjaan Docking</b> tekan
                &ldquo;Punya termin&rdquo; — nanti terisi 3 baris, satu per termin.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <div className="space-y-2 min-w-[32rem]">
                  {/* satu baris = satu nomor GR/SES; kolomnya tetap sejajar dari atas ke bawah */}
                  <div className="grid grid-cols-[4rem_1fr_8.5rem_7rem_2rem] gap-2 text-[10px] font-semibold text-slate-500">
                    <span>Termin</span><span>Nomor</span><span>Tanggal</span><span>Nilai (Rp)</span><span />
                  </div>
                  {gr.map((g) => (
                    <div key={g.id} className="grid grid-cols-[4rem_1fr_8.5rem_7rem_2rem] gap-2 items-center">
                      <select value={g.termin ?? ""} onChange={(e) => ubah(g.id, { termin: e.target.value ? +e.target.value : undefined })}
                        className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm bg-white">
                        <option value="">—</option><option value="1">I</option><option value="2">II</option><option value="3">III</option>
                      </select>
                      <input value={g.nomor} placeholder="mis. 5000123456" onChange={(e) => ubah(g.id, { nomor: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/20 outline-none" />
                      <input type="date" value={g.tanggal || ""} onChange={(e) => ubah(g.id, { tanggal: e.target.value || undefined })}
                        className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm bg-white" />
                      {/* satu nomor = sekali terima penuh -> nilainya ikut tabel item SPBJ */}
                      <input type="number" value={nilaiGrEfektif(g, gr, p.items) || ""}
                        title={nilaiGrOtomatis(g, gr) ? "Otomatis dari total tabel item SPBJ. Ketik angka lain untuk menimpa." : undefined}
                        onChange={(e) => ubah(g.id, { nilai: e.target.value ? +e.target.value : undefined })}
                        className={`w-full rounded-lg border px-2 py-2 text-sm tabular-nums ${nilaiGrOtomatis(g, gr) ? "border-emerald-200 bg-emerald-50/60" : "border-slate-300"}`} />
                      <button onClick={() => setGr((l) => l.filter((x) => x.id !== g.id))}
                        className="h-9 w-8 rounded-lg border border-slate-300 text-rose-600 hover:bg-rose-50 text-sm" title="Buang baris ini">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {gr.length > 0 && (
              <p className="text-[11px] text-slate-600 pt-2">
                {gr.length} nomor{bertermin ? " · bertermin" : ""}
                {total ? <> · total GR/SES <b className="tabular-nums">{rupiah(total)}</b></> : null}
              </p>
            )}
          </div>

          {galat && <p className="text-xs text-rose-800 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">Gagal simpan: {galat}</p>}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
          <button onClick={onBuka} className="btn btn-ghost text-xs" title="Buka form lengkap (Fase 2 — Data SPBJ / PO), tempat kolom yang sama bisa diisi dari dalam">
            Isi dari dalam form →
          </button>
          <span className="flex-1" />
          <button onClick={onTutup} className="btn btn-ghost text-xs">Batal</button>
          <button onClick={simpan} disabled={sibuk} className="btn btn-primary text-xs px-4">{sibuk ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl ring-line elev-sm p-4 card-hover border border-transparent">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</p>
      <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}
