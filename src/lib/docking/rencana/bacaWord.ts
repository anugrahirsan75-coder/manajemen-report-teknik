"use client";
/**
 * Baca borang permintaan kapal berbentuk Word (.docx).
 *
 * Berbeda dengan PDF pindaian yang harus "dilihat" model AI, berkas Word masih
 * punya lapisan teks — jadi dibaca langsung dari XML-nya: seketika, tanpa
 * Ollama, dan tanpa risiko salah baca. Kalau kapal mengirim Word, inilah jalur
 * yang dipakai.
 *
 * Yang dicari: TABEL di dalam dokumen. Dua borang baku punya susunan kolom
 * berbeda, jadi kolomnya dikenali dari baris kepala tabelnya sendiri —
 * bukan ditebak dari urutan — supaya tetap benar bila kapal menggeser kolom.
 *
 *   TF-102.01.01  NO. | URAIAN | VOLUME (Qty|Unit) | HARGA SATUAN | KETERANGAN
 *   HP-103.00.01  No | Jumlah | Satuan | Merk/Katalog | Uraian/Spesifikasi
 */
import PizZip from "pizzip";
import { HasilBorang, BarisBorang, JenisBorang } from "./borang";

/** buang tag XML, satukan spasi; <w:br> & akhir paragraf jadi baris baru */
function teksDari(xml: string): string {
  return xml
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t ]+/g, " ")
    .split("\n").map((x) => x.trim()).filter(Boolean).join("\n")
    .trim();
}

const potongSemua = (xml: string, tag: string): string[] => {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
};

/** satu tabel -> larik baris -> larik sel (teks) */
function tabelJadiBaris(xmlTabel: string): string[][] {
  return potongSemua(xmlTabel, "w:tr").map((tr) =>
    potongSemua(tr, "w:tc").map((tc) => teksDari(tc)),
  );
}

/**
 * Berkas kapal mencampur dua gaya angka: "512.52" (titik = desimal) dan
 * "1.250" (titik = pemisah ribuan). Aturannya: kalau ada koma, koma-lah
 * desimalnya dan titik dibuang; kalau tak ada koma, titik dianggap desimal
 * hanya bila angka di belakangnya 1-2 digit — selain itu pemisah ribuan.
 */
const angka = (v: string) => {
  let t = String(v || "").replace(/[^\d.,-]/g, "").trim();
  if (!t) return 0;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else {
    const bagi = t.split(".");
    t = bagi.length > 1 && bagi[bagi.length - 1].length <= 2
      ? `${bagi.slice(0, -1).join("")}.${bagi[bagi.length - 1]}`
      : bagi.join("");
  }
  const n = parseFloat(t);
  return isFinite(n) ? n : 0;
};

interface PetaKolom { no: number; uraian: number; qty: number; unit: number; merk: number; ket: number }

/**
 * Kenali arti tiap kolom dari baris kepala. Beberapa borang memakai kepala dua
 * baris (VOLUME lalu Qty|Unit), jadi dua baris pertama digabung dulu.
 */
function petaKolom(baris: string[][]): { peta: PetaKolom; mulai: number; jenis: JenisBorang } | null {
  for (let i = 0; i < Math.min(4, baris.length); i++) {
    // Kepala kolom kerap ditulis berspasi ("U R A I A N", "N O ."), jadi
    // dicocokkan dalam dua bentuk: apa adanya dan tanpa spasi sama sekali.
    const gabung = baris[i].map((sel, k) =>
      `${sel} ${baris[i + 1]?.[k] || ""}`.toLowerCase().replace(/\s+/g, " ").trim());
    const rapat = gabung.map((x) => x.replace(/\s+/g, ""));
    const cari = (re: RegExp) => {
      const a = gabung.findIndex((x) => re.test(x));
      return a >= 0 ? a : rapat.findIndex((x) => re.test(x));
    };
    const uraian = cari(/uraian|deskripsi|nama barang|nama pekerjaan|jenis pekerjaan|pekerjaan|rincian|item/);
    if (uraian < 0) continue;
    const qty = cari(new RegExp(String.raw`qty|jumlah|volume|vol\b|banyak`));
    const unit = cari(/unit|satuan|sat\.?$/);
    const merk = cari(/merk|katalog/);
    const ket = cari(/keterangan|ket\.?$/);
    const no = cari(/^no\.?$|^no |^nomor/);
    // borang permintaan punya kolom Merk/Katalog; RL punya kolom Harga Satuan
    const jenis: JenisBorang = merk >= 0 ? "permintaan" : "rl";
    // kepala dua baris: lompati baris kedua bila memang bagian dari kepala
    const duaBaris = baris[i + 1]?.some((x) => /^(qty|unit)$/i.test(x.trim()));
    return {
      peta: { no, uraian, qty, unit, merk, ket },
      mulai: i + (duaBaris ? 2 : 1),
      jenis,
    };
  }
  return null;
}

