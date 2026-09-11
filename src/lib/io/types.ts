/**
 * Permintaan Nomor IO & Nomor Aset — investasi kapal.
 *
 * Tiap belanja investasi (radar, pompa, rehabilitasi winch) harus punya nomor
 * IO dari Kantor Pusat sebelum bisa dibelanjakan, dan nomor aset SAP sesudah
 * barangnya datang. Selama ini rekapnya berupa satu berkas Excel per bulan yang
 * disalin dari bulan sebelumnya; nomor yang sudah turun ditempel di sana, dan
 * begitu bulannya berganti, tidak ada satu tempat pun yang bisa menjawab
 * "permintaan mana yang nomornya belum turun".
 *
 * Yang dijaga di sini persis kolom berkas resminya, supaya hasil ekspornya bisa
 * dikirim apa adanya ke Kantor Pusat tanpa disusun ulang.
 */

export const KIND_IO = "nomor_io";

/** Pajak yang berlaku pada borang resmi. Ditulis sekali supaya tidak tersebar. */
export const TARIF_PPN = 0.11;

export interface BarisIO {
  id: string;
  kapal: string;
  assetClass: string;
  deskripsi: string;
  spesifikasi: string;
  costCenter: string;
  /** jumlah; disimpan sebagai teks karena borangnya diketik, bukan dihitung */
  unit: string;
  satuan: string;
  hargaSatuan: string;
  /** sebagian belanja tidak dikenai PPN; borang aslinya pun mengosongkannya */
  ppn: boolean;
  lokasi: string;
  gantiBaru: "" | "Ganti" | "Baru";
  /** nomor aset lama yang digantikan — wajib ada kalau "Ganti" */
  asetLama: string;
  noAsetSap: string;
  noIoSap: string;
  catatan: string;
  dibuatPada: string;
  diubahPada: string;
}

export interface PeriodeIO {
  /** "2026-09" */
  periode: string;
  baris: BarisIO[];
  diperbaruiPada: string;
}

/** Kelas aset resmi SAP — disalin dari lembar ASSET CLASS pada borang. */
export const ASSET_CLASS: { kode: string; label: string }[] = [
  { kode: "A01001", label: "Tanah dan Hak Atas Tanah" },
  { kode: "A02001", label: "Bangunan Fasilitas Pelabuhan" },
  { kode: "A02002", label: "Bangunan Lainnya" },
  { kode: "A02003", label: "Bangunan/Gedung - Komersil" },
  { kode: "A02004", label: "Bangunan/Gedung - Dinas" },
  { kode: "A03001", label: "Jalan" },
  { kode: "A03002", label: "Sarana dan Prasarana" },
  { kode: "A04001", label: "Kapal Ro-Ro/Penyeberangan" },
  { kode: "A04002", label: "Akomodasi, Peralatan dan Perlengkapan Kapal" },
  { kode: "A04003", label: "Permesinan dan Kelistrikan Kapal" },
  { kode: "A05001", label: "Alat Penunjang" },
  { kode: "A06001", label: "Instalasi Air dan Peralatannya" },
  { kode: "A06002", label: "Instalasi SPBU dan Peralatannya" },
  { kode: "A06003", label: "Instalasi Jaringan dan Peralatannya" },
  { kode: "A07001", label: "Alat Kerja Teknik dan Perbengkelan" },
  { kode: "A07002", label: "Alat Kerja Perkantoran" },
  { kode: "A07003", label: "Peralatan Teknologi dan Komunikasi" },
  { kode: "A07004", label: "Komputer dan Perlengkapan" },
  { kode: "A07005", label: "Furniture Kantor" },
  { kode: "A07006", label: "Peralatan dan Perlengkapan Lainnya" },
  { kode: "A08001", label: "Mobil - Komersil" },
  { kode: "A08002", label: "Mobil - Dinas" },
  { kode: "A08003", label: "Sepeda Motor - Komersil" },
  { kode: "A08004", label: "Sepeda Motor - Dinas" },
  { kode: "A08005", label: "Kendaraan Lainnya - Komersil" },
  { kode: "A08006", label: "Kendaraan Lainnya - Dinas" },
  { kode: "A09001", label: "ADK Bangunan Fasilitas" },
  { kode: "A09002", label: "ADK Jalan, Sarana, dan Prasarana" },
  { kode: "A09003", label: "ADK Kapal" },
  { kode: "A09004", label: "ADK Alat-Alat Fasilitas" },
  { kode: "A09005", label: "ADK Instalasi Fasilitas" },
  { kode: "A09006", label: "ADK Peralatan dan Perlengkapan" },
  { kode: "A10001", label: "Asset Tidak Produktif  Tanah dan Hak Atas Tanah" },
  { kode: "A10002", label: "Asset Tidak Produktif  Bangunan Fasilitas Pelabuhan" },
  { kode: "A10003", label: "Asset Tidak Produktif  Bangunan Lainnya" },
  { kode: "A10004", label: "Asset Tidak Produktif  Bangunan/Gedung - Komersil" },
  { kode: "A10005", label: "Asset Tidak Produktif  Jalan" },
  { kode: "A10006", label: "Asset Tidak Produktif  Sarana dan Prasarana" },
  { kode: "A10007", label: "Asset Tidak Produktif  Kapal Ro-Ro/Penyeberangan" },
  { kode: "A10008", label: "Asset Tidak Produktif  Akomodasi, Peralatan dan Perlengkapan Kapal" },
  { kode: "A10009", label: "Asset Tidak Produktif  Permesinan dan Kelistrikan Kapal" },
  { kode: "A10010", label: "Asset Tidak Produktif  Alat Penunjang" },
  { kode: "A10011", label: "Asset Tidak Produktif  Instalasi Air dan Peralatannya" },
  { kode: "A10012", label: "Asset Tidak Produktif  Instalasi SPBU dan Peralatannya" },
  { kode: "A10013", label: "Asset Tidak Produktif  Instalasi Jaringan dan Peralatannya" },
  { kode: "A10014", label: "Asset Tidak Produktif  Alat Kerja Teknik dan Perbengkelan" },
  { kode: "A10015", label: "Asset Tidak Produktif  Alat Kerja Perkantoran" },
  { kode: "A10016", label: "Asset Tidak Produktif  Peralatan Teknologi dan Komunikasi" },
  { kode: "A10017", label: "Asset Tidak Produktif  Komputer dan Perlengkapan" },
  { kode: "A10018", label: "Asset Tidak Produktif  Furniture Kantor" },
  { kode: "A10019", label: "Asset Tidak Produktif  Peralatan dan Perlengkapan Lainnya" },
  { kode: "A10020", label: "Asset Tidak Produktif  Mobil - Komersil" },
  { kode: "A10021", label: "Asset Tidak Produktif  Mobil - Dinas" },
  { kode: "A10022", label: "Asset Tidak Produktif  Sepeda Motor - Komersil" },
  { kode: "A10023", label: "Asset Tidak Produktif  Sepeda Motor - Dinas" },
  { kode: "A10024", label: "Asset Tidak Produktif  Kendaraan Lainnya - Komersil" },
  { kode: "A10025", label: "Asset Tidak Produktif  Kendaraan Lainnya - Dinas" },
  { kode: "A11001", label: "Aset Properti Investasi Tanah dan Hak Atas Tanah" },
  { kode: "A11002", label: "Aset Properti Investasi Bangunan" },
  { kode: "A11003", label: "Aset Properti Investasi Aset dalam Konstruksi" },
];

