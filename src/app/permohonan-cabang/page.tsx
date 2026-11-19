"use client";
/**
 * Monitoring Permohonan Cabang — surat permohonan Cabang Ternate ke Kantor Pusat
 * dan status persetujuannya.
 *
 * Setiap simpanan langsung ditulis juga ke spreadsheet "Kontrol Permohonan
 * Ternate 2026" (kolomnya sama), jadi tim yang biasa membuka spreadsheet tetap
 * melihat data terbaru. Tombol "Tarik dari spreadsheet" mengambil baris yang
 * diisi langsung di spreadsheet supaya kedua tempat tidak berselisih.
 */
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { PermohonanCabangProvider, usePermohonanCabang } from "@/lib/permohonanCabang/store";
import {
  JENIS, JENIS_WARNA, JenisUsulan, Permohonan, STATUS, STATUS_WARNA, StatusPermohonan,
  hariIni, permohonanKosong, rupiah,
} from "@/lib/permohonanCabang/types";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { beritahu, konfirmasi } from "@/components/Konfirmasi";
import { unggahBerkas, ukuranSingkat } from "@/lib/docking/laporan/drive";
import { ACCEPT_BERKAS } from "@/lib/lapor/berkasJenis";

/**
 * Nama subfolder lampiran dari judul permohonan, mengikuti kebiasaan folder
 * yang sudah ada di Drive: "Permohonan Persetujuan Addendum Docking KMP. Kerapu
 * II Tahun 2026" → "ADDENDUM DOCKING KMP KERAPU II 2026". Nomor urutnya ("17.")
 * dipasang Apps Script dari folder bernomor terbesar.
 */
