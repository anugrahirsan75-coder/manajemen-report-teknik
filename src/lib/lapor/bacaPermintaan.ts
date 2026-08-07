"use client";
/**
 * Membaca ISI permintaan kapal.
 *
 * ABK mengirim permintaannya sebagai foto borang atau PDF hasil pindaian, dan
 * selama ini kantor membacanya satu per satu lalu mengetik ulang saat menyusun
 * SPPBJ. Yang dikerjakan di sini: ambil berkasnya dari Drive, baca daftar
 * barangnya, dan kembalikan sebagai baris yang bisa langsung dipakai.
 *
 * Mesin bacanya SAMA dengan yang dipakai Buat Surat E-Office (lib/surat/
 * bacaTabel) — satu mesin untuk seluruh aplikasi, jadi perbaikan di satu tempat
 * terasa di semua tempat.
 */
import { KolomTabel } from "@/lib/surat/types";
import { Kemajuan, bacaBerkasTabel } from "@/lib/surat/bacaTabel";

/** kolom yang dicari dari borang permintaan kapal */
export const KOLOM_PERMINTAAN: KolomTabel[] = [
  { id: "nama", label: "Nama barang / pekerjaan", jenis: "teks" },
  { id: "spesifikasi", label: "Spesifikasi / part number", jenis: "teks" },
  { id: "jumlah", label: "Jumlah", jenis: "teks" },
  { id: "satuan", label: "Satuan", jenis: "teks" },
  { id: "keterangan", label: "Keterangan", jenis: "teks" },
];

export const KONTEKS_PERMINTAAN =
  "Borang permintaan barang dari kapal (Deck atau Mesin) milik PT ASDP. Tiap baris adalah satu barang "
  + "atau pekerjaan yang diminta ABK: nama barangnya, spesifikasi atau part number bila ada, jumlah, dan "
  + "satuan (pcs, set, liter, buah, unit). Kolom keterangan diisi bila borangnya memuat catatan seperti "
  + "merek mesin, letak pemakaian, atau kondisi kerusakan. Abaikan kop surat, nama kapal, tanda tangan, "
  + "dan baris tanda terima.";

export interface BarisPermintaan {
  nama: string;
  spesifikasi: string;
  jumlah: string;
  satuan: string;
  keterangan: string;
}

export interface HasilPermintaan {
  baris: BarisPermintaan[];
  mesin: string;
  catatan: string[];
}

/** ambil berkas dari Drive lalu baca isinya */
export async function bacaPermintaan(
  fileId: string,
  namaBerkas: string,
  lapor: (k: Kemajuan) => void = () => {},
): Promise<HasilPermintaan> {
  lapor({ tahap: "Mengambil berkas dari Google Drive…" });

  let r: Response;
  try {
    r = await fetch(`/api/lapor/isi?fileId=${encodeURIComponent(fileId)}`, {
      cache: "no-store",
      // Drive kadang lambat; batas ini membuat kegagalannya punya sebab yang
      // bisa dibaca, bukan menggantung sampai peramban menyerah sendiri
      signal: AbortSignal.timeout(70_000),
    });
  } catch (e: any) {
    /**
     * fetch yang gagal SEBELUM ada jawaban hanya berkata "Failed to fetch" —
     * pesan yang tak menjelaskan apa pun kepada orang kantor. Diterjemahkan ke
     * sebab yang benar-benar mungkin terjadi di sini.
     */
    throw new Error(
      e?.name === "TimeoutError"
        ? `Berkas "${namaBerkas}" terlalu lama diambil dari Drive (lebih dari 70 detik). Coba lagi, atau buka berkasnya langsung lewat tombol Buka.`
        : `Sambungan terputus saat mengambil "${namaBerkas}" (${e?.message || e}). Periksa jaringan lalu coba lagi.`,
    );
  }

  if (!r.ok) {
    const d = await r.json().catch(() => ({} as any));
    throw new Error(d?.error || `gagal mengambil berkas (${r.status})`);
  }

  // Badannya adalah isi berkas apa adanya — langsung jadi File untuk mesin baca
  // yang sama dengan yang dipakai halaman surat (ia menerima File, bukan tautan).
  const buf = await r.arrayBuffer();
  if (!buf.byteLength) throw new Error(`Berkas "${namaBerkas}" kosong saat diambil dari Drive.`);
  const namaAsli = decodeURIComponent(r.headers.get("X-Nama-Berkas") || "") || namaBerkas;
  const file = new File([buf], namaAsli, { type: r.headers.get("Content-Type") || "application/octet-stream" });

  lapor({ tahap: "Membaca isi permintaan…" });
  const hasil = await bacaBerkasTabel(file, KOLOM_PERMINTAAN, KONTEKS_PERMINTAAN, lapor);
  return {
    baris: (hasil.baris as unknown as BarisPermintaan[]).filter((b) => (b.nama || "").trim()),
    mesin: hasil.mesin,
    catatan: hasil.catatan,
  };
}

/** angka jumlah dari isian bebas ("4", "4 pcs", "±2") */
export const keJumlah = (v: string): number => {
  const m = /(\d+(?:[.,]\d+)?)/.exec(String(v || ""));
  return m ? Math.max(1, Math.round(Number(m[1].replace(",", ".")))) : 1;
};

const KUNCI_TITIPAN = "sppbj_titipan";

/**
 * Titipkan daftar barang untuk halaman pembuatan SPPBJ.
 *
 * Lewat penyimpanan peramban, bukan alamat: daftar barang bisa panjang, dan
 * alamat yang kepanjangan dipotong diam-diam oleh sebagian peramban — barang
 * terakhir hilang tanpa ada yang tahu.
 */
export function titipkanKeSppbj(kapal: string, baris: BarisPermintaan[], asal: string) {
  const isi = {
    kapal, asal, waktu: new Date().toISOString(),
    items: baris.map((b) => ({
      kapal, nama: b.nama, spesifikasi: b.spesifikasi || "",
      jumlah: keJumlah(b.jumlah), satuan: b.satuan || "pcs",
      keterangan: b.keterangan || "", harga: 0,
    })),
  };
  try { localStorage.setItem(KUNCI_TITIPAN, JSON.stringify(isi)); } catch { /* penyimpanan penuh */ }
  return isi.items.length;
}

export function ambilTitipanSppbj(): { kapal: string; asal: string; items: any[] } | null {
  try {
    const t = localStorage.getItem(KUNCI_TITIPAN);
    if (!t) return null;
    localStorage.removeItem(KUNCI_TITIPAN);   // sekali pakai
    const isi = JSON.parse(t);
    return isi?.items?.length ? isi : null;
  } catch { return null; }
}
