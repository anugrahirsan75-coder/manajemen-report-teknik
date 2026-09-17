"use client";
/**
 * KERANJANG PENGADAAN — kartu yang tahu pagu.
 *
 * Memilih barang dari permintaan kapal itu mudah; yang sulit adalah menjawab
 * "kalau semuanya saya ambil, pagu bulan itu masih cukup tidak?". Selama
 * jawabannya harus dicari di layar lain, orang memilih dulu dan baru tahu
 * belakangan bahwa pagunya lewat — membatalkan SPPBJ jauh lebih mahal daripada
 * tiga baris angka di layar ini.
 *
 * Bentuknya KARTU DI POJOK, bukan bilah selebar layar. Tabel permintaan sudah
 * penuh kolom; bilah bawah memotong tinggi layar justru ketika orang sedang
 * menggulung daftar panjang. Kartu hanya menutupi sudut, dan angka yang paling
 * sering dicari — total belanja — bisa dibuat besar tanpa berebut tempat.
 *
 * Tiga baris anggarannya berurutan sama dengan layar Rencana Belanja:
 * pagu → terpakai → sisa. Sisa yang benar adalah pagu dikurangi KEDUANYA;
 * membandingkan keranjang dengan pagu saja membuat bulan yang sudah banyak
 * terpakai tampak masih lapang.
 */
import { useEffect, useMemo, useState } from "react";
import { Ikon } from "@/components/ikon";
import { useAnggaran, realisasiRutin } from "@/lib/anggaran/store";
import { MATA_ANGGARAN, labelMA, maKey, paguTotal } from "@/lib/anggaran/types";
import {
  barisBaru, muatRencana, rencanaKosong, simpanRencana,
} from "@/lib/anggaran/rencanaBelanja";

export interface ItemKeranjang {
  /** kunci baris di layar permintaan, dipakai untuk membuang satu item */
  kunci: string;
  kapal: string;
  nama: string;
  jumlah: string | number;
  satuan: string;
  /** taksiran nilai; 0 berarti belum ada pembanding harga */
  nilai: number;
}

const MA_BIAYA = MATA_ANGGARAN.filter((m) => m.kategori === "Biaya");
/** mata anggaran yang paling sering dipakai permintaan kapal */
const MA_AWAL = "5010403009";

const bulanIni = () => new Date().toISOString().slice(0, 7);

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const rupiahRingkas = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `Rp ${(n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(".", ",")} M`;
  if (a >= 1e6) return `Rp ${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",")} jt`;
  if (a >= 1e3) return `Rp ${Math.round(n / 1e3)} rb`;
  return rupiah(n);
};

const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
  "Agustus", "September", "Oktober", "November", "Desember"];

const namaBulan = (b: string) => {
  const [th, bl] = b.split("-");
  const nama = NAMA_BULAN[Number(bl) - 1];
  return nama ? `${nama} ${th}` : b;
};

/** enam bulan ke belakang dan ke depan dari bulan berjalan */
function daftarBulan(): string[] {
  const n = new Date();
  const keluar: string[] = [];
  for (let i = -6; i <= 6; i++) {
    const d = new Date(n.getFullYear(), n.getMonth() + i, 1);
    keluar.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keluar;
}

/**
 * Meteran pagu: satu batang, dua bagian.
 *
 * Abu-abu yang sudah terpakai bulan itu, biru yang sedang di keranjang,
 * sisanya kosong. Begitu keduanya melewati pagu, batangnya penuh dan merah —
 * menampilkan proporsi yang sudah tidak masuk akal tidak ada gunanya, yang
 * perlu terbaca hanya "ini lewat".
 */
function Meteran({ pagu, pakai, keranjang }: { pagu: number; pakai: number; keranjang: number }) {
  const lewat = pagu > 0 && pakai + keranjang > pagu;
  const lebar = (v: number) => (pagu > 0 ? Math.max(0, Math.min(100, (v / pagu) * 100)) : 0);
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <span className={`h-full ${lewat ? "bg-rose-300" : "bg-slate-400"}`}
        style={{ width: lewat ? "38%" : `${lebar(pakai)}%` }} />
      <span className={`h-full ${lewat ? "bg-rose-600" : "bg-[#16357f]"}`}
        style={{ width: lewat ? "62%" : `${lebar(keranjang)}%` }} />
    </div>
  );
}

