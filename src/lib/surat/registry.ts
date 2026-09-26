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
import { penunjukanGabungan } from "./templates/penunjukanGabungan";
import { tambahanHariDock } from "./templates/tambahanHariDock";
import { dendaDocking } from "./templates/dendaDocking";
import { laporanBerangkatDock } from "./templates/laporanBerangkatDock";
import { dockSpace } from "./templates/dockSpace";
import { dockSpaceArmada } from "./templates/dockSpaceArmada";
import { jointSurvey } from "./templates/jointSurvey";
import { exemptionStability } from "./templates/exemptionStability";
import { pelimpahanWewenang } from "./templates/pelimpahanWewenang";
import { pelimpahanPenunjukan } from "./templates/pelimpahanPenunjukan";
import { pengantarKodeMaterial } from "./templates/pengantarKodeMaterial";
import { suratKustom } from "./templates/suratKustom";

export const TEMPLATE_SURAT: TemplateSurat[] = [
  dockSpaceArmada,
  dockSpace,
  jointSurvey,
  dockingInvestasi,
  pekerjaanTambahan,
  penunjukanLangsung,
  penunjukanPengadaan,
  penunjukanRampdoor,
  penunjukanGabungan,
  pelimpahanWewenang,
  pelimpahanPenunjukan,
  tambahanHariDock,
  dendaDocking,
  laporanBerangkatDock,
  realisasiRutin,
  classMatter,
  surveyStatutori,
  perpanjanganSertifikat,
  permohonanIO,
  pengantarKodeMaterial,
  exemptionStability,
  suratKustom,
];

export const cariTemplate = (id: string) => TEMPLATE_SURAT.find((t) => t.id === id);
