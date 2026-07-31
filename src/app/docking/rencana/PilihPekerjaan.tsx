"use client";
/**
 * Pemilih pekerjaan untuk Repair List — dua sumber, satu jendela:
 *
 *   TARIF GALANGAN  — 575 baris tarif baku (List Pekerjaan Docking PT IKI UGB),
 *                     lengkap dengan satuan dan jenjang ukurannya. Harga ikut.
 *   KERANGKA RL     — 254 uraian pekerjaan baku dari Repair List yang sudah
 *                     pernah dipakai ke pusat, sudah ber-Docking Code (OM/CM).
 *
 * Boleh pilih beberapa sekaligus; yang dipilih langsung jadi baris RL.
 */
import { useMemo, useState } from "react";
import { rupiah } from "@/lib/format";
import tarif from "@/lib/docking/rencana/tarifGalangan.json";
import rlTpl from "@/lib/docking/rencana/rlTemplate.json";
import { ItemRl, rlBaru } from "@/lib/docking/rencana/types";

type Calon = { key: string; item: ItemRl; label: string; sub: string; harga: number };

const dariTarif = (): Calon[] => {
  const out: Calon[] = [];
  (tarif as any).kelompok.forEach((k: any) =>
    k.sub.forEach((s: any) =>
      s.item.forEach((it: any) => out.push({
        key: `T${k.kode}-${it.baris}`,
        label: it.uraian,
        sub: `${k.kode}. ${k.nama} › ${s.nama}${it.grup ? " › " + it.grup : ""}`,
        harga: it.harga,
        item: rlBaru({
          grup: `${k.kode}. ${k.nama}`, uraian: [s.nama, it.grup, it.uraian].filter(Boolean).join(" — "),
          satuan: it.satuan, vol: it.jml || 1, harga: it.harga,
          sumber: "tarif", refHarga: `IKI ${k.kode}/${it.baris}`, ket: it.ket,
        }),
      }))));
  return out;
};

const dariRl = (): Calon[] => {
  const out: Calon[] = [];
  (["dok", "floating"] as const).forEach((jenis) =>
    ((rlTpl as any)[jenis] || []).forEach((b: any) =>
      b.item.forEach((it: any, i: number) => out.push({
        key: `R${jenis}-${b.romawi}-${i}`,
        label: it.uraian,
        sub: `${b.romawi}. ${b.nama}${it.grup ? " › " + it.grup : ""} · ${it.kode}${it.sub ? "-" + it.sub : ""}`,
        harga: 0,
        item: rlBaru({
          jenis, bagian: b.romawi, kode: it.kode, sub: it.sub, grup: it.grup || b.nama,
          uraian: it.uraian, satuan: it.satuan || "Ls", vol: it.vol || 1, harga: 0,
          sumber: "manual", ket: it.ket,
        }),
      }))));
  return out;
};

export default function PilihPekerjaan({ onTambah, onTutup }: {
  onTambah: (items: ItemRl[]) => void;
  onTutup: () => void;
}) {
  const [tab, setTab] = useState<"tarif" | "rl">("tarif");
  const [q, setQ] = useState("");
  const [pilih, setPilih] = useState<Record<string, Calon>>({});

  const semua = useMemo(() => ({ tarif: dariTarif(), rl: dariRl() }), []);
  const daftar = useMemo(() => {
    const src = tab === "tarif" ? semua.tarif : semua.rl;
    const kata = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!kata.length) return src.slice(0, 400);
    return src.filter((c) => {
      const t = (c.label + " " + c.sub).toLowerCase();
      return kata.every((k) => t.includes(k));
    }).slice(0, 400);
  }, [tab, q, semua]);

  const jml = Object.keys(pilih).length;
  const toggle = (c: Calon) => setPilih((p) => {
    const n = { ...p };
    if (n[c.key]) delete n[c.key]; else n[c.key] = c;
    return n;
  });

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-[2px] p-4 overflow-y-auto" onClick={onTutup}>
      <div className="max-w-4xl mx-auto my-6 bg-white rounded-2xl elev-lg ring-line overflow-hidden flex flex-col max-h-[88vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <span className="h-9 w-9 rounded-xl asdp-gradient text-white grid place-items-center text-sm shrink-0">🛠️</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 leading-tight">Tambah pekerjaan ke Repair List</h3>
            <p className="text-xs text-slate-500">tarif baku galangan &amp; kerangka RL yang sudah pernah dipakai</p>
          </div>
          <button onClick={onTutup} className="text-slate-400 hover:text-slate-700 text-lg px-1">✕</button>
        </div>

        <div className="px-5 pt-4 flex flex-wrap gap-2 items-center">
          <div className="flex rounded-lg overflow-hidden ring-1 ring-slate-200">
            <button onClick={() => setTab("tarif")}
              className={`text-[11px] font-bold px-3 py-2 ${tab === "tarif" ? "bg-slate-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              Tarif galangan {semua.tarif.length}
            </button>
            <button onClick={() => setTab("rl")}
              className={`text-[11px] font-bold px-3 py-2 ${tab === "rl" ? "bg-slate-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              Kerangka RL {semua.rl.length}
            </button>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="saring: sand blasting, anode, pipa 2 inch…"
            className="flex-1 min-w-[14rem] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/20 outline-none" />
        </div>

        <div className="px-5 py-3 flex-1 overflow-y-auto">
          <div className="space-y-1">
            {daftar.map((c) => {
              const aktif = !!pilih[c.key];
              return (
                <button key={c.key} onClick={() => toggle(c)}
                  className={`w-full text-left rounded-lg px-3 py-2 ring-1 transition flex items-start gap-3 ${
                    aktif ? "ring-[#1ca3dd] bg-sky-50" : "ring-slate-200 hover:bg-slate-50"}`}>
                  <span className={`mt-0.5 h-4 w-4 rounded border grid place-items-center text-[10px] shrink-0 ${
                    aktif ? "bg-[#1ca3dd] border-[#1ca3dd] text-white" : "border-slate-300"}`}>{aktif ? "✓" : ""}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-800 leading-snug">{c.label}</span>
                    <span className="block text-[10px] text-slate-400 leading-snug">{c.sub}</span>
                  </span>
                  <span className="text-xs tabular-nums text-slate-600 shrink-0">
                    {c.harga ? rupiah(c.harga) : <span className="text-slate-300">harga menyusul</span>}
                  </span>
                </button>
              );
            })}
            {!daftar.length && <p className="text-xs text-slate-400 py-4">Tak ada yang cocok.</p>}
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
          <span className="text-xs text-slate-500">{jml ? `${jml} pekerjaan dipilih` : "belum ada yang dipilih"}</span>
          <span className="flex-1" />
          <button onClick={onTutup} className="btn btn-ghost text-xs">Batal</button>
          <button disabled={!jml} onClick={() => { onTambah(Object.values(pilih).map((c) => ({ ...c.item, id: rlBaru().id }))); onTutup(); }}
            className="btn btn-primary text-xs px-4 disabled:opacity-40">Tambahkan {jml || ""}</button>
        </div>
      </div>
    </div>
  );
}
