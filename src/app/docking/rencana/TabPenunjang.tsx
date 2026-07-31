"use client";
/**
 * RAB Penunjang Docking — semua biaya di luar kontrak galangan, dikelompokkan
 * persis seperti berkas "Penunjang Docking": tiap kelompok punya Mata Anggaran
 * sendiri, sub-jumlah, PPN, lalu jumlah.
 *
 * Pengelompokan per Mata Anggaran ini yang nanti dipakai kontrol anggaran dan
 * usulan RKA, jadi angkanya tidak perlu disalin ulang ke mana-mana.
 */
import { useState } from "react";
import { rupiah } from "@/lib/format";
import {
  ItemPenunjang, RencanaDocking, penunjangBaru, nilaiPenunjang, rekapPenunjang,
  KELOMPOK_PENUNJANG, STATUS_USULAN, StatusUsulan, SUMBER_LABEL, PPN_BAKU,
} from "@/lib/docking/rencana/types";
import CariHarga from "./CariHarga";
import PanelCat from "./PanelCat";

export default function TabPenunjang({ r, ubah }: {
  r: RencanaDocking;
  ubah: (patch: Partial<RencanaDocking>) => void;
}) {
  const [buka, setBuka] = useState<Record<string, boolean>>({ roro: true });
  const [cariUntuk, setCariUntuk] = useState<ItemPenunjang | null>(null);
  const [otomatis, setOtomatis] = useState("");
  const rekap = rekapPenunjang(r);
  const belumHarga = (r.penunjang || []).filter((x) => !x.harga && x.uraian.trim().length >= 6);

  const isiOtomatis = async () => {
    if (!belumHarga.length) return;
    setOtomatis("jalan");
    try {
      const res = await fetch("/api/harga/cocok", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: belumHarga.map((x) => ({ id: x.id, teks: `${x.uraian} ${x.spek || ""} ${x.grup}` })) }),
      });
      const d = await res.json();
      if (!d.ok) { setOtomatis("Gagal: " + (d.error || res.status)); return; }
      let terisi = 0, ragu = 0;
      ubah({
        penunjang: (r.penunjang || []).map((x) => {
          const c = d.hasil[x.id];
          if (!c || x.harga) return x;
          if (!c.yakin) { ragu++; return x; }
          terisi++;
          return { ...x, harga: c.harga, sumber: "database" as const, refHarga: c.kode };
        }),
      });
      setOtomatis(`Terisi ${terisi} dari ${belumHarga.length} baris` +
        (ragu ? ` · ${ragu} tak cukup yakin (dibiarkan kosong)` : ""));
    } catch (e: any) { setOtomatis("Gagal: " + (e?.message || e)); }
  };

  const setItem = (id: string, patch: Partial<ItemPenunjang>) =>
    ubah({ penunjang: (r.penunjang || []).map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const buang = (id: string) => ubah({ penunjang: (r.penunjang || []).filter((x) => x.id !== id) });
  const tambah = (kelompok: string, grup: string) =>
    ubah({ penunjang: [...(r.penunjang || []), penunjangBaru({ kelompok, grup })] });

  return (
    <div className="space-y-3">
      {belumHarga.length > 0 && (
        <div className="flex items-center gap-2">
          <button onClick={isiOtomatis} disabled={otomatis === "jalan"}
            className="btn btn-success text-xs disabled:opacity-50"
            title="Cocokkan baris tanpa harga dengan database realisasi 2024-2026">
            {otomatis === "jalan" ? "mencocokkan…" : `💰 Isi harga otomatis (${belumHarga.length})`}
          </button>
          {otomatis && otomatis !== "jalan" && (
            <span className="text-[11px] text-slate-700 bg-emerald-50 ring-1 ring-emerald-200 rounded-lg px-3 py-1.5">
              {otomatis} <button onClick={() => setOtomatis("")} className="ml-1 text-slate-400 hover:text-slate-700">✕</button>
            </span>
          )}
        </div>
      )}
      <PanelCat r={r} ubah={ubah} />

      {rekap.map((k) => {
        const items = (r.penunjang || []).filter((x) => x.kelompok === k.key);
        const terbuka = buka[k.key] ?? false;
        const lebih = k.pagu > 0 && k.jumlah > k.pagu;
        return (
          <div key={k.key} className="bg-white rounded-2xl ring-line elev-sm overflow-hidden">
            <button onClick={() => setBuka((p) => ({ ...p, [k.key]: !terbuka }))}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 text-left">
              <span className="text-slate-400 text-xs w-4">{terbuka ? "▾" : "▸"}</span>
              <span className="text-[11px] font-bold text-slate-400 w-8">{k.romawi}.</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-800 leading-snug">{k.nama}</span>
                <span className="block text-[10px] text-slate-400">M.A. {k.ma} · {items.length} baris</span>
              </span>
              <span className="text-right shrink-0">
                <span className="block text-sm font-bold tabular-nums text-slate-800">{rupiah(k.jumlah)}</span>
                {k.pagu > 0 && (
                  <span className={`block text-[10px] tabular-nums ${lebih ? "text-rose-600" : "text-slate-400"}`}>
                    pagu {rupiah(k.pagu)}{lebih ? ` · lebih ${rupiah(k.jumlah - k.pagu)}` : ""}
                  </span>
                )}
              </span>
            </button>

            {terbuka && (
              <div className="border-t border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[58rem]">
                    <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th className="px-2 py-1.5 text-left w-44">Sub-kelompok</th>
                        <th className="px-2 py-1.5 text-left">Uraian barang / jasa</th>
                        <th className="px-2 py-1.5 text-right w-16">Vol</th>
                        <th className="px-2 py-1.5 text-left w-20">Satuan</th>
                        <th className="px-2 py-1.5 text-right w-32">Harga satuan</th>
                        <th className="px-2 py-1.5 text-right w-32">Jumlah</th>
                        <th className="px-2 py-1.5 text-left w-28">Status</th>
                        <th className="px-2 py-1.5 w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id} className="border-b border-slate-100 last:border-0 align-top">
                          <td className="px-2 py-1.5">
                            <input list={`grup-${k.key}`} value={it.grup} onChange={(e) => setItem(it.id, { grup: e.target.value })}
                              placeholder="pilih / ketik" className="w-full rounded border border-slate-200 px-1.5 py-1 text-[11px]" />
                            <datalist id={`grup-${k.key}`}>{k.sub.map((s) => <option key={s} value={s} />)}</datalist>
                          </td>
                          <td className="px-2 py-1.5">
                            <input value={it.uraian} onChange={(e) => setItem(it.id, { uraian: e.target.value })}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-[12px]" />
                            <input value={it.spek || ""} onChange={(e) => setItem(it.id, { spek: e.target.value })}
                              placeholder="spesifikasi (opsional)"
                              className="w-full mt-1 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-500" />
                            {it.sumber && <span className="text-[10px] text-slate-400">{SUMBER_LABEL[it.sumber]}{it.refHarga ? ` · ${it.refHarga}` : ""}</span>}
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" value={it.vol || ""} onChange={(e) => setItem(it.id, { vol: +e.target.value || 0 })}
                              className="w-full rounded border border-slate-200 px-1.5 py-1 text-[12px] text-right tabular-nums" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input value={it.satuan} onChange={(e) => setItem(it.id, { satuan: e.target.value })}
                              className="w-full rounded border border-slate-200 px-1.5 py-1 text-[12px]" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" value={it.harga || ""} onChange={(e) => setItem(it.id, { harga: +e.target.value || 0, sumber: "manual" })}
                              className="w-full rounded border border-slate-200 px-1.5 py-1 text-[12px] text-right tabular-nums" />
                            <button onClick={() => setCariUntuk(it)} className="mt-1 w-full text-[10px] text-[#1ca3dd] hover:underline">cari harga acuan</button>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{rupiah(nilaiPenunjang(it))}</td>
                          <td className="px-2 py-1.5">
                            <select value={it.status || "usulan"} onChange={(e) => setItem(it.id, { status: e.target.value as StatusUsulan })}
                              className={`w-full rounded px-1.5 py-1 text-[11px] ring-1 ${STATUS_USULAN[it.status || "usulan"].kelas}`}>
                              {Object.entries(STATUS_USULAN).map(([kk, v]) => <option key={kk} value={kk}>{v.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => buang(it.id)} className="text-rose-600 hover:bg-rose-50 rounded px-2 py-1 text-xs">✕</button>
                          </td>
                        </tr>
                      ))}
                      {!items.length && (
                        <tr><td colSpan={8} className="px-4 py-3 text-xs text-slate-400">Belum ada baris pada kelompok ini.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-3">
                  <div className="flex flex-wrap gap-1">
                    {k.sub.map((s) => (
                      <button key={s} onClick={() => tambah(k.key, s)}
                        className="text-[11px] px-2 py-1 rounded-lg ring-1 ring-slate-200 bg-white hover:bg-slate-100 text-slate-600">＋ {s}</button>
                    ))}
                  </div>
                  <span className="flex-1" />
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    Sub jumlah {rupiah(k.subJumlah)} · PPN {r.ppn ?? PPN_BAKU}% {rupiah(k.ppn)} · <b className="text-slate-700">Jumlah {rupiah(k.jumlah)}</b>
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="bg-white rounded-2xl ring-line elev-sm p-4 flex items-center">
        <span className="text-sm font-semibold text-slate-700 flex-1">Jumlah seluruh penunjang docking</span>
        <b className="text-lg tabular-nums text-slate-800">{rupiah(rekap.reduce((s, k) => s + k.jumlah, 0))}</b>
      </div>

      {cariUntuk && (
        <CariHarga awal={cariUntuk.uraian.slice(0, 40)} onTutup={() => setCariUntuk(null)}
          onPilih={(p) => {
            setItem(cariUntuk.id, {
              harga: p.harga, satuan: cariUntuk.satuan || p.satuan,
              uraian: cariUntuk.uraian || p.uraian, spek: cariUntuk.spek || p.spek,
              sumber: "database", refHarga: p.kode,
            });
            setCariUntuk(null);
          }} />
      )}

      {KELOMPOK_PENUNJANG.length === 0 && null}
    </div>
  );
}
