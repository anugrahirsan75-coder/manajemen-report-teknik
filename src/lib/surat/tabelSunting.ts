/**
 * Ubah susunan tabel di surat yang sedang disunting tangan: sisip/hapus baris,
 * sisip/hapus kolom, sisip tabel baru, hapus tabel.
 *
 * BEDANYA DENGAN PERKAKAS TABEL DI EditorSurat. Di sana isi penyunting selalu
 * dilewatkan penormal sebelum jadi keluaran, jadi sel baru boleh polos. Di
 * pratinjau surat ber-template, HTML yang disunting ADALAH HTML final e-office:
 * garis, warna kepala, lebar, dan perataan ditulis inline di tiap sel dan tidak
 * ada yang memasangnya lagi sesudahnya. Sel polos di sini berarti sel tanpa
 * garis di surat yang terbit. Maka sel baru selalu DISALIN dari sel tetangganya
 * (atribut + style), hanya isinya yang dikosongkan.
 *
 * LEBAR KOLOM. Tabel surat memakai table-layout:fixed dengan lebar persen yang
 * jumlahnya 100%. Kolom baru tanpa lebar akan mendapat sisa nol; kolom baru
 * yang menyalin lebar tetangga membuat jumlahnya lewat 100% dan tabel keluar
 * kertas. Jadi lebar tetangga DIBAGI DUA dengan kolom baru, dan lebar kolom
 * yang dihapus DIBERIKAN ke tetangganya — jumlahnya tetap.
 *
 * Semua posisi dihitung dari PETA tabel (kisi logis), bukan urutan anak <tr>,
 * supaya sel bergabung (colspan/rowspan) tidak membuat kolom bergeser.
 *
 * Gaya diubah lewat teks atribut style, bukan el.style: CSSOM menulis ulang
 * seluruh atribut (warna hex jadi rgb(), urutan berubah) dan hasilnya tidak
 * lagi sama dengan yang dihasilkan pembangun surat.
 */
import { baris, tabel, td, th } from "./htmlHelpers";

type Sel = HTMLTableCellElement;

export interface Peta {
  baris: HTMLTableRowElement[];
  /** grid[r][c] = sel yang menutupi baris r kolom c */
  grid: (Sel | undefined)[][];
  lebar: number;
}

export function petaTabel(t: HTMLTableElement): Peta {
  const rows = Array.from(t.rows);
  const grid: (Sel | undefined)[][] = rows.map(() => []);
  rows.forEach((tr, r) => {
    let c = 0;
    for (const sel of Array.from(tr.cells)) {
      while (grid[r][c]) c++;
      const rs = Math.max(1, sel.rowSpan || 1);
      const cs = Math.max(1, sel.colSpan || 1);
      for (let i = 0; i < rs && r + i < rows.length; i++)
        for (let j = 0; j < cs; j++) grid[r + i][c + j] = sel;
      c += cs;
    }
  });
  return { baris: rows, grid, lebar: Math.max(0, ...grid.map((g) => g.length)) };
}

function posisi(p: Peta, sel: Sel): { r: number; c: number } | null {
  for (let r = 0; r < p.grid.length; r++) {
    const c = p.grid[r].indexOf(sel);
    if (c >= 0) return { r, c };
  }
  return null;
}

/** kolom paling kiri yang ditempati sel di baris r */
const awalKolom = (p: Peta, r: number, sel: Sel) => p.grid[r]?.indexOf(sel) ?? -1;

function aturRentang(s: Sel, nama: "rowspan" | "colspan", n: number) {
  if (n > 1) s.setAttribute(nama, String(n));
  else s.removeAttribute(nama);
}

/* ── gaya inline, lewat teks atribut ─────────────────────────────────────── */

function bacaGaya(el: Element, prop: string): string {
  for (const bagian of (el.getAttribute("style") || "").split(";")) {
    const i = bagian.indexOf(":");
    if (i > 0 && bagian.slice(0, i).trim().toLowerCase() === prop) return bagian.slice(i + 1).trim();
  }
  return "";
}

function aturGaya(el: Element, prop: string, nilai: string | null) {
  const sisa = (el.getAttribute("style") || "").split(";").map((s) => s.trim()).filter(Boolean)
    .filter((s) => s.slice(0, s.indexOf(":")).trim().toLowerCase() !== prop);
  if (nilai !== null) sisa.push(`${prop}:${nilai}`);
  if (sisa.length) el.setAttribute("style", sisa.join(";") + ";");
  else el.removeAttribute("style");
}

