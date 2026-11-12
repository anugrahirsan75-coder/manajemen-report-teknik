/**
 * Persediaan suku cadang di atas kapal (borang TF-101.00.11).
 *
 * Borang kertasnya meminta kapal menulis stok awal, penerimaan, pemakaian, dan
 * stok akhir tiap bulan. Hasil pindaiannya menunjukkan masalahnya: angka akhir
 * sering tidak sama dengan awal + terima − pakai (48 diterima, 7 dipakai, stok
 * akhir tetap 6), dan tanggal mutasi bulan lalu terbawa ke laporan bulan ini
 * karena lembarnya disalin. Yang salah bukan orangnya — borang itu meminta
 * manusia mengerjakan pekerjaan kalkulator setiap bulan.
 *
 * Karena itu yang dicatat kapal di sini hanya KEJADIAN: barang diterima, barang
 * dipakai, hasil cek fisik. Stok sekarang dan isi borang bulanan dihitung dari
 * kejadian itu, jadi stok akhir bulan ini otomatis menjadi stok awal bulan
 * depan dan tidak ada angka yang bisa saling bertentangan.
 */

export const KIND_SUKU_CADANG = "stok_suku_cadang";

export type JenisMutasi = "awal" | "terima" | "pakai" | "koreksi";

export const LABEL_MUTASI: Record<JenisMutasi, string> = {
  awal: "Stok awal",
  terima: "Diterima",
  pakai: "Dipakai",
  koreksi: "Koreksi cek fisik",
};

export type KondisiSC = "baru" | "bekas";

export interface ItemSC {
  id: string;
  /** mesin/peralatan pemakainya: Motor Induk, AE 1, Pompa, Ramp Door, … */
  peralatan: string;
  partNumber: string;
  nama: string;
  satuan: string;
  /** batas stok minimal menurut kapal; 0 = tidak dipantau */
  minimum: number;
  /** kolom STATUS borang: Baru atau Bekas (Rekondisi) */
  kondisi: KondisiSC;
  /** rak/lemari tempat menyimpan — supaya bisa dicari saat dibutuhkan */
  lokasi: string;
  catatan: string;
  /** barang yang tidak lagi distok disembunyikan, bukan dihapus: riwayatnya tetap utuh */
  aktif: boolean;
  dibuatPada: string;
}

export interface MutasiSC {
  id: string;
  itemId: string;
  jenis: JenisMutasi;
  /** awal/terima/pakai selalu positif; koreksi bertanda (+ lebih, − kurang) */
  jumlah: number;
  /** yyyy-mm-dd — tanggal kejadian, bukan tanggal dicatat */
  tanggal: string;
  keterangan: string;
  oleh: string;
  dicatatPada: string;
  /** mutasi yang keliru dibatalkan, tidak dihapus: jejaknya tetap terbaca */
  dibatalkan?: { pada: string; oleh: string; alasan: string };
}

export interface CekFisikSC {
  tanggal: string;
  oleh: string;
  diperiksa: number;
  berselisih: number;
}

export interface PenandaTanganSC {
  penyusun: string;
  jabatanPenyusun: string;
  penyetuju: string;
  jabatanPenyetuju: string;
}

export interface LembarSC {
  kind: typeof KIND_SUKU_CADANG;
  kapal: string;
  bagian: "deck" | "mesin";
  item: ItemSC[];
  mutasi: MutasiSC[];
  cekFisik: CekFisikSC[];
  penandaTangan: PenandaTanganSC;
  diperbaruiPada: string;
  olehAkun: string;
  riwayat: { pada: string; oleh: string; aksi: string; rincian: string }[];
}

export const PENANDA_TANGAN_AWAL = (bagian: "deck" | "mesin"): PenandaTanganSC => ({
  penyusun: "",
  jabatanPenyusun: bagian === "mesin" ? "KKM" : "Mualim I",
  penyetuju: "",
  jabatanPenyetuju: "Nakhoda",
});

