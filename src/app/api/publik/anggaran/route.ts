/**
 * Data untuk halaman Kinerja Anggaran — halaman TERBUKA, tanpa login.
 *
 * Halaman itu dibagikan ke Direksi sebagai TAUTAN LIHAT SAJA, jadi route ini
 * dibuat sesempit mungkin:
 *
 *   · hanya GET. Tidak ada jalan mengubah apa pun dari sini;
 *   · isi dokumen DIPANGKAS di server. Yang keluar hanya yang dibutuhkan untuk
 *     menghitung penyerapan: tanggal, jenis anggaran, dan tiap baris item
 *     (kapal, jumlah, harga, mata anggaran). VENDOR, penerima, nomor kontrak,
 *     foto, catatan, tanda tangan, dan nomor SAP TIDAK ikut keluar sama sekali;
 *   · pagu (RKA, plafon rutin, persetujuan docking, surat persetujuan lainnya)
 *     ikut dikirim karena tanpa pembanding itu angka penyerapan tak berarti.
 *
 * Pemangkasan dilakukan di SERVER, bukan disembunyikan di layar: apa yang tidak
 * dikirim tidak bisa dibuka siapa pun yang membuka alat pengembang peramban.
 *
 * Bila env KINERJA_KODE diisi, tautannya minta kode itu lebih dulu.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbServer, dbSiap } from "@/lib/dbServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const n = (v: any) => (typeof v === "number" && isFinite(v) ? v : 0);
const teks = (v: any) => String(v ?? "").trim();

/** satu baris item, dipangkas ke yang perlu saja untuk menghitung nilai */
const itemBersih = (it: any) => ({
  kapal: teks(it?.kapal),
  nama: teks(it?.nama).slice(0, 120),
  jumlah: n(it?.jumlah),
  harga: n(it?.harga),
  hargaSpbj: n(it?.hargaSpbj),
  mataAnggaran: teks(it?.mataAnggaran),
  jenisAnggaran: teks(it?.jenisAnggaran),
  programId: teks(it?.programId) || undefined,
});

export async function GET(req: NextRequest) {
  const kode = process.env.KINERJA_KODE || "";
  if (kode && req.nextUrl.searchParams.get("kode") !== kode) {
    return NextResponse.json({ ok: false, perluKode: true, error: "Kode akses salah" }, { status: 401 });
  }
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  try {
    const sb = dbServer()!;
    const { data, error } = await sb.from("projects")
      .select("id,nama_kapal,payload,created_at")
      .or("payload->>kind.eq.sppbj,payload->>kind.eq.nonpr,payload->>kind.eq.anggaran")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const semua = data || [];
    const meta = semua.find((r: any) => r.payload?.kind === "anggaran")?.payload || {};

    const pengadaan = semua
      .filter((r: any) => r.payload?.kind === "sppbj" || r.payload?.kind === "nonpr")
      .map((r: any) => {
        const p = r.payload || {};
        const ma = Array.isArray(p.mataAnggaran) ? p.mataAnggaran : p.mataAnggaran ? [p.mataAnggaran] : [];
        return {
          id: r.id,
          sumber: p.kind === "nonpr" ? "Non PR PO" : "SPPBJ",
          nama: teks(r.nama_kapal || p.namaPengadaan) || "(tanpa nama)",
          tanggal: teks(p.tanggal),
          mataAnggaran: ma.map(teks),
          kategoriRekap: teks(p.kategoriRekap),
          jenisAnggaran: teks(p.jenisAnggaran),
          programId: teks(p.programId) || undefined,
          stok: !!p.stokPersediaan,
          items: (p.items || []).map(itemBersih),
        };
      });

    return NextResponse.json({
      ok: true,
      diperbarui: new Date().toISOString(),
      pengadaan,
      rka: meta.rka || null,
      plafon: Array.isArray(meta.plafon) ? meta.plafon : [],
      docking: Array.isArray(meta.docking) ? meta.docking : [],
      // surat persetujuan: nomor & nama surat memang perlu untuk menamai pagunya
      program: (Array.isArray(meta.program) ? meta.program : []).map((pr: any) => ({
        id: pr.id, nama: teks(pr.nama), noSurat: teks(pr.noSurat), tanggal: teks(pr.tanggal),
        rows: pr.rows || [], pos: pr.pos || [],
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "gagal" }, { status: 500 });
  }
}
