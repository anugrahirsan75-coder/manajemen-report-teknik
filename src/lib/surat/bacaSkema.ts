/**
 * Bagian mesin baca berkas yang dipakai DUA sisi: peramban (lib/surat/bacaTabel)
 * dan server (api/surat/baca-tabel). Isinya murni fungsi — tidak menyentuh DOM
 * maupun jaringan — supaya perintah ke model dan pembersihan hasilnya persis
 * sama siapa pun yang menjalankan.
 */
import { KolomTabel } from "./types";

export interface HasilTabel {
  baris: Record<string, string>[];
  catatan: string[];
}

const BULAN = ["januari", "februari", "maret", "april", "mei", "juni",
  "juli", "agustus", "september", "oktober", "november", "desember"];

/** ubah tanggal bentuk apa pun jadi "yyyy-mm-dd"; yang tak terbaca dikembalikan apa adanya */
export function keTanggalIso(v: unknown): string {
  const t = String(v ?? "").trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

  const dua = (n: number) => String(n).padStart(2, "0");

  // 23 Juli 2026 / 23 juli 26
  const teks = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/.exec(t);
  if (teks) {
    const bl = BULAN.findIndex((b) => b.startsWith(teks[2].toLowerCase().slice(0, 3)));
    if (bl >= 0) {
      const th = Number(teks[3]);
      return `${th < 100 ? 2000 + th : th}-${dua(bl + 1)}-${dua(Number(teks[1]))}`;
    }
  }
  // 23/07/2026 · 23-07-2026 · 23.07.2026
  const angka = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(t);
  if (angka) {
    const th = Number(angka[3]);
    return `${th < 100 ? 2000 + th : th}-${dua(Number(angka[2]))}-${dua(Number(angka[1]))}`;
  }
  // 2026/07/23
  const balik = /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/.exec(t);
  if (balik) return `${balik[1]}-${dua(Number(balik[2]))}-${dua(Number(balik[3]))}`;

  return t;
}

/**
 * Angka rupiah dari sel apa pun.
 *
 * Nilai berdesimal ("932.924.327,50" atau "932924327.5") dipotong ke rupiah
 * bulat — surat tidak pernah menulis sen, dan membiarkan koma lewat akan
 * membuat "12.901.849,00" terbaca 1.290.184.900.
 */
export function keRupiahBersih(v: unknown): string {
  let t = String(v ?? "").trim();
  if (!t) return "";
  const minus = /^\(.*\)$/.test(t) || t.startsWith("-");
  t = t.replace(/[^\d.,]/g, "");
  if (!t) return "";
  // pemisah desimal = tanda terakhir yang diikuti tepat 1-2 digit di ujung
  const desimal = /[.,](\d{1,2})$/.exec(t);
  if (desimal && /[.,]/.test(t.slice(0, t.length - desimal[0].length))) t = t.slice(0, t.length - desimal[0].length);
  const digit = t.replace(/[^\d]/g, "");
  if (!digit) return "";
  const n = Number(digit);
  return String(minus ? -n : n);
}

const jenisTeks = (k: KolomTabel) =>
  k.jenis === "rupiah" ? "angka rupiah, tulis DIGIT POLOS tanpa titik/koma (contoh: 932924327)"
    : k.jenis === "tanggal" ? "tanggal, tulis format yyyy-mm-dd"
      : "teks apa adanya";

/** perintah untuk model, dirakit dari skema kolom tabel yang sedang diisi */
export function promptTabel(kolom: KolomTabel[], konteks: string, mode: "teks" | "gambar"): string {
  /**
   * Daftar saran sengaja TIDAK ikut ditulis ke perintah. Model kecil cenderung
   * menyalinnya bulat-bulat ke hasil begitu ragu — pernah terjadi seluruh daftar
   * pilihan masuk sebagai isi satu sel — padahal gunanya hanya untuk manusia.
   */
  const daftar = kolom.map((k) => `- "${k.id}" (${k.label}): ${jenisTeks(k)}`).join("\n");

  const sumber = mode === "gambar"
    ? "sebuah gambar/pindaian dokumen"
    : "teks yang disalin apa adanya dari sebuah berkas (Excel/PDF), jadi kolom bisa terpisah tab atau spasi";

  return `Kamu mengekstrak isi TABEL dari ${sumber}. Dokumennya berbahasa Indonesia, milik kantor cabang PT ASDP.
${konteks ? `\nKonteks tabel: ${konteks}\n` : ""}
Setiap baris data keluarkan sebagai satu objek dengan field berikut:
${daftar}

Aturan:
- Jangan mengarang, dan jangan menyalin contoh apa pun dari perintah ini. Yang keluar hanya yang benar-benar tertulis di dokumen.
- Sel yang kosong di sumber, kosongkan juga ("").
- Kop surat, nomor surat pengirim, alamat tujuan, dan perihal surat itu sendiri BUKAN baris data.
- ABAIKAN baris TOTAL, SUB TOTAL, JUMLAH, dan baris rekap sejenis — angka itu dihitung ulang oleh aplikasi.
- Abaikan baris judul, kop, nomor halaman, dan catatan kaki.
- Nomor urut (No / 1,2,3 / I,II,III) tidak perlu dikeluarkan kecuali ada field khusus untuknya.
- Kalau satu baris terpecah jadi beberapa baris di sumber (uraian panjang), gabungkan jadi satu objek.
- Pertahankan urutan baris seperti di dokumen.

Keluarkan HANYA JSON valid tanpa teks lain, bentuknya:
{"baris":[{${kolom.map((k) => `"${k.id}":""`).join(",")}}]}`;
}

/** bersihkan hasil model jadi baris siap tempel ke borang */
export function rapikanBaris(mentah: any, kolom: KolomTabel[]): HasilTabel {
  const daftar: any[] = Array.isArray(mentah) ? mentah : (mentah?.baris || mentah?.rows || mentah?.items || []);
  const catatan: string[] = [];
  const baris: Record<string, string>[] = [];

  daftar.forEach((r) => {
    if (!r || typeof r !== "object") return;
    const isi: Record<string, string> = {};
    kolom.forEach((k) => {
      const asal = r[k.id] ?? r[k.label] ?? "";
      isi[k.id] = k.jenis === "rupiah" ? keRupiahBersih(asal)
        : k.jenis === "tanggal" ? keTanggalIso(asal)
          : String(asal ?? "").replace(/\s+/g, " ").trim();
    });
    // baris rekap kadang lolos juga dari model — buang di sini
    const teksGabung = kolom.filter((k) => k.jenis === "teks").map((k) => isi[k.id]).join(" ").toLowerCase();
    if (/^\s*(sub\s*)?total\b|^jumlah\b|grand total/.test(teksGabung)) {
      catatan.push(`Baris rekap dilewati: “${teksGabung.slice(0, 40)}”.`);
      return;
    }
    if (Object.values(isi).every((v) => !v)) return;
    baris.push(isi);
  });

  return { baris, catatan };
}