export const PERALATAN_UMUM: Record<"deck" | "mesin", string[]> = {
  mesin: ["Motor Induk", "Motor Bantu (AE)", "AE Emergency", "Gearbox", "Pompa", "Kompresor", "Purifier", "Kelistrikan", "Kemudi", "Lainnya"],
  deck: ["Ramp Door", "Winch / Windlass", "Jangkar & Rantai", "Alat Keselamatan", "Navigasi", "Komunikasi", "Akomodasi", "Lainnya"],
};

/** tanggal hari ini, waktu setempat (Ternate UTC+9 — toISOString meleset sehari tiap pagi) */
export function hariIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const bulanIni = () => hariIni().slice(0, 7);

const BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const namaBulan = (p: string) => (/^\d{4}-\d{2}$/.test(p) ? `${BULAN[+p.slice(5, 7)]} ${p.slice(0, 4)}` : p);
/** tanggal gaya borang: 01-08-26 */
export const tglPendek = (t: string) => (/^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t.slice(8, 10)}-${t.slice(5, 7)}-${t.slice(2, 4)}` : t);
export const tglPanjang = (t: string) =>
  (/^\d{4}-\d{2}-\d{2}$/.test(t) ? `${+t.slice(8, 10)} ${BULAN[+t.slice(5, 7)]} ${t.slice(0, 4)}` : t);
/** hari terakhir bulan "yyyy-mm" */
export const akhirBulan = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return `${p}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
};

/** pengaruh satu mutasi terhadap stok */
export const arah = (m: MutasiSC) => (m.jenis === "pakai" ? -m.jumlah : m.jumlah);

const berlaku = (m: MutasiSC) => !m.dibatalkan;

/*
 * Urutan kejadian: tanggal kejadian dulu. Di hari yang sama, barang masuk
 * dihitung sebelum barang keluar — kapal mencatat dengan tanggal, bukan jam,
 * dan "diterima pagi, dipakai sore" jauh lebih lazim daripada sebaliknya.
 * Koreksi cek fisik paling akhir: hitungan gudang dilakukan sesudah kegiatan hari itu.
 */
const PERINGKAT: Record<JenisMutasi, number> = { awal: 0, terima: 1, pakai: 2, koreksi: 3 };
const urutKejadian = (a: MutasiSC, b: MutasiSC) =>
  a.tanggal.localeCompare(b.tanggal) || PERINGKAT[a.jenis] - PERINGKAT[b.jenis] || a.dicatatPada.localeCompare(b.dicatatPada);

/** stok satu barang, opsional hanya kejadian SEBELUM tanggal tertentu */
export function stokBarang(mutasi: MutasiSC[], itemId: string, sebelum?: string): number {
  let n = 0;
  for (const m of mutasi) {
    if (m.itemId !== itemId || !berlaku(m)) continue;
    if (sebelum && m.tanggal >= sebelum) continue;
    n += arah(m);
  }
  return Math.round(n * 1000) / 1000;
}

/** peta stok sekarang untuk seluruh barang */
export function petaStok(mutasi: MutasiSC[]): Map<string, number> {
  const peta = new Map<string, number>();
  for (const m of mutasi) {
    if (!berlaku(m)) continue;
    peta.set(m.itemId, Math.round(((peta.get(m.itemId) || 0) + arah(m)) * 1000) / 1000);
  }
  return peta;
}

/**
 * Apakah deretan mutasi satu barang pernah membuat stok MINUS bila diurutkan
 * menurut tanggal kejadian.
 *
 * Diperiksa di server setiap kali ada mutasi baru atau pembatalan. Pemakaian
 * yang mundur tanggalnya bisa sah secara total tetapi membuat stok minus pada
 * hari itu — artinya ada penerimaan yang belum dicatat, dan lebih baik kapal
 * diminta mencatatnya sekarang daripada borangnya memuat stok −3.
 */
