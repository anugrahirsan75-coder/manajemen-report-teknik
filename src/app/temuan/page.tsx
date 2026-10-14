"use client";
/**
 * Monitoring Temuan Kapal — dari temuan pemeriksa sampai bukti pemenuhannya.
 *
 * Satu halaman, bukan dua: daftar dan borangnya dipakai berselang-seling
 * sepanjang hari, dan memindahkan borang ke halaman tersendiri membuat orang
 * kehilangan tempatnya di daftar setiap kali menutup satu temuan.
 *
 * Aturan yang dijaga halaman ini: temuan tidak bisa ditutup tanpa bukti.
 * Lembar monitoring yang seluruhnya hijau tanpa satu pun dokumen justru lebih
 * menyesatkan daripada lembar yang jujur menunjukkan tunggakan, dan yang
 * memeriksanya kelak bukan kita.
 */
import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { useTemuan } from "@/lib/temuan/store";
import {
  BuktiTemuan, KATEGORI, PENERBIT, PRIORITAS, PRIORITAS_BAWAAN, STATUS_LABEL, STATUS_WARNA,
  StatusTemuan, TemuanItem, bolehDitutup, sisaHari, temuanKosong,
} from "@/lib/temuan/types";
import { GagalUnggah, buktiTautan, ukuranRapi, unggahBukti } from "@/lib/temuan/bukti";
import { SEED_CIC_2026, siapkanImpor } from "@/lib/temuan/impor";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { tanggalIndo } from "@/lib/format";
import { beritahu, konfirmasi } from "@/components/Konfirmasi";

