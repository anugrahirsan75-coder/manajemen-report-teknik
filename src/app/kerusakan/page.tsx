"use client";
/**
 * Rekap Kerusakan Kapal (Report Accident).
 *
 * Rancangan: satu layar untuk mencatat & menelusuri kerusakan armada.
 *  - Kartu ringkas di atas: berapa yang belum ditangani, sedang ditangani, selesai,
 *    berapa trip hilang, berapa perkiraan biaya.
 *  - Saring per kapal / status / tahun + pencarian bebas.
 *  - Tabel mengikuti kolom laporan cabang; klik baris untuk melihat & menyunting.
 *  - Kolom "Lost Opportunity" = jumlah trip yang hilang akibat kerusakan.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { useKerusakan } from "@/lib/kerusakan/store";
import { Kerusakan, kerusakanBaru, BAGIAN, STATUS_LABEL, STATUS_WARNA, StatusKerusakan, ringkas } from "@/lib/kerusakan/types";
import { rupiah, tanggalIndo } from "@/lib/format";
import { ringkasKapal } from "@/lib/kapal/nama";

export default function KerusakanPage() {
  const { ready, loading, list, err, reload, simpan, hapus } = useKerusakan();
  const [kapal, setKapal] = useState("");
  const [status, setStatus] = useState<"" | StatusKerusakan>("");
  const [tahun, setTahun] = useState("");
  const [cari, setCari] = useState("");
  const [edit, setEdit] = useState<Kerusakan | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const tahunList = useMemo(
    () => Array.from(new Set(list.map((k) => (k.tanggal || "").slice(0, 4)).filter(Boolean))).sort().reverse(),
    [list]);

  const tampil = useMemo(() => list.filter((k) => {
    if (kapal && k.kapal !== kapal) return false;
    if (status && k.status !== status) return false;
    if (tahun && !(k.tanggal || "").startsWith(tahun)) return false;
    if (cari) {
      const hay = [k.kapal, k.bagian, k.kejadian, k.akibat, k.tindakLanjut, k.catatan].filter(Boolean).join(" ").toLowerCase();
      if (!cari.toLowerCase().split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    return true;
  }), [list, kapal, status, tahun, cari]);

  const r = ringkas(tampil);

  // kapal dengan kejadian terbanyak — untuk melihat armada yang paling sering bermasalah
  const perKapal = useMemo(() => {
    const m: Record<string, { n: number; trip: number }> = {};
    tampil.forEach((k) => {
      const s = (m[k.kapal] ||= { n: 0, trip: 0 });
      s.n += 1; s.trip += k.lostOpportunity || 0;
    });
    return Object.entries(m).sort((a, b) => b[1].n - a[1].n).slice(0, 6);
  }, [tampil]);

  const simpanEdit = async () => {
    if (!edit) return;
    if (!edit.kapal) { alert("Pilih kapal dulu."); return; }
    if (!edit.kejadian.trim()) { alert("Isi dulu kejadiannya."); return; }
    setSibuk(true);
    try { await simpan(edit); setEdit(null); } finally { setSibuk(false); }
  };

  const unduhCsv = () => {
    const kol = ["No", "Kapal", "Tanggal", "Bagian", "Kejadian", "Akibat / Tindakan",
                 "Trip Hilang", "Biaya", "Evidence", "Tindak Lanjut", "Status"];
    const baris = tampil.map((k, i) => [
      i + 1, k.kapal, k.tanggal, k.bagian, k.kejadian, k.akibat,
      k.lostOpportunity || 0, k.biaya || 0, k.evidence, k.tindakLanjut, STATUS_LABEL[k.status],
    ]);
    const csv = [kol, ...baris]
      .map((b) => b.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `Rekap Kerusakan Kapal${tahun ? " " + tahun : ""}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex flex-wrap items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 grid place-items-center text-2xl text-white shadow-md shrink-0">🛠️</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold asdp-text-gradient tracking-tight">Rekap Kerusakan Kapal</h1>
            <p className="text-slate-500 text-sm">Report Accident — kejadian, dampak, trip yang hilang, bukti &amp; tindak lanjut</p>
          </div>
          <button onClick={() => setEdit(kerusakanBaru(kapal))} className="btn btn-primary text-sm px-5 py-2.5">＋ Catat Kerusakan</button>
          <button onClick={unduhCsv} disabled={!tampil.length} className="btn btn-ghost text-xs disabled:opacity-50">📊 Unduh CSV</button>
          <button onClick={reload} className="btn btn-ghost text-xs">↻ Muat ulang</button>
        </div>
      </div>

      {!ready && (
        <p className="mt-5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
          Butuh Supabase (env) supaya catatan tersimpan &amp; bisa dibuka dari perangkat lain.
        </p>
      )}
      {err && <p className="mt-4 text-xs font-semibold text-rose-700">Supabase: {err}</p>}

      {/* ringkasan */}
      <section className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kartu label="Total kejadian" nilai={String(r.total)} tint="text-slate-900" bar="bg-slate-500" />
        <Kartu label="Belum ditangani" nilai={String(r.terbuka)} tint="text-rose-700" bar="bg-rose-500" />
        <Kartu label="Sedang ditangani" nilai={String(r.proses)} tint="text-amber-700" bar="bg-amber-500" />
        <Kartu label="Selesai" nilai={String(r.selesai)} tint="text-emerald-700" bar="bg-emerald-500" />
        <Kartu label="Trip hilang" nilai={String(r.trip)} sub={r.biaya ? `biaya ${rupiah(r.biaya)}` : undefined} tint="text-indigo-700" bar="bg-indigo-500" />
      </section>

      {perKapal.length > 1 && (
        <div className="mt-3 bg-white rounded-2xl ring-line elev-sm px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Kapal dengan kejadian terbanyak</p>
          <div className="flex flex-wrap gap-2">
            {perKapal.map(([k, v]) => (
              <button key={k} onClick={() => setKapal(kapal === k ? "" : k)}
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition ${kapal === k ? "bg-slate-800 text-white border-slate-800" : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"}`}>
                {ringkasKapal(k)} <span className="opacity-70">· {v.n}x{v.trip ? ` · ${v.trip} trip` : ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* saringan */}
      <div className="mt-3 bg-white rounded-2xl ring-line elev-sm p-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari kejadian / bagian / tindak lanjut…"
            className="text-xs border border-slate-300 rounded-lg pl-7 pr-3 py-1.5 w-64" />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
        </div>
        <select value={kapal} onChange={(e) => setKapal(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
          <option value="">Semua kapal</option>
          {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={tahun} onChange={(e) => setTahun(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
          <option value="">Semua tahun</option>
          {tahunList.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex rounded-lg overflow-hidden ring-1 ring-slate-200">
          {([["", "Semua"], ["terbuka", "Belum"], ["proses", "Proses"], ["selesai", "Selesai"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setStatus(v as any)}
              className={`text-[11px] font-bold px-2.5 py-1.5 ${status === v ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{l}</button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-slate-500">{tampil.length} dari {list.length} kejadian</span>
      </div>

      {/* tabel */}
      <div className="mt-3 bg-white rounded-2xl ring-line elev-md overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Memuat…</p>
        ) : !tampil.length ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">Belum ada catatan kerusakan{list.length ? " pada saringan ini" : ""}.</p>
            <button onClick={() => setEdit(kerusakanBaru(kapal))} className="btn btn-primary text-xs mt-3">＋ Catat kerusakan pertama</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600 font-bold">
                <tr>
                  <th className="p-2 text-left w-8">No</th>
                  <th className="p-2 text-left w-32">Kapal</th>
                  <th className="p-2 text-left w-24">Tanggal</th>
                  <th className="p-2 text-left">Kejadian</th>
                  <th className="p-2 text-left">Akibat / Tindakan</th>
                  <th className="p-2 text-center w-16">Trip<br />hilang</th>
                  <th className="p-2 text-left w-20">Bukti</th>
                  <th className="p-2 text-left">Tindak lanjut</th>
                  <th className="p-2 text-center w-24">Status</th>
                  <th className="p-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {tampil.map((k, i) => (
                  <tr key={k.id} className="border-b border-slate-100 last:border-0 align-top hover:bg-slate-50/70">
                    <td className="p-2 text-slate-500">{i + 1}</td>
                    <td className="p-2 font-semibold text-slate-800 whitespace-nowrap">
                      {ringkasKapal(k.kapal)}
                      {k.bagian ? <span className="block text-[10px] font-normal text-slate-500">{k.bagian}</span> : null}
                    </td>
                    <td className="p-2 text-slate-600 whitespace-nowrap">{k.tanggal ? tanggalIndo(k.tanggal) : "—"}</td>
                    <td className="p-2 text-slate-800">{k.kejadian}</td>
                    <td className="p-2 text-slate-700">{k.akibat || <span className="text-slate-400">—</span>}</td>
                    <td className="p-2 text-center font-bold tabular-nums text-slate-900">{k.lostOpportunity || 0}</td>
                    <td className="p-2">
                      {k.evidence
                        ? <a href={k.evidence} target="_blank" rel="noreferrer" className="text-blue-700 font-bold text-xs hover:underline">buka ↗</a>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="p-2 text-slate-700">{k.tindakLanjut || <span className="text-slate-400">—</span>}</td>
                    <td className="p-2 text-center">
                      <span className={`inline-block text-[10px] font-extrabold px-2 py-1 rounded-full ring-1 whitespace-nowrap ${STATUS_WARNA[k.status]}`}>
                        {STATUS_LABEL[k.status]}
                      </span>
                      {k.biaya ? <span className="block text-[10px] text-slate-500 mt-1">{rupiah(k.biaya)}</span> : null}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button onClick={() => setEdit({ ...k })} className="text-xs font-bold text-slate-700 hover:underline">✏️</button>
                      <button onClick={() => { if (confirm(`Hapus catatan kerusakan ${k.kapal} (${k.tanggal})?`)) hapus(k.id); }}
                        className="text-xs text-rose-600 hover:text-rose-800 ml-2">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] text-slate-500">
        Kolom <b>Trip hilang</b> = Lost Opportunity, yaitu jumlah trip yang batal akibat kerusakan.
        Isi <b>Bukti</b> dengan tautan folder foto/dokumen (mis. Google Drive).
      </p>

      {/* formulir */}
      {edit && (
        <div className="fixed inset-0 z-[80] bg-black/50 overflow-auto" onMouseDown={() => setEdit(null)}>
          <div className="min-h-full py-8 px-3 flex items-start justify-center">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl p-6" onMouseDown={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-extrabold text-slate-800 mb-4">
                {list.some((x) => x.id === edit.id) ? "Ubah Catatan Kerusakan" : "Catat Kerusakan Kapal"}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Baris label="Kapal">
                  <select value={edit.kapal} onChange={(e) => setEdit({ ...edit, kapal: e.target.value })} className="inp">
                    <option value="">— pilih kapal —</option>
                    {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </Baris>
                <Baris label="Tanggal kejadian">
                  <input type="date" value={edit.tanggal} onChange={(e) => setEdit({ ...edit, tanggal: e.target.value })} className="inp" />
                </Baris>
                <Baris label="Bagian kapal">
                  <input list="bagianList" value={edit.bagian} onChange={(e) => setEdit({ ...edit, bagian: e.target.value })}
                    placeholder="mis. Mesin Induk" className="inp" />
                  <datalist id="bagianList">{BAGIAN.map((b) => <option key={b} value={b} />)}</datalist>
                </Baris>
                <Baris label="Status penanganan">
                  <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as StatusKerusakan })} className="inp">
                    {(Object.keys(STATUS_LABEL) as StatusKerusakan[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </Baris>
                <Baris label="Kejadian (Events / Genesis)" lebar>
                  <textarea rows={2} value={edit.kejadian} onChange={(e) => setEdit({ ...edit, kejadian: e.target.value })}
                    placeholder="mis. Crack pada piston no. 2" className="inp" />
                </Baris>
                <Baris label="Akibat / tindakan (Effect / Resulting)" lebar>
                  <textarea rows={2} value={edit.akibat} onChange={(e) => setEdit({ ...edit, akibat: e.target.value })}
                    placeholder="mis. Dilakukan penggantian baru" className="inp" />
                </Baris>
                <Baris label="Trip hilang (Lost Opportunity)">
                  <input type="number" min={0} value={edit.lostOpportunity || ""}
                    onChange={(e) => setEdit({ ...edit, lostOpportunity: +e.target.value })} className="inp" />
                </Baris>
                <Baris label="Perkiraan biaya (opsional)">
                  <input type="number" min={0} value={edit.biaya || ""}
                    onChange={(e) => setEdit({ ...edit, biaya: +e.target.value || undefined })} className="inp" />
                </Baris>
                <Baris label="Bukti (tautan foto / dokumen)" lebar>
                  <input value={edit.evidence} onChange={(e) => setEdit({ ...edit, evidence: e.target.value })}
                    placeholder="https://drive.google.com/…" className="inp" />
                </Baris>
                <Baris label="Tindak lanjut (Follow up)" lebar>
                  <textarea rows={2} value={edit.tindakLanjut} onChange={(e) => setEdit({ ...edit, tindakLanjut: e.target.value })}
                    placeholder="mis. Telah diusulkan penggantian SC baru ke OMA Kantor Pusat" className="inp" />
                </Baris>
                <Baris label="Catatan tambahan" lebar>
                  <input value={edit.catatan || ""} onChange={(e) => setEdit({ ...edit, catatan: e.target.value })} className="inp" />
                </Baris>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setEdit(null)} className="btn btn-ghost text-sm">Batal</button>
                <button onClick={simpanEdit} disabled={sibuk} className="btn btn-primary text-sm">{sibuk ? "Menyimpan…" : "💾 Simpan"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .inp { width: 100%; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.5rem 0.65rem; font-size: 0.85rem; background: #fff; }
      `}</style>
    </main>
  );
}

function Kartu({ label, nilai, sub, tint, bar }: { label: string; nilai: string; sub?: string; tint: string; bar: string }) {
  return (
    <div className="relative bg-white rounded-2xl ring-line elev-sm pl-4 pr-3 py-3 overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${bar}`} />
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold">{label}</p>
      <p className={`text-2xl font-extrabold tabular-nums leading-tight ${tint}`}>{nilai}</p>
      {sub ? <p className="text-[10px] text-slate-500">{sub}</p> : null}
    </div>
  );
}
function Baris({ label, children, lebar }: { label: string; children: React.ReactNode; lebar?: boolean }) {
  return (
    <label className={`block ${lebar ? "sm:col-span-2" : ""}`}>
      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">{label}</span>
      {children}
    </label>
  );
}
