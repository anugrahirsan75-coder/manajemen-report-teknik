/**
 * Temuan inspeksi kapal — daftar, simpan borongan, ubah, hapus.
 *
 * Satu baris tabel `projects` per temuan (payload.kind = "inspeksi_temuan").
 * Bentuk itu dipilih supaya dua orang yang menutup dua temuan berbeda pada
 * laporan yang sama tidak saling menimpa — pelajaran dari kiriman ABK, di mana
 * catatan yang ditulis ulang penuh sempat menghapus berkas yang baru masuk.
 *
 * Di balik login: ini rekap internal, bukan halaman terbuka.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { dbLapor, dbSiap } from "@/lib/lapor/db";
import {
  BAGIAN_INSPEKSI, STATUS_TEMUAN, TINGKAT_TEMUAN, Temuan, hariIni, tambahHari,
} from "@/lib/inspeksi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KIND = "inspeksi_temuan";
const MAKS_BORONGAN = 200;

const teks = (v: unknown, maks: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, maks);
const tanggal = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : "");

const sah = <T extends { id: string }>(daftar: T[], v: unknown, bawaan: string) =>
  (daftar.some((x) => x.id === v) ? String(v) : bawaan);

function keTemuan(row: any): Temuan {
  const p = row.payload || {};
  return {
    id: row.id,
    kapal: p.kapal || row.nama_kapal || "",
    tanggalInspeksi: p.tanggalInspeksi || "",
    inspektor: p.inspektor || "",
    bagian: p.bagian || "lain",
    komponen: p.komponen || "",
    uraian: p.uraian || "",
    penyebab: p.penyebab || "",
    tindakan: p.tindakan || "",
    tingkat: p.tingkat || "minor",
    targetSelesai: p.targetSelesai || "",
    penanggungJawab: p.penanggungJawab || "kapal",
    status: p.status || "terbuka",
    catatanTutup: p.catatanTutup || "",
    diverifikasiOleh: p.diverifikasiOleh || "",
    diverifikasiPada: p.diverifikasiPada || "",
    // bukti disimpan pada payload.berkas oleh jalur unggah bersama
    // (/api/lapor/berkas), jadi tidak ada dua tempat penyimpanan berkas
    bukti: Array.isArray(p.berkas) ? p.berkas : [],
    riwayat: Array.isArray(p.riwayat) ? p.riwayat : [],
    sumber: p.sumber || "",
    dibuatPada: p.dibuatPada || "",
    token: p.token || "",
  };
}

export async function GET() {
  const c = dbLapor();
  if (!c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const { data, error } = await c.from("projects")
    .select("id,nama_kapal,payload").filter("payload->>kind", "eq", KIND);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // terbaru di atas; id sebagai pemutus supaya urutannya tidak berubah-ubah
  const baris = (data || []).map(keTemuan).sort((a, b) =>
    (b.tanggalInspeksi || "").localeCompare(a.tanggalInspeksi || "")
    || (b.dibuatPada || "").localeCompare(a.dibuatPada || "")
    || a.id.localeCompare(b.id));
  return NextResponse.json({ ok: true, baris });
}

/** simpan hasil impor / tambahan manual — bisa banyak sekaligus */
export async function POST(req: NextRequest) {
  const c = dbLapor();
  if (!dbSiap() || !c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const b = await req.json().catch(() => ({} as any));
  const masuk: any[] = Array.isArray(b?.temuan) ? b.temuan : [b?.temuan].filter(Boolean);
  if (!masuk.length) return NextResponse.json({ ok: false, error: "Tidak ada temuan yang dikirim" }, { status: 400 });
  if (masuk.length > MAKS_BORONGAN) {
    return NextResponse.json({ ok: false, error: `Maksimal ${MAKS_BORONGAN} temuan sekali simpan` }, { status: 400 });
  }

  const sekarang = new Date().toISOString();
  const baris = masuk
    .map((t) => {
      const tingkat = sah(TINGKAT_TEMUAN, t.tingkat, "minor");
      const tglInspeksi = tanggal(t.tanggalInspeksi) || hariIni();
      const bawaanHari = TINGKAT_TEMUAN.find((x) => x.id === tingkat)!.hari;
      return {
        kapal: teks(t.kapal, 60),
        komponen: teks(t.komponen, 200),
        uraian: teks(t.uraian, 1500),
        payload: {
          kind: KIND,
          kapal: teks(t.kapal, 60),
          tanggalInspeksi: tglInspeksi,
          inspektor: teks(t.inspektor, 80),
          bagian: sah(BAGIAN_INSPEKSI, t.bagian, "lain"),
          komponen: teks(t.komponen, 200),
          uraian: teks(t.uraian, 1500),
          penyebab: teks(t.penyebab, 800),
          tindakan: teks(t.tindakan, 800),
          tingkat,
          // target kosong diisi dari klasifikasinya, bukan dibiarkan kosong:
          // temuan tanpa tenggat tidak pernah muncul sebagai terlambat
          targetSelesai: tanggal(t.targetSelesai) || tambahHari(tglInspeksi, bawaanHari),
          penanggungJawab: ["kapal", "darat", "galangan"].includes(t.penanggungJawab) ? t.penanggungJawab : "kapal",
          status: sah(STATUS_TEMUAN, t.status, "terbuka"),
          catatanTutup: "", diverifikasiOleh: "", diverifikasiPada: "",
          berkas: [], riwayat: [{ status: sah(STATUS_TEMUAN, t.status, "terbuka"), pada: sekarang }],
          sumber: teks(t.sumber, 200),
          dibuatPada: sekarang,
          /** dipakai jalur unggah bukti; tidak pernah keluar ke halaman terbuka */
          token: randomUUID().replace(/-/g, ""),
          /*
           * Dua medan ini dibaca Apps Script saat menamai berkas di Drive.
           * Tanpa keduanya, bukti perbaikan tersimpan bernama
           * "tanpa-periode - lainnya - <kapal> - ..." dan tak bisa dicari
           * berdasarkan bulan inspeksinya.
           */
          periode: tglInspeksi.slice(0, 7),
          jenis: "Inspeksi Kapal",
          jalurDrive: ["Inspeksi Kapal", teks(t.kapal, 60) || "TANPA KAPAL", tglInspeksi.slice(0, 7)],
        },
      };
    })
    .filter((x) => x.kapal && (x.komponen || x.uraian));

  if (!baris.length) {
    return NextResponse.json({ ok: false, error: "Temuan harus punya kapal dan uraian" }, { status: 400 });
  }

  const { data, error } = await c.from("projects")
    .insert(baris.map((x) => ({
      nama_kapal: x.kapal,
      tahun: +String(x.payload.tanggalInspeksi).slice(0, 4) || new Date().getFullYear(),
      payload: x.payload,
    })))
    .select("id,nama_kapal,payload");
  if (error) {
    console.error("inspeksi/daftar POST:", error.message);
    return NextResponse.json({ ok: false, error: "Temuan gagal disimpan. Coba lagi." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, jumlah: (data || []).length, baris: (data || []).map(keTemuan) });
}

/** ubah satu temuan: status, tenggat, penanggung jawab, catatan, verifikasi */
export async function PATCH(req: NextRequest) {
  const c = dbLapor();
  if (!c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const { id, ubah } = await req.json().catch(() => ({} as any));
  if (!id || !ubah) return NextResponse.json({ ok: false, error: "Temuan tidak dikenali" }, { status: 400 });

  const { data: ada, error: e1 } = await c.from("projects").select("payload").eq("id", id).single();
  if (e1 || !ada) return NextResponse.json({ ok: false, error: "Temuan tidak ditemukan" }, { status: 404 });
  const p: any = { ...(ada.payload as any) };
  if (p.kind !== KIND) return NextResponse.json({ ok: false, error: "Bukan temuan inspeksi" }, { status: 400 });

  const sekarang = new Date().toISOString();
  const medan: [string, (v: unknown) => any][] = [
    ["komponen", (v) => teks(v, 200)],
    ["uraian", (v) => teks(v, 1500)],
    ["penyebab", (v) => teks(v, 800)],
    ["tindakan", (v) => teks(v, 800)],
    ["catatanTutup", (v) => teks(v, 1000)],
    ["diverifikasiOleh", (v) => teks(v, 80)],
    ["inspektor", (v) => teks(v, 80)],
    ["targetSelesai", (v) => tanggal(v)],
    ["tanggalInspeksi", (v) => tanggal(v)],
  ];
  medan.forEach(([k, bersih]) => { if (typeof ubah[k] === "string") p[k] = bersih(ubah[k]); });
  if (ubah.bagian) p.bagian = sah(BAGIAN_INSPEKSI, ubah.bagian, p.bagian);
  if (ubah.tingkat) p.tingkat = sah(TINGKAT_TEMUAN, ubah.tingkat, p.tingkat);
  if (["kapal", "darat", "galangan"].includes(ubah.penanggungJawab)) p.penanggungJawab = ubah.penanggungJawab;

  if (typeof ubah.status === "string" && STATUS_TEMUAN.some((s) => s.id === ubah.status) && ubah.status !== p.status) {
    /*
     * Penutupan dijaga DI SERVER, bukan cuma di tombol layar: temuan hanya
     * boleh berstatus selesai kalau ada bukti perbaikan dan nama pemeriksanya.
     * Penjagaan di layar saja bisa dilewati siapa pun yang memanggil route ini
     * langsung, dan rekap penutupan yang bisa dipalsukan tidak ada gunanya.
     */
    if (ubah.status === "selesai") {
      const punyaBukti = (Array.isArray(p.berkas) ? p.berkas : []).some((b: any) => b?.jenis === "sesudah");
      const pemeriksa = String(p.diverifikasiOleh || "").trim();
      if (!punyaBukti || !pemeriksa) {
        return NextResponse.json({
          ok: false,
          error: !punyaBukti
            ? "Belum bisa ditutup: unggah dulu bukti perbaikan (foto/dokumen)."
            : "Belum bisa ditutup: isi dulu nama pemeriksa yang memverifikasi.",
        }, { status: 400 });
      }
      p.diverifikasiPada = sekarang;
    } else {
      p.diverifikasiPada = "";
    }
    p.status = ubah.status;
    p.riwayat = [...(Array.isArray(p.riwayat) ? p.riwayat : []),
      { status: ubah.status, pada: sekarang, catatan: teks(ubah.catatan, 300) || undefined }].slice(-30);
  }

  const { error: e2 } = await c.from("projects").update({ payload: p }).eq("id", id);
  if (e2) {
    console.error("inspeksi/daftar PATCH:", e2.message);
    return NextResponse.json({ ok: false, error: "Perubahan gagal disimpan. Coba lagi." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, baris: keTemuan({ id, nama_kapal: p.kapal, payload: p }) });
}

export async function DELETE(req: NextRequest) {
  const c = dbLapor();
  if (!c) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Temuan tidak dikenali" }, { status: 400 });
  const { data: ada } = await c.from("projects").select("payload").eq("id", id).single();
  if ((ada?.payload as any)?.kind !== KIND) {
    return NextResponse.json({ ok: false, error: "Bukan temuan inspeksi" }, { status: 400 });
  }
  const { error } = await c.from("projects").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: "Temuan gagal dihapus" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
