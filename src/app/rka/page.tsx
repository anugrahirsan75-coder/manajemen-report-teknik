"use client";
/**
 * Rencana RKA — usulan RKA tahun berikutnya per kapal per kelompok biaya.
 *
 * Alur: pilih tahun (default tahun depan) -> klik kapal -> "Isi dari data
 * <tahun dasar>" menarik realisasi aplikasi per kelompok -> sesuaikan angka
 * (bisa sekali naik/turun N%) -> simpan -> export Excel format pusat.
 */
import { useMemo, useState } from "react";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { useAnggaran } from "@/lib/anggaran/store";
import { ringkasKapal } from "@/lib/kapal/nama";
import { rupiah } from "@/lib/format";
import { rupiahShort } from "@/lib/anggaran/types";
import { useRka } from "@/lib/rka/store";
import { RkaKapal, KELOMPOK_RKA, rkaBaru, totalRka } from "@/lib/rka/types";
import { dasarDariTahun } from "@/lib/rka/isi";
import { exportRkaExcel } from "@/lib/rka/excel";
import { ParameterKapal, PARAM_BAKU, TP_INTERVAL, gemukBakuKg, jamPerMinggu, hitungSemua, Lintasan } from "@/lib/rka/parameter";
import { useKapalDb } from "@/lib/kapal/store";
import { useFleetplan, ringkasFleet, polaDariFleet } from "@/lib/rka/fleetplan";
import { konfirmasi, beritahu } from "@/components/Konfirmasi";

