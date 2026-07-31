"use client";
/**
 * Baca borang permintaan kapal (PDF pindaian / foto) lalu ubah jadi baris
 * Repair List atau RAB penunjang.
 *
 * Hasil bacaan TIDAK langsung masuk. Semua baris ditampilkan dulu berikut
 * tebakan golongannya, dan tiap baris bisa dicoret. Ini borang hasil pindai
 * tulisan lapangan — pembacaan mesin harus dilihat manusia sebelum jadi usulan
 * ke pusat.
 */
import { useState } from "react";
import { BarisBorang, HasilBorang, golongkan } from "@/lib/docking/rencana/borang";
import { bacaBorang, OllamaBelumSiap, jalurBaca, PilihModel } from "@/lib/docking/rencana/bacaBorang";
import { ItemRl, ItemPenunjang, rlBaru, penunjangBaru } from "@/lib/docking/rencana/types";

/** tebak kelompok RAB penunjang dari judul bagian yang ditulis kapal */
function kelompokPermintaan(bagian: string): { kelompok: string; grup: string } {
  const t = (bagian || "").toLowerCase();
  if (/bottom|botop|bottop|garis air|aga|lambung|rampdoor|cardeck|void|tank/.test(t)) {
    // cat lambung bawah garis air masuk pemeliharaan kapal; sisanya akomodasi
    return /bottom|botop|bottop|bga/.test(t)
      ? { kelompok: "roro", grup: "Cat BGA" }
      : { kelompok: "akomodasi", grup: "Cat AGA" };
  }
  if (/alat kerja|perkakas|deck/.test(t)) return { kelompok: "akomodasi", grup: "Alat Kerja Deck" };
  if (/keselamatan|lsa|ffa/.test(t)) return { kelompok: "akomodasi", grup: "Alat Keselamatan" };
  if (/suku cadang|sparepart|mesin/.test(t)) return { kelompok: "permesinan", grup: "Suku Cadang Mesin Induk" };
  return { kelompok: "akomodasi", grup: "Pemeliharaan Deck" };
}

