// Database kapal: nama -> kode storage (kolom O, file1) + cost center (file2 D10)
export interface KapalInfo { nama: string; kode: string; costCenter: string }

export const KAPAL_DB: KapalInfo[] = [
  { nama: "SEMUA KAPAL", kode: "5205", costCenter: "" },
  { nama: "KMP. PORTLINK VIII", kode: "5203", costCenter: "5201100014" },
  { nama: "KMP. BARONANG", kode: "5204", costCenter: "5201100016" },
  { nama: "KMP. GORANGO", kode: "5205", costCenter: "5201100017" },
  { nama: "KMP. BOBARA", kode: "5206", costCenter: "5201100010" },
  { nama: "KMP. KERAPU II", kode: "5207", costCenter: "5201100011" },
  { nama: "KMP. LOMPA", kode: "5208", costCenter: "5201100021" },
  { nama: "KMP. ARIWANGANI", kode: "5209", costCenter: "5201100022" },
  { nama: "KMP. PULAU SAGORI", kode: "5210", costCenter: "5201100012" },
  { nama: "KMP. NGAFI", kode: "5211", costCenter: "5201100023" },
  { nama: "KMP. MAMING", kode: "5212", costCenter: "5201100009" },
  { nama: "KMP. TUNA", kode: "5213", costCenter: "5201100025" },
  { nama: "KMP. KOLORAI", kode: "5214", costCenter: "5201100024" },
  { nama: "KMP. LEMA", kode: "5215", costCenter: "5201100029" },
];

export const kapalByNama = (nama: string) => KAPAL_DB.find((k) => k.nama === nama);
export const kapalKode = (nama: string) => kapalByNama(nama)?.kode ?? "5205";
export const kapalCostCenter = (nama: string) => kapalByNama(nama)?.costCenter ?? "";

// Database Reference: kode material (mat group) -> deskripsi + kelompok + tipe
export interface RefMaterial { kode: string; short: string; kelompok: string; tipe: string }

export const REFERENCE_DB: RefMaterial[] = [
  { kode: "B01001", short: "BBM - Kapal", kelompok: "Bahan bakar & Pelumas", tipe: "ZBB" },
  { kode: "B01002", short: "BBM - Bungker", kelompok: "Bahan bakar & Pelumas", tipe: "ZBB" },
  { kode: "B01003", short: "Pelumas/Oli Mesin", kelompok: "Bahan bakar & Pelumas", tipe: "ZBB" },
  { kode: "B01004", short: "BB Kendaraan", kelompok: "Bahan bakar & Pelumas", tipe: "ZBB" },
  { kode: "B01005", short: "Pelumas/Oli Hydrolik", kelompok: "Bahan bakar & Pelumas", tipe: "ZBB" },
  { kode: "B01006", short: "Gemuk", kelompok: "Bahan bakar & Pelumas", tipe: "ZBB" },
  { kode: "B02001", short: "Suku Cadang Kapal", kelompok: "Suku Cadang", tipe: "ZSC" },
  { kode: "B02002", short: "SC Instalasi Faspel", kelompok: "Suku Cadang", tipe: "ZSC" },
  { kode: "B02003", short: "SC Alat Faspel", kelompok: "Suku Cadang", tipe: "ZSC" },
  { kode: "B02004", short: "SC Kendaraan", kelompok: "Suku Cadang", tipe: "ZSC" },
  { kode: "B02005", short: "SC Peralatan Umum", kelompok: "Suku Cadang", tipe: "ZSC" },
  { kode: "B02006", short: "SC Peralatan Deck", kelompok: "Suku Cadang", tipe: "ZSC" },
  { kode: "B02007", short: "SC Mesin Induk", kelompok: "Suku Cadang", tipe: "ZSC" },
  { kode: "B02008", short: "SC Mesin Bantu", kelompok: "Suku Cadang", tipe: "ZSC" },
  { kode: "B02009", short: "SC Mesin Emrgncy Gen", kelompok: "Suku Cadang", tipe: "ZSC" },
  { kode: "B02010", short: "SC Propulsion System", kelompok: "Suku Cadang", tipe: "ZSC" },
  { kode: "B02011", short: "SC Kelistrikan Kapal", kelompok: "Suku Cadang", tipe: "ZSC" },
  { kode: "B02012", short: "SC Genset Pelabuhan", kelompok: "Suku Cadang", tipe: "ZSC" },
  { kode: "B02013", short: "Movable Bridge Pel", kelompok: "Suku Cadang", tipe: "ZSC" },
  { kode: "B02014", short: "Hydrolik Sistem Pel", kelompok: "Suku Cadang", tipe: "ZSC" },
  { kode: "B02015", short: "Timbangan Pelabuhan", kelompok: "Suku Cadang", tipe: "ZSC" },
  { kode: "B03001", short: "Perlengkapan Bongkar", kelompok: "Peralatan", tipe: "ZPKP" },
  { kode: "B03002", short: "Mat. Galangan Kapal", kelompok: "Peralatan", tipe: "ZPKP" },
  { kode: "B03003", short: "Mat. Perbengkelan", kelompok: "Peralatan", tipe: "ZPKP" },
  { kode: "B03004", short: "Alat Navigasi Kapal", kelompok: "Peralatan", tipe: "ZPKP" },
  { kode: "B03005", short: "Alat Kes. Kapal", kelompok: "Peralatan", tipe: "ZPKP" },
  { kode: "B03006", short: "Sis. Kes. Kapal", kelompok: "Peralatan", tipe: "ZPKP" },
  { kode: "B03007", short: "Obat dan Alat Medis", kelompok: "Peralatan", tipe: "ZPKP" },
  { kode: "B03008", short: "Cat- kapal", kelompok: "Peralatan", tipe: "ZPKP" },
  { kode: "B03009", short: "Peralatan Umum-kapal", kelompok: "Peralatan", tipe: "ZPKP" },
  { kode: "B03010", short: "cat- pelabuhan", kelompok: "Peralatan", tipe: "ZPKP" },
  { kode: "B03011", short: "Peralatan Pelabuhan", kelompok: "Peralatan", tipe: "ZPKP" },
  { kode: "B03012", short: "Alat Perbengkelan", kelompok: "Peralatan", tipe: "ZPKP" },
  { kode: "B03013", short: "Surat&Sertifikat", kelompok: "Peralatan", tipe: "ZPKP" },
  { kode: "B03014", short: "Peralatan Interior", kelompok: "Peralatan", tipe: "ZPKP" },
  { kode: "B03015", short: "Material Interior", kelompok: "Peralatan", tipe: "ZPKP" },
  { kode: "B03016", short: "Alat Sensor Kapal", kelompok: "Peralatan", tipe: "ZPKP" },
];

export const refByKode = (kode: string) => REFERENCE_DB.find((r) => r.kode === kode);
export const descByKode = (kode: string) => refByKode(kode)?.short ?? ""; // kolom J otomatis
export const isSukuCadang = (kode: string) => refByKode(kode)?.tipe === "ZSC";
// ME (Mesin Induk) jika kode = SC Mesin Induk, selain itu AE (Mesin Bantu/lainnya)
export const meAe = (kode: string): "ME" | "AE" => (refByKode(kode)?.short.includes("Induk") ? "ME" : "AE");
