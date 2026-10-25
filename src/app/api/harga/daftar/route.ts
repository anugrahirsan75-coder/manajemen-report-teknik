/**
 * Daftar barang dari database harga menurut KATEGORI — bahan usulan borongan.
 *
 * Berbeda dengan /api/harga/cari yang menjawab ketikan orang, route ini
 * menyerahkan sekumpulan barang sekaligus untuk dipakai penyusun usulan:
 * riwayat satu kapal kerap cuma puluhan barang, tak cukup untuk memenuhi jatah
 * sebulan, sedangkan database ini memuat 60 ribu barang dari berkas RAB
 * 2024-2026.
 *
 * Yang diserahkan hanya barang yang PANTAS diusulkan:
 *   · punya harga tahun berjalan atau tahun lalu — harga 2024 pada barang yang
 *     tak pernah dibeli lagi cuma menyesatkan;
 *   · punya minimal dua data pembanding, jadi harganya bukan kejadian tunggal;
 *   · bukan jasa dan bukan pekerjaan docking (dikenali dari kategorinya).
 * Urutannya: yang paling sering muncul di berkas lebih dulu.
 */
import { NextRequest, NextResponse } from "next/server";
import { muatIndeks, galatIndeks, keHasil } from "@/lib/harga/indeks";
import { punyaNomorPart, stokMati } from "@/lib/rr/penempatan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const m = muatIndeks();
  if (!m) {
    return NextResponse.json({ ok: false, error: "Indeks harga belum tersedia: " + galatIndeks() }, { status: 503 });
  }
  const { db } = m;
  const sp = req.nextUrl.searchParams;
  const kategori = (sp.get("kategori") || "").split("|").map((s) => s.trim()).filter(Boolean);
  const batas = Math.min(400, Math.max(10, parseInt(sp.get("batas") || "150", 10) || 150));
  const lewati = Math.max(0, parseInt(sp.get("lewati") || "0", 10) || 0);
  const hargaMaks = Number(sp.get("hargaMaks") || 0);
  const jenis = (sp.get("jenis") || "").toUpperCase();      // B | J | S
  const minData = Math.max(1, parseInt(sp.get("minData") || "2", 10) || 2);
  /**
   * mesin=1 menyaring barang yang jelas melayani mesin induk atau mesin bantu.
   * Tanpa saringan ini, daftar diurut menurut seberapa sering barang muncul di
   * berkas, dan yang menang selalu barang umum — lampu, baut, packing. Suku
   * cadang mesin justru jarang berulang: tiap kapal beda merek mesin, jadi
   * namanya tak pernah naik ke dua ratus teratas meski jumlahnya ribuan.
   */
  const hanyaMesin = sp.get("mesin") === "1";
  /**
   * part=1 menyisakan HANYA barang yang punya nomor part pabrikan.
   *
   * Kelompok Suku Cadang pada Lampiran 3 memang diisi barang bernomor: tanpa
   * nomor, yang tertulis baru kategori ("v-belt", "packing karet"), bukan
   * barang yang bisa dipesan. Dari enam puluh ribu baris indeks, yang lolos
   * saringan ini sekitar empat ratus — dan justru empat ratus itulah yang
   * pantas diusulkan sebagai suku cadang.
   */
  const hanyaBerpart = sp.get("part") === "1";
  /**
   * Baris yang namanya bukan nama barang.
   *
   * Indeks dipanen dari berkas pengadaan, dan sebagian barisnya terbawa
   * kepala dokumennya: "1020005105 DIESEL TEKNIK KHARISMA , PT",
   * "Inv. Permesinan dan Kelistrikan Kapal", "AKOMODASI DAN PERALATAN KAPAL
   * ( (MA : 501403009)". Barisnya punya harga dan kadang punya nomor part,
   * jadi saringan nomor part saja meloloskannya — dan yang tercetak di
   * Lampiran 3 menjadi nama vendor, bukan nama barang.
   */
  const BUKAN_NAMA_BARANG = new RegExp([
    String.raw`^\s*\d{7,}`,                 // kode vendor di depan
    String.raw`\b(?:pt|cv)\b\s*$`,          // "... , PT"
    String.raw`\bm\.?\s?a\b\s*[:.]`,      // "(MA : 5010403009)"
    String.raw`\basdp-\d{4}\b`,             // nomor surat
    String.raw`\btn\.\d`,                   // TN.101/...
    String.raw`^\s*inv\.`,                   // "Inv. Permesinan ..."
  ].join("|"), "i");
  const POLA_MESIN = new RegExp(String.raw`\b(m\s*\/?\s*e|a\s*\/?\s*e|main\s*engine`
    + String.raw`|aux(?:iliary)?|mesin\s*induk|mesin\s*bantu|gen\s*?set)\b`, "i");

  const pilih: { b: any[]; skor: number }[] = [];
  for (const b of db.baris) {
    const kat = db.kamus.kategori[b[2]] || "";
    if (kategori.length && !kategori.includes(kat)) continue;
    if (jenis && b[1] !== jenis) continue;
    const n = b[6] || 0;
    if (n < minData) continue;                             // harga kejadian tunggal
    const harga = b[12] || b[11] || 0;                     // 2026, lalu 2025
    if (!harga) continue;
    if (hargaMaks && harga > hargaMaks) continue;          // tak mungkin muat di jatah
    if (hanyaMesin && !POLA_MESIN.test(`${b[3] || ""} ${b[4] || ""}`)) continue;
    if (hanyaBerpart) {
      // nomor part harus ada di kolom SPESIFIKASI, bukan menumpang di nama
      if (!punyaNomorPart(String(b[4] || ""))) continue;
      // barang death/dead/non moving: stok mati, tidak diusulkan lagi
      if (stokMati(`${b[4] || ""} ${b[3] || ""}`)) continue;
      if (BUKAN_NAMA_BARANG.test(String(b[3] || ""))) continue;
    }
    pilih.push({ b, skor: Math.min(n, 30) * (b[12] ? 2 : 1) });
  }
  pilih.sort((x, y) => y.skor - x.skor);

  return NextResponse.json({
    ok: true,
    total: pilih.length,
    hasil: pilih.slice(lewati, lewati + batas).map((x) => keHasil(db, x.b)),
    kategori: db.kamus.kategori,
  });
}
