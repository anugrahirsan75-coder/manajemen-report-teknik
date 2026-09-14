"use client";
/**
 * Borang kepala surat — dipakai HANYA saat mencetak konsep surat jadi PDF.
 *
 * Untuk menempel ke e-office bagian ini tidak perlu diisi: nomor, tanggal,
 * tujuan, tanda tangan, dan tembusan dibuatkan sendiri oleh aplikasinya. Jadi
 * panel ini bisa dibiarkan terlipat, dan tidak satu pun isiannya menghalangi
 * tombol Salin.
 *
 * Perihal dan tujuan sengaja BOLEH KOSONG. Kosong berarti "ikut template", dan
 * nilainya tampil sebagai teks bayangan di kotak isian. Kalau nilai itu
 * disalin ke dalam isian begitu template diganti, perihal yang sudah disunting
 * pengguna akan tertimpa tiap kali ia berpindah jenis surat.
 */
import { PENANDA_TANGAN, KODE_SURAT, TEMBUSAN_SERING, URUT_KOSONG, susunNomor } from "@/lib/surat/kop";

export interface DataKop {
  kode: string;
  urut: string;
  tanggal: string;
  perihal: string;
  jabatan: string;
  kota: string;
  namaPenanda: string;
  jabatanPenanda: string;
  tembusan: string;
  qrKonsep: boolean;
}

export const kopAwal = (): DataKop => ({
  kode: "TN.101",
  urut: "",
  tanggal: new Date().toISOString().slice(0, 10),
  perihal: "",
  jabatan: "",
  kota: "",
  namaPenanda: PENANDA_TANGAN[0].nama,
  jabatanPenanda: PENANDA_TANGAN[0].jabatan,
  tembusan: "",
  qrKonsep: true,
});

const KELAS = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const LABEL = "mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200";

