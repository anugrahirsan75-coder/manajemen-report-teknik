"use client";
/**
 * Kirim Permintaan & Laporan Kapal — halaman TERBUKA, tanpa login.
 *
 * Dipakai ABK di kapal: pilih kapal, jenis dokumen, periode, lalu unggah
 * berkasnya. Berkas masuk ke Google Drive kantor, catatannya muncul di menu
 * "Permintaan & Laporan Kapal" di aplikasi Manajemen Report Teknik.
 *
 * Jaringan kapal naik-turun, jadi seluruh jalur unggah dirancang untuk PUTUS
 * DI TENGAH JALAN:
 *   · berkas dipecah kecil-kecil dan dikirim satu per satu,
 *   · potongan yang sudah sampai TIDAK diulang — server ditanya dulu sampai
 *     mana, lalu unggahan dilanjutkan dari situ,
 *   · tiap potongan punya batas waktu dan dicoba beberapa kali dengan jeda,
 *   · isian borang tidak pernah hilang, tombol coba lagi memakai kiriman sama.
 */
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { JENIS_LAPOR, JenisLapor, bulanIndo, labelJenis, tautanWa, ukuranSingkat, WA_KONFIRMASI } from "@/lib/lapor/types";
import { ACCEPT_BERKAS, kenaliBerkas, PESAN_JENIS_DITOLAK } from "@/lib/lapor/berkasJenis";

const MAKS_BERKAS = 12;
/** batas ini harus sama dengan BATAS_MB di docs/lapor-apps-script.gs */
const BATAS_MB = 35;
const BATAS_BYTE = BATAS_MB * 1024 * 1024;
/**
 * Berkas dibaca dan dikirim sepotong-sepotong supaya HP tidak menampung seluruh
 * PDF beserta salinan base64-nya sekaligus, dan supaya satu permintaan tetap
 * selesai walau jaringan lambat. Kelipatan 3 byte: base64 tiap potongan jadi
 * rata tanpa "=" di tengah, sehingga bisa disambung apa adanya di Drive.
 */
const BYTE_PER_POTONGAN = 2_250_000;
const MAKS_COBA = 5;
/** jeda antar percobaan — mengikuti sinyal kapal yang biasa hilang 20-60 detik */
const JEDA_COBA = [2000, 5000, 12000, 25000];
/** satu potongan tidak boleh menggantung selamanya */
const TENGGANG_MS = 90_000;

const tunggu = (ms: number) => new Promise((selesai) => setTimeout(selesai, ms));

const keB64 = (blob: Blob) => new Promise<string>((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result).split(",")[1] || "");
  fr.onerror = () => rej(new Error("Berkas tidak terbaca dari perangkat. Coba pilih ulang berkasnya."));
  fr.readAsDataURL(blob);
});

const pesanRamah = (e: unknown) => {
  const pesan = e instanceof Error ? e.message : String(e || "");
  if (/abort|timeout|tenggang/i.test(pesan)) {
    return "Jaringan terlalu lambat untuk berkas ini. Cari sinyal yang lebih baik lalu tekan coba lagi.";
  }
  if (/load failed|failed to fetch|networkerror|network request failed/i.test(pesan)) {
    return "Koneksi terputus saat mengunggah. Pastikan sinyal aktif lalu coba lagi.";
  }
  if (/<html|<!doctype/i.test(pesan)) return "Server sedang bermasalah. Coba lagi beberapa saat.";
  return pesan || "Unggahan gagal";
};

/** bulan berjalan menurut waktu HP, bukan UTC (di WIT, awal bulan bisa meleset sehari) */
const bulanIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

interface Siap { nama: string; mime: string; blob: Blob; ukuran: number }

/**
 * Foto dikecilkan dulu di peramban supaya hemat kuota ABK. Kalau peramban tidak
 * sanggup (HEIC di ponsel lama, canvas diblokir), berkas asli dikirim apa adanya
 * — jangan sampai foto malah gagal terkirim gara-gara pengecilan.
 */
