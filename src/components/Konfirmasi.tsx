"use client";
/**
 * Dialog konfirmasi milik aplikasi — pengganti window.confirm() bawaan browser.
 *
 * Alasan diganti: confirm() bawaan tampil sebagai kotak abu-abu polos bertuliskan
 * alamat situs, tidak bisa diberi rincian, tidak membedakan mana tindakan yang
 * merusak dan mana yang biasa. Di sini: ada nada warna, ikon, rincian, dan
 * penegasan untuk tindakan yang tak bisa dibatalkan.
 *
 * Pemakaian (tetap semudah confirm, karena mengembalikan Promise<boolean>):
 *
 *   const { konfirmasi, dialogKonfirmasi } = useKonfirmasi();
 *   if (!(await konfirmasi({ judul: "Hapus?", pesan: "...", nada: "bahaya" }))) return;
 *   ...
 *   return (<>{isi}{dialogKonfirmasi}</>);
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type NadaKonfirmasi = "bahaya" | "perhatian" | "sukses" | "biasa";

export interface OpsiKonfirmasi {
  judul: string;
  pesan?: string;
  /** baris rincian (mis. daftar yang akan dibuang) — tampil di kotak terpisah */
  rincian?: string[];
  /** kalimat penegasan, dicetak tebal di bawah pesan (mis. "tidak bisa dikembalikan") */
  tegasan?: string;
  tombolYa?: string;
  tombolTidak?: string;
  nada?: NadaKonfirmasi;
  ikon?: string;
}

const NADA: Record<NadaKonfirmasi, {
  ikon: string; lingkar: string; garis: string; tombol: string;
  kotak: string; tegas: string; fokusBatal: boolean;
}> = {
  bahaya: {
    ikon: "🗑️", lingkar: "from-rose-500 to-red-600", garis: "bg-gradient-to-r from-rose-500 to-red-600",
    tombol: "btn-rose", kotak: "bg-rose-50 ring-rose-200 text-rose-900", tegas: "text-rose-700",
    fokusBatal: true,   // tindakan merusak: yang aman yang disorot lebih dulu
  },
  perhatian: {
    ikon: "⚠️", lingkar: "from-amber-400 to-orange-500", garis: "bg-gradient-to-r from-amber-400 to-orange-500",
    tombol: "btn-primary", kotak: "bg-amber-50 ring-amber-200 text-amber-900", tegas: "text-amber-700",
    fokusBatal: false,
  },
  sukses: {
    ikon: "🔒", lingkar: "from-emerald-500 to-teal-600", garis: "bg-gradient-to-r from-emerald-500 to-teal-600",
    tombol: "btn-success", kotak: "bg-emerald-50 ring-emerald-200 text-emerald-900", tegas: "text-emerald-700",
    fokusBatal: false,
  },
  biasa: {
    ikon: "❓", lingkar: "from-[#1ca3dd] to-[#16357f]", garis: "asdp-gradient",
    tombol: "btn-primary", kotak: "bg-sky-50 ring-sky-200 text-slate-800", tegas: "text-slate-800",
    fokusBatal: false,
  },
};

/** dipakai internal: satu antrean untuk seluruh aplikasi */
interface Antrean extends OpsiKonfirmasi { hanyaOk?: boolean; res: (ya: boolean) => void }
let dorong: ((a: Antrean) => void) | null = null;

/**
 * Tanya ya/tidak. Bisa dipanggil dari mana saja (termasuk file store non-React),
 * tanpa hook. Kalau penyedia belum terpasang (SSR / dipanggil terlalu awal),
 * jatuh ke confirm() bawaan supaya alur tetap jalan.
 */
export function konfirmasi(o: OpsiKonfirmasi | string): Promise<boolean> {
  const opsi: OpsiKonfirmasi = typeof o === "string" ? { judul: o } : o;
  if (!dorong) {
    if (typeof window === "undefined") return Promise.resolve(false);
    return Promise.resolve(window.confirm([opsi.judul, opsi.pesan, ...(opsi.rincian || []), opsi.tegasan].filter(Boolean).join("\n")));
  }
  return new Promise<boolean>((res) => dorong!({ ...opsi, res }));
}

/**
 * Beri tahu saja (pengganti alert): satu tombol, tak ada pilihan.
 * Bentuk singkat: beritahu("Gagal simpan: ...") — otomatis bernada bahaya
 * kalau kalimatnya menyebut gagal/error.
 */
