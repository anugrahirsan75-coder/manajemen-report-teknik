"use client";
/**
 * Beranda Portal Kapal — apa yang sudah saya kirim, dan sudah diapakan kantor.
 *
 * Inilah yang selama ini tidak pernah bisa dilihat kapal. Berkas dikirim lewat
 * tautan terbuka, lalu senyap: sampai atau tidak, sudah dibaca atau belum, sudah
 * jadi pengadaan atau masih mengantre — semuanya hanya bisa ditanyakan lewat
 * WhatsApp kepada orang yang sedang mengerjakan hal lain.
 *
 * Karena itu yang ditaruh paling atas bukan tombol kirim, melainkan STATUS
 * kiriman terakhir. Dan di tiap kiriman yang belum ditutup kantor ada tombol
 * mengingatkan — sekali sehari, supaya tanda yang terlalu sering muncul tidak
 * berhenti dibaca.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RangkaPortal, useAku } from "@/components/portal/Rangka";

interface KirimanSaya {
  id: string;
  jenis: string;
  periode: string;
  dikirimPada: string;
  status: string;
  statusPada: string;
  pengirim: string;
  catatan: string;
  berkas: { nama: string; ukuran: number; fileId: string }[];
  dorongan: { pada: string; pesan: string }[];
}

const NADA_STATUS: Record<string, { label: string; kelas: string; arti: string }> = {
  baru: { label: "Belum dibuka", kelas: "bg-rose-100 text-rose-800 ring-rose-300", arti: "Kantor belum membuka kiriman ini." },
  dibaca: { label: "Sudah dibaca", kelas: "bg-slate-100 text-slate-700 ring-slate-300", arti: "Sudah dibuka kantor, belum ditindaklanjuti." },
  ditindaklanjuti: { label: "Sedang diproses", kelas: "bg-amber-100 text-amber-800 ring-amber-300", arti: "Sedang diurus kantor." },
  selesai: { label: "Selesai", kelas: "bg-emerald-100 text-emerald-800 ring-emerald-300", arti: "Sudah dituntaskan kantor." },
};

const JENIS_LABEL: Record<string, string> = {
  permintaan_deck: "Permintaan Deck",
  permintaan_mesin: "Permintaan Mesin",
  laporan_deck: "Laporan Deck",
  laporan_mesin: "Laporan Mesin",
};

const BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const bulanIndo = (p: string) => (/^\d{4}-\d{2}$/.test(p || "") ? `${BULAN[+p.slice(5, 7)]} ${p.slice(0, 4)}` : p || "—");
/**
 * Judul berkas tanpa awalan dan tanpa cap waktu.
 *
 * Apps Script menamai berkas "<periode> - <borang> - <kapal> - <judul> -
 * 20260901-113830.pdf". Mengambil potongan terakhir begitu saja menghasilkan
 * cap waktunya — deretan angka yang tidak memberi tahu apa pun tentang isi
 * lembarnya. Cap waktu dibuang dulu, baru judulnya diambil.
 */
const judulBerkas = (nama: string) => {
  const tanpaExt = nama.replace(/\.[a-z0-9]+$/i, "");
  const tanpaCap = tanpaExt.replace(/\s*-\s*\d{8}-\d{6}$/i, "").trim();
  const bagian = tanpaCap.split(/\s+-\s+/);
  return bagian[bagian.length - 1] || tanpaCap || nama;
};

