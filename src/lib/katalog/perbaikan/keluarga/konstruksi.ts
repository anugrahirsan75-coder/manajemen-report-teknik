/** Konstruksi badan kapal (plat, las, penguatan) dan pengecatan. */
import { Pola, KAWAT_LAS, OKSIGEN, ASETILEN, GERINDA, GERINDA_ASAH, AMPLAS, THINNER, MAJUN, UPAH } from "../pola";

/* ── plat & pengelasan ───────────────────────────────────────────────── */

const TEBAL = [4, 5, 6, 8, 10, 12, 14, 16].map((t) => ({ id: `t${t}`, nama: `${t} mm`, t }));

const LOKASI = [
  { id: "lbw", nama: "lambung bawah garis air", min: 8, klas: true, f: 1.35 },
  { id: "lat", nama: "lambung atas garis air", min: 6, klas: true, f: 1.15 },
  { id: "bootop", nama: "boottop", min: 6, klas: true, f: 1.15 },
  { id: "gutama", nama: "geladak utama", min: 6, klas: true, f: 1.1 },
  { id: "gkend", nama: "geladak kendaraan", min: 6, klas: true, f: 1.2 },
  { id: "kardek", nama: "dinding kardek", min: 4, klas: false, f: 1 },
  { id: "bulwark", nama: "bulwark", min: 4, klas: false, f: 1 },
  { id: "tballast", nama: "tangki ballast", min: 8, klas: true, f: 1.4 },
  { id: "tbbm", nama: "tangki bahan bakar", min: 8, klas: true, f: 1.5 },
  { id: "tair", nama: "tangki air tawar", min: 6, klas: true, f: 1.3 },
  { id: "rmesin", nama: "ruang mesin", min: 5, klas: false, f: 1.25 },
  { id: "batas", nama: "bangunan atas", min: 4, klas: false, f: 1 },
  { id: "ramp", nama: "ramp door", min: 8, klas: true, f: 1.45 },
  { id: "sekat", nama: "sekat kedap air", min: 6, klas: true, f: 1.3 },
  { id: "haluan", nama: "haluan", min: 6, klas: true, f: 1.3 },
  { id: "buritan", nama: "buritan", min: 6, klas: true, f: 1.3 },
  { id: "seachest", nama: "sea chest", min: 8, klas: true, f: 1.6 },
];

const KERJA_PLAT = [
  { id: "replat", nama: "Replating (ganti plat baru)", sat: "m2", kgm2: 7.85, f: 1, jam: 5 },
  { id: "doubling", nama: "Tambal doubling plat", sat: "m2", kgm2: 7.85, f: 0.8, jam: 4 },
  { id: "crop", nama: "Cropping dan renewal plat", sat: "m2", kgm2: 7.85, f: 1.1, jam: 6 },
  { id: "retak", nama: "Perbaikan retak (V-groove dan las penuh)", sat: "Titik", kgm2: 0.6, f: 1, jam: 3 },
  { id: "stiff", nama: "Pasang penguatan (stiffener)", sat: "Batang", kgm2: 12, f: 1, jam: 4 },
  { id: "gading", nama: "Ganti gading / frame", sat: "Batang", kgm2: 18, f: 1, jam: 8 },
  { id: "bracket", nama: "Ganti bracket dan knee plat", sat: "Unit", kgm2: 4, f: 1, jam: 3 },
  { id: "manhole", nama: "Ganti tutup manhole dan gasket", sat: "Unit", kgm2: 9, f: 1, jam: 4 },
];

/** harga plat baja kapal grade A per kg, sudah termasuk potong dan pengangkutan */
const PLAT_KG = 21_500;

