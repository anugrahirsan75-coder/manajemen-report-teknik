/**
 * Unduh SPPBJ satu pengadaan dari halaman terbuka — memakai TEMPLATE SPPBJ
 * yang sama persis dengan yang dipakai di dalam aplikasi (templates/sppbj),
 * bukan lembar buatan sendiri. Jadi berkas yang diunduh orang luar sama
 * bentuknya dengan yang dipakai cabang.
 *
 * Payload lengkap hanya dibaca DI SISI SERVER untuk mengisi template; halaman
 * terbuka tetap tak pernah menerima isian internal seperti vendor & penerima
 * dalam bentuk data — yang keluar hanya berkas jadinya.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SppbjRequest } from "@/lib/sppbj/types";
import { fillSppbj } from "@/lib/sppbj/fill";
import { fillFase1, fillLengkap } from "@/lib/sppbj/fill2";

export const runtime = "nodejs";
export const maxDuration = 120;

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY_SB = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const aman = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim();

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!URL_SB || !KEY_SB) return NextResponse.json({ error: "Sumber data belum siap" }, { status: 503 });
  const c = createClient(URL_SB, KEY_SB);
  const { data, error } = await c.from("projects").select("nama_kapal,payload").eq("id", params.id).single();
  if (error || !data) return NextResponse.json({ error: "Pengadaan tak ditemukan" }, { status: 404 });

  const p: any = data.payload || {};
  if (p.kind !== "sppbj") return NextResponse.json({ error: "Bukan SPPBJ Pengadaan" }, { status: 400 });

  // "doc" menentukan lembar apa yang diisi — sama pilihannya dengan di aplikasi
  const doc = req.nextUrl.searchParams.get("doc") || "sppbj";
  const isi: SppbjRequest = { ...p, namaPengadaan: p.namaPengadaan || data.nama_kapal || "" };

  try {
    const buf =
      doc === "lengkap" ? await fillLengkap(isi)
        : doc === "fase1" ? await fillFase1(isi)
        : await fillSppbj(isi);
    const nama = aman(isi.namaPengadaan || "SPPBJ").slice(0, 80) || "SPPBJ";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nama}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal menyusun berkas" }, { status: 500 });
  }
}