const waktu = (iso: string) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export default function BerandaPortal() {
  const { aku } = useAku();
  const [baris, setBaris] = useState<KirimanSaya[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [dorong, setDorong] = useState<{ id: string; pesan: string } | null>(null);
  const [sibuk, setSibuk] = useState("");
  const [kabar, setKabar] = useState("");
  /**
   * Permintaan dan laporan dipisah.
   *
   * Keduanya berbeda urusan: permintaan menunggu DIKERJAKAN kantor —
   * dibelanjakan, dibuatkan SPPBJ — sedangkan laporan sudah selesai tugasnya
   * begitu ia sampai. Menumpuknya dalam satu daftar membuat kapal menagih
   * laporan yang tidak perlu ditagih, dan tagihan yang tak ada gunanya membuat
   * seluruh tanda tagihan berhenti dibaca kantor.
   */
  const [rupa, setRupa] = useState<"permintaan" | "laporan">("permintaan");

  const ambil = useCallback(async () => {
    try {
      const r = await fetch("/api/portal/kiriman", { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal memuat kiriman");
      setBaris(d.baris || []);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);

  useEffect(() => { void ambil(); }, [ambil]);

  const kirimDorongan = async (id: string, pesan: string) => {
    setSibuk(id); setGalat("");
    try {
      const r = await fetch("/api/portal/kiriman", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, pesan }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Pengingat gagal dikirim");
      setDorong(null);
      setKabar("Pengingat terkirim ke kantor ✓");
      setTimeout(() => setKabar(""), 4000);
      await ambil();
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setSibuk(""); }
  };

  /*
   * Dikelompokkan per periode laporan. Kapal membuka portalnya dengan
   * pertanyaan "yang bulan ini bagaimana"; daftar panjang tanpa pemisah bulan
   * menuntut pembacanya mengurutkan sendiri di kepala.
   */
  const permintaan = baris.filter((b) => b.jenis.startsWith("permintaan"));
  const laporan = baris.filter((b) => !b.jenis.startsWith("permintaan"));
  const tampil = rupa === "permintaan" ? permintaan : laporan;

  const kelompok = tampil.reduce((peta, b) => {
    const k = b.periode || "tanpa-periode";
    peta.set(k, [...(peta.get(k) || []), b]);
    return peta;
  }, new Map<string, KirimanSaya[]>());
  const periodeUrut = Array.from(kelompok.keys()).sort().reverse();

  return (
    <RangkaPortal aku={aku}>
      {/* ── satu baris ringkas: yang perlu diketahui cuma berapa yang tercatat ── */}
      <section className="mb-3 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <span className="text-3xl font-black tabular-nums leading-none text-slate-900 dark:text-white">{baris.length}</span>
        <span className="flex-1">
          <span className="block text-[13px] font-bold text-slate-800 dark:text-slate-100">Kiriman saya</span>
          <span className="block text-[11px] text-slate-500">
            {permintaan.length} permintaan · {laporan.length} laporan
          </span>
        </span>
        <button onClick={() => { setMuat(true); void ambil(); }}
          className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300">
          Muat ulang
        </button>
      </section>

      {/* ── pintasan ke borang bagiannya ──────────────────────────────── */}
      {aku && (
        <Link href={aku.bagian === "mesin" ? "/portal/stok" : "/portal/alkes"}
          className="mb-4 flex items-center gap-3 rounded-2xl bg-[#16357f] px-4 py-3.5 text-white shadow-sm transition hover:bg-[#12296a]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 text-xl">
            {aku.bagian === "mesin" ? "⚙️" : "🩺"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold leading-tight">
              {aku.bagian === "mesin" ? "Stok Filter & jam kerja mesin" : "Alat Kesehatan kapal"}
            </span>
            <span className="block text-[11.5px] leading-tight text-white/75">
              {aku.ringkas
                ? aku.bagian === "mesin"
                  ? `${aku.ringkas.baris} jenis tercatat${aku.ringkas.menipis ? ` · ${aku.ringkas.menipis} menipis` : ""}`
                  : `${aku.ringkas.baris} butir tercatat${aku.ringkas.lewat ? ` · ${aku.ringkas.lewat} kedaluwarsa` : ""}${aku.ringkas.dekat ? ` · ${aku.ringkas.dekat} mendekati` : ""}`
                : "Belum pernah diisi — isi sekarang"}
            </span>
          </span>
          <span className="shrink-0 text-lg text-white/70">›</span>
        </Link>
      )}

      {kabar && (
        <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800 ring-1 ring-emerald-200">{kabar}</p>
      )}
      {galat && (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-800 ring-1 ring-rose-200">{galat}</p>
      )}

      {/* dua golongan, dua daftar — bukan satu tumpukan yang harus dipilah mata */}
      <div className="mb-3 flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        {([["permintaan", "Permintaan", permintaan.length], ["laporan", "Laporan", laporan.length]] as const).map(([id, l, n]) => (
          <button key={id} onClick={() => setRupa(id)}
            className={`flex-1 rounded-lg py-2 text-[12.5px] font-bold transition ${
              rupa === id ? "bg-[#16357f] text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300"}`}>
            {l} <span className={rupa === id ? "text-white/70" : "text-slate-400"}>({n})</span>
          </button>
        ))}
      </div>

      {muat ? (
        <p className="rounded-2xl bg-white px-4 py-10 text-center text-[13px] text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900">Memuat…</p>
      ) : !tampil.length ? (
        <div className="rounded-2xl bg-white px-4 py-12 text-center ring-1 ring-slate-200 dark:bg-slate-900">
          <p className="text-2xl">📭</p>
          <p className="mt-2 text-[13px] font-bold text-slate-700 dark:text-slate-200">Belum ada {rupa} tercatat.</p>
          <p className="mt-0.5 text-[11.5px] text-slate-500">Kirim lewat menu Kirim berkas di bawah.</p>
          <Link href="/portal/kirim" className="mt-3 inline-block rounded-xl bg-[#16357f] px-4 py-2 text-[12.5px] font-bold text-white">
            Kirim berkas pertama
          </Link>
        </div>
      ) : (
        periodeUrut.map((per) => (
          <section key={per} className="mb-4">
            {/* pemisah bulan: nama bulannya sendiri, bukan sekadar garis */}
            <h2 className="mb-1.5 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              {per === "tanpa-periode" ? "Tanpa periode" : bulanIndo(per)}
              <span className="ml-2 font-bold normal-case tracking-normal text-slate-400">
                {kelompok.get(per)!.length} kiriman
              </span>
            </h2>

            <ul className="space-y-2">
              {kelompok.get(per)!.map((b) => {
                const nada = NADA_STATUS[b.status] || NADA_STATUS.baru;
                const terakhirDorong = b.dorongan[b.dorongan.length - 1];
                return (
                  <li key={b.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                    {/* baris judul: borang, keadaan, waktu — tiga hal yang dibaca lebih dulu */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-100 px-3.5 py-2.5 dark:border-slate-800">
                      <span className="text-[14px] font-black text-slate-900 dark:text-white">
                        {JENIS_LABEL[b.jenis] || b.jenis}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-black ring-1 ${nada.kelas}`}>{nada.label}</span>
                      <span className="ml-auto text-[11px] text-slate-500">{waktu(b.dikirimPada)}</span>
                    </div>

                    <div className="px-3.5 py-2.5">
                      <p className="text-[11.5px] text-slate-500">
                        {nada.arti}
                        {b.pengirim ? ` · dikirim oleh ${b.pengirim}` : ""}
                      </p>

                      {!b.berkas.length ? (
                        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11.5px] font-semibold text-amber-900 ring-1 ring-amber-200">
                          Kiriman ini tercatat tanpa berkas — unggahannya terputus. Kirim ulang berkasnya.
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {b.berkas.map((f) => (
                            <li key={f.fileId} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/60">
                              <span className="shrink-0 text-[13px]">📄</span>
                              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200" title={f.nama}>
                                {judulBerkas(f.nama)}
                              </span>
                              <a href={`/api/lapor/isi?fileId=${encodeURIComponent(f.fileId)}`} target="_blank" rel="noreferrer"
                                className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-[#16357f] ring-1 ring-slate-300 transition hover:bg-slate-100 dark:bg-slate-900 dark:ring-slate-600">
                                Lihat
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}

                      {terakhirDorong && (
                        <p className="mt-2 rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-800 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300">
                          🔔 Pengingat terkirim {waktu(terakhirDorong.pada)}
                          {terakhirDorong.pesan ? ` — "${terakhirDorong.pesan}"` : ""}
                        </p>
                      )}

                      {/*
                        Hanya PERMINTAAN yang bisa ditagih. Laporan selesai
                        tugasnya begitu sampai di kantor; tombol yang menagih
                        sesuatu yang memang tidak dikerjakan siapa pun hanya
                        melemahkan tagihan yang sungguhan.
                      */}
                      {b.jenis.startsWith("permintaan") && b.status !== "selesai" && (
                        dorong?.id === b.id ? (
                          <div className="mt-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                            <textarea value={dorong.pesan} onChange={(e) => setDorong({ id: b.id, pesan: e.target.value })}
                              rows={2} placeholder="Mis. mohon diproses, filter tinggal 1 dan kapal jalan terus."
                              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[12.5px] outline-none focus:border-[#16357f] dark:border-slate-600 dark:bg-slate-900" />
                            <div className="mt-2 flex gap-2">
                              <button onClick={() => void kirimDorongan(b.id, dorong.pesan)} disabled={sibuk === b.id}
                                className="rounded-lg bg-[#16357f] px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">
                                {sibuk === b.id ? "Mengirim…" : "Kirim pengingat"}
                              </button>
                              <button onClick={() => setDorong(null)}
                                className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-slate-500">Batal</button>
                            </div>
                          </div>
                        ) : (
                          /* tombol kecil di sudut: keadaannya lebih sering dibaca daripada tombolnya ditekan */
                          <div className="mt-2 flex justify-end">
                            <button onClick={() => setDorong({ id: b.id, pesan: "" })}
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11.5px] font-bold text-slate-600 transition hover:border-[#16357f] hover:bg-[#16357f] hover:text-white dark:border-slate-600 dark:text-slate-300">
                              🔔 Ingatkan kantor
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </RangkaPortal>
  );
}