export function cekMinus(mutasi: MutasiSC[], itemId: string): { tanggal: string; stok: number } | null {
  let n = 0;
  const deret = mutasi.filter((m) => m.itemId === itemId && berlaku(m)).sort(urutKejadian);
  for (const m of deret) {
    n = Math.round((n + arah(m)) * 1000) / 1000;
    if (n < 0) return { tanggal: m.tanggal, stok: n };
  }
  return null;
}

export type TingkatSC = "habis" | "menipis" | "aman" | "tanpa";

export const tingkatStok = (stok: number, minimum: number): TingkatSC => {
  if (stok <= 0) return "habis";
  if (minimum > 0 && stok <= minimum) return "menipis";
  if (minimum > 0) return "aman";
  return "tanpa";
};

export const NADA_SC: Record<TingkatSC, { label: string; kelas: string }> = {
  habis: { label: "Habis", kelas: "bg-rose-100 text-rose-800 ring-rose-300" },
  menipis: { label: "Menipis", kelas: "bg-amber-100 text-amber-900 ring-amber-300" },
  aman: { label: "Aman", kelas: "bg-emerald-100 text-emerald-800 ring-emerald-300" },
  tanpa: { label: "Ada", kelas: "bg-slate-100 text-slate-700 ring-slate-300" },
};

/** satu baris borang TF-101.00.11 untuk satu bulan */
export interface BarisBorangSC {
  no: number;
  item: ItemSC;
  awal: number;
  terima: number;
  tglTerima: string[];
  pakai: number;
  tglPakai: string[];
  koreksi: number;
  akhir: number;
  ketTerima: string[];
  ketPakai: string[];
}

/**
 * Isi borang bulan "yyyy-mm".
 *
 * Stok awal = semua kejadian sebelum tanggal 1, ditambah pencatatan "stok awal"
 * di bulan itu (barang yang baru didaftarkan pertengahan bulan tetap tampil
 * sebagai stok awal, bukan sebagai penerimaan yang tidak pernah terjadi).
 * Koreksi cek fisik dijumlahkan tersendiri supaya selisihnya tidak menyamar
 * menjadi penerimaan atau pemakaian.
 */
export function borangBulan(lembar: Pick<LembarSC, "item" | "mutasi">, periode: string): BarisBorangSC[] {
  const mulai = `${periode}-01`;
  const selesai = akhirBulan(periode);
  const diBulan = (m: MutasiSC) => berlaku(m) && m.tanggal >= mulai && m.tanggal <= selesai;
  const hasil: BarisBorangSC[] = [];
  for (const item of lembar.item) {
    const milik = lembar.mutasi.filter((m) => m.itemId === item.id);
    const bulan = milik.filter(diBulan).sort(urutKejadian);
    const awal = stokBarang(milik, item.id, mulai) + bulan.filter((m) => m.jenis === "awal").reduce((n, m) => n + m.jumlah, 0);
    const terimaM = bulan.filter((m) => m.jenis === "terima");
    const pakaiM = bulan.filter((m) => m.jenis === "pakai");
    const koreksi = bulan.filter((m) => m.jenis === "koreksi").reduce((n, m) => n + m.jumlah, 0);
    const terima = terimaM.reduce((n, m) => n + m.jumlah, 0);
    const pakai = pakaiM.reduce((n, m) => n + m.jumlah, 0);
    /* barang nonaktif hanya tampil bila bulan itu masih punya stok atau kejadian */
    const dibuatSesudah = item.dibuatPada && item.dibuatPada.slice(0, 10) > selesai && !milik.some((m) => m.tanggal <= selesai);
    if (dibuatSesudah) continue;
    if (!item.aktif && awal === 0 && !bulan.length) continue;
    hasil.push({
      no: hasil.length + 1, item, awal, terima, pakai, koreksi,
      akhir: Math.round((awal + terima - pakai + koreksi) * 1000) / 1000,
      tglTerima: Array.from(new Set(terimaM.map((m) => tglPendek(m.tanggal)))),
      tglPakai: Array.from(new Set(pakaiM.map((m) => tglPendek(m.tanggal)))),
      ketTerima: terimaM.map((m) => m.keterangan).filter(Boolean),
      ketPakai: pakaiM.map((m) => m.keterangan).filter(Boolean),
    });
  }
  return hasil;
}