function usulanFolder(judul: string, tgl: string): string {
  let s = judul.toUpperCase()
    .replace(/^\s*PERMOHONAN\s+(PERSETUJUAN\s+)?/, "")
    .replace(/\bKMP\.\s*/g, "KMP ")
    .replace(/\bTAHUN\s+(\d{4})\b/g, "$1")
    .replace(/[\\/:*?"<>|\r\n\t]+/g, " ")
    .replace(/\s+/g, " ").trim();
  if (!/\b20\d{2}\b/.test(s) && tgl) s += " " + tgl.slice(0, 4);
  return s.slice(0, 100);
}

const ALAMAT_BERKAS = "/api/permohonan-cabang/berkas";

export default function HalamanPermohonanCabang() {
  return (
    <PermohonanCabangProvider>
      <Isi />
    </PermohonanCabangProvider>
  );
}

const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function tglPendek(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${Number(m[3])} ${BLN[Number(m[2]) - 1]} ${m[1]}` : "";
}
const kapalPendek = (k: string) => k.replace(/^KMP\.?\s*/i, "");

/** lama permohonan berjalan (hari) — sampai selesai, atau sampai hari ini bila masih proses */
function lamaHari(p: Permohonan): number | null {
  if (!p.tglPengajuan) return null;
  const a = new Date(p.tglPengajuan + "T00:00:00").getTime();
  const b = new Date((p.status !== "Proses" && p.tglSelesai ? p.tglSelesai : hariIni()) + "T00:00:00").getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

type Saring = "" | StatusPermohonan | "gagal";

function Isi() {
  const { items, loading, galat, sheetUrl, simpan, hapus, kirimUlang, tarik, supabaseReady } = usePermohonanCabang();
  const [sunting, setSunting] = useState<Permohonan | null>(null);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState<Saring>("");
  const [fJenis, setFJenis] = useState("");
  const [fTahun, setFTahun] = useState("");
  const [sibuk, setSibuk] = useState("");

  const tahunAda = useMemo(() => Array.from(new Set(items.map((p) => p.tglPengajuan.slice(0, 4)).filter(Boolean))).sort().reverse(), [items]);

  const hitung = useMemo(() => {
    const h = { total: items.length, biaya: 0, Proses: 0, Disetujui: 0, Ditolak: 0, bProses: 0, bSetuju: 0, gagal: 0 };
    for (const p of items) {
      h.biaya += p.totalBiaya;
      h[p.status]++;
      if (p.status === "Proses") h.bProses += p.totalBiaya;
      if (p.status === "Disetujui") h.bSetuju += p.totalBiaya;
      if (!p.sinkron?.ok) h.gagal++;
    }
    return h;
  }, [items]);

  const tampil = useMemo(() => {
    const kata = q.trim().toLowerCase();
    return items
      .filter((p) => !fStatus || (fStatus === "gagal" ? !p.sinkron?.ok : p.status === fStatus))
      .filter((p) => !fJenis || p.jenisUsulan === fJenis)
      .filter((p) => !fTahun || p.tglPengajuan.startsWith(fTahun))
      .filter((p) => !kata || [p.judul, p.nomorSurat, p.keterangan, p.ketPersetujuan, p.lampiranNama, p.kapal.join(" ")]
        .join(" ").toLowerCase().includes(kata))
      .sort((a, b) => (b.tglPengajuan || "").localeCompare(a.tglPengajuan || "") || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }, [items, q, fStatus, fJenis, fTahun]);

  const totalTampil = tampil.reduce((s, p) => s + p.totalBiaya, 0);

  const onSimpan = async (p: Permohonan) => {
    const ok = await simpan(p);
    if (ok) setSunting(null);
  };
  const onHapus = async (p: Permohonan) => {
    const ya = await konfirmasi(`Hapus "${p.judul}" dari aplikasi?\n\nBaris di spreadsheet TIDAK ikut terhapus — hapus manual di spreadsheet bila perlu.`);
    if (ya) await hapus(p.id);
  };
  const onTarik = async () => {
    setSibuk("tarik");
    try { const h = await tarik(); void beritahu(h.ok ? "Tarik dari spreadsheet: " + h.pesan : "Gagal menarik: " + h.pesan); }
    finally { setSibuk(""); }
  };
  const onKirimUlang = async () => {
    const ids = items.filter((p) => !p.sinkron?.ok).map((p) => p.id);
    setSibuk("kirim");
    try {
      const h = await kirimUlang(ids);
      void beritahu(h.ok ? `${Object.keys(h.baris).length} dari ${ids.length} baris masuk spreadsheet.` : "Gagal kirim ulang: " + h.pesan);
    } finally { setSibuk(""); }
  };

  return (
    <main className="mx-auto max-w-[110rem] px-3 py-4 sm:px-4 sm:py-6">
      <header className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass flex flex-wrap items-center gap-3 rounded-[calc(1.5rem-1.5px)] px-4 py-4 sm:gap-4 sm:px-5 sm:py-5">
          <div className="hidden shrink-0 rounded-2xl bg-white p-2.5 ring-1 ring-black/5 elev-md sm:block">
            <Image src="/logo-asdp.png" alt="ASDP" width={56} height={38} className="object-contain" />
          </div>
          <div className="min-w-0 flex-1 basis-[14rem]">
            <h1 className="asdp-text-gradient text-xl font-extrabold leading-tight sm:text-2xl">Monitoring Permohonan Cabang</h1>
            <p className="mt-0.5 text-[13px] text-slate-500 sm:text-sm">
              Surat permohonan Cabang Ternate ke Kantor Pusat dan status persetujuannya — tersambung ke spreadsheet Kontrol Permohonan.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {sheetUrl && (
              <a href={sheetUrl} target="_blank" rel="noreferrer" className="btn btn-ghost px-3 py-2 text-xs">📊 Buka spreadsheet</a>
            )}
            <button onClick={onTarik} disabled={!!sibuk} className="btn btn-ghost px-3 py-2 text-xs"
              title="Ambil baris yang diisi langsung di spreadsheet">
              {sibuk === "tarik" ? "menarik…" : "⟳ Tarik dari spreadsheet"}
            </button>
            <button onClick={() => setSunting(permohonanKosong())} className="btn btn-primary flex-1 px-5 py-2.5 text-sm sm:flex-none">
              ＋ Tambah Permohonan
            </button>
          </div>
        </div>
      </header>

      {!supabaseReady && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          Supabase belum tersambung — data tersimpan di peramban ini saja.
        </p>
      )}
      {galat && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800 ring-1 ring-red-200">{galat}</p>}
      {hitung.gagal > 0 && items.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
          <span><b>{hitung.gagal}</b> permohonan belum masuk spreadsheet.</span>
          <button onClick={onKirimUlang} disabled={!!sibuk} className="btn btn-ghost px-2.5 py-1 text-[11px]">
            {sibuk === "kirim" ? "mengirim…" : "Kirim ulang ke spreadsheet"}
          </button>
        </div>
      )}

      <section className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        <Kartu label="Total permohonan" nilai={String(hitung.total)} sub={rupiah(hitung.biaya)} bar="bg-[#16357f]"
          aktif={!fStatus} onKlik={() => setFStatus("")} />
        <Kartu label="Proses di Pusat" nilai={String(hitung.Proses)} sub={rupiah(hitung.bProses)} bar="bg-indigo-500"
          aktif={fStatus === "Proses"} onKlik={() => setFStatus(fStatus === "Proses" ? "" : "Proses")} />
        <Kartu label="Disetujui" nilai={String(hitung.Disetujui)} sub={rupiah(hitung.bSetuju)} bar="bg-emerald-600"
          aktif={fStatus === "Disetujui"} onKlik={() => setFStatus(fStatus === "Disetujui" ? "" : "Disetujui")} />
        <Kartu label="Ditolak" nilai={String(hitung.Ditolak)} sub="permohonan" bar="bg-red-500"
          aktif={fStatus === "Ditolak"} onKlik={() => setFStatus(fStatus === "Ditolak" ? "" : "Ditolak")} />
        <Kartu label="Belum di spreadsheet" nilai={String(hitung.gagal)} sub={hitung.gagal ? "perlu dikirim ulang" : "semua tersambung"}
          bar={hitung.gagal ? "bg-amber-500" : "bg-slate-300"}
          aktif={fStatus === "gagal"} onKlik={() => setFStatus(fStatus === "gagal" ? "" : "gagal")} />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 cari permohonan, nomor surat, kapal…"
          className="inp col-span-2 sm:min-w-[16rem] sm:flex-1" />
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value as Saring)} className="inp sm:w-auto" aria-label="Saring status">
          <option value="">Semua status</option>
          {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          <option value="gagal">Belum di spreadsheet</option>
        </select>
        <select value={fJenis} onChange={(e) => setFJenis(e.target.value)} className="inp sm:w-auto" aria-label="Saring jenis usulan">
          <option value="">Semua jenis usulan</option>
          {JENIS.map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
        <select value={fTahun} onChange={(e) => setFTahun(e.target.value)} className="inp sm:w-auto" aria-label="Saring tahun">
          <option value="">Semua tahun</option>
          {tahunAda.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </section>

      <p className="mt-2 text-[11px] text-slate-500">
        {loading ? "memuat…" : `${tampil.length} permohonan · total ${rupiah(totalTampil)}`}
      </p>

      {/* tabel — layar lebar */}
      <div className="mt-2 hidden overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200 elev-sm lg:block">
        <table className="w-full text-[12px]">
          <thead className="bg-[#16357f] text-left text-[11px] uppercase tracking-wide text-white">
            <tr>
              <th className="px-2 py-2 text-center">No</th>
              <th className="px-2 py-2">Jenis Survey / Pekerjaan</th>
              <th className="px-2 py-2 text-right">Total Biaya</th>
              <th className="px-2 py-2">Status Pusat</th>
              <th className="px-2 py-2">Lampiran</th>
              <th className="px-2 py-2">Pengajuan</th>
              <th className="px-2 py-2">Selesai</th>
              <th className="px-2 py-2 text-center">Lama</th>
              <th className="px-2 py-2">Jenis Usulan</th>
              <th className="px-2 py-2">Keterangan</th>
              <th className="px-2 py-2 text-center" title="Spreadsheet">📊</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {tampil.map((p, i) => {
              const lama = lamaHari(p);
              return (
                <tr key={p.id} className="border-t border-slate-100 align-top hover:bg-sky-50/40">
                  <td className="px-2 py-2 text-center tabular-nums text-slate-500">{i + 1}</td>
                  <td className="max-w-[26rem] px-2 py-2">
                    <button onClick={() => setSunting(p)} className="text-left font-semibold text-slate-800 hover:text-sky-700 hover:underline">
                      {p.judul || "(tanpa judul)"}
                    </button>
                    {(p.nomorSurat || p.kapal.length > 0) && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                        {p.nomorSurat && <span className="font-mono">{p.nomorSurat}</span>}
                        {p.kapal.map((k) => <span key={k} className="rounded bg-slate-100 px-1.5 font-semibold text-slate-600">{kapalPendek(k)}</span>)}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums">{rupiah(p.totalBiaya)}</td>
                  <td className="px-2 py-2"><Lencana s={p.status} /></td>
                  <td className="max-w-[14rem] px-2 py-2"><Lampiran p={p} /></td>
                  <td className="whitespace-nowrap px-2 py-2">{tglPendek(p.tglPengajuan)}</td>
                  <td className="whitespace-nowrap px-2 py-2">{tglPendek(p.tglSelesai)}</td>
                  <td className="px-2 py-2 text-center"><Lama p={p} lama={lama} /></td>
                  <td className="px-2 py-2"><JenisChip j={p.jenisUsulan} /></td>
                  <td className="max-w-[16rem] px-2 py-2 text-slate-600">
                    {p.keterangan}
                    {p.ketPersetujuan && <div className="mt-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">{p.ketPersetujuan}</div>}
                  </td>
                  <td className="px-2 py-2 text-center"><TandaSinkron p={p} /></td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <button onClick={() => setSunting(p)} className="btn btn-ghost px-2 py-1 text-[11px]">Ubah</button>
                    <button onClick={() => onHapus(p)} className="btn btn-ghost px-2 py-1 text-[11px] text-red-600">Hapus</button>
                  </td>
                </tr>
              );
            })}
            {!tampil.length && (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-slate-500">
                {items.length ? "Tidak ada yang cocok dengan saringan." : "Belum ada permohonan. Klik ＋ Tambah Permohonan, atau ⟳ Tarik dari spreadsheet untuk mengambil data yang sudah ada."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* kartu — HP & tablet */}
      <div className="mt-2 grid gap-2 lg:hidden">
        {tampil.map((p) => (
          <div key={p.id} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200 elev-sm">
            <div className="flex items-start gap-2">
              <button onClick={() => setSunting(p)} className="min-w-0 flex-1 text-left text-[13px] font-semibold text-slate-800">
                {p.judul || "(tanpa judul)"}
              </button>
              <TandaSinkron p={p} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <Lencana s={p.status} /><JenisChip j={p.jenisUsulan} />
              <span className="font-semibold tabular-nums">{rupiah(p.totalBiaya)}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Diajukan {tglPendek(p.tglPengajuan) || "-"}{p.tglSelesai ? ` · selesai ${tglPendek(p.tglSelesai)}` : ""} · <Lama p={p} lama={lamaHari(p)} />
            </div>
            {(p.keterangan || p.ketPersetujuan) && <div className="mt-1 text-[11px] text-slate-600">{[p.keterangan, p.ketPersetujuan].filter(Boolean).join(" · ")}</div>}
            <div className="mt-1.5 flex items-center gap-2">
              <Lampiran p={p} />
              <button onClick={() => onHapus(p)} className="btn btn-ghost ml-auto px-2 py-1 text-[11px] text-red-600">Hapus</button>
            </div>
          </div>
        ))}
        {!tampil.length && <p className="rounded-xl bg-white px-3 py-6 text-center text-xs text-slate-500 ring-1 ring-slate-200">Belum ada permohonan.</p>}
      </div>

      {sunting && (
        <Borang awal={sunting} baru={!items.some((x) => x.id === sunting.id)} onTutup={() => setSunting(null)} onSimpan={onSimpan} />
      )}
    </main>
  );
}

function Kartu({ label, nilai, sub, bar, aktif, onKlik }: { label: string; nilai: string; sub: string; bar: string; aktif: boolean; onKlik: () => void }) {
  return (
    <button onClick={onKlik} aria-pressed={aktif}
      className={`relative overflow-hidden rounded-2xl bg-white px-3 py-2.5 text-left ring-1 transition elev-sm ${aktif ? "ring-2 ring-[#16357f]" : "ring-slate-200 hover:ring-slate-400"}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="block text-2xl font-extrabold tabular-nums text-slate-800">{nilai}</span>
      <span className="block truncate text-[11px] text-slate-500">{sub}</span>
    </button>
  );
}

const Lencana = ({ s }: { s: StatusPermohonan }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${STATUS_WARNA[s]}`}>{s}</span>
);
const JenisChip = ({ j }: { j: JenisUsulan }) => (
  <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${JENIS_WARNA[j]}`}>{j}</span>
);

