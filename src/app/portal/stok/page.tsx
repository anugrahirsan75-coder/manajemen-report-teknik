"use client";
/**
 * Stok Filter & jam kerja mesin — diisi akun MESIN.
 *
 * Dua tabel yang saling menjelaskan. Stok menjawab "ada berapa sekarang", jam
 * kerja menjawab "berapa lama lagi sampai ganti berikutnya". Satu saja tidak
 * cukup: sepuluh filter di gudang tidak berarti aman bila penggantian jatuh
 * minggu depan, dan jam kerja tanpa stok hanya menghasilkan permintaan mendesak.
 *
 * Semua penyuntingan terjadi di layar dulu, baru disimpan sekali tekan. Kapal
 * mengisinya di jaringan yang putus-nyambung; menyimpan tiap ketikan berarti
 * separuh perubahan sampai dan separuh hilang, dan orang di kapal tidak pernah
 * tahu bagian mana yang gagal.
 */
import { useCallback, useEffect, useState } from "react";
import { RangkaPortal, useAku } from "@/components/portal/Rangka";
import { idBaris, type BarisFilter, type JamMesin } from "@/lib/portal/types";

const MESIN_UMUM = ["ME Kiri", "ME Kanan", "AE 1", "AE 2", "AE 3", "Gearbox", "Lainnya"];
const JENIS_FILTER = ["Filter Oli", "Filter Solar", "Filter Udara", "Filter Air", "Filter Hidrolik", "Lainnya"];

