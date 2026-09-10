/**
 * Dokumen Kapal — catatan berkas tidak rutin milik satu kapal.
 *
 * Route ini hanya membuat CATATANNYA dan mengembalikan token; berkasnya
 * menyusul lewat /api/lapor/berkas, jalur potongan yang sudah terbukti bertahan
 * di jaringan kapal. Menulis jalur unggah kedua berarti menguji ulang dari nol
 * semua yang sudah teruji di sana — sambungan putus di tengah, percobaan ulang
 * yang melanjutkan, penjaga salinan ganda.
 *
 * Kapalnya dibaca dari cookie bertanda tangan, tidak pernah dari badan
 * permintaan: akun KMP. MAMING tidak bisa menitipkan berita acara ke arsip
 * KMP. TUNA dengan menyunting apa pun di peramban.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { dbServer, dbSiap } from "@/lib/dbServer";
import { sesiKapal } from "@/lib/portal/server";
import { JENIS_DOKUMEN, KIND_DOKUMEN, jalurDokumen } from "@/lib/portal/dokumen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const teks = (v: unknown, n = 200) => String(v ?? "").slice(0, n).trim();
const tanggalSah = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");

const keDokumen = (r: any) => {
  const p = r.payload || {};
  return {
    id: r.id,
    kapal: p.kapal || "",
    bagian: p.bagian || "",
    jenis: p.jenis || "lainnya",
    judul: p.judul || "",
    tanggal: p.tanggal || "",
    catatan: p.catatan || "",
    nomor: p.nomor || "",
    berkas: (p.berkas || []).map((f: any) => ({
      nama: f.nama, ukuran: f.ukuran, fileId: f.fileId, url: f.url, diunggahPada: f.diunggahPada,
    })),
    dibuatPada: p.dibuatPada || "",
    olehAkun: p.olehAkun || "",
  };
};

export async function GET() {
  const s = await sesiKapal();
  if (!s) return NextResponse.json({ ok: false, error: "Belum masuk" }, { status: 401 });
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const c = dbServer()!;
  const { data, error } = await c.from("projects")
    .select("id,payload")
    .filter("payload->>kind", "eq", KIND_DOKUMEN)
    .filter("payload->>kapal", "eq", s.kapal);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  /*
   * SELURUH dokumen kapal ditampilkan, tidak disaring per bagian.
   *
   * Berbeda dari borang bulanan yang memang milik satu bagian, berita acara
   * kandas atau serah terima jabatan menyangkut kapal seluruhnya — dan awak
   * mesin yang mencarinya tidak seharusnya menemukan layar kosong hanya karena
   * yang dulu mengunggahnya kebetulan memakai akun deck.
   */
  const baris = (data || []).map(keDokumen)
    .sort((a, b) => (b.tanggal || b.dibuatPada || "").localeCompare(a.tanggal || a.dibuatPada || ""));

  return NextResponse.json({ ok: true, kapal: s.kapal, bagian: s.bagian, baris });
}

export async function POST(req: NextRequest) {
  const s = await sesiKapal();
  if (!s) return NextResponse.json({ ok: false, error: "Belum masuk" }, { status: 401 });
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
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
    kapal: s.kapal,
    bagian: s.bagian,
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
    /*
     * Apps Script memakai "periode" sebagai awalan nama berkas. Untuk dokumen
     * tidak rutin yang paling menolong adalah TANGGAL KEJADIANNYA — arsip yang
     * diurut menurut nama otomatis tersusun kronologis.
     */
    periode: tanggal,
    nomor: teks(b.nomor, 80),
    catatan: teks(b.catatan, 1000),
    berkas: [] as any[],
    /*
     * Folder Drive ditentukan SERVER dari golongan dokumennya. Kalau jalurnya
     * ikut dikirim peramban, satu kesalahan ketik menaruh berita acara satu
     * kapal ke dalam folder kapal lain — dan berkas yang salah tempat di arsip
     * praktis sama dengan berkas yang hilang.
     */
    jalurDrive: jalurDokumen(s.kapal, jenis),
    token,
    dibuatPada: kini,
    olehAkun: s.nama,
  };

  const c = dbServer()!;
  const { data, error } = await c.from("projects")
    .insert({ nama_kapal: s.kapal, tahun: +tanggal.slice(0, 4) || new Date().getFullYear(), payload })
    .select("id").single();
  if (error || !data) {
    console.error("portal/dokumen simpan:", error?.message);
    return NextResponse.json({ ok: false, error: "Dokumen gagal dicatat. Coba lagi." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id, token });
}

/**
 * Hapus catatan dokumen.
 *
 * Berkas di Google Drive TIDAK ikut terhapus — sengaja, sama seperti di rekap
 * kantor: salah pencet di sini tidak boleh melenyapkan dokumen asli kapal.
 * Hanya dokumen milik kapal sendiri yang bisa dihapus.
 */
export async function DELETE(req: NextRequest) {
  const s = await sesiKapal();
  if (!s) return NextResponse.json({ ok: false, error: "Belum masuk" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Dokumen tidak dikenali" }, { status: 400 });

  const c = dbServer()!;
  const { data: ada } = await c.from("projects").select("payload").eq("id", id).single();
  const p: any = ada?.payload || {};
  if (p.kind !== KIND_DOKUMEN || p.kapal !== s.kapal) {
    return NextResponse.json({ ok: false, error: "Dokumen tidak ditemukan" }, { status: 404 });
  }
  const { error } = await c.from("projects").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: "Dokumen gagal dihapus" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
