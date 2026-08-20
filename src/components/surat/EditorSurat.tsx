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
 * Dua keputusan tata letak yang menentukan enak-tidaknya dipakai:
 *
 *   · Perkakas TABEL hanya muncul saat kursor berada di dalam tabel. Sebelumnya
 *     enam tombol tabel selalu terpampang dalam keadaan kelabu — memenuhi bilah
 *     dengan tombol yang tak bisa ditekan, sekaligus menyamarkan tombol yang bisa.
 *   · Menyisipkan tabel memakai pemilih petak, bukan dua kotak pertanyaan
 *     berturut-turut. Orang tahu bentuk tabel yang diinginkannya, bukan angkanya.
 *
 * Tempelan dari Word dibersihkan lebih dulu, bukan ditolak. Melarang tempelan
 * hanya membuat orang menempelkannya diam-diam lewat jalan lain.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bersihkanTempelan, rapikanHtmlSurat } from "@/lib/surat/kustom";

/* ── tombol bilah ────────────────────────────────────────────────────────── */
function Tombol({ pada, judul, anak, lebar }: {
  pada: () => void; judul: string; anak: React.ReactNode; lebar?: boolean;
}) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={pada} title={judul}
      className={`grid h-7 place-items-center rounded-lg text-xs font-bold text-slate-600 transition hover:bg-white hover:text-sky-700 dark:text-slate-300 dark:hover:bg-slate-700 ${
        lebar ? "px-2" : "w-7"}`}>
      {anak}
    </button>
  );
}

