"use client";
/**
 * Rencana kerja berkala — isi PMS yang sebenarnya.
 *
 * Tiap baris: satu pekerjaan berulang pada satu peralatan, berjarak JAM JALAN
 * atau KALENDER. Jatuh temponya dihitung di layar, tidak disimpan — angka
 * jatuh tempo yang tersimpan akan basi tanpa ada yang tahu, dan itulah cara
 * paling umum sebuah PMS berhenti dipercaya.
 *
 * Tombol "Catat selesai" sengaja ada di sini, bukan di layar terpisah.
 * Mencatat penyelesaian adalah pekerjaan sehari-hari; kalau tempatnya jauh,
 * ia tidak akan dilakukan, dan seluruh daftar ini ikut jadi bohong.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePms } from "@/lib/pms/store";
import {
  Basis, PENANGGUNG, RencanaKerja, TEMPLATE_RENCANA, WARNA_KRITIS, WARNA_STATUS,
  LABEL_STATUS, hitungJatuh, rencanaBaru,
} from "@/lib/pms/types";
import { Pengerjaan, WARNA_KERJA, LABEL_KERJA, pengerjaanBaru, urutRiwayat } from "@/lib/pms/kerja";
import { KAPAL_LIST, STAF_TEKNIK } from "@/lib/sppbj/db";
import { Ikon } from "@/components/ikon";
import { beritahu, konfirmasi } from "@/components/Konfirmasi";

const ringkas = (k: string) => k.replace(/^KMP\.?\s*/i, "");
const hariIni = () => new Date().toISOString().slice(0, 10);
const KELAS_INPUT = "w-full text-xs border rounded-lg px-2 py-1.5 focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/20 outline-none";

