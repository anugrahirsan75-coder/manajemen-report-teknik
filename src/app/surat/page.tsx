"use client";
/**
 * Buat Surat E-Office.
 *
 * Kop, nomor, tanggal, tujuan, tanda tangan, dan tembusan sudah dibuat sendiri
 * oleh aplikasi e-office. Yang dibuat di sini hanya BADAN SURAT — dari
 * "Dengan Hormat," sampai kalimat penutup — dalam bentuk HTML bergaya inline
 * yang tinggal ditempel ke editor e-office.
 *
 * Borangnya dirakit dari skema isian tiap template (lib/surat/registry.ts),
 * jadi menambah jenis surat baru tidak menyentuh berkas ini sama sekali.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TEMPLATE_SURAT, cariTemplate } from "@/lib/surat/registry";
import { DataSurat, Isian, TemplateSurat } from "@/lib/surat/types";
import { angkaRibuan, keAngka, rupiahSurat } from "@/lib/surat/format";
import { terbilangRupiah } from "@/lib/surat/terbilang";
import UnggahTabel from "@/components/surat/UnggahTabel";

const KUNCI_DRAF = "surat_eoffice_draf";

/** nilai awal satu template, dipakai saat pertama buka & saat tombol Reset */
function dataAwal(t: TemplateSurat): DataSurat {
  const d: DataSurat = {};
  t.isian.forEach((f) => {
    if (f.jenis === "tabel") d[f.id] = (f.awal as Record<string, string>[]) || [barisKosong(f)];
    else if (f.jenis === "daftar-centang") d[f.id] = (f.awal as string[]) || [];
    else if (f.jenis === "daftar-teks") d[f.id] = (f.awal as string[]) || [""];
    else d[f.id] = (f.awal as string) ?? "";
  });
  return d;
}

const barisKosong = (f: Isian): Record<string, string> =>
  Object.fromEntries((f.kolom || []).map((k) => [k.id, ""]));

const kosongkah = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && !v.trim())
  || (Array.isArray(v) && (v.length === 0 || v.every((x) =>
    typeof x === "string" ? !x.trim() : Object.values(x || {}).every((y) => !String(y).trim()))));

