// Ship Database — data partikular kapal (vessel particulars) ASDP Ternate.
import { KAPAL_LIST } from "@/lib/sppbj/db";
import { BKI, DataBKI } from "./bki";

export interface ShipGeneral {
  registerBKI: string; imo: string; callSign: string; bendera: string; tipe: string;
  pelabuhanDaftar: string; klasLambung: string; klasMesin: string; galangan: string;
  tahun: string; pemilik: string; operator: string; lintasan: string;
}
export interface ShipDimension { gt: string; loa: string; lbp: string; b: string; h: string; t: string; }
export interface ShipEngine { merk: string; type: string; ehp: string; rpm: string; serialStbd: string; serialPrsd: string; }
export interface ShipGearbox { merk: string; type: string; ratio: string; serialStbd: string; serialPrsd: string; }
export interface ShipShaft { propKanan: string; propKiri: string; kemudiKanan: string; kemudiKiri: string; } // ukuran inch
export interface ShipFile { name: string; url: string; size: number; type?: string; path?: string; uploadedAt: string; }

export interface Ship {
  id: string;          // slug
  nama: string;
  general: ShipGeneral;
  dimension: ShipDimension;
  mainEngine: ShipEngine;
  auxEngine: ShipEngine;
  gearbox: ShipGearbox;
  shaft: ShipShaft;       // ukuran poros propeller & kemudi (inch)
  inventaris: ShipFile[]; // file daftar inventaris (upload, klik buka)
  /*
   * Salinan rekap resmi BKI, apa adanya. TIDAK disunting lewat aplikasi dan
   * tidak ikut tersimpan sebagai isian kantor: ia dipasang ulang dari bki.ts
   * setiap kali data kapal dimuat, supaya rekap BKI yang baru langsung terpakai
   * tanpa perlu menyentuh satu per satu tiga belas catatan yang sudah tersimpan.
   */
  bki?: DataBKI;
}

export const slugKapal = (nama: string) => nama.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// default umum semua ferry ASDP (benar utk seluruh armada)
const DEF = { bendera: "Indonesia", tipe: "Ferry Ro-Ro", pemilik: "PT. ASDP Indonesia Ferry (Persero)", operator: "PT. ASDP Indonesia Ferry (Persero)" };
const emptyGeneral = (): ShipGeneral => ({ registerBKI: "", imo: "", callSign: "", bendera: DEF.bendera, tipe: DEF.tipe, pelabuhanDaftar: "", klasLambung: "", klasMesin: "", galangan: "", tahun: "", pemilik: DEF.pemilik, operator: DEF.operator, lintasan: "" });
const emptyDim = (): ShipDimension => ({ gt: "", loa: "", lbp: "", b: "", h: "", t: "" });
const emptyEngine = (): ShipEngine => ({ merk: "", type: "", ehp: "", rpm: "", serialStbd: "", serialPrsd: "" });
const emptyGearbox = (): ShipGearbox => ({ merk: "", type: "", ratio: "", serialStbd: "", serialPrsd: "" });
const emptyShaft = (): ShipShaft => ({ propKanan: "", propKiri: "", kemudiKanan: "", kemudiKiri: "" });

export const emptyShip = (nama: string): Ship => ({
  id: slugKapal(nama), nama, general: emptyGeneral(), dimension: emptyDim(), mainEngine: emptyEngine(), auxEngine: emptyEngine(), gearbox: emptyGearbox(), shaft: emptyShaft(), inventaris: [],
});

/* "JAKARTA" -> "Jakarta". Rekap BKI seluruhnya huruf besar; kartu kapal tidak. */
const judul = (s: string) => s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, a, b) => a + b.toUpperCase());

/*
 * Nomor seri mesin di rekap BKI menempel di belakang modelnya, misal
 * "6 LA DTE 439 5502" = model "6 LA DTE 439" + seri "5502". Yang dipisah hanya
 * kelompok angka PALING BELAKANG, dan hanya kalau model masih menyisakan teks —
 * kalau tidak, "1103A-33YG2" akan terpotong jadi model tanpa nama.
 */
export function pisahSeri(model: string): { type: string; seri: string } {
  const m = /^(.*\S)\s+(\d{3,})$/.exec(String(model || "").trim());
  return m ? { type: m[1], seri: m[2] } : { type: String(model || "").trim(), seri: "" };
}

/* PS/PA = portside (kiri), SB/SA = starboard (kanan) */
const kanan = (posisi: string) => /^S/i.test(posisi || "");

