/**
 * Penempatan otomatis item tarikan ke KELOMPOK Lampiran 3.
 *
 * Masalahnya: Mata Anggaran cuma memberi tahu "Akomodasi" atau "Permesinan",
 * padahal tiap MA punya beberapa judul kebutuhan (cleaning / perlengkapan /
 * alat keselamatan / suku cadang / service / lain-lain). Kalau semua dilempar
 * ke "Lain-Lain", berkas realisasi jadi tidak terbaca dan pusat sulit memeriksa.
 *
 * Urutan penentuan — dari yang paling bisa dipercaya:
 *   1. NAMA PENGADAAN. Satu paket biasanya punya satu maksud: "Paketisasi
 *      Perawatan Rutin Kebersihan Kapal Bagian Deck" = seisinya barang cleaning,
 *      walau ada "Jas Hujan" dan "Keset" yang kalau dibaca sendiri tak jelas.
 *   2. NAMA BARANG. Dipakai kalau nama pengadaannya netral ("Rutin Mesin Kapal
 *      Juni 2026") — barangnya sendiri yang bicara.
 *   3. LAIN-LAIN. Hanya kalau dua-duanya tak mengenali.
 *
 * Hasilnya tetap bisa dikoreksi manual lewat tombol ⇄ pada tiap baris.
 */
import { KELOMPOK_RR, kunciKelompok } from "./types";

interface Aturan {
  judul: string;      // harus sama persis dengan judul di KELOMPOK_RR
  dok?: RegExp;       // pola pada NAMA PENGADAAN
  item?: RegExp;      // pola pada NAMA BARANG / SPESIFIKASI
}

/** kata yang menandai jasa/pekerjaan (bukan barang) — dipakai beberapa MA */
const JASA = /jasa|servis|service|perbaikan|perbengkelan|bengkel|kalibrasi|overhaul|pengelasan|las\b|bubut|balancing|setting|pemasangan|instal|install|pengujian|tes\s|test\s|rekondisi|penggantian/i;

/**
 * Aturan per kode Mata Anggaran. URUTAN PENTING: yang lebih khusus di atas.
 * MA yang cuma punya satu judul tak perlu aturan — otomatis ke judul itu.
 */
const ATURAN: Record<string, Aturan[]> = {
  // ---------- Akomodasi, Peralatan & Perlengkapan Kapal ----------
  "5010403009": [
    {
      judul: "Cleaning dan Peralatan kerja",
      dok: /kebersihan|cleaning|bahan pembersih|alat kerja|peralatan kerja|paketisasi perawatan rutin/i,
      item: /deterjen|detergen|sabun|bayclin|bayclyn|baygon|bayfress|karbol|wipol|prostex|mama lemon|super pel|alat pel|\bpel\b|majun|kamfer|kemper|stela|pengharum|pewangi|tissue|tisu|plastik sampah|kantong sampah|tong sampah|sapu|serok|sikat|keset|gayung|ember|pembersih kaca|kanebo|kain lap|spons|sponge|jas hujan|sepatu boot|sarung tangan|masker|helm|kacamata safety|wearpack|senter kerja|kuas|rol cat|selang air/i,
    },
    {
      judul: "Pemeliharaan Alat Keselamatan dan Navigasi",
      dok: /keselamatan|safety|navigasi|life ?jacket|pemadam|smc|sertifikasi keselamatan|temuan smc/i,
      item: /life ?jacket|life ?buoy|lifebuoy|pelampung|rakit penolong|life ?raft|liferaft|sekoci|apar|pemadam|fire ?extinguish|hydrant|selang pemadam|nozzle pemadam|smoke signal|red hand|parachute signal|epirb|sart|radio|\bvhf\b|\bssb\b|\bgps\b|radar|kompas|compass|gyro|magnet|echo ?sounder|\bais\b|lampu navigasi|navigation light|suar|sirine|\bbell\b|megaphone|toa\b|senter darurat|lampu darurat/i,
    },
    {
      judul: "Pemeliharaan Peralatan Kapal",
      dok: /peralatan kapal|perlengkapan deck|peralatan deck|jangkar|rantai|wire|tali tross|tros|fender|rampdoor|ramp door/i,
      item: /jangkar|anchor|rantai|chain|wire rope|\bwire\b|tali tros|tali tross|\btros\b|tambang|fender|kuku macan|segel|shackle|turnbuckle|takal|winch|derek|capstan|rampdoor|ramp ?door|tangga|gangway|pokhout|chockfast|katrol/i,
    },
    {
      judul: "Pemeliharaan Perlengkapan kapal",
      dok: /perlengkapan|akomodasi|interior|hiburan|kursi|meja|ruang penumpang/i,
      item: /kursi|sofa|meja|hpl|triplek|plywood|pintu|handle|engsel|kunci|kaca ?film|riben|\bacp\b|list alumunium|list pvc|plafon|karpet|vinyl|tirai|gorden|kasur|bantal|sprei|toilet|kloset|wastafel|kran|shower|\btv\b|televisi|speaker|amplifier|antena|dispenser|kulkas|kipas|\bac\b|blower|cat\b|thinner|resin|serat fiber|katalis/i,
    },
    { judul: "Lain Lain" },
  ],

  // ---------- Permesinan & Kelistrikan Kapal ----------
  "5010403100": [
    {
      judul: "Cleaning dan Peralatan Kerja Mesin",
      dok: /kebersihan.*mesin|mesin.*kebersihan|cleaning.*mesin|alat kerja.*mesin|peralatan kerja.*mesin/i,
      item: /contak cleaner|kontak cleaner|contact cleaner|brake cleaner|degreaser|carbon remover|solar cleaner|majun|deterjen mesin|kuas\b|mata gerinda|amplas|gerinda potong|isolasi listrik|kabel ?ties|kabelties|klem\b|sarung tangan|kacamata las|apron las|masker las/i,
    },
    {
      judul: "Suku Cadang Permesinan",
      dok: /suku cadang|sparepart|spare ?part|\bsc\b|kelistrikan|modul listrik|pelistrikan/i,
      item: /piston|ring set|liner|cylinder|silinder|bearing|metal (jalan|duduk|conrod)|conrod|crank|camshaft|noken|klep|valve|injector|nozzle|\bfip\b|fuel pump|governor|turbo|impeller|water pump|radiator|heat exchanger|cooler|gasket|packing|seal|o.?ring|oring|filter|element|belt|\bv.?belt\b|pulley|bushing|bosh|pin\b|baut|bolt|mur\b|washer|selenoid|solenoid|sensor|sender|alternator|dinamo|starter|stater|aki\b|accu|batter[ai]|kabel|lampu|mcb\b|saklar|stop kontak|fitting|ballast|trafo|kontaktor|relay|breaker|busbar|panel listrik|inverter|charger/i,
    },
    {
      judul: "Service / Perbaikan Peralatan Permesinan",
      dok: JASA,
      item: JASA,
    },
    { judul: "Lain - Lain" },
  ],
};

