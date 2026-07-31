"use client";
/**
 * Penyusun satu rencana docking (satu kapal, satu tahun).
 *
 * Lima tab mengikuti urutan kerja sebenarnya: tentukan sasaran & tanggal →
 * susun Repair List galangan → susun RAB penunjang per Mata Anggaran → jadwal
 * tahapan → kontrol anggaran saat pusat sudah menjawab.
 */
import { useMemo, useState } from "react";
import { rupiah, tanggalIndo } from "@/lib/format";
import { Field, Input, Section } from "@/components/Field";
import { konfirmasi } from "@/components/Konfirmasi";
import {
  RencanaDocking, totalRencana, rekapPenunjang, totalRl, nilaiBerlaku,
  KELOMPOK_PENUNJANG, PPN_BAKU, ppnDari,
} from "@/lib/docking/rencana/types";
import { susunJadwal, ringkasJadwal, geser, hariIniLokal } from "@/lib/docking/rencana/tahapan";
import TabRepairList from "./TabRepairList";
import TabPenunjang from "./TabPenunjang";
import TabJadwal from "./TabJadwal";
import { unduhRencana } from "@/lib/docking/rencana/ekspor";

const TAB = [
  { key: "ringkas", label: "Ringkasan" },
  { key: "rl", label: "Repair List" },
  { key: "penunjang", label: "RAB Penunjang" },
  { key: "jadwal", label: "Jadwal" },
  { key: "kontrol", label: "Kontrol Anggaran" },
] as const;
type TabKey = (typeof TAB)[number]["key"];

