"use client";
/**
 * Daftar peralatan kapal — fondasi PMS.
 *
 * Satu baris = satu benda yang dirawat, dengan TAG sebagai namanya di mata
 * sistem. Rencana kerja menempel pada tag, bukan pada nama, supaya nama boleh
 * diperbaiki tanpa memutus riwayatnya.
 *
 * Template baku tidak dipasang otomatis. Armada cabang tidak seragam — ada
 * kapal bermesin tunggal, ada yang tanpa bow thruster — dan daftar yang tampak
 * lengkap padahal salah lebih berbahaya daripada daftar kosong, karena orang
 * berhenti memeriksanya.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePms } from "@/lib/pms/store";
import {
  KEKRITISAN, Kekritisan, Peralatan, SISTEM, Sistem, TEMPLATE_PERALATAN,
  WARNA_KRITIS, peralatanBaru,
} from "@/lib/pms/types";
import { KAPAL_LIST } from "@/lib/sppbj/db";
import { Ikon } from "@/components/ikon";
import { beritahu, konfirmasi } from "@/components/Konfirmasi";

const ringkas = (k: string) => k.replace(/^KMP\.?\s*/i, "");
const KELAS_INPUT = "w-full text-xs border rounded-lg px-2 py-1.5 focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/20 outline-none";

