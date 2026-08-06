"use client";
/**
 * Kinerja Anggaran — halaman TERBUKA, hanya untuk dilihat.
 *
 * Dibuat untuk dibagikan ke Direksi sebagai satu tautan: seluruh kinerja
 * anggaran (Rutin, Docking, Persetujuan Lainnya) dalam satu layar, tanpa login
 * dan tanpa satu pun tombol yang mengubah data.
 *
 * Angkanya memakai fungsi hitung yang sama dengan Dashboard di dalam aplikasi
 * (lihat lib/anggaran/kinerja.ts), dan datanya sudah dipangkas di server —
 * vendor, nomor kontrak, foto, dan catatan tidak pernah dikirim ke halaman ini.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataMentah, Kinerja, hitungKinerja } from "@/lib/anggaran/kinerja";
import { rupiah, bulanTahun } from "@/lib/format";
import { ringkasKapal } from "@/lib/kapal/nama";

const KUNCI_KODE = "kinerja_kode";
const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const nadaPct = (p: number, adaPagu: boolean) =>
  !adaPagu ? { teks: "text-slate-500", latar: "bg-slate-300", cincin: "ring-slate-200" }
    : p > 100 ? { teks: "text-rose-700", latar: "bg-rose-500", cincin: "ring-rose-200" }
      : p >= 95 ? { teks: "text-amber-700", latar: "bg-amber-500", cincin: "ring-amber-200" }
        : { teks: "text-emerald-700", latar: "bg-emerald-500", cincin: "ring-emerald-200" };

export default function KinerjaAnggaran() {
  const [data, setData] = useState<DataMentah | null>(null);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [perluKode, setPerluKode] = useState(false);
  const [kode, setKode] = useState("");
  const [tahun, setTahun] = useState(new Date().getFullYear());

  const ambil = useCallback(async (k: string) => {
    setMuat(true); setGalat("");
    try {
      const r = await fetch(`/api/publik/anggaran${k ? `?kode=${encodeURIComponent(k)}` : ""}`, { cache: "no-store" });
      const d = await r.json();
      if (r.status === 401 && d?.perluKode) { setPerluKode(true); setMuat(false); return; }
      if (!r.ok || !d?.ok) throw new Error(d?.error || `gagal memuat (${r.status})`);
      setPerluKode(false);
      setData(d);
      if (k) { try { localStorage.setItem(KUNCI_KODE, k); } catch { /* mode penyamaran */ } }
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);

  useEffect(() => {
    let simpanan = "";
    try { simpanan = localStorage.getItem(KUNCI_KODE) || ""; } catch { /* mode penyamaran */ }
    setKode(simpanan);
    void ambil(simpanan);
  }, [ambil]);

  const tahunAda = useMemo(() => {
    const t = new Set<number>();
    (data?.pengadaan || []).forEach((p: any) => { const y = Number((p.tanggal || "").slice(0, 4)); if (y) t.add(y); });
    (data?.plafon || []).forEach((p: any) => { const y = Number((p.bulan || "").slice(0, 4)); if (y) t.add(y); });
    return Array.from(t).sort((a, b) => b - a);
  }, [data]);

  useEffect(() => { if (tahunAda.length && !tahunAda.includes(tahun)) setTahun(tahunAda[0]); }, [tahunAda, tahun]);

  const k: Kinerja | null = useMemo(() => (data ? hitungKinerja(data, tahun) : null), [data, tahun]);

  if (perluKode) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-lg font-extrabold text-slate-800">Kinerja Anggaran</h1>
          <p className="mt-1 text-sm text-slate-500">Halaman ini dilindungi kode akses.</p>
          <form onSubmit={(e) => { e.preventDefault(); void ambil(kode); }} className="mt-4 flex gap-2">
            <input value={kode} onChange={(e) => setKode(e.target.value)} placeholder="Kode akses" autoFocus
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400" />
            <button className="btn btn-primary text-sm">Masuk</button>
          </form>
          {galat && <p className="mt-3 text-sm text-rose-700">{galat}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:px-0">
      {/* ── kepala ─────────────────────────────────────────────────────── */}
      <header className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in print:hidden">
        <div className="glass hero-glow flex flex-wrap items-center gap-4 rounded-3xl px-6 py-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl asdp-gradient text-2xl text-white shadow-md">📈</div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-700">Hanya lihat</span>
              <span className="text-[10px] text-slate-400">
                {data?.diperbarui ? `data per ${new Date(data.diperbarui).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}` : ""}
              </span>
            </div>
            <h1 className="asdp-text-gradient text-2xl font-extrabold tracking-tight">Kinerja Anggaran Teknik</h1>
            <p className="text-sm text-slate-500">PT ASDP Indonesia Ferry (Persero) — Cabang Ternate · Rutin, Docking, dan Persetujuan Lainnya</p>
          </div>
          <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            {(tahunAda.length ? tahunAda : [tahun]).map((t) => <option key={t} value={t}>Tahun {t}</option>)}
          </select>
          <button onClick={() => window.print()} className="btn btn-ghost text-xs">🖨️ Cetak</button>
        </div>
      </header>

      <h1 className="hidden text-xl font-extrabold print:block">Kinerja Anggaran Teknik — Cabang Ternate {tahun}</h1>

      {muat && <p className="mt-8 text-center text-sm text-slate-400">Memuat data anggaran…</p>}
      {galat && !muat && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{galat}</div>
      )}

      {k && !muat && (
        <>
          {/* ── angka besar ────────────────────────────────────────────── */}
          <Bagian judul="Ringkasan tahun berjalan" ket="Pagu = persetujuan yang berlaku. Terpakai = SPPBJ + Non PR PO, barang persediaan tidak dihitung.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kartu label={`Pagu ${tahun}`} nilai={k.rutin.pagu + k.docking.pagu + k.lainnya.pagu} warna="text-slate-800" />
              <Kartu label="Terpakai" nilai={k.rutin.pakai + k.docking.pakai + k.lainnya.pakai} warna="text-sky-700"
                sub={`${pct(k.rutin.pakai + k.docking.pakai + k.lainnya.pakai, k.rutin.pagu + k.docking.pagu + k.lainnya.pagu)}% terserap`} />
              <Kartu label="Sisa" nilai={(k.rutin.pagu + k.docking.pagu + k.lainnya.pagu) - (k.rutin.pakai + k.docking.pakai + k.lainnya.pakai)} warna="text-emerald-700" />
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Perlu perhatian</p>
                <p className="text-2xl font-extrabold text-rose-700">{k.perhatian.length} pos</p>
                <p className="mt-0.5 text-[11px] text-slate-500">terpakai ≥ 95% dari pagunya</p>
              </div>
            </div>
          </Bagian>

          {/* ── tiga sumber ────────────────────────────────────────────── */}
          <Bagian judul="Tiga sumber anggaran">
            <div className="grid gap-3 lg:grid-cols-3">
              <SumberKartu judul="Rutin" ikon="🎯" sub="pagu per bulan · per Mata Anggaran" pagu={k.rutin.pagu} pakai={k.rutin.pakai}
                catatan={k.rutin.rka ? `RKA ${tahun} untuk bulan-bulan ini: ${rupiah(k.rutin.rka)}` : undefined} />
              <SumberKartu judul="Docking" ikon="⚓" sub="pagu per kapal dari persetujuan pusat" pagu={k.docking.pagu} pakai={k.docking.pakai} />
              <SumberKartu judul="Lainnya" ikon="📜" sub="per surat persetujuan biaya" pagu={k.lainnya.pagu} pakai={k.lainnya.pakai} />
            </div>
          </Bagian>

          {/* ── rutin per bulan ────────────────────────────────────────── */}
          <Bagian judul="Rutin — pagu vs realisasi per bulan"
            ket="Batang abu = pagu bulan itu. Batang berwarna = realisasi. Merah berarti melewati pagu.">
            <GrafikBulan baris={k.perBulan} />
            <TabelDua judul="" baris={k.perBulan.filter((b) => b.pagu || b.pakai).map((b) => ({
              label: bulanTahun(`${b.bulan}-01`), pagu: b.pagu, pakai: b.pakai,
            }))} kolom="Bulan" />
          </Bagian>

          {/* ── rutin per mata anggaran ────────────────────────────────── */}
          {k.rutin.perMa.length > 0 && (
            <Bagian judul="Rutin — per Mata Anggaran" ket="Sepanjang tahun berjalan, seluruh bulan digabung.">
              <TabelDua baris={k.rutin.perMa} kolom="Mata Anggaran" />
            </Bagian>
          )}

          {/* ── docking per kapal ──────────────────────────────────────── */}
          {k.docking.perKapal.length > 0 && (
            <Bagian judul="Docking — per kapal" ket="Pagu diambil dari surat persetujuan pusat (termasuk addendum bila ada).">
              <TabelDua baris={k.docking.perKapal.map((x) => ({ ...x, label: ringkasKapal(x.label) }))} kolom="Kapal" />
            </Bagian>
          )}

          {/* ── lainnya per surat ──────────────────────────────────────── */}
          {k.lainnya.perSurat.length > 0 && (
            <Bagian judul="Persetujuan Biaya Lainnya — per surat">
              <TabelDua baris={k.lainnya.perSurat} kolom="Surat persetujuan" />
            </Bagian>
          )}

          {/* ── beban per kapal ────────────────────────────────────────── */}
          {k.kapal.length > 0 && (
            <Bagian judul="Beban biaya per kapal" ket="Seluruh sumber digabung. Satu pengadaan yang menyebut beberapa kapal dibagi rata.">
              <BebanKapal baris={k.kapal} />
            </Bagian>
          )}

          {/* ── perhatian ──────────────────────────────────────────────── */}
          {k.perhatian.length > 0 && (
            <Bagian judul="Pos yang perlu diperhatikan" ket="Terpakai 95% ke atas dari pagunya — termasuk yang sudah melewati.">
              <TabelDua baris={k.perhatian} kolom="Pos anggaran" />
            </Bagian>
          )}

          <p className="mt-8 rounded-2xl bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-slate-500 ring-1 ring-slate-200">
            <b>Cara angka ini dihitung.</b> Realisasi diambil dari SPPBJ dan Non PR PO yang tanggalnya jatuh pada periode
            bersangkutan; harga yang dipakai adalah harga final SPBJ bila sudah terbit, kalau belum memakai harga usulan.
            Barang yang masuk persediaan tidak menggerus pagu. Satu pengadaan yang menyebut beberapa kapal dibagi rata ke
            kapal-kapal itu, dan tiap baris pengadaan bisa dibebankan ke sumber anggaran yang berbeda, jadi satu dokumen
            tak pernah terhitung dua kali. Halaman ini hanya menampilkan; perubahan data dilakukan di aplikasi.
          </p>
        </>
      )}
    </main>
  );
}

