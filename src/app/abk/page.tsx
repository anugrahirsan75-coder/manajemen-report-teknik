"use client";
/**
 * Rekap Awak Kapal & Penanda Tangan.
 *
 * Menjawab satu pertanyaan yang selalu muncul saat menyusun BA, SPPBJ, atau
 * laporan: siapa Nakhoda dan KKM kapal ini. Sebelum ada layar ini jawabannya
 * dicari dengan membuka berkas pindaian satu per satu.
 *
 * Yang disimpan nama dan jabatannya, bukan gambar tanda tangannya — lihat
 * alasannya di src/lib/abk/types.ts.
 */
import { useMemo, useState } from "react";
import { useAbk } from "@/lib/abk/store";
import { Awak, KapalAwak, awakBaru, JABATAN_UMUM, penandaUtama, rapiJabatan, urutanJabatan } from "@/lib/abk/types";
import { KAPAL_LIST } from "@/lib/sppbj/db";
import { Ikon } from "@/components/ikon";
import { beritahu, konfirmasi } from "@/components/Konfirmasi";

const ringkas = (k: string) => k.replace(/^KMP\.?\s*/i, "");
const norm = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

export default function RekapAbk() {
  const { list, loading, galat, reload, simpan } = useAbk();
  const [kapal, setKapal] = useState(KAPAL_LIST[0]);
  const [cari, setCari] = useState("");
  const [edit, setEdit] = useState(false);
  const [draf, setDraf] = useState<Awak[]>([]);
  const [sibuk, setSibuk] = useState(false);

  const data: KapalAwak | undefined = list.find((x) => x.kapal === kapal);
  const awak = data?.awak || [];
  const utama = penandaUtama(data);

  /** pencarian menyapu SEMUA kapal: nama orang lebih sering diingat daripada kapalnya */
  const hasilCari = useMemo(() => {
    const q = norm(cari);
    if (!q) return [];
    const out: { kapal: string; a: Awak }[] = [];
    for (const k of list) {
      for (const a of k.awak || []) {
        const hay = norm(`${a.nama} ${a.jabatan} ${a.nik || ""} ${a.coc || ""}`);
        if (hay.includes(q)) out.push({ kapal: k.kapal, a });
      }
    }
    return out.slice(0, 80);
  }, [cari, list]);

  const mulaiEdit = () => { setDraf(awak.length ? awak.map((a) => ({ ...a })) : [awakBaru()]); setEdit(true); };
  const ubah = (i: number, p: Partial<Awak>) =>
    setDraf((d) => d.map((a, j) => (j === i ? { ...a, ...p } : a)));
  const tambahBaris = () => setDraf((d) => [...d, awakBaru()]);
  const hapusBaris = (i: number) => setDraf((d) => d.filter((_, j) => j !== i));

  const simpanDraf = async () => {
    const bersih = draf
      .map((a) => ({ ...a, nama: a.nama.trim(), jabatan: rapiJabatan(a.jabatan) }))
      .filter((a) => a.nama && a.jabatan);
    if (!bersih.length) { await beritahu("Belum ada baris terisi (nama dan jabatan wajib)."); return; }
    setSibuk(true);
    try {
      await simpan({ kapal, awak: bersih, sumber: data?.sumber });
      setEdit(false);
    } catch (e: any) { await beritahu("Gagal menyimpan: " + (e?.message ?? e)); }
    finally { setSibuk(false); }
  };

  const batal = async () => {
    if (JSON.stringify(draf) !== JSON.stringify(awak) &&
        !(await konfirmasi({ nada: "bahaya", ikon: "✏️", judul: "Buang perubahan?",
                             pesan: "Suntingan daftar awak belum disimpan.", tombolYa: "Ya, buang" }))) return;
    setEdit(false);
  };

  const salin = async (teks: string) => {
    try { await navigator.clipboard.writeText(teks); } catch { await beritahu("Gagal menyalin."); }
  };

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-5 flex items-center gap-4">
          <span className="bg-white rounded-2xl p-3 shadow-md shrink-0 text-[#16357f]"><Ikon nama="kapal" className="w-6 h-6" /></span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold asdp-text-gradient">Rekap Awak Kapal &amp; Penanda Tangan</h1>
            <p className="text-slate-500 text-sm">
              {list.reduce((s, k) => s + (k.awak?.length || 0), 0)} orang · {list.length} kapal ·
              nama &amp; jabatan penanda tangan untuk BA, SPPBJ, dan laporan
            </p>
          </div>
          <button onClick={reload} disabled={loading} className="btn btn-ghost text-xs disabled:opacity-50">
            {loading ? "memuat…" : "⟲ Muat ulang"}
          </button>
        </div>
      </div>

      {galat && (
        <p className="mt-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2">
          Daftar dari server gagal dimuat: {galat} — yang tampil daftar tersimpan/bibit.
        </p>
      )}

      {/* pencarian lintas kapal */}
      <div className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 p-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-400"><Ikon nama="kaca" className="w-4 h-4" /></span>
          <input value={cari} onChange={(e) => setCari(e.target.value)}
            placeholder="cari nama / jabatan / NIK di seluruh kapal… (mis. nakhoda, atau SURYADI)"
            className="flex-1 text-sm border rounded-lg px-3 py-2 focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/20 outline-none" />
          {cari && <button onClick={() => setCari("")} className="text-xs text-slate-500 underline">hapus</button>}
        </div>
        {cari && (
          <div className="mt-2 max-h-64 overflow-auto rounded-lg border">
            {hasilCari.length === 0 && <p className="p-3 text-xs text-slate-400">Tak ada yang cocok.</p>}
            {hasilCari.map(({ kapal: k, a }, i) => (
              <button key={i} onClick={() => { setKapal(k); setCari(""); }}
                className="w-full text-left px-3 py-2 border-b last:border-0 hover:bg-sky-50 flex items-center gap-3">
                <span className="text-xs font-bold text-slate-800 flex-1">{a.nama}</span>
                <span className="text-[11px] text-slate-500 w-40">{a.jabatan}</span>
                <span className="text-[11px] font-semibold text-[#16357f] w-32 text-right">{ringkas(k)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* pilih kapal */}
      <div className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 p-3">
        <div className="flex flex-wrap gap-1.5">
          {KAPAL_LIST.map((k) => {
            const n = list.find((x) => x.kapal === k)?.awak?.length || 0;
            return (
              <button key={k} onClick={() => { setKapal(k); setEdit(false); }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                  k === kapal ? "bg-[#16357f] text-white border-[#16357f]"
                              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
                {ringkas(k)} <span className={k === kapal ? "text-sky-200" : "text-slate-400"}>({n})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* penanda tangan utama */}
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
        {([["Nakhoda", utama.nakhoda], ["KKM / Masinis I", utama.kkm],
           ["Mualim I", utama.mualim1], ["Masinis II", utama.masinis2]] as const).map(([label, a]) => (
          <div key={label} className="rounded-xl bg-white ring-1 ring-slate-200 p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`text-sm font-bold mt-0.5 ${a ? "text-slate-900" : "text-slate-300"}`}>
              {a?.nama || "— belum ada —"}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-slate-400">{a?.coc || ""}</span>
              {a && (
                <button onClick={() => salin(a.nama)} title="Salin nama"
                  className="ml-auto text-[10px] text-[#16357f] hover:underline flex items-center gap-1">
                  <Ikon nama="salin" className="w-3 h-3" /> salin
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* daftar awak */}
      <div className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50 flex flex-wrap items-center gap-2">
          <div>
            <h2 className="font-bold text-slate-800">{kapal}</h2>
            <p className="text-[11px] text-slate-500">
              {awak.length} orang{data?.sumber ? ` · sumber: ${data.sumber}` : ""}
              {data?.diubahPada ? ` · diubah ${new Date(data.diubahPada).toLocaleDateString("id-ID")}` : ""}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!edit ? (
              <>
                <button onClick={() => salin(awak.map((a) => `${a.jabatan}\t${a.nama}`).join("\n"))}
                  disabled={!awak.length} className="btn btn-ghost text-xs disabled:opacity-40">📋 Salin daftar</button>
                <button onClick={mulaiEdit} className="btn btn-primary text-xs">✏️ Ubah daftar</button>
              </>
            ) : (
              <>
                <button onClick={tambahBaris} className="btn btn-ghost text-xs">＋ Baris</button>
                <button onClick={batal} className="btn btn-ghost text-xs">Batal</button>
                <button onClick={simpanDraf} disabled={sibuk} className="btn btn-primary text-xs disabled:opacity-50">
                  {sibuk ? "…" : "💾 Simpan"}
                </button>
              </>
            )}
          </div>
        </div>

        {!edit ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600 text-xs">
                <tr>
                  <th className="p-2 w-10 text-center">No</th>
                  <th className="p-2 text-left">Nama</th>
                  <th className="p-2 text-left w-44">Jabatan</th>
                  <th className="p-2 text-left w-28">NIK</th>
                  <th className="p-2 text-center w-20">COC</th>
                  <th className="p-2 text-center w-28">TMT</th>
                </tr>
              </thead>
              <tbody>
                {awak.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-400 text-xs">
                    Belum ada daftar awak untuk {kapal}. Klik <b>Ubah daftar</b> untuk mengisinya.
                  </td></tr>
                )}
                {awak.map((a, i) => {
                  const pejabat = urutanJabatan(a.jabatan) <= 5;
                  return (
                    <tr key={i} className={`border-b ${pejabat ? "bg-amber-50/50" : ""}`}>
                      <td className="p-2 text-center text-slate-400">{i + 1}</td>
                      <td className={`p-2 ${pejabat ? "font-bold text-slate-900" : "text-slate-700"}`}>{a.nama}</td>
                      <td className="p-2 text-slate-600">{a.jabatan}</td>
                      <td className="p-2 text-slate-500 font-mono text-[11px]">{a.nik}</td>
                      <td className="p-2 text-center text-slate-500 text-xs">{a.coc}</td>
                      <td className="p-2 text-center text-slate-500 text-xs">{a.tmt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-3">
            <datalist id="jabatanAbk">{JABATAN_UMUM.map((j) => <option key={j} value={j} />)}</datalist>
            {draf.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span className="w-6 text-[11px] text-slate-400 text-center">{i + 1}</span>
                <input value={a.nama} onChange={(e) => ubah(i, { nama: e.target.value })} placeholder="Nama"
                  className="flex-1 min-w-[10rem] text-xs border rounded-lg px-2 py-1.5" />
                <input list="jabatanAbk" value={a.jabatan} onChange={(e) => ubah(i, { jabatan: e.target.value })}
                  placeholder="Jabatan" className="w-40 text-xs border rounded-lg px-2 py-1.5" />
                <input value={a.nik || ""} onChange={(e) => ubah(i, { nik: e.target.value })} placeholder="NIK"
                  className="w-28 text-xs border rounded-lg px-2 py-1.5" />
                <input value={a.coc || ""} onChange={(e) => ubah(i, { coc: e.target.value })} placeholder="COC"
                  className="w-20 text-xs border rounded-lg px-2 py-1.5" />
                <input type="date" value={a.tmt || ""} onChange={(e) => ubah(i, { tmt: e.target.value })}
                  className="w-32 text-xs border rounded-lg px-2 py-1.5" title="TMT penempatan" />
                <button onClick={() => hapusBaris(i)} title="Hapus baris"
                  className="text-slate-300 hover:text-red-600 px-1"><Ikon nama="silang" className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <p className="text-[11px] text-slate-400 mt-2">
              Baris tanpa nama atau jabatan diabaikan saat disimpan. Urutan ditata sendiri menurut jabatan.
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
        Rekap ini memuat <b>nama dan jabatan</b> penanda tangan, bukan gambar tanda tangannya.
        Kumpulan potongan tanda tangan per orang akan berfungsi sebagai stempel siap tempel —
        untuk memeriksa keaslian sebuah tanda tangan, buka berkas pindaian aslinya.
      </p>
    </main>
  );
}
