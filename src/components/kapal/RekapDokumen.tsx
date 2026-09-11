"use client";
/**
 * Rekap Dokumen Kapal — seluruh armada dalam satu layar.
 *
 * Daftar per kapal menjawab "apa saja yang dikirim KMP. LOMPA". Yang tidak
 * terjawab di sana justru pertanyaan yang lebih sering muncul di kantor: golongan
 * mana yang kosong di seluruh armada, kapal mana yang belum pernah mengirim
 * bukti drill, berapa berita acara yang masuk kuartal ini. Untuk menjawabnya
 * dengan tampilan per kapal, orang harus membuka tiga belas baris satu per satu
 * lalu menghitung sendiri — dan hitungan yang dikerjakan tangan setiap minggu
 * pada akhirnya tidak dikerjakan sama sekali.
 *
 * Angkanya dihitung dari data yang sudah ada di halaman; tidak ada permintaan
 * tambahan ke server kecuali saat berkas Excel-nya diminta.
 */
import { useMemo, useState } from "react";
import { JENIS_DOKUMEN, jenisDokumen } from "@/lib/portal/dokumen";
import PenampilDokumen, { ikonBerkas } from "./PenampilDokumen";

export interface BarisDokumen {
  id: string; jenis: string; judul: string; tanggal: string; nomor: string;
  catatan: string; olehAkun: string; dibuatPada: string;
  berkas: { nama: string; ukuran: number; fileId: string }[];
}
export interface KapalDokumen { kapal: string; dokumen: { daftar: BarisDokumen[] } }

const pendek = (k: string) => k.replace(/^KMP\.?\s*/i, "");
const BULAN = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tglIndo = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "—";
  const [y, m, d] = iso.split("-");
  return `${+d} ${BULAN[+m]} ${y}`;
};

/** dari sisi mana dokumen ini masuk — kapal atau kantor */
const asal = (oleh: string) => (/^kantor/i.test(oleh || "") ? "Kantor" : oleh ? "Kapal" : "—");

