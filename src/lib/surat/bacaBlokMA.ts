"use client";
/**
 * Pembaca berkas "Kontrol Biaya Docking" — sumber tetap surat permohonan docking.
 *
 * Bentuk berkasnya tidak bisa dibaca dengan mencocokkan judul kolom, dan itu
 * bukan kekurangan berkasnya: satu mata anggaran memang ditulis sebagai BLOK,
 * bukan sebagai satu baris.
 *
 *   I   Pemeliharaan Kapal / Ro-ro                 <- judul kelompok (angka Romawi)
 *       (M.A. 5010403003)  1. Docking Induk        932.924.327  851.587.600  925.567.600
 *                          2. Cat BGA                            54.380.000
 *                          3. Penunjang Docking                   19.600.000
 *                             Jumlah               932.924.327               925.567.600
 *   TOTAL BIAYA DOCKING                          1.380.274.796             1.466.529.390
 *
 * Yang dibutuhkan surat hanyalah satu baris per mata anggaran: kodenya, judul
 * kelompoknya, nilai RKA, dan JUMLAH usulan cabang — bukan rincian per item dan
 * bukan pula kolom "Nilai" yang hanya nilai satu item. Berkas seperti ini dibaca
 * di sini apa adanya, tanpa AI: hasilnya pasti, dan tidak ada yang perlu
 * dipercaya selain angka di berkasnya sendiri.
 */
import { KolomTabel } from "./types";
import { keRupiahBersih } from "./bacaSkema";

export interface HasilBlok { baris: Record<string, string>[]; catatan: string[] }

const MA_RE = /\(\s*M\.?\s*A\.?\s*\.?\s*([0-9]{6,})\s*\)/i;
const ROMAWI_RE = /^(?:[IVX]{1,6})$/;
const REKAP_RE = /^(total|sub\s*total|jumlah)\b/i;

const teks = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

/** kolom borang mana yang dipakai untuk apa; null bila tabelnya bukan tabel mata anggaran */
function petaKolom(kolom: KolomTabel[]) {
  const cocok = (k: KolomTabel, kata: RegExp) => kata.test(k.id) || kata.test(k.label.toLowerCase());
  const kode = kolom.find((k) => k.jenis === "teks" && cocok(k, /kode|m\.?a\b|mata anggaran/));
  const uraian = kolom.find((k) => k.jenis === "teks" && k !== kode);
  const rupiah = kolom.filter((k) => k.jenis === "rupiah");
  if (!kode || !rupiah.length) return null;
  return { kode: kode.id, uraian: uraian?.id, rka: rupiah[0].id, usulan: rupiah[1]?.id };
}

/**
 * Kolom RKA dan kolom JUMLAH usulan, dicari dari baris judul.
 *
 * Pencarian dibatasi sampai blok mata anggaran pertama: judul tabel selalu ada
 * di atasnya, dan berhenti di situ mencegah kata "RKA" yang kebetulan muncul di
 * tengah data ikut dianggap judul kolom.
 */
