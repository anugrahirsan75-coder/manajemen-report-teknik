"use client";
/**
 * Penyusun satu rencana docking (satu kapal, satu tahun).
 *
 * Lima tab mengikuti urutan kerja sebenarnya: tentukan sasaran & tanggal →
 * susun Repair List galangan → susun RAB penunjang per Mata Anggaran → jadwal
 * tahapan → kontrol anggaran saat pusat sudah menjawab.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { rupiah, tanggalIndo } from "@/lib/format";
import { Field, Input, Section } from "@/components/Field";
import { konfirmasi } from "@/components/Konfirmasi";
import { useKapalDb } from "@/lib/kapal/store";
import { paguDocking, TAHUN_RKA, SUMBER_RKA } from "@/lib/anggaran/rka2026";
import { Ship, slugKapal } from "@/lib/kapal/types";
import {
  RencanaDocking, totalRencana, rekapPenunjang, totalRl, nilaiBerlaku,
  KELOMPOK_PENUNJANG, PPN_BAKU, ppnDari,
} from "@/lib/docking/rencana/types";
import { susunJadwal, ringkasJadwal, geser, hariIniLokal } from "@/lib/docking/rencana/tahapan";
import TabRepairList from "./TabRepairList";
import TabPenunjang from "./TabPenunjang";
import TabJadwal from "./TabJadwal";
import ImporBorang from "./ImporBorang";
import { unduhRencana } from "@/lib/docking/rencana/ekspor";
import { unduhSmartsheet } from "@/lib/docking/rencana/eksporSmartsheet";

const TAB = [
  { key: "ringkas", label: "Ringkasan" },
  { key: "rl", label: "Repair List" },
  { key: "penunjang", label: "RAB Penunjang" },
  { key: "jadwal", label: "Jadwal" },
  { key: "kontrol", label: "Kontrol Anggaran" },
] as const;
type TabKey = (typeof TAB)[number]["key"];

/** ukuran di Ship Database disimpan sebagai teks bergaya Indonesia ("29,05") */
const angkaKapal = (s?: string): number | undefined => {
  const n = parseFloat((s || "").replace(/\./g, "").replace(",", "."));
  return isFinite(n) && n > 0 ? n : undefined;
};
const ukuranDariShip = (k?: Ship) => ({
  grt: angkaKapal(k?.dimension?.gt),
  loa: angkaKapal(k?.dimension?.loa),
  lbp: angkaKapal(k?.dimension?.lbp),
  tinggi: angkaKapal(k?.dimension?.h),
  lebar: angkaKapal(k?.dimension?.b),
  sarat: angkaKapal(k?.dimension?.t),
});

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
  // Pembaca borang hidup di tingkat ini, bukan di dalam tab: pindah tab
  // membongkar tab lamanya, dan pembacaan yang sedang jalan akan ikut berhenti.
  const [baca, setBaca] = useState(false);

  const ubah = (patch: Partial<RencanaDocking>) => { setR((p) => ({ ...p, ...patch })); setPesan(""); };

  // ── ukuran kapal menempel ke Ship Database ────────────────────────────────
  // Satu sumber data: begitu kapal dipilih, GRT/LOA/LBP/tinggi diambil dari
  // sana. Yang sudah diisi tangan TIDAK ditimpa — pengisian otomatis hanya
  // mengisi yang masih kosong, sisanya lewat tombol "Ambil ulang".
  const { ships } = useKapalDb();
  const kapalDb = useMemo(
    () => ships.find((s) => s.id === slugKapal(r.kapal || "")),
    [ships, r.kapal],
  );
  const ukuranDb = ukuranDariShip(kapalDb);
  const adaUkuranDb = Object.values(ukuranDb).some(Boolean);
  const kapalTerakhir = useRef<string>("");
  useEffect(() => {
    if (!kapalDb) return;
    // Saat rencana lama dibuka: hanya isi yang masih kosong (jangan menimpa
    // ukuran yang sudah disesuaikan tangan). Saat kapalnya DIGANTI di layar ini:
    // ambil ulang semuanya, karena ukuran lama milik kapal sebelumnya.
    const pertamaKali = kapalTerakhir.current === "";
    const gantiKapal = !pertamaKali && kapalTerakhir.current !== kapalDb.id;
    kapalTerakhir.current = kapalDb.id;
    const isi: Partial<RencanaDocking> = {};
    (Object.keys(ukuranDb) as (keyof typeof ukuranDb)[]).forEach((k) => {
      const v = ukuranDb[k];
      if (v && (gantiKapal || !r[k])) isi[k] = v;
    });
    if (Object.keys(isi).length) setR((p) => ({ ...p, ...isi }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kapalDb]);
  const ambilUlang = () => setR((p) => ({ ...p, ...Object.fromEntries(Object.entries(ukuranDb).filter(([, v]) => v)) }));

  // ── pagu ikut RKA cabang ──────────────────────────────────────────────────
  // RKA 2026 sudah ada di aplikasi (KONTROL ANGGARAN TERNATE). Begitu kapal
  // dipilih, pagu tiap kelompok terisi sendiri — yang sudah diisi tangan tidak
  // ditimpa, dan pengambilan ulang tetap disediakan lewat tombol.
  const rka = useMemo(() => paguDocking(r.kapal || ""), [r.kapal]);
  const adaRka = Object.keys(rka.pagu).length > 0 && r.tahun === TAHUN_RKA;
  useEffect(() => {
    if (!adaRka) return;
    const isi: Record<string, number> = { ...(r.pagu || {}) };
    let berubah = false;
    for (const [k, v] of Object.entries(rka.pagu)) if (v && !isi[k]) { isi[k] = v; berubah = true; }
    if (berubah) setR((p) => ({ ...p, pagu: isi }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adaRka, r.kapal]);
  const ambilPagu = () => setR((p) => ({ ...p, pagu: { ...(p.pagu || {}), ...rka.pagu } }));

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
          <button onClick={() => unduhRencana(r)} className="btn btn-ghost text-xs" title="Excel kerja cabang: Repair List, Penunjang, Kontrol Anggaran, Jadwal, Sumber Harga">📤 Excel</button>
          <button onClick={() => unduhSmartsheet(r)} className="btn btn-ghost text-xs"
            title="Excel format PUSAT — 25 kolom persis unduhan Smartsheet (Klasifikasi GS/OM/CM, bagian romawi, kolom evaluasi kosong utk pusat)">🏛️ Format Pusat</button>
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
              {/* daftar kapal digabung dengan Ship Database supaya nama yang dipilih
                  selalu cocok dengan catatan ukurannya di sana */}
              <Field label="Kapal" hint={kapalDb ? "cocok dengan Ship Database" : undefined}>
                <Input list="kapalRencana" value={r.kapal} onChange={(e) => ubah({ kapal: e.target.value })} placeholder="KMP. ..." />
                <datalist id="kapalRencana">
                  {Array.from(new Set([...ships.map((s) => s.nama), ...kapalTersedia])).sort()
                    .map((k) => <option key={k} value={k} />)}
                </datalist>
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
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
              {kapalDb && adaUkuranDb ? (
                <>
                  <span className="text-emerald-800 bg-emerald-50 ring-1 ring-emerald-200 rounded-full px-2 py-0.5">
                    🔗 terisi dari Ship Database
                  </span>
                  <span className="text-slate-500">
                    {kapalDb.nama}
                    {kapalDb.general?.registerBKI ? ` · Reg. BKI ${kapalDb.general.registerBKI}` : ""}
                    {kapalDb.general?.tahun ? ` · buatan ${kapalDb.general.tahun}` : ""}
                    {kapalDb.dimension?.b ? ` · lebar ${kapalDb.dimension.b} m` : ""}
                  </span>
                  <button onClick={ambilUlang} className="btn btn-ghost text-[11px] py-1"
                    title="Timpa isian di bawah dengan ukuran terbaru dari Ship Database">↻ Ambil ulang</button>
                </>
              ) : r.kapal ? (
                <span className="text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-full px-2 py-0.5">
                  Ukuran <b>{r.kapal}</b> belum ada di Ship Database — isi tangan, atau lengkapi di sana supaya semua modul ikut benar
                </span>
              ) : (
                <span className="text-slate-500">Pilih kapal dulu, ukurannya diambil sendiri dari Ship Database.</span>
              )}
              <Link href="/kapal" className="text-[11px] text-[#1ca3dd] hover:underline">buka Ship Database →</Link>
            </div>
            <div className="grid sm:grid-cols-4 gap-4">
              <Field label="GRT" hint={ukuranDb.grt && ukuranDb.grt !== r.grt ? `Ship Database: ${ukuranDb.grt}` : undefined}>
                <Input type="number" value={r.grt || ""} onChange={(e) => ubah({ grt: +e.target.value || undefined })} />
              </Field>
              <Field label="LOA (m)" hint={ukuranDb.loa && ukuranDb.loa !== r.loa ? `Ship Database: ${ukuranDb.loa}` : undefined}>
                <Input type="number" step="0.01" value={r.loa || ""} onChange={(e) => ubah({ loa: +e.target.value || undefined })} />
              </Field>
              <Field label="LBP (m)" hint={ukuranDb.lbp && ukuranDb.lbp !== r.lbp ? `Ship Database: ${ukuranDb.lbp}` : undefined}>
                <Input type="number" step="0.01" value={r.lbp || ""} onChange={(e) => ubah({ lbp: +e.target.value || undefined })} />
              </Field>
              <Field label="Tinggi (m)" hint={ukuranDb.tinggi && ukuranDb.tinggi !== r.tinggi ? `Ship Database: ${ukuranDb.tinggi}` : undefined}>
                <Input type="number" step="0.01" value={r.tinggi || ""} onChange={(e) => ubah({ tinggi: +e.target.value || undefined })} />
              </Field>
              <Field label="Lebar / B (m)" hint={ukuranDb.lebar && ukuranDb.lebar !== r.lebar ? `Ship Database: ${ukuranDb.lebar}` : undefined}>
                <Input type="number" step="0.01" value={r.lebar || ""} onChange={(e) => ubah({ lebar: +e.target.value || undefined })} />
              </Field>
              <Field label="Sarat / T (m)" hint={ukuranDb.sarat && ukuranDb.sarat !== r.sarat ? `Ship Database: ${ukuranDb.sarat}` : undefined}>
                <Input type="number" step="0.01" value={r.sarat || ""} onChange={(e) => ubah({ sarat: +e.target.value || undefined })} />
              </Field>
              <Field label="Cb (koef. blok)" hint="baku 0,80 — berkas cat cabang memakai 0,75-0,80">
                <Input type="number" step="0.01" value={r.cb || ""} onChange={(e) => ubah({ cb: +e.target.value || undefined })} placeholder="0.80" />
              </Field>
            </div>
          </Section>

          <Section title="Pagu RKA per Mata Anggaran" icon="💼"
            desc="Angka RKA tahun berjalan sebagai pembanding usulan. Kosongkan bila belum ada.">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
              {adaRka ? (
                <>
                  <span className="text-emerald-800 bg-emerald-50 ring-1 ring-emerald-200 rounded-full px-2 py-0.5">
                    🔗 terisi dari RKA {TAHUN_RKA}
                  </span>
                  <span className="text-slate-500">{SUMBER_RKA}</span>
                  <button onClick={ambilPagu} className="btn btn-ghost text-[11px] py-1"
                    title="Timpa pagu di bawah dengan angka RKA cabang">↻ Ambil ulang</button>
                </>
              ) : r.kapal ? (
                <span className="text-slate-500">
                  RKA {TAHUN_RKA} tersedia untuk 13 kapal; tahun rencana ini {r.tahun}, jadi pagunya diisi tangan.
                </span>
              ) : null}
              {adaRka && rka.luarKelompok.length > 0 && (
                <span className="text-slate-500">
                  · di luar kelompok penunjang:{" "}
                  {rka.luarKelompok.map((x) => `${x.label.trim()} ${rupiah(x.rka)}`).join(" · ")}
                </span>
              )}
            </div>
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

      {tab === "rl" && <TabRepairList r={r} ubah={ubah} onBaca={() => setBaca(true)} />}
      {tab === "penunjang" && <TabPenunjang r={r} ubah={ubah} />}
      {tab === "jadwal" && <TabJadwal r={r} ubah={ubah} />}
      {tab === "kontrol" && <Kontrol r={r} />}

      {baca && (
        <ImporBorang onTutup={() => setBaca(false)}
          onRl={(items) => ubah({ rl: [...(r.rl || []), ...items] })}
          onPenunjang={(items) => ubah({ penunjang: [...(r.penunjang || []), ...items] })} />
      )}
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
