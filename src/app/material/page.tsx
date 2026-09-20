"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useMaterial } from "@/lib/material/store";
import { itemKategori } from "@/lib/material/types";
import { bulanTahun } from "@/lib/format";
import { generateMaterial, generateMaterialAll, MATERIAL_DOCS } from "@/lib/material/generateClient";
import { formatDok } from "@/lib/material/formatDok";
import { beritahu } from "@/components/Konfirmasi";

export default function MaterialDashboard() {
  const { req, update } = useMaterial();
  const [busy, setBusy] = useState<string | null>(null);
  const [ttd, setTtd] = useState<{ deptHead: boolean; stafTeknik: boolean; stempel: boolean; folder: string } | null>(null);

  // berkas tanda tangan ada di laptop, bukan di kode — layar menanyakannya
  // supaya pilihan membubuhkan tak ditawarkan saat berkasnya belum ada
  useEffect(() => {
    fetch("/api/material/ttd").then((r) => (r.ok ? r.json() : null)).then(setTtd).catch(() => setTtd(null));
  }, []);
  const ttdSiap = !!ttd && ttd.deptHead && ttd.stafTeknik && ttd.stempel;
  const totalSC = req.items.filter((i) => itemKategori(i) === "SC").length;
  const totalUmum = req.items.length - totalSC;

  const run = async (fn: () => Promise<void>, key: string) => {
    setBusy(key);
    try { await fn(); } catch (e: any) { void beritahu("Gagal: " + (e?.message ?? e)); } finally { setBusy(null); }
  };

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex items-center gap-4">
          <div className="bg-white rounded-2xl p-2 shadow-md shrink-0"><Image src="/logo-asdp.png" alt="ASDP" width={56} height={38} className="object-contain" /></div>
          <div>
            <h1 className="text-2xl font-extrabold asdp-text-gradient">Pengajuan Kode Material</h1>
            <p className="text-slate-500 text-sm">Periode {bulanTahun(req.tanggal)} · {req.items.length} item ({totalSC} SC, {totalUmum} umum)</p>
          </div>
        </div>
      </div>

      <section className="mt-5 grid sm:grid-cols-3 gap-4">
        <Link href="/material/cek" className="card-hover bg-white rounded-2xl elev-sm ring-line border border-transparent p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 grid place-items-center text-2xl text-white shadow-md">🔎</div>
          <div><p className="font-semibold text-slate-800">Cek Kode Material</p><p className="text-xs text-slate-400">Cek item sudah punya kode (SAP) atau belum</p></div>
        </Link>
        <Link href="/material/isi" className="card-hover bg-white rounded-2xl elev-sm ring-line border border-transparent p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center text-2xl text-white shadow-md">✏️</div>
          <div><p className="font-semibold text-slate-800">Input Item</p><p className="text-xs text-slate-400">Tambah/ubah item, kode, harga, kapal</p></div>
        </Link>
        <button onClick={() => run(() => generateMaterialAll(req), "all")} disabled={!!busy}
          className="card-hover bg-white rounded-2xl elev-sm ring-line border border-transparent p-4 flex items-center gap-4 text-left disabled:opacity-60">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 grid place-items-center text-2xl text-white shadow-md">🗂️</div>
          <div><p className="font-semibold text-slate-800">{busy === "all" ? "Menyiapkan ZIP…" : "Generate Semua"}</p><p className="text-xs text-slate-400">4 dokumen: template Excel, sisanya PDF (.zip)</p></div>
        </button>
      </section>

      {/* Pembubuhan tanda tangan. Hanya menyentuh Formulir Permintaan Master
          Data — dokumen itu yang memang bertanda tangan Dept. Head dan staf. */}
      <section className="mt-5 rounded-2xl bg-white ring-1 ring-slate-200 p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1" checked={!!req.bubuhiTtd} disabled={!ttdSiap}
            onChange={(e) => update({ bubuhiTtd: e.target.checked })} />
          <span className="flex-1">
            <span className="font-semibold text-slate-800 text-sm">
              Bubuhkan tanda tangan &amp; stempel pada Formulir Permintaan Master Data
            </span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Tanda tangan Dept. Head dan staf teknik, stempel cabang di sisi Dept. Head.
              {ttd && !ttdSiap && (
                <span className="text-amber-700">
                  {" "}Berkasnya belum lengkap di <code className="text-[11px]">{ttd.folder}</code> — perlu
                  {!ttd.deptHead ? " ttd-dept-head.png" : ""}{!ttd.stafTeknik ? " ttd-staf-teknik.png" : ""}
                  {!ttd.stempel ? " stempel.png" : ""}.
                </span>
              )}
              {ttdSiap && (
                <span className="text-slate-400">
                  {" "}Gambarnya tersimpan di laptop ini saja ({ttd!.folder}) dan tidak ikut ke GitHub.
                </span>
              )}
            </span>
          </span>
        </label>
      </section>

      {/* Sesudah berkasnya jadi, yang dikerjakan berikutnya selalu sama:
          menulis surat pengantarnya ke pusat. Tautannya ditaruh di sini supaya
          tidak perlu dicari lagi di daftar 20 jenis surat. */}
      <section className="mt-5 rounded-2xl bg-sky-50 ring-1 ring-sky-200 p-4 flex flex-wrap items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 grid place-items-center text-xl text-white shadow">📨</div>
        <div className="flex-1 min-w-[16rem]">
          <p className="font-semibold text-slate-800 text-sm">Surat pengantar ke divisi pusat</p>
          <p className="text-xs text-slate-500">
            “Terlampir permohonan kode material … bulan … tahun ….” — badan surat disusun di layar Surat E-Office,
            penandatanganan dan QR sahnya tetap di e-office.
          </p>
        </div>
        <Link href="/surat?t=pengantar-kode-material" className="btn btn-primary text-xs">✉️ Buat surat pengantar</Link>
      </section>

      <h2 className="font-bold text-slate-700 mt-8 mb-3">Dokumen ({MATERIAL_DOCS.length})</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {MATERIAL_DOCS.map((d) => (
          <div key={d.slug} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center text-xl text-white shadow">{d.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">{d.nama}</p>
                <p className="text-xs text-slate-400">{d.ket}</p>
              </div>
            </div>
            {/* bentuk utama tiap dokumen berbeda — lihat lib/material/formatDok.ts.
                Bentuk satunya tetap disediakan sebagai tombol kecil, karena
                sesekali dibutuhkan (mis. menyunting angka di Excel dulu). */}
            <div className="flex items-center gap-2 mt-3">
              {formatDok(d.slug) === "xlsx" ? (
                <>
                  <button onClick={() => run(() => generateMaterial(d.slug, "native", req), d.slug + "x")} disabled={!!busy}
                    className="btn btn-success text-xs disabled:opacity-50">📊 Excel</button>
                  <button onClick={() => run(() => generateMaterial(d.slug, "pdf", req), d.slug + "p")} disabled={!!busy}
                    className="text-[11px] text-slate-400 hover:text-slate-600 underline disabled:opacity-50">PDF</button>
                </>
              ) : (
                <>
                  <button onClick={() => run(() => generateMaterial(d.slug, "pdf", req), d.slug + "p")} disabled={!!busy}
                    className="btn btn-rose text-xs disabled:opacity-50">📄 PDF</button>
                  <button onClick={() => run(() => generateMaterial(d.slug, "native", req), d.slug + "x")} disabled={!!busy}
                    className="text-[11px] text-slate-400 hover:text-slate-600 underline disabled:opacity-50">Excel</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <footer className="mt-10 text-center text-xs text-slate-400">Output mengikuti template asli · PDF via MS Office di laptop ini</footer>
    </main>
  );
}