/**
 * Tuang rekap BKI ke dalam satu catatan kapal.
 *
 * Nilai BKI hanya MENGISI yang masih kosong; apa pun yang sudah diketik orang
 * kantor dibiarkan. Kantor memegang hal-hal yang tidak diketahui BKI — lintasan,
 * ukuran poros, nomor seri hasil penggantian mesin — dan menimpanya dengan
 * rekap tahunan akan menghapus pengetahuan yang tidak ada di tempat lain.
 */
export function terapkanBKI(s: Ship): Ship {
  const b = BKI[s.id];
  if (!b) return s;
  /*
   * Dua arah gabungan, sengaja dibedakan.
   *
   * bki() dipakai untuk kolom yang REKAP BKI-lah pemegang catatannya — register,
   * IMO, ukuran utama, mesin. Kalau di sana ada isinya, itu yang benar, dan
   * angka lama hasil ketikan tahun lalu harus mengalah; itulah gunanya
   * memasukkan rekap baru.
   *
   * kantor() untuk kolom yang justru lebih lengkap di sisi kantor, mis. klas
   * lambung: BKI menyimpannya sebagai satu huruf "P", sedangkan catatan kantor
   * memuat notasi utuh A100 P "Ferry RO-RO". Menimpanya berarti membuang
   * keterangan.
   */
  const bkiKata = (lama: string, baru: string) => (String(baru || "").trim() ? baru : lama);
  const kantor = (lama: string, baru: string) => (String(lama || "").trim() ? lama : baru);
  /* ukuran "0" di rekap BKI berarti belum tercatat, bukan nol meter */
  const ukur = (lama: string, baru: string) => bkiKata(lama, baru === "0" ? "" : baru);

  const induk = b.mesinInduk;
  const sbd = induk.find((m) => kanan(m.posisi)) || induk[0];
  const prd = induk.find((m) => !kanan(m.posisi)) || induk[1];
  const bantu = b.mesinBantu[0];

  return {
    ...s,
    bki: b,
    general: {
      ...s.general,
      registerBKI: bkiKata(s.general.registerBKI, b.register),
      imo: bkiKata(s.general.imo, b.imo),
      callSign: bkiKata(s.general.callSign, b.callSign),
      bendera: kantor(s.general.bendera, judul(b.bendera)),
      pelabuhanDaftar: kantor(s.general.pelabuhanDaftar, judul(b.pelabuhan)),
      klasLambung: kantor(s.general.klasLambung, b.tandaKelasLambung),
      galangan: bkiKata(s.general.galangan, b.galangan),
      tahun: bkiKata(s.general.tahun, b.tahun),
    },
    dimension: {
      gt: ukur(s.dimension.gt, b.gt), loa: ukur(s.dimension.loa, b.loa), lbp: ukur(s.dimension.lbp, b.lbp),
      b: ukur(s.dimension.b, b.bmld), h: ukur(s.dimension.h, b.hmld), t: ukur(s.dimension.t, b.t),
    },
    mainEngine: sbd ? {
      merk: bkiKata(s.mainEngine.merk, sbd.merk),
      type: bkiKata(s.mainEngine.type, pisahSeri(sbd.model).type),
      ehp: bkiKata(s.mainEngine.ehp, sbd.tenaga),
      rpm: bkiKata(s.mainEngine.rpm, sbd.rpm),
      serialStbd: bkiKata(s.mainEngine.serialStbd, pisahSeri(sbd.model).seri),
      serialPrsd: bkiKata(s.mainEngine.serialPrsd, prd ? pisahSeri(prd.model).seri : ""),
    } : s.mainEngine,
    auxEngine: bantu ? {
      merk: bkiKata(s.auxEngine.merk, bantu.merk),
      type: bkiKata(s.auxEngine.type, bantu.model),
      ehp: bkiKata(s.auxEngine.ehp, bantu.bhp),
      rpm: s.auxEngine.rpm,
      serialStbd: s.auxEngine.serialStbd,
      serialPrsd: s.auxEngine.serialPrsd,
    } : s.auxEngine,
    gearbox: { ...s.gearbox, ratio: bkiKata(s.gearbox.ratio, b.gigiReduksi) },
  };
}

