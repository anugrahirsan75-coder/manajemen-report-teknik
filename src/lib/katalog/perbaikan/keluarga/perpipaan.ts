/** Perpipaan, katup, dan pompa — sistem air laut, air tawar, bahan bakar, pemadam. */
import { Pola, SEAL_TAPE, KAWAT_LAS, KAWAT_LAS_SS, OKSIGEN, GERINDA, CAT_BESI, MAJUN, UPAH } from "../pola";

/* ── pipa ─────────────────────────────────────────────────────────────── */

/** harga per BATANG 6 m untuk pipa GIP tebal dinding sedang; bahan lain dikali faktor */
const UKURAN = [
  { id: "05", label: "1/2 inci", mm: 15, batang: 38_000 },
  { id: "075", label: "3/4 inci", mm: 20, batang: 52_000 },
  { id: "1", label: "1 inci", mm: 25, batang: 72_000 },
  { id: "125", label: "1 1/4 inci", mm: 32, batang: 96_000 },
  { id: "15", label: "1 1/2 inci", mm: 40, batang: 118_000 },
  { id: "2", label: "2 inci", mm: 50, batang: 165_000 },
  { id: "25", label: "2 1/2 inci", mm: 65, batang: 235_000 },
  { id: "3", label: "3 inci", mm: 80, batang: 310_000 },
  { id: "4", label: "4 inci", mm: 100, batang: 430_000 },
  { id: "5", label: "5 inci", mm: 125, batang: 590_000 },
  { id: "6", label: "6 inci", mm: 150, batang: 760_000 },
  { id: "8", label: "8 inci", mm: 200, batang: 1_150_000 },
];

const BAHAN_PIPA = [
  { id: "gip", nama: "GIP galvanis", spek: "SNI, tebal dinding sedang, tekanan kerja 10 bar, berulir, batang 6 m", f: 1, las: true, maks: 200 },
  { id: "pvc", nama: "PVC", spek: "tekanan kerja 10 bar (tipe AW), SNI, batang 4 m", f: 0.35, las: false, maks: 200 },
  { id: "ppr", nama: "PPR", spek: "tekanan kerja 10 bar, tahan air panas sampai 70 derajat C, batang 4 m", f: 0.8, las: false, maks: 100 },
  { id: "ss", nama: "stainless 304", spek: "stainless SUS 304, tebal dinding 3 mm, batang 6 m", f: 3.2, las: true, maks: 150 },
  { id: "cu", nama: "tembaga", spek: "tembaga lunak, tebal dinding 0.9 mm", f: 4, las: false, maks: 40 },
  { id: "hdpe", nama: "HDPE", spek: "PE100, tekanan kerja 10 bar, roll", f: 0.55, las: false, maks: 200 },
  { id: "bh", nama: "besi hitam", spek: "baja tanpa sambungan, tebal dinding standar (sch 40), batang 6 m", f: 0.9, las: true, maks: 200 },
];

const SISTEM = [
  { id: "ptw", nama: "air tawar", spek: "air bersih, tekanan kerja 4 bar" },
  { id: "pal", nama: "air laut", spek: "air laut, tahan korosi, tekanan kerja 4 bar" },
  { id: "pmd", nama: "pemadam", spek: "sistem pemadam, tekanan kerja 8 bar" },
  { id: "bbm", nama: "bahan bakar", spek: "sistem bahan bakar, tahan solar, tekanan kerja 6 bar" },
  { id: "bng", nama: "buangan", spek: "saluran buangan gravitasi, kemiringan minimal 1%" },
  { id: "bls", nama: "ballast", spek: "sistem ballast, tekanan kerja 4 bar" },
  { id: "hid", nama: "hidrolik", spek: "sistem hidrolik, tekanan kerja 210 bar" },
];