export default function PeralatanPms() {
  const { list, jam, loading, galat, reload, simpan } = usePms();
  const [kapal, setKapal] = useState(KAPAL_LIST[0]);
  const [cari, setCari] = useState("");
  const [sunting, setSunting] = useState<Peralatan | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const doc = list.find((x) => x.kapal === kapal);
  const peralatan = useMemo(() => doc?.peralatan || [], [doc]);
  const namaJam = Object.keys(jam[kapal] || {});

  const tampil = useMemo(() => {
    const q = cari.toLowerCase().trim();
    const hasil = q
      ? peralatan.filter((p) => `${p.tag} ${p.nama} ${p.sistem} ${p.merek || ""} ${p.tipe || ""}`.toLowerCase().includes(q))
      : peralatan;
    const perSistem = new Map<Sistem, Peralatan[]>();
    for (const s of SISTEM) {
      const isi = hasil.filter((p) => p.sistem === s);
      if (isi.length) perSistem.set(s, isi);
    }
    return perSistem;
  }, [peralatan, cari]);

  const simpanSemua = async (baru: Peralatan[]) => {
    setSibuk(true);
    try {
      await simpan({ kapal, peralatan: baru, rencana: doc?.rencana || [] });
    } catch (e: any) { await beritahu("Gagal menyimpan: " + (e?.message ?? e)); }
    finally { setSibuk(false); }
  };

  const pakaiTemplate = async () => {
    const adaTag = new Set(peralatan.map((p) => p.tag));
    const tambahan = TEMPLATE_PERALATAN.filter((t) => !adaTag.has(t.tag));
    if (!tambahan.length) { await beritahu("Semua tag template sudah ada di kapal ini."); return; }
    if (!(await konfirmasi({
      nada: "biasa", ikon: "🔧", judul: `Isi dari template baku?`,
      pesan: `${tambahan.length} peralatan akan ditambahkan ke ${kapal}.`,
      rincian: ["Tag yang sudah ada tidak diubah",
                "Template ini titik awal — hapus yang tidak ada di kapal ini, dan betulkan merek/tipe/nomor serinya"],
      tombolYa: "Ya, tambahkan",
    }))) return;
    await simpanSemua([
      ...peralatan,
      ...tambahan.map((t) => ({ ...peralatanBaru(), ...t })),
    ]);
  };

  const simpanSatu = async (p: Peralatan) => {
    const tag = p.tag.trim().toUpperCase();
    if (!tag || !p.nama.trim()) { await beritahu("Tag dan nama peralatan wajib diisi."); return; }
    const bentrok = peralatan.some((x) => x.id !== p.id && x.tag.toUpperCase() === tag);
    if (bentrok) { await beritahu(`Tag ${tag} sudah dipakai peralatan lain di kapal ini.`); return; }
    const isi = { ...p, tag, nama: p.nama.trim() };
    const ada = peralatan.some((x) => x.id === p.id);
    await simpanSemua(ada ? peralatan.map((x) => (x.id === p.id ? isi : x)) : [...peralatan, isi]);
    setSunting(null);
  };

  const hapus = async (p: Peralatan) => {
    const terpakai = (doc?.rencana || []).filter((r) => r.tag === p.tag).length;
    if (!(await konfirmasi({
      nada: "bahaya", ikon: "🗑️", judul: `Hapus ${p.tag} — ${p.nama}?`,
      pesan: terpakai
        ? `${terpakai} rencana kerja menempel pada tag ini dan akan kehilangan peralatannya.`
        : "Peralatan ini belum punya rencana kerja.",
      tegasan: "Tidak bisa dikembalikan.", tombolYa: "Ya, hapus",
    }))) return;
    await simpanSemua(peralatan.filter((x) => x.id !== p.id));
  };

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-5 flex flex-wrap items-center gap-4">
          <Link href="/pms" className="bg-white rounded-2xl p-3 shadow-md shrink-0 text-[#16357f]" title="Kembali ke beranda PMS">
            <Ikon nama="obeng" className="w-6 h-6" />
          </Link>
          <div className="flex-1 min-w-[15rem]">
            <Link href="/pms" className="text-xs text-slate-500 hover:text-[#16357f]">‹ PMS</Link>
            <h1 className="text-xl font-extrabold asdp-text-gradient">Peralatan Kapal</h1>
            <p className="text-slate-500 text-sm">{peralatan.length} peralatan di {kapal} · tag dipakai rencana kerja</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pms/rencana" className="btn btn-ghost text-xs">🗓️ Rencana Kerja</Link>
            <button onClick={reload} disabled={loading} className="btn btn-ghost text-xs disabled:opacity-50">
              {loading ? "memuat…" : "⟲ Muat ulang"}
            </button>
          </div>
        </div>
      </div>

      {galat && <p className="mt-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2">{galat}</p>}

      {/* pilih kapal */}
      <div className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 p-3">
        <div className="flex flex-wrap gap-1.5">
          {KAPAL_LIST.map((k) => {
            const n = list.find((x) => x.kapal === k)?.peralatan?.length || 0;
            return (
              <button key={k} onClick={() => { setKapal(k); setSunting(null); }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                  k === kapal ? "bg-[#16357f] text-white border-[#16357f]"
                              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
                {ringkas(k)} <span className={k === kapal ? "text-sky-200" : "text-slate-400"}>({n})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* alat kerja */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <input value={cari} onChange={(e) => setCari(e.target.value)}
            placeholder="cari tag / nama / merek…" className={`${KELAS_INPUT} pl-8 py-2`} />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"><Ikon nama="kaca" className="w-4 h-4" /></span>
        </div>
        <button onClick={() => setSunting(peralatanBaru())} className="btn btn-primary text-xs">＋ Tambah peralatan</button>
        <button onClick={pakaiTemplate} disabled={sibuk} className="btn btn-ghost text-xs disabled:opacity-50"
          title="Menambahkan peralatan baku kapal penyeberangan yang belum ada">
          🔧 Isi dari template ({TEMPLATE_PERALATAN.length})
        </button>
      </div>

      {/* borang sunting */}
      {sunting && (
        <section className="mt-4 rounded-2xl bg-white ring-2 ring-[#16357f]/30 p-4">
          <h2 className="font-bold text-slate-800 text-sm mb-3">
            {peralatan.some((x) => x.id === sunting.id) ? "Ubah peralatan" : "Peralatan baru"}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-[11px] font-semibold text-slate-600">
              Tag <span className="text-red-500">*</span>
              <input value={sunting.tag} onChange={(e) => setSunting({ ...sunting, tag: e.target.value })}
                placeholder="ME-01" className={`${KELAS_INPUT} mt-1 font-mono uppercase`} />
            </label>
            <label className="text-[11px] font-semibold text-slate-600 sm:col-span-2">
              Nama peralatan <span className="text-red-500">*</span>
              <input value={sunting.nama} onChange={(e) => setSunting({ ...sunting, nama: e.target.value })}
                placeholder="Mesin Induk Kanan" className={`${KELAS_INPUT} mt-1`} />
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Sistem
              <select value={sunting.sistem} onChange={(e) => setSunting({ ...sunting, sistem: e.target.value as Sistem })}
                className={`${KELAS_INPUT} mt-1`}>
                {SISTEM.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Merek
              <input value={sunting.merek || ""} onChange={(e) => setSunting({ ...sunting, merek: e.target.value })}
                placeholder="Yanmar" className={`${KELAS_INPUT} mt-1`} />
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Tipe
              <input value={sunting.tipe || ""} onChange={(e) => setSunting({ ...sunting, tipe: e.target.value })}
                placeholder="12 AYM-WST" className={`${KELAS_INPUT} mt-1`} />
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Nomor seri
              <input value={sunting.nomorSeri || ""} onChange={(e) => setSunting({ ...sunting, nomorSeri: e.target.value })}
                className={`${KELAS_INPUT} mt-1`} />
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Kekritisan
              <select value={sunting.kekritisan} onChange={(e) => setSunting({ ...sunting, kekritisan: e.target.value as Kekritisan })}
                className={`${KELAS_INPUT} mt-1`}>
                {KEKRITISAN.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-600 sm:col-span-2">
              Sumber jam jalan (nama mesin di Portal Kapal)
              <input list="namaJamMesin" value={sunting.sumberJam || ""}
                onChange={(e) => setSunting({ ...sunting, sumberJam: e.target.value })}
                placeholder={namaJam.length ? namaJam[0] : "kosongkan bila tak berjam-meter"}
                className={`${KELAS_INPUT} mt-1`} />
              <datalist id="namaJamMesin">{namaJam.map((n) => <option key={n} value={n} />)}</datalist>
              <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                {namaJam.length
                  ? `Terbaca dari kapal ini: ${namaJam.join(", ")}`
                  : "Kapal ini belum mengirim jam mesin lewat Portal — rencana berbasis jam belum bisa dihitung."}
              </span>
            </label>
            <label className="text-[11px] font-semibold text-slate-600 sm:col-span-2">
              Catatan
              <input value={sunting.catatan || ""} onChange={(e) => setSunting({ ...sunting, catatan: e.target.value })}
                className={`${KELAS_INPUT} mt-1`} />
            </label>
            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 mt-5">
              <input type="checkbox" checked={sunting.aktif} onChange={(e) => setSunting({ ...sunting, aktif: e.target.checked })} />
              Masih terpasang / aktif
            </label>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button onClick={() => simpanSatu(sunting)} disabled={sibuk} className="btn btn-primary text-xs disabled:opacity-50">
              {sibuk ? "…" : "💾 Simpan"}
            </button>
            <button onClick={() => setSunting(null)} className="btn btn-ghost text-xs">Batal</button>
          </div>
        </section>
      )}

      {/* daftar per sistem */}
      {peralatan.length === 0 ? (
        <section className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 p-8 text-center">
          <p className="text-3xl">🔧</p>
          <p className="mt-2 font-bold text-slate-800">{kapal} belum punya daftar peralatan</p>
          <p className="text-sm text-slate-500 mt-1">
            Klik <b>Isi dari template</b> untuk memulai dari {TEMPLATE_PERALATAN.length} peralatan baku,
            lalu hapus yang tidak ada di kapal ini.
          </p>
        </section>
      ) : (
        <div className="mt-4 space-y-3">
          {Array.from(tampil.entries()).map(([sistem, isi]) => (
            <section key={sistem} className="rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b flex items-center gap-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">{sistem}</h3>
                <span className="text-[11px] text-slate-400">{isi.length} peralatan</span>
              </div>
              <div className="divide-y">
                {isi.map((p) => {
                  const nRencana = (doc?.rencana || []).filter((r) => r.tag === p.tag && r.aktif).length;
                  const jamKini = p.sumberJam ? jam[kapal]?.[p.sumberJam] : undefined;
                  return (
                    <div key={p.id} className={`px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 ${p.aktif ? "" : "opacity-50"}`}>
                      <span className="font-mono text-[11px] font-bold text-[#16357f] w-24">{p.tag}</span>
                      <span className="text-sm font-semibold text-slate-800 flex-1 min-w-[12rem]">{p.nama}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ring-1 ${WARNA_KRITIS[p.kekritisan]}`}>{p.kekritisan}</span>
                      {(p.merek || p.tipe) && (
                        <span className="text-[11px] text-slate-500 w-40 truncate" title={`${p.merek || ""} ${p.tipe || ""}`}>
                          {[p.merek, p.tipe].filter(Boolean).join(" ")}
                        </span>
                      )}
                      {p.sumberJam && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                          ⏱ {p.sumberJam}{jamKini !== undefined ? `: ${jamKini.toLocaleString("id-ID")} jam` : " — belum ada data"}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${nRencana ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-400"}`}>
                        {nRencana} rencana
                      </span>
                      {!p.aktif && <span className="text-[10px] bg-slate-200 text-slate-600 rounded px-1.5 py-0.5">nonaktif</span>}
                      <div className="flex items-center gap-1 ml-auto">
                        <button onClick={() => setSunting({ ...p })} className="text-[11px] text-[#16357f] hover:underline">ubah</button>
                        <button onClick={() => hapus(p)} className="text-slate-300 hover:text-red-600 px-1" title="Hapus">
                          <Ikon nama="silang" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