export default function HalamanTemuan() {
  const { items, loading, galat, refresh, simpan, hapus, supabaseReady } = useTemuan();
  const [q, setQ] = useState("");
  const [fKapal, setFKapal] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPrioritas, setFPrioritas] = useState("");
  const [sunting, setSunting] = useState<TemuanItem | null>(null);
  const [imporSibuk, setImporSibuk] = useState(false);

  /*
   * Impor seed CIC 2026. Aman diulang: yang sudah ada dilewati menurut sidik
   * jari kapal+deskripsi, jadi menekannya dua kali tidak melipatgandakan
   * tunggakan.
   */
  const imporCic = async () => {
    const { dibuat, dilewati } = siapkanImpor(items);
    if (!dibuat.length) {
      await beritahu(`Seluruh ${dilewati} temuan CIC 2026 sudah ada — tidak ada yang ditambahkan.`);
      return;
    }
    if (!(await konfirmasi(`Tambahkan ${dibuat.length} temuan CIC 2026`
      + `${dilewati ? ` (${dilewati} sudah ada, dilewati)` : ""}?`))) return;
    setImporSibuk(true);
    try {
      for (const t of dibuat) await simpan(t);
      await beritahu(`${dibuat.length} temuan ditambahkan.`);
    } finally { setImporSibuk(false); }
  };

  const tersaring = useMemo(() => items.filter((t) => {
    if (fKapal && t.kapal !== fKapal) return false;
    if (fStatus && t.status !== fStatus) return false;
    if (fPrioritas && t.prioritas !== fPrioritas) return false;
    if (q) {
      const gabung = `${t.deskripsi} ${t.kapal} ${t.sumber} ${t.rencanaTindakLanjut} ${t.penanggungJawab}`;
      if (!gabung.toLowerCase().includes(q.toLowerCase())) return false;
    }
    return true;
  }), [items, q, fKapal, fStatus, fPrioritas]);

  const hitung = useMemo(() => {
    const n = { open: 0, proses: 0, closed: 0, telat: 0, tanpaBukti: 0 };
    items.forEach((t) => {
      n[t.status] += 1;
      const sisa = sisaHari(t.jatuhTempo);
      if (t.status !== "closed" && sisa !== null && sisa < 0) n.telat += 1;
      if (t.status === "closed" && !bolehDitutup(t)) n.tanpaBukti += 1;
    });
    return n;
  }, [items]);

  const kapalAda = useMemo(
    () => Array.from(new Set(items.map((t) => t.kapal).filter(Boolean))).sort(), [items]);

  const hapusTemuan = async (t: TemuanItem) => {
    if (!(await konfirmasi(`Hapus temuan "${t.deskripsi.slice(0, 60)}"?`))) return;
    await hapus(t.id);
  };

  return (
    <main className="mx-auto max-w-[105rem] px-4 py-6">
      <header className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass flex flex-wrap items-center gap-4 rounded-[calc(1.5rem-1.5px)] px-5 py-5">
          <div className="bg-white rounded-2xl p-2.5 elev-md shrink-0 ring-1 ring-black/5">
            <Image src="/logo-asdp.png" alt="ASDP" width={56} height={38} className="object-contain" />
          </div>
          <div className="min-w-[18rem] flex-1">
            <h1 className="asdp-text-gradient text-2xl font-extrabold leading-tight">Monitoring Temuan Kapal</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Temuan pemeriksa — Marine Inspector, auditor internal, surveyor klas — sampai bukti pemenuhannya.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={imporCic} disabled={imporSibuk}
              className="btn btn-ghost px-4 py-2.5 text-sm disabled:opacity-50"
              title={`Tarik ${SEED_CIC_2026.length} temuan hasil pemeriksaan CIC KSOP 2026`}>
              {imporSibuk ? "⏳ mengimpor…" : `⤓ Impor CIC 2026 (${SEED_CIC_2026.length})`}
            </button>
            <button onClick={() => setSunting(temuanKosong())} className="btn btn-primary px-5 py-2.5 text-sm">
              ＋ Tambah Temuan
            </button>
          </div>
        </div>
      </header>

      {!supabaseReady && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          Supabase belum tersambung — temuan tersimpan di peramban ini saja, dan unggahan bukti belum bisa dipakai.
        </p>
      )}
      {galat && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800 ring-1 ring-red-200">{galat}</p>
      )}

      <section className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Angka label="Open" nilai={hitung.open} bar="bg-red-500" />
        <Angka label="On Progress" nilai={hitung.proses} bar="bg-amber-500" />
        <Angka label="Closed" nilai={hitung.closed} bar="bg-emerald-600" />
        <Angka label="Lewat jatuh tempo" nilai={hitung.telat} bar="bg-red-700"
          sub={hitung.telat ? "perlu tindakan segera" : "tidak ada"} />
        <Angka label="Closed tanpa bukti" nilai={hitung.tanpaBukti} bar="bg-fuchsia-600"
          sub={hitung.tanpaBukti ? "tidak bisa diperiksa" : "bersih"} />
      </section>

      <section className="mt-4 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 cari temuan…"
          className="inp flex-1 min-w-[14rem]" />
        <select value={fKapal} onChange={(e) => setFKapal(e.target.value)} className="inp w-auto">
          <option value="">Semua kapal</option>
          {kapalAda.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="inp w-auto">
          <option value="">Semua status</option>
          {(["open", "proses", "closed"] as StatusTemuan[]).map((s) =>
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={fPrioritas} onChange={(e) => setFPrioritas(e.target.value)} className="inp w-auto">
          <option value="">Semua prioritas</option>
          {PRIORITAS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={refresh} className="btn btn-ghost text-xs">↻ Muat ulang</button>
      </section>

      {loading && <p className="mt-4 text-sm text-slate-500">memuat…</p>}

      {!loading && !tersaring.length && (
        <div className="mt-4 rounded-2xl bg-white ring-line elev-sm p-8 text-center text-sm text-slate-500">
          {items.length ? "Tidak ada temuan yang cocok dengan saringan." : "Belum ada temuan tercatat."}
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {tersaring.map((t) => (
          <Kartu key={t.id} t={t} onSunting={() => setSunting(t)} onHapus={() => hapusTemuan(t)} />
        ))}
      </div>

      {sunting && (
        <Borang
          awal={sunting}
          onTutup={() => setSunting(null)}
          onSimpan={async (it) => { await simpan(it); setSunting(null); }}
        />
      )}
    </main>
  );
}

function Angka({ label, nilai, bar, sub }: { label: string; nilai: number; bar: string; sub?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 elev-sm pl-4 pr-3 py-3">
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${bar}`} />
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="text-2xl font-extrabold tabular-nums leading-tight text-slate-900">{nilai}</p>
      {sub && <p className="mt-0.5 truncate text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}

function Kartu({ t, onSunting, onHapus }:
  { t: TemuanItem; onSunting: () => void; onHapus: () => void }) {
  const sisa = sisaHari(t.jatuhTempo);
  const telat = t.status !== "closed" && sisa !== null && sisa < 0;
  const janggal = t.status === "closed" && !bolehDitutup(t);

  return (
    <article className="rounded-2xl bg-white ring-line elev-sm p-4 card-hover">
      <div className="flex flex-wrap items-start gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${STATUS_WARNA[t.status]}`}>
          {STATUS_LABEL[t.status]}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">{t.kapal || "—"}</span>
        {t.kategori && (
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 ring-1 ring-sky-200">
            {t.kategori}
          </span>
        )}
        {t.prioritas && (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200">
            Prioritas {t.prioritas}
          </span>
        )}
        <span className="ml-auto flex gap-1">
          <button onClick={onSunting} className="btn btn-primary px-2.5 py-1 text-[11px]">Buka</button>
          <button onClick={onHapus} className="btn btn-danger-soft px-2.5 py-1 text-[11px]">Hapus</button>
        </span>
      </div>

      <p className="mt-2 text-sm font-semibold leading-snug text-slate-800">{t.deskripsi || "(tanpa deskripsi)"}</p>

      <div className="mt-2 grid gap-x-6 gap-y-1 text-[11px] text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
        <p>Diterbitkan: <b className="text-slate-800">{t.penerbit || "—"}</b></p>
        <p>Jatuh tempo: <b className={telat ? "text-red-700" : "text-slate-800"}>
          {t.jatuhTempo ? tanggalIndo(t.jatuhTempo) : "—"}
          {sisa !== null && t.status !== "closed" && (
            <span className="font-normal"> ({sisa < 0 ? `telat ${-sisa} hari` : `${sisa} hari lagi`})</span>
          )}
        </b></p>
        <p>Penanggung jawab: <b className="text-slate-800">{t.penanggungJawab || "belum ditunjuk"}</b></p>
        <p>Bukti: <b className={t.bukti?.length ? "text-emerald-700" : "text-slate-800"}>
          {t.bukti?.length || 0} dokumen</b></p>
      </div>

      {t.prosesSaatIni && (
        <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-700">
          Proses saat ini: {t.prosesSaatIni}
        </p>
      )}
      {janggal && (
        <p className="mt-2 rounded-lg bg-fuchsia-50 px-2.5 py-1.5 text-[11px] font-semibold text-fuchsia-800 ring-1 ring-fuchsia-200">
          Ditutup tanpa dokumen bukti — tidak bisa diperiksa kembali oleh siapa pun.
        </p>
      )}
    </article>
  );
}

function Borang({ awal, onTutup, onSimpan }:
  { awal: TemuanItem; onTutup: () => void; onSimpan: (t: TemuanItem) => Promise<void> }) {
  const [t, setT] = useState<TemuanItem>({ ...awal, bukti: awal.bukti || [] });
  const [sibuk, setSibuk] = useState("");
  const [tautan, setTautan] = useState("");
  const berkasRef = useRef<HTMLInputElement>(null);

  const ubah = (k: keyof TemuanItem, v: any) => setT((x) => ({ ...x, [k]: v }));

  const pilihKategori = (v: string) =>
    setT((x) => ({ ...x, kategori: v, prioritas: PRIORITAS_BAWAAN[v] || x.prioritas }));

  const tambahBerkas = async (daftar: FileList | null) => {
    if (!daftar?.length) return;
    setSibuk("mengunggah…");
    try {
      const baru: BuktiTemuan[] = [];
      for (const f of Array.from(daftar)) baru.push(await unggahBukti(f));
      setT((x) => ({ ...x, bukti: [...(x.bukti || []), ...baru] }));
    } catch (e: any) {
      await beritahu(e instanceof GagalUnggah ? e.message : `Gagal unggah: ${e?.message || e}`);
    } finally {
      setSibuk("");
      if (berkasRef.current) berkasRef.current.value = "";
    }
  };

  const tambahTautan = () => {
    const url = tautan.trim();
    if (!/^https?:\/\//i.test(url)) { void beritahu("Tautan harus diawali http:// atau https://"); return; }
    setT((x) => ({ ...x, bukti: [...(x.bukti || []), buktiTautan(url, "")] }));
    setTautan("");
  };

  const buangBukti = (id: string) =>
    setT((x) => ({ ...x, bukti: (x.bukti || []).filter((b) => b.id !== id) }));

  const simpanBorang = async () => {
    if (!t.deskripsi.trim()) { await beritahu("Deskripsi temuan belum diisi."); return; }
    if (!t.kapal.trim()) { await beritahu("Kapal belum dipilih."); return; }
    /*
     * Penjagaan yang sesungguhnya: CLOSED menuntut bukti. Ditaruh di sini,
     * bukan sekadar sebagai peringatan di daftar, supaya statusnya tidak
     * pernah sempat tersimpan dalam keadaan tak bisa diperiksa.
     */
    if (t.status === "closed" && !bolehDitutup(t)) {
      await beritahu("Temuan tidak bisa ditutup tanpa dokumen bukti. Unggah berkasnya, "
        + "atau tautkan dari Drive bila berkasnya besar.");
      return;
    }
    setSibuk("menyimpan…");
    try { await onSimpan(t); } finally { setSibuk(""); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white elev-lg">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-slate-800">{awal.deskripsi ? "Temuan" : "Temuan Baru"}</h2>
          <button onClick={onTutup} className="btn btn-ghost ml-auto text-xs">Tutup</button>
        </div>

        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          <Medan label="Kapal" wajib>
            <select value={t.kapal} onChange={(e) => ubah("kapal", e.target.value)} className="inp">
              <option value="">— pilih kapal —</option>
              {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </Medan>
          <Medan label="Diterbitkan oleh">
            <select value={t.penerbit} onChange={(e) => ubah("penerbit", e.target.value)} className="inp">
              {PENERBIT.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Medan>

          <div className="sm:col-span-2">
            <Medan label="Deskripsi NC & Memorandum" wajib>
              <textarea value={t.deskripsi} onChange={(e) => ubah("deskripsi", e.target.value)}
                rows={3} className="inp" placeholder="Rumusan temuan apa adanya dari laporan pemeriksa" />
            </Medan>
          </div>

          <Medan label="Kategori temuan">
            <select value={t.kategori} onChange={(e) => pilihKategori(e.target.value)} className="inp">
              {KATEGORI.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </Medan>
          <Medan label="Prioritas" petunjuk="Terisi menurut kategori; boleh diubah cabang.">
            <select value={t.prioritas} onChange={(e) => ubah("prioritas", e.target.value)} className="inp">
              {PRIORITAS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Medan>

          <Medan label="Sumber laporan">
            <input value={t.sumber} onChange={(e) => ubah("sumber", e.target.value)} className="inp"
              placeholder="mis. Laporan CIC KSOP 28-09-2026" />
          </Medan>
          <Medan label="Referensi aturan">
            <input value={t.referensi} onChange={(e) => ubah("referensi", e.target.value)} className="inp"
              placeholder="mis. SOLAS II-2 / KP-DJPL 24/2025" />
          </Medan>

          <Medan label="Tanggal temuan">
            <input type="date" value={t.tglTemuan} onChange={(e) => ubah("tglTemuan", e.target.value)} className="inp" />
          </Medan>
          <Medan label="Tanggal jatuh tempo">
            <input type="date" value={t.jatuhTempo} onChange={(e) => ubah("jatuhTempo", e.target.value)} className="inp" />
          </Medan>

          <div className="sm:col-span-2">
            <Medan label="Rencana tindak lanjut">
              <textarea value={t.rencanaTindakLanjut} onChange={(e) => ubah("rencanaTindakLanjut", e.target.value)}
                rows={2} className="inp" />
            </Medan>
          </div>

          <Medan label="Yang bertanggung jawab">
            <input value={t.penanggungJawab} onChange={(e) => ubah("penanggungJawab", e.target.value)} className="inp" />
          </Medan>
          <Medan label="Target penyelesaian">
            <input type="date" value={t.targetSelesai} onChange={(e) => ubah("targetSelesai", e.target.value)} className="inp" />
          </Medan>

          <Medan label="Proses saat ini">
            <input value={t.prosesSaatIni} onChange={(e) => ubah("prosesSaatIni", e.target.value)} className="inp"
              placeholder="mis. menunggu SPPBJ / barang dikirim" />
          </Medan>
          <Medan label="Pihak penanggung jawab proses">
            <input value={t.pihakProses} onChange={(e) => ubah("pihakProses", e.target.value)} className="inp" />
          </Medan>

          <Medan label="Status">
            <select value={t.status} onChange={(e) => ubah("status", e.target.value as StatusTemuan)} className="inp">
              {(["open", "proses", "closed"] as StatusTemuan[]).map((s) =>
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </Medan>
          <Medan label="Tanggal realisasi penyelesaian">
            <input type="date" value={t.tglRealisasi} onChange={(e) => ubah("tglRealisasi", e.target.value)} className="inp" />
          </Medan>
        </div>

        {/* ── bukti pemenuhan ─────────────────────────────────────────────── */}
        <div className="border-t border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-800">Dokumen bukti pemenuhan</h3>
            <span className="text-[11px] text-slate-500">
              berita acara, foto, sertifikat, hasil uji — PDF naik utuh, foto dikecilkan
            </span>
            <label className="btn btn-primary ml-auto cursor-pointer px-3 py-1.5 text-xs">
              ＋ Unggah berkas
              <input ref={berkasRef} type="file" multiple hidden
                accept=".pdf,image/*"
                onChange={(e) => tambahBerkas(e.target.files)} />
            </label>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <input value={tautan} onChange={(e) => setTautan(e.target.value)}
              placeholder="atau tempel tautan Google Drive untuk berkas besar…" className="inp flex-1 min-w-[16rem]" />
            <button onClick={tambahTautan} className="btn btn-ghost text-xs">Tautkan</button>
          </div>

          {sibuk && <p className="mt-2 text-xs text-slate-500">{sibuk}</p>}

          {!t.bukti?.length ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600 ring-1 ring-slate-200">
              Belum ada bukti. Temuan tidak bisa ditutup sebelum ada setidaknya satu dokumen.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {t.bukti.map((b) => (
                <li key={b.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                  <span className="text-base">{b.jenis === "tautan" ? "🔗" : "📄"}</span>
                  <a href={b.url} target="_blank" rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-xs font-semibold text-sky-800 hover:underline">
                    {b.nama}
                  </a>
                  <span className="text-[10px] tabular-nums text-slate-500">
                    {b.jenis === "tautan" ? "tautan" : ukuranRapi(b.bita)}
                  </span>
                  <button onClick={() => buangBukti(b.id)} className="btn btn-danger-soft px-2 py-0.5 text-[10px]">
                    Buang
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-3">
          <p className="text-[11px] text-slate-500">
            {t.status === "closed" && !bolehDitutup(t)
              ? "Status CLOSED butuh minimal satu dokumen bukti."
              : "Perubahan tersimpan ke basis data cabang."}
          </p>
          <button onClick={onTutup} className="btn btn-ghost ml-auto text-xs">Batal</button>
          <button onClick={simpanBorang} disabled={!!sibuk} className="btn btn-success text-xs disabled:opacity-50">
            {sibuk === "menyimpan…" ? "menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Medan({ label, children, wajib, petunjuk }:
  { label: string; children: React.ReactNode; wajib?: boolean; petunjuk?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
        {label}{wajib && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {petunjuk && <span className="mt-1 block text-[10px] text-slate-500">{petunjuk}</span>}
    </label>
  );
}
