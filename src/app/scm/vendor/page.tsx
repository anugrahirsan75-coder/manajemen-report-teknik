"use client";
/**
 * Database vendor SCM.
 *
 * Isinya berawal dari sheet DATA VENDOR milik tim SCM (40 penyedia) dan kini
 * tinggal di satu tempat: dipakai saat memilih vendor undangan, dan nanti oleh
 * generator dokumen. Tiap kolom bisa disalin sekali ketuk — tim SCM sering
 * menempelkan NPWP dan alamat ke dokumen lain, dan mengetik ulang NPWP 15 digit
 * adalah cara tercepat membuat salah ketik yang tak ketahuan.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import BilahScm from "@/components/scm/BilahScm";
import { Vendor } from "@/lib/scm/types";
import { bawaanVendor, muatVendor, simpanVendor, vendorBaru } from "@/lib/scm/store";

export default function DataVendorScm() {
  const [daftar, setDaftar] = useState<Vendor[]>([]);
  const [idBaris, setIdBaris] = useState<string | null>(null);   // id baris Supabase
  const [muat, setMuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [cari, setCari] = useState("");
  const [sunting, setSunting] = useState<Vendor | null>(null);
  const [belumSimpan, setBelumSimpan] = useState(false);

  const ambil = useCallback(async () => {
    setMuat(true); setGalat("");
    try {
      const v = await muatVendor();
      setDaftar(v.daftar); setIdBaris(v.id);
      // daftar bawaan belum pernah tersimpan — tandai supaya jelas perlu disimpan sekali
      setBelumSimpan(!v.id);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);

  useEffect(() => { void ambil(); }, [ambil]);

  const beritahu = (t: string) => { setPesan(t); window.setTimeout(() => setPesan(""), 3500); };

  const simpan = async (baru: Vendor[]) => {
    setSibuk(true); setGalat("");
    try {
      const id = await simpanVendor(idBaris, baru);
      setIdBaris(id); setDaftar(baru); setBelumSimpan(false);
      beritahu("Data vendor tersimpan.");
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setSibuk(false); }
  };

  const simpanSatu = async (v: Vendor) => {
    const ada = daftar.some((x) => x.id === v.id);
    await simpan(ada ? daftar.map((x) => (x.id === v.id ? v : x)) : [...daftar, v]);
    setSunting(null);
  };

  const hapus = async (v: Vendor) => {
    if (!confirm(`Hapus vendor "${v.nama}" dari daftar?`)) return;
    await simpan(daftar.filter((x) => x.id !== v.id));
  };

  const pulihkanBawaan = async () => {
    if (!confirm("Kembalikan ke 40 vendor bawaan dari berkas SCM? Perubahan yang sudah dibuat akan hilang.")) return;
    await simpan(bawaanVendor());
  };

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return daftar;
    return daftar.filter((v) =>
      `${v.nama} ${v.pimpinan} ${v.kota} ${v.npwp} ${v.alamat} ${v.telepon}`.toLowerCase().includes(q));
  }, [daftar, cari]);

  return (
    <div className="min-h-screen bg-slate-100">
      <BilahScm aksi={
        <button onClick={() => setSunting(vendorBaru())} className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25">
          ＋ Vendor
        </button>
      } />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-slate-800">Data Vendor</h1>
            <p className="text-sm text-slate-500">
              {daftar.length} penyedia barang &amp; jasa. Ketuk nilai apa pun untuk menyalinnya.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama / kota / NPWP…"
              className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-sky-400" />
            <button onClick={ambil} disabled={muat} className="btn btn-ghost text-xs disabled:opacity-50">↻ Muat ulang</button>
          </div>
        </div>

        {pesan && <div className="anim-in mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">✓ {pesan}</div>}
        {galat && <div className="anim-in mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{galat}</div>}
        {belumSimpan && !muat && (
          <div className="anim-in mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
            <span>Daftar ini masih bawaan dari berkas SCM dan belum tersimpan di basis data.</span>
            <button onClick={() => simpan(daftar)} disabled={sibuk} className="btn btn-primary text-xs disabled:opacity-50">
              {sibuk ? "Menyimpan…" : "Simpan sekarang"}
            </button>
          </div>
        )}

        {muat ? (
          <p className="py-10 text-center text-sm text-slate-400">Memuat data vendor…</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="w-full min-w-[72rem] text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-left font-extrabold">No</th>
                  <th className="px-3 py-2.5 text-left font-extrabold">Nama Vendor</th>
                  <th className="px-3 py-2.5 text-left font-extrabold">Pimpinan</th>
                  <th className="px-3 py-2.5 text-left font-extrabold">Jabatan</th>
                  <th className="px-3 py-2.5 text-left font-extrabold">Telepon</th>
                  <th className="px-3 py-2.5 text-left font-extrabold">NPWP</th>
                  <th className="px-3 py-2.5 text-left font-extrabold">Alamat</th>
                  <th className="px-3 py-2.5 text-left font-extrabold">Kota</th>
                  <th className="w-24 px-3 py-2.5 text-center font-extrabold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((v, i) => (
                  <tr key={v.id} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
                    <td className="px-3 py-2 text-xs text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2"><Salin nilai={v.nama} tebal /></td>
                    <td className="px-3 py-2"><Salin nilai={v.pimpinan} /></td>
                    <td className="px-3 py-2"><Salin nilai={v.jabatan} /></td>
                    <td className="px-3 py-2"><Salin nilai={v.telepon || ""} /></td>
                    <td className="px-3 py-2"><Salin nilai={v.npwp || ""} mono /></td>
                    <td className="max-w-[18rem] px-3 py-2"><Salin nilai={v.alamat || ""} /></td>
                    <td className="px-3 py-2"><Salin nilai={v.kota || ""} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => salinSemua(v, beritahu)} title="Salin seluruh data vendor ini"
                          className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">📋</button>
                        <button onClick={() => setSunting({ ...v })} className="rounded-lg px-2 py-1 text-xs text-sky-700 hover:bg-sky-50">Ubah</button>
                        <button onClick={() => hapus(v)} className="rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!tampil.length && (
                  <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-slate-400">
                    {cari ? "Tidak ada vendor yang cocok dengan pencarian." : "Belum ada vendor."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={() => setSunting(vendorBaru())} className="btn btn-primary text-xs">＋ Tambah vendor</button>
          <button onClick={pulihkanBawaan} disabled={sibuk} className="btn btn-ghost text-xs disabled:opacity-50">
            ↺ Kembalikan 40 vendor bawaan
          </button>
          <span className="text-[11px] text-slate-400">
            Perubahan tersimpan ke basis data yang sama dengan aplikasi Teknik, jadi terbaca dari mana saja.
          </span>
        </div>
      </main>

      {sunting && (
        <FormVendor v={sunting} sibuk={sibuk} onTutup={() => setSunting(null)} onSimpan={simpanSatu} />
      )}
    </div>
  );
}

/** salin isi seluruh baris — bentuknya siap tempel ke dokumen atau pesan */
async function salinSemua(v: Vendor, beritahu: (t: string) => void) {
  const teks = [
    v.nama, v.pimpinan && `${v.pimpinan}${v.jabatan ? ` (${v.jabatan})` : ""}`,
    v.alamat, v.kota, v.npwp && `NPWP: ${v.npwp}`, v.telepon && `Telp: ${v.telepon}`,
  ].filter(Boolean).join("\n");
  try { await navigator.clipboard.writeText(teks); beritahu(`Data ${v.nama} disalin.`); }
  catch { beritahu("Peramban menolak menyalin."); }
}