function Lampiran({ p }: { p: Permohonan }) {
  if (!p.lampiranUrl && !p.lampiranNama) return <span className="text-[11px] text-slate-400">—</span>;
  const nama = p.lampiranNama || "Lampiran";
  return p.lampiranUrl ? (
    <a href={p.lampiranUrl} target="_blank" rel="noreferrer"
      className="inline-block max-w-full truncate rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 ring-1 ring-sky-200 hover:underline">
      📁 {nama}
    </a>
  ) : <span className="text-[11px] text-slate-600">📁 {nama}</span>;
}

function Lama({ p, lama }: { p: Permohonan; lama: number | null }) {
  if (lama === null) return <span className="text-slate-400">—</span>;
  const lewat = p.status === "Proses" && lama > 30;
  return <span className={`tabular-nums ${lewat ? "font-bold text-amber-700" : "text-slate-600"}`} title={p.status === "Proses" ? "hari sejak diajukan" : "hari sampai selesai"}>{lama} hr</span>;
}

function TandaSinkron({ p }: { p: Permohonan }) {
  if (p.sinkron?.ok) return <span title={`Spreadsheet baris ${p.sinkron.baris ?? "?"} · ${p.sinkron.pesan}`} className="text-emerald-600">✓</span>;
  return <span title={p.sinkron ? `Belum masuk spreadsheet: ${p.sinkron.pesan}` : "Belum dikirim ke spreadsheet"} className="font-bold text-amber-600">!</span>;
}

