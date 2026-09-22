"use client";
/**
 * Tempel satu tabel SPPB/J utuh dari Excel.
 *
 * Alurnya sengaja tiga langkah — tempel, PERIKSA, baru masuk. Langkah tengah
 * itu yang membedakannya dari tempel biasa: tabel yang langsung masuk tanpa
 * ditunjukkan dulu membuat kolom yang tergeser satu lajur berubah menjadi
 * harga yang salah, dan kesalahan seperti itu baru ketahuan setelah dokumennya
 * terbit.
 *
 * Yang ditampilkan sebelum menekan "Masukkan": pemetaan tiap kolom (bisa
 * dibetulkan sendiri), tiap baris beserta alasan kalau ada yang janggal, dan
 * adu angka antara hasil hitung dengan baris Jumlah/PPn/Total pada lembarnya.
 */
import { useEffect, useMemo, useState } from "react";
import {
  BarisTempel, HasilTempel, PERAN_LABEL, Peran, pecah, tebakKolom, uraikan,
} from "@/lib/sppbj/tempelTabel";
import { KAPAL_LIST } from "@/lib/sppbj/db";

export interface ItemTempel {
  kapal: string; jumlah: number; satuan: string; nama: string;
  spesifikasi: string; harga: number; keterangan?: string; breakdown?: string[];
}

const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

const WARNA: Record<BarisTempel["jenis"], string> = {
  item: "",
  kapal: "bg-sky-50 text-sky-800 font-semibold",
  golongan: "bg-violet-50 text-violet-800 font-semibold",
  rincian: "bg-slate-50 text-slate-500 italic",
  penutup: "bg-emerald-50 text-emerald-800",
  lewat: "bg-slate-100 text-slate-400",
};

const LABEL_JENIS: Record<BarisTempel["jenis"], string> = {
  item: "item", kapal: "kapal", golongan: "golongan", rincian: "rincian",
  penutup: "penutup", lewat: "dilewati",
};

