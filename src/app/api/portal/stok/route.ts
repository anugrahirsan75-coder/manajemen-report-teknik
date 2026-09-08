/**
 * Stok filter & jam kerja mesin — diisi akun MESIN kapal.
 *
 * Kantor selama ini baru tahu filter sebuah kapal habis pada saat kapal
 * memintanya, yaitu ketika sudah telat: pengadaan butuh berminggu-minggu,
 * sedangkan filter dibutuhkan pada jam penggantian berikutnya. Dengan stok dan
 * jam kerja yang dicatat kapal sendiri, kebutuhan itu terbaca sebelum menjadi
 * permintaan mendesak.
 *
 * Bentuknya DAFTAR HIDUP, bukan setoran bulanan: yang ditanya selalu "sekarang
 * ada berapa", dan jawaban itu tidak boleh bergantung pada siapa yang
 * menjumlahkan setoran-setoran lama. Tiap perubahan meninggalkan jejak, karena
 * angka yang berubah tanpa bekas tidak bisa dipakai memutuskan belanja.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbSiap } from "@/lib/dbServer";
import { lembarKapal, sambungJejak, sesiBagian } from "@/lib/portal/server";
import type { BarisFilter, JamMesin } from "@/lib/portal/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAKS_BARIS = 200;

const angka = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const teks = (v: unknown, panjang = 120) => String(v ?? "").slice(0, panjang);

/** bentuk baris yang boleh masuk — apa pun selain ini dibuang, bukan dipercaya */
const bersihkanFilter = (b: any, kini: string): BarisFilter => ({
  id: teks(b?.id, 60) || `f-${Math.random().toString(36).slice(2, 10)}`,
  mesin: teks(b?.mesin, 40),
  jenis: teks(b?.jenis, 80),
  partNumber: teks(b?.partNumber, 60),
  jumlah: angka(b?.jumlah),
  satuan: teks(b?.satuan, 20) || "pcs",
  minimum: angka(b?.minimum),
  catatan: teks(b?.catatan, 200),
  diperbaruiPada: teks(b?.diperbaruiPada, 40) || kini,
});

const bersihkanMesin = (m: any, kini: string): JamMesin => ({
  id: teks(m?.id, 60) || `m-${Math.random().toString(36).slice(2, 10)}`,
  mesin: teks(m?.mesin, 40),
  merek: teks(m?.merek, 40),
  tipe: teks(m?.tipe, 60),
  nomorSeri: teks(m?.nomorSeri, 60),
  jam: angka(m?.jam),
  jamGantiTerakhir: angka(m?.jamGantiTerakhir),
  intervalJam: angka(m?.intervalJam),
  dicatatPada: teks(m?.dicatatPada, 40) || kini,
});

export async function GET() {
  const s = await sesiBagian("mesin");
  if (!s) return NextResponse.json({ ok: false, error: "Halaman ini untuk akun Mesin" }, { status: 403 });
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const { payload } = await lembarKapal("stok", s.kapal);
  return NextResponse.json({
    ok: true, kapal: s.kapal,
    filter: payload?.filter || [], mesin: payload?.mesin || [],
    diperbaruiPada: payload?.diperbaruiPada || "", olehAkun: payload?.olehAkun || "",
  });
}

export async function PUT(req: NextRequest) {
  const s = await sesiBagian("mesin");
  if (!s) return NextResponse.json({ ok: false, error: "Halaman ini untuk akun Mesin" }, { status: 403 });
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const isi = (await req.json().catch(() => ({}))) as { filter?: any[]; mesin?: any[] };
  const kini = new Date().toISOString();
  const filter = (Array.isArray(isi.filter) ? isi.filter : []).slice(0, MAKS_BARIS).map((b) => bersihkanFilter(b, kini));
  const mesin = (Array.isArray(isi.mesin) ? isi.mesin : []).slice(0, 20).map((m) => bersihkanMesin(m, kini));

  const { c, id, payload } = await lembarKapal("stok", s.kapal);
  if (!c || !id) return NextResponse.json({ ok: false, error: "Lembar stok gagal disiapkan" }, { status: 500 });

  /*
   * Jejaknya menyebut APA yang berubah, bukan sekadar "disunting". Perubahan
   * jumlah filter adalah dasar keputusan belanja; enam bulan kemudian pertanyaan
   * "kenapa waktu itu kita beli sepuluh" harus punya jawaban yang bisa dibaca.
   */
  const sebelum: BarisFilter[] = payload?.filter || [];
  const beda: string[] = [];
  filter.forEach((b) => {
    const lama = sebelum.find((x) => x.id === b.id);
    if (!lama) beda.push(`+ ${b.jenis || "filter"} ${b.partNumber} (${b.jumlah} ${b.satuan})`);
    else if (lama.jumlah !== b.jumlah) beda.push(`${b.jenis || "filter"} ${b.partNumber}: ${lama.jumlah} → ${b.jumlah}`);
  });
  sebelum.forEach((lama) => {
    if (!filter.some((b) => b.id === lama.id)) beda.push(`− ${lama.jenis || "filter"} ${lama.partNumber}`);
  });

  const { error } = await c.from("projects").update({
    payload: {
      ...payload, kind: payload?.kind || "stok_filter", kapal: s.kapal,
      filter, mesin, diperbaruiPada: kini, olehAkun: s.nama,
      riwayat: sambungJejak(payload?.riwayat, {
        pada: kini, oleh: s.nama, aksi: "ubah-stok",
        rincian: beda.slice(0, 12).join(" · ") || "penyesuaian tanpa perubahan jumlah",
      }),
    },
  }).eq("id", id);
  if (error) {
    console.error("portal/stok simpan:", error.message);
    return NextResponse.json({ ok: false, error: "Stok gagal disimpan. Coba lagi." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, diperbaruiPada: kini });
}