/**
 * Baca baris tempelan dari Excel/WhatsApp.
 *
 * Kolom yang diharapkan (dipisah TAB, titik koma, atau garis tegak):
 *   Peralatan | Part Number | Nama Barang | Jumlah | Satuan | Minimum
 * Jumlah boleh ditulis "7 Pcs" seperti di borang lama — angka dan satuannya
 * dipisahkan sendiri. Baris judul dan baris kosong dilewati.
 */
export interface BarisTempel {
  peralatan: string;
  partNumber: string;
  nama: string;
  jumlah: number;
  satuan: string;
  minimum: number;
  masalah: string;
}

export function bacaTempelan(teks: string, peralatanAwal = ""): BarisTempel[] {
  const hasil: BarisTempel[] = [];
  let peralatanTerakhir = peralatanAwal;
  for (const mentah of teks.split(/\r?\n/)) {
    /* hanya ujung kanan yang dipangkas: TAB di depan berarti kolom Peralatan
       sengaja kosong, dan memangkasnya menggeser semua kolom satu langkah */
    const baris = mentah.replace(/\s+$/, "");
    if (!baris.trim()) continue;
    const sel = baris.split(/\t|;|\|/).map((s) => s.trim());
    if (sel.length < 3) {
      hasil.push({ peralatan: "", partNumber: "", nama: baris, jumlah: 0, satuan: "", minimum: 0, masalah: "Kolom kurang (butuh Peralatan, Part Number, Nama, Jumlah)" });
      continue;
    }
    if (/^(peralatan|no\.?)$/i.test(sel[0]) || /nama\s*barang/i.test(sel.join(" "))) continue;
    const [peralatan, partNumber, nama, jumlahMentah = "", satuanMentah = "", minMentah = ""] = sel;
    const m = jumlahMentah.replace(",", ".").match(/^(-?\d+(?:\.\d+)?)\s*([A-Za-z].*)?$/);
    const jumlah = m ? Number(m[1]) : NaN;
    const satuan = (satuanMentah || m?.[2] || "Pcs").trim();
    const minimum = Number(String(minMentah).replace(/[^\d.]/g, "")) || 0;
    if (peralatan) peralatanTerakhir = peralatan;
    const masalah = !nama ? "Nama barang kosong" : !Number.isFinite(jumlah) ? "Jumlah bukan angka" : jumlah < 0 ? "Jumlah minus" : "";
    hasil.push({
      peralatan: peralatan || peralatanTerakhir, partNumber: partNumber.replace(/\s*[–—]\s*|\s+-\s+/g, "-"),
      nama, jumlah: Number.isFinite(jumlah) ? jumlah : 0, satuan, minimum, masalah,
    });
  }
  return hasil;
}

/** ringkasan satu lembar — dipakai portal dan kantor supaya angkanya sama */
export function ringkasSC(lembar: Pick<LembarSC, "item" | "mutasi" | "cekFisik">) {
  const stok = petaStok(lembar.mutasi || []);
  const aktif = (lembar.item || []).filter((i) => i.aktif);
  const tingkat = aktif.map((i) => tingkatStok(stok.get(i.id) || 0, i.minimum));
  const periode = bulanIni();
  return {
    barang: aktif.length,
    habis: tingkat.filter((t) => t === "habis").length,
    menipis: tingkat.filter((t) => t === "menipis").length,
    mutasiBulanIni: (lembar.mutasi || []).filter((m) => !m.dibatalkan && m.tanggal.startsWith(periode) && m.jenis !== "awal").length,
    cekFisikTerakhir: (lembar.cekFisik || []).slice(-1)[0]?.tanggal || "",
  };
}