const waktu = (iso: string) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function StokFilter() {
  const { aku } = useAku();
  const [filter, setFilter] = useState<BarisFilter[]>([]);
  const [mesin, setMesin] = useState<JamMesin[]>([]);
  const [muat, setMuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");
  const [terakhir, setTerakhir] = useState({ pada: "", oleh: "" });
  const [kotor, setKotor] = useState(false);

  const ambil = useCallback(async () => {
    try {
      const r = await fetch("/api/portal/stok", { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal memuat stok");
      setFilter(d.filter || []);
      setMesin(d.mesin || []);
      setTerakhir({ pada: d.diperbaruiPada || "", oleh: d.olehAkun || "" });
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);

  useEffect(() => { void ambil(); }, [ambil]);

  const simpan = async () => {
    setSibuk(true); setGalat("");
    try {
      const r = await fetch("/api/portal/stok", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter, mesin }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal menyimpan");
      setTerakhir({ pada: d.diperbaruiPada, oleh: aku?.nama || "" });
      setKotor(false);
      setKabar("Tersimpan ✓ Kantor sudah bisa melihatnya.");
      setTimeout(() => setKabar(""), 4000);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setSibuk(false); }
  };

  const ubahFilter = (id: string, k: keyof BarisFilter, v: string | number) => {
    setKotor(true);
    setFilter((l) => l.map((b) => (b.id === id ? { ...b, [k]: v, diperbaruiPada: new Date().toISOString() } : b)));
  };
  const ubahMesin = (id: string, k: keyof JamMesin, v: string | number) => {
    setKotor(true);
    setMesin((l) => l.map((m) => (m.id === id ? { ...m, [k]: v, dicatatPada: new Date().toISOString() } : m)));
  };

  const tambahFilter = () => {
    setKotor(true);
    setFilter((l) => [...l, {
      id: idBaris("f"), mesin: MESIN_UMUM[0], jenis: JENIS_FILTER[0], partNumber: "",
      jumlah: 0, satuan: "pcs", minimum: 2, catatan: "", diperbaruiPada: new Date().toISOString(),
    }]);
  };
  const tambahMesin = () => {
    setKotor(true);
    setMesin((l) => [...l, {
      id: idBaris("m"), mesin: MESIN_UMUM[0], jam: 0, jamGantiTerakhir: 0,
      intervalJam: 250, dicatatPada: new Date().toISOString(),
    }]);
  };

  const menipis = filter.filter((b) => b.minimum > 0 && b.jumlah <= b.minimum);

  return (
    <RangkaPortal aku={aku}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="flex-1 text-[17px] font-black text-slate-900 dark:text-white">Stok Filter & Jam Mesin</h1>
        <button onClick={simpan} disabled={sibuk || muat}
          className={`rounded-xl px-4 py-2 text-[12.5px] font-bold text-white transition disabled:opacity-50 ${
            kotor ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#16357f] hover:bg-[#12296a]"}`}>
          {sibuk ? "Menyimpan…" : kotor ? "Simpan perubahan" : "Simpan"}
        </button>
      </div>

      <p className="mb-3 text-[11.5px] text-slate-500">
        Terakhir diperbarui {waktu(terakhir.pada)}{terakhir.oleh ? ` oleh ${terakhir.oleh}` : ""}.
        Isian tersimpan hanya setelah tombol Simpan ditekan — aman kalau sinyal putus di tengah pengisian.
      </p>

      {kabar && <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800 ring-1 ring-emerald-200">{kabar}</p>}
      {galat && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-800 ring-1 ring-rose-200">{galat}</p>}

      {!!menipis.length && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-900 ring-1 ring-amber-300">
          {menipis.length} jenis filter sudah di bawah batas minimum: {menipis.map((b) => `${b.jenis} ${b.partNumber || ""}`.trim()).join(", ")}.
          Kantor melihat tanda yang sama — tidak perlu menelepon.
        </p>
      )}

      {/* ── stok filter ────────────────────────────────────────────────── */}
      <section className="mb-5 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <h2 className="mb-2 px-1 text-[13px] font-black text-slate-800 dark:text-slate-100">Stok filter di kapal</h2>

        {muat ? <p className="px-1 py-6 text-center text-[12.5px] text-slate-500">Memuat…</p> : null}

        <ul className="space-y-2.5">
          {filter.map((b) => {
            const kurang = b.minimum > 0 && b.jumlah <= b.minimum;
            return (
              <li key={b.id} className={`rounded-xl p-2.5 ring-1 ${
                kurang ? "bg-amber-50 ring-amber-300 dark:bg-amber-950/30" : "bg-slate-50 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700"}`}>
                <div className="grid grid-cols-2 gap-2">
                  <label className="col-span-1">
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Mesin</span>
                    <select value={b.mesin} onChange={(e) => ubahFilter(b.id, "mesin", e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] dark:border-slate-600 dark:bg-slate-900">
                      {Array.from(new Set([...MESIN_UMUM, b.mesin].filter(Boolean))).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  <label className="col-span-1">
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Jenis filter</span>
                    <select value={b.jenis} onChange={(e) => ubahFilter(b.id, "jenis", e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] dark:border-slate-600 dark:bg-slate-900">
                      {Array.from(new Set([...JENIS_FILTER, b.jenis].filter(Boolean))).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  <label className="col-span-2">
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Part number</span>
                    <input value={b.partNumber} onChange={(e) => ubahFilter(b.id, "partNumber", e.target.value)}
                      placeholder="mis. 1R-0750"
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] uppercase dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                  <label>
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Jumlah</span>
                    <input value={b.jumlah} onChange={(e) => ubahFilter(b.id, "jumlah", Number(e.target.value) || 0)}
                      inputMode="numeric"
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[15px] font-bold tabular-nums dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                  <label>
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Satuan</span>
                    <input value={b.satuan} onChange={(e) => ubahFilter(b.id, "satuan", e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                  <label>
                    {/* batas minimum ditentukan KAPAL, bukan kantor: yang tahu berapa
                        cepat filter itu habis adalah yang menggantinya */}
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Batas minimum</span>
                    <input value={b.minimum} onChange={(e) => ubahFilter(b.id, "minimum", Number(e.target.value) || 0)}
                      inputMode="numeric"
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] tabular-nums dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                  <label className="col-span-1">
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Catatan</span>
                    <input value={b.catatan} onChange={(e) => ubahFilter(b.id, "catatan", e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {kurang && <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10.5px] font-black text-amber-900">STOK MENIPIS</span>}
                  <button onClick={() => { setKotor(true); setFilter((l) => l.filter((x) => x.id !== b.id)); }}
                    className="ml-auto text-[11px] font-bold text-rose-600 hover:underline">Hapus baris</button>
                </div>
              </li>
            );
          })}
        </ul>

        <button onClick={tambahFilter}
          className="mt-2.5 w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-[12.5px] font-bold text-slate-500 transition hover:border-[#16357f] hover:text-[#16357f] dark:border-slate-600">
          + Tambah jenis filter
        </button>
      </section>

      {/* ── jam kerja mesin ────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <h2 className="mb-1 px-1 text-[13px] font-black text-slate-800 dark:text-slate-100">Jam kerja mesin</h2>
        <p className="mb-2 px-1 text-[11.5px] text-slate-500">
          Isi jam kerja terbaru dan jam saat filter terakhir diganti. Aplikasi menghitung sisa jam sampai penggantian
          berikutnya — itulah yang dipakai kantor menyiapkan filter sebelum diminta.
        </p>

        <ul className="space-y-2.5">
          {mesin.map((m) => {
            const jalan = Math.max(0, m.jam - m.jamGantiTerakhir);
            const sisa = m.intervalJam > 0 ? m.intervalJam - jalan : null;
            const mendesak = sisa !== null && sisa <= 50;
            return (
              <li key={m.id} className={`rounded-xl p-2.5 ring-1 ${
                mendesak ? "bg-orange-50 ring-orange-300 dark:bg-orange-950/30" : "bg-slate-50 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700"}`}>
                <div className="grid grid-cols-2 gap-2">
                  <label className="col-span-2">
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Mesin</span>
                    <select value={m.mesin} onChange={(e) => ubahMesin(m.id, "mesin", e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] dark:border-slate-600 dark:bg-slate-900">
                      {Array.from(new Set([...MESIN_UMUM, m.mesin].filter(Boolean))).map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Jam kerja sekarang</span>
                    <input value={m.jam} onChange={(e) => ubahMesin(m.id, "jam", Number(e.target.value) || 0)} inputMode="numeric"
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[15px] font-bold tabular-nums dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                  <label>
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Jam saat ganti terakhir</span>
                    <input value={m.jamGantiTerakhir} onChange={(e) => ubahMesin(m.id, "jamGantiTerakhir", Number(e.target.value) || 0)} inputMode="numeric"
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] tabular-nums dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                  <label>
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Interval ganti (jam)</span>
                    <input value={m.intervalJam} onChange={(e) => ubahMesin(m.id, "intervalJam", Number(e.target.value) || 0)} inputMode="numeric"
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] tabular-nums dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                  <div className="rounded-lg bg-white px-2 py-1.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Sisa sampai ganti</span>
                    <span className={`text-[15px] font-black tabular-nums ${mendesak ? "text-orange-700" : "text-slate-800 dark:text-slate-100"}`}>
                      {sisa === null ? "—" : `${sisa} jam`}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">Sudah berjalan {jalan} jam sejak penggantian terakhir</span>
                  <button onClick={() => { setKotor(true); setMesin((l) => l.filter((x) => x.id !== m.id)); }}
                    className="ml-auto text-[11px] font-bold text-rose-600 hover:underline">Hapus</button>
                </div>
              </li>
            );
          })}
        </ul>

        <button onClick={tambahMesin}
          className="mt-2.5 w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-[12.5px] font-bold text-slate-500 transition hover:border-[#16357f] hover:text-[#16357f] dark:border-slate-600">
          + Tambah mesin
        </button>
      </section>

      {kotor && (
        <div className="fixed inset-x-0 bottom-[3.6rem] z-30 px-4">
          <button onClick={simpan} disabled={sibuk}
            className="mx-auto block w-full max-w-3xl rounded-xl bg-emerald-600 py-3 text-[14px] font-bold text-white shadow-lg disabled:opacity-50">
            {sibuk ? "Menyimpan…" : "Simpan perubahan"}
          </button>
        </div>
      )}
    </RangkaPortal>
  );
}
