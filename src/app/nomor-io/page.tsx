"use client";
/**
 * Permintaan Nomor IO & Nomor Aset — investasi armada.
 *
 * Borang aslinya satu berkas Excel per bulan. Yang tidak bisa dijawab berkas
 * seperti itu adalah pertanyaan yang justru paling sering ditanyakan: nomor IO
 * mana yang belum turun, dan sudah berapa lama menunggu. Jawabannya menuntut
 * membuka berkas bulan lalu, bulan sebelumnya, lalu membandingkan dengan mata.
 *
 * Karena itu halaman ini punya dua muka. "Bulan ini" untuk mengisi — barisnya
 * disunting langsung di tempat, tanpa borang terpisah. "Semua periode" untuk
 * menagih — seluruh bulan sekaligus, disaring menurut tahap, kapal, atau kata.
 *
 * Kolomnya sengaja sama persis dengan borang resmi, supaya ekspornya bisa
 * dikirim tanpa disusun ulang.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import {
  ASSET_CLASS, ASSET_SERING, BarisIO, NADA_TAHAP, PeriodeIO, SATUAN_IO,
  barisKosong, hitungBaris, labelAsset, namaPeriode, periodeSekarang, rupiah, tahapIO,
} from "@/lib/io/types";

const pendek = (k: string) => k.replace(/^KMP\.?\s*/i, "");
const angka = (v: string) => Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0;
/* "22200000" -> "22.200.000" untuk dibaca, tanpa mengubah yang tersimpan */
const bacaAngka = (v: string) => (v === "" ? "" : angka(v).toLocaleString("id-ID"));

