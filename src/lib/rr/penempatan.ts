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
/*
 * "las\\b" sengaja DIBUANG, yang dipakai hanya "pengelasan".
 *
 * Kata "las" jauh lebih sering menyebut BAHAN daripada pekerjaannya —
 * kawat las, travo las, kaca mata las, apron las, masker las. Dengan pola
 * selonggar itu, sekardus kawat las tercatat sebagai jasa pengelasan dan
 * kelompok Service terisi barang habis pakai.
 */
const JASA = /jasa|servis|service|perbaikan|perbengkelan|bengkel|kalibrasi|overhaul|pengelasan|bubut|balancing|setting|pemasangan|instal|install|pengujian|tes\s|test\s|rekondisi|penggantian/i;

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
      item: /contak cleaner|kontak cleaner|contact cleaner|brake cleaner|degreaser|carbon remover|solar cleaner|majun|deterjen mesin|kuas\b|mata gerinda|amplas|gerinda potong|isolasi listrik|kabel ?ties|kabelties|klem\b|sarung tangan|kacamata las|apron las|masker las|kawat las|elektroda|travo las|mesin las|mata gergaji|kunci pas|kunci ring|tang\b|obeng|palu\b|tespen|wd.?40|\blem\b|sealtip|silicon|asbes/i,
    },
    /*
     * JASA DIPERIKSA SEBELUM SUKU CADANG, dan urutannya memang itu yang
     * menentukan hasilnya.
     *
     * Hampir setiap pekerjaan jasa menyebut benda yang dikerjakannya —
     * "Rekondisi rumah filter bbm ME", "Service dinamo starter", "Perbaikan
     * pompa pendingin". Selama Suku Cadang diperiksa lebih dulu, kata
     * "filter", "dinamo", dan "pompa" menangkapnya duluan, dan kelompok
     * Service berakhir NOL di setiap rencana yang terbit — persis seperti
     * pada RENCANA Oktober 2026, yang seluruh isinya menumpuk di Cleaning
     * dan dua kelompok lainnya kosong.
     */
    {
      judul: "Service / Perbaikan Peralatan Permesinan",
      dok: JASA,
      item: JASA,
    },
    {
      judul: "Suku Cadang Permesinan",
      dok: /suku cadang|sparepart|spare ?part|\bsc\b|kelistrikan|modul listrik|pelistrikan/i,
      item: /piston|ring set|liner|cylinder|silinder|bearing|metal (jalan|duduk|conrod)|conrod|crank|camshaft|noken|klep|valve|injector|nozzle|\bfip\b|fuel pump|governor|turbo|impeller|water pump|radiator|heat exchanger|cooler|gasket|packing|seal|o.?ring|oring|filter|element|belt|\bv.?belt\b|pulley|bushing|bosh|pin\b|baut|bolt|mur\b|washer|selenoid|solenoid|sensor|sender|alternator|dinamo|starter|stater|aki\b|accu|batter[ai]|kabel|lampu|mcb\b|saklar|stop kontak|fitting|ballast|trafo|kontaktor|relay|breaker|busbar|panel listrik|inverter|charger/i,
    },
    { judul: "Lain - Lain" },
  ],
};

const cocok = (re: RegExp | undefined, teks: string) => !!re && !!teks && re.test(teks);

/**
 * Batas atas satu baris suku cadang pada rencana RUTIN.
 *
 * Di atas sepuluh juta barangnya masuk INVESTASI, mata anggaran yang berbeda
 * dan jalur persetujuannya sendiri. Barang semahal itu yang nyasar ke rencana
 * rutin membuat pagu rutin terpakai untuk sesuatu yang semestinya tidak
 * dibebankan ke sana.
 */
export const BATAS_SUKU_CADANG = 10_000_000;

/**
 * Punya nomor part?
 *
 * Suku cadang yang sungguhan selalu dikenali oleh nomornya — bearing 6206,
 * V-belt A-53, kawat las RB26 2,6 mm, packing klingrit 3 mm. Yang disebut
 * tanpa nomor ("filter oli", "seal pompa") belum menunjuk barang tertentu:
 * itu kategori, bukan barang, dan tidak bisa dipesan apa adanya.
 *
 * Yang dihitung sebagai nomor: nomor part yang ditulis terang-terangan
 * (P/N, Part No), angka berdempetan huruf (A-53, RB26, 6SD1), ukuran
 * bernomor (3 MM, 2,6 mm, 1 inch), atau angka tiga digit ke atas (6206).
 * Angka satu-dua digit sengaja TIDAK dihitung — "Lampu 10 Watt" dan "Kunci
 * Pas 17" bukan nomor part, melainkan ukuran sehari-hari.
 */
