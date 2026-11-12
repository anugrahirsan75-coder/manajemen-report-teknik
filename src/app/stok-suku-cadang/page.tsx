"use client";
/**
 * Stok Suku Cadang — sisi KANTOR dari persediaan yang diisi kapal (borang TF-101.00.11).
 *
 * Tiga pertanyaan yang dijawab, berurutan:
 *   1. Kapal mana yang sudah mengisi, dan kapan terakhir?  (kapal yang diam menyala)
 *   2. Barang apa yang habis atau di bawah minimum?        (bahan permintaan berikutnya)
 *   3. Kapal mana yang MASIH punya part number ini?         (pindah barang antar-kapal
 *      lebih cepat daripada pengadaan baru)
 *
 * Kantor hanya membaca. Borang bulanan bisa dicetak dari sini juga, dengan angka
 * yang sama persis dengan yang dicetak kapal.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Ikon } from "@/components/ikon";
import {
  LABEL_MUTASI, NADA_SC, bulanIni, namaBulan, petaStok, tglPanjang, tingkatStok,
  type CekFisikSC, type ItemSC, type MutasiSC,
} from "@/lib/portal/sukuCadang";

interface Lembar {
  bagian: "mesin" | "deck";
  adaIsi: boolean;
  diperbaruiPada: string;
  olehAkun: string;
  ringkas: { barang: number; habis: number; menipis: number; mutasiBulanIni: number; cekFisikTerakhir: string } | null;
  item: ItemSC[];
  mutasi: MutasiSC[];
  cekFisik: CekFisikSC[];
}
interface BarisArmada { kapal: string; bagian: Lembar[] }

const waktu = (iso: string) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const umurHari = (iso: string) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null);
const LABEL_BAGIAN = { mesin: "Mesin", deck: "Deck" };

export default function StokSukuCadangKantor() {
  const [armada, setArmada] = useState<BarisArmada[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [pilih, setPilih] = useState<{ kapal: string; bagian: "mesin" | "deck" } | null>(null);
  const [cari, setCari] = useState("");

  const ambil = useCallback(async () => {
    try {
      const r = await fetch("/api/suku-cadang", { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal memuat");
      setArmada(d.armada || []);
      setGalat("");
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);
  useEffect(() => { void ambil(); }, [ambil]);

  const semuaLembar = useMemo(() => armada.flatMap((a) => a.bagian.map((l) => ({ kapal: a.kapal, ...l }))), [armada]);
  const total = useMemo(() => ({
    mengisi: armada.filter((a) => a.bagian.some((l) => l.adaIsi)).length,
    barang: semuaLembar.reduce((n, l) => n + (l.ringkas?.barang || 0), 0),
    habis: semuaLembar.reduce((n, l) => n + (l.ringkas?.habis || 0), 0),
    menipis: semuaLembar.reduce((n, l) => n + (l.ringkas?.menipis || 0), 0),
  }), [armada, semuaLembar]);

  /* pencarian lintas armada: siapa yang masih memegang barang ini */
  const hasilCari = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (q.length < 3) return [];
    return semuaLembar.flatMap((l) => {
      const stok = petaStok(l.mutasi);
      return l.item.filter((i) => i.aktif && `${i.partNumber} ${i.nama}`.toLowerCase().includes(q))
        .map((i) => ({ kapal: l.kapal, bagian: l.bagian, i, jumlah: stok.get(i.id) || 0 }));
    }).sort((a, b) => b.jumlah - a.jumlah).slice(0, 60);
  }, [cari, semuaLembar]);

  const terpilih = pilih ? semuaLembar.find((l) => l.kapal === pilih.kapal && l.bagian === pilih.bagian) : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#16357f] text-white">
            <Ikon nama="kotak" className="h-5 w-5" />
          </span>
          <div className="min-w-[16rem] flex-1">
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Stok Suku Cadang Kapal</h1>
            <p className="text-[11.5px] text-slate-500">
              Persediaan di atas kapal (borang TF-101.00.11), diisi awak lewat Portal Kapal → menu <b>Sparepart</b>.
              Stok dan borang bulanan dihitung dari catatan terima, pakai, dan cek fisik.
            </p>
          </div>
          <button onClick={() => { setMuat(true); void ambil(); }}
            className="rounded-xl border border-slate-300 px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">
            Muat ulang
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { l: "Kapal sudah mengisi", v: `${total.mengisi}/${armada.length || 13}`, k: "text-slate-800 dark:text-slate-100" },
            { l: "Jenis barang tercatat", v: total.barang, k: "text-slate-800 dark:text-slate-100" },
            { l: "Habis", v: total.habis, k: total.habis ? "text-rose-700" : "text-slate-400" },
            { l: "Di bawah minimum", v: total.menipis, k: total.menipis ? "text-amber-700" : "text-slate-400" },
          ].map((x) => (
            <div key={x.l} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700">
              <p className={`text-xl font-black tabular-nums ${x.k}`}>{x.v}</p>
              <p className="text-[10.5px] font-bold uppercase text-slate-500">{x.l}</p>
            </div>
          ))}
        </div>
      </header>

      {galat && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-800 ring-1 ring-rose-200">{galat}</p>}
      {muat && <p className="py-10 text-center text-[13px] text-slate-500">Memuat…</p>}

      {!muat && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          {/* ── daftar kapal ── */}
          <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <h2 className="mb-2 px-1 text-[13px] font-black text-slate-800 dark:text-slate-100">Per kapal</h2>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase text-slate-500">
                  <th className="px-1.5 py-1">Kapal</th>
                  <th className="px-1.5">Mesin</th>
                  <th className="px-1.5">Deck</th>
                </tr>
              </thead>
              <tbody>
                {armada.map((a) => (
                  <tr key={a.kapal} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-1.5 py-1.5 font-bold text-slate-800 dark:text-slate-100">{a.kapal.replace(/^KMP\.\s*/, "")}</td>
                    {a.bagian.map((l) => {
                      const aktif = pilih?.kapal === a.kapal && pilih.bagian === l.bagian;
                      const lama = umurHari(l.diperbaruiPada);
                      return (
                        <td key={l.bagian} className="px-1 py-1">
                          <button onClick={() => setPilih({ kapal: a.kapal, bagian: l.bagian })}
                            className={`w-full rounded-lg px-2 py-1 text-left ring-1 transition ${aktif ? "bg-[#16357f] text-white ring-[#16357f]"
                              : l.adaIsi ? "bg-slate-50 ring-slate-200 hover:ring-[#16357f] dark:bg-slate-800 dark:ring-slate-700"
                                : "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/30"}`}>
                            {l.adaIsi && l.ringkas ? (
                              <>
                                <span className="font-black tabular-nums">{l.ringkas.barang}</span> brg
                                {l.ringkas.habis ? <span className={`ml-1 font-black ${aktif ? "" : "text-rose-700"}`}>· {l.ringkas.habis} habis</span> : null}
                                {l.ringkas.menipis ? <span className={`ml-1 font-black ${aktif ? "" : "text-amber-700"}`}>· {l.ringkas.menipis} tipis</span> : null}
                                <span className={`block text-[10px] ${aktif ? "text-white/80" : lama !== null && lama > 35 ? "font-bold text-orange-700" : "text-slate-500"}`}>
                                  {lama === null ? "—" : lama === 0 ? "diperbarui hari ini" : `${lama} hari lalu`}
                                </span>
                              </>
                            ) : <span className="text-[11px] font-bold">Belum mengisi</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="space-y-4">
            {/* ── cari lintas armada ── */}
            <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <h2 className="px-1 text-[13px] font-black text-slate-800 dark:text-slate-100">Cari di seluruh armada</h2>
              <p className="px-1 text-[11px] text-slate-500">Ketik part number atau nama barang — untuk melihat kapal mana yang masih menyimpannya.</p>
              <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="mis. 37561-17500 atau nozzle"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] dark:border-slate-600 dark:bg-slate-900" />
              {cari.trim().length >= 3 && (
                <div className="mt-2 max-h-72 overflow-auto">
                  {!hasilCari.length && <p className="py-3 text-center text-[12px] text-slate-500">Tidak ada kapal yang mencatat barang ini.</p>}
                  <table className="w-full text-[12px]">
                    <tbody>
                      {hasilCari.map((h) => (
                        <tr key={`${h.kapal}-${h.bagian}-${h.i.id}`} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-1.5 py-1 font-bold">{h.kapal}</td>
                          <td className="px-1.5 text-slate-500">{LABEL_BAGIAN[h.bagian]}</td>
                          <td className="px-1.5">{h.i.partNumber}</td>
                          <td className="px-1.5">{h.i.nama}</td>
                          <td className={`px-1.5 text-right font-black tabular-nums ${h.jumlah > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                            {h.jumlah} {h.i.satuan}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── rincian satu lembar ── */}
            {terpilih
              ? <RincianLembar kapal={terpilih.kapal} l={terpilih} />
              : (
                <section className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-[12.5px] text-slate-500 dark:border-slate-700">
                  Pilih kapal dan bagian di daftar untuk melihat rincian stoknya.
                </section>
              )}
          </div>
        </div>
      )}
    </main>
  );
}

function RincianLembar({ kapal, l }: { kapal: string; l: Lembar & { kapal: string } }) {
  const [saring, setSaring] = useState<"semua" | "perlu">("perlu");
  const [periode, setPeriode] = useState(bulanIni());
  const stok = useMemo(() => petaStok(l.mutasi), [l.mutasi]);
  const aktif = l.item.filter((i) => i.aktif);
  const baris = aktif.map((i) => ({ i, jumlah: stok.get(i.id) || 0, t: tingkatStok(stok.get(i.id) || 0, i.minimum) }));
  const perlu = baris.filter((b) => b.t === "habis" || b.t === "menipis");
  const tampil = saring === "perlu" ? perlu : baris;
  const nama = new Map(l.item.map((i) => [i.id, i]));
  const terbaru = [...l.mutasi].filter((m) => m.jenis !== "awal")
    .sort((a, b) => (b.tanggal + b.dicatatPada).localeCompare(a.tanggal + a.dicatatPada)).slice(0, 25);
  const pilihan = Array.from({ length: 12 }, (_, k) => {
    const d = new Date(); const x = new Date(d.getFullYear(), d.getMonth() - k, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  });
  const cek = l.cekFisik.slice(-1)[0];

  if (!l.adaIsi) {
    return (
      <section className="rounded-2xl bg-rose-50 p-5 text-[12.5px] text-rose-900 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-200">
        <p className="font-black">{kapal} · {LABEL_BAGIAN[l.bagian]} belum pernah mengisi persediaan suku cadang.</p>
        <p className="mt-1">Minta awak masuk Portal Kapal dengan akun {LABEL_BAGIAN[l.bagian]}, buka menu <b>Sparepart</b> → <b>Tambah</b>,
          lalu tempel daftar dari borang TF-101.00.11 bulan terakhir.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-black text-slate-900 dark:text-white">{kapal} · {LABEL_BAGIAN[l.bagian]}</h2>
          <p className="text-[11px] text-slate-500">
            Diperbarui {waktu(l.diperbaruiPada)} oleh {l.olehAkun || "—"} ·
            cek fisik {cek ? `terakhir ${tglPanjang(cek.tanggal)} (${cek.berselisih} berselisih dari ${cek.diperiksa})` : "belum pernah"}
          </p>
        </div>
        <select value={periode} onChange={(e) => setPeriode(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[12px] dark:border-slate-600 dark:bg-slate-900">
          {pilihan.map((p) => <option key={p} value={p}>{namaBulan(p)}</option>)}
        </select>
        <a href={`/stok-suku-cadang/cetak?kapal=${encodeURIComponent(kapal)}&bagian=${l.bagian}&periode=${periode}`} target="_blank" rel="noreferrer"
          className="rounded-lg bg-[#16357f] px-3 py-1.5 text-[12px] font-bold text-white">Cetak borang TF-101.00.11</a>
      </div>

      <div className="mb-2 flex gap-1 px-1">
        {([["perlu", `Perlu perhatian (${perlu.length})`], ["semua", `Semua barang (${baris.length})`]] as const).map(([k, lab]) => (
          <button key={k} onClick={() => setSaring(k)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${saring === k ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
            {lab}
          </button>
        ))}
      </div>

      <div className="max-h-[28rem] overflow-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-slate-100 text-left text-[10.5px] uppercase text-slate-500 dark:bg-slate-800">
            <tr>
              <th className="px-2 py-1.5">Peralatan</th><th className="px-2">Part number</th><th className="px-2">Nama barang</th>
              <th className="px-2 text-right">Stok</th><th className="px-2 text-right">Min</th><th className="px-2">Status</th><th className="px-2">Lokasi</th>
            </tr>
          </thead>
          <tbody>
            {tampil.map(({ i, jumlah, t }) => (
              <tr key={i.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-2 py-1 text-slate-500">{i.peralatan}</td>
                <td className="px-2 font-mono text-[11.5px]">{i.partNumber}</td>
                <td className="px-2 font-semibold">{i.nama}</td>
                <td className="px-2 text-right font-black tabular-nums">{jumlah} {i.satuan}</td>
                <td className="px-2 text-right tabular-nums text-slate-500">{i.minimum || "—"}</td>
                <td className="px-2"><span className={`rounded px-1.5 py-0.5 text-[10.5px] font-black ring-1 ${NADA_SC[t].kelas}`}>{NADA_SC[t].label}</span></td>
                <td className="px-2 text-slate-500">{i.lokasi}</td>
              </tr>
            ))}
            {!tampil.length && (
              <tr><td colSpan={7} className="px-2 py-4 text-center text-slate-500">
                {saring === "perlu" ? "Tidak ada barang habis atau di bawah minimum." : "Belum ada barang."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mb-1 mt-3 px-1 text-[12px] font-black text-slate-700 dark:text-slate-200">Catatan terbaru</h3>
      <ul className="divide-y divide-slate-100 text-[11.5px] dark:divide-slate-800">
        {terbaru.map((m) => (
          <li key={m.id} className={`flex gap-2 px-1 py-1 ${m.dibatalkan ? "text-slate-400 line-through" : ""}`}>
            <span className="w-24 shrink-0 tabular-nums">{tglPanjang(m.tanggal)}</span>
            <span className={`w-28 shrink-0 font-bold ${m.jenis === "pakai" ? "text-orange-700" : m.jenis === "koreksi" ? "text-violet-700" : "text-emerald-700"}`}>
              {LABEL_MUTASI[m.jenis]} {m.jumlah}
            </span>
            <span className="min-w-0 flex-1">{nama.get(m.itemId)?.nama || "?"}{m.keterangan ? ` — ${m.keterangan}` : ""}</span>
            <span className="shrink-0 text-slate-400">{m.oleh}</span>
          </li>
        ))}
        {!terbaru.length && <li className="px-1 py-2 text-slate-500">Belum ada penerimaan, pemakaian, atau koreksi.</li>}
      </ul>
    </section>
  );
}
