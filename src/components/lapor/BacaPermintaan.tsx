"use client";
/**
 * Baca isi permintaan kapal, lalu antar ke pembuatan SPPBJ.
 *
 * Hasil bacaan SELALU ditampilkan untuk diperiksa dan disunting dulu. Yang
 * dibaca adalah foto borang tulisan tangan — angka jumlah dan part number
 * paling gampang meleset, dan keduanya justru yang paling mahal akibatnya
 * kalau salah masuk ke SPPBJ.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Kemajuan } from "@/lib/surat/bacaTabel";
import { BarisPermintaan, bacaPermintaan, keJumlah, titipkanKeSppbj } from "@/lib/lapor/bacaPermintaan";

export interface BerkasDibaca { fileId: string; nama: string }

export default function BacaPermintaan({ buka, tutup, kapal, jenis, berkas }: {
  buka: boolean;
  tutup: () => void;
  kapal: string;
  jenis: string;
  berkas: BerkasDibaca[];
}) {
  const router = useRouter();
  const [sibuk, setSibuk] = useState(false);
  const [tahap, setTahap] = useState<Kemajuan>({ tahap: "" });
  const [baris, setBaris] = useState<BarisPermintaan[]>([]);
  const [mesin, setMesin] = useState("");
  const [catatan, setCatatan] = useState<string[]>([]);
  const [galat, setGalat] = useState("");
  const [sudah, setSudah] = useState<string[]>([]);

  useEffect(() => {
    if (!buka) return;
    setSibuk(false); setTahap({ tahap: "" }); setBaris([]); setMesin("");
    setCatatan([]); setGalat(""); setSudah([]);
  }, [buka]);

  const baca = useCallback(async (b: BerkasDibaca) => {
    setSibuk(true); setGalat("");
    try {
      const h = await bacaPermintaan(b.fileId, b.nama, setTahap);
      setBaris((l) => [...l, ...h.baris]);
      setMesin(h.mesin);
      setCatatan((l) => [...l, ...h.catatan]);
      setSudah((l) => [...l, b.fileId]);
      if (!h.baris.length) setGalat(`Tidak ada barang yang terbaca dari ${b.nama}. Coba berkas lain, atau ketik sendiri di SPPBJ.`);
    } catch (e: any) {
      setGalat(e?.message || String(e));
    } finally { setSibuk(false); setTahap({ tahap: "" }); }
  }, []);

  if (!buka) return null;

  const ubah = (i: number, k: keyof BarisPermintaan, v: string) =>
    setBaris((l) => l.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  const hapus = (i: number) => setBaris((l) => l.filter((_, idx) => idx !== i));

  const keSppbj = () => {
    const n = titipkanKeSppbj(kapal, baris, `${jenis} — ${kapal}`);
    if (!n) return;
    router.push("/sppbj/isi?dari=permintaan");
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-auto bg-black/50 p-3" onMouseDown={tutup}>
      <div className="my-4 w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-3">
          <div>
            <h3 className="font-extrabold text-slate-800">🔍 Baca isi permintaan — {kapal}</h3>
            <p className="text-[11px] text-slate-500">{jenis} · hasil bacaan diperiksa dulu, baru dibawa ke SPPBJ.</p>
          </div>
          <button onClick={tutup} className="text-xl leading-none text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <div className="px-5 py-4">
          {/* berkas kiriman */}
          <div className="flex flex-wrap gap-2">
            {berkas.map((b) => (
              <button key={b.fileId} onClick={() => baca(b)} disabled={sibuk}
                className={`rounded-xl px-3 py-2 text-left text-xs ring-1 transition disabled:opacity-50 ${
                  sudah.includes(b.fileId)
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-sky-50 hover:ring-sky-300"}`}>
                <span className="block max-w-[18rem] truncate font-semibold">{b.nama}</span>
                <span className="text-[10px] text-slate-400">
                  {sudah.includes(b.fileId) ? "sudah dibaca — ketuk untuk mengulang" : "ketuk untuk membaca"}
                </span>
              </button>
            ))}
          </div>

          {sibuk && (
            <div className="mt-3 rounded-xl bg-sky-50 px-3 py-2.5 text-sm text-sky-900 ring-1 ring-sky-200">
              {tahap.tahap || "Membaca…"}
              <span className="ml-1 text-[11px] text-sky-700/70">
                (foto borang dibaca AI — bisa memakan waktu, terutama dengan AI lokal)
              </span>
            </div>
          )}
          {galat && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{galat}</p>}
          {catatan.length > 0 && (
            <ul className="mt-3 space-y-0.5 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              {Array.from(new Set(catatan)).slice(0, 5).map((c, i) => <li key={i}>• {c}</li>)}
            </ul>
          )}

          {baris.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  <b className="text-slate-800">{baris.length} barang</b> terbaca
                  {mesin && <span className="text-slate-400"> · lewat {mesin}</span>}
                </p>
                <button onClick={() => setBaris([])} className="text-[11px] text-slate-500 hover:underline">bersihkan</button>
              </div>

              <div className="max-h-[42vh] overflow-auto rounded-xl ring-1 ring-slate-200">
                <table className="w-full min-w-[48rem] text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-8 px-2 py-2 text-left font-extrabold">#</th>
                      <th className="px-2 py-2 text-left font-extrabold">Nama barang</th>
                      <th className="px-2 py-2 text-left font-extrabold">Spesifikasi</th>
                      <th className="w-20 px-2 py-2 text-left font-extrabold">Jumlah</th>
                      <th className="w-24 px-2 py-2 text-left font-extrabold">Satuan</th>
                      <th className="px-2 py-2 text-left font-extrabold">Keterangan</th>
                      <th className="w-6 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {baris.map((b, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-2 py-1 text-center text-slate-400">{i + 1}</td>
                        {(["nama", "spesifikasi", "jumlah", "satuan", "keterangan"] as const).map((k) => (
                          <td key={k} className="px-2 py-1">
                            <input value={b[k] || ""} onChange={(e) => ubah(i, k, e.target.value)}
                              className={`w-full rounded border border-slate-300 px-1.5 py-1 ${
                                k === "jumlah" ? "text-center tabular-nums" : ""}`} />
                          </td>
                        ))}
                        <td className="px-2 py-1 text-center">
                          <button onClick={() => hapus(i)} className="text-rose-400 hover:text-rose-600">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Periksa jumlah dan part number-nya — dua hal itu yang paling sering meleset saat borang tulisan
                tangan dibaca, dan paling mahal akibatnya kalau salah masuk ke SPPBJ.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t bg-slate-50 px-5 py-3">
          <button onClick={tutup} className="btn btn-ghost text-xs">Tutup</button>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => navigator.clipboard?.writeText(
              baris.map((b, i) => `${i + 1}. ${b.nama}${b.spesifikasi ? ` (${b.spesifikasi})` : ""} — ${keJumlah(b.jumlah)} ${b.satuan || "pcs"}`).join("\n"))}
              disabled={!baris.length} className="btn btn-ghost text-xs disabled:opacity-40">
              ⧉ Salin daftar
            </button>
            <button onClick={keSppbj} disabled={!baris.length || sibuk}
              className="btn btn-primary text-xs disabled:opacity-40">
              ➜ Buat SPPBJ dari {baris.length} barang ini
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