export default function TempelTabelSppbj({ open, onClose, onAdd, kapalAwal = "" }: {
  open: boolean;
  onClose: () => void;
  onAdd: (items: ItemTempel[]) => void;
  kapalAwal?: string;
}) {
  const [teks, setTeks] = useState("");
  const [kolom, setKolom] = useState<Peran[]>([]);
  const [kapal, setKapal] = useState(kapalAwal);
  const [pakai, setPakai] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!open) { setTeks(""); setKolom([]); setPakai({}); }
    else setKapal(kapalAwal);
  }, [open, kapalAwal]);

  // tebakan kolom disetel ulang tiap tempelan baru, lalu boleh diubah pemakai
  useEffect(() => {
    if (!teks.trim()) { setKolom([]); return; }
    setKolom(tebakKolom(pecah(teks)));
    setPakai({});
  }, [teks]);

  const hasil: HasilTempel | null = useMemo(
    () => (teks.trim() ? uraikan(teks, kolom.length ? kolom : undefined, kapal) : null),
    [teks, kolom, kapal]);

  const item = useMemo(() => (hasil?.baris || []).filter((b) => b.jenis === "item"), [hasil]);
  const dipakai = useMemo(
    () => item.filter((b) => (pakai[b.sumber] ?? b.pakai)),
    [item, pakai]);
  const totalDipakai = dipakai.reduce((s, b) => s + b.jumlah * b.harga, 0);

  if (!open) return null;

  const gantiKolom = (i: number, p: Peran) => {
    setKolom((lama) => {
      const baru = [...lama];
      // satu peran hanya boleh dipegang satu kolom (kecuali "abaikan")
      if (p !== "abaikan") baru.forEach((x, j) => { if (x === p && j !== i) baru[j] = "abaikan"; });
      baru[i] = p;
      return baru;
    });
  };

  const masukkan = () => {
    onAdd(dipakai.map((b) => ({
      kapal: b.kapal, jumlah: b.jumlah, satuan: b.satuan, nama: b.nama,
      spesifikasi: b.spesifikasi, harga: b.harga,
      keterangan: b.keterangan, breakdown: b.breakdown?.length ? b.breakdown : undefined,
    })));
    onClose();
  };

  const lebar = hasil?.kolom.length || 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl my-4">
        <div className="flex items-center gap-3 px-5 py-3 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <span className="text-xl">📋</span>
          <div className="flex-1">
            <h2 className="font-extrabold text-slate-800">Tempel Tabel SPPB/J dari Excel</h2>
            <p className="text-[11px] text-slate-500">
              Blok seluruh tabel di Excel → Ctrl+C → tempel di kotak bawah. Baris kapal, judul golongan,
              dan baris Jumlah/PPn/Total dikenali sendiri.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none px-2">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[11px] font-semibold text-slate-600">
              Kapal bawaan (dipakai bila lembarnya tidak menyebut kapal)
              <input list="kapalTempel" value={kapal} onChange={(e) => setKapal(e.target.value)}
                className="block mt-1 w-56 text-xs border rounded-lg px-2 py-1.5" placeholder="mis. KMP. BARONANG" />
              <datalist id="kapalTempel">{KAPAL_LIST.map((k) => <option key={k} value={k} />)}</datalist>
            </label>
            {teks && (
              <button onClick={() => setTeks("")} className="text-[11px] text-slate-500 underline mb-1.5">
                kosongkan tempelan
              </button>
            )}
          </div>

          <textarea
            autoFocus
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            rows={teks ? 4 : 10}
            placeholder="Klik di sini lalu tekan Ctrl+V…"
            className="w-full text-[11px] font-mono border-2 border-dashed rounded-xl px-3 py-2 focus:border-[#1ca3dd] outline-none"
          />

          {hasil && (
            <>
              {/* pemetaan kolom */}
              <section className="rounded-xl ring-1 ring-slate-200 p-3">
                <p className="text-[11px] font-bold text-slate-700 mb-2">
                  Pemetaan kolom — tebakan aplikasi, betulkan bila ada yang meleset
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: lebar }, (_, i) => (
                    <label key={i} className="text-[10px] text-slate-500">
                      Kolom {i + 1}
                      <select value={hasil.kolom[i] || "abaikan"} onChange={(e) => gantiKolom(i, e.target.value as Peran)}
                        className={`block mt-0.5 text-[11px] border rounded-lg px-1.5 py-1 ${
                          (hasil.kolom[i] || "abaikan") === "abaikan" ? "text-slate-400" : "font-semibold text-slate-700"}`}>
                        {(Object.keys(PERAN_LABEL) as Peran[]).map((p) => (
                          <option key={p} value={p}>{PERAN_LABEL[p]}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </section>

              {/* adu angka */}
              <section className="grid sm:grid-cols-3 gap-2">
                {([
                  ["Jumlah (sebelum PPN)", hasil.hitung.jumlah, hasil.lembar.jumlah],
                  ["PPN 11%", hasil.hitung.ppn, hasil.lembar.ppn],
                  ["Total", hasil.hitung.total, hasil.lembar.total],
                ] as [string, number, number | undefined][]).map(([judul, hitung, dilembar]) => {
                  const beda = dilembar !== undefined && Math.abs(dilembar - hitung) > 2;
                  return (
                    <div key={judul} className={`rounded-xl p-3 ring-1 ${beda ? "bg-rose-50 ring-rose-300" : "bg-slate-50 ring-slate-200"}`}>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{judul}</p>
                      <p className="text-sm font-bold text-slate-800">{rp(hitung)}</p>
                      <p className={`text-[10px] ${beda ? "text-rose-700 font-semibold" : "text-slate-400"}`}>
                        {dilembar === undefined ? "tidak ada di lembar" : `di lembar: ${rp(dilembar)}`}
                      </p>
                    </div>
                  );
                })}
              </section>

              {hasil.masalah.length > 0 && (
                <ul className="rounded-xl bg-amber-50 ring-1 ring-amber-300 px-4 py-2 text-[11px] text-amber-900 list-disc list-inside space-y-0.5">
                  {hasil.masalah.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              )}

              {/* pratinjau baris */}
              <section className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-bold text-slate-700 flex-1">
                    {hasil.baris.length} baris ditempel · {item.length} terbaca sebagai item ·
                    {" "}{hasil.baris.filter((b) => b.jenis === "lewat").length} dilewati
                  </p>
                  <button onClick={() => setPakai(Object.fromEntries(item.map((b) => [b.sumber, true])))}
                    className="text-[11px] text-[#16357f] underline">pilih semua item</button>
                  <button onClick={() => setPakai(Object.fromEntries(item.map((b) => [b.sumber, false])))}
                    className="text-[11px] text-slate-500 underline">kosongkan pilihan</button>
                </div>
                <div className="max-h-[22rem] overflow-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0">
                      <tr>
                        <th className="p-1.5 w-8"></th>
                        <th className="p-1.5 w-10 text-left">Brs</th>
                        <th className="p-1.5 w-16 text-left">Jenis</th>
                        <th className="p-1.5 w-24 text-left">Kapal</th>
                        <th className="p-1.5 w-12 text-right">Jml</th>
                        <th className="p-1.5 w-12 text-left">Sat</th>
                        <th className="p-1.5 text-left">Nama / isi baris</th>
                        <th className="p-1.5 w-24 text-right">Harga</th>
                        <th className="p-1.5 w-24 text-right">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hasil.baris.map((b) => {
                        const aktif = b.jenis === "item";
                        const dicentang = pakai[b.sumber] ?? b.pakai;
                        return (
                          <tr key={b.sumber}
                            className={`border-b ${WARNA[b.jenis]} ${b.jenis === "item" && b.catatan ? "bg-amber-50" : ""}`}>
                            <td className="p-1.5 text-center">
                              {aktif && (
                                <input type="checkbox" checked={dicentang}
                                  onChange={(e) => setPakai((p) => ({ ...p, [b.sumber]: e.target.checked }))} />
                              )}
                            </td>
                            <td className="p-1.5 text-slate-400">{b.sumber}</td>
                            <td className="p-1.5">{LABEL_JENIS[b.jenis]}</td>
                            <td className="p-1.5 truncate">{aktif ? b.kapal : ""}</td>
                            <td className="p-1.5 text-right">{aktif ? b.jumlah : ""}</td>
                            <td className="p-1.5">{aktif ? b.satuan : ""}</td>
                            <td className="p-1.5">
                              {aktif ? b.nama : (b.catatan || b.sel.filter(Boolean).join(" · "))}
                              {aktif && b.spesifikasi && <span className="text-slate-400"> · {b.spesifikasi}</span>}
                              {aktif && b.breakdown?.length ? (
                                <span className="block text-slate-500">
                                  {b.breakdown.map((x) => `- ${x}`).join(" ")}
                                </span>
                              ) : null}
                              {aktif && b.keterangan && (
                                <span className="block text-violet-700">🏷 {b.keterangan.replace(/\n/g, " · ")}</span>
                              )}
                              {aktif && b.catatan && (
                                <span className="block text-amber-800 font-semibold">⚠ {b.catatan}</span>
                              )}
                            </td>
                            <td className="p-1.5 text-right">{aktif && b.harga ? b.harga.toLocaleString("id-ID") : ""}</td>
                            <td className="p-1.5 text-right">
                              {aktif ? Math.round(b.jumlah * b.harga).toLocaleString("id-ID") : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-t sticky bottom-0 bg-white rounded-b-2xl">
          <p className="text-[11px] text-slate-500 flex-1">
            {hasil ? <>Akan dimasukkan <b>{dipakai.length}</b> item senilai <b>{rp(totalDipakai)}</b> (sebelum PPN).</>
              : "Belum ada tempelan."}
          </p>
          <button onClick={onClose} className="btn btn-ghost text-xs">Batal</button>
          <button onClick={masukkan} disabled={!dipakai.length}
            className="btn btn-primary text-xs disabled:opacity-40">
            ＋ Masukkan {dipakai.length || ""} item
          </button>
        </div>
      </div>
    </div>
  );
}
