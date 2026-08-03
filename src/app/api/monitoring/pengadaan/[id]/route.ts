/**
 * Rincian satu pengadaan untuk pratinjau di halaman terbuka.
 *
 * Yang boleh keluar hanya isi tabel pekerjaan/barangnya — itulah yang memang
 * dipantau orang banyak. TIDAK ikut: vendor, penerima BSTB, foto dokumentasi,
 * catatan anggaran, dan nama pejabat penanda tangan. Hal-hal itu urusan
 * internal dan tak diperlukan untuk memantau.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY_SB = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const n = (v: any) => (typeof v === "number" && isFinite(v) ? v : 0);
const s = (v: any) => String(v ?? "").trim();

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!URL_SB || !KEY_SB) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const c = createClient(URL_SB, KEY_SB);
  const { data, error } = await c.from("projects").select("nama_kapal,payload").eq("id", params.id).single();
  if (error || !data) return NextResponse.json({ ok: false, error: "Pengadaan tak ditemukan" }, { status: 404 });

  const p: any = data.payload || {};
  if (p.kind !== "sppbj") return NextResponse.json({ ok: false, error: "Bukan SPPBJ Pengadaan" }, { status: 400 });

  return NextResponse.json({
    ok: true,
    dok: {
      namaPengadaan: data.nama_kapal || s(p.namaPengadaan),
      nomor: s(p.noSPPBJ),
      noPr: s(p.noPRSAP) || s(p.noSPPBJ),
      noPo: s(p.noPOSAP),
      tanggal: s(p.tanggal),
      dasarPelimpahan: s(p.dasarPelimpahan),
      mataAnggaran: Array.isArray(p.mataAnggaran) ? p.mataAnggaran.map(s) : [s(p.mataAnggaran)].filter(Boolean),
      grSes: (p.grSes || []).filter((g: any) => s(g?.nomor))
        .map((g: any) => ({ termin: g.termin || null, nomor: s(g.nomor), tanggal: s(g.tanggal) })),
      items: (p.items || []).map((it: any) => ({
        kapal: s(it.kapal), jumlah: n(it.jumlah), satuan: s(it.satuan),
        nama: s(it.nama), spesifikasi: s(it.spesifikasi),
        keterangan: s(it.keterangan), breakdown: (it.breakdown || []).map(s).filter(Boolean),
        harga: n(it.harga), hargaSpbj: n(it.hargaSpbj),
      })),
    },
  });
}
