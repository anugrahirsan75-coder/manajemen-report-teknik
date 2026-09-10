"use client";
/**
 * Unggah Dokumen Kapal dari meja KANTOR.
 *
 * Berita acara, temuan Marine Superintendent, salinan sertifikat yang baru
 * diperpanjang — semuanya sering sampai ke kantor lebih dulu, lewat surel atau
 * WhatsApp. Sebelum ada layar ini, satu-satunya jalan masuk arsip adalah
 * meminta awak mengunggah ulang dari kapal, dan permintaan itu sering tidak
 * pernah dikerjakan.
 *
 * Berkasnya menempuh jalur potongan yang sama dengan unggahan kapal, dan
 * mendarat di folder Drive yang sama persis. Satu arsip, satu cara mencarinya,
 * apa pun pintu masuknya.
 */
import { useEffect, useRef, useState } from "react";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { JENIS_DOKUMEN, jenisDokumen } from "@/lib/portal/dokumen";
import { pesanRamah, unggahSatuBerkas, type Kemajuan } from "@/lib/lapor/unggahBerkas";

const ukuran = (b: number) =>
  b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

export default function UnggahDokumenKantor({ kapalAwal, onTutup, onSelesai }: {
  /** kapal yang sudah terpilih saat borang dibuka dari baris kapal tertentu */
  kapalAwal?: string;
  onTutup: () => void;
  onSelesai: (pesan: string) => void;
}) {
  const [kapal, setKapal] = useState(kapalAwal || KAPAL_ANGGARAN[0]);
  const [jenis, setJenis] = useState("berita_acara");
  const [judul, setJudul] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [nomor, setNomor] = useState("");
  const [catatan, setCatatan] = useState("");
  const [berkas, setBerkas] = useState<File[]>([]);
  const [kirim, setKirim] = useState(false);
  const [maju, setMaju] = useState<Kemajuan | null>(null);
  const [galat, setGalat] = useState("");
  const pilihRef = useRef<HTMLInputElement | null>(null);

  /* Esc menutup — tetapi tidak selagi berkas sedang naik, karena menutup di
     tengah unggahan meninggalkan catatan tanpa lampiran. */
  useEffect(() => {
    const t = (e: KeyboardEvent) => { if (e.key === "Escape" && !kirim) onTutup(); };
    window.addEventListener("keydown", t);
    return () => window.removeEventListener("keydown", t);
  }, [kirim, onTutup]);

  const simpan = async () => {
    if (!judul.trim()) { setGalat("Judul dokumen wajib diisi."); return; }
    if (!berkas.length) { setGalat("Pilih dulu berkasnya — dokumen tanpa lampiran tidak ada gunanya diarsipkan."); return; }
    setKirim(true); setGalat(""); setMaju(null);
    try {
      /* Dua langkah, sama seperti sisi kapal: catatannya dibuat lebih dulu
         supaya berkas punya tempat menempel, baru berkasnya menyusul. */
      const r = await fetch("/api/armada-data/dokumen", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kapal, jenis, judul, tanggal, nomor, catatan }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Dokumen gagal dicatat");

      for (let i = 0; i < berkas.length; i++) {
        await unggahSatuBerkas({ id: d.id, token: d.token }, berkas[i], i + 1, berkas.length, setMaju);
      }
      onSelesai(`${berkas.length} berkas masuk arsip ${kapal} ✓`);
      onTutup();
    } catch (e: any) {
      setGalat(pesanRamah(e));
    } finally { setKirim(false); setMaju(null); }
  };

  const gaya = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-[#16357f] dark:border-slate-600 dark:bg-slate-800 dark:text-white";
  const label = "text-[11px] font-bold uppercase tracking-wide text-slate-500";

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-auto bg-black/50 p-3 sm:items-center"
      onMouseDown={() => { if (!kirim) onTutup(); }}>
      <div className="my-4 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 bg-[#16357f] px-5 py-3.5 text-white">
          <span className="text-lg">🗂️</span>
          <div className="flex-1">
            <h2 className="text-[15px] font-black tracking-tight">Unggah Dokumen Kapal</h2>
            <p className="text-[11px] text-white/60">Dari kantor — masuk ke arsip yang sama dengan unggahan awak</p>
          </div>
          <button onClick={onTutup} disabled={kirim} className="text-xl leading-none text-white/70 hover:text-white disabled:opacity-40">✕</button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-auto bg-slate-50/60 px-5 py-4 dark:bg-slate-900">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Kapal</span>
              <select value={kapal} onChange={(e) => setKapal(e.target.value)} className={gaya}>
                {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={label}>Golongan dokumen</span>
              <select value={jenis} onChange={(e) => setJenis(e.target.value)} className={gaya}>
                {/* kantor melihat SELURUH golongan, tidak disaring deck/mesin:
                    berkas yang sampai ke kantor tidak datang dengan label bagian */}
                {JENIS_DOKUMEN.map((j) => <option key={j.id} value={j.id}>{j.ikon} {j.label}</option>)}
              </select>
            </label>
          </div>
          <p className="rounded-lg bg-white px-3 py-2 text-[11.5px] leading-snug text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
            {jenisDokumen(jenis)?.ket}
          </p>

          <label className="block">
            <span className={label}>Judul dokumen</span>
            <input value={judul} onChange={(e) => setJudul(e.target.value)}
              placeholder="mis. Berita Acara Kerusakan Pompa Pendingin ME Kanan" className={gaya} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Tanggal kejadian</span>
              <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={gaya} />
            </label>
            <label className="block">
              <span className={label}>Nomor (bila ada)</span>
              <input value={nomor} onChange={(e) => setNomor(e.target.value)} placeholder="mis. BA/012/IX/2026" className={gaya} />
            </label>
          </div>

          <label className="block">
            <span className={label}>Keterangan singkat</span>
            <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2}
              placeholder="Apa yang terjadi, siapa yang hadir, tindakan yang sudah diambil." className={gaya} />
          </label>

          <label className="block">
            <span className={label}>Berkas (boleh lebih dari satu)</span>
            <input ref={pilihRef} type="file" multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setBerkas(Array.from(e.target.files || []))}
              className={`${gaya} file:mr-3 file:rounded-lg file:border-0 file:bg-[#16357f] file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-white`} />
          </label>

          {!!berkas.length && (
            <ul className="space-y-1">
              {berkas.map((f) => (
                <li key={f.name} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12px] ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-700 dark:text-slate-200">{f.name}</span>
                  <span className="shrink-0 text-slate-500">{ukuran(f.size)}</span>
                </li>
              ))}
            </ul>
          )}

          {maju && (
            <p className="rounded-lg bg-sky-50 px-2.5 py-2 text-[11.5px] font-semibold text-sky-900 ring-1 ring-sky-200">
              Mengunggah {maju.berkas} — potongan {maju.potongan}/{maju.total}
              {maju.percobaan > 1 ? ` (percobaan ke-${maju.percobaan})` : ""}
            </p>
          )}
          {galat && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-800 ring-1 ring-rose-200">{galat}</p>}

          <p className="text-[11px] leading-relaxed text-slate-500">
            Berkas naik ke Google Drive kantor, folder <b>Dokumen Kapal › {kapal} › {jenisDokumen(jenis)?.folder}</b>.
            Tercatat sebagai unggahan kantor, dan langsung terlihat di Portal Kapal milik awak.
          </p>
        </div>

        <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
          <button onClick={onTutup} disabled={kirim}
            className="rounded-xl border border-slate-300 px-4 py-2 text-[12.5px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300">
            Batal
          </button>
          <button onClick={simpan} disabled={kirim}
            className="ml-auto rounded-xl bg-emerald-600 px-5 py-2 text-[13px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">
            {kirim ? "Mengunggah…" : "Simpan & unggah ke Drive"}
          </button>
        </div>
      </div>
    </div>
  );
}