interface Lebar { n: number; u: string }

function bacaLebar(sel: Sel): Lebar | null {
  const m = /^\s*([\d.]+)\s*(%|px)?\s*$/.exec(bacaGaya(sel, "width") || sel.getAttribute("width") || "");
  return m ? { n: parseFloat(m[1]), u: m[2] || "px" } : null;
}

function pasangLebar(sel: Sel, l: Lebar | null) {
  if (!l) { sel.removeAttribute("width"); aturGaya(sel, "width", null); return; }
  const n = Math.round(l.n * 10) / 10;
  sel.setAttribute("width", l.u === "%" ? `${n}%` : String(Math.round(n)));
  aturGaya(sel, "width", `${n}${l.u}`);
}

/* ── sel baru ────────────────────────────────────────────────────────────── */

/**
 * Isi kosong yang tetap membawa pembungkus format sel acuan. Sel kepala ditulis
 * <font color="#FFFFFF"><b>…</b></font>; kalau isinya dikosongkan jadi <br>
 * begitu saja, teks yang diketik kemudian berwarna hitam di atas kepala biru tua.
 */
function isiKosong(acuan: Element): string {
  const rantai: Element[] = [];
  let n: Element = acuan;
  for (;;) {
    const anak = Array.from(n.childNodes).filter((x) => !(x.nodeType === 3 && !(x.textContent || "").trim()));
    if (anak.length !== 1 || anak[0].nodeType !== 1) break;
    const el = anak[0] as Element;
    if (!/^(FONT|B|STRONG|I|EM|U|SPAN)$/.test(el.tagName)) break;
    rantai.push(el);
    n = el;
  }
  let html = "<br>";
  for (const w of rantai.reverse()) {
    const k = w.cloneNode(false) as Element;
    k.innerHTML = html;
    html = k.outerHTML;
  }
  return html;
}

function selBaru(acuan: Sel, o: { tag?: "td" | "th"; bawaLebar?: boolean; polos?: boolean } = {}): Sel {
  const baru = document.createElement(o.tag || (acuan.tagName.toLowerCase() as "td" | "th")) as Sel;
  for (const a of Array.from(acuan.attributes)) {
    if (a.name === "id" || a.name === "rowspan" || a.name === "colspan") continue;
    baru.setAttribute(a.name, a.value);
  }
  if (!o.bawaLebar) pasangLebar(baru, null);
  if (o.polos) {
    // sel isi yang dicontoh dari sel kepala: buang warna kepala, sisakan garis & padding
    baru.removeAttribute("bgcolor");
    aturGaya(baru, "background-color", null);
    aturGaya(baru, "background", null);
    aturGaya(baru, "color", null);
    aturGaya(baru, "font-weight", null);
    baru.innerHTML = "<br>";
  } else {
    baru.innerHTML = isiKosong(acuan);
  }
  return baru;
}

const barisJudul = (tr: HTMLTableRowElement | undefined) =>
  !!tr && (tr.parentElement?.tagName === "THEAD"
    || (tr.cells.length > 0 && Array.from(tr.cells).every((c) => c.tagName === "TH")));

/* ── operasi ─────────────────────────────────────────────────────────────── */

/**
 * Sisip baris di atas/bawah baris sel. Hasilnya sel pertama baris baru — tempat
 * kursor ditaruh.
 *
 * Contoh baris yang disalin: sisip di BAWAH menyalin baris itu sendiri; sisip di
 * ATAS menyalin baris di atasnya bila ada. Alasannya baris jumlah di ujung
 * tabel (latar kuning, tebal): orang mengklik baris jumlah lalu "sisip di atas"
 * untuk menambah rincian — yang diinginkan baris rincian, bukan baris kuning
 * kedua.
 */
