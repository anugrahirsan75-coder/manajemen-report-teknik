/**
 * Data untuk halaman Monitoring Pengadaan Teknik — halaman TERBUKA, tanpa login.
 *
 * Karena terbuka, route ini sengaja dibuat sempit:
 *
 *   GET   hanya mengembalikan kolom rekap yang memang untuk dilihat orang
 *         banyak (judul, nomor, jenis, kapal, nilai). Rincian item, vendor,
 *         penerima, foto, catatan anggaran TIDAK ikut keluar.
 *   POST  hanya boleh mengubah 4 hal: No. PR SAP, No. PO SAP, GR/SES, dan
 *         status — dan harus menyertakan kode ubah. Menambah atau menghapus
 *         pengadaan tidak mungkin lewat sini.
 *
 * Hanya SPPBJ Pengadaan (kind="sppbj"). SPPBJ Non PR PO sengaja tidak ikut.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY_SB = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const KODE_UBAH = process.env.MONITOR_EDIT_CODE || "";

const sb = () => (URL_SB && KEY_SB ? createClient(URL_SB, KEY_SB) : null);

const n = (v: any) => (typeof v === "number" && isFinite(v) ? v : 0);

/** jenis anggaran — aturan sama dengan Dashboard, disalin ringkas ke sisi server */
function jenisAnggaran(p: any): "rutin" | "docking" | "lainnya" {
  const j = String(p?.jenisAnggaran || "").toLowerCase();
  if (j.startsWith("dock")) return "docking";
  if (j.startsWith("lain")) return "lainnya";
  if (j.startsWith("rutin")) return "rutin";
  if (p?.programId) return "lainnya";
  const t = `${p?.kategoriRekap || ""} ${p?.namaPengadaan || ""}`.toLowerCase();
  if (t.includes("docking")) return "docking";
  return "rutin";
}

const kapalDari = (items: any[]) => {
  const out: string[] = [];
  for (const it of items || []) {
    const k = String(it?.kapal || "").trim();
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
};

/** baris rekap — sengaja hanya kolom yang boleh dilihat umum */
function keRekap(row: any) {
  const p = row.payload || {};
  const items: any[] = p.items || [];
  // nilai PR = harga usulan; nilai SPBJ = harga final PO bila sudah diisi
  const nilaiPr = items.reduce((s, i) => s + n(i.harga) * n(i.jumlah), 0);
  const nilaiSpbj = items.reduce(
    (s, i) => s + (n(i.hargaSpbj) > 0 ? n(i.hargaSpbj) : n(i.harga)) * n(i.jumlah), 0);
  return {
    id: row.id,
    nama: row.nama_kapal || p.namaPengadaan || "",
    noPr: p.noPRSAP || p.noSPPBJ || "",
    noPo: p.noPOSAP || "",
    grSes: (p.grSes || [])
      .filter((g: any) => String(g?.nomor || "").trim())
      .map((g: any) => ({ termin: g.termin || null, nomor: String(g.nomor), tanggal: g.tanggal || "" })),
    jenis: jenisAnggaran(p),
    kapal: kapalDari(items),
    tanggal: p.tanggal || "",
    status: p.status || "menunggu_spbj",
    nilaiPr,
    nilaiSpbj: items.some((i) => n(i.hargaSpbj) > 0) ? nilaiSpbj : 0,
    jumlahItem: items.length,
  };
}

export async function GET() {
  const c = sb();
  if (!c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const { data, error } = await c.from("projects")
    .select("id,nama_kapal,payload")
    .filter("payload->>kind", "eq", "sppbj");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const baris = (data || []).map(keRekap)
    .sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""));
  return NextResponse.json({ ok: true, baris, bolehUbah: !!KODE_UBAH });
}

const STATUS_SAH = new Set(["menunggu_spbj", "spbj_terbit", "selesai"]);

export async function POST(req: NextRequest) {
  if (!KODE_UBAH) {
    return NextResponse.json({ ok: false, error: "Pengubahan dari halaman ini belum diaktifkan." }, { status: 403 });
  }
  const c = sb();
  if (!c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { id, kode, noPr, noPo, grSes, status } = body as any;
  if (kode !== KODE_UBAH) {
    return NextResponse.json({ ok: false, error: "Kode ubah salah." }, { status: 401 });
  }
  if (!id) return NextResponse.json({ ok: false, error: "Baris tak dikenali" }, { status: 400 });

  const { data: ada, error: e1 } = await c.from("projects").select("payload").eq("id", id).single();
  if (e1 || !ada) return NextResponse.json({ ok: false, error: "Pengadaan tak ditemukan" }, { status: 404 });
  if (ada.payload?.kind !== "sppbj") {
    return NextResponse.json({ ok: false, error: "Bukan SPPBJ Pengadaan" }, { status: 400 });
  }

  // hanya empat hal ini yang boleh berubah dari halaman terbuka
  const payload: any = { ...ada.payload };
  if (typeof noPr === "string") payload.noPRSAP = noPr.trim();
  if (typeof noPo === "string") payload.noPOSAP = noPo.trim();
  if (typeof status === "string" && STATUS_SAH.has(status)) payload.status = status;
  if (Array.isArray(grSes)) {
    payload.grSes = grSes.slice(0, 6).map((g: any, i: number) => ({
      id: String(g?.id || `m${i}`),
      termin: [1, 2, 3].includes(+g?.termin) ? +g.termin : undefined,
      nomor: String(g?.nomor || "").slice(0, 40),
      tanggal: typeof g?.tanggal === "string" ? g.tanggal.slice(0, 10) : undefined,
    })).filter((g: any) => g.nomor);
  }

  const { error: e2 } = await c.from("projects").update({ payload }).eq("id", id);
  if (e2) return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });
  return NextResponse.json({ ok: true, baris: keRekap({ id, nama_kapal: payload.namaPengadaan, payload }) });
}
