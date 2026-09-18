/** Permesinan, propulsi, kemudi, dan perlengkapan geladak. */
import { Pola, KAWAT_LAS, OKSIGEN, GERINDA, CAT_BESI, MAJUN, UPAH } from "../pola";

/* ── mesin induk & mesin bantu ───────────────────────────────────────── */

const UNIT_MESIN = [
  { id: "mi-ka", nama: "Mesin Induk kanan", f: 1.35 },
  { id: "mi-ki", nama: "Mesin Induk kiri", f: 1.35 },
  { id: "ab-1", nama: "Mesin Bantu 1", f: 1 },
  { id: "ab-2", nama: "Mesin Bantu 2", f: 1 },
  { id: "ab-3", nama: "Mesin Bantu 3", f: 1 },
  { id: "ab-dar", nama: "Mesin Bantu Darurat", f: 0.9 },
];

const KOMPONEN = [
  { id: "head", nama: "cylinder head", dasar: 18_500_000, sat: "Unit", kerja: ["ganti", "over", "uji", "bersih"] },
  { id: "piston", nama: "piston", dasar: 12_400_000, sat: "Unit", kerja: ["ganti", "over", "bersih"] },
  { id: "ring", nama: "ring piston", dasar: 3_850_000, sat: "Set", kerja: ["ganti"] },
  { id: "liner", nama: "cylinder liner", dasar: 9_600_000, sat: "Unit", kerja: ["ganti", "bersih"] },
  { id: "mbear", nama: "bantalan utama (main bearing)", dasar: 6_800_000, sat: "Set", kerja: ["ganti"] },
  { id: "cbear", nama: "bantalan engkol (con-rod bearing)", dasar: 4_900_000, sat: "Set", kerja: ["ganti"] },
  { id: "crank", nama: "poros engkol (crankshaft)", dasar: 145_000_000, sat: "Unit", kerja: ["ganti", "over"] },
  { id: "conrod", nama: "batang torak (connecting rod)", dasar: 16_500_000, sat: "Unit", kerja: ["ganti", "over"] },
  { id: "injektor", nama: "injektor bahan bakar", dasar: 3_200_000, sat: "Unit", kerja: ["ganti", "kalib", "uji", "bersih"] },
  { id: "pinj", nama: "pompa injeksi bahan bakar", dasar: 22_500_000, sat: "Unit", kerja: ["ganti", "over", "kalib"] },
  { id: "turbo", nama: "turbocharger", dasar: 48_000_000, sat: "Unit", kerja: ["ganti", "over", "bersih"] },
  { id: "inter", nama: "intercooler / aftercooler", dasar: 16_800_000, sat: "Unit", kerja: ["ganti", "bersih", "uji"] },
  { id: "kisap", nama: "katup isap", dasar: 1_450_000, sat: "Unit", kerja: ["ganti", "skir"] },
  { id: "kbuang", nama: "katup buang", dasar: 1_750_000, sat: "Unit", kerja: ["ganti", "skir"] },
  { id: "gasket", nama: "gasket cylinder head", dasar: 2_400_000, sat: "Set", kerja: ["ganti"] },
  { id: "rocker", nama: "rocker arm dan pushrod", dasar: 4_200_000, sat: "Set", kerja: ["ganti", "over"] },
  { id: "cam", nama: "camshaft", dasar: 32_000_000, sat: "Unit", kerja: ["ganti", "over"] },
  { id: "timing", nama: "timing gear", dasar: 14_500_000, sat: "Set", kerja: ["ganti", "over"] },
  { id: "poli", nama: "pompa minyak lumas mesin", dasar: 11_200_000, sat: "Unit", kerja: ["ganti", "over", "uji"] },
  { id: "plaut", nama: "pompa air laut pendingin mesin", dasar: 8_600_000, sat: "Unit", kerja: ["ganti", "over"] },
  { id: "ptawar", nama: "pompa air tawar pendingin mesin", dasar: 7_800_000, sat: "Unit", kerja: ["ganti", "over"] },
  { id: "hex", nama: "heat exchanger / pendingin", dasar: 19_500_000, sat: "Unit", kerja: ["ganti", "bersih", "uji"] },
  { id: "thermo", nama: "thermostat", dasar: 1_250_000, sat: "Unit", kerja: ["ganti", "uji"] },
  { id: "foli", nama: "filter minyak lumas", dasar: 485_000, sat: "Unit", kerja: ["ganti", "bersih"] },
  { id: "fsolar", nama: "filter bahan bakar", dasar: 385_000, sat: "Unit", kerja: ["ganti", "bersih"] },
  { id: "fudara", nama: "filter udara", dasar: 650_000, sat: "Unit", kerja: ["ganti", "bersih"] },
  { id: "starter", nama: "motor starter", dasar: 9_800_000, sat: "Unit", kerja: ["ganti", "over"] },
  { id: "alt", nama: "alternator pengisian", dasar: 7_200_000, sat: "Unit", kerja: ["ganti", "over"] },
  { id: "gov", nama: "governor", dasar: 26_500_000, sat: "Unit", kerja: ["ganti", "over", "kalib"] },
  { id: "manifold", nama: "exhaust manifold", dasar: 13_500_000, sat: "Unit", kerja: ["ganti", "bersih"] },
  { id: "mount", nama: "engine mounting", dasar: 4_600_000, sat: "Set", kerja: ["ganti"] },
  { id: "sili", nama: "silencer gas buang", dasar: 12_800_000, sat: "Unit", kerja: ["ganti", "bersih"] },
];

