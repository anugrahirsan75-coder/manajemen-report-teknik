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

  const belumSelesai = baris.filter((b) => b.status !== "selesai").length;

  return (
    <RangkaPortal aku={aku}>
      {/* ── ringkasan ─────────────────────────────────────────────────── */}
      <section className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Kiriman saya</p>
          <p className="mt-0.5 text-3xl font-black tabular-nums text-slate-900 dark:text-white">{baris.length}</p>
          <p className="text-[11px] text-slate-500">sepanjang tercatat</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Belum selesai</p>
          <p className={`mt-0.5 text-3xl font-black tabular-nums ${belumSelesai ? "text-amber-600" : "text-emerald-600"}`}>{belumSelesai}</p>
          <p className="text-[11px] text-slate-500">masih diurus kantor</p>
        </div>
      </section>

      {/* ── pintasan ke borang bagiannya ──────────────────────────────── */}
      {aku && (
        <Link href={aku.bagian === "mesin" ? "/portal/stok" : "/portal/alkes"}
          className="mb-4 flex items-center gap-3 rounded-2xl bg-[#16357f] px-4 py-3 text-white shadow-sm transition hover:bg-[#12296a]">
          <span className="text-2xl">{aku.bagian === "mesin" ? "⚙️" : "🩺"}</span>
          <span className="flex-1">
            <span className="block text-[14px] font-bold">
              {aku.bagian === "mesin" ? "Stok Filter & jam kerja mesin" : "Alat Kesehatan kapal"}
            </span>
            <span className="block text-[11.5px] text-white/75">
              {aku.ringkas
                ? aku.bagian === "mesin"
                  ? `${aku.ringkas.baris} jenis tercatat${aku.ringkas.menipis ? ` · ${aku.ringkas.menipis} menipis` : ""}`
                  : `${aku.ringkas.baris} butir tercatat${aku.ringkas.lewat ? ` · ${aku.ringkas.lewat} kedaluwarsa` : ""}${aku.ringkas.dekat ? ` · ${aku.ringkas.dekat} mendekati` : ""}`
                : "Belum pernah diisi — isi sekarang"}
            </span>
          </span>
          <span className="text-lg">›</span>
        </Link>
      )}

      {kabar && (
        <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800 ring-1 ring-emerald-200">{kabar}</p>
      )}
      {galat && (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-800 ring-1 ring-rose-200">{galat}</p>
      )}

      {/* ── riwayat kiriman ───────────────────────────────────────────── */}
      <h2 className="mb-2 px-1 text-[13px] font-black text-slate-800 dark:text-slate-100">Kiriman saya ke kantor</h2>

      {muat ? (
        <p className="rounded-2xl bg-white px-4 py-10 text-center text-[13px] text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900">Memuat…</p>
      ) : !baris.length ? (
        <div className="rounded-2xl bg-white px-4 py-10 text-center ring-1 ring-slate-200 dark:bg-slate-900">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Belum ada kiriman tercatat.</p>
          <Link href="/portal/kirim" className="mt-3 inline-block rounded-xl bg-[#16357f] px-4 py-2 text-[12.5px] font-bold text-white">
            Kirim berkas pertama
          </Link>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {baris.map((b) => {
            const nada = NADA_STATUS[b.status] || NADA_STATUS.baru;
            const sudahDorong = b.dorongan.length > 0;
            return (
              <li key={b.id} className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-black text-slate-900 dark:text-white">{JENIS_LABEL[b.jenis] || b.jenis}</span>
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {bulanIndo(b.periode)}
                  </span>
                  <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${nada.kelas}`}>{nada.label}</span>
                </div>

                <p className="mt-1 text-[11.5px] text-slate-500">
                  Dikirim {waktu(b.dikirimPada)} · {b.berkas.length} berkas
                  {b.pengirim ? ` · oleh ${b.pengirim}` : ""}
                </p>

                {!!b.berkas.length && (
                  <ul className="mt-2 space-y-1">
                    {b.berkas.map((f) => (
                      <li key={f.fileId} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/60">
                        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200">{f.nama}</span>
                        {/* berkasnya sendiri boleh dibuka kapal — ini dokumen mereka */}
                        <a href={`/api/lapor/isi?fileId=${encodeURIComponent(f.fileId)}`} target="_blank" rel="noreferrer"
                          className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-[#16357f] ring-1 ring-slate-300 transition hover:bg-slate-100">
                          Lihat
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                {!b.berkas.length && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11.5px] font-semibold text-amber-900 ring-1 ring-amber-200">
                    Kiriman ini tercatat tanpa berkas — unggahannya terputus di tengah jalan. Kirim ulang berkasnya.
                  </p>
                )}

                <p className="mt-2 text-[11px] text-slate-500">{nada.arti}</p>

                {sudahDorong && (
                  <p className="mt-1.5 rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-800 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300">
                    Pengingat sudah dikirim {waktu(b.dorongan[b.dorongan.length - 1].pada)}
                    {b.dorongan[b.dorongan.length - 1].pesan ? ` — "${b.dorongan[b.dorongan.length - 1].pesan}"` : ""}
                  </p>
                )}

                {b.status !== "selesai" && (
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
                    <button onClick={() => setDorong({ id: b.id, pesan: "" })}
                      className="mt-2 w-full rounded-xl border border-[#16357f]/30 py-2 text-[12.5px] font-bold text-[#16357f] transition hover:bg-[#16357f] hover:text-white dark:border-sky-700 dark:text-sky-300">
                      🔔 Ingatkan kantor
                    </button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </RangkaPortal>
  );
}
