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
 *
 * TABEL. Baris kedua papan alat muncul saat kursor ada di dalam tabel: sisip &
 * hapus baris/kolom, hapus tabel. Logikanya di lib/surat/tabelSunting.ts — sel
 * baru menyalin gaya inline tetangganya, karena HTML di sini sudah HTML final
 * e-office. Operasi tabel mengubah DOM langsung, di luar riwayat urungkan milik
 * peramban; maka sebelum tiap operasi isi kotak dipotret, dan Urungkan/Ctrl+Z
 * memakai potret itu dulu selama belum ada ketikan sesudahnya.
 */
import { useEffect, useRef, useState } from "react";
import { hapusBaris, hapusKolom, htmlTabelBaru, sisipBaris, sisipKolom } from "@/lib/surat/tabelSunting";

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
  const [diTabel, setDiTabel] = useState(false);
  const [bukaTabel, setBukaTabel] = useState(false);
  const [petak, setPetak] = useState({ b: 0, k: 0 });
  /** potret isi sebelum operasi tabel, untuk Urungkan */
  const riwayatTabel = useRef<string[]>([]);

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
    riwayatTabel.current = [];   // riwayat peramban kini lebih baru dari potret tabel
    rekam();
  };

  /* ── tabel ──────────────────────────────────────────────────────────── */

  /** sel tabel tempat kursor berada, hanya bila di dalam kotak surat */
  const selAktif = (): HTMLTableCellElement | null => {
    const el = kotak.current;
    const n = window.getSelection()?.anchorNode || null;
    if (!el || !n || !el.contains(n)) return null;
    const mulai = n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement;
    const sel = mulai?.closest("td,th") as HTMLTableCellElement | null;
    return sel && el.contains(sel) ? sel : null;
  };

  useEffect(() => {
    if (!sunting) { setDiTabel(false); setBukaTabel(false); return; }
    const cek = () => setDiTabel(!!selAktif());
    document.addEventListener("selectionchange", cek);
    return () => document.removeEventListener("selectionchange", cek);
  }, [sunting]);

  /**
   * Taruh kursor di sel — di dalam pembungkus <font>/<b> bila ada, supaya
   * ketikan mewarisi warna kepala tabel. pilih=true memblok isi sel seperti Tab
   * di Word: ketikan langsung menggantikan "Judul 1", tidak menempel di depannya.
   */
  const taruhKursor = (sel: Element, pilih = false) => {
    let n: Element = sel;
    while (n.firstElementChild && n.firstElementChild.tagName !== "BR" && n.childNodes.length === 1) n = n.firstElementChild;
    const r = document.createRange();
    if (pilih && (n.textContent || "").trim()) r.selectNodeContents(n);
    else { r.setStart(n, 0); r.collapse(true); }
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  };

  const potret = () => {
    const el = kotak.current;
    if (!el) return;
    riwayatTabel.current.push(el.innerHTML);
    if (riwayatTabel.current.length > 30) riwayatTabel.current.shift();
  };

  const opTabel = (aksi: (sel: HTMLTableCellElement) => HTMLTableCellElement | null) => {
    const el = kotak.current;
    const sel = selAktif();
    if (!el || !sel) return;
    potret();
    const tujuan = aksi(sel);
    rekam();
    if (tujuan && el.contains(tujuan)) taruhKursor(tujuan);
    else el.focus();
    setDiTabel(!!selAktif());
  };

  const hapusTabelIni = () => {
    const t = selAktif()?.closest("table");
    if (!t || !confirm("Hapus seluruh tabel ini dari surat?")) return;
    potret();
    t.remove();
    rekam();
    setDiTabel(false);
  };

  /**
   * Tabel baru ditaruh SESUDAH paragraf/butir tempat kursor — tidak memotong
   * kalimat di tengah. Di dalam butir bernomor ia masuk ke ujung butir itu,
   * seperti rincian denda di bawah butir 2.e.
   */
  const sisipTabelBaru = (b: number, k: number) => {
    const el = kotak.current;
    setBukaTabel(false);
    if (!el) return;
    const wadah = document.createElement("div");
    wadah.innerHTML = htmlTabelBaru(b, k);
    const t = wadah.firstElementChild as HTMLTableElement;
    const n = window.getSelection()?.anchorNode || null;
    const mulai = n && el.contains(n) ? (n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement) : null;
    const blok = mulai?.closest("li,p,h1,h2,h3,h4,h5,h6,table,blockquote") || null;
    potret();
    if (blok && el.contains(blok) && blok.tagName === "LI") blok.appendChild(t);
    else if (blok && el.contains(blok)) blok.after(t);
    else (el.querySelector("div") || el).appendChild(t);
    rekam();
    const pertama = t.querySelector("td,th");
    if (pertama) taruhKursor(pertama, true);
  };

  const urungkan = () => {
    const el = kotak.current;
    const lama = riwayatTabel.current.pop();
    if (el && lama !== undefined) {
      el.innerHTML = lama;
      rekam();
      el.focus();
      return;
    }
    perintah("undo");
  };

  /** Tab pindah sel, Ctrl+Z memakai potret tabel bila ada */
  const papanTik = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && riwayatTabel.current.length) {
      e.preventDefault();
      urungkan();
      return;
    }
    if (e.key !== "Tab") return;
    const sel = selAktif();
    const t = sel?.closest("table");
    if (!sel || !t) return;
    e.preventDefault();
    const semua = Array.from(t.querySelectorAll("td,th")).filter((x) => x.closest("table") === t);
    const tujuan = semua[semua.indexOf(sel) + (e.shiftKey ? -1 : 1)];
    if (tujuan) taruhKursor(tujuan, true);
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
    riwayatTabel.current = [];
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
            {PEMISAH}
            <div className="relative">
              <Alat judul="Sisipkan tabel baru sesudah paragraf/butir tempat kursor" aktif={bukaTabel}
                onClick={() => setBukaTabel((v) => !v)}>⊞ Tabel</Alat>
              {bukaTabel && (
                <div className="absolute left-0 top-9 z-30 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="mb-1 grid grid-cols-6 gap-0.5" onMouseLeave={() => setPetak({ b: 0, k: 0 })}>
                    {Array.from({ length: 36 }, (_, i) => {
                      const b = Math.floor(i / 6) + 1;
                      const k = (i % 6) + 1;
                      const nyala = b <= petak.b && k <= petak.k;
                      return (
                        <button key={i} type="button" aria-label={`${b} baris × ${k} kolom`}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setPetak({ b, k })} onClick={() => sisipTabelBaru(b, k)}
                          className={`h-4 rounded-sm border transition ${
                            nyala ? "border-sky-500 bg-sky-400" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"}`} />
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {petak.b ? `${petak.b} baris isi × ${petak.k} kolom (+ baris judul)` : "Sorot untuk memilih ukuran"}
                  </p>
                </div>
              )}
            </div>
            {PEMISAH}
            <Alat judul="Hapus format" onClick={() => perintah("removeFormat")}>⌫</Alat>
            <Alat judul="Urungkan (Ctrl+Z)" onClick={urungkan}>↶</Alat>
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

      {/* baris alat tabel: hanya saat kursor di dalam tabel */}
      {sunting && diTabel && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-sky-50 px-2 py-1.5 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:ring-sky-800">
          <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wide text-sky-700 dark:text-sky-300">Tabel</span>
          <Alat judul="Tambah baris di atas" onClick={() => opTabel((s) => sisipBaris(s, false))}>↑ + baris</Alat>
          <Alat judul="Tambah baris di bawah" onClick={() => opTabel((s) => sisipBaris(s, true))}>↓ + baris</Alat>
          <Alat judul="Hapus baris ini" onClick={() => opTabel(hapusBaris)}>✕ baris</Alat>
          {PEMISAH}
          <Alat judul="Tambah kolom di kiri" onClick={() => opTabel((s) => sisipKolom(s, false))}>← + kolom</Alat>
          <Alat judul="Tambah kolom di kanan" onClick={() => opTabel((s) => sisipKolom(s, true))}>→ + kolom</Alat>
          <Alat judul="Hapus kolom ini" onClick={() => opTabel(hapusKolom)}>✕ kolom</Alat>
          {PEMISAH}
          <Alat judul="Hapus seluruh tabel" onClick={hapusTabelIni}>🗑 tabel</Alat>
          <span className="ml-auto text-[10px] text-sky-700/70 dark:text-sky-300/70">Tab = pindah sel · ↶ membatalkan</span>
        </div>
      )}

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
          onInput={() => { riwayatTabel.current = []; rekam(); }}
          onBlur={rekam}
          onPaste={tempel}
          onKeyDown={papanTik}
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
