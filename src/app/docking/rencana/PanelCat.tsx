"use client";
/**
 * Kalkulator kebutuhan cat — hitung dari ukuran kapal, banding dengan
 * permintaan kapal, lalu masukkan ke RAB sekali klik.
 *
 * Gunanya bukan sekadar menghitung: permintaan cat dari kapal (borang
 * HP-103.00.01) selama ini diperiksa tangan terhadap hitungan luas bidang.
 * Panel ini menaruh keduanya berdampingan — hitungan rumus vs total liter
 * yang sudah ada di RAB grup Cat — supaya kelebihannya langsung kelihatan.
 */
import { useMemo, useState } from "react";
import { RencanaDocking, penunjangBaru } from "@/lib/docking/rencana/types";
import { hitungCat, totalLiter, UkuranCat } from "@/lib/docking/rencana/cat";

export default function PanelCat({ r, ubah }: {
  r: RencanaDocking;
  ubah: (patch: Partial<RencanaDocking>) => void;
}) {
  const [buka, setBuka] = useState(false);
  const [pesan, setPesan] = useState("");

  const u: UkuranCat = {
    loa: r.loa || 0, lbp: r.lbp || 0, b: r.lebar || 0,
    h: r.tinggi || 0, t: r.sarat || 0, cb: r.cb || 0.8,
  };
  const lengkap = u.loa > 0 && u.lbp > 0 && u.b > 0 && u.h > 0 && u.t > 0;
  const hasil = useMemo(() => (lengkap ? hitungCat(u) : []), [u.loa, u.lbp, u.b, u.h, u.t, u.cb, lengkap]);

  // pembanding: liter cat yang SUDAH ada di RAB (grup ber-nama Cat …)
  const literRab = useMemo(() => (r.penunjang || [])
    .filter((x) => /^cat\b/i.test(x.grup || "") && /liter/i.test(x.satuan || ""))
    .reduce((s, x) => s + (x.vol || 0), 0), [r.penunjang]);
  const literHitung = totalLiter(hasil);

  const masukkan = (key?: string) => {
    const pilih = hasil.filter((b) => !key || b.key === key);
    const baris = pilih.flatMap((b) => b.lapis.filter((l) => l.liter > 0).map((l) => penunjangBaru({
      kelompok: b.kelompok, grup: b.grup,
      uraian: `${l.nama} — ${b.nama}`, spek: l.spek,
      satuan: "Liter", vol: l.liter, harga: 0,
      sumber: "manual",
    })));
    ubah({ penunjang: [...(r.penunjang || []), ...baris] });
    setPesan(`${baris.length} baris cat masuk ke RAB (harga 0 — isi lewat "Isi harga otomatis" / cari acuan).`);
  };

  return (
    <div className="bg-white rounded-2xl ring-line elev-sm overflow-hidden">
      <button onClick={() => setBuka((v) => !v)} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 text-left">
        <span className="text-slate-400 text-xs w-4">{buka ? "▾" : "▸"}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-slate-800">🎨 Kalkulator kebutuhan cat</span>
          <span className="block text-[10px] text-slate-400">
            rumus berkas cabang (terverifikasi KMP. NGAFI) — luas bidang & liter dari ukuran kapal
          </span>
        </span>
        {lengkap && (
          <span className="text-right shrink-0">
            <span className="block text-sm font-bold tabular-nums text-slate-800">{literHitung.toLocaleString("id-ID")} L</span>
            <span className={`block text-[10px] tabular-nums ${literRab > literHitung * 1.15 ? "text-amber-700" : "text-slate-400"}`}>
              di RAB saat ini {literRab.toLocaleString("id-ID")} L
              {literRab > literHitung * 1.15 ? " · di atas hitungan" : ""}
            </span>
          </span>
        )}
      </button>

      {buka && (
        <div className="border-t border-slate-200 p-4 space-y-3">
          {!lengkap ? (
            <p className="text-xs text-slate-500">
              Lengkapi ukuran kapal di tab <b>Ringkasan</b> dulu: LOA, LBP, Lebar (B), Tinggi (H), Sarat (T).
              Kalau kapalnya ada di Ship Database, semuanya terisi sendiri.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-slate-500">
                LOA {u.loa} · LBP {u.lbp} · B {u.b} · H {u.h} · T {u.t} · Cb {u.cb} — ubah lewat tab Ringkasan.
                Liter dibulatkan ke atas kelipatan 5 (kemasan). Thinner 20% dari jumlah catnya.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] min-w-[38rem]">
                  <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="px-2 py-1.5 text-left">Bidang</th>
                      <th className="px-2 py-1.5 text-right w-24">Luas (m²)</th>
                      <th className="px-2 py-1.5 text-left">Lapisan → liter</th>
                      <th className="px-2 py-1.5 w-28" />
                    </tr>
                  </thead>
                  <tbody>
                    {hasil.map((b) => (
                      <tr key={b.key} className="border-b border-slate-100 last:border-0 align-top">
                        <td className="px-2 py-1.5">
                          <span className="text-slate-800">{b.nama}</span>
                          <span className="block text-[10px] text-slate-400">→ {b.grup}</span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{b.luas.toLocaleString("id-ID")}</td>
                        <td className="px-2 py-1.5 text-slate-600">
                          {b.lapis.map((l) => `${l.nama.replace(/^Cat /, "")} ${l.liter} L`).join(" · ")}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button onClick={() => masukkan(b.key)} className="text-[11px] text-[#1ca3dd] hover:underline">＋ ke RAB</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-slate-700">
                      <td className="px-2 py-2">JUMLAH</td>
                      <td />
                      <td className="px-2 py-2 tabular-nums">{literHitung.toLocaleString("id-ID")} L
                        <span className="font-normal text-slate-500"> · di RAB {literRab.toLocaleString("id-ID")} L</span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button onClick={() => masukkan()} className="btn btn-primary text-[11px] px-2.5 py-1">＋ Semua ke RAB</button>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {literRab > 0 && (
                <p className={`text-[11px] rounded-lg px-3 py-2 ring-1 ${literRab > literHitung * 1.15
                  ? "text-amber-800 bg-amber-50 ring-amber-200"
                  : "text-emerald-800 bg-emerald-50 ring-emerald-200"}`}>
                  Permintaan kapal di RAB: <b>{literRab.toLocaleString("id-ID")} L</b> · hitungan rumus:{" "}
                  <b>{literHitung.toLocaleString("id-ID")} L</b>
                  {literRab > literHitung * 1.15
                    ? " — permintaan melebihi hitungan >15%, layak ditanyakan ke kapal sebelum diusulkan."
                    : " — masih sejalan dengan hitungan."}
                </p>
              )}
            </>
          )}
          {pesan && <p className="text-[11px] text-emerald-800 bg-emerald-50 ring-1 ring-emerald-200 rounded-lg px-3 py-2">{pesan}</p>}
        </div>
      )}
    </div>
  );
}
