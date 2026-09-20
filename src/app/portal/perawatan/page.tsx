"use client";
/**
 * Perawatan Berencana — sisi kapal.
 *
 * Satu pertanyaan saja yang dijawab layar ini: apa yang harus dikerjakan
 * sekarang, dan bagaimana menandainya sudah selesai. Karena itu isinya bukan
 * tabel rencana lengkap melainkan daftar yang sudah diurutkan menurut
 * kemendesakan, dengan satu tombol besar di tiap barisnya.
 *
 * Pekerjaan bagian sendiri ditaruh lebih dulu — akun Mesin melihat kamar mesin,
 * akun Deck melihat geladak — tetapi tidak dikunci. Satu kapal kerap kekurangan
 * orang, dan melarang Mualim mencatat pemeriksaan pompa got berarti pemeriksaan
 * itu tidak tercatat sama sekali.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { RangkaPortal, useAku } from "@/components/portal/Rangka";
import { LABEL_STATUS, Peralatan, RencanaKerja, WARNA_STATUS, hitungJatuh } from "@/lib/pms/types";
import { LABEL_KERJA, Pengerjaan, WARNA_KERJA, bagianRencana } from "@/lib/pms/kerja";

const hariIni = () => new Date().toISOString().slice(0, 10);
const KELAS = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#16357f] dark:border-slate-600 dark:bg-slate-800 dark:text-white";

const tanggalIndo = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s || "")
    ? new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
    : s || "—";

interface Isi {
  peralatan: Peralatan[];
  rencana: RencanaKerja[];
  riwayat: Pengerjaan[];
  jam: Record<string, number>;
}

const KOSONG: Isi = { peralatan: [], rencana: [], riwayat: [], jam: {} };

export default function PerawatanKapal() {
  const { aku } = useAku();
  const [isi, setIsi] = useState<Isi>(KOSONG);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");
  const [buka, setBuka] = useState<RencanaKerja | null>(null);
  const [borang, setBorang] = useState({ tanggal: hariIni(), jam: "", pelaksana: "", sukuCadangDipakai: "", catatan: "" });
  const [sibuk, setSibuk] = useState(false);
  const [semua, setSemua] = useState(false);

  const ambil = useCallback(async () => {
    try {
      const r = await fetch("/api/portal/perawatan", { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal memuat");
      setIsi({ peralatan: d.peralatan || [], rencana: d.rencana || [], riwayat: d.riwayat || [], jam: d.jam || {} });
      setGalat("");
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);

  useEffect(() => { void ambil(); }, [ambil]);

  const petaAlat = useMemo(() => new Map(isi.peralatan.map((p) => [p.tag, p])), [isi.peralatan]);
  const jamUntuk = useCallback((tag: string) => {
    const a = petaAlat.get(tag);
    return a?.sumberJam ? isi.jam[a.sumberJam] : undefined;
  }, [petaAlat, isi.jam]);

  const URUT = { terlambat: 0, segera: 1, belum: 2, aman: 3 } as const;

  const sekapal = useMemo(() =>
    isi.rencana
      .map((r) => ({ r, alat: petaAlat.get(r.tag), jatuh: hitungJatuh(r, jamUntuk(r.tag)), bagian: bagianRencana(r.penanggung) }))
      .sort((a, b) => URUT[a.jatuh.status] - URUT[b.jatuh.status]
        || (a.jatuh.sisa ?? 1e9) - (b.jatuh.sisa ?? 1e9)
        || a.r.tag.localeCompare(b.r.tag)),
  [isi.rencana, petaAlat, jamUntuk]);

  const bagianku = aku?.bagian;
  const baris = useMemo(
    () => sekapal.filter((b) => semua || !bagianku || b.bagian === bagianku || b.bagian === "lain"),
    [sekapal, semua, bagianku]);

  /*
   * Angka di atas menghitung SELURUH kapal, bukan hanya bagian yang sedang
   * ditampilkan. Seorang Masinis yang membaca "Terlambat 0" padahal kemudi
   * daruratnya sudah lewat dua minggu akan menyimpulkan kapalnya bersih —
   * padahal yang bersih hanya daftar yang sedang ia lihat.
   */
  const telat = sekapal.filter((b) => b.jatuh.status === "terlambat").length;
  const segera = sekapal.filter((b) => b.jatuh.status === "segera").length;
  const tersembunyi = sekapal.length - baris.length;
  const mendesakTersembunyi = sekapal.filter((b) =>
    !baris.includes(b) && (b.jatuh.status === "terlambat" || b.jatuh.status === "segera")).length;

  const bukaBorang = (r: RencanaKerja) => {
    const j = jamUntuk(r.tag);
    setBuka(r);
    setBorang({
      tanggal: hariIni(),
      jam: r.basis === "jam" && j !== undefined ? String(j) : "",
      // jabatan, bukan nama akun: "portlink8-mesin" tidak menjawab siapa yang
      // mengerjakan, dan nama akunnya tetap tercatat sendiri di sisi server
      pelaksana: r.penanggung,
      sukuCadangDipakai: r.sukuCadang || "",
      catatan: "",
    });
  };

  const kirim = async () => {
    if (!buka) return;
    setSibuk(true); setGalat("");
    try {
      const r = await fetch("/api/portal/perawatan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rencanaId: buka.id, ...borang, jam: borang.jam }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal mengirim");
      setBuka(null);
      setKabar("Laporan terkirim ✓ menunggu pengesahan kantor");
      setTimeout(() => setKabar(""), 5000);
      await ambil();
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setSibuk(false); }
  };

  return (
    <RangkaPortal aku={aku}>
      <div className="mb-3 flex items-center gap-2">
        <h1 className="flex-1 text-[15px] font-black text-slate-900 dark:text-white">Perawatan Berencana</h1>
        <button onClick={() => { setMuat(true); void ambil(); }}
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:border-slate-600 dark:text-slate-300">
          ⟲ Segarkan
        </button>
      </div>

      {kabar && <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800 ring-1 ring-emerald-200">{kabar}</p>}
      {galat && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-800 ring-1 ring-rose-200">{galat}</p>}

      {muat ? (
        <p className="py-10 text-center text-sm text-slate-400">Memuat…</p>
      ) : isi.rencana.length === 0 ? (
        <section className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <p className="text-3xl">🗓️</p>
          <p className="mt-2 text-sm font-bold text-slate-800 dark:text-white">Kantor belum menyusun rencana perawatan kapal ini</p>
          <p className="mt-1 text-[12px] text-slate-500">
            Begitu daftarnya disusun, pekerjaan yang jatuh tempo muncul di sini dan bisa ditandai selesai langsung dari ponsel.
          </p>
        </section>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className={`rounded-2xl px-3 py-2.5 ring-1 ${telat ? "bg-rose-50 ring-rose-200" : "bg-white ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"}`}>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Terlambat</p>
              <p className={`text-2xl font-extrabold ${telat ? "text-rose-700" : "text-slate-800 dark:text-white"}`}>{telat}</p>
            </div>
            <div className={`rounded-2xl px-3 py-2.5 ring-1 ${segera ? "bg-amber-50 ring-amber-200" : "bg-white ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"}`}>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Segera</p>
              <p className={`text-2xl font-extrabold ${segera ? "text-amber-700" : "text-slate-800 dark:text-white"}`}>{segera}</p>
            </div>
          </div>

          <p className="mb-2 text-[10px] text-slate-400">Dua angka di atas menghitung seluruh kapal, bukan hanya bagian Anda.</p>

          <label className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={semua} onChange={(e) => setSemua(e.target.checked)} />
            Tampilkan juga pekerjaan bagian lain{tersembunyi > 0 ? ` (${tersembunyi})` : ""}
          </label>
          {mendesakTersembunyi > 0 && (
            <button onClick={() => setSemua(true)}
              className="mb-3 w-full rounded-xl bg-amber-50 px-3 py-2 text-left text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
              {mendesakTersembunyi} pekerjaan mendesak ada di bagian lain — ketuk untuk menampilkannya.
            </button>
          )}

          <div className="space-y-2">
            {baris.map(({ r, alat, jatuh }) => (
              <article key={r.id} className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                <div className="flex items-start gap-2">
                  <span className="font-mono text-[11px] font-bold text-[#16357f] dark:text-sky-300">{r.tag}</span>
                  <span className="flex-1 text-[13px] font-bold leading-snug text-slate-900 dark:text-white">{r.pekerjaan}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${WARNA_STATUS[jatuh.status]}`}>
                    {LABEL_STATUS[jatuh.status]}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {alat?.nama || "peralatan tak dikenal"} · {r.penanggung} · {jatuh.teks}
                </p>
                {r.langkah && <p className="mt-1 text-[11px] text-slate-500">📋 {r.langkah}</p>}
                {r.sukuCadang && <p className="mt-0.5 text-[11px] text-slate-500">🔩 {r.sukuCadang}</p>}
                <button onClick={() => bukaBorang(r)}
                  className="mt-2.5 w-full rounded-xl bg-emerald-600 py-2.5 text-[13px] font-bold text-white active:bg-emerald-700">
                  ✓ Tandai sudah dikerjakan
                </button>
              </article>
            ))}
            {baris.length === 0 && (
              <p className="rounded-2xl bg-white p-6 text-center text-[12px] text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                Tidak ada pekerjaan untuk bagian {aku?.bagian === "mesin" ? "Mesin" : "Deck"}. Centang di atas untuk melihat semuanya.
              </p>
            )}
          </div>
        </>
      )}

      {isi.riwayat.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 px-1 text-[13px] font-black text-slate-800 dark:text-slate-100">Yang sudah dilaporkan</h2>
          <div className="space-y-1.5">
            {isi.riwayat.slice(0, 15).map((k) => (
              <div key={k.id} className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                <div className="flex items-start gap-2">
                  <span className="font-mono text-[10px] font-bold text-slate-500">{k.tag}</span>
                  <span className="flex-1 text-[12px] font-semibold text-slate-800 dark:text-slate-100">{k.pekerjaan}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1 ${WARNA_KERJA[k.status]}`}>
                    {LABEL_KERJA[k.status]}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {tanggalIndo(k.tanggal)}{k.jam !== undefined ? ` · ${k.jam.toLocaleString("id-ID")} jam` : ""} · {k.pelaksana}
                </p>
                {k.status === "ditolak" && k.alasanTolak && (
                  <p className="mt-1 text-[10px] text-rose-700">Ditolak kantor: {k.alasanTolak}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* borang laporan — layar penuh supaya papan tik ponsel tidak menutupi isian */}
      {buka && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/40" onClick={() => !sibuk && setBuka(null)}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
            <p className="text-[11px] font-mono font-bold text-[#16357f] dark:text-sky-300">{buka.tag}</p>
            <h2 className="mb-3 text-[15px] font-black leading-snug text-slate-900 dark:text-white">{buka.pekerjaan}</h2>

            <div className="space-y-3">
              <label className="block text-[11px] font-bold uppercase text-slate-500">
                Tanggal dikerjakan
                <input type="date" value={borang.tanggal} max={hariIni()}
                  onChange={(e) => setBorang({ ...borang, tanggal: e.target.value })} className={`${KELAS} mt-1`} />
              </label>

              {buka.basis === "jam" && (
                <label className="block text-[11px] font-bold uppercase text-slate-500">
                  Jam jalan mesin saat dikerjakan
                  <input type="number" inputMode="numeric" min={0} value={borang.jam}
                    onChange={(e) => setBorang({ ...borang, jam: e.target.value })} className={`${KELAS} mt-1`} />
                  <span className="mt-1 block text-[10px] font-normal normal-case text-slate-400">
                    {jamUntuk(buka.tag) !== undefined
                      ? "terisi dari Stok Filter — betulkan bila jam meternya sudah berbeda"
                      : "belum ada di Stok Filter — isi dari jam meter di kamar mesin"}
                  </span>
                </label>
              )}

              <label className="block text-[11px] font-bold uppercase text-slate-500">
                Dikerjakan oleh
                <input value={borang.pelaksana} onChange={(e) => setBorang({ ...borang, pelaksana: e.target.value })}
                  className={`${KELAS} mt-1`} />
              </label>

              <label className="block text-[11px] font-bold uppercase text-slate-500">
                Suku cadang yang terpakai
                <input value={borang.sukuCadangDipakai}
                  onChange={(e) => setBorang({ ...borang, sukuCadangDipakai: e.target.value })} className={`${KELAS} mt-1`} />
              </label>

              <label className="block text-[11px] font-bold uppercase text-slate-500">
                Catatan / temuan
                <textarea rows={3} value={borang.catatan} onChange={(e) => setBorang({ ...borang, catatan: e.target.value })}
                  placeholder="mis. gasket mulai rembes, perlu diganti docking nanti" className={`${KELAS} mt-1`} />
                <span className="mt-1 block text-[10px] font-normal normal-case text-slate-400">
                  Temuan yang ditulis di sini terbaca kantor sebelum jadi kerusakan.
                </span>
              </label>
            </div>

            <p className="mt-3 text-[10px] text-slate-400">
              Laporan ini masuk sebagai <b>menunggu pengesahan</b>. Kantor yang mengesahkannya; jatuh tempo
              berikutnya sudah dihitung sejak sekarang.
            </p>

            <div className="mt-4 flex gap-2">
              <button onClick={kirim} disabled={sibuk}
                className="flex-1 rounded-xl bg-[#16357f] py-3 text-sm font-bold text-white disabled:opacity-50">
                {sibuk ? "Mengirim…" : "Kirim laporan"}
              </button>
              <button onClick={() => setBuka(null)} disabled={sibuk}
                className="rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </RangkaPortal>
  );
}