/**
 * Kalau kepala tabelnya tak dikenali (kapal kerap memakai judul kolom sendiri,
 * atau tabelnya tanpa kepala sama sekali), susunan kolom ditebak dari ISI
 * barisnya: kolom mana yang teksnya paling panjang = uraian, kolom mana yang
 * isinya satuan baku = unit, angka di sebelah kirinya = volume.
 */
const SATUAN_BAKU = /^(ls|bh|buah|unit|set|pcs|pcs\.|hari|ton|liter|ltr|lbr|lembar|kg|m|m2|m²|m3|m³|meter|btg|batang|roll|kaleng|paket|pkt|orang|org|titik|ea)$/i;

function tebakKolom(baris: string[][]): { peta: PetaKolom; mulai: number } | null {
  const data = baris.filter((r) => r.filter(Boolean).length >= 3);
  if (data.length < 3) return null;
  const lebar = Math.max(...data.map((r) => r.length));
  const nilai = (k: number) => data.map((r) => (r[k] || "").trim());

  let uraian = -1, panjangTerbaik = 0;
  let unit = -1, satuanTerbanyak = 0;
  for (let k = 0; k < lebar; k++) {
    const isi = nilai(k).filter(Boolean);
    if (!isi.length) continue;
    const rata = isi.reduce((s2, x) => s2 + x.length, 0) / isi.length;
    if (rata > panjangTerbaik && rata > 12) { panjangTerbaik = rata; uraian = k; }
    const satuan = isi.filter((x) => SATUAN_BAKU.test(x)).length / isi.length;
    if (satuan > satuanTerbanyak && satuan > 0.4) { satuanTerbanyak = satuan; unit = k; }
  }
  if (uraian < 0) return null;

  // volume: kolom angka terdekat di kiri kolom satuan (kalau satuannya ketemu)
  let qty = -1;
  const angkaBanyak = (k: number) => {
    const isi = nilai(k).filter(Boolean);
    return isi.length ? isi.filter((x) => /^[\d.,]+$/.test(x)).length / isi.length : 0;
  };
  if (unit > 0 && angkaBanyak(unit - 1) > 0.4) qty = unit - 1;
  else for (let k = uraian + 1; k < lebar; k++) if (angkaBanyak(k) > 0.5) { qty = k; break; }

  const no = uraian > 0 ? uraian - 1 : -1;
  return { peta: { no, uraian, qty, unit, merk: -1, ket: -1 }, mulai: 0 };
}

/** baris judul bagian: sel terisi cuma satu-dua & bertulisan huruf besar */
function judulBagian(sel: string[]): string {
  const isi = sel.map((x) => x.trim()).filter(Boolean);
  if (!isi.length || isi.length > 2) return "";
  const t = isi.join(" ");
  if (t.length < 4 || t.length > 90) return "";
  const huruf = t.replace(/[^A-Za-z]/g, "");
  if (!huruf) return "";
  const besar = (t.match(/[A-Z]/g) || []).length / huruf.length;
  return besar > 0.7 ? t : "";
}

const ROMAWI = /^([IVXL]+)[.)]?\s+(.*)$/;