function BarisAngka({ label, nilai, warna = "" }: { label: string; nilai: string; warna?: string }) {
  return (
    <div className="flex items-baseline justify-between py-[3px] text-[11.5px]">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`font-bold tabular-nums ${warna || "text-slate-800 dark:text-slate-100"}`}>{nilai}</span>
    </div>
  );
}

export default function KeranjangPengadaan({
  item, kapalTerpilih, onHapus, onBersih, onSalin, onSppbj, onSppbjKapal,
}: {
  item: ItemKeranjang[];
  kapalTerpilih: string[];
  onHapus: (kunci: string) => void;
  onBersih: () => void;
  onSalin: () => void;
  onSppbj: () => void;
  /** berangkatkan barang satu kapal saja; sisanya tetap di keranjang */
  onSppbjKapal: (kapal: string) => void;
}) {
  const { plafon, pengadaan } = useAnggaran();
  const [bulan, setBulan] = useState(bulanIni);
  const [ma, setMa] = useState(MA_AWAL);
  const [buka, setBuka] = useState(false);
  /** daftar kapal untuk dipilih ketika keranjang memuat lebih dari satu */
  const [pilihKapal, setPilihKapal] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");

  useEffect(() => { if (!item.length) { setBuka(false); setPilihKapal(false); } }, [item.length]);
  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(""), 4000);
    return () => clearTimeout(t);
  }, [pesan]);

  const nilai = useMemo(() => ({
    jumlah: item.reduce((s, x) => s + x.nilai, 0),
    tanpaHarga: item.filter((x) => x.nilai <= 0).length,
  }), [item]);

  /* pagu bulan terpilih untuk mata anggaran terpilih, dan pemakaiannya */
  const anggaran = useMemo(() => {
    const kunciMa = maKey(ma);
    const p = plafon.find((x) => x.bulan === bulan);
    const pagu = (p?.rows || [])
      .filter((r) => maKey(r.ma) === kunciMa)
      .reduce((s, r) => s + paguTotal(r), 0);
    const pakai = realisasiRutin(pengadaan, bulan).perKey[kunciMa] || 0;
    return { pagu, pakai, sisa: pagu - pakai - nilai.jumlah };
  }, [plafon, pengadaan, bulan, ma, nilai.jumlah]);

  const adaPagu = anggaran.pagu > 0;
  const lewat = adaPagu && anggaran.sisa < 0;

  const perKapal = useMemo(() => {
    const peta = new Map<string, ItemKeranjang[]>();
    item.forEach((x) => {
      const k = x.kapal || "Tanpa kapal";
      peta.set(k, [...(peta.get(k) || []), x]);
    });
    return Array.from(peta, ([kapal, daftar]) => ({
      kapal, daftar, nilai: daftar.reduce((s, y) => s + y.nilai, 0),
    })).sort((a, b) => b.nilai - a.nilai);
  }, [item]);

  /**
   * Simpan keranjang sebagai rencana belanja — satu baris per kapal.
   *
   * Yang disimpan taksiran nilainya, bukan daftar barangnya: begitu SPPBJ
   * terbit, yang berlaku SPPBJ itu sendiri, dan rencana hanya perlu menjawab
   * "pagu bulan ini sudah dijanjikan untuk apa saja".
   */
  const keRencana = async () => {
    setSibuk(true);
    setPesan("");
    try {
      const daftar = await muatRencana();
      const cocok = daftar.find((r) => r.isi.dari <= bulan && bulan <= r.isi.sampai);
      const isi = cocok ? cocok.isi : rencanaKosong(bulan, bulan);
      const tambahan = perKapal.map((g) => ({
        ...barisBaru(ma),
        nama: `Permintaan ${g.kapal} — ${namaBulan(bulan)}`,
        nilai: Math.round(g.nilai),
      }));
      await simpanRencana(cocok ? cocok.id : null, { ...isi, baris: [...isi.baris, ...tambahan] });
      setPesan(`Masuk Rencana Belanja ${namaBulan(bulan)} — ${tambahan.length} baris.`);
    } catch (e: any) {
      setPesan(e?.message || "Gagal menyimpan rencana.");
    } finally {
      setSibuk(false);
    }
  };

  if (!item.length) return null;

  const kelasPilih = "min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11.5px] "
    + "text-slate-700 outline-none transition focus:border-[#16357f] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";

  return (
    <>
      {/* ── laci rincian ─────────────────────────────────────────────────── */}
      {buka && (
        <>
          <button aria-label="Tutup rincian" onClick={() => setBuka(false)}
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px]" />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div>
                <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Isi keranjang</p>
                <p className="text-[11px] text-slate-500">{item.length} barang · {perKapal.length} kapal</p>
              </div>
              <button onClick={() => setBuka(false)} aria-label="Tutup"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800">
                <Ikon nama="silang" className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {perKapal.map((g) => (
                <section key={g.kapal} className="mb-4">
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <h3 className="text-[12px] font-bold text-[#16357f] dark:text-sky-400">{g.kapal}</h3>
                    <span className="text-[11.5px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                      {rupiah(g.nilai)}
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                    {g.daftar.map((x) => (
                      <li key={x.kunci} className="flex items-start gap-2 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] text-slate-800 dark:text-slate-100">{x.nama}</p>
                          <p className="text-[10.5px] text-slate-500">
                            {x.jumlah} {x.satuan || "pcs"}
                            {x.nilai > 0
                              ? <span className="ml-1.5 tabular-nums">· {rupiah(x.nilai)}</span>
                              : <span className="ml-1.5 text-amber-600">· belum ada pembanding harga</span>}
                          </p>
                        </div>
                        <button onClick={() => onHapus(x.kunci)} title="Keluarkan dari keranjang"
                          className="mt-0.5 rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950">
                          <Ikon nama="silang" className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <footer className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[11.5px] text-slate-500">Total keranjang</span>
                <span className="text-[15px] font-bold tabular-nums text-slate-900 dark:text-slate-50">
                  {rupiah(nilai.jumlah)}
                </span>
              </div>
              <button onClick={onBersih}
                className="w-full rounded-lg border border-slate-200 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Kosongkan keranjang
              </button>
            </footer>
          </aside>
        </>
      )}

      {/* ── kartu keranjang ──────────────────────────────────────────────── */}
      <div className="fixed inset-x-3 bottom-3 z-30 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[21rem]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,.16)] dark:border-slate-700 dark:bg-slate-900">

          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Keranjang
            </span>
            <span className="rounded-md bg-[#16357f] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">
              {item.length} barang
            </span>
          </div>

          <p className="px-4 text-[23px] font-extrabold leading-none tracking-tight tabular-nums text-slate-900 dark:text-slate-50">
            {rupiah(nilai.jumlah)}
          </p>
          <p className="px-4 pb-3 pt-1 text-[11.5px] text-slate-500 dark:text-slate-400">
            {kapalTerpilih.length === 1 ? kapalTerpilih[0] : `${kapalTerpilih.length} kapal — SPPBJ dibuat per kapal`}
            {nilai.tanpaHarga > 0 && ` · ${nilai.tanpaHarga} barang tanpa pembanding harga`}
          </p>

          <div className="flex gap-1.5 px-4 pb-3">
            <select value={bulan} onChange={(e) => setBulan(e.target.value)} aria-label="Bulan anggaran"
              className={kelasPilih}>
              {daftarBulan().map((b) => <option key={b} value={b}>{namaBulan(b)}</option>)}
            </select>
            <select value={ma} onChange={(e) => setMa(e.target.value)} aria-label="Mata anggaran"
              className={kelasPilih}>
              {MA_BIAYA.map((m) => <option key={m.kode} value={m.kode}>{m.label}</option>)}
            </select>
          </div>

          <div className="px-4 pb-3">
            {adaPagu ? (
              <>
                <BarisAngka label="Pagu bulan ini" nilai={rupiahRingkas(anggaran.pagu)} />
                <BarisAngka label="Sudah terpakai" nilai={rupiahRingkas(anggaran.pakai)} />
                <BarisAngka
                  label={lewat ? "Melewati pagu" : "Sisa bila diambil"}
                  nilai={lewat ? rupiahRingkas(-anggaran.sisa) : rupiahRingkas(anggaran.sisa)}
                  warna={lewat ? "text-rose-600" : "text-emerald-700 dark:text-emerald-400"} />
                <div className="mt-1.5">
                  <Meteran pagu={anggaran.pagu} pakai={anggaran.pakai} keranjang={nilai.jumlah} />
                </div>
              </>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                Pagu {labelMA(maKey(ma))} belum ada untuk {namaBulan(bulan)}.
              </p>
            )}
          </div>

          {pesan && (
            <p className="mx-4 mb-3 rounded-lg bg-slate-100 px-3 py-2 text-[11.5px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {pesan}
            </p>
          )}

          {kapalTerpilih.length > 1 && pilihKapal && (
            <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-700">
              <p className="mb-1.5 text-[11px] text-slate-500">
                Satu SPPBJ hanya untuk satu kapal. Pilih yang berangkat dulu —
                sisanya tetap di keranjang.
              </p>
              <ul className="space-y-1">
                {perKapal.map((g) => (
                  <li key={g.kapal}>
                    <button onClick={() => onSppbjKapal(g.kapal)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-left transition hover:border-[#16357f] hover:bg-[#16357f]/[0.04] dark:border-slate-700 dark:hover:border-sky-600">
                      <span className="min-w-0 truncate text-[11.5px] font-semibold text-slate-700 dark:text-slate-200">
                        {g.kapal}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                        {g.daftar.length} brg · {rupiahRingkas(g.nilai)} →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-1.5 border-t border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
            <button onClick={() => setBuka(true)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              Rincian
            </button>
            {kapalTerpilih.length === 1 ? (
              <button onClick={onSppbj}
                className="flex-1 rounded-lg bg-[#16357f] px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#12296a]">
                Buat SPPBJ →
              </button>
            ) : (
              /*
               * Keranjang lintas kapal tidak lagi mematikan tombolnya tanpa
               * penjelasan. Satu SPPBJ memang hanya untuk satu kapal, jadi yang
               * ditawarkan adalah memilih kapal mana yang berangkat lebih dulu.
               */
              <button onClick={() => setPilihKapal((v) => !v)}
                className="flex-1 rounded-lg bg-[#16357f] px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#12296a]">
                Buat SPPBJ per kapal {pilihKapal ? "▴" : "▾"}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-1.5 text-[11px] dark:border-slate-800">
            <button onClick={keRencana} disabled={sibuk}
              className="rounded px-1.5 py-1 font-semibold text-[#16357f] transition hover:bg-[#16357f]/5 disabled:opacity-40 dark:text-sky-400">
              {sibuk ? "Menyimpan…" : "Simpan ke Rencana"}
            </button>
            <span className="flex items-center gap-1">
              <button onClick={onSalin}
                className="rounded px-1.5 py-1 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800">
                Salin
              </button>
              <button onClick={onBersih}
                className="rounded px-1.5 py-1 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950">
                Kosongkan
              </button>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
