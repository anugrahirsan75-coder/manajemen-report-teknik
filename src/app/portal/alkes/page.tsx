"use client";
/**
 * Alat Kesehatan kapal — diisi akun DECK.
 *
 * Yang dicatat bukan sekadar "ada atau tidak", melainkan KAPAN habis masa
 * berlakunya. Obat di kotak P3K kapal lewat masa pakainya diam-diam; kotaknya
 * baru dibuka ketika sudah ada yang terluka, dan pada saat itu satu-satunya
 * pilihan yang tersisa adalah memakai yang kedaluwarsa.
 *
 * Karena itu tiap butir diberi tanda menurut sisa harinya, dan yang paling dekat
 * kedaluwarsa naik ke atas dengan sendirinya — daftar yang urutannya tetap
 * membuat butir mendesak tenggelam di baris keempat puluh.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { RangkaPortal, useAku } from "@/components/portal/Rangka";
import {
  GOLONGAN_ALKES, NADA_ALKES, idBaris, sisaHariAlkes, tingkatAlkes, type BarisAlkes,
} from "@/lib/portal/types";

const LOKASI = ["Kotak P3K Anjungan", "Kotak P3K Kamar Mesin", "Klinik/Ruang Perawatan", "Gudang", "Lainnya"];

const waktu = (iso: string) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function AlkesKapal() {
  const { aku } = useAku();
  const [item, setItem] = useState<BarisAlkes[]>([]);
  const [muat, setMuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");
  const [terakhir, setTerakhir] = useState({ pada: "", oleh: "" });
  const [kotor, setKotor] = useState(false);
  const [cari, setCari] = useState("");

  const ambil = useCallback(async () => {
    try {
      const r = await fetch("/api/portal/alkes", { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal memuat data");
      setItem(d.item || []);
      setTerakhir({ pada: d.diperbaruiPada || "", oleh: d.olehAkun || "" });
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);

  useEffect(() => { void ambil(); }, [ambil]);

  const simpan = async () => {
    setSibuk(true); setGalat("");
    try {
      const r = await fetch("/api/portal/alkes", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item }),
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

  const ubah = (id: string, k: keyof BarisAlkes, v: string | number) => {
    setKotor(true);
    setItem((l) => l.map((b) => (b.id === id ? { ...b, [k]: v, diperbaruiPada: new Date().toISOString() } : b)));
  };

  const tambah = () => {
    setKotor(true);
    setItem((l) => [{
      id: idBaris("a"), nama: "", golongan: GOLONGAN_ALKES[0], jumlah: 1, satuan: "pcs",
      kedaluwarsa: "", lokasi: LOKASI[0], minimum: 1, catatan: "",
      diperbaruiPada: new Date().toISOString(),
    }, ...l]);
  };

  /*
   * Diurut menurut sisa hari — yang paling dekat kedaluwarsa di atas. Daftar
   * yang urutannya tetap membuat butir mendesak tenggelam, dan yang mengisinya
   * berdiri sambil memegang kotak P3K, bukan duduk membaca empat puluh baris.
   */
  const tampil = useMemo(() => {
    const kunci = cari.trim().toLowerCase();
    return [...item]
      .filter((b) => !kunci || `${b.nama} ${b.golongan} ${b.lokasi} ${b.catatan}`.toLowerCase().includes(kunci))
      .sort((a, b) => {
        const sa = sisaHariAlkes(a.kedaluwarsa);
        const sb = sisaHariAlkes(b.kedaluwarsa);
        if (sa === null && sb === null) return a.nama.localeCompare(b.nama, "id");
        if (sa === null) return 1;
        if (sb === null) return -1;
        return sa - sb;
      });
  }, [item, cari]);

  const hitung = useMemo(() => ({
    lewat: item.filter((b) => tingkatAlkes(b.kedaluwarsa) === "lewat").length,
    kritis: item.filter((b) => tingkatAlkes(b.kedaluwarsa) === "kritis").length,
    menipis: item.filter((b) => b.minimum > 0 && b.jumlah <= b.minimum).length,
  }), [item]);

  return (
    <RangkaPortal aku={aku}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="flex-1 text-[17px] font-black text-slate-900 dark:text-white">Alat Kesehatan</h1>
        <button onClick={simpan} disabled={sibuk || muat}
          className={`rounded-xl px-4 py-2 text-[12.5px] font-bold text-white transition disabled:opacity-50 ${
            kotor ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#16357f] hover:bg-[#12296a]"}`}>
          {sibuk ? "Menyimpan…" : kotor ? "Simpan perubahan" : "Simpan"}
        </button>
      </div>

      <p className="mb-3 text-[11.5px] text-slate-500">
        Terakhir diperbarui {waktu(terakhir.pada)}{terakhir.oleh ? ` oleh ${terakhir.oleh}` : ""}.
        Isi tanggal kedaluwarsanya — dari situ kantor menyiapkan penggantian sebelum masa berlakunya habis.
      </p>

      {kabar && <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800 ring-1 ring-emerald-200">{kabar}</p>}
      {galat && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-800 ring-1 ring-rose-200">{galat}</p>}

      <section className="mb-3 grid grid-cols-3 gap-2">
        {([["Kedaluwarsa", hitung.lewat, "text-rose-700"], ["≤ 30 hari", hitung.kritis, "text-orange-700"], ["Stok menipis", hitung.menipis, "text-amber-700"]] as const).map(([l, n, w]) => (
          <div key={l} className="rounded-xl bg-white p-2.5 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <p className={`text-2xl font-black tabular-nums ${n ? w : "text-slate-300"}`}>{n}</p>
            <p className="text-[10.5px] font-bold uppercase text-slate-500">{l}</p>
          </div>
        ))}
      </section>

      <div className="mb-2 flex gap-2">
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama obat / alat…"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#16357f] dark:border-slate-600 dark:bg-slate-900" />
        <button onClick={tambah} className="shrink-0 rounded-xl bg-[#16357f] px-3 py-2 text-[12.5px] font-bold text-white">+ Tambah</button>
      </div>

      {muat ? (
        <p className="rounded-2xl bg-white px-4 py-10 text-center text-[13px] text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900">Memuat…</p>
      ) : !tampil.length ? (
        <div className="rounded-2xl bg-white px-4 py-10 text-center ring-1 ring-slate-200 dark:bg-slate-900">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
            {item.length ? "Tidak ada yang cocok dengan pencarian." : "Belum ada alat kesehatan tercatat."}
          </p>
          {!item.length && (
            <button onClick={tambah} className="mt-3 rounded-xl bg-[#16357f] px-4 py-2 text-[12.5px] font-bold text-white">
              Tambah butir pertama
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {tampil.map((b) => {
            const t = tingkatAlkes(b.kedaluwarsa);
            const sisa = sisaHariAlkes(b.kedaluwarsa);
            const kurang = b.minimum > 0 && b.jumlah <= b.minimum;
            return (
              <li key={b.id} className={`rounded-xl p-2.5 ring-1 ${
                t === "lewat" ? "bg-rose-50 ring-rose-300 dark:bg-rose-950/30"
                  : t === "kritis" ? "bg-orange-50 ring-orange-300 dark:bg-orange-950/30"
                    : "bg-slate-50 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700"}`}>
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-black ring-1 ${NADA_ALKES[t].kelas}`}>
                    {NADA_ALKES[t].label}
                    {sisa !== null && t !== "aman" && t !== "tanpa" && ` · ${sisa < 0 ? `lewat ${Math.abs(sisa)} hari` : `${sisa} hari lagi`}`}
                  </span>
                  {kurang && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10.5px] font-black text-amber-900">STOK MENIPIS</span>}
                  <button onClick={() => { setKotor(true); setItem((l) => l.filter((x) => x.id !== b.id)); }}
                    className="ml-auto text-[11px] font-bold text-rose-600 hover:underline">Hapus</button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="col-span-2">
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Nama obat / alat</span>
                    <input value={b.nama} onChange={(e) => ubah(b.id, "nama", e.target.value)}
                      placeholder="mis. Betadine 60 ml"
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[14px] font-semibold dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                  <label>
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Golongan</span>
                    <select value={b.golongan} onChange={(e) => ubah(b.id, "golongan", e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] dark:border-slate-600 dark:bg-slate-900">
                      {Array.from(new Set([...GOLONGAN_ALKES, b.golongan].filter(Boolean))).map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Kedaluwarsa</span>
                    <input type="date" value={b.kedaluwarsa} onChange={(e) => ubah(b.id, "kedaluwarsa", e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                  <label>
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Jumlah</span>
                    <input value={b.jumlah} onChange={(e) => ubah(b.id, "jumlah", Number(e.target.value) || 0)} inputMode="numeric"
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[15px] font-bold tabular-nums dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                  <label>
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Satuan</span>
                    <input value={b.satuan} onChange={(e) => ubah(b.id, "satuan", e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                  <label>
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Batas minimum</span>
                    <input value={b.minimum} onChange={(e) => ubah(b.id, "minimum", Number(e.target.value) || 0)} inputMode="numeric"
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] tabular-nums dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                  <label>
                    {/* lokasi ditanyakan karena kotak P3K dicari saat panik, bukan saat santai */}
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Letak</span>
                    <select value={b.lokasi} onChange={(e) => ubah(b.id, "lokasi", e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] dark:border-slate-600 dark:bg-slate-900">
                      {Array.from(new Set([...LOKASI, b.lokasi].filter(Boolean))).map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </label>
                  <label className="col-span-2">
                    <span className="block text-[10.5px] font-bold uppercase text-slate-500">Catatan</span>
                    <input value={b.catatan} onChange={(e) => ubah(b.id, "catatan", e.target.value)}
                      placeholder="mis. segel rusak, perlu diganti"
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}

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
