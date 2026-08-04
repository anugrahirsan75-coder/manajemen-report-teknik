"use client";
/**
 * Kirim Permintaan & Laporan Kapal — halaman TERBUKA, tanpa login.
 *
 * Dipakai ABK di kapal: pilih kapal, jenis dokumen, periode, lalu unggah
 * berkasnya. Berkas masuk ke Google Drive kantor, catatannya muncul di menu
 * "Permintaan & Laporan Kapal" di aplikasi Manajemen Report Teknik.
 *
 * Unggahan dikirim satu per satu. Kalau sinyal kapal putus di tengah jalan,
 * yang sudah masuk tetap tercatat dan sisanya bisa diulang tanpa mengisi
 * borang dari awal.
 */
import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { JENIS_LAPOR, JenisLapor, bulanIndo, labelJenis, tautanWa, ukuranSingkat, WA_KONFIRMASI } from "@/lib/lapor/types";

const MAKS_BERKAS = 12;
const BATAS_BYTE = 50 * 1024 * 1024;
/**
 * Berkas dibaca dan dikirim sepotong-sepotong supaya HP tidak menampung seluruh
 * PDF beserta salinan base64-nya sekaligus. Potongan disatukan di Google Drive.
 */
const BYTE_PER_POTONGAN = 2_250_000;
const MAKS_COBA = 3;

const tunggu = (ms: number) => new Promise((selesai) => setTimeout(selesai, ms));

const keB64 = (blob: Blob) => new Promise<string>((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result).split(",")[1] || "");
  fr.onerror = () => rej(new Error("Gagal membaca berkas dari perangkat"));
  fr.readAsDataURL(blob);
});

const pesanRamah = (e: unknown) => {
  const pesan = e instanceof Error ? e.message : String(e || "");
  if (/load failed|failed to fetch|networkerror|network request failed/i.test(pesan)) {
    return "Koneksi terputus saat mengunggah. Pastikan sinyal aktif lalu coba lagi.";
  }
  return pesan || "Unggahan gagal";
};

/** foto dari HP dikecilkan dulu di peramban — hemat kuota ABK & cepat terkirim */
async function siapkan(file: File): Promise<{ nama: string; mime: string; blob: Blob; ukuran: number }> {
  if (file.type.startsWith("image/") && file.type !== "image/heic") {
    try {
      const img = await createImageBitmap(file);
      const skala = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * skala);
      c.height = Math.round(img.height * skala);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b || file), "image/jpeg", 0.78));
      const nama = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      return { nama, mime: "image/jpeg", blob, ukuran: blob.size };
    } catch { /* kalau gagal dikecilkan, kirim apa adanya */ }
  }
  return { nama: file.name, mime: file.type || "application/octet-stream", blob: file, ukuran: file.size };
}

interface GagalUnggah { file: File; pesan: string }
interface HasilKiriman {
  kiriman: { id: string; token: string };
  masuk: number;
  gagal: GagalUnggah[];
}

