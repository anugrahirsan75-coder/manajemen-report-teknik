"use client";
/**
 * Penormal HTML surat kustom.
 *
 * Penyunting apa pun — termasuk yang dibangun di sini — menghasilkan HTML yang
 * TIDAK layak ditempel ke e-office: tempelan dari Word membawa <span
 * class="MsoNormal">, gaya dari clipboard, font aneh, bahkan <style> utuh.
 * E-office membuang CSS-nya dan yang tersisa berantakan.
 *
 * Maka isi penyunting selalu dilewatkan ke sini dulu: pohon DOM-nya dibangun
 * ULANG dari nol memakai daftar tag yang boleh, dengan gaya INLINE yang sama
 * persis dengan template surat lain (lihat htmlHelpers.ts) plus atribut lawas
 * (border, cellpadding, bgcolor, align) sebagai cadangan. Apa pun yang tidak
 * dikenali dibuang, bukan diloloskan — surat resmi tak boleh membawa sisa
 * penanda dari aplikasi lain.
 */
import { UKURAN_ISI, UKURAN_TABEL, WARNA } from "./htmlHelpers";

/** garis & warna teks disamakan dengan template surat lain */
const GARIS = "#000000";
const TEKS = "#000000";

const GAYA_P = `margin:0 0 10px 0;text-align:justify;font-family:Arial,Helvetica,sans-serif;font-size:${UKURAN_ISI};line-height:1.5;color:${TEKS};`;
const GAYA_TABEL = `border-collapse:collapse;width:100%;table-layout:fixed;font-family:Arial,Helvetica,sans-serif;font-size:${UKURAN_TABEL};color:${TEKS};margin:0 0 10px 0;`;
const GAYA_SEL = `border:1px solid ${GARIS};padding:4px 6px;vertical-align:top;word-wrap:break-word;`;
const GAYA_KEPALA = `${GAYA_SEL}background-color:${WARNA.kepala};color:#FFFFFF;font-weight:bold;text-align:center;`;
const GAYA_LI = `margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:${UKURAN_ISI};line-height:1.5;color:${TEKS};`;

/** tabel data tanpa garis: "Label : Isi", bentuk yang dipakai blok identitas kapal */
const GAYA_TABEL_DATA = `border-collapse:collapse;width:100%;font-family:Arial,Helvetica,sans-serif;font-size:${UKURAN_ISI};color:${TEKS};margin:0 0 10px 0;`;
const GAYA_SEL_DATA = "vertical-align:top;padding:3px;";

/**
 * Judul bagian. E-office tidak mengenal <h2> dengan gaya sendiri — yang
 * bertahan hanya paragraf bergaya inline, jadi judul ditulis sebagai paragraf
 * tebal, bukan sebagai tag judul yang gayanya pasti hilang.
 */
const GAYA_JUDUL = (besar: boolean) =>
  `${GAYA_P}font-weight:bold;text-align:left;${besar ? "font-size:11pt;" : ""}`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** tag sebaris yang boleh bertahan; sisanya diambil isinya saja */
const SEBARIS: Record<string, string> = {
  B: "b", STRONG: "b", I: "i", EM: "i", U: "u", S: "s", STRIKE: "s",
  SUB: "sub", SUP: "sup", BR: "br",
};

function isiSebaris(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return esc(node.textContent || "");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const anak = Array.from(el.childNodes).map(isiSebaris).join("");

  const tag = SEBARIS[el.tagName];
  if (tag === "br") return "<br />";
  if (tag) return anak.trim() ? `<${tag}>${anak}</${tag}>` : anak;

  // gaya tebal/miring dari tempelan (mis. <span style="font-weight:700">)
  const gaya = el.getAttribute("style") || "";
  let hasil = anak;
  if (/font-weight:\s*(bold|[6-9]00)/i.test(gaya) && hasil.trim()) hasil = `<b>${hasil}</b>`;
  if (/font-style:\s*italic/i.test(gaya) && hasil.trim()) hasil = `<i>${hasil}</i>`;
  if (/text-decoration:[^;]*underline/i.test(gaya) && hasil.trim()) hasil = `<u>${hasil}</u>`;
  return hasil;
}

const rata = (el: HTMLElement): string => {
  const a = (el.getAttribute("align") || el.style.textAlign || "").toLowerCase();
  return a === "center" || a === "right" || a === "left" ? a : "";
};