const KERJA_MESIN = [
  { id: "ganti", nama: "Ganti", f: 1, jam: 8 },
  { id: "over", nama: "Overhaul dan rekondisi", f: 0.4, jam: 24 },
  { id: "skir", nama: "Skir dan setel celah", f: 0.2, jam: 6 },
  { id: "kalib", nama: "Kalibrasi dan setel", f: 0.12, jam: 8 },
  { id: "bersih", nama: "Pembersihan dan pemeriksaan", f: 0.07, jam: 6 },
  { id: "uji", nama: "Uji tekan dan uji fungsi", f: 0.06, jam: 5 },
];

export const POLA_MESIN: Pola[] = [{
  kode: "MSN",
  kategori: "Perbaikan — Permesinan",
  dimensi: { un: UNIT_MESIN, kp: KOMPONEN, kj: KERJA_MESIN },
  sah: (v) => v.kp.kerja.includes(v.kj.id),
  nama: (v) => `${v.kj.nama} ${v.kp.nama} ${v.un.nama}`,
  spek: (v) => {
    if (v.kj.id === "kalib") return "Dikalibrasi di bangku uji bersertifikat, hasil setelan dilampirkan dalam lembar uji";
    if (v.kj.id === "skir") return "Dudukan diskir sampai rapat, celah disetel sesuai buku manual, diuji kompresi";
    if (v.kj.id === "uji") return "Diuji pada tekanan kerja sesuai manual, tidak bocor dan tidak menurun selama 30 menit";
    if (v.kj.id === "bersih") return "Dibersihkan menyeluruh, keausan diukur dan dicatat, hasil dilaporkan dengan foto";
    if (v.kj.id === "over") return "Dibongkar, diukur, bagian aus diganti, dipasang dengan momen sesuai manual, diuji jalan 2 jam";
    return "Suku cadang baru sesuai nomor pabrikan, dipasang dengan momen sesuai manual, diuji jalan tanpa kelainan";
  },
  satuan: (v) => v.kp.sat,
  harga: (v) => v.kp.dasar * v.kj.f * v.un.f + (UPAH.ahli / 8) * v.kj.jam * v.un.f,
  bahan: (v) => {
    const utama = `${v.kp.nama[0].toUpperCase()}${v.kp.nama.slice(1)} — sesuai nomor pabrikan ${v.un.nama}`;
    if (v.kj.id === "kalib") return ["Jasa kalibrasi bangku uji — bengkel bersertifikat", "Gasket dan seal pemasangan ulang", "Solar kalibrasi — sesuai standar uji", MAJUN];
    if (v.kj.id === "skir") return ["Pasta skir (grinding paste) — kasar dan halus, 100 gram", "Gasket dan seal katup — satu set", "Feeler gauge dan kunci momen — sewa alat", MAJUN];
    if (v.kj.id === "bersih") return ["Cairan pembersih (degreaser) — 20 liter", "Sikat tabung dan alat ukur keausan — sewa alat", "Gasket pemasangan ulang — satu set", MAJUN];
    if (v.kj.id === "uji") return ["Pompa uji tekan dan manometer — kalibrasi berlaku", "Gasket dan seal pemasangan ulang", MAJUN];
    if (v.kj.id === "over") return [
      utama, "Gasket dan seal lengkap (overhaul kit) — satu set sesuai tipe mesin",
      "Bantalan dan bushing — sesuai nomor pabrikan",
      "Oli dan gemuk pelumas — sesuai kapasitas dan spesifikasi mesin",
      "Baut dan mur pengikat — baja kuat tarik 1000 N/mm2, dikencangkan sesuai momen di buku manual", MAJUN,
    ];
    return [
      utama, "Gasket dan O-ring pemasangan — satu set sesuai bagian",
      "Baut dan mur pengikat — baja kuat tarik 1000 N/mm2, dikencangkan sesuai momen di buku manual",
      "Oli dan cairan pendingin pengganti — sesuai kapasitas", MAJUN,
    ];
  },
}];

