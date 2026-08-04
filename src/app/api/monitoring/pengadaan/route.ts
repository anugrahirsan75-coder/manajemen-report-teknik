/**
 * Data untuk halaman Monitoring Pengadaan Teknik — halaman TERBUKA, tanpa login.
 *
 * Karena terbuka, route ini sengaja dibuat sempit:
 *
 *   GET   hanya mengembalikan kolom rekap yang memang untuk dilihat orang
 *         banyak (judul, nomor, jenis, kapal, nilai). Rincian item, vendor,
 *         penerima, foto, catatan anggaran TIDAK ikut keluar.
 *   POST  hanya boleh mengubah TIGA hal: No. PO SAP, No. GR/SES, dan status.
 *         No. PR SAP dikunci — itu nomor terbit dari SAP, jadi patokan yang
 *         menautkan baris ini ke dokumen aslinya dan tak boleh bergeser dari
 *         halaman terbuka. Nilai rupiah juga tak bisa disentuh: angkanya
 *         dihitung dari item pengadaan. Menambah/menghapus pengadaan tidak
 *         mungkin lewat sini.
 *
 * Pengisian sengaja TANPA kode atas keputusan pemilik proses, supaya petugas
 * bisa langsung mengisi. Penggantinya: pembatas laju per alamat IP dan jejak
 * waktu tiap perubahan, sehingga penyalahgunaan tetap terlihat dan tertahan.
 *
 * Hanya SPPBJ Pengadaan (kind="sppbj"). SPPBJ Non PR PO sengaja tidak ikut.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY_SB = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

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
    tanggalSpbj: p.tanggalSPBJ || "",
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
  // Urutan harus tetap sama tiap kali dimuat. Tanggal saja tak cukup — banyak
  // pengadaan bertanggal sama, dan urutan Supabase tidak dijamin, sehingga
  // baris bisa berpindah-pindah di layar. Disamakan dengan nama lalu id.
  const baris = (data || []).map(keRekap).sort((a, b) =>
    (b.tanggal || "").localeCompare(a.tanggal || "")
    || a.nama.localeCompare(b.nama, "id")
    || a.id.localeCompare(b.id));
  return NextResponse.json({ ok: true, baris, bolehUbah: true });
}

const STATUS_SAH = new Set(["menunggu_spbj", "spbj_terbit", "selesai"]);

/**
 * Pembatas laju sederhana per alamat IP. Bukan pengganti kata sandi, tapi
 * menahan penyuntingan borongan: tanpa ini satu skrip bisa menyapu seluruh
 * baris dalam hitungan detik.
 */
const JEJAK = new Map<string, number[]>();
const JENDELA_MS = 5 * 60 * 1000;
const BATAS = 40;
function lajuTerlampaui(ip: string) {
  const kini = Date.now();
  const lama = (JEJAK.get(ip) || []).filter((t) => kini - t < JENDELA_MS);
  lama.push(kini);
  JEJAK.set(ip, lama);
  if (JEJAK.size > 500) JEJAK.clear();          // jaga-jaga agar tak menumpuk
  return lama.length > BATAS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "tak-dikenal";
  if (lajuTerlampaui(ip)) {
    return NextResponse.json(
      { ok: false, error: "Terlalu banyak perubahan dalam waktu singkat. Coba lagi beberapa menit." },
      { status: 429 });
  }
  const c = sb();
  if (!c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { id, noPo, grSes, status } = body as any;
  if (!id) return NextResponse.json({ ok: false, error: "Baris tak dikenali" }, { status: 400 });

  const { data: ada, error: e1 } = await c.from("projects").select("payload").eq("id", id).single();
  if (e1 || !ada) return NextResponse.json({ ok: false, error: "Pengadaan tak ditemukan" }, { status: 404 });
  if (ada.payload?.kind !== "sppbj") {
    return NextResponse.json({ ok: false, error: "Bukan SPPBJ Pengadaan" }, { status: 400 });
  }

  // hanya tiga hal ini yang boleh berubah dari halaman terbuka.
  // No. PR SAP sengaja TIDAK ikut walau dikirim — dikunci di sisi server,
  // bukan sekadar dinonaktifkan di layar, supaya tetap aman bila ada yang
  // memanggil route ini langsung.
  const payload: any = { ...ada.payload };
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

  // jejak: kapan dan berapa kali baris ini diubah dari halaman terbuka
  payload.monitorUbahPada = new Date().toISOString();
  payload.monitorUbahKe = (Number(payload.monitorUbahKe) || 0) + 1;

  const { error: e2 } = await c.from("projects").update({ payload }).eq("id", id);
  if (e2) return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });
  return NextResponse.json({ ok: true, baris: keRekap({ id, nama_kapal: payload.namaPengadaan, payload }) });
}