export const labelAsset = (kode: string) =>
  ASSET_CLASS.find((a) => a.kode === kode)?.label || "";

/*
 * Kelas aset yang benar-benar dipakai belanja kapal ditaruh paling atas pada
 * daftar pilihan. Enam puluh baris yang sebagian besar tentang gedung dan
 * kendaraan dinas membuat orang menggulir jauh untuk memilih dua kode yang
 * itu-itu saja.
 */
export const ASSET_SERING = ["A04001", "A04002", "A04003", "A05001", "A07001"];

export const SATUAN_IO = ["UNIT", "SET", "PCS", "LOT", "BUAH", "METER", "KG", "LITER", "ROLL", "PAKET"];

const bil = (v: string) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Hitungan satu baris, persis rumus di borang: total, PPN, grand total. */
export function hitungBaris(b: Pick<BarisIO, "unit" | "hargaSatuan" | "ppn">) {
  const total = bil(b.unit) * bil(b.hargaSatuan);
  const ppn = b.ppn ? Math.round(total * TARIF_PPN) : 0;
  return { total, ppn, grand: total + ppn };
}

/**
 * Tahap yang sudah dilalui satu permintaan.
 *
 * Urutannya menentukan warna dan penyaringan: yang paling perlu dilihat kantor
 * bukan yang sudah selesai, melainkan yang masih menunggu nomor turun.
 */
export type TahapIO = "menunggu" | "ada-io" | "ada-aset";
export const tahapIO = (b: Pick<BarisIO, "noIoSap" | "noAsetSap">): TahapIO => {
  if (String(b.noAsetSap || "").trim()) return "ada-aset";
  if (String(b.noIoSap || "").trim()) return "ada-io";
  return "menunggu";
};

export const NADA_TAHAP: Record<TahapIO, { label: string; warna: string }> = {
  menunggu: {
    label: "Menunggu nomor IO",
    warna: "bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  },
  "ada-io": {
    label: "Nomor IO turun",
    warna: "bg-sky-100 text-sky-900 ring-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800",
  },
  "ada-aset": {
    label: "Nomor aset terbit",
    warna: "bg-emerald-100 text-emerald-900 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
  },
};

const BULAN_ID = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "2026-09" -> "September 2026" */
export const namaPeriode = (p: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(p || "");
  return m ? `${BULAN_ID[+m[2]]} ${m[1]}` : p || "";
};

export const periodeSekarang = () => new Date().toISOString().slice(0, 7);

/** rupiah tanpa desimal, gaya Indonesia */
export const rupiah = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

export const barisKosong = (kapal: string): BarisIO => ({
  id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
  kapal, assetClass: "A04003", deskripsi: "", spesifikasi: "", costCenter: "",
  unit: "1", satuan: "UNIT", hargaSatuan: "", ppn: true, lokasi: "",
  gantiBaru: "", asetLama: "", noAsetSap: "", noIoSap: "", catatan: "",
  dibuatPada: new Date().toISOString(), diubahPada: new Date().toISOString(),
});
