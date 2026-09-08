/**
 * Alat kesehatan kapal — diisi akun DECK.
 *
 * Obat dan alat P3K punya masa kedaluwarsa, dan di kapal masa itu lewat tanpa
 * ada yang menyadarinya: kotaknya baru dibuka ketika sudah ada yang terluka.
 * Yang dicatat di sini bukan sekadar "ada atau tidak", melainkan KAPAN habis
 * masa berlakunya — sehingga penggantiannya bisa dibelanjakan pada waktu biasa,
 * bukan sebagai permintaan mendesak setelah kejadian.
 *
 * Sama seperti stok filter: daftar hidup, bukan setoran bulanan, dengan jejak
 * tiap perubahan.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbSiap } from "@/lib/dbServer";
import { lembarKapal, sambungJejak, sesiBagian } from "@/lib/portal/server";
import type { BarisAlkes } from "@/lib/portal/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAKS_BARIS = 300;

const angka = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const teks = (v: unknown, panjang = 120) => String(v ?? "").slice(0, panjang);

/** tanggal hanya diterima dalam bentuk yang sah; selain itu dikosongkan */
const tanggal = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");

const bersihkan = (b: any, kini: string): BarisAlkes => ({
  id: teks(b?.id, 60) || `a-${Math.random().toString(36).slice(2, 10)}`,
  nama: teks(b?.nama, 120),
  golongan: teks(b?.golongan, 40),
  jumlah: angka(b?.jumlah),
  satuan: teks(b?.satuan, 20) || "pcs",
  kedaluwarsa: tanggal(b?.kedaluwarsa),
  lokasi: teks(b?.lokasi, 60),
  minimum: angka(b?.minimum),
  catatan: teks(b?.catatan, 200),
  diperbaruiPada: teks(b?.diperbaruiPada, 40) || kini,
});

export async function GET() {
  const s = await sesiBagian("deck");
  if (!s) return NextResponse.json({ ok: false, error: "Halaman ini untuk akun Deck" }, { status: 403 });
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const { payload } = await lembarKapal("alkes", s.kapal);
  return NextResponse.json({
    ok: true, kapal: s.kapal,
    item: payload?.item || [],
    diperbaruiPada: payload?.diperbaruiPada || "", olehAkun: payload?.olehAkun || "",
  });
}

export async function PUT(req: NextRequest) {
  const s = await sesiBagian("deck");
  if (!s) return NextResponse.json({ ok: false, error: "Halaman ini untuk akun Deck" }, { status: 403 });
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const isi = (await req.json().catch(() => ({}))) as { item?: any[] };
  const kini = new Date().toISOString();
  const item = (Array.isArray(isi.item) ? isi.item : []).slice(0, MAKS_BARIS).map((b) => bersihkan(b, kini));

  const { c, id, payload } = await lembarKapal("alkes", s.kapal);
  if (!c || !id) return NextResponse.json({ ok: false, error: "Lembar alkes gagal disiapkan" }, { status: 500 });

  const sebelum: BarisAlkes[] = payload?.item || [];
  const beda: string[] = [];
  item.forEach((b) => {
    const lama = sebelum.find((x) => x.id === b.id);
    if (!lama) beda.push(`+ ${b.nama} (${b.jumlah} ${b.satuan}${b.kedaluwarsa ? `, exp ${b.kedaluwarsa}` : ""})`);
    else {
      if (lama.jumlah !== b.jumlah) beda.push(`${b.nama}: ${lama.jumlah} → ${b.jumlah}`);
      if (lama.kedaluwarsa !== b.kedaluwarsa) beda.push(`${b.nama} exp: ${lama.kedaluwarsa || "—"} → ${b.kedaluwarsa || "—"}`);
    }
  });
  sebelum.forEach((lama) => { if (!item.some((b) => b.id === lama.id)) beda.push(`− ${lama.nama}`); });

  const { error } = await c.from("projects").update({
    payload: {
      ...payload, kind: payload?.kind || "alkes_kapal", kapal: s.kapal,
      item, diperbaruiPada: kini, olehAkun: s.nama,
      riwayat: sambungJejak(payload?.riwayat, {
        pada: kini, oleh: s.nama, aksi: "ubah-alkes",
        rincian: beda.slice(0, 12).join(" · ") || "penyesuaian tanpa perubahan jumlah",
      }),
    },
  }).eq("id", id);
  if (error) {
    console.error("portal/alkes simpan:", error.message);
    return NextResponse.json({ ok: false, error: "Data alkes gagal disimpan. Coba lagi." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, diperbaruiPada: kini });
}
