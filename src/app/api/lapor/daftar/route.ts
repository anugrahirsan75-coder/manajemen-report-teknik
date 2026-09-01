/**
 * Daftar kiriman Permintaan & Laporan Kapal untuk DI DALAM aplikasi.
 * Route ini ada di balik gerbang login (middleware) — bukan halaman terbuka.
 *
 * Token kiriman sengaja dibuang sebelum data dikirim ke peramban: token itu
 * hanya urusan pengirim saat menempelkan berkas, tidak ada gunanya di kantor
 * dan tidak perlu ikut beredar.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbLapor, dbSiap } from "@/lib/lapor/db";
import { KirimanLapor, STATUS_LAPOR } from "@/lib/lapor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function keKiriman(row: any): KirimanLapor {
  const p = row.payload || {};
  return {
    id: row.id,
    kapal: p.kapal || row.nama_kapal || "",
    jenis: p.jenis,
    periode: p.periode || "",
    pengirim: p.pengirim || "",
    jabatan: p.jabatan || "",
    kontak: p.kontak || "",
    catatan: p.catatan || "",
    berkas: p.berkas || [],
    dikirimPada: p.dikirimPada || "",
    status: p.status || "baru",
    tindakLanjut: p.tindakLanjut || "",
    galatUnggah: p.galatUnggah || "",
    statusPada: p.statusPada || "",
    riwayatStatus: Array.isArray(p.riwayatStatus) ? p.riwayatStatus : [],
    digantikan: p.digantikan || "",
    riwayatPeriode: Array.isArray(p.riwayatPeriode) ? p.riwayatPeriode : [],
  };
}

export async function GET() {
  const c = dbLapor();
  if (!c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const { data, error } = await c.from("projects")
    .select("id,nama_kapal,payload")
    .filter("payload->>kind", "eq", "lapor_kapal");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  // terbaru di atas; id sebagai pemutus supaya urutan tidak berubah-ubah
  const baris = (data || []).map(keKiriman).sort((a, b) =>
    (b.dikirimPada || "").localeCompare(a.dikirimPada || "") || a.id.localeCompare(b.id));
  return NextResponse.json({ ok: true, baris });
}

/** ubah status / catatan tindak lanjut — hanya dari dalam aplikasi */
export async function PATCH(req: NextRequest) {
  const c = dbLapor();
  if (!c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const { id, status, tindakLanjut, periode } = await req.json().catch(() => ({} as any));
  if (!id) return NextResponse.json({ ok: false, error: "Kiriman tidak dikenali" }, { status: 400 });

  const { data: ada, error: e1 } = await c.from("projects").select("payload").eq("id", id).single();
  if (e1 || !ada) return NextResponse.json({ ok: false, error: "Kiriman tidak ditemukan" }, { status: 404 });
  const p: any = ada.payload || {};
  if (p.kind !== "lapor_kapal") return NextResponse.json({ ok: false, error: "Bukan kiriman kapal" }, { status: 400 });

  // Hanya medan-medan ini yang boleh berubah, dan payload dibaca ULANG sesaat
  // sebelum ditulis. Kalau tidak, berkas yang baru selesai diunggah ABK bisa
  // terhapus dari rekap hanya karena kantor menyimpan catatan tindak lanjut.
  const { data: kini } = await c.from("projects").select("payload").eq("id", id).single();
  const pTulis: any = { ...(kini?.payload || p) };

  if (typeof status === "string" && STATUS_LAPOR.some((s) => s.id === status) && status !== pTulis.status) {
    pTulis.status = status;
    pTulis.statusPada = new Date().toISOString();
    /*
     * Jejak perubahan status disimpan, bukan sekadar status terakhirnya.
     * Tanpa ini tak ada yang bisa menjawab "kapan ini dinyatakan selesai" —
     * dan perubahan yang tak meninggalkan bekas mudah diragukan sendiri oleh
     * yang mengubahnya. Dibatasi 20 langkah supaya payload tidak menggelembung.
     */
    const jejak = Array.isArray(pTulis.riwayatStatus) ? pTulis.riwayatStatus : [];
    pTulis.riwayatStatus = [...jejak, { status, pada: pTulis.statusPada }].slice(-20);
  }
  if (typeof tindakLanjut === "string") pTulis.tindakLanjut = tindakLanjut.slice(0, 2000);

  /*
   * Memindahkan kiriman ke periode lain.
   *
   * ABK kadang memilih bulan yang keliru — paling sering pada hari-hari
   * pertama bulan baru, ketika laporan bulan lalu sedang ramai dikirim. Tanpa
   * jalan memindahkan, satu-satunya cara membetulkan adalah menyuruh kapal
   * mengirim ulang seluruh berkasnya, dan itu menukar kesalahan kecil dengan
   * pekerjaan besar di jaringan yang justru paling rapuh.
   *
   * Perpindahannya dicatat: rekap bulanan adalah dasar penagihan, dan angka
   * yang bisa digeser tanpa bekas tidak bisa dipertanggungjawabkan.
   */
  if (typeof periode === "string" && periode !== pTulis.periode) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periode)) {
      return NextResponse.json({ ok: false, error: "Periode harus bulan yang sah" }, { status: 400 });
    }
    const jejakPeriode = Array.isArray(pTulis.riwayatPeriode) ? pTulis.riwayatPeriode : [];
    pTulis.riwayatPeriode = [...jejakPeriode, {
      dari: pTulis.periode || "", ke: periode, pada: new Date().toISOString(),
    }].slice(-10);
    pTulis.periode = periode;
  }

  const { error: e2 } = await c.from("projects")
    // kolom tahun ikut berpindah; kalau tidak, kiriman yang digeser ke Januari
    // tahun berikutnya masih tercatat pada tahun lamanya
    .update({ payload: pTulis, tahun: +String(pTulis.periode || "").slice(0, 4) || undefined })
    .eq("id", id);
  if (e2) {
    console.error("lapor/daftar PATCH:", e2.message);
    return NextResponse.json({ ok: false, error: "Perubahan gagal disimpan. Coba lagi." }, { status: 500 });
  }
  // yang dikembalikan adalah isi yang BENAR-BENAR tersimpan, termasuk berkas
  // yang mungkin baru masuk dari kapal sedetik sebelumnya
  return NextResponse.json({ ok: true, baris: keKiriman({ id, nama_kapal: pTulis.kapal, payload: pTulis }) });
}

/**
 * Hapus catatan kiriman. Berkas di Google Drive TIDAK ikut terhapus — sengaja,
 * supaya salah pencet di sini tidak menghilangkan dokumen asli kapal. Kalau
 * berkasnya memang mau dibuang, hapus langsung dari folder Drive.
 */
export async function DELETE(req: NextRequest) {
  const c = dbLapor();
  if (!c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Kiriman tidak dikenali" }, { status: 400 });
  const { data: ada } = await c.from("projects").select("payload").eq("id", id).single();
  if ((ada?.payload as any)?.kind !== "lapor_kapal") {
    return NextResponse.json({ ok: false, error: "Bukan kiriman kapal" }, { status: 400 });
  }
  const { error } = await c.from("projects").delete().eq("id", id);
  if (error) {
    console.error("lapor/daftar DELETE:", error.message);
    return NextResponse.json({ ok: false, error: "Kiriman gagal dihapus. Coba lagi." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
