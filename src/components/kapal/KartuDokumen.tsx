"use client";
/**
 * Satu dokumen kapal sebagai kartu.
 *
 * Bentuk sebelumnya baris tipis berisi judul dan beberapa tautan kecil. Yang
 * dicari orang kantor saat membuka arsip bukan judulnya saja, melainkan
 * gabungan: golongan apa, tanggal berapa, nomor suratnya, dan berapa lampiran —
 * dan semuanya harus terbaca sekaligus, tanpa mengarahkan tetikus ke mana pun.
 */
import { BerkasLihat, ikonBerkas } from "./PenampilDokumen";
import { jenisDokumen } from "@/lib/portal/dokumen";

export interface DokumenTampil {
  id: string; jenis: string; judul: string; tanggal: string; nomor: string;
  catatan: string; olehAkun: string; dibuatPada: string; berkas: BerkasLihat[];
}

const BULAN = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const tglIndo = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "—";
  const [y, m, d] = iso.split("-");
  return `${+d} ${BULAN[+m]} ${y}`;
};
const ukuranRamah = (b: number) =>
  !b ? "" : b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

/** dari sisi mana dokumen ini masuk — kapal atau kantor */
export const asalDokumen = (oleh: string) => (/^kantor/i.test(oleh || "") ? "Kantor" : oleh ? "Kapal" : "—");

export default function KartuDokumen({ d, onLihat, onHapus }: {
  d: DokumenTampil;
  onLihat: (d: DokumenTampil, ke: number) => void;
  onHapus?: (d: DokumenTampil) => void;
}) {
  const j = jenisDokumen(d.jenis);
  const kantor = asalDokumen(d.olehAkun) === "Kantor";

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 transition hover:ring-[#16357f]/40 dark:bg-slate-900 dark:ring-slate-700">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pt-2.5">
        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-black ring-1 ${j?.warna || "bg-slate-100 text-slate-700 ring-slate-200"}`}>
          {j?.ikon} {j?.label || d.jenis}
        </span>
        <span className="text-[11.5px] font-bold text-slate-500">{tglIndo(d.tanggal)}</span>
        <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          kantor ? "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
          {kantor ? "kantor" : "kapal"}
        </span>
      </div>

      <div className="px-3 pb-2 pt-1.5">
        <h4 className="text-[13.5px] font-bold leading-snug text-slate-900 dark:text-white">{d.judul}</h4>
        {d.nomor && <p className="mt-0.5 font-mono text-[11px] text-slate-500">{d.nomor}</p>}
        {d.catatan && <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-slate-600 dark:text-slate-300" title={d.catatan}>{d.catatan}</p>}
      </div>

      <div className="mt-auto border-t border-slate-100 px-3 py-2 dark:border-slate-800">
        {!d.berkas.length ? (
          <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800">
            Unggahan terputus — berkasnya belum sampai
          </p>
        ) : (
          <ul className="space-y-1">
            {d.berkas.map((f, i) => (
              <li key={f.fileId}>
                {/* satu tombol untuk seluruh baris: sasaran klik selebar kartu
                    jauh lebih mudah dikenai daripada tautan setinggi satu baris */}
                <button onClick={() => onLihat(d, i)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800">
                  <span className="shrink-0 text-[15px]">{ikonBerkas(f.nama)}</span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-slate-700 dark:text-slate-200" title={f.nama}>
                    {f.nama.replace(/\.[a-z0-9]+$/i, "")}
                  </span>
                  <span className="shrink-0 text-[10.5px] text-slate-400">{ukuranRamah(f.ukuran)}</span>
                  <span className="shrink-0 text-[11px] font-bold text-[#16357f] opacity-0 transition group-hover:opacity-100 dark:text-sky-300">Lihat</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-1.5 flex items-center gap-2 border-t border-slate-100 pt-1.5 dark:border-slate-800">
          <span className="truncate text-[10.5px] text-slate-400" title={d.olehAkun}>
            diunggah {d.olehAkun || "—"}
          </span>
          {onHapus && (
            <button onClick={() => onHapus(d)}
              className="ml-auto shrink-0 text-[10.5px] font-bold text-slate-400 transition hover:text-rose-600">
              Hapus catatan
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