export default function KirimLaporKapal() {
  const [kapal, setKapal] = useState("");
  const [jenis, setJenis] = useState<JenisLapor | "">("");
  const [periode, setPeriode] = useState(new Date().toISOString().slice(0, 7));
  const [pengirim, setPengirim] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [berkas, setBerkas] = useState<File[]>([]);

  const [kirim, setKirim] = useState(false);
  const [maju, setMaju] = useState("");
  const [galat, setGalat] = useState("");
  const [selesai, setSelesai] = useState<HasilKiriman | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idUnggah = useRef(new WeakMap<File, string>());

  const totalByte = useMemo(() => berkas.reduce((s, f) => s + f.size, 0), [berkas]);
  const siap = kapal && jenis && /^\d{4}-\d{2}$/.test(periode) && pengirim.trim().length >= 3 && berkas.length > 0;

  const tambahBerkas = (l: FileList | null) => {
    if (!l) return;
    const baru = Array.from(l).filter((f) => f.size <= BATAS_BYTE);
    const ditolak = Array.from(l).length - baru.length;
    setBerkas((b) => [...b, ...baru].slice(0, MAKS_BERKAS));
    setGalat(ditolak ? `${ditolak} berkas dilewati karena lebih dari 50 MB.` : "");
    if (inputRef.current) inputRef.current.value = "";
  };

  /** kirim satu berkas: pecah, lempar potongan demi potongan, kembalikan berkas jadi */
  const unggahSatu = async (
    kiriman: { id: string; token: string }, f: File, urut: string,
  ) => {
    const s = await siapkan(f);
    const total = Math.max(1, Math.ceil(s.blob.size / BYTE_PER_POTONGAN));
    let unggahId = idUnggah.current.get(f);
    if (!unggahId) {
      unggahId = `${kiriman.id.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      idUnggah.current.set(f, unggahId);
    }

    for (let k = 0; k < total; k++) {
      // Hanya satu potongan berada di memori. Ini mencegah Safari/Chrome pada
      // HP menutup permintaan besar dengan pesan "Load failed".
      const awal = k * BYTE_PER_POTONGAN;
      const dataBase64 = await keB64(s.blob.slice(awal, Math.min(awal + BYTE_PER_POTONGAN, s.blob.size)));
      let selesaiBagian = false;
      let galatTerakhir: unknown;

      for (let coba = 1; coba <= MAKS_COBA; coba++) {
        setMaju(coba > 1
          ? `Sinyal terputus — mencoba lagi (${coba}/${MAKS_COBA})…`
          : total > 1
            ? `Mengunggah ${urut} — bagian ${k + 1} dari ${total}…`
            : `Mengunggah ${urut}…`);
        try {
          const rr = await fetch("/api/lapor/berkas", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: kiriman.id, token: kiriman.token, nama: s.nama, mime: s.mime,
              unggahId, indeks: k, total, dataBase64,
            }),
          });
          const teks = await rr.text();
          let dd: any;
          try { dd = JSON.parse(teks); }
          catch {
            const er: Error & { retryable?: boolean } = new Error(`Respons server tidak terbaca (${rr.status})`);
            er.retryable = rr.status >= 500;
            throw er;
          }
          if (!rr.ok || !dd.ok) {
            const er: Error & { retryable?: boolean } = new Error(dd.error || `Gagal (${rr.status})`);
            er.retryable = Boolean(dd.retryable) || [408, 429, 503, 504].includes(rr.status);
            throw er;
          }
          if (k === total - 1 && dd.selesai !== true) {
            throw new Error("Google Drive belum menyelesaikan berkas");
          }
          selesaiBagian = true;
          break;
        } catch (e) {
          galatTerakhir = e;
          const retryable = e instanceof TypeError || Boolean((e as Error & { retryable?: boolean })?.retryable);
          if (!retryable) break;
          if (coba < MAKS_COBA) await tunggu(coba * 1200);
        }
      }
      if (!selesaiBagian) throw new Error(pesanRamah(galatTerakhir));
    }
  };

  const kirimSemua = async () => {
    setKirim(true); setGalat(""); setMaju("Membuka kiriman…");
    try {
      const r = await fetch("/api/lapor/kirim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kapal, jenis, periode, pengirim, jabatan, catatan }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal membuka kiriman");

      const gagal: GagalUnggah[] = [];
      let masuk = 0;
      for (let i = 0; i < berkas.length; i++) {
        try {
          await unggahSatu(d, berkas[i], `berkas ${i + 1} dari ${berkas.length}`);
          masuk++;
        } catch (e) {
          gagal.push({ file: berkas[i], pesan: pesanRamah(e) });
        }
      }
      // Kiriman sudah dibuat. Walau semua berkas gagal karena sinyal, simpan ID
      // dan tokennya supaya tombol coba lagi memakai kiriman yang sama.
      setSelesai({ kiriman: { id: d.id, token: d.token }, masuk, gagal });
    } catch (e) {
      setGalat(pesanRamah(e));
    } finally {
      setKirim(false); setMaju("");
    }
  };

  const ulangiGagal = async () => {
    if (!selesai?.gagal.length) return;
    setKirim(true); setGalat("");
    const gagalLagi: GagalUnggah[] = [];
    let tambahan = 0;
    try {
      for (let i = 0; i < selesai.gagal.length; i++) {
        const item = selesai.gagal[i];
        try {
          await unggahSatu(selesai.kiriman, item.file, `berkas ${i + 1} dari ${selesai.gagal.length}`);
          tambahan++;
        } catch (e) {
          gagalLagi.push({ file: item.file, pesan: pesanRamah(e) });
        }
      }
      setSelesai((lama) => lama ? { ...lama, masuk: lama.masuk + tambahan, gagal: gagalLagi } : lama);
    } finally {
      setKirim(false); setMaju("");
    }
  };

  const ulangi = () => {
    setSelesai(null); setBerkas([]); setCatatan("");
    idUnggah.current = new WeakMap<File, string>();
  };

  // ── layar berhasil ────────────────────────────────────────────────────────
  if (selesai) {
    const semuaMasuk = selesai.gagal.length === 0;
    const belumAdaYangMasuk = selesai.masuk === 0;
    const pesan = `Halo, saya ${pengirim}${jabatan ? ` (${jabatan})` : ""} dari ${kapal}.\n`
      + `Sudah mengirim ${labelJenis(jenis as string)} periode ${bulanIndo(periode)} `
      + `sebanyak ${selesai.masuk} berkas lewat halaman Lapor Kapal.`
      + (selesai.gagal.length ? ` Masih ada ${selesai.gagal.length} berkas yang belum berhasil.` : "")
      + ` Mohon dicek. Terima kasih.`;
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-8 text-center">
          <div className="text-5xl mb-3">{semuaMasuk ? "✅" : belumAdaYangMasuk ? "📶" : "⏳"}</div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {semuaMasuk ? "Kiriman berhasil" : belumAdaYangMasuk ? "Berkas belum terkirim" : "Sebagian berkas masuk"}
          </h1>
          <p className="mt-2 text-slate-600">
            {selesai.masuk > 0 ? <><b>{selesai.masuk} berkas</b> sudah tersimpan untuk </> : "Belum ada berkas yang tersimpan untuk "}
            <b>{labelJenis(jenis as string)}</b> dari <b>{kapal}</b> periode <b>{bulanIndo(periode)}</b>.
          </p>
          {!!selesai.gagal.length && (
            <div className="mt-5 text-left text-sm bg-amber-50 ring-1 ring-amber-200 rounded-2xl p-4 text-amber-900">
              <b>{selesai.gagal.length} berkas menunggu dikirim:</b>
              <ul className="mt-2 space-y-2">{selesai.gagal.map((g, i) => (
                <li key={`${g.file.name}-${i}`} className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-amber-200/70">
                  <span className="block truncate font-bold">{g.file.name}</span>
                  <span className="block text-xs text-amber-700">{g.pesan}</span>
                </li>
              ))}</ul>
              <p className="mt-3 text-xs">Tidak perlu mengisi ulang formulir. Pastikan sinyal aktif, lalu tekan tombol coba lagi.</p>
            </div>
          )}
          <div className="mt-6 flex flex-col items-stretch justify-center gap-2 sm:flex-row">
            {!!selesai.gagal.length && (
              <button type="button" onClick={ulangiGagal} disabled={kirim}
                className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-300">
                {kirim ? maju || "Mencoba lagi…" : `↻ Coba lagi ${selesai.gagal.length} berkas`}
              </button>
            )}
            {selesai.masuk > 0 && (
              <a href={tautanWa(pesan)} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-700">
                💬 Konfirmasi lewat WhatsApp
              </a>
            )}
          </div>
          {semuaMasuk && <p className="mt-2 text-xs text-slate-500">Pesannya sudah terisi otomatis, tinggal kirim.</p>}
          <button onClick={ulangi} className="mt-6 block mx-auto text-sm font-semibold text-blue-700 hover:underline">
            Kirim dokumen lain
          </button>
        </div>
      </main>
    );
  }

  // ── borang ────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <header className="flex items-center gap-3 mb-5">
        <div className="bg-white rounded-xl p-1.5 ring-1 ring-slate-200 shrink-0">
          <Image src="/logo-asdp.png" alt="ASDP" width={44} height={30} className="object-contain" />
        </div>
        <div className="leading-tight">
          <h1 className="text-2xl font-extrabold asdp-text-gradient">Lapor Kapal</h1>
          <p className="text-sm text-slate-500">Permintaan &amp; Laporan Deck / Mesin · Teknik ASDP Ternate</p>
        </div>
      </header>

      <div className="rounded-2xl bg-blue-50 ring-1 ring-blue-200 p-4 text-sm text-blue-900 mb-5">
        Kirim permintaan atau laporan kapal di sini. Tidak perlu akun. Berkas langsung
        masuk ke arsip kantor dan terbaca oleh Teknik ASDP Ternate.
      </div>

      <div className="rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-5 space-y-5">
        {/* jenis dokumen */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">1. Dokumen apa yang dikirim?</label>
          <div className="grid grid-cols-2 gap-2">
            {JENIS_LAPOR.map((j) => (
              <button key={j.id} type="button" onClick={() => setJenis(j.id)}
                className={`text-left rounded-xl px-3 py-3 ring-1 transition ${
                  jenis === j.id ? "bg-blue-600 text-white ring-blue-600" : "bg-slate-50 ring-slate-200 hover:bg-slate-100"}`}>
                <div className="text-lg leading-none">{j.ikon}</div>
                <div className="font-bold text-sm mt-1">{j.singkat}</div>
                <div className={`text-xs ${jenis === j.id ? "text-blue-100" : "text-slate-500"}`}>Bagian {j.bagian}</div>
              </button>
            ))}
          </div>
        </div>

        {/* kapal + periode */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">2. Kapal</label>
            <select value={kapal} onChange={(e) => setKapal(e.target.value)}
              className="w-full rounded-xl ring-1 ring-slate-300 px-3 py-2.5 bg-white">
              <option value="">— pilih kapal —</option>
              {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">3. Periode</label>
            <input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)}
              className="w-full rounded-xl ring-1 ring-slate-300 px-3 py-2.5" />
            <p className="text-xs text-slate-500 mt-1">Bulan yang dilaporkan, bukan tanggal kirim.</p>
          </div>
        </div>

        {/* pengirim — nomor HP sengaja tidak diminta; konfirmasi lewat WhatsApp kantor */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">4. Nama pengirim</label>
            <input value={pengirim} onChange={(e) => setPengirim(e.target.value)} placeholder="Nama lengkap"
              className="w-full rounded-xl ring-1 ring-slate-300 px-3 py-2.5" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Jabatan</label>
            <input value={jabatan} onChange={(e) => setJabatan(e.target.value)} placeholder="Mualim I / KKM / …"
              className="w-full rounded-xl ring-1 ring-slate-300 px-3 py-2.5" />
          </div>
        </div>

        {/* berkas */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">5. Berkas</label>
          <input ref={inputRef} type="file" multiple onChange={(e) => tambahBerkas(e.target.files)}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white file:font-semibold" />
          <p className="text-xs text-slate-500 mt-1">
            PDF, foto, Word, atau Excel. Maksimal {MAKS_BERKAS} berkas, tiap berkas ≤ 50 MB.
            Foto dikecilkan otomatis supaya hemat kuota.
          </p>
          {!!berkas.length && (
            <ul className="mt-3 space-y-1.5">
              {berkas.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm bg-slate-50 ring-1 ring-slate-200 rounded-lg px-3 py-2">
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-xs text-slate-500 shrink-0">{ukuranSingkat(f.size)}</span>
                  <button onClick={() => setBerkas((b) => b.filter((_, k) => k !== i))}
                    className="text-rose-600 hover:text-rose-800 text-xs font-bold shrink-0">hapus</button>
                </li>
              ))}
              <li className="text-xs text-slate-500 pl-1">Total {ukuranSingkat(totalByte)}</li>
            </ul>
          )}
        </div>

        {/* catatan */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">6. Catatan <span className="font-normal text-slate-400">(boleh kosong)</span></label>
          <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3}
            placeholder="Contoh: permintaan mendesak, alat sudah tidak layak pakai."
            className="w-full rounded-xl ring-1 ring-slate-300 px-3 py-2.5" />
        </div>

        {galat && <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-800 text-sm px-3 py-2">{galat}</div>}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button onClick={kirimSemua} disabled={!siap || kirim}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold px-6 py-3">
            {kirim ? maju || "Mengirim…" : "Kirim ke kantor"}
          </button>
          <a href={tautanWa(`Halo, saya mau tanya soal pengiriman ${jenis ? labelJenis(jenis) : "permintaan/laporan"} kapal${kapal ? ` ${kapal}` : ""}.`)}
             target="_blank" rel="noopener noreferrer"
             className="rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-3">
            💬 Konfirmasi WA
          </a>
          {!siap && !kirim && <span className="text-xs text-slate-500">Lengkapi jenis, kapal, nama pengirim, dan berkas dulu.</span>}
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 mt-6">
        Konfirmasi juga bisa langsung ke WhatsApp kantor +{WA_KONFIRMASI}
      </p>
    </main>
  );
}