export function sisipBaris(sel: Sel, bawah: boolean): Sel | null {
  const t = sel.closest("table");
  if (!t) return null;
  const p = petaTabel(t);
  const pos = posisi(p, sel);
  if (!pos) return null;

  const rAcuan = bawah ? pos.r + Math.max(1, sel.rowSpan || 1) - 1 : pos.r;
  const trAcuan = p.baris[rAcuan];
  const acuanJudul = barisJudul(trAcuan);
  const jadiJudul = acuanJudul && !bawah;

  let rContoh = rAcuan;
  if (acuanJudul && bawah) {
    const k = p.baris.findIndex((tr, i) => i > rAcuan && !barisJudul(tr));
    if (k >= 0) rContoh = k;
  } else if (!bawah && !acuanJudul && rAcuan > 0 && !barisJudul(p.baris[rAcuan - 1])) {
    rContoh = rAcuan - 1;
  }
  const trContoh = p.baris[rContoh];
  const contohJudul = barisJudul(trContoh);

  // batas sisip: di antara baris a (atas) dan b (bawah)
  const a = bawah ? rAcuan : rAcuan - 1;
  const b = a + 1;
  const trBaru = trContoh.cloneNode(false) as HTMLTableRowElement;
  const diperpanjang = new Set<Sel>();
  let pertama: Sel | null = null;

  for (let c = 0; c < p.lebar;) {
    const atas = a >= 0 ? p.grid[a]?.[c] : undefined;
    const bawahnya = b < p.baris.length ? p.grid[b]?.[c] : undefined;
    if (atas && atas === bawahnya) {
      // sel gabungan-ke-bawah melintasi batas: cukup diperpanjang satu baris
      if (!diperpanjang.has(atas)) { aturRentang(atas, "rowspan", (atas.rowSpan || 1) + 1); diperpanjang.add(atas); }
      let d = c + 1;
      while (d < p.lebar && p.grid[a][d] === atas) d++;
      c = d;
      continue;
    }
    const contoh = p.grid[rContoh]?.[c];
    if (!contoh) { c++; continue; }
    let d = c + 1;
    while (d < p.lebar && p.grid[rContoh][d] === contoh) d++;
    const baru = selBaru(contoh, {
      bawaLebar: true,
      tag: jadiJudul ? undefined : "td",
      polos: contohJudul && !jadiJudul,
    });
    if (d - c > 1) aturRentang(baru, "colspan", d - c);
    trBaru.appendChild(baru);
    pertama ??= baru;
    c = d;
  }

  if (bawah && acuanJudul && !jadiJudul && t.tBodies[0] && trAcuan.parentElement?.tagName === "THEAD") {
    t.tBodies[0].insertBefore(trBaru, t.tBodies[0].firstChild);
  } else if (bawah) {
    trAcuan.after(trBaru);
  } else {
    trAcuan.before(trBaru);
  }
  return pertama;
}

/** Hapus baris sel. Hasilnya sel tujuan kursor, atau null bila tabel ikut habis. */
export function hapusBaris(sel: Sel): Sel | null {
  const t = sel.closest("table");
  if (!t) return null;
  const p = petaTabel(t);
  const pos = posisi(p, sel);
  if (!pos) return null;
  if (p.baris.length <= 1) { t.remove(); return null; }

  const r = pos.r;
  const tr = p.baris[r];
  const berikut = p.baris[r + 1];
  const sudah = new Set<Sel>();
  for (let c = 0; c < p.lebar; c++) {
    const s = p.grid[r][c];
    if (!s || sudah.has(s)) continue;
    sudah.add(s);
    if (s.parentElement !== tr) {               // mulai di baris atas, melintas ke sini
      aturRentang(s, "rowspan", (s.rowSpan || 1) - 1);
    } else if ((s.rowSpan || 1) > 1 && berikut) { // mulai di sini, melintas ke bawah: pindahkan
      aturRentang(s, "rowspan", s.rowSpan - 1);
      const acuan = Array.from(berikut.cells).find((x) => awalKolom(p, r + 1, x) > c) || null;
      berikut.insertBefore(s, acuan);
    }
  }
  tr.remove();
  const tujuan = p.grid[r + 1]?.[pos.c] || p.grid[r - 1]?.[pos.c] || null;
  return tujuan && t.contains(tujuan) ? tujuan : (t.querySelector("td,th") as Sel | null);
}