export function beritahu(o: OpsiKonfirmasi | string): Promise<void> {
  let opsi: OpsiKonfirmasi;
  if (typeof o === "string") {
    const teks = o.trim();
    const buruk = /gagal|error|tidak bisa|tak bisa|belum|salah|kosong|wajib|minimal/i.test(teks);
    // baris pertama jadi judul kalau pesannya panjang & bertingkat
    const baris = teks.split("\n");
    const judul = baris.length > 1 && baris[0].length <= 90 ? baris[0].replace(/[:：]\s*$/, "") : teks.slice(0, 90);
    opsi = baris.length > 1 && baris[0].length <= 90
      ? { judul, pesan: baris.slice(1).join("\n").trim() || undefined, nada: buruk ? "perhatian" : "biasa" }
      : { judul: teks, nada: buruk ? "perhatian" : "biasa" };
  } else opsi = o;

  if (!dorong) {
    if (typeof window !== "undefined") window.alert([opsi.judul, opsi.pesan, ...(opsi.rincian || []), opsi.tegasan].filter(Boolean).join("\n"));
    return Promise.resolve();
  }
  return new Promise<void>((res) => dorong!({ ...opsi, hanyaOk: true, res: () => res() }));
}

/** Pasang SEKALI di layout — menyediakan dialog untuk seluruh halaman & store. */
export function PenyediaDialog() {
  const [antre, setAntre] = useState<Antrean[]>([]);
  useEffect(() => {
    dorong = (a) => setAntre((q) => [...q, a]);
    return () => { dorong = null; };
  }, []);
  const kini = antre[0];
  const tutup = useCallback((ya: boolean) => {
    setAntre((q) => { q[0]?.res(ya); return q.slice(1); });
  }, []);
  return kini ? <DialogKonfirmasi opsi={kini} hanyaOk={kini.hanyaOk} onJawab={tutup} /> : null;
}

/** Bentuk lama (berbasis hook) — tetap ada supaya pemakaian yang sudah jalan tak perlu diubah. */
export function useKonfirmasi() {
  return { konfirmasi, beritahu, dialogKonfirmasi: null as React.ReactNode };
}

function DialogKonfirmasi({ opsi, onJawab, hanyaOk }: { opsi: OpsiKonfirmasi; onJawab: (ya: boolean) => void; hanyaOk?: boolean }) {
  const n = NADA[opsi.nada || "biasa"];
  const yaRef = useRef<HTMLButtonElement>(null);
  const tidakRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    (n.fokusBatal ? tidakRef : yaRef).current?.focus();
    const tombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onJawab(false); }
      // Enter hanya untuk yang tidak merusak — tindakan bahaya harus benar-benar diklik
      if (e.key === "Enter" && !n.fokusBatal) { e.preventDefault(); onJawab(true); }
    };
    document.addEventListener("keydown", tombol);
    const semula = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", tombol); document.body.style.overflow = semula; };
  }, [n.fokusBatal, onJawab]);

  const isi = (
    <div className="fixed inset-0 z-[150] grid place-items-center p-4 bg-slate-900/55 backdrop-blur-[2px]"
      onMouseDown={() => onJawab(false)} role="dialog" aria-modal="true" aria-label={opsi.judul}>
      <div onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl elev-lg overflow-hidden ring-1 ring-black/5"
        style={{ animation: "popIn 0.16s ease-out both" }}>
        {/* pita warna: nada tindakan terbaca sebelum teksnya dibaca */}
        <div className={`h-1.5 ${n.garis}`} />

        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start gap-3.5">
            <div className={`h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br ${n.lingkar} grid place-items-center text-xl shadow-md`}>
              {opsi.ikon || n.ikon}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="font-extrabold text-slate-800 leading-snug">{opsi.judul}</h3>
              {opsi.pesan && <p className="text-sm text-slate-600 mt-1.5 whitespace-pre-line leading-relaxed">{opsi.pesan}</p>}
            </div>
          </div>

          {opsi.rincian && opsi.rincian.length > 0 && (
            <ul className={`mt-3.5 rounded-xl ring-1 px-3.5 py-2.5 text-xs space-y-1 max-h-48 overflow-auto ${n.kotak}`}>
              {opsi.rincian.map((r, i) => (
                <li key={i} className="flex gap-2 leading-relaxed">
                  <span className="opacity-50 shrink-0">•</span><span className="min-w-0">{r}</span>
                </li>
              ))}
            </ul>
          )}

          {opsi.tegasan && (
            <p className={`mt-3.5 text-xs font-bold ${n.tegas} flex items-start gap-1.5`}>
              <span className="shrink-0">↳</span>{opsi.tegasan}
            </p>
          )}
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button ref={tidakRef} onClick={() => onJawab(false)} className="btn btn-ghost text-sm">
            {opsi.tombolTidak || "Batal"}
          </button>
          <button ref={yaRef} onClick={() => onJawab(true)} className={`btn ${n.tombol} text-sm px-5`}>
            {opsi.tombolYa || "Lanjutkan"}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(isi, document.body) : null;
}