/**
 * Tabel "Label : Isi" tanpa garis.
 *
 * Ditandai data-gaya="data" oleh penyunting. Tanpa penanda itu, blok identitas
 * kapal akan keluar sebagai tabel bergaris tiga kolom — bentuk yang tak pernah
 * dipakai surat dinas untuk menuliskan data.
 */
function bangunTabelData(tabel: HTMLTableElement): string {
  const baris = Array.from(tabel.querySelectorAll("tr")).map((tr) => {
    const sel = Array.from(tr.children).filter((c) => /^T[DH]$/.test(c.tagName)) as HTMLTableCellElement[];
    if (!sel.length) return "";
    const isi = (i: number) => Array.from(sel[i]?.childNodes || []).map(isiSebaris).join("").trim();
    const kiri = isi(0);
    const kanan = sel.length >= 3 ? isi(2) : isi(1);
    if (!kiri && !kanan) return "";
    return `<tr>`
      + `<td width="170" valign="top" style="width:170px;${GAYA_SEL_DATA}">${kiri || "&nbsp;"}</td>`
      + `<td width="14" valign="top" style="width:14px;${GAYA_SEL_DATA}">:</td>`
      + `<td valign="top" style="${GAYA_SEL_DATA}">${kanan || "&nbsp;"}</td>`
      + `</tr>`;
  }).filter(Boolean);
  if (!baris.length) return "";
  // penanda ikut ditulis ulang supaya bentuknya bertahan saat surat dirapikan
  // berkali-kali — tanpa itu, sekali dirapikan ia berubah jadi tabel bergaris
  return `<table data-gaya="data" border="0" cellpadding="3" cellspacing="0" width="100%" style="${GAYA_TABEL_DATA}"><tbody>${baris.join("")}</tbody></table>`;
}

function bangunTabel(tabel: HTMLTableElement): string {
  if (tabel.getAttribute("data-gaya") === "data") return bangunTabelData(tabel);
  const baris: string[] = [];
  const semuaBaris = Array.from(tabel.querySelectorAll("tr"));
  semuaBaris.forEach((tr, iBaris) => {
    const sel = Array.from(tr.children).filter((c) => /^T[DH]$/.test(c.tagName)) as HTMLTableCellElement[];
    if (!sel.length) return;
    const isi = sel.map((td) => {
      const kepala = td.tagName === "TH" || (iBaris === 0 && !!tabel.querySelector("thead"));
      const gaya = kepala ? GAYA_KEPALA : GAYA_SEL;
      const r = rata(td);
      const span = Number(td.getAttribute("colspan")) > 1 ? ` colspan="${td.getAttribute("colspan")}"` : "";
      const rspan = Number(td.getAttribute("rowspan")) > 1 ? ` rowspan="${td.getAttribute("rowspan")}"` : "";
      const isiSel = Array.from(td.childNodes).map(isiSebaris).join("").trim() || "&nbsp;";
      // atribut lawas ikut ditulis: sebagian e-office membuang CSS dan hanya
      // menghormati align/bgcolor, sehingga tabelnya tetap terbaca
      const lawas = `${r ? ` align="${r}"` : ""}${kepala ? ` bgcolor="${WARNA.kepala}"` : ""}`;
      return `<${kepala ? "th" : "td"}${span}${rspan}${lawas} style="${gaya}${r ? `text-align:${r};` : ""}">${isiSel}</${kepala ? "th" : "td"}>`;
    }).join("");
    baris.push(`<tr>${isi}</tr>`);
  });
  if (!baris.length) return "";
  return `<table border="1" cellpadding="4" cellspacing="0" style="${GAYA_TABEL}"><tbody>${baris.join("")}</tbody></table>`;
}