const KERJA_PIPA = [
  { id: "ganti", nama: "Ganti jalur pipa", sat: "m", f: 1.3, upah: 0.9 },
  { id: "baru", nama: "Pasang jalur pipa baru", sat: "m", f: 1.25, upah: 0.75 },
  { id: "bocor", nama: "Perbaikan dan pengelasan titik bocor pipa", sat: "Titik", f: 0.5, upah: 0.6 },
  { id: "klem", nama: "Ganti klem dan penggantung pipa", sat: "Titik", f: 0.15, upah: 0.25 },
  { id: "uji", nama: "Uji tekan jalur pipa", sat: "Jalur", f: 0.1, upah: 1.2 },
  { id: "isol", nama: "Pasang isolasi jalur pipa", sat: "m", f: 0.45, upah: 0.4 },
];

const perM = (v: any) => (v.uk.batang * v.bhn.f) / 6;

export const POLA_PIPA: Pola[] = [{
  kode: "PIP",
  kategori: "Perbaikan — Perpipaan",
  dimensi: { bhn: BAHAN_PIPA, uk: UKURAN, sis: SISTEM, kj: KERJA_PIPA },
  sah: (v) =>
    v.uk.mm <= v.bhn.maks &&
    // pengelasan hanya untuk pipa logam yang memang dilas
    !(v.kj.id === "bocor" && !v.bhn.las) &&
    // hidrolik memakai pipa/selang tekanan tinggi saja
    !(v.sis.id === "hid" && !["bh", "ss"].includes(v.bhn.id)) &&
    // bahan bakar tidak dijalankan dengan PVC/PPR
    !(v.sis.id === "bbm" && ["pvc", "ppr"].includes(v.bhn.id)) &&
    // buangan gravitasi praktis selalu PVC/HDPE dan minimal 2 inci
    !(v.sis.id === "bng" && (!["pvc", "hdpe"].includes(v.bhn.id) || v.uk.mm < 50)) &&
    // air tawar minum tidak memakai besi hitam
    !(v.sis.id === "ptw" && v.bhn.id === "bh") &&
    // isolasi hanya untuk pipa air panas/bahan bakar berdiameter layak
    !(v.kj.id === "isol" && (v.uk.mm < 25 || !["ptw", "bbm", "hid"].includes(v.sis.id))),
  nama: (v) => `${v.kj.nama} ${v.bhn.nama} ${v.uk.label} — sistem ${v.sis.nama}`,
  spek: (v) => {
    if (v.kj.id === "uji") return `Jalur diuji 1.5x tekanan kerja selama 30 menit tanpa penurunan, ${v.sis.spek}`;
    if (v.kj.id === "bocor") return "Bagian bocor digerinda dan dilas penuh, diuji tidak merembes pada tekanan kerja";
    if (v.kj.id === "klem") return "Klem terpasang tiap 1 m, pipa tidak bergetar dan tidak melendut";
    if (v.kj.id === "isol") return "Isolasi rapat tanpa celah, dibungkus pelindung dan diberi penanda arah aliran";
    return `Jalur lurus dan diklem tiap 1 m, sambungan rapat, diuji tanpa bocor — ${v.sis.spek}`;
  },
  satuan: (v) => v.kj.sat,
  harga: (v) => perM(v) * v.kj.f + (UPAH.tukang / 8) * (1 + v.uk.mm / 55) * v.kj.upah * 2.2,
  bahan: (v) => {
    const pipa = `Pipa ${v.bhn.nama} ${v.uk.label} — ${v.bhn.spek}`;
    if (v.kj.id === "uji") return [
      "Air pengujian dan pompa uji tekan — pompa tangan lengkap manometer",
      "Blind flange dan gasket penyumbat — sesuai diameter jalur",
      MAJUN,
    ];
    if (v.kj.id === "klem") return [
      `Klem pipa ${v.uk.label} — klem U galvanis lengkap karet peredam`,
      "Baut dan mur — M10 galvanis, lengkap ring",
      CAT_BESI,
    ];
    if (v.kj.id === "isol") return [
      `Isolasi pipa ${v.uk.label} — busa elastomer tebal 19 mm`,
      "Aluminium foil tape — lebar 50 mm, roll 45 m",
      "Penanda arah aliran — stiker vinyl tahan cuaca",
    ];
    if (v.kj.id === "bocor") return [
      `Plat/pipa tambalan ${v.uk.label} — ${v.bhn.spek}`,
      v.bhn.id === "ss" ? KAWAT_LAS_SS : KAWAT_LAS, OKSIGEN, GERINDA,
    ];
    return [
      pipa,
      `Sambungan ${v.bhn.nama} ${v.uk.label} — elbow, sok, dan tee sesuai jalur`,
      v.bhn.las ? (v.bhn.id === "ss" ? KAWAT_LAS_SS : KAWAT_LAS) : "Lem/perekat sambungan — sesuai bahan pipa, kemasan 100 gram",
      v.bhn.las ? OKSIGEN : SEAL_TAPE,
      `Klem pipa ${v.uk.label} — klem U galvanis lengkap karet peredam`,
      v.bhn.las ? CAT_BESI : undefined,
    ];
  },
}];