export default function BuatSuratEOffice() {
  const [idTemplate, setIdTemplate] = useState(TEMPLATE_SURAT[0].id);
  const [semuaData, setSemuaData] = useState<Record<string, DataSurat>>(() =>
    Object.fromEntries(TEMPLATE_SURAT.map((t) => [t.id, dataAwal(t)])));
  const [tab, setTab] = useState<"pratinjau" | "kode">("pratinjau");
  const [pesan, setPesan] = useState("");
  const [sudahMuat, setSudahMuat] = useState(false);
  const kodeRef = useRef<HTMLTextAreaElement>(null);

  const templat = cariTemplate(idTemplate)!;
  const data = semuaData[idTemplate];

  // ── draf disimpan supaya isian tidak hilang saat halaman dimuat ulang ────
  useEffect(() => {
    try {
      const simpanan = localStorage.getItem(KUNCI_DRAF);
      if (simpanan) {
        const isi = JSON.parse(simpanan);
        if (isi?.data) {
          setSemuaData((lama) => {
            const gabung = { ...lama };
            TEMPLATE_SURAT.forEach((t) => {
              if (isi.data[t.id]) gabung[t.id] = { ...dataAwal(t), ...isi.data[t.id] };
            });
            return gabung;
          });
        }
        if (isi?.template && cariTemplate(isi.template)) setIdTemplate(isi.template);
      }
    } catch { /* draf rusak: abaikan, pakai isian kosong */ }
    setSudahMuat(true);
  }, []);

  useEffect(() => {
    if (!sudahMuat) return;
    try { localStorage.setItem(KUNCI_DRAF, JSON.stringify({ template: idTemplate, data: semuaData })); }
    catch { /* penyimpanan penuh: biarkan, bukan hal yang boleh menghentikan pekerjaan */ }
  }, [semuaData, idTemplate, sudahMuat]);

  /**
   * Nilai boleh berupa fungsi (lamaNilai) => baru. Ini bukan kemewahan: tabel
   * mengubah satu sel dari salinan baris yang ada di closure, dan kalau dua
   * perubahan terjadi sebelum layar digambar ulang, yang belakangan menimpa
   * yang duluan — isian yang sudah diketik bisa hilang begitu saja.
   */
  const ubah = useCallback((id: string, nilai: unknown) => {
    setSemuaData((lama) => {
      const dataLama = lama[idTemplate] || {};
      const baru = typeof nilai === "function" ? (nilai as (v: any) => unknown)(dataLama[id]) : nilai;
      return { ...lama, [idTemplate]: { ...dataLama, [id]: baru } };
    });
  }, [idTemplate]);

  // ── pemeriksaan isian ────────────────────────────────────────────────────
  const kurang = useMemo(
    () => templat.isian.filter((f) => f.wajib && kosongkah(data[f.id])).map((f) => f.label),
    [templat, data]);
  const peringatan = useMemo(() => (templat.periksa ? templat.periksa(data) : []), [templat, data]);
  const lengkap = kurang.length === 0;

  const html = useMemo(() => {
    if (!lengkap) return "";
    try { return templat.generate(data); }
    catch (e: any) { return `<p>Gagal menyusun surat: ${e?.message || e}</p>`; }
  }, [templat, data, lengkap]);

  const ringkas = useMemo(
    () => (templat.ringkasNilai ? templat.ringkasNilai(data) : null), [templat, data]);

  const beritahu = (t: string) => { setPesan(t); setTimeout(() => setPesan(""), 3500); };

  const salinKode = async () => {
    try { await navigator.clipboard.writeText(html); beritahu("Kode HTML disalin. Tempel di mode HTML e-office."); }
    catch {
      kodeRef.current?.select();
      document.execCommand("copy");
      beritahu("Kode HTML disalin lewat cara cadangan.");
    }
  };

  /** salinan berformat: bisa ditempel langsung ke editor WYSIWYG e-office */
  const salinKaya = async () => {
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([html], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      beritahu("Tersalin sebagai teks berformat. Tempel di editor biasa e-office.");
    } catch {
      // Peramban lama tidak punya ClipboardItem: pakai seleksi elemen tersembunyi
      const bak = document.createElement("div");
      bak.innerHTML = html;
      bak.setAttribute("style", "position:fixed;left:-9999px;top:0;");
      document.body.appendChild(bak);
      const rentang = document.createRange();
      rentang.selectNodeContents(bak);
      const pilih = window.getSelection();
      pilih?.removeAllRanges(); pilih?.addRange(rentang);
      const ok = document.execCommand("copy");
      pilih?.removeAllRanges();
      document.body.removeChild(bak);
      beritahu(ok ? "Tersalin sebagai teks berformat." : "Peramban menolak menyalin. Pakai tombol Salin HTML.");
    }
  };

  const unduh = () => {
    const berkas = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(berkas);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${templat.id}-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    if (!confirm("Kosongkan seluruh isian template ini?")) return;
    setSemuaData((lama) => ({ ...lama, [idTemplate]: dataAwal(templat) }));
    beritahu("Isian dikosongkan.");
  };

  return (
    <main className="mx-auto max-w-[105rem] px-4 py-6">
      {/* ── kepala ───────────────────────────────────────────────────────── */}
      <header className="asdp-gradient mb-5 rounded-[1.75rem] p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow flex flex-wrap items-center gap-4 rounded-[calc(1.75rem-1.5px)] px-5 py-5 sm:px-6">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-800 text-2xl text-white shadow-lg shadow-sky-900/20">✉️</div>
          <div className="min-w-[16rem] flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-sky-800 ring-1 ring-sky-200">Dokumen</span>
              <span className="text-[10px] font-medium text-slate-400">{TEMPLATE_SURAT.length} jenis surat</span>
            </div>
            <h1 className="asdp-text-gradient text-2xl font-extrabold leading-tight">Buat Surat E-Office</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Menyusun <b>badan surat</b> saja — kop, nomor, tanggal, tujuan, tanda tangan, dan tembusan tetap dari e-office.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={reset} className="btn btn-ghost text-xs">↺ Kosongkan</button>
            <button onClick={unduh} disabled={!lengkap} className="btn btn-ghost text-xs disabled:opacity-40">⬇ Unduh .html</button>
            <button onClick={salinKaya} disabled={!lengkap} className="btn btn-success text-xs disabled:opacity-40">📋 Salin Rich Text</button>
            <button onClick={salinKode} disabled={!lengkap} className="btn btn-primary text-xs disabled:opacity-40">⧉ Salin HTML</button>
          </div>
        </div>
      </header>

      {pesan && <div className="anim-in mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">✓ {pesan}</div>}

      {/* ── pilih template ───────────────────────────────────────────────── */}
      <section className="anim-in mb-5 rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/80 dark:ring-slate-700">
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Pilih jenis surat</h2>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {TEMPLATE_SURAT.map((t) => {
            const aktif = t.id === idTemplate;
            return (
              <button key={t.id} onClick={() => setIdTemplate(t.id)}
                className={`card-hover rounded-2xl p-3.5 text-left ring-1 transition ${
                  aktif ? "bg-slate-900 text-white ring-slate-900 dark:bg-slate-700"
                        : "bg-white ring-slate-200 hover:ring-slate-300 dark:bg-slate-800 dark:ring-slate-700"}`}>
                <div className="text-xl leading-none">{t.ikon}</div>
                <p className={`mt-1.5 text-sm font-extrabold leading-snug ${aktif ? "text-white" : "text-slate-900 dark:text-white"}`}>{t.nama}</p>
                <p className={`mt-1 text-[11px] leading-snug ${aktif ? "text-white/70" : "text-slate-500 dark:text-slate-400"}`}>{t.deskripsi}</p>
                <p className={`mt-1.5 text-[10px] font-semibold ${aktif ? "text-sky-200" : "text-sky-700 dark:text-sky-400"}`}>Yth. {t.tujuan}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ── borang ─────────────────────────────────────────────────────── */}
        <section className="anim-in rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/80 dark:ring-slate-700 sm:p-5">
          <div className="mb-3">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Isian surat</h2>
            <p className="text-xs text-slate-400">Perihal yang biasa dipakai: <span className="text-slate-500">{templat.perihal}</span></p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {templat.isian.map((f) => (
              <div key={f.id} className={f.kolomBorang === 2 ? "sm:col-span-1" : "sm:col-span-2"}>
                <MedanIsian medan={f} nilai={data[f.id]} ubah={(v) => ubah(f.id, v)} />
              </div>
            ))}
          </div>

          {(ringkas || peringatan.length > 0 || kurang.length > 0) && (
            <div className="mt-4 space-y-2">
              {ringkas && (
                <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{ringkas.label}</p>
                  <p className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white">{rupiahSurat(ringkas.nilai)}</p>
                  <p className="mt-0.5 text-[11px] italic text-slate-500">{terbilangRupiah(ringkas.nilai)}</p>
                </div>
              )}
              {kurang.length > 0 && (
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200">
                  <b>Belum lengkap:</b> {kurang.join(", ")}.
                </div>
              )}
              {peringatan.map((x, i) => (
                <div key={i} className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-200">
                  ⚠ {x}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── pratinjau & kode ───────────────────────────────────────────── */}
        <section className="anim-in rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/80 dark:ring-slate-700 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {(["pratinjau", "kode"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    tab === t ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500"}`}>
                  {t === "pratinjau" ? "Pratinjau" : "Kode HTML"}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-400">
              {lengkap ? `${html.length.toLocaleString("id-ID")} karakter` : "menunggu isian wajib"}
            </span>
          </div>

          {!lengkap ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
              <p className="text-3xl">📝</p>
              <p className="mt-2 font-bold text-slate-700 dark:text-slate-200">Lengkapi isian wajib</p>
              <p className="text-xs text-slate-400">Surat disusun otomatis begitu isian wajib terisi.</p>
            </div>
          ) : tab === "pratinjau" ? (
            <div className="max-h-[70vh] overflow-auto rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
              <div className="mx-auto w-full max-w-[800px] bg-white p-8 shadow-md"
                // Isi berasal dari template kita sendiri, bukan dari luar; nilai
                // yang diketik pengguna sudah dilewatkan esc() di pembangun HTML.
                dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          ) : (
            <textarea ref={kodeRef} readOnly value={html}
              className="h-[70vh] w-full rounded-2xl border border-slate-300 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300" />
          )}

          <div className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-sky-900 ring-1 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-200">
            Seluruh gaya ditulis <b>inline</b> di tiap elemen, plus atribut lawas (<code>border</code>,
            <code> bgcolor</code>, <code> align</code>) sebagai cadangan — jadi garis tabel dan pemisah angka
            tetap ada walau e-office membuang CSS.
          </div>
        </section>
      </div>
    </main>
  );
}

/* ── satu medan isian ──────────────────────────────────────────────────── */
function MedanIsian({ medan, nilai, ubah }: { medan: Isian; nilai: any; ubah: (v: unknown) => void }) {
  const label = (
    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">
      {medan.label}{medan.wajib && <span className="text-rose-500"> *</span>}
    </label>
  );
  const kelas = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const petunjuk = medan.petunjuk && <p className="mt-1 text-[11px] text-slate-400">{medan.petunjuk}</p>;

  if (medan.jenis === "tabel") return <TabelIsian medan={medan} nilai={nilai} ubah={ubah} />;

  if (medan.jenis === "daftar-centang") {
    const dipilih: string[] = nilai || [];
    const alih = (x: string) =>
      ubah((lama: string[]) => ((lama || []).includes(x) ? (lama || []).filter((y) => y !== x) : [...(lama || []), x]));
    const tambahBebas = () => {
      const t = prompt("Tulis pekerjaan lain:");
      if (t && t.trim()) ubah((lama: string[]) => [...(lama || []), t.trim()]);
    };
    return (
      <div>
        {label}
        <div className="space-y-1.5">
          {Array.from(new Set([...(medan.pilihan || []), ...dipilih])).map((x) => (
            <label key={x} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
              <input type="checkbox" checked={dipilih.includes(x)} onChange={() => alih(x)} className="mt-0.5" />
              <span className="text-slate-700 dark:text-slate-200">{x}</span>
            </label>
          ))}
        </div>
        <button onClick={tambahBebas} className="mt-2 text-xs font-bold text-blue-700 hover:underline dark:text-blue-400">+ Tambah pekerjaan lain</button>
        {petunjuk}
      </div>
    );
  }

  if (medan.jenis === "daftar-teks") {
    const daftar: string[] = nilai?.length ? nilai : [""];
    return (
      <div>
        {label}
        <div className="space-y-1.5">
          {daftar.map((v, idx) => (
            <div key={idx} className="flex gap-2">
              <input value={v} placeholder={medan.contoh}
                onChange={(e) => {
                  const t = e.target.value;
                  ubah((lama: string[]) => (lama?.length ? lama : [""]).map((x, k) => (k === idx ? t : x)));
                }}
                className={kelas} />
              <button onClick={() => ubah((lama: string[]) => (lama || []).filter((_, k) => k !== idx))}
                disabled={daftar.length === 1}
                className="shrink-0 rounded-lg px-2 text-sm text-rose-600 hover:bg-rose-50 disabled:text-slate-300">✕</button>
            </div>
          ))}
        </div>
        <button onClick={() => ubah((lama: string[]) => [...(lama?.length ? lama : [""]), ""])} className="mt-2 text-xs font-bold text-blue-700 hover:underline dark:text-blue-400">+ Tambah baris</button>
        {petunjuk}
      </div>
    );
  }

  if (medan.jenis === "pilih") {
    const daftar = medan.pilihan || [];
    const diLuarDaftar = nilai && !daftar.includes(nilai);
    return (
      <div>
        {label}
        <select value={diLuarDaftar ? "__lain" : (nilai || "")}
          onChange={(e) => ubah(e.target.value === "__lain" ? " " : e.target.value)}
          className={kelas}>
          <option value="">— pilih —</option>
          {daftar.map((x) => <option key={x} value={x}>{x}</option>)}
          {medan.bebas && <option value="__lain">Lainnya…</option>}
        </select>
        {medan.bebas && diLuarDaftar && (
          <input value={nilai} onChange={(e) => ubah(e.target.value)} placeholder="Tulis sendiri"
            className={`${kelas} mt-1.5`} autoFocus />
        )}
        {petunjuk}
      </div>
    );
  }

  if (medan.jenis === "textarea") {
    return (
      <div>
        {label}
        <textarea value={nilai || ""} rows={3} placeholder={medan.contoh}
          onChange={(e) => ubah(e.target.value)} className={kelas} />
        {petunjuk}
      </div>
    );
  }

  if (medan.jenis === "rupiah") {
    return (
      <div>
        {label}
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Rp</span>
          <input value={nilai ? angkaRibuan(keAngka(nilai)) : ""} inputMode="numeric" placeholder="0"
            onChange={(e) => ubah(String(keAngka(e.target.value) || ""))}
            className={`${kelas} pl-9 text-right tabular-nums`} />
        </div>
        {nilai ? <p className="mt-1 text-[11px] italic text-slate-400">{terbilangRupiah(keAngka(nilai))}</p> : petunjuk}
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        type={medan.jenis === "tanggal" ? "date" : "text"}
        inputMode={medan.jenis === "angka" ? "numeric" : undefined}
        value={nilai || ""} placeholder={medan.contoh}
        onChange={(e) => ubah(e.target.value)} className={kelas} />
      {petunjuk}
    </div>
  );
}

/* ── isian berbentuk tabel ─────────────────────────────────────────────── */
function TabelIsian({ medan, nilai, ubah }: { medan: Isian; nilai: any; ubah: (v: unknown) => void }) {
  const [bukaUnggah, setBukaUnggah] = useState(false);
  const kolom = medan.kolom || [];
  const kosong = () => Object.fromEntries(kolom.map((k) => [k.id, ""]));
  const baris: Record<string, string>[] = nilai?.length ? nilai : [kosong()];
  const perbarui = (ubahBaris: (lama: Record<string, string>[]) => Record<string, string>[]) =>
    ubah((lama: Record<string, string>[]) => ubahBaris(lama?.length ? lama : [kosong()]));
  const setSel = (idx: number, kol: string, v: string) =>
    perbarui((lama) => lama.map((r, k) => (k === idx ? { ...r, [kol]: v } : r)));

  const saranId = (k: string) => `saran-${medan.id}-${k}`;

  /** hasil bacaan berkas: dirapikan ke bentuk kolom tabel ini, lalu diganti/ditambah */
  const terapkanBacaan = (hasil: Record<string, string>[], cara: "ganti" | "tambah") => {
    const rapi = hasil.map((r) => ({ ...kosong(), ...Object.fromEntries(kolom.map((k) => [k.id, r[k.id] ?? ""])) }));
    if (!rapi.length) return;
    if (cara === "ganti") { ubah(rapi); return; }
    ubah((lama: Record<string, string>[]) => {
      // baris kosong bawaan tidak ikut terbawa saat menambah
      const ada = (lama || []).filter((r) => Object.values(r).some((v) => String(v).trim()));
      return [...ada, ...rapi];
    });
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
          {medan.label}{medan.wajib && <span className="text-rose-500"> *</span>}
        </label>
        {medan.bacaBerkas !== false && (
          <button onClick={() => setBukaUnggah(true)}
            className="rounded-lg bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-800 ring-1 ring-sky-200 transition hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900">
            📄 Isi dari berkas
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2 font-extrabold">#</th>
              {kolom.map((k) => <th key={k.id} className="px-2 py-2 font-extrabold">{k.label}</th>)}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {baris.map((r, idx) => (
              <tr key={idx} className="border-t border-slate-100 dark:border-slate-700/60">
                <td className="px-2 py-1.5 text-xs text-slate-400">{idx + 1}</td>
                {kolom.map((k) => (
                  <td key={k.id} className="px-2 py-1.5" style={k.lebar ? { width: k.lebar } : undefined}>
                    {k.jenis === "tanggal" ? (
                      <input type="date" value={r[k.id] || ""}
                        onChange={(e) => setSel(idx, k.id, e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900" />
                    ) : k.jenis === "rupiah" ? (
                      <input value={r[k.id] ? angkaRibuan(keAngka(r[k.id])) : ""} inputMode="numeric" placeholder="0"
                        onChange={(e) => setSel(idx, k.id, String(keAngka(e.target.value) || ""))}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-right text-sm tabular-nums dark:border-slate-700 dark:bg-slate-900" />
                    ) : (
                      <>
                        <input value={r[k.id] || ""} list={k.saran ? saranId(k.id) : undefined}
                          onChange={(e) => {
                            const v = e.target.value;
                            // memilih kode mata anggaran ikut mengisi uraiannya
                            const cocok = k.saran?.find((s) => s.nilai === v);
                            if (cocok && kolom.some((c) => c.id === "uraian") && k.id === "kode") {
                              const uraian = cocok.label.split("—")[1]?.trim() || "";
                              perbarui((lama) => lama.map((b2, k2) => (k2 === idx ? { ...b2, kode: v, uraian } : b2)));
                            } else setSel(idx, k.id, v);
                          }}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900" />
                        {k.saran && (
                          <datalist id={saranId(k.id)}>
                            {k.saran.map((s) => <option key={s.nilai} value={s.nilai}>{s.label}</option>)}
                          </datalist>
                        )}
                      </>
                    )}
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  <button onClick={() => perbarui((lama) => lama.filter((_, k2) => k2 !== idx))} disabled={baris.length === 1}
                    className="rounded-lg px-2 text-sm text-rose-600 hover:bg-rose-50 disabled:text-slate-300">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => perbarui((lama) => [...lama, kosong()])}
        className="mt-2 text-xs font-bold text-blue-700 hover:underline dark:text-blue-400">+ Tambah baris</button>
      {medan.petunjuk && <p className="mt-1 text-[11px] text-slate-400">{medan.petunjuk}</p>}

      {medan.bacaBerkas !== false && (
        <UnggahTabel
          buka={bukaUnggah} tutup={() => setBukaUnggah(false)}
          kolom={kolom} judul={medan.label}
          konteks={typeof medan.bacaBerkas === "string" ? medan.bacaBerkas : ""}
          jumlahBarisSekarang={baris.filter((r) => Object.values(r).some((v) => String(v).trim())).length}
          terapkan={terapkanBacaan}
        />
      )}
    </div>
  );
}
