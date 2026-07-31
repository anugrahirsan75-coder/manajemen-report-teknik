export interface SppbjItem {
  id: string;
  kapal: string; // sub-header tabel (boleh sama utk beberapa item)
  jumlah: number;
  satuan: string;
  nama: string; // Nama Barang/Jasa
  spesifikasi: string;
  harga: number; // harga satuan ESTIMASI (tabel SPPBJ)
  hargaSpbj?: number; // harga satuan FINAL dari SPBJ/PO (tabel Data SPBJ) -> BSTB/BAPP
  breakdown?: string[]; // rincian di bawah item (khusus jasa), tanpa harga
  keterangan?: string; // header/kategori di ATAS item (boleh multi-baris), grup >1 item
  // Mata Anggaran khusus item ini (opsional). Kosong = ikut MA pertama pengadaan.
  // Hanya dipakai saat pengadaan mencentang >1 MA — biar penyerapan per MA akurat.
  mataAnggaran?: string;
  // Sumber anggaran khusus item ini. Kosong = ikut pengadaan.
  // Dipakai bila 1 SPPBJ membebani lebih dari satu sumber (mis. sebagian item
  // dari pagu Docking kapal, sisanya dari surat Persetujuan Biaya Lainnya).
  jenisAnggaran?: "rutin" | "docking" | "lainnya";
  // Bila jenisAnggaran = "lainnya": surat persetujuan mana yang dibebani item ini.
  programId?: string;
  // --- metadata katalog HSPK (opsional, TIDAK dipakai fill.ts/template — output SPPBJ tetap) ---
  kodeKatalog?: string;   // kode item katalog RAB, mis. JS2-HL-002 (utk feedback harga riil)
  sumberHarga?: "Riil" | "Pasar"; // asal harga saat dipilih dari katalog
  kategoriKatalog?: string; // kategori katalog (utk filter/telusur)
}

// baris header keterangan (1 baris per poin), muncul di atas item saat keterangan berganti
export const ketLines = (it: SppbjItem): string[] =>
  (it.keterangan || "").split("\n").map((s) => s.trim()).filter(Boolean);

// harga acuan BSTB/BAPP = harga SPBJ jika diisi, fallback estimasi
export const hargaSpbjOf = (it: SppbjItem) => (it.hargaSpbj && it.hargaSpbj > 0 ? it.hargaSpbj : it.harga);

// baris-baris rincian breakdown (tiap poin -> "- xxx"), untuk baris terpisah di dokumen
export const bdLines = (it: SppbjItem): string[] =>
  (it.breakdown || []).filter((b) => b.trim()).map((b) => `- ${b.trim().replace(/^[-•*]\s*/, "")}`);

// nama + rincian (multi-baris 1 sel) — dipakai untuk tampilan layar
export const namaLengkap = (it: SppbjItem) =>
  it.breakdown && it.breakdown.length ? `${it.nama}\n${bdLines(it).join("\n")}` : it.nama;

export type SppbjStatus = "menunggu_spbj" | "spbj_terbit" | "selesai"; // tahap workflow

export const STATUS_LABEL: Record<SppbjStatus, string> = {
  menunggu_spbj: "Menunggu SPBJ",
  spbj_terbit: "SPBJ Terbit",
  selesai: "Selesai (BAPP & BSTB)",
};
export const STATUS_COLOR: Record<SppbjStatus, string> = {
  menunggu_spbj: "bg-amber-100 text-amber-700",
  spbj_terbit: "bg-blue-100 text-blue-700",
  selesai: "bg-green-100 text-green-700",
};

/**
 * Satu baris GR/SES. Untuk pengadaan biasa cukup satu (termin dibiarkan kosong);
 * untuk Pekerjaan Docking dipakai 3 baris, termin 1/2/3 sesuai Berita Acara
 * pemicunya (Naik Dok, Selesai Pekerjaan, Selesai Masa Pemeliharaan).
 */
export interface GrSes {
  id: string;
  termin?: number;    // 1 | 2 | 3 — kosong bila bukan pekerjaan bertermin
  nomor: string;      // No. GR / SES di SAP
  tanggal?: string;   // ISO
  nilai?: number;     // nilai yang di-GR (opsional)
  catatan?: string;
}

/** total tabel item SPBJ — harga SPBJ final bila sudah diisi, kalau belum pakai estimasi */
export const totalSpbj = (items: SppbjItem[] = []) =>
  items.reduce((s, i) => s + hargaSpbjOf(i) * (i.jumlah || 0), 0);

/**
 * Nilai sebuah baris GR/SES yang berlaku.
 *
 * Kalau pengadaan cuma punya SATU nomor GR/SES, seluruh pekerjaan diterima
 * sekali — nilainya pasti sebesar tabel item SPBJ, jadi tak perlu diketik ulang.
 * Begitu dibayar bertermin, tiap termin nilainya sendiri-sendiri dan harus
 * diisi manual. Nilai yang diketik pengguna selalu menang.
 */
export const nilaiGrEfektif = (g: GrSes, semua: GrSes[] = [], items: SppbjItem[] = []): number =>
  typeof g.nilai === "number" ? g.nilai : semua.length === 1 ? totalSpbj(items) : 0;

