"use client";
/**
 * Dokumen Kapal — arsip berkas tidak rutin, diunggah kapal sendiri.
 *
 * Empat borang bulanan menampung yang rutin. Yang tidak rutin — berita acara
 * kerusakan, temuan Marine Superintendent, foto kejadian, serah terima jabatan,
 * nota bunker — selama ini beredar sebagai lampiran WhatsApp lalu hilang
 * bersama obrolannya. Ketika dibutuhkan berbulan-bulan kemudian untuk audit,
 * klaim asuransi, atau sengketa docking, yang tersisa hanya ingatan.
 *
 * Berkasnya naik ke Google Drive lewat jalur potongan yang sama dengan borang
 * kiriman — sudah terbukti bertahan pada sinyal kapal yang putus-nyambung —
 * dan mendarat di folder Dokumen Kapal / <nama kapal> / <golongan>.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RangkaPortal, useAku } from "@/components/portal/Rangka";
import { JENIS_DOKUMEN, jenisUntuk, labelDokumen, jenisDokumen } from "@/lib/portal/dokumen";
import { pesanRamah, unggahSatuBerkas, type Kemajuan } from "@/lib/lapor/unggahBerkas";

interface Dok {
  id: string;
  jenis: string;
  judul: string;
  tanggal: string;
  nomor: string;
  catatan: string;
  bagian: string;
  olehAkun: string;
  dibuatPada: string;
  berkas: { nama: string; ukuran: number; fileId: string; url: string }[];
}

const ukuran = (b: number) =>
  b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

const tanggalIndo = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "—";
  const bulan = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const [y, m, d] = iso.split("-");
  return `${+d} ${bulan[+m]} ${y}`;
};

export default function DokumenKapal() {
  const { aku } = useAku();
  const [baris, setBaris] = useState<Dok[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");
  const [saring, setSaring] = useState("");
  const [cari, setCari] = useState("");

  /* ── borang unggah ─────────────────────────────────────────────────── */
  const [buka, setBuka] = useState(false);
  const [jenis, setJenis] = useState("berita_acara");
  const [judul, setJudul] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [nomor, setNomor] = useState("");
  const [catatan, setCatatan] = useState("");
  const [berkas, setBerkas] = useState<File[]>([]);
  const [kirim, setKirim] = useState(false);
  const [maju, setMaju] = useState<Kemajuan | null>(null);
  const pilihRef = useRef<HTMLInputElement | null>(null);

  const ambil = useCallback(async () => {
    try {
      const r = await fetch("/api/portal/dokumen", { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal memuat dokumen");
      setBaris(d.baris || []);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);

  useEffect(() => { void ambil(); }, [ambil]);

  // tanggal hari ini sebagai bawaan — dokumen hampir selalu diunggah pada hari kejadiannya
  useEffect(() => {
    if (!tanggal) setTanggal(new Date().toISOString().slice(0, 10));
  }, [tanggal]);

  const pilihanJenis = useMemo(
    () => (aku ? jenisUntuk(aku.bagian) : JENIS_DOKUMEN), [aku]);

  const tampil = useMemo(() => {
    const k = cari.trim().toLowerCase();
    return baris
      .filter((b) => !saring || b.jenis === saring)
      .filter((b) => !k || `${b.judul} ${b.nomor} ${b.catatan} ${labelDokumen(b.jenis)}`.toLowerCase().includes(k));
  }, [baris, saring, cari]);

  const kirimDokumen = async () => {
    if (!judul.trim()) { setGalat("Judul dokumen wajib diisi."); return; }
    if (!berkas.length) { setGalat("Pilih dulu berkasnya — dokumen tanpa lampiran tidak ada gunanya diarsipkan."); return; }
    setKirim(true); setGalat(""); setMaju(null);
    try {
      /*
       * Dua langkah, persis seperti borang kiriman: catatannya dibuat lebih
       * dulu supaya berkas punya tempat menempel, baru berkasnya menyusul
       * potongan demi potongan. Kalau sinyal putus di tengah, catatannya sudah
       * ada dan unggahan bisa dilanjutkan tanpa mengulang dari nol.
       */
      const r = await fetch("/api/portal/dokumen", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jenis, judul, tanggal, nomor, catatan }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Dokumen gagal dicatat");

      // urut/dari dipakai pengunggah untuk melaporkan "berkas ke-2 dari 3"
      for (let i = 0; i < berkas.length; i++) {
        await unggahSatuBerkas({ id: d.id, token: d.token }, berkas[i], i + 1, berkas.length, setMaju);
      }

      setKabar(`${berkas.length} berkas tersimpan di arsip kapal ✓`);
      setTimeout(() => setKabar(""), 5000);
      setJudul(""); setNomor(""); setCatatan(""); setBerkas([]);
      if (pilihRef.current) pilihRef.current.value = "";
      setBuka(false);
      await ambil();
    } catch (e: any) {
      setGalat(pesanRamah(e));
    } finally { setKirim(false); setMaju(null); }
  };

  const hapus = async (d: Dok) => {
    if (!window.confirm(`Hapus catatan "${d.judul}"?\n\nBerkasnya TETAP ada di Google Drive — yang hilang hanya catatannya di sini.`)) return;
    try {
      const r = await fetch(`/api/portal/dokumen?id=${encodeURIComponent(d.id)}`, { method: "DELETE" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Gagal menghapus");
      await ambil();
    } catch (e: any) { setGalat(e?.message || String(e)); }
  };

  return (
    <RangkaPortal aku={aku}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[12rem] flex-1">
          <h1 className="text-[17px] font-black text-slate-900 dark:text-white">Dokumen Kapal</h1>
          <p className="text-[11.5px] text-slate-500">
            Berita acara, temuan, bunker, serah terima — berkas di luar borang bulanan.
          </p>
        </div>
        <button onClick={() => setBuka((v) => !v)}
          className="rounded-xl bg-[#16357f] px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#12296a]">
          {buka ? "Tutup borang" : "+ Unggah dokumen"}
        </button>
      </div>

      {kabar && <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800 ring-1 ring-emerald-200">{kabar}</p>}
      {galat && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-800 ring-1 ring-rose-200">{galat}</p>}

      {/* ── borang unggah ─────────────────────────────────────────────── */}
      {buka && (
        <section className="mb-4 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <label className="block">
            <span className="text-[11px] font-bold uppercase text-slate-500">Golongan dokumen</span>
            <select value={jenis} onChange={(e) => setJenis(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[14px] dark:border-slate-600 dark:bg-slate-800">
              {pilihanJenis.map((j) => <option key={j.id} value={j.id}>{j.ikon} {j.label}</option>)}
            </select>
            {/* keterangan golongan: menghindari dokumen benar yang masuk laci salah */}
            <span className="mt-1 block text-[11px] leading-snug text-slate-500">{jenisDokumen(jenis)?.ket}</span>
          </label>

          <label className="mt-3 block">
            <span className="text-[11px] font-bold uppercase text-slate-500">Judul dokumen</span>
            <input value={judul} onChange={(e) => setJudul(e.target.value)}
              placeholder="mis. Berita Acara Kerusakan Pompa Pendingin ME Kanan"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[14px] dark:border-slate-600 dark:bg-slate-800" />
          </label>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label>
              <span className="text-[11px] font-bold uppercase text-slate-500">Tanggal kejadian</span>
              <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[13px] dark:border-slate-600 dark:bg-slate-800" />
            </label>
            <label>
              <span className="text-[11px] font-bold uppercase text-slate-500">Nomor (bila ada)</span>
              <input value={nomor} onChange={(e) => setNomor(e.target.value)} placeholder="mis. BA/012/IX/2026"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[13px] dark:border-slate-600 dark:bg-slate-800" />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="text-[11px] font-bold uppercase text-slate-500">Keterangan singkat</span>
            <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2}
              placeholder="Apa yang terjadi, siapa yang hadir, tindakan yang sudah diambil."
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[13px] dark:border-slate-600 dark:bg-slate-800" />
          </label>

          <label className="mt-3 block">
            <span className="text-[11px] font-bold uppercase text-slate-500">Berkas (boleh lebih dari satu)</span>
            <input ref={pilihRef} type="file" multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setBerkas(Array.from(e.target.files || []))}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12.5px] file:mr-3 file:rounded-lg file:border-0 file:bg-[#16357f] file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-white dark:border-slate-600 dark:bg-slate-800" />
          </label>

          {!!berkas.length && (
            <ul className="mt-2 space-y-1">
              {berkas.map((f) => (
                <li key={f.name} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px] dark:bg-slate-800/60">
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-700 dark:text-slate-200">{f.name}</span>
                  <span className="shrink-0 text-slate-500">{ukuran(f.size)}</span>
                </li>
              ))}
            </ul>
          )}

          {maju && (
            <p className="mt-2 rounded-lg bg-sky-50 px-2.5 py-2 text-[11.5px] font-semibold text-sky-900 ring-1 ring-sky-200">
              Mengunggah {maju.berkas} — potongan {maju.potongan}/{maju.total}
              {maju.percobaan > 1 ? ` (percobaan ke-${maju.percobaan})` : ""}
            </p>
          )}

          <button onClick={kirimDokumen} disabled={kirim}
            className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-[14px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">
            {kirim ? "Mengunggah…" : "Simpan & unggah ke Drive"}
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Berkas naik ke Google Drive kantor, folder <b>Dokumen Kapal › {aku?.kapal || "kapal ini"} › {jenisDokumen(jenis)?.folder}</b>.
            Sinyal putus di tengah tidak menghapus yang sudah naik — ulangi saja, unggahannya dilanjutkan.
          </p>
        </section>
      )}

      {/* ── saringan ──────────────────────────────────────────────────── */}
      <div className="mb-2 flex gap-2">
        <select value={saring} onChange={(e) => setSaring(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-[12.5px] dark:border-slate-600 dark:bg-slate-900">
          <option value="">Semua golongan</option>
          {JENIS_DOKUMEN.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
        </select>
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari judul / nomor…"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#16357f] dark:border-slate-600 dark:bg-slate-900" />
      </div>

      {/* ── daftar ────────────────────────────────────────────────────── */}
      {muat ? (
        <p className="rounded-2xl bg-white px-4 py-10 text-center text-[13px] text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900">Memuat…</p>
      ) : !tampil.length ? (
        <div className="rounded-2xl bg-white px-4 py-12 text-center ring-1 ring-slate-200 dark:bg-slate-900">
          <p className="text-2xl">🗂️</p>
          <p className="mt-2 text-[13px] font-bold text-slate-700 dark:text-slate-200">
            {baris.length ? "Tidak ada yang cocok dengan saringan." : "Belum ada dokumen tersimpan."}
          </p>
          {!baris.length && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
              Berita acara, temuan, bukti bunker, serah terima jabatan — simpan di sini supaya tidak hilang
              bersama obrolan WhatsApp.
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {tampil.map((d) => {
            const j = jenisDokumen(d.jenis);
            return (
              <li key={d.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-100 px-3.5 py-2.5 dark:border-slate-800">
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {j?.ikon} {j?.label || d.jenis}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500">{tanggalIndo(d.tanggal)}</span>
                  {d.nomor && <span className="text-[11px] text-slate-500">· {d.nomor}</span>}
                  <button onClick={() => hapus(d)} className="ml-auto text-[11px] font-bold text-rose-600 hover:underline">Hapus</button>
                </div>

                <div className="px-3.5 py-2.5">
                  <p className="text-[14px] font-bold leading-snug text-slate-900 dark:text-white">{d.judul}</p>
                  {d.catatan && <p className="mt-0.5 text-[12px] leading-snug text-slate-600 dark:text-slate-300">{d.catatan}</p>}

                  {!d.berkas.length ? (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11.5px] font-semibold text-amber-900 ring-1 ring-amber-200">
                      Belum ada berkas yang sampai — unggahannya terputus. Unggah ulang dokumen ini.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {d.berkas.map((f) => (
                        <li key={f.fileId} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/60">
                          <span className="shrink-0 text-[13px]">📄</span>
                          <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200" title={f.nama}>
                            {f.nama}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-500">{ukuran(f.ukuran)}</span>
                          <a href={`/api/lapor/isi?fileId=${encodeURIComponent(f.fileId)}`} target="_blank" rel="noreferrer"
                            className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-[#16357f] ring-1 ring-slate-300 transition hover:bg-slate-100 dark:bg-slate-900 dark:ring-slate-600">
                            Lihat
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="mt-1.5 text-[10.5px] text-slate-400">
                    Diunggah {d.olehAkun || "—"}
                    {d.dibuatPada ? ` · ${new Date(d.dibuatPada).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" })}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </RangkaPortal>
  );
}
