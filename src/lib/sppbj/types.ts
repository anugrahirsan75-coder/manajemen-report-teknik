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
  kategoriRekap?: string; // KET. rekap: DOCKING(BIAYA) / DOCKING (INVESTASI) / RUTIN / INVESTASI DILUAR DOCKING
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
