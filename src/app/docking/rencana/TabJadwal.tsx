"use client";
/**
 * Jadwal tahapan docking — lahir dari SATU tanggal (rencana naik dok).
 *
 * Berkas proyeksi yang lama mengetik tanggal satu per satu; di sini yang
 * disimpan jarak harinya, jadi begitu tanggal docking digeser seluruh tenggat
 * ikut bergeser. Tenggat administrasi (persetujuan pusat, rilis budget, kontrak
 * cat & suku cadang) ikut mundur otomatis — dan justru tenggat itulah yang
 * biasanya membuat docking terlambat, bukan pekerjaan galangannya.
 *
 * Tampilannya dua lapis: daftar tugas yang bisa dicentang & digeser tangan, dan
 * batang waktu per minggu untuk melihat tumpang tindih antar fase.
 */
import { useMemo, useState } from "react";
import { tanggalIndo } from "@/lib/format";
import { RencanaDocking } from "@/lib/docking/rencana/types";
import {
  FASE, SIFAT_LABEL, SIFAT_WARNA, TugasJadwal, susunJadwal, statusTugas,
  ringkasJadwal, selisihHari, geser, hariIniLokal,
} from "@/lib/docking/rencana/tahapan";

const WARNA_FASE: Record<string, string> = {
  survey: "bg-sky-500", usul: "bg-indigo-500", setuju: "bg-violet-500",
  siap: "bg-amber-500", pra: "bg-orange-500", mob: "bg-rose-500", laksana: "bg-emerald-500",
};
const STATUS_KELAS: Record<string, string> = {
  telat: "bg-rose-50 text-rose-700 ring-rose-200",
  berjalan: "bg-sky-50 text-sky-700 ring-sky-200",
  selesai: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  menunggu: "bg-slate-50 text-slate-500 ring-slate-200",
};
const STATUS_LABEL: Record<string, string> = {
  telat: "Lewat tenggat", berjalan: "Berjalan", selesai: "Selesai", menunggu: "Belum mulai",
};

