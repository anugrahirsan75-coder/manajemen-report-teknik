/**
 * Konversi Excel ke PDF lewat MS Office di laptop yang menjalankan aplikasi.
 *
 * Dipisah ke berkas sendiri karena dipakai dua route — satu dokumen dan
 * satu ZIP berisi semuanya. Waktu masih disalin di kedua tempat, perbaikan
 * pada satu salinan tidak ikut ke salinan lainnya.
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export const officeAda = () =>
  process.platform === "win32" && process.env.DISABLE_OFFICE_PDF !== "1";

export function xlsxKePdf(masuk: string, keluar: string): Promise<void> {
  const skrip = path.join(process.cwd(), "scripts", "to-pdf.ps1");
  return new Promise((resolve, reject) => {
    const ps = spawn("powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", skrip, "-In", masuk, "-Out", keluar]);
    let galat = "";
    ps.stderr.on("data", (d) => (galat += d.toString()));
    ps.on("close", (kode) =>
      kode === 0 && fs.existsSync(keluar)
        ? resolve()
        : reject(new Error("Konversi PDF gagal. " + galat)));
  });
}