function bangunBlok(el: HTMLElement): string {
  switch (el.tagName) {
    case "TABLE": return bangunTabel(el as HTMLTableElement);
    case "UL":
    case "OL": {
      const li = Array.from(el.children).filter((c) => c.tagName === "LI")
        .map((c) => `<li style="${GAYA_LI}">${Array.from(c.childNodes).map(isiSebaris).join("").trim() || "&nbsp;"}</li>`)
        .join("");
      if (!li) return "";
      const tag = el.tagName.toLowerCase();
      /**
       * Jenis penomoran ikut dipertahankan. Surat dinas kerap memakai butir
       * a, b, c — kalau tipenya dibuang, seluruhnya berubah jadi 1, 2, 3 dan
       * rujukan "sebagaimana huruf b" di paragraf lain jadi menunjuk entah ke mana.
       */
      const tipe = (el.getAttribute("type") || "").toLowerCase();
      const gayaTipe = tipe === "a" ? "list-style-type:lower-alpha;"
        : tipe === "i" ? "list-style-type:lower-roman;"
          : tipe === "a".toUpperCase() ? "list-style-type:upper-alpha;" : "";
      const tipeLawas = tipe ? ` type="${tipe}"` : "";
      return `<${tag}${tipeLawas} style="margin:0 0 10px 0;padding-left:22px;${gayaTipe}">${li}</${tag}>`;
    }
    case "HR": return `<hr style="border:none;border-top:1px solid ${GARIS};margin:10px 0;" />`;
    case "H1":
    case "H2":
    case "H3":
    case "H4": {
      const isi = Array.from(el.childNodes).map(isiSebaris).join("").trim();
      return isi ? `<p style="${GAYA_JUDUL(el.tagName === "H1" || el.tagName === "H2")}">${isi}</p>` : "";
    }
    case "BLOCKQUOTE": {
      const isi = Array.from(el.childNodes).map(isiSebaris).join("").trim();
      return isi ? `<p style="${GAYA_P}margin-left:24px;">${isi}</p>` : "";
    }
    default: {
      const isi = Array.from(el.childNodes).map(isiSebaris).join("").trim();
      if (!isi) return "";
      const r = rata(el);
      return `<p style="${GAYA_P}${r ? `text-align:${r};` : ""}">${isi}</p>`;
    }
  }
}

const BLOK = new Set(["P", "DIV", "TABLE", "UL", "OL", "HR", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "PRE"]);

/**
 * Isi penyunting -> HTML siap tempel ke e-office.
 *
 * Simpul sebaris yang tercecer di luar blok (biasa terjadi saat pengguna
 * mengetik langsung di badan penyunting) dikumpulkan jadi satu paragraf,
 * bukan dibuang — kalau dibuang, kalimat yang baru diketik hilang begitu saja.
 */
export function rapikanHtmlSurat(html: string): string {
  if (typeof document === "undefined") return html;
  const wadah = document.createElement("div");
  wadah.innerHTML = html || "";
  wadah.querySelectorAll("style,script,meta,link,o\\:p").forEach((n) => n.remove());

  const keluar: string[] = [];
  let sisa: string[] = [];
  const buangSisa = () => {
    const t = sisa.join("").trim();
    if (t) keluar.push(`<p style="${GAYA_P}">${t}</p>`);
    sisa = [];
  };

  Array.from(wadah.childNodes).forEach((n) => {
    if (n.nodeType === Node.ELEMENT_NODE && BLOK.has((n as HTMLElement).tagName)) {
      buangSisa();
      const b = bangunBlok(n as HTMLElement);
      if (b) keluar.push(b);
    } else {
      sisa.push(isiSebaris(n));
    }
  });
  buangSisa();

  return keluar.join("\n");
}

/** bersihkan tempelan sebelum masuk penyunting (Word membawa banyak sekali sampah) */
export function bersihkanTempelan(html: string): string {
  const wadah = document.createElement("div");
  wadah.innerHTML = html || "";
  wadah.querySelectorAll("style,script,meta,link").forEach((n) => n.remove());
  wadah.querySelectorAll("*").forEach((el) => {
    const e = el as HTMLElement;
    // gaya tebal/miring dipertahankan lewat rapikanHtmlSurat; sisanya dibuang
    const gaya = e.getAttribute("style") || "";
    const simpan = [
      /font-weight:\s*(bold|[6-9]00)/i.test(gaya) ? "font-weight:bold;" : "",
      /font-style:\s*italic/i.test(gaya) ? "font-style:italic;" : "",
      /text-decoration:[^;]*underline/i.test(gaya) ? "text-decoration:underline;" : "",
      /text-align:\s*(center|right)/i.test(gaya) ? `text-align:${/center/i.test(gaya) ? "center" : "right"};` : "",
    ].join("");
    Array.from(e.attributes).forEach((a) => {
      if (!["colspan", "rowspan", "align"].includes(a.name)) e.removeAttribute(a.name);
    });
    if (simpan) e.setAttribute("style", simpan);
  });
  return wadah.innerHTML;
}