const BLN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default function RkaPage() {
  const { ready, loading, err, list, reload, simpan, hapus } = useRka();
  const { pengadaan } = useAnggaran();
  const [tahun, setTahun] = useState(new Date().getFullYear() + 1);
  const tahunDasar = tahun - 1;
  const [edit, setEdit] = useState<RkaKapal | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [xls, setXls] = useState(false);

  const baris = useMemo(() => KAPAL_ANGGARAN.map((k) => {
    const d = list.find((x) => x.kapal === k && x.tahun === tahun);
    return { kapal: k, dok: d, total: d ? totalRka(d) : 0 };
  }), [list, tahun]);

  const terisi = baris.filter((b) => b.dok);
  const totalSemua = baris.reduce((s, b) => s + b.total, 0);
  const totalDasar = useMemo(() =>
    KAPAL_ANGGARAN.reduce((s, k) => {
      const d = dasarDariTahun(pengadaan, k, tahunDasar);
      return s + Object.values(d).reduce((a, v) => a + v, 0);
    }, 0), [pengadaan, tahunDasar]);

  const simpanEdit = async () => {
    if (!edit) return;
    setSibuk(true);
    try { await simpan(edit); setEdit(null); } finally { setSibuk(false); }
  };
  const hapusEdit = async () => {
    if (!edit) return;
    if (!(await konfirmasi({
      nada: "bahaya", ikon: "📊", judul: `Hapus usulan RKA ${edit.kapal} ${edit.tahun}?`,
      pesan: `Total ${rupiah(totalRka(edit))}.`, tegasan: "Tidak bisa dikembalikan.", tombolYa: "Ya, hapus",
    }))) return;
    setSibuk(true);
    try { await hapus(edit.id); setEdit(null); } finally { setSibuk(false); }
  };
  const unduh = async () => {
    if (!terisi.length) { void beritahu("Belum ada kapal yang diisi — isi dulu minimal satu kapal."); return; }
    setXls(true);
    try { await exportRkaExcel(tahun, list); }
    catch (e: any) { void beritahu("Gagal export: " + (e?.message ?? e)); }
    finally { setXls(false); }
  };

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex flex-wrap items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-700 grid place-items-center text-2xl text-white shadow-md shrink-0">📊</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold asdp-text-gradient tracking-tight">Rencana RKA {tahun}</h1>
            <p className="text-slate-500 text-sm">Usulan RKA pemeliharaan per kapal — diisi otomatis dari data {tahunDasar}, diekspor dgn format pusat</p>
          </div>
          <select value={tahun} onChange={(e) => setTahun(+e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-semibold">
            {[0, 1, 2].map((n) => { const t = new Date().getFullYear() + n; return <option key={t} value={t}>{t}</option>; })}
          </select>
          <button onClick={unduh} disabled={xls} className="btn btn-success text-xs disabled:opacity-50">{xls ? "menyiapkan…" : "📊 Export Excel"}</button>
          <button onClick={reload} className="btn btn-ghost text-xs">↻ Muat ulang</button>
        </div>
      </div>

      {!ready && <p className="mt-5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">Butuh Supabase (env) supaya usulan tersimpan.</p>}
      {err && <p className="mt-4 text-xs font-semibold text-rose-700">Supabase: {err}</p>}

      <section className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kartu label={`Total usulan ${tahun}`} nilai={totalSemua ? rupiah(totalSemua) : "—"} tint="text-slate-900" bar="bg-violet-500" />
        <Kartu label="Kapal terisi" nilai={`${terisi.length} / ${KAPAL_ANGGARAN.length}`} tint={terisi.length === KAPAL_ANGGARAN.length ? "text-emerald-700" : "text-amber-700"} bar={terisi.length === KAPAL_ANGGARAN.length ? "bg-emerald-500" : "bg-amber-500"} />
        <Kartu label={`Realisasi ${tahunDasar} (dasar)`} nilai={totalDasar ? rupiah(Math.round(totalDasar)) : "—"} sub="dari SPPBJ + Non PR PO di aplikasi" tint="text-slate-700" bar="bg-slate-400" />
        <Kartu label="Perubahan vs dasar" nilai={totalSemua && totalDasar ? `${totalSemua >= totalDasar ? "+" : ""}${Math.round(((totalSemua - totalDasar) / totalDasar) * 100)}%` : "—"} tint="text-slate-900" bar="bg-sky-500" />
      </section>

      {/* matriks kelompok x kapal */}
      <section className="mt-4 bg-white rounded-2xl ring-line elev-md p-5">
        <div className="flex flex-wrap items-baseline gap-3 mb-3">
          <h3 className="font-bold text-slate-800">Usulan per kapal — {tahun}</h3>
          <span className="text-[11px] text-slate-500">klik kapal untuk mengisi / mengubah; struktur kelompok mengikuti berkas RKA pusat (docs/PENYUSUNAN_RKA.md)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600 font-bold">
              <tr>
                <th className="p-2 text-left">Kelompok biaya</th>
                {baris.map((b) => (
                  <th key={b.kapal} className="p-2 text-right whitespace-nowrap cursor-pointer hover:text-[#16357f]"
                    onClick={() => setEdit(b.dok ? { ...b.dok } : rkaBaru(b.kapal, tahun))}>
                    {ringkasKapal(b.kapal)}
                  </th>
                ))}
                <th className="p-2 text-right">JUMLAH</th>
              </tr>
            </thead>
            <tbody>
              {KELOMPOK_RKA.map((k) => {
                const jml = baris.reduce((s, b) => s + (b.dok?.nilai?.[k.key] || 0), 0);
                return (
                  <tr key={k.key} className="border-b border-slate-100 last:border-0">
                    <td className="p-2 font-semibold text-slate-700 whitespace-nowrap" title={`M.A. ${k.maLama}`}>{k.label}</td>
                    {baris.map((b) => (
                      <td key={b.kapal} className="p-2 text-right tabular-nums text-slate-600">
                        {b.dok?.nilai?.[k.key] ? rupiahShort(b.dok.nilai[k.key]) : "–"}
                      </td>
                    ))}
                    <td className="p-2 text-right tabular-nums font-bold text-slate-800">{jml ? rupiahShort(jml) : "–"}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50 font-extrabold">
                <td className="p-2 text-slate-800">TOTAL</td>
                {baris.map((b) => (
                  <td key={b.kapal} className="p-2 text-right tabular-nums cursor-pointer hover:text-[#16357f]"
                    onClick={() => setEdit(b.dok ? { ...b.dok } : rkaBaru(b.kapal, tahun))}>
                    {b.total ? rupiahShort(b.total) : <span className="text-[10px] font-bold text-[#1ca3dd]">+ isi</span>}
                  </td>
                ))}
                <td className="p-2 text-right tabular-nums text-slate-900">{totalSemua ? rupiahShort(totalSemua) : "–"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {edit && (
        <FormRka nilai={edit} setNilai={setEdit} sibuk={sibuk} tahunDasar={tahunDasar}
          pengadaan={pengadaan} onSimpan={simpanEdit} onHapus={hapusEdit} onTutup={() => setEdit(null)} />
      )}
      {loading && <p className="mt-4 text-xs text-slate-400">memuat…</p>}
    </main>
  );
}

function FormRka({ nilai, setNilai, sibuk, tahunDasar, pengadaan, onSimpan, onHapus, onTutup }: {
  nilai: RkaKapal; setNilai: (d: RkaKapal) => void; sibuk: boolean; tahunDasar: number;
  pengadaan: any[]; onSimpan: () => void; onHapus: () => void; onTutup: () => void;
}) {
  const [tab, setTab] = useState<"usulan" | "param">("usulan");
  const [faktor, setFaktor] = useState("");
  const dasar = useMemo(() => dasarDariTahun(pengadaan, nilai.kapal, tahunDasar), [pengadaan, nilai.kapal, tahunDasar]);
  const adaDasar = Object.keys(dasar).length > 0;
  const set = (p: Partial<RkaKapal>) => setNilai({ ...nilai, ...p });

  const isiOtomatis = async () => {
    const terisiSudah = KELOMPOK_RKA.some((k) => nilai.nilai?.[k.key]);
    if (terisiSudah && !(await konfirmasi({
      nada: "perhatian", ikon: "⚡", judul: `Timpa dengan angka ${tahunDasar}?`,
      pesan: "Angka yang sudah Anda ketik akan diganti dengan realisasi dari aplikasi.",
      tombolYa: "Timpa",
    }))) return;
    set({ nilai: { ...dasar }, dasar: { ...dasar } });
  };
  const terapkanFaktor = () => {
    const f = parseFloat(faktor);
    if (!isFinite(f)) { void beritahu("Isi persennya dulu — mis. 10 untuk naik 10%, -5 untuk turun 5%."); return; }
    const next: Record<string, number> = {};
    KELOMPOK_RKA.forEach((k) => { const v = nilai.nilai?.[k.key] || 0; if (v) next[k.key] = Math.round(v * (1 + f / 100)); });
    set({ nilai: next });
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 overflow-auto" onMouseDown={onTutup}>
      <div className="min-h-full py-8 px-3 flex items-start justify-center">
        <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 grid place-items-center text-xl text-white shadow-md shrink-0">📊</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-extrabold text-slate-800 leading-tight">{nilai.kapal} · Usulan RKA {nilai.tahun}</h3>
              <p className="text-[11px] text-slate-500">total {rupiah(totalRka(nilai))}</p>
            </div>
          </div>

          <div className="px-6 pt-3 flex gap-1 border-b border-slate-200">
            {([["usulan", "📋 Usulan biaya"], ["param", "⚙️ Parameter & Hitung Teknis"]] as const).map(([v, t]) => (
              <button key={v} onClick={() => setTab(v)}
                className={`text-xs font-semibold px-3 py-2 rounded-t-lg border-b-2 transition ${tab === v ? "border-[#16357f] text-[#16357f] bg-slate-50" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{t}</button>
            ))}
          </div>

          <div className="p-6 max-h-[62vh] overflow-auto">
            {tab === "param" ? <TabParameter nilai={nilai} set={set} /> : <>
            <div className="flex flex-wrap items-end gap-2 mb-4">
              <button onClick={isiOtomatis} disabled={!adaDasar}
                title={adaDasar ? `Isi semua kelompok dari realisasi ${tahunDasar} di aplikasi` : `Belum ada realisasi ${tahunDasar} untuk kapal ini`}
                className="btn btn-primary text-xs disabled:opacity-50">⚡ Isi dari data {tahunDasar}</button>
              <label className="block ml-auto">
                <span className="text-[10px] font-semibold text-slate-500">Naik/turun semua (%)</span>
                <div className="flex gap-1.5 mt-1">
                  <input type="number" className="inp !w-24" placeholder="mis. 10" value={faktor} onChange={(e) => setFaktor(e.target.value)} />
                  <button onClick={terapkanFaktor} className="btn btn-ghost text-xs">Terapkan</button>
                </div>
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold text-slate-500">Rencana bulan docking</span>
                <select className="inp mt-1" value={nilai.bulanDocking ?? ""} onChange={(e) => set({ bulanDocking: e.target.value ? +e.target.value : undefined })}>
                  <option value="">— belum —</option>
                  {BLN.map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
                </select>
              </label>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600 font-bold">
                <tr>
                  <th className="p-2 text-left">Kelompok biaya</th>
                  <th className="p-2 text-right w-36" title={`Realisasi ${tahunDasar} menurut data aplikasi`}>Dasar {tahunDasar}</th>
                  <th className="p-2 text-right w-40">Usulan {nilai.tahun} (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {KELOMPOK_RKA.map((k) => (
                  <tr key={k.key} className="border-b border-slate-100 last:border-0">
                    <td className="p-2">
                      <p className="font-semibold text-slate-800">{k.label}{k.ikutDocking ? <span className="ml-1.5 text-[9px] font-bold text-orange-700 bg-orange-100 px-1 py-0.5 rounded">DOCKING</span> : null}</p>
                      <p className="text-[10px] text-slate-400">M.A. {k.maLama}</p>
                    </td>
                    <td className="p-2 text-right tabular-nums text-slate-500">{dasar[k.key] ? rupiah(dasar[k.key]) : "–"}</td>
                    <td className="p-2">
                      <input type="number" className="inp text-right" value={nilai.nilai?.[k.key] ?? ""}
                        onChange={(e) => set({ nilai: { ...nilai.nilai, [k.key]: e.target.value ? +e.target.value : 0 } })} />
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-extrabold">
                  <td className="p-2 text-slate-800">TOTAL</td>
                  <td className="p-2 text-right tabular-nums text-slate-600">{rupiah(Object.values(dasar).reduce((s, v) => s + v, 0))}</td>
                  <td className="p-2 text-right tabular-nums text-slate-900">{rupiah(totalRka(nilai))}</td>
                </tr>
              </tbody>
            </table>

            <label className="block mt-4">
              <span className="text-[11px] font-semibold text-slate-600">Catatan</span>
              <textarea className="inp min-h-[60px] mt-1" value={nilai.catatan || ""} onChange={(e) => set({ catatan: e.target.value })}
                placeholder="mis. tahun depan SS — anggaran docking dinaikkan" />
            </label>
            </>}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
            <button onClick={onHapus} disabled={sibuk} className="btn btn-danger-soft text-sm disabled:opacity-50">🗑️ Hapus</button>
            <span className="ml-auto" />
            <button onClick={onTutup} className="btn btn-ghost text-sm">Batal</button>
            <button onClick={onSimpan} disabled={sibuk} className="btn btn-primary text-sm px-5 disabled:opacity-50">{sibuk ? "…" : "💾 Simpan"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Parameter teknis + mesin hitung (pelumas & Tingkat Perawatan).
 * Rumusnya sama persis dengan workbook RKA pusat — lihat lib/rka/parameter.ts.
 */
function TabParameter({ nilai, set }: { nilai: RkaKapal; set: (p: Partial<RkaKapal>) => void }) {
  const { ships } = useKapalDb();
  const { list: fleets } = useFleetplan();
  // fleetplan tahun dasar (tahun RKA - 1); kalau tak ada, pakai yang terbaru
  const fleet = fleets.find((f) => f.tahun === nilai.tahun - 1) || fleets[0];
  const p: ParameterKapal = { ...PARAM_BAKU, ...(nilai.param || {}) };
  const setP = (x: Partial<ParameterKapal>) => set({ param: { ...p, ...x } });
  const lint: Lintasan[] = p.lintasan?.length ? p.lintasan : [{ nama: "Lintasan I", tripPerMinggu: 0, jamPerTrip: 0 }];
  const setLint = (i: number, x: Partial<Lintasan>) =>
    setP({ lintasan: lint.map((l, j) => (j === i ? { ...l, ...x } : l)) });

  const h = hitungSemua(p);
  const jamMgg = jamPerMinggu(p);

  /** tarik GT / daya mesin dari Ship Database supaya tak diketik dua kali */
  const dariKapal = () => {
    const s = ships.find((x) => x.nama === nilai.kapal);
    if (!s) { void beritahu("Kapal ini belum ada di Ship Database."); return; }
    const angka = (v: any) => { const n = parseFloat(String(v || "").replace(/[^\d.,]/g, "").replace(",", ".")); return isFinite(n) ? n : undefined; };
    setP({
      grt: angka(s.dimension?.gt) ?? p.grt,
      meHp: angka(s.mainEngine?.ehp) ?? p.meHp,
      aeHp: angka(s.auxEngine?.ehp) ?? p.aeHp,
      meUnit: p.meUnit ?? 2, aeUnit: p.aeUnit ?? 2,
      gemukKgPerBulan: p.gemukKgPerBulan ?? gemukBakuKg(angka(s.dimension?.gt)),
    });
  };

  const rf = ringkasFleet(fleet, nilai.kapal);
  const dariFleet = async () => {
    if (!fleet) { void beritahu("Data Fleetplan belum ada di aplikasi."); return; }
    if (!rf.rute.length) { void beritahu(`${nilai.kapal} tidak punya rute di Fleetplan ${fleet.tahun}.`); return; }
    const v = p.kecepatanKnot || 0;
    if (!v) { void beritahu("Isi dulu Kecepatan (knot) — jam per trip dihitung dari jarak ÷ kecepatan."); return; }
    if ((p.lintasan || []).length && !(await konfirmasi({
      nada: "perhatian", ikon: "🗺️", judul: `Ganti pola operasi dengan Fleetplan ${fleet.tahun}?`,
      pesan: `${rf.rute.length} lintasan · ${rf.tripSetahun} trip setahun · ${Math.round(rf.milSetahun)} Nm.`,
      tegasan: "Pola operasi yang sudah diketik akan ditimpa.", tombolYa: "Ambil dari Fleetplan",
    }))) return;
    const pola = polaDariFleet(fleet, nilai.kapal, v);
    setP({ lintasan: pola.lintasan, tripSetahun: pola.tripSetahun, jamPerTripUtama: pola.jamPerTripUtama });
  };

  const pindahkan = async () => {
    if (!(await konfirmasi({
      nada: "perhatian", ikon: "⚡", judul: "Pindahkan hasil hitung ke usulan?",
      pesan: "Kelompok Pelumas dan Pemeliharaan Mesin & Kelistrikan akan ditimpa dengan hasil perhitungan ini.",
      rincian: [`Pelumas ${rupiah(Math.round(h.pelumas.total))}`, `Permesinan (TP ME+AE) ${rupiah(Math.round(h.permesinan))}`],
      tombolYa: "Pindahkan",
    }))) return;
    set({ nilai: { ...nilai.nilai, pelumas: Math.round(h.pelumas.total), permesinan: Math.round(h.permesinan) } });
  };

  const Num = ({ label, k, sat, step }: { label: string; k: keyof ParameterKapal; sat?: string; step?: string }) => (
    <label className="block">
      <span className="text-[10px] font-semibold text-slate-500">{label}{sat ? ` (${sat})` : ""}</span>
      <input type="number" step={step} className="inp mt-1" value={(p[k] as any) ?? ""}
        onChange={(e) => setP({ [k]: e.target.value ? +e.target.value : undefined } as any)} />
    </label>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={dariKapal} className="btn btn-ghost text-xs">🚢 Ambil dari Ship Database</button>
        <button onClick={dariFleet} disabled={!rf.rute.length} className="btn btn-ghost text-xs disabled:opacity-40"
          title={rf.rute.length ? `Fleetplan ${fleet?.tahun}: ${rf.rute.length} lintasan · ${rf.tripSetahun} trip/tahun` : "Kapal ini tak ada di Fleetplan"}>
          🗺️ Ambil pola dari Fleetplan{fleet ? ` ${fleet.tahun}` : ""}
        </button>
        <span className="text-[11px] text-slate-500">GT &amp; daya mesin dari Ship Database; pola operasi (lintasan, trip, jarak) dari Fleetplan cabang.</span>
        <button onClick={pindahkan} className="btn btn-primary text-xs ml-auto">⚡ Pindahkan ke usulan</button>
      </div>

      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Mesin &amp; operasi</p>
      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <Num label="GRT" k="grt" />
        <Num label="Mesin Induk — jumlah" k="meUnit" sat="unit" />
        <Num label="Daya per ME" k="meHp" sat="HP" />
        <Num label="Jam kerja ME awal tahun" k="jamKerjaAwalMe" sat="jam" />
        <Num label="Mesin Bantu — jumlah" k="aeUnit" sat="unit" />
        <Num label="Daya per AE" k="aeHp" sat="HP" />
        <Num label="Jam kerja AE / hari" k="jamAePerHari" sat="jam" />
        <Num label="Jam kerja AE awal tahun" k="jamKerjaAwalAe" sat="jam" />
        <Num label="Hari operasi setahun" k="hariOperasi" sat="hari" />
        <Num label="Trip setahun" k="tripSetahun" sat="trip" />
        <Num label="Waktu tempuh 1 trip" k="jamPerTripUtama" sat="jam" step="0.05" />
        <Num label="Kecepatan dinas" k="kecepatanKnot" sat="knot" step="0.5" />
      </div>

      {rf.rute.length > 0 && (
        <div className="rounded-xl ring-1 ring-violet-200 bg-violet-50 p-3.5 mb-3 text-[11px] text-slate-700">
          <p className="font-bold text-slate-800 mb-1">
            Fleetplan {fleet?.tahun} — {rf.rute.length} lintasan · {rf.tripSetahun} trip/tahun · {Math.round(rf.milSetahun).toLocaleString("id-ID")} Nm
            {rf.jarakRataRata ? ` · rata-rata ${rf.jarakRataRata.toFixed(1)} Nm/trip` : ""}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {rf.rute.map((r) => (
              <span key={r.lintasan}>{r.lintasan}: <b>{r.tripSetahun}</b> trip{r.jarakNm ? ` · ${r.jarakNm} Nm` : ""}</span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
        Pola operasi <span className="normal-case font-normal text-slate-400">— menentukan jam kerja ME: {jamMgg.toFixed(1)} jam/minggu · {Math.round(jamMgg * 52).toLocaleString("id-ID")} jam/tahun</span>
      </p>
      <div className="space-y-2 mb-4">
        {lint.map((l, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <label className="block flex-1 min-w-[10rem]">
              <span className="text-[10px] font-semibold text-slate-500">Lintasan</span>
              <input className="inp mt-1" value={l.nama} onChange={(e) => setLint(i, { nama: e.target.value })} placeholder="mis. Bastiong – Sofifi" />
            </label>
            <label className="block"><span className="text-[10px] font-semibold text-slate-500">Trip / minggu</span>
              <input type="number" className="inp mt-1 !w-28" value={l.tripPerMinggu || ""} onChange={(e) => setLint(i, { tripPerMinggu: +e.target.value })} /></label>
            <label className="block"><span className="text-[10px] font-semibold text-slate-500">Jam / trip</span>
              <input type="number" step="0.05" className="inp mt-1 !w-28" value={l.jamPerTrip || ""} onChange={(e) => setLint(i, { jamPerTrip: +e.target.value })} /></label>
            <button onClick={() => setP({ lintasan: lint.filter((_, j) => j !== i) })} className="h-10 px-2.5 rounded-lg border border-slate-300 text-rose-600 hover:bg-rose-50 text-sm">✕</button>
          </div>
        ))}
        <button onClick={() => setP({ lintasan: [...lint, { nama: `Lintasan ${lint.length + 1}`, tripPerMinggu: 0, jamPerTrip: 0 }] })}
          className="btn btn-ghost text-xs">＋ Tambah lintasan</button>
      </div>

      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Pelumas &amp; gemuk</p>
      <div className="grid sm:grid-cols-4 gap-3 mb-3">
        <Num label="Constanta (SOC)" k="constanta" step="0.0001" />
        <Num label="Rendemen ME" k="rendemenMe" step="0.05" />
        <Num label="Rendemen AE" k="rendemenAe" step="0.05" />
        <Num label="Harga pelumas mesin" k="hargaPelumas" sat="Rp/L" />
        <Num label="Kapasitas oil pan ME" k="kapasitasMe" sat="L" />
        <Num label="Kapasitas oil pan AE" k="kapasitasAe" sat="L" />
        <Num label="Ganti pelumas ME / tahun" k="gantiMeSetahun" sat="kali" />
        <Num label="Ganti pelumas AE / tahun" k="gantiAeSetahun" sat="kali" />
        <Num label="Hidraulik / bulan" k="hidraulikLiterPerBulan" sat="L" />
        <Num label="Harga hidraulik" k="hargaHidraulik" sat="Rp/L" />
        <Num label={`Gemuk / bulan (baku ${gemukBakuKg(p.grt)} kg)`} k="gemukKgPerBulan" sat="kg" />
        <Num label="Harga gemuk" k="hargaGemuk" sat="Rp/kg" />
      </div>

      <div className="rounded-xl ring-1 ring-sky-200 bg-sky-50 p-3.5 mb-4 text-[11px] text-slate-700">
        <p className="font-bold text-slate-800 mb-1.5">Hasil hitung pelumas — total {rupiah(Math.round(h.pelumas.total))}</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-0.5">
          <span>Topping up ME: {h.pelumas.literPerJamMe.toFixed(3)} L/jam × {p.jamPerTripUtama || 0} jam = {h.pelumas.literPerTripMe.toFixed(2)} L/trip × {p.tripSetahun || 0} trip = <b>{Math.round(h.pelumas.toppingMeLiter)} L</b> → {rupiah(Math.round(h.pelumas.toppingMeRp))}</span>
          <span>Topping up AE: {h.pelumas.literPerJamAe.toFixed(3)} L/jam × {p.jamAePerHari || 0} jam/hari = {h.pelumas.literPerHariAe.toFixed(2)} L/hari × {p.hariOperasi || 0} hari = <b>{Math.round(h.pelumas.toppingAeLiter)} L</b> → {rupiah(Math.round(h.pelumas.toppingAeRp))}</span>
          <span>Penggantian ME: {rupiah(Math.round(h.pelumas.gantiMeRp))}</span>
          <span>Penggantian AE: {rupiah(Math.round(h.pelumas.gantiAeRp))}</span>
          <span>Hidraulik: {rupiah(Math.round(h.pelumas.hidraulikRp))}</span>
          <span>Gemuk: {rupiah(Math.round(h.pelumas.gemukRp))}</span>
        </div>
      </div>

      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
        Tingkat Perawatan <span className="normal-case font-normal text-slate-400">— jumlah kejadian dihitung dari jam kerja; isi biaya sekali kejadian</span>
      </p>
      <div className="grid lg:grid-cols-2 gap-4">
        {([["me", "Mesin Induk", h.tpMe, p.biayaTpMe], ["ae", "Mesin Bantu", h.tpAe, p.biayaTpAe]] as const).map(([kk, judul, res, biaya]) => (
          <div key={kk} className="rounded-xl ring-1 ring-slate-200 p-3">
            <p className="font-bold text-slate-800 text-xs mb-1">{judul} — {Math.round(res.jamSetahun)} jam/tahun (awal {Math.round(res.jamAwal)} → akhir {Math.round(res.jamAkhir)})</p>
            <table className="w-full text-[11px]">
              <thead className="text-[9px] uppercase text-slate-500 font-bold">
                <tr><th className="text-left p-1">Tingkat</th><th className="text-right p-1">Kali</th><th className="text-right p-1 w-32">Biaya / kejadian</th><th className="text-right p-1">Total</th></tr>
              </thead>
              <tbody>
                {res.baris.map((b) => (
                  <tr key={b.key} className="border-b border-slate-100 last:border-0">
                    <td className="p-1 text-slate-700">{b.label}</td>
                    <td className="p-1 text-right tabular-nums font-semibold">{b.kali}</td>
                    <td className="p-1">
                      <input type="number" className="inp !py-1 !text-[11px] text-right"
                        value={biaya?.[b.key] ?? ""}
                        onChange={(e) => setP({ [kk === "me" ? "biayaTpMe" : "biayaTpAe"]: { ...(biaya || {}), [b.key]: e.target.value ? +e.target.value : 0 } } as any)} />
                    </td>
                    <td className="p-1 text-right tabular-nums text-slate-700">{b.total ? rupiahShort(b.total) : "–"}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-extrabold"><td className="p-1" colSpan={3}>TOTAL</td><td className="p-1 text-right tabular-nums">{rupiah(Math.round(res.total))}</td></tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 mt-3">
        Rumus pelumas &amp; jam kerja sudah dicocokkan sel-per-sel dengan workbook RKA pusat (KMP. TUNA 2026).
        Daftar suku cadang tiap TP tidak ada di aplikasi, jadi biayanya diisi manual di sini —
        jumlah kejadiannya yang dihitung otomatis.
      </p>
    </>
  );
}

function Kartu({ label, nilai, sub, tint, bar }: { label: string; nilai: string; sub?: string; tint: string; bar: string }) {
  return (
    <div className="relative bg-white rounded-2xl ring-line elev-sm pl-4 pr-3 py-3 overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${bar}`} />
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold">{label}</p>
      <p className={`text-lg font-extrabold tabular-nums leading-tight ${tint}`}>{nilai}</p>
      {sub && <p className="text-[10px] text-slate-500 truncate">{sub}</p>}
    </div>
  );
}
