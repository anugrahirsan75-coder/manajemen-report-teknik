"use client";

import Link from "next/link";
import { useSppbj } from "@/lib/sppbj/store";
import { MATA_ANGGARAN, STAF_TEKNIK, KAPAL_LIST, DEPT_HEAD, VENDOR_DB, MATL_GROUP } from "@/lib/sppbj/db";
import { SppbjItem, emptySppbjItem, sppbjTotal, kapalUnik, hargaSpbjOf, namaLengkap, ketLines } from "@/lib/sppbj/types";
import { useState, Fragment } from "react";
import { Field, Input, Section } from "@/components/Field";
import DrpPicker from "@/components/DrpPicker";
import { rupiah, bulanTahun } from "@/lib/format";

export default function SppbjIsi() {
  const { req, update, setItem, addItem, delItem, setItems, saveRemote, saving } = useSppbj();
  const total = sppbjTotal(req.items);
  const [openBd, setOpenBd] = useState<Record<string, boolean>>({});

  const toInt = (s: string) => { const d = (s || "").replace(/[^\d]/g, ""); return d ? parseInt(d, 10) : 0; };
  const toNum = (s: string) => { const x = parseFloat((s || "").replace(/[^\d.]/g, "")); return isNaN(x) ? 0 : x; };
  const FIELDS: (keyof SppbjItem)[] = ["kapal", "jumlah", "satuan", "nama", "spesifikasi", "harga"];
  const handlePaste = (startRow: number, startCol: number, e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return;
    e.preventDefault();
    const rows = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((r) => r.split("\t"));
    const next = [...req.items];
    rows.forEach((cells, ri) => {
      const idx = startRow + ri;
      if (!next[idx]) next[idx] = emptySppbjItem();
      else next[idx] = { ...next[idx] };
      cells.forEach((val, ci) => {
        const f = FIELDS[startCol + ci]; if (!f) return;
        if (f === "harga") next[idx].harga = toInt(val);
        else if (f === "jumlah") next[idx].jumlah = toNum(val);
        else (next[idx] as any)[f] = val.trim();
      });
    });
    setItems(next);
  };

  const toggleMA = (ma: string) => {
    const has = req.mataAnggaran.includes(ma);
    update({ mataAnggaran: has ? req.mataAnggaran.filter((x) => x !== ma) : [...req.mataAnggaran, ma] });
  };

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <div className="glass rounded-2xl border border-slate-100 shadow-sm px-5 py-4 mb-6 sticky top-3 z-20 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/sppbj" className="text-xs text-slate-500 hover:text-[#16357f]">‹ SPPBJ</Link>
          <h1 className="text-xl font-extrabold asdp-text-gradient">Input SPPBJ</h1>
          <p className="text-xs text-slate-500">{req.items.length} item · {bulanTahun(req.tanggal)} · estimasi {rupiah(total)}</p>
        </div>
        <button onClick={saveRemote} disabled={saving} className="asdp-gradient text-white text-sm font-semibold px-5 py-2 rounded-xl shadow">{saving ? "…" : "💾 Simpan"}</button>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="h-7 w-7 rounded-lg asdp-gradient text-white grid place-items-center text-xs font-bold">1</span>
        <h2 className="font-bold text-slate-700">FASE 1 — SPPBJ &amp; FORMAT SAP</h2>
      </div>

      <Section title="Data Pengadaan" icon="📑">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Tanggal (bulan & tahun dipakai)"><Input type="date" value={req.tanggal} onChange={(e) => update({ tanggal: e.target.value })} /></Field>
          <Field label="No. SPPB/J (kosong = isi manual)"><Input value={req.noSPPBJ} onChange={(e) => update({ noSPPBJ: e.target.value })} placeholder="biarkan kosong" /></Field>
          <Field label="No. DRP (cari deskripsi)"><DrpPicker value={req.noDRP} onChange={(v) => update({ noDRP: v })} /></Field>
          <Field label="Nama Pengadaan"><Input value={req.namaPengadaan} onChange={(e) => update({ namaPengadaan: e.target.value })} /></Field>
          <Field label="Dasar Pelimpahan (= KAK poin A)"><Input value={req.dasarPelimpahan} onChange={(e) => update({ dasarPelimpahan: e.target.value })} /></Field>
          <Field label="Staf Teknik (TTD)">
            <Input list="stafList" value={req.stafTeknik} onChange={(e) => update({ stafTeknik: e.target.value })} />
            <datalist id="stafList">{STAF_TEKNIK.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Dept. Head (TTD)"><Input value={req.deptHead} onChange={(e) => update({ deptHead: e.target.value })} placeholder={DEPT_HEAD} /></Field>
          <Field label="Jenis Pengadaan (FORMAT SAP kolom I)">
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" value={req.jenisPengadaan || (/jasa/i.test(req.namaPengadaan) ? "jasa" : "barang")} onChange={(e) => update({ jenisPengadaan: e.target.value as any })}>
              <option value="barang">Barang (kolom I kosong)</option>
              <option value="jasa">Jasa (kolom I = D)</option>
            </select>
          </Field>
          <Field label="Matl Group (FORMAT SAP — dari DATABASE)">
            <Input list="matlList" value={req.matlGroup || ""} onChange={(e) => update({ matlGroup: e.target.value.toUpperCase() })} placeholder="cari kode / nama, mis. B02001" />
            <datalist id="matlList">{MATL_GROUP.map((r) => <option key={r.kode} value={r.kode}>{r.kode} — {r.nama}</option>)}</datalist>
          </Field>
        </div>
        <div className="mt-4">
          <span className="text-xs font-medium text-slate-600">Mata Anggaran (boleh &gt;1)</span>
          <div className="grid sm:grid-cols-2 gap-1 mt-1">
            {MATA_ANGGARAN.map((ma) => (
              <label key={ma} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={req.mataAnggaran.includes(ma)} onChange={() => toggleMA(ma)} /> {ma}
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section title={`Item SPPBJ (${req.items.length}) — multi kapal · harga ESTIMASI`} icon="🛠️">
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-3 text-sm text-slate-700">
          <b className="text-sky-800">📋 Paste dari Excel:</b> urutan <b>Kapal · Jumlah · Satuan · Nama Barang/Jasa · Spesifikasi · Harga</b> → klik sel → <kbd className="px-1.5 py-0.5 bg-white border rounded">Ctrl+V</kbd>. Item dengan kapal sama dikelompokkan + dibuat sheet BSTB-nya nanti.
        </div>
        <datalist id="kapalListSppbj">{KAPAL_LIST.map((k) => <option key={k} value={k} />)}</datalist>
        <div className="mb-2">
          <button onClick={() => addItem()} className="bg-[#16357f] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90">＋ Tambah Item</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-slate-50 text-xs">
              <tr><th className="p-2 border w-8">No</th><th className="p-2 border">Kapal</th><th className="p-2 border">Jml</th><th className="p-2 border">Sat</th><th className="p-2 border text-left">Nama Barang/Jasa</th><th className="p-2 border text-left">Spesifikasi</th><th className="p-2 border">Harga Satuan</th><th className="p-2 border">Jumlah</th><th className="p-2 border"></th></tr>
            </thead>
            <tbody>
              {req.items.map((it, ri) => (
                <Fragment key={it.id}>
                {ri > 0 && it.kapal.trim() !== (req.items[ri - 1].kapal || "").trim() &&
                  <tr aria-hidden><td colSpan={9} className="h-3 bg-slate-100/60"></td></tr>}
                {(it.keterangan || "") !== (ri > 0 ? req.items[ri - 1].keterangan || "" : "") &&
                  ketLines(it).map((kl, ki) => (
                    <tr key={"kt" + ki}><td className="border p-1"></td><td colSpan={8} className="border p-1 font-bold text-slate-700 bg-amber-50">{kl}</td></tr>
                  ))}
                <tr>
                  <td className="border p-1 text-center text-slate-400">{ri + 1}</td>
                  <td className="border p-1"><input list="kapalListSppbj" className="w-28 px-1" value={it.kapal} onChange={(e) => setItem(it.id, { kapal: e.target.value })} onPaste={(e) => handlePaste(ri, 0, e)} /></td>
                  <td className="border p-1"><input type="number" className="w-14 px-1 text-center" value={it.jumlah} onChange={(e) => setItem(it.id, { jumlah: +e.target.value })} onPaste={(e) => handlePaste(ri, 1, e)} /></td>
                  <td className="border p-1"><input className="w-14 px-1 text-center" value={it.satuan} onChange={(e) => setItem(it.id, { satuan: e.target.value })} onPaste={(e) => handlePaste(ri, 2, e)} /></td>
                  <td className="border p-1"><input className="w-48 px-1" value={it.nama} onChange={(e) => setItem(it.id, { nama: e.target.value })} onPaste={(e) => handlePaste(ri, 3, e)} /></td>
                  <td className="border p-1"><input className="w-36 px-1" value={it.spesifikasi} onChange={(e) => setItem(it.id, { spesifikasi: e.target.value })} onPaste={(e) => handlePaste(ri, 4, e)} /></td>
                  <td className="border p-1"><input type="number" className="w-28 px-1 text-right" value={it.harga} onChange={(e) => setItem(it.id, { harga: +e.target.value })} onPaste={(e) => handlePaste(ri, 5, e)} /></td>
                  <td className="border p-1 text-right text-slate-500 w-28">{rupiah(it.harga * it.jumlah)}</td>
                  <td className="border p-1 text-center whitespace-nowrap">
                    <button onClick={() => setOpenBd((o) => ({ ...o, [it.id]: !o[it.id] }))} className={`text-xs px-2 py-0.5 rounded border mr-1 ${(it.breakdown?.length || it.keterangan) ? "bg-sky-100 border-sky-300 text-sky-700" : "border-slate-300 text-sky-600"}`}>＋ ket/rincian</button>
                    <button onClick={() => delItem(it.id)} className="text-red-500 text-xs px-1.5 py-0.5 rounded border border-red-200">hapus</button>
                  </td>
                </tr>
                {openBd[it.id] && (
                  <tr>
                    <td className="border p-1"></td>
                    <td className="border p-1" colSpan={8}>
                      <p className="text-[11px] text-amber-700 mb-1 mt-1">Keterangan / header DI ATAS item (mis. <b>ME : YANMAR…</b> atau <b>CAT BAWAH GARIS AIR</b>). 1 baris = 1 header. Item dgn keterangan sama & berurutan dikelompokkan:</p>
                      <textarea rows={2} className="w-full text-xs border rounded p-1 bg-amber-50" placeholder={"CAT BAWAH GARIS AIR\nBOTTOM"}
                        value={it.keterangan || ""} onChange={(e) => setItem(it.id, { keterangan: e.target.value })} />
                      <p className="text-[11px] text-slate-500 mb-1 mt-2">Rincian / breakdown (1 baris = 1 poin, DI BAWAH item — tak perlu tanda "-"):</p>
                      <textarea rows={3} className="w-full text-xs border rounded p-1" placeholder={"Fabrikasi lidah stopper baru, plat t=20mm\nPengelasan retak struktur"}
                        value={(it.breakdown || []).join("\n")}
                        onChange={(e) => setItem(it.id, { breakdown: e.target.value.split("\n") })} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
              <tr className="bg-slate-50 font-semibold"><td colSpan={7} className="border p-1 text-right">Estimasi (sebelum PPN)</td><td className="border p-1 text-right">{rupiah(total)}</td><td className="border p-1"></td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ===== FASE 2 ===== */}
      <div className="mt-8 mb-3 flex items-center gap-2">
        <span className="h-7 w-7 rounded-lg asdp-gradient text-white grid place-items-center text-xs font-bold">2</span>
        <h2 className="font-bold text-slate-700">FASE 2 — setelah SPBJ (PO) terbit · acuan BSTB &amp; BAPP</h2>
      </div>

      <Section title="Data SPBJ / PO" icon="📥">
        <label className="flex items-center gap-2 text-sm mb-3">
          <input type="checkbox" checked={req.status !== "menunggu_spbj"} onChange={(e) => update({ status: e.target.checked ? "spbj_terbit" : "menunggu_spbj" })} />
          SPBJ (PO) sudah terbit — aktifkan BSTB / BAPP
        </label>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="No. Kontrak / SPBJ (= No. SPBJ)"><Input value={req.noKontrak || ""} onChange={(e) => update({ noKontrak: e.target.value })} placeholder="mis. SPB/J.384/PBJ/ASDP-2026" /></Field>
          <Field label="Tanggal SPBJ"><Input type="date" value={req.tanggalSPBJ || ""} onChange={(e) => update({ tanggalSPBJ: e.target.value })} /></Field>
          <Field label="Tanggal Kontrak"><Input type="date" value={req.tanggalKontrak || ""} onChange={(e) => update({ tanggalKontrak: e.target.value })} /></Field>
          <Field label="Tanggal BAPP"><Input type="date" value={req.tanggalBAPP || ""} onChange={(e) => update({ tanggalBAPP: e.target.value })} /></Field>
          <Field label="Vendor / Rekanan (BAPP)">
            <Input list="vendorList" value={req.vendor || ""} onChange={(e) => update({ vendor: e.target.value })} />
            <datalist id="vendorList">{VENDOR_DB.map((v) => <option key={v.nama} value={v.nama} />)}</datalist>
          </Field>
        </div>
        {kapalUnik(req.items).length > 0 && (
          <div className="mt-4">
            <span className="text-xs font-medium text-slate-600">Penerima BSTB per kapal (default Nakhoda)</span>
            <div className="grid sm:grid-cols-2 gap-2 mt-1">
              {kapalUnik(req.items).map((k) => (
                <Field key={k} label={k}>
                  <Input value={req.penerima?.[k] || ""} placeholder={`Nakhoda ${k}`} onChange={(e) => update({ penerima: { ...(req.penerima || {}), [k]: e.target.value } })} />
                </Field>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5">
          <p className="text-xs font-medium text-slate-600 mb-1">Tabel Item SPBJ — otomatis dari Item SPPBJ di atas. Isi <b>Harga SPBJ</b> (final/PO) → jadi acuan <b>BSTB &amp; BAPP</b>.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-slate-50 text-xs">
                <tr><th className="p-2 border w-8">No</th><th className="p-2 border">Kapal</th><th className="p-2 border">Jml</th><th className="p-2 border">Sat</th><th className="p-2 border text-left">Nama Barang/Jasa</th><th className="p-2 border text-left">Spesifikasi</th><th className="p-2 border">Harga SPBJ</th><th className="p-2 border">Jumlah</th></tr>
              </thead>
              <tbody>
                {req.items.length === 0 && <tr><td colSpan={8} className="p-2 text-center text-slate-400">Belum ada item.</td></tr>}
                {req.items.map((it, ri) => (
                  <Fragment key={it.id}>
                  {ri > 0 && it.kapal.trim() !== (req.items[ri - 1].kapal || "").trim() &&
                    <tr aria-hidden><td colSpan={8} className="h-3 bg-slate-100/60"></td></tr>}
                  {(it.keterangan || "") !== (ri > 0 ? req.items[ri - 1].keterangan || "" : "") &&
                    ketLines(it).map((kl, ki) => (
                      <tr key={"sk" + ki}><td className="border p-1"></td><td colSpan={7} className="border p-1 font-bold text-slate-700 bg-amber-50">{kl}</td></tr>
                    ))}
                  <tr>
                    <td className="border p-1 text-center text-slate-400">{ri + 1}</td>
                    <td className="border p-1 text-slate-500">{it.kapal || "-"}</td>
                    <td className="border p-1 text-center text-slate-500">{it.jumlah}</td>
                    <td className="border p-1 text-center text-slate-500">{it.satuan}</td>
                    <td className="border p-1 text-slate-500 whitespace-pre-line">{namaLengkap(it)}</td>
                    <td className="border p-1 text-slate-500">{it.spesifikasi}</td>
                    <td className="border p-1"><input type="number" className="w-28 px-1 text-right bg-sky-50" value={it.hargaSpbj ?? 0} onChange={(e) => setItem(it.id, { hargaSpbj: +e.target.value })} /></td>
                    <td className="border p-1 text-right text-slate-500 w-28">{rupiah(hargaSpbjOf(it) * it.jumlah)}</td>
                  </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <div className="flex justify-end gap-3">
        <Link href="/sppbj/detail" className="asdp-gradient text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow">Selesai → Generate Dokumen</Link>
      </div>
    </main>
  );
}