/* ── pelumas & bahan habis pakai mesin ───────────────────────────────── */

const OLI = [
  { id: "me40", nama: "minyak lumas mesin SAE 40 CF", lt: 38_000 },
  { id: "me1540", nama: "minyak lumas mesin SAE 15W-40 CH-4", lt: 42_000 },
  { id: "gear90", nama: "oli roda gigi SAE 90", lt: 46_000 },
  { id: "gear140", nama: "oli roda gigi SAE 140", lt: 49_000 },
  { id: "hid46", nama: "oli hidrolik ISO VG 46", lt: 44_000 },
  { id: "hid68", nama: "oli hidrolik ISO VG 68", lt: 46_000 },
  { id: "kompresor", nama: "oli kompresor ISO VG 100", lt: 58_000 },
  { id: "coolant", nama: "air pendingin (coolant) siap pakai", lt: 32_000 },
];
const WADAH = [
  { id: "20", nama: "drum 20 liter", lt: 20 }, { id: "200", nama: "drum 200 liter", lt: 200 },
];

export const POLA_OLI: Pola[] = [{
  kode: "OLI", jenis: "BARANG",
  kategori: "Perbaikan — Permesinan",
  dimensi: { ol: OLI, wd: WADAH },
  nama: (v) => `Penggantian ${v.ol.nama} — ${v.wd.nama}`,
  spek: () => "Pelumas baru bersegel pabrik, oli bekas ditampung dan diserahkan sesuai aturan limbah B3",
  satuan: () => "Drum",
  harga: (v) => v.ol.lt * v.wd.lt * 1.05 + (UPAH.teknisi / 8) * (v.wd.lt > 20 ? 4 : 1.5),
  bahan: (v) => [
    `${v.ol.nama[0].toUpperCase()}${v.ol.nama.slice(1)} — ${v.wd.nama}, bersegel pabrik`,
    "Pompa pemindah dan selang — sewa alat",
    "Wadah penampung oli bekas — drum berlabel limbah B3", MAJUN,
  ],
}];

/* ── propulsi & kemudi ───────────────────────────────────────────────── */

const PROPULSI = [
  { id: "poros", nama: "poros baling-baling", dasar: 78_000_000 },
  { id: "prop", nama: "baling-baling (propeller)", dasar: 96_000_000 },
  { id: "daun", nama: "daun baling-baling", dasar: 24_000_000 },
  { id: "stern", nama: "bantalan stern tube", dasar: 28_500_000 },
  { id: "seal", nama: "seal stern tube", dasar: 16_500_000 },
  { id: "kopling", nama: "kopling fleksibel poros", dasar: 22_000_000 },
  { id: "gearbox", nama: "gearbox (reduction gear)", dasar: 185_000_000 },
  { id: "thrust", nama: "thrust bearing", dasar: 34_000_000 },
  { id: "antara", nama: "poros antara (intermediate shaft)", dasar: 52_000_000 },
  { id: "bracket", nama: "shaft bracket dan bushing", dasar: 26_000_000 },
  { id: "rudder", nama: "daun kemudi", dasar: 62_000_000 },
  { id: "stock", nama: "rudder stock", dasar: 48_000_000 },
  { id: "pintle", nama: "pintle dan bushing kemudi", dasar: 18_500_000 },
  { id: "tiller", nama: "tiller kemudi", dasar: 16_000_000 },
  { id: "steering", nama: "steering gear hidrolik", dasar: 125_000_000 },
  { id: "silinder", nama: "silinder hidrolik kemudi", dasar: 38_000_000 },
  { id: "phid", nama: "pompa hidrolik kemudi", dasar: 32_000_000 },
  { id: "thruster", nama: "bow thruster", dasar: 240_000_000 },
];

