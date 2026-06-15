"use client";

import { useRef } from "react";
import { useStore } from "@/lib/store";
import { DokFoto } from "@/lib/types";
import DocToolbar from "@/components/DocToolbar";
import { uploadFoto } from "@/lib/fotoStorage";
import FotoUploader from "@/components/FotoUploader";

export default function DokumentasiDoc() {
  const { data: d, update } = useStore();
  const deckRef = useRef<HTMLInputElement>(null);
  const mesinRef = useRef<HTMLInputElement>(null);

  const addFotos = async (files: FileList, kategori: "DECK" | "MESIN") => {
    const baru: DokFoto[] = [];
    for (const f of Array.from(files)) {
      baru.push({ id: crypto.randomUUID(), kategori, caption: "", dataUrl: await uploadFoto(f) }); // Storage URL / fallback base64
    }
    update({ fotoDok: [...d.fotoDok, ...baru] });
  };
  const setCaption = (id: string, caption: string) => update({ fotoDok: d.fotoDok.map((f) => (f.id === id ? { ...f, caption } : f)) });
  const del = (id: string) => update({ fotoDok: d.fotoDok.filter((f) => f.id !== id) });

  const addFromUploader = (kategori: "DECK" | "MESIN") => (urls: string[]) => {
    const baru: DokFoto[] = urls.map((u) => ({ id: crypto.randomUUID(), kategori, caption: "", dataUrl: u }));
    update({ fotoDok: [...d.fotoDok, ...baru] });
  };

  const Grid = ({ kategori }: { kategori: "DECK" | "MESIN" }) => {
    const fotos = d.fotoDok.filter((f) => f.kategori === kategori);
    return (
      <>
        <div className="bg-blue-50 font-bold border border-black px-2 py-1 mt-4">{kategori}</div>
        <div className="no-print mt-2">
          <FotoUploader onAdd={addFromUploader(kategori)} compact label={`Tambah foto ${kategori}`} />
        </div>
        {fotos.length === 0 ? (
          <p className="text-slate-400 text-sm my-2 no-print">Belum ada foto {kategori}.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-2">
            {fotos.map((f) => (
              <div key={f.id} className="border border-black p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.dataUrl} alt={f.caption} className="w-full h-44 object-cover" />
                <input
                  value={f.caption}
                  onChange={(e) => setCaption(f.id, e.target.value)}
                  placeholder="Keterangan foto..."
                  className="w-full text-center text-[10pt] border-t border-black px-1 py-0.5 outline-none"
                />
                <button onClick={() => del(f.id)} className="no-print text-red-500 text-xs mt-1">hapus</button>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  const extra = (
    <div className="flex items-center gap-2">
      <input ref={deckRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFotos(e.target.files, "DECK")} />
      <input ref={mesinRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFotos(e.target.files, "MESIN")} />
      <button onClick={() => deckRef.current?.click()} className="bg-cyan-600 text-white text-xs px-3 py-2 rounded-lg">📷 Foto DECK</button>
      <button onClick={() => mesinRef.current?.click()} className="bg-cyan-700 text-white text-xs px-3 py-2 rounded-lg">📷 Foto MESIN</button>
    </div>
  );

  return (
    <>
      <DocToolbar title="08. Dokumentasi Swakelola Docking" slug="dokumentasi" data={d} nativeKind="excel" extra={extra} />
      <div className="print-page text-black">
        <div className="text-center font-bold text-[12pt] mb-2">
          DOKUMENTASI PEKERJAAN SWAKELOLA DOCKING {d.namaKapal} TAHUN {d.tahun}
        </div>
        <Grid kategori="DECK" />
        <Grid kategori="MESIN" />
      </div>
    </>
  );
}
