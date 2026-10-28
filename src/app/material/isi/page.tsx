"use client";

import Link from "next/link";
import { useState } from "react";
import { useMaterial } from "@/lib/material/store";
import { KAPAL_DB, REFERENCE_DB } from "@/lib/material/db";
import { itemKategori, itemPOText, emptyItem, MaterialItem, MaterialRequest } from "@/lib/material/types";
import { tempelExcel, LaporanTempel } from "@/lib/material/tempel";
import { Field, Input, Section } from "@/components/Field";
import { rupiah, bulanTahun } from "@/lib/format";
import FotoUploader from "@/components/FotoUploader";

export default function MaterialIsi() {
  const { req, update, setItem, addItem, delItem } = useMaterial();
  const bt = bulanTahun(req.tanggal);

  const toInt = (s: string) => { const d = (s || "").replace(/[^\d]/g, ""); return d ? parseInt(d, 10) : 0; };
  const PASTE_FIELDS: (keyof MaterialItem)[] = ["kapal", "partNumber", "nama", "kode", "namaMesin", "satuan", "qty", "harga"];

  /**
   * Hasil tempelan terakhir, berikut salinan daftar sebelum ditempel.
   *
   * Dua-duanya disimpan karena menempel blok Excel mengubah banyak baris
   * sekaligus: pembacaan kolom yang keliru tidak cukup diberitahu, harus bisa
   * dikembalikan juga. Tanpa tombol batal, satu tempelan yang salah berarti
   * mengetik ulang seluruh tabel.
   */
  const [laporan, setLaporan] = useState<LaporanTempel | null>(null);
  const [cadangan, setCadangan] = useState<MaterialItem[] | null>(null);
  const [gagalTempel, setGagalTempel] = useState("");

  const addFotos = (urls: string[]) => update({ fotoDokumentasi: [...(req.fotoDokumentasi || []), ...urls].slice(0, 5) });

  /** Tulis hasil bacaan mulai dari baris ke-mulai, menambah baris bila perlu. */
  const terapkan = (hasil: LaporanTempel, mulai: number) => {
    const next = [...req.items];
    hasil.items.forEach((it, i) => { next[mulai + i] = it; });
    for (let i = 0; i < next.length; i++) if (!next[i]) next[i] = emptyItem();
    setCadangan(req.items);
    setGagalTempel("");
    setLaporan(hasil);
    update({ items: next });
  };

  const batalkanTempel = () => {
    if (!cadangan) return;
    update({ items: cadangan });
    setCadangan(null);
    setLaporan(null);
  };

  /** Baris terakhir yang benar-benar terisi — baris kosong di ekor ditimpa. */
  const ekorTerisi = () => {
    let n = req.items.length;
    while (n > 0 && !req.items[n - 1].nama && !req.items[n - 1].partNumber) n--;
    return n;
  };

  // paste blok Excel mulai dari (baris ke-startRow, kolom ke-startCol)
  const handlePaste = (startRow: number, startCol: number, e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    // Blok bertabel dibaca menurut isi kolomnya, bukan menurut sel yang diklik:
    // urutan kolom berkas pengajuan berbeda dari urutan kolom di layar ini.
    const hasil = tempelExcel(text);
    if (hasil) { e.preventDefault(); terapkan(hasil, startRow); return; }
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const rows = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((r) => r.split("\t"));
    const next = [...req.items];
    rows.forEach((cells, ri) => {
      const idx = startRow + ri;
      if (!next[idx]) next[idx] = emptyItem();
      else next[idx] = { ...next[idx] };
      cells.forEach((val, ci) => {
        const f = PASTE_FIELDS[startCol + ci];
        if (!f) return;
        if (f === "qty" || f === "harga") (next[idx] as any)[f] = toInt(val);
        else if (f === "kode") next[idx].kode = val.trim().toUpperCase();
        else (next[idx] as any)[f] = val.trim();
      });
    });
    update({ items: next });
  };

  /**
   * Kotak tempel di luar tabel.
   *
   * Tempelan lewat sel tabel hanya mungkin kalau barisnya sudah ada — pada
   * pengajuan yang masih kosong tidak ada sel yang bisa diklik. Kotak ini
   * selalu tersedia, dan isinya disambung di bawah baris terakhir yang terisi.
   */
  const tempelKotak = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const hasil = tempelExcel(text);
    if (!hasil) {
      setLaporan(null);
      setGagalTempel("Tempelan tidak terbaca sebagai tabel. Blok sel di Excel (beberapa kolom sekaligus), lalu Ctrl+V di kotak ini.");
      return;
    }
    terapkan(hasil, ekorTerisi());
  };
  const totalSC = req.items.filter((i) => itemKategori(i) === "SC").length;
  const totalUmum = req.items.length - totalSC;

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="glass rounded-2xl ring-line elev-md px-5 py-4 mb-6 sticky top-3 z-20">
        <span className="flex items-center gap-2.5">
            <Link href="/material" title="Kembali ke Pengajuan Kode Material"
              className="shrink-0 h-9 w-9 grid place-items-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:border-[#1ca3dd] hover:text-[#16357f] transition">←</Link>
            <nav className="flex items-center gap-1.5 text-[11px] text-slate-500" aria-label="Navigasi">
              <Link href="/material" className="font-semibold hover:text-[#16357f] hover:underline">Pengajuan Kode Material</Link>
              <span className="text-slate-300">›</span>
              <span className="font-bold text-slate-700">Input / Edit</span>
            </nav>
          </span>
        <h1 className="text-xl font-extrabold asdp-text-gradient">Input Item Pengajuan</h1>
        <p className="text-xs text-slate-500">{req.items.length} item · {totalSC} suku cadang · {totalUmum} barang umum · periode {bt}</p>
      </div>

      <Section title="Data Pengajuan" icon="🧾">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Tanggal Dokumen"><Input type="date" value={req.tanggal} onChange={(e) => update({ tanggal: e.target.value })} /></Field>
          <Field label="No. Penawaran (angka acak)"><Input value={req.noPenawaran} onChange={(e) => update({ noPenawaran: e.target.value })} /></Field>
          <Field label="Periode (otomatis)"><Input value={bt} readOnly className="bg-slate-50 text-slate-500" /></Field>
          <Field label="Dept. Head Operasional & Teknik"><Input value={req.deptHead} onChange={(e) => update({ deptHead: e.target.value })} /></Field>
          <Field label="Staf Teknik"><Input value={req.stafTeknik} onChange={(e) => update({ stafTeknik: e.target.value })} /></Field>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <Field label="Judul Formulir (prefix)"><Input value={req.judulFormulir} onChange={(e) => update({ judulFormulir: e.target.value })} /></Field>
          <Field label="Judul Penawaran SC (prefix)"><Input value={req.judulSC} onChange={(e) => update({ judulSC: e.target.value })} /></Field>
          <Field label="Judul Penawaran Umum (prefix)"><Input value={req.judulUmum} onChange={(e) => update({ judulUmum: e.target.value })} /></Field>
        </div>
        <p className="text-xs text-slate-400 mt-2">Judul akhir = prefix + &quot;{bt}&quot;. No. penawaran = CTT/E/{req.noPenawaran}/(bulan romawi)/(tahun).</p>
      </Section>

      <Section title={`Item Material (${req.items.length})`} icon="📦">
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-3 text-sm text-slate-700">
          <b className="text-sky-800">📋 Tempel dari Excel:</b> blok sel di Excel — <b>ikutkan baris judul kolomnya</b> — lalu <kbd className="px-1.5 py-0.5 bg-white border rounded">Ctrl+V</kbd> di kotak bawah ini (atau di sel tabel untuk menimpa dari baris itu).
          <ul className="mt-1.5 ml-4 list-disc text-[11px] text-slate-600 space-y-0.5">
            <li>Urutan kolom <b>bebas</b> — dikenali dari judulnya: Nama Barang, Part Number, Kuantiti, Satuan, Harga Satuan, Kapal, Nama Mesin, Spesifikasi.</li>
            <li>Baris <b>judul kapal</b> (<i>KMP BOBARA</i>) dan <b>judul mesin</b> (<i>ME YANMAR 6KYM-ETE</i>) ikut diblok saja — kapal &amp; mesinnya diturunkan ke item di bawahnya.</li>
            <li>Kode diisi dari judul mesin: <b>ME → B02007</b>, <b>AE → B02008</b>. Kolom <i>Kode Material</i> (nomor SAP 10 angka) dilewati — bukan kolom Kode di layar ini.</li>
          </ul>
        </div>
        <textarea
          onPaste={tempelKotak}
          value=""
          onChange={() => { /* kotak ini hanya untuk menempel; ketikannya tidak disimpan */ }}
          rows={2}
          placeholder="Klik di sini lalu Ctrl+V untuk menempel blok dari Excel…"
          className="w-full mb-3 rounded-xl border-2 border-dashed border-sky-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
        />
        {!!gagalTempel && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 mb-3 text-xs text-amber-900">⚠️ {gagalTempel}</div>
        )}
        {!!laporan && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 mb-3 text-xs text-slate-700">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <b className="text-emerald-800">✓ {laporan.items.length} item terbaca</b>
              {!!laporan.kapal.length && <span>{laporan.kapal.length} kapal: {laporan.kapal.join(", ")}</span>}
              {!!laporan.judulMesin && <span>{laporan.judulMesin} judul mesin</span>}
              {!!laporan.dilewati && <span>{laporan.dilewati} baris dilewati</span>}
              <span className="text-slate-500">
                peta kolom dari {laporan.sumberPeta === "judul" ? "baris judul" : "isi kolom (tebakan)"}
              </span>
              {!!cadangan && (
                <button onClick={batalkanTempel} className="ml-auto btn btn-ghost !py-1 !px-2.5 text-[11px]">↩ Batalkan tempelan</button>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {laporan.kolom.filter((k) => k.label).map((k, i) => (
                <span key={i} className={`px-1.5 py-0.5 rounded font-semibold ${k.bidang
                  ? "bg-white ring-1 ring-emerald-300 text-emerald-800"
                  : "bg-slate-100 text-slate-400 line-through"}`}>{k.label}</span>
              ))}
            </div>
            {laporan.catatan.map((c, i) => <p key={i} className="mt-1 text-[11px] text-slate-500">· {c}</p>)}
          </div>
        )}
        <p className="text-xs text-slate-500 mb-3">
          Kode dipilih dari Reference (cari/ketik). <b>Kategori otomatis</b>: ZSC → Penawaran SC, lainnya → Penawaran Umum.
        </p>
        <datalist id="kodeList">
          {REFERENCE_DB.map((r) => <option key={r.kode} value={r.kode}>{r.kode} — {r.short} ({r.tipe})</option>)}
        </datalist>
        <datalist id="kapalList">
          {KAPAL_DB.map((k) => <option key={k.nama} value={k.nama} />)}
        </datalist>
        <button onClick={() => addItem()} className="btn btn-ghost text-sm mb-3">+ Tambah Item</button>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-slate-50 text-xs">
              <tr>
                <th className="p-2 border">Kapal</th>
                <th className="p-2 border">Part No (E)</th>
                <th className="p-2 border text-left">Nama Barang (F)</th>
                <th className="p-2 border">Kode (I)</th>
                <th className="p-2 border">Nama Mesin <span className="text-[9px] text-slate-400">(SC)</span></th>
                <th className="p-2 border">Deskripsi (J)</th>
                <th className="p-2 border">Sat</th>
                <th className="p-2 border">Qty</th>
                <th className="p-2 border">Harga</th>
                <th className="p-2 border">Kat.</th>
                <th className="p-2 border"></th>
              </tr>
            </thead>
            <tbody>
              {req.items.map((it, ri) => {
                const kat = itemKategori(it);
                return (
                  <tr key={it.id}>
                    <td className="border p-1"><input list="kapalList" className="w-28 px-1" value={it.kapal} onChange={(e) => setItem(it.id, { kapal: e.target.value })} onPaste={(e) => handlePaste(ri, 0, e)} /></td>
                    <td className="border p-1"><input className="w-28 px-1" value={it.partNumber} onChange={(e) => setItem(it.id, { partNumber: e.target.value })} onPaste={(e) => handlePaste(ri, 1, e)} /></td>
                    <td className="border p-1"><input className="w-44 px-1" value={it.nama} onChange={(e) => setItem(it.id, { nama: e.target.value })} onPaste={(e) => handlePaste(ri, 2, e)} /></td>
                    <td className="border p-1"><input list="kodeList" className="w-24 px-1" value={it.kode} onChange={(e) => setItem(it.id, { kode: e.target.value.toUpperCase() })} onPaste={(e) => handlePaste(ri, 3, e)} /></td>
                    <td className="border p-1"><input className="w-36 px-1" placeholder={kat === "SC" ? "nama mesin…" : "—"} value={it.namaMesin || ""} onChange={(e) => setItem(it.id, { namaMesin: e.target.value })} onPaste={(e) => handlePaste(ri, 4, e)} /></td>
                    <td className="border p-1 text-xs text-slate-500 w-32">{itemPOText(it) || "—"}</td>
                    <td className="border p-1"><input className="w-12 px-1 text-center" value={it.satuan} onChange={(e) => setItem(it.id, { satuan: e.target.value })} onPaste={(e) => handlePaste(ri, 5, e)} /></td>
                    <td className="border p-1"><input type="number" className="w-14 px-1 text-center" value={it.qty} onChange={(e) => setItem(it.id, { qty: +e.target.value })} onPaste={(e) => handlePaste(ri, 6, e)} /></td>
                    <td className="border p-1"><input type="number" className="w-28 px-1 text-right" value={it.harga} onChange={(e) => setItem(it.id, { harga: +e.target.value })} onPaste={(e) => handlePaste(ri, 7, e)} /></td>
                    <td className="border p-1 text-center">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${kat === "SC" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{kat}</span>
                    </td>
                    <td className="border p-1 text-center"><button onClick={() => delItem(it.id)} className="text-red-500 text-xs">hapus</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Dokumentasi (Foto, maks 5)" icon="📷">
        <FotoUploader onAdd={addFotos} max={5 - (req.fotoDokumentasi?.length || 0)} hint="kompres otomatis maks 1024px" />
        {!!req.fotoDokumentasi?.length && (
          <div className="flex gap-3 mt-3 flex-wrap">
            {req.fotoDokumentasi.map((u, i) => (
              <div key={i} className="relative">
                <img src={u} alt={`foto ${i + 1}`} className="h-24 w-32 object-cover rounded-lg border" />
                <button onClick={() => update({ fotoDokumentasi: req.fotoDokumentasi!.filter((_, fi) => fi !== i) })} title="Hapus foto"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white text-xs font-bold shadow grid place-items-center hover:bg-red-600">✕</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="flex justify-end">
        <Link href="/material" className="btn btn-primary px-5 py-2.5 text-sm">Selesai → Generate</Link>
      </div>
    </main>
  );
}