/* ── potongan tampilan ──────────────────────────────────────────────────── */

function Bagian({ judul, ket, children }: { judul: string; ket?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">{judul}</h2>
      {ket && <p className="mb-2 mt-0.5 text-[11px] text-slate-400">{ket}</p>}
      <div className={ket ? "" : "mt-2"}>{children}</div>
    </section>
  );
}

function Kartu({ label, nilai, warna, sub }: { label: string; nilai: number; warna: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`text-2xl font-extrabold tabular-nums ${warna}`}>{rupiah(nilai)}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function SumberKartu({ judul, ikon, sub, pagu, pakai, catatan }: {
  judul: string; ikon: string; sub: string; pagu: number; pakai: number; catatan?: string;
}) {
  const p = pct(pakai, pagu);
  const nada = nadaPct(p, pagu > 0);
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        <span className="text-xl">{ikon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-slate-800">{judul}</p>
          <p className="truncate text-[11px] text-slate-400">{sub}</p>
        </div>
        <span className={`text-lg font-extrabold tabular-nums ${nada.teks}`}>{pagu ? `${p}%` : "—"}</span>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${nada.latar}`} style={{ width: `${Math.min(100, p)}%` }} />
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
        <div><dt className="text-slate-400">Pagu</dt><dd className="font-bold tabular-nums text-slate-700">{rupiah(pagu)}</dd></div>
        <div><dt className="text-slate-400">Terpakai</dt><dd className="font-bold tabular-nums text-slate-700">{rupiah(pakai)}</dd></div>
      </dl>
      {catatan && <p className="mt-2 text-[10px] text-slate-400">{catatan}</p>}
    </div>
  );
}

/** batang pagu vs realisasi per bulan — pagu jadi latar, realisasi jadi isinya */
function GrafikBulan({ baris }: { baris: { bulan: string; pagu: number; pakai: number }[] }) {
  const puncak = Math.max(1, ...baris.map((b) => Math.max(b.pagu, b.pakai)));
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-end gap-1.5" style={{ height: 190 }}>
        {baris.map((b) => {
          const p = pct(b.pakai, b.pagu);
          const nada = nadaPct(p, b.pagu > 0);
          const tPagu = Math.round((b.pagu / puncak) * 150);
          const tPakai = Math.round((b.pakai / puncak) * 150);
          return (
            <div key={b.bulan} className="flex flex-1 flex-col items-center justify-end gap-1">
              {b.pagu > 0 && b.pakai > 0 && <span className={`text-[9px] font-bold ${nada.teks}`}>{p}%</span>}
              <div className="relative flex w-full items-end justify-center" style={{ height: 152 }}>
                <div className="absolute bottom-0 w-full rounded-t bg-slate-200/80" style={{ height: Math.max(2, tPagu) }} title={`Pagu ${rupiah(b.pagu)}`} />
                <div className={`relative w-3/5 rounded-t ${nada.latar}`} style={{ height: Math.max(b.pakai ? 3 : 0, tPakai) }} title={`Realisasi ${rupiah(b.pakai)}`} />
              </div>
              <span className="text-[10px] text-slate-500">{NAMA_BULAN[Number(b.bulan.slice(5, 7)) - 1]}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><i className="h-2 w-4 rounded bg-slate-200" /> pagu</span>
        <span className="flex items-center gap-1"><i className="h-2 w-4 rounded bg-emerald-500" /> aman</span>
        <span className="flex items-center gap-1"><i className="h-2 w-4 rounded bg-amber-500" /> ≥95%</span>
        <span className="flex items-center gap-1"><i className="h-2 w-4 rounded bg-rose-500" /> melewati pagu</span>
      </div>
    </div>
  );
}

function TabelDua({ judul, baris, kolom }: { judul?: string; baris: { label: string; pagu: number; pakai: number; ket?: string }[]; kolom: string }) {
  const totalPagu = baris.reduce((s, b) => s + b.pagu, 0);
  const totalPakai = baris.reduce((s, b) => s + b.pakai, 0);
  if (!baris.length) return null;
  return (
    <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      {judul && <p className="px-4 pt-3 text-xs font-bold text-slate-600">{judul}</p>}
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left font-extrabold">{kolom}</th>
            <th className="px-3 py-2 text-right font-extrabold">Pagu</th>
            <th className="px-3 py-2 text-right font-extrabold">Terpakai</th>
            <th className="px-3 py-2 text-right font-extrabold">Sisa</th>
            <th className="w-40 px-3 py-2 text-left font-extrabold">Serapan</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b, i) => {
            const p = pct(b.pakai, b.pagu);
            const nada = nadaPct(p, b.pagu > 0);
            return (
              <tr key={`${b.label}-${i}`} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <span className="block text-[13px] font-semibold text-slate-800">{b.label}</span>
                  {b.ket && <span className="block text-[10px] text-slate-400">{b.ket}</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{b.pagu ? rupiah(b.pagu) : "—"}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">{rupiah(b.pakai)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${b.pagu && b.pagu - b.pakai < 0 ? "text-rose-700" : "text-slate-600"}`}>
                  {b.pagu ? rupiah(b.pagu - b.pakai) : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full ${nada.latar}`} style={{ width: `${Math.min(100, p)}%` }} />
                    </div>
                    <span className={`w-10 text-right text-[11px] font-bold tabular-nums ${nada.teks}`}>{b.pagu ? `${p}%` : "—"}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-slate-50 text-[12px] font-bold text-slate-700">
          <tr className="border-t-2 border-slate-200">
            <td className="px-3 py-2">Jumlah</td>
            <td className="px-3 py-2 text-right tabular-nums">{rupiah(totalPagu)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{rupiah(totalPakai)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{rupiah(totalPagu - totalPakai)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{totalPagu ? `${pct(totalPakai, totalPagu)}%` : "—"}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function BebanKapal({ baris }: { baris: { kapal: string; rutin: number; docking: number; lainnya: number; total: number }[] }) {
  const puncak = Math.max(1, ...baris.map((b) => b.total));
  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      {baris.map((b) => (
        <div key={b.kapal} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-[12px] font-semibold text-slate-700" title={b.kapal}>{ringkasKapal(b.kapal)}</span>
          <div className="flex h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-sky-500" style={{ width: `${(b.rutin / puncak) * 100}%` }} title={`Rutin ${rupiah(b.rutin)}`} />
            <div className="h-full bg-indigo-500" style={{ width: `${(b.docking / puncak) * 100}%` }} title={`Docking ${rupiah(b.docking)}`} />
            <div className="h-full bg-amber-500" style={{ width: `${(b.lainnya / puncak) * 100}%` }} title={`Lainnya ${rupiah(b.lainnya)}`} />
          </div>
          <span className="w-32 shrink-0 text-right text-[12px] font-bold tabular-nums text-slate-800">{rupiah(b.total)}</span>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><i className="h-2 w-4 rounded bg-sky-500" /> Rutin</span>
        <span className="flex items-center gap-1"><i className="h-2 w-4 rounded bg-indigo-500" /> Docking</span>
        <span className="flex items-center gap-1"><i className="h-2 w-4 rounded bg-amber-500" /> Lainnya</span>
      </div>
    </div>
  );
}
