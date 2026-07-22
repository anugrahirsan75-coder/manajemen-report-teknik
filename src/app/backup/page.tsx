"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { didukung, pilihFolder, folderSiap, namaFolder, lupakanFolder, backupPenuh, unduhSatuFile, LS_TERAKHIR } from "@/lib/backup/local";

const LABEL: Record<string, string> = {
  sppbj: "SPPBJ Pengadaan", nonpr: "SPPBJ Non PR PO", servis: "Monitoring Servis",
  anggaran: "Dashboard Anggaran", kapal: "Ship Database", swakelola: "Generator Swakelola", material: "Kode Material",
};

export default function BackupPage() {
  const [folder, setFolder] = useState<string | null>(null);
  const [aktif, setAktif] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState("");
  const [terakhir, setTerakhir] = useState<string | null>(null);
  const [fsOk, setFsOk] = useState(true); // dicek di browser (hindari beda render server/klien)
  useEffect(() => setFsOk(didukung()), []);

  const segarkan = useCallback(async () => {
    setFolder(await namaFolder());
    setAktif(!!(await folderSiap(false)));
    try { setTerakhir(localStorage.getItem(LS_TERAKHIR)); } catch {}
  }, []);

  const muat = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from("projects").select("id,nama_kapal,tahun,payload,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      setRows(data || []);
    } catch (e: any) { setPesan("Gagal membaca database: " + e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { segarkan(); muat(); }, [segarkan, muat]);

  const perJenis = rows.reduce<Record<string, number>>((a, r) => {
    const k = r.payload?.kind || "swakelola"; a[k] = (a[k] || 0) + 1; return a;
  }, {});
  const besarKb = Math.round(JSON.stringify(rows).length / 1024);

  const hubungkan = async () => {
    const r = await pilihFolder();
    setPesan(r.ok ? `✅ Folder backup: ${r.nama}` : "⚠️ " + (r.pesan || "gagal"));
    await segarkan();
    if (r.ok && rows.length) { const b = await backupPenuh(rows); setPesan(b.ok ? `✅ Folder "${r.nama}" terhubung. ${b.jumlah} data langsung dibackup.` : "⚠️ " + b.pesan); await segarkan(); }
  };
  const backupSekarang = async () => {
    setBusy(true); setPesan("");
    try {
      await muat();
      const r = await backupPenuh(rows);
      setPesan(r.ok ? `✅ ${r.jumlah} data tersalin ke folder backup (snapshot/${r.berkas}).` : "⚠️ " + r.pesan);
      await segarkan();
    } finally { setBusy(false); }
  };

  return (
    <main className="max-w-4xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-5">
          <Link href="/" className="text-xs text-slate-500 hover:text-[#16357f]">‹ Beranda</Link>
          <h1 className="text-2xl font-extrabold asdp-text-gradient mt-1">Backup Data</h1>
          <p className="text-slate-600 text-sm">Salinan seluruh database aplikasi disimpan di folder laptop Anda — otomatis tiap kali menyimpan.</p>
        </div>
      </div>

      {/* status */}
      <div className={`mt-5 rounded-2xl p-5 ring-1 ${aktif ? "bg-emerald-50 ring-emerald-300" : "bg-amber-50 ring-amber-300"}`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`h-10 w-10 rounded-xl grid place-items-center text-lg ${aktif ? "bg-emerald-600" : "bg-amber-500"} text-white`}>{aktif ? "🛡️" : "⚠️"}</span>
          <div className="flex-1 min-w-[14rem]">
            <p className={`font-extrabold ${aktif ? "text-emerald-900" : "text-amber-900"}`}>
              {aktif ? "Backup otomatis AKTIF" : folder ? "Folder terputus — izin perlu diberikan lagi" : "Backup otomatis belum aktif"}
            </p>
            <p className="text-xs text-slate-600">
              {folder ? <>Folder: <b>{folder}</b></> : "Pilih 1 folder di laptop untuk menampung salinan data."}
              {terakhir && <> · terakhir: <b>{new Date(terakhir).toLocaleString("id-ID")}</b></>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={hubungkan} className="btn btn-primary text-xs">{folder ? "📂 Ganti / Sambungkan Folder" : "📂 Pilih Folder Backup"}</button>
            <button onClick={backupSekarang} disabled={busy || !rows.length} className="btn btn-success text-xs disabled:opacity-50">{busy ? "…" : "💾 Backup Sekarang"}</button>
            <button onClick={() => unduhSatuFile(rows)} disabled={!rows.length} className="btn btn-ghost text-xs disabled:opacity-50">⬇️ Unduh 1 File</button>
            {folder && <button onClick={async () => { await lupakanFolder(); await segarkan(); setPesan("Folder dilepas."); }} className="btn btn-ghost text-xs">Lepas</button>}
          </div>
        </div>
        {pesan && <p className="mt-3 text-sm font-medium text-slate-800">{pesan}</p>}
        {!fsOk && <p className="mt-3 text-xs text-amber-900">Browser ini belum mendukung folder backup otomatis. Pakai <b>Chrome</b> atau <b>Edge</b> di laptop, atau gunakan tombol <b>Unduh 1 File</b>.</p>}
      </div>

      {/* isi database */}
      <div className="mt-5 bg-white rounded-2xl elev-md ring-line p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-bold text-slate-800">Isi database saat ini</h2>
          <span className="text-xs text-slate-500">{loading ? "memuat…" : `${rows.length} data · ±${besarKb} KB`}</span>
          <button onClick={muat} className="btn btn-ghost text-xs ml-auto">↻ Muat ulang</button>
        </div>
        {!isSupabaseReady ? (
          <p className="text-sm text-amber-700">Supabase belum dikonfigurasi — tidak ada data untuk dibackup.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(perJenis).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <div key={k} className="bg-slate-50 rounded-xl ring-1 ring-slate-200 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">{LABEL[k] || k}</p>
                <p className="text-xl font-extrabold tabular-nums text-slate-900">{n}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* penjelasan */}
      <div className="mt-5 bg-white rounded-2xl elev-md ring-line p-5 text-sm text-slate-700 space-y-2">
        <h2 className="font-bold text-slate-800">Cara kerjanya</h2>
        <p><b>1. Otomatis tiap simpan.</b> Setelah folder dipilih sekali, setiap kali Anda menekan Simpan (SPPBJ, Non PR PO, Servis, Anggaran, Ship Database), salinan JSON-nya langsung ditulis ke <code className="bg-slate-100 px-1 rounded">data/&lt;jenis&gt;/</code> di folder itu.</p>
        <p><b>2. Snapshot penuh.</b> Tombol <b>Backup Sekarang</b> menyalin SELURUH database jadi 1 file bertanggal di <code className="bg-slate-100 px-1 rounded">snapshot/</code> plus <code className="bg-slate-100 px-1 rounded">TERBARU.json</code>.</p>
        <p><b>3. Cadangan terjadwal (tanpa buka aplikasi).</b> Jalankan <code className="bg-slate-100 px-1 rounded">npm run backup</code> di folder aplikasi, atau pasang di Windows Task Scheduler — lihat <code className="bg-slate-100 px-1 rounded">BACKUP.md</code>.</p>
        <p className="text-slate-500 text-xs">Catatan: folder backup hanya bisa ditulis saat aplikasi dibuka di browser laptop ini. Kalau input dilakukan dari HP, salinan lokalnya menyusul saat aplikasi dibuka lagi di laptop dan Anda menekan <b>Backup Sekarang</b> (atau lewat cadangan terjadwal).</p>
      </div>
    </main>
  );
}