async function siapkan(file: File): Promise<Siap> {
  const jenis = kenaliBerkas(file.name, file.type);
  if (!jenis) throw new Error(PESAN_JENIS_DITOLAK);

  if (jenis.gambar && typeof createImageBitmap === "function") {
    let img: ImageBitmap | null = null;
    try {
      // imageOrientation: foto HP menyimpan arah di EXIF; tanpa ini hasilnya
      // bisa tersimpan miring 90 derajat secara permanen.
      img = await createImageBitmap(file, { imageOrientation: "from-image" });
      const skala = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * skala));
      c.height = Math.max(1, Math.round(img.height * skala));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((r) => c.toBlob((b) => r(b), "image/jpeg", 0.78));
      if (blob && blob.size > 0) {
        const nama = file.name.replace(/\.[^.]+$/, "") + ".jpg";
        return { nama, mime: "image/jpeg", blob, ukuran: blob.size };
      }
    } catch { /* biarkan, kirim aslinya */ }
    finally { img?.close?.(); }   // lepas memori gambar penuh, 12 foto berturut bisa membekukan tab
  }
  // nama & jenis dibakukan supaya server tidak menolak berkas sah yang jenisnya
  // dilaporkan kosong oleh ponsel
  return { nama: file.name, mime: jenis.mime, blob: file, ukuran: file.size };
}

const kunciBerkas = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

interface GagalUnggah { file: File; pesan: string }
interface HasilKiriman {
  kiriman: { id: string; token: string };
  masuk: number;
  gagal: GagalUnggah[];
}