export default function RekapDokumen({ armada }: { armada: KapalDokumen[] }) {
  const [kapal, setKapal] = useState("");
  const [jenis, setJenis] = useState("");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [cari, setCari] = useState("");
  const [unduh, setUnduh] = useState(false);
  const [lihat, setLihat] = useState<{ d: any; ke: number } | null>(null);

  /* satu daftar datar, karena semua pertanyaan rekap dijawab dari bentuk ini */
  const semua = useMemo(
    () => armada.flatMap((a) => (a.dokumen?.daftar || []).map((d) => ({ ...d, kapal: a.kapal }))),
    [armada]);

  const saring = useMemo(() => {
    const k = cari.trim().toLowerCase();
    return semua
      .filter((d) => !kapal || d.kapal === kapal)
      .filter((d) => !jenis || d.jenis === jenis)
      /* tanggal kosong tidak disembunyikan saat rentangnya dipakai: dokumen
         tanpa tanggal justru yang paling perlu dibetulkan, bukan disingkirkan */
      .filter((d) => !dari || !d.tanggal || d.tanggal >= dari)
      .filter((d) => !sampai || !d.tanggal || d.tanggal <= sampai)
      .filter((d) => !k || `${d.judul} ${d.nomor} ${d.catatan} ${d.kapal}`.toLowerCase().includes(k))
      .sort((a, b) => (b.tanggal || b.dibuatPada || "").localeCompare(a.tanggal || a.dibuatPada || ""));
  }, [semua, kapal, jenis, dari, sampai, cari]);

  const angka = useMemo(() => ({
    dokumen: saring.length,
    berkas: saring.reduce((n, d) => n + d.berkas.length, 0),
    putus: saring.filter((d) => !d.berkas.length).length,
    kapalIsi: new Set(saring.map((d) => d.kapal)).size,
    dariKantor: saring.filter((d) => asal(d.olehAkun) === "Kantor").length,
  }), [saring]);

  /* matriks kapal × golongan, memakai hasil saringan supaya sejalan dengan daftarnya */
  const matriks = useMemo(() => armada.map((a) => {
    const punya = saring.filter((d) => d.kapal === a.kapal);
    const per: Record<string, number> = {};
    JENIS_DOKUMEN.forEach((j) => { per[j.id] = punya.filter((d) => d.jenis === j.id).length; });
    return { kapal: a.kapal, per, total: punya.length };
  }), [armada, saring]);

  const totalKolom = useMemo(() => {
    const per: Record<string, number> = {};
    JENIS_DOKUMEN.forEach((j) => { per[j.id] = matriks.reduce((n, m) => n + m.per[j.id], 0); });
    return per;
  }, [matriks]);

  const unduhExcel = async () => {
    setUnduh(true);
    try {
      const r = await fetch("/api/armada-data/dokumen/rekap-excel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kapal, jenis, dari, sampai, cari }),
      });
      if (!r.ok) throw new Error("Gagal menyusun berkas");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Rekap Dokumen Kapal ${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      window.alert(e?.message || String(e));
    } finally { setUnduh(false); }
  };

  const gaya = "rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-[12px] outline-none focus:border-[#16357f] dark:border-slate-600 dark:bg-slate-900 dark:text-white";

  return (
    <div className="space-y-3">
      {/* ── saringan ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Kapal</span>
          <select value={kapal} onChange={(e) => setKapal(e.target.value)} className={gaya}>
            <option value="">Semua kapal</option>
            {armada.map((a) => <option key={a.kapal} value={a.kapal}>{pendek(a.kapal)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Golongan</span>
          <select value={jenis} onChange={(e) => setJenis(e.target.value)} className={gaya}>
            <option value="">Semua golongan</option>
            {JENIS_DOKUMEN.map((j) => <option key={j.id} value={j.id}>{j.ikon} {j.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Dari tanggal</span>
          <input type="date" value={dari} onChange={(e) => setDari(e.target.value)} className={gaya} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Sampai</span>
          <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} className={gaya} />
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cari</span>
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="judul / nomor / keterangan…" className={gaya} />
        </label>
        {(kapal || jenis || dari || sampai || cari) && (
          <button onClick={() => { setKapal(""); setJenis(""); setDari(""); setSampai(""); setCari(""); }}
            className="rounded-xl border border-slate-300 px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">
            Bersihkan
          </button>
        )}
        <button onClick={unduhExcel} disabled={unduh || !saring.length}
          className="rounded-xl bg-emerald-600 px-3.5 py-2 text-[12px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">
          {unduh ? "Menyusun…" : "⬇️ Unduh Excel"}
        </button>
      </div>

      {/* ── angka ringkas ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {([
          ["Dokumen", angka.dokumen, "text-[#16357f]"],
          ["Berkas di Drive", angka.berkas, "text-emerald-700"],
          ["Unggahan terputus", angka.putus, "text-amber-700"],
          ["Kapal terwakili", `${angka.kapalIsi}/${armada.length}`, "text-slate-700"],
          ["Diunggah kantor", angka.dariKantor, "text-sky-700"],
        ] as const).map(([l, n, w]) => (
          <div key={l} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700">
            <p className={`text-2xl font-black tabular-nums ${Number(String(n).split("/")[0]) ? w : "text-slate-300"}`}>{n}</p>
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">{l}</p>
          </div>
        ))}
      </div>

      {/* ── matriks kapal × golongan ──────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3.5 py-2.5 dark:border-slate-800">
          <h3 className="text-[12px] font-black uppercase tracking-wide text-[#16357f]">Sebaran golongan per kapal</h3>
          <span className="text-[10.5px] text-slate-400">kotak kosong = golongan itu belum pernah diarsipkan</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-900">Kapal</th>
                {JENIS_DOKUMEN.map((j) => (
                  <th key={j.id} title={j.label}
                    className="px-1.5 py-2 text-center text-[15px] font-normal">{j.ikon}</th>
                ))}
                <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase tracking-wide text-slate-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {matriks.map((m, i) => (
                <tr key={m.kapal} className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${i % 2 ? "bg-slate-50/60 dark:bg-slate-800/30" : ""}`}>
                  <td className={`sticky left-0 z-10 px-3 py-1.5 text-[12.5px] font-bold text-slate-800 dark:text-slate-100 ${i % 2 ? "bg-slate-50 dark:bg-slate-800/60" : "bg-white dark:bg-slate-900"}`}>
                    {pendek(m.kapal)}
                  </td>
                  {JENIS_DOKUMEN.map((j) => (
                    <td key={j.id} className="px-1.5 py-1.5 text-center tabular-nums">
                      {m.per[j.id]
                        ? <span className="inline-block min-w-[1.4rem] rounded bg-emerald-100 px-1 py-0.5 font-bold text-emerald-800">{m.per[j.id]}</span>
                        : <span className="text-slate-300">·</span>}
                    </td>
                  ))}
                  <td className={`px-3 py-1.5 text-right font-black tabular-nums ${m.total ? "text-slate-800 dark:text-slate-100" : "text-rose-400"}`}>
                    {m.total || "0"}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                <td className="sticky left-0 z-10 bg-slate-100 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">Armada</td>
                {JENIS_DOKUMEN.map((j) => (
                  <td key={j.id} className="px-1.5 py-2 text-center font-black tabular-nums text-slate-700 dark:text-slate-200">
                    {totalKolom[j.id] || <span className="text-slate-400">0</span>}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-black tabular-nums text-[#16357f] dark:text-sky-300">{angka.dokumen}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 px-3.5 py-2 dark:border-slate-800">
          {JENIS_DOKUMEN.map((j) => (
            <span key={j.id} className="text-[10.5px] text-slate-500">{j.ikon} {j.label}</span>
          ))}
        </div>
      </div>

      {/* ── daftar datar ──────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <div className="border-b border-slate-200 px-3.5 py-2.5 dark:border-slate-800">
          <h3 className="text-[12px] font-black uppercase tracking-wide text-[#16357f]">
            Daftar dokumen · {saring.length} baris
          </h3>
        </div>
        {!saring.length ? (
          <p className="px-4 py-10 text-center text-[13px] text-slate-500">Tidak ada dokumen yang cocok dengan saringan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                  {["Tanggal", "Kapal", "Golongan", "Judul", "Nomor", "Berkas", "Asal"].map((h) => (
                    <th key={h} className="px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {saring.map((d, i) => {
                  const j = jenisDokumen(d.jenis);
                  return (
                    <tr key={d.id} className={`border-b border-slate-100 align-top last:border-0 dark:border-slate-800 ${i % 2 ? "bg-slate-50/60 dark:bg-slate-800/30" : ""}`}>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">{tglIndo(d.tanggal)}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-800 dark:text-slate-100">{pendek(d.kapal)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold ring-1 ${j?.warna || "bg-slate-100 text-slate-700 ring-slate-200"}`}>
                          {j?.ikon} {j?.label || d.jenis}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-semibold text-slate-900 dark:text-white">{d.judul}</span>
                        {d.catatan && <span className="mt-0.5 block text-[11px] text-slate-500">{d.catatan}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">{d.nomor || "—"}</td>
                      <td className="px-3 py-2">
                        {!d.berkas.length ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">unggahan putus</span>
                        ) : (
                          <ul className="flex flex-wrap gap-1">
                            {d.berkas.map((f, n) => (
                              <li key={f.fileId}>
                                <button onClick={() => setLihat({ d, ke: n })} title={f.nama}
                                  className="inline-flex max-w-[13rem] items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-[#16357f] transition hover:bg-slate-200 dark:bg-slate-800 dark:text-sky-300">
                                  <span>{ikonBerkas(f.nama)}</span>
                                  <span className="truncate">{f.nama.replace(/\.[a-z0-9]+$/i, "")}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-[11px] text-slate-500">{asal(d.olehAkun)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {lihat && (
        <PenampilDokumen
          judul={lihat.d.judul}
          kapal={lihat.d.kapal}
          golongan={jenisDokumen(lihat.d.jenis)?.label || lihat.d.jenis}
          berkas={lihat.d.berkas}
          mulai={lihat.ke}
          onTutup={() => setLihat(null)}
        />
      )}
    </div>
  );
}
