"use client";
/**
 * KERANJANG PENGADAAN — bilah pilihan yang tahu pagu.
 *
 * Memilih barang dari permintaan kapal itu mudah; yang sulit adalah menjawab
 * "kalau yang ini semua saya ambil, pagu bulan itu masih cukup tidak?".
 * Selama jawabannya harus dicari di layar lain, orang memilih dulu baru tahu
 * belakangan bahwa pagunya lewat — dan pembatalan SPPBJ jauh lebih mahal
 * daripada satu baris angka di layar ini.
 *
 * Karena itu bilahnya menampilkan tiga angka yang sama urutannya dengan
 * Rencana Belanja: pagu → terpakai → keranjang, lalu sisanya. Sisa yang benar
 * adalah pagu dikurangi KEDUANYA; membandingkan keranjang dengan pagu saja
 * membuat bulan yang sudah banyak terpakai tampak masih lapang.
 *
 * Rinciannya sengaja disembunyikan di laci yang bisa ditarik. Bilah bawah
 * dipakai sambil memilih — ia harus muat satu baris dan tidak menutupi tabel;
 * daftar barang, pengelompokan per kapal, dan tombol hapus baru diperlukan
 * ketika orang berhenti memilih dan mulai memeriksa.
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

const namaBulan = (b: string) => {
  const [th, bl] = b.split("-");
  const nama = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
    "Agustus", "September", "Oktober", "November", "Desember"][Number(bl) - 1];
  return nama ? `${nama} ${th}` : b;
};

/** dua belas bulan ke depan dan ke belakang dari bulan ini */
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
 * Meteran pagu: satu batang, tiga bagian.
 *
 * Batangnya dibaca sekali lihat — abu-abu yang sudah terpakai, biru yang
 * sedang di keranjang, sisanya kosong. Begitu keranjang melewati pagu, seluruh
 * batang menjadi merah: tidak ada gunanya menampilkan proporsi yang sudah tidak
 * masuk akal, yang perlu terbaca adalah "ini lewat".
 */
function Meteran({ pagu, pakai, keranjang }: { pagu: number; pakai: number; keranjang: number }) {
  const lewat = pagu > 0 && pakai + keranjang > pagu;
  const bagian = (v: number) => (pagu > 0 ? Math.min(100, (v / pagu) * 100) : 0);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <div className="flex h-full">
        <div className={`h-full ${lewat ? "bg-rose-300" : "bg-slate-400"}`}
          style={{ width: `${bagian(pakai)}%` }} />
        <div className={`h-full ${lewat ? "bg-rose-600" : "bg-[#16357f]"}`}
          style={{ width: `${bagian(keranjang)}%` }} />
      </div>
    </div>
  );
}

