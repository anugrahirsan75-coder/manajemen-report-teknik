"use client";
/**
 * Kendali "Persetujuan Biaya Lainnya" — persetujuan pusat di LUAR Docking & Rutin.
 * 1 surat = 1 program (mis. Investasi Sarana Hiburan, Pemenuhan Uji Petik & SMC).
 * Isi program: baris per KAPAL x Mata Anggaran dgn nilai Persetujuan Pusat (pagu)
 * + Addendum bila ada persetujuan tambahan.
 */
import { Fragment, useMemo, useState } from "react";
import { PengadaanRow, realisasiProgram, RealisasiItem } from "@/lib/anggaran/store";
import { PlafonProgram, ProgramRow, KAPAL_ANGGARAN, MATA_ANGGARAN, fullMA, maKey, namaKapalPenuh, isMaInvestasi } from "@/lib/anggaran/types";
import { pecahKapal, ringkasKapal } from "@/lib/kapal/nama";
import { rupiah, tanggalIndo } from "@/lib/format";

const idBaru = () => globalThis.crypto?.randomUUID?.() ?? String(Math.random()).slice(2);

/**
 * Tempel dari tabel surat/Excel. Tiap baris: teks (kapal &/ mata anggaran) + angka.
 * Angka PALING KANAN diambil sebagai nilai persetujuan pusat (pagu) — kolom RKA/usulan diabaikan.
 * Baris tanpa angka dipakai sebagai KAPAL berjalan (mis. "KMP. Ngafi" sebagai judul kelompok).
 */
export function parseProgramPaste(teks: string): ProgramRow[] {
  const out: ProgramRow[] = [];
  let kapalAktif = "";
  for (const brs of (teks || "").split(/\r?\n/)) {
    let b = brs.replace(/ /g, " ").trim();
    if (!b) continue;
    if (/^(grand\s*)?total|^jumlah|^no\b|^uraian|^mata anggaran|^keterangan/i.test(b)) continue;
    // buang nomor urut di awal baris ("1  KMP. Ngafi", "10\tKMP. Lema") biar tak terbaca sebagai nilai
    b = b.replace(/^\s*\d{1,3}\s*[.)\]]?\s*(?=[A-Za-z(])/, "").replace(/^\s*[IVXLC]+\s+(?=[A-Za-z])/, "").trim();
    // angka: "-" dan "0" dihitung NOL (di surat sering ditulis bergaris)
    const token = b.match(/(?:Rp\s*)?(?:-|\d[\d.,]*)/g) || [];
    const angka = token
      .map((x) => (/^-+$/.test(x.replace(/Rp\s*/i, "").trim()) ? 0 : parseInt(x.replace(/[^\d]/g, ""), 10)))
      .filter((n) => Number.isFinite(n));
    const teksSaja = b.replace(/Rp/gi, " ").replace(/(?:-|\d[\d.,]*)/g, " ").replace(/\s+/g, " ").trim();
    const kapalBaris = pecahKapal(teksSaja)[0] || "";
    if (!angka.length) { if (kapalBaris) kapalAktif = kapalBaris; continue; }
    if (kapalBaris) kapalAktif = kapalBaris;
    // buang nama kapal dari teks MA biar rapi
    let ma = teksSaja;
    if (kapalBaris) ma = ma.replace(new RegExp(ringkasKapal(kapalBaris).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "").replace(/^kmp\.?\s*/i, "").trim();
    ma = ma.replace(/^[|.\s]+|[|.\s]+$/g, "").trim();
    if (!ma && !kapalAktif) continue;
    // Angka TERAKHIR tiap baris = nilai yang disetujui pusat (kolom paling kanan di surat).
    const row: ProgramRow = { kapal: kapalAktif, ma: ma || "(tanpa MA)", nilai: angka[angka.length - 1] };
    // baris tanpa keterangan MA dan tanpa nilai -> lewati (biasanya sisa header)
    if (!ma && !row.nilai) continue;
    out.push(row);
  }
  return out;
}

