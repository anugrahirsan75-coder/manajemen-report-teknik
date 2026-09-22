"use client";
/**
 * Tempel satu tabel SPPB/J utuh dari Excel.
 *
 * Alurnya tiga langkah — tempel, PERIKSA, baru masuk. Langkah tengah itu yang
 * membedakannya dari tempel biasa: tabel yang langsung masuk tanpa ditunjukkan
 * dulu membuat kolom yang tergeser satu lajur berubah menjadi harga yang
 * salah, dan kesalahan seperti itu baru ketahuan setelah dokumennya terbit.
 *
 * Bentuknya kotak melayang di atas halaman isi SPPBJ — tetap di halaman yang
 * sama, tidak membuka jendela peramban baru — dan mengambil hampir seluruh
 * layar, karena yang diperiksa di dalamnya adalah tabel berpuluh baris.
 *
 * Tinggi kotaknya DIPATOK ke layar, bukan mengikuti isi, dengan tiga bagian
 * tetap: kepala, isi yang bisa digulung, dan kaki. Versi pertama tingginya
 * mengikuti isi, dan pada layar pendek kaki kotaknya menindih baris pemetaan
 * kolom — tombol "Masukkan" menutup persis kendali yang harus dilihat sebelum
 * menekan tombol itu.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarisTempel, HasilTempel, PERAN_LABEL, Peran, pecah, tebakKolom, uraikan,
} from "@/lib/sppbj/tempelTabel";
import { KAPAL_LIST } from "@/lib/sppbj/db";

export interface ItemTempel {
  kapal: string; jumlah: number; satuan: string; nama: string;
  spesifikasi: string; harga: number; keterangan?: string; breakdown?: string[];
}

const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

const WARNA: Record<BarisTempel["jenis"], string> = {
  item: "",
  kapal: "bg-sky-100 text-sky-900 font-bold",
  golongan: "bg-violet-100 text-violet-900 font-bold",
  rincian: "bg-slate-50 text-slate-600 italic",
  penutup: "bg-emerald-100 text-emerald-900 font-semibold",
  lewat: "bg-slate-100 text-slate-500",
};

const LABEL_JENIS: Record<BarisTempel["jenis"], string> = {
  item: "ITEM", kapal: "KAPAL", golongan: "GOLONGAN", rincian: "rincian",
  penutup: "penutup", lewat: "dilewati",
};

export default function TempelTabelSppbj({ open, onClose, onAdd, kapalAwal = "" }: {
  open: boolean;
  onClose: () => void;
  onAdd: (items: ItemTempel[]) => void;
  kapalAwal?: string;
}) {
  const [teks, setTeks] = useState("");
  const [kolom, setKolom] = useState<Peran[]>([]);
  const [kapal, setKapal] = useState(kapalAwal);
  const [pakai, setPakai] = useState<Record<number, boolean>>({});
  const [lihatMentah, setLihatMentah] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) { setTeks(""); setKolom([]); setPakai({}); setLihatMentah(false); }
    else { setKapal(kapalAwal); setTimeout(() => areaRef.current?.focus(), 50); }
  }, [open, kapalAwal]);

  // tebakan kolom disetel ulang tiap tempelan baru, lalu boleh diubah pemakai
  useEffect(() => {
    if (!teks.trim()) { setKolom([]); return; }
    setKolom(tebakKolom(pecah(teks)));
    setPakai({});
  }, [teks]);

  // Esc menutup — kotak setinggi layar tanpa jalan keluar cepat terasa mengurung
  useEffect(() => {
    if (!open) return;
    const tekan = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [open, onClose]);

  const hasil: HasilTempel | null = useMemo(
    () => (teks.trim() ? uraikan(teks, kolom.length ? kolom : undefined, kapal) : null),
    [teks, kolom, kapal]);

  const sel = useMemo(() => pecah(teks), [teks]);
  const item = useMemo(() => (hasil?.baris || []).filter((b) => b.jenis === "item"), [hasil]);
  const dipakai = useMemo(() => item.filter((b) => (pakai[b.sumber] ?? b.pakai)), [item, pakai]);
  const totalDipakai = dipakai.reduce((s, b) => s + b.jumlah * b.harga, 0);

  if (!open) return null;

  const gantiKolom = (i: number, p: Peran) => {
    setKolom((lama) => {
      const baru = [...lama];
      if (p !== "abaikan") baru.forEach((x, j) => { if (x === p && j !== i) baru[j] = "abaikan"; });
      baru[i] = p;
      return baru;
    });
  };

  const masukkan = () => {
    onAdd(dipakai.map((b) => ({
      kapal: b.kapal, jumlah: b.jumlah, satuan: b.satuan, nama: b.nama,
      spesifikasi: b.spesifikasi, harga: b.harga,
      keterangan: b.keterangan, breakdown: b.breakdown?.length ? b.breakdown : undefined,
    })));
    onClose();
  };

  const lebar = hasil?.kolom.length || 0;
  const kosong = !teks.trim();

  return (
    <div className="fixed inset-0 z-50 bg-black/55 p-2 sm:p-4 grid place-items-center" onMouseDown={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/10 w-full max-w-[104rem] h-[97vh] flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}>

        {/* ── kepala ── */}
        <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-b-2 border-slate-200">
          <span className="text-2xl">📋</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900">Tempel Tabel SPPB/J dari Excel</h2>
            <p className="text-[13px] text-slate-600">
              Blok seluruh tabel di Excel → <b>Ctrl+C</b> → tempel di kotak bawah.
              Baris kapal, judul golongan, dan baris Jumlah/PPn/Total dikenali sendiri.
            </p>
          </div>
          <button onClick={onClose} title="Tutup (Esc)"
            className="shrink-0 h-9 w-9 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 text-xl">✕</button>
        </div>

        {/* ── isi ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* langkah 1: tempel */}
          <section>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="text-[13px] font-extrabold text-slate-800">
                <span className="inline-grid place-items-center h-6 w-6 rounded-full bg-[#16357f] text-white text-[12px] mr-1.5">1</span>
                Tempel tabelnya
              </span>
              <label className="text-[12px] font-bold text-slate-700 flex items-center gap-2">
                Kapal bawaan
                <input list="kapalTempel" value={kapal} onChange={(e) => setKapal(e.target.value)}
                  className="w-52 text-[13px] font-semibold border-2 rounded-lg px-2.5 py-1.5 focus:border-[#1ca3dd] outline-none"
                  placeholder="mis. KMP. TUNA" />
                <datalist id="kapalTempel">{KAPAL_LIST.map((k) => <option key={k} value={k} />)}</datalist>
              </label>
              <span className="text-[12px] text-slate-500">dipakai bila lembarnya tidak menyebut kapal</span>
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
                {sel.length} baris · {lebar} kolom terbaca ·{" "}
                <button onClick={() => setLihatMentah(!lihatMentah)} className="font-bold text-[#16357f] hover:underline">
                  {lihatMentah ? "sembunyikan" : "lihat"} isi mentah per kolom
                </button>
              </p>
            )}
          </section>

          {/* isi mentah — dipakai saat hasilnya tidak masuk akal */}
          {!kosong && lihatMentah && (
            <section className="rounded-xl ring-1 ring-slate-300 overflow-auto max-h-64">
              <table className="text-[11px] font-mono">
                <thead className="bg-slate-800 text-white sticky top-0">
                  <tr>
                    <th className="px-2 py-1">brs</th>
                    {Array.from({ length: lebar }, (_, i) => <th key={i} className="px-2 py-1">k{i + 1}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sel.slice(0, 40).map((b, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-2 py-0.5 text-slate-400">{i + 1}</td>
                      {Array.from({ length: lebar }, (_, j) => (
                        <td key={j} className="px-2 py-0.5 whitespace-nowrap max-w-[14rem] truncate">{b[j] || ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {hasil && (
            <>
              {/* langkah 2: periksa */}
              <section>
                <p className="text-[13px] font-extrabold text-slate-800 mb-2">
                  <span className="inline-grid place-items-center h-6 w-6 rounded-full bg-[#16357f] text-white text-[12px] mr-1.5">2</span>
                  Periksa dulu
                </p>

                <div className="rounded-xl ring-1 ring-slate-300 p-3 mb-3">
                  <p className="text-[12px] font-bold text-slate-700 mb-2">
                    Pemetaan kolom <span className="font-normal text-slate-500">— tebakan aplikasi, betulkan bila meleset</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: lebar }, (_, i) => {
                      const p = hasil.kolom[i] || "abaikan";
                      return (
                        <label key={i} className="text-[11px] font-bold text-slate-500">
                          Kolom {i + 1}
                          <select value={p} onChange={(e) => gantiKolom(i, e.target.value as Peran)}
                            className={`block mt-0.5 text-[12px] border-2 rounded-lg px-2 py-1.5 outline-none focus:border-[#1ca3dd] ${
                              p === "abaikan" ? "text-slate-400 border-slate-200" : "font-bold text-slate-800 border-slate-400 bg-slate-50"}`}>
                            {(Object.keys(PERAN_LABEL) as Peran[]).map((x) => (
                              <option key={x} value={x}>{PERAN_LABEL[x]}</option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-2 mb-3">
                  {([
                    ["Jumlah (sebelum PPN)", hasil.hitung.jumlah, hasil.lembar.jumlah],
                    ["PPN 11%", hasil.hitung.ppn, hasil.lembar.ppn],
                    ["Total", hasil.hitung.total, hasil.lembar.total],
                  ] as [string, number, number | undefined][]).map(([judul, hitung, dilembar]) => {
                    const beda = dilembar !== undefined && Math.abs(dilembar - hitung) > 2;
                    return (
                      <div key={judul} className={`rounded-xl p-3 ring-2 ${beda ? "bg-rose-50 ring-rose-400" : "bg-emerald-50 ring-emerald-300"}`}>
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">{judul}</p>
                        <p className="text-lg font-extrabold text-slate-900">{rp(hitung)}</p>
                        <p className={`text-[12px] font-semibold ${beda ? "text-rose-700" : "text-emerald-700"}`}>
                          {dilembar === undefined ? "tidak ada di lembar"
                            : beda ? `≠ lembar: ${rp(dilembar)}` : `cocok dengan lembar`}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/*
                  Tidak ada item terbaca adalah jalan buntu yang paling
                  membingungkan: tombol "pilih semua item" ditekan berkali-kali
                  dan tidak terjadi apa-apa, karena memang tidak ada yang bisa
                  dipilih. Jadi keadaan itu diberi penjelasan sendiri beserta
                  langkah keluarnya, bukan sekadar tabel kosong.
                */}
                {item.length === 0 && (
                  <div className="rounded-xl bg-rose-50 ring-2 ring-rose-300 px-4 py-3 mb-3">
                    <p className="text-[14px] font-extrabold text-rose-900 mb-1">
                      Belum ada baris yang terbaca sebagai item
                    </p>
                    <p className="text-[13px] text-rose-900 mb-2">
                      Hampir selalu karena kolomnya salah petakan. Aplikasi butuh minimal
                      dua kolom: <b>Nama Barang/Jasa</b> dan <b>Harga Satuan</b> (atau <b>Jumlah</b> total baris).
                    </p>
                    <ol className="text-[13px] text-rose-900 list-decimal list-inside space-y-0.5 font-semibold">
                      <li>Tekan <b>lihat isi mentah per kolom</b> di atas — lihat kolom ke berapa nama barangnya.</li>
                      <li>Pada <b>Pemetaan kolom</b>, setel kolom itu jadi <b>Nama Barang/Jasa</b>.</li>
                      <li>Setel kolom angkanya jadi <b>Harga Satuan</b> dan <b>Jumlah (total baris)</b>.</li>
                    </ol>
                    <button onClick={() => setLihatMentah(true)}
                      className="mt-2 text-[12px] font-extrabold px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:opacity-90">
                      Tampilkan isi mentah per kolom
                    </button>
                  </div>
                )}

                {hasil.masalah.length > 0 && (
                  <ul className="rounded-xl bg-amber-50 ring-2 ring-amber-300 px-4 py-2.5 text-[13px] font-semibold text-amber-900 list-disc list-inside space-y-1">
                    {hasil.masalah.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                )}
              </section>

              {/* daftar baris */}
              <section className="rounded-xl ring-1 ring-slate-300 overflow-hidden">
                <div className="px-3 py-2 bg-slate-100 border-b flex flex-wrap items-center gap-3">
                  <p className="text-[12px] font-bold text-slate-800 flex-1">
                    {hasil.baris.length} baris ditempel · <span className="text-[#16357f]">{item.length} item</span> ·
                    {" "}{hasil.baris.filter((b) => b.jenis === "lewat").length} dilewati
                  </p>
                  <button onClick={() => setPakai(Object.fromEntries(item.map((b) => [b.sumber, true])))}
                    className="text-[12px] font-bold text-[#16357f] hover:underline">pilih semua</button>
                  <button onClick={() => setPakai(Object.fromEntries(item.map((b) => [b.sumber, false])))}
                    className="text-[12px] font-bold text-slate-600 hover:underline">kosongkan</button>
                </div>
                <div className="max-h-[26rem] overflow-auto">
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-200 text-slate-800 sticky top-0">
                      <tr className="text-[11px] font-extrabold uppercase tracking-wide">
                        <th className="p-2 w-8"></th>
                        <th className="p-2 w-10 text-left">Brs</th>
                        <th className="p-2 w-20 text-left">Jenis</th>
                        <th className="p-2 w-28 text-left">Kapal</th>
                        <th className="p-2 w-12 text-right">Jml</th>
                        <th className="p-2 w-12 text-left">Sat</th>
                        <th className="p-2 text-left">Nama / isi baris</th>
                        <th className="p-2 w-28 text-right">Harga</th>
                        <th className="p-2 w-28 text-right">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hasil.baris.map((b) => {
                        const aktif = b.jenis === "item";
                        const dicentang = pakai[b.sumber] ?? b.pakai;
                        return (
                          <tr key={b.sumber}
                            className={`border-b ${WARNA[b.jenis]} ${aktif && b.catatan ? "bg-amber-50" : ""}`}>
                            <td className="p-2 text-center">
                              {aktif && (
                                <input type="checkbox" className="h-4 w-4" checked={dicentang}
                                  onChange={(e) => setPakai((p) => ({ ...p, [b.sumber]: e.target.checked }))} />
                              )}
                            </td>
                            <td className="p-2 text-slate-500 font-mono">{b.sumber}</td>
                            <td className="p-2 text-[11px] font-bold">{LABEL_JENIS[b.jenis]}</td>
                            <td className="p-2 truncate font-semibold">{aktif ? b.kapal : ""}</td>
                            <td className="p-2 text-right font-bold">{aktif ? b.jumlah : ""}</td>
                            <td className="p-2">{aktif ? b.satuan : ""}</td>
                            <td className="p-2">
                              <span className={aktif ? "font-semibold text-slate-900" : ""}>
                                {aktif ? b.nama : (b.catatan || b.sel.filter(Boolean).join(" · "))}
                              </span>
                              {aktif && b.spesifikasi && <span className="text-slate-500"> · {b.spesifikasi}</span>}
                              {aktif && b.breakdown?.length ? (
                                <span className="block text-slate-600">{b.breakdown.map((x) => `- ${x}`).join(" ")}</span>
                              ) : null}
                              {aktif && b.keterangan && (
                                <span className="block text-violet-800 font-semibold">🏷 {b.keterangan.replace(/\n/g, " · ")}</span>
                              )}
                              {aktif && b.catatan && (
                                <span className="block text-amber-900 font-bold">⚠ {b.catatan}</span>
                              )}
                            </td>
                            <td className="p-2 text-right font-semibold">{aktif && b.harga ? b.harga.toLocaleString("id-ID") : ""}</td>
                            <td className="p-2 text-right font-bold">
                              {aktif ? Math.round(b.jumlah * b.harga).toLocaleString("id-ID") : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>

        {/* ── kaki ── */}
        <div className="shrink-0 flex flex-wrap items-center gap-3 px-6 py-3 border-t-2 border-slate-200 bg-slate-50">
          <p className="text-[13px] text-slate-700 flex-1">
            {hasil
              ? <><span className="inline-grid place-items-center h-6 w-6 rounded-full bg-[#16357f] text-white text-[12px] mr-1.5">3</span>
                Akan dimasukkan <b className="text-slate-900">{dipakai.length}</b> item senilai{" "}
                <b className="text-slate-900">{rp(totalDipakai)}</b> (sebelum PPN).</>
              : "Belum ada tempelan."}
          </p>
          <button onClick={onClose}
            className="text-[13px] font-bold px-4 py-2 rounded-lg border-2 border-slate-300 text-slate-700 hover:bg-white">Batal</button>
          <button onClick={masukkan} disabled={!dipakai.length}
            className="text-[13px] font-extrabold px-5 py-2 rounded-lg bg-[#16357f] text-white hover:opacity-90 disabled:opacity-30">
            ＋ Masukkan {dipakai.length || ""} item
          </button>
        </div>
      </div>
    </div>
  );
}
