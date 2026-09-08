/**
 * Data yang diisi kapal, dilihat dari KANTOR: stok filter dan alat kesehatan
 * seluruh armada dalam satu jawaban.
 *
 * Berada di balik gerbang login utama, jadi hanya akun Teknik yang bisa
 * memanggilnya. Sengaja mengembalikan SELURUH baris, bukan ringkasannya saja:
 * halaman kantor perlu bisa membuka rincian tiap kapal tanpa memanggil ulang
 * tiga belas kali, dan seluruh data ini pun hanya beberapa puluh kilobita.
 *
 * Kapal yang BELUM PERNAH mengisi ikut disebut. Itu justru jawaban yang paling
 * dicari: daftar yang hanya memuat kapal yang rajin membuat kapal yang diam
 * menghilang dari layar.
 */
import { NextResponse } from "next/server";
import { dbServer, dbSiap } from "@/lib/dbServer";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { KIND_ALKES, KIND_STOK_FILTER, tingkatAlkes } from "@/lib/portal/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const c = dbServer()!;

  const [stok, alkes] = await Promise.all([
    c.from("projects").select("id,payload").filter("payload->>kind", "eq", KIND_STOK_FILTER),
    c.from("projects").select("id,payload").filter("payload->>kind", "eq", KIND_ALKES),
  ]);
  if (stok.error || alkes.error) {
    return NextResponse.json({ ok: false, error: (stok.error || alkes.error)!.message }, { status: 500 });
  }

  const petaStok = new Map<string, any>();
  (stok.data || []).forEach((r: any) => petaStok.set((r.payload || {}).kapal, r.payload));
  const petaAlkes = new Map<string, any>();
  (alkes.data || []).forEach((r: any) => petaAlkes.set((r.payload || {}).kapal, r.payload));

  const armada = KAPAL_ANGGARAN.map((kapal) => {
    const s = petaStok.get(kapal);
    const a = petaAlkes.get(kapal);
    const filter = (s?.filter || []) as any[];
    const mesin = (s?.mesin || []) as any[];
    const item = (a?.item || []) as any[];

    return {
      kapal,
      stok: {
        adaIsi: !!s?.diperbaruiPada,
        diperbaruiPada: s?.diperbaruiPada || "",
        olehAkun: s?.olehAkun || "",
        jenis: filter.length,
        totalLembar: filter.reduce((n, f) => n + (Number(f.jumlah) || 0), 0),
        menipis: filter.filter((f) => Number(f.minimum) > 0 && Number(f.jumlah) <= Number(f.minimum)).length,
        /* mesin yang penggantian filternya tinggal ≤ 50 jam lagi */
        gantiDekat: mesin.filter((m) => {
          const interval = Number(m.intervalJam) || 0;
          if (!interval) return false;
          const jalan = Math.max(0, (Number(m.jam) || 0) - (Number(m.jamGantiTerakhir) || 0));
          return interval - jalan <= 50;
        }).length,
        filter, mesin,
      },
      alkes: {
        adaIsi: !!a?.diperbaruiPada,
        diperbaruiPada: a?.diperbaruiPada || "",
        olehAkun: a?.olehAkun || "",
        butir: item.length,
        lewat: item.filter((b) => tingkatAlkes(b.kedaluwarsa) === "lewat").length,
        kritis: item.filter((b) => tingkatAlkes(b.kedaluwarsa) === "kritis").length,
        waspada: item.filter((b) => tingkatAlkes(b.kedaluwarsa) === "waspada").length,
        menipis: item.filter((b) => Number(b.minimum) > 0 && Number(b.jumlah) <= Number(b.minimum)).length,
        item,
      },
    };
  });

  return NextResponse.json({ ok: true, armada });
}