// data terisi: KMP. ARIWANGAN (dari lampiran particular)
const ARIWANGAN: Ship = {
  id: slugKapal("KMP. ARIWANGAN"),
  nama: "KMP. ARIWANGAN",
  general: {
    registerBKI: "3927", imo: "8824799", callSign: "YDZL", bendera: "Indonesia", tipe: "Ferry Ro-Ro",
    pelabuhanDaftar: "Jakarta", klasLambung: "+A100IL", klasMesin: "+SM", galangan: "PT. KODJA (PERSERO)",
    tahun: "1986", pemilik: DEF.pemilik, operator: DEF.operator, lintasan: "Kupal - Kasiruta - Busuwa, Kupal - Mandioli",
  },
  dimension: { gt: "157", loa: "29,05", lbp: "25", b: "7", h: "2,2", t: "1,25" },
  mainEngine: { merk: "YANMAR", type: "6 HA-HTA", ehp: "240", rpm: "2000", serialStbd: "12397", serialPrsd: "12398" },
  auxEngine: { merk: "YANMAR", type: "4 CHL-N", ehp: "38", rpm: "", serialStbd: "", serialPrsd: "" },
  gearbox: emptyGearbox(),
  shaft: emptyShaft(),
  inventaris: [],
};

export const SHIP_SEED: Ship[] = KAPAL_LIST.map((nama) =>
  terapkanBKI(nama === ARIWANGAN.nama ? ARIWANGAN : emptyShip(nama))
);

// label baris (urut sesuai dokumen particular)
export const GENERAL_FIELDS: { key: keyof ShipGeneral; label: string }[] = [
  { key: "registerBKI", label: "No. Register BKI" }, { key: "imo", label: "No. IMO" }, { key: "callSign", label: "Call Sign" },
  { key: "bendera", label: "Bendera" }, { key: "tipe", label: "Tipe Kapal" }, { key: "pelabuhanDaftar", label: "Pelabuhan Pendaftaran" },
  { key: "klasLambung", label: "Klas Lambung" }, { key: "klasMesin", label: "Klas Mesin" }, { key: "galangan", label: "Galangan Pembuat" },
  { key: "tahun", label: "Tahun Pembuatan" }, { key: "pemilik", label: "Nama Pemilik" }, { key: "operator", label: "Operator" },
  { key: "lintasan", label: "Lintasan" },
];
export const DIM_FIELDS: { key: keyof ShipDimension; label: string; unit: string }[] = [
  { key: "gt", label: "GT", unit: "Ton" }, { key: "loa", label: "LOA", unit: "Meter" }, { key: "lbp", label: "LBP", unit: "Meter" },
  { key: "b", label: "B", unit: "Meter" }, { key: "h", label: "H", unit: "Meter" }, { key: "t", label: "T", unit: "Meter" },
];
export const ENGINE_FIELDS: { key: keyof ShipEngine; label: string }[] = [
  { key: "merk", label: "Merk" }, { key: "type", label: "Type" }, { key: "ehp", label: "EHP (HP)" }, { key: "rpm", label: "RPM" },
  { key: "serialStbd", label: "Serial Number (STBD)" }, { key: "serialPrsd", label: "Serial Number (PRSD)" },
];
export const GEARBOX_FIELDS: { key: keyof ShipGearbox; label: string }[] = [
  { key: "merk", label: "Merk" }, { key: "type", label: "Type Gearbox" }, { key: "ratio", label: "Rasio Reduksi" },
  { key: "serialStbd", label: "Serial Number (STBD)" }, { key: "serialPrsd", label: "Serial Number (PRSD)" },
];
export const SHAFT_FIELDS: { key: keyof ShipShaft; label: string; unit: string }[] = [
  { key: "propKanan", label: "Shaft Propeller Kanan", unit: "Inch" },
  { key: "propKiri", label: "Shaft Propeller Kiri", unit: "Inch" },
  { key: "kemudiKanan", label: "Shaft Kemudi Kanan", unit: "Inch" },
  { key: "kemudiKiri", label: "Shaft Kemudi Kiri", unit: "Inch" },
];

// hitung kelengkapan data (utk badge)
export const shipFilled = (s: Ship): number => {
  /* hanya medan yang memang diisi manusia; blok bki bukan isian */
  const vals = [
    ...Object.values(s.general), ...Object.values(s.dimension),
    ...Object.values(s.mainEngine), ...Object.values(s.auxEngine), ...Object.values(s.gearbox), ...Object.values(s.shaft || {}),
  ];
  const isi = vals.filter((v) => String(v || "").trim()).length;
  return Math.round((isi / vals.length) * 100);
};
