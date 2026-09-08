/**
 * Pengelolaan akun kapal — dipakai KANTOR, bukan kapal.
 *
 * SENGAJA di luar /api/portal: seluruh alamat itu dijaga cookie kapal, sedangkan
 * route ini justru harus dijaga sesi KANTOR. Menaruhnya di bawah /api/portal
 * berarti akun kapal bisa memanggil pengelola akun kapal.
 *
 * Berada di balik gerbang login utama (middleware), jadi hanya akun Teknik yang
 * bisa memanggilnya. Tiga hal yang dilayani: melihat daftar akun, membuatkan
 * akun yang belum ada untuk seluruh armada, dan mengatur ulang sandi satu akun.
 *
 * Sandi awal ditampilkan SEKALI, tepat setelah dibuat. Sesudah itu yang tersimpan
 * hanya sidiknya — kantor pun tidak bisa membacanya lagi, dan satu-satunya jalan
 * bagi kapal yang lupa adalah minta diatur ulang. Itu memang tujuannya: sandi
 * yang masih bisa dibaca kantor bukan lagi milik kapal.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbServer, dbSiap } from "@/lib/dbServer";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { buatSandi, sandiAwal } from "@/lib/portal/sandi";
import { BAGIAN, KIND_AKUN_KAPAL, namaAkun, type BagianKapal } from "@/lib/portal/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const keAkun = (r: any) => {
  const p = r.payload || {};
  return {
    id: r.id,
    kapal: p.kapal || "",
    bagian: p.bagian as BagianKapal,
    nama: p.nama || "",
    aktif: p.aktif !== false,
    dibuatPada: p.dibuatPada || "",
    terakhirMasuk: p.terakhirMasuk || "",
    sandiDiubahPada: p.sandiDiubahPada || "",
    catatan: p.catatan || "",
  };
};

export async function GET() {
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const c = dbServer()!;
  const { data, error } = await c.from("projects")
    .select("id,payload").filter("payload->>kind", "eq", KIND_AKUN_KAPAL);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const akun = (data || []).map(keAkun)
    .sort((a, b) => a.kapal.localeCompare(b.kapal, "id") || a.bagian.localeCompare(b.bagian));

  // kapal × bagian yang belum punya akun — supaya kantor tahu apa yang kurang
  const ada = new Set(akun.map((a) => a.nama));
  const belum: { kapal: string; bagian: BagianKapal; nama: string }[] = [];
  KAPAL_ANGGARAN.forEach((k) => BAGIAN.forEach((b) => {
    const n = namaAkun(k, b.id);
    if (!ada.has(n)) belum.push({ kapal: k, bagian: b.id, nama: n });
  }));

  return NextResponse.json({ ok: true, akun, belum });
}

export async function POST(req: NextRequest) {
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const { aksi, id, kapal, bagian, catatan } = (await req.json().catch(() => ({}))) as {
    aksi?: string; id?: string; kapal?: string; bagian?: BagianKapal; catatan?: string;
  };
  const c = dbServer()!;
  const kini = new Date().toISOString();

  /* ── buatkan seluruh akun yang belum ada ──────────────────────────────── */
  if (aksi === "buat-semua" || aksi === "buat") {
    const { data } = await c.from("projects")
      .select("id,payload").filter("payload->>kind", "eq", KIND_AKUN_KAPAL);
    const ada = new Set((data || []).map((r: any) => (r.payload || {}).nama));

    const sasaran: { kapal: string; bagian: BagianKapal }[] = aksi === "buat" && kapal && bagian
      ? [{ kapal, bagian }]
      : KAPAL_ANGGARAN.flatMap((k) => BAGIAN.map((b) => ({ kapal: k, bagian: b.id })));

    const dibuat: { kapal: string; bagian: string; nama: string; sandi: string }[] = [];
    for (const s of sasaran) {
      const nama = namaAkun(s.kapal, s.bagian);
      if (ada.has(nama)) continue;
      const sandi = sandiAwal();
      const { error } = await c.from("projects").insert({
        nama_kapal: s.kapal,
        tahun: new Date().getFullYear(),
        payload: {
          kind: KIND_AKUN_KAPAL,
          kapal: s.kapal, bagian: s.bagian, nama,
          sandi: await buatSandi(sandi),
          aktif: true, dibuatPada: kini, sandiDiubahPada: kini,
          terakhirMasuk: "", catatan: catatan || "",
        },
      });
      if (error) {
        console.error("akun-kapal buat:", error.message);
        return NextResponse.json({ ok: false, error: "Akun gagal dibuat. Coba lagi." }, { status: 500 });
      }
      dibuat.push({ kapal: s.kapal, bagian: s.bagian, nama, sandi });
    }
    return NextResponse.json({ ok: true, dibuat });
  }

  if (!id) return NextResponse.json({ ok: false, error: "Akun tidak dikenali" }, { status: 400 });
  const { data: ada } = await c.from("projects").select("payload").eq("id", id).single();
  const p: any = ada?.payload || {};
  if (p.kind !== KIND_AKUN_KAPAL) {
    return NextResponse.json({ ok: false, error: "Bukan akun kapal" }, { status: 400 });
  }

  /* ── atur ulang sandi ─────────────────────────────────────────────────── */
  if (aksi === "reset") {
    const sandi = sandiAwal();
    const { error } = await c.from("projects").update({
      payload: { ...p, sandi: await buatSandi(sandi), sandiDiubahPada: kini },
    }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: "Sandi gagal diatur ulang." }, { status: 500 });
    return NextResponse.json({ ok: true, nama: p.nama, sandi });
  }

  /* ── nyalakan / matikan akun ──────────────────────────────────────────── */
  if (aksi === "aktif" || aksi === "nonaktif") {
    const { error } = await c.from("projects").update({
      payload: { ...p, aktif: aksi === "aktif" },
    }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: "Perubahan gagal disimpan." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (aksi === "catatan") {
    const { error } = await c.from("projects").update({
      payload: { ...p, catatan: String(catatan || "").slice(0, 500) },
    }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: "Catatan gagal disimpan." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Aksi tidak dikenali" }, { status: 400 });
}
