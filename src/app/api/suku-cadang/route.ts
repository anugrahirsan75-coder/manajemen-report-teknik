/**
 * Persediaan suku cadang seluruh armada — dibaca KANTOR (di balik gerbang login utama).
 *
 * Tanpa parameter: semua lembar (13 kapal × Deck/Mesin), termasuk kapal yang
 * BELUM PERNAH mengisi — justru itu yang paling perlu terlihat.
 * Dengan ?kapal=&bagian=: satu lembar utuh, dipakai halaman cetak borang.
 *
 * Kantor hanya membaca. Angka stok milik kapal; kalau kantor ikut menyunting,
 * tidak ada lagi yang bisa menjawab angka itu hasil hitungan siapa.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbServer, dbSiap } from "@/lib/dbServer";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { KIND_SUKU_CADANG, ringkasSC } from "@/lib/portal/sukuCadang";
import { rapikan } from "@/lib/portal/sukuCadangServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const c = dbServer()!;
  const kapal = req.nextUrl.searchParams.get("kapal");
  const bagian = req.nextUrl.searchParams.get("bagian") === "deck" ? "deck" : "mesin";

  let q = c.from("projects").select("id,payload").filter("payload->>kind", "eq", KIND_SUKU_CADANG);
  if (kapal) q = q.filter("payload->>kapal", "eq", kapal).filter("payload->>bagian", "eq", bagian);
  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const lembar = (data || []).map((r: any) => rapikan(r.payload, r.payload?.kapal || "", r.payload?.bagian || "mesin"));

  if (kapal) {
    const satu = lembar[0];
    if (!satu) return NextResponse.json({ ok: false, error: `${kapal} (${bagian}) belum pernah mengisi persediaan` }, { status: 404 });
    return NextResponse.json({ ok: true, lembar: { ...satu, riwayat: undefined } });
  }

  const kunci = (k: string, b: string) => `${k}|${b}`;
  const peta = new Map(lembar.map((l) => [kunci(l.kapal, l.bagian), l]));
  /* kapal di luar daftar resmi tetap ikut di belakang, supaya tidak ada lembar yang tak terlihat */
  const daftarKapal = [...KAPAL_ANGGARAN, ...lembar.map((l) => l.kapal).filter((k) => !KAPAL_ANGGARAN.includes(k))];
  const armada = Array.from(new Set(daftarKapal)).map((k) => ({
    kapal: k,
    bagian: (["mesin", "deck"] as const).map((b) => {
      const l = peta.get(kunci(k, b));
      return {
        bagian: b,
        adaIsi: !!l?.item.length,
        diperbaruiPada: l?.diperbaruiPada || "",
        olehAkun: l?.olehAkun || "",
        ringkas: l ? ringkasSC(l) : null,
        item: l?.item || [],
        mutasi: l?.mutasi || [],
        cekFisik: l?.cekFisik || [],
        penandaTangan: l?.penandaTangan || null,
      };
    }),
  }));
  return NextResponse.json({ ok: true, armada });
}
