"use client";
/**
 * Monitoring Sensor Kapal — pintu masuk ke laporan Looker Studio Regional 4.
 *
 * Laporan ini milik pusat dan pemiliknya MEMATIKAN penyematan ("Melihat di situs
 * lain telah dinonaktifkan"), jadi menampilkannya dalam bingkai hanya memunculkan
 * halaman galat Google. Karena itu halaman ini dibuat sebagai peluncur: tombol
 * buka yang jelas + keterangan isinya. Bingkai tetap disediakan sebagai percobaan
 * (tersembunyi), supaya begitu pusat mengizinkan penyematan tinggal dinyalakan.
 */
import { useState } from "react";

const LAPORAN = "a54d8700-358b-4b4a-a617-0a22b5fd7b3e";
const HALAMAN = "6LHOF";
const URL_BUKA = `https://lookerstudio.google.com/u/0/reporting/${LAPORAN}/page/${HALAMAN}`;
const URL_SEMAT = `https://lookerstudio.google.com/embed/reporting/${LAPORAN}/page/${HALAMAN}`;

const ISI = [
  { ikon: "🚦", judul: "Status mesin", teks: "Status_ME1 & Status_ME2 — Normal, Low Pressure, atau Engine Off" },
  { ikon: "🔄", judul: "Putaran mesin", teks: "rpm_me1 & rpm_me2 saat data terakhir terkirim" },
  { ikon: "🌡️", judul: "Suhu", teks: "temp_me1 & temp_me2 per mesin induk" },
  { ikon: "🧯", judul: "Tekanan", teks: "pressure — nilai 0 ditandai merah di laporan" },
  { ikon: "🕒", judul: "Waktu data", teks: "tanggal & jam pengiriman terakhir tiap kapal" },
  { ikon: "🏢", judul: "Lingkup", teks: "seluruh cabang Regional 4 — Ternate, Ambon, Bitung, Luwuk, Sorong, Biak, Merauke, Selayar" },
];

export default function SensorPage() {
  const [coba, setCoba] = useState(false);

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex flex-wrap items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-700 grid place-items-center text-2xl text-white shadow-md shrink-0">📡</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold asdp-text-gradient tracking-tight">Monitoring Sensor Kapal</h1>
            <p className="text-slate-500 text-sm">Rekapitulasi Data Sensor Terupdate Regional 4 — laporan Looker Studio pusat</p>
          </div>
          <a href={URL_BUKA} target="_blank" rel="noreferrer" className="btn btn-primary text-sm px-5 py-2.5">📡 Buka Monitoring Sensor ↗</a>
        </div>
      </div>

      {/* kartu peluncur */}
      <section className="mt-5 bg-white rounded-2xl ring-line elev-md overflow-hidden">
        <div className="px-6 py-5 flex flex-wrap items-center gap-4 border-b border-slate-200 bg-gradient-to-r from-cyan-50 to-white">
          <div className="h-14 w-14 rounded-2xl bg-slate-900 grid place-items-center text-2xl shrink-0">📊</div>
          <div className="flex-1 min-w-[14rem]">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Looker Studio · laporan pusat</p>
            <p className="font-extrabold text-slate-800 leading-tight">Rekapitulasi Data Sensor Terupdate Regional 4</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-mono break-all">{URL_BUKA}</p>
          </div>
          <a href={URL_BUKA} target="_blank" rel="noreferrer" className="btn btn-primary text-sm px-5 py-2.5">Buka di tab baru ↗</a>
          <button
            onClick={() => { navigator.clipboard?.writeText(URL_BUKA); }}
            className="btn btn-ghost text-xs" title="Salin tautannya">⧉ Salin tautan</button>
        </div>

        <div className="p-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ISI.map((x) => (
            <div key={x.judul} className="rounded-xl ring-1 ring-slate-200 bg-slate-50/60 px-4 py-3">
              <p className="font-bold text-slate-800 text-sm">{x.ikon} {x.judul}</p>
              <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">{x.teks}</p>
            </div>
          ))}
        </div>
      </section>

      {/* kenapa tidak ditampilkan langsung di sini */}
      <div className="mt-4 rounded-2xl bg-amber-50 ring-1 ring-amber-200 px-5 py-4">
        <p className="font-bold text-amber-900 text-sm mb-1">Kenapa laporannya tidak langsung tampil di halaman ini?</p>
        <p className="text-[12px] text-amber-900 leading-relaxed">
          Pemilik laporan mematikan penyematan di Looker Studio, jadi kalau dipaksa ditampilkan dalam bingkai
          yang muncul hanya pesan <i>&ldquo;Melihat di situs lain telah dinonaktifkan oleh pemilik laporan&rdquo;</i>.
          Supaya bisa tampil di sini, pemiliknya perlu membuka laporan → <b>Bagikan</b> → <b>Sematkan laporan</b> →
          aktifkan <b>Sematkan</b>. Setelah itu tombol di bawah akan berfungsi.
        </p>
        <button onClick={() => setCoba((v) => !v)} className="btn btn-ghost text-xs mt-2.5">
          {coba ? "▴ Sembunyikan percobaan sematan" : "▾ Coba tampilkan di sini"}
        </button>
      </div>

      {coba && (
        <div className="mt-3 bg-white rounded-2xl ring-line elev-md overflow-hidden" style={{ height: "70vh", minHeight: 460 }}>
          <iframe
            src={URL_SEMAT}
            title="Rekapitulasi Data Sensor Terupdate Regional 4"
            className="w-full h-full border-0"
            allowFullScreen
          />
        </div>
      )}

      <p className="text-[11px] text-slate-500 mt-3">
        Sumber data mengikuti laporan pusat — aplikasi ini hanya menyediakan pintu masuknya, tidak menyalin datanya.
      </p>
    </main>
  );
}
