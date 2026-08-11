"use client";
/**
 * Penyunting badan surat.
 *
 * Dipakai untuk surat yang tak punya template — pengguna menulis sendiri, tapi
 * hasilnya tetap harus berupa HTML bergaya inline yang dimengerti e-office.
 * Karena itu apa pun yang diketik atau ditempel di sini SELALU dilewatkan
 * penormal (lib/surat/kustom.ts) sebelum jadi keluaran: yang tersimpan bukan
 * isi mentah penyunting, melainkan HTML yang sudah layak tempel.
 *
 * Tempelan dari Word dibersihkan lebih dulu, bukan ditolak. Melarang tempelan
 * hanya membuat orang menempelkannya diam-diam lewat jalan lain.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { bersihkanTempelan, rapikanHtmlSurat } from "@/lib/surat/kustom";

export default function EditorSurat({ nilai, ubah }: { nilai: string; ubah: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fokusTabel, setFokusTabel] = useState(false);
  const [pesan, setPesan] = useState("");

  // isi awal dipasang sekali; menulis ulang tiap ketikan akan memindahkan kursor
  useEffect(() => {
    if (ref.current && !ref.current.innerHTML) ref.current.innerHTML = nilai || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kirim = useCallback(() => {
    if (!ref.current) return;
    ubah(rapikanHtmlSurat(ref.current.innerHTML));
  }, [ubah]);

  const perintah = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    kirim();
  };

  /** sel tabel tempat kursor berada — dipakai tombol tambah/hapus baris & kolom */
  const selAktif = (): HTMLTableCellElement | null => {
    const s = window.getSelection();
    let n: Node | null = s?.anchorNode || null;
    while (n && n !== ref.current) {
      if (n.nodeType === Node.ELEMENT_NODE && /^T[DH]$/.test((n as HTMLElement).tagName)) return n as HTMLTableCellElement;
      n = n.parentNode;
    }
    return null;
  };

  useEffect(() => {
    const cek = () => setFokusTabel(!!selAktif());
    document.addEventListener("selectionchange", cek);
    return () => document.removeEventListener("selectionchange", cek);
  }, []);

  const sisipTabel = () => {
    const kolom = Math.max(1, Math.min(12, Number(prompt("Berapa kolom?", "3") || 0)));
    const baris = Math.max(1, Math.min(60, Number(prompt("Berapa baris ISI (di luar baris judul)?", "3") || 0)));
    if (!kolom || !baris) return;
    const th = Array.from({ length: kolom }, (_, i) => `<th>Judul ${i + 1}</th>`).join("");
    const td = Array.from({ length: kolom }, () => "<td>&nbsp;</td>").join("");
    const isi = Array.from({ length: baris }, () => `<tr>${td}</tr>`).join("");
    perintah("insertHTML", `<table><thead><tr>${th}</tr></thead><tbody>${isi}</tbody></table><p>&nbsp;</p>`);
  };

  const tambahBaris = (bawah: boolean) => {
    const sel = selAktif();
    if (!sel) return;
    const tr = sel.parentElement as HTMLTableRowElement;
    const baru = tr.cloneNode(true) as HTMLTableRowElement;
    Array.from(baru.children).forEach((c) => {
      const s = c as HTMLTableCellElement;
      // baris baru selalu berupa sel isi, walau disalin dari baris judul —
      // dua baris judul dalam satu tabel tak pernah dimaksudkan
      if (s.tagName === "TH") {
        const td = document.createElement("td");
        td.innerHTML = "&nbsp;";
        s.replaceWith(td);
      } else s.innerHTML = "&nbsp;";
    });
    tr.parentElement?.insertBefore(baru, bawah ? tr.nextSibling : tr);
    kirim();
  };

  const hapusBaris = () => {
    const sel = selAktif();
    const tr = sel?.parentElement as HTMLTableRowElement | undefined;
    const tabel = tr?.closest("table");
    if (!tr || !tabel) return;
    if (tabel.querySelectorAll("tr").length <= 1) { tabel.remove(); } else { tr.remove(); }
    kirim();
  };

  const tambahKolom = () => {
    const sel = selAktif();
    const tabel = sel?.closest("table");
    if (!sel || !tabel) return;
    const idx = Array.from(sel.parentElement!.children).indexOf(sel);
    tabel.querySelectorAll("tr").forEach((tr) => {
      const acuan = tr.children[idx] as HTMLTableCellElement | undefined;
      const baru = document.createElement(acuan?.tagName === "TH" ? "th" : "td");
      baru.innerHTML = acuan?.tagName === "TH" ? "Judul" : "&nbsp;";
      tr.insertBefore(baru, acuan?.nextSibling || null);
    });
    kirim();
  };

  const hapusKolom = () => {
    const sel = selAktif();
    const tabel = sel?.closest("table");
    if (!sel || !tabel) return;
    const idx = Array.from(sel.parentElement!.children).indexOf(sel);
    tabel.querySelectorAll("tr").forEach((tr) => tr.children[idx]?.remove());
    if (!tabel.querySelector("td,th")) tabel.remove();
    kirim();
  };

  const tempel = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const teks = e.clipboardData.getData("text/plain");
    if (html) document.execCommand("insertHTML", false, bersihkanTempelan(html));
    else document.execCommand("insertText", false, teks);
    kirim();
  };

  const rapikanSekarang = () => {
    if (!ref.current) return;
    const rapi = rapikanHtmlSurat(ref.current.innerHTML);
    ref.current.innerHTML = rapi;
    ubah(rapi);
    setPesan("Sudah dirapikan ke gaya e-office.");
    window.setTimeout(() => setPesan(""), 2500);
  };

  const Tombol = ({ pada, judul, anak, mati }: { pada: () => void; judul: string; anak: React.ReactNode; mati?: boolean }) => (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={pada} title={judul} disabled={mati}
      className="rounded-lg px-2 py-1 text-xs font-bold text-slate-600 transition hover:bg-white hover:text-sky-700 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-700">
      {anak}
    </button>
  );
  const Pisah = () => <span className="mx-0.5 h-5 w-px bg-slate-300 dark:bg-slate-600" />;

  return (
    <div>
      {/* ── perkakas ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-2xl border border-b-0 border-slate-300 bg-slate-100 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
        <Tombol pada={() => perintah("bold")} judul="Tebal (Ctrl+B)" anak={<b>B</b>} />
        <Tombol pada={() => perintah("italic")} judul="Miring (Ctrl+I)" anak={<i>I</i>} />
        <Tombol pada={() => perintah("underline")} judul="Garis bawah (Ctrl+U)" anak={<u>U</u>} />
        <Pisah />
        <Tombol pada={() => perintah("justifyLeft")} judul="Rata kiri" anak="⯇" />
        <Tombol pada={() => perintah("justifyCenter")} judul="Rata tengah" anak="≡" />
        <Tombol pada={() => perintah("justifyRight")} judul="Rata kanan" anak="⯈" />
        <Tombol pada={() => perintah("justifyFull")} judul="Rata kiri-kanan" anak="☰" />
        <Pisah />
        <Tombol pada={() => perintah("insertUnorderedList")} judul="Daftar berbutir" anak="•" />
        <Tombol pada={() => perintah("insertOrderedList")} judul="Daftar bernomor" anak="1." />
        <Tombol pada={() => perintah("outdent")} judul="Kurangi indent" anak="⇤" />
        <Tombol pada={() => perintah("indent")} judul="Tambah indent" anak="⇥" />
        <Pisah />
        <Tombol pada={sisipTabel} judul="Sisipkan tabel" anak="⊞ Tabel" />
        <Tombol pada={() => tambahBaris(true)} judul="Tambah baris di bawah" anak="+Baris" mati={!fokusTabel} />
        <Tombol pada={hapusBaris} judul="Hapus baris ini" anak="−Baris" mati={!fokusTabel} />
        <Tombol pada={tambahKolom} judul="Tambah kolom di kanan" anak="+Kolom" mati={!fokusTabel} />
        <Tombol pada={hapusKolom} judul="Hapus kolom ini" anak="−Kolom" mati={!fokusTabel} />
        <Pisah />
        <Tombol pada={() => perintah("insertHorizontalRule")} judul="Garis pemisah" anak="―" />
        <Tombol pada={() => perintah("removeFormat")} judul="Bersihkan format" anak="⌫" />
        <Tombol pada={() => perintah("undo")} judul="Batal (Ctrl+Z)" anak="↶" />
        <Tombol pada={() => perintah("redo")} judul="Ulangi" anak="↷" />
        <button type="button" onClick={rapikanSekarang}
          className="ml-auto rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-700">
          ✨ Rapikan ke gaya e-office
        </button>
      </div>

      {/* ── kertas ───────────────────────────────────────────────────── */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={kirim}
        onBlur={kirim}
        onPaste={tempel}
        className="editor-surat min-h-[26rem] rounded-b-2xl border border-slate-300 bg-white px-6 py-5 text-[13px] leading-relaxed text-slate-800 outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />

      <style jsx global>{`
        .editor-surat table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .editor-surat th, .editor-surat td { border: 1px solid #94a3b8; padding: 4px 6px; }
        .editor-surat th { background: #1F4E79; color: #fff; font-weight: 700; }
        .editor-surat p { margin: 0 0 8px 0; text-align: justify; }
        .editor-surat ul, .editor-surat ol { margin: 0 0 8px 0; padding-left: 22px; }
        .editor-surat:empty:before { content: "Tulis badan suratnya di sini…"; color: #94a3b8; }
      `}</style>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span>
          Yang ditempel dari Word dibersihkan otomatis. Tabel, daftar, dan penebalan ikut terbawa; warna dan
          jenis huruf tidak — e-office memakai gayanya sendiri.
        </span>
        {pesan && <span className="font-semibold text-emerald-700">✓ {pesan}</span>}
      </div>
    </div>
  );
}
