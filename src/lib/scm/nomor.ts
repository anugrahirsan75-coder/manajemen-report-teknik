/**
 * Nomor dokumen pengadaan.
 *
 * Di berkas SCM, seluruh nomor dokumen dirakit dari EMPAT ANGKA PERTAMA nomor
 * inisiasi e-Proc. Contoh: inisiasi "4181/INITIATION/ASDP-DN-11-02-03/VI/2026"
 * menghasilkan 4181/UND/PBJ-TTE/VI/ASDP-2026, 4181/BA-NGH/PBJ/VI/ASDP-2026,
 * dan seterusnya. Aturannya disalin apa adanya ke sini supaya nomor yang keluar
 * dari aplikasi sama persis dengan yang selama ini ditulis tangan.
 */

const ROMAWI = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export const kodeDokumen = (noInisiasi: string) => (noInisiasi || "").trim().slice(0, 4);

/** bagian "VI/ASDP-2026" dari sebuah tanggal */
function ekorTanggal(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso || "");
  return m ? `${ROMAWI[Number(m[2])]}/ASDP-${m[1]}` : null;
}

export interface NomorDokumen {
  undangan: string;
  jadwal: string;
  baNego: string;
  bahp: string;
  spbj: string;
}

/**
 * Susun seluruh nomor dokumen. Yang belum bisa disusun dikembalikan kosong —
 * lebih baik kosong daripada nomor separuh jadi yang terlanjur tersalin ke
 * dokumen resmi.
 */
export function nomorDokumen(noInisiasi: string, tglInisiasi: string, tglNego: string, tglBahp: string, tglSpbj: string): NomorDokumen {
  const kode = kodeDokumen(noInisiasi);
  const buat = (pola: string, iso: string) => {
    const ekor = ekorTanggal(iso);
    return kode && ekor ? pola.replace("{kode}", kode).replace("{ekor}", ekor) : "";
  };
  return {
    undangan: buat("{kode}/UND/PBJ-TTE/{ekor}", tglInisiasi),
    jadwal: buat("{kode}/JW/PBJ/{ekor}", tglInisiasi),
    baNego: buat("{kode}/BA-NGH/PBJ/{ekor}", tglNego || tglInisiasi),
    bahp: buat("{kode}/BAHP/PBJ/{ekor}", tglBahp || tglNego || tglInisiasi),
    spbj: buat("SPB/J.{kode}/PBJ/{ekor}", tglSpbj || tglBahp || tglInisiasi),
  };
}
