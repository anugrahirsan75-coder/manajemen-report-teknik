"use client";
/**
 * Pratinjau surat yang bisa langsung disunting, seperti mengetik di Word.
 *
 * KENAPA ADA. Badan surat disusun otomatis dari borang, dan itu menutup 95%
 * kebutuhan. Sisanya tidak: satu kalimat perlu ditambah, satu kata perlu
 * ditebalkan, satu butir perlu dipindah. Sebelum ini jalan satu-satunya adalah
 * menempel dulu ke e-office lalu menyuntingnya di sana — artinya konsep PDF
 * yang diedarkan ke pimpinan isinya berbeda dengan surat yang akhirnya terbit.
 * Dengan menyunting di sini, PDF konsep, salinan HTML, dan salinan berformat
 * semuanya ikut berubah, jadi ketiganya tidak pernah berbeda isi.
 *
 * SATU HAL YANG HARUS DIPAHAMI PEMAKAI, dan karena itu ditulis besar-besar di
 * layar: begitu surat disunting tangan, isian borang TIDAK LAGI mengubahnya.
 * Kalau tidak begitu, satu ketikan di borang akan menghapus seluruh suntingan
 * tanpa bisa dibatalkan. Tombol "Kembali ke otomatis" membuang suntingan dan
 * menyambungkan surat ke borang lagi.
 *
 * CARA PASANG ISINYA. innerHTML TIDAK boleh dipasang ulang tiap render: kotak
 * contenteditable yang isinya ditimpa saat diketik akan melemparkan kursor ke
 * awal tiap huruf. Jadi isi hanya dipasang kalau sumbernya memang berganti —
 * dijaga oleh terpasang.current, yang ikut diperbarui saat pemakai mengetik
 * supaya ketikannya sendiri tidak dianggap sumber baru.
 */
import { useEffect, useRef, useState } from "react";

export interface PratinjauSuntingProps {
  /** HTML yang ditampilkan: hasil suntingan kalau ada, kalau tidak hasil borang */
  html: string;
  /** true bila yang tampil adalah hasil suntingan tangan, bukan susunan borang */
  disunting: boolean;
  /** dipanggil tiap isi berubah karena diketik/diformat pemakai */
  ubah: (html: string) => void;
  /** buang suntingan, kembalikan ke susunan borang */
  kembalikan: () => void;
}

