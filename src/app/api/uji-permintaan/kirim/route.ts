/**
 * Buka kiriman BORANG PERMINTAAN KAPAL — halaman uji coba, terbuka tanpa login.
 *
 * Bentuknya sengaja sama dengan /api/lapor/kirim (catatan dulu, berkas
 * menyusul lewat /api/lapor/berkas dengan token yang dikembalikan di sini)
 * supaya seluruh jalur unggah yang sudah dikeraskan — potongan, lanjut setelah
 * putus, penjaga salinan ganda — dipakai apa adanya, bukan ditulis ulang.
 *
 * Yang berbeda hanya dua hal, dan keduanya disengaja agar uji coba ini tidak
 * mengganggu yang berjalan:
 *   · payload.kind = "permintaan_uji", jadi tidak muncul di rekap kantor;
 *   · berkasnya masuk folder Drive tersendiri (_UJI FORMULIR), tidak tercampur
 *     dengan arsip laporan kapal yang asli.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { dbLapor, dbSiap } from "@/lib/lapor/db";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { lajuTerlampaui, ipDari } from "@/lib/lapor/laju";
import { BAGIAN, bagianDari, BarisPermintaan } from "@/lib/lapor/formulir";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** folder induk khusus uji coba di Drive — dibuat sendiri oleh Apps Script */
const FOLDER_UJI = "_UJI FORMULIR";
const MAKS_BARIS = 60;

const teks = (v: any, maks: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, maks);

export async function POST(req: NextRequest) {
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  if (lajuTerlampaui(`uji:${ipDari(req)}`, 20)) {
    return NextResponse.json({ ok: false, error: "Terlalu banyak kiriman dari perangkat ini. Coba lagi beberapa menit." }, { status: 429 });
  }

  const b = await req.json().catch(() => ({} as any));
  const f = b?.formulir || {};

  const kapal = teks(f.kapal, 60);
  if (!KAPAL_ANGGARAN.includes(kapal)) {
    return NextResponse.json({ ok: false, error: "Kapal tidak dikenali" }, { status: 400 });
  }
  const bagian = bagianDari(teks(f.bagian, 10));
  const noSurat = teks(f.noSurat, 60);
  if (!noSurat) return NextResponse.json({ ok: false, error: "No. SPPB/J wajib diisi" }, { status: 400 });
  const tanggal = teks(f.tanggal, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    return NextResponse.json({ ok: false, error: "Tanggal tidak sah" }, { status: 400 });
  }
  const peminta = teks(f.peminta, 60);
  if (peminta.length < 3) return NextResponse.json({ ok: false, error: "Nama peminta wajib diisi" }, { status: 400 });

  const baris = (Array.isArray(f.baris) ? f.baris : [])
    .map((x: any): BarisPermintaan => ({
      id: teks(x.id, 40) || randomUUID().slice(0, 8),
      jumlah: teks(x.jumlah, 12),
      satuan: teks(x.satuan, 20),
      merk: teks(x.merk, 80),
      uraian: teks(x.uraian, 200),
      spesifikasi: teks(x.spesifikasi, 200),
      kode: teks(x.kode, 30) || undefined,
    }))
    .filter((x: BarisPermintaan) => x.uraian)
    .slice(0, MAKS_BARIS);
  if (!baris.length) return NextResponse.json({ ok: false, error: "Belum ada barang yang diminta" }, { status: 400 });

  const jenis = BAGIAN.find((x) => x.id === bagian)!.jenisLapor;
  const token = randomUUID().replace(/-/g, "");
  const payload = {
    kind: "permintaan_uji",
    /** penanda supaya jelas ini masih uji coba, bukan jalur resmi */
    uji: true,
    kapal, bagian, jenis,
    periode: tanggal.slice(0, 7),
    noSurat, tanggal,
    dasar: teks(f.dasar, 120),
    tanggalDibutuhkan: teks(f.tanggalDibutuhkan, 60) || "Segera",
    peminta,
    jabatan: teks(f.jabatanPeminta, 60),
    nakhoda: teks(f.nakhoda, 60),
    masinis: teks(f.masinis, 60),
    kontak: teks(f.kontak, 40),
    catatan: teks(f.catatan, 1000),
    baris,
    berkas: [] as any[],
    /** Apps Script memakai jalur ini apa adanya; berkas uji tidak masuk arsip asli */
    jalurDrive: [FOLDER_UJI, kapal, bagian === "mesin" ? "Permintaan Mesin" : "Permintaan Deck"],
    dikirimPada: new Date().toISOString(),
    status: "baru",
    tindakLanjut: "",
    galatUnggah: "",
    token,
  };

  const c = dbLapor()!;
  const { data, error } = await c.from("projects")
    .insert({ nama_kapal: kapal, tahun: +tanggal.slice(0, 4), payload })
    .select("id").single();
  if (error || !data) {
    console.error("uji-permintaan/kirim:", error?.message);
    return NextResponse.json({ ok: false, error: "Kiriman gagal dibuka di server. Coba lagi sebentar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id, token });
}