export default function BacaBorang({ onTutup, onTerap }: {
  onTutup: () => void;
  onTerap: (rl: ItemRl[], penunjang: ItemPenunjang[]) => void;
}) {
  const [hasil, setHasil] = useState<HasilBorang | null>(null);
  const [sibuk, setSibuk] = useState("");
  const [maju, setMaju] = useState<{ halaman: number; total: number } | null>(null);
  const [kecil, setKecil] = useState(false);
  const [galat, setGalat] = useState("");
  const [buang, setBuang] = useState<Record<number, boolean>>({});
  const [namaBerkas, setNamaBerkas] = useState("");
  const [model, setModel] = useState<PilihModel>("teliti");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");

  const pilihBerkas = async (f: File | null) => {
    if (!f) return;
    setGalat(""); setHasil(null); setBuang({}); setNamaBerkas(f.name);
    try {
      const h = await bacaBorang(f,
        ({ halaman, total }) => { setMaju({ halaman, total }); setSibuk(`membaca halaman ${halaman} dari ${total}…`); },
        { model, dari: +dari || undefined, sampai: +sampai || undefined });
      setHasil(h);
      if (!h.baris.length) setGalat("Tak ada baris yang terbaca. Coba unggah ulang dengan pindaian yang lebih terang.");
    } catch (e: any) {
      if (e instanceof OllamaBelumSiap) {
        setGalat(`${e.message}\n\nPemindaian berjalan di laptop sendiri lewat Ollama. Pastikan Ollama hidup, lalu ulangi.`);
      } else setGalat(e?.message || String(e));
    } finally { setSibuk(""); setMaju(null); setKecil(false); }
  };

  const terap = () => {
    if (!hasil) return;
    const dipakai = hasil.baris.filter((_, i) => !buang[i]);
    if (hasil.jenis === "permintaan") {
      onTerap([], dipakai.map((b) => {
        const k = kelompokPermintaan(b.bagian);
        return penunjangBaru({
          kelompok: k.kelompok, grup: k.grup, uraian: b.uraian,
          spek: b.merk || "", satuan: b.unit || "Ls", vol: b.qty || 1, harga: 0,
        });
      }));
    } else {
      onTerap(dipakai.map((b) => {
        const g = golongkan(b);
        return rlBaru({
          jenis: "dok", kode: g.kode, bagian: g.romawi, grup: g.bagian,
          uraian: b.uraian, satuan: b.unit || "Ls", vol: b.qty || 1, harga: 0,
          sumber: "manual", ket: b.ket,
        });
      }), []);
    }
    onTutup();
  };

  const jml = hasil ? hasil.baris.length - Object.values(buang).filter(Boolean).length : 0;

  // Menutup jendela ini akan MEMBONGKARnya, dan pembacaan yang sedang jalan ikut
  // berhenti di tengah. Jadi selama sibuk, tutup diarahkan jadi "kecilkan".
  const tutupAman = () => { if (sibuk) setKecil(true); else onTutup(); };
  const persen = maju && maju.total ? Math.round((maju.halaman / maju.total) * 100) : 0;

  if (kecil) {
    return (
      <div className="fixed bottom-4 right-4 z-[60] w-80 bg-white rounded-2xl elev-lg ring-line overflow-hidden">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg asdp-gradient text-white grid place-items-center text-xs shrink-0">📄</span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-bold text-slate-800 truncate">{sibuk ? "Membaca permintaan kapal" : "Bacaan selesai"}</span>
              <span className="block text-[10px] text-slate-500 truncate" title={namaBerkas}>{namaBerkas}</span>
            </span>
            <button onClick={() => setKecil(false)} className="text-[11px] font-semibold text-[#1ca3dd] hover:underline shrink-0">Buka</button>
          </div>
          {maju && (
            <>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                <div className="h-full asdp-gradient transition-all" style={{ width: `${persen}%` }} />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 tabular-nums">
                halaman {maju.halaman} dari {maju.total} · {persen}%
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-[2px] p-4 overflow-y-auto" onClick={tutupAman}>
      <div className="max-w-4xl mx-auto my-6 bg-white rounded-2xl elev-lg ring-line overflow-hidden flex flex-col max-h-[88vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <span className="h-9 w-9 rounded-xl asdp-gradient text-white grid place-items-center text-sm shrink-0">📄</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 leading-tight">Baca permintaan dari kapal</h3>
            <p className="text-xs text-slate-500">
              Daftar Pekerjaan Docking (TF-102.01.01) atau Permintaan Pengadaan (HP-103.00.01) — PDF pindaian atau foto
            </p>
          </div>
          {sibuk && (
            <button onClick={() => setKecil(true)} className="btn btn-ghost text-xs shrink-0"
              title="Kecilkan — pembacaan tetap jalan di latar">— Kecilkan</button>
          )}
          <button onClick={tutupAman} className="text-slate-400 hover:text-slate-700 text-lg px-1"
            title={sibuk ? "Kecilkan (pembacaan masih jalan)" : "Tutup"}>✕</button>
        </div>

        <div className="p-5 space-y-3 flex-1 overflow-y-auto">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-600">Cara baca</span>
              <select value={model} onChange={(e) => setModel(e.target.value as PilihModel)} disabled={!!sibuk}
                className="mt-1 block rounded-lg border border-slate-300 px-2 py-2 text-sm bg-white">
                <option value="teliti">Teliti — ± 9 menit/halaman</option>
                <option value="cepat">Cepat — ± 20 detik/halaman</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-600">Halaman</span>
              <span className="mt-1 flex items-center gap-1">
                <input value={dari} onChange={(e) => setDari(e.target.value)} placeholder="dari" disabled={!!sibuk}
                  className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-sm tabular-nums" />
                <span className="text-slate-400 text-xs">–</span>
                <input value={sampai} onChange={(e) => setSampai(e.target.value)} placeholder="sampai" disabled={!!sibuk}
                  className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-sm tabular-nums" />
              </span>
            </label>
            <p className="text-[11px] text-slate-500 flex-1 min-w-[14rem] pb-2">
              <b>Teliti</b> untuk borang Permintaan Pengadaan yang berkolom banyak — model kecil sering menukar
              kolom Merk dengan Uraian di sana. <b>Cepat</b> memadai untuk Daftar Pekerjaan Docking.
              Kosongkan halaman untuk membaca semuanya.
            </p>
          </div>

          <label className="block rounded-xl ring-1 ring-dashed ring-slate-300 bg-slate-50/60 px-4 py-6 text-center cursor-pointer hover:bg-slate-50">
            <input type="file" accept="application/pdf,image/*" className="hidden"
              onChange={(e) => pilihBerkas(e.target.files?.[0] || null)} disabled={!!sibuk} />
            <span className="block text-sm font-semibold text-slate-700">
              {sibuk ? sibuk : namaBerkas || "Pilih berkas PDF / foto"}
            </span>
            <span className="block text-[11px] text-slate-500 mt-1">
              Dibaca di laptop ini lewat Ollama — isi dokumen tidak dikirim ke mana pun
            </span>
            {maju && (
              <span className="block mt-3 max-w-sm mx-auto">
                <span className="block h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <span className="block h-full asdp-gradient transition-all" style={{ width: `${persen}%` }} />
                </span>
                <span className="block text-[11px] text-slate-500 mt-1 tabular-nums">{persen}% · boleh dikecilkan, bacaan tetap jalan</span>
              </span>
            )}
          </label>

          {galat && <p className="text-xs text-rose-800 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2 whitespace-pre-line">{galat}</p>}

          {hasil && hasil.baris.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-semibold text-slate-700">
                  {hasil.jenis === "permintaan" ? "Permintaan Pengadaan (HP-103.00.01)" : "Daftar Pekerjaan Docking (TF-102.01.01)"}
                </span>
                {hasil.kapal && <span className="text-slate-500">· {hasil.kapal}</span>}
                {hasil.noSurat && <span className="text-slate-500">· {hasil.noSurat}</span>}
                <span className="text-slate-400">· dibaca lewat {jalurBaca === "peramban" ? "peramban → Ollama laptop" : "Ollama laptop"}</span>
              </div>

              <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-slate-100 text-[10px] uppercase text-slate-600">
                    <tr>
                      <th className="px-2 py-1.5 w-8" />
                      <th className="px-2 py-1.5 text-left w-16">Hal</th>
                      <th className="px-2 py-1.5 text-left">Uraian terbaca</th>
                      <th className="px-2 py-1.5 text-right w-14">Vol</th>
                      <th className="px-2 py-1.5 text-left w-16">Sat</th>
                      <th className="px-2 py-1.5 text-left w-56">Digolongkan ke</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hasil.baris.map((b: BarisBorang, i) => {
                      const g = hasil.jenis === "permintaan" ? null : golongkan(b);
                      const k = hasil.jenis === "permintaan" ? kelompokPermintaan(b.bagian) : null;
                      const dicoret = !!buang[i];
                      return (
                        <tr key={i} className={`border-t border-slate-100 align-top ${dicoret ? "opacity-40" : ""}`}>
                          <td className="px-2 py-1.5">
                            <input type="checkbox" checked={!dicoret} onChange={(e) => setBuang((p) => ({ ...p, [i]: !e.target.checked }))} />
                          </td>
                          <td className="px-2 py-1.5 text-slate-400 tabular-nums">{b.halaman || "-"}</td>
                          <td className="px-2 py-1.5">
                            <span className="block text-slate-800 whitespace-pre-line leading-snug">{b.uraian}</span>
                            {b.bagian && <span className="block text-[10px] text-slate-400">{b.romawi ? `${b.romawi}. ` : ""}{b.bagian}</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{b.qty || ""}</td>
                          <td className="px-2 py-1.5">{b.unit}</td>
                          <td className="px-2 py-1.5">
                            {g ? (
                              <span className={g.kode ? "text-slate-600" : "text-amber-700"}>
                                {g.kode ? `${g.kode} · ${g.bagian}` : g.bagian}
                              </span>
                            ) : (
                              <span className="text-slate-600">{k!.kelompok} · {k!.grup}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500">
                Golongan di atas hanya tebakan dari kata kunci — periksa yang bertanda kuning
                (&ldquo;perlu ditetapkan&rdquo;). Harga belum diisi; isi setelahnya lewat tarif galangan atau database harga.
              </p>
            </>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
          <span className="text-xs text-slate-500">{hasil ? `${jml} baris akan dimasukkan` : "belum ada berkas"}</span>
          <span className="flex-1" />
          <button onClick={tutupAman} className="btn btn-ghost text-xs">{sibuk ? "Kecilkan" : "Batal"}</button>
          <button onClick={terap} disabled={!jml} className="btn btn-primary text-xs px-4 disabled:opacity-40">Masukkan {jml || ""}</button>
        </div>
      </div>
    </div>
  );
}
