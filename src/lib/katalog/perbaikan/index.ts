/**
 * Katalog pekerjaan perbaikan & perawatan kapal.
 *
 * Dua lapis. Lapis pertama `PERBAIKAN_DASAR`: pekerjaan yang benar-benar
 * pernah dibayar cabang, harga aslinya, ditandai "Riil". Lapis kedua hasil
 * pengembangan pola (bahan x ukuran x jenis pekerjaan), ditandai "Pasar"
 * karena harganya taksiran — besar jumlahnya, tetapi statusnya jujur.
 *
 * Dibangun saat pertama dipakai, bukan saat modul dimuat: katalognya puluhan
 * ribu baris dan sebagian besar layar tidak pernah menyentuhnya.
 */
import type { KatalogItem } from "../source";
import { kembangkan } from "./pola";
import { PERBAIKAN_DASAR } from "./dasar";
import { POLA_PIPA, POLA_KATUP, POLA_POMPA } from "./keluarga/perpipaan";
import { POLA_LAMPU, POLA_KABEL, POLA_PROTEKSI, POLA_PANEL, POLA_MOTOR, POLA_GENSET, POLA_AKI } from "./keluarga/listrik";
import { POLA_PLAT, POLA_CAT, POLA_SIAP } from "./keluarga/konstruksi";
import { POLA_MESIN, POLA_OLI, POLA_PROPULSI, POLA_GELADAK, POLA_TANGKI, POLA_ANODA } from "./keluarga/permesinan";
import { POLA_PINTU, POLA_JENDELA, POLA_PENUTUP, POLA_MEBEL, POLA_SANITASI, POLA_AC, POLA_VENTILASI } from "./keluarga/akomodasi";
import { POLA_APAR, POLA_PEMADAM, POLA_PENOLONG, POLA_NAVIGASI } from "./keluarga/keselamatan";
import { POLA_BERSIH, POLA_DOCK, POLA_FASILITAS } from "./keluarga/layanan";

const SEMUA_POLA = [
  ...POLA_PIPA, ...POLA_KATUP, ...POLA_POMPA,
  ...POLA_LAMPU, ...POLA_KABEL, ...POLA_PROTEKSI, ...POLA_PANEL, ...POLA_MOTOR, ...POLA_GENSET, ...POLA_AKI,
  ...POLA_PLAT, ...POLA_CAT, ...POLA_SIAP,
  ...POLA_MESIN, ...POLA_OLI, ...POLA_PROPULSI, ...POLA_GELADAK, ...POLA_TANGKI, ...POLA_ANODA,
  ...POLA_PINTU, ...POLA_JENDELA, ...POLA_PENUTUP, ...POLA_MEBEL, ...POLA_SANITASI, ...POLA_AC, ...POLA_VENTILASI,
  ...POLA_APAR, ...POLA_PEMADAM, ...POLA_PENOLONG, ...POLA_NAVIGASI,
  ...POLA_BERSIH, ...POLA_DOCK, ...POLA_FASILITAS,
];

let cache: KatalogItem[] | null = null;

/** Seluruh item perbaikan: yang ditulis tangan lebih dulu, lalu hasil pola. */
export function katalogPerbaikan(): KatalogItem[] {
  if (cache) return cache;
  const out: KatalogItem[] = [...PERBAIKAN_DASAR];
  const ada = new Set(out.map((i) => i.kode));
  for (const it of kembangkan(SEMUA_POLA)) {
    // kode dibentuk dari id dimensi, jadi bentrok berarti dua pola memakai
    // awalan yang sama — item kedua dibuang daripada menimpa yang pertama
    if (ada.has(it.kode)) continue;
    ada.add(it.kode);
    out.push(it);
  }
  cache = out;
  return out;
}
