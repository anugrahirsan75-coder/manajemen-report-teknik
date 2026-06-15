"use client";

import { useEffect, useId, useRef, useState } from "react";
import { uploadFoto } from "@/lib/fotoStorage";

interface Props {
  onAdd: (urls: string[]) => void;            // tambah ke koleksi luar (maks ditegakkan pemanggil)
  max?: number;                                // sisa slot (utk hint UI)
  label?: string;                              // teks tombol
  hint?: string;                               // teks bantu
  className?: string;
  compact?: boolean;
}

/** Upload foto fleksibel: pilih file, drag-drop, atau paste (Ctrl+V) screenshot. */
export default function FotoUploader({ onAdd, max, label = "Pilih / Tarik / Paste Foto", hint, className = "", compact }: Props) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(0);          // jumlah foto sedang upload
  const [drag, setDrag] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    const limit = max && max > 0 ? files.slice(0, max) : files;
    setBusy((n) => n + limit.length);
    try {
      const urls = await Promise.all(limit.map((f) => uploadFoto(f)));
      onAdd(urls.filter(Boolean));
    } finally { setBusy(0); }
  };

  // PASTE Ctrl+V global — aktif di mana saja selama tidak sedang ketik di input/textarea
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || (active as HTMLElement).isContentEditable)) return;
      const items = Array.from(e.clipboardData?.items || []);
      const files = items
        .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
        .map((it) => it.getAsFile()!)
        .filter(Boolean) as File[];
      if (!files.length) return;
      e.preventDefault();
      handleFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [max]);

  // Modern Clipboard API fallback (navigator.clipboard.read)
  const readClipboard = async () => {
    try {
      if (!navigator.clipboard?.read) {
        alert("Browser tidak mendukung navigator.clipboard.read(). Gunakan Ctrl+V atau drag-drop.");
        return;
      }
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            files.push(new File([blob], `clipboard-${Date.now()}.${type.split("/")[1]}`, { type }));
            break;
          }
        }
      }
      if (!files.length) {
        alert("Tidak ada gambar di clipboard.");
        return;
      }
      handleFiles(files);
    } catch (e: any) {
      if (e.name === "NotAllowedError" || e.name === "SecurityError") {
        alert("Izin clipboard ditolak. Izinkan akses clipboard di pengaturan browser, atau gunakan Ctrl+V / drag-drop.");
      } else {
        alert("Gagal baca clipboard: " + (e?.message ?? e));
      }
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
    handleFiles(files);
  };

  return (
    <div className={className}>
      <div
        ref={dropRef}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        tabIndex={0}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition px-4 ${compact ? "py-3" : "py-5"} text-center
          ${drag ? "border-[#1ca3dd] bg-[#1ca3dd]/10" : hovered ? "border-[#1ca3dd] bg-sky-50/60" : "border-slate-300 bg-slate-50/40 hover:bg-slate-50"}`}
      >
        <input ref={fileRef} id={id} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { handleFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-700">
          <span className="text-lg">{busy ? "⏳" : drag ? "📥" : "📷"}</span>
          {busy ? `Mengunggah ${busy} foto…` : label}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Pilih file · tarik (drag &amp; drop) · atau <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Ctrl</kbd>
          <span className="mx-0.5">+</span>
          <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">V</kbd> tempel hasil screenshot
          {hint ? <> · <span className="text-slate-400">{hint}</span></> : null}
          {max ? <span className="text-slate-400"> · sisa {max} slot</span> : null}
        </p>
      </div>
      <button type="button" onClick={readClipboard} disabled={busy > 0}
        className="mt-2 w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 transition flex items-center justify-center gap-1.5">
        <span>📋</span> Ambil dari Clipboard
      </button>
    </div>
  );
}
