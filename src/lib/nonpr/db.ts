// DATABASE SPPBJ Non PR PO — dari sheet "Database" template.

export const MATA_ANGGARAN_NONPR: { kode: string; label: string }[] = [
  { kode: "5010403003", label: "5010403003 (Kapal Ro-Ro)" },
  { kode: "5010403100", label: "5010403100 (Permesinan & Kelistrikan Kapal)" },
  { kode: "5010403009", label: "5010403009 (Akomodasi, Peralatan & Perlengkapan Kapal)" },
  { kode: "5010317000", label: "5010317000 (Biaya Sertifikasi Alat Produksi Docking)" },
  { kode: "5010302006", label: "5010302006 (Fumigasi)" },
  { kode: "5010302004", label: "5010302004 (Mobilisasi Docking)" },
  { kode: "1020604003", label: "1020604003 (Investasi Kapal Ro-Ro)" },
  { kode: "1020604009", label: "1020604009 (Investasi Akomodasi, Peralatan & Perlengkapan)" },
  { kode: "1020604010", label: "1020604010 (Investasi Permesinan dan Kelistrikan)" },
];

// per kapal: nama Nakhoda & KKM/Masinis I
export interface KapalPic { kapal: string; nakhoda: string; kkm: string }
export const KAPAL_PIC: KapalPic[] = [
  { kapal: "KMP. TUNA", nakhoda: "CECEP KOSWARA", kkm: "RUSLI" },
  { kapal: "KMP. MAMING", nakhoda: "MUHADI", kkm: "ARIEF SETYAWAN" },
  { kapal: "KMP. PULAU SAGORI", nakhoda: "SARPUDIN SANDUAN", kkm: "SLAMET DAHRONI" },
  { kapal: "KMP. PORTLINK VIII", nakhoda: "SARAFUDIN HAYALE", kkm: "PAWIT SUTRISNO" },
  { kapal: "KMP. LOMPA", nakhoda: "YONDI U SAKTI", kkm: "SURYADI WIJAYA" },
  { kapal: "KMP. NGAFI", nakhoda: "ASMIN", kkm: "FAIZAL" },
  { kapal: "KMP. KOLORAI", nakhoda: "REZKY LOLO PAYUNG", kkm: "REZKY" },
  { kapal: "KMP. BARONANG", nakhoda: "SAMSON TINUNGKI", kkm: "DENY SETYAWAN" },
  { kapal: "KMP. KERAPU II", nakhoda: "FAHRIL", kkm: "MUHAMMAD ARIF" },
  { kapal: "KMP. GORANGO", nakhoda: "ANTON WAHYUDI", kkm: "SELSIUS C PONTO" },
  { kapal: "KMP. BOBARA", nakhoda: "PHILIPUS MAHUBESSY", kkm: "PIERE GEORGE H. REHATTA" },
  { kapal: "KMP. ARIWANGAN", nakhoda: "ERIEK PUTRA NEGARA", kkm: "SISWANTO" },
  { kapal: "KMP. LEMA", nakhoda: "BUDI PRIYANTO", kkm: "HENDRA RUDOLF SOUMOKIL" },
];
export const KAPAL_LIST_NONPR = KAPAL_PIC.map((k) => k.kapal);
export const picOf = (kapal: string) => KAPAL_PIC.find((k) => k.kapal.trim().toUpperCase() === (kapal || "").trim().toUpperCase());

export type Jabatan = "KKM" | "Nakhoda";
// Kepada Yth + penerima BSTB sesuai jabatan
export function penerimaBstb(kapal: string, jabatan: Jabatan): { kepada: string; nama: string } {
  const p = picOf(kapal);
  const gelar = jabatan === "KKM" ? "KKM" : "Nakhoda";
  return { kepada: `${gelar} ${kapal}`, nama: (jabatan === "KKM" ? p?.kkm : p?.nakhoda) || "" };
}

export interface Vendor { nama: string; telp: string }
export const VENDOR_NONPR: Vendor[] = [
  { nama: "CV. Multi Karya Jasa", telp: "082153148837" },
  { nama: "CV. Leon Pratama", telp: "087754384412" },
  { nama: "Bengkel Buana Karya", telp: "082177650201" },
];
export const vendorOf = (nama: string) => VENDOR_NONPR.find((v) => v.nama.trim().toUpperCase() === (nama || "").trim().toUpperCase());

// pejabat (TTD) default
export const STAF_TEKNIK_NONPR = "IRSAN ANUGRAH";
export const DEPT_HEAD_NONPR = "ERYANTO SIDABALOK";
export const GM_NONPR = "MUSHAR USMAN";

export const MAX_NILAI_NONPR = 2_500_000; // batas total per file