/** satu nilai yang bisa diketuk untuk disalin */
function Salin({ nilai, tebal, mono }: { nilai: string; tebal?: boolean; mono?: boolean }) {
  const [ok, setOk] = useState(false);
  if (!nilai) return <span className="text-slate-300">—</span>;
  const salin = async () => {
    try {
      await navigator.clipboard.writeText(nilai);
      setOk(true); window.setTimeout(() => setOk(false), 1200);
    } catch { /* peramban menolak — biarkan, teksnya masih bisa disorot sendiri */ }
  };
  return (
    <button onClick={salin} title="Ketuk untuk menyalin"
      className={`group max-w-full rounded px-1 -mx-1 text-left leading-snug transition hover:bg-sky-50 ${
        tebal ? "font-bold text-slate-800" : "text-slate-600"} ${mono ? "font-mono text-[12px]" : ""}`}>
      <span className="break-words">{nilai}</span>
      <span className={`ml-1 text-[10px] ${ok ? "text-emerald-600" : "text-slate-300 opacity-0 group-hover:opacity-100"}`}>
        {ok ? "tersalin" : "⧉"}
      </span>
    </button>
  );
}

function FormVendor({ v, sibuk, onTutup, onSimpan }: {
  v: Vendor; sibuk: boolean; onTutup: () => void; onSimpan: (v: Vendor) => void;
}) {
  const [isi, setIsi] = useState<Vendor>(v);
  const ubah = (k: keyof Vendor, val: string) => setIsi((x) => ({ ...x, [k]: val }));
  const kelas = "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-sky-400";
  const label = "mb-1 block text-[11px] font-bold text-slate-600";

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-auto bg-black/50 p-3" onMouseDown={onTutup}>
      <div className="my-6 w-full max-w-2xl rounded-3xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="font-extrabold text-slate-800">{v.nama ? "Ubah vendor" : "Vendor baru"}</h3>
          <button onClick={onTutup} className="text-xl leading-none text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Nama vendor *</label>
            <input value={isi.nama} onChange={(e) => ubah("nama", e.target.value)} autoFocus
              placeholder="PT Baracuda Bintang Sentosa" className={kelas} />
          </div>
          <div>
            <label className={label}>Pimpinan</label>
            <input value={isi.pimpinan} onChange={(e) => ubah("pimpinan", e.target.value)} className={kelas} />
          </div>
          <div>
            <label className={label}>Jabatan</label>
            <input value={isi.jabatan} onChange={(e) => ubah("jabatan", e.target.value)} placeholder="Direktur" className={kelas} />
          </div>
          <div>
            <label className={label}>Telepon</label>
            <input value={isi.telepon || ""} onChange={(e) => ubah("telepon", e.target.value)} className={kelas} />
          </div>
          <div>
            <label className={label}>Fax</label>
            <input value={isi.fax || ""} onChange={(e) => ubah("fax", e.target.value)} className={kelas} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>NPWP</label>
            <input value={isi.npwp || ""} onChange={(e) => ubah("npwp", e.target.value)}
              placeholder="92.627.756.7-075.000" className={`${kelas} font-mono`} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Alamat</label>
            <input value={isi.alamat || ""} onChange={(e) => ubah("alamat", e.target.value)} className={kelas} />
          </div>
          <div>
            <label className={label}>Kota</label>
            <input value={isi.kota || ""} onChange={(e) => ubah("kota", e.target.value)} placeholder="TERNATE" className={kelas} />
          </div>
          <div>
            <label className={label}>No. Vendor (SAP)</label>
            <input value={isi.noVendor || ""} onChange={(e) => ubah("noVendor", e.target.value)} className={kelas} />
          </div>
        </div>
        <div className="flex items-center gap-2 border-t bg-slate-50 px-5 py-3">
          <button onClick={onTutup} className="btn btn-ghost text-xs">Batal</button>
          <button onClick={() => onSimpan(isi)} disabled={sibuk || !isi.nama.trim()}
            className="btn btn-primary ml-auto text-xs disabled:opacity-40">
            {sibuk ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