const KERJA_PROP = [
  { id: "ganti", nama: "Ganti", f: 1, jam: 24 },
  { id: "cabut", nama: "Cabut pasang dan pengukuran clearance", f: 0.06, jam: 20 },
  { id: "balance", nama: "Balancing dan perbaikan", f: 0.14, jam: 18 },
  { id: "align", nama: "Pelurusan (alignment)", f: 0.05, jam: 16 },
  { id: "las", nama: "Perbaikan dan pengelasan", f: 0.12, jam: 16 },
  { id: "seal", nama: "Ganti seal dan bushing", f: 0.1, jam: 12 },
  { id: "uji", nama: "Uji fungsi dan uji tekan", f: 0.03, jam: 8 },
];

export const POLA_PROPULSI: Pola[] = [{
  kode: "PRP",
  kategori: "Perbaikan — Propulsi & Kemudi",
  dimensi: { pr: PROPULSI, kj: KERJA_PROP },
  sah: (v) =>
    !(v.kj.id === "balance" && !["prop", "daun", "poros", "antara"].includes(v.pr.id)) &&
    !(v.kj.id === "align" && !["poros", "antara", "gearbox", "kopling", "thrust"].includes(v.pr.id)) &&
    !(v.kj.id === "las" && ["seal", "phid", "gearbox", "thruster"].includes(v.pr.id)) &&
    !(v.kj.id === "seal" && !["stern", "seal", "silinder", "phid", "steering", "pintle", "bracket", "gearbox"].includes(v.pr.id)),
  nama: (v) => `${v.kj.nama} ${v.pr.nama}`,
  spek: (v) => {
    if (v.kj.id === "cabut") return "Clearance diukur sebelum dan sesudah, hasil dicatat dan disaksikan surveyor klas";
    if (v.kj.id === "balance") return "Dibalans statis dan dinamis, penyimpangan sesuai toleransi pabrikan, hasil dilampirkan";
    if (v.kj.id === "align") return "Penyimpangan sumbu sesuai batas manual, hasil pengukuran dilampirkan dan disaksikan klas";
    if (v.kj.id === "uji") return "Diuji fungsi penuh dari anjungan dan lokal, waktu peralihan dicatat";
    if (v.kj.id === "las") return "Bagian aus dilas dan dibubut ulang ke ukuran semula, diuji penetran";
    return "Terpasang sesuai gambar dan toleransi pabrikan, diuji jalan tanpa getaran berlebih, disaksikan surveyor klas";
  },
  satuan: () => "Unit",
  harga: (v) => v.pr.dasar * v.kj.f + (UPAH.ahli / 8) * v.kj.jam,
  bahan: (v) => {
    if (v.kj.id === "cabut") return ["Alat ukur clearance (bridge gauge, feeler) — kalibrasi berlaku", "Gasket dan seal pemasangan ulang", "Jasa angkat dan dudukan sementara — sewa alat", MAJUN];
    if (v.kj.id === "align") return ["Shim plat pelurusan — stainless 0.05–1 mm, satu set", "Alat ukur pelurusan (dial/laser) — sewa alat", MAJUN];
    if (v.kj.id === "balance") return ["Jasa balancing bengkel — bersertifikat", "Bahan tambal dan las — sesuai bahan baling-baling", "Alat ukur pitch dan kerataan — sewa alat"];
    if (v.kj.id === "las") return ["Bahan las sesuai logam induk — kuningan/baja/stainless", KAWAT_LAS, OKSIGEN, GERINDA, "Pengujian penetran — oleh pihak bersertifikat"];
    if (v.kj.id === "seal") return ["Seal dan bushing — sesuai diameter dan tipe terpasang", "O-ring dan gasket — satu set", "Oli/gemuk pelumas — sesuai spesifikasi", MAJUN];
    if (v.kj.id === "uji") return ["Alat ukur tekanan dan waktu peralihan — kalibrasi berlaku", "Oli hidrolik penambah — ISO VG 46", MAJUN];
    return [
      `${v.pr.nama[0].toUpperCase()}${v.pr.nama.slice(1)} — sesuai gambar dan sertifikat klas`,
      "Baut, mur, dan pasak pengikat — sesuai gambar konstruksi",
      "Seal, gasket, dan O-ring — satu set pemasangan",
      "Oli dan gemuk pelumas — sesuai spesifikasi pabrikan",
      "Jasa angkat dan dudukan sementara — sewa alat", MAJUN,
    ];
  },
}];

