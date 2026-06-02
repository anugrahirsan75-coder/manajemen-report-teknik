"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { Field, Input, Select, Section } from "@/components/Field";
import { CrewMember, formatNomorSpk, penerimaanBersih } from "@/lib/types";
import { rupiah } from "@/lib/format";

export default function IsiData() {
  const { data, update, saveRemote, loadRemote, saving, supabaseReady, lastSaved } = useStore();

  const setCrew = (i: number, patch: Partial<CrewMember>) => {
    const crew = data.crew.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    update({ crew });
  };
  const addCrew = () => {
    update({
      crew: [...data.crew, { no: data.crew.length + 1, nama: "", jabatan: "", nik: "", npwp: "", nilaiBruto: 0, pph21: 0 }],
    });
  };
  const delCrew = (i: number) => {
    update({ crew: data.crew.filter((_, idx) => idx !== i).map((c, idx) => ({ ...c, no: idx + 1 })) });
  };

  const totalBruto = data.crew.reduce((s, c) => s + (c.nilaiBruto || 0), 0);
  const totalPph = data.crew.reduce((s, c) => s + (c.pph21 || 0), 0);

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <div className="glass rounded-2xl border border-slate-100 shadow-sm px-5 py-4 mb-6 flex flex-wrap items-center justify-between gap-3 sticky top-3 z-20">
        <div>
          <Link href="/" className="text-xs text-slate-500 hover:text-[#16357f] inline-flex items-center gap-1"><span className="text-base leading-none">‹</span> Dashboard</Link>
          <h1 className="text-xl font-extrabold asdp-text-gradient">Isi Data Proyek Swakelola</h1>
          <p className="text-xs text-slate-500 font-mono">{formatNomorSpk(data)}</p>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && <span className="text-xs text-slate-400">✓ {lastSaved}</span>}
          {supabaseReady && (
            <button onClick={loadRemote} disabled={saving} className="text-sm border border-slate-300 px-3 py-2 rounded-xl hover:bg-slate-50 transition">
              Muat Terakhir
            </button>
          )}
          <button onClick={saveRemote} disabled={saving} className="asdp-gradient text-white text-sm font-semibold px-5 py-2 rounded-xl shadow-md hover:opacity-95 disabled:opacity-50 transition">
            {saving ? "Menyimpan…" : "💾 Simpan"}
          </button>
        </div>
      </div>

      <Section title="Identitas SPK & Kapal" icon="🚢">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Nomor SPK (angka saja)">
            <Input value={data.nomorSpk} onChange={(e) => update({ nomorSpk: e.target.value })} />
          </Field>
          <Field label="Tahun">
            <Input type="number" value={data.tahun} onChange={(e) => update({ tahun: +e.target.value })} />
          </Field>
          <Field label="Nomor SPK lengkap (otomatis)">
            <Input value={formatNomorSpk(data)} readOnly className="bg-slate-50 text-slate-500" />
          </Field>
          <Field label="Nama Kapal">
            <Input value={data.namaKapal} onChange={(e) => update({ namaKapal: e.target.value })} />
          </Field>
          <Field label="NPWP Kapal">
            <Input value={data.npwpKapal} onChange={(e) => update({ npwpKapal: e.target.value })} />
          </Field>
          <Field label="Cost Center">
            <Input value={data.costCenter} onChange={(e) => update({ costCenter: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Tanggal & Biaya" icon="📅">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Tanggal Mulai (file SPK)">
            <Input type="date" value={data.tanggalMulai} onChange={(e) => update({ tanggalMulai: e.target.value })} />
          </Field>
          <Field label="Tanggal Selesai (BA, Lampiran, SPKH)">
            <Input type="date" value={data.tanggalSelesai} onChange={(e) => update({ tanggalSelesai: e.target.value })} />
          </Field>
          <Field label="Biaya Pekerjaan / Nilai Swakelola (Rp)">
            <Input type="number" value={data.biayaPekerjaan} onChange={(e) => update({ biayaPekerjaan: +e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Pejabat & Perwira Kapal" icon="👤">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="General Manager"><Input value={data.generalManager} onChange={(e) => update({ generalManager: e.target.value })} /></Field>
          <Field label="Dept. Head Operasional dan Teknik"><Input value={data.deptHeadOpsTeknik} onChange={(e) => update({ deptHeadOpsTeknik: e.target.value })} /></Field>
          <Field label="NIK Dept. Head"><Input value={data.nikDeptHead} onChange={(e) => update({ nikDeptHead: e.target.value })} /></Field>
          <Field label="Staf Teknik"><Input value={data.stafTeknik} onChange={(e) => update({ stafTeknik: e.target.value })} /></Field>
          <Field label="Nakhoda / Kapten"><Input value={data.nakhoda} onChange={(e) => update({ nakhoda: e.target.value })} /></Field>
          <Field label="KKM (Masinis I)"><Input value={data.kkm} onChange={(e) => update({ kkm: e.target.value })} /></Field>
          <Field label="Owner Surveyor (OS)"><Input value={data.ownerSurveyor} onChange={(e) => update({ ownerSurveyor: e.target.value })} /></Field>
          <Field label="Muallim I"><Input value={data.muallimI} onChange={(e) => update({ muallimI: e.target.value })} /></Field>
        </div>
      </Section>

      <Section title="Pekerjaan Mesin (GO / TO)" icon="⚙️">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Mesin Induk (ME)">
            <Select value={data.mesinME} onChange={(e) => update({ mesinME: e.target.value as any })}>
              <option value="GO">GO — General Overhoul</option>
              <option value="TO">TO — Top Overhoul</option>
            </Select>
          </Field>
          <Field label="Tipe / Nama ME"><Input value={data.namaME} onChange={(e) => update({ namaME: e.target.value })} /></Field>
          <Field label="Mesin Bantu (AE)">
            <Select value={data.mesinAE} onChange={(e) => update({ mesinAE: e.target.value as any })}>
              <option value="GO">GO — General Overhoul</option>
              <option value="TO">TO — Top Overhoul</option>
            </Select>
          </Field>
          <Field label="Tipe / Nama AE"><Input value={data.namaAE} onChange={(e) => update({ namaAE: e.target.value })} /></Field>
        </div>
      </Section>

      <Section title="Data SPM (Nominatif PPH 21)" icon="🧾">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Tanggal SPM"><Input type="date" value={data.tanggalSpm} onChange={(e) => update({ tanggalSpm: e.target.value })} /></Field>
          <Field label="Nomor SPM"><Input value={data.nomorSpm} onChange={(e) => update({ nomorSpm: e.target.value })} /></Field>
          <Field label="No. Daftar Nominatif"><Input value={data.noDafnom} onChange={(e) => update({ noDafnom: e.target.value })} /></Field>
        </div>
      </Section>

      <Section title={`Crew Kapal (${data.crew.length})`} icon="👥">
        <p className="text-xs text-slate-500 mb-3">
          Nilai Bruto & PPH 21 bisa diisi manual, atau pakai tombol OCR di dokumen <b>Daftar Perhitungan</b>. Penerimaan Bersih = otomatis.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-slate-50 text-xs">
              <tr>
                <th className="p-2 border">No</th>
                <th className="p-2 border text-left">Nama</th>
                <th className="p-2 border text-left">Jabatan</th>
                <th className="p-2 border">NIK</th>
                <th className="p-2 border">NPWP</th>
                <th className="p-2 border">Nilai Bruto</th>
                <th className="p-2 border">PPH 21</th>
                <th className="p-2 border">Bersih</th>
                <th className="p-2 border"></th>
              </tr>
            </thead>
            <tbody>
              {data.crew.map((c, i) => (
                <tr key={i}>
                  <td className="border p-1 text-center w-8">{c.no}</td>
                  <td className="border p-1"><input className="w-40 px-1" value={c.nama} onChange={(e) => setCrew(i, { nama: e.target.value })} /></td>
                  <td className="border p-1"><input className="w-32 px-1" value={c.jabatan} onChange={(e) => setCrew(i, { jabatan: e.target.value })} /></td>
                  <td className="border p-1"><input className="w-24 px-1" value={c.nik} onChange={(e) => setCrew(i, { nik: e.target.value })} /></td>
                  <td className="border p-1"><input className="w-32 px-1" value={c.npwp} onChange={(e) => setCrew(i, { npwp: e.target.value })} /></td>
                  <td className="border p-1"><input type="number" className="w-24 px-1 text-right" value={c.nilaiBruto} onChange={(e) => setCrew(i, { nilaiBruto: +e.target.value })} /></td>
                  <td className="border p-1"><input type="number" className="w-20 px-1 text-right" value={c.pph21} onChange={(e) => setCrew(i, { pph21: +e.target.value })} /></td>
                  <td className="border p-1 text-right text-slate-500 w-24">{rupiah(penerimaanBersih(c))}</td>
                  <td className="border p-1 text-center"><button onClick={() => delCrew(i)} className="text-red-500 text-xs">hapus</button></td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="border p-1" colSpan={5}>JUMLAH</td>
                <td className="border p-1 text-right">{rupiah(totalBruto)}</td>
                <td className="border p-1 text-right">{rupiah(totalPph)}</td>
                <td className="border p-1 text-right">{rupiah(totalBruto - totalPph)}</td>
                <td className="border p-1"></td>
              </tr>
            </tbody>
          </table>
        </div>
        <button onClick={addCrew} className="mt-3 text-sm border px-3 py-1.5 rounded-lg">+ Tambah Crew</button>
      </Section>

      <div className="flex justify-end gap-3">
        <Link href="/" className="border px-4 py-2 rounded-lg text-sm">Selesai</Link>
        <button onClick={saveRemote} disabled={saving} className="bg-[#0b4d8c] text-white text-sm px-5 py-2 rounded-lg">Simpan</button>
      </div>
    </main>
  );
}
