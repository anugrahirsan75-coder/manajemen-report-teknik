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
  const r = await fetch(`/api/lapor/isi?fileId=${encodeURIComponent(fileId)}`, { cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d?.ok) throw new Error(d?.error || `gagal mengambil berkas (${r.status})`);

  // base64 -> File, supaya bisa dilewatkan ke mesin baca yang sama dengan
  // yang dipakai halaman surat (ia menerima File, bukan tautan)
  const bin = atob(String(d.dataBase64 || ""));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const file = new File([buf], d.nama || namaBerkas, { type: d.mime || "application/octet-stream" });

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