const cocok = (re: RegExp | undefined, teks: string) => !!re && !!teks && re.test(teks);

export interface HasilPenempatan {
  kunci: string;                       // `${kode}|${judul}` — kosong bila MA di luar Lampiran 3
  judul: string;
  dasar: "dokumen" | "barang" | "tunggal" | "sisa";
}

/**
 * Tentukan kelompok Lampiran 3 untuk satu item tarikan.
 * @param kode        kode Mata Anggaran (mis. "5010403009")
 * @param namaDok     nama pengadaan (SPPBJ / Non PR PO)
 * @param namaItem    nama barang/jasa
 * @param spesifikasi spesifikasi item (ikut dibaca sebagai petunjuk)
 */
export function tentukanKelompok(kode: string, namaDok: string, namaItem: string, spesifikasi = ""): HasilPenempatan {
  const sub = KELOMPOK_RR.filter((k) => k.kode === kode);
  if (!sub.length) return { kunci: "", judul: "", dasar: "sisa" };

  // MA dengan satu judul saja: tak ada yang perlu ditebak
  if (sub.length === 1) return { kunci: kunciKelompok(sub[0]), judul: sub[0].judul, dasar: "tunggal" };

  const aturan = ATURAN[kode];
  const pakai = (judul: string, dasar: HasilPenempatan["dasar"]): HasilPenempatan => {
    const k = sub.find((x) => x.judul === judul) || sub[sub.length - 1];
    return { kunci: kunciKelompok(k), judul: k.judul, dasar };
  };

  if (aturan) {
    const dok = namaDok || "";
    const barang = `${namaItem || ""} ${spesifikasi || ""}`.trim();

    // 1. maksud PAKET dulu — satu pengadaan biasanya satu tujuan
    for (const a of aturan) if (cocok(a.dok, dok)) return pakai(a.judul, "dokumen");
    // 2. baru nama barangnya
    for (const a of aturan) if (cocok(a.item, barang)) return pakai(a.judul, "barang");
  }

  // 3. menyerah -> judul terakhir (selalu "Lain-Lain" pada kedua MA di atas)
  const akhir = sub[sub.length - 1];
  return { kunci: kunciKelompok(akhir), judul: akhir.judul, dasar: "sisa" };
}
