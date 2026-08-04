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
const BATAS_BYTE = 12 * 1024 * 1024;

/** foto dari HP dikecilkan dulu di peramban — hemat kuota ABK & cepat terkirim */
async function siapkan(file: File): Promise<{ nama: string; mime: string; b64: string; ukuran: number }> {
  const keB64 = (blob: Blob) => new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(",")[1] || "");
    fr.onerror = () => rej(new Error("Gagal membaca berkas"));
    fr.readAsDataURL(blob);
  });

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
      return { nama, mime: "image/jpeg", b64: await keB64(blob), ukuran: blob.size };
    } catch { /* kalau gagal dikecilkan, kirim apa adanya */ }
  }
  return { nama: file.name, mime: file.type || "application/octet-stream", b64: await keB64(file), ukuran: file.size };
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
  const [selesai, setSelesai] = useState<{ id: string; masuk: number; gagal: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalByte = useMemo(() => berkas.reduce((s, f) => s + f.size, 0), [berkas]);
  const siap = kapal && jenis && /^\d{4}-\d{2}$/.test(periode) && pengirim.trim().length >= 3 && berkas.length > 0;

  const tambahBerkas = (l: FileList | null) => {
    if (!l) return;
    const baru = Array.from(l).filter((f) => f.size <= BATAS_BYTE);
    const ditolak = Array.from(l).length - baru.length;
    setBerkas((b) => [...b, ...baru].slice(0, MAKS_BERKAS));
    setGalat(ditolak ? `${ditolak} berkas dilewati karena lebih dari 12 MB.` : "");
    if (inputRef.current) inputRef.current.value = "";
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

      const gagal: string[] = [];
      let masuk = 0;
      for (let i = 0; i < berkas.length; i++) {
        setMaju(`Mengunggah berkas ${i + 1} dari ${berkas.length}…`);
        try {
          const s = await siapkan(berkas[i]);
          const rr = await fetch("/api/lapor/berkas", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: d.id, token: d.token, nama: s.nama, mime: s.mime, dataBase64: s.b64 }),
          });
          const dd = await rr.json();
          if (!dd.ok) throw new Error(dd.error || `Gagal (${rr.status})`);
          masuk++;
        } catch (e: any) {
          gagal.push(`${berkas[i].name}: ${e?.message || e}`);
        }
      }
      if (!masuk) throw new Error(gagal[0] || "Tidak ada berkas yang berhasil diunggah");
      setSelesai({ id: d.id, masuk, gagal });
    } catch (e: any) {
      setGalat(e?.message || String(e));
    } finally {
      setKirim(false); setMaju("");
    }
  };

  const ulangi = () => {
    setSelesai(null); setBerkas([]); setCatatan("");
  };

  // ── layar berhasil ────────────────────────────────────────────────────────
  if (selesai) {
    const pesan = `Halo, saya ${pengirim}${jabatan ? ` (${jabatan})` : ""} dari ${kapal}.\n`
      + `Sudah mengirim ${labelJenis(jenis as string)} periode ${bulanIndo(periode)} `
      + `sebanyak ${selesai.masuk} berkas lewat halaman Lapor Kapal. Mohon dicek. Terima kasih.`;
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-8 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h1 className="text-2xl font-extrabold text-slate-900">Kiriman masuk</h1>
          <p className="mt-2 text-slate-600">
            {selesai.masuk} berkas <b>{labelJenis(jenis as string)}</b> dari <b>{kapal}</b> periode{" "}
            <b>{bulanIndo(periode)}</b> sudah tersimpan.
          </p>
          {!!selesai.gagal.length && (
            <div className="mt-4 text-left text-sm bg-amber-50 ring-1 ring-amber-200 rounded-xl p-3 text-amber-800">
              <b>Belum terkirim:</b>
              <ul className="list-disc ml-5 mt-1">{selesai.gagal.map((g, i) => <li key={i}>{g}</li>)}</ul>
              <p className="mt-1">Kirim ulang berkas itu saja lewat borang di bawah.</p>
            </div>
          )}
          <a href={tautanWa(pesan)} target="_blank" rel="noopener noreferrer"
             className="mt-6 inline-flex items-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-3">
            💬 Konfirmasi lewat WhatsApp
          </a>
          <p className="mt-2 text-xs text-slate-500">Pesannya sudah terisi otomatis, tinggal kirim.</p>
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
            PDF, foto, Word, atau Excel. Maksimal {MAKS_BERKAS} berkas, tiap berkas ≤ 12 MB.
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