export default function DataKopSurat({ kop, ubah, bayanganPerihal, bayanganJabatan, bayanganKota }: {
  kop: DataKop;
  ubah: (bagian: Partial<DataKop>) => void;
  bayanganPerihal: string;
  bayanganJabatan: string;
  bayanganKota: string;
}) {
  const nomor = susunNomor(kop.kode, kop.urut, kop.tanggal);
  const diLuarDaftar = !PENANDA_TANGAN.some((p) => p.nama === kop.namaPenanda);

  const tambahTembusan = (t: string) => {
    const ada = kop.tembusan.split("\n").map((x) => x.trim()).filter(Boolean);
    if (ada.includes(t)) return;
    ubah({ tembusan: [...ada, t].join("\n") });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700">
        Isian di bawah ini hanya dipakai tombol <b>Unduh PDF</b>. Untuk menempel ke e-office
        semuanya boleh dibiarkan kosong — nomor, tanggal, tujuan, dan tanda tangan diurus e-office sendiri.
      </div>

      <div>
        <label className={LABEL}>Kode surat</label>
        <input list="kode-surat" value={kop.kode} onChange={(e) => ubah({ kode: e.target.value })} className={KELAS} />
        <datalist id="kode-surat">{KODE_SURAT.map((k) => <option key={k} value={k} />)}</datalist>
      </div>

      <div>
        <label className={LABEL}>Nomor urut (4 angka)</label>
        <input value={kop.urut} inputMode="numeric" placeholder={`kosongkan → ${URUT_KOSONG}`}
          onChange={(e) => ubah({ urut: e.target.value.replace(/\D/g, "").slice(0, 5) })} className={KELAS} />
        <p className="mt-1 text-[11px] text-slate-400">
          Dikosongkan berarti nomornya dicetak sebagai titik-titik, seperti surat konsep — tinggal ditulis tangan.
        </p>
      </div>

      <div className="sm:col-span-2 rounded-xl bg-slate-900 px-3 py-2 font-mono text-xs text-sky-200 dark:bg-slate-800">
        {nomor}
      </div>

      <div>
        <label className={LABEL}>Tanggal surat</label>
        <input type="date" value={kop.tanggal} onChange={(e) => ubah({ tanggal: e.target.value })} className={KELAS} />
        <p className="mt-1 text-[11px] text-slate-400">Bulan romawi pada nomor diambil dari tanggal ini.</p>
      </div>

      <div>
        <label className={LABEL}>Penanda tangan</label>
        <select value={diLuarDaftar ? "__lain" : kop.namaPenanda}
          onChange={(e) => {
            if (e.target.value === "__lain") { ubah({ namaPenanda: " ", jabatanPenanda: "" }); return; }
            const p = PENANDA_TANGAN.find((x) => x.nama === e.target.value)!;
            ubah({ namaPenanda: p.nama, jabatanPenanda: p.jabatan });
          }}
          className={KELAS}>
          {PENANDA_TANGAN.map((p) => <option key={p.nama} value={p.nama}>{p.nama} — {p.jabatan}</option>)}
          <option value="__lain">Lainnya…</option>
        </select>
        {diLuarDaftar && (
          <div className="mt-1.5 grid gap-1.5">
            <input value={kop.namaPenanda} onChange={(e) => ubah({ namaPenanda: e.target.value })}
              placeholder="Nama penanda tangan" className={KELAS} autoFocus />
            <input value={kop.jabatanPenanda} onChange={(e) => ubah({ jabatanPenanda: e.target.value })}
              placeholder="Jabatan" className={KELAS} />
          </div>
        )}
        <p className="mt-1 text-[11px] text-slate-400">
          Yang dicetak hanya nama dan jabatan. QR tanda tangan terbit dari e-office saat surat disahkan.
        </p>
      </div>

      <div className="sm:col-span-2">
        <label className={LABEL}>Perihal</label>
        <textarea value={kop.perihal} rows={2} placeholder={bayanganPerihal}
          onChange={(e) => ubah({ perihal: e.target.value })} className={KELAS} />
        <p className="mt-1 text-[11px] text-slate-400">Dikosongkan berarti memakai perihal bawaan template (teks abu-abu di atas).</p>
      </div>

      <div>
        <label className={LABEL}>Tujuan (jabatan)</label>
        <input value={kop.jabatan} placeholder={bayanganJabatan}
          onChange={(e) => ubah({ jabatan: e.target.value })} className={KELAS} />
      </div>

      <div>
        <label className={LABEL}>Kota tujuan</label>
        <input value={kop.kota} placeholder={bayanganKota}
          onChange={(e) => ubah({ kota: e.target.value })} className={KELAS} />
      </div>

      <div className="sm:col-span-2">
        <label className={LABEL}>Tembusan</label>
        <textarea value={kop.tembusan} rows={3} placeholder="Satu penerima per baris. Kosongkan bila surat tanpa tembusan."
          onChange={(e) => ubah({ tembusan: e.target.value })} className={KELAS} />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {TEMBUSAN_SERING.map((t) => (
            <button key={t} type="button" onClick={() => tambahTembusan(t)}
              className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
              + {t}
            </button>
          ))}
        </div>
      </div>

      <label className="sm:col-span-2 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <input type="checkbox" checked={kop.qrKonsep !== false} onChange={(e) => ubah({ qrKonsep: e.target.checked })} className="mt-0.5" />
        <span className="text-slate-700 dark:text-slate-200">
          Bubuhkan QR konsep di ruang tanda tangan
          <span className="block text-[11px] text-slate-400">
            Memuat nomor surat, perihal, tanggal penyusunan, dan kepada siapa surat akan dimintakan
            tanda tangan — diberi keterangan <b>belum disahkan</b>. Ini penanda berkas konsep, bukan
            tanda tangan elektronik: QR pengesahan terbit dari e-office saat pejabatnya menyetujui.
          </span>
        </span>
      </label>

    </div>
  );
}
