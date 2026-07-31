"use client";
/**
 * Unggah borang permintaan kapal (PDF pindaian / foto) lalu ubah jadi baris
 * Repair List atau baris RAB Penunjang.
 *
 * Yang dibaca model hanya isi kertasnya. Penggolongan (Docking Code, bagian,
 * klasifikasi GS/OM/CM) dikerjakan aturan di borang.ts, dan hasilnya
 * ditampilkan dulu untuk diperiksa — tidak ada yang masuk diam-diam.
 */
import { useState } from "react";
import { BarisBorang, HasilBorang, golongkan } from "@/lib/docking/rencana/borang";
import { bacaBorang, jalurBaca, OllamaBelumSiap, PilihModel } from "@/lib/docking/rencana/bacaBorang";
import { ItemRl, ItemPenunjang, rlBaru, penunjangBaru } from "@/lib/docking/rencana/types";

type Pilihan = Record<number, boolean>;

export default function ImporBorang({ onRl, onPenunjang, onTutup }: {
  onRl: (items: ItemRl[]) => void;
  onPenunjang: (items: ItemPenunjang[]) => void;
  onTutup: () => void;
}) {
  const [hasil, setHasil] = useState<HasilBorang | null>(null);
  const [pilih, setPilih] = useState<Pilihan>({});
  const [sibuk, setSibuk] = useState(false);
  const [maju, setMaju] = useState("");
  const [galat, setGalat] = useState("");
  const [namaBerkas, setNamaBerkas] = useState("");
  const [model, setModel] = useState<PilihModel>("teliti");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [halaman, setHalaman] = useState<{ h: number; t: number } | null>(null);
  const [kecil, setKecil] = useState(false);

  const muat = async (files: FileList | null) => {
    if (!files?.length) return;
    setSibuk(true); setGalat(""); setHasil(null);
    try {
      const kumpul: HasilBorang[] = [];
      for (const f of Array.from(files)) {
        setNamaBerkas(f.name);
        kumpul.push(await bacaBorang(f,
          (k) => { setHalaman({ h: k.halaman, t: k.total }); setMaju(`${f.name} — halaman ${k.halaman}/${k.total}`); },
          { model, dari: +dari || undefined, sampai: +sampai || undefined }));
      }
      const gab: HasilBorang = {
        jenis: kumpul.find((k) => k.jenis)?.jenis || "",
        kapal: kumpul.find((k) => k.kapal)?.kapal || "",
        noSurat: kumpul.find((k) => k.noSurat)?.noSurat || "",
        tanggal: kumpul.find((k) => k.tanggal)?.tanggal || "",
        baris: kumpul.flatMap((k) => k.baris),
      };
      setHasil(gab);
      setPilih(Object.fromEntries(gab.baris.map((_, i) => [i, true])));
    } catch (e: any) {
      setGalat(e instanceof OllamaBelumSiap
        ? `${e.message}\n\nPemindaian memakai AI lokal (Ollama) di laptop ini. Lihat docs/OLLAMA.md.`
        : (e?.message || String(e)));
    } finally { setSibuk(false); setMaju(""); setHalaman(null); setKecil(false); }
  };

  const terpilih = (hasil?.baris || []).filter((_, i) => pilih[i]);

  // Menutup jendela membongkar komponennya — pembacaan yang sedang jalan ikut
  // mati di tengah. Selama sibuk, "tutup" diarahkan jadi "kecilkan".
  const tutupAman = () => { if (sibuk) setKecil(true); else onTutup(); };
  const persen = halaman && halaman.t ? Math.round((halaman.h / halaman.t) * 100) : 0;

  if (kecil) {
    return (
      <div className="fixed bottom-4 right-4 z-[60] w-80 bg-white rounded-2xl elev-lg ring-line overflow-hidden">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg asdp-gradient text-white grid place-items-center text-xs shrink-0">📄</span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-bold text-slate-800 truncate">
                {sibuk ? "Membaca permintaan kapal…" : "Bacaan selesai — tinggal diperiksa"}
              </span>
              <span className="block text-[10px] text-slate-500 truncate" title={maju || namaBerkas}>{maju || namaBerkas}</span>
            </span>
            <button onClick={() => setKecil(false)} className="text-[11px] font-semibold text-[#1ca3dd] hover:underline shrink-0">Buka</button>
          </div>
          {halaman && (
            <>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                <div className="h-full asdp-gradient transition-all" style={{ width: `${persen}%` }} />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 tabular-nums">halaman {halaman.h} dari {halaman.t} · {persen}%</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const keRl = () => {
    onRl(terpilih.map((b) => {
      const g = golongkan(b);
      return rlBaru({
        jenis: "dok", kode: g.kode, bagian: g.romawi, grup: g.bagian,
        uraian: b.uraian, satuan: b.unit || "Ls", vol: b.qty || 1, harga: 0,
        sumber: "manual", ket: [b.ket, b.halaman ? `hal. ${b.halaman}` : ""].filter(Boolean).join(" · "),
      });
    }));
    onTutup();
  };

  const kePenunjang = () => {
    onPenunjang(terpilih.map((b) => penunjangBaru({
      kelompok: /cat|thinner|primer|epoxy|alkyd|anode/i.test(b.uraian + b.bagian) ? "roro" : "akomodasi",
      grup: b.bagian || "Penunjang Docking Lainnya",
      uraian: [b.merk, b.uraian].filter(Boolean).join(" "),
      satuan: b.unit || "Ls", vol: b.qty || 1, harga: 0, sumber: "manual",
    })));
    onTutup();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-[2px] p-4 overflow-y-auto" onClick={tutupAman}>
      <div className="max-w-4xl mx-auto my-6 bg-white rounded-2xl elev-lg ring-line overflow-hidden flex flex-col max-h-[88vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <span className="h-9 w-9 rounded-xl asdp-gradient text-white grid place-items-center text-sm shrink-0">📄</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 leading-tight">Baca permintaan dari kapal</h3>
            <p className="text-xs text-slate-500">
              Daftar Pekerjaan Docking (TF-102.01.01) atau Permintaan Pengadaan (HP-103.00.01) — Word, PDF pindaian, atau foto
            </p>
          </div>
          {sibuk && (
            <button onClick={() => setKecil(true)} className="btn btn-ghost text-xs shrink-0"
              title="Kecilkan — pembacaan tetap jalan, kemajuannya tampil di gelembung kanan bawah">— Kecilkan</button>
          )}
          <button onClick={tutupAman} className="text-slate-400 hover:text-slate-700 text-lg px-1"
            title={sibuk ? "Kecilkan (pembacaan masih jalan)" : "Tutup"}>✕</button>
        </div>

        <div className="p-5 space-y-3 flex-1 overflow-y-auto">
          {!hasil && !sibuk && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-600">Cara baca</span>
                <select value={model} onChange={(e) => setModel(e.target.value as PilihModel)}
                  className="mt-1 block rounded-lg border border-slate-300 px-2 py-2 text-sm bg-white">
                  <option value="teliti">Teliti — ± 9 mnt/halaman, paling tepat</option>
                  <option value="cepat">Cepat — ± 20 dtk/halaman</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-600">Halaman (kosong = semua)</span>
                <span className="mt-1 flex items-center gap-1">
                  <input value={dari} onChange={(e) => setDari(e.target.value)} placeholder="dari"
                    className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-sm tabular-nums" />
                  <span className="text-slate-400 text-xs">-</span>
                  <input value={sampai} onChange={(e) => setSampai(e.target.value)} placeholder="s.d."
                    className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-sm tabular-nums" />
                </span>
              </label>
              <p className="text-[11px] text-slate-500 flex-1 min-w-[13rem] pb-1.5">
                Pilihan ini hanya berlaku untuk PDF pindaian &amp; foto — berkas <b>Word</b> dibaca
                langsung tanpa AI. <b>Teliti</b> untuk Permintaan Pengadaan (kolomnya banyak),
                <b>Cepat</b> memadai untuk Daftar Pekerjaan Docking. Berkas RL sering berlampiran foto —
                batasi halamannya.
              </p>
            </div>
          )}

          {!hasil && (
            <label className={`block rounded-xl border-2 border-dashed p-8 text-center cursor-pointer ${sibuk ? "border-slate-200 bg-slate-50" : "border-slate-300 hover:border-[#1ca3dd] hover:bg-sky-50/40"}`}>
              <input type="file" accept="application/pdf,image/*,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple className="hidden" disabled={sibuk}
                onChange={(e) => muat(e.target.files)} />
              {sibuk ? (
                <>
                  <p className="text-sm font-semibold text-slate-700">Sedang dibaca…</p>
                  <p className="text-xs text-slate-500 mt-1">{maju || namaBerkas}</p>
                  {halaman && (
                    <span className="block max-w-xs mx-auto mt-3">
                      <span className="block h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <span className="block h-full asdp-gradient transition-all" style={{ width: `${persen}%` }} />
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-1 tabular-nums">{persen}%</span>
                    </span>
                  )}
                  <p className="text-[11px] text-slate-400 mt-2">
                    Dibaca AI lokal di laptop ini, satu halaman sekali jalan — boleh <b>dikecilkan</b>, bacaan tetap jalan.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-700">Pilih berkas Word / PDF / foto</p>
                  <p className="text-xs text-slate-500 mt-1">boleh beberapa sekaligus — RL Deck &amp; RL Mesin, permintaan cat, alat kerja</p>
                  <p className="text-[11px] text-emerald-700 mt-1">Word (.docx) dibaca seketika tanpa AI — paling tepat bila kapal punya berkasnya</p>
                  <p className="text-[11px] text-slate-400 mt-2">Isi dokumen tidak keluar dari laptop ini.</p>
                </>
              )}
            </label>
          )}

          {galat && (
            <p className="text-xs text-rose-800 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2 whitespace-pre-line">{galat}</p>
          )}

          {hasil && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-semibold text-slate-700">
                  {hasil.jenis === "rl" ? "Daftar Pekerjaan Docking (RL)"
                    : hasil.jenis === "permintaan" ? "Permintaan Pengadaan Barang/Jasa"
                    : "Jenis borang tak dikenali"}
                </span>
                {hasil.kapal && <span className="text-slate-500">{hasil.kapal}</span>}
                {hasil.noSurat && <span className="text-slate-400">No. {hasil.noSurat}</span>}
                {hasil.tanggal && <span className="text-slate-400">{hasil.tanggal}</span>}
                <span className="text-slate-500">· {hasil.baris.length} baris terbaca</span>
                {jalurBaca === "peramban" && <span className="text-slate-400">· dibaca lewat peramban langsung ke Ollama</span>}
                <span className="flex-1" />
                <button onClick={() => setPilih(Object.fromEntries(hasil.baris.map((_, i) => [i, true])))} className="btn btn-ghost text-[11px] py-1">Pilih semua</button>
                <button onClick={() => setPilih({})} className="btn btn-ghost text-[11px] py-1">Kosongkan</button>
                <button onClick={() => { setHasil(null); setGalat(""); }} className="btn btn-ghost text-[11px] py-1">Ulangi</button>
              </div>

              {!hasil.baris.length && (
                <p className="text-xs text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2">
                  Tak ada baris yang terbaca. Pindaian mungkin terlalu miring atau buram — coba foto ulang lebih tegak, atau naikkan mutu pindaian.
                </p>
              )}

              <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="px-2 py-1.5 w-8" />
                      <th className="px-2 py-1.5 text-left w-40">Bagian &amp; Docking Code</th>
                      <th className="px-2 py-1.5 text-left">Uraian</th>
                      <th className="px-2 py-1.5 text-right w-16">Vol</th>
                      <th className="px-2 py-1.5 text-left w-16">Sat.</th>
                      <th className="px-2 py-1.5 text-left w-12">Hal.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hasil.baris.map((b: BarisBorang, i: number) => {
                      const g = golongkan(b);
                      return (
                        <tr key={i} className={`border-b border-slate-100 last:border-0 align-top ${pilih[i] ? "" : "opacity-40"}`}>
                          <td className="px-2 py-1.5">
                            <input type="checkbox" checked={!!pilih[i]} onChange={(e) => setPilih((p) => ({ ...p, [i]: e.target.checked }))} />
                          </td>
                          <td className="px-2 py-1.5">
                            <span className="block text-[11px] text-slate-700">{g.bagian}</span>
                            <span className="block text-[10px] text-slate-400">
                              {g.kode || "kode belum ditetapkan"} · {g.klasifikasi}
                              {b.bagian && b.bagian !== g.bagian ? ` · kertas: ${b.bagian}` : ""}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-[12px] text-slate-800 whitespace-pre-line leading-snug">
                            {b.merk ? <span className="text-slate-500">{b.merk} · </span> : null}{b.uraian}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{b.qty || ""}</td>
                          <td className="px-2 py-1.5 text-slate-600">{b.unit}</td>
                          <td className="px-2 py-1.5 text-[10px] text-slate-400">{b.halaman || ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {hasil && (
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">{terpilih.length} baris dipilih</span>
            <span className="flex-1" />
            <button onClick={tutupAman} className="btn btn-ghost text-xs">Batal</button>
            <button disabled={!terpilih.length} onClick={kePenunjang} className="btn btn-ghost text-xs disabled:opacity-40">
              → RAB Penunjang
            </button>
            <button disabled={!terpilih.length} onClick={keRl} className="btn btn-primary text-xs px-4 disabled:opacity-40">
              → Repair List
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
