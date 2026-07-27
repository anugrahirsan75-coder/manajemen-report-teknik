"use client";
/**
 * Rekap Swakelola — daftar seluruh pekerjaan swakelola yang pernah disimpan.
 *
 * Sebelumnya aplikasi hanya memuat SATU (yang terbaru), jadi pekerjaan lama
 * tidak kelihatan walaupun datanya ada di Supabase. Di sini semuanya
 * ditampilkan: bisa dibuka lagi untuk dicetak ulang / diperbaiki, dan
 * kembaran (nomor SPK + kapal + nilai sama) ditandai supaya tidak dobel.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore, ProyekRingkas } from "@/lib/store";
import { rupiahRp, tanggalIndo } from "@/lib/format";

export default function RekapSwakelola() {
  const { data, supabaseReady, listProyek, bukaProyek, hapusProyek } = useStore();
  const [list, setList] = useState<ProyekRingkas[]>([]);
  const [muat, setMuat] = useState(false);
  const [err, setErr] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [tahun, setTahun] = useState("");
  const [buka, setBuka] = useState(true);

  const ambil = useCallback(async () => {
    if (!supabaseReady) return;
    setMuat(true); setErr("");
    try { setList(await listProyek()); }
    catch (e: any) { setErr(e?.message || String(e)); }
    finally { setMuat(false); }
  }, [supabaseReady, listProyek]);

  useEffect(() => { ambil(); }, [ambil]);

  const tahunList = useMemo(
    () => Array.from(new Set(list.map((p) => p.tahun).filter(Boolean))).sort((a, b) => b - a), [list]);
  const tampil = useMemo(() => (tahun ? list.filter((p) => String(p.tahun) === tahun) : list), [list, tahun]);

  // tandai kembaran: kapal + nomor SPK + nilai sama -> kemungkinan tersimpan dua kali
  const kembar = useMemo(() => {
    const n: Record<string, number> = {};
    list.forEach((p) => { const k = `${p.namaKapal}|${p.nomorSpk}|${p.nilai}`; n[k] = (n[k] || 0) + 1; });
    return n;
  }, [list]);
  const kunciKembar = (p: ProyekRingkas) => `${p.namaKapal}|${p.nomorSpk}|${p.nilai}`;

  const total = tampil.reduce((s, p) => s + (p.nilai || 0), 0);
  const kapalUnik = new Set(tampil.map((p) => p.namaKapal)).size;
  const totalCrew = tampil.reduce((s, p) => s + p.jmlCrew, 0);

  const onBuka = async (p: ProyekRingkas) => {
    if (p.id === data.id) return;
    if (!confirm(`Buka pekerjaan ${p.namaKapal} — SPK.${p.nomorSpk}/${p.tahun}?\n\nData yang sedang tampil sekarang akan diganti. Pastikan sudah disimpan.`)) return;
    setSibuk(p.id);
    try { await bukaProyek(p.id); } catch (e: any) { alert("Gagal membuka: " + (e?.message ?? e)); }
    finally { setSibuk(""); }
  };

  const onHapus = async (p: ProyekRingkas) => {
    if (!confirm(`Hapus rekaman ${p.namaKapal} — SPK.${p.nomorSpk}/${p.tahun} (${rupiahRp(p.nilai)})?\n\nTindakan ini tidak bisa dibatalkan.`)) return;
    setSibuk(p.id);
    try { await hapusProyek(p.id); await ambil(); }
    catch (e: any) { alert("Gagal menghapus: " + (e?.message ?? e)); }
    finally { setSibuk(""); }
  };

  if (!supabaseReady) return null;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={() => setBuka(!buka)} className="flex items-center gap-2 group">
          <span className={`text-slate-400 text-xs transition-transform ${buka ? "rotate-90" : ""}`}>▶</span>
          <h2 className="font-bold text-slate-700 group-hover:text-[#16357f] transition">Rekap Swakelola</h2>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{list.length}</span>
        </button>
        <span className="text-xs text-slate-400 hidden sm:inline">pekerjaan yang sudah pernah dibuat — klik untuk membuka &amp; cetak ulang</span>
        <div className="ml-auto flex items-center gap-2">
          {tahunList.length > 1 && (
            <select value={tahun} onChange={(e) => setTahun(e.target.value)} className="text-[11px] border border-slate-300 rounded-lg px-2 py-1 bg-white">
              <option value="">Semua tahun</option>
              {tahunList.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <button onClick={ambil} disabled={muat} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-[#1ca3dd] disabled:opacity-50">
            {muat ? "memuat…" : "↻ Muat ulang"}
          </button>
        </div>
      </div>

      {err && <p className="text-xs font-semibold text-rose-700 mb-2">Supabase: {err}</p>}

      {buka && (
        <>
          {tampil.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <Sel label="Pekerjaan" nilai={String(tampil.length)} />
              <Sel label="Kapal" nilai={String(kapalUnik)} />
              <Sel label="Total nilai" nilai={rupiahRp(total)} tint="text-[#16357f]" />
              <Sel label="Total crew" nilai={`${totalCrew} orang`} />
            </div>
          )}

          {muat && !list.length ? (
            <p className="text-sm text-slate-400 text-center py-6 bg-white rounded-2xl ring-line">Memuat rekap…</p>
          ) : !tampil.length ? (
            <p className="text-sm text-slate-500 text-center py-6 bg-white rounded-2xl ring-line">
              Belum ada pekerjaan swakelola tersimpan. Isi datanya lalu simpan di halaman <b>Isi / Ubah Data</b>.
            </p>
          ) : (
            <div className="space-y-2.5 stagger">
              {tampil.map((p) => {
                const aktif = p.id === data.id;
                const isKembar = kembar[kunciKembar(p)] > 1;
                return (
                  <div key={p.id}
                    className={`bg-white rounded-2xl elev-sm p-4 flex items-center gap-4 border transition ${aktif ? "border-[#1ca3dd] ring-1 ring-[#1ca3dd]" : "ring-line border-transparent card-hover"}`}>
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 grid place-items-center text-xl text-white shadow-md shrink-0">⚓</div>

                    {/* identitas + meta dalam satu kolom yang boleh melipat — tombol tetap di kanan */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-800">{p.namaKapal}</p>
                        {aktif && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1ca3dd] text-white">sedang dibuka</span>}
                        {isKembar && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                            title="Ada rekaman lain dengan kapal, nomor SPK, dan nilai yang sama — periksa mana yang benar">⚠ kembar</span>
                        )}
                        <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">SPK.{p.nomorSpk || "—"}/TN.101/ASDP-TTE/SWK/{p.tahun}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-2">
                        <Kol label="Periode" nilai={p.tanggalMulai ? `${tanggalIndo(p.tanggalMulai)} – ${tanggalIndo(p.tanggalSelesai)}` : "—"} />
                        <Kol label="Nilai" nilai={rupiahRp(p.nilai)} tebal />
                        <Kol label="Isi" nilai={`${p.jmlCrew} crew · ${p.jmlPekerjaan} pek.${p.jmlFoto ? ` · ${p.jmlFoto} foto` : ""}`} />
                        <Kol label="Disimpan" nilai={p.dibuatPada ? tanggalIndo(p.dibuatPada.slice(0, 10)) : "—"} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => onBuka(p)} disabled={aktif || !!sibuk}
                        className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition disabled:opacity-50 ${aktif ? "bg-slate-100 text-slate-400" : "asdp-gradient text-white shadow-md hover:opacity-95"}`}>
                        {sibuk === p.id ? "…" : aktif ? "aktif" : "📂 Buka"}
                      </button>
                      <button onClick={() => onHapus(p)} disabled={!!sibuk}
                        className="text-xs font-semibold px-2.5 py-2 rounded-xl border border-slate-300 text-red-600 hover:border-red-400 hover:bg-red-50 transition disabled:opacity-50"
                        title="Hapus rekaman ini dari Supabase">🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {Object.values(kembar).some((n) => n > 1) && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-2.5">
              ⚠ Ada rekaman bertanda <b>kembar</b> — kapal, nomor SPK, dan nilainya sama persis. Biasanya karena satu pekerjaan tersimpan dua kali. Buka keduanya, pastikan mana yang paling lengkap, lalu hapus sisanya.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Sel({ label, nilai, tint = "text-slate-900" }: { label: string; nilai: string; tint?: string }) {
  return (
    <div className="bg-white rounded-xl ring-line elev-sm px-3.5 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">{label}</p>
      <p className={`text-base font-extrabold ${tint}`}>{nilai}</p>
    </div>
  );
}

function Kol({ label, nilai, tebal }: { label: string; nilai: string; tebal?: boolean }) {
  return (
    <div className="min-w-[7rem]">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</p>
      <p className={`text-xs text-slate-700 ${tebal ? "font-bold text-slate-900 tabular-nums" : ""}`}>{nilai}</p>
    </div>
  );
}
