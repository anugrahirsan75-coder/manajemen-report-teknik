"use client";
/**
 * Jendela pratinjau berkas kiriman ABK — dibuka di atas halaman, bukan tab baru.
 *
 * Berkas kiriman tinggal di Drive yang tidak dibagikan, jadi menyematkan tautan
 * Drive hanya berhasil bagi yang kebetulan sedang login ke akun pemiliknya.
 * Komponen ini mengambil berkasnya lewat /api/lapor/isi — server aplikasi yang
 * memintanya ke Apps Script — lalu menampilkannya dari alamat kita sendiri.
 *
 * Dipakai dua layar: Isi Permintaan (mencocokkan hasil bacaan dengan fotonya)
 * dan Rekap Kiriman (memeriksa berkas yang baru masuk). Keduanya butuh hal yang
 * sama: membaca tulisan tangan ABK tanpa keluar dari aplikasi.
 */
import { useEffect, useRef, useState } from "react";
import { Ikon } from "./ikon";

export interface PratinjauProps {
  fileId: string;
  nama: string;
  keterangan?: string;
  /** tautan Drive aslinya, sebagai jalan keluar bila pengambilan gagal */
  tautanAsli?: string;
  /**
   * Berkas yang SUDAH diambil pemanggil (mis. panel foto di samping tabel).
   * Bila diisi, jendela ini tidak mengambil ulang — menghemat satu perjalanan
   * ke Drive yang memakan beberapa detik.
   */
  berkasSiap?: { url: string; mime: string } | null;
  tutup: () => void;
}

