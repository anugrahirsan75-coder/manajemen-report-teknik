"use client";
/**
 * Monitoring Docking Kapal.
 *
 *  - Grafik semua kapal: target vs lama docking sebenarnya (bullet), warna = status.
 *  - Garis waktu setahun: kapan tiap kapal keluar & kembali ke lintasan.
 *  - Tabel + form milestone mengikuti form Jadwal Docking pusat.
 *  - Unggah Berita Acara (BAST, Mulai Pekerjaan, Naik/Turun Dok, dst).
 *  - Status kelas BKI per tahun (AS I–IV, IS, SS, DS) beserta jatuh temponya.
 */
import { useMemo, useState } from "react";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { ringkasKapal } from "@/lib/kapal/nama";
import { tanggalIndo } from "@/lib/format";
import { useDocking } from "@/lib/docking/store";
import {
  DockingJadwal, KelasBki, TAHAP, JENIS_BA, JENIS_SURVEY, STATUS_SURVEY_LABEL, StatusSurvey,
  BerkasBA, dockingBaru, kelasBaru, ringkasDocking, gayaDocking, labelBA,
  TERMIN, TerminBayar, ringkasTermin, RingkasTermin, STATUS_TERMIN, MASA_PEMELIHARAAN_HARI,
  jatuhTempoPemeliharaan, AMBANG_TERLAMBAT,
  PersiapanItem, TEMPLATE_PERSIAPAN, persiapanBaru, ringkasPersiapan, STATUS_SIAP, StatusSiap,
} from "@/lib/docking/types";
import { rupiah } from "@/lib/format";
import { unggahBerkas, ukuranSingkat, BerkasError } from "@/lib/berkasStorage";
import { konfirmasi, beritahu } from "@/components/Konfirmasi";

const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
const uid = () => globalThis.crypto?.randomUUID?.() ?? String(Math.random());
const hariKe = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const awal = new Date(d.getFullYear(), 0, 1).getTime();
  return Math.round((d.getTime() - awal) / 86400000);
};