/* ── perlengkapan geladak, jangkar, ramp door ────────────────────────── */

const GELADAK = [
  { id: "jangkar", nama: "jangkar", dasar: 42_000_000 },
  { id: "rantai", nama: "rantai jangkar (per segel 27.5 m)", dasar: 38_000_000 },
  { id: "shackle", nama: "shackle / kenter rantai jangkar", dasar: 4_800_000 },
  { id: "winch", nama: "winch jangkar (windlass)", dasar: 115_000_000 },
  { id: "capstan", nama: "capstan tambat", dasar: 62_000_000 },
  { id: "bollard", nama: "bollard tambat", dasar: 12_500_000 },
  { id: "fairlead", nama: "fairlead / roller tambat", dasar: 8_600_000 },
  { id: "tali", nama: "tali tambat (mooring rope)", dasar: 7_400_000 },
  { id: "fender", nama: "fender kapal", dasar: 9_800_000 },
  { id: "ramp", nama: "ramp door", dasar: 185_000_000 },
  { id: "engsel", nama: "engsel dan bushing ramp door", dasar: 18_500_000 },
  { id: "wire", nama: "wire rope ramp door", dasar: 16_200_000 },
  { id: "hidramp", nama: "unit hidrolik ramp door", dasar: 74_000_000 },
  { id: "kanvas", nama: "kanvas rem winch", dasar: 4_200_000 },
  { id: "sideramp", nama: "side ramp", dasar: 96_000_000 },
  { id: "movable", nama: "movable car deck", dasar: 145_000_000 },
  { id: "tangga", nama: "tangga akomodasi (accommodation ladder)", dasar: 38_000_000 },
  { id: "gangway", nama: "gangway", dasar: 24_000_000 },
  { id: "derek", nama: "derek (crane) geladak", dasar: 165_000_000 },
];

const KERJA_GELADAK = [
  { id: "ganti", nama: "Ganti", f: 1, jam: 16 },
  { id: "las", nama: "Perbaikan dan pengelasan", f: 0.11, jam: 12 },
  { id: "ukur", nama: "Pengukuran keausan dan kalibrasi", f: 0.03, jam: 8 },
  { id: "rawat", nama: "Pelumasan dan perawatan", f: 0.025, jam: 6 },
  { id: "beban", nama: "Uji beban dan uji fungsi", f: 0.04, jam: 8 },
];

