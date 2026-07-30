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

          <div className="p-6 max-h-[62vh] overflow-auto">
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