/**
 * NOMOR PART = kode pabrikan, bukan ukuran barang.
 *
 * Bentuk yang benar-benar dipakai, terbaca dari kolom Spesifikasi pada
 * rencana yang sudah terbit dan dari 416 baris bernomor part di database
 * pengadaan:
 *
 *     129150-49360      Gasket
 *     124465-44950      Gasket , 16
 *     24316-000140      Oring 4DP14.0
 *     119005-35170      Filter LO
 *     PN : 3926723      Bearing, crankshaft thrust
 *     DLLA155P277       Nozzle Bosch
 *     DJ51297           Ring Piston
 *     USME0003          Crank Pin Bearing
 *
 * YANG BUKAN NOMOR PART, dan inilah yang selama ini salah tertangkap:
 * "V-Belt B-51", "Van-belt A-34", "Bearing 6309", "Packing Karet 2 mm".
 * Semua itu UKURAN — panjang sabuk, diameter laher, tebal paking. Barangnya
 * nyata, tetapi ia tidak menunjuk satu kode pabrikan, jadi tempatnya bukan
 * Suku Cadang.
 *
 * Aturannya: angka harus PANJANG (enam digit ke atas, atau dua gugus dipisah
 * tanda hubung), atau menempel pada huruf kapital berderet seperti kode
 * katalog. Angka pendek — 51, 34, 6309, 2 mm — tidak pernah cukup.
 */
const NOMOR_PART = [
  /\b(?:p\s*\/?\s*n|part\s*(?:no|number)|kode)\b\s*:?\s*[a-z0-9-]{4,}/i,
  /\b\d{4,}\s*-\s*\d{3,}\b/,              // 129150-49360, 24316-000140
  /\b\d{6,}\b/,                            // 3926723
  /\b[a-z]{2,}\d{3,}[a-z0-9.-]*\b/i,       // DLLA155P277, DJ51297, USME0003
  /\b\d{2,}[a-z]{2,}\d{3,}\b/i,            // 19001-901 gaya lain
];

/**
 * Punya nomor part?
 *
 * Spesifikasi diperiksa LEBIH DULU dan lebih dipercaya: di sanalah nomor part
 * ditulis pada rencana yang terbit, sedangkan kolom Deskripsi memuat nama
 * barangnya. Keduanya tetap diperiksa — sebagian dokumen menulis nomornya
 * menyatu dengan nama.
 */
export const punyaNomorPart = (teks: string): boolean =>
  !!teks && NOMOR_PART.some((re) => re.test(teks));


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
export function tentukanKelompok(
  kode: string, namaDok: string, namaItem: string, spesifikasi = "", harga = 0,
): HasilPenempatan {
  const sub = KELOMPOK_RR.filter((k) => k.kode === kode);
  if (!sub.length) return { kunci: "", judul: "", dasar: "sisa" };

  // MA dengan satu judul saja: tak ada yang perlu ditebak
  if (sub.length === 1) return { kunci: kunciKelompok(sub[0]), judul: sub[0].judul, dasar: "tunggal" };

  const aturan = ATURAN[kode];
  const barangLengkap = `${namaItem || ""} ${spesifikasi || ""}`.trim();

  /**
   * Tempat jatuh barang yang bukan jasa dan bukan suku cadang bernomor.
   *
   * Bukan "Lain-Lain", melainkan kelompok CLEANING & PERALATAN KERJA milik
   * Mata Anggaran itu. Begitulah rencana yang sudah terbit menyusunnya: pada
   * RENCANA Oktober 2026, lampu LED, MCB, V-belt, gasket, kunci pas, dan
   * travo las semuanya berada di Cleaning dan Peralatan Kerja Mesin, sedangkan
   * Lain-Lain kosong. Lain-Lain yang terisi belasan baris adalah tanda
   * penggolongan yang menyerah, bukan golongan yang sebenarnya.
   */
  const turunKeCleaning = (): HasilPenempatan => {
    const bersih = sub.find((x) => /cleaning|peralatan kerja/i.test(x.judul));
    const k = bersih || sub[sub.length - 1];
    return { kunci: kunciKelompok(k), judul: k.judul, dasar: "sisa" };
  };

  const pakai = (judul: string, dasar: HasilPenempatan["dasar"]): HasilPenempatan => {
    /*
     * SUKU CADANG punya dua syarat yang tidak dimiliki kelompok lain.
     *
     * Harus punya NOMOR PART: tanpa nomor, yang tertulis baru kategori
     * ("filter oli", "seal pompa"), bukan barang yang bisa dipesan.
     *
     * Harus di bawah SEPULUH JUTA: di atas itu barangnya investasi, mata
     * anggaran lain dengan jalur persetujuan sendiri.
     *
     * Yang tak memenuhi tidak dibuang — ia turun ke Lain-Lain, tetap di Mata
     * Anggaran yang sama. Membuangnya berarti kebutuhan nyata kapal hilang
     * dari rencana hanya karena namanya ditulis kurang lengkap.
     */
    if (/suku cadang/i.test(judul)
      && (!punyaNomorPart(barangLengkap) || (harga > 0 && harga > BATAS_SUKU_CADANG))) {
      return turunKeCleaning();
    }
    const k = sub.find((x) => x.judul === judul) || sub[sub.length - 1];
    return { kunci: kunciKelompok(k), judul: k.judul, dasar };
  };

  if (aturan) {
    const dok = namaDok || "";
    const barang = barangLengkap;

    // 1. maksud PAKET dulu — satu pengadaan biasanya satu tujuan
    for (const a of aturan) if (cocok(a.dok, dok)) return pakai(a.judul, "dokumen");
    // 2. baru nama barangnya
    for (const a of aturan) if (cocok(a.item, barang)) return pakai(a.judul, "barang");
  }

  // 3. menyerah -> Cleaning & Peralatan Kerja, bukan Lain-Lain
  if (aturan) return turunKeCleaning();
  const akhir = sub[sub.length - 1];
  return { kunci: kunciKelompok(akhir), judul: akhir.judul, dasar: "sisa" };
}
