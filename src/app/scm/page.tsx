"use client";
/**
 * Halaman kerja SCM.
 *
 * SPPBJ yang dikirim Teknik masuk sendiri ke antrean di sini — tidak ada yang
 * perlu diketik ulang. Tiap perpindahan tahap dicatat jamnya, sehingga
 * pertanyaan "kenapa lama" terjawab angka, bukan ingatan.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSppbj } from "@/lib/sppbj/store";
import { totalSppbj, adaHargaSpbj, totalSpbj } from "@/lib/sppbj/types";
import { rupiah, tanggalIndo } from "@/lib/format";
import { kapalDariItems } from "@/components/KapalCell";
import {
  BarisScm, majuTahap, muatProses, muatVendor, prosesBaru, simpanProses,
} from "@/lib/scm/store";
import {
  LABEL_TAHAP, ProsesScm, TahapScm, TINDAKAN_TAHAP, URUT_TAHAP, Vendor, WARNA_TAHAP,
  lamaPerTahap, tahapBerikut, tertahan, totalHari, umurTahap,
} from "@/lib/scm/types";

export default function HalamanScm() {
  const { listRemote } = useSppbj();
  const [sppbj, setSppbj] = useState<any[]>([]);
  const [proses, setProses] = useState<BarisScm[]>([]);
  const [vendor, setVendor] = useState<Vendor[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [saring, setSaring] = useState<"aktif" | "tertahan" | "selesai" | "semua">("aktif");
  const [cari, setCari] = useState("");
  const [buka, setBuka] = useState<string | null>(null);   // sppbjId yang sedang dibuka

  const ambil = useCallback(async () => {
    setMuat(true); setGalat("");
    try {
      const [a, b, v] = await Promise.all([listRemote(), muatProses(), muatVendor()]);
      setSppbj(a || []); setProses(b); setVendor(v.daftar);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, [listRemote]);

  useEffect(() => { void ambil(); }, [ambil]);

  const beritahu = (t: string) => { setPesan(t); window.setTimeout(() => setPesan(""), 4000); };

  /** SPPBJ yang sudah dikirim Teknik ke SCM + prosesnya (bila sudah ada) */
  const antrean = useMemo(() => {
    const petaProses = new Map(proses.map((p) => [p.proses.sppbjId, p]));
    return sppbj
      .filter((r) => r.payload?.keScm || petaProses.has(r.id))
      .map((r) => {
        const item = r.payload?.items || [];
        return {
          id: r.id, nama: r.nama_pengadaan || "(tanpa nama)",
          nomor: r.payload?.noSPPBJ || r.payload?.noKontrak || "-",
          tanggal: r.payload?.tanggal || "",
          kapal: kapalDariItems(item).join(", "),
          nilai: totalSppbj(item),
          nilaiFinal: adaHargaSpbj(item) ? totalSpbj(item) : 0,
          dikirim: r.payload?.keScm || "",
          baris: petaProses.get(r.id) || null,
          payload: r.payload,
        };
      })
      .sort((a, b) => (b.dikirim || b.tanggal).localeCompare(a.dikirim || a.tanggal));
  }, [sppbj, proses]);

  const tampil = antrean.filter((a) => {
    const p = a.baris?.proses;
    const cocokSaring =
      saring === "semua" ? true
        : saring === "selesai" ? p?.tahap === "selesai"
          : saring === "tertahan" ? !!p && tertahan(p)
            : p?.tahap !== "selesai";
    const q = cari.trim().toLowerCase();
    const cocokCari = !q || `${a.nama} ${a.nomor} ${a.kapal}`.toLowerCase().includes(q);
    return cocokSaring && cocokCari;
  });

  const jmlTertahan = antrean.filter((a) => a.baris && tertahan(a.baris.proses)).length;
  const jmlBaru = antrean.filter((a) => !a.baris).length;

  /** terima SPPBJ ke antrean kerja (membuat catatan prosesnya) */
  const terima = async (sppbjId: string) => {
    try {
      const p = prosesBaru(sppbjId, "SCM");
      const id = await simpanProses(null, p);
      setProses((l) => [{ id, proses: p }, ...l]);
      beritahu("Pengadaan diterima di SCM. Tahap: Masuk SCM.");
    } catch (e: any) { setGalat(e?.message || String(e)); }
  };

  const naik = async (b: BarisScm, ke: TahapScm) => {
    try {
      const p = majuTahap(b.proses, ke, "SCM");
      await simpanProses(b.id, p);
      setProses((l) => l.map((x) => (x.id === b.id ? { ...x, proses: p } : x)));
      beritahu(`Tahap diperbarui: ${LABEL_TAHAP[ke]}.`);
    } catch (e: any) { setGalat(e?.message || String(e)); }
  };

  const simpanIsian = async (b: BarisScm, patch: Partial<ProsesScm>) => {
    try {
      const p = { ...b.proses, ...patch };
      await simpanProses(b.id, p);
      setProses((l) => l.map((x) => (x.id === b.id ? { ...x, proses: p } : x)));
    } catch (e: any) { setGalat(e?.message || String(e)); }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow flex flex-wrap items-center gap-4 rounded-3xl px-6 py-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl asdp-gradient text-2xl text-white shadow-md">📦</div>
          <div className="min-w-0 flex-1">
            <h1 className="asdp-text-gradient text-2xl font-extrabold tracking-tight">Pengadaan — SCM</h1>
            <p className="text-sm text-slate-500">SPPBJ dari Teknik masuk sendiri ke sini. Tiap tahap dicatat jamnya.</p>
          </div>
          <a href="/scm/vendor" className="btn btn-ghost text-xs">🏢 Data Vendor</a>
          <button onClick={ambil} disabled={muat} className="btn btn-primary text-xs disabled:opacity-50">
            {muat ? "Memuat…" : "↻ Muat ulang"}
          </button>
        </div>
      </header>

      {pesan && <div className="anim-in mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">✓ {pesan}</div>}
      {galat && <div className="anim-in mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{galat}</div>}

      {/* ── ringkasan cepat ─────────────────────────────────────────────── */}
      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Angka label="Di antrean" nilai={antrean.filter((a) => a.baris?.proses.tahap !== "selesai").length} warna="text-slate-800" />
        <Angka label="Belum diterima" nilai={jmlBaru} warna="text-sky-700" sub="SPPBJ baru dari Teknik" />
        <Angka label="Tertahan" nilai={jmlTertahan} warna="text-rose-700" sub="melewati lama wajar tahapnya" />
        <Angka label="Selesai" nilai={antrean.filter((a) => a.baris?.proses.tahap === "selesai").length} warna="text-emerald-700" />
      </section>

      {/* ── saringan ────────────────────────────────────────────────────── */}
      <section className="mt-5 flex flex-wrap items-center gap-2">
        {([["aktif", "Sedang berjalan"], ["tertahan", `Tertahan (${jmlTertahan})`], ["selesai", "Selesai"], ["semua", "Semua"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSaring(k)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ring-1 transition ${
              saring === k ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}>
            {l}
          </button>
        ))}
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari judul / nomor / kapal…"
          className="ml-auto w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-sky-400" />
      </section>

      {/* ── daftar ──────────────────────────────────────────────────────── */}
      <section className="mt-4 space-y-2.5">
        {muat && <p className="py-8 text-center text-sm text-slate-400">Memuat antrean…</p>}
        {!muat && !tampil.length && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-400">
            Belum ada pengadaan pada saringan ini. SPPBJ akan muncul di sini begitu Teknik menekan “Kirim ke SCM”.
          </p>
        )}
        {tampil.map((a) => (
          <KartuPengadaan key={a.id} a={a} vendor={vendor} dibuka={buka === a.id}
            onBuka={() => setBuka(buka === a.id ? null : a.id)}
            onTerima={() => terima(a.id)}
            onNaik={(ke) => a.baris && naik(a.baris, ke)}
            onSimpan={(patch) => a.baris && simpanIsian(a.baris, patch)} />
        ))}
      </section>
    </main>
  );
}