export default function DockingPage() {
  const { ready, loading, err, jadwal, kelas, reload, simpanJadwal, simpanKelas, hapusJadwal, hapusKelas } = useDocking();
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [edit, setEdit] = useState<DockingJadwal | null>(null);
  const [tabAwal, setTabAwal] = useState<"jadwal" | "siap">("jadwal");
  /** buka kapal langsung pada tab tertentu */
  const buka = (d: DockingJadwal, t: "jadwal" | "siap" = "jadwal") => { setTabAwal(t); setEdit({ ...d }); };
  const [sibuk, setSibuk] = useState(false);

  const tahunList = useMemo(() => {
    const s = new Set<string>([String(new Date().getFullYear())]);
    jadwal.forEach((d) => s.add(String(d.tahun)));
    kelas.forEach((k) => s.add(String(k.tahun)));
    return Array.from(s).sort().reverse();
  }, [jadwal, kelas]);

  /**
   * Satu baris per kapal — kapal tanpa jadwal tetap tampil supaya ketahuan belum diisi.
   * Urutannya mengikuti KAPAN kapal mulai docking (paling awal di atas); yang belum
   * ada tanggalnya ditaruh di bawah dan otomatis naik sendiri begitu tanggalnya diisi.
   */
  const baris = useMemo(() => {
    const awalDocking = (d?: DockingJadwal) =>
      d && (d.keluarLintasan || d.berangkatGalangan || d.tibaGalangan || d.naikDock) || "";
    return KAPAL_ANGGARAN.map((k) => {
      const d = jadwal.find((x) => x.kapal === k && String(x.tahun) === tahun);
      const r = d ? ringkasDocking(d) : null;
      const kls = kelas.filter((x) => x.kapal === k && String(x.tahun) === tahun);
      return { kapal: k, dok: d, r, kelas: kls, awal: awalDocking(d) };
    }).sort((a, b) => {
      if (a.awal && b.awal) return a.awal.localeCompare(b.awal) || a.kapal.localeCompare(b.kapal);
      if (a.awal) return -1;          // yang sudah punya tanggal selalu di atas
      if (b.awal) return 1;
      return a.kapal.localeCompare(b.kapal);
    });
  }, [jadwal, kelas, tahun]);

  const adaData = baris.filter((b) => b.dok);
  const selesai = adaData.filter((b) => b.r?.status === "selesai");
  const berjalan = adaData.filter((b) => b.r?.status === "berjalan");
  const telat = selesai.filter((b) => (b.r?.selisih ?? 0) > 0);
  const rata = selesai.length
    ? Math.round(selesai.reduce((s, b) => s + (b.r?.utama || 0), 0) / selesai.length) : 0;

  const maksHari = Math.max(1, ...adaData.map((b) => Math.max(b.r?.target || 0, b.r?.utama || 0)));

  /**
   * Termin lintas kapal yang perlu diurus — inilah jawaban "kapan harus bayar
   * Termin III". Yang sudah dibayar & yang BA pemicunya belum kelihatan sama
   * sekali tidak ikut; urut dari yang paling mendesak.
   */
  const perluBayar = useMemo(() => {
    const out: { kapal: string; dok: DockingJadwal; t: RingkasTermin }[] = [];
    adaData.forEach((b) => ringkasTermin(b.dok!).forEach((t) => {
      if (t.status === "dibayar" || t.status === "belum_siap") return;
      out.push({ kapal: b.kapal, dok: b.dok!, t });
    }));
    const bobot = { terlambat: 0, siap: 1, menunggu: 2 } as Record<string, number>;
    return out.sort((x, y) =>
      (bobot[x.t.status] ?? 9) - (bobot[y.t.status] ?? 9) || (x.t.sisaHari ?? 0) - (y.t.sisaHari ?? 0));
  }, [adaData]);

  const nSiap = perluBayar.filter((x) => x.t.status === "siap" || x.t.status === "terlambat").length;
  const nTerlambat = perluBayar.filter((x) => x.t.status === "terlambat").length;

  const bukaBaru = (kapal: string) => { setTabAwal("jadwal"); setEdit(dockingBaru(kapal, +tahun)); };

  const simpanEdit = async () => {
    if (!edit) return;
    // Keluar Lintasan penting utk hitung lama docking, tapi TIDAK boleh memblokir:
    // rekaman dari Berita Acara sering belum punya tanggal itu, dan checklist /
    // termin / berkas tetap harus bisa disimpan. Cukup diingatkan sekali.
    if (!edit.keluarLintasan && !(edit as any)._ingatkan) {
      (edit as any)._ingatkan = true;
      void beritahu({
        nada: "perhatian", judul: "Tanggal Keluar Lintasan belum diisi",
        pesan: "Data tetap disimpan. Isi tanggalnya nanti supaya lama docking (off-lintasan) ikut terhitung.",
      });
    }
    setSibuk(true);
    try {
      const { _ingatkan, ...bersih } = edit as any;
      await simpanJadwal(bersih); setEdit(null);
    } finally { setSibuk(false); }
  };

  const hapusEdit = async () => {
    if (!edit) return;
    if (!(await konfirmasi({
      nada: "bahaya", ikon: "⚓",
      judul: `Hapus jadwal docking ${edit.kapal} ${edit.tahun}?`,
      pesan: "Seluruh tanggal milestone dan daftar berita acaranya ikut hilang.",
      rincian: [`${(edit.berkas || []).length} berkas berita acara terlampir`],
      tegasan: "Berkas di Storage tidak ikut terhapus, tapi tautannya hilang dari sini.",
      tombolYa: "Ya, hapus",
    }))) return;
    setSibuk(true);
    try { await hapusJadwal(edit.id); setEdit(null); } finally { setSibuk(false); }
  };

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex flex-wrap items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center text-2xl text-white shadow-md shrink-0">🛠️</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold asdp-text-gradient tracking-tight">Monitoring Docking Kapal</h1>
            <p className="text-slate-500 text-sm">Lama pengerjaan vs target · berita acara · status kelas BKI</p>
          </div>
          <select value={tahun} onChange={(e) => setTahun(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-semibold">
            {tahunList.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={reload} className="btn btn-ghost text-xs">↻ Muat ulang</button>
        </div>
      </div>

      {!ready && (
        <p className="mt-5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
          Butuh Supabase (env) supaya jadwal &amp; berita acara tersimpan dan bisa dibuka dari perangkat lain.
        </p>
      )}
      {err && <p className="mt-4 text-xs font-semibold text-rose-700">Supabase: {err}</p>}

      {/* ringkasan */}
      <section className="mt-4 grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kartu label="Sudah docking" nilai={`${selesai.length} kapal`} tint="text-emerald-700" bar="bg-emerald-500" />
        <Kartu label="Sedang docking" nilai={`${berjalan.length} kapal`} tint="text-sky-700" bar="bg-sky-500" />
        <Kartu label="Belum ada jadwal" nilai={`${KAPAL_ANGGARAN.length - adaData.length} kapal`} tint="text-slate-700" bar="bg-slate-400" />
        <Kartu label="Rata-rata lama" nilai={rata ? `${rata} hari` : "—"} sub="keluar → tiba lintasan" tint="text-slate-900" bar="bg-slate-500" />
        <Kartu label="Lewat target" nilai={`${telat.length} kapal`} sub={telat.length ? telat.map((b) => ringkasKapal(b.kapal)).slice(0, 3).join(", ") : "tidak ada"}
          tint={telat.length ? "text-red-700" : "text-emerald-700"} bar={telat.length ? "bg-red-500" : "bg-emerald-500"} />
        <Kartu label="Termin bisa dibayar" nilai={`${nSiap} termin`}
          sub={nTerlambat ? `${nTerlambat} sudah terlambat` : nSiap ? "BA pemicunya sudah terbit" : "tidak ada yang menunggu"}
          tint={nTerlambat ? "text-red-700" : nSiap ? "text-sky-700" : "text-slate-700"}
          bar={nTerlambat ? "bg-red-500" : nSiap ? "bg-sky-500" : "bg-slate-400"} />
      </section>

      {/* ============ ringkasan kesiapan persiapan docking ============ */}
      <KesiapanPanel baris={adaData} onBuka={(d) => buka(d, "siap")} />

      {/* ============ termin pembayaran yang perlu diurus ============ */}
      {perluBayar.length > 0 && (
        <section className={`mt-4 rounded-2xl ring-1 overflow-hidden ${nTerlambat ? "ring-red-300 bg-red-50" : nSiap ? "ring-sky-300 bg-sky-50" : "ring-slate-200 bg-slate-50"}`}>
          <div className="px-5 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-black/5">
            <h3 className="font-bold text-slate-800">💰 Termin pembayaran yang perlu diurus</h3>
            <span className="text-[11px] text-slate-600">
              tiap termin dipicu terbitnya Berita Acara — bukan tanggal kalender
            </span>
            <span className="ml-auto text-[11px] font-bold">
              {nTerlambat ? <span className="text-red-700">{nTerlambat} terlambat · </span> : null}
              <span className="text-sky-800">{nSiap} bisa dibayar</span>
            </span>
          </div>
          <div className="divide-y divide-black/5">
            {perluBayar.slice(0, 8).map(({ kapal, dok, t }) => {
              const st = STATUS_TERMIN[t.status];
              return (
                <button key={`${kapal}-${t.ke}`} onClick={() => setEdit({ ...dok })}
                  className="w-full text-left px-5 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 hover:bg-white/60 transition">
                  <span className="text-xs font-extrabold text-slate-800 w-24 shrink-0">{t.label}</span>
                  <span className="text-xs font-semibold text-slate-700 w-36 shrink-0 truncate">{ringkasKapal(kapal)}</span>
                  <span className="text-[11px] text-slate-600 flex-1 min-w-[13rem]">
                    {t.tanggalPemicu
                      ? <>{t.baLabel} terbit <b>{tanggalIndo(t.tanggalPemicu)}</b></>
                      : <>{t.baLabel} diperkirakan <b>{t.perkiraan ? tanggalIndo(t.perkiraan) : "—"}</b></>}
                  </span>
                  {t.nominal != null && <span className="text-[11px] font-bold tabular-nums text-slate-800">{rupiah(t.nominal)}</span>}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ring-1 ${st.chip}`}>{st.label}</span>
                  <span className={`text-[11px] font-bold tabular-nums w-24 text-right ${
                    t.sisaHari == null ? "text-slate-400" : t.sisaHari < 0 ? "text-red-700" : "text-slate-600"}`}>
                    {t.sisaHari == null ? "—" : t.sisaHari < 0 ? `lewat ${-t.sisaHari} hr` : t.sisaHari === 0 ? "hari ini" : `${t.sisaHari} hr lagi`}
                  </span>
                </button>
              );
            })}
            {perluBayar.length > 8 && (
              <p className="px-5 py-2 text-[11px] text-slate-500">…{perluBayar.length - 8} termin lain, lihat di kartu kapalnya.</p>
            )}
          </div>
        </section>
      )}

      {/* ================= grafik lama docking ================= */}
      <section className="mt-4 bg-white rounded-2xl ring-line elev-md p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
          <h3 className="font-bold text-slate-800">Lama docking vs target — {tahun}</h3>
          <span className="text-[11px] text-slate-500">batang abu = target hari · batang berwarna = kenyataan (keluar → tiba di lintasan)</span>
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-600">
            <Leg kelas="bg-emerald-500" teks="lebih cepat" /><Leg kelas="bg-amber-500" teks="pas target" />
            <Leg kelas="bg-red-500" teks="lewat target" /><Leg kelas="bg-sky-500" teks="masih berjalan" />
          </div>
        </div>
        {!adaData.length ? (
          <p className="text-sm text-slate-500 text-center py-6">Belum ada jadwal docking di tahun {tahun}. Klik kapal di tabel bawah untuk mengisinya.</p>
        ) : (
          <div className="space-y-2 mt-3">
            {adaData
              .slice()
              .sort((a, b) => (b.r?.utama || 0) - (a.r?.utama || 0))
              .map((b) => {
                const r = b.r!; const g = gayaDocking(r);
                const nyata = r.utama ?? 0;
                return (
                  <button key={b.kapal} onClick={() => buka(b.dok!)}
                    className="w-full text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1ca3dd] rounded"
                    title={`${b.kapal} · target ${r.target ?? "-"} hari · nyata ${nyata} hari${r.selisih != null ? ` (${r.selisih > 0 ? "+" : ""}${r.selisih})` : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-28 sm:w-36 shrink-0 text-[11px] font-semibold text-slate-700 truncate group-hover:text-[#16357f]">{ringkasKapal(b.kapal)}</span>
                      <span className="flex-1 relative h-5 block">
                        {r.target ? <span className="absolute inset-y-0 left-0 bg-slate-200 rounded block" style={{ width: `${(r.target / maksHari) * 100}%` }} /> : null}
                        {r.target ? <span className="absolute inset-y-0 w-[2px] bg-slate-500/70 block" style={{ left: `calc(${(r.target / maksHari) * 100}% - 1px)` }} title={`target ${r.target} hari`} /> : null}
                        <span className={`absolute top-1 bottom-1 left-0 rounded block ${g.bar}`} style={{ width: `${Math.max(1, (nyata / maksHari) * 100)}%` }} />
                      </span>
                      <span className="w-16 shrink-0 text-right text-[11px] font-bold tabular-nums text-slate-800">{nyata} hr</span>
                      <span className={`w-28 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ring-1 text-center ${g.chip}`}>{g.teks}</span>
                    </div>
                  </button>
                );
              })}
          </div>
        )}
      </section>

      {/* ================= garis waktu setahun ================= */}
      {adaData.length > 0 && (
        <section className="mt-4 bg-white rounded-2xl ring-line elev-md p-5">
          <h3 className="font-bold text-slate-800 mb-1">Garis waktu docking {tahun}</h3>
          <p className="text-[11px] text-slate-500 mb-3">kapan tiap kapal keluar dari lintasan sampai kembali — berguna untuk melihat tumpang tindih armada</p>
          <div className="flex text-[9px] text-slate-400 mb-1">
            <span className="w-28 sm:w-36 shrink-0" />
            {BLN.map((m) => <span key={m} className="flex-1 text-center">{m}</span>)}
          </div>
          <div className="space-y-1.5">
            {adaData.map((b) => {
              const r = b.r!; const g = gayaDocking(r);
              const a = hariKe(r.mulai); const z = hariKe(r.akhir) ?? (r.status === "berjalan" ? hariKe(new Date().toISOString().slice(0, 10)) : a);
              const kiri = a != null ? (a / 365) * 100 : 0;
              const lebar = a != null && z != null ? Math.max(0.8, ((z - a) / 365) * 100) : 0;
              return (
                <div key={b.kapal} className="flex items-center gap-2">
                  <span className="w-28 sm:w-36 shrink-0 text-[11px] font-semibold text-slate-700 truncate">{ringkasKapal(b.kapal)}</span>
                  <span className="flex-1 relative h-4 bg-slate-100 rounded block overflow-hidden">
                    {[...Array(11)].map((_, i) => <span key={i} className="absolute inset-y-0 w-px bg-white/70" style={{ left: `${((i + 1) / 12) * 100}%` }} />)}
                    {a != null && (
                      <span className={`absolute inset-y-0 rounded ${g.bar} block`} style={{ left: `${kiri}%`, width: `${lebar}%` }}
                        title={`${b.kapal}: ${tanggalIndo(r.mulai || "")} → ${r.akhir ? tanggalIndo(r.akhir) : "masih berjalan"}`} />
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ================= tabel per kapal ================= */}
      <section className="mt-4 bg-white rounded-2xl ring-line elev-md p-5">
        <h3 className="font-bold text-slate-800 mb-3">Rincian per kapal — {tahun}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600 font-bold">
              <tr>
                <th className="p-2 text-left">Kapal</th>
                <th className="p-2 text-left">Galangan</th>
                <th className="p-2 text-left whitespace-nowrap">Keluar → Tiba lintasan</th>
                <th className="p-2 text-right">Target</th>
                <th className="p-2 text-right">Nyata</th>
                <th className="p-2 text-right">Selisih</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2 text-center" title="Persiapan docking: SPPBJ repair list, anode, cat, suku cadang, dst.">Siap</th>
                <th className="p-2 text-center">BA</th>
                <th className="p-2 text-center" title="Termin I dipicu BA Naik Dok · II BA Selesai Pekerjaan · III BA Selesai Masa Pemeliharaan">Termin</th>
                <th className="p-2 text-left">Kelas BKI</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => {
                const r = b.r; const g = r ? gayaDocking(r) : null;
                return (
                  <tr key={b.kapal} className="border-b border-slate-100 last:border-0 row-hover cursor-pointer"
                    onClick={() => (b.dok ? buka(b.dok) : bukaBaru(b.kapal))}>
                    <td className="p-2 font-semibold text-slate-800 whitespace-nowrap">{b.kapal}</td>
                    <td className="p-2 text-slate-600">{b.dok?.galangan || "—"}</td>
                    <td className="p-2 text-slate-600 whitespace-nowrap">
                      {b.dok?.keluarLintasan ? `${tanggalIndo(b.dok.keluarLintasan)} → ${b.dok.tibaLintasan ? tanggalIndo(b.dok.tibaLintasan) : "…"}` : "—"}
                    </td>
                    <td className="p-2 text-right tabular-nums text-slate-600">{r?.target ?? "—"}</td>
                    <td className="p-2 text-right tabular-nums font-bold text-slate-900">{r?.utama ?? "—"}</td>
                    <td className={`p-2 text-right tabular-nums font-bold ${r?.selisih == null ? "text-slate-300" : r.selisih > 0 ? "text-red-700" : "text-emerald-700"}`}>
                      {r?.selisih == null ? "—" : `${r.selisih > 0 ? "+" : ""}${r.selisih}`}
                    </td>
                    <td className="p-2 text-center">
                      {g ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ring-1 ${g.chip}`}>{g.teks}</span>
                        : <span className="text-[10px] text-slate-400">belum diisi</span>}
                    </td>
                    <td className="p-2 text-center">
                      {(() => {
                        if (!b.dok) return <span className="text-[10px] text-slate-400">—</span>;
                        const rp = ringkasPersiapan(b.dok.persiapan);
                        if (!rp.ada) return <span className="text-[10px] text-slate-400" title="Checklist belum dibuat — buka kapal → tab Persiapan">belum ada</span>;
                        return (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ring-1 tabular-nums ${
                            rp.pct >= 100 ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                              : rp.pct >= 50 ? "bg-amber-100 text-amber-800 ring-amber-300"
                              : "bg-red-100 text-red-800 ring-red-300"}`}
                            title={`${rp.selesai} dari ${rp.total} item siap · ${rp.proses} sedang diproses`}>
                            {rp.selesai}/{rp.total}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-2 text-center tabular-nums text-slate-600">{(b.dok?.berkas || []).length || "—"}</td>
                    <td className="p-2 text-center">
                      {b.dok ? (
                        <span className="inline-flex gap-1">
                          {ringkasTermin(b.dok).map((t) => (
                            <span key={t.ke}
                              title={`${t.label} — pemicu ${t.baLabel}: ${STATUS_TERMIN[t.status].label}${t.tanggalBayar ? ` (dibayar ${tanggalIndo(t.tanggalBayar)})` : ""}`}
                              className={`w-5 h-5 grid place-items-center text-[9px] font-extrabold rounded ring-1 ${STATUS_TERMIN[t.status].chip}`}>
                              {t.ke === 1 ? "I" : t.ke === 2 ? "II" : "III"}
                            </span>
                          ))}
                        </span>
                      ) : <span className="text-[10px] text-slate-400">—</span>}
                    </td>
                    <td className="p-2">
                      {b.kelas.length ? (
                        <span className="flex flex-wrap gap-1">
                          {b.kelas.map((k) => (
                            <span key={k.id} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ring-1 ${
                              k.status === "selesai" ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                                : k.status === "proses" ? "bg-amber-100 text-amber-800 ring-amber-300"
                                : "bg-slate-100 text-slate-600 ring-slate-300"}`}
                              title={`${k.jenis}${k.dueDate ? ` · jatuh tempo ${tanggalIndo(k.dueDate)}` : ""} — ${STATUS_SURVEY_LABEL[k.status]}`}>
                              {k.jenis}
                            </span>
                          ))}
                        </span>
                      ) : <span className="text-[10px] text-slate-400">—</span>}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <span className="text-[11px] font-bold text-[#1ca3dd]">{b.dok ? "buka →" : "+ isi"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {edit && (
        <FormDocking
          nilai={edit} setNilai={setEdit} sibuk={sibuk} tabAwal={tabAwal}
          kelas={kelas.filter((k) => k.kapal === edit.kapal && k.tahun === edit.tahun)}
          onSimpan={simpanEdit} onHapus={hapusEdit} onTutup={() => setEdit(null)}
          onSimpanKelas={simpanKelas} onHapusKelas={hapusKelas}
        />
      )}
      {loading && <p className="mt-4 text-xs text-slate-400">memuat…</p>}
    </main>
  );
}

/* ============================ form / detail ============================ */

function FormDocking({ nilai, setNilai, kelas, sibuk, tabAwal, onSimpan, onHapus, onTutup, onSimpanKelas, onHapusKelas }: {
  nilai: DockingJadwal; setNilai: (d: DockingJadwal) => void; kelas: KelasBki[]; sibuk: boolean;
  tabAwal?: "jadwal" | "siap";
  onSimpan: () => void; onHapus: () => void; onTutup: () => void;
  onSimpanKelas: (k: KelasBki) => Promise<void>; onHapusKelas: (id: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<"jadwal" | "siap" | "termin" | "ba" | "kelas">(tabAwal || "jadwal");
  const r = ringkasDocking(nilai);
  const g = gayaDocking(r);
  const set = (p: Partial<DockingJadwal>) => setNilai({ ...nilai, ...p });

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 overflow-auto" onMouseDown={onTutup}>
      <div className="min-h-full py-8 px-3 flex items-start justify-center">
        <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center text-xl text-white shadow-md shrink-0">⚓</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-extrabold text-slate-800 leading-tight">{nilai.kapal} · Docking {nilai.tahun}</h3>
              <p className="text-[11px] text-slate-500">{nilai.galangan || "galangan belum diisi"}</p>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ring-1 ${g.chip}`}>{g.teks}</span>
          </div>

          <div className="px-6 pt-3 flex gap-1 border-b border-slate-200">
            {([["jadwal", "📅 Jadwal & lama"],
               ["siap", (() => { const r = ringkasPersiapan(nilai.persiapan); return `✅ Persiapan${r.ada ? ` (${r.selesai}/${r.total})` : ""}`; })()],
               ["termin", `💰 Termin (${ringkasTermin(nilai).filter((t) => t.status === "dibayar").length}/3 dibayar)`],
               ["ba", `📄 Berita Acara (${(nilai.berkas || []).length})`],
               ["kelas", `🏷️ Kelas BKI (${kelas.length})`]] as const).map(([v, t]) => (
              <button key={v} onClick={() => setTab(v)}
                className={`text-xs font-semibold px-3 py-2 rounded-t-lg border-b-2 transition ${tab === v ? "border-[#16357f] text-[#16357f] bg-slate-50" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{t}</button>
            ))}
          </div>

          <div className="p-6 max-h-[62vh] overflow-auto">
            {tab === "jadwal" && <TabJadwal nilai={nilai} set={set} r={r} />}
            {tab === "siap" && <TabPersiapan nilai={nilai} set={set} />}
            {tab === "termin" && <TabTermin nilai={nilai} set={set} />}
            {tab === "ba" && <TabBA nilai={nilai} set={set} />}
            {tab === "kelas" && <TabKelas kapal={nilai.kapal} tahun={nilai.tahun} kelas={kelas} onSimpan={onSimpanKelas} onHapus={onHapusKelas} />}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
            <button onClick={onHapus} disabled={sibuk} className="btn btn-danger-soft text-sm disabled:opacity-50">🗑️ Hapus</button>
            <span className="ml-auto" />
            <button onClick={onTutup} className="btn btn-ghost text-sm">Batal</button>
            <button onClick={onSimpan} disabled={sibuk} className="btn btn-primary text-sm px-5 disabled:opacity-50">{sibuk ? "…" : "💾 Simpan"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabJadwal({ nilai, set, r }: { nilai: DockingJadwal; set: (p: Partial<DockingJadwal>) => void; r: ReturnType<typeof ringkasDocking> }) {
  return (
    <>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <Baris label="Cabang"><input className="inp" value={nilai.cabang || ""} onChange={(e) => set({ cabang: e.target.value })} /></Baris>
        <Baris label="Galangan"><input className="inp" value={nilai.galangan || ""} onChange={(e) => set({ galangan: e.target.value })} placeholder="mis. PT. IKI (Persero) Bitung" /></Baris>
        <Baris label="Owner Surveyor"><input className="inp" value={nilai.os || ""} onChange={(e) => set({ os: e.target.value })} /></Baris>
        <Baris label="Tipe Docking">
          <select className="inp" value={nilai.tipe || "DOCKING"} onChange={(e) => set({ tipe: e.target.value })}>
            <option>DOCKING</option><option>EMERGENCY DOCKING</option><option>DOCKING TAHUNAN</option>
          </select>
        </Baris>
        <Baris label="Bulan Jadwal (pusat)"><input className="inp" value={nilai.jadwalBulan || ""} onChange={(e) => set({ jadwalBulan: e.target.value })} placeholder="mis. Januari" /></Baris>
        <Baris label="Bulan Pelaksanaan"><input className="inp" value={nilai.bulanPelaksanaan || ""} onChange={(e) => set({ bulanPelaksanaan: e.target.value })} /></Baris>
        <Baris label="Target Docking (hari)">
          <input type="number" className="inp" value={nilai.targetHari ?? ""} onChange={(e) => set({ targetHari: e.target.value ? +e.target.value : undefined })} placeholder="22" />
        </Baris>
      </div>

      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Tanggal pelaksanaan</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {TAHAP.map((t) => (
          <Baris key={t.key} label={`${t.label}${t.wajib ? " *" : ""}`}>
            <input type="date" className="inp" value={(nilai as any)[t.key] || ""} onChange={(e) => set({ [t.key]: e.target.value || undefined } as any)} />
          </Baris>
        ))}
      </div>

      <div className="mt-4 grid sm:grid-cols-4 gap-2">
        <Hitung label="Off lintasan" nilai={r.offLintasan ?? r.berjalan} sat="hari" sub="keluar → tiba lintasan" tebal />
        <Hitung label="Di galangan" nilai={r.diGalangan} sat="hari" sub="tiba → selesai kerja" />
        <Hitung label="Di atas dock" nilai={r.diAtasDock} sat="hari" sub="naik → turun dock" />
        <Hitung label="Selisih target" nilai={r.selisih} sat="hari" sub={r.target ? `target ${r.target} hari` : "target belum diisi"} tanda />
      </div>

      <Baris label="Catatan" lebar>
        <textarea className="inp min-h-[70px]" value={nilai.catatan || ""} onChange={(e) => set({ catatan: e.target.value })}
          placeholder="mis. keterlambatan karena menunggu material, cuaca, dsb." />
      </Baris>
    </>
  );
}

/**
 * Ringkasan kesiapan persiapan docking seluruh armada.
 *
 * Dua cara lihat, karena dua pertanyaan berbeda:
 *  - "Kapal mana yang paling belum siap?"  -> daftar batang per kapal, urut termuda
 *  - "Item apa yang tersendat di banyak kapal?" -> matriks item x kapal
 * Klik di mana pun langsung membuka kapal itu pada tab Persiapan.
 */
function KesiapanPanel({ baris, onBuka }: {
  baris: { kapal: string; dok?: DockingJadwal; r: any }[];
  onBuka: (d: DockingJadwal) => void;
}) {
  const [tampil, setTampil] = useState<"kapal" | "matriks">("kapal");

  const data = useMemo(() => baris
    .filter((b) => b.dok)
    .map((b) => ({ kapal: b.kapal, dok: b.dok!, r: ringkasPersiapan(b.dok!.persiapan) }))
    .sort((a, b) => {
      if (a.r.ada !== b.r.ada) return a.r.ada ? -1 : 1;   // yang punya checklist dulu
      return a.r.pct - b.r.pct || a.kapal.localeCompare(b.kapal);
    }), [baris]);

  // daftar item unik lintas kapal (template dulu, item khusus menyusul)
  const items = useMemo(() => {
    const urut: string[] = [...TEMPLATE_PERSIAPAN];
    data.forEach((d) => (d.dok.persiapan || []).forEach((it) => {
      if (it.nama && !urut.includes(it.nama)) urut.push(it.nama);
    }));
    return urut.filter((nama) => data.some((d) => (d.dok.persiapan || []).some((it) => it.nama === nama)));
  }, [data]);

  if (!data.length) return null;
  const punya = data.filter((d) => d.r.ada);
  const belumPunya = data.filter((d) => !d.r.ada);
  const totItem = punya.reduce((s, d) => s + d.r.total, 0);
  const totSelesai = punya.reduce((s, d) => s + d.r.selesai, 0);
  const pctArmada = totItem ? Math.round((totSelesai / totItem) * 100) : 0;
  const siapPenuh = punya.filter((d) => d.r.pct >= 100).length;

  return (
    <section className="mt-4 bg-white rounded-2xl ring-line elev-md p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
        <h3 className="font-bold text-slate-800">✅ Kesiapan persiapan docking</h3>
        <span className="text-[11px] text-slate-500">klik kapal / kotak untuk langsung membuka checklistnya</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] text-slate-600">
            <b className="text-slate-900">{pctArmada}%</b> armada · {totSelesai}/{totItem} item · {siapPenuh} kapal siap penuh
          </span>
          <div className="flex gap-1">
            {([["kapal", "📋 Per kapal"], ["matriks", "▦ Matriks"]] as const).map(([v, t]) => (
              <button key={v} onClick={() => setTampil(v)}
                className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition ${tampil === v ? "bg-[#16357f] text-white border-[#16357f]" : "bg-white border-slate-300 text-slate-600 hover:border-[#1ca3dd]"}`}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {tampil === "kapal" ? (
        <div className="space-y-1.5">
          {punya.map((d) => (
            <button key={d.kapal} onClick={() => onBuka(d.dok)}
              className="w-full text-left flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition group">
              <span className="w-28 sm:w-36 shrink-0 text-[11px] font-semibold text-slate-700 truncate group-hover:text-[#16357f]">{ringkasKapal(d.kapal)}</span>
              <span className="flex-1 flex h-4 rounded overflow-hidden ring-1 ring-inset ring-slate-200 bg-slate-100">
                <span className="bg-emerald-500 h-full" style={{ width: `${d.r.total ? (d.r.selesai / d.r.total) * 100 : 0}%` }} />
                <span className="bg-amber-400 h-full" style={{ width: `${d.r.total ? (d.r.proses / d.r.total) * 100 : 0}%` }} />
              </span>
              <span className="w-14 shrink-0 text-right text-[11px] font-bold tabular-nums text-slate-800">{d.r.selesai}/{d.r.total}</span>
              <span className={`w-16 shrink-0 text-right text-[11px] font-extrabold tabular-nums ${
                d.r.pct >= 100 ? "text-emerald-700" : d.r.pct >= 50 ? "text-amber-700" : "text-red-700"}`}>{d.r.pct}%</span>
            </button>
          ))}
          {belumPunya.length > 0 && (
            <p className="pt-2 mt-1 border-t border-slate-100 text-[11px] text-slate-500">
              Belum punya checklist ({belumPunya.length} kapal):{" "}
              <span className="text-slate-600">{belumPunya.map((d) => ringkasKapal(d.kapal)).join(" · ")}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] uppercase tracking-wide text-slate-500 font-bold">
                <th className="p-1.5 text-left sticky left-0 bg-white">Item persiapan</th>
                {punya.map((d) => (
                  <th key={d.kapal} className="p-1.5 text-center cursor-pointer hover:text-[#16357f]" onClick={() => onBuka(d.dok)}>
                    <span className="block [writing-mode:vertical-rl] rotate-180 h-20 mx-auto">{ringkasKapal(d.kapal)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((nama) => (
                <tr key={nama} className="border-b border-slate-100 last:border-0">
                  <td className="p-1.5 text-slate-700 whitespace-nowrap sticky left-0 bg-white">{nama}</td>
                  {punya.map((d) => {
                    const it = (d.dok.persiapan || []).find((x) => x.nama === nama);
                    const st = it ? STATUS_SIAP[it.status] : null;
                    return (
                      <td key={d.kapal} className="p-1 text-center">
                        <button onClick={() => onBuka(d.dok)}
                          title={`${ringkasKapal(d.kapal)} — ${nama}: ${it ? st!.label : "tidak ada di kapal ini"}${it?.noRef ? ` (${it.noRef})` : ""}`}
                          className={`w-6 h-6 grid place-items-center rounded text-[10px] font-extrabold ring-1 mx-auto ${
                            !it ? "bg-white ring-slate-200 text-slate-300"
                              : it.status === "selesai" ? "bg-emerald-100 ring-emerald-300 text-emerald-800"
                              : it.status === "proses" ? "bg-amber-100 ring-amber-300 text-amber-800"
                              : it.status === "tidak_perlu" ? "bg-slate-100 ring-slate-300 text-slate-400"
                              : "bg-red-100 ring-red-300 text-red-800"}`}>
                          {!it ? "·" : it.status === "selesai" ? "✓" : it.status === "proses" ? "…" : it.status === "tidak_perlu" ? "—" : "○"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-slate-50 font-extrabold">
                <td className="p-1.5 text-slate-800 sticky left-0 bg-slate-50">KESIAPAN</td>
                {punya.map((d) => (
                  <td key={d.kapal} className={`p-1.5 text-center text-[10px] tabular-nums ${
                    d.r.pct >= 100 ? "text-emerald-700" : d.r.pct >= 50 ? "text-amber-700" : "text-red-700"}`}>{d.r.pct}%</td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="text-[10px] text-slate-400 mt-2">✓ sudah · … diproses · ○ belum · — tidak perlu · · tidak ada di kapal itu</p>
        </div>
      )}
    </section>
  );
}

function TabPersiapan({ nilai, set }: { nilai: DockingJadwal; set: (p: Partial<DockingJadwal>) => void }) {
  const list = nilai.persiapan || [];
  const r = ringkasPersiapan(list);
  const [namaBaru, setNamaBaru] = useState("");
  const ubah = (id: string, p: Partial<PersiapanItem>) =>
    set({ persiapan: list.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const tambah = (nama: string) => {
    const n = nama.trim();
    if (!n) return;
    set({ persiapan: [...list, persiapanBaru(n)] });
    setNamaBaru("");
  };
  // urutan siklus klik cepat pada status: belum -> proses -> selesai -> belum
  const putar = (s: StatusSiap): StatusSiap => (s === "belum" ? "proses" : s === "proses" ? "selesai" : "belum");

  return (
    <>
      {/* progres */}
      {r.ada && (
        <div className="rounded-xl ring-1 ring-slate-200 bg-slate-50 p-3.5 mb-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
            <span className="text-sm font-extrabold text-slate-800">Kesiapan docking: {r.pct}%</span>
            <span className="text-[11px] text-slate-600">{r.selesai} sudah · {r.proses} diproses · {r.belum} belum{list.length - r.total ? ` · ${list.length - r.total} tidak perlu` : ""}</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden ring-1 ring-inset ring-slate-200 bg-white">
            <div className="bg-emerald-500" style={{ width: `${r.total ? (r.selesai / r.total) * 100 : 0}%` }} />
            <div className="bg-amber-400" style={{ width: `${r.total ? (r.proses / r.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {!list.length ? (
        <div className="rounded-xl ring-1 ring-sky-200 bg-sky-50 p-4 text-center">
          <p className="text-sm text-slate-700 mb-3">
            Belum ada checklist. Mulai dari template baku (SPPBJ Repair List, Anode, Cat BGA/AGA,
            Perlengkapan Deck, Alat Kerja, Suku Cadang, Perbengkelan, Swakelola, Fumigasi, BBM,
            Pelumas, Surat Kapal, Investasi) — setelah itu bebas ditambah / dibuang sesuai kapal.
          </p>
          <button onClick={() => set({ persiapan: TEMPLATE_PERSIAPAN.map((n) => persiapanBaru(n)) })}
            className="btn btn-primary text-xs">📋 Pakai template ({TEMPLATE_PERSIAPAN.length} item)</button>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((it) => {
            const st = STATUS_SIAP[it.status];
            return (
              <div key={it.id} className={`rounded-xl ring-1 px-3.5 py-2.5 ${
                it.status === "selesai" ? "ring-emerald-200 bg-emerald-50/40"
                  : it.status === "proses" ? "ring-amber-200 bg-amber-50/40"
                  : it.status === "tidak_perlu" ? "ring-slate-200 bg-slate-50 opacity-70" : "ring-slate-200"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => ubah(it.id, { status: putar(it.status), tanggal: putar(it.status) === "selesai" ? (it.tanggal || new Date().toISOString().slice(0, 10)) : it.tanggal })}
                    title="Klik untuk ganti status: Belum → Sedang diproses → Sudah"
                    className={`h-7 w-7 grid place-items-center rounded-lg ring-1 text-sm shrink-0 ${st.chip}`}>
                    {it.status === "selesai" ? "✓" : it.status === "proses" ? "…" : it.status === "tidak_perlu" ? "—" : "○"}
                  </button>
                  <input className={`flex-1 min-w-[12rem] bg-transparent text-sm font-semibold outline-none ${it.status === "tidak_perlu" ? "line-through text-slate-400" : "text-slate-800"}`}
                    value={it.nama} onChange={(e) => ubah(it.id, { nama: e.target.value })} />
                  <select value={it.status} onChange={(e) => ubah(it.id, { status: e.target.value as StatusSiap })}
                    className={`text-[11px] font-bold rounded-lg px-2 py-1 ring-1 border-0 ${st.chip}`}>
                    {(Object.keys(STATUS_SIAP) as StatusSiap[]).map((s) => <option key={s} value={s}>{STATUS_SIAP[s].label}</option>)}
                  </select>
                  <input className="inp !w-36 !text-[11px] !py-1" placeholder="No. SPPBJ / ref"
                    value={it.noRef || ""} onChange={(e) => ubah(it.id, { noRef: e.target.value })} />
                  <input type="date" className="inp !w-36 !text-[11px] !py-1" value={it.tanggal || ""}
                    onChange={(e) => ubah(it.id, { tanggal: e.target.value || undefined })} />
                  <button onClick={() => set({ persiapan: list.filter((x) => x.id !== it.id) })}
                    className="text-rose-600 hover:text-rose-800 text-sm px-1" title="Buang item ini">✕</button>
                </div>
                <input className="mt-1.5 w-full bg-transparent text-[11px] text-slate-500 outline-none placeholder:text-slate-300"
                  placeholder="catatan (opsional) — mis. menunggu barang dari Surabaya"
                  value={it.catatan || ""} onChange={(e) => ubah(it.id, { catatan: e.target.value })} />
              </div>
            );
          })}

          <div className="flex items-center gap-2 pt-1">
            <input className="inp flex-1" placeholder="tambah item baru — mis. Pengadaan Wire Rope"
              value={namaBaru} onChange={(e) => setNamaBaru(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") tambah(namaBaru); }} />
            <button onClick={() => tambah(namaBaru)} className="btn btn-primary text-xs">＋ Tambah</button>
          </div>
          <p className="text-[11px] text-slate-500">
            Klik lingkaran untuk memutar status (Belum → Diproses → Sudah). Nama item bisa langsung
            diketik ulang. Item &ldquo;Tidak perlu&rdquo; tidak dihitung dalam persen kesiapan.
            Jangan lupa <b>Simpan</b> setelah selesai.
          </p>
        </div>
      )}
    </>
  );
}

function TabTermin({ nilai, set }: { nilai: DockingJadwal; set: (p: Partial<DockingJadwal>) => void }) {
  const daftar = ringkasTermin(nilai);
  const tempo = jatuhTempoPemeliharaan(nilai);
  const setT = (ke: number, p: Partial<TerminBayar>) => {
    const lama = nilai.termin || [];
    const ada = lama.find((x) => x.ke === ke);
    const baru = ada ? lama.map((x) => (x.ke === ke ? { ...x, ...p } : x)) : [...lama, { ke, ...p }];
    set({ termin: baru });
  };
  const totalPersen = daftar.reduce((s, t) => s + (t.persen || 0), 0);
  const totalNominal = daftar.reduce((s, t) => s + (t.nominal || 0), 0);
  const terbayar = daftar.filter((t) => t.tanggalBayar).reduce((s, t) => s + (t.nominal || 0), 0);

  return (
    <>
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <Baris label="Nilai kontrak docking (Rp)">
          <input type="number" className="inp" value={nilai.nilaiKontrak ?? ""}
            onChange={(e) => set({ nilaiKontrak: e.target.value ? +e.target.value : undefined })} placeholder="mis. 1500000000" />
        </Baris>
        <Baris label="Masa pemeliharaan (hari)">
          <input type="number" className="inp" value={nilai.masaPemeliharaanHari ?? ""}
            onChange={(e) => set({ masaPemeliharaanHari: e.target.value ? +e.target.value : undefined })}
            placeholder={String(MASA_PEMELIHARAAN_HARI)} />
        </Baris>
        <div className="rounded-xl ring-1 ring-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Jatuh tempo BA Pemeliharaan</p>
          <p className="text-sm font-extrabold text-slate-900 leading-tight">{tempo ? tanggalIndo(tempo) : "—"}</p>
          <p className="text-[10px] text-slate-500">
            {nilai.selesaiPekerjaan
              ? `BA Selesai Pekerjaan + ${nilai.masaPemeliharaanHari ?? MASA_PEMELIHARAAN_HARI} hari`
              : "isi dulu tanggal Selesai Pekerjaan"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {daftar.map((t) => {
          const st = STATUS_TERMIN[t.status];
          const def = TERMIN.find((x) => x.ke === t.ke)!;
          return (
            <div key={t.ke} className={`rounded-xl ring-1 p-4 ${t.status === "terlambat" ? "ring-red-300 bg-red-50/40"
              : t.status === "siap" ? "ring-sky-300 bg-sky-50/40"
              : t.status === "dibayar" ? "ring-emerald-300 bg-emerald-50/30" : "ring-slate-200"}`}>
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                <span className="text-sm font-extrabold text-slate-800">{t.label}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ring-1 ${st.chip}`}>{st.label}</span>
                <span className="text-[11px] text-slate-600">
                  pemicu: <b>{t.baLabel}</b>
                  {t.tanggalPemicu ? <> · terbit {tanggalIndo(t.tanggalPemicu)}</> :
                    t.perkiraan ? <> · diperkirakan {tanggalIndo(t.perkiraan)}</> : <> · tanggalnya belum diisi</>}
                </span>
                <span className={`ml-auto text-[11px] font-bold ${t.adaBerkas ? "text-emerald-700" : "text-amber-700"}`}
                  title={t.adaBerkas ? "berkas BA sudah diunggah" : "berkas BA belum diunggah di tab Berita Acara"}>
                  {t.adaBerkas ? "✓ berkas BA ada" : "! berkas BA belum diunggah"}
                </span>
              </div>
              <div className="grid sm:grid-cols-4 gap-3">
                <Baris label="Porsi (%)">
                  <input type="number" className="inp" value={t.persen ?? ""}
                    onChange={(e) => setT(t.ke, { persen: e.target.value ? +e.target.value : undefined })} placeholder="mis. 30" />
                </Baris>
                <Baris label="Nominal (Rp)">
                  <input type="number" className="inp"
                    value={(nilai.termin || []).find((x) => x.ke === t.ke)?.nominal ?? ""}
                    onChange={(e) => setT(t.ke, { nominal: e.target.value ? +e.target.value : undefined })}
                    placeholder={t.persen && nilai.nilaiKontrak ? String(t.nominal ?? "") : "isi bila tak pakai %"} />
                </Baris>
                <Baris label="Tanggal dibayar">
                  <input type="date" className="inp" value={t.tanggalBayar || ""}
                    onChange={(e) => setT(t.ke, { tanggalBayar: e.target.value || undefined })} />
                </Baris>
                <Baris label="No. bukti / kwitansi">
                  <input className="inp" value={t.noBukti || ""} onChange={(e) => setT(t.ke, { noBukti: e.target.value })} />
                </Baris>
              </div>
              {t.status === "siap" && (
                <p className="text-[11px] text-sky-800 font-semibold mt-2">
                  {t.baLabel} sudah terbit — termin ini sudah boleh diproses pembayarannya.
                </p>
              )}
              {t.status === "terlambat" && (
                <p className="text-[11px] text-red-800 font-semibold mt-2">
                  Sudah {t.sisaHari != null ? -t.sisaHari : "?"} hari sejak {t.baLabel} terbit (ambang {AMBANG_TERLAMBAT} hari) dan belum tercatat dibayar.
                </p>
              )}
              {t.ke === 3 && t.status === "menunggu" && (
                <p className="text-[11px] text-slate-600 mt-2">
                  BA Selesai Masa Pemeliharaan belum terbit. Perkiraan {t.perkiraan ? tanggalIndo(t.perkiraan) : "—"}
                  {t.sisaHari != null ? ` (${t.sisaHari} hari lagi)` : ""} — isi tanggalnya di tab Jadwal setelah BA-nya ada.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid sm:grid-cols-3 gap-2">
        <Hitung label="Total porsi" nilai={totalPersen || null} sat="%" sub={totalPersen && totalPersen !== 100 ? "belum 100% — periksa" : "lengkap"} />
        <div className="rounded-xl ring-1 ring-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Nilai seluruh termin</p>
          <p className="text-lg font-extrabold tabular-nums text-slate-900 leading-tight">{totalNominal ? rupiah(totalNominal) : "—"}</p>
          {nilai.nilaiKontrak ? <p className="text-[10px] text-slate-500">kontrak {rupiah(nilai.nilaiKontrak)}</p> : null}
        </div>
        <div className="rounded-xl ring-1 ring-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Sudah dibayar</p>
          <p className="text-lg font-extrabold tabular-nums text-emerald-700 leading-tight">{terbayar ? rupiah(terbayar) : "—"}</p>
          <p className="text-[10px] text-slate-500">
            sisa {totalNominal - terbayar > 0 ? rupiah(totalNominal - terbayar) : "—"}
          </p>
        </div>
      </div>
    </>
  );
}

function TabBA({ nilai, set }: { nilai: DockingJadwal; set: (p: Partial<DockingJadwal>) => void }) {
  const [jenis, setJenis] = useState<string>(JENIS_BA[0].key);
  const [unggah, setUnggah] = useState(false);
  const berkas = nilai.berkas || [];

  const tambah = async (files: File[]) => {
    if (!files.length) return;
    setUnggah(true);
    try {
      const baru: BerkasBA[] = [];
      for (const f of files) {
        const { url, ukuran } = await unggahBerkas(f, `berita-acara/${nilai.kapal.replace(/\W+/g, "_")}-${nilai.tahun}`);
        baru.push({ id: uid(), jenis, nama: f.name, url, ukuran, diunggahPada: new Date().toISOString() });
      }
      set({ berkas: [...berkas, ...baru] });
    } catch (e: any) {
      void beritahu(e instanceof BerkasError ? e.message : `Gagal mengunggah: ${e?.message ?? e}`);
    } finally { setUnggah(false); }
  };

  const buang = async (b: BerkasBA) => {
    if (!(await konfirmasi({
      nada: "bahaya", ikon: "📄", judul: "Buang berkas ini dari daftar?",
      pesan: b.nama, rincian: [labelBA(b.jenis), ukuranSingkat(b.ukuran)].filter(Boolean),
      tegasan: "Tautannya hilang dari sini (berkas di Storage tidak ikut dihapus).", tombolYa: "Buang",
    }))) return;
    set({ berkas: berkas.filter((x) => x.id !== b.id) });
  };

  return (
    <>
      <div className="rounded-xl ring-1 ring-slate-200 bg-slate-50 p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Jenis berita acara:</span>
          <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
            {JENIS_BA.map((j) => <option key={j.key} value={j.key}>{j.label}{j.kode !== "—" ? ` · ${j.kode}` : ""}</option>)}
          </select>
          <label className={`btn btn-primary text-xs cursor-pointer ${unggah ? "opacity-60 pointer-events-none" : ""}`}>
            {unggah ? "mengunggah…" : "＋ Unggah berkas"}
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden"
              onChange={(e) => { tambah(Array.from(e.target.files || [])); e.target.value = ""; }} />
          </label>
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">
          Pilih jenisnya dulu, baru unggah — supaya berkas terdaftar sebagai BA yang benar. Boleh beberapa berkas sekaligus. Maks 15 MB per berkas.
        </p>
      </div>

      {/* kelengkapan BA menurut milestone yang sudah terisi */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {JENIS_BA.filter((j) => j.key !== "lain").map((j) => {
          const ada = berkas.some((b) => b.jenis === j.key);
          const perlu = j.tahap && (nilai as any)[j.tahap];
          return (
            <span key={j.key} title={ada ? "sudah ada berkasnya" : perlu ? "tanggalnya sudah terisi tapi berkas BA belum diunggah" : "belum waktunya"}
              className={`text-[10px] font-bold px-2 py-1 rounded-lg ring-1 ${
                ada ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                  : perlu ? "bg-amber-100 text-amber-800 ring-amber-300"
                  : "bg-slate-100 text-slate-500 ring-slate-300"}`}>
              {ada ? "✓" : perlu ? "!" : "·"} {j.label.replace(/^BA /, "")}
            </span>
          );
        })}
      </div>

      {!berkas.length ? (
        <p className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-xl ring-1 ring-slate-200">Belum ada berita acara diunggah.</p>
      ) : (
        <div className="space-y-2">
          {berkas.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl ring-1 ring-slate-200 px-3.5 py-2.5">
              <span className="h-9 w-9 rounded-lg bg-rose-100 text-rose-700 grid place-items-center text-base shrink-0">📄</span>
              <div className="flex-1 min-w-[12rem]">
                <p className="text-xs font-bold text-slate-800">{labelBA(b.jenis)}</p>
                <p className="text-[11px] text-slate-500 truncate" title={b.nama}>{b.nama} {b.ukuran ? `· ${ukuranSingkat(b.ukuran)}` : ""}</p>
              </div>
              <input className="inp !w-40 !text-[11px] !py-1" placeholder="No. BA" value={b.nomor || ""}
                onChange={(e) => set({ berkas: berkas.map((x) => x.id === b.id ? { ...x, nomor: e.target.value } : x) })} />
              <input type="date" className="inp !w-36 !text-[11px] !py-1" value={b.tanggal || ""}
                onChange={(e) => set({ berkas: berkas.map((x) => x.id === b.id ? { ...x, tanggal: e.target.value } : x) })} />
              <a href={b.url} target="_blank" rel="noreferrer" className="btn btn-ghost text-[11px]">buka ↗</a>
              <button onClick={() => buang(b)} className="text-rose-600 hover:text-rose-800 text-sm">✕</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function TabKelas({ kapal, tahun, kelas, onSimpan, onHapus }: {
  kapal: string; tahun: number; kelas: KelasBki[];
  onSimpan: (k: KelasBki) => Promise<void>; onHapus: (id: string) => Promise<void>;
}) {
  const [draf, setDraf] = useState<KelasBki | null>(null);
  const simpan = async () => { if (draf) { await onSimpan(draf); setDraf(null); } };

  return (
    <>
      <p className="text-[11px] text-slate-600 bg-sky-50 ring-1 ring-sky-200 rounded-xl px-3.5 py-2.5 mb-3 leading-relaxed">
        Kapal Ro-Ro berkelas BKI menjalani <b>Survey Tahunan (AS I–IV)</b> dalam daur 5 tahun, ditutup
        <b> Survey Pembaruan Kelas (SS)</b>; <b>Survey Antara (IS)</b> jatuh di sekitar AS II–III dan
        <b> Survey Pengedokan (DS)</b> mengikuti jadwal dock. Catat jatuh tempo &amp; jendela surveinya di sini
        supaya jadwal docking bisa disandingkan dengan kewajiban kelas.
      </p>

      {kelas.length > 0 && (
        <div className="space-y-2 mb-3">
          {kelas.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-3 rounded-xl ring-1 ring-slate-200 px-3.5 py-2.5">
              <span className="text-xs font-extrabold text-slate-800 w-14">{k.jenis}</span>
              <div className="flex-1 min-w-[12rem] text-[11px] text-slate-600">
                {k.dueDate ? <>jatuh tempo <b className="text-slate-800">{tanggalIndo(k.dueDate)}</b></> : "jatuh tempo belum diisi"}
                {k.rentangDari && k.rentangSampai && <> · jendela {tanggalIndo(k.rentangDari)} – {tanggalIndo(k.rentangSampai)}</>}
                {k.noSertifikat && <> · sertifikat {k.noSertifikat}</>}
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ring-1 ${
                k.status === "selesai" ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                  : k.status === "proses" ? "bg-amber-100 text-amber-800 ring-amber-300"
                  : "bg-slate-100 text-slate-600 ring-slate-300"}`}>{STATUS_SURVEY_LABEL[k.status]}</span>
              <button onClick={() => setDraf({ ...k })} className="btn btn-ghost text-[11px]">✏️</button>
              <button onClick={async () => {
                if (await konfirmasi({ nada: "bahaya", judul: `Hapus catatan ${k.jenis} ${k.tahun}?`, pesan: kapal, tegasan: "Tidak bisa dikembalikan.", tombolYa: "Ya, hapus" })) await onHapus(k.id);
              }} className="text-rose-600 hover:text-rose-800 text-sm">✕</button>
            </div>
          ))}
        </div>
      )}

      {!draf ? (
        <button onClick={() => setDraf(kelasBaru(kapal, tahun))} className="btn btn-primary text-xs">＋ Tambah survey kelas</button>
      ) : (
        <div className="rounded-xl ring-1 ring-[#1ca3dd] bg-sky-50/50 p-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Baris label="Jenis survey">
              <select className="inp" value={draf.jenis} onChange={(e) => setDraf({ ...draf, jenis: e.target.value })}>
                {JENIS_SURVEY.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Baris>
            <Baris label="Status">
              <select className="inp" value={draf.status} onChange={(e) => setDraf({ ...draf, status: e.target.value as StatusSurvey })}>
                {(Object.keys(STATUS_SURVEY_LABEL) as StatusSurvey[]).map((s) => <option key={s} value={s}>{STATUS_SURVEY_LABEL[s]}</option>)}
              </select>
            </Baris>
            <Baris label="Jatuh tempo (due date)"><input type="date" className="inp" value={draf.dueDate || ""} onChange={(e) => setDraf({ ...draf, dueDate: e.target.value || undefined })} /></Baris>
            <Baris label="No. Sertifikat"><input className="inp" value={draf.noSertifikat || ""} onChange={(e) => setDraf({ ...draf, noSertifikat: e.target.value })} /></Baris>
            <Baris label="Jendela survey — dari"><input type="date" className="inp" value={draf.rentangDari || ""} onChange={(e) => setDraf({ ...draf, rentangDari: e.target.value || undefined })} /></Baris>
            <Baris label="Jendela survey — sampai"><input type="date" className="inp" value={draf.rentangSampai || ""} onChange={(e) => setDraf({ ...draf, rentangSampai: e.target.value || undefined })} /></Baris>
            <Baris label="Catatan" lebar><input className="inp" value={draf.catatan || ""} onChange={(e) => setDraf({ ...draf, catatan: e.target.value })} /></Baris>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={simpan} className="btn btn-primary text-xs">💾 Simpan survey</button>
            <button onClick={() => setDraf(null)} className="btn btn-ghost text-xs">Batal</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================ potongan kecil ============================ */

function Kartu({ label, nilai, sub, tint, bar }: { label: string; nilai: string; sub?: string; tint: string; bar: string }) {
  return (
    <div className="relative bg-white rounded-2xl ring-line elev-sm pl-4 pr-3 py-3 overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${bar}`} />
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold">{label}</p>
      <p className={`text-xl font-extrabold leading-tight ${tint}`}>{nilai}</p>
      {sub && <p className="text-[10px] text-slate-500 truncate">{sub}</p>}
    </div>
  );
}
const Leg = ({ kelas, teks }: { kelas: string; teks: string }) =>
  <span className="flex items-center gap-1"><i className={`w-2.5 h-2.5 rounded-sm inline-block ${kelas}`} />{teks}</span>;

function Baris({ label, children, lebar }: { label: string; children: React.ReactNode; lebar?: boolean }) {
  return (
    <div className={lebar ? "sm:col-span-2 mt-3" : ""}>
      <label className="block text-[11px] font-semibold text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Hitung({ label, nilai, sat, sub, tebal, tanda }: {
  label: string; nilai: number | null; sat: string; sub?: string; tebal?: boolean; tanda?: boolean;
}) {
  const warna = !tanda ? (tebal ? "text-slate-900" : "text-slate-700")
    : nilai == null ? "text-slate-400" : nilai > 0 ? "text-red-700" : "text-emerald-700";
  return (
    <div className="rounded-xl ring-1 ring-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">{label}</p>
      <p className={`text-lg font-extrabold tabular-nums leading-tight ${warna}`}>
        {nilai == null ? "—" : `${tanda && nilai > 0 ? "+" : ""}${nilai} ${sat}`}
      </p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}