export const POLA_PLAT: Pola[] = [{
  kode: "PLT",
  kategori: "Perbaikan — Las & Konstruksi",
  dimensi: { kj: KERJA_PLAT, lok: LOKASI, tb: TEBAL },
  sah: (v) =>
    v.tb.t >= v.lok.min &&
    // bangunan atas dan kardek tidak memakai plat tebal
    !(["batas", "kardek", "bulwark"].includes(v.lok.id) && v.tb.t > 8) &&
    // manhole dan sea chest hanya pada tangki/lambung
    !(v.kj.id === "manhole" && !v.lok.id.startsWith("t")) &&
    !(v.lok.id === "seachest" && ["stiff", "gading", "manhole"].includes(v.kj.id)),
  nama: (v) => `${v.kj.nama} ${v.tb.nama} — ${v.lok.nama}`,
  spek: (v) => {
    const klas = v.lok.klas ? ", dilaporkan ke surveyor klas sebelum ditutup" : "";
    if (v.kj.id === "retak") return `Ujung retak dibor stop hole, dialur V dan dilas penuh, diuji penetran${klas}`;
    if (v.kj.id === "manhole") return `Tutup dan gasket baru, diuji kedap dengan uji tekan air${klas}`;
    if (v.kj.id === "doubling") return `Plat doubling dilas keliling penuh, permukaan rata dan dicat dasar${klas}`;
    return `Plat baja kapal grade A tebal ${v.tb.nama}, las penuh, diuji kedap dan dicat dasar${klas}`;
  },
  satuan: (v) => v.kj.sat,
  // 7.85 kg/m2 tiap 1 mm tebal untuk baja; profil memakai berat per batangnya sendiri
  harga: (v) => v.kj.kgm2 * v.tb.t * PLAT_KG * v.lok.f * v.kj.f + (UPAH.tukang / 8) * v.kj.jam * v.lok.f * 2,
  bahan: (v) => [
    v.kj.id === "stiff" || v.kj.id === "gading"
      ? `Profil baja ${v.tb.nama} — baja kapal grade A, profil T/L sesuai gambar konstruksi`
      : `Plat baja ${v.tb.nama} — baja kapal grade A, bersertifikat klas`,
    KAWAT_LAS,
    v.tb.t >= 10 ? "Kawat las low hydrogen — AWS E7018, 3.2 mm, kemasan 5 kg" : undefined,
    OKSIGEN, ASETILEN, GERINDA, GERINDA_ASAH,
    v.kj.id === "manhole" ? "Gasket manhole — karet tahan minyak, tebal 5 mm" : undefined,
    "Cat dasar zinc chromate — 4 liter",
    v.lok.klas ? "Pengujian las (penetran/ultrasonik) — oleh pihak bersertifikat" : undefined,
  ],
}];

/* ── pengecatan ──────────────────────────────────────────────────────── */

const AREA_CAT = [
  { id: "bawah", nama: "lambung bawah garis air", f: 1.3, af: true, luar: true },
  { id: "boottop", nama: "boottop", f: 1.25, af: true, luar: true },
  { id: "topside", nama: "lambung atas garis air (topside)", f: 1.15, af: false, luar: true },
  { id: "gutama", nama: "geladak utama", f: 1.1, af: false, luar: true },
  { id: "gkend", nama: "geladak kendaraan", f: 1.2, af: false, luar: false },
  { id: "rmesin", nama: "ruang mesin", f: 1.35, af: false, luar: false },
  { id: "akomodasi", nama: "ruang akomodasi", f: 0.9, af: false, luar: false },
  { id: "tballast", nama: "tangki ballast", f: 1.6, af: false, luar: false },
  { id: "tair", nama: "tangki air tawar", f: 1.6, af: false, luar: false },
  { id: "bangunan", nama: "bangunan atas (superstructure)", f: 1.05, af: false, luar: true },
  { id: "ramp", nama: "ramp door", f: 1.3, af: false, luar: true },
  { id: "bulwark", nama: "bulwark", f: 1.1, af: false, luar: true },
  { id: "cerobong", nama: "cerobong asap", f: 1.4, af: false, luar: true },
  { id: "mark", nama: "marka lambung timbul dan sarat", f: 1.2, af: false, luar: true },
];

const SISTEM_CAT = [
  { id: "ac", nama: "cat dasar anti korosi (AC)", lt: 92_000, hanya: null as string[] | null },
  { id: "tie", nama: "tie coat", lt: 108_000, hanya: ["bawah", "boottop"] },
  { id: "af", nama: "cat antifouling (AF)", lt: 145_000, hanya: ["bawah", "boottop"] },
  { id: "epoksi", nama: "cat epoksi dua komponen", lt: 135_000, hanya: null },
  { id: "food", nama: "cat epoksi food grade", lt: 210_000, hanya: ["tair"] },
  { id: "enamel", nama: "cat marine enamel", lt: 88_000, hanya: null },
  { id: "panas", nama: "cat tahan panas 400 derajat", lt: 245_000, hanya: ["cerobong", "rmesin"] },
  { id: "selip", nama: "cat anti selip", lt: 165_000, hanya: ["gutama", "gkend", "ramp"] },
  { id: "marka", nama: "cat marka", lt: 125_000, hanya: ["gkend", "mark", "gutama"] },
  { id: "zinc", nama: "primer zinc silicate", lt: 185_000, hanya: null },
];

