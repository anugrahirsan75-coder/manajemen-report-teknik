"use client";
/**
 * Rencana & Realisasi Perawatan Bulanan (Lampiran 3).
 *
 * Prinsip rancangan:
 *  - TENGGAT DULU. Papan paling atas menjawab "apa yang harus saya isi hari ini,
 *    sampai kapan" — rencana periode 2-bulanan (batas tgl 22) & realisasi bulan
 *    berjalan (batas tgl 1 bulan depan).
 *  - SATU KAPAL SATU LAYAR. Isi per kapal, per kelompok Mata Anggaran; deretan
 *    kapal memakai penanda: kosong / draf / terkirim, jadi terlihat mana yang belum.
 *  - AMAN. Dokumen yang sudah "Terkirim" terkunci (tak bisa berubah tanpa sengaja);
 *    membuka kunci butuh konfirmasi dan dicatat waktunya.
 *  - AKUNTABEL. Total dihitung dari item (jumlah x harga satuan), bukan diketik.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { KAPAL_ANGGARAN, maKey, namaKapalPenuh } from "@/lib/anggaran/types";
import { useAnggaran } from "@/lib/anggaran/store";
import { pecahKapal } from "@/lib/kapal/nama";
import { useRR, idDoc } from "@/lib/rr/store";
import {
  KELOMPOK_RR, MA_RR, kunciKelompok, RrDoc, RrItem, TipeRR,
  bulanDari, bulanKe, namaBulan, periodeAktif, periodeDari, statusTenggat, tenggatDoc,
  totalDoc, totalKelompok, totalPerMA, nilaiItem, bulanRealisasiAktif,
} from "@/lib/rr/types";
import { rupiah } from "@/lib/format";

const uid = () => Math.random().toString(36).slice(2, 9);
const barisKosong = (): RrItem => ({ id: uid(), deskripsi: "", spesifikasi: "", jumlah: 0, satuan: "", harga: 0 });

const docBaru = (tipe: TipeRR, bulan: string, kapal: string): RrDoc => ({
  id: idDoc(tipe, bulan, kapal), tipe, bulan, kapal,
  kelompok: KELOMPOK_RR.map((k) => ({ kunci: kunciKelompok(k), items: [] })),
  ppnPersen: 0, status: "draf", diubahPada: new Date().toISOString(),
});

const NADA = {
  rencana: { grad: "from-indigo-600 to-blue-600", ring: "ring-indigo-200", bg: "bg-indigo-50", teks: "text-indigo-800", tombol: "bg-indigo-600" },
  realisasi: { grad: "from-emerald-600 to-teal-600", ring: "ring-emerald-200", bg: "bg-emerald-50", teks: "text-emerald-800", tombol: "bg-emerald-600" },
} as const;

const WARNA_TENGGAT: Record<string, string> = {
  aman: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  dekat: "bg-amber-50 text-amber-800 ring-amber-200",
  mendesak: "bg-orange-50 text-orange-800 ring-orange-300",
  lewat: "bg-rose-50 text-rose-800 ring-rose-300",
};

export default function RencanaPage() {
  const { ready, loading, dok, simpan, hapus, reload, simpanErr } = useRR();
  const { pengadaan } = useAnggaran();   // untuk menarik realisasi dari SPPBJ/Non PR PO
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);   // hindari beda server/klien

  const periode = now ? periodeAktif(now) : null;
  const bulanReal = now ? bulanRealisasiAktif(now) : "";

  const [tipe, setTipe] = useState<TipeRR>("rencana");
  const [bulan, setBulan] = useState("");
  const [kapal, setKapal] = useState(KAPAL_ANGGARAN[0]);
  useEffect(() => {
    if (!now || bulan) return;
    setBulan(periodeAktif(now).mulai);
  }, [now, bulan]);

  // dokumen yang sedang dibuka (salinan kerja)
  const tersimpan = dok.find((x) => x.tipe === tipe && x.bulan === bulan && x.kapal === kapal);
  const [kerja, setKerja] = useState<RrDoc | null>(null);
  const kunciBuka = `${tipe}|${bulan}|${kapal}`;
  const kunciRef = useRef("");
  const [berubah, setBerubah] = useState(false);
  useEffect(() => {
    if (!bulan) return;
    const gantiDokumen = kunciRef.current !== kunciBuka || !kerja;
    // data Supabase sering tiba SETELAH layar terbuka — kalau belum ada suntingan lokal,
    // isinya harus ikut masuk; kalau tidak, dokumen yang sudah tersimpan terlihat kosong.
    const dataBaruTiba = !gantiDokumen && !berubah && tersimpan && tersimpan.diubahPada !== kerja?.diubahPada;
    if (!gantiDokumen && !dataBaruTiba) return;
    kunciRef.current = kunciBuka;
    setKerja(tersimpan ? JSON.parse(JSON.stringify(tersimpan)) : docBaru(tipe, bulan, kapal));
    setBerubah(false);
  }, [kunciBuka, tersimpan, bulan, tipe, kapal, kerja, berubah]);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");
  const terkunci = kerja?.status === "terkirim";

  const ubah = (f: (d: RrDoc) => void) => {
    if (!kerja || terkunci) return;
    const salin: RrDoc = JSON.parse(JSON.stringify(kerja));
    f(salin);
    setKerja(salin);
    setBerubah(true);
  };

  const simpanDoc = async (d?: RrDoc) => {
    const isi = d || kerja;
    if (!isi) return;
    setSibuk(true); setPesan("");
    try {
      await simpan(isi);
      setKerja(JSON.parse(JSON.stringify(isi)));
      setBerubah(false);
      setPesan("Tersimpan.");
      setTimeout(() => setPesan(""), 2500);
    } catch (e: any) {
      setPesan(`Gagal simpan: ${e?.message || e}`);
    } finally { setSibuk(false); }
  };

  const tandaiTerkirim = async () => {
    if (!kerja) return;
    if (!confirm(`Tandai ${tipe} ${namaBulan(bulan)} — ${kapal} sebagai TERKIRIM?\n\nSetelah ini isinya dikunci (tak bisa berubah tanpa membuka kunci lagi).`)) return;
    await simpanDoc({ ...kerja, status: "terkirim", dikirimPada: new Date().toISOString() });
  };
  const hapusDoc = async () => {
    if (!kerja || !tersimpan) return;
    if (!confirm(`Hapus ${tipe} ${namaBulan(bulan)} — ${kapal}?\n\nSeluruh itemnya ikut terhapus dan tak bisa dikembalikan.`)) return;
    setSibuk(true);
    try {
      await hapus(kerja.id);
      setKerja(docBaru(tipe, bulan, kapal));
      setBerubah(false);
      setPesan("Dokumen dihapus.");
      setTimeout(() => setPesan(""), 2500);
    } finally { setSibuk(false); }
  };

  const bukaKunci = async () => {
    if (!kerja) return;
    if (!confirm("Buka kunci untuk revisi?\n\nDokumen ini sudah ditandai terkirim ke pusat. Perubahan setelah ini perlu dilaporkan ulang.")) return;
    await simpanDoc({ ...kerja, status: "draf" });
  };

  /**
   * Tarik realisasi dari pengadaan yang SUDAH tercatat (SPPBJ + Non PR PO ber-jenis Rutin)
   * pada bulan & kapal ini. Item multi-kapal dibagi rata supaya totalnya tetap pas.
   * Item Akomodasi/Permesinan masuk ke kelompok "Lain-Lain" karena sub-kelompoknya tak bisa
   * ditebak dari dokumen — tinggal dipindahkan lewat tombol ⇄ pada barisnya.
   */
  const tarikDariPengadaan = () => {
    const sasaran = (kode: string) => {
      const sub = KELOMPOK_RR.filter((k) => k.kode === kode);
      if (!sub.length) return "";
      const lain = sub.find((k) => /lain/i.test(k.judul));
      return kunciKelompok(lain || sub[0]);
    };
    const kumpul: Record<string, RrItem[]> = {};
    let n = 0, diabaikan = 0;
    for (const p of pengadaan) {
      if (p.jenis !== "rutin") continue;
      if ((p.tanggal || "").slice(0, 7) !== bulan) continue;
      const arr: any[] = p.items || [];
      const adaFinal = arr.some((it) => (it.hargaSpbj || 0) > 0);
      const maDefault = (p.mataAnggaran || [])[0] || "";
      for (const it of arr) {
        const kapals = pecahKapal(it.kapal || "").map(namaKapalPenuh);
        if (!kapals.includes(kapal)) continue;
        const bagi = kapals.length || 1;
        const harga = (adaFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0)) / bagi;
        if (!harga) continue;
        const kode = maKey((it.mataAnggaran || "").trim() || maDefault);
        const kunci = sasaran(kode);
        if (!kunci) { diabaikan++; continue; }
        (kumpul[kunci] ||= []).push({
          id: uid(), deskripsi: it.nama || "(tanpa nama)",
          spesifikasi: [it.spesifikasi, `${p.sumber} ${p.nama}`].filter(Boolean).join(" · "),
          jumlah: it.jumlah || 0, satuan: it.satuan || "", harga: Math.round(harga),
        });
        n++;
      }
    }
    if (!n) { setPesan(`Tidak ada pengadaan Rutin ${namaBulan(bulan)} untuk ${kapal}.`); setTimeout(() => setPesan(""), 4000); return; }
    ubah((d) => {
      for (const [kunci, items] of Object.entries(kumpul)) {
        const g = d.kelompok.find((x) => x.kunci === kunci);
        if (g) g.items = [...g.items.filter((i) => i.deskripsi || i.harga), ...items];
        else d.kelompok.push({ kunci, items });
      }
    });
    setPesan(`${n} item ditarik dari SPPBJ / Non PR PO${diabaikan ? ` · ${diabaikan} item Mata Anggarannya di luar daftar Lampiran 3` : ""}. Periksa penempatan kelompoknya, lalu simpan.`);
    setTimeout(() => setPesan(""), 9000);
  };

  /** salin isi dari dokumen lain (bulan lalu / rencana bulan yang sama) */
  const salinDari = (sumber?: RrDoc) => {
    if (!sumber) { setPesan("Sumber salinan belum ada isinya."); setTimeout(() => setPesan(""), 3000); return; }
    ubah((d) => {
      d.kelompok = KELOMPOK_RR.map((k) => {
        const kunci = kunciKelompok(k);
        const asal = (sumber.kelompok || []).find((x) => x.kunci === kunci);
        return { kunci, items: (asal?.items || []).map((i) => ({ ...i, id: uid() })) };
      });
      d.ppnPersen = sumber.ppnPersen || 0;
    });
  };

  const t = kerja ? totalDoc(kerja) : { dasar: 0, ppn: 0, total: 0 };
  const nada = NADA[tipe];
  const tenggat = bulan && now ? statusTenggat(tenggatDoc(tipe, bulan), now) : null;

  // status pengisian tiap kapal (untuk deretan chip)
  const statusKapal = (k: string) => {
    const d = dok.find((x) => x.tipe === tipe && x.bulan === bulan && x.kapal === k);
    if (!d) return "kosong";
    if (d.status === "terkirim") return "terkirim";
    return totalDoc(d).total > 0 ? "draf" : "kosong";
  };
  const jumlahTerkirim = KAPAL_ANGGARAN.filter((k) => statusKapal(k) === "terkirim").length;
  const jumlahDraf = KAPAL_ANGGARAN.filter((k) => statusKapal(k) === "draf").length;

  const [xlsSibuk, setXlsSibuk] = useState(false);
  const unduhExcel = async () => {
    setXlsSibuk(true);
    try {
      const { exportRrExcel } = await import("@/lib/rr/export");
      await exportRrExcel({ bulanRencana: bulan, bulanRealisasi: bulanKe(bulan, -1), dok });
    } catch (e: any) {
      setPesan(`Gagal export: ${e?.message || e}`);
    } finally { setXlsSibuk(false); }
  };

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      {/* ================= kepala ================= */}
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex flex-wrap items-center gap-4">
          <div className="h-12 w-12 rounded-2xl asdp-gradient grid place-items-center text-2xl text-white shadow-md shrink-0">📆</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold asdp-text-gradient tracking-tight">Rencana &amp; Realisasi Perawatan</h1>
            <p className="text-slate-500 text-sm">Lampiran 3 · usulan program perawatan bulanan per kapal &amp; realisasinya</p>
          </div>
          <button onClick={unduhExcel} disabled={xlsSibuk || !bulan} className="btn btn-success text-xs disabled:opacity-50"
            title="Unduh berkas Lampiran 3: rekap Budget Control Rutin + lembar USL & REAL tiap kapal">
            {xlsSibuk ? "menyiapkan…" : "📊 Export Excel (Lampiran 3)"}
          </button>
          <button onClick={reload} className="btn btn-ghost text-xs">↻ Muat ulang</button>
        </div>
      </div>

      {/* ================= papan tenggat ================= */}
      {now && periode && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PapanTenggat
            judul={`Rencana ${periode.label}`}
            sub="Budget rutin dirilis per 2 bulan · input rencana paling lambat tanggal 22 bulan sebelumnya"
            status={statusTenggat(periode.tenggat, now)}
            aktif={tipe === "rencana"}
            onKlik={() => { setTipe("rencana"); setBulan(periode.mulai); }}
          />
          <PapanTenggat
            judul={`Realisasi ${namaBulan(bulanReal)}`}
            sub="Realisasi satu bulan paling lambat diinput tanggal 1 bulan berikutnya"
            status={statusTenggat(tenggatDoc("realisasi", bulanReal), now)}
            aktif={tipe === "realisasi"}
            onKlik={() => { setTipe("realisasi"); setBulan(bulanReal); }}
          />
        </div>
      )}

      {!ready && (
        <p className="mt-5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
          Butuh Supabase (env) supaya data tersimpan dan bisa dibuka dari perangkat lain.
        </p>
      )}

      {/* ================= pemilih ================= */}
      <div className={`mt-4 bg-white rounded-2xl elev-md ring-line p-4 anim-in`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg overflow-hidden ring-1 ring-slate-200">
            {(["rencana", "realisasi"] as const).map((x) => (
              <button key={x} onClick={() => setTipe(x)}
                className={`text-xs px-4 py-1.5 font-semibold capitalize ${tipe === x ? `text-white bg-gradient-to-r ${NADA[x].grad}` : "bg-white text-slate-600"}`}>
                {x === "rencana" ? "📝 Rencana" : "✅ Realisasi"}
              </button>
            ))}
          </div>
          <input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 font-semibold" />
          {tipe === "rencana" && bulan && (
            <span className="text-[11px] text-slate-500">
              periode rilis <b className="text-slate-700">{periodeDari(bulan).label}</b>
            </span>
          )}
          <span className="ml-auto text-[11px] text-slate-500">
            {jumlahTerkirim} terkirim · {jumlahDraf} draf · {KAPAL_ANGGARAN.length - jumlahTerkirim - jumlahDraf} belum diisi
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {KAPAL_ANGGARAN.map((k) => {
            const st = statusKapal(k);
            const aktif = k === kapal;
            return (
              <button key={k} onClick={() => setKapal(k)}
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1 ${
                  aktif ? `text-white border-transparent bg-gradient-to-r ${nada.grad}`
                        : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"}`}>
                {k.replace("KMP. ", "")}
                <span className={aktif ? "opacity-90" : ""}>
                  {st === "terkirim" ? "🔒" : st === "draf" ? "•" : ""}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-400 mt-2">🔒 = sudah ditandai terkirim (terkunci) · • = draf tersimpan</p>
      </div>

      {/* ================= editor ================= */}
      {kerja && bulan && (
        <div className={`mt-4 bg-white rounded-2xl elev-md ring-1 ${nada.ring} anim-in`}>
          <div className={`px-5 py-3 rounded-t-2xl ${nada.bg} flex flex-wrap items-center gap-3`}>
            <div>
              <h2 className={`font-extrabold ${nada.teks}`}>
                {tipe === "rencana" ? "Usulan Program Perawatan" : "Realisasi Perawatan"} — {kapal}
              </h2>
              <p className="text-[11px] text-slate-600">
                {namaBulan(bulan)}
                {tenggat && <> · <span className={tenggat.tingkat === "lewat" ? "text-rose-700 font-bold" : "text-slate-600"}>{tenggat.teks}</span></>}
                {kerja.dikirimPada && <> · dikirim {new Date(kerja.dikirimPada).toLocaleString("id-ID")}</>}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!terkunci ? (
                <>
                  <button onClick={() => salinDari(dok.find((x) => x.tipe === tipe && x.bulan === bulanKe(bulan, -1) && x.kapal === kapal))}
                    className="btn btn-ghost text-xs" title={`Salin isi ${tipe} ${namaBulan(bulanKe(bulan, -1))} kapal ini`}>
                    ⧉ Salin bulan lalu
                  </button>
                  {tipe === "realisasi" && (
                    <>
                      <button onClick={() => salinDari(dok.find((x) => x.tipe === "rencana" && x.bulan === bulan && x.kapal === kapal))}
                        className="btn btn-ghost text-xs" title="Salin dari rencana bulan ini, lalu sesuaikan yang benar-benar terpakai">
                        ⧉ Salin dari rencana
                      </button>
                      <button onClick={tarikDariPengadaan} className="btn btn-ghost text-xs"
                        title="Isi otomatis dari SPPBJ & Non PR PO Rutin bulan ini untuk kapal ini — angkanya dari dokumen yang benar-benar ada">
                        ⚡ Tarik dari SPPBJ / Non PR PO
                      </button>
                    </>
                  )}
                  <button onClick={() => simpanDoc()} disabled={sibuk || (!berubah && !!tersimpan)} className="btn btn-primary text-xs disabled:opacity-50">
                    {sibuk ? "…" : !tersimpan ? "💾 Simpan" : berubah ? "💾 Simpan perubahan" : "✓ Tersimpan"}
                  </button>
                  <button onClick={tandaiTerkirim} disabled={sibuk || t.total <= 0} className="btn btn-success text-xs disabled:opacity-40"
                    title={t.total <= 0 ? "Isi dulu itemnya" : "Kunci dokumen ini sebagai sudah dikirim ke pusat"}>
                    🔒 Tandai terkirim
                  </button>
                  {tersimpan && (
                    <button onClick={hapusDoc} disabled={sibuk} className="btn btn-danger-soft text-xs"
                      title="Hapus dokumen ini (salah bulan / salah kapal)">🗑️ Hapus</button>
                  )}
                </>
              ) : (
                <>
                  <span className="chip bg-emerald-100 text-emerald-800">TERKIRIM · terkunci</span>
                  <button onClick={bukaKunci} className="btn btn-ghost text-xs">🔓 Buka kunci (revisi)</button>
                </>
              )}
            </div>
          </div>

          {pesan && <p className="px-5 pt-3 text-xs font-semibold text-slate-600">{pesan}</p>}
          {simpanErr && <p className="px-5 pt-3 text-xs font-semibold text-rose-700">Supabase: {simpanErr}</p>}
          {tenggat?.tingkat === "lewat" && !terkunci && (
            <p className="mx-5 mt-3 text-xs bg-rose-50 text-rose-800 ring-1 ring-rose-200 rounded-lg px-3 py-2">
              Sudah lewat tenggat ({tenggat.teks}). Isi tetap bisa disimpan, tapi laporkan keterlambatannya ke pusat.
            </p>
          )}

          <div className="p-5 pt-4 space-y-3">
            {MA_RR.map((ma) => {
              const kelompokMA = KELOMPOK_RR.filter((k) => k.kode === ma.kode);
              const totalMA = kelompokMA.reduce((s, k) => {
                const g = kerja.kelompok.find((x) => x.kunci === kunciKelompok(k));
                return s + (g ? totalKelompok(g) : 0);
              }, 0);
              return (
                <div key={ma.kode} className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 flex items-center gap-2">
                    <span className="text-[11px] font-extrabold text-slate-700">{ma.ma}</span>
                    <span className="ml-auto text-xs font-bold text-slate-800">{totalMA ? rupiah(totalMA) : "—"}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {kelompokMA.map((k) => (
                      <Kelompok key={kunciKelompok(k)} judul={k.judul} terkunci={terkunci}
                        items={kerja.kelompok.find((x) => x.kunci === kunciKelompok(k))?.items || []}
                        tetangga={kelompokMA.filter((x) => x.judul !== k.judul).map((x) => ({ kunci: kunciKelompok(x), judul: x.judul }))}
                        onPindah={(itemId, tujuan) => ubah((d) => {
                          const asal = d.kelompok.find((x) => x.kunci === kunciKelompok(k));
                          const it = asal?.items.find((i) => i.id === itemId);
                          if (!asal || !it) return;
                          asal.items = asal.items.filter((i) => i.id !== itemId);
                          const g = d.kelompok.find((x) => x.kunci === tujuan);
                          if (g) g.items.push(it);
                          else d.kelompok.push({ kunci: tujuan, items: [it] });
                        })}
                        onUbah={(items) => ubah((d) => {
                          const g = d.kelompok.find((x) => x.kunci === kunciKelompok(k));
                          if (g) g.items = items;
                          else d.kelompok.push({ kunci: kunciKelompok(k), items });
                        })} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 pb-5 flex flex-wrap items-center gap-3">
            <label className="text-[11px] text-slate-600 flex items-center gap-1.5">
              PPN
              <select value={kerja.ppnPersen} disabled={terkunci}
                onChange={(e) => ubah((d) => { d.ppnPersen = +e.target.value; })}
                className="text-xs border border-slate-300 rounded px-1.5 py-1">
                <option value={0}>0%</option>
                <option value={11}>11%</option>
                <option value={12}>12%</option>
              </select>
            </label>
            <input value={kerja.catatan || ""} disabled={terkunci} placeholder="Catatan (opsional)"
              onChange={(e) => ubah((d) => { d.catatan = e.target.value; })}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 flex-1 min-w-[200px]" />
            <div className="ml-auto text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total {tipe}</p>
              <p className="text-xl font-extrabold text-slate-800 tabular-nums">{rupiah(t.total)}</p>
              {kerja.ppnPersen > 0 && <p className="text-[10px] text-slate-500">dasar {rupiah(t.dasar)} + PPN {rupiah(t.ppn)}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ================= rekap semua kapal ================= */}
      <Rekap dok={dok} bulan={bulan} tipe={tipe} />

      {loading && <p className="mt-4 text-xs text-slate-400">memuat…</p>}
    </main>
  );
}

/* ---------------- papan tenggat ---------------- */
function PapanTenggat({ judul, sub, status, aktif, onKlik }: {
  judul: string; sub: string; status: ReturnType<typeof statusTenggat>; aktif: boolean; onKlik: () => void;
}) {
  return (
    <button onClick={onKlik}
      className={`text-left rounded-2xl px-4 py-3 ring-1 transition ${WARNA_TENGGAT[status.tingkat]} ${aktif ? "ring-2" : "hover:brightness-95"}`}>
      <div className="flex items-center gap-2">
        <p className="font-extrabold text-sm">{judul}</p>
        <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/70">
          {status.tingkat === "lewat" ? "LEWAT" : status.sisaHari <= 1 ? "HARI INI" : `H-${status.sisaHari}`}
        </span>
      </div>
      <p className="text-[11px] font-semibold mt-0.5">{status.teks}</p>
      <p className="text-[10px] opacity-70 mt-1 leading-snug">{sub}</p>
    </button>
  );
}

/* ---------------- satu kelompok kebutuhan ---------------- */
function Kelompok({ judul, items, terkunci, onUbah, tetangga = [], onPindah }: {
  judul: string; items: RrItem[]; terkunci: boolean; onUbah: (i: RrItem[]) => void;
  tetangga?: { kunci: string; judul: string }[];
  onPindah?: (itemId: string, tujuan: string) => void;
}) {
  // null = ikuti isinya (kelompok berisi otomatis terbuka, termasuk saat data baru tiba)
  const [bukaManual, setBukaManual] = useState<boolean | null>(null);
  const buka = bukaManual ?? items.length > 0;
  const setBuka = (v: boolean) => setBukaManual(v);
  const total = items.reduce((s, i) => s + nilaiItem(i), 0);

  const set = (id: string, f: (i: RrItem) => void) => {
    const next = items.map((i) => { if (i.id !== id) return i; const s = { ...i }; f(s); return s; });
    onUbah(next);
  };
  const tambah = () => { onUbah([...items, barisKosong()]); setBuka(true); };
  const buang = (id: string) => onUbah(items.filter((i) => i.id !== id));

  /** tempel dari Excel: Deskripsi | Spesifikasi | Jumlah | Satuan | Harga */
  const tempel = (teks: string) => {
    const baris = teks.split(/\r?\n/).map((b) => b.split("\t")).filter((k) => k.some((x) => x.trim()));
    if (!baris.length) return;
    const angka = (s: string) => Number((s || "").replace(/[^\d,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")) || 0;
    const baru: RrItem[] = baris.map((k) => ({
      id: uid(), deskripsi: (k[0] || "").trim(), spesifikasi: (k[1] || "").trim(),
      jumlah: angka(k[2] || ""), satuan: (k[3] || "").trim(), harga: angka(k[4] || ""),
    }));
    onUbah([...items.filter((i) => i.deskripsi || i.harga), ...baru]);
    setBuka(true);
  };

  return (
    <div>
      <div className="px-3 py-1.5 flex items-center gap-2 bg-white">
        <button onClick={() => setBuka(!buka)} className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
          <span className="text-slate-400">{buka ? "▾" : "▸"}</span> {judul}
        </button>
        <span className="text-[10px] text-slate-400">{items.length ? `${items.length} item` : "kosong"}</span>
        <span className="ml-auto text-[11px] font-bold text-slate-700 tabular-nums">{total ? rupiah(total) : ""}</span>
        {!terkunci && <button onClick={tambah} className="text-[11px] font-bold text-blue-700 hover:underline">+ baris</button>}
      </div>

      {buka && (
        <div className="px-3 pb-3">
          {items.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-1">
              Belum ada item. <button onClick={tambah} className="text-blue-700 font-semibold hover:underline">Tambah baris</button>
              {!terkunci && <> atau tempel dari Excel di kotak bawah.</>}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">
                    <th className="text-left p-1 w-[30%]">Deskripsi</th>
                    <th className="text-left p-1 w-[26%]">Spesifikasi</th>
                    <th className="text-right p-1 w-14">Jml</th>
                    <th className="text-left p-1 w-16">Satuan</th>
                    <th className="text-right p-1 w-28">Harga Satuan</th>
                    <th className="text-right p-1 w-28">Total</th>
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-t border-slate-100">
                      <td className="p-1">
                        <input value={i.deskripsi} disabled={terkunci} onChange={(e) => set(i.id, (x) => { x.deskripsi = e.target.value; })}
                          className="w-full border border-slate-200 rounded px-1.5 py-1" placeholder="nama barang / jasa" />
                      </td>
                      <td className="p-1">
                        <input value={i.spesifikasi} disabled={terkunci} onChange={(e) => set(i.id, (x) => { x.spesifikasi = e.target.value; })}
                          className="w-full border border-slate-200 rounded px-1.5 py-1" />
                      </td>
                      <td className="p-1">
                        <input type="number" value={i.jumlah || ""} disabled={terkunci} onChange={(e) => set(i.id, (x) => { x.jumlah = +e.target.value; })}
                          className="w-full text-right border border-slate-200 rounded px-1.5 py-1" />
                      </td>
                      <td className="p-1">
                        <input value={i.satuan} disabled={terkunci} onChange={(e) => set(i.id, (x) => { x.satuan = e.target.value; })}
                          className="w-full border border-slate-200 rounded px-1.5 py-1" placeholder="Pcs" />
                      </td>
                      <td className="p-1">
                        <input type="number" value={i.harga || ""} disabled={terkunci} onChange={(e) => set(i.id, (x) => { x.harga = +e.target.value; })}
                          className="w-full text-right border border-slate-200 rounded px-1.5 py-1" />
                      </td>
                      <td className="p-1 text-right font-bold text-slate-700 tabular-nums">{nilaiItem(i) ? rupiah(nilaiItem(i)) : "—"}</td>
                      <td className="p-1 text-center whitespace-nowrap">
                        {!terkunci && tetangga.length > 0 && onPindah && (
                          <select value="" onChange={(e) => { if (e.target.value) onPindah(i.id, e.target.value); }}
                            title="Pindahkan baris ini ke kelompok lain dalam Mata Anggaran yang sama"
                            className="text-[10px] border border-slate-200 rounded w-6 mr-0.5 text-slate-500">
                            <option value="">⇄</option>
                            {tetangga.map((t) => <option key={t.kunci} value={t.kunci}>{t.judul}</option>)}
                          </select>
                        )}
                        {!terkunci && <button onClick={() => buang(i.id)} className="text-rose-500 hover:text-rose-700" title="Hapus baris">✕</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!terkunci && (
            <textarea rows={1} placeholder="Tempel dari Excel: Deskripsi ⇥ Spesifikasi ⇥ Jumlah ⇥ Satuan ⇥ Harga Satuan"
              onPaste={(e) => { e.preventDefault(); tempel(e.clipboardData.getData("text")); }}
              onChange={() => {}}
              value=""
              className="mt-2 w-full text-[10px] border border-dashed border-slate-300 rounded px-2 py-1 text-slate-500" />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- rekap semua kapal (Budget Control Rutin) ---------------- */
function Rekap({ dok, bulan, tipe }: { dok: RrDoc[]; bulan: string; tipe: TipeRR }) {
  const baris = useMemo(() => KAPAL_ANGGARAN.map((k) => {
    const d = dok.find((x) => x.tipe === tipe && x.bulan === bulan && x.kapal === k);
    const per = d ? totalPerMA(d) : {};
    const total = d ? totalDoc(d).total : 0;
    return { kapal: k, per, total, status: d?.status, ada: !!d };
  }), [dok, bulan, tipe]);
  const totalSemua = baris.reduce((s, b) => s + b.total, 0);
  if (!bulan) return null;

  return (
    <div className="mt-4 bg-white rounded-2xl elev-md ring-line p-5 anim-in">
      <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-lg asdp-gradient text-white grid place-items-center text-sm">📋</span>
        <span className="accent-bar">Rekap {tipe} {namaBulan(bulan)} — semua kapal</span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-slate-600 font-bold bg-slate-100">
            <tr>
              <th className="p-2 text-left">Kapal</th>
              {MA_RR.map((m) => <th key={m.kode} className="p-2 text-right whitespace-nowrap">{m.kode}</th>)}
              <th className="p-2 text-right">Total</th>
              <th className="p-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.kapal} className="border-b border-slate-100 last:border-0">
                <td className="p-2 font-semibold text-slate-700 whitespace-nowrap">{b.kapal}</td>
                {MA_RR.map((m) => (
                  <td key={m.kode} className="p-2 text-right tabular-nums text-slate-600">
                    {b.per[m.kode] ? rupiah(b.per[m.kode]) : "–"}
                  </td>
                ))}
                <td className="p-2 text-right font-bold text-slate-800 tabular-nums">{b.total ? rupiah(b.total) : "–"}</td>
                <td className="p-2 text-center">
                  {b.status === "terkirim" ? <span className="chip bg-emerald-100 text-emerald-700">terkirim</span>
                    : b.ada ? <span className="chip bg-amber-100 text-amber-700">draf</span>
                    : <span className="chip bg-slate-100 text-slate-500">belum</span>}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-extrabold">
              <td className="p-2 text-slate-800">TOTAL</td>
              {MA_RR.map((m) => (
                <td key={m.kode} className="p-2 text-right tabular-nums text-slate-800">
                  {rupiah(baris.reduce((s, b) => s + (b.per[m.kode] || 0), 0))}
                </td>
              ))}
              <td className="p-2 text-right text-slate-900 tabular-nums">{rupiah(totalSemua)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