export default function KeranjangPengadaan({
  item, kapalTerpilih, onHapus, onBersih, onSalin, onSppbj,
}: {
  item: ItemKeranjang[];
  kapalTerpilih: string[];
  onHapus: (kunci: string) => void;
  onBersih: () => void;
  onSalin: () => void;
  onSppbj: () => void;
}) {
  const { plafon, pengadaan } = useAnggaran();
  const [bulan, setBulan] = useState(bulanIni);
  const [ma, setMa] = useState(MA_AWAL);
  const [buka, setBuka] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");

  useEffect(() => { if (!item.length) setBuka(false); }, [item.length]);
  useEffect(() => { if (!pesan) return; const t = setTimeout(() => setPesan(""), 4000); return () => clearTimeout(t); }, [pesan]);

  const nilai = useMemo(() => {
    const jumlah = item.reduce((s, x) => s + x.nilai, 0);
    return { jumlah, tanpaHarga: item.filter((x) => x.nilai <= 0).length };
  }, [item]);

  /* pagu bulan yang dipilih untuk mata anggaran yang dipilih, dan pemakaiannya */
  const anggaran = useMemo(() => {
    const kunciMa = maKey(ma);
    const p = plafon.find((x) => x.bulan === bulan);
    const pagu = (p?.rows || [])
      .filter((r) => maKey(r.ma) === kunciMa)
      .reduce((s, r) => s + paguTotal(r), 0);
    const pakai = realisasiRutin(pengadaan, bulan).perKey[kunciMa] || 0;
    return { pagu, pakai, sisa: pagu - pakai - nilai.jumlah };
  }, [plafon, pengadaan, bulan, ma, nilai.jumlah]);

  const lewat = anggaran.pagu > 0 && anggaran.sisa < 0;
  const belumAdaPagu = anggaran.pagu <= 0;

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
   * Yang disimpan taksiran nilainya saja, bukan daftar barangnya: begitu
   * SPPBJ-nya terbit, yang berlaku SPPBJ itu, dan rencana hanya perlu
   * menjawab "pagu bulan ini sudah dijanjikan untuk apa saja".
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
                <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Keranjang pengadaan</p>
                <p className="text-[11px] text-slate-500">{item.length} barang · {perKapal.length} kapal</p>
              </div>
              <button onClick={() => setBuka(false)}
                className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800">
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
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                    {g.daftar.map((x) => (
                      <li key={x.kunci} className="flex items-start gap-2 px-2.5 py-2">
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
                          className="mt-0.5 rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950">
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
                className="w-full rounded-md border border-slate-300 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                Kosongkan keranjang
              </button>
            </footer>
          </aside>
        </>
      )}

      {/* ── bilah bawah ──────────────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/97 backdrop-blur dark:border-slate-700 dark:bg-slate-900/97">
        {pesan && (
          <p className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-center text-[11.5px] font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
            {pesan}
          </p>
        )}
        <div className="mx-auto flex max-w-[104rem] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">

          {/* jumlah & nilai */}
          <button onClick={() => setBuka(true)}
            className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#16357f] text-[13px] font-bold text-white tabular-nums">
              {item.length}
            </span>
            <span>
              <span className="block text-[13px] font-bold leading-tight text-slate-900 dark:text-slate-50 tabular-nums">
                {rupiah(nilai.jumlah)}
              </span>
              <span className="block text-[10.5px] leading-tight text-slate-500">
                {kapalTerpilih.length === 1 ? kapalTerpilih[0] : `${kapalTerpilih.length} kapal`}
                {nilai.tanpaHarga > 0 && ` · ${nilai.tanpaHarga} tanpa harga`}
                <span className="ml-1 font-semibold text-[#16357f] dark:text-sky-400">· rincian</span>
              </span>
            </span>
          </button>

          {/* pagu bulan & mata anggaran */}
          <div className="min-w-[17rem] flex-1">
            <div className="mb-1 flex items-center gap-1.5">
              <select value={bulan} onChange={(e) => setBulan(e.target.value)}
                className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {daftarBulan().map((b) => <option key={b} value={b}>{namaBulan(b)}</option>)}
              </select>
              <select value={ma} onChange={(e) => setMa(e.target.value)}
                className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {MA_BIAYA.map((m) => <option key={m.kode} value={m.kode}>{m.label}</option>)}
              </select>
            </div>
            <Meteran pagu={anggaran.pagu} pakai={anggaran.pakai} keranjang={nilai.jumlah} />
            <p className="mt-1 text-[10.5px] leading-tight text-slate-500">
              {belumAdaPagu ? (
                <span className="font-semibold text-amber-600">
                  Pagu {labelMA(maKey(ma))} belum ada untuk {namaBulan(bulan)}
                </span>
              ) : (
                <>
                  pagu {rupiahRingkas(anggaran.pagu)} · terpakai {rupiahRingkas(anggaran.pakai)} ·{" "}
                  <span className={`font-bold ${lewat ? "text-rose-600" : "text-emerald-700 dark:text-emerald-400"}`}>
                    {lewat ? `lewat ${rupiahRingkas(-anggaran.sisa)}` : `sisa ${rupiahRingkas(anggaran.sisa)}`}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* tindakan */}
          <div className="flex items-center gap-1.5">
            <button onClick={onSalin} title="Salin daftar barang"
              className="rounded-md border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
              <Ikon nama="salin" className="h-4 w-4" />
            </button>
            <button onClick={keRencana} disabled={sibuk}
              className="rounded-md border border-[#16357f] px-3 py-1.5 text-[12px] font-semibold text-[#16357f] transition hover:bg-[#16357f]/5 disabled:opacity-40 dark:border-sky-500 dark:text-sky-400">
              {sibuk ? "Menyimpan…" : "Simpan ke Rencana"}
            </button>
            <button onClick={onSppbj} disabled={kapalTerpilih.length !== 1}
              title={kapalTerpilih.length === 1 ? "" : "Satu SPPBJ hanya untuk satu kapal"}
              className="rounded-md bg-[#16357f] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#12296a] disabled:opacity-40">
              Buat SPPBJ →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