export default function KirimLaporKapal() {
  const [kapal, setKapal] = useState("");
  const [jenis, setJenis] = useState<JenisLapor | "">("");
  const [periode, setPeriode] = useState(bulanIni);
  const [pengirim, setPengirim] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [berkas, setBerkas] = useState<File[]>([]);

  const [kirim, setKirim] = useState(false);
  const [maju, setMaju] = useState("");
  const [persen, setPersen] = useState(0);
  const [galat, setGalat] = useState("");
  const [selesai, setSelesai] = useState<HasilKiriman | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idUnggah = useRef(new WeakMap<File, string>());
  const batal = useRef<AbortController | null>(null);
  const dibatalkan = useRef(false);

  const totalByte = useMemo(() => berkas.reduce((s, f) => s + f.size, 0), [berkas]);
  const siap = kapal && jenis && /^\d{4}-\d{2}$/.test(periode) && pengirim.trim().length >= 3 && berkas.length > 0;

  // Menutup halaman di tengah unggahan berarti kiriman menggantung tanpa berkas.
  useEffect(() => {
    if (!kirim) return;
    const jaga = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", jaga);
    return () => window.removeEventListener("beforeunload", jaga);
  }, [kirim]);

  const tambahBerkas = (l: FileList | null) => {
    if (!l) return;
    const dipilih = Array.from(l);
    // Penyaringan dihitung DI LUAR pembaru state. Kalau dikerjakan di dalamnya,
    // React memanggil pembaru itu dua kali saat mode ketat dan berkas yang
    // ditolak ikut terhitung dua kali di pesan.
    const adaKunci = new Set(berkas.map(kunciBerkas));
    const diterima: File[] = [];
    const kebesaran: string[] = [];
    const takDidukung: string[] = [];
    const kembar: string[] = [];
    let penuh = 0;

    for (const f of dipilih) {
      if (f.size > BATAS_BYTE) { kebesaran.push(f.name); continue; }
      if (!kenaliBerkas(f.name, f.type)) { takDidukung.push(f.name); continue; }
      if (adaKunci.has(kunciBerkas(f))) { kembar.push(f.name); continue; }
      if (berkas.length + diterima.length >= MAKS_BERKAS) { penuh++; continue; }
      adaKunci.add(kunciBerkas(f));
      diterima.push(f);
    }

    const catat: string[] = [];
    if (kebesaran.length) catat.push(`${kebesaran.length} berkas lebih dari ${BATAS_MB} MB`);
    if (takDidukung.length) catat.push(`${takDidukung.length} berkas jenisnya belum didukung`);
    if (kembar.length) catat.push(`${kembar.length} berkas sudah ada di daftar`);
    if (penuh) catat.push(`${penuh} berkas tidak muat (maksimal ${MAKS_BERKAS})`);
    setGalat(catat.length ? `Dilewati: ${catat.join(", ")}.` : "");
    if (diterima.length) setBerkas((lama) => [...lama, ...diterima]);
    if (inputRef.current) inputRef.current.value = "";
  };

  /** satu permintaan dengan batas waktu; galat jaringan ditandai boleh diulang */
  const mintaJson = async (alamat: string, isi: any) => {
    const ac = new AbortController();
    batal.current = ac;
    const jam = setTimeout(() => ac.abort(), TENGGANG_MS);
    try {
      const r = await fetch(alamat, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isi), signal: ac.signal,
      });
      const teks = await r.text();
      let d: any;
      try { d = JSON.parse(teks); }
      catch {
        const er: Error & { retryable?: boolean } = new Error(`Server menjawab tidak wajar (${r.status})`);
        er.retryable = r.status >= 500 || r.status === 0;
        throw er;
      }
      if (!r.ok || !d.ok) {
        const er: Error & { retryable?: boolean } = new Error(d.error || `Gagal (${r.status})`);
        er.retryable = Boolean(d.retryable) || [408, 429, 500, 502, 503, 504].includes(r.status);
        throw er;
      }
      return d;
    } finally {
      clearTimeout(jam);
      batal.current = null;
    }
  };

  /** tanya server: potongan mana yang sudah sampai untuk unggahan ini */
  const tanyaSampaiMana = async (kiriman: { id: string; token: string }, unggahId: string) => {
    try {
      const r = await fetch(
        `/api/lapor/berkas?id=${encodeURIComponent(kiriman.id)}&token=${encodeURIComponent(kiriman.token)}&unggahId=${encodeURIComponent(unggahId)}`,
        { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) return { sudah: new Set<number>(), hasil: null as any };
      if (d.selesai && d.hasil) return { sudah: new Set<number>(), hasil: d.hasil };
      return { sudah: new Set<number>((d.potongan || []) as number[]), hasil: null as any };
    } catch {
      return { sudah: new Set<number>(), hasil: null as any };   // gagal bertanya bukan alasan gagal kirim
    }
  };

  /** kirim satu berkas: pecah, lanjutkan dari potongan yang belum sampai */
  const unggahSatu = async (
    kiriman: { id: string; token: string }, f: File, urut: string,
  ) => {
    const s = await siapkan(f);
    if (s.ukuran === 0) throw new Error("Berkas kosong (0 byte). Pilih ulang berkasnya.");
    const total = Math.max(1, Math.ceil(s.blob.size / BYTE_PER_POTONGAN));

    let unggahId = idUnggah.current.get(f);
    if (!unggahId) {
      unggahId = `${kiriman.id.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      idUnggah.current.set(f, unggahId);
    }

    // Melanjutkan, bukan mengulang: inilah yang membuat berkas besar akhirnya
    // selesai di jaringan yang putus-nyambung.
    let sudah = new Set<number>();
    if (total > 1) {
      const cek = await tanyaSampaiMana(kiriman, unggahId);
      if (cek.hasil) { setPersen(100); return; }
      sudah = cek.sudah;
    }

    for (let k = 0; k < total; k++) {
      if (dibatalkan.current) throw new Error("Pengiriman dihentikan.");
      if (sudah.has(k) && k < total - 1) {           // potongan terakhir selalu dikirim: itu pemicu penyatuan
        setPersen(Math.round(((k + 1) / total) * 100));
        continue;
      }

      const awal = k * BYTE_PER_POTONGAN;
      const dataBase64 = await keB64(s.blob.slice(awal, Math.min(awal + BYTE_PER_POTONGAN, s.blob.size)));
      let beres = false;
      let galatTerakhir: unknown;

      for (let coba = 1; coba <= MAKS_COBA; coba++) {
        if (dibatalkan.current) throw new Error("Pengiriman dihentikan.");
        setMaju(coba > 1
          ? `Sinyal terputus — mencoba lagi (${coba}/${MAKS_COBA})…`
          : total > 1
            ? `Mengunggah ${urut} — bagian ${k + 1} dari ${total}`
            : `Mengunggah ${urut}…`);
        try {
          const d = await mintaJson("/api/lapor/berkas", {
            id: kiriman.id, token: kiriman.token, nama: s.nama, mime: s.mime,
            unggahId, indeks: k, total, dataBase64,
          });
          beres = true;
          setPersen(Math.round(((k + 1) / total) * 100));
          // Server bisa menyatakan berkas sudah utuh lebih cepat (mis. unggahan
          // ini pengulangan). Berhenti, jangan kirim sisa potongan percuma.
          if (d.selesai === true) return;
          break;
        } catch (e) {
          galatTerakhir = e;
          const bolehUlang = e instanceof TypeError
            || (e as any)?.name === "AbortError"
            || Boolean((e as Error & { retryable?: boolean })?.retryable);
          if (!bolehUlang || dibatalkan.current) break;
          if (coba < MAKS_COBA) await tunggu(JEDA_COBA[Math.min(coba - 1, JEDA_COBA.length - 1)]);
        }
      }
      if (!beres) throw new Error(pesanRamah(galatTerakhir));
      if (k === total - 1) throw new Error("Google Drive belum menyelesaikan berkas. Tekan coba lagi.");
    }
  };

  /** simpan sebab kegagalan pada kirimannya, supaya kantor tahu apa yang terjadi */
  const laporGagal = async (kiriman: { id: string; token: string }, pesan: string) => {
    try {
      await fetch("/api/lapor/gagal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...kiriman, pesan }),
      });
    } catch { /* diamkan: ini hanya catatan bantu */ }
  };

  const jalankanUnggah = async (
    kiriman: { id: string; token: string }, daftar: File[],
  ): Promise<{ masuk: number; gagal: GagalUnggah[] }> => {
    const gagal: GagalUnggah[] = [];
    let masuk = 0;
    for (let i = 0; i < daftar.length; i++) {
      setPersen(0);
      try {
        await unggahSatu(kiriman, daftar[i], `berkas ${i + 1} dari ${daftar.length}`);
        masuk++;
      } catch (e) {
        gagal.push({ file: daftar[i], pesan: pesanRamah(e) });
      }
      if (dibatalkan.current) {
        for (let j = i + 1; j < daftar.length; j++) gagal.push({ file: daftar[j], pesan: "Belum sempat dikirim." });
        break;
      }
    }
    if (gagal.length) await laporGagal(kiriman, `${gagal.length} berkas gagal: ${gagal[0].pesan}`);
    return { masuk, gagal };
  };

  const kirimSemua = async () => {
    setKirim(true); setGalat(""); setPersen(0); dibatalkan.current = false;
    setMaju("Membuka kiriman…");
    try {
      const d = await mintaJson("/api/lapor/kirim", { kapal, jenis, periode, pengirim, jabatan, catatan });
      const kiriman = { id: d.id, token: d.token };
      const { masuk, gagal } = await jalankanUnggah(kiriman, berkas);
      // Kiriman sudah dibuat. Walau semua berkas gagal karena sinyal, simpan ID
      // dan tokennya supaya tombol coba lagi memakai kiriman yang sama.
      setSelesai({ kiriman, masuk, gagal });
    } catch (e) {
      setGalat(pesanRamah(e));
    } finally {
      setKirim(false); setMaju(""); setPersen(0);
    }
  };

  const ulangiGagal = async () => {
    if (!selesai?.gagal.length) return;
    setKirim(true); setGalat(""); dibatalkan.current = false;
    try {
      const daftar = selesai.gagal.map((g) => g.file);
      const { masuk, gagal } = await jalankanUnggah(selesai.kiriman, daftar);
      setSelesai((lama) => (lama ? { ...lama, masuk: lama.masuk + masuk, gagal } : lama));
    } finally {
      setKirim(false); setMaju(""); setPersen(0);
    }
  };

  const hentikan = () => {
    dibatalkan.current = true;
    batal.current?.abort();
    setMaju("Menghentikan…");
  };

  const ulangi = () => {
    setSelesai(null); setBerkas([]); setCatatan("");
    idUnggah.current = new WeakMap<File, string>();
  };

  // ── layar hasil ───────────────────────────────────────────────────────────
  if (selesai) {
    const semuaMasuk = selesai.gagal.length === 0;
    const belumAdaYangMasuk = selesai.masuk === 0;
    const pesan = `Halo, saya ${pengirim}${jabatan ? ` (${jabatan})` : ""} dari ${kapal}.\n`
      + `Sudah mengirim ${labelJenis(jenis as string)} periode ${bulanIni() === periode ? bulanIndo(periode) : bulanIndo(periode)} `
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
              <p className="mt-3 text-xs">
                Tidak perlu mengisi ulang formulir, dan bagian yang sudah terkirim tidak diulang.
                Pastikan sinyal aktif, lalu tekan tombol coba lagi.
              </p>
            </div>
          )}
          {kirim && (
            <div className="mt-4">
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${persen}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{maju}</p>
            </div>
          )}
          <div className="mt-6 flex flex-col items-stretch justify-center gap-2 sm:flex-row">
            {!!selesai.gagal.length && (
              <button type="button" onClick={ulangiGagal} disabled={kirim}
                className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-300">
                {kirim ? maju || "Mencoba lagi…" : `↻ Coba lagi ${selesai.gagal.length} berkas`}
              </button>
            )}
            {kirim && (
              <button type="button" onClick={hentikan}
                className="rounded-xl bg-white px-5 py-3 font-bold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
                Hentikan
              </button>
            )}
            {selesai.masuk > 0 && !kirim && (
              <a href={tautanWa(pesan)} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-700">
                💬 Konfirmasi lewat WhatsApp
              </a>
            )}
          </div>
          {semuaMasuk && <p className="mt-2 text-xs text-slate-500">Pesannya sudah terisi otomatis, tinggal kirim.</p>}
          {!kirim && (
            <button onClick={ulangi} className="mt-6 block mx-auto text-sm font-semibold text-blue-700 hover:underline">
              Kirim dokumen lain
            </button>
          )}
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
              <button key={j.id} type="button" onClick={() => setJenis(j.id)} disabled={kirim}
                className={`text-left rounded-xl px-3 py-3 ring-1 transition disabled:opacity-60 ${
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
            <select value={kapal} onChange={(e) => setKapal(e.target.value)} disabled={kirim}
              className="w-full rounded-xl ring-1 ring-slate-300 px-3 py-2.5 bg-white disabled:bg-slate-100">
              <option value="">— pilih kapal —</option>
              {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">3. Periode</label>
            <input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} disabled={kirim}
              className="w-full rounded-xl ring-1 ring-slate-300 px-3 py-2.5 disabled:bg-slate-100" />
            <p className="text-xs text-slate-500 mt-1">Bulan yang dilaporkan, bukan tanggal kirim.</p>
          </div>
        </div>

        {/* pengirim — nomor HP sengaja tidak diminta; konfirmasi lewat WhatsApp kantor */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">4. Nama pengirim</label>
            <input value={pengirim} onChange={(e) => setPengirim(e.target.value)} placeholder="Nama lengkap" disabled={kirim}
              className="w-full rounded-xl ring-1 ring-slate-300 px-3 py-2.5 disabled:bg-slate-100" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Jabatan</label>
            <input value={jabatan} onChange={(e) => setJabatan(e.target.value)} placeholder="Mualim I / KKM / …" disabled={kirim}
              className="w-full rounded-xl ring-1 ring-slate-300 px-3 py-2.5 disabled:bg-slate-100" />
          </div>
        </div>

        {/* berkas */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">5. Berkas</label>
          <input ref={inputRef} type="file" multiple onChange={(e) => tambahBerkas(e.target.files)}
            accept={ACCEPT_BERKAS} disabled={kirim}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white file:font-semibold disabled:opacity-60" />
          <p className="text-xs text-slate-500 mt-1">
            PDF, foto (termasuk HEIC dari iPhone), Word, atau Excel. Maksimal {MAKS_BERKAS} berkas,
            tiap berkas ≤ {BATAS_MB} MB. Foto dikecilkan otomatis supaya hemat kuota.
          </p>
          {!!berkas.length && (
            <ul className="mt-3 space-y-1.5">
              {berkas.map((f, i) => (
                <li key={kunciBerkas(f)} className="flex items-center gap-2 text-sm bg-slate-50 ring-1 ring-slate-200 rounded-lg px-3 py-2">
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-xs text-slate-500 shrink-0">{ukuranSingkat(f.size)}</span>
                  <button onClick={() => setBerkas((b) => b.filter((_, k) => k !== i))} disabled={kirim}
                    className="text-rose-600 hover:text-rose-800 text-xs font-bold shrink-0 disabled:text-slate-300">hapus</button>
                </li>
              ))}
              <li className="text-xs text-slate-500 pl-1">Total {ukuranSingkat(totalByte)}</li>
            </ul>
          )}
        </div>

        {/* catatan */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">6. Catatan <span className="font-normal text-slate-400">(boleh kosong)</span></label>
          <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3} disabled={kirim}
            placeholder="Contoh: permintaan mendesak, alat sudah tidak layak pakai."
            className="w-full rounded-xl ring-1 ring-slate-300 px-3 py-2.5 disabled:bg-slate-100" />
        </div>

        {galat && <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-800 text-sm px-3 py-2">{galat}</div>}

        {kirim && (
          <div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${persen}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-600">{maju}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button onClick={kirimSemua} disabled={!siap || kirim}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold px-6 py-3">
            {kirim ? "Mengirim…" : "Kirim ke kantor"}
          </button>
          {kirim ? (
            <button onClick={hentikan} className="rounded-xl bg-white ring-1 ring-slate-300 hover:bg-slate-50 text-slate-700 font-bold px-5 py-3">
              Hentikan
            </button>
          ) : (
            <a href={tautanWa(`Halo, saya mau tanya soal pengiriman ${jenis ? labelJenis(jenis) : "permintaan/laporan"} kapal${kapal ? ` ${kapal}` : ""}.`)}
               target="_blank" rel="noopener noreferrer"
               className="rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-3">
              💬 Konfirmasi WA
            </a>
          )}
          {!siap && !kirim && <span className="text-xs text-slate-500">Lengkapi jenis, kapal, nama pengirim, dan berkas dulu.</span>}
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 mt-6">
        Konfirmasi juga bisa langsung ke WhatsApp kantor +{WA_KONFIRMASI}
      </p>
    </main>
  );
}