export const POLA_GELADAK: Pola[] = [{
  kode: "GLD",
  kategori: "Perbaikan — Geladak & Jangkar",
  dimensi: { gl: GELADAK, kj: KERJA_GELADAK },
  sah: (v) =>
    !(v.kj.id === "las" && ["tali", "kanvas", "wire", "hidramp"].includes(v.gl.id)) &&
    !(v.kj.id === "ukur" && !["rantai", "jangkar", "shackle", "wire", "tali", "engsel", "kanvas"].includes(v.gl.id)) &&
    !(v.kj.id === "beban" && !["winch", "capstan", "ramp", "sideramp", "movable", "derek", "tangga", "gangway", "hidramp"].includes(v.gl.id)),
  nama: (v) => `${v.kj.nama} ${v.gl.nama}`,
  spek: (v) => {
    if (v.kj.id === "ukur") return "Diameter dan keausan diukur pada beberapa titik, hasil dicatat dan dibandingkan batas klas";
    if (v.kj.id === "beban") return "Diuji pada beban kerja aman (SWL), hasil dicatat dalam berita acara dan disaksikan klas";
    if (v.kj.id === "rawat") return "Dibersihkan, dilumasi, dan disetel; bagian aus dilaporkan dengan foto";
    if (v.kj.id === "las") return "Bagian aus/retak dilas penuh dan digerinda rata, dicat ulang, diuji fungsi";
    return "Terpasang sesuai gambar, diuji fungsi dan beban, dicat sesuai skema warna kapal";
  },
  satuan: (v) => (v.gl.id === "rantai" ? "Segel" : "Unit"),
  harga: (v) => v.gl.dasar * v.kj.f + (UPAH.teknisi / 8) * v.kj.jam,
  bahan: (v) => {
    if (v.kj.id === "rawat") return ["Gemuk (grease) — lithium EP2, tahan sampai 130 derajat C, 5 kg", "Oli roda gigi — SAE 140, 20 liter", "Cairan pembersih dan sikat kawat", MAJUN];
    if (v.kj.id === "ukur") return ["Alat ukur (jangka sorong, mikrometer, kaliper rantai) — kalibrasi berlaku", "Cat penanda dan lembar hasil ukur", MAJUN];
    if (v.kj.id === "beban") return ["Beban uji dan dinamometer — sewa alat", "Lembar hasil uji dan berita acara", MAJUN];
    if (v.kj.id === "las") return ["Plat/profil baja penambal — baja kapal grade A", KAWAT_LAS, OKSIGEN, GERINDA, CAT_BESI];
    return [
      `${v.gl.nama[0].toUpperCase()}${v.gl.nama.slice(1)} — sesuai gambar dan sertifikat klas`,
      "Baut, mur, dan pasak pengikat — sesuai gambar konstruksi",
      "Gemuk (grease) — lithium EP2, tahan sampai 130 derajat C, 5 kg", CAT_BESI, MAJUN,
    ];
  },
}];

/* ── tangki & anoda ──────────────────────────────────────────────────── */

const TANGKI = [
  { id: "bbm-h", nama: "tangki bahan bakar harian", f: 1.1, gas: true },
  { id: "bbm-i", nama: "tangki bahan bakar induk", f: 1.5, gas: true },
  { id: "air", nama: "tangki air tawar", f: 1, gas: false },
  { id: "ballast", nama: "tangki ballast", f: 1.3, gas: false },
  { id: "sludge", nama: "tangki lumpur (sludge)", f: 1.2, gas: true },
  { id: "sewage", nama: "tangki kotoran (sewage)", f: 1.2, gas: true },
  { id: "lumas", nama: "tangki minyak lumas", f: 1.05, gas: true },
  { id: "cofferdam", nama: "cofferdam", f: 0.9, gas: true },
  { id: "chain", nama: "chain locker", f: 0.85, gas: false },
];

const KERJA_TANGKI = [
  { id: "bersih", nama: "Pembersihan dan gas free", f: 1, dasar: 4_200_000, jam: 16 },
  { id: "uji", nama: "Uji kebocoran dan uji tekan", f: 1, dasar: 2_800_000, jam: 8 },
  { id: "anoda", nama: "Ganti anoda korban", f: 1, dasar: 3_600_000, jam: 10 },
  { id: "sounding", nama: "Perbaikan pipa sounding dan pipa udara", f: 1, dasar: 2_400_000, jam: 8 },
  { id: "manhole", nama: "Ganti gasket manhole", f: 1, dasar: 1_450_000, jam: 4 },
  { id: "catdalam", nama: "Pengecatan bagian dalam tangki", f: 1, dasar: 8_500_000, jam: 24 },
  { id: "kalibrasi", nama: "Kalibrasi tabel sounding tangki", f: 1, dasar: 5_200_000, jam: 12 },
];

const KAPASITAS = [
  { id: "kcl", nama: "kapasitas sampai 10 m3", f: 0.7 },
  { id: "sdg", nama: "kapasitas 10–50 m3", f: 1 },
  { id: "bsr", nama: "kapasitas di atas 50 m3", f: 1.6 },
];

