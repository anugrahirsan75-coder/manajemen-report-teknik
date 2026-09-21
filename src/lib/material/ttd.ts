/**
 * Pembubuhan tanda tangan dan stempel pada dokumen pengajuan kode material.
 *
 * Berkas gambarnya TIDAK ikut kode. Ia dibaca dari data/ttd pada laptop yang
 * menjalankan aplikasi dan folder itu dikecualikan dari git: tanda tangan
 * orang bukan aset kode, dan sekali ikut terdorong ke penyimpanan bersama ia
 * tidak bisa benar-benar ditarik kembali.
 *
 * Dibubuhkan atas persetujuan pemilik tanda tangannya (Dept. Head), yang juga
 * memakai aplikasi ini dan menyetujui kirimannya ke pusat. Kalau berkasnya
 * tidak ada, dokumen tetap terbit — hanya kosong pada ruang tanda tangan,
 * sehingga bisa dicetak lalu ditandatangani seperti biasa.
 */
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { ambilTtdPenuh } from "./ttdSumber";

export type PeranTtd = "deptHead" | "stafTeknik" | "stempel";

const BERKAS: Record<PeranTtd, string> = {
  deptHead: "ttd-dept-head.png",
  stafTeknik: "ttd-staf-teknik.png",
  stempel: "stempel.png",
};

export const folderTtd = () => path.join(process.cwd(), "data", "ttd");

export function adaTtd(peran: PeranTtd): boolean {
  try {
    return fs.statSync(path.join(folderTtd(), BERKAS[peran])).size > 0;
  } catch {
    return false;
  }
}

export const statusTtd = () => ({
  deptHead: adaTtd("deptHead"),
  stafTeknik: adaTtd("stafTeknik"),
  stempel: adaTtd("stempel"),
});

// sumbernya satu pintu dengan jalur PDF: env, berkas laptop, lalu brankas
const baca = (peran: PeranTtd): Promise<Buffer | null> => ambilTtdPenuh(peran);

interface Tempat {
  /** kolom & baris Excel berbasis 1, sama seperti yang dibaca orang */
  kolom: number;
  baris: number;
  lebar: number;
  tinggi: number;
  /** geser halus dalam piksel, dipakai merapikan letak terhadap garis nama */
  geserX?: number;
  geserY?: number;
}

/**
 * Tempelkan satu gambar ke lembar kerja.
 *
 * ExcelJS memakai indeks berbasis NOL untuk jangkarnya, sementara alamat sel
 * yang dipakai di seluruh berkas ini berbasis satu. Perbedaan itu pernah
 * menggeser tanda tangan satu baris ke atas tanpa ada galat apa pun, jadi
 * konversinya dikerjakan di satu tempat ini saja.
 */
function tempel(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, gambar: Buffer, t: Tempat) {
  // sama seperti jalur PDF: jenisnya dari isi berkas, bukan dianggap PNG
  const jpeg = gambar.length > 3 && gambar[0] === 0xff && gambar[1] === 0xd8 && gambar[2] === 0xff;
  const id = wb.addImage({ buffer: gambar as any, extension: jpeg ? "jpeg" : "png" });
  ws.addImage(id, {
    tl: { col: t.kolom - 1 + (t.geserX || 0), row: t.baris - 1 + (t.geserY || 0) } as any,
    ext: { width: t.lebar, height: t.tinggi },
    editAs: "oneCell",
  });
}

/**
 * Bubuhkan tanda tangan Dept. Head, staf teknik, dan stempel pada blok tanda
 * tangan Formulir Permintaan Master Data.
 *
 * Nama tercetak ada di baris 23 (B untuk Dept. Head, G untuk staf), jadi
 * tanda tangannya duduk tepat di atas baris itu. Stempel ditaruh di sisi
 * Dept. Head dan sengaja menindih sebagian tanda tangannya — begitulah
 * stempel dibubuhkan di atas kertas.
 */
export async function bubuhiFormulir(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet) {
  const [dept, staf, cap] = await Promise.all([baca("deptHead"), baca("stafTeknik"), baca("stempel")]);

  // Stempel ditaruh DI SAMPING tanda tangan, bukan menindihnya. Urutan tumpuk
  // gambar pada lembar Excel tidak dijamin, jadi kalau keduanya ditumpuk,
  // tanda tangannya bisa hilang sepenuhnya di balik stempel — dan itu persis
  // yang terjadi pada percobaan pertama. Keduanya juga berhenti di atas baris
  // nama supaya nama tercetaknya tetap terbaca.
  if (cap) tempel(wb, ws, cap, { kolom: 2, baris: 19, lebar: 88, tinggi: 87, geserX: 0.02, geserY: -0.25 });
  if (dept) tempel(wb, ws, dept, { kolom: 3, baris: 19, lebar: 124, tinggi: 82, geserX: 0.15, geserY: 0.35 });
  if (staf) tempel(wb, ws, staf, { kolom: 7, baris: 19, lebar: 52, tinggi: 81, geserX: 0.3, geserY: 0.3 });

  return { deptHead: !!dept, stafTeknik: !!staf, stempel: !!cap };
}
