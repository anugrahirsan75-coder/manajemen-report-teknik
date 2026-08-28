/**
 * Baca laporan inspeksi (.docx) jadi calon daftar temuan.
 *
 * Yang dibaca adalah TABELNYA, bukan seluruh kalimat: laporan Marine
 * Superintendent selalu menaruh ketidaksesuaian dalam tabel resume
 * (formulir TF-101.00.03: NO · NAMA KOMPONEN · KONDISI PERALATAN · KLASIFIKASI),
 * dan tabel adalah satu-satunya bagian yang bentuknya cukup tetap untuk dibaca
 * mesin tanpa menebak-nebak.
 *
 * Hasilnya TIDAK langsung disimpan. Route ini hanya mengembalikan calon baris
 * untuk ditinjau orang kantor lebih dulu — pembacaan otomatis boleh keliru,
 * yang tidak boleh adalah keliru masuk diam-diam ke rekap yang dipakai menagih
 * kapal.
 */
import { NextRequest, NextResponse } from "next/server";
import PizZip from "pizzip";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { tebakBagian, tebakTingkat } from "@/lib/inspeksi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BULAN = ["januari", "februari", "maret", "april", "mei", "juni", "juli",
  "agustus", "september", "oktober", "november", "desember"];

const bersih = (s: string) => s.replace(/\s+/g, " ").trim();