const STATUS = (pct: number) =>
  pct > 100 ? { c: "bg-red-100 text-red-800 ring-1 ring-red-300", t: "OVERBUDGET", bar: "bg-red-500", num: "text-red-700" }
    : pct >= 80 ? { c: "bg-amber-100 text-amber-800 ring-1 ring-amber-300", t: "Waspada", bar: "bg-amber-500", num: "text-amber-700" }
      : { c: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300", t: "Aman", bar: "bg-emerald-500", num: "text-emerald-700" };

export default function ProgramLainnya({ program, pengadaan, onSave, onExcel, xlsBusy }: {
  program: PlafonProgram[]; pengadaan: PengadaanRow[]; onSave: (p: PlafonProgram[]) => Promise<void>;
  onExcel?: () => void; xlsBusy?: boolean;
}) {
  const [pilih, setPilih] = useState<string>("");
  const aktifId = pilih || program[0]?.id || "";
  const aktif = program.find((p) => p.id === aktifId);

  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<PlafonProgram | null>(null);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);
  const [buka, setBuka] = useState<string | null>(null);
  const [tampil, setTampil] = useState<"kapal" | "ma">("kapal");

  const real = useMemo(() => realisasiProgram(pengadaan, aktifId), [pengadaan, aktifId]);

  // gabung pagu + realisasi per (kapal|MA)
  const baris = useMemo(() => {
    const by: Record<string, { kunci: string; kapal: string; ma: string; pagu: number; add: number; pakai: number; inv: boolean }> = {};
    (aktif?.rows || []).forEach((r) => {
      const kapal = namaKapalPenuh(r.kapal || "") || "(umum)";
      const kunci = `${kapal}|${maKey(r.ma)}`;
      by[kunci] = {
        kunci, kapal, ma: r.ma, inv: isMaInvestasi(maKey(r.ma)),
        pagu: (by[kunci]?.pagu || 0) + (r.nilai || 0), add: (by[kunci]?.add || 0) + (r.addendum || 0), pakai: by[kunci]?.pakai || 0,
      };
    });
    Object.entries(real.perKunci).forEach(([k, v]) => {
      if (by[k]) by[k].pakai = v;
      else {
        const [kapal, kode] = k.split("|");
        by[k] = { kunci: k, kapal, ma: fullMA(kode), pagu: 0, add: 0, pakai: v, inv: isMaInvestasi(kode) };
      }
    });
    return Object.values(by).sort((a, b) => (a.inv === b.inv ? a.kapal.localeCompare(b.kapal) : a.inv ? 1 : -1));
  }, [aktif, real]);

  // rekap lintas kapal: 1 baris per Mata Anggaran
  const perMA = useMemo(() => {
    const by: Record<string, { kunci: string; ma: string; pagu: number; add: number; pakai: number; inv: boolean; kapal: { kapal: string; pagu: number; pakai: number }[] }> = {};
    for (const b of baris) {
      const k = maKey(b.ma) || b.ma;
      if (!by[k]) by[k] = { kunci: k, ma: b.ma, pagu: 0, add: 0, pakai: 0, inv: b.inv, kapal: [] };
      by[k].pagu += b.pagu; by[k].add += b.add; by[k].pakai += b.pakai;
      by[k].kapal.push({ kapal: b.kapal, pagu: b.pagu + b.add, pakai: b.pakai });
    }
    return Object.values(by)
      .map((x) => ({ ...x, kapal: x.kapal.sort((a, b) => b.pagu - a.pagu) }))
      .sort((a, b) => (a.inv === b.inv ? (b.pagu + b.add) - (a.pagu + a.add) : a.inv ? 1 : -1));
  }, [baris]);

  const grup = { biaya: baris.filter((b) => !b.inv), investasi: baris.filter((b) => b.inv) };
  const grupMA = { biaya: perMA.filter((b) => !b.inv), investasi: perMA.filter((b) => b.inv) };
  const jml = (arr: typeof baris) => ({
    pagu: arr.reduce((s, x) => s + x.pagu + x.add, 0),
    pakai: arr.reduce((s, x) => s + x.pakai, 0),
  });
  const totalPagu = jml(baris).pagu;
  const totalPakai = real.total;
  const sisa = totalPagu - totalPakai;
  const pctTot = totalPagu ? Math.round((totalPakai / totalPagu) * 100) : 0;

  const mulaiBaru = () => {
    setDraft({ id: idBaru(), nama: "", tahun: new Date().getFullYear(), rows: [{ kapal: "", ma: "", nilai: 0 }] });
    setEdit(true);
  };
  const mulaiEdit = () => { if (aktif) { setDraft(JSON.parse(JSON.stringify(aktif))); setEdit(true); } };
  const simpan = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const bersih: PlafonProgram = { ...draft, nama: draft.nama.trim() || "(tanpa nama)", rows: (draft.rows || []).filter((r) => (r.ma || "").trim() || r.nilai) };
      const next = program.filter((p) => p.id !== bersih.id);
      next.push(bersih);
      next.sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""));
      await onSave(next);
      setPilih(bersih.id); setEdit(false);
    } finally { setBusy(false); }
  };
  const hapus = async () => {
    if (!aktif) return;
    const tertaut = pengadaan.filter((x) => x.programId === aktif.id);
    const pesan = [
      `Hapus persetujuan "${aktif.nama}"?`,
      `${(aktif.rows || []).length} baris pagu, total ${rupiah(totalPagu)}.`,
      "",
      "Pengadaan/SPPBJ TIDAK ikut terhapus — hanya pagunya.",
      tertaut.length
        ? `⚠ ${tertaut.length} pengadaan masih tertaut ke surat ini dan akan kehilangan kendali pagunya:\n` +
          tertaut.slice(0, 5).map((x) => `  • ${x.nama}`).join("\n") + (tertaut.length > 5 ? `\n  • …(${tertaut.length - 5} lagi)` : "")
        : "",
    ].filter(Boolean).join("\n");
    if (!confirm(pesan)) return;
    await onSave(program.filter((p) => p.id !== aktif.id));
    setPilih("");
  };

  const setDraftRow = (i: number, patch: Partial<ProgramRow>) =>
    setDraft((d) => d ? { ...d, rows: d.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) } : d);

  return (
    <div>
      {/* pilih program */}
      <div className="rounded-xl bg-white ring-1 ring-indigo-200 p-2.5 mb-3">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-800">Pilih persetujuan</span>
          {aktif?.noSurat && !edit && <span className="text-[11px] font-semibold text-indigo-800">No. {aktif.noSurat}</span>}
          {aktif?.tanggal && !edit && <span className="text-[11px] text-slate-500">{tanggalIndo(aktif.tanggal)}</span>}
          <div className="ml-auto flex items-center gap-2">
            {!edit ? (
              <>
                <button onClick={mulaiBaru} className="btn btn-ghost text-xs">➕ Persetujuan Baru</button>
                {onExcel && (
                  <button onClick={onExcel} disabled={xlsBusy} className="btn btn-success text-xs disabled:opacity-50"
                    title="Unduh Excel berjenjang: ringkasan per surat → per Mata Anggaran → per item pengadaan (bertaut)">
                    {xlsBusy ? "menyiapkan…" : "📊 Export Excel"}
                  </button>
                )}
                {aktif && <a href={`/dashboard/cetak?jenis=lainnya&program=${encodeURIComponent(aktif.id)}`} target="_blank" rel="noreferrer" className="btn btn-ghost text-xs">🖨️ Export PDF</a>}
                {aktif && <button onClick={mulaiEdit} className="btn btn-ghost text-xs">✏️ Atur Pagu</button>}
                {aktif && <button onClick={hapus} className="btn btn-ghost text-xs text-red-600">🗑️ Hapus</button>}
              </>
            ) : (
              <>
                <button onClick={() => setPaste("")} className="btn btn-ghost text-xs">📋 Tempel dari Surat/Excel</button>
                <button onClick={simpan} disabled={busy} className="btn btn-primary text-xs">{busy ? "…" : "💾 Simpan"}</button>
                <button onClick={() => setEdit(false)} className="btn btn-ghost text-xs">Batal</button>
              </>
            )}
          </div>
        </div>
        {program.length === 0 ? (
          <p className="text-xs text-slate-500">Belum ada persetujuan. Klik <b>➕ Persetujuan Baru</b>, isi nomor surat & pagu per kapal.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {program.map((p) => (
              <button key={p.id} onClick={() => { setPilih(p.id); setEdit(false); }}
                className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition ${p.id === aktifId ? "bg-indigo-700 text-white border-indigo-700" : "bg-white border-indigo-300 text-indigo-800 hover:border-indigo-500"}`}>
                {p.nama || "(tanpa nama)"} <span className="opacity-70">· {p.tahun}</span>
              </button>
            ))}
          </div>
        )}
        {aktif?.perihal && !edit && <p className="text-[10px] text-slate-500 mt-1.5">{aktif.perihal}</p>}
      </div>

      {edit && draft ? (
        <div className="rounded-xl bg-white ring-1 ring-indigo-200 p-3">
          <div className="grid sm:grid-cols-4 gap-2 mb-3">
            <L label="Nama persetujuan"><input value={draft.nama} onChange={(e) => setDraft({ ...draft, nama: e.target.value })} placeholder="Investasi Sarana Hiburan Kapal 2026" className="w-full text-xs border rounded-lg px-2 py-1.5" /></L>
            <L label="No. surat"><input value={draft.noSurat || ""} onChange={(e) => setDraft({ ...draft, noSurat: e.target.value })} placeholder="TN.205/01044/II/ASDP-2026" className="w-full text-xs border rounded-lg px-2 py-1.5" /></L>
            <L label="Tanggal surat"><input type="date" value={draft.tanggal || ""} onChange={(e) => setDraft({ ...draft, tanggal: e.target.value, tahun: parseInt(e.target.value.slice(0, 4), 10) || draft.tahun })} className="w-full text-xs border rounded-lg px-2 py-1.5" /></L>
            <L label="Tahun anggaran"><input type="number" value={draft.tahun} onChange={(e) => setDraft({ ...draft, tahun: +e.target.value })} className="w-full text-xs border rounded-lg px-2 py-1.5" /></L>
            <L label="KET. di REKAP (opsional)"><input value={draft.ketRekap || ""} onChange={(e) => setDraft({ ...draft, ketRekap: e.target.value })} placeholder={draft.nama || "ikut nama persetujuan"} className="w-full text-xs border rounded-lg px-2 py-1.5" /></L>
            <div className="sm:col-span-3"><L label="Perihal (opsional)"><input value={draft.perihal || ""} onChange={(e) => setDraft({ ...draft, perihal: e.target.value })} placeholder="Persetujuan Investasi Sarana Hiburan Di Atas Kapal Cabang Ternate Tahun 2026" className="w-full text-xs border rounded-lg px-2 py-1.5" /></L></div>
          </div>

          <div className="flex items-center gap-2 mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <span className="w-40">Kapal</span><span className="flex-1">Mata Anggaran</span>
            <span className="w-44 text-right text-indigo-700">Persetujuan Pusat (Pagu)</span>
            <span className="w-32 text-right text-violet-700">Addendum</span><span className="w-4" />
          </div>
          {draft.rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <input list="kapalProgram" value={r.kapal} onChange={(e) => setDraftRow(i, { kapal: e.target.value })} placeholder="semua/umum" className="w-40 text-xs border rounded-lg px-2 py-1.5" />
              <input list="maProgram" value={r.ma} onChange={(e) => setDraftRow(i, { ma: e.target.value })} placeholder="Mata Anggaran" className="flex-1 text-xs border rounded-lg px-2 py-1.5" />
              <input type="number" value={r.nilai || ""} onChange={(e) => setDraftRow(i, { nilai: +e.target.value })} placeholder="0" className="w-44 text-xs border border-indigo-300 bg-indigo-50/40 rounded-lg px-2 py-1.5 text-right font-semibold" />
              <input type="number" value={r.addendum || ""} onChange={(e) => setDraftRow(i, { addendum: +e.target.value })} placeholder="0" className="w-32 text-xs border border-violet-300 bg-violet-50/40 rounded-lg px-2 py-1.5 text-right" />
              <button onClick={() => setDraft({ ...draft, rows: draft.rows.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
            </div>
          ))}
          <datalist id="kapalProgram">{KAPAL_ANGGARAN.map((k) => <option key={k} value={k} />)}</datalist>
          <datalist id="maProgram">{MATA_ANGGARAN.map((m) => <option key={m.kode} value={fullMA(m.kode)} />)}</datalist>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => setDraft({ ...draft, rows: [...draft.rows, { kapal: "", ma: "", nilai: 0 }] })} className="text-xs text-indigo-700 font-semibold hover:underline">+ baris</button>
            <button onClick={() => setDraft({ ...draft, rows: [...draft.rows, ...KAPAL_ANGGARAN.map((k) => ({ kapal: k, ma: draft.rows[0]?.ma || "", nilai: 0 }))] })} className="text-xs text-indigo-700 font-semibold hover:underline">+ 13 kapal sekaligus</button>
            <span className="text-[10px] text-slate-500 ml-auto">Isi nilai yang <b>disetujui pusat</b>. Addendum = persetujuan tambahan menyusul.</span>
          </div>
        </div>
      ) : !aktif ? null : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Mini label="Pagu Disetujui" val={rupiah(totalPagu)} tint="text-slate-900" bar="bg-indigo-600" />
            <Mini label="Terpakai" val={rupiah(Math.round(totalPakai))} tint="text-blue-800" bar="bg-blue-600" />
            <Mini label="Sisa" val={rupiah(Math.round(sisa))} tint={sisa < 0 ? "text-red-700" : "text-emerald-800"} bar={sisa < 0 ? "bg-red-500" : "bg-emerald-500"} />
            <Mini label="Serapan" val={`${pctTot}%`} tint={pctTot > 100 ? "text-red-700" : "text-slate-900"} bar={pctTot > 100 ? "bg-red-500" : pctTot >= 80 ? "bg-amber-500" : "bg-emerald-500"} />
          </div>

          <div className="flex items-center gap-1 mb-2">
            {([["kapal", "Per Kapal"], ["ma", `Per Mata Anggaran (${perMA.length})`]] as const).map(([v, t]) => (
              <button key={v} onClick={() => { setTampil(v); setBuka(null); }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${tampil === v ? "bg-indigo-700 text-white border-indigo-700" : "bg-white border-indigo-300 text-indigo-800 hover:border-indigo-500"}`}>{t}</button>
            ))}
            <span className="text-[10px] text-slate-500 ml-1">{tampil === "ma" ? "total tiap Mata Anggaran digabung dari semua kapal — klik baris utk rincian per kapal" : "pagu per kapal seperti tertulis di surat"}</span>
          </div>

          {tampil === "ma" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-indigo-100/70 text-[11px] uppercase tracking-wide text-indigo-900 font-bold border-b-2 border-indigo-300">
                <tr>
                  <th className="p-2 text-left">Mata Anggaran</th>
                  <th className="p-2 text-center w-20">Kapal</th>
                  <th className="p-2 text-right w-28">Pagu</th>
                  <th className="p-2 text-right w-24 text-violet-800">Addendum</th>
                  <th className="p-2 text-right w-28">Pagu Total</th>
                  <th className="p-2 text-right w-28">Terpakai</th>
                  <th className="p-2 text-right w-28">Sisa</th>
                  <th className="p-2 text-right w-24">Serapan</th>
                  <th className="p-2 text-center w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {([["Biaya", grupMA.biaya], ["Investasi", grupMA.investasi]] as const).flatMap(([judul, arr]) => arr.length === 0 ? [] : [
                  <tr key={"hm" + judul} className={judul === "Biaya" ? "bg-indigo-200/50" : "bg-violet-100"}>
                    <td colSpan={9} className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-900">
                      {judul === "Biaya" ? "Biaya" : "Investasi (belanja modal)"}
                      <span className="ml-2 font-bold normal-case tracking-normal tabular-nums">pagu {rupiah(arr.reduce((t, x) => t + x.pagu + x.add, 0))} · terpakai {rupiah(Math.round(arr.reduce((t, x) => t + x.pakai, 0)))}</span>
                    </td>
                  </tr>,
                  ...arr.map((m) => {
                    const pagu = m.pagu + m.add;
                    const pct = pagu ? Math.round((m.pakai / pagu) * 100) : (m.pakai ? 999 : 0);
                    const st = STATUS(pct);
                    const isOpen = buka === "ma:" + m.kunci;
                    return (
                      <Fragment key={m.kunci}>
                        <tr className={`border-b border-slate-200 row-hover cursor-pointer ${isOpen ? "bg-indigo-50" : "even:bg-indigo-50/30"}`} onClick={() => setBuka(isOpen ? null : "ma:" + m.kunci)}>
                          <td className="p-2 font-semibold text-slate-800">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`text-slate-500 text-[10px] transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                              <span className="block truncate max-w-[22rem]" title={m.ma}>{m.ma}</span>
                            </span>
                          </td>
                          <td className="p-2 text-center"><span className="text-[10px] font-bold text-indigo-900 bg-indigo-100 rounded-full px-2 py-0.5">{m.kapal.length}</span></td>
                          <td className="p-2 text-right tabular-nums whitespace-nowrap text-slate-700">{rupiah(m.pagu)}</td>
                          <td className="p-2 text-right tabular-nums whitespace-nowrap font-bold text-violet-800">{m.add ? "+" + rupiah(m.add) : <span className="text-slate-400 font-normal">—</span>}</td>
                          <td className="p-2 text-right tabular-nums whitespace-nowrap font-semibold text-slate-800">{rupiah(pagu)}</td>
                          <td className="p-2 text-right tabular-nums whitespace-nowrap font-bold text-slate-900">{rupiah(Math.round(m.pakai))}</td>
                          <td className={`p-2 text-right tabular-nums whitespace-nowrap font-bold ${pagu - m.pakai < 0 ? "text-red-700" : "text-emerald-700"}`}>{rupiah(Math.round(pagu - m.pakai))}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-1.5 justify-end">
                              <div className="w-10 h-2 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                <div className={`h-full rounded-full ${pagu ? st.bar : "bg-slate-400"}`} style={{ width: pagu ? `${Math.max(m.pakai > 0 ? 6 : 0, Math.min(100, pct))}%` : "0%" }} />
                              </div>
                              <span className={`text-xs font-bold tabular-nums w-9 text-right ${pagu ? st.num : "text-slate-400"}`}>{pagu ? pct + "%" : "—"}</span>
                            </div>
                          </td>
                          <td className="p-2 text-center"><span className={`inline-block text-[10px] font-extrabold tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap ${pagu ? st.c : "bg-slate-100 text-slate-500 ring-1 ring-slate-300"}`}>{pagu ? st.t : "—"}</span></td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-indigo-50/50">
                            <td colSpan={9} className="px-3 py-2">
                              <table className="w-full text-[11px]">
                                <thead className="text-[9px] uppercase tracking-wide text-slate-500">
                                  <tr><th className="text-left py-1">Kapal</th><th className="text-right py-1 w-32">Pagu</th><th className="text-right py-1 w-32">Terpakai</th><th className="text-right py-1 w-32">Sisa</th></tr>
                                </thead>
                                <tbody>
                                  {m.kapal.map((k) => (
                                    <tr key={k.kapal} className="border-b border-slate-200 last:border-0">
                                      <td className="py-1 pr-2 font-semibold text-slate-800">{ringkasKapal(k.kapal)}</td>
                                      <td className="py-1 pr-2 text-right tabular-nums text-slate-700">{rupiah(k.pagu)}</td>
                                      <td className="py-1 pr-2 text-right tabular-nums font-bold text-slate-900">{rupiah(Math.round(k.pakai))}</td>
                                      <td className="py-1 text-right tabular-nums font-bold text-emerald-700">{rupiah(Math.round(k.pagu - k.pakai))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  }),
                ])}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-100/70 border-t-2 border-indigo-300 font-extrabold text-indigo-950">
                  <td className="p-2" colSpan={2}>TOTAL</td>
                  <td className="p-2 text-right tabular-nums">{rupiah(perMA.reduce((t, x) => t + x.pagu, 0))}</td>
                  <td className="p-2 text-right tabular-nums text-violet-800">{perMA.some((x) => x.add) ? "+" + rupiah(perMA.reduce((t, x) => t + x.add, 0)) : "—"}</td>
                  <td className="p-2 text-right tabular-nums">{rupiah(totalPagu)}</td>
                  <td className="p-2 text-right tabular-nums">{rupiah(Math.round(totalPakai))}</td>
                  <td className={`p-2 text-right tabular-nums ${sisa < 0 ? "text-red-700" : "text-emerald-700"}`}>{rupiah(Math.round(sisa))}</td>
                  <td className="p-2 text-right tabular-nums">{pctTot}%</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[62rem]">
              <thead className="bg-indigo-100/70 text-[11px] uppercase tracking-wide text-indigo-900 font-bold border-b-2 border-indigo-300">
                <tr>
                  <th className="p-2 text-left w-32">Kapal</th>
                  <th className="p-2 text-left">Mata Anggaran</th>
                  <th className="p-2 text-right w-28">Pagu</th>
                  <th className="p-2 text-right w-24 text-violet-800">Addendum</th>
                  <th className="p-2 text-right w-28">Pagu Total</th>
                  <th className="p-2 text-right w-24">Terpakai</th>
                  <th className="p-2 text-right w-28">Sisa</th>
                  <th className="p-2 text-right w-24">Serapan</th>
                  <th className="p-2 text-center w-24">Status</th>
                  <th className="p-2 text-center w-20">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {([["Biaya", grup.biaya], ["Investasi", grup.investasi]] as const).flatMap(([judul, arr]) => arr.length === 0 ? [] : [
                  <tr key={"h" + judul} className={judul === "Biaya" ? "bg-indigo-200/50" : "bg-violet-100"}>
                    <td colSpan={10} className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-900">
                      {judul === "Biaya" ? "Biaya" : "Investasi (belanja modal)"}
                      <span className="ml-2 font-bold normal-case tracking-normal tabular-nums">pagu {rupiah(jml(arr as any).pagu)} · terpakai {rupiah(Math.round(jml(arr as any).pakai))}</span>
                    </td>
                  </tr>,
                  ...(arr as any).map((b: any) => {
                    const pagu = b.pagu + b.add;
                    const pct = pagu ? Math.round((b.pakai / pagu) * 100) : (b.pakai ? 999 : 0);
                    const s = STATUS(pct);
                    const rinci: RealisasiItem[] = real.list.filter((x) => x.key === b.kunci);
                    const isOpen = buka === b.kunci;
                    return (
                      <Fragment key={b.kunci}>
                        <tr className={`border-b border-slate-200 row-hover cursor-pointer ${isOpen ? "bg-indigo-50" : "even:bg-indigo-50/30"}`} onClick={() => setBuka(isOpen ? null : b.kunci)}>
                          <td className="p-2 font-semibold text-slate-800 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`text-slate-500 text-[10px] transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                              {ringkasKapal(b.kapal)}
                              {rinci.length > 0 && <span className="text-[10px] font-bold text-indigo-900 bg-indigo-200 rounded-full px-1.5 py-px">{rinci.length}</span>}
                            </span>
                          </td>
                          <td className="p-2 text-slate-700"><span className="block truncate max-w-[13rem]" title={b.ma}>{b.ma}</span></td>
                          <td className="p-2 text-right tabular-nums whitespace-nowrap text-slate-700">{b.pagu ? rupiah(b.pagu) : <span className="text-slate-400">0</span>}</td>
                          <td className="p-2 text-right tabular-nums whitespace-nowrap font-bold text-violet-800">{b.add ? "+" + rupiah(b.add) : <span className="text-slate-400 font-normal">—</span>}</td>
                          <td className="p-2 text-right tabular-nums whitespace-nowrap font-semibold text-slate-800">{pagu ? rupiah(pagu) : <span className="text-slate-400 font-normal">0</span>}</td>
                          <td className="p-2 text-right tabular-nums whitespace-nowrap font-bold text-slate-900">{rupiah(Math.round(b.pakai))}</td>
                          <td className={`p-2 text-right tabular-nums font-bold ${pagu - b.pakai < 0 ? "text-red-700" : "text-emerald-700"}`}>{rupiah(Math.round(pagu - b.pakai))}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-1.5 justify-end">
                              <div className="w-10 h-2 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                <div className={`h-full rounded-full ${pagu ? s.bar : "bg-slate-400"}`} style={{ width: pagu ? `${Math.max(b.pakai > 0 ? 6 : 0, Math.min(100, pct))}%` : "0%" }} />
                              </div>
                              <span className={`text-xs font-bold tabular-nums w-9 text-right ${pagu ? s.num : "text-slate-400"}`}>{pagu ? pct + "%" : "—"}</span>
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <span className={`inline-block text-[10px] font-extrabold tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap ${pagu ? s.c : "bg-slate-100 text-slate-500 ring-1 ring-slate-300"}`}>{pagu ? s.t : "—"}</span>
                          </td>
                          <td className="p-2 text-center">
                            {pagu - b.pakai > 0 && (
                              <a href={`/sppbj/isi?program=${encodeURIComponent(aktifId)}&kapal=${encodeURIComponent(b.kapal === "(umum)" ? "" : b.kapal)}&ma=${encodeURIComponent(b.ma)}`}
                                onClick={(e) => e.stopPropagation()} title="Buat SPPBJ untuk pos ini"
                                className="inline-block text-[10px] font-bold text-indigo-700 hover:underline whitespace-nowrap">＋ SPPBJ</a>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-indigo-50/50">
                            <td colSpan={10} className="px-3 py-2">
                              {rinci.length === 0 ? <p className="text-[11px] text-slate-500">Belum ada pengadaan yang ditautkan ke pos ini.</p> : (
                                <table className="w-full text-[11px]"><tbody>
                                  {rinci.map((x, i) => (
                                    <tr key={x.id + i} className="border-b border-slate-200 last:border-0">
                                      <td className="py-1 pr-2 w-20"><span className={`px-1.5 py-0.5 rounded font-bold ${x.sumber === "Non PR PO" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"}`}>{x.sumber === "Non PR PO" ? "Non PR PO" : "SPPBJ"}</span></td>
                                      <td className="py-1 pr-2 text-slate-800">{x.nama}</td>
                                      <td className="py-1 pr-2 text-slate-500 whitespace-nowrap w-24">{x.tanggal ? tanggalIndo(x.tanggal) : "—"}</td>
                                      <td className="py-1 text-right font-bold tabular-nums text-slate-900 whitespace-nowrap">{rupiah(Math.round(x.nilai))}</td>
                                    </tr>
                                  ))}
                                </tbody></table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  }),
                ])}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-100/70 border-t-2 border-indigo-300 font-extrabold text-indigo-950">
                  <td className="p-2" colSpan={2}>TOTAL</td>
                  <td className="p-2 text-right tabular-nums">{rupiah(baris.reduce((s2, x) => s2 + x.pagu, 0))}</td>
                  <td className="p-2 text-right tabular-nums text-violet-800">{baris.some((x) => x.add) ? "+" + rupiah(baris.reduce((s2, x) => s2 + x.add, 0)) : "—"}</td>
                  <td className="p-2 text-right tabular-nums">{rupiah(totalPagu)}</td>
                  <td className="p-2 text-right tabular-nums">{rupiah(Math.round(totalPakai))}</td>
                  <td className={`p-2 text-right tabular-nums ${sisa < 0 ? "text-red-700" : "text-emerald-700"}`}>{rupiah(Math.round(sisa))}</td>
                  <td className="p-2 text-right tabular-nums">{pctTot}%</td>
                  <td /><td />
                </tr>
              </tfoot>
            </table>
          </div>
          )}
          <p className="text-[10px] text-slate-500 mt-2">
            Realisasi diambil dari SPPBJ / Non PR PO yang <b>ditautkan ke persetujuan ini</b> (di form: Jenis Anggaran → <b>Lainnya</b>, lalu pilih persetujuannya). Docking & Rutin tetap terpisah, tak dobel hitung.
          </p>
        </>
      )}

      {/* modal tempel */}
      {paste !== null && draft && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/40" onMouseDown={() => setPaste(null)}>
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-5" onMouseDown={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-slate-800 mb-1">Tempel tabel dari Surat Persetujuan / Excel</h4>
            <p className="text-[11px] text-slate-500 mb-2">Salin baris tabelnya apa adanya. Angka <b>paling kanan</b> tiap baris diambil sebagai <b>nilai persetujuan pusat</b> (pagu). Baris judul kapal ikut terbaca sebagai pengelompokan.</p>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={10} className="w-full border rounded-lg p-2 text-xs font-mono"
              placeholder={"KMP. Ngafi\nM.A Biaya Akomodasi\t19.100.000\t0\t19.092.000\nKMP. Lema\nM.A Biaya Akomodasi\t78.000.000\t80.641.500\t77.644.500"} />
            <div className="flex items-center justify-end gap-2 mt-2">
              <span className="text-[11px] text-slate-500 mr-auto">{parseProgramPaste(paste).length} baris terbaca</span>
              <button onClick={() => setPaste(null)} className="btn btn-ghost text-xs">Tutup</button>
              <button onClick={() => { const r = parseProgramPaste(paste); if (!r.length) { alert("Tak terbaca. Pastikan tiap baris ada angkanya."); return; } setDraft({ ...draft, rows: r }); setPaste(null); }} className="btn btn-primary text-xs">Pakai →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">{label}</span>{children}</label>;
}
function Mini({ label, val, tint, bar }: { label: string; val: string; tint: string; bar: string }) {
  return (
    <div className="relative bg-white rounded-xl ring-1 ring-slate-200 elev-sm pl-4 pr-3 py-2.5 overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${bar}`} />
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold">{label}</p>
      <p className={`text-xl font-extrabold tabular-nums leading-tight ${tint}`}>{val}</p>
    </div>
  );
}