export default function TabJadwal({ r, ubah }: {
  r: RencanaDocking;
  ubah: (patch: Partial<RencanaDocking>) => void;
}) {
  const [saring, setSaring] = useState<string>("");
  const [pic, setPic] = useState<string>("");
  const [tampil, setTampil] = useState<"daftar" | "batang">("daftar");
  const hariIni = hariIniLokal();

  const jadwal = useMemo(
    () => susunJadwal(r.naikDok || "", r.lamaDocking || 21, r.jadwal || {}, r.tugasTambahan || []),
    [r.naikDok, r.lamaDocking, r.jadwal, r.tugasTambahan],
  );
  const selesai = r.tugasSelesai || {};
  const rekap = ringkasJadwal(jadwal, hariIni, selesai);
  const semuaPic = useMemo(
    () => Array.from(new Set(jadwal.flatMap((t) => t.pic))).sort(),
    [jadwal],
  );
  const tampilJadwal = jadwal.filter(
    (t) => (!saring || t.fase === saring) && (!pic || t.pic.includes(pic)),
  );

  const setUbah = (id: string, patch: { mulai?: string; lama?: number; buang?: boolean }) =>
    ubah({ jadwal: { ...(r.jadwal || {}), [id]: { ...(r.jadwal || {})[id], ...patch } } });
  const centang = (id: string, v: boolean) =>
    ubah({ tugasSelesai: { ...(r.tugasSelesai || {}), [id]: v } });

  if (!r.naikDok) {
    return (
      <div className="text-center bg-white rounded-2xl ring-line elev-sm p-8">
        <p className="text-slate-500 text-sm">Isi dulu <b>rencana tanggal naik dok</b> di tab Ringkasan.
          Seluruh jadwal — dari join survey sampai pembayaran Termin III — akan tersusun sendiri dari tanggal itu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kartu label="Tugas" nilai={String(rekap.total)} ket="dari kerangka baku" />
        <Kartu label="Selesai" nilai={`${rekap.selesai}`} ket={`${rekap.pct}% rampung`} warna="text-emerald-600" />
        <Kartu label="Berjalan" nilai={String(rekap.berjalan)} ket="sedang jalan hari ini" warna="text-sky-600" />
        <Kartu label="Lewat tenggat" nilai={String(rekap.telat)} ket="perlu dikejar" warna={rekap.telat ? "text-rose-600" : "text-slate-400"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg overflow-hidden ring-1 ring-slate-200 bg-white">
          {([["daftar", "Daftar"], ["batang", "Batang waktu"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTampil(v)}
              className={`text-[11px] font-bold px-3 py-2 ${tampil === v ? "bg-slate-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{l}</button>
          ))}
        </div>
        <select value={saring} onChange={(e) => setSaring(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg px-2 py-2 bg-white">
          <option value="">Semua fase</option>
          {FASE.map((f) => <option key={f.key} value={f.key}>{f.nama}</option>)}
        </select>
        <select value={pic} onChange={(e) => setPic(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg px-2 py-2 bg-white">
          <option value="">Semua PIC</option>
          {semuaPic.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="flex-1" />
        <span className="text-[11px] text-slate-500">
          naik dok {tanggalIndo(r.naikDok)} · {r.lamaDocking || 21} hari · kembali lintasan ±{tanggalIndo(geser(r.naikDok, r.lamaDocking || 21))}
        </span>
      </div>

      {tampil === "batang" ? (
        <Batang jadwal={tampilJadwal} hariIni={hariIni} selesai={selesai} />
      ) : (
        <div className="space-y-3">
          {FASE.filter((f) => !saring || f.key === saring).map((f) => {
            const items = tampilJadwal.filter((t) => t.fase === f.key);
            if (!items.length) return null;
            return (
              <div key={f.key} className="bg-white rounded-2xl ring-line elev-sm overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${WARNA_FASE[f.key]}`} />
                  <span className="text-xs font-bold text-slate-700 flex-1">{f.nama}</span>
                  <span className="text-[11px] text-slate-500">
                    {tanggalIndo(items[0].mulaiTgl)} – {tanggalIndo(items.reduce((m, x) => (x.selesaiTgl > m ? x.selesaiTgl : m), items[0].selesaiTgl))}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {items.map((t) => {
                    const st = statusTugas(t, hariIni, selesai);
                    const sisa = selisihHari(hariIni, t.selesaiTgl);
                    return (
                      <div key={t.id} className="px-3 py-2 flex flex-wrap items-center gap-2 hover:bg-slate-50/60">
                        <input type="checkbox" checked={!!selesai[t.id]} onChange={(e) => centang(t.id, e.target.checked)}
                          className="h-4 w-4 shrink-0" title="Tandai selesai" />
                        <div className="flex-1 min-w-[16rem]">
                          <p className={`text-[13px] leading-snug ${selesai[t.id] ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.uraian}</p>
                          <p className="text-[10px] text-slate-400">
                            {t.pic.join(", ")} · {t.jenis.join(", ")}
                            {t.catatan ? ` · ${t.catatan}` : ""}
                          </p>
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ring-1 shrink-0 ${SIFAT_WARNA[t.sifat]}`}>{SIFAT_LABEL[t.sifat]}</span>
                        <input type="date" value={t.mulaiTgl} onChange={(e) => setUbah(t.id, { mulai: e.target.value })}
                          className="text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white" title="Geser tanggal mulai" />
                        <input type="number" value={t.lama} min={1} onChange={(e) => setUbah(t.id, { lama: +e.target.value || 1 })}
                          className="w-14 text-[11px] border border-slate-200 rounded px-1.5 py-1 text-right tabular-nums" title="Lama (hari)" />
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 shrink-0 w-28 text-center ${STATUS_KELAS[st]}`}>
                          {st === "menunggu" && sisa >= 0 ? `${sisa} hr lagi` : st === "telat" ? `telat ${-sisa} hr` : STATUS_LABEL[st]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kartu({ label, nilai, ket, warna = "text-slate-800" }: { label: string; nilai: string; ket: string; warna?: string }) {
  return (
    <div className="bg-white rounded-2xl ring-line elev-sm p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</p>
      <p className={`text-2xl font-extrabold ${warna}`}>{nilai}</p>
      <p className="text-[10px] text-slate-400">{ket}</p>
    </div>
  );
}

/** batang waktu per minggu — untuk melihat fase yang bertumpuk */
function Batang({ jadwal, hariIni, selesai }: {
  jadwal: TugasJadwal[]; hariIni: string; selesai: Record<string, boolean>;
}) {
  if (!jadwal.length) return <p className="text-xs text-slate-400">Tak ada tugas pada saringan ini.</p>;
  const awal = jadwal.reduce((m, t) => (t.mulaiTgl < m ? t.mulaiTgl : m), jadwal[0].mulaiTgl);
  const akhir = jadwal.reduce((m, t) => (t.selesaiTgl > m ? t.selesaiTgl : m), jadwal[0].selesaiTgl);
  const totalHari = Math.max(1, selisihHari(awal, akhir) + 1);
  const minggu = Math.ceil(totalHari / 7);
  const pos = (tgl: string) => (selisihHari(awal, tgl) / totalHari) * 100;

  // label bulan di kepala batang
  const bulanLabel: { kiri: number; teks: string }[] = [];
  let cursor = awal.slice(0, 7);
  for (let d = 0; d < totalHari; d++) {
    const t = geser(awal, d);
    if (d === 0 || t.slice(0, 7) !== cursor) {
      cursor = t.slice(0, 7);
      bulanLabel.push({ kiri: (d / totalHari) * 100, teks: new Date(t + "T00:00:00").toLocaleDateString("id-ID", { month: "short", year: "2-digit" }) });
    }
  }

  return (
    <div className="bg-white rounded-2xl ring-line elev-sm p-4 overflow-x-auto">
      <div className="min-w-[46rem]">
        <div className="relative h-5 mb-1 border-b border-slate-200">
          {bulanLabel.map((b, i) => (
            <span key={i} className="absolute text-[10px] text-slate-400 -translate-x-1/2" style={{ left: `${b.kiri}%` }}>{b.teks}</span>
          ))}
        </div>
        <div className="space-y-1">
          {jadwal.map((t) => {
            const kiri = pos(t.mulaiTgl);
            const lebar = Math.max(0.8, ((t.lama || 1) / totalHari) * 100);
            const st = statusTugas(t, hariIni, selesai);
            return (
              <div key={t.id} className="flex items-center gap-2">
                <span className="w-56 shrink-0 text-[11px] text-slate-600 truncate" title={t.uraian}>{t.uraian}</span>
                <span className="relative flex-1 h-4 bg-slate-100 rounded">
                  <span className={`absolute h-4 rounded ${WARNA_FASE[t.fase] || "bg-slate-400"} ${st === "selesai" ? "opacity-40" : ""} ${st === "telat" ? "ring-2 ring-rose-400" : ""}`}
                    style={{ left: `${kiri}%`, width: `${lebar}%` }} title={`${tanggalIndo(t.mulaiTgl)} – ${tanggalIndo(t.selesaiTgl)}`} />
                  {hariIni >= awal && hariIni <= akhir && (
                    <span className="absolute top-0 bottom-0 w-px bg-rose-500/70" style={{ left: `${pos(hariIni)}%` }} />
                  )}
                </span>
                <span className="w-24 shrink-0 text-[10px] text-slate-400 text-right tabular-nums">{tanggalIndo(t.mulaiTgl)}</span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-slate-100">
          {FASE.map((f) => (
            <span key={f.key} className="flex items-center gap-1 text-[10px] text-slate-500">
              <span className={`h-2 w-4 rounded ${WARNA_FASE[f.key]}`} />{f.nama.replace(/^[A-G] · /, "")}
            </span>
          ))}
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="h-3 w-px bg-rose-500" />hari ini · {minggu} minggu
          </span>
        </div>
      </div>
    </div>
  );
}