export function bacaDocx(buf: ArrayBuffer): HasilBorang {
  const zip = new PizZip(buf);
  const xml = zip.file("word/document.xml")?.asText() || "";
  if (!xml) throw new Error("Bukan berkas Word yang bisa dibaca (word/document.xml tak ada).");

  const semuaTeks = teksDari(xml);
  const jenisDoc: JenisBorang =
    /HP\s*-?\s*103\.00\.01|PERMINTAAN PENGADAAN/i.test(semuaTeks) ? "permintaan"
      : /TF\s*-?\s*102\.01\.01|DAFTAR PEKERJAAN DOCKING/i.test(semuaTeks) ? "rl"
      : "";
  const kapal = (semuaTeks.match(/KMP\.?\s+[A-Z][A-Z .]+/)?.[0] || "").trim();
  const noSurat = (semuaTeks.match(/\b\d{2,4}\s*\/\s*[A-Z0-9]+\s*\/[^\s\n]*/)?.[0] || "").trim();
  const tanggal = (semuaTeks.match(/\b\d{1,2}\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}/i)?.[0] || "").trim();

  const baris: BarisBorang[] = [];
  let jenis: JenisBorang = jenisDoc;

  const tabel = potongSemua(xml, "w:tbl");
  const bukti: string[] = [];   // kepala tabel yang terlihat, untuk pesan galat

  tabel.forEach((tbl) => {
    const isi = tabelJadiBaris(tbl);
    if (isi.length) bukti.push(isi[0].filter(Boolean).join(" | ").slice(0, 90));
    // tabel kecil (identitas kapal, tanda tangan) tak perlu diurai
    if (isi.length < 4) return;
    const kepala = petaKolom(isi) || tebakKolom(isi);
    if (!kepala) return;
    if (!jenis && "jenis" in kepala) jenis = (kepala as any).jenis;
    const { peta } = kepala;
    let bagian = "", romawi = "";

    for (let i = kepala.mulai; i < isi.length; i++) {
      const sel = isi[i];
      const judul = judulBagian(sel);
      if (judul) {
        const m = judul.match(ROMAWI) || judul.match(/^([A-Z])[.)]?\s+(.*)$/);
        if (m) { romawi = m[1]; bagian = m[2].trim(); } else { romawi = ""; bagian = judul; }
        continue;
      }
      const uraian = (sel[peta.uraian] || "").trim();
      if (!uraian) continue;
      // Kolom No berisi penanda bagian (huruf A/B/C atau romawi) sementara
      // volumenya kosong = baris judul bagian, bukan pekerjaan. Ini pola yang
      // dipakai berkas kapal: "B | DOCKING & UNDOCKING | | | | ".
      const noSel = (sel[peta.no] || "").trim();
      if (/^([IVXL]+|[A-Z])$/.test(noSel) && !(sel[peta.qty] || "").trim() && !(sel[peta.unit] || "").trim()) {
        romawi = noSel; bagian = uraian; continue;
      }
      const qty = angka(sel[peta.qty] || "");
      const unit = (sel[peta.unit] || "").trim();
      const terakhir = baris[baris.length - 1];
      // Baris tanpa nomor yang menyusul item = sambungannya: uraiannya
      // digabung, dan volumenya (yang memang ditulis di baris itu) diambil.
      if (!noSel && terakhir && terakhir.bagian === bagian) {
        terakhir.uraian = `${terakhir.uraian}\n${uraian}`;
        if (!terakhir.qty && qty) { terakhir.qty = qty; terakhir.unit = unit || terakhir.unit; }
        continue;
      }
      baris.push({
        romawi, bagian,
        no: noSel,
        uraian,
        qty, unit,
        merk: (sel[peta.merk] || "").trim() || undefined,
        ket: (sel[peta.ket] || "").trim() || undefined,
      });
    }
  });

  if (!baris.length) {
    throw new Error(
      `Berkas Word terbaca, tapi tak ada tabel yang berbentuk daftar pekerjaan/permintaan.
` +
      `Ditemukan ${tabel.length} tabel. Kepala tabelnya: ` +
      (bukti.length ? bukti.map((x) => `"${x}"`).join(" · ") : "(kosong)") +
      `

Pastikan daftarnya memang berbentuk tabel Word (bukan gambar hasil tempel), ` +
      `dan ada kolom uraian pekerjaan beserta volume/satuannya.`,
    );
  }
  return { jenis, kapal, noSurat, tanggal, baris };
}

export const berkasWord = (f: File) =>
  /\.docx$/i.test(f.name) || f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** .doc lama (biner, bukan zip) tak bisa dibaca di peramban */
export const wordLama = (f: File) => /\.doc$/i.test(f.name) && !berkasWord(f);