/** Sisip kolom di kiri/kanan sel. Hasilnya sel baru di baris yang sama. */
export function sisipKolom(sel: Sel, kanan: boolean): Sel | null {
  const t = sel.closest("table");
  if (!t) return null;
  const p = petaTabel(t);
  const pos = posisi(p, sel);
  if (!pos) return null;

  let rentang = 1;
  while (pos.c + rentang < p.lebar && p.grid[pos.r][pos.c + rentang] === sel) rentang++;
  const k = kanan ? pos.c + rentang : pos.c;      // indeks kolom baru
  const dilebarkan = new Set<Sel>();
  let fokus: Sel | null = null;

  p.baris.forEach((tr, r) => {
    const kiri = k > 0 ? p.grid[r][k - 1] : undefined;
    const kananSel = k < p.lebar ? p.grid[r][k] : undefined;
    if (kiri && kiri === kananSel) {
      // sel gabungan-ke-samping melintasi titik sisip: cukup dilebarkan
      if (!dilebarkan.has(kiri)) { aturRentang(kiri, "colspan", (kiri.colSpan || 1) + 1); dilebarkan.add(kiri); }
      return;
    }
    const contoh = kanan ? (kiri ?? kananSel) : (kananSel ?? kiri);
    if (!contoh) return;
    // sel gabungan-ke-bawah: sel barunya dibuat sekali di baris awalnya, ikut menggabung
    if (contoh.parentElement !== tr) return;
    const baru = selBaru(contoh);
    if ((contoh.rowSpan || 1) > 1) aturRentang(baru, "rowspan", contoh.rowSpan);
    const sebelum = Array.from(tr.cells).find((x) => awalKolom(p, r, x) >= k) || null;
    tr.insertBefore(baru, sebelum);
    if ((contoh.colSpan || 1) <= 1) {
      const l = bacaLebar(contoh);
      if (l) { const h = { n: l.n / 2, u: l.u }; pasangLebar(contoh, h); pasangLebar(baru, h); }
    }
    if (r === pos.r) fokus = baru;
  });
  return fokus;
}

/** Hapus kolom tempat sel berada. Hasilnya sel tujuan kursor, atau null bila tabel habis. */
export function hapusKolom(sel: Sel): Sel | null {
  const t = sel.closest("table");
  if (!t) return null;
  const p = petaTabel(t);
  const pos = posisi(p, sel);
  if (!pos) return null;
  if (p.lebar <= 1) { t.remove(); return null; }

  const k = pos.c;
  const sudah = new Set<Sel>();
  const diberi = new Set<Sel>();
  p.baris.forEach((_, r) => {
    const s = p.grid[r][k];
    if (!s || sudah.has(s)) return;
    sudah.add(s);
    if ((s.colSpan || 1) > 1) { aturRentang(s, "colspan", s.colSpan - 1); return; }
    // Lebarnya diberikan ke satu tetangga supaya jumlah lebar tetap. Tetangga
    // yang lebarnya KEMBAR didahulukan: itu pasangan bagi-dua saat kolom ini
    // disisipkan, jadi sisip lalu hapus mengembalikan lebar semula. Kalau tak
    // ada yang kembar, yang lebih lebar menerimanya (biasanya kolom uraian).
    const l = bacaLebar(s);
    if (l) {
      const calon = [k > 0 ? p.grid[r][k - 1] : undefined, p.grid[r][k + 1]]
        .filter((x): x is Sel => !!x && x !== s && (x.colSpan || 1) <= 1 && !diberi.has(x))
        .map((x) => ({ x, l: bacaLebar(x) }))
        .filter((c): c is { x: Sel; l: Lebar } => !!c.l && c.l.u === l.u);
      const pilih = calon.find((c) => Math.abs(c.l.n - l.n) < 0.05)
        || calon.sort((a, b) => b.l.n - a.l.n)[0];
      if (pilih) { pasangLebar(pilih.x, { n: pilih.l.n + l.n, u: l.u }); diberi.add(pilih.x); }
    }
    s.remove();
  });
  if (!t.querySelector("td,th")) { t.remove(); return null; }
  const tujuan = p.grid[pos.r][k + 1] || p.grid[pos.r][k - 1] || null;
  return tujuan && t.contains(tujuan) ? tujuan : (t.querySelector("td,th") as Sel | null);
}

/** Tabel baru bergaya e-office (kepala biru, garis hitam), lebar kolom dibagi rata. */
export function htmlTabelBaru(jumlahBaris: number, kolom: number): string {
  const lebar = `${Math.round(1000 / kolom) / 10}%`;
  const kepala = baris(Array.from({ length: kolom }, (_, i) => th(`Judul ${i + 1}`, { width: lebar })));
  const isi = Array.from({ length: jumlahBaris }, () =>
    baris(Array.from({ length: kolom }, () => td("", { width: lebar }))));
  return tabel(isi, kepala);
}