/** satu tombol papan alat */
function Alat({ judul, aktif, onClick, children }: {
  judul: string; aktif?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" title={judul} aria-label={judul}
      // mousedown di-cegah supaya sorotan teks di dalam kotak tidak hilang
      // sebelum perintahnya jalan — tanpa ini tombol Tebal tidak berefek
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition ${
        aktif
          ? "bg-sky-600 text-white"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700"
      }`}>
      {children}
    </button>
  );
}

const PEMISAH = <span className="mx-0.5 h-5 w-px self-center bg-slate-300 dark:bg-slate-600" />;

export default function PratinjauSunting({ html, disunting, ubah, kembalikan }: PratinjauSuntingProps) {
  const kotak = useRef<HTMLDivElement>(null);
  const terpasang = useRef<string>("");
  const [sunting, setSunting] = useState(false);

  useEffect(() => {
    const el = kotak.current;
    if (!el) return;
    if (terpasang.current === html) return;   // ketikan sendiri: jangan pasang ulang
    el.innerHTML = html;
    terpasang.current = html;
  }, [html]);

  const rekam = () => {
    const el = kotak.current;
    if (!el) return;
    terpasang.current = el.innerHTML;   // harus serentak, bukan di dalam setState
    ubah(el.innerHTML);
  };

  /*
   * execCommand memang sudah ditandai usang, tetapi penggantinya belum ada yang
   * didukung semua peramban; semua papan alat penyunting hari ini masih
   * memakainya. styleWithCSS sengaja dibiarkan mati supaya Tebal menghasilkan
   * <b>, bukan <span style="font-weight:bold"> — e-office membuang CSS, dan
   * tag lawas itu yang tetap selamat sampai surat terbit.
   */
  const perintah = (nama: string, nilai?: string) => {
    kotak.current?.focus();
    document.execCommand(nama, false, nilai);
    rekam();
  };

  /*
   * Tempel dipaksa jadi teks polos. Menempel dari Word membawa serta gaya,
   * kelas, dan tag <o:p> milik Office yang akan dibuang mentah-mentah oleh
   * e-office — hasilnya surat yang di layar sini rapi tapi di e-office
   * berantakan. Teks polos lalu diformat dengan papan alat jauh lebih aman.
   */
  const tempel = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const teks = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, teks);
    rekam();
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Alat judul={sunting ? "Selesai menyunting" : "Sunting langsung seperti di Word"}
          aktif={sunting} onClick={() => setSunting((v) => !v)}>
          {sunting ? "✓ Selesai" : "✎ Sunting"}
        </Alat>

        {sunting && (
          <>
            {PEMISAH}
            <Alat judul="Tebal (Ctrl+B)" onClick={() => perintah("bold")}><b>B</b></Alat>
            <Alat judul="Miring (Ctrl+I)" onClick={() => perintah("italic")}><i>I</i></Alat>
            <Alat judul="Garis bawah (Ctrl+U)" onClick={() => perintah("underline")}><u>U</u></Alat>
            {PEMISAH}
            <Alat judul="Daftar bernomor" onClick={() => perintah("insertOrderedList")}>1.</Alat>
            <Alat judul="Daftar titik" onClick={() => perintah("insertUnorderedList")}>•</Alat>
            <Alat judul="Geser masuk" onClick={() => perintah("indent")}>→|</Alat>
            <Alat judul="Geser keluar" onClick={() => perintah("outdent")}>|←</Alat>
            {PEMISAH}
            <Alat judul="Rata kiri" onClick={() => perintah("justifyLeft")}>⬅</Alat>
            <Alat judul="Rata tengah" onClick={() => perintah("justifyCenter")}>↔</Alat>
            <Alat judul="Rata kanan-kiri" onClick={() => perintah("justifyFull")}>☰</Alat>
            {PEMISAH}
            <Alat judul="Hapus format" onClick={() => perintah("removeFormat")}>⌫</Alat>
            <Alat judul="Urungkan (Ctrl+Z)" onClick={() => perintah("undo")}>↶</Alat>
            <Alat judul="Ulangi (Ctrl+Y)" onClick={() => perintah("redo")}>↷</Alat>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {disunting && (
            <>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-200">
                disunting tangan
              </span>
              <button type="button"
                onClick={() => {
                  if (!confirm("Buang seluruh suntingan tangan dan susun ulang dari isian borang?")) return;
                  terpasang.current = "";   // paksa pasang ulang dari susunan borang
                  kembalikan();
                }}
                className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 dark:bg-slate-800 dark:ring-rose-900">
                Kembali ke otomatis
              </button>
            </>
          )}
        </div>
      </div>

      {disunting && (
        <div className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200">
          Surat ini sudah disunting tangan, jadi <b>isian borang tidak lagi mengubahnya</b> — kalau
          tidak begitu, satu ketikan di borang akan menghapus suntingan Bapak. PDF konsep, Salin HTML,
          dan Salin berformat semuanya memakai isi yang terlihat di sini.
        </div>
      )}

      <div className={`max-h-[70vh] overflow-auto rounded-2xl p-4 ${
        sunting ? "bg-sky-50 ring-2 ring-sky-300 dark:bg-slate-800" : "bg-slate-100 dark:bg-slate-800"}`}>
        <div
          ref={kotak}
          contentEditable={sunting}
          suppressContentEditableWarning
          spellCheck={false}
          onInput={rekam}
          onBlur={rekam}
          onPaste={tempel}
          className={`mx-auto w-full max-w-[800px] bg-white p-8 shadow-md ${
            sunting ? "outline-none ring-1 ring-sky-200" : ""}`}
        />
      </div>

      {sunting && (
        <p className="mt-1.5 text-[11px] text-slate-400">
          Klik di dalam surat lalu ketik. Tempel dari Word masuk sebagai teks polos — gaya Word
          dibuang e-office, jadi formatnya dipasang ulang dengan papan alat di atas.
        </p>
      )}
    </div>
  );
}
