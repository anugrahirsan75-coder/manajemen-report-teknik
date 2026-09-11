/**
 * Permintaan Nomor IO — satu baris Supabase per PERIODE, bukan per item.
 *
 * Borangnya memang disusun per bulan dan dikirim per bulan; menyimpannya begitu
 * membuat "ambil bulan September" jadi satu pembacaan, dan ekspor Excel-nya
 * tidak perlu menjahit puluhan baris lepas. Seluruh periode sekaligus pun masih
 * ringan — dua belas baris setahun.
 *
 * Di balik gerbang login utama, jadi hanya akun Teknik yang menjangkaunya.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbServer, dbSiap } from "@/lib/dbServer";
import { KIND_IO, BarisIO } from "@/lib/io/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const teks = (v: unknown, n = 300) => String(v ?? "").slice(0, n).trim();
const periodeSah = (v: unknown) => (/^\d{4}-\d{2}$/.test(String(v || "")) ? String(v) : "");

/*
 * Baris dibersihkan di SERVER, bukan dipercaya apa adanya dari peramban.
 * Bentuk yang tersimpan menentukan apa yang bisa dibaca ekspor Excel setahun
 * lagi; satu medan liar yang lolos hari ini akan muncul sebagai sel kosong yang
 * tidak bisa dijelaskan di kemudian hari.
 */
const bersihBaris = (b: any): BarisIO => ({
  id: teks(b?.id, 40) || Math.random().toString(36).slice(2, 12),
  kapal: teks(b?.kapal, 60),
  assetClass: teks(b?.assetClass, 20),
  deskripsi: teks(b?.deskripsi, 300),
  spesifikasi: teks(b?.spesifikasi, 300),
  costCenter: teks(b?.costCenter, 40),
  unit: teks(b?.unit, 12),
  satuan: teks(b?.satuan, 20),
  hargaSatuan: teks(b?.hargaSatuan, 24),
  ppn: b?.ppn !== false,
  lokasi: teks(b?.lokasi, 120),
  gantiBaru: b?.gantiBaru === "Ganti" || b?.gantiBaru === "Baru" ? b.gantiBaru : "",
  asetLama: teks(b?.asetLama, 60),
  noAsetSap: teks(b?.noAsetSap, 60),
  noIoSap: teks(b?.noIoSap, 60),
  catatan: teks(b?.catatan, 500),
  dibuatPada: teks(b?.dibuatPada, 40) || new Date().toISOString(),
  diubahPada: new Date().toISOString(),
});

export async function GET(req: NextRequest) {
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const c = dbServer()!;

  const { data, error } = await c.from("projects").select("id,payload")
    .filter("payload->>kind", "eq", KIND_IO);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const periode = (data || [])
    .map((r: any) => ({
      periode: r.payload?.periode || "",
      baris: (r.payload?.baris || []) as BarisIO[],
      diperbaruiPada: r.payload?.diperbaruiPada || "",
    }))
    .filter((p) => p.periode)
    .sort((a, b) => b.periode.localeCompare(a.periode));

  return NextResponse.json({ ok: true, periode });
}

/** Simpan satu periode utuh — ganti seluruh isinya, bukan tambal per baris. */
export async function POST(req: NextRequest) {
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const periode = periodeSah(b.periode);
  if (!periode) return NextResponse.json({ ok: false, error: "Periode tidak sah" }, { status: 400 });

  const baris = Array.isArray(b.baris) ? (b.baris as any[]).map(bersihBaris) : [];
  const payload = { kind: KIND_IO, periode, baris, diperbaruiPada: new Date().toISOString() };

  const c = dbServer()!;
  const { data: ada } = await c.from("projects").select("id")
    .filter("payload->>kind", "eq", KIND_IO)
    .filter("payload->>periode", "eq", periode)
    .limit(1);

  const lama = (ada || [])[0];
  const { error } = lama
    ? await c.from("projects").update({ payload }).eq("id", lama.id)
    : await c.from("projects").insert({
        nama_kapal: `NOMOR IO ${periode}`, tahun: +periode.slice(0, 4), payload,
      });

  if (error) {
    console.error("nomor-io simpan:", error.message);
    return NextResponse.json({ ok: false, error: "Gagal menyimpan. Coba lagi." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, diperbaruiPada: payload.diperbaruiPada });
}