function Angka({ label, nilai, warna, sub }: { label: string; nilai: number; warna: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`text-2xl font-extrabold ${warna}`}>{nilai}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

/** satu pengadaan: ringkas saat tertutup, penuh dengan isian saat dibuka */
function KartuPengadaan({ a, vendor, dibuka, onBuka, onTerima, onNaik, onSimpan }: {
  a: any; vendor: Vendor[]; dibuka: boolean;
  onBuka: () => void; onTerima: () => void;
  onNaik: (ke: TahapScm) => void; onSimpan: (patch: Partial<ProsesScm>) => void;
}) {
  const p: ProsesScm | undefined = a.baris?.proses;
  const macet = p ? tertahan(p) : false;
  const berikut = p ? tahapBerikut(p.tahap) : null;

  return (
    <article className={`rounded-2xl bg-white shadow-sm ring-1 transition ${macet ? "ring-rose-300" : "ring-slate-200"}`}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button onClick={onBuka} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            {p ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-1 ${WARNA_TAHAP[p.tahap]}`}>
                {LABEL_TAHAP[p.tahap]}
              </span>
            ) : (
              <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-extrabold text-white">BARU</span>
            )}
            {macet && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold text-rose-700 ring-1 ring-rose-200">TERTAHAN {umurTahap(p!)} HARI</span>}
            <span className="text-[11px] tabular-nums text-slate-400">{a.nomor}</span>
          </div>
          <p className="mt-1 truncate text-sm font-bold text-slate-800">{a.nama}</p>
          <p className="text-[11px] text-slate-500">
            {a.kapal || "—"} · SPPBJ {a.tanggal ? tanggalIndo(a.tanggal) : "—"} · {rupiah(a.nilai)}
            {p && <> · di SCM {totalHari(p)} hari</>}
          </p>
        </button>
        {!p ? (
          <button onClick={onTerima} className="btn btn-primary text-xs">✓ Terima</button>
        ) : berikut ? (
          <button onClick={() => onNaik(berikut)} className="btn btn-success text-xs" title={TINDAKAN_TAHAP[p.tahap]}>
            Lanjut → {LABEL_TAHAP[berikut]}
          </button>
        ) : null}
        <button onClick={onBuka} className="btn btn-ghost text-xs">{dibuka ? "Tutup" : "Rincian"}</button>
      </div>

      {dibuka && (
        <div className="border-t border-slate-100 px-4 py-4">
          {!p ? (
            <p className="text-sm text-slate-500">
              Pengadaan ini belum diterima. Tekan <b>Terima</b> supaya masuk hitungan lama proses SCM.
            </p>
          ) : (
            <RincianProses a={a} p={p} vendor={vendor} onNaik={onNaik} onSimpan={onSimpan} />
          )}
        </div>
      )}
    </article>
  );
}

function RincianProses({ a, p, vendor, onNaik, onSimpan }: {
  a: any; p: ProsesScm; vendor: Vendor[];
  onNaik: (ke: TahapScm) => void; onSimpan: (patch: Partial<ProsesScm>) => void;
}) {
  const [draf, setDraf] = useState<Partial<ProsesScm>>({});
  const nilai = <K extends keyof ProsesScm>(k: K): any => (draf as any)[k] ?? (p as any)[k] ?? "";
  const ubah = (k: keyof ProsesScm, v: any) => setDraf((d) => ({ ...d, [k]: v }));
  const simpan = () => { onSimpan(draf); setDraf({}); };
  const lama = lamaPerTahap(p);
  const v = vendor.find((x) => x.id === nilai("vendorId"));

  const isian = "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-sky-400";
  const label = "mb-1 block text-[11px] font-bold text-slate-600";

  return (
    <div className="space-y-4">
      {/* jejak waktu */}
      <div>
        <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Perjalanan dokumen</p>
        <div className="flex flex-wrap gap-1.5">
          {URUT_TAHAP.map((t) => {
            const lewat = URUT_TAHAP.indexOf(t) <= URUT_TAHAP.indexOf(p.tahap);
            const hari = lama.filter((x) => x.tahap === t).reduce((s, x) => s + x.hari, 0);
            return (
              <span key={t} className={`rounded-lg px-2 py-1 text-[10px] font-bold ring-1 ${
                lewat ? WARNA_TAHAP[t] : "bg-white text-slate-300 ring-slate-200"}`}>
                {LABEL_TAHAP[t]}{lewat && hari > 0 ? ` · ${hari}h` : ""}
              </span>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">
          Yang harus dikerjakan sekarang: <b className="text-slate-700">{TINDAKAN_TAHAP[p.tahap]}</b>
        </p>
      </div>

      {/* isian per tahap */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>No. Inisiasi e-Proc</label>
          <input value={nilai("noInisiasi")} onChange={(e) => ubah("noInisiasi", e.target.value)}
            placeholder="4181/INITIATION/ASDP-DN-11-02-03/VI/2026" className={isian} />
        </div>
        <div>
          <label className={label}>Tanggal inisiasi</label>
          <input type="date" value={nilai("tglInisiasi")} onChange={(e) => ubah("tglInisiasi", e.target.value)} className={isian} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Vendor</label>
          <select value={nilai("vendorId")} onChange={(e) => ubah("vendorId", e.target.value)} className={isian}>
            <option value="">— pilih vendor —</option>
            {vendor.map((x) => <option key={x.id} value={x.id}>{x.nama}{x.kota ? ` — ${x.kota}` : ""}</option>)}
          </select>
          {v && (
            <p className="mt-1 text-[11px] text-slate-500">
              {v.pimpinan} ({v.jabatan}) · {v.kota} {v.npwp ? `· NPWP ${v.npwp}` : ""}
            </p>
          )}
        </div>
        <div>
          <label className={label}>Nomor penawaran harga</label>
          <input value={nilai("noPenawaran")} onChange={(e) => ubah("noPenawaran", e.target.value)}
            placeholder="789-2/QUOT/BBS/JKT/VI/2026" className={isian} />
        </div>
        <div>
          <label className={label}>Tanggal penawaran</label>
          <input type="date" value={nilai("tglPenawaran")} onChange={(e) => ubah("tglPenawaran", e.target.value)} className={isian} />
        </div>
        <div>
          <label className={label}>Potongan negosiasi (%)</label>
          <input type="number" min={0} max={100} step={0.5} value={nilai("potonganPersen")}
            onChange={(e) => ubah("potonganPersen", Number(e.target.value))} placeholder="5" className={isian} />
          <p className="mt-1 text-[11px] text-slate-400">
            Potongan rata dari harga penawaran. Nilai setelah nego: {rupiah(Math.round(a.nilai * (1 - (Number(nilai("potonganPersen")) || 0) / 100)))}
          </p>
        </div>
        <div>
          <label className={label}>Tanggal negosiasi</label>
          <input type="date" value={nilai("tglNego")} onChange={(e) => ubah("tglNego", e.target.value)} className={isian} />
        </div>
        <div>
          <label className={label}>Nomor SPBJ</label>
          <input value={nilai("noSpbj")} onChange={(e) => ubah("noSpbj", e.target.value)}
            placeholder="SPB/J.4181/PBJ/VI/ASDP-2026" className={isian} />
        </div>
        <div>
          <label className={label}>Tanggal SPBJ</label>
          <input type="date" value={nilai("tglSpbj")} onChange={(e) => ubah("tglSpbj", e.target.value)} className={isian} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Catatan</label>
          <textarea value={nilai("catatan")} onChange={(e) => ubah("catatan", e.target.value)} rows={2}
            placeholder="mis. menunggu revisi spesifikasi dari Teknik" className={isian} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={simpan} disabled={!Object.keys(draf).length} className="btn btn-primary text-xs disabled:opacity-40">
          💾 Simpan isian
        </button>
        <select value="" onChange={(e) => e.target.value && onNaik(e.target.value as TahapScm)}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs">
          <option value="">Pindahkan ke tahap…</option>
          {URUT_TAHAP.map((t) => <option key={t} value={t}>{LABEL_TAHAP[t]}</option>)}
        </select>
        <span className="ml-auto text-[11px] text-slate-400">
          Total {totalHari(p)} hari sejak masuk SCM
        </span>
      </div>
    </div>
  );
}