export const POLA_TANGKI: Pola[] = [{
  kode: "TGK",
  kategori: "Perbaikan — Tangki",
  dimensi: { tk: TANGKI, kj: KERJA_TANGKI, kap: KAPASITAS },
  sah: (v) =>
    !(v.tk.id === "chain" && ["kalibrasi", "sounding", "catdalam"].includes(v.kj.id)) &&
    !(v.kj.id === "anoda" && !["ballast", "air"].includes(v.tk.id)),
  nama: (v) => `${v.kj.nama} ${v.tk.nama} — ${v.kap.nama}`,
  spek: (v) => {
    if (v.kj.id === "bersih") return `Tangki bersih dari endapan, ${v.tk.gas ? "diukur gas free oleh petugas bersertifikat sebelum orang masuk, " : ""}limbah diserahkan sesuai aturan`;
    if (v.kj.id === "uji") return "Diuji dengan tekanan air/udara sesuai aturan klas, tidak ada rembesan selama 2 jam";
    if (v.kj.id === "kalibrasi") return "Tabel sounding disusun ulang dan disahkan, salinan diserahkan ke kapal";
    if (v.kj.id === "catdalam") return "Bagian dalam bersih dan kering, dicat sistem sesuai peruntukan tangki, tebal kering diukur";
    return "Dikerjakan sesuai aturan klas, hasil diuji kedap dan dicatat dalam berita acara";
  },
  satuan: () => "Tangki",
  harga: (v) => v.kj.dasar * v.tk.f * v.kap.f + (UPAH.tukang / 8) * v.kj.jam * v.kap.f,
  bahan: (v) => {
    if (v.kj.id === "bersih") return [
      "Cairan pembersih dan degreaser — 20 liter",
      v.tk.gas ? "Jasa pengukuran gas free — petugas bersertifikat, lengkap sertifikat" : "Desinfektan tangki air minum — sesuai standar kesehatan",
      "Blower dan penerangan kerja — portabel, tegangan rendah",
      "Wadah penampung limbah — drum berlabel limbah B3", MAJUN,
    ];
    if (v.kj.id === "anoda") return ["Anoda korban (zinc anode) — sesuai luas permukaan, bersertifikat", "Baut dan dudukan anoda — stainless", KAWAT_LAS, GERINDA];
    if (v.kj.id === "manhole") return ["Gasket manhole — karet tahan minyak, tebal 5 mm", "Baut dan mur manhole — galvanis", MAJUN];
    if (v.kj.id === "sounding") return ["Pipa sounding dan pipa udara — GIP sesuai diameter", "Sounding cap dan flame screen — kuningan/stainless", KAWAT_LAS, OKSIGEN];
    if (v.kj.id === "catdalam") return ["Cat epoksi dua komponen — sesuai peruntukan tangki, 20 liter", "Thinner epoksi — 4 liter", "Alat semprot airless dan blower — sewa alat", MAJUN];
    if (v.kj.id === "kalibrasi") return ["Jasa kalibrasi tangki — pihak bersertifikat", "Alat ukur sounding dan meteran tera", "Cetak tabel sounding dan pengesahan"];
    return ["Pompa uji tekan dan manometer — kalibrasi berlaku", "Air pengujian dan selang", "Gasket penyumbat — sesuai bukaan tangki", MAJUN];
  },
}];

const ANODA = [2, 3, 5, 8, 10, 15].map((k) => ({ id: `${k}kg`, nama: `${k} kg`, kg: k }));
const LOKASI_ANODA = [
  { id: "lambung", nama: "lambung bawah air", f: 1 },
  { id: "kemudi", nama: "daun kemudi", f: 1.1 },
  { id: "seachest", nama: "sea chest", f: 1.25 },
  { id: "ballast", nama: "tangki ballast", f: 1.2 },
  { id: "hex", nama: "heat exchanger", f: 1.4 },
  { id: "propeller", nama: "poros dan baling-baling", f: 1.3 },
];

export const POLA_ANODA: Pola[] = [{
  kode: "AND",
  kategori: "Perbaikan — Tangki",
  dimensi: { an: ANODA, lok: LOKASI_ANODA },
  sah: (v) => !(v.lok.id === "hex" && v.an.kg > 5),
  nama: (v) => `Ganti anoda korban ${v.an.nama} — ${v.lok.nama}`,
  spek: () => "Anoda zinc bersertifikat, dilas/dibaut pada dudukan bersih, jumlah dan posisi sesuai gambar",
  satuan: () => "Unit",
  harga: (v) => v.an.kg * 92_000 * v.lok.f + (UPAH.tukang / 8) * 1.8,
  bahan: (v) => [
    `Anoda korban (zinc anode) ${v.an.nama} — bersertifikat, lengkap inti besi`,
    v.lok.id === "hex" || v.lok.id === "ballast" ? "Baut dan dudukan anoda — stainless" : KAWAT_LAS,
    GERINDA, MAJUN,
  ],
}];
