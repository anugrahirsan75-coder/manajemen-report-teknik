/**
 * Pencarian barang untuk BORANG PERMINTAAN KAPAL (halaman uji coba ABK).
 *
 * Sumbernya Database RAB yang sama dengan yang dipakai kantor, tetapi jawaban
 * route ini SENGAJA TIDAK MEMBAWA HARGA. Halaman ini terbuka tanpa login untuk
 * ABK di kapal; harga satuan pengadaan bukan urusan borang permintaan dan tidak
 * ada alasan menyiarkannya ke luar aplikasi.
 *
 * Barang yang sama muncul berkali-kali di berkas RAB (satu baris per kapal per
 * pengadaan). Di sini digabung menurut nama+spesifikasi, jadi ABK melihat satu
 * "Kabel NYY 4 x 1,5 mm", bukan tiga puluh salinannya.
 */
import { NextRequest, NextResponse } from "next/server";
import { muatIndeks, galatIndeks, norm } from "@/lib/harga/indeks";
import { KATEGORI_BAGIAN, bagianDari } from "@/lib/lapor/formulir";
import { bersihNamaItem } from "@/lib/harga/bersihNama";
import { lajuTerlampaui, ipDari } from "@/lib/lapor/laju";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Awalan kelompok yang menempel di depan nama barang pada berkas RAB:
 * "MATERIAL REPLACEMENT - Parachute Signal", "INFLATABLE LIFERAFT - Parachute
 * Signal", "Kapasitas - Selang pemadam". Semuanya barang yang sama, ditulis
 * bertumpuk dengan judul bagiannya.
 *
 * Awalan itu tidak dibuang dari namanya (kadang justru menjelaskan letaknya),
 * tetapi dipakai untuk MENYATUKAN hasil pencarian: yang ditawarkan ke ABK satu
 * "Parachute Signal", bukan tiga baris yang isinya sama.
 */
const AWALAN_KELOMPOK = /^(?:[A-Z][A-Z0-9 ,/&().-]{3,}|kapasitas|ukuran|merk|tipe|type|model)\s+-\s+/;
const intiNama = (s: string) => s.replace(AWALAN_KELOMPOK, "").trim() || s;

/** satuan dari berkas lama kadang tersimpan dengan huruf rusak (M², M³) */
const satuanBersih = (s: string) => (s || "").replace(/\uFFFD/g, "").trim();

export async function GET(req: NextRequest) {
  if (lajuTerlampaui(`cari:${ipDari(req)}`, 240)) {
    return NextResponse.json({ ok: false, error: "Terlalu banyak pencarian. Tunggu sebentar." }, { status: 429 });
  }
  const m = muatIndeks();
  if (!m) return NextResponse.json({ ok: false, error: "Database RAB belum siap: " + galatIndeks() }, { status: 503 });

  const { db, teks } = m;
  const sp = req.nextUrl.searchParams;
  const q = norm(sp.get("q") || "");
  const bagian = bagianDari(sp.get("bagian") || "deck");
  const kategoriPilih = sp.get("kategori") || "";
  const batas = Math.min(40, Math.max(5, parseInt(sp.get("batas") || "20", 10) || 20));
  if (q.length < 2) return NextResponse.json({ ok: true, hasil: [], kategori: KATEGORI_BAGIAN[bagian] });

  const boleh = new Set(KATEGORI_BAGIAN[bagian]);
  const kata = q.split(" ").filter(Boolean);
  const kumpul = new Map<string, { uraian: string; spek: string; satuan: string; kategori: string; kode: string; n: number; skor: number }>();

  for (let i = 0; i < teks.length; i++) {
    const t = teks[i];
    let cocok = true;
    for (const k of kata) { if (!t.includes(k)) { cocok = false; break; } }
    if (!cocok) continue;

    const b = db.baris[i];
    const kategori = db.kamus.kategori[b[2]] || "";
    if (!boleh.has(kategori)) continue;
    if (kategoriPilih && kategori !== kategoriPilih) continue;

    /*
     * Nama dibersihkan dulu dari bungkus berkas RAB ("Pengadaan …", nomor surat,
     * nama kapal di ekor). Yang dipilih ABK harus nama BARANG, bukan judul
     * pekerjaan — nama yang bertele-tele itulah yang selama ini membuat satu
     * barang tercatat dengan lima nama berbeda.
     */
    const uraian = bersihNamaItem(String(b[3] || ""));
    if (uraian.length < 3 || uraian.length > 80) continue;
    // baris RAB yang memuat beberapa barang sekaligus ("Kunci Pas | Selang
    // Hose") bukan barang yang bisa diminta satu satuan; jangan ditawarkan
    if (/[|;]/.test(uraian)) continue;
    const spek = String(b[4] || "").trim().slice(0, 120);

    // pembobotan: sering dipakai, punya harga tahun berjalan (= masih diadakan),
    // kata utuh, dan nama yang tidak bertele-tele
    let skor = Math.min(b[6] || 0, 8) * 3;
    if (b[12]) skor += 12; else if (b[11]) skor += 6;
    for (const k of kata) if (new RegExp(`(^| )${k}( |$)`).test(t)) skor += 4;
    skor -= Math.min(t.length / 40, 6);

    const kunci = norm(`${intiNama(uraian)} ${spek}`);
    const ada = kumpul.get(kunci);
    if (ada) {
      ada.n += b[6] || 1;
      if (skor > ada.skor) ada.skor = skor;
      if (!ada.spek && spek) ada.spek = spek;
      if (!ada.satuan) ada.satuan = satuanBersih(db.kamus.satuan[b[5]] || "");
      // nama terpendek yang menang: itu yang paling dekat dengan nama barangnya
      if (uraian.length < ada.uraian.length) ada.uraian = uraian;
      continue;
    }
    kumpul.set(kunci, {
      uraian, spek, satuan: satuanBersih(db.kamus.satuan[b[5]] || ""),
      kategori, kode: String(b[0] || ""), n: b[6] || 1, skor,
    });
  }

  const hasil = Array.from(kumpul.values()).sort((a, b) => b.skor - a.skor).slice(0, batas)
    .map(({ skor, ...sisa }) => sisa);
  return NextResponse.json({ ok: true, hasil, cocok: kumpul.size, kategori: KATEGORI_BAGIAN[bagian] });
}
