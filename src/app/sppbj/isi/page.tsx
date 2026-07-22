"use client";

import Link from "next/link";
import { useSppbj } from "@/lib/sppbj/store";
import { MATA_ANGGARAN, STAF_TEKNIK, KAPAL_LIST, DEPT_HEAD, VENDOR_DB, MATL_GROUP, KATEGORI_REKAP } from "@/lib/sppbj/db";
import { SppbjItem, emptySppbjItem, sppbjTotal, kapalUnik, hargaSpbjOf, namaLengkap, ketLines, SppbjRequest, fullNoKontrak } from "@/lib/sppbj/types";
import { useState, Fragment } from "react";
import { Field, Input, Section } from "@/components/Field";
import DrpPicker from "@/components/DrpPicker";
import { rupiah, bulanTahun } from "@/lib/format";
import FotoUploader from "@/components/FotoUploader";
import KatalogPicker from "@/components/KatalogPicker";
import KatalogBrowser from "@/components/KatalogBrowser";
import ScanSppbj from "@/components/ScanSppbj";
import { KatalogItem } from "@/lib/katalog/source";
import { ParsedItem } from "@/lib/sppbj/ocrTable";
import { buildRekapRow, sendToRekap, NoRekapConfigError } from "@/lib/sppbj/rekapSync";
import { useAnggaran, realisasiRutin, nilaiPengadaan } from "@/lib/anggaran/store";
import { maKey, jenisAnggaranOf } from "@/lib/anggaran/types";
import PaguProgram from "@/components/anggaran/PaguProgram";
import { posProgram, cekPemakaian } from "@/lib/anggaran/program";
import { tanggalIndo } from "@/lib/format";
import { useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SppbjIsiInner() {
  const { req, update, setItem, addItem, delItem, setItems, saveRemote, saving, newDraft } = useSppbj();
  const total = sppbjTotal(req.items);
  const [openBd, setOpenBd] = useState<Record<string, boolean>>({});
  const [browseKatalog, setBrowseKatalog] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [rekapBusy, setRekapBusy] = useState(false);
  // kolom Mata Anggaran per item hanya perlu saat pengadaan mencentang >1 MA
  const multiMA = (req.mataAnggaran || []).length > 1;
  const nCol = multiMA ? 10 : 9;
  const kodeSingkat = (m: string) => (m || "").match(/\d{6,}/)?.[0] || m;
  // warna per Mata Anggaran (urutan sesuai centang) biar mudah dibedakan sekilas
  const MA_WARNA = [
    "bg-sky-50 text-sky-800 border-sky-300",
    "bg-amber-50 text-amber-800 border-amber-300",
    "bg-violet-50 text-violet-800 border-violet-300",
    "bg-emerald-50 text-emerald-800 border-emerald-300",
    "bg-rose-50 text-rose-800 border-rose-300",
    "bg-teal-50 text-teal-800 border-teal-300",
  ];
  const warnaMA = (ma: string) => {
    const efektif = (ma || "").trim() || (req.mataAnggaran || [])[0] || "";
    const i = (req.mataAnggaran || []).indexOf(efektif);
    return MA_WARNA[(i < 0 ? 0 : i) % MA_WARNA.length];
  };

  // ===== Undo / Redo tabel item (maks 50 langkah; snapshot sebelum aksi masal, bukan tiap ketikan) =====
  const [past, setPast] = useState<SppbjItem[][]>([]);
  const [future, setFuture] = useState<SppbjItem[][]>([]);
  const salin = (arr: SppbjItem[]) => arr.map((x) => ({ ...x }));
  const snapshot = () => { setPast((p) => [...p.slice(-49), salin(req.items)]); setFuture([]); };
  const undo = () => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [salin(req.items), ...f].slice(0, 50));
    setItems(prev);
  };
  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p.slice(-49), salin(req.items)]);
    setItems(next);
  };
  // pembungkus aksi yang mengubah banyak baris -> tercatat di riwayat
  const addItemU = (kapal?: string) => { snapshot(); addItem(kapal); };
  const delItemU = (id: string) => { snapshot(); delItem(id); };

  // isi nama kapal ke SEMUA item / rentang nomor tertentu (mis. 1-20)
  const [kapalMassal, setKapalMassal] = useState("");
  const [dariNo, setDariNo] = useState("");
  const [sampaiNo, setSampaiNo] = useState("");
  const kapalPertama = (req.items.find((i) => (i.kapal || "").trim())?.kapal || "").trim();
  const nItem = req.items.length;
  const rDari = Math.max(1, parseInt(dariNo || "1", 10) || 1);
  const rSampai = Math.min(nItem || 1, parseInt(sampaiNo || String(nItem || 1), 10) || nItem || 1);
  const seluruh = rDari <= 1 && rSampai >= nItem;
  const isiKapalSemua = () => {
    const k = (kapalMassal || kapalPertama).trim();
    if (!k) { alert("Pilih / ketik nama kapal dulu."); return; }
    if (!nItem) { alert("Belum ada item."); return; }
    if (rDari > rSampai) { alert(`Rentang tak valid (${rDari} > ${rSampai}).`); return; }
    const target = req.items.slice(rDari - 1, rSampai);
    const beda = Array.from(new Set(target.map((i) => (i.kapal || "").trim()).filter(Boolean)));
    const cakupan = seluruh ? "SEMUA item" : `item no ${rDari}–${rSampai} (${target.length} baris)`;
    if (beda.length > 1 && !confirm(`${cakupan} punya ${beda.length} kapal berbeda (${beda.join(", ")}).\nTimpa jadi "${k}"?`)) return;
    snapshot();
    setItems(req.items.map((it, i) => (i >= rDari - 1 && i <= rSampai - 1 ? { ...it, kapal: k } : it)));
  };

  // Prefill dari Dashboard: /sppbj/isi?program=<id>&kapal=..&ma=..
  const qs = useSearchParams();
  const sudahPrefill = useRef(false);
  useEffect(() => {
    if (sudahPrefill.current) return;
    const pid = qs.get("program");
    if (!pid) return;
    sudahPrefill.current = true;
    const kapalQ = qs.get("kapal") || "";
    const maQ = qs.get("ma") || "";
    const isiDraf = req.items.length > 0 || (req.namaPengadaan || "").trim();
    if (isiDraf && !confirm("Draf SPPBJ saat ini akan diganti dengan pengadaan baru dari pos persetujuan. Lanjut?")) return;
    newDraft();
    setTimeout(() => {
      update({ programId: pid, jenisAnggaran: "Lainnya", mataAnggaran: maQ ? [maQ] : [] });
      if (maQ || kapalQ) setItems([{ ...emptySppbjItem(kapalQ), satuan: "Ls", mataAnggaran: maQ || undefined }]);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  // ===== Guardrail pagu RUTIN (anti-overbudget) =====
  const { plafon, pengadaan, program } = useAnggaran();
  const rutinInfo = useMemo(() => {
    if (jenisAnggaranOf(req) !== "rutin") return null;
    const ma = (req.mataAnggaran || [])[0] || "";
    if (!ma || !req.tanggal) return null;
    const bulan = req.tanggal.slice(0, 7);
    const key = maKey(ma);
    const pe = plafon.find((p) => p.bulan === bulan);
    const pagu = pe?.rows.find((r) => maKey(r.ma) === key)?.nilai || 0;
    const lain = realisasiRutin(pengadaan.filter((p) => p.id !== req.id), bulan).perKey[key] || 0;
    const sisa = pagu - lain;
    const nilaiIni = nilaiPengadaan(req.items);
    return { ma, bulan, pagu, sisa, nilaiIni, hasPagu: pagu > 0, over: pagu > 0 && nilaiIni > sisa };
  }, [req.jenisAnggaran, req.kategoriRekap, req.mataAnggaran, req.tanggal, req.items, req.id, plafon, pengadaan]);

  // guardrail pagu Persetujuan Biaya Lainnya
  const progInfo = useMemo(() => {
    if (!req.programId) return null;
    const pr = program.find((x) => x.id === req.programId);
    if (!pr) return null;
    const pos = posProgram(pr, pengadaan, req.id);
    return { pr, ...cekPemakaian(pos, req) };
  }, [req.programId, req.items, req.mataAnggaran, req.id, program, pengadaan]);

  const lolosGuard = (): boolean => {
    if (progInfo && (progInfo.over.length || progInfo.tanpaPos.length)) {
      const pesan = [
        ...progInfo.over.map((o) => `• ${o.kapal} · ${o.ma} lebih ${rupiah(Math.round(o.lebih))}`),
        ...progInfo.tanpaPos.map((o) => `• ${o.kapal} · ${o.ma} tak ada di surat ini`),
      ].join("\n");
      if (!confirm(`⚠ Pemakaian tak cocok dgn pagu surat "${progInfo.pr.nama}":\n${pesan}\n\nTetap lanjut?`)) return false;
    }
    if (rutinInfo?.over) return confirm(`⚠ OVERBUDGET pagu RUTIN.\nPengadaan ini ${rupiah(rutinInfo.nilaiIni)} melebihi sisa pagu ${rupiah(rutinInfo.sisa)} (lewat ${rupiah(rutinInfo.nilaiIni - rutinInfo.sisa)}).\nTetap lanjut?`);
    return true;
  };
  const simpanGuard = async () => { if (lolosGuard()) await saveRemote(); };

  // kirim pengadaan ini ke spreadsheet REKAP (tab bulan sesuai tanggal)
  const kirimRekap = async () => {
    if (!lolosGuard()) return;
    if (!(req.noPRSAP || "").trim() && !(req.noSPPBJ || "").trim()) { alert("Isi No. PR SAP dulu — jadi kunci baris di rekap."); return; }
    if (!req.kategoriRekap && !confirm("Kategori Rekap (KET.) belum dipilih. Lanjut kirim tanpa KET?")) return;
    setRekapBusy(true);
    try {
      const r = await sendToRekap([buildRekapRow(req)]);
      if (r.ok) { const res = r.results?.[0]; alert(`Terkirim ke rekap → tab "${res?.sheet || "-"}" (${res?.action === "append" ? "baris baru" : "diperbarui"}).`); }
      else alert("Gagal kirim: " + r.error);
    } catch (e: any) {
      if (e instanceof NoRekapConfigError) alert("Fitur rekap belum aktif.\nDeploy Apps Script + set REKAP_GAS_URL & REKAP_GAS_SECRET di server (lihat docs/rekap-apps-script.gs).");
      else alert("Gagal: " + (e?.message || e));
    } finally { setRekapBusy(false); }
  };

  const toInt = (s: string) => { const d = (s || "").replace(/[^\d]/g, ""); return d ? parseInt(d, 10) : 0; };
  const toNum = (s: string) => { const x = parseFloat((s || "").replace(/[^\d.]/g, "")); return isNaN(x) ? 0 : x; };
  const FIELDS: (keyof SppbjItem)[] = ["kapal", "jumlah", "satuan", "nama", "spesifikasi", "harga"];

  const addFotos = (urls: string[]) => update({ fotoDokumentasi: [...(req.fotoDokumentasi || []), ...urls].slice(0, 5) });
  // isi item dari Katalog HSPK (metadata kodeKatalog/sumberHarga utk feedback harga; tak ubah format SPPBJ)
  const applyKatalog = (id: string, k: KatalogItem) => setItem(id, {
    nama: k.nama,
    spesifikasi: k.spesifikasi || "",
    satuan: k.satuan || "unit",
    harga: k.harga || 0,
    breakdown: k.breakdown?.length ? [...k.breakdown] : undefined,
    kodeKatalog: k.kode,
    sumberHarga: (k.sumber === "Riil" || k.sumber === "Pasar") ? k.sumber : undefined,
    kategoriKatalog: k.kategori || undefined,
  });
  // tambah BANYAK item sekaligus dari browser katalog -> langsung jadi baris tabel SPPBJ
  const addFromKatalog = (picked: KatalogItem[], kapal: string) => {
    snapshot();
    const baru = picked.map((k) => ({
      ...emptySppbjItem(kapal),
      jumlah: 1,
      satuan: k.satuan || "unit",
      nama: k.nama,
      spesifikasi: k.spesifikasi || "",
      harga: k.harga || 0,
      breakdown: k.breakdown?.length ? [...k.breakdown] : undefined,
      kodeKatalog: k.kode,
      sumberHarga: (k.sumber === "Riil" || k.sumber === "Pasar") ? k.sumber : undefined,
      kategoriKatalog: k.kategori || undefined,
    }));
    setItems([...req.items, ...baru]);
  };
  // hasil OCR screenshot Excel -> append jadi baris tabel (+ id)
  const addFromScan = (parsed: ParsedItem[]) => {
    snapshot();
    const baru = parsed.map((p) => ({
      ...emptySppbjItem(p.kapal || ""),
      jumlah: p.jumlah || 1,
      satuan: p.satuan || "unit",
      nama: p.nama || "",
      spesifikasi: p.spesifikasi || "",
      harga: p.harga || 0,
      keterangan: p.keterangan || undefined,
      breakdown: p.breakdown?.length ? [...p.breakdown] : undefined,
    }));
    setItems([...req.items, ...baru]);
  };
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
      <div className="glass rounded-2xl ring-line elev-md px-5 py-4 mb-6 sticky top-3 z-20 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/sppbj" className="text-xs text-slate-500 hover:text-[#16357f]">‹ SPPBJ</Link>
          <h1 className="text-xl font-extrabold asdp-text-gradient">Input SPPBJ</h1>
          <p className="text-xs text-slate-500">{req.items.length} item · {bulanTahun(req.tanggal)} · estimasi {rupiah(total)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={kirimRekap} disabled={rekapBusy} className="text-sm font-semibold px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50" title="Kirim ke spreadsheet REKAP PJK (tab bulan sesuai tanggal)">{rekapBusy ? "…" : "📊 Kirim ke Rekap"}</button>
          <button onClick={simpanGuard} disabled={saving} className="asdp-gradient text-white text-sm font-semibold px-5 py-2 rounded-xl shadow">{saving ? "…" : "💾 Simpan"}</button>
        </div>
      </div>

      {rutinInfo && (
        <div className={`mb-4 rounded-xl px-4 py-2.5 text-sm flex flex-wrap items-center gap-2 border ${rutinInfo.over ? "bg-red-50 text-red-700 border-red-200" : rutinInfo.hasPagu ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
          <span>🧭 Pagu RUTIN <b>{rutinInfo.ma}</b> ({bulanTahun(rutinInfo.bulan + "-01")}):</span>
          {rutinInfo.hasPagu ? (
            <span>sisa <b>{rupiah(rutinInfo.sisa)}</b> · pengadaan ini {rupiah(rutinInfo.nilaiIni)}{rutinInfo.over && <b> → OVERBUDGET {rupiah(rutinInfo.nilaiIni - rutinInfo.sisa)}</b>}</span>
          ) : (<span>belum ada pagu bulan ini — atur di Dashboard Anggaran → Kendali Anggaran Rutin</span>)}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <span className="h-7 w-7 rounded-lg asdp-gradient text-white grid place-items-center text-xs font-bold">1</span>
        <h2 className="font-bold text-slate-700">FASE 1 — SPPBJ &amp; FORMAT SAP</h2>
      </div>

      <Section title="Data Pengadaan" icon="📑">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Tanggal (bulan & tahun dipakai)"><Input type="date" value={req.tanggal} onChange={(e) => update({ tanggal: e.target.value })} /></Field>
          <Field label="No. SPPB/J (kosong = isi manual)"><Input value={req.noSPPBJ} onChange={(e) => update({ noSPPBJ: e.target.value })} placeholder="biarkan kosong" /></Field>
          <Field label="No. DRP (cari deskripsi)"><DrpPicker value={req.noDRP} onChange={(v) => update({ noDRP: v })} /></Field>
          <Field label="No. PR SAP (kosong = ikut No. SPPB/J)">
            <Input value={req.noPRSAP || ""} onChange={(e) => update({ noPRSAP: e.target.value })}
              placeholder={(req.noSPPBJ || "").trim() ? `↳ ${req.noSPPBJ}` : "2000xxxxxx"} />
          </Field>
          <Field label="Kategori Rekap (KET. di spreadsheet)">
            {/* daftar bawah = surat Persetujuan Biaya Lainnya yang sudah dibuat di Dashboard.
                Memilihnya sekaligus menautkan pengadaan ke surat itu (pagu + KET. rekap). */}
            <select className={`w-full rounded-lg border px-3 py-2 text-sm ${req.programId ? "border-indigo-300 bg-indigo-50/40" : "border-slate-300 bg-white"}`}
              value={req.programId ? "prog:" + req.programId : req.kategoriRekap || ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith("prog:")) {
                  const pr = program.find((x) => x.id === v.slice(5));
                  if (!pr) return;
                  const maSurat = Array.from(new Set((pr.rows || []).map((r) => r.ma).filter(Boolean)));
                  update({
                    programId: pr.id, jenisAnggaran: "Lainnya",
                    kategoriRekap: (pr.ketRekap || pr.nama || "").trim(),
                    mataAnggaran: (req.mataAnggaran || []).length ? req.mataAnggaran : maSurat,
                    namaPengadaan: req.namaPengadaan || pr.nama,
                    dasarPelimpahan: req.dasarPelimpahan || (pr.noSurat ? `Surat Persetujuan Pusat No. ${pr.noSurat}${pr.tanggal ? ` tanggal ${tanggalIndo(pr.tanggal)}` : ""}` : pr.nama),
                  });
                  return;
                }
                update({ kategoriRekap: v, programId: undefined, jenisAnggaran: /docking/i.test(v) ? "Docking" : (v ? "Rutin" : req.jenisAnggaran) });
              }}>
              <option value="">— pilih —</option>
              {KATEGORI_REKAP.map((k) => <option key={k} value={k}>{k}</option>)}
              {program.length > 0 && (
                <optgroup label="Persetujuan Biaya Lainnya (dari Dashboard)">
                  {program.map((pr) => (
                    <option key={pr.id} value={"prog:" + pr.id}>{(pr.ketRekap || pr.nama)}{pr.noSurat ? ` — ${pr.noSurat}` : ""}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {req.programId && (
              <p className="text-[11px] text-indigo-800 mt-1">
                Tertaut ke surat persetujuan — KET. rekap: <b>{req.kategoriRekap || "(kosong)"}</b>. Pagu &amp; sisanya ada di panel Sumber Pagu di bawah.
              </p>
            )}
          </Field>
          <Field label="Jenis Anggaran (Dashboard)">
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" value={req.jenisAnggaran || ""} onChange={(e) => update({ jenisAnggaran: (e.target.value || undefined) as any })}>
              <option value="">— otomatis dari Kategori —</option>
              <option value="Rutin">Rutin (Persetujuan Rutin bulanan)</option>
              <option value="Docking">Docking (Persetujuan Pusat)</option>
              <option value="Lainnya">Lainnya (Persetujuan Biaya Lainnya)</option>
            </select>
          </Field>
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
                <input type="checkbox" checked={req.mataAnggaran.includes(ma)} onChange={() => toggleMA(ma)} />
                {multiMA && req.mataAnggaran.includes(ma) && (
                  <span className={`inline-block h-3.5 w-3.5 rounded border shrink-0 ${warnaMA(ma)}`} title="warna penanda di kolom M. Anggaran" />
                )}
                {ma}
              </label>
            ))}
          </div>
        </div>
      </Section>

      {(req.jenisAnggaran === "Lainnya" || req.programId) && (
        <div className="mb-4">
          <PaguProgram
            program={program} pengadaan={pengadaan} programId={req.programId} reqId={req.id}
            items={req.items} mataAnggaran={req.mataAnggaran} namaPengadaan={req.namaPengadaan}
            onPilih={(id, pr) => {
              if (!id || !pr) { update({ programId: undefined }); return; }
              // sekali pilih surat: Mata Anggaran, nama, dasar pelimpahan, kategori rekap ikut terisi
              const maSurat = Array.from(new Set((pr.rows || []).map((r) => r.ma).filter(Boolean)));
              const adaInv = (pr.rows || []).some((r) => maKey(r.ma).startsWith("10206"));
              update({
                programId: id, jenisAnggaran: "Lainnya",
                mataAnggaran: (req.mataAnggaran || []).length ? req.mataAnggaran : maSurat,
                namaPengadaan: req.namaPengadaan || pr.nama,
                dasarPelimpahan: req.dasarPelimpahan || (pr.noSurat ? `Surat Persetujuan Pusat No. ${pr.noSurat}${pr.tanggal ? ` tanggal ${tanggalIndo(pr.tanggal)}` : ""}` : pr.nama),
                kategoriRekap: (pr.ketRekap || pr.nama || "").trim() || req.kategoriRekap || (adaInv ? "INVESTASI DILUAR DOCKING" : req.kategoriRekap),
              });
            }}
            onTarik={(pos) => { snapshot(); setItems([...req.items, { ...emptySppbjItem(pos.kapal === "(umum)" ? "" : pos.kapal), satuan: "Ls", mataAnggaran: pos.ma }]); }}
            onTarikSemua={(list) => {
              if (!list.length) { alert("Semua pos di surat ini sudah habis terpakai."); return; }
              snapshot();
              setItems([...req.items, ...list.map((pos) => ({ ...emptySppbjItem(pos.kapal === "(umum)" ? "" : pos.kapal), satuan: "Ls", mataAnggaran: pos.ma }))]);
            }}
          />
        </div>
      )}

      <Section title={`Item SPPBJ (${req.items.length}) — multi kapal · harga ESTIMASI`} icon="🛠️">
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-3 text-sm text-slate-700">
          <b className="text-sky-800">📋 Paste dari Excel:</b> urutan <b>Kapal · Jumlah · Satuan · Nama Barang/Jasa · Spesifikasi · Harga</b> → klik sel → <kbd className="px-1.5 py-0.5 bg-white border rounded">Ctrl+V</kbd>. Item dengan kapal sama dikelompokkan + dibuat sheet BSTB-nya nanti.
        </div>
        <datalist id="kapalListSppbj">{KAPAL_LIST.map((k) => <option key={k} value={k} />)}</datalist>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button onClick={() => addItemU()} className="bg-[#16357f] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90">＋ Tambah Item</button>
          <button onClick={() => setBrowseKatalog(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100">📚 Pilih dari Katalog (banyak)</button>
          <button onClick={() => setScanOpen(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">📷 Scan dari Excel (OCR)</button>
          <span className="text-[11px] text-slate-400">screenshot tabel → terisi otomatis</span>
          <span className="flex items-center gap-1 ml-2">
            <button onClick={undo} disabled={!past.length} title={past.length ? `Batalkan perubahan terakhir (${past.length} langkah tersimpan)` : "Belum ada yang bisa dibatalkan"}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">↶ Undo{past.length ? ` (${past.length})` : ""}</button>
            <button onClick={redo} disabled={!future.length} title={future.length ? `Ulangi perubahan (${future.length})` : "Tak ada yang bisa diulangi"}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">↷ Redo{future.length ? ` (${future.length})` : ""}</button>
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            <input list="kapalListSppbj" value={kapalMassal} onChange={(e) => setKapalMassal(e.target.value)}
              placeholder={kapalPertama || "pilih kapal…"} className="w-36 text-xs border rounded-lg px-2 py-1.5 bg-white" />
            <span className="text-[11px] text-slate-400">no</span>
            <input type="number" min={1} value={dariNo} onChange={(e) => setDariNo(e.target.value)} placeholder="1"
              className="w-14 text-xs border rounded-lg px-2 py-1.5 bg-white text-center" title="dari nomor item" />
            <span className="text-[11px] text-slate-400">–</span>
            <input type="number" min={1} value={sampaiNo} onChange={(e) => setSampaiNo(e.target.value)} placeholder={String(nItem || 1)}
              className="w-14 text-xs border rounded-lg px-2 py-1.5 bg-white text-center" title="sampai nomor item (kosong = terakhir)" />
            <button onClick={isiKapalSemua} title="Isi nama kapal ke item pada rentang nomor (kosongkan rentang = semua item)"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#16357f]/30 bg-[#16357f]/5 text-[#16357f] hover:bg-[#16357f]/10">
              🚢 Isi Kapal {seluruh ? "ke Semua Item" : `no ${rDari}–${rSampai}`}
            </button>
          </div>
        </div>
        <KatalogBrowser open={browseKatalog} onClose={() => setBrowseKatalog(false)} onAdd={addFromKatalog}
          defaultKapal={req.items.length ? req.items[req.items.length - 1].kapal : ""} />
        <ScanSppbj open={scanOpen} onClose={() => setScanOpen(false)} onAdd={addFromScan} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-slate-50 text-xs">
              <tr><th className="p-2 border w-8">No</th><th className="p-2 border">Kapal</th><th className="p-2 border">Jml</th><th className="p-2 border">Sat</th><th className="p-2 border text-left">Nama Barang/Jasa</th><th className="p-2 border text-left">Spesifikasi</th>{multiMA && <th className="p-2 border" title="Mata Anggaran item ini (kosong = ikut MA pertama)">M. Anggaran</th>}<th className="p-2 border">Harga Satuan</th><th className="p-2 border">Jumlah</th><th className="p-2 border"></th></tr>
            </thead>
            <tbody>
              {req.items.map((it, ri) => (
                <Fragment key={it.id}>
                {ri > 0 && it.kapal.trim() !== (req.items[ri - 1].kapal || "").trim() &&
                  <tr aria-hidden><td colSpan={nCol} className="h-3 bg-slate-100/60"></td></tr>}
                {(it.keterangan || "") !== (ri > 0 ? req.items[ri - 1].keterangan || "" : "") &&
                  ketLines(it).map((kl, ki) => (
                    <tr key={"kt" + ki}><td className="border p-1"></td><td colSpan={nCol - 1} className="border p-1 font-bold text-slate-700 bg-amber-50">{kl}</td></tr>
                  ))}
                <tr>
                  <td className="border p-1 text-center text-slate-400">{ri + 1}</td>
                  <td className="border p-1"><input list="kapalListSppbj" className="w-28 px-1" value={it.kapal} onChange={(e) => setItem(it.id, { kapal: e.target.value })} onPaste={(e) => handlePaste(ri, 0, e)} /></td>
                  <td className="border p-1"><input type="number" className="w-14 px-1 text-center" value={it.jumlah} onChange={(e) => setItem(it.id, { jumlah: +e.target.value })} onPaste={(e) => handlePaste(ri, 1, e)} /></td>
                  <td className="border p-1"><input className="w-14 px-1 text-center" value={it.satuan} onChange={(e) => setItem(it.id, { satuan: e.target.value })} onPaste={(e) => handlePaste(ri, 2, e)} /></td>
                  <td className="border p-1">
                    <div className="flex items-center gap-1">
                      <input className="w-48 px-1" value={it.nama} onChange={(e) => setItem(it.id, { nama: e.target.value })} onPaste={(e) => handlePaste(ri, 3, e)} />
                      <KatalogPicker initialQuery={it.nama} onPick={(k) => applyKatalog(it.id, k)} />
                    </div>
                    {(it.breakdown || []).some((b) => (b || "").trim()) && (
                      <ul className="mt-0.5 ml-1 text-[11px] text-slate-500 leading-snug">
                        {(it.breakdown || []).filter((b) => (b || "").trim()).map((b, bi) => (
                          <li key={bi}>- {b.trim().replace(/^[-•*]\s*/, "")}</li>
                        ))}
                      </ul>
                    )}
                    {it.kodeKatalog && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="font-mono text-[9px] text-slate-400">{it.kodeKatalog}</span>
                        {it.sumberHarga && <span className={`text-[9px] font-semibold px-1 rounded ${it.sumberHarga === "Riil" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{it.sumberHarga === "Riil" ? "Riil ✓" : "Pasar ⚠ verifikasi"}</span>}
                      </div>
                    )}
                  </td>
                  <td className="border p-1"><input className="w-36 px-1" value={it.spesifikasi} onChange={(e) => setItem(it.id, { spesifikasi: e.target.value })} onPaste={(e) => handlePaste(ri, 4, e)} /></td>
                  {multiMA && (
                    <td className="border p-1">
                      <select value={it.mataAnggaran || ""} onChange={(e) => setItem(it.id, { mataAnggaran: e.target.value || undefined })}
                        className={`w-28 px-1 py-0.5 text-xs border rounded font-semibold ${warnaMA(it.mataAnggaran || "")}`} title={it.mataAnggaran || `ikut ${req.mataAnggaran[0] || "-"}`}>
                        <option value="">↳ {kodeSingkat(req.mataAnggaran[0] || "")}</option>
                        {req.mataAnggaran.map((m) => <option key={m} value={m}>{kodeSingkat(m)}</option>)}
                      </select>
                    </td>
                  )}
                  <td className="border p-1"><input type="number" className="w-28 px-1 text-right" value={it.harga} onChange={(e) => setItem(it.id, { harga: +e.target.value })} onPaste={(e) => handlePaste(ri, 5, e)} /></td>
                  <td className="border p-1 text-right text-slate-500 w-28">{rupiah(it.harga * it.jumlah)}</td>
                  <td className="border p-1 text-center whitespace-nowrap">
                    <button onClick={() => setOpenBd((o) => ({ ...o, [it.id]: !o[it.id] }))} className={`text-xs px-2 py-0.5 rounded border mr-1 ${(it.breakdown?.length || it.keterangan) ? "bg-sky-100 border-sky-300 text-sky-700" : "border-slate-300 text-sky-600"}`}>
                      {openBd[it.id] ? "▴ tutup" : "＋ ket/rincian"}
                      {(() => { const n = (it.breakdown || []).filter((b) => (b || "").trim()).length; return n ? ` (${n})` : ""; })()}
                    </button>
                    <button onClick={() => delItemU(it.id)} className="text-red-500 text-xs px-1.5 py-0.5 rounded border border-red-200">hapus</button>
                  </td>
                </tr>
                {openBd[it.id] && (
                  <tr>
                    <td className="border p-1"></td>
                    <td className="border p-1" colSpan={nCol - 1}>
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
              <tr className="bg-slate-50 font-semibold"><td colSpan={nCol - 2} className="border p-1 text-right">Estimasi (sebelum PPN)</td><td className="border p-1 text-right">{rupiah(total)}</td><td className="border p-1"></td></tr>
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
          <Field label="No. SPBJ (angka saja, mis. 3798)"><Input value={req.noSpbjNum || ""} onChange={(e) => update({ noSpbjNum: e.target.value })} placeholder="3798" /></Field>
          <Field label="Bulan SPBJ (romawi, mis. VI)"><Input value={req.noSpbjBulan || ""} onChange={(e) => update({ noSpbjBulan: e.target.value.toUpperCase() })} placeholder="VI" maxLength={4} /></Field>
          <div className="sm:col-span-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">No. Kontrak (otomatis)</span>
              <div className="mt-1"><Input value={fullNoKontrak(req) || "— isi angka & romawi —"} readOnly className="bg-slate-50 text-slate-500 font-mono" /></div>
            </label>
          </div>
          <Field label="Tanggal SPBJ (= Tanggal Kontrak)"><Input type="date" value={req.tanggalSPBJ || ""} onChange={(e) => update({ tanggalSPBJ: e.target.value })} /></Field>
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

      <div className="flex justify-end gap-3">
        <Link href="/sppbj/detail" className="asdp-gradient text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow">Selesai → Generate Dokumen</Link>
      </div>
    </main>
  );
}

export default function SppbjIsi() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Memuat formulir…</p>}>
      <SppbjIsiInner />
    </Suspense>
  );
}
