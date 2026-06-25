// OCR tabel item SPPBJ dari screenshot Excel (client-side, tesseract.js).
// Rekonstruksi kolom via bounding-box + deteksi baris kapal (header) & rincian (breakdown).
import { createWorker } from "tesseract.js";
import { preprocessImage } from "./imagePrep";

export interface ParsedItem {
  kapal: string;
  jumlah: number;
  satuan: string;
  nama: string;
  spesifikasi: string;
  harga: number;
  keterangan?: string;   // header/kategori di ATAS item (mis. "ME, Merk : MITSUBISHI…")
  breakdown?: string[];  // rincian di BAWAH item
  warn?: boolean;        // harga meragukan (mismatch qty×harga vs total / harga kosong) -> perlu cek
}

interface Word { text: string; x0: number; x1: number; xc: number; }
interface Line { y: number; words: Word[]; text: string; }

const toInt = (s: string) => { const d = (s || "").replace(/[^\d]/g, ""); return d ? parseInt(d, 10) : 0; };
const isShip = (s: string) => /\bKM[PT]\b|\bKMP\.?/i.test(s);

// kumpulkan baris+kata dari hasil tesseract (blocks -> paragraphs -> lines -> words)
function collectLines(data: any): Line[] {
  const lines: Line[] = [];
  const pushLine = (ln: any) => {
    const words: Word[] = (ln.words || [])
      .filter((w: any) => (w.text || "").trim() && (w.confidence ?? 100) >= 35) // buang kata sampah confidence rendah
      .map((w: any) => ({ text: w.text.trim(), x0: w.bbox?.x0 ?? 0, x1: w.bbox?.x1 ?? 0, xc: ((w.bbox?.x0 ?? 0) + (w.bbox?.x1 ?? 0)) / 2 }));
    if (!words.length) return;
    const y = (ln.bbox?.y0 ?? 0 + (ln.bbox?.y1 ?? 0)) / 2;
    lines.push({ y, words, text: words.map((w) => w.text).join(" ") });
  };
  if (data.blocks?.length) {
    for (const b of data.blocks) for (const p of (b.paragraphs || [])) for (const ln of (p.lines || [])) pushLine(ln);
  } else if (data.lines?.length) {
    for (const ln of data.lines) pushLine(ln);
  }
  return lines.sort((a, b) => a.y - b.y);
}

// boundaries kolom dari baris header (No|Jumlah|Satuan|Nama|Spesifikasi|Harga Satuan|Jumlah)
function headerBoundaries(lines: Line[]): number[] | null {
  const h = lines.find((l) => {
    const t = l.text.toLowerCase();
    return /\bno\b/.test(t) && (t.includes("jumlah") || t.includes("satuan")) && t.includes("nama");
  });
  if (!h) return null;
  const anchorX: number[] = [];
  const find = (re: RegExp) => h.words.find((w) => re.test(w.text.toLowerCase()))?.xc;
  for (const re of [/^no/i, /jumlah/i, /satuan/i, /nama|barang/i, /spesifikasi|ukuran/i, /harga/i]) {
    const x = h.words.find((w) => re.test(w.text.toLowerCase()))?.xc;
    if (x != null) anchorX.push(x);
  }
  const uniq = Array.from(new Set(anchorX)).sort((a, b) => a - b);
  if (uniq.length < 4) return null;
  const bounds: number[] = [];
  for (let i = 0; i < uniq.length - 1; i++) bounds.push((uniq[i] + uniq[i + 1]) / 2);
  return bounds; // n-1 boundaries -> n kolom
}

// pecah kata sebuah baris jadi sel berdasar boundaries x
function splitCols(line: Line, bounds: number[]): string[] {
  const cells: string[] = new Array(bounds.length + 1).fill("");
  for (const w of line.words) {
    let col = 0;
    while (col < bounds.length && w.xc > bounds[col]) col++;
    cells[col] = (cells[col] ? cells[col] + " " : "") + w.text;
  }
  return cells.map((c) => c.trim());
}

// fallback tanpa header: No=int depan, 2 angka besar di kanan = harga satuan & jumlah
function parseFallback(line: Line): { no: number; qty: number; sat: string; nama: string; spek: string; harga: number } | null {
  const toks = line.words.map((w) => w.text);
  if (!toks.length) return null;
  const no = toInt(toks[0]);
  const bigNums = toks.map((t) => t.replace(/[^\d]/g, "")).map((d, i) => ({ d, i })).filter((x) => x.d.length >= 4);
  const harga = bigNums.length ? parseInt(bigNums[bigNums.length >= 2 ? bigNums.length - 2 : 0].d, 10) : 0;
  const qty = toks[1] && /^\d{1,3}$/.test(toks[1]) ? parseInt(toks[1], 10) : 1;
  const sat = toks[2] && /^[a-z]{1,6}$/i.test(toks[2]) ? toks[2] : "unit";
  const stop = bigNums.length ? bigNums[bigNums.length >= 2 ? bigNums.length - 2 : 0].i : toks.length;
  const nama = toks.slice(3, stop).join(" ");
  return { no, qty, sat, nama, spek: "", harga };
}

