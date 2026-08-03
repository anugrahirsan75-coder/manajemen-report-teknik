/**
 * Data ekspor halaman terbuka: rekap + SELURUH item tiap pengadaan sekaligus.
 *
 * Dipisah dari GET daftar supaya halaman tak perlu memuat ribuan baris item
 * hanya untuk menampilkan tabel. Batasannya sama persis dengan pratinjau
 * per-baris: kepala dokumen + tabel item, tanpa vendor, penerima, foto,
 * catatan anggaran, maupun nama penanda tangan.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY_SB = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const n = (v: any) => (typeof v === "number" && isFinite(v) ? v : 0);
const s = (v: any) => String(v ?? "").trim();

function jenisAnggaran(p: any): "rutin" | "docking" | "lainnya" {
  const j = s(p?.jenisAnggaran).toLowerCase();
  if (j.startsWith("dock")) return "docking";
  if (j.startsWith("lain")) return "lainnya";
  if (j.startsWith("rutin")) return "rutin";
  if (p?.programId) return "lainnya";
  return `${s(p?.kategoriRekap)} ${s(p?.namaPengadaan)}`.toLowerCase().includes("docking") ? "docking" : "rutin";
}

export async function GET() {
  if (!URL_SB || !KEY_SB) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const c = createClient(URL_SB, KEY_SB);
  const { data, error } = await c.from("projects").select("id,nama_kapal,payload")
    .filter("payload->>kind", "eq", "sppbj");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const baris = (data || []).map((row: any) => {
    const p = row.payload || {};
    const items = (p.items || []).map((it: any) => ({
      kapal: s(it.kapal), nama: s(it.nama), spesifikasi: s(it.spesifikasi),
      keterangan: s(it.keterangan), breakdown: (it.breakdown || []).map(s).filter(Boolean),
      jumlah: n(it.jumlah), satuan: s(it.satuan),
      harga: n(it.harga), hargaSpbj: n(it.hargaSpbj),
    }));
    const kapal: string[] = [];
    items.forEach((it: any) => { if (it.kapal && !kapal.includes(it.kapal)) kapal.push(it.kapal); });
    return {
      id: row.id,
      nama: row.nama_kapal || s(p.namaPengadaan),
      noPr: s(p.noPRSAP) || s(p.noSPPBJ),
      noPo: s(p.noPOSAP),
      grSes: (p.grSes || []).filter((g: any) => s(g?.nomor))
        .map((g: any) => ({ termin: g.termin || null, nomor: s(g.nomor), tanggal: s(g.tanggal) })),
      jenis: jenisAnggaran(p),
      kapal, tanggal: s(p.tanggal), status: s(p.status) || "menunggu_spbj",
      mataAnggaran: Array.isArray(p.mataAnggaran) ? p.mataAnggaran.map(s) : [s(p.mataAnggaran)].filter(Boolean),
      dasarPelimpahan: s(p.dasarPelimpahan),
      items,
    };
  }).sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""));

  return NextResponse.json({ ok: true, baris });
}
