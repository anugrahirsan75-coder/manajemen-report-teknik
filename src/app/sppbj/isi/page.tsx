"use client";

import Link from "next/link";
import { useSppbj } from "@/lib/sppbj/store";
import { MATA_ANGGARAN, STAF_TEKNIK, KAPAL_LIST, DEPT_HEAD, VENDOR_DB, MATL_GROUP, KATEGORI_REKAP } from "@/lib/sppbj/db";
import { SppbjItem, GrSes, grSesBaru, emptySppbjItem, sppbjTotal, kapalUnik, hargaSpbjOf, namaLengkap, ketLines, SppbjRequest, fullNoKontrak, totalSpbj, nilaiGrEfektif, nilaiGrOtomatis } from "@/lib/sppbj/types";
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
import { maKey, jenisAnggaranOf, jenisItemOf, anggaranCampuran, kunciSumber } from "@/lib/anggaran/types";
import PaguProgram from "@/components/anggaran/PaguProgram";
import { posProgram, cekPemakaian } from "@/lib/anggaran/program";
import { tanggalIndo } from "@/lib/format";
import { useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { beritahu, konfirmasi } from "@/components/Konfirmasi";

function SppbjIsiInner() {
  const { req, update, setItem, addItem, delItem, setItems, saveRemote, saving, newDraft } = useSppbj();
  const total = sppbjTotal(req.items);
  const [openBd, setOpenBd] = useState<Record<string, boolean>>({});
  const [browseKatalog, setBrowseKatalog] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [rekapBusy, setRekapBusy] = useState(false);
  // kolom Mata Anggaran per item hanya perlu saat pengadaan mencentang >1 MA
  const multiMA = (req.mataAnggaran || []).length > 1;
  const nCol = 9 + (multiMA ? 1 : 0) + (req.anggaranPerItem ? 1 : 0);
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
  // ---- sumber anggaran per item (1 SPPBJ boleh membebani >1 sumber) ----
  const WARNA_SUMBER: Record<string, string> = {
    rutin: "bg-sky-50 text-sky-800 border-sky-300",
    docking: "bg-orange-50 text-orange-800 border-orange-300",
    lainnya: "bg-indigo-50 text-indigo-800 border-indigo-300",
    ikut: "bg-white text-slate-500 border-slate-300",
  };
  const warnaSumber = (it: SppbjItem) => WARNA_SUMBER[it.jenisAnggaran || "ikut"] || WARNA_SUMBER.ikut;
  const labelSumber = (it: SppbjItem) => {
    if (!it.jenisAnggaran) return "Ikut sumber anggaran pengadaan ini";
    if (it.jenisAnggaran !== "lainnya") return `Dibebankan ke pagu ${it.jenisAnggaran}`;
    return `Dibebankan ke surat: ${program.find((p) => p.id === it.programId)?.nama || "(belum dipilih)"}`;
  };

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
  const isiKapalSemua = async () => {
    const k = (kapalMassal || kapalPertama).trim();
    if (!k) { void beritahu("Pilih / ketik nama kapal dulu."); return; }
    if (!nItem) { void beritahu("Belum ada item."); return; }
    if (rDari > rSampai) { void beritahu(`Rentang tak valid (${rDari} > ${rSampai}).`); return; }
    const target = req.items.slice(rDari - 1, rSampai);
    const beda = Array.from(new Set(target.map((i) => (i.kapal || "").trim()).filter(Boolean)));
    const cakupan = seluruh ? "SEMUA item" : `item no ${rDari}–${rSampai} (${target.length} baris)`;
    if (beda.length > 1 && !(await konfirmasi({
      nada: "perhatian", ikon: "🚢",
      judul: `Timpa kapal jadi "${k}"?`,
      pesan: `${cakupan} sekarang memakai ${beda.length} kapal berbeda.`,
      rincian: beda,
      tegasan: "Semuanya akan diganti jadi satu kapal.",
      tombolYa: "Timpa",
    }))) return;
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
    (async () => {
    if (isiDraf && !(await konfirmasi({
      nada: "perhatian", ikon: "📄",
      judul: "Ganti draf yang sedang dibuka?",
      pesan: "Draf SPPBJ saat ini akan diganti dengan pengadaan baru dari pos persetujuan.",
      tegasan: "Isi draf sekarang hilang kalau belum disimpan.",
      tombolYa: "Ganti draf",
    }))) return;
    newDraft();
    setTimeout(() => {
      update({ programId: pid, jenisAnggaran: "Lainnya", mataAnggaran: maQ ? [maQ] : [] });
      if (maQ || kapalQ) setItems([{ ...emptySppbjItem(kapalQ), satuan: "Ls", mataAnggaran: maQ || undefined }]);
    }, 0);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  // ===== Guardrail pagu RUTIN (anti-overbudget) =====
  const { plafon, pengadaan, program } = useAnggaran();
  const rutinInfo = useMemo(() => {
    // barang untuk stok tak menggerus pagu -> guardrail tidak berlaku
    if (req.stokPersediaan) return null;
    // yang diadu dengan pagu Rutin hanya BARIS yang dibebankan ke Rutin
    const itemRutin = (req.items || []).filter((it) => jenisItemOf(req, it).jenis === "rutin");
    if (!itemRutin.length) return null;
    const ma = (req.mataAnggaran || [])[0] || "";
    if (!ma || !req.tanggal) return null;
    const bulan = req.tanggal.slice(0, 7);
    const key = maKey(ma);
    const pe = plafon.find((p) => p.bulan === bulan);
    const pagu = pe?.rows.find((r) => maKey(r.ma) === key)?.nilai || 0;
    const lain = realisasiRutin(pengadaan.filter((p) => p.id !== req.id), bulan).perKey[key] || 0;
    const sisa = pagu - lain;
    const nilaiIni = nilaiPengadaan(itemRutin);
    return { ma, bulan, pagu, sisa, nilaiIni, hasPagu: pagu > 0, over: pagu > 0 && nilaiIni > sisa };
  }, [req.jenisAnggaran, req.kategoriRekap, req.mataAnggaran, req.tanggal, req.items, req.id, req.stokPersediaan, plafon, pengadaan]);

  // guardrail pagu Persetujuan Biaya Lainnya.
  // Satu SPPBJ bisa membebani BEBERAPA surat sekaligus (kolom Anggaran per item),
  // jadi tiap surat diperiksa terpisah dengan hanya baris miliknya.
  const progInfoList = useMemo(() => {
    const ids = new Set<string>();
    if (req.programId) ids.add(req.programId);        // tautan dokumen (perilaku lama)
    (req.items || []).forEach((it) => {               // + surat yang dibebani per baris
      const s = jenisItemOf(req, it);
      if (s.jenis === "lainnya" && s.programId) ids.add(s.programId);
    });
    return Array.from(ids).map((id) => {
      const pr = program.find((x) => x.id === id);
      if (!pr) return null;
      const pos = posProgram(pr, pengadaan, req.id);
      const saring = (it: any) => jenisItemOf(req, it).programId === id;
      return { pr, ...cekPemakaian(pos, req, saring) };
    }).filter(Boolean) as { pr: any; over: any[]; tanpaPos: any[] }[];
  }, [req.programId, req.items, req.mataAnggaran, req.id, req.jenisAnggaran, req.kategoriRekap, program, pengadaan]);
  const progInfo = progInfoList[0] || null;

  /** rekap nilai per sumber anggaran — dasar tampilan & pengingat pembagian */
  const campuran = useMemo(() => {
    const arr = req.items || [];
    const hasFinal = arr.some((it) => (it.hargaSpbj || 0) > 0);
    const by: Record<string, { kunci: string; label: string; warna: string; nilai: number; jml: number }> = {};
    for (const it of arr) {
      const v = (hasFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0)) * (it.jumlah || 0);
      if (!v) continue;
      const s = jenisItemOf(req, it);
      const kunci = kunciSumber(s);
      const label = s.jenis === "lainnya"
        ? `📜 ${(program.find((p) => p.id === s.programId)?.nama || "Persetujuan Lainnya").slice(0, 38)}`
        : s.jenis === "docking" ? "⚓ Docking" : "🧭 Rutin";
      const warna = s.jenis === "lainnya" ? "bg-indigo-50 text-indigo-800 border-indigo-300"
        : s.jenis === "docking" ? "bg-orange-50 text-orange-800 border-orange-300"
        : "bg-sky-50 text-sky-800 border-sky-300";
      const b = (by[kunci] ||= { kunci, label, warna, nilai: 0, jml: 0 });
      b.nilai += v; b.jml += 1;
    }
    const baris = Object.values(by).sort((a, b) => b.nilai - a.nilai);
    return { baris, n: baris.length };
  }, [req.items, req.jenisAnggaran, req.kategoriRekap, req.programId, program]);

  const lolosGuard = async (): Promise<boolean> => {
    for (const pi of progInfoList) {
      if (!pi.over.length && !pi.tanpaPos.length) continue;
      if (!(await konfirmasi({
        nada: "perhatian", ikon: "📊",
        judul: "Pemakaian tak cocok dengan pagu surat",
        pesan: `Surat persetujuan: "${pi.pr.nama}".`,
        rincian: [
          ...pi.over.map((o: any) => `${o.kapal} · ${o.ma} — LEBIH ${rupiah(Math.round(o.lebih))}`),
          ...pi.tanpaPos.map((o: any) => `${o.kapal} · ${o.ma} — pos ini tak ada di surat`),
        ],
        tegasan: "Kalau diteruskan, pemakaian melebihi yang disetujui pusat.",
        tombolYa: "Tetap lanjut",
      }))) return false;
    }
    if (rutinInfo?.over) return await konfirmasi({
      nada: "perhatian", ikon: "🧭",
      judul: "Overbudget pagu Rutin",
      pesan: "Pengadaan ini melewati sisa pagu Rutin bulan ini.",
      rincian: [
        `Nilai pengadaan ini ${rupiah(rutinInfo.nilaiIni)}`,
        `Sisa pagu ${rupiah(rutinInfo.sisa)}`,
        `Lewat ${rupiah(rutinInfo.nilaiIni - rutinInfo.sisa)}`,
      ],
      tegasan: "Lebihnya perlu dilaporkan ke pusat.",
      tombolYa: "Tetap lanjut",
    });
    return true;
  };
  const simpanGuard = async () => { if (await lolosGuard()) await saveRemote(); };

  // kirim pengadaan ini ke spreadsheet REKAP (tab bulan sesuai tanggal)
  const kirimRekap = async () => {
    if (!(await lolosGuard())) return;
    if (!(req.noPRSAP || "").trim() && !(req.noSPPBJ || "").trim()) { void beritahu("Isi No. PR SAP dulu — jadi kunci baris di rekap."); return; }
    if (!req.kategoriRekap && !(await konfirmasi({
      nada: "perhatian", ikon: "🏷️",
      judul: "Kategori Rekap belum dipilih",
      pesan: "Kolom KET. di spreadsheet rekap akan kosong.",
      tombolYa: "Kirim tanpa KET",
    }))) return;
    setRekapBusy(true);
    try {
      const r = await sendToRekap([buildRekapRow(req)]);
      if (r.ok) { const res = r.results?.[0]; void beritahu(`Terkirim ke rekap → tab "${res?.sheet || "-"}" (${res?.action === "append" ? "baris baru" : "diperbarui"}).`); }
      else void beritahu("Gagal kirim: " + r.error);
    } catch (e: any) {
      if (e instanceof NoRekapConfigError) void beritahu("Fitur rekap belum aktif.\nDeploy Apps Script + set REKAP_GAS_URL & REKAP_GAS_SECRET di server (lihat docs/rekap-apps-script.gs).");
      else void beritahu("Gagal: " + (e?.message || e));
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
        {/* Tombol kembali dibuat sebagai tombol sungguhan + jejak lokasi.
            Sebelumnya hanya tulisan "‹ SPPBJ" sebesar 12px yang mudah terlewat. */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/sppbj" title="Kembali ke daftar Riwayat Pengadaan"
            className="shrink-0 h-10 w-10 grid place-items-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:border-[#1ca3dd] hover:text-[#16357f] transition text-lg">
            ←
          </Link>
          <div className="min-w-0">
            <nav className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-0.5" aria-label="Navigasi">
              <Link href="/sppbj" className="font-semibold hover:text-[#16357f] hover:underline">SPPBJ Pengadaan</Link>
              <span className="text-slate-300">›</span>
              <span className="font-bold text-slate-700">{req.id ? "Ubah pengadaan" : "Pengadaan baru"}</span>
            </nav>
            <h1 className="text-xl font-extrabold asdp-text-gradient leading-tight truncate" title={req.namaPengadaan || undefined}>
              {req.namaPengadaan?.trim() || "Input SPPBJ"}
            </h1>
            <p className="text-xs text-slate-500">{req.items.length} item · {bulanTahun(req.tanggal)} · estimasi {rupiah(total)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/sppbj" className="btn btn-ghost text-sm" title="Kembali ke daftar pengadaan yang sudah tersimpan">
            ← Daftar pengadaan
          </Link>
          <button onClick={kirimRekap} disabled={rekapBusy} className="text-sm font-semibold px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50" title="Kirim ke spreadsheet REKAP PJK (tab bulan sesuai tanggal)">{rekapBusy ? "…" : "📊 Kirim ke Rekap"}</button>
          <button onClick={simpanGuard} disabled={saving} className="asdp-gradient text-white text-sm font-semibold px-5 py-2 rounded-xl shadow">{saving ? "…" : "💾 Simpan"}</button>
        </div>
      </div>

      {req.stokPersediaan && (
        <div className="mb-4 rounded-xl px-4 py-2.5 text-sm flex flex-wrap items-center gap-2 border bg-sky-50 text-sky-800 border-sky-200">
          <span>📦 <b>Masuk stok / persediaan</b> — pengadaan ini <b>tidak menggerus</b> pagu Mata Anggaran manapun.</span>
          {req.catatanAnggaran ? <span className="text-sky-700">· {req.catatanAnggaran}</span> : null}
        </div>
      )}
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
          <Field label="No. PO SAP" hint="terbit setelah PR disetujui — bisa juga diisi di Fase 2 atau dari daftar pengadaan">
            <Input value={req.noPOSAP || ""} onChange={(e) => update({ noPOSAP: e.target.value })} placeholder="45000xxxxx" />
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
          {/* blok ini pakai <div>, BUKAN <Field> — Field sendiri sebuah <label>,
              dan dua <label> bersarang membuat centang kedua memicu centang pertama */}
          <div className="block">
            <span className="text-xs font-semibold text-slate-600">Perlakuan Anggaran</span>
            <div className="mt-1">
            <label className="flex items-start gap-2 rounded-lg border border-slate-300 px-3 py-2 bg-white cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={!!req.stokPersediaan}
                onChange={(e) => update({ stokPersediaan: e.target.checked || undefined })} />
              <span className="text-sm leading-snug">
                Masuk <b>STOK / persediaan</b>
                <span className="block text-[11px] text-slate-500">
                  barang disimpan dulu, belum dipakai kapal — tidak menggerus pagu Mata Anggaran.
                  Nilainya tetap tercatat &amp; terlihat di Dashboard, hanya tak dihitung sebagai serapan.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-slate-300 px-3 py-2 bg-white cursor-pointer mt-2">
              <input type="checkbox" className="mt-0.5" checked={!!req.anggaranPerItem}
                onChange={(e) => update({ anggaranPerItem: e.target.checked || undefined })} />
              <span className="text-sm leading-snug">
                Pakai <b>lebih dari satu sumber anggaran</b>
                <span className="block text-[11px] text-slate-500">
                  buka kolom <b>Anggaran</b> di tabel item, mis. sebagian item dibebankan ke pagu
                  Docking kapal dan sisanya ke surat Persetujuan Biaya Lainnya. Item yang dibiarkan
                  kosong tetap ikut Jenis Anggaran pengadaan ini.
                </span>
              </span>
            </label>
            </div>
          </div>
          <Field label="Catatan Anggaran (tampil di Dashboard)">
            <Input value={req.catatanAnggaran || ""} placeholder="mis. Suku cadang untuk stok, dipakai saat perbaikan berikutnya"
              onChange={(e) => update({ catatanAnggaran: e.target.value || undefined })} />
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
              if (!list.length) { void beritahu("Semua pos di surat ini sudah habis terpakai."); return; }
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
        {/* pembagian per sumber anggaran — muncul begitu pengadaan ini membebani >1 sumber */}
        {(req.anggaranPerItem || campuran.n > 1) && (
          <div className={`rounded-xl p-3 mb-3 ring-1 ${campuran.n > 1 ? "bg-violet-50 ring-violet-200" : "bg-slate-50 ring-slate-200"}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-2">
              Pembagian per sumber anggaran {campuran.n > 1 && <span className="text-violet-700">· {campuran.n} sumber</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {campuran.baris.map((b) => (
                <span key={b.kunci} className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${b.warna}`}>
                  {b.label} <b className="tabular-nums">{rupiah(Math.round(b.nilai))}</b>
                  <span className="opacity-60"> · {b.jml} item</span>
                </span>
              ))}
              {campuran.baris.length === 0 && <span className="text-xs text-slate-500">belum ada item bernilai.</span>}
            </div>
            {campuran.n > 1 && (
              <p className="text-[11px] text-violet-800 mt-2">
                Tiap bagian akan menggerus pagunya masing-masing di Dashboard. Dokumen SPPBJ-nya tetap satu &amp; dicetak utuh.
              </p>
            )}
          </div>
        )}
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
              <tr><th className="p-2 border w-8">No</th><th className="p-2 border">Kapal</th><th className="p-2 border">Jml</th><th className="p-2 border">Sat</th><th className="p-2 border text-left">Nama Barang/Jasa</th><th className="p-2 border text-left">Spesifikasi</th>{multiMA && <th className="p-2 border" title="Mata Anggaran item ini (kosong = ikut MA pertama)">M. Anggaran</th>}{req.anggaranPerItem && <th className="p-2 border" title="Sumber anggaran yang dibebani item ini (kosong = ikut pengadaan)">Anggaran</th>}<th className="p-2 border">Harga Satuan</th><th className="p-2 border">Jumlah</th><th className="p-2 border"></th></tr>
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
                  {req.anggaranPerItem && (
                    <td className="border p-1">
                      <select
                        value={it.jenisAnggaran ? (it.jenisAnggaran === "lainnya" ? `lainnya|${it.programId || ""}` : it.jenisAnggaran) : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return setItem(it.id, { jenisAnggaran: undefined, programId: undefined });
                          if (v.startsWith("lainnya|")) return setItem(it.id, { jenisAnggaran: "lainnya", programId: v.slice(8) || undefined });
                          setItem(it.id, { jenisAnggaran: v as any, programId: undefined });
                        }}
                        className={`w-32 px-1 py-0.5 text-xs border rounded font-semibold ${warnaSumber(it)}`}
                        title={labelSumber(it)}>
                        <option value="">↳ ikut pengadaan</option>
                        <option value="rutin">🧭 Rutin</option>
                        <option value="docking">⚓ Docking</option>
                        {program.map((pr) => <option key={pr.id} value={`lainnya|${pr.id}`}>📜 {pr.nama.slice(0, 40)}</option>)}
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
      {/* anchor #spbj — dituju tombol "Isi dari dalam form" pada dialog Nomor SAP di daftar */}
      <div id="spbj" className="mt-8 mb-3 flex items-center gap-2 scroll-mt-6">
        <span className="h-7 w-7 rounded-lg asdp-gradient text-white grid place-items-center text-xs font-bold">2</span>
        <h2 className="font-bold text-slate-700">FASE 2 — setelah SPBJ (PO) terbit · acuan BSTB &amp; BAPP</h2>
      </div>

      <Section title="Data SPBJ / PO" icon="📥"
        desc="Tiga nomor yang berbeda: No. SPBJ (surat dari PBJ) · No. PO SAP (dokumen pembelian di SAP) · No. GR/SES (bukti terima di SAP). Jangan diisi nomor yang sama.">
        <label className="flex items-center gap-2 text-sm mb-3">
          <input type="checkbox" checked={req.status !== "menunggu_spbj"} onChange={(e) => update({ status: e.target.checked ? "spbj_terbit" : "menunggu_spbj" })} />
          SPBJ (PO) sudah terbit — aktifkan BSTB / BAPP
        </label>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="1 · No. SPBJ — angka saja" hint="dari surat PBJ, mis. 3798. Dipakai menyusun No. Kontrak di bawah, BUKAN nomor SAP.">
            <Input value={req.noSpbjNum || ""} onChange={(e) => update({ noSpbjNum: e.target.value })} placeholder="3798" />
          </Field>
          <Field label="2 · Bulan SPBJ — romawi" hint="bulan surat SPBJ, mis. VII untuk Juli">
            <Input value={req.noSpbjBulan || ""} onChange={(e) => update({ noSpbjBulan: e.target.value.toUpperCase() })} placeholder="VII" maxLength={4} />
          </Field>
          {/* Field yang SAMA dengan yang di Fase 1 (satu nilai, dua tempat isi) — PO terbit
              bersama SPBJ, jadi lebih enak diisi di sini, berdampingan dengan GR/SES. */}
          <Field label="3 · No. PO SAP" hint="10 digit dari SAP, biasanya diawali 45… · satu nilai dengan kolom di Fase 1 & kolom No. PO di daftar pengadaan">
            <Input value={req.noPOSAP || ""} onChange={(e) => update({ noPOSAP: e.target.value })} placeholder="4500012345" />
          </Field>
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
        {/* ===== GR / SES ===== */}
        <div className="mt-5 rounded-xl ring-1 ring-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-700">4 · No. GR / SES</span>
            <span className="text-[11px] text-slate-500">bukti terima di SAP (Goods Receipt / Service Entry Sheet) — <b>satu baris = satu kali penerimaan</b>. Ikut tampil di preview &amp; di kolom GR/SES daftar pengadaan, jadi bisa diisi dari sana juga.</span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => update({ grSes: [...(req.grSes || []), grSesBaru()] })}
                className="btn btn-ghost text-xs">＋ Tambah baris</button>
              <button onClick={() => update({ grSes: [1, 2, 3].map((t) => grSesBaru(t)) })}
                className="btn btn-primary text-xs"
                title="Pekerjaan docking dibayar 3 termin dalam 1 SPPBJ, jadi ada 3 nomor GR/SES">
                🛠️ Siapkan 3 termin (docking)
              </button>
            </div>
          </div>
          {!(req.grSes || []).length ? (
            <p className="text-[11px] text-slate-500">
              Belum ada. Untuk pengadaan biasa cukup satu baris; untuk <b>Pekerjaan Docking</b> pakai tombol
              &ldquo;Siapkan 3 termin&rdquo; — Termin I saat BA Naik Dok, II saat BA Selesai Pekerjaan,
              III saat BA Selesai Masa Pemeliharaan.
            </p>
          ) : (
            <>
            <div className="mt-3 overflow-x-auto">
              <div className="space-y-2 min-w-[38rem]">
                {/* judul kolom ditulis sekali di atas — biar tiap baris tidak mengulang label */}
                <div className="grid grid-cols-[5rem_1fr_9.5rem_9rem_2.25rem] gap-2 text-[10px] font-semibold text-slate-500">
                  <span>Termin</span><span>No. GR / SES</span><span>Tanggal terima</span><span>Nilai (Rp)</span><span />
                </div>
                {(req.grSes || []).map((g) => (
                  <div key={g.id} className="grid grid-cols-[5rem_1fr_9.5rem_9rem_2.25rem] gap-2 items-center">
                    <select value={g.termin ?? ""} onChange={(e) => update({
                      grSes: (req.grSes || []).map((x) => x.id === g.id ? { ...x, termin: e.target.value ? +e.target.value : undefined } : x) })}
                      title="Kosongkan bila dibayar sekali. Isi I/II/III hanya untuk pekerjaan bertermin."
                      className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm bg-white">
                      <option value="">—</option><option value="1">I</option><option value="2">II</option><option value="3">III</option>
                    </select>
                    <Input value={g.nomor} placeholder="mis. 5000123456" onChange={(e) => update({
                      grSes: (req.grSes || []).map((x) => x.id === g.id ? { ...x, nomor: e.target.value } : x) })} />
                    <Input type="date" value={g.tanggal || ""} onChange={(e) => update({
                      grSes: (req.grSes || []).map((x) => x.id === g.id ? { ...x, tanggal: e.target.value || undefined } : x) })} />
                    {/* satu nomor = sekali terima penuh -> nilainya ikut tabel item SPBJ,
                        tinggal diketik kalau memang beda */}
                    <Input type="number" value={nilaiGrEfektif(g, req.grSes, req.items) || ""}
                      className={nilaiGrOtomatis(g, req.grSes) ? "bg-emerald-50/60 border-emerald-200" : ""}
                      title={nilaiGrOtomatis(g, req.grSes) ? "Otomatis dari total tabel item SPBJ di bawah. Ketik angka lain untuk menimpa; kosongkan untuk kembali otomatis." : "Nilai termin ini — isi manual karena pembayarannya dipecah."}
                      onChange={(e) => update({
                        grSes: (req.grSes || []).map((x) => x.id === g.id ? { ...x, nilai: e.target.value ? +e.target.value : undefined } : x) })} />
                    <button onClick={() => update({ grSes: (req.grSes || []).filter((x) => x.id !== g.id) })}
                      className="h-10 w-9 rounded-lg border border-slate-300 text-rose-600 hover:bg-rose-50 text-sm" title="Buang baris ini">✕</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2 mt-2">
              {(req.grSes || []).length === 1 && (
                <p className="text-[11px] text-emerald-800 bg-emerald-50 ring-1 ring-emerald-200 rounded-lg px-2.5 py-1.5">
                  Cuma satu nomor → <b>Nilai diisi otomatis</b> sebesar total Tabel Item SPBJ di bawah. Ketik angka
                  lain kalau memang beda; kosongkan lagi untuk kembali otomatis.
                </p>
              )}
              {(() => {
                const total = (req.grSes || []).reduce((s, g) => s + nilaiGrEfektif(g, req.grSes, req.items), 0);
                const acuan = totalSpbj(req.items);
                const selisih = total - acuan;
                return total ? (
                  <p className="text-[11px] text-slate-600 pt-1">
                    Total GR/SES <b className="tabular-nums">{rupiah(total)}</b> · tabel SPBJ {rupiah(acuan)}
                    {selisih ? <span className="text-amber-700"> — selisih {rupiah(Math.abs(selisih))} ({selisih > 0 ? "lebih" : "kurang"})</span> : " · cocok"}
                  </p>
                ) : null;
              })()}
            </div>
            </>
          )}
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
