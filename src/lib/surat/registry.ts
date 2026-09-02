/**
 * Daftar template surat.
 *
 * Menambah jenis surat baru: buat satu berkas di templates/, lalu daftarkan di
 * sini. Halaman UI membaca daftar ini dan merakit borangnya sendiri dari skema
 * isian, jadi tidak ada yang perlu diubah di sisi tampilan.
 */
import { TemplateSurat } from "./types";
import { dockingInvestasi } from "./templates/dockingInvestasi";
import { realisasiRutin } from "./templates/realisasiRutin";
import { classMatter } from "./templates/classMatter";
import { surveyStatutori } from "./templates/surveyStatutori";
import { perpanjanganSertifikat } from "./templates/perpanjanganSertifikat";
import { permohonanIO } from "./templates/permohonanIO";
import { pekerjaanTambahan } from "./templates/pekerjaanTambahan";
import { penunjukanLangsung } from "./templates/penunjukanLangsung";
import { penunjukanPengadaan } from "./templates/penunjukanPengadaan";
import { penunjukanRampdoor } from "./templates/penunjukanRampdoor";
import { exemptionStability } from "./templates/exemptionStability";
import { suratKustom } from "./templates/suratKustom";

export const TEMPLATE_SURAT: TemplateSurat[] = [
  dockingInvestasi,
  pekerjaanTambahan,
  penunjukanLangsung,
  penunjukanPengadaan,
  penunjukanRampdoor,
  realisasiRutin,
  classMatter,
  surveyStatutori,
  perpanjanganSertifikat,
  permohonanIO,
  exemptionStability,
  suratKustom,
];

export const cariTemplate = (id: string) => TEMPLATE_SURAT.find((t) => t.id === id);
