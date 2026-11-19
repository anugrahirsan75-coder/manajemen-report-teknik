import { VENDOR_DB } from "./db";

const kunci = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const inti = (s: string) => kunci(s.replace(/^\s*(PT|CV|UD|KOPKAR|KOPERASI)\b\.?/i, ""));

/**
 * Vendor diketik bebas di Excel. Kalau cocok dengan tepat satu rekanan di
 * daftar aplikasi, pakai nama resminya supaya rekap tidak terpecah oleh ejaan
 * ("argo jaya" dan "CV. ARGO JAYA MANDIRI"). Selain itu disimpan apa adanya.
 */
export function rapikanVendor(v: unknown): string {
  const teks = String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!teks) return "";
  const k = inti(teks);
  if (k.length < 3) return teks;
  const persis = VENDOR_DB.filter((x) => inti(x.nama) === k);
  if (persis.length === 1) return persis[0].nama;
  const mirip = VENDOR_DB.filter((x) => inti(x.nama).includes(k));
  return mirip.length === 1 ? mirip[0].nama : teks;
}

/** nama rekanan untuk pilihan di makro Excel */
export const daftarVendor = () => VENDOR_DB.map((v) => v.nama);
