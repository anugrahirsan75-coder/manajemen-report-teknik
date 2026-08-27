/**
 * Cocokkan kiriman yang tampak KOSONG dengan berkas yang sebenarnya sudah ada
 * di Google Drive.
 *
 * Kejadian nyata yang ditambal route ini: ABK mengunggah, berkasnya sampai di
 * Drive, lalu jaringan kapal putus tepat sebelum jawabannya kembali. Berkas ada
 * — utuh, bernama benar, di folder yang benar — tetapi tak pernah tercatat pada
 * kirimannya, sehingga kantor membaca "tidak membawa berkas" dan menyuruh kapal
 * mengirim ulang sesuatu yang sudah ada. (Ditemukan pada KMP. PORTLINK VIII
 * 4 Agustus 2026: lima catatan kosong, satu berkas 2,3 MB duduk di Drive.)
 *
 * Berkas TIDAK diunggah ulang dan tidak dipindahkan; yang ditambahkan hanya
 * tautannya. Berkas yang sudah diklaim kiriman lain tidak pernah ditawarkan
 * dua kali.
 *
 * Di balik login (berada di bawah /api/lapor/daftar).
 */
import { NextRequest, NextResponse } from "next/server";
import { dbLapor, dbSiap } from "@/lib/lapor/db";
import { LABEL_FOLDER_DRIVE } from "@/lib/lapor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** selisih waktu yang masih dianggap "kiriman yang sama" */
const JENDELA_JAM = 12;

interface BerkasDrive { nama: string; id: string; url: string; mime: string; ukuran: number; diubah: string }

async function drive(jalur: string[]) {
  const gasUrl = process.env.LAPOR_GAS_URL;
  if (!gasUrl) throw new Error("Penyimpanan Google Drive belum aktif (LAPOR_GAS_URL kosong).");
  const res = await fetch(gasUrl, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: process.env.LAPOR_GAS_SECRET || "", aksi: "daftar", jalur }),
    redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(45_000),
  });
  const teks = await res.text();
  let d: any;
  try { d = JSON.parse(teks); } catch { throw new Error("Apps Script menjawab bukan JSON."); }
  if (d?.ok !== true) throw new Error(d?.error || "Google Drive menolak permintaan daftar isi.");
  return (d.berkas || []) as BerkasDrive[];
}

export async function POST(req: NextRequest) {
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const { id, aksi, fileIds } = await req.json().catch(() => ({} as any));
  if (!id) return NextResponse.json({ ok: false, error: "Kiriman tidak dikenali" }, { status: 400 });

  const c = dbLapor()!;
  const { data: semua, error } = await c.from("projects")
    .select("id,payload").filter("payload->>kind", "eq", "lapor_kapal");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const baris = (semua || []).find((x: any) => x.id === id);
  if (!baris) return NextResponse.json({ ok: false, error: "Kiriman tidak ditemukan" }, { status: 404 });
  const p: any = baris.payload || {};

  // Berkas yang sudah menjadi milik kiriman mana pun tidak boleh ditawarkan
  // lagi — satu berkas Drive hanya boleh tercatat pada satu kiriman.
  const sudahDiklaim = new Set<string>();
  (semua || []).forEach((x: any) => ((x.payload?.berkas || []) as any[])
    .forEach((f) => f?.fileId && sudahDiklaim.add(f.fileId)));

  const label = LABEL_FOLDER_DRIVE[p.jenis] || p.jenis || "lainnya";
  let isiFolder: BerkasDrive[];
  try { isiFolder = await drive([p.kapal, label]); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e?.message || "Gagal membaca Drive" }, { status: 502 }); }

  const dikirim = Date.parse(p.dikirimPada || "") || 0;
  const kandidat = isiFolder
    .filter((f) => !sudahDiklaim.has(f.id))
    // Nama berkas dibentuk Apps Script sebagai "<periode> - <jenis> - <kapal> - …",
    // jadi periodenya cukup dicocokkan dari awalan namanya.
    .filter((f) => !p.periode || f.nama.startsWith(p.periode))
    .map((f) => ({ ...f, jarakJam: dikirim ? Math.abs(Date.parse(f.diubah) - dikirim) / 3_600_000 : 0 }))
    .filter((f) => !dikirim || f.jarakJam <= JENDELA_JAM)
    .sort((a, b) => a.jarakJam - b.jarakJam);

  if (aksi !== "tautkan") {
    return NextResponse.json({ ok: true, kandidat, folder: [p.kapal, label] });
  }

  const dipilih = new Set<string>(Array.isArray(fileIds) ? fileIds.map(String) : []);
  const ambil = kandidat.filter((f) => dipilih.has(f.id));
  if (!ambil.length) return NextResponse.json({ ok: false, error: "Tidak ada berkas yang dipilih" }, { status: 400 });

  // Payload dibaca ulang tepat sebelum ditulis: kiriman ini bisa saja baru
  // menerima berkas dari ABK selagi kantor menautkan yang lama.
  const { data: kini } = await c.from("projects").select("payload").eq("id", id).single();
  const pKini: any = kini?.payload || p;
  const daftar: any[] = Array.isArray(pKini.berkas) ? pKini.berkas : [];
  const tambahan = ambil
    .filter((f) => !daftar.some((x) => x.fileId === f.id))
    .map((f) => ({
      nama: f.nama, mime: f.mime || "application/octet-stream", ukuran: f.ukuran || 0,
      fileId: f.id, url: f.url, diunggahPada: f.diubah || new Date().toISOString(),
      /** penanda bahwa tautannya ditambalkan kantor, bukan datang dari unggahan */
      ditautkanKantor: true,
    }));
  const berkas = [...daftar, ...tambahan];
  const { error: e2 } = await c.from("projects")
    .update({ payload: { ...pKini, berkas, galatUnggah: "" } }).eq("id", id);
  if (e2) return NextResponse.json({ ok: false, error: "Gagal menyimpan tautan berkas" }, { status: 500 });

  return NextResponse.json({ ok: true, berkas, ditautkan: tambahan.length });
}