/** teks satu sel: tiap paragraf jadi satu baris */
function teksSel(xml: string): string {
  const paragraf = xml.split(/<w:p[ >]/).slice(1)
    .map((p) => (p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
      .map((t) => t.replace(/<[^>]+>/g, ""))
      .join(""))
    .map((t) => t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'))
    .map((t) => t.trim())
    .filter(Boolean);
  return paragraf.join("\n");
}

function tabelDari(xml: string): string[][][] {
  const tabel: string[][][] = [];
  const potongan = xml.split("<w:tbl>").slice(1);
  for (const p of potongan) {
    const isi = p.split("</w:tbl>")[0];
    const baris: string[][] = [];
    /*
     * Pemisahnya HARUS memakai batas tag. "<w:tr" juga cocok dengan "<w:trPr"
     * (sifat baris), dan "<w:tc>" tidak cocok dengan "<w:tc >" — dua kekeliruan
     * yang membuat seluruh sel satu baris menyatu jadi satu, sehingga kolom
     * komponen berisi nomor urut dan uraiannya hilang.
     */
    for (const tr of isi.split(/<w:tr[ >]/).slice(1)) {
      const sel = tr.split("</w:tr>")[0].split(/<w:tc[ >]/).slice(1)
        .map((tc) => teksSel(tc.split("</w:tc>")[0]));
      if (sel.length) baris.push(sel);
    }
    if (baris.length) tabel.push(baris);
  }
  return tabel;
}

/** cari kolom yang judulnya mengandung salah satu kata kunci */
const kolomDari = (kepala: string[], ...kata: string[]) =>
  kepala.findIndex((h) => kata.some((k) => h.toLowerCase().includes(k)));

function tanggalDari(teks: string): string {
  const m = teks.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) {
    const bulan = BULAN.indexOf(m[2].toLowerCase());
    if (bulan >= 0) return `${m[3]}-${String(bulan + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const s = teks.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (s) return s[0];
  const d = teks.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (d) return `${d[3]}-${d[2].padStart(2, "0")}-${d[1].padStart(2, "0")}`;
  return "";
}

function kapalDari(teks: string): string {
  const atas = teks.toUpperCase();
  // huruf/angka di tepi kata = masih bagian dari kata lain
  const batas = (c: string) => !(c >= "A" && c <= "Z") && !(c >= "0" && c <= "9");
  for (const k of KAPAL_ANGGARAN) {
    const inti = k.replace(/^KMP\.?\s*/i, "").trim().toUpperCase();
    if (!inti) continue;
    /*
     * Dicocokkan sebagai KATA UTUH. Tanpa batas kata, "LEMA" ketemu di dalam
     * "lemari life jacket", dan laporan KMP. MASIREI terbaca sebagai KMP. LEMA —
     * seluruh temuannya masuk ke kapal yang salah.
     */
    for (let i = atas.indexOf(inti); i >= 0; i = atas.indexOf(inti, i + 1)) {
      const sebelum = i === 0 ? " " : atas[i - 1];
      const sesudah = i + inti.length >= atas.length ? " " : atas[i + inti.length];
      if (batas(sebelum) && batas(sesudah)) return k;
    }
  }
  return "";
}

export async function POST(req: NextRequest) {
  const { nama, dataBase64 } = await req.json().catch(() => ({} as any));
  if (!dataBase64) return NextResponse.json({ ok: false, error: "Berkas kosong" }, { status: 400 });
  if (!/\.docx$/i.test(String(nama || ""))) {
    return NextResponse.json({
      ok: false,
      error: "Hanya .docx yang bisa dibaca otomatis. Berkas .doc lama: buka di Word lalu simpan sebagai .docx, "
        + "atau salin tabelnya dan tempel di kotak tempel.",
    }, { status: 415 });
  }

  let xml = "";
  try {
    const zip = new PizZip(Buffer.from(String(dataBase64), "base64"));
    xml = zip.file("word/document.xml")?.asText() || "";
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "Berkas tidak terbaca sebagai dokumen Word." }, { status: 400 });
  }
  if (!xml) return NextResponse.json({ ok: false, error: "Isi dokumen tidak ditemukan." }, { status: 400 });

  const seluruhTeks = bersih(xml.replace(/<[^>]+>/g, " "));
  const kapal = kapalDari(seluruhTeks);
  const tanggalInspeksi = tanggalDari(seluruhTeks);
  const inspektor = (seluruhTeks.match(/(?:marine\s+superintendent|superintendent|inspektor)\s*[:\-]?\s*([A-Z][A-Za-z. ]{3,40})/i)
    || [])[1]?.trim() || "";

  const semuaTabel = tabelDari(xml);
  const temuan: any[] = [];

  for (const tabel of semuaTabel) {
    if (tabel.length < 2) continue;
    /*
     * Baris kepala dipilih dengan SKOR, bukan "baris pertama yang menyebut
     * kata kunci". Laporan baku memuat paragraf ringkasan berbunyi "RESUME
     * HASIL INSPEKSI KONDISI KAPAL ... PERALATAN ..." dalam satu sel lebar;
     * kalimat itu mengandung dua kata kunci sekaligus, dan dulu terpilih
     * sebagai kepala tabel — akibatnya seluruh kolom menunjuk sel yang sama
     * dan yang tercatat sebagai temuan hanyalah nomor urutnya.
     *
     * Kepala yang benar punya BEBERAPA sel, masing-masing pendek, dan
     * mencocoki kata kunci yang berbeda-beda.
     */
    const KUNCI = [new RegExp(String.raw`\bno\b`, "i"), /komponen|item|peralatan|lokasi/i,
      /kondisi|uraian|temuan|deskripsi|finding|ketidaksesuaian/i,
      /klasifikasi|kategori|tingkat|severity|prioritas/i,
      /tindakan|rekomendasi|saran|action|perbaikan/i,
      /keterangan|catatan|remark/i];
    let iKepala = -1;
    let skorTerbaik = 0;
    tabel.forEach((b, i) => {
      if (b.length < 3) return;
      const pendek = b.map((s) => s.replace(/\r?\n/g, " ").trim());
      if (pendek.every((s) => s.length > 40)) return;      // paragraf, bukan kepala
      const skor = KUNCI.filter((k) => pendek.some((s) => s.length <= 40 && k.test(s))).length;
      if (skor >= 2 && skor > skorTerbaik) { skorTerbaik = skor; iKepala = i; }
    });
    if (iKepala < 0) continue;
    const kepala = tabel[iKepala].map((x) => x.replace(/\r?\n/g, " "));

    const kNo = kolomDari(kepala, "no");
    const kKomponen = kolomDari(kepala, "komponen", "item", "peralatan", "lokasi");
    const kUraian = kolomDari(kepala, "kondisi", "uraian", "temuan", "deskripsi", "finding", "ketidaksesuaian");
    const kTingkat = kolomDari(kepala, "klasifikasi", "kategori", "tingkat", "severity", "prioritas");
    const kTindakan = kolomDari(kepala, "tindakan", "rekomendasi", "saran", "action", "perbaikan");
    const kKet = kolomDari(kepala, "keterangan", "catatan", "remark");
    if (kUraian < 0 && kKomponen < 0) continue;

    for (const baris of tabel.slice(iKepala + 1)) {
      const ambil = (i: number) => (i >= 0 && i < baris.length ? bersih(baris[i].replace(/\n/g, " ")) : "");
      const komponen = ambil(kKomponen);
      const uraian = ambil(kUraian) || ambil(kKet);
      if (!komponen && !uraian) continue;
      // baris nomor / sub-judul tanpa isi bukan temuan
      if (!uraian && /^[IVX0-9.\s]+$/.test(komponen)) continue;
      /*
       * Kepala tabel formulir baku bertingkat dua: baris pertama
       * "NO / NAMA KOMPONEN / KONDISI PERALATAN / KLASIFIKASI", baris kedua
       * menjelaskan kolom ketiga sebagai "URAIAN, PENYEBAB, TINDAKAN
       * PENCEGAHAN". Tanpa penjagaan ini, kalimat penjelas itu tercatat sebagai
       * temuan pertama pada setiap laporan yang diimpor.
       */
      const bakuKepala = /uraian|penyebab|tindakan pencegahan|kondisi peralatan|klasifikasi/i;
      if (!komponen && bakuKepala.test(uraian) && uraian.length < 60) continue;

      const gabung = `${komponen} ${uraian}`;
      temuan.push({
        no: ambil(kNo),
        kapal,
        tanggalInspeksi,
        inspektor,
        komponen: komponen || uraian.slice(0, 80),
        uraian: uraian || komponen,
        tindakan: ambil(kTindakan),
        penyebab: "",
        bagian: tebakBagian(gabung),
        /*
         * Kolom klasifikasi pada formulir baku berisi ANGKA (1/2/3), dan angka
         * itu tidak menjelaskan apa-apa bagi penebak tingkat — hasilnya semua
         * temuan jatuh ke "minor", termasuk yang uraiannya berbunyi "rusak".
         * Angka dibiarkan lewat: yang dibaca uraiannya, dan angkanya tetap
         * ditampilkan pada layar tinjauan supaya bisa dikoreksi orang.
         */
        tingkat: /[a-z]/i.test(ambil(kTingkat)) ? tebakTingkat(ambil(kTingkat)) : tebakTingkat(gabung),
        klasifikasiAsli: ambil(kTingkat),
        sumber: String(nama || ""),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    kapal, tanggalInspeksi, inspektor,
    jumlahTabel: semuaTabel.length,
    temuan: temuan.slice(0, 200),
  });
}
