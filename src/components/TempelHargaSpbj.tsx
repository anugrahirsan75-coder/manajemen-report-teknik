"use client";
/**
 * Tempel harga final SPBJ/PO dari Excel ke Tabel Item SPBJ.
 *
 * Kembarannya, TempelTabelSppbj, MENAMBAH baris. Yang ini tidak boleh: isi
 * Tabel Item SPBJ diturunkan dari Item SPPB/J di atasnya, jadi yang dipindahkan
 * dari tempelan hanya kolom harganya. Karena itu layarnya pun berbeda — yang
 * ditunjukkan bukan "baris apa saja yang akan masuk", melainkan "harga dari
 * baris mana yang akan menimpa item mana".
 *
 * Tiap pasangan bisa dibetulkan sendiri lewat daftar pilih di kolom terakhir.
 * Ini bukan hiasan: perjodohan otomatis paling sering meleset justru pada
 * lembar yang nama barangnya disingkat, dan tanpa jalan membetulkan, satu
 * pasangan yang salah memaksa seluruh tempelan dibatalkan.
 *
 * Bentuknya mengikuti TempelTabelSppbj: kotak melayang di halaman yang sama,
 * dipasang lewat portal ke <body> karena "position: fixed" berhenti mengacu ke
 * layar begitu salah satu induknya punya transform, filter atau backdrop-filter
 * — dan halaman isi SPPBJ penuh dengan ketiganya.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PERAN_LABEL, Peran, pecah, tebakKolom, uraikan } from "@/lib/sppbj/tempelTabel";
import {
  AMBANG, BarisSumber, ItemTujuan, Jodoh, ModeCocok, cocokkan, ringkas,
} from "@/lib/sppbj/cocokHarga";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

export default function TempelHargaSpbj({ open, onClose, items, onTerapkan }: {
  open: boolean;
  onClose: () => void;
  items: ItemTujuan[];
  onTerapkan: (ubah: { id: string; hargaSpbj: number }[]) => void;
}) {
  const [teks, setTeks] = useState("");
  const [kolom, setKolom] = useState<Peran[]>([]);
  const [mode, setMode] = useState<ModeCocok>("nama");
  /** pasangan yang dibetulkan tangan: id item -> nomor baris tempelan, 0 = lepas */
  const [paksa, setPaksa] = useState<Record<string, number>>({});
  const [lewati, setLewati] = useState<Record<string, boolean>>({});
  const [lihatMentah, setLihatMentah] = useState(false);

  const [terpasang, setTerpasang] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setTerpasang(true), []);

  useEffect(() => {
    if (!open) { setTeks(""); setKolom([]); setPaksa({}); setLewati({}); setLihatMentah(false); }
    else setTimeout(() => areaRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!teks.trim()) { setKolom([]); return; }
    setKolom(tebakKolom(pecah(teks)));
    setPaksa({});
    setLewati({});
  }, [teks]);

  useEffect(() => { setPaksa({}); }, [mode]);

  useEffect(() => {
    if (!open) return;
    const tekan = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", tekan);
    const simpan = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tekan);
      document.body.style.overflow = simpan;
    };
  }, [open, onClose]);

  const sel = useMemo(() => pecah(teks), [teks]);

  const hasil = useMemo(
    () => (teks.trim() ? uraikan(teks, kolom.length ? kolom : undefined) : null),
    [teks, kolom]);

  const sumber: BarisSumber[] = useMemo(
    () => (hasil?.baris || []).filter((b) => b.jenis === "item").map((b) => ({
      sumber: b.sumber, kapal: b.kapal, jumlah: b.jumlah,
      satuan: b.satuan, nama: b.nama, harga: b.harga,
    })), [hasil]);

  const otomatis = useMemo(() => cocokkan(items, sumber, mode), [items, sumber, mode]);

  /** hasil akhir = perjodohan otomatis, ditimpa pembetulan tangan */
  const jodoh: Jodoh[] = useMemo(() => otomatis.map((j) => {
    const p = paksa[j.item.id];
    if (p === undefined) return j;
    if (p === 0) return { ...j, baris: null, skor: 0, catatan: "dilepas manual" };
    const b = sumber.find((s) => s.sumber === p) || null;
    return { ...j, baris: b, skor: b ? 1 : 0, catatan: b ? "dipasangkan manual" : undefined };
  }), [otomatis, paksa, sumber]);

  const terpakai = useMemo(
    () => jodoh.filter((j) => j.baris && !lewati[j.item.id]),
    [jodoh, lewati]);

  const ring = useMemo(() => ringkas(jodoh), [jodoh]);
  const totalBaru = terpakai.reduce((s, j) => s + (j.baris?.harga || 0) * j.item.jumlah, 0);
  const totalLama = items.reduce((s, it) => s + (it.hargaSpbj && it.hargaSpbj > 0 ? it.hargaSpbj : it.harga) * it.jumlah, 0);

  if (!open || !terpasang) return null;

  const gantiKolom = (i: number, p: Peran) => {
    setKolom((lama) => {
      const baru = [...lama];
      if (p !== "abaikan") baru.forEach((x, j) => { if (x === p && j !== i) baru[j] = "abaikan"; });
      baru[i] = p;
      return baru;
    });
  };

  const terapkan = () => {
    onTerapkan(terpakai.map((j) => ({ id: j.item.id, hargaSpbj: j.baris?.harga || 0 })));
    onClose();
  };

  const kosong = !teks.trim();
  const lebar = hasil?.kolom.length || 0;

  const isi = (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-md p-5 sm:p-10 grid place-items-center"
      onMouseDown={onClose}>
      <div
        className="bg-white rounded-3xl shadow-[0_32px_80px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/10 w-full max-w-[92rem] h-[90vh] flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}>

        {/* ── kepala ── */}
        <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-b-2 border-slate-200">
          <span className="text-2xl">💰</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900">Tempel Harga SPBJ dari Excel</h2>
            <p className="text-[13px] text-slate-600">
              Tempel tabel SPBJ/PO final → harganya dijodohkan ke item yang sudah ada.
              <b> Tidak ada baris baru yang ditambahkan</b>, hanya kolom Harga SPBJ yang diisi.
            </p>
          </div>
          <button onClick={onClose} title="Tutup (Esc)"
            className="shrink-0 h-9 w-9 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 text-xl">✕</button>
        </div>

        {/* ── isi ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {items.length === 0 && (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4 text-[13px] text-amber-900">
              <b>Tabel Item SPBJ masih kosong.</b> Isi dulu Item SPPB/J di atas — baris SPBJ
              diturunkan dari sana, jadi belum ada yang bisa diisi harganya.
            </div>
          )}

          {/* langkah 1 */}
          <section>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="text-[13px] font-extrabold text-slate-800">
                <span className="inline-grid place-items-center h-6 w-6 rounded-full bg-[#16357f] text-white text-[12px] mr-1.5">1</span>
                Tempel tabel SPBJ/PO-nya
              </span>
              {!kosong && (
                <button onClick={() => setTeks("")} className="ml-auto text-[12px] font-bold text-rose-600 hover:underline">
                  kosongkan tempelan
                </button>
              )}
            </div>
            <textarea
              ref={areaRef}
              value={teks}
              onChange={(e) => setTeks(e.target.value)}
              rows={kosong ? 8 : 3}
              placeholder="Klik di sini lalu tekan Ctrl+V…"
              className="w-full text-[12px] font-mono leading-relaxed border-2 border-dashed border-slate-300 rounded-xl px-3 py-2 focus:border-[#1ca3dd] outline-none"
            />
            {!kosong && (
              <p className="mt-1 text-[12px] text-slate-600">
                {sel.length} baris · {lebar} kolom terbaca · {sumber.length} baris berharga ·{" "}
                <button onClick={() => setLihatMentah(!lihatMentah)} className="font-bold text-[#16357f] hover:underline">
                  {lihatMentah ? "sembunyikan" : "lihat"} isi tiap kolom
                </button>
              </p>
            )}
          </section>

          {/* langkah 2: pemetaan kolom */}
          {!kosong && lebar > 0 && (
            <section>
              <p className="text-[13px] font-extrabold text-slate-800 mb-2">
                <span className="inline-grid place-items-center h-6 w-6 rounded-full bg-[#16357f] text-white text-[12px] mr-1.5">2</span>
                Kolom mana isinya apa
                <span className="ml-2 font-semibold text-slate-500 text-[12px]">
                  yang wajib benar cuma <b>Nama Barang/Jasa</b> dan <b>Harga Satuan</b> (atau <b>Jumlah</b>)
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: lebar }, (_, i) => (
                  <label key={i} className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1.5 border">
                    <span className="text-slate-400">#{i + 1}</span>
                    <select value={hasil?.kolom[i] || "abaikan"} onChange={(e) => gantiKolom(i, e.target.value as Peran)}
                      className="text-[12px] font-semibold bg-white border rounded px-1.5 py-1 outline-none focus:border-[#1ca3dd]">
                      {(Object.keys(PERAN_LABEL) as Peran[]).map((p) => (
                        <option key={p} value={p}>{PERAN_LABEL[p]}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {lihatMentah && (
                <div className="mt-2 overflow-x-auto rounded-xl border">
                  <table className="text-[11px] font-mono">
                    <tbody>
                      {sel.slice(0, 12).map((r, ri) => (
                        <tr key={ri} className={ri % 2 ? "bg-slate-50" : ""}>
                          <td className="px-2 py-1 text-slate-400 border-r">{ri + 1}</td>
                          {r.map((c, ci) => <td key={ci} className="px-2 py-1 border-r whitespace-nowrap max-w-[16rem] truncate">{c}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* langkah 3: perjodohan */}
          {!kosong && items.length > 0 && (
            <section>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="text-[13px] font-extrabold text-slate-800">
                  <span className="inline-grid place-items-center h-6 w-6 rounded-full bg-[#16357f] text-white text-[12px] mr-1.5">3</span>
                  Periksa pasangannya
                </span>
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                  {([["nama", "Cocokkan nama"], ["urut", "Ikut urutan baris"]] as [ModeCocok, string][]).map(([m, l]) => (
                    <button key={m} onClick={() => setMode(m)}
                      className={"px-3 py-1 rounded-md text-[12px] font-bold " + (mode === m ? "bg-white shadow text-[#16357f]" : "text-slate-600 hover:text-slate-900")}>
                      {l}
                    </button>
                  ))}
                </div>
                <span className="text-[12px] text-slate-600">
                  <b className="text-emerald-700">{ring.ketemu}</b> ketemu ·{" "}
                  <b className="text-amber-700">{ring.ragu}</b> perlu dilihat ·{" "}
                  <b className="text-slate-500">{ring.kosong}</b> belum ketemu
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-[12px]">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-2 py-2 border-b w-8"></th>
                      <th className="px-2 py-2 border-b text-left">Item di formulir</th>
                      <th className="px-2 py-2 border-b text-right w-28">Harga SPPB/J</th>
                      <th className="px-2 py-2 border-b text-right w-28">Harga SPBJ baru</th>
                      <th className="px-2 py-2 border-b text-right w-28">Selisih</th>
                      <th className="px-2 py-2 border-b text-right w-32">Jumlah baru</th>
                      <th className="px-2 py-2 border-b text-left w-72">Dari baris tempelan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jodoh.map((j) => {
                      const lewat = !!lewati[j.item.id];
                      const baru = j.baris?.harga || 0;
                      const lama = j.item.hargaSpbj && j.item.hargaSpbj > 0 ? j.item.hargaSpbj : j.item.harga;
                      const beda = j.baris ? baru - lama : 0;
                      const warna = !j.baris ? "bg-slate-50" : j.catatan ? "bg-amber-50" : "";
                      return (
                        <tr key={j.item.id} className={(lewat ? "opacity-40 " : "") + warna + " border-b last:border-0 align-top"}>
                          <td className="px-2 py-1.5">
                            <input type="checkbox" checked={!lewat && !!j.baris} disabled={!j.baris}
                              onChange={(e) => setLewati((s) => ({ ...s, [j.item.id]: !e.target.checked }))} />
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="font-semibold text-slate-800 whitespace-pre-line">{j.item.nama}</div>
                            <div className="text-[11px] text-slate-500">
                              {j.item.kapal || "—"} · {j.item.jumlah} {j.item.satuan}
                            </div>
                            {j.catatan && <div className="text-[11px] font-semibold text-amber-800 mt-0.5">⚠ {j.catatan}</div>}
                          </td>
                          <td className="px-2 py-1.5 text-right text-slate-500">{rp(j.item.harga)}</td>
                          <td className="px-2 py-1.5 text-right font-bold text-slate-900">{j.baris ? rp(baru) : "—"}</td>
                          <td className={"px-2 py-1.5 text-right font-semibold " + (beda > 0 ? "text-rose-600" : beda < 0 ? "text-emerald-700" : "text-slate-400")}>
                            {j.baris && beda !== 0 ? (beda > 0 ? "+" : "−") + rp(Math.abs(beda)) : "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right text-slate-700">{j.baris ? rp(baru * j.item.jumlah) : "—"}</td>
                          <td className="px-2 py-1.5">
                            <select
                              value={j.baris ? j.baris.sumber : 0}
                              onChange={(e) => setPaksa((s) => ({ ...s, [j.item.id]: +e.target.value }))}
                              className="w-full text-[11px] bg-white border rounded px-1.5 py-1 outline-none focus:border-[#1ca3dd]">
                              <option value={0}>— tidak dipasangkan —</option>
                              {sumber.map((b) => (
                                <option key={b.sumber} value={b.sumber}>
                                  {"br." + b.sumber + " · " + b.nama.slice(0, 48) + " · " + rp(b.harga)}
                                </option>
                              ))}
                            </select>
                            {j.baris && j.skor > 0 && j.skor < 1 && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                kemiripan nama {Math.round(j.skor * 100)}%{j.skor < AMBANG ? " — rendah" : ""}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* baris tempelan yang tidak terpakai: tanda item di formulir kurang */}
              {(() => {
                const dipakai: Record<number, boolean> = {};
                jodoh.forEach((j) => { if (j.baris) dipakai[j.baris.sumber] = true; });
                const sisa = sumber.filter((b) => !dipakai[b.sumber]);
                if (!sisa.length) return null;
                return (
                  <p className="mt-2 text-[12px] text-slate-600">
                    <b>{sisa.length} baris tempelan tidak terpakai</b> — kalau seharusnya ada,
                    berarti item itu belum ada di Item SPPB/J di atas:{" "}
                    <span className="text-slate-500">{sisa.map((b) => "br." + b.sumber + " " + b.nama.slice(0, 28)).join(" · ")}</span>
                  </p>
                );
              })()}
            </section>
          )}
        </div>

        {/* ── kaki ── */}
        <div className="shrink-0 flex flex-wrap items-center gap-3 px-6 py-3.5 border-t-2 border-slate-200 bg-slate-50">
          <div className="text-[13px] text-slate-700">
            Total sekarang <b>{rp(totalLama)}</b>
            <span className="mx-2 text-slate-400">→</span>
            total setelah tempel <b className="text-[#16357f]">{rp(totalBaru + items.reduce((s, it) => {
              const ada = terpakai.some((j) => j.item.id === it.id);
              return ada ? s : s + (it.hargaSpbj && it.hargaSpbj > 0 ? it.hargaSpbj : it.harga) * it.jumlah;
            }, 0))}</b>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-[13px] font-bold text-slate-700 hover:bg-slate-200">Batal</button>
            <button onClick={terapkan} disabled={!terpakai.length}
              className="px-5 py-2 rounded-xl text-[13px] font-extrabold text-white bg-[#16357f] hover:bg-[#122c6a] disabled:bg-slate-300 disabled:cursor-not-allowed">
              Isi harga {terpakai.length} item
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(isi, document.body);
}
