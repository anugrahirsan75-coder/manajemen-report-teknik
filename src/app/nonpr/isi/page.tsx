"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNonpr } from "@/lib/nonpr/store";
import { Field, Input, Section } from "@/components/Field";
import { rupiah } from "@/lib/format";
import { MATA_ANGGARAN_NONPR, VENDOR_NONPR, KAPAL_LIST_NONPR, MAX_NILAI_NONPR } from "@/lib/nonpr/db";
import { NonprItem, emptyNonprItem, kapalUnikNonpr, nonprTotal } from "@/lib/nonpr/types";

export default function NonprIsi() {
  const { req, update, setItem, addItem, delItem, setItems, saveRemote, saving, lastSaved, supabaseReady } = useNonpr();
  const router = useRouter();

  const total = nonprTotal(req.items);
  const over = total > MAX_NILAI_NONPR;
  const kapals = kapalUnikNonpr(req.items);

  const toInt = (s: string) => { const d = (s || "").replace(/[^\d]/g, ""); return d ? parseInt(d, 10) : 0; };
  const PASTE: (keyof NonprItem)[] = ["kapal", "jumlah", "satuan", "nama", "spesifikasi", "harga"];
  const handlePaste = (startRow: number, startCol: number, e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return;
    e.preventDefault();
    const rows = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((r) => r.split("\t"));
    const next = [...req.items];
    rows.forEach((cells, ri) => {
      const idx = startRow + ri;
      if (!next[idx]) next[idx] = emptyNonprItem();
      else next[idx] = { ...next[idx] };
      cells.forEach((val, ci) => {
        const f = PASTE[startCol + ci]; if (!f) return;
        if (f === "jumlah" || f === "harga") (next[idx] as any)[f] = toInt(val);
        else (next[idx] as any)[f] = val.trim();
      });
    });
    setItems(next);
  };

  const setJab = (kapal: string, jab: "KKM" | "Nakhoda") => update({ jabatanByKapal: { ...req.jabatanByKapal, [kapal]: jab } });

  const onFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 2);
    const urls = await Promise.all(files.map((f) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f); })));
    update({ fotoDokumentasi: urls });
  };

  const simpan = async () => { await saveRemote(); };
  const simpanLanjut = async () => { await saveRemote(); router.push("/nonpr/detail"); };

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <div className="glass rounded-2xl border border-slate-100 shadow-sm px-5 py-4 mb-6 sticky top-3 z-20 flex items-center justify-between gap-3">
        <div>
          <Link href="/nonpr" className="text-xs text-slate-500 hover:text-[#16357f]">‹ SPPBJ Non PR PO</Link>
          <h1 className="text-xl font-extrabold asdp-text-gradient">Input Pengadaan Non PR PO</h1>
          <p className="text-xs text-slate-500">{req.items.length} item · {kapals.length} kapal · total <b className={over ? "text-red-600" : "text-slate-700"}>{rupiah(total)}</b></p>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && <span className="text-[11px] text-slate-400">{lastSaved}</span>}
          <button onClick={simpan} disabled={saving} className="text-sm border px-3 py-1.5 rounded-lg disabled:opacity-60">{saving ? "Menyimpan…" : "💾 Simpan"}</button>
          <button onClick={simpanLanjut} disabled={saving} className="asdp-gradient text-white text-sm font-semibold px-4 py-1.5 rounded-lg shadow disabled:opacity-60">Simpan → Generate</button>
        </div>
      </div>

      {over && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-5">⚠️ Total <b>{rupiah(total)}</b> melebihi batas <b>Rp {rupiah(MAX_NILAI_NONPR)}</b> per file Non PR PO. Pecah jadi beberapa pengadaan.</div>}

      <Section title="Data Pengadaan" icon="🧾">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Tanggal SPPB"><Input type="date" value={req.tanggal} onChange={(e) => update({ tanggal: e.target.value })} /></Field>
          <Field label="No. SPPB (nomor awal saja, mis 051)"><Input value={req.noSPPB} onChange={(e) => update({ noSPPB: e.target.value })} placeholder="051" /></Field>
          <Field label="Mata Anggaran">
            <Input list="maList" value={req.mataAnggaran} onChange={(e) => update({ mataAnggaran: e.target.value })} placeholder="pilih / ketik" />
            <datalist id="maList">{MATA_ANGGARAN_NONPR.map((m) => <option key={m.kode} value={m.label} />)}</datalist>
          </Field>
          <Field label="Nama Pengadaan"><Input value={req.namaPengadaan} onChange={(e) => update({ namaPengadaan: e.target.value })} placeholder="Jasa Perbaikan ... KMP ... Bulan 2026" /></Field>
          <Field label="Dasar Pelimpahan (jika ada)"><Input value={req.dasarPelimpahan} onChange={(e) => update({ dasarPelimpahan: e.target.value })} /></Field>
          <Field label="Vendor (Surat Pernyataan Harga)">
            <Input list="vendorList" value={req.vendor} onChange={(e) => update({ vendor: e.target.value })} placeholder="pilih vendor" />
            <datalist id="vendorList">{VENDOR_NONPR.map((v) => <option key={v.nama} value={v.nama}>{v.nama} — {v.telp}</option>)}</datalist>
          </Field>
          <Field label="Staf Teknik"><Input value={req.stafTeknik} onChange={(e) => update({ stafTeknik: e.target.value })} /></Field>
        </div>
        <p className="text-xs text-slate-400 mt-2">No. SPPB final = {req.noSPPB || "###"}/SPPB/TTE/(romawi bulan)/ASDP-{req.tanggal.slice(0, 4)}.</p>
      </Section>

      <Section title={`Item Pengadaan (${req.items.length})`} icon="📦">
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-3 text-sm text-slate-700">
          <b className="text-sky-800">📋 Paste dari Excel</b> (urutan <b>Kapal · Jumlah · Satuan · Nama · Spesifikasi · Harga</b>) → klik sel → <kbd className="px-1.5 py-0.5 bg-white border rounded">Ctrl+V</kbd>.
        </div>
        <button onClick={() => addItem()} className="mb-3 text-sm border px-3 py-1.5 rounded-lg">+ Tambah Item</button>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-slate-50 text-xs">
              <tr>
                <th className="p-2 border w-8">#</th>
                <th className="p-2 border">Kapal</th>
                <th className="p-2 border">Jml</th>
                <th className="p-2 border">Sat</th>
                <th className="p-2 border text-left">Nama Barang/Jasa</th>
                <th className="p-2 border text-left">Spesifikasi</th>
                <th className="p-2 border">Harga Satuan</th>
                <th className="p-2 border">Jumlah</th>
                <th className="p-2 border"></th>
              </tr>
            </thead>
            <tbody>
              {req.items.map((it, ri) => (
                <tr key={it.id}>
                  <td className="border p-1 text-center text-xs text-slate-400">{ri + 1}</td>
                  <td className="border p-1"><input list="kapalListNonpr" className="w-32 px-1" value={it.kapal} onChange={(e) => setItem(it.id, { kapal: e.target.value })} onPaste={(e) => handlePaste(ri, 0, e)} /></td>
                  <td className="border p-1"><input type="number" className="w-14 px-1 text-center" value={it.jumlah} onChange={(e) => setItem(it.id, { jumlah: +e.target.value })} onPaste={(e) => handlePaste(ri, 1, e)} /></td>
                  <td className="border p-1"><input className="w-14 px-1 text-center" value={it.satuan} onChange={(e) => setItem(it.id, { satuan: e.target.value })} onPaste={(e) => handlePaste(ri, 2, e)} /></td>
                  <td className="border p-1"><input className="w-48 px-1" value={it.nama} onChange={(e) => setItem(it.id, { nama: e.target.value })} onPaste={(e) => handlePaste(ri, 3, e)} /></td>
                  <td className="border p-1"><input className="w-40 px-1" value={it.spesifikasi} onChange={(e) => setItem(it.id, { spesifikasi: e.target.value })} onPaste={(e) => handlePaste(ri, 4, e)} /></td>
                  <td className="border p-1"><input type="number" className="w-28 px-1 text-right" value={it.harga} onChange={(e) => setItem(it.id, { harga: +e.target.value })} onPaste={(e) => handlePaste(ri, 5, e)} /></td>
                  <td className="border p-1 text-right text-slate-600 w-28">{rupiah(it.harga * it.jumlah)}</td>
                  <td className="border p-1 text-center"><button onClick={() => delItem(it.id)} className="text-red-500 text-xs">hapus</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="kapalListNonpr">{KAPAL_LIST_NONPR.map((k) => <option key={k} value={k} />)}</datalist>
        </div>
      </Section>

      {kapals.length > 0 && (
        <Section title="Penerima BSTB per Kapal" icon="🚢">
          <p className="text-xs text-slate-500 mb-3">Pilih jabatan penerima (Kepada Yth + nama otomatis dari Database). Tiap kapal = 1 sheet BSTB.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {kapals.map((k) => {
              const jab = req.jabatanByKapal?.[k] === "Nakhoda" ? "Nakhoda" : "KKM";
              return (
                <div key={k} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">{k}</span>
                  <div className="flex gap-1">
                    {(["KKM", "Nakhoda"] as const).map((j) => (
                      <button key={j} onClick={() => setJab(k, j)} className={`text-xs px-2.5 py-1 rounded-lg border ${jab === j ? "asdp-gradient text-white border-transparent" : "text-slate-600"}`}>{j}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Dokumentasi (Foto, maks 2)" icon="📷">
        <input type="file" accept="image/*" multiple onChange={onFoto} className="text-sm" />
        {!!req.fotoDokumentasi?.length && (
          <div className="flex gap-3 mt-3">
            {req.fotoDokumentasi.map((u, i) => <img key={i} src={u} alt={`foto ${i + 1}`} className="h-24 w-32 object-cover rounded-lg border" />)}
          </div>
        )}
      </Section>

      {!supabaseReady && <p className="text-xs text-amber-600">Supabase tak aktif — data tersimpan lokal di browser.</p>}
    </main>
  );
}
