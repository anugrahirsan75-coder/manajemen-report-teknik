/**
 * Terbilang Bahasa Indonesia untuk nilai rupiah pada badan surat.
 *
 * Mengikuti kebiasaan surat cabang: memakai kata "milyar" (bukan miliar) dan
 * ditutup satu kali dengan "rupiah" — bukan diulang tiap suku.
 */

const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan",
  "sepuluh", "sebelas"];

/** angka di bawah seribu */
function ratusan(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} belas`;
  if (n < 100) {
    const puluh = Math.floor(n / 10);
    const sisa = n % 10;
    return `${SATUAN[puluh]} puluh${sisa ? ` ${SATUAN[sisa]}` : ""}`;
  }
  const ratus = Math.floor(n / 100);
  const sisa = n % 100;
  const depan = ratus === 1 ? "seratus" : `${SATUAN[ratus]} ratus`;
  return `${depan}${sisa ? ` ${ratusan(sisa)}` : ""}`;
}

const TINGKAT = [
  { nilai: 1_000_000_000_000, nama: "triliun" },
  { nilai: 1_000_000_000, nama: "milyar" },
  { nilai: 1_000_000, nama: "juta" },
  { nilai: 1_000, nama: "ribu" },
];

/** 2615429394 -> "dua milyar enam ratus lima belas juta empat ratus dua puluh sembilan ribu tiga ratus sembilan puluh empat" */
export function terbilangAngka(n: number): string {
  const bilangan = Math.floor(Math.abs(n));
  if (!isFinite(bilangan) || bilangan === 0) return "nol";

  let sisa = bilangan;
  const bagian: string[] = [];
  for (const { nilai, nama } of TINGKAT) {
    const jumlah = Math.floor(sisa / nilai);
    if (jumlah > 0) {
      // "seribu", bukan "satu ribu" — sedangkan "satu juta" tetap memakai satu
      const depan = jumlah === 1 && nama === "ribu" ? "seribu" : `${terbilangAngka(jumlah)} ${nama}`;
      bagian.push(depan);
      sisa -= jumlah * nilai;
    }
  }
  if (sisa > 0) bagian.push(ratusan(sisa));
  return bagian.join(" ").replace(/\s+/g, " ").trim();
}

/** untuk badan surat: "... tiga ratus sembilan puluh empat rupiah" */
export function terbilangRupiah(n: number): string {
  const t = terbilangAngka(n);
  return `${t} rupiah`;
}
