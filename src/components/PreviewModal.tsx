"use client";
// Modal preview dokumen dari daftar riwayat — lihat isi pengadaan tanpa membuka halaman detail.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import PreviewPengadaan from "@/components/PreviewPengadaan";
import { fullNoKontrak } from "@/lib/sppbj/types";

export interface PreviewModalProps {
  jenis: "SPPBJ" | "Non PR PO";
  payload: any;            // isi pengadaan (payload Supabase)
  onTutup: () => void;
  onBuka?: () => void;     // buka halaman detail (opsional)
}

export default function PreviewModal({ jenis, payload, onTutup, onBuka }: PreviewModalProps) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onTutup(); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onTutup]);

  const p = payload || {};
  const isi = (
    <div className="fixed inset-0 z-[120] bg-black/50 overflow-auto no-print-bg" onMouseDown={onTutup}>
      <div className="min-h-full py-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="no-print max-w-[210mm] mx-auto px-3 flex flex-wrap items-center gap-2 mb-2">
          <span className="text-white font-bold text-sm truncate flex-1">{p.namaPengadaan || "(tanpa nama)"}</span>
          {onBuka && <button onClick={onBuka} className="btn btn-primary text-xs">Buka detail →</button>}
          <button onClick={() => window.print()} className="btn btn-ghost text-xs">🖨️ Cetak</button>
          <button onClick={onTutup} className="btn btn-ghost text-xs">✕ Tutup</button>
        </div>
        <PreviewPengadaan
          jenis={jenis}
          judul={jenis === "SPPBJ" ? "Daftar Kebutuhan Pengadaan Barang/Jasa" : "Daftar Kebutuhan Pengadaan (Non PR PO)"}
          nomor={(jenis === "SPPBJ" ? p.noSPPBJ || fullNoKontrak(p) : p.noSPPB) || ""}
          tanggal={p.tanggal || ""}
          noDRP={p.noDRP}
          dasarPelimpahan={p.dasarPelimpahan}
          namaPengadaan={p.namaPengadaan || ""}
          mataAnggaran={Array.isArray(p.mataAnggaran) ? p.mataAnggaran : p.mataAnggaran ? [p.mataAnggaran] : []}
          jenisAnggaran={p.jenisAnggaran}
          vendor={p.vendor}
          stafTeknik={p.stafTeknik}
          deptHead={p.deptHead}
          items={p.items || []}
        />
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(isi, document.body) : null;
}