// koreksi harga pakai redundansi kolom total (qty × harga ≈ total).
function fixHarga(qty: number, harga: number, total: number): { harga: number; warn: boolean } {
  if (total > 0 && qty > 0) {
    if (harga === 0) return { harga: Math.round(total / qty), warn: false };
    if (Math.abs(qty * harga - total) > Math.max(total * 0.02, 500)) return { harga: Math.round(total / qty), warn: true };
    return { harga, warn: false };
  }
  return { harga, warn: harga === 0 };
}

export async function ocrTableItems(file: File | Blob, onProgress?: (p: number) => void): Promise<ParsedItem[]> {
  let input: Blob = file;
  try { input = await preprocessImage(file); } catch { /* pakai gambar asli bila prep gagal */ }
  const worker = await createWorker("eng", 1, {
    logger: (m) => { if (m.status === "recognizing text" && onProgress) onProgress(Math.round(m.progress * 100)); },
  });
  let data: any;
  try {
    await worker.setParameters({ tessedit_pageseg_mode: "4" as any, preserve_interword_spaces: "1" });
    const r = await worker.recognize(input as any, {}, { blocks: true, text: true } as any);
    data = r.data;
  } finally { await worker.terminate(); }

  const lines = collectLines(data);
  if (!lines.length) return [];
  const bounds = headerBoundaries(lines);
  // buang baris header & baris kosong angka kolom
  const headerIdx = lines.findIndex((l) => {
    const t = l.text.toLowerCase();
    return /\bno\b/.test(t) && t.includes("nama");
  });

  // 1) klasifikasi tiap baris: ship | item | text
  type Cls = { type: "ship" | "item" | "text" | "skip"; text?: string; item?: Omit<ParsedItem, "kapal"> };
  const classified: Cls[] = lines.map((line, idx) => {
    if (idx === headerIdx) return { type: "skip" };
    const t = line.text.trim();
    if (!t) return { type: "skip" };
    const tl = t.toLowerCase();
    // skip baris-baris header/judul tabel & baris total
    if (/estimasi harga|harga satuan|nama barang.*spesifikasi|^no\s+jumlah|^total\b/i.test(t)) return { type: "skip" };
    if (/^(jumlah|satuan|spesifikasi|nama barang|harga|no)$/i.test(tl)) return { type: "skip" };
    if (/^jumlah\b[\s\S]*\d{3}/i.test(t)) return { type: "skip" };
    if (isShip(t) && !/^\d/.test(t)) return { type: "ship", text: t.replace(/\s{2,}/g, " ").trim() };

    if (bounds) {
      const c = splitCols(line, bounds); // [No,Jumlah,Satuan,Nama,Spek,Harga,(Total)]
      const no = toInt(c[0]);
      const namaCell = (c[3] || "").trim();
      if (no > 0 && (namaCell || c[4])) {
        const qty = toInt(c[1]) || 1;
        const { harga, warn } = fixHarga(qty, toInt(c[5]), toInt(c[6]));
        return { type: "item", item: { jumlah: qty, satuan: (c[2] || "unit").trim(), nama: namaCell, spesifikasi: (c[4] || "").trim(), harga, ...(warn ? { warn: true } : {}) } };
      }
    } else if (/^\d/.test(t)) {
      const p = parseFallback(line);
      if (p && p.nama) return { type: "item", item: { jumlah: p.qty, satuan: p.sat, nama: p.nama, spesifikasi: p.spek, harga: p.harga, ...(p.harga === 0 ? { warn: true } : {}) } };
    }
    return { type: "text", text: t };
  });

  // baris kategori mesin (mis. "ME, Merk : MITSUBISHI…", "AE …") -> header di ATAS item
  const isCategory = (s: string) => /^(M\.?E|A\.?E|MESIN|MAIN ENGINE|AUX|AUXILIARY)\b/i.test(s) && (s.includes(":") || /merk/i.test(s));

  // 2) rakit jadi item; teks SEBELUM item -> keterangan(atas), SESUDAH item -> breakdown(bawah)
  const items: ParsedItem[] = [];
  let kapal = "";
  let last: ParsedItem | null = null;
  let pendingKet: string[] = [];

  for (const cl of classified) {
    if (cl.type === "skip") continue;
    if (cl.type === "ship") { kapal = cl.text!; last = null; continue; }
    if (cl.type === "item") {
      last = { kapal, ...cl.item!, ...(pendingKet.length ? { keterangan: pendingKet.join("\n") } : {}) };
      // selamatkan part-number yg ke-gabung di nama -> spesifikasi (saat spek kosong)
      if (!last.spesifikasi) {
        const m = last.nama.match(/^(.*\S)\s+([0-9][0-9A-Za-z.\/-]{4,})$/);
        if (m && /\d/.test(m[2])) { last.nama = m[1].trim(); last.spesifikasi = m[2]; }
      }
      items.push(last);
      pendingKet = [];
      continue;
    }
    // type === "text"
    const t = cl.text!;
    if (isCategory(t)) { pendingKet.push(t); last = null; }      // kategori baru -> keterangan utk item berikut
    else if (!last) pendingKet.push(t);                          // teks sebelum item pertama -> keterangan
    else (last.breakdown ||= []).push(t);                        // teks setelah item -> breakdown
  }

  for (const it of items) if (it.breakdown) it.breakdown = it.breakdown.filter((b) => b.trim());
  return items;
}