export default function Editor({ awal, kapalTersedia, onSimpan, onHapus, onTutup }: {
  awal: RencanaDocking;
  kapalTersedia: string[];
  onSimpan: (r: RencanaDocking) => Promise<void>;
  onHapus: (id: string) => Promise<void>;
  onTutup: () => void;
}) {
  const [r, setR] = useState<RencanaDocking>(awal);
  const [tab, setTab] = useState<TabKey>("ringkas");
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");

  const ubah = (patch: Partial<RencanaDocking>) => { setR((p) => ({ ...p, ...patch })); setPesan(""); };
  const total = totalRencana(r);
  const hariIni = hariIniLokal();
  const jadwal = useMemo(
    () => susunJadwal(r.naikDok || "", r.lamaDocking || 21, r.jadwal || {}, r.tugasTambahan || []),
    [r.naikDok, r.lamaDocking, r.jadwal, r.tugasTambahan],
  );
  const rekapJadwal = ringkasJadwal(jadwal, hariIni, r.tugasSelesai || {});

  const simpan = async () => {
    setSibuk(true);
    try { await onSimpan(r); setPesan("Tersimpan " + new Date().toLocaleTimeString("id-ID")); }
    catch (e: any) { setPesan("Gagal simpan: " + (e?.message || e)); }
    finally { setSibuk(false); }
  };

  return (
    <div className="space-y-4">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg">
        <div className="glass hero-glow rounded-3xl px-5 py-4 flex flex-wrap items-center gap-3">
          <button onClick={onTutup} className="h-9 w-9 rounded-xl bg-white/80 ring-1 ring-slate-200 grid place-items-center text-slate-600 hover:bg-white">←</button>
          <div className="flex-1 min-w-[14rem]">
            <p className="text-[11px] text-slate-500">Perencanaan Docking · {r.tahun}</p>
            <h1 className="text-xl font-extrabold asdp-text-gradient leading-tight">{r.kapal || "(pilih kapal)"}</h1>
            <p className="text-xs text-slate-500">
              {r.naikDok ? `naik dok ${tanggalIndo(r.naikDok)} · ${r.lamaDocking || 21} hari` : "tanggal naik dok belum diisi"}
              {" · "}usulan {rupiah(total.total)}
            </p>
          </div>
          <button onClick={() => unduhRencana(r)} className="btn btn-ghost text-xs">📤 Excel</button>
          <button onClick={simpan} disabled={sibuk} className="btn btn-primary text-xs px-4">{sibuk ? "…" : "💾 Simpan"}</button>
        </div>
      </div>

      {pesan && <p className="text-xs text-slate-600 bg-slate-50 ring-1 ring-slate-200 rounded-lg px-3 py-2">{pesan}</p>}

      <div className="flex flex-wrap gap-1 bg-white rounded-xl ring-line elev-sm p-1">
        {TAB.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-xs font-semibold px-3 py-2 rounded-lg ${tab === t.key ? "asdp-gradient text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ringkas" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Angka label="Kontrak galangan" nilai={rupiah(total.galanganPpn)} ket={`RL ${(r.rl || []).length} pekerjaan · ber-PPN`} />
            <Angka label="Penunjang docking" nilai={rupiah(total.penunjang)} ket={`${(r.penunjang || []).length} baris · 7 Mata Anggaran`} />
            <Angka label="Total usulan" nilai={rupiah(total.total)} ket={total.pagu ? `pagu ${rupiah(total.pagu)}` : "pagu belum diisi"} warna="text-[#16357f]" />
            <Angka label="Kesiapan tahapan" nilai={`${rekapJadwal.pct}%`} ket={rekapJadwal.telat ? `${rekapJadwal.telat} tugas lewat tenggat` : `${rekapJadwal.total} tugas terjadwal`}
              warna={rekapJadwal.telat ? "text-rose-600" : "text-emerald-600"} />
          </div>

          <Section title="Sasaran docking" icon="🎯"
            desc="Tanggal naik dok adalah patokan seluruh jadwal — begitu diubah, semua tenggat tahapan ikut bergeser.">
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Kapal">
                <Input list="kapalRencana" value={r.kapal} onChange={(e) => ubah({ kapal: e.target.value })} placeholder="KMP. ..." />
                <datalist id="kapalRencana">{kapalTersedia.map((k) => <option key={k} value={k} />)}</datalist>
              </Field>
              <Field label="Tahun docking">
                <Input type="number" value={r.tahun} onChange={(e) => ubah({ tahun: +e.target.value || r.tahun })} />
              </Field>
              <Field label="Galangan (rencana)">
                <Input value={r.galangan || ""} onChange={(e) => ubah({ galangan: e.target.value })} placeholder="mis. PT IKI UGB" />
              </Field>
              <Field label="Rencana naik dok" hint="patokan seluruh tahapan">
                <Input type="date" value={r.naikDok || ""} onChange={(e) => ubah({ naikDok: e.target.value })} />
              </Field>
              <Field label="Lama pengerjaan (hari)" hint={r.naikDok ? `selesai ± ${tanggalIndo(geser(r.naikDok, (r.lamaDocking || 21) - 1))}` : "termasuk hari naik dok"}>
                <Input type="number" value={r.lamaDocking || 21} onChange={(e) => ubah({ lamaDocking: +e.target.value || 21 })} />
              </Field>
              <Field label="Lokasi galangan">
                <Input value={r.lokasi || ""} onChange={(e) => ubah({ lokasi: e.target.value })} placeholder="mis. Bitung" />
              </Field>
            </div>
          </Section>

          <Section title="Ukuran kapal" icon="📐" desc="Dipakai memilih tarif galangan bertingkat (GRT) dan menghitung luas pengecatan.">
            <div className="grid sm:grid-cols-4 gap-4">
              <Field label="GRT"><Input type="number" value={r.grt || ""} onChange={(e) => ubah({ grt: +e.target.value || undefined })} /></Field>
              <Field label="LOA (m)"><Input type="number" step="0.01" value={r.loa || ""} onChange={(e) => ubah({ loa: +e.target.value || undefined })} /></Field>
              <Field label="LBP (m)"><Input type="number" step="0.01" value={r.lbp || ""} onChange={(e) => ubah({ lbp: +e.target.value || undefined })} /></Field>
              <Field label="Tinggi (m)"><Input type="number" step="0.01" value={r.tinggi || ""} onChange={(e) => ubah({ tinggi: +e.target.value || undefined })} /></Field>
            </div>
          </Section>

          <Section title="Pagu RKA per Mata Anggaran" icon="💼"
            desc="Angka RKA tahun berjalan sebagai pembanding usulan. Kosongkan bila belum ada.">
            <div className="grid sm:grid-cols-2 gap-3">
              {KELOMPOK_PENUNJANG.map((k) => (
                <label key={k.key} className="flex items-center gap-2">
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-slate-600 truncate">{k.romawi}. {k.nama}</span>
                    <span className="block text-[10px] text-slate-400">M.A. {k.ma}</span>
                  </span>
                  <input type="number" value={r.pagu?.[k.key] || ""}
                    onChange={(e) => ubah({ pagu: { ...(r.pagu || {}), [k.key]: +e.target.value || 0 } })}
                    className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-right tabular-nums" />
                </label>
              ))}
              <label className="flex items-center gap-2">
                <span className="flex-1 text-xs font-semibold text-slate-600">PPN (%)</span>
                <input type="number" value={r.ppn ?? PPN_BAKU} onChange={(e) => ubah({ ppn: +e.target.value || PPN_BAKU })}
                  className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-right tabular-nums" />
              </label>
            </div>
            <label className="block mt-4">
              <span className="text-xs font-semibold text-slate-600">Catatan rencana</span>
              <textarea value={r.catatan || ""} onChange={(e) => ubah({ catatan: e.target.value })} rows={3}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </Section>

          <div className="flex justify-end">
            <button onClick={async () => {
              if (!(await konfirmasi({
                nada: "bahaya", judul: "Hapus rencana docking ini?",
                pesan: `${r.kapal} ${r.tahun}`,
                tegasan: "Repair List, RAB penunjang, dan penyesuaian jadwalnya ikut terhapus.",
                tombolYa: "Ya, hapus",
              }))) return;
              await onHapus(r.id); onTutup();
            }} className="btn btn-danger-soft text-xs">🗑 Hapus rencana</button>
          </div>
        </div>
      )}

      {tab === "rl" && <TabRepairList r={r} ubah={ubah} />}
      {tab === "penunjang" && <TabPenunjang r={r} ubah={ubah} />}
      {tab === "jadwal" && <TabJadwal r={r} ubah={ubah} />}
      {tab === "kontrol" && <Kontrol r={r} />}
    </div>
  );
}

