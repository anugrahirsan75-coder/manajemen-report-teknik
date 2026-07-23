"use client";

import Link from "next/link";
import { useState, Fragment } from "react";
import { saveAs } from "file-saver";
import { Section } from "@/components/Field";
import type { CekResult } from "@/lib/material/kodeCheck";

interface Row { id: string; nama: string; partNumber: string }
const uid = () => globalThis.crypto?.randomUUID?.() ?? String(Math.random());
const emptyRow = (): Row => ({ id: uid(), nama: "", partNumber: "" });

export default function CekKodeMaterial() {
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [res, setRes] = useState<Record<string, CekResult>>({});
  const [pick, setPick] = useState<Record<string, number>>({}); // UMUM: index kandidat terpilih per baris
  const [open, setOpen] = useState<Record<string, boolean>>({}); // UMUM: baris rincian kandidat terbuka
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [meta, setMeta] = useState<{ count: number; source: string; lastSync: number | null; error?: string | null } | null>(null);
  const [tersalin, setTersalin] = useState<string>(""); // nama kolom yg baru disalin (utk umpan balik)

  /** Nilai 1 kolom untuk SEMUA baris terisi — dipakai tombol salin di kepala kolom. */
  const nilaiKolom = (kolom: string): string[] => {
    return rows
      .filter((r) => r.nama.trim() || r.partNumber.trim())
      .map((r, i) => {
        const x = res[r.id];
        const cand = x?.candidates;
        const sel = cand?.length ? cand[Math.min(pick[r.id] ?? 0, cand.length - 1)] : undefined;
        switch (kolom) {
          case "no": return String(i + 1);
          case "nama": return r.nama;
          case "part": return r.partNumber;
          case "kategori": return x?.kategori || (r.partNumber.trim() ? "SC" : "UMUM");
          case "kode": return sel ? sel.kode : x?.kode || "";
          case "desc": return sel ? sel.desc : x?.desc || "";
          case "po": return sel ? sel.po : x?.po || "";
          case "status": return x?.status || "";
          case "lainnya": return x?.kode2 ? `${x.kode2} — ${x.desc2 || ""}` : "";
          default: return "";
        }
      });
  };

  const salinKolom = async (kolom: string, judul: string) => {
    const isi = nilaiKolom(kolom);
    if (!isi.length) { alert("Belum ada item."); return; }
    const teks = isi.join("\n"); // 1 nilai per baris -> tempel langsung ke kolom Excel
    try {
      await navigator.clipboard.writeText(teks);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = teks; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setTersalin(judul);
    setTimeout(() => setTersalin((t) => (t === judul ? "" : t)), 1800);
  };


  // baris export sesuai tabel (ikut kandidat terpilih)
  const exportExcel = async () => {
    const out = rows
      .filter((r) => r.nama.trim() || r.partNumber.trim())
      .map((r, i) => {
        const x = res[r.id];
        const cand = x?.candidates;
        const sel = cand?.length ? cand[Math.min(pick[r.id] ?? 0, cand.length - 1)] : undefined;
        return {
          no: i + 1, nama: r.nama, part: r.partNumber,
          kategori: x?.kategori || (r.partNumber.trim() ? "SC" : "UMUM"),
          kode: sel ? sel.kode : x?.kode || "", desc: sel ? sel.desc : x?.desc || "",
          po: sel ? sel.po : x?.po || "", status: x?.status || "-",
          lainnya: x?.kode2 ? `${x.kode2} — ${x.desc2 || ""}` : "",
        };
      });
    if (!out.length) { alert("Belum ada item."); return; }
    setExporting(true);
    try {
      const r = await fetch("/api/material/cek-export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: out }) });
      if (!r.ok) throw new Error((await r.json()).error || "Gagal export");
      saveAs(await r.blob(), `Cek Kode Material ${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) { alert("Gagal: " + (e?.message ?? e)); } finally { setExporting(false); }
  };

  const setRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const delRow = (id: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));

  // paste blok Excel: kolom 0=Nama, 1=Part Number
  const PASTE: (keyof Row)[] = ["nama", "partNumber"];
  const handlePaste = (startRow: number, startCol: number, e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return;
    e.preventDefault();
    const cells = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((r) => r.split("\t"));
    setRows((rs) => {
      const next = [...rs];
      cells.forEach((cols, ri) => {
        const idx = startRow + ri;
        if (!next[idx]) next[idx] = emptyRow();
        else next[idx] = { ...next[idx] };
        cols.forEach((val, ci) => {
          const f = PASTE[startCol + ci];
          if (f) (next[idx] as any)[f] = val.trim();
        });
      });
      return next;
    });
  };

  const cek = async () => {
    const items = rows.filter((r) => r.nama.trim() || r.partNumber.trim());
    if (!items.length) return;
    setBusy(true);
    try {
      const r = await fetch("/api/material/cek-kode", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal cek");
      const map: Record<string, CekResult> = {};
      (j.results as CekResult[]).forEach((x) => (map[x.id] = x));
      setRes(map);
      setPick({});
      setOpen({});
      if (j.meta) setMeta(j.meta);
    } catch (e: any) {
      alert("Gagal: " + (e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await fetch("/api/material/cek-kode", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal sinkron");
      setMeta(j.meta);
      alert(`DB tersinkron: ${j.meta.count} kode (${j.meta.source === "live" ? "live dari spreadsheet" : "fallback bundled"}).`);
    } catch (e: any) {
      alert("Gagal sinkron: " + (e?.message ?? e));
    } finally {
      setSyncing(false);
    }
  };

  const syncLabel = meta
    ? `DB: ${meta.count.toLocaleString("id-ID")} kode · ${meta.source === "live" ? "live spreadsheet" : meta.source === "cadangan" ? "salinan cadangan (Google tak terjangkau)" : "bundled (offline)"}${meta.lastSync ? " · sync " + new Date(meta.lastSync).toLocaleTimeString("id-ID") : ""}`
    : "DB: DATABASE KODE MATERIAL (auto-sync dari spreadsheet tiap 30 menit)";
  // DB dianggap tak sehat bila jauh lebih sedikit dari isi spreadsheet -> hasil "tidak ada" bisa menyesatkan
  const dbBermasalah = !!meta && (meta.count < 3000 || !!meta.error);

  const isi = rows.filter((r) => r.nama.trim() || r.partNumber.trim());
  const hasil = isi.map((r) => res[r.id]).filter(Boolean) as CekResult[];
  const ada = hasil.filter((x) => x.status !== "tidak ada").length;

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="glass rounded-2xl ring-line elev-md px-5 py-4 mb-6 sticky top-3 z-20">
        <Link href="/material" className="text-xs text-slate-500 hover:text-[#16357f]">‹ Pengajuan Kode Material</Link>
        <h1 className="text-xl font-extrabold asdp-text-gradient">Cek Kode Material</h1>
        <p className="text-xs text-slate-500">
          Langkah awal: cek apakah barang/suku cadang sudah punya kode Material (SAP).
          {hasil.length > 0 && <> · {ada}/{hasil.length} ada/ada kandidat</>}
        </p>
      </div>

      <Section title="Item Pengecekan" icon="🔎">
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-3 text-sm text-slate-700">
          <b className="text-sky-800">Cara cek:</b> isi <b>Nama Barang</b> (untuk barang umum) dan/atau <b>Part Number</b> (untuk suku cadang), lalu klik <b>Cek</b>.
          <ul className="list-disc ml-5 mt-1 text-xs text-slate-600">
            <li><b>Ada Part Number</b> → dianggap <b>suku cadang</b>, dicocokkan ke <i>Old Material Number</i>.</li>
            <li><b>Tanpa Part Number</b> → dianggap <b>barang umum</b>, dicocokkan ke <i>Material description</i>.</li>
          </ul>
          <span className="text-xs">📋 Paste dari Excel (urutan <b>Nama · Part Number</b>) → klik sel → <kbd className="px-1.5 py-0.5 bg-white border rounded">Ctrl+V</kbd>.</span>
        </div>

        <div className="flex gap-2 mb-3">
          <button onClick={addRow} className="btn btn-ghost text-sm">+ Tambah Baris</button>
          <button onClick={cek} disabled={busy} className="asdp-gradient text-white text-sm font-semibold px-4 py-1.5 rounded-lg shadow disabled:opacity-60">
            {busy ? "Mengecek…" : "🔍 Cek Kode Material"}
          </button>
          <button onClick={sync} disabled={syncing} title="Tarik data terbaru dari spreadsheet sekarang"
            className="text-sm border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-60">
            {syncing ? "Menyinkron…" : "🔄 Sinkron DB"}
          </button>
          <button onClick={exportExcel} disabled={exporting} className="btn btn-success text-sm">
            {exporting ? "Menyiapkan…" : "📊 Export Excel"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-slate-50 text-xs">
              <tr>
                <th className="p-2 border w-8">#</th>
                <Th judul="Nama Barang" kolom="nama" kiri onSalin={salinKolom} aktif={tersalin === "Nama Barang"} />
                <Th judul="Part Number" kolom="part" onSalin={salinKolom} aktif={tersalin === "Part Number"} />
                <th className="p-2 border">Kategori</th>
                <Th judul="Kode Material" kolom="kode" onSalin={salinKolom} aktif={tersalin === "Kode Material"} />
                <Th judul="Material Description" kolom="desc" kiri onSalin={salinKolom} aktif={tersalin === "Material Description"} />
                <Th judul="Purchase Order Text" kolom="po" kiri onSalin={salinKolom} aktif={tersalin === "Purchase Order Text"} />
                <th className="p-2 border">Status</th>
                <Th judul="Kode/Deskripsi Lainnya" kolom="lainnya" kiri onSalin={salinKolom} aktif={tersalin === "Kode/Deskripsi Lainnya"} catatan="(SC)" />
                <th className="p-2 border"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => {
                const x = res[r.id];
                const kategori = x?.kategori || (r.partNumber.trim() ? "SC" : "UMUM");
                const cand = x?.candidates;
                const selIdx = cand?.length ? Math.min(pick[r.id] ?? 0, cand.length - 1) : 0;
                const sel = cand?.length ? cand[selIdx] : undefined;
                const showKode = sel ? sel.kode : (x?.kode || "");
                const showDesc = sel ? sel.desc : (x?.desc || "");
                const showPO = sel ? sel.po : (x?.po || "");
                const rowColor = x ? (x.status === "ada" ? "bg-emerald-50/40" : x.status === "cek" ? "bg-amber-50/40" : "bg-rose-50/40") : "";
                const stBadge = x?.status === "ada" ? "bg-emerald-100 text-emerald-700" : x?.status === "cek" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
                const multi = (cand?.length ?? 0) > 1;
                const isOpen = !!open[r.id];
                return (
                  <Fragment key={r.id}>
                  <tr className={rowColor}>
                    <td className="border p-1 text-center text-xs text-slate-400">{ri + 1}</td>
                    <td className="border p-1"><input className="w-52 px-1" value={r.nama} placeholder="nama barang…" onChange={(e) => setRow(r.id, { nama: e.target.value })} onPaste={(e) => handlePaste(ri, 0, e)} /></td>
                    <td className="border p-1"><input className="w-32 px-1" value={r.partNumber} placeholder="part no…" onChange={(e) => setRow(r.id, { partNumber: e.target.value })} onPaste={(e) => handlePaste(ri, 1, e)} /></td>
                    <td className="border p-1 text-center">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${kategori === "SC" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{kategori}</span>
                    </td>
                    <td className="border p-1 text-center font-mono text-xs">{showKode || "—"}</td>
                    <td className="border p-1 text-xs text-slate-600">
                      {cand?.length ? (
                        <div className="flex items-center gap-2">
                          <span className="flex-1">{showDesc}</span>
                          {multi && (
                            <button onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}
                              className="shrink-0 text-[10px] border border-sky-300 text-sky-700 px-1.5 py-0.5 rounded hover:bg-sky-50 whitespace-nowrap">
                              {isOpen ? "tutup ▲" : `rincian (${cand.length}) ▾`}
                            </button>
                          )}
                        </div>
                      ) : (showDesc || "—")}
                    </td>
                    <td className="border p-1 text-xs text-slate-600">{showPO || <span className="text-slate-300">—</span>}</td>
                    <td className="border p-1 text-center">
                      {x ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${stBadge}`}>{x.status}</span> : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="border p-1 text-xs text-slate-600">
                      {x?.kode2 ? <><span className="font-mono">{x.kode2}</span> — {x.desc2}</> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="border p-1 text-center"><button onClick={() => delRow(r.id)} className="text-red-500 text-xs">hapus</button></td>
                  </tr>
                  {isOpen && cand && (
                    <tr className="bg-sky-50/50">
                      <td className="border"></td>
                      <td className="border p-2" colSpan={9}>
                        <div className="text-[11px] font-semibold text-slate-600 mb-1.5">Pilih material description yang sesuai untuk &quot;{r.nama || r.partNumber}&quot; ({cand.length} kandidat):</div>
                        <div className="grid sm:grid-cols-2 gap-1">
                          {cand.map((c, ci) => (
                            <button key={ci} onClick={() => { setPick((p) => ({ ...p, [r.id]: ci })); setOpen((o) => ({ ...o, [r.id]: false })); }}
                              className={`flex items-center gap-2 text-left text-xs px-2 py-1 rounded border ${ci === selIdx ? "bg-emerald-100 border-emerald-300 font-semibold" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
                              <span className="font-mono text-slate-500 w-24 shrink-0">{c.kode}</span>
                              <span className="flex-1">{c.desc}{c.po && <span className="text-slate-400"> · {c.po}</span>}</span>
                              {ci === selIdx && <span className="text-emerald-600">✓</span>}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {dbBermasalah && (
          <div className="mt-3 rounded-xl bg-red-50 ring-1 ring-red-300 px-3 py-2 text-xs text-red-800">
            <b>⚠ Database kode material belum lengkap terbaca</b> — baru {meta?.count.toLocaleString("id-ID")} kode.
            Hasil &quot;tidak ada&quot; belum tentu benar. Klik <b>Sinkron DB</b> untuk menarik ulang.
            {meta?.error && <span className="block mt-0.5 text-red-700/80">Sebab: {meta.error}</span>}
          </div>
        )}
        <p className="text-xs text-slate-400 mt-3">{syncLabel}. <b>Barang umum</b> fuzzy → status <b>cek</b> = ada kandidat mirip, pilih di tombol rincian. <b>Suku cadang</b> cocok part number (abaikan pemisah); &gt;1 kode → kolom <i>Lainnya</i> / tombol rincian. Update spreadsheet → server auto-refresh; klik <b>Sinkron DB</b> untuk tarik langsung.</p>
      </Section>
    </main>
  );
}

/** Kepala kolom + tombol salin 1 kolom (semua baris) ke papan klip. */
function Th({ judul, kolom, kiri, onSalin, aktif, catatan }: {
  judul: string; kolom: string; kiri?: boolean; aktif?: boolean; catatan?: string;
  onSalin: (kolom: string, judul: string) => void;
}) {
  return (
    <th className={`p-2 border ${kiri ? "text-left" : ""}`}>
      <span className="inline-flex items-center gap-1.5">
        <span>{judul}{catatan && <span className="text-[9px] text-slate-400 ml-1">{catatan}</span>}</span>
        <button type="button" onClick={() => onSalin(kolom, judul)}
          title={`Salin seluruh kolom ${judul} (1 baris per item, siap tempel ke Excel)`}
          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border transition ${aktif ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-300 text-slate-500 hover:border-sky-400 hover:text-sky-700"}`}>
          {aktif ? "✓ tersalin" : "⧉ salin"}
        </button>
      </span>
    </th>
  );
}