export default function RencanaPms() {
  const { list, kerja, jam, loading, galat, reload, simpan, catat } = usePms();
  const [kapal, setKapal] = useState(KAPAL_LIST[0]);
  const [cari, setCari] = useState("");
  const [sunting, setSunting] = useState<RencanaKerja | null>(null);
  const [selesai, setSelesai] = useState<Pengerjaan | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const doc = list.find((x) => x.kapal === kapal);
  const riwayat = useMemo(() => kerja.find((x) => x.kapal === kapal)?.riwayat || [], [kerja, kapal]);
  const peralatan = useMemo(() => doc?.peralatan || [], [doc]);
  const rencana = useMemo(() => doc?.rencana || [], [doc]);
  const petaAlat = useMemo(() => new Map(peralatan.map((p) => [p.tag, p])), [peralatan]);

  const jamUntuk = (tag: string) => {
    const alat = petaAlat.get(tag);
    return alat?.sumberJam ? jam[kapal]?.[alat.sumberJam] : undefined;
  };

  /** catatan pengerjaan terakhir tiap rencana — dipakai memberi tahu ASAL angka "Terakhir" */
  const kerjaTerakhir = useMemo(() => {
    const peta = new Map<string, Pengerjaan>();
    [...riwayat].sort(urutRiwayat).forEach((k) => {
      if (k.status !== "ditolak" && !peta.has(k.rencanaId)) peta.set(k.rencanaId, k);
    });
    return peta;
  }, [riwayat]);

  const baris = useMemo(() => {
    const q = cari.toLowerCase().trim();
    return rencana
      .filter((r) => !q || `${r.tag} ${r.pekerjaan} ${r.penanggung}`.toLowerCase().includes(q))
      .map((r) => ({ r, alat: petaAlat.get(r.tag), jatuh: hitungJatuh(r, jamUntuk(r.tag)), akhir: kerjaTerakhir.get(r.id) }))
      .sort((a, b) => (a.r.tag).localeCompare(b.r.tag) || a.r.pekerjaan.localeCompare(b.r.pekerjaan));
  }, [rencana, cari, petaAlat, jam, kapal, kerjaTerakhir]);

  const simpanSemua = async (baru: RencanaKerja[]) => {
    setSibuk(true);
    try { await simpan({ kapal, peralatan, rencana: baru }); }
    catch (e: any) { await beritahu("Gagal menyimpan: " + (e?.message ?? e)); }
    finally { setSibuk(false); }
  };

  const pakaiTemplate = async () => {
    if (!peralatan.length) {
      await beritahu("Isi daftar peralatan kapal ini dulu — rencana kerja menempel pada tag peralatan.");
      return;
    }
    const tagAda = new Set(peralatan.map((p) => p.tag));
    // hanya untuk peralatan yang benar-benar ada di kapal ini
    const calon = TEMPLATE_RENCANA.filter((t) => tagAda.has(t.tag));
    const sudah = new Set(rencana.map((r) => `${r.tag}|${r.pekerjaan.toLowerCase()}`));
    const tambahan = calon.filter((t) => !sudah.has(`${t.tag}|${t.pekerjaan.toLowerCase()}`));
    if (!tambahan.length) {
      await beritahu("Tidak ada yang bisa ditambahkan: rencana template untuk peralatan kapal ini sudah ada semua.");
      return;
    }
    if (!(await konfirmasi({
      nada: "biasa", ikon: "🗓️", judul: "Isi rencana dari template?",
      pesan: `${tambahan.length} rencana kerja akan ditambahkan ke ${kapal}.`,
      rincian: [`Hanya untuk peralatan yang sudah terdaftar di kapal ini (${calon.length} cocok dari ${TEMPLATE_RENCANA.length} template)`,
                "Interval dan penanggung boleh diubah setelahnya",
                "Capaian terakhir masih kosong — statusnya “Belum disetel” sampai diisi"],
      tombolYa: "Ya, tambahkan",
    }))) return;
    await simpanSemua([...rencana, ...tambahan.map((t) => ({ ...rencanaBaru(t.tag), intervalHari: undefined, ...t }))]);
  };

  const simpanSatu = async (r: RencanaKerja) => {
    if (!r.tag.trim() || !r.pekerjaan.trim()) { await beritahu("Tag peralatan dan nama pekerjaan wajib diisi."); return; }
    if (!petaAlat.has(r.tag)) { await beritahu(`Tag ${r.tag} tidak ada di daftar peralatan ${kapal}.`); return; }
    if (r.basis === "jam" && !Number(r.intervalJam)) { await beritahu("Interval jam belum diisi."); return; }
    if (r.basis === "kalender" && !Number(r.intervalHari)) { await beritahu("Interval hari belum diisi."); return; }
    const ada = rencana.some((x) => x.id === r.id);
    await simpanSemua(ada ? rencana.map((x) => (x.id === r.id ? r : x)) : [...rencana, r]);
    setSunting(null);
  };

  /**
   * Buka borang "pekerjaan selesai".
   *
   * Sengaja borang, bukan sekadar tombol ya/tidak. Yang dicatat bukan hanya
   * "sudah" melainkan siapa yang mengerjakan, pada jam berapa, dan suku cadang
   * apa yang terpakai — tiga hal yang setahun kemudian menjadi dasar menyusun
   * kebutuhan belanja, dan yang tidak mungkin diingat kalau tidak ditulis saat
   * pekerjaannya masih hangat.
   */
  const bukaSelesai = (r: RencanaKerja) => {
    const k = pengerjaanBaru(r, "kantor");
    const jamKini = jamUntuk(r.tag);
    setSelesai({ ...k, jam: r.basis === "jam" ? jamKini : undefined, olehAkun: STAF_TEKNIK[0] });
  };

  const kirimSelesai = async () => {
    if (!selesai) return;
    if (!selesai.tanggal) { await beritahu("Tanggal pengerjaan belum diisi."); return; }
    if (!selesai.pelaksana.trim()) { await beritahu("Isi siapa yang mengerjakan."); return; }
    if (selesai.basis === "jam" && (selesai.jam === undefined || Number.isNaN(selesai.jam))) {
      await beritahu({
        nada: "perhatian", judul: "Jam jalan belum diisi",
        pesan: "Rencana ini berjarak jam jalan mesin, jadi angka jamnya wajib ada — tanpa itu jatuh tempo berikutnya tidak bisa dihitung.",
        rincian: ["Angka terisi sendiri bila ABK mesin mengisi Jam kerja mesin di Portal Kapal."],
      });
      return;
    }
    setSibuk(true);
    try {
      await catat(kapal, { ...selesai, dicatatPada: new Date().toISOString() });
      setSelesai(null);
    } catch (e: any) { await beritahu("Gagal mencatat: " + (e?.message ?? e)); }
    finally { setSibuk(false); }
  };

  const hapus = async (r: RencanaKerja) => {
    if (!(await konfirmasi({
      nada: "bahaya", ikon: "🗑️", judul: "Hapus rencana kerja?",
      pesan: `${r.tag} — ${r.pekerjaan}`, tegasan: "Tidak bisa dikembalikan.", tombolYa: "Ya, hapus",
    }))) return;
    await simpanSemua(rencana.filter((x) => x.id !== r.id));
  };

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-5 flex flex-wrap items-center gap-4">
          <Link href="/pms" className="bg-white rounded-2xl p-3 shadow-md shrink-0 text-[#16357f]" title="Kembali ke beranda PMS">
            <Ikon nama="kalenderCentang" className="w-6 h-6" />
          </Link>
          <div className="flex-1 min-w-[15rem]">
            <Link href="/pms" className="text-xs text-slate-500 hover:text-[#16357f]">‹ PMS</Link>
            <h1 className="text-xl font-extrabold asdp-text-gradient">Rencana Kerja Berkala</h1>
            <p className="text-slate-500 text-sm">{rencana.length} rencana di {kapal} · {peralatan.length} peralatan tersedia</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pms/peralatan" className="btn btn-ghost text-xs">🔧 Peralatan</Link>
            <button onClick={reload} disabled={loading} className="btn btn-ghost text-xs disabled:opacity-50">
              {loading ? "memuat…" : "⟲ Muat ulang"}
            </button>
          </div>
        </div>
      </div>

      {galat && <p className="mt-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2">{galat}</p>}

      <div className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 p-3">
        <div className="flex flex-wrap gap-1.5">
          {KAPAL_LIST.map((k) => {
            const n = list.find((x) => x.kapal === k)?.rencana?.length || 0;
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <input value={cari} onChange={(e) => setCari(e.target.value)}
            placeholder="cari pekerjaan / tag / penanggung…" className={`${KELAS_INPUT} pl-8 py-2`} />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"><Ikon nama="kaca" className="w-4 h-4" /></span>
        </div>
        <button onClick={() => setSunting(rencanaBaru(peralatan[0]?.tag || ""))}
          disabled={!peralatan.length} className="btn btn-primary text-xs disabled:opacity-40">＋ Tambah rencana</button>
        <button onClick={pakaiTemplate} disabled={sibuk} className="btn btn-ghost text-xs disabled:opacity-50">
          🗓️ Isi dari template
        </button>
      </div>

      {sunting && (
        <section className="mt-4 rounded-2xl bg-white ring-2 ring-[#16357f]/30 p-4">
          <h2 className="font-bold text-slate-800 text-sm mb-3">
            {rencana.some((x) => x.id === sunting.id) ? "Ubah rencana kerja" : "Rencana kerja baru"}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-[11px] font-semibold text-slate-600">
              Peralatan <span className="text-red-500">*</span>
              <select value={sunting.tag} onChange={(e) => setSunting({ ...sunting, tag: e.target.value })}
                className={`${KELAS_INPUT} mt-1`}>
                {peralatan.map((p) => <option key={p.id} value={p.tag}>{p.tag} — {p.nama}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-600 sm:col-span-2">
              Pekerjaan <span className="text-red-500">*</span>
              <input value={sunting.pekerjaan} onChange={(e) => setSunting({ ...sunting, pekerjaan: e.target.value })}
                placeholder="Ganti minyak lumas dan filter oli" className={`${KELAS_INPUT} mt-1`} />
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Penanggung jawab
              <select value={sunting.penanggung} onChange={(e) => setSunting({ ...sunting, penanggung: e.target.value })}
                className={`${KELAS_INPUT} mt-1`}>
                {PENANGGUNG.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Dasar interval
              <select value={sunting.basis} onChange={(e) => setSunting({ ...sunting, basis: e.target.value as Basis })}
                className={`${KELAS_INPUT} mt-1`}>
                <option value="kalender">Kalender (hari)</option>
                <option value="jam">Jam jalan mesin</option>
              </select>
            </label>
            {sunting.basis === "jam" ? (
              <>
                <label className="text-[11px] font-semibold text-slate-600">
                  Tiap berapa jam <span className="text-red-500">*</span>
                  <input type="number" min={1} value={sunting.intervalJam || ""}
                    onChange={(e) => setSunting({ ...sunting, intervalJam: Number(e.target.value) })}
                    placeholder="250" className={`${KELAS_INPUT} mt-1`} />
                </label>
                <label className="text-[11px] font-semibold text-slate-600">
                  Jam saat terakhir dikerjakan
                  <input type="number" min={0} value={sunting.terakhirJam ?? ""}
                    onChange={(e) => setSunting({ ...sunting, terakhirJam: e.target.value === "" ? undefined : Number(e.target.value) })}
                    className={`${KELAS_INPUT} mt-1`} />
                </label>
              </>
            ) : (
              <>
                <label className="text-[11px] font-semibold text-slate-600">
                  Tiap berapa hari <span className="text-red-500">*</span>
                  <input type="number" min={1} value={sunting.intervalHari || ""}
                    onChange={(e) => setSunting({ ...sunting, intervalHari: Number(e.target.value) })}
                    placeholder="30" className={`${KELAS_INPUT} mt-1`} />
                </label>
                <label className="text-[11px] font-semibold text-slate-600">
                  Tanggal terakhir dikerjakan
                  <input type="date" value={sunting.terakhirTanggal || ""}
                    onChange={(e) => setSunting({ ...sunting, terakhirTanggal: e.target.value })}
                    className={`${KELAS_INPUT} mt-1`} />
                </label>
              </>
            )}
            <label className="text-[11px] font-semibold text-slate-600 sm:col-span-2">
              Suku cadang yang dibutuhkan
              <input value={sunting.sukuCadang || ""} onChange={(e) => setSunting({ ...sunting, sukuCadang: e.target.value })}
                placeholder="Oli SAE 40, filter oli, filter solar" className={`${KELAS_INPUT} mt-1`} />
            </label>
            <label className="text-[11px] font-semibold text-slate-600 sm:col-span-2 lg:col-span-4">
              Langkah kerja singkat
              <textarea value={sunting.langkah || ""} onChange={(e) => setSunting({ ...sunting, langkah: e.target.value })}
                rows={2} className={`${KELAS_INPUT} mt-1`} />
            </label>
            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              <input type="checkbox" checked={sunting.aktif} onChange={(e) => setSunting({ ...sunting, aktif: e.target.checked })} />
              Rencana aktif
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

      {selesai && (
        <section className="mt-4 rounded-2xl bg-white ring-2 ring-emerald-400/60 p-4">
          <h2 className="font-bold text-slate-800 text-sm">✓ Catat pekerjaan selesai</h2>
          <p className="text-[11px] text-slate-500 mb-3">
            <span className="font-mono font-bold text-[#16357f]">{selesai.tag}</span> — {selesai.pekerjaan}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-[11px] font-semibold text-slate-600">
              Tanggal dikerjakan <span className="text-red-500">*</span>
              <input type="date" value={selesai.tanggal} max={hariIni()}
                onChange={(e) => setSelesai({ ...selesai, tanggal: e.target.value })} className={`${KELAS_INPUT} mt-1`} />
            </label>
            {selesai.basis === "jam" && (
              <label className="text-[11px] font-semibold text-slate-600">
                Jam jalan saat dikerjakan <span className="text-red-500">*</span>
                <input type="number" min={0} value={selesai.jam ?? ""}
                  onChange={(e) => setSelesai({ ...selesai, jam: e.target.value === "" ? undefined : Number(e.target.value) })}
                  className={`${KELAS_INPUT} mt-1`} />
                <span className="block mt-0.5 font-normal text-[10px] text-slate-400">
                  {jamUntuk(selesai.tag) !== undefined
                    ? `terisi dari kiriman kapal (${jamUntuk(selesai.tag)!.toLocaleString("id-ID")} jam) — ubah bila pekerjaannya dilakukan lebih dulu`
                    : "kapal belum mengirim jam jalan — isi dari buku jurnal mesin"}
                </span>
              </label>
            )}
            <label className="text-[11px] font-semibold text-slate-600">
              Dikerjakan oleh <span className="text-red-500">*</span>
              <input value={selesai.pelaksana} onChange={(e) => setSelesai({ ...selesai, pelaksana: e.target.value })}
                placeholder="Masinis II / bengkel" className={`${KELAS_INPUT} mt-1`} />
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Dicatat oleh (staf kantor)
              <input list="stafPms" value={selesai.olehAkun} onChange={(e) => setSelesai({ ...selesai, olehAkun: e.target.value })}
                className={`${KELAS_INPUT} mt-1`} />
              <datalist id="stafPms">{STAF_TEKNIK.map((s) => <option key={s} value={s} />)}</datalist>
            </label>
            <label className="text-[11px] font-semibold text-slate-600 sm:col-span-2">
              Suku cadang yang terpakai
              <input value={selesai.sukuCadangDipakai || ""}
                onChange={(e) => setSelesai({ ...selesai, sukuCadangDipakai: e.target.value })}
                className={`${KELAS_INPUT} mt-1`} />
            </label>
            <label className="text-[11px] font-semibold text-slate-600 sm:col-span-2">
              Catatan temuan
              <input value={selesai.catatan || ""} onChange={(e) => setSelesai({ ...selesai, catatan: e.target.value })}
                placeholder="mis. gasket head mulai rembes, siapkan penggantian" className={`${KELAS_INPUT} mt-1`} />
            </label>
          </div>
          <p className="mt-3 text-[10px] text-slate-400">
            Dicatat staf kantor → langsung berstatus <b>Disahkan</b>. Laporan yang datang dari kapal lewat
            Portal masuk sebagai <b>Menunggu pengesahan</b> dan disahkan di halaman Riwayat &amp; Pengesahan.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={kirimSelesai} disabled={sibuk} className="btn btn-primary text-xs disabled:opacity-50">
              {sibuk ? "…" : "✓ Simpan catatan"}
            </button>
            <button onClick={() => setSelesai(null)} className="btn btn-ghost text-xs">Batal</button>
          </div>
        </section>
      )}

      {!peralatan.length ? (
        <section className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 p-8 text-center">
          <p className="text-3xl">🔧</p>
          <p className="mt-2 font-bold text-slate-800">{kapal} belum punya peralatan</p>
          <p className="text-sm text-slate-500 mt-1">Rencana kerja menempel pada tag peralatan, jadi daftarnya harus ada lebih dulu.</p>
          <Link href="/pms/peralatan" className="btn btn-primary text-sm mt-4 inline-block">🔧 Buka daftar peralatan</Link>
        </section>
      ) : rencana.length === 0 ? (
        <section className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 p-8 text-center">
          <p className="text-3xl">🗓️</p>
          <p className="mt-2 font-bold text-slate-800">Belum ada rencana kerja di {ringkas(kapal)}</p>
          <p className="text-sm text-slate-500 mt-1">Isi dari template untuk memulai, lalu sesuaikan interval dan penanggungnya.</p>
        </section>
      ) : (
        <section className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-2 text-left w-24">Tag</th>
                  <th className="p-2 text-left">Pekerjaan</th>
                  <th className="p-2 text-left w-28">Interval</th>
                  <th className="p-2 text-left w-28">Terakhir</th>
                  <th className="p-2 text-left w-24">Penanggung</th>
                  <th className="p-2 text-left w-36">Jatuh tempo</th>
                  <th className="p-2 text-right w-36">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {baris.map(({ r, alat, jatuh, akhir }) => (
                  <tr key={r.id} className={`border-b hover:bg-slate-50 ${r.aktif ? "" : "opacity-50"}`}>
                    <td className="p-2 align-top">
                      <span className="font-mono text-[11px] font-bold text-[#16357f]">{r.tag}</span>
                      {alat ? (
                        <span className={`block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded ring-1 w-fit ${WARNA_KRITIS[alat.kekritisan]}`}>
                          {alat.kekritisan}
                        </span>
                      ) : <span className="block text-[10px] text-red-600">tag tak dikenal</span>}
                    </td>
                    <td className="p-2 align-top">
                      <p className="font-semibold text-slate-800">{r.pekerjaan}</p>
                      <p className="text-[10px] text-slate-400">{alat?.nama}</p>
                      {r.sukuCadang && <p className="text-[10px] text-slate-500 mt-0.5">🔩 {r.sukuCadang}</p>}
                    </td>
                    <td className="p-2 align-top text-slate-600">
                      {r.basis === "jam" ? `${r.intervalJam} jam` : `${r.intervalHari} hari`}
                    </td>
                    <td className="p-2 align-top text-slate-500 text-[11px]">
                      {r.basis === "jam"
                        ? (r.terakhirJam !== undefined ? `${r.terakhirJam.toLocaleString("id-ID")} jam` : "—")
                        : (r.terakhirTanggal || "—")}
                      {akhir && (
                        <>
                          <span className="block text-[10px] text-slate-400">
                            {akhir.pelaksana}{akhir.sumber === "kapal" ? " · lapor kapal" : ""}
                          </span>
                          {akhir.status === "menunggu" && (
                            <span className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded ring-1 ${WARNA_KERJA.menunggu}`}>
                              {LABEL_KERJA.menunggu}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="p-2 align-top text-slate-600">{r.penanggung}</td>
                    <td className="p-2 align-top">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${WARNA_STATUS[jatuh.status]}`}>
                        {LABEL_STATUS[jatuh.status]}
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">{jatuh.teks}</span>
                    </td>
                    <td className="p-2 align-top">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => bukaSelesai(r)} disabled={sibuk}
                          className="text-[10px] font-semibold px-2 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                          ✓ Catat selesai
                        </button>
                        <button onClick={() => setSunting({ ...r })} className="text-[11px] text-[#16357f] hover:underline">ubah</button>
                        <button onClick={() => hapus(r)} className="text-slate-300 hover:text-red-600 px-1" title="Hapus">
                          <Ikon nama="silang" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