function kolomNilai(matriks: string[][], sampai: number): { rka: number; jumlah: number } | null {
  for (let r = 0; r < Math.min(matriks.length, Math.max(sampai, 25)); r++) {
    const kolomRka = matriks[r].findIndex((s) => /\brka\b/i.test(teks(s)));
    if (kolomRka < 0) continue;
    // "Jumlah (Rp.)" biasanya ada di baris berikutnya, di bawah judul USULAN
    for (let b = r; b <= r + 2 && b < matriks.length; b++) {
      const kolomJumlah = matriks[b].findIndex((s, i) => i > kolomRka && /jumlah\s*\(?\s*rp/i.test(teks(s)));
      if (kolomJumlah > 0) return { rka: kolomRka, jumlah: kolomJumlah };
    }
    return { rka: kolomRka, jumlah: kolomRka + 2 };   // tata letak baku: RKA | Nilai | Jumlah
  }
  return null;
}

/** judul kelompok di atas blok: baris berangka Romawi yang membawa teks */
function judulKelompok(matriks: string[][], sampai: number): { baris: number; judul: string } | null {
  for (let r = sampai; r >= 0 && r > sampai - 6; r--) {
    const sel = matriks[r] || [];
    const adaRomawi = sel.some((s) => ROMAWI_RE.test(teks(s)));
    if (!adaRomawi) continue;
    const judul = sel.map(teks).find((s) => s.length > 3 && !ROMAWI_RE.test(s) && !REKAP_RE.test(s) && !MA_RE.test(s));
    if (judul) return { baris: r, judul };
  }
  return null;
}

/** uraian pada baris mata anggaran itu sendiri (dipakai bila satu kelompok punya banyak M.A.) */
function uraianBaris(sel: string[], kolomMa: number, batasNilai: number): string {
  return sel.map(teks)
    .filter((s, i) => i > kolomMa && i < batasNilai && s.length > 3 && !/^\d+\.?$/.test(s) && !REKAP_RE.test(s))[0] || "";
}

export function tabelBlokMA(matriks: string[][], kolom: KolomTabel[]): HasilBlok | null {
  const peta = petaKolom(kolom);
  if (!peta) return null;

  // semua baris yang memuat "(M.A. xxxxxxx)"
  const semua: { baris: number; kolom: number; kode: string }[] = [];
  matriks.forEach((sel, r) => {
    (sel || []).forEach((s, c) => {
      const m = MA_RE.exec(teks(s));
      if (m) semua.push({ baris: r, kolom: c, kode: m[1] });
    });
  });

  /**
   * Sel mata anggaran DIGABUNG menutupi seluruh baris item di bawahnya, dan
   * pembaca Excel mengembalikan nilai yang sama untuk tiap baris gabungan itu.
   * Tanpa disaring, satu mata anggaran berubah jadi tiga baris kembar yang
   * angkanya sama semua — persis yang bikin hasilnya kacau. Kemunculan pertama
   * saja yang dipakai; blok berakhir saat kodenya berganti.
   */
  const blok = semua.filter((b, i) => i === 0 || b.kode !== semua[i - 1].kode);
  if (blok.length < 2) return null;

  const nilai = kolomNilai(matriks, blok[0].baris);
  if (!nilai) return null;

  const catatan: string[] = [];
  const baris: Record<string, string>[] = [];

  /**
   * Judul kelompok tiap blok dihitung sekali di muka. Satu kelompok bisa memuat
   * lebih dari satu mata anggaran — "Investasi" memayungi tiga sekaligus — dan
   * di situ judul kelompoknya terlalu umum, jadi uraian diambil dari baris mata
   * anggarannya sendiri.
   */
  const kelompokBlok = blok.map((b) => judulKelompok(matriks, b.baris - 1));
  const jumlahSekelompok = (r: number | undefined) =>
    kelompokBlok.filter((k) => k && k.baris === r).length;

  blok.forEach((b, idx) => {
    const akhir = idx + 1 < blok.length ? blok[idx + 1].baris : matriks.length;

    // baris "Jumlah" milik blok ini — di situlah nilai satu mata anggaran utuh
    let barisJumlah = -1;
    for (let r = b.baris; r < akhir; r++) {
      if ((matriks[r] || []).some((s) => /^jumlah$/i.test(teks(s)))) { barisJumlah = r; break; }
      if ((matriks[r] || []).some((s) => /^total\b/i.test(teks(s)))) break;   // sudah masuk rekap
    }
    const ambil = (kolomNo: number) => {
      const dariJumlah = barisJumlah >= 0 ? keRupiahBersih((matriks[barisJumlah] || [])[kolomNo]) : "";
      return dariJumlah || keRupiahBersih((matriks[b.baris] || [])[kolomNo]);
    };

    const kelompok = kelompokBlok[idx];
    const sendiri = uraianBaris(matriks[b.baris] || [], b.kolom, nilai.rka);
    const uraian = jumlahSekelompok(kelompok?.baris) > 1
      ? (sendiri || kelompok?.judul || "")
      : (kelompok?.judul || sendiri);

    const isi: Record<string, string> = Object.fromEntries(kolom.map((k) => [k.id, ""]));
    isi[peta.kode] = b.kode;
    if (peta.uraian) isi[peta.uraian] = uraian;
    isi[peta.rka] = ambil(nilai.rka);
    if (peta.usulan) isi[peta.usulan] = ambil(nilai.jumlah);
    if (barisJumlah < 0) catatan.push(`M.A. ${b.kode}: baris “Jumlah” tak ketemu, nilai diambil dari baris mata anggarannya.`);
    baris.push(isi);
  });

  if (!baris.length) return null;
  catatan.unshift(`Berkas dikenali sebagai Kontrol Biaya Docking: ${baris.length} mata anggaran dibaca dari baris “Jumlah” tiap blok.`);
  return { baris, catatan };
}