function Borang({ awal, baru, onTutup, onSimpan }: {
  awal: Permohonan; baru: boolean; onTutup: () => void; onSimpan: (p: Permohonan) => Promise<void>;
}) {
  const [p, setP] = useState<Permohonan>(awal);
  const [biayaTeks, setBiayaTeks] = useState(awal.totalBiaya ? awal.totalBiaya.toLocaleString("id-ID") : "");
  const [sibukSimpan, setSibuk] = useState(false);
  const ubah = <K extends keyof Permohonan>(k: K, v: Permohonan[K]) => setP((x) => ({ ...x, [k]: v }));

  /* ── unggah lampiran ke Drive ───────────────────────────────────────── */
  const [mengunggah, setMengunggah] = useState(false);
  const [kemajuan, setKemajuan] = useState("");
  const [terunggah, setTerunggah] = useState<{ nama: string; url: string; ukuran: number }[]>([]);
  const [perluFolder, setPerluFolder] = useState(false);
  const [tautanInduk, setTautanInduk] = useState("");
  const sibuk = sibukSimpan || mengunggah;

  const kirimBerkasApi = async (isi: Record<string, unknown>) => {
    const r = await fetch(ALAMAT_BERKAS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isi) });
    const d = await r.json().catch(() => ({}));
    if (d?.perluFolder) setPerluFolder(true);
    if (!r.ok || !d?.ok) throw new Error(d?.error || `HTTP ${r.status}`);
    return d;
  };

  /** folder lampiran: yang sudah bernomor dipakai lagi, kalau belum dibuatkan bernomor */
  const siapkanFolder = async (): Promise<string> => {
    const ada = p.lampiranNama.trim();
    if (/^\d+\s*\./.test(ada) && p.lampiranUrl) return ada;
    const d = await kirimBerkasApi({ aksi: "folder", nama: ada || usulanFolder(p.judul, p.tglPengajuan) });
    setP((x) => ({ ...x, lampiranNama: d.folderNama, lampiranUrl: d.folderUrl }));
    return d.folderNama as string;
  };

  const unggah = async (daftar: File[]) => {
    if (!daftar.length) return;
    if (!p.judul.trim() && !p.lampiranNama.trim()) { await beritahu("Isi dulu Jenis survey / pekerjaan — nama folder lampiran diambil dari situ."); return; }
    setMengunggah(true);
    setKemajuan("menyiapkan folder di Google Drive…");
    try {
      const folder = await siapkanFolder();
      for (const f of daftar) {
        const b = await unggahBerkas(f, [folder], (k) => setKemajuan(
          `${k.berkas} — ${k.total > 1 ? `potongan ${k.potongan}/${k.total}` : "mengunggah"}${k.percobaan ? ` (ulang ${k.percobaan})` : ""}`), ALAMAT_BERKAS);
        setTerunggah((x) => [...x, { nama: b.nama, url: b.url, ukuran: b.ukuran }]);
        if (b.folderUrl) setP((x) => ({ ...x, lampiranUrl: x.lampiranUrl || b.folderUrl! }));
      }
      setKemajuan("");
    } catch (e: any) {
      setKemajuan("");
      await beritahu("Unggah lampiran gagal: " + (e?.message || e));
    } finally { setMengunggah(false); }
  };

  const simpanFolderInduk = async () => {
    try {
      const d = await kirimBerkasApi({ aksi: "aturFolder", url: tautanInduk.trim() });
      setPerluFolder(false);
      setTautanInduk("");
      await beritahu(`Folder induk tersimpan: ${d.folderNama}. Silakan pilih berkas lagi.`);
    } catch (e: any) { await beritahu(e?.message || String(e)); }
  };

  useEffect(() => {
    const tombol = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || sibuk) return;
      if (document.querySelectorAll('[aria-modal="true"]').length > 1) return;
      onTutup();
    };
    document.addEventListener("keydown", tombol);
    const semula = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", tombol); document.body.style.overflow = semula; };
  }, [onTutup, sibuk]);

  const alihKapal = (k: string) => setP((x) => ({ ...x, kapal: x.kapal.includes(k) ? x.kapal.filter((y) => y !== k) : [...x.kapal, k] }));
  const pilihStatus = (s: StatusPermohonan) => setP((x) => ({
    ...x, status: s,
    tglSelesai: s === "Proses" ? x.tglSelesai : (x.tglSelesai || hariIni()),
    ketPersetujuan: s === "Disetujui" && !x.ketPersetujuan ? "sudah terbit persetujuan" : x.ketPersetujuan,
  }));

  const simpanBorang = async () => {
    const angka = Number(biayaTeks.replace(/[^\d]/g, "")) || 0;
    const isi = { ...p, totalBiaya: angka };
    if (!isi.judul.trim()) { await beritahu("Jenis survey / pekerjaan belum diisi."); return; }
    if (!isi.tglPengajuan) { await beritahu("Tanggal pengajuan belum diisi."); return; }
    if (isi.tglSelesai && isi.tglSelesai < isi.tglPengajuan) { await beritahu("Tanggal selesai tidak bisa lebih awal dari tanggal pengajuan."); return; }
    if (isi.lampiranUrl && !/^https?:\/\//i.test(isi.lampiranUrl)) { await beritahu("Tautan lampiran harus diawali https://"); return; }
    setSibuk(true);
    try { await onSimpan(isi); } finally { setSibuk(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-slate-900/50 sm:items-start sm:p-4"
      role="dialog" aria-modal="true" aria-label={baru ? "Permohonan baru" : "Ubah permohonan"}>
      <div className="flex min-h-full w-full max-w-3xl flex-col bg-white elev-lg sm:min-h-0 sm:rounded-2xl [&_.inp]:text-base sm:[&_.inp]:text-[0.8125rem]">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:rounded-t-2xl sm:px-5">
          <h2 className="font-bold text-slate-800">{baru ? "Permohonan Baru" : "Ubah Permohonan"}</h2>
          <button onClick={onTutup} className="btn btn-ghost ml-auto text-xs">Tutup</button>
        </div>

        <div className="grid flex-1 gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <div className="sm:col-span-2">
            <Medan label="Jenis survey / pekerjaan" wajib>
              <textarea value={p.judul} onChange={(e) => ubah("judul", e.target.value)} rows={2} className="inp" autoFocus={baru}
                placeholder="mis. Permohonan Persetujuan Addendum Docking KMP. Kerapu II Tahun 2026" />
            </Medan>
          </div>

          <Medan label="Nomor surat permohonan" petunjuk="Ditulis juga di kolom Keterangan spreadsheet.">
            <input value={p.nomorSurat} onChange={(e) => ubah("nomorSurat", e.target.value)} className="inp" placeholder="TN.101/00000/XI/ASDP-TTE/2026" />
          </Medan>
          <Medan label="Total biaya yang diajukan (Rp)">
            <input value={biayaTeks} inputMode="numeric" className="inp text-right tabular-nums"
              onChange={(e) => { const d = e.target.value.replace(/[^\d]/g, ""); setBiayaTeks(d ? Number(d).toLocaleString("id-ID") : ""); }}
              placeholder="0" />
          </Medan>

          <div className="sm:col-span-2">
            <Medan label="Kapal terkait" petunjuk="Boleh lebih dari satu; hanya tersimpan di aplikasi.">
              <div className="flex flex-wrap gap-1.5">
                {KAPAL_ANGGARAN.map((k) => {
                  const on = p.kapal.includes(k);
                  return (
                    <button key={k} type="button" onClick={() => alihKapal(k)} aria-pressed={on}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition ${on ? "bg-[#16357f] text-white ring-[#16357f]" : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-400"}`}>
                      {kapalPendek(k)}
                    </button>
                  );
                })}
              </div>
            </Medan>
          </div>

          <Medan label="Status persetujuan pusat">
            <div className="grid grid-cols-3 gap-1.5">
              {STATUS.map((s) => (
                <button key={s} type="button" onClick={() => pilihStatus(s)}
                  className={`rounded-lg py-2 text-xs font-bold ring-1 transition ${p.status === s
                    ? s === "Disetujui" ? "bg-emerald-600 text-white ring-emerald-600" : s === "Ditolak" ? "bg-red-600 text-white ring-red-600" : "bg-indigo-600 text-white ring-indigo-600"
                    : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-400"}`}>
                  {s}
                </button>
              ))}
            </div>
          </Medan>
          <Medan label="Jenis usulan">
            <div className="grid grid-cols-3 gap-1.5">
              {JENIS.map((j) => (
                <button key={j} type="button" onClick={() => ubah("jenisUsulan", j)}
                  className={`rounded-lg px-1 py-2 text-[11px] font-bold ring-1 transition ${p.jenisUsulan === j ? "bg-[#16357f] text-white ring-[#16357f]" : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-400"}`}>
                  {j}
                </button>
              ))}
            </div>
          </Medan>

          <Medan label="Tanggal pengajuan" wajib>
            <input type="date" value={p.tglPengajuan} onChange={(e) => ubah("tglPengajuan", e.target.value)} className="inp" />
          </Medan>
          <Medan label="Tanggal selesai" petunjuk="Tanggal persetujuan terbit / permohonan ditutup.">
            <input type="date" value={p.tglSelesai} onChange={(e) => ubah("tglSelesai", e.target.value)} className="inp" />
          </Medan>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3 sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Lampiran dokumen</span>
              <label className={`btn btn-primary ml-auto px-3 py-1.5 text-xs ${mengunggah ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
                📎 {mengunggah ? "mengunggah…" : "Unggah berkas"}
                <input type="file" multiple accept={ACCEPT_BERKAS} className="hidden" disabled={mengunggah}
                  onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ""; void unggah(f); }} />
              </label>
              {p.lampiranUrl && (
                <a href={p.lampiranUrl} target="_blank" rel="noreferrer" className="btn btn-ghost px-3 py-1.5 text-xs">📂 Buka folder ↗</a>
              )}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              Berkas masuk ke folder Drive <b>KONTROL PERMOHONAN CABANG</b>; subfolder bernomor (mis. “17. ADDENDUM DOCKING KMP KERAPU II 2026”)
              dibuat otomatis dari judul. PDF, Word, Excel, foto — maks ±34 MB per berkas.
            </p>

            {kemajuan && <p className="mt-2 text-xs font-semibold text-indigo-700">⏳ {kemajuan}</p>}
            {terunggah.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs">
                {terunggah.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-600">✓</span>
                    <a href={b.url} target="_blank" rel="noreferrer" className="truncate text-slate-700 hover:underline">{b.nama}</a>
                    <span className="shrink-0 text-slate-400">{ukuranSingkat(b.ukuran)}</span>
                  </li>
                ))}
              </ul>
            )}

            {perluFolder && (
              <div className="mt-2 rounded-lg bg-amber-50 p-2 ring-1 ring-amber-200">
                <p className="text-[11px] text-amber-900">
                  Apps Script belum menemukan folder Drive <b>01. KONTROL PERMOHONAN CABANG 2026</b>. Buka folder itu di Google Drive,
                  salin tautannya dari kolom alamat, tempel di sini (cukup sekali):
                </p>
                <div className="mt-1.5 flex gap-1.5">
                  <input value={tautanInduk} onChange={(e) => setTautanInduk(e.target.value)} className="inp flex-1" placeholder="https://drive.google.com/drive/folders/…" />
                  <button type="button" onClick={simpanFolderInduk} disabled={!tautanInduk.trim()} className="btn btn-success px-3 text-xs">Simpan</button>
                </div>
              </div>
            )}

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Medan label="Nama folder lampiran" petunjuk="Terisi sendiri saat unggah; boleh diketik bila folder sudah ada.">
                <input value={p.lampiranNama} onChange={(e) => ubah("lampiranNama", e.target.value)} className="inp" placeholder="mis. 17. ADDENDUM DOCKING KMP KERAPU II 2026" />
              </Medan>
              <Medan label="Tautan folder (Google Drive)">
                <input value={p.lampiranUrl} onChange={(e) => ubah("lampiranUrl", e.target.value)} className="inp" placeholder="https://drive.google.com/…" />
              </Medan>
            </div>
          </div>

          <Medan label="Keterangan">
            <input value={p.keterangan} onChange={(e) => ubah("keterangan", e.target.value)} className="inp" placeholder="mis. Docking, Temuan audit, Hutang BKI" />
          </Medan>
          <Medan label="Keterangan persetujuan" petunjuk="Kolom J spreadsheet.">
            <input value={p.ketPersetujuan} onChange={(e) => ubah("ketPersetujuan", e.target.value)} className="inp" placeholder="sudah terbit persetujuan — TN.101/…" />
          </Medan>
        </div>

        <div className="sticky bottom-0 flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:rounded-b-2xl sm:px-5">
          <p className="hidden text-[11px] text-slate-500 sm:block">Tersimpan ke basis data cabang & otomatis ke spreadsheet Kontrol Permohonan.</p>
          <button onClick={onTutup} disabled={sibuk} className="btn btn-ghost ml-auto text-xs">Batal</button>
          <button onClick={simpanBorang} disabled={sibuk} className="btn btn-success px-5 text-xs">{sibukSimpan ? "menyimpan…" : mengunggah ? "tunggu unggahan…" : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}

function Medan({ label, children, wajib, petunjuk }: { label: string; children: React.ReactNode; wajib?: boolean; petunjuk?: string }) {
  return (
    <div className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
        {label}{wajib && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {petunjuk && <span className="mt-1 block text-[10px] text-slate-500">{petunjuk}</span>}
    </div>
  );
}