const LAPIS = [1, 2, 3].map((n) => ({ id: `l${n}`, nama: `${n} lapis`, n }));

export const POLA_CAT: Pola[] = [{
  kode: "CAT",
  kategori: "Perbaikan — Pengecatan",
  dimensi: { ar: AREA_CAT, sc: SISTEM_CAT, lp: LAPIS },
  sah: (v) => (v.sc.hanya ? v.sc.hanya.includes(v.ar.id) : true) &&
    // tangki bagian dalam tidak dicat enamel biasa
    !(v.ar.id.startsWith("t") && ["enamel", "ac"].includes(v.sc.id)),
  nama: (v) => `Pengecatan ${v.ar.nama} — ${v.sc.nama} ${v.lp.nama}`,
  spek: (v) =>
    `Permukaan dibersihkan dan kering, ${v.sc.nama} ${v.lp.nama}, ketebalan kering diukur dan dicatat`,
  satuan: () => "m2",
  // 1 liter cat menutup sekitar 8 m2 per lapis pada tebal kering standar
  harga: (v) => (v.sc.lt / 8) * v.lp.n * v.ar.f * 1.12 + (UPAH.tukang / 8) * 0.55 * v.lp.n * v.ar.f,
  bahan: (v) => [
    `${v.sc.nama[0].toUpperCase()}${v.sc.nama.slice(1)} — kemasan 20 liter, merek marine bersertifikat`,
    THINNER, AMPLAS,
    "Kuas, roller, dan peralatan semprot — sewa alat semprot airless",
    v.ar.luar ? "Perancah dan tali pengaman — sewa perancah" : "Ventilasi paksa dan penerangan kerja — blower portabel",
    MAJUN,
  ],
}];

const SIAP = [
  { id: "sa1", nama: "sandblasting SA 1 (sapuan ringan)", dasar: 78_000 },
  { id: "sa2", nama: "sandblasting SA 2 (bersih menyeluruh)", dasar: 112_000 },
  { id: "sa25", nama: "sandblasting SA 2.5 (hampir putih)", dasar: 148_000 },
  { id: "sa3", nama: "sandblasting SA 3 (logam putih)", dasar: 195_000 },
  { id: "wj", nama: "water jetting tekanan tinggi", dasar: 85_000 },
  { id: "uhp", nama: "water jetting UHP 2500 bar", dasar: 165_000 },
  { id: "scrap", nama: "scraping dan sikat kawat", dasar: 38_000 },
  { id: "spot", nama: "spot blasting setempat", dasar: 125_000 },
];

export const POLA_SIAP: Pola[] = [{
  kode: "BLS",
  kategori: "Perbaikan — Pengecatan",
  dimensi: { sp: SIAP, ar: AREA_CAT },
  sah: (v) => !(["sa3", "uhp"].includes(v.sp.id) && !["bawah", "boottop", "tballast", "tair"].includes(v.ar.id)),
  nama: (v) => `Persiapan permukaan ${v.sp.nama} — ${v.ar.nama}`,
  spek: (v) => `Permukaan mencapai derajat kebersihan ${v.sp.nama.toUpperCase()}, kekasaran dan kebersihan diperiksa sebelum dicat`,
  satuan: () => "m2",
  harga: (v) => v.sp.dasar * v.ar.f,
  bahan: (v) => [
    v.sp.id.startsWith("sa") || v.sp.id === "spot"
      ? "Pasir silika / steel grit — sesuai derajat kebersihan, karung 50 kg"
      : "Air bersih bertekanan — pompa dan selang tekanan tinggi",
    "Kompresor dan mesin blasting — sewa alat lengkap operator",
    "Alat pelindung diri — helm blasting, sarung tangan, sepatu",
    v.ar.luar ? "Terpal penutup dan perancah — sewa" : "Blower dan penerangan kerja — portabel",
    MAJUN,
  ],
}];
