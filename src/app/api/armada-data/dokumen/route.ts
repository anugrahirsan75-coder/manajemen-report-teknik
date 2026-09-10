/**
 * Dokumen Kapal yang diunggah dari KANTOR.
 *
 * Kembarannya di /api/portal/dokumen membaca nama kapal dari cookie kapal,
 * karena di sana kapal hanya boleh mengarsip miliknya sendiri. Di sini kapalnya
 * justru dipilih: berita acara, temuan Marine Superintendent, dan salinan
 * sertifikat sering sampai lebih dulu ke meja kantor lewat surel atau
 * WhatsApp, dan menunggu awak mengunggah ulang berarti dokumen itu menganggur —
 * atau tak pernah masuk arsip sama sekali.
 *
 * Catatan dan berkasnya jatuh ke tempat yang sama persis dengan unggahan kapal:
 * satu arsip, dicari dengan satu cara, apa pun jalan masuknya.
 *
 * Route ini berada di balik gerbang login utama, jadi hanya akun Teknik yang
 * bisa memanggilnya — akun SCM tidak melewati /api/armada-data.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { dbServer, dbSiap } from "@/lib/dbServer";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { JENIS_DOKUMEN, KIND_DOKUMEN, jalurDokumen } from "@/lib/portal/dokumen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const teks = (v: unknown, n = 200) => String(v ?? "").slice(0, n).trim();
const tanggalSah = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");

export async function POST(req: NextRequest) {
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  /*
   * Nama kapal dicocokkan dengan daftar armada, tidak diterima apa adanya.
   * Satu salah ketik membuat dokumen mendarat di folder Drive kapal yang tidak
   * pernah ada — dan berkas yang salah tempat di arsip sama saja dengan hilang.
   */
  const kapal = teks(b.kapal, 60);
  if (!KAPAL_ANGGARAN.includes(kapal)) {
    return NextResponse.json({ ok: false, error: "Kapal tidak dikenali" }, { status: 400 });
  }
  const jenis = teks(b.jenis, 40);
  if (!JENIS_DOKUMEN.some((j) => j.id === jenis)) {
    return NextResponse.json({ ok: false, error: "Golongan dokumen tidak dikenali" }, { status: 400 });
  }
  const judul = teks(b.judul, 200);
  if (!judul) return NextResponse.json({ ok: false, error: "Judul dokumen wajib diisi" }, { status: 400 });

  const kini = new Date().toISOString();
  const token = randomUUID().replace(/-/g, "");
  const tanggal = tanggalSah(b.tanggal) || kini.slice(0, 10);

  const payload = {
    kind: KIND_DOKUMEN,
    kapal,
    /*
     * "kantor" — bukan deck atau mesin. Dokumen yang dimasukkan kantor tetap
     * terbaca sebagai milik kapal, tetapi asal-usulnya jujur tercatat: enam
     * bulan lagi, saat ada yang bertanya siapa yang mengarsipkan berita acara
     * ini, jawabannya ada di barisnya sendiri.
     */
    bagian: "kantor",
    jenis,
    /*
     * Nama FOLDER, bukan label. Label boleh memuat tanda baca yang enak dibaca
     * di layar ("Temuan / Findings"), dan garis miring itu ikut masuk ke nama
     * berkas di Drive — menyusahkan saat berkasnya diunduh ke Windows dan
     * membingungkan saat arsipnya ditelusuri.
     */
    jenisNama: JENIS_DOKUMEN.find((j) => j.id === jenis)!.folder,
    judul,
    tanggal,
    /* Apps Script memakai "periode" sebagai awalan nama berkas; tanggal kejadian
       membuat arsip yang diurut menurut nama otomatis tersusun kronologis */
    periode: tanggal,
    nomor: teks(b.nomor, 80),
    catatan: teks(b.catatan, 1000),
    berkas: [] as any[],
    jalurDrive: jalurDokumen(kapal, jenis),
    token,
    dibuatPada: kini,
    olehAkun: teks(b.oleh, 60) || "Kantor Teknik",
  };

  const c = dbServer()!;
  const { data, error } = await c.from("projects")
    .insert({ nama_kapal: kapal, tahun: +tanggal.slice(0, 4) || new Date().getFullYear(), payload })
    .select("id").single();
  if (error || !data) {
    console.error("armada-data/dokumen simpan:", error?.message);
    return NextResponse.json({ ok: false, error: "Dokumen gagal dicatat. Coba lagi." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id, token });
}

/**
 * Hapus catatan dokumen kapal mana pun.
 *
 * Berkas di Google Drive TIDAK ikut terhapus — sengaja: salah pencet di layar
 * kantor tidak boleh melenyapkan dokumen asli kapal. Yang hilang hanya
 * catatannya, dan berkasnya masih bisa ditemukan kembali di foldernya.
 */
export async function DELETE(req: NextRequest) {
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Dokumen tidak dikenali" }, { status: 400 });

  const c = dbServer()!;
  const { data: ada } = await c.from("projects").select("payload").eq("id", id).single();
  if (((ada?.payload as any) || {}).kind !== KIND_DOKUMEN) {
    return NextResponse.json({ ok: false, error: "Dokumen tidak ditemukan" }, { status: 404 });
  }
  const { error } = await c.from("projects").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: "Dokumen gagal dihapus" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