const Pisah = () => <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" />;

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const tanggalIndo = (d = new Date()) => `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;

export default function EditorSurat({ nilai, ubah }: { nilai: string; ubah: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fokusTabel, setFokusTabel] = useState(false);
  const [pesan, setPesan] = useState("");
  const [bukaSisip, setBukaSisip] = useState(false);
  const [petak, setPetak] = useState({ b: 0, k: 0 });
  const [penuh, setPenuh] = useState(false);
  const [hitung, setHitung] = useState({ kata: 0, karakter: 0 });

  // isi awal dipasang sekali; menulis ulang tiap ketikan akan memindahkan kursor
  useEffect(() => {
    if (ref.current && !ref.current.innerHTML) ref.current.innerHTML = nilai || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hitungKata = useCallback(() => {
    const teks = (ref.current?.innerText || "").replace(/\s+/g, " ").trim();
    setHitung({ kata: teks ? teks.split(" ").length : 0, karakter: teks.length });
  }, []);

  const kirim = useCallback(() => {
    if (!ref.current) return;
    ubah(rapikanHtmlSurat(ref.current.innerHTML));
    hitungKata();
  }, [ubah, hitungKata]);

  const perintah = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    kirim();
  };

  const sisipHtml = (html: string) => {
    ref.current?.focus();
    document.execCommand("insertHTML", false, html);
    kirim();
  };

  /** sel tabel tempat kursor berada — dipakai seluruh perkakas tabel */
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

  useEffect(() => { hitungKata(); }, [hitungKata]);

  /* ── sisipan ──────────────────────────────────────────────────────────── */

  const sisipTabel = (baris: number, kolom: number) => {
    const th = Array.from({ length: kolom }, (_, i) => `<th>Judul ${i + 1}</th>`).join("");
    const td = Array.from({ length: kolom }, () => "<td>&nbsp;</td>").join("");
    const isi = Array.from({ length: baris }, () => `<tr>${td}</tr>`).join("");
    sisipHtml(`<table><thead><tr>${th}</tr></thead><tbody>${isi}</tbody></table><p>&nbsp;</p>`);
    setBukaSisip(false);
  };

  /**
   * Blok "Label : Isi" — bentuk baku surat dinas untuk menuliskan data kapal,
   * bukan tabel bergaris. Ditandai data-gaya="data" supaya penormal tahu ia
   * harus keluar tanpa garis.
   */
  const sisipBlokData = (n = 3) => {
    const baris = Array.from({ length: n }, () =>
      "<tr><td>Keterangan</td><td>:</td><td>&nbsp;</td></tr>").join("");
    sisipHtml(`<table data-gaya="data"><tbody>${baris}</tbody></table><p>&nbsp;</p>`);
    setBukaSisip(false);
  };

  const sisipDaftarHuruf = () => {
    sisipHtml('<ol type="a"><li>&nbsp;</li><li>&nbsp;</li><li>&nbsp;</li></ol><p>&nbsp;</p>');
    setBukaSisip(false);
  };

  /* ── perkakas tabel ───────────────────────────────────────────────────── */

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
    if (tabel.querySelectorAll("tr").length <= 1) tabel.remove(); else tr.remove();
    kirim();
  };

  const tambahKolom = (kanan: boolean) => {
    const sel = selAktif();
    const tabel = sel?.closest("table");
    if (!sel || !tabel) return;
    const idx = Array.from(sel.parentElement!.children).indexOf(sel);
    tabel.querySelectorAll("tr").forEach((tr) => {
      const acuan = tr.children[idx] as HTMLTableCellElement | undefined;
      const baru = document.createElement(acuan?.tagName === "TH" ? "th" : "td");
      baru.innerHTML = acuan?.tagName === "TH" ? "Judul" : "&nbsp;";
      tr.insertBefore(baru, kanan ? (acuan?.nextSibling || null) : (acuan || null));
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

  /** gabung sel dengan tetangga kanannya; isinya disambung, bukan dibuang */
  const gabungKanan = () => {
    const sel = selAktif();
    const kanan = sel?.nextElementSibling as HTMLTableCellElement | null;
    if (!sel || !kanan) return;
    const isi = kanan.innerHTML.replace(/&nbsp;/g, "").trim();
    if (isi) sel.innerHTML = `${sel.innerHTML} ${isi}`;
    sel.setAttribute("colspan", String((Number(sel.getAttribute("colspan")) || 1) + (Number(kanan.getAttribute("colspan")) || 1)));
    kanan.remove();
    kirim();
  };

  const gabungBawah = () => {
    const sel = selAktif();
    const tr = sel?.parentElement as HTMLTableRowElement | undefined;
    const trBawah = tr?.nextElementSibling as HTMLTableRowElement | null;
    if (!sel || !tr || !trBawah) return;
    const idx = Array.from(tr.children).indexOf(sel);
    const bawah = trBawah.children[idx] as HTMLTableCellElement | undefined;
    if (!bawah) return;
    const isi = bawah.innerHTML.replace(/&nbsp;/g, "").trim();
    if (isi) sel.innerHTML = `${sel.innerHTML} ${isi}`;
    sel.setAttribute("rowspan", String((Number(sel.getAttribute("rowspan")) || 1) + (Number(bawah.getAttribute("rowspan")) || 1)));
    bawah.remove();
    kirim();
  };

  /** kembalikan sel gabungan jadi sel-sel biasa */
  const pisahSel = () => {
    const sel = selAktif();
    const tr = sel?.parentElement as HTMLTableRowElement | undefined;
    if (!sel || !tr) return;
    const kolom = (Number(sel.getAttribute("colspan")) || 1) - 1;
    const baris = (Number(sel.getAttribute("rowspan")) || 1) - 1;
    sel.removeAttribute("colspan");
    sel.removeAttribute("rowspan");
    const idx = Array.from(tr.children).indexOf(sel);
    for (let i = 0; i < kolom; i++) {
      const td = document.createElement(sel.tagName === "TH" ? "th" : "td");
      td.innerHTML = "&nbsp;";
      tr.insertBefore(td, sel.nextSibling);
    }
    let berikut = tr.nextElementSibling as HTMLTableRowElement | null;
    for (let i = 0; i < baris && berikut; i++) {
      const td = document.createElement("td");
      td.innerHTML = "&nbsp;";
      berikut.insertBefore(td, berikut.children[idx] || null);
      berikut = berikut.nextElementSibling as HTMLTableRowElement | null;
    }
    kirim();
  };

  const alihBarisJudul = () => {
    const tabel = selAktif()?.closest("table");
    const tr = tabel?.querySelector("tr");
    if (!tabel || !tr) return;
    const jadiJudul = tr.querySelector("th") === null;
    Array.from(tr.children).forEach((c) => {
      const lama = c as HTMLTableCellElement;
      const baru = document.createElement(jadiJudul ? "th" : "td");
      baru.innerHTML = lama.innerHTML;
      ["colspan", "rowspan"].forEach((a) => { const v = lama.getAttribute(a); if (v) baru.setAttribute(a, v); });
      lama.replaceWith(baru);
    });
    kirim();
  };

  const hapusTabel = () => {
    selAktif()?.closest("table")?.remove();
    kirim();
  };

  /* ── tempel, rapikan, papan tik ───────────────────────────────────────── */

  const tempel = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const teks = e.clipboardData.getData("text/plain");
    if (html) document.execCommand("insertHTML", false, bersihkanTempelan(html));
    else document.execCommand("insertText", false, teks);
    kirim();
  };

  /** Tab berpindah antar sel — kebiasaan dari Word & Excel yang selalu dicoba orang */
  const papanTik = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const sel = selAktif();
    if (!sel) return;
    e.preventDefault();
    const tabel = sel.closest("table");
    if (!tabel) return;
    const semua = Array.from(tabel.querySelectorAll("td,th")) as HTMLTableCellElement[];
    const tujuan = semua[semua.indexOf(sel) + (e.shiftKey ? -1 : 1)];
    if (!tujuan) return;
    const r = document.createRange();
    r.selectNodeContents(tujuan);
    r.collapse(false);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  };

  const rapikanSekarang = () => {
    if (!ref.current) return;
    const rapi = rapikanHtmlSurat(ref.current.innerHTML);
    ref.current.innerHTML = rapi;
    ubah(rapi);
    hitungKata();
    setPesan("Sudah dirapikan ke gaya e-office.");
    window.setTimeout(() => setPesan(""), 2500);
  };

  /** perkiraan halaman: satu halaman surat dinas memuat sekitar 350 kata */
  const halaman = useMemo(() => Math.max(1, Math.ceil(hitung.kata / 350)), [hitung.kata]);

  return (
    <div className={penuh ? "fixed inset-0 z-[80] overflow-auto bg-slate-100 p-4 dark:bg-slate-950" : ""}>
      <div className={penuh ? "mx-auto max-w-4xl" : ""}>
        {/* ── perkakas ───────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 rounded-t-2xl border border-b-0 border-slate-300 bg-slate-100 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap items-center gap-0.5">
            <select onChange={(e) => { perintah("formatBlock", e.target.value); e.currentTarget.selectedIndex = 0; }}
              title="Bentuk paragraf"
              className="mr-1 h-7 rounded-lg border border-slate-300 bg-white px-1.5 text-[11px] font-bold text-slate-600 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <option>Bentuk…</option>
              <option value="p">Teks isi</option>
              <option value="h2">Judul bagian</option>
              <option value="h4">Sub judul</option>
            </select>
            <Tombol pada={() => perintah("bold")} judul="Tebal (Ctrl+B)" anak={<b>B</b>} />
            <Tombol pada={() => perintah("italic")} judul="Miring (Ctrl+I)" anak={<i>I</i>} />
            <Tombol pada={() => perintah("underline")} judul="Garis bawah (Ctrl+U)" anak={<u>U</u>} />
            <Pisah />
            <Tombol pada={() => perintah("justifyLeft")} judul="Rata kiri" anak="⇤" />
            <Tombol pada={() => perintah("justifyCenter")} judul="Rata tengah" anak="⇎" />
            <Tombol pada={() => perintah("justifyRight")} judul="Rata kanan" anak="⇥" />
            <Tombol pada={() => perintah("justifyFull")} judul="Rata kiri-kanan — bentuk baku surat dinas" anak="☰" />
            <Pisah />
            <Tombol pada={() => perintah("insertUnorderedList")} judul="Butir bulat" anak="•" />
            <Tombol pada={() => perintah("insertOrderedList")} judul="Butir bernomor 1, 2, 3" anak="1." lebar />
            <Tombol pada={sisipDaftarHuruf} judul="Butir berhuruf a, b, c" anak="a." lebar />
            <Tombol pada={() => perintah("outdent")} judul="Kurangi menjorok" anak="◀" />
            <Tombol pada={() => perintah("indent")} judul="Tambah menjorok" anak="▶" />
            <Pisah />
            <div className="relative">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setBukaSisip((v) => !v)}
                className={`h-7 rounded-lg px-2 text-[11px] font-bold transition ${
                  bukaSisip
                    ? "bg-white text-sky-700 shadow-sm ring-1 ring-sky-200 dark:bg-slate-700 dark:text-sky-300"
                    : "text-slate-600 hover:bg-white hover:text-sky-700 dark:text-slate-300 dark:hover:bg-slate-700"}`}>
                ⊞ Sisipkan ▾
              </button>
              {bukaSisip && (
                <div className="absolute left-0 top-8 z-30 w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Tabel</p>
                  <div className="mb-1 grid grid-cols-6 gap-0.5" onMouseLeave={() => setPetak({ b: 0, k: 0 })}>
                    {Array.from({ length: 30 }, (_, i) => {
                      const b = Math.floor(i / 6) + 1;
                      const k = (i % 6) + 1;
                      const nyala = b <= petak.b && k <= petak.k;
                      return (
                        <button key={i} type="button" onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setPetak({ b, k })} onClick={() => sisipTabel(b, k)}
                          className={`h-4 rounded-sm border transition ${
                            nyala ? "border-sky-500 bg-sky-400" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"}`} />
                      );
                    })}
                  </div>
                  <p className="mb-2 text-[10px] text-slate-400">
                    {petak.b ? `${petak.b} baris isi × ${petak.k} kolom (+ baris judul)` : "Sorot untuk memilih ukuran"}
                  </p>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => sisipBlokData(3)}
                    className="mb-1 w-full rounded-lg bg-slate-100 px-2 py-1.5 text-left text-[11px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">
                    ▤ Blok data “Label : Isi”
                  </button>
                  <button type="button" onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { sisipHtml(tanggalIndo()); setBukaSisip(false); }}
                    className="mb-1 w-full rounded-lg bg-slate-100 px-2 py-1.5 text-left text-[11px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">
                    📅 Tanggal hari ini
                  </button>
                  <button type="button" onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { perintah("insertHorizontalRule"); setBukaSisip(false); }}
                    className="w-full rounded-lg bg-slate-100 px-2 py-1.5 text-left text-[11px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">
                    ― Garis pemisah
                  </button>
                </div>
              )}
            </div>
            <Pisah />
            <Tombol pada={() => perintah("removeFormat")} judul="Bersihkan format" anak="⌫" />
            <Tombol pada={() => perintah("undo")} judul="Batal (Ctrl+Z)" anak="↶" />
            <Tombol pada={() => perintah("redo")} judul="Ulangi (Ctrl+Y)" anak="↷" />
            <div className="ml-auto flex items-center gap-1">
              <Tombol pada={() => setPenuh((v) => !v)} judul={penuh ? "Keluar dari layar penuh" : "Layar penuh"} anak={penuh ? "⤡" : "⤢"} />
              <button type="button" onClick={rapikanSekarang}
                className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-700">
                ✨ Rapikan ke gaya e-office
              </button>
            </div>
          </div>

          {/* baris kedua: muncul hanya saat kursor berada di dalam tabel */}
          {fokusTabel && (
            <div className="anim-in mt-1.5 flex flex-wrap items-center gap-0.5 rounded-lg bg-sky-50 px-2 py-1 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:ring-sky-800">
              <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wide text-sky-700 dark:text-sky-300">Tabel</span>
              <Tombol pada={() => tambahBaris(false)} judul="Sisip baris di atas" anak="↑+" lebar />
              <Tombol pada={() => tambahBaris(true)} judul="Sisip baris di bawah" anak="↓+" lebar />
              <Tombol pada={hapusBaris} judul="Hapus baris ini" anak="✕ baris" lebar />
              <Pisah />
              <Tombol pada={() => tambahKolom(false)} judul="Sisip kolom di kiri" anak="←+" lebar />
              <Tombol pada={() => tambahKolom(true)} judul="Sisip kolom di kanan" anak="→+" lebar />
              <Tombol pada={hapusKolom} judul="Hapus kolom ini" anak="✕ kolom" lebar />
              <Pisah />
              <Tombol pada={gabungKanan} judul="Gabung dengan sel di kanan" anak="⇥⇤" lebar />
              <Tombol pada={gabungBawah} judul="Gabung dengan sel di bawah" anak="⤓" lebar />
              <Tombol pada={pisahSel} judul="Pisahkan sel gabungan" anak="⇹" lebar />
              <Pisah />
              <Tombol pada={alihBarisJudul} judul="Jadikan / batalkan baris judul" anak="⬒ judul" lebar />
              <Tombol pada={hapusTabel} judul="Hapus seluruh tabel" anak="🗑 tabel" lebar />
              <span className="ml-auto text-[10px] text-sky-700/70 dark:text-sky-300/70">Tab = pindah sel</span>
            </div>
          )}
        </div>

        {/* ── kertas ─────────────────────────────────────────────────── */}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={kirim}
          onBlur={kirim}
          onPaste={tempel}
          onKeyDown={papanTik}
          className={`editor-surat rounded-b-2xl border border-slate-300 bg-white px-8 py-6 text-[13px] leading-relaxed text-slate-800 outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${
            penuh ? "min-h-[calc(100vh-10rem)]" : "min-h-[26rem]"}`}
        />

        <style jsx global>{`
          .editor-surat table { border-collapse: collapse; width: 100%; margin: 8px 0; }
          .editor-surat th, .editor-surat td { border: 1px solid #94a3b8; padding: 4px 6px; }
          .editor-surat th { background: #1F4E79; color: #fff; font-weight: 700; }
          .editor-surat table[data-gaya="data"] th,
          .editor-surat table[data-gaya="data"] td { border: none; background: transparent; color: inherit; padding: 3px; }
          .editor-surat table[data-gaya="data"] td:first-child { width: 170px; }
          .editor-surat table[data-gaya="data"] td:nth-child(2) { width: 14px; }
          .editor-surat p { margin: 0 0 8px 0; text-align: justify; }
          .editor-surat h2 { font-size: 14px; font-weight: 800; margin: 0 0 8px 0; }
          .editor-surat h4 { font-size: 13px; font-weight: 700; margin: 0 0 8px 0; }
          .editor-surat ul, .editor-surat ol { margin: 0 0 8px 0; padding-left: 22px; }
          .editor-surat ol[type="a"] { list-style-type: lower-alpha; }
          .editor-surat:empty:before { content: "Tulis badan suratnya di sini…"; color: #94a3b8; }
        `}</style>

        {/* ── kaki ───────────────────────────────────────────────────── */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            {hitung.kata} kata · {hitung.karakter} karakter · ± {halaman} halaman
          </span>
          <span>Tempelan dari Word dibersihkan otomatis; warna dan jenis huruf tidak ikut — e-office memakai gayanya sendiri.</span>
          {pesan && <span className="font-semibold text-emerald-700">✓ {pesan}</span>}
        </div>
      </div>
    </div>
  );
}
