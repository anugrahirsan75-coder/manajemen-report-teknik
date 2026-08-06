"use client";
/**
 * Laporan Docking — penelusur folder Drive milik kantor.
 *
 * Berkasnya tetap tinggal di Google Drive, bukan disalin ke Supabase: satu
 * laporan docking bisa puluhan MB dan jumlahnya bertambah tiap kapal tiap
 * tahun. Halaman ini membaca Drive apa adanya, jadi berkas yang ditaruh
 * langsung dari Google Drive dan yang diunggah dari sini tampil berdampingan
 * tanpa ada daftar kedua yang bisa berbeda.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BerkasDrive, IsiFolder, KemajuanUnggah, bacaFolder, ikonBerkas, tanggalSingkat, ukuranSingkat, unggahBerkas,
} from "@/lib/docking/laporan/drive";
import { ACCEPT_BERKAS } from "@/lib/lapor/berkasJenis";

export default function LaporanDocking() {
  const [jalur, setJalur] = useState<string[]>([]);
  const [isi, setIsi] = useState<IsiFolder | null>(null);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [unggah, setUnggah] = useState<KemajuanUnggah | null>(null);
  const [pesan, setPesan] = useState("");
  const berkasRef = useRef<HTMLInputElement>(null);

  const buka = useCallback(async (j: string[]) => {
    setMuat(true); setGalat("");
    try { setIsi(await bacaFolder(j)); setJalur(j); }
    catch (e: any) { setGalat(e?.message || String(e)); setIsi(null); }
    finally { setMuat(false); }
  }, []);

  useEffect(() => { void buka([]); }, [buka]);

  const beritahu = (t: string) => { setPesan(t); setTimeout(() => setPesan(""), 4000); };

  const kirim = async (berkas: File[]) => {
    if (!berkas.length) return;
    if (!jalur.length) { beritahu("Masuk dulu ke folder kapal/tahunnya, baru unggah berkas."); return; }
    setGalat("");
    try {
      for (const f of berkas) await unggahBerkas(f, jalur, setUnggah);
      beritahu(`${berkas.length} berkas tersimpan di Drive.`);
      await buka(jalur);
    } catch (e: any) {
      setGalat(e?.message || String(e));
    } finally { setUnggah(null); }
  };

  const folderTampil = (isi?.folder || []).filter((f) => f.nama.toLowerCase().includes(cari.toLowerCase()));
  const berkasTampil = (isi?.berkas || []).filter((b) => b.nama.toLowerCase().includes(cari.toLowerCase()));
  const totalUkuran = (isi?.berkas || []).reduce((s, b) => s + (b.ukuran || 0), 0);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      {/* ── kepala ─────────────────────────────────────────────────────── */}
      <header className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow flex flex-wrap items-center gap-4 rounded-3xl px-7 py-6">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl asdp-gradient text-2xl text-white shadow-md">🛠️</div>
          <div className="min-w-0 flex-1">
            <h1 className="asdp-text-gradient text-2xl font-extrabold tracking-tight">Laporan Docking</h1>
            <p className="text-sm text-slate-500">
              Berkas tersimpan di Google Drive kantor. Yang ditaruh langsung dari Drive ikut terlihat di sini.
            </p>
          </div>
          {isi?.folderUrl && (
            <a href={isi.folderUrl} target="_blank" rel="noreferrer" className="btn btn-ghost text-xs">📂 Buka di Drive</a>
          )}
          <button onClick={() => buka(jalur)} className="btn btn-ghost text-xs">↻ Muat ulang</button>
        </div>
      </header>

      {pesan && <div className="anim-in mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">✓ {pesan}</div>}
      {galat && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {galat}
          {/mengenal aksi|versi 4/i.test(galat) && (
            <p className="mt-1 text-[11px]">
              Apps Script-nya perlu diperbarui: buka script.google.com → tempel ulang <code>docs/lapor-apps-script.gs</code> →
              Deploy → Kelola deployment → pensil → Versi baru → Terapkan.
            </p>
          )}
        </div>
      )}

      {/* ── jejak folder + pencarian ───────────────────────────────────── */}
      <section className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl bg-white/90 px-4 py-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900/80 dark:ring-slate-700">
        <button onClick={() => buka([])} className={`text-sm font-bold ${jalur.length ? "text-sky-700 hover:underline" : "text-slate-800 dark:text-white"}`}>
          🗂️ Laporan Docking
        </button>
        {jalur.map((n, i) => (
          <span key={`${n}-${i}`} className="flex items-center gap-2">
            <span className="text-slate-300">›</span>
            <button onClick={() => buka(jalur.slice(0, i + 1))}
              className={`text-sm font-bold ${i === jalur.length - 1 ? "text-slate-800 dark:text-white" : "text-sky-700 hover:underline"}`}>
              {n}
            </button>
          </span>
        ))}
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama berkas / folder…"
          className="ml-auto w-56 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900" />
      </section>

      {/* ── unggah ─────────────────────────────────────────────────────── */}
      <section className="mt-4">
        <div
          onClick={() => !unggah && jalur.length && berkasRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void kirim(Array.from(e.dataTransfer.files || [])); }}
          className={`rounded-2xl border-2 border-dashed px-4 py-4 text-center transition ${
            unggah ? "border-sky-300 bg-sky-50"
              : jalur.length ? "cursor-pointer border-slate-300 hover:border-sky-400 hover:bg-sky-50/50 dark:border-slate-700"
                : "border-slate-200 bg-slate-50/60 dark:border-slate-800"}`}>
          {unggah ? (
            <div>
              <p className="text-sm font-semibold text-sky-800">
                Mengunggah {unggah.berkas} — potongan {unggah.potongan}/{unggah.total}
                {unggah.percobaan > 0 && ` (ulangan ke-${unggah.percobaan})`}
              </p>
              <div className="mx-auto mt-2 h-2 max-w-sm overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-sky-500 transition-all" style={{ width: `${Math.round((unggah.potongan / unggah.total) * 100)}%` }} />
              </div>
            </div>
          ) : jalur.length ? (
            <>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">📎 Klik pilih · tarik berkas ke sini</p>
              <p className="mt-1 text-[11px] text-slate-400">
                Tersimpan ke <b>{jalur.join(" / ")}</b> di Drive. Berkas sangat besar (di atas ~35 MB) taruh langsung lewat Google Drive.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Pilih folder kapal dulu untuk mengunggah berkas ke sana.</p>
          )}
          <input ref={berkasRef} type="file" accept={ACCEPT_BERKAS} multiple className="hidden"
            onChange={(e) => { void kirim(Array.from(e.target.files || [])); e.target.value = ""; }} />
        </div>
      </section>

      {/* ── isi folder ─────────────────────────────────────────────────── */}
      {muat ? (
        <p className="mt-6 text-center text-sm text-slate-400">Membaca folder di Google Drive…</p>
      ) : (
        <>
          {folderTampil.length > 0 && (
            <section className="mt-5">
              <h2 className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Folder ({folderTampil.length})</h2>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {folderTampil.map((f) => (
                  <button key={f.id} onClick={() => buka([...jalur, f.nama])}
                    className="card-hover flex items-center gap-3 rounded-2xl bg-white p-3.5 text-left ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                    <span className="text-2xl">📁</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-800 dark:text-white">{f.nama}</span>
                      <span className="text-[11px] text-slate-400">diubah {tanggalSingkat(f.diubah)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Berkas ({berkasTampil.length})</h2>
              {totalUkuran > 0 && <span className="text-[11px] text-slate-400">total {ukuranSingkat(totalUkuran)}</span>}
            </div>
            {berkasTampil.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-700">
                {isi?.kosong ? "Folder ini belum ada di Drive — akan dibuat begitu berkas pertama diunggah."
                  : cari ? "Tidak ada yang cocok dengan pencarian." : "Belum ada berkas di folder ini."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:divide-slate-700/60 dark:bg-slate-800 dark:ring-slate-700">
                {berkasTampil.map((b: BerkasDrive) => (
                  <li key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-xl">{ikonBerkas(b.mime, b.nama)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800 dark:text-white">{b.nama}</span>
                      <span className="text-[11px] text-slate-400">{ukuranSingkat(b.ukuran)} · {tanggalSingkat(b.diubah)}</span>
                    </span>
                    <a href={b.url} target="_blank" rel="noreferrer" className="btn btn-ghost shrink-0 text-xs">Buka</a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
