"use client";

import { useState, useRef } from "react";
import { useStore } from "@/lib/store";
import { CrewMember, penerimaanBersih } from "@/lib/types";
import { tanggalIndo, rupiah } from "@/lib/format";
import DocToolbar from "@/components/DocToolbar";
import { ocrNumbers } from "@/lib/ocr";

// "1.256.418" / "Rp 1,256,418" -> 1256418
function parseInt2(s: string): number {
  const digits = (s || "").replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export default function PerhitunganDoc() {
  const { data: d, update } = useStore();
  const [ocrMsg, setOcrMsg] = useState<string>("");
  const brutoRef = useRef<HTMLInputElement>(null);
  const pphRef = useRef<HTMLInputElement>(null);

  const setCrew = (i: number, patch: Partial<CrewMember>) => {
    update({ crew: d.crew.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  };
  const addRow = () => {
    update({ crew: [...d.crew, { no: d.crew.length + 1, nama: "", jabatan: "", nik: "", npwp: "", nilaiBruto: 0, pph21: 0 }] });
  };
  const delRow = (i: number) => {
    update({ crew: d.crew.filter((_, idx) => idx !== i).map((c, idx) => ({ ...c, no: idx + 1 })) });
  };

  // paste dari Excel: kolom = Nama | Jabatan | Nilai Bruto | PPH 21 (mulai dari baris ke-`startRow`)
  const handlePaste = (startRow: number, startCol: number, e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return; // biar paste sel tunggal normal
    e.preventDefault();
    const rows = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((r) => r.split("\t"));
    const cols: (keyof CrewMember)[] = ["nama", "jabatan", "nilaiBruto", "pph21"];
    const next = [...d.crew];
    rows.forEach((cells, ri) => {
      const idx = startRow + ri;
      if (!next[idx]) next[idx] = { no: idx + 1, nama: "", jabatan: "", nik: "", npwp: "", nilaiBruto: 0, pph21: 0 };
      cells.forEach((val, ci) => {
        const field = cols[startCol + ci];
        if (!field) return;
        if (field === "nilaiBruto" || field === "pph21") (next[idx] as any)[field] = parseInt2(val);
        else (next[idx] as any)[field] = val.trim();
      });
    });
    update({ crew: next.map((c, i) => ({ ...c, no: i + 1 })) });
  };

  const handleOcr = async (file: File, field: "nilaiBruto" | "pph21") => {
    setOcrMsg(`Membaca gambar (${field})... 0%`);
    try {
      const nums = await ocrNumbers(file, (p) => setOcrMsg(`Membaca gambar (${field})... ${p}%`));
      if (nums.length === 0) { setOcrMsg("Tidak ada angka terdeteksi. Coba gambar lebih jelas."); return; }
      update({ crew: d.crew.map((c, i) => (i < nums.length ? { ...c, [field]: nums[i] } : c)) });
      setOcrMsg(`✅ ${nums.length} nilai terisi ke kolom ${field === "nilaiBruto" ? "Nilai Bruto" : "PPH 21"}.`);
    } catch (e: any) {
      setOcrMsg("OCR gagal: " + e.message);
    }
  };

  const totalBruto = d.crew.reduce((s, c) => s + c.nilaiBruto, 0);
  const totalPph = d.crew.reduce((s, c) => s + c.pph21, 0);

  const extra = (
    <div className="flex items-center gap-2">
      <input ref={brutoRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleOcr(e.target.files[0], "nilaiBruto")} />
      <input ref={pphRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleOcr(e.target.files[0], "pph21")} />
      <button onClick={() => brutoRef.current?.click()} className="bg-amber-500 text-white text-xs px-3 py-2 rounded-lg">🖼️ OCR Bruto</button>
      <button onClick={() => pphRef.current?.click()} className="bg-amber-600 text-white text-xs px-3 py-2 rounded-lg">🖼️ OCR PPH</button>
    </div>
  );

  const cellInput = "w-full px-1 py-0.5 bg-transparent outline-none focus:bg-amber-50 rounded";

  return (
    <>
      <DocToolbar title="03. Daftar Perhitungan Swakelola" slug="perhitungan" data={d} nativeKind="excel" extra={extra} />
      {ocrMsg && <div className="no-print max-w-[230mm] mx-auto px-4 py-2 text-sm bg-amber-50 text-amber-800 border-b">{ocrMsg}</div>}

      {/* Panel kontrol editor (tidak ikut cetak) */}
      <div className="no-print max-w-[230mm] mx-auto px-4 pt-3">
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm text-slate-700 flex flex-wrap items-center gap-3">
          <span className="font-semibold text-sky-800">📋 Paste dari Excel:</span>
          <span className="text-xs">Blok sel di Excel (kolom <b>Nama · Jabatan · Nilai Bruto · PPH 21</b>) → klik sel di tabel → <kbd className="px-1.5 py-0.5 bg-white border rounded">Ctrl+V</kbd>. Baris dibuat otomatis.</span>
          <button onClick={addRow} className="ml-auto bg-[#16357f] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90">➕ Tambah Baris</button>
        </div>
      </div>

      <div className="print-page text-black">
        <div className="text-center font-bold leading-tight mb-4">
          <div className="text-[13pt]">DAFTAR PERHITUNGAN SWAKELOLA</div>
          <div className="text-[11pt]">{d.namaKapal} — TAHUN {d.tahun}</div>
        </div>

        <table className="doc-table text-[10pt]">
          <thead>
            <tr className="bg-blue-50 font-bold text-center">
              <td className="w-8">NO.</td><td>NAMA</td><td>JABATAN</td><td>NILAI BRUTO</td><td>PPH PSL 21 (5%)</td><td>PENERIMAAN BERSIH</td><td className="w-24 no-print">AKSI</td>
            </tr>
          </thead>
          <tbody>
            {d.crew.map((c, i) => (
              <tr key={i}>
                <td className="text-center">{c.no}</td>
                <td><input className={cellInput} value={c.nama} onChange={(e) => setCrew(i, { nama: e.target.value })} onPaste={(e) => handlePaste(i, 0, e)} /></td>
                <td><input className={cellInput} value={c.jabatan} onChange={(e) => setCrew(i, { jabatan: e.target.value })} onPaste={(e) => handlePaste(i, 1, e)} /></td>
                <td><input className={cellInput + " text-right"} value={c.nilaiBruto ? rupiah(c.nilaiBruto) : ""} onChange={(e) => setCrew(i, { nilaiBruto: parseInt2(e.target.value) })} onPaste={(e) => handlePaste(i, 2, e)} /></td>
                <td><input className={cellInput + " text-right"} value={c.pph21 ? rupiah(c.pph21) : ""} onChange={(e) => setCrew(i, { pph21: parseInt2(e.target.value) })} onPaste={(e) => handlePaste(i, 3, e)} /></td>
                <td className="text-right pr-1">{rupiah(penerimaanBersih(c))}</td>
                <td className="text-center no-print"><button onClick={() => delRow(i)} className="text-red-500 text-xs hover:underline">hapus</button></td>
              </tr>
            ))}
            <tr className="font-bold bg-slate-100">
              <td colSpan={3} className="text-center">JUMLAH</td>
              <td className="text-right pr-1">{rupiah(totalBruto)}</td>
              <td className="text-right pr-1">{rupiah(totalPph)}</td>
              <td className="text-right pr-1">{rupiah(totalBruto - totalPph)}</td>
              <td className="no-print"></td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-end mt-6">Ternate, {tanggalIndo(d.tanggalSelesai)}</div>
        <div className="grid grid-cols-2 mt-4 text-center">
          <div>
            <p>Mengetahui,</p>
            <p>Dept. Head Operasional dan Teknik</p>
            <div className="h-16" />
            <p className="font-bold underline">{d.deptHeadOpsTeknik}</p>
          </div>
          <div>
            <p>Dibuat oleh,</p>
            <p>Staf Teknik</p>
            <div className="h-16" />
            <p className="font-bold underline">{d.stafTeknik || "—"}</p>
          </div>
        </div>
      </div>
    </>
  );
}
