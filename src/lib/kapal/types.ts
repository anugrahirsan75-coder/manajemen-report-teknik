// Ship Database — data partikular kapal (vessel particulars) ASDP Ternate.
import { KAPAL_LIST } from "@/lib/sppbj/db";

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
  nama === ARIWANGAN.nama ? ARIWANGAN : emptyShip(nama)
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
  const vals = [
    ...Object.values(s.general), ...Object.values(s.dimension),
    ...Object.values(s.mainEngine), ...Object.values(s.auxEngine), ...Object.values(s.gearbox), ...Object.values(s.shaft || {}),
  ];
  const isi = vals.filter((v) => String(v || "").trim()).length;
  return Math.round((isi / vals.length) * 100);
};