export function PratinjauBerkas({ fileId, nama, keterangan, tautanAsli, berkasSiap, tutup }: PratinjauProps) {
  const [berkas, setBerkas] = useState<{ url: string; mime: string } | null>(berkasSiap || null);
  const [galat, setGalat] = useState("");
  const [muat, setMuat] = useState(!berkasSiap);
  const [ulang, setUlang] = useState(0);

  const [zum, setZum] = useState(1);
  const [putar, setPutar] = useState(0);
  const [geser, setGeser] = useState({ x: 0, y: 0 });
  const seret = useRef<{ x: number; y: number; gx: number; gy: number } | null>(null);
  /*
   * Jarak tempuh tetikus sejak tombol ditekan. Klik pada latar gelap menutup
   * jendela, tetapi menggeser berkas yang diperbesar juga berakhir dengan
   * melepas tombol di latar itu — tanpa membedakannya, tiap selesai menggeser
   * jendelanya ikut tertutup.
   */
  const jarakSeret = useRef(0);
  const panggung = useRef<HTMLDivElement | null>(null);

  const gambar = (berkas?.mime || "").startsWith("image/");
  const batas = (n: number) => Math.min(6, Math.max(0.4, Number(n.toFixed(2))));
  const pasKan = () => { setZum(1); setGeser({ x: 0, y: 0 }); setPutar(0); };

  // ── ambil berkasnya ───────────────────────────────────────────────────────
  useEffect(() => {
    if (berkasSiap) { setBerkas(berkasSiap); setMuat(false); return; }
    let batalkan = false;
    let objek = "";
    setBerkas(null); setGalat(""); setMuat(true);

    /*
     * Apps Script sesekali menjawab halaman HTML alih-alih JSON ketika sedang
     * sibuk melayani unggahan ABK. Kegagalan seperti itu hilang sendiri pada
     * percobaan berikutnya, jadi sekali diulang dulu sebelum menyerah.
     */
    const ambil = async (percobaan = 0): Promise<void> => {
      try {
        const r = await fetch(`/api/lapor/isi?fileId=${encodeURIComponent(fileId)}`, { cache: "no-store" });
        const jenisIsi = r.headers.get("content-type") || "";
        if (!r.ok || jenisIsi.includes("application/json")) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d?.error || `Berkas tidak bisa diambil (kode ${r.status}).`);
        }
        const blob = await r.blob();
        if (batalkan) return;
        objek = URL.createObjectURL(blob);
        setBerkas({ url: objek, mime: blob.type || jenisIsi });
      } catch (e: any) {
        if (batalkan) return;
        if (percobaan < 1) {
          await new Promise((s) => setTimeout(s, 1500));
          if (!batalkan) return ambil(percobaan + 1);
          return;
        }
        setGalat(e?.message || "Berkas gagal diambil.");
      }
    };

    ambil().finally(() => { if (!batalkan) setMuat(false); });
    return () => { batalkan = true; if (objek) URL.revokeObjectURL(objek); };
  }, [fileId, berkasSiap, ulang]);

  // ── papan tik & gulir halaman di belakang ────────────────────────────────
  useEffect(() => {
    const tekan = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") tutup();
      else if (ev.key === "+" || ev.key === "=") setZum((z) => batas(z + 0.25));
      else if (ev.key === "-" || ev.key === "_") setZum((z) => batas(z - 0.25));
      else if (ev.key === "0") pasKan();
    };
    window.addEventListener("keydown", tekan);
    const gulirLama = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tekan);
      document.body.style.overflow = gulirLama;
    };
  }, [tutup]);

  /*
   * Roda mouse dipasang sendiri, bukan lewat onWheel React: React memasang
   * pendengar roda secara pasif, sehingga preventDefault-nya diabaikan dan
   * halaman di belakang ikut bergulir ketika berkasnya diperbesar.
   */
  useEffect(() => {
    const el = panggung.current;
    if (!el) return;
    const roda = (ev: WheelEvent) => {
      ev.preventDefault();
      setZum((z) => batas(z + (ev.deltaY < 0 ? 0.18 : -0.18)));
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, []);

  const mulaiSeret = (ev: React.MouseEvent) => {
    jarakSeret.current = 0;
    seret.current = { x: ev.clientX, y: ev.clientY, gx: geser.x, gy: geser.y };
  };
  const jalanSeret = (ev: React.MouseEvent) => {
    if (!seret.current) return;
    jarakSeret.current = Math.max(
      jarakSeret.current,
      Math.abs(ev.clientX - seret.current.x) + Math.abs(ev.clientY - seret.current.y));
    setGeser({
      x: seret.current.gx + (ev.clientX - seret.current.x),
      y: seret.current.gy + (ev.clientY - seret.current.y),
    });
  };
  const lepasSeret = () => { seret.current = null; };

  const TombolAlat = ({ onClick, judul, children }: { onClick: () => void; judul: string; children: React.ReactNode }) => (
    <button onClick={onClick} title={judul}
      className="grid h-8 w-8 place-items-center rounded-md border border-white/25 bg-white/10 text-[15px] font-bold text-white transition hover:bg-white/20">
      {children}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900/92 backdrop-blur-sm"
      onClick={(ev) => { if (ev.target === ev.currentTarget) tutup(); }}>
      <div className="flex flex-wrap items-center gap-3 border-b border-white/15 px-4 py-2.5">
        <div className="min-w-[14rem] flex-1">
          <p className="truncate text-[13px] font-bold text-white">{nama}</p>
          {keterangan && <p className="truncate text-[11px] text-white/60">{keterangan}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          <TombolAlat onClick={() => setZum((z) => batas(z - 0.25))} judul="Perkecil (−)">−</TombolAlat>
          <span className="w-14 text-center text-[12px] font-bold tabular-nums text-white">{Math.round(zum * 100)}%</span>
          <TombolAlat onClick={() => setZum((z) => batas(z + 0.25))} judul="Perbesar (+)">+</TombolAlat>
          <button onClick={pasKan} title="Kembalikan ke ukuran semula (0)"
            className="rounded-md border border-white/25 bg-white/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-white/20">
            Pas layar
          </button>
          {gambar && <TombolAlat onClick={() => setPutar((r) => (r + 90) % 360)} judul="Putar 90°">⟳</TombolAlat>}
          {tautanAsli && (
            <a href={tautanAsli} target="_blank" rel="noreferrer" title="Buka berkas aslinya di Drive"
              className="rounded-md border border-white/25 bg-white/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-white/20">
              Drive
            </a>
          )}
          <button onClick={tutup} title="Tutup (Esc)"
            className="rounded-md bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-900 transition hover:bg-slate-200">
            Tutup
          </button>
        </div>
      </div>

      <div ref={panggung}
        onMouseDown={mulaiSeret} onMouseMove={jalanSeret} onMouseUp={lepasSeret} onMouseLeave={lepasSeret}
        onClick={(ev) => { if (ev.target === ev.currentTarget && jarakSeret.current < 5) tutup(); }}
        className={`flex flex-1 items-center justify-center overflow-hidden p-4 ${
          gambar && zum > 1 ? (seret.current ? "cursor-grabbing" : "cursor-grab") : "cursor-default"}`}>
        {!berkas ? (
          <div className="text-center">
            <p className="text-[13px] font-semibold text-white">
              {galat ? "Berkas tidak bisa ditampilkan" : "Mengambil berkas dari Drive…"}
            </p>
            {galat && <p className="mx-auto mt-2 max-w-lg text-[12px] leading-relaxed text-white/70">{galat}</p>}
            {galat && (
              <span className="mt-3 flex items-center justify-center gap-2">
                <button onClick={() => setUlang((n) => n + 1)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-900">
                  <Ikon nama="segarkan" className="h-3.5 w-3.5" /> Coba lagi
                </button>
                {tautanAsli && (
                  <a href={tautanAsli} target="_blank" rel="noreferrer"
                    className="rounded-md border border-white/25 px-3 py-1.5 text-[11.5px] font-semibold text-white">
                    Buka di Drive
                  </a>
                )}
              </span>
            )}
            {muat && <p className="mt-2 text-[12px] text-white/50">Berkas besar bisa memakan beberapa detik.</p>}
          </div>
        ) : gambar ? (
          /*
           * Gambar diperbesar dengan transform — mulus dan bisa digeser. PDF
           * tidak: menyekalakan bingkainya ikut menyeret alat baca PDF bawaan
           * peramban keluar layar, jadi angka zoom-nya diteruskan lewat #zoom.
           */
          <div style={{ transform: `translate(${geser.x}px, ${geser.y}px) scale(${zum}) rotate(${putar}deg)` }}
            className="origin-center transition-transform duration-75">
            <img src={berkas.url} alt={nama} draggable={false}
              className="max-h-[calc(100vh-9rem)] max-w-[92vw] select-none rounded bg-white shadow-2xl" />
          </div>
        ) : (
          <iframe src={`${berkas.url}#zoom=${Math.round(zum * 100)}&toolbar=0`} title={nama}
            className="h-[calc(100vh-9rem)] w-[92vw] rounded bg-white shadow-2xl" />
        )}
      </div>

      <p className="border-t border-white/15 px-4 py-2 text-center text-[11px] text-white/60">
        Gulir atau tekan <b className="text-white/80">+</b> / <b className="text-white/80">−</b> untuk memperbesar
        {gambar ? " · seret untuk menggeser" : ""} · <b className="text-white/80">Esc</b> atau klik di luar kertas
        menutup · <b className="text-white/80">0</b> mengembalikan ke ukuran semula
      </p>
    </div>
  );
}
