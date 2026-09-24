/**
 * Data yang diisi kapal, dilihat dari KANTOR: stok filter dan alat kesehatan
 * seluruh armada dalam satu jawaban.
 *
 * Berada di balik gerbang login utama, jadi hanya akun Teknik yang bisa
 * memanggilnya. Sengaja mengembalikan SELURUH baris, bukan ringkasannya saja:
 * halaman kantor perlu bisa membuka rincian tiap kapal tanpa memanggil ulang
 * tiga belas kali, dan seluruh data ini pun hanya beberapa puluh kilobita.
 *
 * Kapal yang BELUM PERNAH mengisi ikut disebut. Itu justru jawaban yang paling
 * dicari: daftar yang hanya memuat kapal yang rajin membuat kapal yang diam
 * menghilang dari layar.
 */
import { NextResponse } from "next/server";
import { dbServer, dbSiap } from "@/lib/dbServer";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { KIND_ALKES, KIND_STOK_FILTER, tingkatAlkes } from "@/lib/portal/types";
import { KIND_DOKUMEN } from "@/lib/portal/dokumen";
import { singkatJenis, bulanIndo } from "@/lib/lapor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!dbSiap()) return NextResponse.json({ ok: false, error: "Sumber data belum siap" }, { status: 503 });
  const c = dbServer()!;

  const [stok, alkes, dokumen, lapor] = await Promise.all([
    c.from("projects").select("id,payload").filter("payload->>kind", "eq", KIND_STOK_FILTER),
    c.from("projects").select("id,payload").filter("payload->>kind", "eq", KIND_ALKES),
    c.from("projects").select("id,payload").filter("payload->>kind", "eq", KIND_DOKUMEN),
    /* borang bulanan ikut ditarik di sini supaya arsip satu kapal bisa dibuka
       utuh dengan SATU panggilan; kalau halaman harus memanggil /api/lapor
       sendiri, dua daftar itu bisa berbeda usia dan orang membaca arsip yang
       tidak pernah benar-benar ada bentuknya pada satu saat pun */
    c.from("projects").select("id,nama_kapal,payload").filter("payload->>kind", "eq", "lapor_kapal"),
  ]);
  if (stok.error || alkes.error || dokumen.error || lapor.error) {
    return NextResponse.json({ ok: false, error: (stok.error || alkes.error || dokumen.error || lapor.error)!.message }, { status: 500 });
  }

  const petaStok = new Map<string, any>();
  (stok.data || []).forEach((r: any) => petaStok.set((r.payload || {}).kapal, r.payload));
  const petaAlkes = new Map<string, any>();
  (alkes.data || []).forEach((r: any) => petaAlkes.set((r.payload || {}).kapal, r.payload));

  /* dokumen: BANYAK baris per kapal, bukan satu lembar — dikumpulkan per kapal */
  const petaDok = new Map<string, any[]>();
  (dokumen.data || []).forEach((r: any) => {
    const p = r.payload || {};
    const k = p.kapal || "";
    petaDok.set(k, [...(petaDok.get(k) || []), {
      id: r.id, jenis: p.jenis || "lainnya", judul: p.judul || "", tanggal: p.tanggal || "",
      nomor: p.nomor || "", catatan: p.catatan || "", olehAkun: p.olehAkun || "",
      dibuatPada: p.dibuatPada || "",
      /* url Drive ikut: penampil memakainya untuk menggambar berkas langsung
         dari Drive alih-alih menariknya lewat relay Apps Script */
      berkas: (p.berkas || []).map((f: any) => ({
        nama: f.nama, ukuran: f.ukuran, fileId: f.fileId, url: f.url || "",
      })),
    }]);
  });

  /*
   * Borang bulanan (permintaan & laporan) dibentuk menyerupai dokumen supaya
   * bisa ditaruh berdampingan di layar arsip — TAPI disimpan di larik sendiri,
   * tidak dicampur ke `daftar`.
   *
   * Sebabnya Rekap Dokumen dan berkas Excel-nya: keduanya membaca `daftar` dan
   * menghitung matriks kapal x golongan dari JENIS_DOKUMEN saja. Mencampurnya
   * di sini akan membuat angka ringkasan di layar tidak sama dengan angka di
   * Excel yang diunduh dari layar yang sama, dan tidak ada yang tahu mana yang
   * benar.
   */
  const petaBorang = new Map<string, any[]>();
  (lapor.data || []).forEach((r: any) => {
    const p = r.payload || {};
    /* percobaan yang sudah digantikan kiriman lain: catatannya ada, berkasnya
       tidak pernah sampai. Menampilkannya cuma melahirkan kembar kosong */
    if (p.digantikan) return;
    const k = p.kapal || r.nama_kapal || "";
    const periode = p.periode || "";
    petaBorang.set(k, [...(petaBorang.get(k) || []), {
      id: `lapor:${r.id}`,
      /* penanda asal: layar memakainya untuk tidak menawarkan "Hapus catatan" —
         kiriman kapal dihapus dari layar Permintaan & Laporan, bukan dari sini */
      sumber: "borang",
      jenis: p.jenis || "lainnya",
      judul: `${singkatJenis(p.jenis)} — ${bulanIndo(periode)}`,
      /* tanggal = awal PERIODE yang dilaporkan, bukan tanggal kirim. Laporan
         Agustus yang telat dikirim 3 September tetap milik kluster Agustus;
         itu yang dicari orang saat menelusuri arsip per bulan */
      tanggal: /^\d{4}-\d{2}$/.test(periode) ? `${periode}-01` : "",
      periode,
      nomor: "",
      catatan: p.catatan || "",
      status: p.status || "baru",
      olehAkun: [p.pengirim, p.jabatan].filter(Boolean).join(" · ") || "kapal",
      dibuatPada: p.dikirimPada || "",
      berkas: (p.berkas || []).map((f: any) => ({
        nama: f.nama, ukuran: f.ukuran, fileId: f.fileId, url: f.url || "",
      })),
    }]);
  });

  const armada = KAPAL_ANGGARAN.map((kapal) => {
    const s = petaStok.get(kapal);
    const a = petaAlkes.get(kapal);
    const filter = (s?.filter || []) as any[];
    const mesin = (s?.mesin || []) as any[];
    const item = (a?.item || []) as any[];

    return {
      kapal,
      stok: {
        adaIsi: !!s?.diperbaruiPada,
        diperbaruiPada: s?.diperbaruiPada || "",
        olehAkun: s?.olehAkun || "",
        jenis: filter.length,
        totalLembar: filter.reduce((n, f) => n + (Number(f.jumlah) || 0), 0),
        menipis: filter.filter((f) => Number(f.minimum) > 0 && Number(f.jumlah) <= Number(f.minimum)).length,
        /* mesin yang penggantian filternya tinggal ≤ 50 jam lagi */
        gantiDekat: mesin.filter((m) => {
          const interval = Number(m.intervalJam) || 0;
          if (!interval) return false;
          const jalan = Math.max(0, (Number(m.jam) || 0) - (Number(m.jamGantiTerakhir) || 0));
          return interval - jalan <= 50;
        }).length,
        filter, mesin,
      },
      alkes: {
        adaIsi: !!a?.diperbaruiPada,
        diperbaruiPada: a?.diperbaruiPada || "",
        olehAkun: a?.olehAkun || "",
        butir: item.length,
        lewat: item.filter((b) => tingkatAlkes(b.kedaluwarsa) === "lewat").length,
        kritis: item.filter((b) => tingkatAlkes(b.kedaluwarsa) === "kritis").length,
        waspada: item.filter((b) => tingkatAlkes(b.kedaluwarsa) === "waspada").length,
        menipis: item.filter((b) => Number(b.minimum) > 0 && Number(b.jumlah) <= Number(b.minimum)).length,
        item,
      },
      dokumen: (() => {
        const urut = (a: any, b: any) =>
          (b.tanggal || b.dibuatPada || "").localeCompare(a.tanggal || a.dibuatPada || "");
        const daftar = (petaDok.get(kapal) || []).sort(urut);
        const borang = (petaBorang.get(kapal) || []).sort(urut);
        return {
          /* angka-angka ini tetap MENGHITUNG ARSIP SAJA — sama seperti sebelum
             borang ikut ditarik, supaya kartu ringkasan di atas layar dan Rekap
             Dokumen tidak berubah artinya diam-diam */
          jumlah: daftar.length,
          berkas: daftar.reduce((n, d) => n + d.berkas.length, 0),
          /* dokumen tercatat tanpa berkas = unggahannya putus, dan itu harus terbaca */
          tanpaBerkas: daftar.filter((d) => !d.berkas.length).length,
          terbaru: daftar[0]?.tanggal || daftar[0]?.dibuatPada || "",
          daftar,
          borang,
          jumlahBorang: borang.length,
          berkasBorang: borang.reduce((n, d) => n + d.berkas.length, 0),
        };
      })(),
    };
  });

  return NextResponse.json({ ok: true, armada });
}