function Angka({ label, nilai, ket, warna = "text-slate-800" }: { label: string; nilai: string; ket: string; warna?: string }) {
  return (
    <div className="bg-white rounded-2xl ring-line elev-sm p-4">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</p>
      <p className={`text-lg font-extrabold tabular-nums ${warna}`}>{nilai}</p>
      <p className="text-[10px] text-slate-400">{ket}</p>
    </div>
  );
}

/**
 * Kontrol anggaran — meniru sheet "Kontrol Anggaran" pada berkas RL: pagu RKA
 * dibanding usulan cabang dibanding apa yang akhirnya disetujui pusat, lengkap
 * dengan deviasinya.
 */
function Kontrol({ r }: { r: RencanaDocking }) {
  const ppn = r.ppn ?? PPN_BAKU;
  const rekap = rekapPenunjang(r);
  const rl = totalRl(r);
  const rlSetuju = (r.rl || []).reduce((s, x) => s + nilaiBerlaku(x), 0);
  const baris = [
    {
      nama: "Kontrak galangan (Repair List)", ma: "5010403003",
      pagu: 0, usul: rl + ppnDari(rl, ppn), setuju: rlSetuju + ppnDari(rlSetuju, ppn),
    },
    ...rekap.map((k) => {
      const setuju = (r.penunjang || []).filter((x) => x.kelompok === k.key).reduce((s, x) => s + nilaiBerlaku(x), 0);
      return { nama: `${k.romawi}. ${k.nama}`, ma: k.ma, pagu: k.pagu, usul: k.jumlah, setuju: setuju + ppnDari(setuju, ppn) };
    }),
  ];
  const jml = baris.reduce((a, b) => ({ pagu: a.pagu + b.pagu, usul: a.usul + b.usul, setuju: a.setuju + b.setuju }), { pagu: 0, usul: 0, setuju: 0 });

  const Sel = ({ v, dasar }: { v: number; dasar: number }) => {
    const d = dasar ? Math.round(((v - dasar) / dasar) * 100) : 0;
    return (
      <span className="tabular-nums">
        {rupiah(v)}
        {dasar > 0 && v !== dasar && (
          <span className={`ml-1 text-[10px] ${d > 0 ? "text-rose-600" : "text-emerald-600"}`}>({d > 0 ? "+" : ""}{d}%)</span>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl ring-line elev-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[46rem]">
          <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600 font-bold">
            <tr className="border-b-2 border-slate-200">
              <th className="px-3 py-2.5 text-left">Mata anggaran</th>
              <th className="px-3 py-2.5 text-right w-40">Pagu RKA</th>
              <th className="px-3 py-2.5 text-right w-48">Usulan cabang</th>
              <th className="px-3 py-2.5 text-right w-48">Berlaku (setelah dicoret)</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.nama} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2">
                  <span className="text-slate-800">{b.nama}</span>
                  <span className="block text-[10px] text-slate-400">M.A. {b.ma}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">{b.pagu ? rupiah(b.pagu) : "—"}</td>
                <td className="px-3 py-2 text-right"><Sel v={b.usul} dasar={b.pagu} /></td>
                <td className="px-3 py-2 text-right"><Sel v={b.setuju} dasar={b.usul} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-bold">
            <tr>
              <td className="px-3 py-2.5 text-slate-700">Jumlah</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{jml.pagu ? rupiah(jml.pagu) : "—"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{rupiah(jml.usul)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{rupiah(jml.setuju)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">
        Kolom <b>Berlaku</b> memakai nilai yang disetujui bila diisi pada baris, dan menganggap baris ber-status
        &ldquo;Dicoret pusat&rdquo; bernilai nol — sama seperti kolom deviasi pada berkas Kontrol Anggaran.
      </p>
    </div>
  );
}
