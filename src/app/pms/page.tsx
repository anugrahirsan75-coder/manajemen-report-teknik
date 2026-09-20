"use client";
/**
 * Beranda PMS — apa yang harus dikerjakan sebelum rusak.
 *
 * Bagian ini terpisah dari Docking dan Kerusakan dengan sengaja. Keduanya
 * mencatat yang sudah terjadi; layar ini menghadap ke depan. Karena itu yang
 * paling atas bukan jumlah peralatan, melainkan pekerjaan yang TERLAMBAT —
 * satu-satunya angka yang menuntut tindakan hari ini.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePms } from "@/lib/pms/store";
import { daftarJatuh, hitungStatus, ringkasPerKapal } from "@/lib/pms/hitung";
import { LABEL_STATUS, StatusJatuh, WARNA_KRITIS, WARNA_STATUS } from "@/lib/pms/types";
import { Ikon } from "@/components/ikon";

const ringkas = (k: string) => k.replace(/^KMP\.?\s*/i, "");

export default function BerandaPms() {
  const { list, kerja, jam, loading, galat, reload } = usePms();
  const [saring, setSaring] = useState<StatusJatuh | "semua">("semua");
  const [kapal, setKapal] = useState("");

  const baris = useMemo(() => daftarJatuh(list, jam), [list, jam]);
  const hitung = useMemo(() => hitungStatus(baris), [baris]);
  const perKapal = useMemo(() => ringkasPerKapal(baris, list), [baris, list]);

  const tampil = useMemo(() => baris.filter((b) =>
    (saring === "semua" || b.jatuh.status === saring) && (!kapal || b.kapal === kapal)), [baris, saring, kapal]);

  const menunggu = useMemo(
    () => kerja.reduce((n, k) => n + (k.riwayat || []).filter((x) => x.status === "menunggu").length, 0),
    [kerja]);

  const belumMulai = list.length === 0;

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-5 flex flex-wrap items-center gap-4">
          <span className="bg-white rounded-2xl p-3 shadow-md shrink-0 text-[#16357f]"><Ikon nama="obeng" className="w-6 h-6" /></span>
          <div className="flex-1 min-w-[15rem]">
            <h1 className="text-xl font-extrabold asdp-text-gradient">PMS — Perawatan Berencana Kapal</h1>
            <p className="text-slate-500 text-sm">
              {list.length} kapal terdaftar · {baris.length} rencana kerja aktif · jam jalan dari kiriman ABK
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pms/peralatan" className="btn btn-ghost text-xs">🔧 Peralatan</Link>
            <Link href="/pms/rencana" className="btn btn-ghost text-xs">🗓️ Rencana Kerja</Link>
            <Link href="/pms/pengerjaan" className="btn btn-ghost text-xs">✓ Riwayat</Link>
            <button onClick={reload} disabled={loading} className="btn btn-ghost text-xs disabled:opacity-50">
              {loading ? "memuat…" : "⟲ Muat ulang"}
            </button>
          </div>
        </div>
      </div>

      {galat && (
        <p className="mt-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2">
          Data dari server gagal dimuat: {galat}
        </p>
      )}

      {/*
        Laporan kapal yang menganggur tanpa disahkan adalah cara paling halus
        sebuah PMS kehilangan nilainya: catatannya ada, tetapi tidak ada yang
        pernah menandatanganinya, dan saat diperiksa auditor semuanya berstatus
        "menunggu". Karena itu angkanya ditaruh di atas, bukan disembunyikan di
        halaman riwayat yang jarang dibuka.
      */}
      {menunggu > 0 && (
        <Link href="/pms/pengerjaan"
          className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 ring-1 ring-amber-300 px-4 py-3 hover:bg-amber-100 transition">
          <span className="text-xl">✋</span>
          <span className="flex-1 min-w-[14rem]">
            <b className="text-amber-900 text-sm">{menunggu} laporan pengerjaan dari kapal menunggu pengesahan</b>
            <span className="block text-[11px] text-amber-800">
              Jam jatuh temponya sudah bergeser; yang belum ada tanda tangan kantornya.
            </span>
          </span>
          <span className="text-[11px] font-bold text-amber-900 underline">Buka Riwayat &amp; Pengesahan ›</span>
        </Link>
      )}

      {belumMulai ? (
        <section className="mt-6 rounded-3xl bg-white ring-1 ring-slate-200 p-8 text-center">
          <p className="text-4xl">🔧</p>
          <h2 className="mt-3 text-lg font-extrabold text-slate-800">Belum ada kapal yang disiapkan</h2>
          <p className="mt-1 text-sm text-slate-500 max-w-xl mx-auto">
            PMS berdiri di atas daftar peralatan bertag. Mulai dari satu kapal: buka Peralatan,
            pilih kapalnya, lalu isi dari template baku (24 peralatan) dan sunting sesuai keadaan
            kapal itu — armada kita tidak seragam.
          </p>
          <Link href="/pms/peralatan" className="btn btn-primary text-sm mt-4 inline-block">🔧 Siapkan peralatan kapal</Link>
        </section>
      ) : (
        <>
          {/* angka utama */}
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
            {(["terlambat", "segera", "belum", "aman"] as StatusJatuh[]).map((s) => (
              <button key={s} onClick={() => setSaring(saring === s ? "semua" : s)}
                className={`rounded-2xl p-4 text-left ring-1 transition ${
                  saring === s ? "ring-[#16357f] bg-[#16357f]/5" : "ring-slate-200 bg-white hover:ring-slate-300"}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${WARNA_STATUS[s]}`} />
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{LABEL_STATUS[s]}</p>
                </div>
                <p className={`text-3xl font-extrabold mt-1 ${
                  s === "terlambat" && hitung[s] ? "text-red-600"
                    : s === "segera" && hitung[s] ? "text-amber-600" : "text-slate-800"}`}>
                  {hitung[s]}
                </p>
                <p className="text-[11px] text-slate-400">
                  {s === "belum" ? "interval / capaian belum diisi" : "pekerjaan"}
                </p>
              </button>
            ))}
          </div>

          {/* per kapal */}
          <section className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
              <h2 className="font-bold text-slate-800 text-sm">Keadaan per kapal</h2>
              {kapal && (
                <button onClick={() => setKapal("")} className="ml-auto text-[11px] text-slate-500 underline">
                  tampilkan semua kapal
                </button>
              )}
            </div>
            <div className="p-3 flex flex-wrap gap-2">
              {perKapal.map((r) => {
                const aktif = kapal === r.kapal;
                const gawat = r.terlambat > 0;
                return (
                  <button key={r.kapal} onClick={() => setKapal(aktif ? "" : r.kapal)}
                    className={`rounded-xl border px-3 py-2 text-left transition min-w-[10.5rem] ${
                      aktif ? "border-[#16357f] bg-[#16357f]/5"
                        : gawat ? "border-red-200 bg-red-50/40 hover:border-red-300"
                          : "border-slate-200 bg-white hover:border-slate-300"}`}>
                    <p className="text-xs font-extrabold text-slate-800">{ringkas(r.kapal)}</p>
                    <p className="text-[10px] text-slate-400">{r.peralatan} peralatan · {r.rencana} rencana</p>
                    {/*
                      "aman" hanya boleh muncul kalau memang tidak ada yang
                      tertunggak DAN tidak ada yang belum disetel. Kapal tanpa
                      rencana atau yang rencananya belum berangka bukan kapal
                      aman — ia kapal yang keadaannya belum diketahui, dan
                      lencana hijau di situ justru menutupi pekerjaan yang
                      seharusnya segera dibereskan.
                    */}
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      {r.rencana === 0 ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">belum ada rencana</span>
                      ) : (
                        <>
                          {r.terlambat > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white">{r.terlambat} telat</span>}
                          {r.segera > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white">{r.segera} segera</span>}
                          {r.belum > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">{r.belum} belum disetel</span>}
                          {r.terlambat === 0 && r.segera === 0 && r.belum === 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">aman</span>
                          )}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* daftar jatuh tempo */}
          <section className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50 flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-slate-800 text-sm">
                Daftar jatuh tempo
                <span className="ml-2 text-[11px] font-normal text-slate-500">
                  {tampil.length} pekerjaan{saring !== "semua" ? ` · ${LABEL_STATUS[saring]}` : ""}{kapal ? ` · ${ringkas(kapal)}` : ""}
                </span>
              </h2>
              {(saring !== "semua" || kapal) && (
                <button onClick={() => { setSaring("semua"); setKapal(""); }}
                  className="ml-auto text-[11px] text-slate-500 underline">reset saringan</button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="p-2 text-left w-24">Status</th>
                    <th className="p-2 text-left w-28">Kapal</th>
                    <th className="p-2 text-left w-24">Tag</th>
                    <th className="p-2 text-left">Pekerjaan</th>
                    <th className="p-2 text-left w-40">Peralatan</th>
                    <th className="p-2 text-center w-24">Penanggung</th>
                    <th className="p-2 text-right w-32">Jatuh tempo</th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-slate-400">Tak ada pekerjaan pada saringan ini.</td></tr>
                  )}
                  {tampil.slice(0, 200).map((b) => (
                    <tr key={b.kapal + b.rencana.id} className="border-b hover:bg-slate-50">
                      <td className="p-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${WARNA_STATUS[b.jatuh.status]}`}>
                          {LABEL_STATUS[b.jatuh.status]}
                        </span>
                      </td>
                      <td className="p-2 text-slate-600">{ringkas(b.kapal)}</td>
                      <td className="p-2 font-mono text-[11px] text-slate-500">{b.rencana.tag}</td>
                      <td className="p-2 text-slate-800 font-medium">{b.rencana.pekerjaan}</td>
                      <td className="p-2">
                        <span className="text-slate-600">{b.alat?.nama || <span className="text-red-600">tag tak dikenal</span>}</span>
                        {b.alat && (
                          <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded ring-1 ${WARNA_KRITIS[b.alat.kekritisan]}`}>
                            {b.alat.kekritisan}
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-center text-slate-500">{b.rencana.penanggung}</td>
                      <td className="p-2 text-right">
                        <span className={b.jatuh.status === "terlambat" ? "font-bold text-red-700"
                          : b.jatuh.status === "segera" ? "font-semibold text-amber-700" : "text-slate-500"}>
                          {b.jatuh.teks}
                        </span>
                        {b.rencana.basis === "jam" && (
                          <span className="block text-[10px] text-slate-400">
                            tiap {b.rencana.intervalJam} jam{b.jam !== undefined ? ` · kini ${b.jam.toLocaleString("id-ID")} jam` : ""}
                          </span>
                        )}
                        {b.rencana.basis === "kalender" && (
                          <span className="block text-[10px] text-slate-400">tiap {b.rencana.intervalHari} hari</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tampil.length > 200 && (
              <p className="px-4 py-2 text-[11px] text-slate-400 border-t">200 teratas ditampilkan — persempit dengan saringan kapal.</p>
            )}
          </section>
        </>
      )}

      <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
        Jatuh tempo dihitung, bukan diketik: rencana berbasis jam memakai angka jam jalan yang dikirim ABK
        lewat Portal Kapal, rencana berbasis kalender memakai tanggal pengerjaan terakhir. Status
        <b> Belum disetel</b> berarti interval atau capaian terakhirnya masih kosong — itu bukan aman,
        hanya belum bisa dihitung.
      </p>
    </main>
  );
}
