/**
 * Perawatan berencana dari sisi kapal — ABK menandai pekerjaan selesai.
 *
 * Yang mengerjakan perawatan adalah ABK, dan hanya mereka yang tahu pekerjaan
 * itu benar-benar tuntas serta pada jam berapa. Selama pencatatannya harus
 * lewat kantor, catatan selalu tertinggal beberapa hari di belakang kenyataan
 * — dan PMS yang tertinggal berhenti dipakai memutuskan apa pun.
 *
 * Yang DIKIRIM kapal hanya peristiwa: pekerjaan mana, tanggal berapa, jam
 * berapa, siapa. Rencana kerjanya sendiri — interval, penanggung, daftar
 * peralatan — tetap milik kantor dan tidak bisa disunting dari sini. Kapal yang
 * bisa mengubah intervalnya sendiri berarti tidak ada lagi standar perawatan,
 * hanya kebiasaan masing-masing kapal.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbServer, dbSiap } from "@/lib/dbServer";
import { sesiKapal } from "@/lib/portal/server";
import { KIND_STOK_FILTER } from "@/lib/portal/types";
import { BATAS_RIWAYAT, KIND_KERJA, Pengerjaan, terapkan, urutRiwayat } from "@/lib/pms/kerja";
import type { PmsKapal, RencanaKerja } from "@/lib/pms/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIND_PMS = "pms";

const teks = (v: unknown, panjang = 160) => String(v ?? "").slice(0, panjang);
const angka = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
const tanggalSah = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : "");

/** baris projects untuk satu kapal pada satu kind; null bila belum ada */
async function barisKapal(kind: string, kapal: string) {
  const c = dbServer();
  if (!c) return { c: null, id: "", doc: null as any };
  const { data, error } = await c.from("projects").select("id,payload")
    .filter("payload->>kind", "eq", kind).filter("payload->>docId", "eq", kapal).limit(1);
  if (error) throw error;
  const ada = (data || [])[0];
  return { c, id: (ada?.id as string) || "", doc: ((ada?.payload as any)?.doc ?? null) };
}

/** jam jalan mesin terakhir yang dikirim kapal ini lewat Stok Filter */
async function jamKapal(kapal: string): Promise<Record<string, number>> {
  const c = dbServer();
  if (!c) return {};
  const { data } = await c.from("projects").select("payload")
    .filter("payload->>kind", "eq", KIND_STOK_FILTER)
    .filter("payload->>kapal", "eq", kapal).limit(1);
  const p: any = (data || [])[0]?.payload;
  const out: Record<string, number> = {};
  for (const m of p?.mesin || []) {
    const nama = String(m?.mesin || "").trim();
    if (nama) out[nama] = Number(m?.jam) || 0;
  }
  return out;
}