/** nilai baris ini datang dari tabel SPBJ (bukan ketikan pengguna)? */
export const nilaiGrOtomatis = (g: GrSes, semua: GrSes[] = []) =>
  typeof g.nilai !== "number" && semua.length === 1;

export const grSesBaru = (termin?: number): GrSes => ({
  id: globalThis.crypto?.randomUUID?.() ?? String(Math.random()),
  termin, nomor: "",
});

export interface SppbjRequest {
  id?: string;
  status: SppbjStatus;
  // SPPBJ
  tanggal: string; // ISO yyyy-mm-dd (dipakai bulan-tahun di G8 + KAK)
  noSPPBJ: string; // kosong (isi manual)
  namaPengadaan: string;
  dasarPelimpahan: string;
  mataAnggaran: string[]; // >=1
  noDRP: string;
  noPRSAP?: string; // Nomor PR SAP (2000xxxxxx) — kolom B & F di REKAP PJK
  noPOSAP?: string; // Nomor PO SAP (terbit setelah PR disetujui)
  /**
   * Nomor GR/SES (Goods Receipt / Service Entry Sheet) — bukti penerimaan di SAP.
   * Pekerjaan docking dibayar 3 termin dalam SATU SPPBJ, jadi bisa ada 3 nomor.
   */
  grSes?: GrSes[];
  kategoriRekap?: string; // KET. rekap: DOCKING(BIAYA) / DOCKING (INVESTASI) / RUTIN / INVESTASI DILUAR DOCKING
  jenisAnggaran?: "Rutin" | "Docking" | "Lainnya"; // klasifikasi Dashboard Anggaran (anti-overlap)
  // Barang masuk PERSEDIAAN (stok), belum dipakai kapal tertentu -> tidak menggerus pagu
  // Mata Anggaran manapun. Nilainya tetap tercatat & terlihat, hanya tak dihitung sbg serapan.
  stokPersediaan?: boolean;
  /** tampilkan kolom sumber anggaran per item (pengadaan memakai >1 sumber) */
  anggaranPerItem?: boolean;
  catatanAnggaran?: string; // keterangan bebas yang tampil di Dashboard Anggaran
  programId?: string; // tautan ke Persetujuan Biaya Lainnya (dashboard)
  stafTeknik: string; // Irsan Anugrah / Supriady Iran / manual
  deptHead: string; // default Eryanto Sidabalok
  items: SppbjItem[];
  // Fase 2 (setelah SPBJ/PO terbit oleh SCM)
  noSPBJ?: string; // angka, mis "384"
  tanggalSPBJ?: string;
  // No SPBJ/Kontrak dipecah: isi angka + romawi bulan -> otomatis jadi SPB/J.{angka}/PBJ/{romawi}/ASDP-{tahun}
  noSpbjNum?: string; // angka saja, mis "3798"
  noSpbjBulan?: string; // romawi bulan, mis "VI"
  tanggalBAPP?: string; // isi manual
  vendor?: string; // nama PT/CV (rekanan)
  jenisPengadaan?: "barang" | "jasa"; // FORMAT SAP kolom I
  matlGroup?: string; // FORMAT SAP kolom Matl Grup (kode B0xxxx dari DATABASE)
  penerima?: Record<string, string>; // BSTB: kapal -> nama/penerima
  fotoDokumentasi?: string[]; // foto dokumentasi (URL/base64)
}

export const tahunDari = (iso: string) => (iso || "").slice(0, 4);

// Generate full noKontrak from components: SPB/J.{num}/PBJ/{romawi}/ASDP-{tahun}
export const fullNoKontrak = (req: SppbjRequest): string => {
  const num = (req.noSpbjNum || "").trim();
  const bulan = (req.noSpbjBulan || "").trim().toUpperCase();
  const thn = tahunDari(req.tanggal);
  if (!num || !bulan) return "";
  return `SPB/J.${num}/PBJ/${bulan}/ASDP-${thn}`;
};

// tanggalKontrak = tanggalSPBJ (sama)
export const tanggalKontrak = (req: SppbjRequest): string => req.tanggalSPBJ || "";

export function emptySppbjItem(kapal = ""): SppbjItem {
  return { id: globalThis.crypto?.randomUUID?.() ?? String(Math.random()), kapal, jumlah: 1, satuan: "unit", nama: "", spesifikasi: "", harga: 0 };
}

// daftar kapal unik (urutan kemunculan) pada tabel — utk BSTB per kapal (fase 2)
export function kapalUnik(items: SppbjItem[] = []): string[] {
  const seen: string[] = [];
  for (const it of items) { const k = (it.kapal || "").trim(); if (k && !seen.includes(k)) seen.push(k); }
  return seen;
}

export const sppbjTotal = (items: SppbjItem[] = []) => items.reduce((s, i) => s + i.harga * i.jumlah, 0);

// Mata Anggaran efektif sebuah item: MA item bila diisi, else MA pertama pengadaan.
export const maItem = (it: { mataAnggaran?: string } | undefined, maPengadaan: string[] = []): string =>
  (it?.mataAnggaran || "").trim() || maPengadaan[0] || "";
