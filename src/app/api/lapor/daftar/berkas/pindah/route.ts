/**
 * Geser SATU berkas ke golongan borang lain.
 *
 * Satu kiriman "Laporan Mesin" kerap memuat lima lembar, dan satu di antaranya
 * ternyata permintaan barang — ABK mengunggah semuanya sekaligus lewat kotak
 * yang sama. Memindahkan seluruh kirimannya salah: empat lembar sisanya memang
 * laporan, dan menggesernya akan mengosongkan kotak Laporan yang sebenarnya
 * sudah terisi. Yang perlu berpindah cuma satu lembar itu.
 *
 * Berkasnya tetap di folder Google Drive semula. Yang dipindahkan adalah
 * CATATANNYA: lembar itu dicabut dari kiriman asal dan ditempelkan ke kiriman
 * bergolongan tujuan pada kapal dan periode yang sama — dibuatkan bila belum
 * ada. Memindahkan berkas Drive berarti mengubah tautan yang sudah tercatat,
 * dan tautan yang putus jauh lebih mahal daripada nama folder yang tak cocok.
 *
 * Kiriman asal yang kehabisan berkas dihapus catatannya, sebab kiriman tanpa
 * berkas dibaca rekap sebagai "unggahan gagal" — kantor akan menagih kapal
 * untuk sesuatu yang justru baru saja dirapikan sendiri.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbLapor, dbSiap } from "@/lib/lapor/db";
import { JENIS_LAPOR } from "@/lib/lapor/types";
import type { BerkasLapor } from "@/lib/lapor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });

  const { id, fileId, keJenis } = await req.json().catch(() => ({} as Record<string, string>));
  if (!id || !fileId) return NextResponse.json({ ok: false, error: "Dokumen tidak dikenali" }, { status: 400 });
  if (!JENIS_LAPOR.some((j) => j.id === keJenis)) {
    return NextResponse.json({ ok: false, error: "Golongan borang tidak dikenali" }, { status: 400 });
  }

  const c = dbLapor()!;
  const { data: asal, error: e1 } = await c.from("projects").select("payload").eq("id", id).single();
  if (e1 || !asal) return NextResponse.json({ ok: false, error: "Kiriman tidak ditemukan" }, { status: 404 });

  const pAsal: any = asal.payload || {};
  if (pAsal.kind !== "lapor_kapal") {
    return NextResponse.json({ ok: false, error: "Bukan kiriman kapal" }, { status: 400 });
  }
  if (pAsal.jenis === keJenis) {
    return NextResponse.json({ ok: false, error: "Berkas sudah berada di golongan itu" }, { status: 400 });
  }

  const berkasAsal = (Array.isArray(pAsal.berkas) ? pAsal.berkas : []) as BerkasLapor[];
  const berkas = berkasAsal.find((f) => f.fileId === fileId);
  if (!berkas) {
    return NextResponse.json({ ok: false, error: "Dokumen tidak tercatat pada kiriman ini" }, { status: 404 });
  }

  const kapal = pAsal.kapal || "";
  const periode = pAsal.periode || "";
  const pada = new Date().toISOString();
  const jejak = { fileId, nama: berkas.nama, dari: pAsal.jenis, ke: keJenis, pada };

  /*
   * Kiriman tujuan dicari, bukan langsung dibuat. Kapal yang tiap bulan mengirim
   * dua-tiga lembar salah kotak akan berakhir dengan tiga kiriman terpisah pada
   * slot yang sama — rekapnya benar, tetapi kantor harus membuka tiga kartu
   * untuk membaca satu permintaan.
   */
  const { data: calon } = await c.from("projects")
    .select("id,payload")
    .filter("payload->>kind", "eq", "lapor_kapal")
    .filter("payload->>kapal", "eq", kapal)
    .filter("payload->>periode", "eq", periode)
    .filter("payload->>jenis", "eq", keJenis);

  const tujuan = (calon || []).find((r: any) => !(r.payload || {}).digantikan) || (calon || [])[0];

  if (tujuan) {
    const pTujuan: any = tujuan.payload || {};
    const isi = (Array.isArray(pTujuan.berkas) ? pTujuan.berkas : []) as BerkasLapor[];
    if (!isi.some((f) => f.fileId === fileId)) isi.push(berkas);
    const { error } = await c.from("projects").update({
      payload: {
        ...pTujuan,
        berkas: isi,
        riwayatBerkas: [...(Array.isArray(pTujuan.riwayatBerkas) ? pTujuan.riwayatBerkas : []), jejak].slice(-20),
      },
    }).eq("id", tujuan.id);
    if (error) {
      console.error("lapor pindah berkas (tujuan ada):", error.message);
      return NextResponse.json({ ok: false, error: "Berkas gagal dipindahkan. Coba lagi." }, { status: 500 });
    }
  } else {
    const { error } = await c.from("projects").insert({
      nama_kapal: kapal,
      // kolom tahun ikut periodenya; jangan null, kolomnya dipakai penyaring rekap
      tahun: +String(periode).slice(0, 4) || new Date().getFullYear(),
      payload: {
        kind: "lapor_kapal",
        kapal,
        jenis: keJenis,
        periode,
        pengirim: pAsal.pengirim || "",
        jabatan: pAsal.jabatan || "",
        kontak: pAsal.kontak || "",
        catatan: `Berkas dipindahkan kantor dari ${pAsal.jenis}.`,
        berkas: [berkas],
        // tanggal kirim aslinya dipertahankan: itu jejak kapan kapal benar-benar
        // menyetor, dan penandaan "kiriman ujung bulan" bersandar padanya
        dikirimPada: pAsal.dikirimPada || pada,
        status: "dibaca",
        statusPada: pada,
        riwayatBerkas: [jejak],
      },
    });
    if (error) {
      console.error("lapor pindah berkas (tujuan baru):", error.message);
      return NextResponse.json({ ok: false, error: "Kiriman tujuan gagal dibuat. Coba lagi." }, { status: 500 });
    }
  }

  // payload asal dibaca ULANG sesaat sebelum ditulis — berkas yang baru selesai
  // diunggah ABK tidak boleh hilang hanya karena kantor merapikan golongan
  const { data: kini } = await c.from("projects").select("payload").eq("id", id).single();
  const pTulis: any = { ...(kini?.payload || pAsal) };
  const sisa = ((Array.isArray(pTulis.berkas) ? pTulis.berkas : []) as BerkasLapor[])
    .filter((f) => f.fileId !== fileId);

  if (!sisa.length) {
    const { error } = await c.from("projects").delete().eq("id", id);
    if (error) {
      console.error("lapor pindah berkas (hapus asal):", error.message);
      return NextResponse.json({ ok: false, error: "Berkas sudah dipindahkan, tetapi kiriman asal gagal dirapikan." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, asalDihapus: true });
  }

  const { error } = await c.from("projects").update({
    payload: {
      ...pTulis,
      berkas: sisa,
      riwayatBerkas: [...(Array.isArray(pTulis.riwayatBerkas) ? pTulis.riwayatBerkas : []), jejak].slice(-20),
    },
  }).eq("id", id);
  if (error) {
    console.error("lapor pindah berkas (asal):", error.message);
    return NextResponse.json({ ok: false, error: "Berkas sudah dipindahkan, tetapi kiriman asal gagal diperbarui." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, asalDihapus: false, sisa: sisa.length });
}
