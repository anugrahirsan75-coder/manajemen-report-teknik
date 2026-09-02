/** Pembantu angka & tanggal untuk badan surat e-office. */

/** 2615429394 -> "2.615.429.394" */
export const angkaRibuan = (n: number | string): string => {
  const bilangan = typeof n === "number" ? n : Number(String(n).replace(/[^\d-]/g, ""));
  if (!isFinite(bilangan)) return "0";
  return Math.round(bilangan).toLocaleString("id-ID").replace(/,/g, ".");
};

/** dipakai di badan surat: "Rp2.615.429.394,-" */
export const rupiahSurat = (n: number | string) => `Rp${angkaRibuan(n)},-`;

/** ubah isian bebas ("2.615.429.394" / "Rp 2615429394") jadi angka */
export const keAngka = (v: unknown): number => {
  const t = String(v ?? "").replace(/[^\d]/g, "");
  return t ? Number(t) : 0;
};

const BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export const NAMA_BULAN = BULAN.slice(1);

/** "2026-01-17" -> "17 Januari 2026"; isian bebas dikembalikan apa adanya */
export function tanggalSurat(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim());
  if (!m) return (iso || "").trim();
  return `${Number(m[3])} ${BULAN[Number(m[2])]} ${m[1]}`;
}

/** 1 -> "I", 4 -> "IV" — penomoran mata anggaran mengikuti surat lama */
export function romawi(n: number): string {
  const peta: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let sisa = Math.max(0, Math.round(n));
  let hasil = "";
  for (const [nilai, huruf] of peta) {
    while (sisa >= nilai) { hasil += huruf; sisa -= nilai; }
  }
  return hasil;
}

/**
 * Rangkai daftar jadi kalimat: ["a","b","c"] -> "a, b, serta c".
 * Dipakai supaya sub-poin a/b/c pada surat lama berubah jadi paragraf mengalir.
 */
export function rangkai(daftar: string[], penghubung = "serta"): string {
  const isi = daftar.map((s) => s.trim()).filter(Boolean);
  if (!isi.length) return "";
  if (isi.length === 1) return isi[0];
  return `${isi.slice(0, -1).join(", ")}, ${penghubung} ${isi[isi.length - 1]}`;
}

export const KAPAL_SURAT = [
  "KMP. Ariwangan", "KMP. Pulau Sagori", "KMP. Lompa", "KMP. Maming",
  "KMP. Portlink VIII", "KMP. Tuna", "KMP. Baronang", "KMP. Gorango",
  "KMP. Kerapu II", "KMP. Ngafi", "KMP. Bobara", "KMP. Kolorai",
  "KMP. Lema", "KMP. Cengkih Afo",
];

/**
 * Keputusan Direksi yang selalu menjadi butir pertama dasar permohonan
 * penunjukan langsung. Nomor dan tanggalnya tetap; dijadikan baris bawaan agar
 * tidak diketik ulang — salah ketik nomor kebijakan pada surat ke Regional
 * jauh lebih mahal daripada satu baris yang sudah terisi.
 */
export const DASAR_KEPUTUSAN_DIREKSI = {
  instansi: "Keputusan Direksi PT ASDP Indonesia Ferry (Persero)",
  nomor: "KD.345/UM.201/ASDP-2023",
  tanggal: "2023-10-09",
  perihal: "Kebijakan Pengadaan Barang dan Jasa di Lingkungan PT ASDP Indonesia Ferry (Persero)",
};

/** baris kosong pendamping, supaya surat dasar berikutnya tinggal diisi */
export const DASAR_KOSONG = { instansi: "", nomor: "", tanggal: "", perihal: "" };

export const GALANGAN = [
  "PT. Industri Kapal Indonesia (Persero) Kota Bitung",
  "PT. Klasaman Indah Raya Sorong",
];

export const JENIS_SURVEY = [
  "Annual Survey ke-1 (AS I)",
  "Annual Survey ke-2 (AS II)",
  "Annual Survey ke-3 (AS III)",
  "Intermediate Survey (IS)",
  "Special Survey (SS)",
];

/** nama kapal selalu ditulis "KMP. <Nama>" walau pengguna mengetik tanpa awalan */
export const namaKapalSurat = (v: string) => {
  const t = (v || "").trim();
  if (!t) return "";
  return /^kmp\.?\s/i.test(t) ? t.replace(/^kmp\.?\s*/i, "KMP. ") : `KMP. ${t}`;
};
