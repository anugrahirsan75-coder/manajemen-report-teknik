"use client";
/**
 * Riwayat & Pengesahan — tempat kantor menutup pekerjaan yang dilaporkan kapal.
 *
 * Pembagian tugasnya: ABK yang mengerjakan dan melapor lewat Portal Kapal,
 * kantor yang mengesahkan. Pengesahan bukan formalitas — ia yang membuat
 * riwayat perawatan sebuah kapal bisa ditunjukkan kepada Class atau auditor ISM
 * tanpa perlu dibela dengan penjelasan lisan.
 *
 * Yang TIDAK dilakukan di sini: menahan jatuh tempo sampai disahkan. Jam sebuah
 * pekerjaan sudah bergeser sejak kapal melapor, karena pekerjaannya memang
 * sudah dikerjakan. Yang menunggu tanda tangan adalah pengakuannya, bukan
 * kenyataannya — dan daftar jatuh tempo yang menampilkan tunggakan palsu
 * selama tiga hari akan berhenti dipercaya jauh sebelum tanda tangan itu turun.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePms } from "@/lib/pms/store";
import {
  LABEL_KERJA, Pengerjaan, StatusKerja, WARNA_KERJA, urutRiwayat,
} from "@/lib/pms/kerja";
import { STAF_TEKNIK } from "@/lib/sppbj/db";
import { Ikon } from "@/components/ikon";
import { beritahu, konfirmasi } from "@/components/Konfirmasi";

const ringkas = (k: string) => k.replace(/^KMP\.?\s*/i, "");
const LS_SAYA = "pms_pemeriksa";
const KELAS_INPUT = "text-xs border rounded-lg px-2 py-1.5 focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/20 outline-none";

const tanggalIndo = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s || "")
    ? new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
    : s || "—";

interface Baris { kapal: string; k: Pengerjaan }