/* ── katup & kran ─────────────────────────────────────────────────────── */

const KATUP = [
  { id: "gate", nama: "gate valve", spek: "badan kuningan/besi cor, berulir, tekanan kerja 16 bar", f: 1, min: 15, maks: 200 },
  { id: "globe", nama: "globe valve", spek: "badan besi cor, sambungan flens, tekanan kerja 16 bar", f: 1.35, min: 20, maks: 150 },
  { id: "ball", nama: "ball valve", spek: "badan kuningan, bola stainless, tekanan kerja 25 bar", f: 0.9, min: 15, maks: 100 },
  { id: "bfly", nama: "butterfly valve", spek: "pasang sisip (wafer), cakram stainless, dudukan karet EPDM, tekanan kerja 10 bar", f: 0.8, min: 50, maks: 300 },
  { id: "check", nama: "check valve", spek: "daun ayun, badan besi cor, tekanan kerja 16 bar", f: 1.1, min: 20, maks: 200 },
  { id: "foot", nama: "foot valve", spek: "lengkap saringan kuningan, tekanan kerja 10 bar", f: 1.2, min: 40, maks: 150 },
  { id: "relief", nama: "safety relief valve", spek: "bersertifikat, tekanan buka disetel sesuai sistem", f: 3.2, min: 15, maks: 100 },
  { id: "kran", nama: "kran taman", spek: "kuningan krom, drat dalam", f: 0.35, min: 15, maks: 25 },
  { id: "hid", nama: "kran hidran", spek: "kuningan, kopling machino, tekanan kerja 16 bar", f: 1.4, min: 40, maks: 65 },
  { id: "strain", nama: "saringan Y (strainer)", spek: "badan besi cor, elemen saring stainless lubang 0,4 mm", f: 1.15, min: 20, maks: 200 },
  { id: "seaco", nama: "sea chest valve", spek: "badan perunggu, tahan air laut, tekanan kerja 16 bar, bersertifikat klas", f: 2.6, min: 50, maks: 300 },
];

const KERJA_KATUP = [
  { id: "ganti", nama: "Ganti", f: 1, upah: 1 },
  { id: "skir", nama: "Skir dan perbaikan dudukan", f: 0.12, upah: 1.4 },
  { id: "packing", nama: "Ganti packing dan gland", f: 0.1, upah: 0.8 },
  { id: "uji", nama: "Bongkar, uji tekan, dan pasang kembali", f: 0.08, upah: 1.6 },
];

const hargaKatup = (v: any) => (v.uk.batang * 0.55 + 85_000) * v.kt.f * (1 + v.uk.mm / 260);

