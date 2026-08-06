"use client";
/**
 * Unggah berkas -> baca -> PERIKSA -> isi tabel surat.
 *
 * Langkah "periksa" tidak boleh dilewati: hasil bacaan mesin apa pun bisa
 * meleset satu digit, dan angka di surat ini dibaca direksi. Maka baris hasil
 * selalu muncul dulu sebagai tabel yang bisa disunting, lengkap dengan jumlah
 * kasar per kolom rupiah supaya salah baca angka ketahuan sebelum ditempel.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { BERKAS_DITERIMA, Kemajuan, Mesin, TakAdaMesin, bacaBerkasTabel, namaMesin, periksaMesin } from "@/lib/surat/bacaTabel";
import { KolomTabel } from "@/lib/surat/types";
import { angkaRibuan, keAngka } from "@/lib/surat/format";

export default function UnggahTabel({
  buka, tutup, kolom, judul, konteks, jumlahBarisSekarang, terapkan,
}: {
  buka: boolean;
  tutup: () => void;
  kolom: KolomTabel[];
  judul: string;
  konteks?: string;
  jumlahBarisSekarang: number;
  terapkan: (baris: Record<string, string>[], cara: "ganti" | "tambah") => void;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [tahap, setTahap] = useState<Kemajuan>({ tahap: "" });
  const [baris, setBaris] = useState<Record<string, string>[]>([]);
  const [mesin, setMesin] = useState<Mesin | "">("");
  const [catatan, setCatatan] = useState<string[]>([]);
  const [galat, setGalat] = useState("");
  const [siap, setSiap] = useState<{ gemini: boolean; ollama: string } | null>(null);
  const [namaBerkas, setNamaBerkas] = useState<string[]>([]);
  const berkasRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!buka) return;
    setSibuk(false); setTahap({ tahap: "" }); setBaris([]); setMesin("");
    setCatatan([]); setGalat(""); setNamaBerkas([]);
    periksaMesin().then(setSiap);
  }, [buka]);

  const jalankan = useCallback(async (berkas: File[]) => {
    if (!berkas.length) return;
    setGalat(""); setSibuk(true);
    try {
      for (const f of berkas) {
        setTahap({ tahap: `Membuka ${f.name}…` });
        const hasil = await bacaBerkasTabel(f, kolom, konteks || "", setTahap);
        setBaris((lama) => [...lama, ...hasil.baris]);
        setMesin(hasil.mesin);
        setCatatan((lama) => [...lama, ...hasil.catatan]);
        setNamaBerkas((lama) => [...lama, f.name]);
        if (!hasil.baris.length) setGalat(`Tidak ada baris yang terbaca dari ${f.name}. Coba berkas lain, atau potret bagian tabelnya saja.`);
      }
    } catch (e: any) {
      console.error("[surat] gagal membaca berkas", e);   // jejak lengkap untuk menelusuri kegagalan
      setGalat(e instanceof TakAdaMesin ? e.message : `Gagal membaca: ${e?.message || e}`);
    } finally {
      setSibuk(false); setTahap({ tahap: "" });
    }
  }, [kolom, konteks]);

  // tempel screenshot langsung dengan Ctrl+V
  useEffect(() => {
    if (!buka) return;
    const onPaste = (e: ClipboardEvent) => {
      const gambar = Array.from(e.clipboardData?.items || [])
        .filter((it) => it.type.startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter(Boolean) as File[];
      if (gambar.length) { e.preventDefault(); jalankan(gambar); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [buka, jalankan]);

  if (!buka) return null;

  const setSel = (i: number, kol: string, v: string) =>
    setBaris((lama) => lama.map((r, k) => (k === i ? { ...r, [kol]: v } : r)));
  const hapus = (i: number) => setBaris((lama) => lama.filter((_, k) => k !== i));

  const kolomRupiah = kolom.filter((k) => k.jenis === "rupiah");
  const jumlahKolom = (id: string) => baris.reduce((s, r) => s + keAngka(r[id]), 0);
  const kosongPenting = baris.filter((r) => kolom.some((k) => k.jenis === "rupiah" && !keAngka(r[k.id]))).length;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-auto bg-black/50 p-3" onMouseDown={tutup}>
      <div className="my-4 w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900" onMouseDown={(e) => e.stopPropagation()}>

        {/* kepala */}
        <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div>
            <h3 className="font-extrabold text-slate-800 dark:text-white">📄 Isi “{judul}” dari berkas</h3>
            <p className="text-[11px] text-slate-500">Excel, CSV, PDF, atau foto/screenshot → dibaca → <b>periksa</b> → tempel ke tabel.</p>
          </div>
          <button onClick={tutup} className="text-xl leading-none text-slate-400 hover:text-slate-700">✕</button>
        </div>

        {/* mesin yang siap */}
        {siap && (
          <div className="flex flex-wrap items-center gap-2 border-b px-5 py-1.5 text-[11px] dark:border-slate-700">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">📗 Excel/CSV: dibaca langsung, tanpa AI</span>
            <span className={`rounded px-1.5 py-0.5 font-semibold ${siap.gemini ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
              ☁️ AI cloud {siap.gemini ? "siap" : "— GEMINI_API_KEY belum diset"}
            </span>
            <span className={`rounded px-1.5 py-0.5 font-semibold ${siap.ollama ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
              🖥️ AI lokal {siap.ollama ? `siap (${siap.ollama})` : "— Ollama tak aktif"}
            </span>
            {mesin && <span className="ml-auto text-slate-400">Terbaca lewat: <b className="text-slate-600 dark:text-slate-300">{namaMesin(mesin)}</b></span>}
          </div>
        )}

        <div className="px-5 py-4">
          {/* dropzone */}
          <div
            onClick={() => !sibuk && berkasRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const fs = Array.from(e.dataTransfer.files || []); if (fs.length) jalankan(fs); }}
            className={`cursor-pointer rounded-2xl border-2 border-dashed px-4 py-5 text-center transition ${
              sibuk ? "border-sky-300 bg-sky-50" : "border-slate-300 hover:border-sky-400 hover:bg-sky-50/50 dark:border-slate-700"}`}>
            {sibuk ? (
              <div>
                <p className="text-sm font-semibold text-sky-800">{tahap.tahap || "Membaca…"}</p>
                <div className="mx-auto mt-2 h-2 max-w-xs overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-sky-500 transition-all" style={{ width: `${tahap.persen ?? 30}%` }} />
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <span className="text-lg">📎</span> Klik pilih · tarik ke sini · <kbd className="rounded border bg-slate-100 px-1.5 py-0.5 text-[10px]">Ctrl</kbd>+<kbd className="rounded border bg-slate-100 px-1.5 py-0.5 text-[10px]">V</kbd> tempel screenshot
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  .xlsx · .xls · .csv · .pdf · foto. Excel dan PDF berteks dibaca <b>persis</b>; pindaian dan foto lewat AI.
                </p>
              </>
            )}
            <input ref={berkasRef} type="file" accept={BERKAS_DITERIMA} multiple className="hidden"
              onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) jalankan(fs); e.target.value = ""; }} />
          </div>

          {galat && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{galat}</p>}
          {catatan.length > 0 && (
            <ul className="mt-3 space-y-0.5 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:bg-slate-800">
              {Array.from(new Set(catatan)).slice(0, 6).map((c, i) => <li key={i}>• {c}</li>)}
            </ul>
          )}

          {/* hasil untuk diperiksa */}
          {baris.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  <b className="text-slate-800 dark:text-white">{baris.length} baris</b> dari {namaBerkas.length} berkas
                  {kosongPenting > 0 && <span className="text-amber-600"> · {kosongPenting} baris belum ada nilainya</span>}
                </p>
                <button onClick={() => setBaris([])} className="text-[11px] text-slate-500 hover:underline">bersihkan</button>
              </div>

              <div className="max-h-[42vh] overflow-auto rounded-xl ring-1 ring-slate-200 dark:ring-slate-700">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800">
                    <tr>
                      <th className="w-8 p-1.5 text-left font-semibold">#</th>
                      {kolom.map((k) => <th key={k.id} className="p-1.5 text-left font-semibold">{k.label}</th>)}
                      <th className="w-6 p-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {baris.map((r, i) => (
                      <tr key={i} className="border-t dark:border-slate-700">
                        <td className="p-1 text-center text-slate-400">{i + 1}</td>
                        {kolom.map((k) => (
                          <td key={k.id} className="p-1">
                            <input
                              value={k.jenis === "rupiah" ? (r[k.id] ? angkaRibuan(keAngka(r[k.id])) : "") : (r[k.id] || "")}
                              type={k.jenis === "tanggal" ? "date" : "text"}
                              onChange={(e) => setSel(i, k.id, k.jenis === "rupiah" ? String(keAngka(e.target.value) || "") : e.target.value)}
                              className={`w-full rounded border border-slate-300 bg-white px-1 py-0.5 dark:border-slate-700 dark:bg-slate-900 ${
                                k.jenis === "rupiah" ? "text-right tabular-nums" : ""} ${
                                k.jenis === "rupiah" && !keAngka(r[k.id]) ? "border-amber-400 bg-amber-50/60" : ""}`}
                            />
                          </td>
                        ))}
                        <td className="p-1 text-center">
                          <button onClick={() => hapus(i)} className="text-rose-400 hover:text-rose-600">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {kolomRupiah.length > 0 && (
                    <tfoot className="sticky bottom-0 bg-slate-50 dark:bg-slate-800">
                      <tr className="border-t-2 border-slate-300 dark:border-slate-600">
                        <td />
                        {kolom.map((k) => (
                          <td key={k.id} className="p-1.5 text-right font-extrabold tabular-nums text-slate-700 dark:text-slate-200">
                            {k.jenis === "rupiah" ? angkaRibuan(jumlahKolom(k.id)) : (k.id === kolom[0].id ? "JUMLAH" : "")}
                          </td>
                        ))}
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                {kolomRupiah.length > 0
                  ? "Cocokkan angka JUMLAH di atas dengan total pada berkas asalnya sebelum ditempel — itu cara tercepat menangkap salah baca satu digit."
                  : "Periksa dulu isinya; yang keliru bisa langsung disunting di sini sebelum ditempel ke borang."}
              </p>
            </div>
          )}
        </div>

        {/* kaki */}
        <div className="flex flex-wrap items-center gap-2 border-t bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <button onClick={tutup} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-white">Tutup</button>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => { terapkan(baris, "tambah"); tutup(); }} disabled={!baris.length || sibuk}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">
              ＋ Tambah ke bawah ({jumlahBarisSekarang} baris sekarang)
            </button>
            <button onClick={() => { terapkan(baris, "ganti"); tutup(); }} disabled={!baris.length || sibuk}
              className="asdp-gradient rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
              Ganti isi tabel dengan {baris.length} baris
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