export default function NomorIoPage() {
  const [periodeAll, setPeriodeAll] = useState<PeriodeIO[]>([]);
  const [periode, setPeriode] = useState(periodeSekarang());
  const [baris, setBaris] = useState<BarisIO[]>([]);
  const [muat, setMuat] = useState(true);
  const [simpan, setSimpan] = useState(false);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");
  const [kotor, setKotor] = useState(false);
  const [rupa, setRupa] = useState<"isi" | "semua">("isi");
  const [unduh, setUnduh] = useState(false);

  const [cari, setCari] = useState("");
  const [sarKapal, setSarKapal] = useState("");
  const [sarTahap, setSarTahap] = useState("");

  const ambil = useCallback(async () => {
    setMuat(true); setGalat("");
    try {
      const r = await fetch("/api/nomor-io", { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal memuat");
      setPeriodeAll(d.periode || []);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);

  useEffect(() => { void ambil(); }, [ambil]);

  /*
   * Berpindah bulan memuat isinya dari hasil yang sudah ada di layar. Suntingan
   * yang belum disimpan sengaja TIDAK dibawa pindah — kalau dibawa, baris milik
   * September bisa ikut tersimpan ke Oktober tanpa ada yang menyadarinya.
   */
  useEffect(() => {
    if (muat) return;
    const p = periodeAll.find((x) => x.periode === periode);
    setBaris(p ? p.baris.map((b) => ({ ...b })) : []);
    setKotor(false);
  }, [periode, periodeAll, muat]);

  const daftarPeriode = useMemo(() => {
    const ada = periodeAll.map((p) => p.periode);
    return Array.from(new Set([periodeSekarang(), periode, ...ada])).sort((a, b) => b.localeCompare(a));
  }, [periodeAll, periode]);

  const ubah = (id: string, tambal: Partial<BarisIO>) => {
    setBaris((p) => p.map((b) => (b.id === id ? { ...b, ...tambal } : b)));
    setKotor(true);
  };
  const hapus = (id: string) => {
    const b = baris.find((x) => x.id === id);
    if (b && (b.deskripsi || b.hargaSatuan) && !window.confirm(`Hapus baris "${b.deskripsi || "tanpa deskripsi"}"?`)) return;
    setBaris((p) => p.filter((x) => x.id !== id));
    setKotor(true);
  };
  const tambah = (kapal: string) => {
    setBaris((p) => [...p, barisKosong(kapal)]);
    setKotor(true);
  };
  /* menyalin baris lebih sering dipakai daripada mengetik dari nol: satu kapal
     biasanya meminta beberapa barang sejenis dengan spesifikasi berbeda tipis */
  const salin = (b: BarisIO) => {
    setBaris((p) => {
      const i = p.findIndex((x) => x.id === b.id);
      const baru = { ...barisKosong(b.kapal), ...b, id: barisKosong(b.kapal).id, noIoSap: "", noAsetSap: "" };
      return [...p.slice(0, i + 1), baru, ...p.slice(i + 1)];
    });
    setKotor(true);
  };

  const simpanPeriode = async () => {
    setSimpan(true); setGalat("");
    try {
      const r = await fetch("/api/nomor-io", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periode, baris }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal menyimpan");
      setKotor(false);
      setKabar(`Tersimpan ${new Date().toLocaleTimeString("id-ID")}`);
      window.setTimeout(() => setKabar(""), 4000);
      setPeriodeAll((p) => {
        const lain = p.filter((x) => x.periode !== periode);
        return [...lain, { periode, baris, diperbaruiPada: d.diperbaruiPada }]
          .sort((a, b) => b.periode.localeCompare(a.periode));
      });
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setSimpan(false); }
  };

  /* peringatan menutup tab selagi ada suntingan yang belum tersimpan */
  useEffect(() => {
    if (!kotor) return;
    const jaga = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", jaga);
    return () => window.removeEventListener("beforeunload", jaga);
  }, [kotor]);

  const unduhExcel = async (p: string, isi: BarisIO[]) => {
    setUnduh(true);
    try {
      const r = await fetch("/api/nomor-io/excel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periode: p, baris: isi }),
      });
      if (!r.ok) throw new Error("Gagal menyusun berkas");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PERMINTAAN NOMOR IO TERNATE ${namaPeriode(p).toUpperCase()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setUnduh(false); }
  };

  /* ── angka ringkas bulan berjalan ───────────────────────────────────── */
  const ringkas = useMemo(() => {
    const nilai = baris.reduce((n, b) => n + hitungBaris(b).grand, 0);
    return {
      item: baris.length,
      kapal: new Set(baris.map((b) => b.kapal)).size,
      nilai,
      menunggu: baris.filter((b) => tahapIO(b) === "menunggu").length,
    };
  }, [baris]);

  /* ── seluruh periode, sudah disaring ────────────────────────────────── */
  const semua = useMemo(() => {
    const k = cari.trim().toLowerCase();
    return periodeAll
      .flatMap((p) => p.baris.map((b) => ({ ...b, periode: p.periode })))
      /* Syaratnya NOMOR IO-nya ada, bukan sekadar "bukan menunggu": satu usulan
         yang nomor asetnya sudah terisi lebih dulu akan lolos oleh tahapnya
         padahal nomor IO-nya belum turun. */
      .filter((b) => !!String(b.noIoSap || "").trim())
      .filter((b) => !sarKapal || b.kapal === sarKapal)
      .filter((b) => !sarTahap || tahapIO(b) === sarTahap)
      .filter((b) => !k || `${b.deskripsi} ${b.spesifikasi} ${b.kapal} ${b.noIoSap} ${b.noAsetSap} ${b.assetClass} ${labelAsset(b.assetClass)}`.toLowerCase().includes(k))
      .sort((a, b) => b.periode.localeCompare(a.periode) || a.kapal.localeCompare(b.kapal));
  }, [periodeAll, cari, sarKapal, sarTahap]);

  const ringkasSemua = useMemo(() => ({
    item: semua.length,
    /* satu nomor bisa tertulis pada dua baris kalau di borangnya salah tempel;
       yang dihitung sebagai "nomor" tetap nomornya, bukan barisnya */
    nomor: new Set(semua.map((b) => b.noIoSap.trim())).size,
    nilai: semua.reduce((n, b) => n + hitungBaris(b).grand, 0),
    /* aset darat tercatat tanpa kapal; kalau ikut dihitung, jumlahnya bisa
       melampaui banyaknya kapal dan kartunya jadi "14/13" */
    kapal: new Set(semua.map((b) => b.kapal).filter(Boolean)).size,
    selesai: semua.filter((b) => tahapIO(b) === "ada-aset").length,
  }), [semua]);

  /* kapal yang punya baris di bulan ini, urut sesuai daftar armada */
  const kapalIsi = useMemo(
    () => KAPAL_ANGGARAN.filter((k) => baris.some((b) => b.kapal === k)),
    [baris]);

  return (
    <main className="mx-auto max-w-[110rem] px-4 py-6">
      <header className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#16357f] text-xl text-white">🧾</span>
          <div className="min-w-[17rem] flex-1">
            <Link href="/dashboard" className="text-[11px] text-slate-400 hover:text-[#16357f]">‹ Dashboard</Link>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Nomor IO Investasi</h1>
            <p className="text-[11.5px] text-slate-500">
              Nomor IO &amp; nomor aset SAP belanja investasi kapal. <b>Semua periode</b> memuat nomor
              yang sudah terbit; usulan yang nomornya belum turun ada di <b>Bulan ini</b>.
            </p>
          </div>

          <div className="flex overflow-hidden rounded-xl ring-1 ring-slate-300 dark:ring-slate-700">
            {([["isi", "Bulan ini"], ["semua", "Semua periode"]] as const).map(([id, l]) => (
              <button key={id} onClick={() => setRupa(id)}
                className={`px-3.5 py-2 text-[12px] font-bold transition ${
                  rupa === id ? "bg-[#16357f] text-white" : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300"}`}>
                {l}
              </button>
            ))}
          </div>

          {rupa === "isi" && (
            <>
              <select value={periode} onChange={(e) => {
                if (kotor && !window.confirm("Ada suntingan yang belum disimpan. Pindah bulan dan buang perubahannya?")) return;
                setPeriode(e.target.value);
              }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12.5px] font-bold outline-none focus:border-[#16357f] dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                {daftarPeriode.map((p) => <option key={p} value={p}>{namaPeriode(p)}</option>)}
              </select>
              <button onClick={simpanPeriode} disabled={simpan || !kotor}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-40">
                {simpan ? "Menyimpan…" : kotor ? "💾 Simpan" : "Tersimpan"}
              </button>
            </>
          )}
          <button onClick={() => unduhExcel(rupa === "isi" ? periode : "semua-periode", rupa === "isi" ? baris : semua)}
            disabled={unduh || !(rupa === "isi" ? baris.length : semua.length)}
            className="rounded-xl bg-[#16357f] px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#12296a] disabled:opacity-40">
            {unduh ? "Menyusun…" : "⬇️ Excel"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {(rupa === "isi"
            ? [
              ["Item permintaan", String(ringkas.item), "text-[#16357f]"],
              ["Kapal terisi", `${ringkas.kapal}/${KAPAL_ANGGARAN.length}`, "text-slate-700 dark:text-slate-200"],
              ["Nilai (grand total)", rupiah(ringkas.nilai), "text-emerald-700"],
              ["Menunggu nomor IO", String(ringkas.menunggu), "text-amber-700"],
            ]
            : [
              ["Nomor IO terbit", String(ringkasSemua.nomor), "text-[#16357f]"],
              ["Nilai tersaring", rupiah(ringkasSemua.nilai), "text-emerald-700"],
              ["Kapal terwakili", `${ringkasSemua.kapal}/${KAPAL_ANGGARAN.length}`, "text-slate-700 dark:text-slate-200"],
              ["Nomor aset terbit", String(ringkasSemua.selesai), "text-sky-700"],
            ]).map(([l, n, w]) => (
            <div key={l} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700">
              <p className={`truncate text-[19px] font-black tabular-nums ${w}`} title={n}>{n}</p>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">{l}</p>
            </div>
          ))}
        </div>
      </header>

      {galat && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-800 ring-1 ring-rose-200">{galat}</p>}
      {kabar && <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800 ring-1 ring-emerald-200">{kabar}</p>}
      {kotor && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-900 ring-1 ring-amber-200">Ada perubahan yang belum disimpan.</p>}

      {muat ? (
        <p className="rounded-2xl bg-white px-4 py-12 text-center text-[13px] text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900">Memuat…</p>
      ) : rupa === "isi" ? (
        <IsiBulan
          periode={periode} baris={baris} kapalIsi={kapalIsi}
          onUbah={ubah} onHapus={hapus} onTambah={tambah} onSalin={salin}
        />
      ) : (
        <SemuaPeriode
          data={semua} cari={cari} setCari={setCari}
          sarKapal={sarKapal} setSarKapal={setSarKapal}
          sarTahap={sarTahap} setSarTahap={setSarTahap}
          onBuka={(p) => { setPeriode(p); setRupa("isi"); }}
        />
      )}
    </main>
  );
}

/* ─────────────────────────── pengisian bulan ─────────────────────────── */

function IsiBulan({ periode, baris, kapalIsi, onUbah, onHapus, onTambah, onSalin }: {
  periode: string; baris: BarisIO[]; kapalIsi: string[];
  onUbah: (id: string, t: Partial<BarisIO>) => void;
  onHapus: (id: string) => void;
  onTambah: (kapal: string) => void;
  onSalin: (b: BarisIO) => void;
}) {
  const [kapalBaru, setKapalBaru] = useState(KAPAL_ANGGARAN[0]);

  return (
    <div className="space-y-3">
      {/* penambah kapal */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <span className="text-[11.5px] font-bold uppercase tracking-wide text-slate-500">Tambah permintaan untuk</span>
        <select value={kapalBaru} onChange={(e) => setKapalBaru(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12.5px] font-semibold outline-none focus:border-[#16357f] dark:border-slate-600 dark:bg-slate-800 dark:text-white">
          {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <button onClick={() => onTambah(kapalBaru)}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-emerald-700">
          + Baris baru
        </button>
        <span className="text-[11.5px] text-slate-500">{namaPeriode(periode)}</span>
      </div>

      {!baris.length ? (
        <div className="rounded-2xl bg-white px-4 py-14 text-center ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <p className="text-3xl">🧾</p>
          <p className="mt-2 text-[14px] font-bold text-slate-700 dark:text-slate-200">Belum ada permintaan untuk {namaPeriode(periode)}.</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
            Pilih kapalnya di atas lalu tambahkan barisnya. Kolomnya sama dengan borang resmi,
            jadi hasil unduhannya bisa langsung dikirim ke Kantor Pusat.
          </p>
        </div>
      ) : (
        kapalIsi.map((kapal) => {
          const punya = baris.filter((b) => b.kapal === kapal);
          const nilai = punya.reduce((n, b) => n + hitungBaris(b).grand, 0);
          return (
            <section key={kapal} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
                <h2 className="text-[14px] font-black tracking-tight text-slate-900 dark:text-white">{pendek(kapal)}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
                  {punya.length} item
                </span>
                <span className="ml-auto text-[12.5px] font-black tabular-nums text-emerald-700 dark:text-emerald-400">{rupiah(nilai)}</span>
                <button onClick={() => onTambah(kapal)}
                  className="rounded-lg bg-[#16357f] px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-[#12296a]">
                  + Item
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {punya.map((b, i) => (
                  <BarisIsi key={b.id} b={b} no={i + 1} onUbah={onUbah} onHapus={onHapus} onSalin={onSalin} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

/**
 * Satu item permintaan.
 *
 * Disusun sebagai kartu, bukan baris tabel selebar layar. Borang aslinya
 * enam belas kolom; dipaksakan jadi satu baris, tiap kotak isian menyempit
 * sampai isinya tidak terbaca dan layar harus digulir mendatar untuk sampai ke
 * kolom nomor IO — kolom yang paling sering diisi.
 */
function BarisIsi({ b, no, onUbah, onHapus, onSalin }: {
  b: BarisIO; no: number;
  onUbah: (id: string, t: Partial<BarisIO>) => void;
  onHapus: (id: string) => void;
  onSalin: (b: BarisIO) => void;
}) {
  const h = hitungBaris(b);
  const t = tahapIO(b);
  const nada = NADA_TAHAP[t];
  const [buka, setBuka] = useState(false);
  const hargaRef = useRef<HTMLInputElement | null>(null);

  const kotak = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[12.5px] outline-none transition focus:border-[#16357f] focus:ring-2 focus:ring-[#16357f]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-white";
  const tanda = "mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500";

  return (
    <div className="px-4 py-3">
      <div className="grid gap-3 lg:grid-cols-[2.2fr_1.4fr_1fr]">
        {/* kiri: apa yang diminta */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="mt-1.5 w-6 shrink-0 text-center text-[12px] font-black text-slate-400">{no}</span>
            <div className="min-w-0 flex-1">
              <label className={tanda}>Deskripsi aset</label>
              <input value={b.deskripsi} onChange={(e) => onUbah(b.id, { deskripsi: e.target.value })}
                placeholder="mis. Radar merk Garmin" className={kotak} />
            </div>
          </div>
          <div className="grid gap-2 pl-8 sm:grid-cols-2">
            <div>
              <label className={tanda}>Spesifikasi</label>
              <input value={b.spesifikasi} onChange={(e) => onUbah(b.id, { spesifikasi: e.target.value })}
                placeholder="mis. radar 4 kW" className={kotak} />
            </div>
            <div>
              <label className={tanda}>Asset class</label>
              <select value={b.assetClass} onChange={(e) => onUbah(b.id, { assetClass: e.target.value })}
                className={kotak} title={labelAsset(b.assetClass)}>
                <optgroup label="Sering dipakai">
                  {ASSET_SERING.map((k) => (
                    <option key={k} value={k}>{k} — {labelAsset(k)}</option>
                  ))}
                </optgroup>
                <optgroup label="Seluruh kelas aset">
                  {ASSET_CLASS.map((a) => <option key={a.kode} value={a.kode}>{a.kode} — {a.label}</option>)}
                </optgroup>
              </select>
            </div>
          </div>
        </div>

        {/* tengah: jumlah & harga */}
        <div className="space-y-2">
          <div className="grid grid-cols-[4.5rem_1fr] gap-2">
            <div>
              <label className={tanda}>Unit</label>
              <input value={b.unit} inputMode="numeric" onChange={(e) => onUbah(b.id, { unit: e.target.value })} className={kotak} />
            </div>
            <div>
              <label className={tanda}>Satuan</label>
              <select value={b.satuan} onChange={(e) => onUbah(b.id, { satuan: e.target.value })} className={kotak}>
                {SATUAN_IO.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={tanda}>Harga satuan</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">Rp</span>
              {/* ditampilkan bertitik ribuan, disimpan sebagai angka polos —
                  orang mengetik harga panjang dan mudah salah hitung nol */}
              <input ref={hargaRef} value={bacaAngka(b.hargaSatuan)} inputMode="numeric"
                onChange={(e) => onUbah(b.id, { hargaSatuan: String(angka(e.target.value) || "") })}
                placeholder="0" className={`${kotak} pl-8 text-right font-semibold tabular-nums`} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[11.5px] font-semibold text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={b.ppn} onChange={(e) => onUbah(b.id, { ppn: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-slate-300 accent-[#16357f]" />
            Kena PPN 11%
          </label>
          <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11.5px] dark:bg-slate-800/60">
            <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="tabular-nums font-semibold">{rupiah(h.total)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">PPN</span><span className="tabular-nums">{rupiah(h.ppn)}</span></div>
            <div className="mt-0.5 flex justify-between border-t border-slate-200 pt-0.5 font-black dark:border-slate-700">
              <span>Grand total</span><span className="tabular-nums text-emerald-700 dark:text-emerald-400">{rupiah(h.grand)}</span>
            </div>
          </div>
        </div>

        {/* kanan: nomor yang ditunggu */}
        <div className="space-y-2">
          <span className={`inline-block rounded-lg px-2 py-0.5 text-[11px] font-black ring-1 ${nada.warna}`}>{nada.label}</span>
          <div>
            <label className={tanda}>No. IO SAP</label>
            <input value={b.noIoSap} onChange={(e) => onUbah(b.id, { noIoSap: e.target.value })}
              placeholder="belum turun" className={`${kotak} font-mono`} />
          </div>
          <div>
            <label className={tanda}>No. Asset SAP</label>
            <input value={b.noAsetSap} onChange={(e) => onUbah(b.id, { noAsetSap: e.target.value })}
              placeholder="sesudah barang datang" className={`${kotak} font-mono`} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setBuka((v) => !v)}
              className="text-[11px] font-bold text-[#16357f] hover:underline dark:text-sky-300">
              {buka ? "Sembunyikan rincian" : "Rincian lain"}
            </button>
            <button onClick={() => onSalin(b)} className="ml-auto text-[11px] font-bold text-slate-500 hover:text-[#16357f]">Salin</button>
            <button onClick={() => onHapus(b.id)} className="text-[11px] font-bold text-slate-400 hover:text-rose-600">Hapus</button>
          </div>
        </div>
      </div>

      {buka && (
        <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className={tanda}>Cost center</label>
            <input value={b.costCenter} onChange={(e) => onUbah(b.id, { costCenter: e.target.value })}
              placeholder="mis. 5201100014" className={`${kotak} font-mono`} />
          </div>
          <div>
            <label className={tanda}>Lokasi</label>
            <input value={b.lokasi} onChange={(e) => onUbah(b.id, { lokasi: e.target.value })} className={kotak} />
          </div>
          <div>
            <label className={tanda}>Ganti / Baru</label>
            <select value={b.gantiBaru} onChange={(e) => onUbah(b.id, { gantiBaru: e.target.value as BarisIO["gantiBaru"] })} className={kotak}>
              <option value="">—</option>
              <option value="Baru">Baru</option>
              <option value="Ganti">Ganti</option>
            </select>
          </div>
          <div>
            <label className={tanda}>No. aset lama diganti</label>
            <input value={b.asetLama} onChange={(e) => onUbah(b.id, { asetLama: e.target.value })}
              className={`${kotak} font-mono`} />
            {b.gantiBaru === "Ganti" && !b.asetLama.trim() && (
              /* pusat menolak permintaan penggantian tanpa nomor aset lama —
                 lebih murah ketahuan di sini daripada sebulan kemudian */
              <p className="mt-1 text-[10.5px] font-bold text-amber-700">Penggantian wajib menyebut nomor aset lama.</p>
            )}
          </div>
          <div>
            <label className={tanda}>Catatan internal</label>
            <input value={b.catatan} onChange={(e) => onUbah(b.id, { catatan: e.target.value })}
              placeholder="tidak ikut ke borang" className={kotak} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── seluruh periode ─────────────────────────── */

function SemuaPeriode({ data, cari, setCari, sarKapal, setSarKapal, sarTahap, setSarTahap, onBuka }: {
  data: (BarisIO & { periode: string })[];
  cari: string; setCari: (v: string) => void;
  sarKapal: string; setSarKapal: (v: string) => void;
  sarTahap: string; setSarTahap: (v: string) => void;
  onBuka: (periode: string) => void;
}) {
  const gaya = "rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-[12px] outline-none focus:border-[#16357f] dark:border-slate-600 dark:bg-slate-900 dark:text-white";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cari</span>
          <input value={cari} onChange={(e) => setCari(e.target.value)}
            placeholder="deskripsi / spesifikasi / nomor IO / kode aset…" className={gaya} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Kapal</span>
          <select value={sarKapal} onChange={(e) => setSarKapal(e.target.value)} className={gaya}>
            <option value="">Semua kapal</option>
            {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{pendek(k)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Tahap</span>
          <select value={sarTahap} onChange={(e) => setSarTahap(e.target.value)} className={gaya}>
            <option value="">Semua tahap</option>
            <option value="ada-io">Nomor IO turun</option>
            <option value="ada-aset">Nomor aset terbit</option>
          </select>
        </label>
        {(cari || sarKapal || sarTahap) && (
          <button onClick={() => { setCari(""); setSarKapal(""); setSarTahap(""); }}
            className="rounded-xl border border-slate-300 px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">
            Bersihkan
          </button>
        )}
      </div>

      {!data.length ? (
        <p className="rounded-2xl bg-white px-4 py-12 text-center text-[13px] text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900">
          Tidak ada nomor IO yang cocok dengan saringan.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                  {["Periode", "Kapal", "Deskripsi aset", "Asset class", "Qty", "Grand total", "No. IO SAP", "No. Asset SAP", "Tahap"].map((hd) => (
                    <th key={hd} className="whitespace-nowrap px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">{hd}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((b, i) => {
                  const h = hitungBaris(b);
                  const nada = NADA_TAHAP[tahapIO(b)];
                  return (
                    <tr key={`${b.periode}-${b.id}`} className={`border-b border-slate-100 align-top last:border-0 dark:border-slate-800 ${i % 2 ? "bg-slate-50/60 dark:bg-slate-800/30" : ""}`}>
                      <td className="whitespace-nowrap px-3 py-2">
                        <button onClick={() => onBuka(b.periode)} className="font-semibold text-[#16357f] hover:underline dark:text-sky-300">
                          {namaPeriode(b.periode)}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-800 dark:text-slate-100">{pendek(b.kapal)}</td>
                      <td className="px-3 py-2">
                        <span className="font-semibold text-slate-900 dark:text-white">{b.deskripsi || "—"}</span>
                        {b.spesifikasi && <span className="mt-0.5 block text-[11px] text-slate-500">{b.spesifikasi}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11.5px] text-slate-600 dark:text-slate-300" title={labelAsset(b.assetClass)}>
                        {b.assetClass}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600 dark:text-slate-300">{b.unit} {b.satuan}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">{rupiah(h.grand)}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11.5px]">{b.noIoSap || <span className="text-slate-300">—</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11.5px]">{b.noAsetSap || <span className="text-slate-300">—</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold ring-1 ${nada.warna}`}>{nada.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