export const POLA_KATUP: Pola[] = [{
  kode: "KTP",
  kategori: "Perbaikan — Katup & Kran",
  dimensi: { kt: KATUP, uk: UKURAN, kj: KERJA_KATUP },
  sah: (v) => v.uk.mm >= v.kt.min && v.uk.mm <= v.kt.maks &&
    // kran kecil dan relief valve tidak diskir, langsung ganti
    !(["kran", "relief"].includes(v.kt.id) && ["skir", "packing"].includes(v.kj.id)),
  nama: (v) => `${v.kj.nama} ${v.kt.nama} ${v.uk.label}`,
  spek: (v) => {
    if (v.kj.id === "skir") return "Dudukan dan cakram diskir sampai rata, diuji tidak melewatkan air saat tertutup";
    if (v.kj.id === "packing") return "Packing gland diganti, tangkai tidak merembes saat katup dibuka penuh";
    if (v.kj.id === "uji") return "Katup diuji pada 1.5x tekanan kerja, dipasang kembali dan diuji buka tutup penuh";
    return `Katup baru terpasang, ${v.kt.spek}, diuji tidak bocor pada tekanan kerja`;
  },
  satuan: () => "Unit",
  harga: (v) => hargaKatup(v) * (v.kj.id === "ganti" ? 1 : v.kj.f + 0.15) + (UPAH.tukang / 8) * 3 * v.kj.upah,
  bahan: (v) => v.kj.id === "ganti" ? [
    `${v.kt.nama[0].toUpperCase()}${v.kt.nama.slice(1)} ${v.uk.label} — ${v.kt.spek}`,
    `Gasket dan baut flens ${v.uk.label} — gasket karet tahan minyak, baut galvanis`,
    SEAL_TAPE, MAJUN,
  ] : v.kj.id === "skir" ? [
    "Pasta skir (grinding paste) — kasar dan halus, 100 gram",
    `Gasket dan packing ${v.uk.label} — sesuai tipe katup`,
    MAJUN,
  ] : v.kj.id === "packing" ? [
    "Gland packing — serat grafit, ukuran sesuai tangkai katup",
    "Gemuk tahan air (grease) — lithium EP2, tahan air laut, 1 kg",
    MAJUN,
  ] : [
    "Gasket flens — karet tahan minyak, sesuai diameter",
    "Air pengujian dan pompa uji tekan — pompa tangan lengkap manometer",
    MAJUN,
  ],
}];

/* ── pompa ────────────────────────────────────────────────────────────── */

const POMPA = [
  { id: "cal", nama: "pompa air laut sentrifugal", dasar: 6_500_000 },
  { id: "catw", nama: "pompa air tawar sentrifugal", dasar: 5_200_000 },
  { id: "self", nama: "pompa self priming", dasar: 7_400_000 },
  { id: "subm", nama: "pompa celup (submersible)", dasar: 4_800_000 },
  { id: "gear", nama: "pompa roda gigi (gear pump) minyak lumas", dasar: 8_600_000 },
  { id: "bilge", nama: "pompa got (bilge pump)", dasar: 9_200_000 },
  { id: "bal", nama: "pompa ballast", dasar: 14_500_000 },
  { id: "gs", nama: "pompa general service", dasar: 11_800_000 },
  { id: "san", nama: "pompa sanitary / hidrofor", dasar: 6_900_000 },
  { id: "bbm", nama: "pompa transfer bahan bakar", dasar: 8_900_000 },
  { id: "sludge", nama: "pompa lumpur (sludge pump)", dasar: 10_400_000 },
  { id: "fire", nama: "pompa pemadam utama", dasar: 18_500_000 },
  { id: "emfire", nama: "pompa pemadam darurat", dasar: 15_200_000 },
  { id: "jockey", nama: "pompa jockey", dasar: 5_600_000 },
  { id: "hyd", nama: "pompa hidrolik", dasar: 16_800_000 },
];

const KELAS = [
  { id: "k", nama: "kapasitas kecil (sampai 5 m3/jam)", f: 0.7 },
  { id: "s", nama: "kapasitas sedang (5–20 m3/jam)", f: 1 },
  { id: "b", nama: "kapasitas besar (di atas 20 m3/jam)", f: 1.7 },
];

