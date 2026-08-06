"use client";
/**
 * Penghubung halaman Laporan Docking dengan folder Drive pemilik.
 *
 * Daftar isinya dibaca hidup-hidup dari Drive: berkas yang ditaruh manual lewat
 * Google Drive dan yang diunggah dari aplikasi tampil di tempat yang sama,
 * tanpa ada catatan kedua yang bisa berbeda dari kenyataannya.
 */

export interface FolderDrive { nama: string; id: string; url: string; diubah: string }
export interface BerkasDrive { nama: string; id: string; url: string; mime: string; ukuran: number; diubah: string }
export interface IsiFolder {
  jalur: string[];
  nama: string;
  folderUrl?: string;
  folder: FolderDrive[];
  berkas: BerkasDrive[];
  kosong?: boolean;
}

export async function bacaFolder(jalur: string[]): Promise<IsiFolder> {
  const q = jalur.map((s) => encodeURIComponent(s)).join("/");
  const r = await fetch(`/api/docking/laporan/daftar?jalur=${q}`, { cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d?.ok) throw new Error(d?.error || `gagal membaca folder (${r.status})`);
  return { jalur, nama: d.nama || "Laporan Docking", folderUrl: d.folderUrl, folder: d.folder || [], berkas: d.berkas || [], kosong: d.kosong };
}

/** 2,25 MB: habis dibagi 3, jadi potongan base64-nya bisa disambung tanpa sisa */
const BYTE_PER_POTONGAN = 2_250_000;
const MAKS_COBA = 4;
const JEDA_COBA = [2000, 5000, 12000];

const keBase64 = (buf: ArrayBuffer): string => {
  const b = new Uint8Array(buf);
  let s = "";
  const langkah = 0x8000;   // potong per 32 KB: argumen fungsi punya batas jumlah
  for (let i = 0; i < b.length; i += langkah) {
    s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + langkah)) as unknown as number[]);
  }
  return btoa(s);
};

export interface KemajuanUnggah { berkas: string; potongan: number; total: number; percobaan: number }

/**
 * Satu berkas naik potongan demi potongan. Potongan yang gagal karena sebab
 * sesaat diulang beberapa kali dengan jeda yang melebar — jaringan kantor di
 * sini kerap putus sebentar, dan mengulang seluruh berkas 20 MB karena satu
 * potongan tersendat itu pemborosan yang tidak perlu.
 */
export async function unggahBerkas(
  file: File,
  jalur: string[],
  lapor: (k: KemajuanUnggah) => void = () => {},
): Promise<BerkasDrive> {
  const buf = await file.arrayBuffer();
  const total = Math.max(1, Math.ceil(buf.byteLength / BYTE_PER_POTONGAN));
  const unggahId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  for (let i = 0; i < total; i++) {
    const potongan = keBase64(buf.slice(i * BYTE_PER_POTONGAN, (i + 1) * BYTE_PER_POTONGAN));
    let galatTerakhir = "";
    let berhasil: any = null;

    for (let coba = 0; coba < MAKS_COBA && !berhasil; coba++) {
      lapor({ berkas: file.name, potongan: i + 1, total, percobaan: coba });
      try {
        const r = await fetch("/api/docking/laporan/berkas", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unggahId, indeks: i, total, jalur,
            nama: file.name, mime: file.type, dataBase64: potongan,
          }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d?.ok) { berhasil = d; break; }
        galatTerakhir = d?.error || `HTTP ${r.status}`;
        if (!d?.retryable) throw new Error(galatTerakhir);
      } catch (e: any) {
        galatTerakhir = e?.message || String(e);
      }
      if (!berhasil && coba < MAKS_COBA - 1) await new Promise((res) => setTimeout(res, JEDA_COBA[coba] || 12000));
    }

    if (!berhasil) throw new Error(`${file.name}: ${galatTerakhir}`);
    if (berhasil.selesai) return berhasil.berkas as BerkasDrive;
  }
  throw new Error(`${file.name}: berkas tidak selesai disatukan di Drive`);
}

export const ukuranSingkat = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n || 0} B`;

const IKON: [RegExp, string][] = [
  [/pdf/, "📕"], [/spreadsheet|excel|sheet|csv/, "📊"], [/word|document/, "📘"],
  [/image|photo|jpeg|png|heic/, "🖼️"], [/zip|rar|compressed/, "🗜️"], [/video/, "🎬"],
];
export const ikonBerkas = (mime: string, nama: string) => {
  const t = `${mime} ${nama}`.toLowerCase();
  for (const [re, ikon] of IKON) if (re.test(t)) return ikon;
  return "📄";
};

export const tanggalSingkat = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};
