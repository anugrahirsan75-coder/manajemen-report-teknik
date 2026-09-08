/**
 * "Saya ini siapa" — dipanggil tiap halaman portal saat dibuka.
 *
 * Identitasnya diambil dari cookie bertanda tangan di SERVER, tidak pernah dari
 * apa pun yang disimpan peramban. Halaman portal memakai jawabannya untuk
 * memutuskan menu mana yang ditampilkan: akun Mesin melihat Stok Filter, akun
 * Deck melihat Alat Kesehatan. Yang menahan penulisannya tetap route
 * masing-masing — ini hanya soal tidak memperlihatkan tombol yang percuma.
 */
import { NextResponse } from "next/server";
import { dbServer, dbSiap } from "@/lib/dbServer";
import { sesiKapal } from "@/lib/portal/server";
import { KIND_ALKES, KIND_STOK_FILTER, tingkatAlkes } from "@/lib/portal/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await sesiKapal();
  if (!s) return NextResponse.json({ ok: false, error: "Belum masuk" }, { status: 401 });
  if (!dbSiap()) return NextResponse.json({ ok: true, ...s, ringkas: null });

  const c = dbServer()!;
  const kind = s.bagian === "mesin" ? KIND_STOK_FILTER : KIND_ALKES;
  const { data } = await c.from("projects")
    .select("payload")
    .filter("payload->>kind", "eq", kind)
    .filter("payload->>kapal", "eq", s.kapal)
    .limit(1);
  const p: any = (data || [])[0]?.payload || null;

  /*
   * Ringkasan dihitung di server, bukan dikirim mentah lalu dihitung di ponsel:
   * yang dibawa jaringan kapal cukup empat angka, bukan seluruh daftar stok.
   */
  const ringkas = !p ? null : s.bagian === "mesin"
    ? {
      baris: (p.filter || []).length,
      menipis: (p.filter || []).filter((f: any) => f.minimum > 0 && f.jumlah <= f.minimum).length,
      diperbaruiPada: p.diperbaruiPada || "",
    }
    : {
      baris: (p.item || []).length,
      lewat: (p.item || []).filter((b: any) => tingkatAlkes(b.kedaluwarsa) === "lewat").length,
      dekat: (p.item || []).filter((b: any) => ["kritis", "waspada"].includes(tingkatAlkes(b.kedaluwarsa))).length,
      diperbaruiPada: p.diperbaruiPada || "",
    };

  return NextResponse.json({ ok: true, kapal: s.kapal, bagian: s.bagian, nama: s.nama, ringkas });
}
