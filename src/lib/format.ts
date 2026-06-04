const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// "2025-02-04" -> "04 Februari 2025"
export function tanggalIndo(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, "0")} ${BULAN[m - 1]} ${y}`;
}

// rentang "16 Januari 2025 s/d 04 Februari 2025"
export function rentangTanggal(mulai: string, selesai: string): string {
  return `${tanggalIndo(mulai)} s/d ${tanggalIndo(selesai)}`;
}

// jumlah hari inklusif
export function jangkaHari(mulai: string, selesai: string): number {
  if (!mulai || !selesai) return 0;
  const a = new Date(mulai).getTime();
  const b = new Date(selesai).getTime();
  return Math.round((b - a) / 86400000) + 1;
}

// 17537500 -> "17.537.500"
export function rupiah(n: number): string {
  return new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
}

// 17537500 -> "Rp 17.537.500"
export function rupiahRp(n: number): string {
  return `Rp ${rupiah(n)}`;
}

// "2026-05-10" -> "Mei 2026"
export function bulanTahun(iso: string): string {
  if (!iso) return "";
  const [y, m] = iso.split("-").map(Number);
  return `${BULAN[m - 1]} ${y}`;
}
const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
export function bulanRomawi(iso: string): string {
  if (!iso) return "";
  const m = Number(iso.split("-")[1]);
  return ROMAWI[m - 1] ?? "";
}

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export function namaHari(iso: string): string {
  if (!iso) return "";
  return HARI[new Date(iso).getDay()] ?? "";
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// "2025-02-04" -> "Selasa tanggal Empat bulan Februari tahun Dua Ribu Dua Puluh Lima"
export function kalimatTanggal(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${namaHari(iso)} tanggal ${titleCase(terbilang(d))} bulan ${BULAN[m - 1]} tahun ${titleCase(terbilang(y))}`;
}

export function terbilangRupiah(n: number): string {
  return titleCase(terbilang(n)) + " Rupiah";
}

// terbilang Indonesia
const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
function terbilangRec(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n < 12) return SATUAN[n];
  if (n < 20) return terbilangRec(n - 10) + " belas";
  if (n < 100) return terbilangRec(Math.floor(n / 10)) + " puluh " + terbilangRec(n % 10);
  if (n < 200) return "seratus " + terbilangRec(n - 100);
  if (n < 1000) return terbilangRec(Math.floor(n / 100)) + " ratus " + terbilangRec(n % 100);
  if (n < 2000) return "seribu " + terbilangRec(n - 1000);
  if (n < 1000000) return terbilangRec(Math.floor(n / 1000)) + " ribu " + terbilangRec(n % 1000);
  if (n < 1000000000) return terbilangRec(Math.floor(n / 1000000)) + " juta " + terbilangRec(n % 1000000);
  return terbilangRec(Math.floor(n / 1000000000)) + " milyar " + terbilangRec(n % 1000000000);
}
export function terbilang(n: number): string {
  if (!n) return "nol";
  return terbilangRec(n).replace(/\s+/g, " ").trim();
}