export async function GET() {
  const s = await sesiKapal();
  if (!s) return NextResponse.json({ ok: false, error: "Belum masuk" }, { status: 401 });
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  try {
    const { doc } = await barisKapal(KIND_PMS, s.kapal);
    const { doc: dk } = await barisKapal(KIND_KERJA, s.kapal);
    const pms = (doc || { kapal: s.kapal, peralatan: [], rencana: [] }) as PmsKapal;
    return NextResponse.json({
      ok: true, kapal: s.kapal, bagian: s.bagian,
      peralatan: pms.peralatan || [],
      rencana: (pms.rencana || []).filter((r) => r.aktif),
      // riwayat dipangkas: yang dibaca di ponsel cukup yang terakhir
      riwayat: ((dk?.riwayat || []) as Pengerjaan[]).sort(urutRiwayat).slice(0, 40),
      jam: await jamKapal(s.kapal),
    });
  } catch (e: any) {
    console.error("portal/perawatan baca:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Data perawatan gagal dimuat" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const s = await sesiKapal();
  if (!s) return NextResponse.json({ ok: false, error: "Belum masuk" }, { status: 401 });
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const isi = (await req.json().catch(() => ({}))) as any;
  const rencanaId = teks(isi?.rencanaId, 60);
  const tanggal = tanggalSah(isi?.tanggal);
  if (!rencanaId) return NextResponse.json({ ok: false, error: "Pekerjaan belum dipilih" }, { status: 400 });
  if (!tanggal) return NextResponse.json({ ok: false, error: "Tanggal pengerjaan tidak sah" }, { status: 400 });
  // tanggal di masa depan berarti salah ketik — dan sekali masuk, ia menggeser
  // jatuh tempo berikutnya ke tahun yang keliru tanpa ada yang menyadarinya
  if (tanggal > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ ok: false, error: "Tanggal pengerjaan tidak boleh melewati hari ini" }, { status: 400 });
  }

  try {
    const { c, id: idPms, doc } = await barisKapal(KIND_PMS, s.kapal);
    if (!c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

    const pms = doc as PmsKapal | null;
    const rencana: RencanaKerja | undefined = (pms?.rencana || []).find((r) => r.id === rencanaId);
    /*
     * Rencana harus dicari di lembar kapal INI. Tanpa pemeriksaan ini, sebuah
     * id yang disalin dari kapal lain akan menulis riwayat ke kapal yang salah
     * — dan riwayat perawatan yang tertukar antar-kapal adalah kekeliruan yang
     * tidak mungkin dibereskan belakangan.
     */
    if (!rencana) return NextResponse.json({ ok: false, error: "Pekerjaan itu tidak ada di rencana kapal ini" }, { status: 404 });
    if (!rencana.aktif) return NextResponse.json({ ok: false, error: "Rencana itu sedang tidak aktif" }, { status: 409 });

    const jam = rencana.basis === "jam" ? angka(isi?.jam) : undefined;
    if (rencana.basis === "jam" && jam === undefined) {
      return NextResponse.json({ ok: false, error: "Isi jam jalan mesin saat pekerjaan dilakukan" }, { status: 400 });
    }

    const kini = new Date().toISOString();
    const k: Pengerjaan = {
      id: `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      rencanaId, tag: rencana.tag, pekerjaan: rencana.pekerjaan, basis: rencana.basis,
      tanggal, jam,
      pelaksana: teks(isi?.pelaksana, 80) || s.nama,
      catatan: teks(isi?.catatan, 400) || undefined,
      sukuCadangDipakai: teks(isi?.sukuCadangDipakai, 200) || undefined,
      sumber: "kapal",
      olehAkun: s.nama,
      dicatatPada: kini,
      status: "menunggu",
      sebelumTanggal: rencana.terakhirTanggal,
      sebelumJam: rencana.terakhirJam,
    };

    /*
     * Riwayat ditulis LEBIH DULU, capaian rencana sesudahnya. Kalau yang kedua
     * gagal, yang tertinggal adalah catatan tanpa pergeseran jam — pekerjaannya
     * masih tampak tertunggak, keliru ke arah yang aman. Urutan sebaliknya
     * meninggalkan jam yang bergeser tanpa catatan yang menerangkan kenapa.
     */
    const { id: idKerja, doc: dk } = await barisKapal(KIND_KERJA, s.kapal);
    const riwayat = [k, ...((dk?.riwayat || []) as Pengerjaan[])].sort(urutRiwayat).slice(0, BATAS_RIWAYAT);
    const docKerja = { kapal: s.kapal, riwayat, diubahPada: kini };
    const payloadKerja = { kind: KIND_KERJA, docId: s.kapal, kapal: s.kapal, doc: docKerja };

    const tulisKerja = idKerja
      ? await c.from("projects").update({ payload: payloadKerja }).eq("id", idKerja)
      : await c.from("projects").insert({
        nama_kapal: `PMS Riwayat ${s.kapal}`, tahun: new Date().getFullYear(), payload: payloadKerja,
      });
    if (tulisKerja.error) throw tulisKerja.error;

    if (idPms && pms) {
      const baru: PmsKapal = {
        ...pms,
        rencana: pms.rencana.map((r) => (r.id === rencanaId ? terapkan(r, k) : r)),
        diubahPada: kini,
      };
      const { error } = await c.from("projects")
        .update({ payload: { kind: KIND_PMS, docId: s.kapal, kapal: s.kapal, doc: baru } })
        .eq("id", idPms);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, id: k.id });
  } catch (e: any) {
    console.error("portal/perawatan simpan:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Laporan gagal disimpan. Coba lagi." }, { status: 500 });
  }
}