export default function PengerjaanPms() {
  const { list, kerja, loading, galat, reload, sahkan, tolak } = usePms();
  const [tab, setTab] = useState<StatusKerja | "semua">("menunggu");
  const [kapal, setKapal] = useState("");
  const [cari, setCari] = useState("");
  const [saya, setSaya] = useState(STAF_TEKNIK[0]);
  const [tolakId, setTolakId] = useState("");
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState("");

  // nama pemeriksa diingat per komputer — mengetiknya ulang tiap pengesahan
  // membuat orang memilih nama pertama yang muncul, dan catatannya jadi bohong
  useEffect(() => {
    try { const a = localStorage.getItem(LS_SAYA); if (a) setSaya(a); } catch { /* diabaikan */ }
  }, []);
  const gantiSaya = (v: string) => {
    setSaya(v);
    try { localStorage.setItem(LS_SAYA, v); } catch { /* diabaikan */ }
  };

  const semua: Baris[] = useMemo(() => {
    const out: Baris[] = [];
    for (const k of kerja) for (const x of k.riwayat || []) out.push({ kapal: k.kapal, k: x });
    return out.sort((a, b) => urutRiwayat(a.k, b.k));
  }, [kerja]);

  const hitung = useMemo(() => ({
    menunggu: semua.filter((b) => b.k.status === "menunggu").length,
    disahkan: semua.filter((b) => b.k.status === "disahkan").length,
    ditolak: semua.filter((b) => b.k.status === "ditolak").length,
  }), [semua]);

  const kapalAda = useMemo(
    () => Array.from(new Set(semua.map((b) => b.kapal))).sort(),
    [semua]);

  const tampil = useMemo(() => {
    const q = cari.toLowerCase().trim();
    return semua.filter((b) =>
      (tab === "semua" || b.k.status === tab)
      && (!kapal || b.kapal === kapal)
      && (!q || `${b.kapal} ${b.k.tag} ${b.k.pekerjaan} ${b.k.pelaksana} ${b.k.catatan || ""}`.toLowerCase().includes(q)));
  }, [semua, tab, kapal, cari]);

  const namaRencanaMasihAda = (b: Baris) =>
    (list.find((x) => x.kapal === b.kapal)?.rencana || []).some((r) => r.id === b.k.rencanaId);

  const kerjakanSahkan = async (b: Baris) => {
    if (!saya.trim()) { await beritahu("Isi dulu nama pemeriksa di kanan atas."); return; }
    if (!(await konfirmasi({
      nada: "sukses", ikon: "✓", judul: "Sahkan laporan pengerjaan?",
      pesan: `${b.k.tag} — ${b.k.pekerjaan} (${ringkas(b.kapal)})`,
      rincian: [
        `Dikerjakan ${tanggalIndo(b.k.tanggal)} oleh ${b.k.pelaksana}`,
        b.k.basis === "jam" && b.k.jam !== undefined ? `Pada ${b.k.jam.toLocaleString("id-ID")} jam jalan` : "Rencana berbasis kalender",
        `Disahkan atas nama: ${saya}`,
      ],
      tombolYa: "Ya, sahkan",
    }))) return;
    setSibuk(b.k.id);
    try { await sahkan(b.kapal, b.k.id, saya); }
    catch (e: any) { await beritahu("Gagal mengesahkan: " + (e?.message ?? e)); }
    finally { setSibuk(""); }
  };

  const kerjakanTolak = async (b: Baris) => {
    if (!alasan.trim()) { await beritahu("Tulis dulu alasan penolakannya — tanpa alasan, kapal tidak tahu apa yang harus dibetulkan."); return; }
    if (!(await konfirmasi({
      nada: "bahaya", ikon: "↩", judul: "Tolak laporan ini?",
      pesan: `${b.k.tag} — ${b.k.pekerjaan} (${ringkas(b.kapal)})`,
      rincian: [
        `Alasan: ${alasan.trim()}`,
        "Capaian rencananya dikembalikan ke angka sebelum laporan ini, sehingga pekerjaan itu kembali muncul sebagai belum dikerjakan.",
      ],
      tegasan: "Catatannya tetap tersimpan sebagai riwayat yang ditolak, tidak dihapus.",
      tombolYa: "Ya, tolak",
    }))) return;
    setSibuk(b.k.id);
    try {
      await tolak(b.kapal, b.k.id, saya, alasan.trim());
      setTolakId(""); setAlasan("");
    } catch (e: any) { await beritahu("Gagal menolak: " + (e?.message ?? e)); }
    finally { setSibuk(""); }
  };

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-5 flex flex-wrap items-center gap-4">
          <Link href="/pms" className="bg-white rounded-2xl p-3 shadow-md shrink-0 text-[#16357f]" title="Kembali ke beranda PMS">
            <Ikon nama="centang" className="w-6 h-6" />
          </Link>
          <div className="flex-1 min-w-[15rem]">
            <Link href="/pms" className="text-xs text-slate-500 hover:text-[#16357f]">‹ PMS</Link>
            <h1 className="text-xl font-extrabold asdp-text-gradient">Riwayat &amp; Pengesahan</h1>
            <p className="text-slate-500 text-sm">
              {hitung.menunggu} menunggu · {hitung.disahkan} disahkan · {semua.length} catatan
            </p>
          </div>
          <label className="text-[11px] font-semibold text-slate-600">
            Pemeriksa
            <input list="stafPeriksa" value={saya} onChange={(e) => gantiSaya(e.target.value)}
              className={`${KELAS_INPUT} block mt-1 w-44`} />
            <datalist id="stafPeriksa">{STAF_TEKNIK.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <button onClick={reload} disabled={loading} className="btn btn-ghost text-xs disabled:opacity-50">
            {loading ? "memuat…" : "⟲ Muat ulang"}
          </button>
        </div>
      </div>

      {galat && <p className="mt-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2">{galat}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {([
          ["menunggu", `Menunggu pengesahan (${hitung.menunggu})`],
          ["disahkan", `Disahkan (${hitung.disahkan})`],
          ["ditolak", `Ditolak (${hitung.ditolak})`],
          ["semua", `Semua (${semua.length})`],
        ] as [StatusKerja | "semua", string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition ${
              tab === id ? "bg-[#16357f] text-white border-[#16357f]"
                         : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
            {label}
          </button>
        ))}
        <div className="relative flex-1 min-w-[12rem]">
          <input value={cari} onChange={(e) => setCari(e.target.value)}
            placeholder="cari pekerjaan / tag / pelaksana…" className={`${KELAS_INPUT} w-full pl-8 py-2`} />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"><Ikon nama="kaca" className="w-4 h-4" /></span>
        </div>
      </div>

      {kapalAda.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button onClick={() => setKapal("")}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
              !kapal ? "bg-[#16357f] text-white border-[#16357f]" : "bg-white text-slate-600 border-slate-300"}`}>
            Semua kapal
          </button>
          {kapalAda.map((k) => (
            <button key={k} onClick={() => setKapal(k === kapal ? "" : k)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                k === kapal ? "bg-[#16357f] text-white border-[#16357f]"
                            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
              {ringkas(k)}
            </button>
          ))}
        </div>
      )}

      {tampil.length === 0 ? (
        <section className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 p-8 text-center">
          <p className="text-3xl">{tab === "menunggu" ? "✓" : "🗂️"}</p>
          <p className="mt-2 font-bold text-slate-800">
            {tab === "menunggu" ? "Tidak ada laporan yang menunggu pengesahan" : "Belum ada catatan pada saringan ini"}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Laporan masuk sendiri begitu ABK menandai pekerjaan selesai di Portal Kapal → Perawatan.
          </p>
        </section>
      ) : (
        <div className="mt-4 space-y-2">
          {tampil.slice(0, 300).map((b) => {
            const yatim = !namaRencanaMasihAda(b);
            return (
              <article key={b.kapal + b.k.id} className="rounded-2xl bg-white ring-1 ring-slate-200 p-4">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <span className="font-mono text-[11px] font-bold text-[#16357f]">{b.k.tag}</span>
                  <span className="text-sm font-bold text-slate-800 flex-1 min-w-[12rem]">{b.k.pekerjaan}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${WARNA_KERJA[b.k.status]}`}>
                    {LABEL_KERJA[b.k.status]}
                  </span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-700">{ringkas(b.kapal)}</span>
                  <span>📅 {tanggalIndo(b.k.tanggal)}</span>
                  {b.k.basis === "jam" && b.k.jam !== undefined && <span>⏱ {b.k.jam.toLocaleString("id-ID")} jam</span>}
                  <span>👤 {b.k.pelaksana}</span>
                  <span className={b.k.sumber === "kapal" ? "text-teal-700 font-semibold" : "text-slate-500"}>
                    {b.k.sumber === "kapal" ? "dilaporkan kapal" : "dicatat kantor"}
                    {b.k.olehAkun ? ` · ${b.k.olehAkun}` : ""}
                  </span>
                </div>

                {(b.k.sukuCadangDipakai || b.k.catatan) && (
                  <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600 space-y-0.5">
                    {b.k.sukuCadangDipakai && <p>🔩 {b.k.sukuCadangDipakai}</p>}
                    {b.k.catatan && <p>📝 {b.k.catatan}</p>}
                  </div>
                )}

                {b.k.status === "ditolak" && b.k.alasanTolak && (
                  <p className="mt-2 text-[11px] text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-xl px-3 py-2">
                    Ditolak {b.k.disahkanOleh ? `oleh ${b.k.disahkanOleh}` : ""}: {b.k.alasanTolak}
                  </p>
                )}
                {b.k.status === "disahkan" && b.k.disahkanOleh && (
                  <p className="mt-1.5 text-[10px] text-emerald-700">✓ disahkan {b.k.disahkanOleh}</p>
                )}
                {yatim && (
                  <p className="mt-1.5 text-[10px] text-slate-400">
                    Rencana kerjanya sudah tidak ada lagi — catatan ini tetap disimpan sebagai riwayat.
                  </p>
                )}

                {b.k.status === "menunggu" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button onClick={() => kerjakanSahkan(b)} disabled={!!sibuk}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                      {sibuk === b.k.id ? "…" : "✓ Sahkan"}
                    </button>
                    {tolakId === b.k.id ? (
                      <>
                        <input autoFocus value={alasan} onChange={(e) => setAlasan(e.target.value)}
                          placeholder="alasan penolakan…" className={`${KELAS_INPUT} flex-1 min-w-[12rem]`} />
                        <button onClick={() => kerjakanTolak(b)} disabled={!!sibuk}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50">
                          Kirim penolakan
                        </button>
                        <button onClick={() => { setTolakId(""); setAlasan(""); }}
                          className="text-[11px] text-slate-500 underline">batal</button>
                      </>
                    ) : (
                      <button onClick={() => { setTolakId(b.k.id); setAlasan(""); }}
                        className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
                        ✗ Tolak
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
          {tampil.length > 300 && (
            <p className="text-[11px] text-slate-400 px-1">300 teratas ditampilkan — persempit dengan saringan kapal atau pencarian.</p>
          )}
        </div>
      )}
    </main>
  );
}
