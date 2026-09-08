/**
 * Kiriman milik kapal yang sedang masuk — dilihat dari sisi KAPAL.
 *
 * Selama ini kapal mengirim lalu tidak pernah tahu apa-apa lagi: berkasnya
 * sampai atau tidak, sudah dibaca kantor atau belum, sudah jadi SPPBJ atau masih
 * menunggu. Yang bisa dilakukan cuma bertanya lewat WhatsApp, dan pertanyaan itu
 * jatuh ke orang yang sedang mengerjakan hal lain.
 *
 * Kapal hanya boleh melihat kirimannya SENDIRI dan hanya bagiannya sendiri:
 * kapalnya dibaca dari cookie bertanda tangan, bukan dari apa pun yang dikirim
 * peramban. Akun Deck KMP. MAMING tidak bisa membaca laporan mesin kapal lain
 * dengan menyunting alamat.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbServer, dbSiap } from "@/lib/dbServer";
import { sesiKapal } from "@/lib/portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** hanya medan yang memang perlu dilihat kapal — tindak lanjut internal tidak ikut */
const keRingkas = (r: any) => {
  const p = r.payload || {};
  return {
    id: r.id,
    jenis: p.jenis,
    periode: p.periode || "",
    dikirimPada: p.dikirimPada || "",
    status: p.status || "baru",
    statusPada: p.statusPada || "",
    pengirim: p.pengirim || "",
    jabatan: p.jabatan || "",
    catatan: p.catatan || "",
    berkas: (p.berkas || []).map((f: any) => ({ nama: f.nama, ukuran: f.ukuran, fileId: f.fileId })),
    /* dorongan yang sudah dikirim kapal — supaya tidak menagih dua kali */
    dorongan: (p.dorongan || []).map((d: any) => ({ pada: d.pada, pesan: d.pesan })),
  };
};

export async function GET() {
  const s = await sesiKapal();
  if (!s) return NextResponse.json({ ok: false, error: "Belum masuk" }, { status: 401 });
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const c = dbServer()!;
  const { data, error } = await c.from("projects")
    .select("id,payload")
    .filter("payload->>kind", "eq", "lapor_kapal")
    .filter("payload->>kapal", "eq", s.kapal);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  /*
   * Disaring pada bagiannya: akun Mesin melihat permintaan & laporan mesin,
   * akun Deck melihat yang deck. Bukan soal rahasia — satu kapal, satu awak —
   * melainkan soal layar yang isinya benar-benar pekerjaan orang yang membuka.
   */
  const baris = (data || [])
    .filter((r: any) => String((r.payload || {}).jenis || "").endsWith(s.bagian))
    .filter((r: any) => !(r.payload || {}).digantikan)
    .map(keRingkas)
    .sort((a, b) => (b.dikirimPada || "").localeCompare(a.dikirimPada || ""));

  return NextResponse.json({ ok: true, kapal: s.kapal, bagian: s.bagian, baris });
}

/**
 * Dorongan: kapal mengingatkan kantor bahwa kirimannya belum dikerjakan.
 *
 * Disimpan pada kiriman yang bersangkutan, bukan sebagai pesan terpisah — supaya
 * yang membaca di kantor melihat tagihan itu tepat di samping dokumennya, bukan
 * di kotak masuk lain yang harus dicocokkan sendiri.
 */
export async function POST(req: NextRequest) {
  const s = await sesiKapal();
  if (!s) return NextResponse.json({ ok: false, error: "Belum masuk" }, { status: 401 });
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const { id, pesan } = (await req.json().catch(() => ({}))) as { id?: string; pesan?: string };
  if (!id) return NextResponse.json({ ok: false, error: "Kiriman tidak dikenali" }, { status: 400 });

  const c = dbServer()!;
  const { data: ada } = await c.from("projects").select("payload").eq("id", id).single();
  const p: any = ada?.payload || {};
  if (p.kind !== "lapor_kapal" || p.kapal !== s.kapal) {
    // kiriman kapal lain: jawabannya sama dengan kiriman yang tidak ada
    return NextResponse.json({ ok: false, error: "Kiriman tidak ditemukan" }, { status: 404 });
  }

  const dorongan = Array.isArray(p.dorongan) ? p.dorongan : [];
  const terakhir = dorongan[dorongan.length - 1];
  /*
   * Satu dorongan per kiriman per hari. Tanpa jeda ini, tombol yang mudah ditekan
   * akan berubah menjadi belasan tanda merah untuk satu dokumen yang sama, dan
   * tanda yang terlalu sering muncul berhenti dibaca.
   */
  if (terakhir && Date.now() - Date.parse(terakhir.pada || "") < 20 * 60 * 60 * 1000) {
    return NextResponse.json({
      ok: false,
      error: "Pengingat untuk kiriman ini sudah terkirim hari ini. Kantor sudah melihatnya.",
    }, { status: 429 });
  }

  const baru = {
    pada: new Date().toISOString(),
    oleh: s.nama,
    bagian: s.bagian,
    pesan: String(pesan || "").slice(0, 500),
  };
  const { error } = await c.from("projects").update({
    payload: { ...p, dorongan: [...dorongan, baru].slice(-20) },
  }).eq("id", id);
  if (error) {
    console.error("portal/kiriman dorongan:", error.message);
    return NextResponse.json({ ok: false, error: "Pengingat gagal dikirim. Coba lagi." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, dorongan: baru });
}
