"use client";
/**
 * Repair List — daftar pekerjaan yang dikerjakan galangan.
 *
 * Barisnya dikelompokkan per bagian Docking Code (OM-01 General Service,
 * OM-02 Blasting & Painting, CM-04 Piping, dst.) persis seperti berkas yang
 * dikirim ke pusat, supaya hasil cetaknya tinggal dipakai.
 *
 * Tiap baris menyimpan dari mana harganya berasal dan rentang pembandingnya.
 * Baris yang harganya di atas rentang pembanding ditandai — pusat memeriksa hal
 * yang sama, jadi lebih baik ketahuan di cabang lebih dulu.
 */
import { useMemo, useState } from "react";
import { rupiah } from "@/lib/format";
import {
  ItemRl, RencanaDocking, rlBaru, nilaiRl, periksaHarga,
  STATUS_USULAN, StatusUsulan, SUMBER_LABEL, PPN_BAKU, ppnDari,
} from "@/lib/docking/rencana/types";
import CariHarga from "./CariHarga";
import PilihPekerjaan from "./PilihPekerjaan";
import ImporBorang from "./ImporBorang";

export default function TabRepairList({ r, ubah }: {
  r: RencanaDocking;
  ubah: (patch: Partial<RencanaDocking>) => void;
}) {
  const [jenis, setJenis] = useState<"dok" | "floating">("dok");
  const [pilih, setPilih] = useState(false);
  const [impor, setImpor] = useState(false);
  const [cariUntuk, setCariUntuk] = useState<ItemRl | null>(null);

  const list = useMemo(() => (r.rl || []).filter((x) => x.jenis === jenis), [r.rl, jenis]);
  const grup = useMemo(() => {
    const m = new Map<string, ItemRl[]>();
    list.forEach((x) => {
      const k = x.grup || x.kode || "(tanpa kelompok)";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(x);
    });
    return Array.from(m.entries());
  }, [list]);

  const setItem = (id: string, patch: Partial<ItemRl>) =>
    ubah({ rl: (r.rl || []).map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const buang = (id: string) => ubah({ rl: (r.rl || []).filter((x) => x.id !== id) });
  const tambah = (items: ItemRl[]) => ubah({ rl: [...(r.rl || []), ...items.map((x) => ({ ...x, jenis }))] });

  const sub = list.reduce((s, x) => s + nilaiRl(x), 0);
  const ppn = ppnDari(sub, r.ppn ?? PPN_BAKU);
  const ragu = list.filter((x) => periksaHarga(x)?.nada === "tinggi").length;
  const belumHarga = list.filter((x) => !x.harga).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg overflow-hidden ring-1 ring-slate-200 bg-white">
          {([["dok", "RL Docking"], ["floating", "RL Floating"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setJenis(v)}
              className={`text-[11px] font-bold px-3 py-2 ${jenis === v ? "bg-slate-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {l} {(r.rl || []).filter((x) => x.jenis === v).length}
            </button>
          ))}
        </div>
        <button onClick={() => setImpor(true)} className="btn btn-primary text-xs" title="Unggah PDF Daftar Pekerjaan Docking / Permintaan Pengadaan dari kapal">📄 Baca permintaan kapal</button>
        <button onClick={() => setPilih(true)} className="btn btn-ghost text-xs">＋ Tambah dari tarif / kerangka RL</button>
        <button onClick={() => tambah([rlBaru({ jenis })])} className="btn btn-ghost text-xs">＋ Baris kosong</button>
        <span className="flex-1" />
        {belumHarga > 0 && <span className="text-[11px] text-slate-500">{belumHarga} baris belum berharga</span>}
        {ragu > 0 && <span className="text-[11px] text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-full px-2 py-0.5">{ragu} baris di atas rentang pembanding</span>}
      </div>

      {!list.length ? (
        <div className="text-center bg-white rounded-2xl ring-line elev-sm p-8">
          <p className="text-slate-400 text-sm">Belum ada pekerjaan. Mulai dari <b>Tambah dari tarif / kerangka RL</b> —
            tarif galangan sudah berikut harganya, kerangka RL sudah berikut Docking Code-nya.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grup.map(([nama, items]) => (
            <div key={nama} className="bg-white rounded-2xl ring-line elev-sm overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 flex-1">{nama}</span>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {items.length} pekerjaan · {rupiah(items.reduce((s, x) => s + nilaiRl(x), 0))}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[62rem]">
                  <thead className="text-[10px] uppercase tracking-wide text-slate-500 bg-white">
                    <tr className="border-b border-slate-200">
                      <th className="px-2 py-1.5 text-left w-24">Kode</th>
                      <th className="px-2 py-1.5 text-left">Uraian pekerjaan</th>
                      <th className="px-2 py-1.5 text-right w-16">Vol</th>
                      <th className="px-2 py-1.5 text-left w-24">Satuan</th>
                      <th className="px-2 py-1.5 text-right w-32">Harga satuan</th>
                      <th className="px-2 py-1.5 text-right w-32">Jumlah</th>
                      <th className="px-2 py-1.5 text-left w-28">Status</th>
                      <th className="px-2 py-1.5 w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => {
                      const cek = periksaHarga(it);
                      return (
                        <tr key={it.id} className="border-b border-slate-100 last:border-0 align-top">
                          <td className="px-2 py-1.5">
                            <input value={it.kode} onChange={(e) => setItem(it.id, { kode: e.target.value })}
                              placeholder="OM - 01" className="w-full rounded border border-slate-200 px-1.5 py-1 text-[11px]" />
                            <input value={it.sub} onChange={(e) => setItem(it.id, { sub: e.target.value })}
                              placeholder="sub" className="w-full mt-1 rounded border border-slate-200 px-1.5 py-1 text-[11px]" />
                          </td>
                          <td className="px-2 py-1.5">
                            <textarea value={it.uraian} onChange={(e) => setItem(it.id, { uraian: e.target.value })}
                              rows={Math.min(4, Math.max(1, Math.ceil(it.uraian.length / 70)))}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-[12px] leading-snug resize-y" />
                            <div className="flex items-center gap-2 mt-0.5">
                              {it.sumber && <span className="text-[10px] text-slate-400">{SUMBER_LABEL[it.sumber]}{it.refHarga ? ` · ${it.refHarga}` : ""}</span>}
                              {cek && cek.nada !== "wajar" && (
                                <span className={`text-[10px] ${cek.nada === "tinggi" ? "text-amber-700" : "text-sky-700"}`}>
                                  {cek.nada === "tinggi" ? `↑ ${cek.pct}% di atas pembanding` : `↓ ${cek.pct}% di bawah pembanding`}
                                  {" "}({rupiah(it.bandingLo || 0)}–{rupiah(it.bandingHi || 0)})
                                </span>
                              )}
                            </div>
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
                              className={`w-full rounded border px-1.5 py-1 text-[12px] text-right tabular-nums ${
                                cek?.nada === "tinggi" ? "border-amber-300 bg-amber-50/60" : "border-slate-200"}`} />
                            <button onClick={() => setCariUntuk(it)}
                              className="mt-1 w-full text-[10px] text-[#1ca3dd] hover:underline">cari harga acuan</button>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{rupiah(nilaiRl(it))}</td>
                          <td className="px-2 py-1.5">
                            <select value={it.status || "usulan"} onChange={(e) => setItem(it.id, { status: e.target.value as StatusUsulan })}
                              className={`w-full rounded px-1.5 py-1 text-[11px] ring-1 ${STATUS_USULAN[it.status || "usulan"].kelas}`}>
                              {Object.entries(STATUS_USULAN).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => buang(it.id)} className="text-rose-600 hover:bg-rose-50 rounded px-2 py-1 text-xs" title="Buang baris">✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {list.length > 0 && (
        <div className="bg-white rounded-2xl ring-line elev-sm p-4 text-sm">
          <div className="flex justify-between py-0.5"><span className="text-slate-600">Sub jumlah {jenis === "dok" ? "RL Docking" : "RL Floating"}</span><b className="tabular-nums">{rupiah(sub)}</b></div>
          <div className="flex justify-between py-0.5 text-slate-500"><span>PPN {r.ppn ?? PPN_BAKU}%</span><span className="tabular-nums">{rupiah(ppn)}</span></div>
          <div className="flex justify-between py-1 border-t border-slate-200 mt-1"><span className="font-semibold text-slate-700">Jumlah</span><b className="tabular-nums text-slate-800">{rupiah(sub + ppn)}</b></div>
        </div>
      )}

      {pilih && <PilihPekerjaan onTutup={() => setPilih(false)} onTambah={tambah} />}
      {impor && (
        <ImporBorang onTutup={() => setImpor(false)}
          onRl={(items) => ubah({ rl: [...(r.rl || []), ...items] })}
          onPenunjang={(items) => ubah({ penunjang: [...(r.penunjang || []), ...items] })} />
      )}
      {cariUntuk && (
        <CariHarga awal={cariUntuk.uraian.slice(0, 40)} onTutup={() => setCariUntuk(null)}
          onPilih={(p) => {
            setItem(cariUntuk.id, {
              harga: p.harga, satuan: cariUntuk.satuan || p.satuan, sumber: "database",
              refHarga: p.kode, bandingLo: p.lo, bandingHi: p.hi,
            });
            setCariUntuk(null);
          }} />
      )}
    </div>
  );
}
