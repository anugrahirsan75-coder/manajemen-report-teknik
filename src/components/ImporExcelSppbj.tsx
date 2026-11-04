"use client";

import { useState } from "react";

/**
 * Unggah berkas SPPB/J dari laptop mana pun.
 *
 * Pasangan tombol di dalam Excel: tidak butuh makro, tidak butuh pasang apa pun,
 * dan tetap jalan di laptop yang makronya diblokir atau bukan Excel Windows.
 * Berkasnya dibaca di server dengan aturan yang sama (lib/sppbj/dariExcel.ts).
 */
type Jenis = "rutin" | "docking";

interface Hasil {
  lembar: string;
  kode: "SIAP" | "TERKIRIM" | "GAGAL" | "TERKUNCI";
  pesan: string;
  namaPengadaan?: string;
  catatan?: string[];
  ringkas?: { item: number; jumlah: number; kapal: string[]; perMa: { ma: string; item: number; nilai: number }[] };
}

const rupiah = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const LABEL: Record<Hasil["kode"], string> = {
  SIAP: "BARU", TERKIRIM: "TERKIRIM", GAGAL: "GAGAL", TERKUNCI: "SUDAH ADA, TIDAK DIUBAH",
};
const WARNA: Record<Hasil["kode"], string> = {
  SIAP: "bg-sky-100 text-sky-800",
  TERKIRIM: "bg-emerald-100 text-emerald-800",
  GAGAL: "bg-rose-100 text-rose-800",
  TERKUNCI: "bg-slate-200 text-slate-700",
};

export default function ImporExcelSppbj({ tutup, selesai }: { tutup: () => void; selesai: () => void }) {
  const [berkas, setBerkas] = useState<File | null>(null);
  const [hasil, setHasil] = useState<Hasil[]>([]);
  const [pilih, setPilih] = useState<string[]>([]);
  const [jenis, setJenis] = useState<Record<string, Jenis>>({});
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const kirim = async (f: File, aksi: "cek" | "kirim", daftar: string[] | null) => {
    const form = new FormData();
    form.append("berkas", f);
    form.append("aksi", aksi);
    if (daftar) form.append("pilih", JSON.stringify(daftar));
    form.append("jenis", JSON.stringify(jenis));
    const res = await fetch("/api/sppbj/dari-excel", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Gagal (${res.status})`);
    return data.hasil as Hasil[];
  };

  const baca = async (f: File) => {
    setBerkas(f); setHasil([]); setPilih([]); setJenis({}); setGalat(""); setSibuk(true);
    try {
      setHasil(await kirim(f, "cek", null));
    } catch (e: any) { setGalat(e?.message || String(e)); }
    setSibuk(false);
  };

  const pilihJenis = (lembar: string, j: Jenis) => {
    setJenis((m) => ({ ...m, [lembar]: j }));
    setPilih((p) => (p.includes(lembar) ? p : [...p, lembar]));
  };

  const simpan = async () => {
    if (!berkas || !pilih.length) return;
    setSibuk(true); setGalat("");
    try {
      const h = await kirim(berkas, "kirim", pilih);
      setHasil((l) => l.map((x) => h.find((y) => y.lembar === x.lembar) || x));
      setPilih([]);
      selesai();
    } catch (e: any) { setGalat(e?.message || String(e)); }
    setSibuk(false);
  };

  const lengkap = pilih.length > 0 && pilih.every((l) => jenis[l]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 grid place-items-center p-4" onClick={tutup}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold text-slate-800">Impor dari Excel</h2>
          <button onClick={tutup} className="text-slate-400 hover:text-slate-700 text-xl leading-none" aria-label="Tutup">×</button>
        </div>
        <p className="text-sm text-slate-600 mb-3">
          Pilih berkas SPPB/J (.xlsx atau .xlsm) yang sudah disimpan. Judul, MA, DRP, dan item dibaca otomatis; simpan dulu berkasnya di Excel supaya angkanya terbaru.
        </p>
        <label className="block rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/40 p-5 text-center cursor-pointer hover:bg-sky-50">
          <input type="file" accept=".xlsx,.xlsm" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void baca(f); e.target.value = ""; }} />
          <span className="text-sm font-semibold text-sky-800">{berkas ? berkas.name : "Klik untuk memilih berkas"}</span>
        </label>

        {sibuk && <p className="text-sm text-slate-500 mt-3">Membaca…</p>}
        {!!galat && <p className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-sm text-rose-800">{galat}</p>}

        {!!hasil.length && (
          <div className="mt-4 space-y-2">
            {hasil.map((h) => {
              const bisa = h.kode === "SIAP";
              return (
                <div key={h.lembar} className="rounded-xl border p-3">
                  <div className="flex items-start gap-2.5">
                    {bisa && (
                      <input type="checkbox" className="mt-1" aria-label={`Kirim sheet ${h.lembar}`} checked={pilih.includes(h.lembar)}
                        onChange={(e) => setPilih((p) => (e.target.checked ? [...p, h.lembar] : p.filter((x) => x !== h.lembar)))} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-sm text-slate-800">{h.namaPengadaan || h.lembar}</b>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${WARNA[h.kode]}`}>
                          {LABEL[h.kode]}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Sheet {h.lembar}
                        {h.ringkas ? ` · ${h.ringkas.item} item · ${rupiah(h.ringkas.jumlah)} · ${h.ringkas.kapal.join(", ") || "tanpa kapal"}` : ""}
                      </p>
                      {!bisa && <p className="text-xs text-slate-700 whitespace-pre-line mt-1">{h.pesan}</p>}
                      {!!h.ringkas?.perMa?.length && bisa && (
                        <p className="text-[11px] text-slate-600 mt-1">
                          {h.ringkas.perMa.map((m) => `${m.ma.slice(0, 10)}: ${m.item} item, ${rupiah(m.nilai)}`).join(" · ")}
                        </p>
                      )}
                      {!!h.catatan?.length && bisa && (
                        <ul className="mt-1 text-[11px] text-amber-800 list-disc ml-4">
                          {h.catatan.slice(0, 5).map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      )}
                      {bisa && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-600">Kirim sebagai:</span>
                          {(["rutin", "docking"] as Jenis[]).map((j) => (
                            <button key={j} type="button" onClick={() => pilihJenis(h.lembar, j)} aria-pressed={jenis[h.lembar] === j}
                              className={`text-xs font-semibold px-3 py-1 rounded-lg border ${jenis[h.lembar] === j ? "bg-sky-700 border-sky-700 text-white" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
                              {j === "rutin" ? "Rutin" : "Docking"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={tutup} className="btn btn-ghost text-sm">Tutup</button>
          {hasil.some((h) => h.kode === "SIAP") && (
            <button onClick={simpan} disabled={sibuk || !lengkap} className="btn btn-primary text-sm disabled:opacity-50">
              Kirim {pilih.length} lembar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
