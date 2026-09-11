"use client";
/**
 * Penampil berkas dokumen kapal.
 *
 * Sebelumnya tiap berkas dibuka sebagai tab baru. Untuk memeriksa satu berita
 * acara berisi empat lampiran, orang kantor membuka empat tab, menutupnya satu
 * per satu, lalu kehilangan tempatnya di daftar. Padahal pekerjaannya bukan
 * "buka berkas", melainkan "periksa dokumen ini" — dan berkas-berkasnya satu
 * kesatuan.
 *
 * PDF dan gambar ditampilkan langsung. Yang lain ditawarkan diunduh: memaksa
 * peramban menggambar .docx hanya akan menghasilkan layar kosong yang tampak
 * seperti berkas rusak.
 */
import { useCallback, useEffect, useState } from "react";

export interface BerkasLihat { nama: string; ukuran: number; fileId: string }

const ukuranRamah = (b: number) =>
  !b ? "" : b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

const tatapan = (nama: string) => {
  const e = (nama.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
  if (e === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(e)) return "gambar";
  return "lain";
};

export const ikonBerkas = (nama: string) => {
  const e = (nama.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
  if (e === "pdf") return "📕";
  if (["xls", "xlsx", "csv"].includes(e)) return "📗";
  if (["doc", "docx"].includes(e)) return "📘";
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(e)) return "🖼️";
  return "📄";
};

export default function PenampilDokumen({ judul, kapal, golongan, berkas, mulai = 0, onTutup }: {
  judul: string; kapal: string; golongan: string;
  berkas: BerkasLihat[]; mulai?: number; onTutup: () => void;
}) {
  const [ke, setKe] = useState(Math.min(Math.max(0, mulai), Math.max(0, berkas.length - 1)));
  const [muat, setMuat] = useState(true);
  const f = berkas[ke];
  const alamat = f ? `/api/lapor/isi?fileId=${encodeURIComponent(f.fileId)}` : "";
  const rupa = f ? tatapan(f.nama) : "lain";

  const geser = useCallback((arah: number) => {
    setKe((n) => {
      const baru = Math.min(berkas.length - 1, Math.max(0, n + arah));
      if (baru !== n) setMuat(true);
      return baru;
    });
  }, [berkas.length]);

  /* halaman di belakang dikunci: menggulir daftar yang tidak terlihat membuat
     orang kehilangan tempatnya begitu penampil ditutup */
  useEffect(() => {
    const semula = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = semula; };
  }, []);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
      if (e.key === "ArrowRight") geser(1);
      if (e.key === "ArrowLeft") geser(-1);
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [geser, onTutup]);

  if (!f) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-900/90 backdrop-blur-sm" onMouseDown={onTutup}>
      {/* kepala */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-white" onMouseDown={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold" title={judul}>{judul}</p>
          <p className="truncate text-[11.5px] text-white/60">{kapal} · {golongan} · {f.nama}{f.ukuran ? ` · ${ukuranRamah(f.ukuran)}` : ""}</p>
        </div>
        <a href={alamat} download={f.nama}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-white/20">
          ⬇️ Unduh
        </a>
        <a href={alamat} target="_blank" rel="noreferrer"
          className="rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-white/20">
          ↗ Tab baru
        </a>
        <button onClick={onTutup} className="rounded-lg px-2.5 py-1 text-xl leading-none text-white/70 hover:bg-white/10 hover:text-white">✕</button>
      </div>

      {/* isi */}
      <div className="relative flex-1 overflow-hidden px-3 pb-3" onMouseDown={(e) => e.stopPropagation()}>
        <div className="relative h-full w-full overflow-hidden rounded-2xl bg-white dark:bg-slate-950">
          {muat && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white/80 dark:bg-slate-950/80">
              <p className="text-[13px] font-semibold text-slate-500">
                Mengambil berkas dari Google Drive…
                <span className="mt-1 block text-[11.5px] font-normal text-slate-400">berkas besar bisa perlu beberapa detik</span>
              </p>
            </div>
          )}
          {rupa === "pdf" && (
            /* iframe, bukan <embed>: peramban yang tak punya penampil PDF bawaan
               tetap menawarkan unduhan alih-alih menampilkan kotak kosong */
            <iframe src={alamat} title={f.nama} className="h-full w-full" onLoad={() => setMuat(false)} />
          )}
          {rupa === "gambar" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={alamat} alt={f.nama} onLoad={() => setMuat(false)} onError={() => setMuat(false)}
              className="mx-auto h-full w-auto max-w-full object-contain" />
          )}
          {rupa === "lain" && (
            <div className="grid h-full place-items-center px-6 text-center">
              <div>
                <p className="text-5xl">{ikonBerkas(f.nama)}</p>
                <p className="mt-3 text-[14px] font-bold text-slate-800 dark:text-slate-100">{f.nama}</p>
                <p className="mt-1 text-[12px] text-slate-500">Jenis berkas ini tidak bisa ditampilkan di peramban.</p>
                <a href={alamat} download={f.nama}
                  className="mt-4 inline-block rounded-xl bg-[#16357f] px-5 py-2.5 text-[13px] font-bold text-white hover:bg-[#12296a]">
                  ⬇️ Unduh berkas
                </a>
              </div>
            </div>
          )}
        </div>

        {berkas.length > 1 && (
          <>
            <button onClick={() => geser(-1)} disabled={ke === 0} aria-label="Berkas sebelumnya"
              className="absolute left-6 top-1/2 -translate-y-1/2 rounded-full bg-slate-900/70 px-3 py-4 text-xl text-white transition hover:bg-slate-900 disabled:opacity-20">‹</button>
            <button onClick={() => geser(1)} disabled={ke === berkas.length - 1} aria-label="Berkas berikutnya"
              className="absolute right-6 top-1/2 -translate-y-1/2 rounded-full bg-slate-900/70 px-3 py-4 text-xl text-white transition hover:bg-slate-900 disabled:opacity-20">›</button>
          </>
        )}
      </div>

      {/* deretan berkas dalam satu dokumen */}
      {berkas.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto px-4 pb-3" onMouseDown={(e) => e.stopPropagation()}>
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-white/50">
            {ke + 1}/{berkas.length}
          </span>
          {berkas.map((b, i) => (
            <button key={b.fileId} onClick={() => { setKe(i); setMuat(true); }} title={b.nama}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition ${
                i === ke ? "bg-white text-slate-900" : "bg-white/10 text-white/70 hover:bg-white/20"}`}>
              <span>{ikonBerkas(b.nama)}</span>
              <span className="max-w-[10rem] truncate">{b.nama.replace(/\.[a-z0-9]+$/i, "")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