const KERJA_POMPA = [
  { id: "ganti", nama: "Ganti unit", f: 1, jam: 8, kelas: true },
  { id: "over", nama: "Overhaul", f: 0.34, jam: 22, kelas: true },
  { id: "uji", nama: "Uji kapasitas dan tekanan", f: 0.04, jam: 6, kelas: true },
  { id: "seal", nama: "Ganti mechanical seal", f: 0.13, jam: 10, kelas: false },
  { id: "imp", nama: "Ganti impeller", f: 0.22, jam: 10, kelas: false },
  { id: "bear", nama: "Ganti bantalan (bearing)", f: 0.11, jam: 9, kelas: false },
  { id: "kop", nama: "Ganti kopling dan karet kopling", f: 0.12, jam: 6, kelas: false },
  { id: "align", nama: "Pelurusan (alignment) pompa dan motor", f: 0.03, jam: 8, kelas: false },
];

export const POLA_POMPA: Pola[] = [{
  kode: "PMP",
  kategori: "Perbaikan — Pompa",
  dimensi: { pm: POMPA, kj: KERJA_POMPA, kls: KELAS },
  // kapasitas hanya membedakan harga pada pekerjaan yang menyentuh seluruh unit
  sah: (v) => v.kj.kelas || v.kls.id === "s",
  nama: (v) => `${v.kj.nama} ${v.pm.nama}${v.kj.kelas ? ` — ${v.kls.nama}` : ""}`,
  spek: (v) => {
    if (v.kj.id === "uji") return "Kapasitas dan tekanan diukur pada putaran kerja, hasil dicatat dalam berita acara";
    if (v.kj.id === "align") return "Penyimpangan sumbu maksimal 0.05 mm, hasil pengukuran dilampirkan";
    if (v.kj.id === "over") return "Seluruh bagian dibongkar, diukur, aus diganti, diuji jalan 2 jam tanpa panas berlebih";
    return "Unit dipasang pada dudukan semula, diuji jalan tanpa bocor, getaran, dan panas berlebih";
  },
  satuan: () => "Unit",
  harga: (v) => v.pm.dasar * v.kj.f * (v.kj.kelas ? v.kls.f : 1) + (UPAH.teknisi / 8) * v.kj.jam,
  bahan: (v) => {
    if (v.kj.id === "ganti") return [
      `${v.pm.nama[0].toUpperCase()}${v.pm.nama.slice(1)} — ${v.kls.nama}, lengkap motor penggerak dan dudukan`,
      "Gasket dan baut dudukan — gasket tahan minyak, baut stainless",
      "Mechanical seal cadangan — sesuai tipe pompa", MAJUN,
    ];
    if (v.kj.id === "over") return [
      "Mechanical seal — sesuai tipe dan diameter poros pompa",
      "Bantalan (bearing) — sepasang, sesuai nomor pabrikan",
      "Gasket dan O-ring lengkap — satu set sesuai tipe pompa",
      "Wear ring — sesuai diameter impeller",
      "Oli dan gemuk pelumas — SAE 90 dan grease EP2", MAJUN,
    ];
    if (v.kj.id === "seal") return ["Mechanical seal — sesuai tipe dan diameter poros pompa", "O-ring dan gasket dudukan seal", MAJUN];
    if (v.kj.id === "imp") return ["Impeller — sesuai tipe dan diameter pompa", "Kunci impeller dan mur pengunci", "Gasket rumah pompa", MAJUN];
    if (v.kj.id === "bear") return ["Bantalan (bearing) — sepasang, sesuai nomor pabrikan", "Gemuk (grease) — lithium EP2, tahan sampai 130 derajat C, 1 kg", "Seal poros — sesuai diameter", MAJUN];
    if (v.kj.id === "kop") return ["Kopling fleksibel — sesuai daya dan diameter poros", "Karet kopling (rubber element) — satu set", "Baut dan mur kopling — baja kuat tarik 800 N/mm2"];
    if (v.kj.id === "align") return ["Shim plat pelurusan — stainless 0.05–1 mm, satu set", "Dial indicator dan alat ukur — sewa alat", MAJUN];
    return ["Alat ukur tekanan dan debit — manometer dan flow meter tera", "Air pengujian dan sambungan uji", MAJUN];
  },
}];
