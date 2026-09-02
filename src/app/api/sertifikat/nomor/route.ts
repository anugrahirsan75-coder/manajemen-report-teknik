/**
 * Nomor sertifikat yang diketik kantor.
 *
 * Lembar MUSTER cabang tidak menyimpan nomor sertifikat — hanya tanggal dan
 * tautan berkasnya. Nomornya ada di dalam PDF, dan sebagian pindaian terlalu
 * pudar untuk dibaca mesin. Jadi nomor itu diketik sekali di aplikasi, disimpan
 * di sini, lalu ikut tercetak tiap kali borang FLEET CERTIFICATE diekspor.
 *
 * Kalau tidak disimpan, tiap ekspor bulanan akan mengosongkan lagi kolom yang
 * sudah susah payah diisi tangan.
 *
 * Satu baris per KAPAL (payload.kind = "sertifikat_nomor"), isinya peta
 * "FDOC/007|Nama baris MUSTER" -> nomor. Dengan begitu satu kapal cukup satu
 * baris walau dokumennya dua puluhan.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbServer, dbSiap } from "@/lib/dbServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIND = "sertifikat_nomor";

export async function GET() {
  if (!dbSiap()) return NextResponse.json({ ok: true, nomor: {} });
  const c = dbServer();
  if (!c) return NextResponse.json({ ok: true, nomor: {} });

  const { data, error } = await c.from("projects")
    .select("nama_kapal,payload").filter("payload->>kind", "eq", KIND);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const nomor: Record<string, Record<string, string>> = {};
  (data || []).forEach((r: any) => {
    const kapal = r.payload?.kapal || r.nama_kapal || "";
    if (kapal) nomor[kapal] = r.payload?.nomor || {};
  });
  return NextResponse.json({ ok: true, nomor });
}

export async function PATCH(req: NextRequest) {
  const c = dbServer();
  if (!c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const { kapal, kunci, nomor } = await req.json().catch(() => ({} as any));
  if (typeof kapal !== "string" || !kapal.trim() || typeof kunci !== "string" || !kunci.trim()) {
    return NextResponse.json({ ok: false, error: "Kapal dan kunci dokumen wajib diisi" }, { status: 400 });
  }
  const nilai = String(nomor ?? "").trim().slice(0, 120);

  const { data: ada, error: e1 } = await c.from("projects")
    .select("id,payload").filter("payload->>kind", "eq", KIND).eq("nama_kapal", kapal).limit(1);
  if (e1) return NextResponse.json({ ok: false, error: e1.message }, { status: 500 });

  const lama = (ada?.[0]?.payload as any) || {};
  const peta: Record<string, string> = { ...(lama.nomor || {}) };
  // nomor yang dikosongkan artinya DIHAPUS, bukan disimpan sebagai string kosong:
  // kolom kosong di borang harus terbaca "belum diisi", bukan "diisi kosong"
  if (nilai) peta[kunci] = nilai;
  else delete peta[kunci];

  const payload = {
    ...lama, kind: KIND, kapal,
    nomor: peta,
    diubahPada: new Date().toISOString(),
  };

  if (ada?.[0]?.id) {
    const { error } = await c.from("projects").update({ payload }).eq("id", ada[0].id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    const { error } = await c.from("projects").insert({
      nama_kapal: kapal, tahun: new Date().getFullYear(), payload,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, kapal, kunci, nomor: nilai });
}
