/** Akomodasi, interior, sanitasi, dan tata udara. */
import { Pola, SEALANT, SEAL_TAPE, MAJUN, CAT_BESI, KAWAT_LAS, GERINDA, UPAH } from "../pola";

/* ── pintu ───────────────────────────────────────────────────────────── */

const PINTU = [
  { id: "kayu", nama: "pintu kayu solid", spek: "kayu keras, finishing melamin", dasar: 1_450_000, kedap: false },
  { id: "pvc", nama: "pintu PVC", spek: "PVC tahan air, rangka aluminium", dasar: 850_000, kedap: false },
  { id: "alu", nama: "pintu aluminium", spek: "profil aluminium 3 inci, panel kaca", dasar: 1_950_000, kedap: false },
  { id: "plat", nama: "pintu plat besi", spek: "plat 4 mm, rangka siku, dicat marine", dasar: 3_200_000, kedap: false },
  { id: "wt", nama: "pintu kedap cuaca (weathertight)", spek: "plat 6 mm, gasket karet, kunci putar 6 titik", dasar: 8_500_000, kedap: true },
  { id: "a60", nama: "pintu kedap api A-60", spek: "bersertifikat A-60, lengkap penutup otomatis", dasar: 14_500_000, kedap: true },
  { id: "sliding", nama: "pintu geser (sliding)", spek: "rel atas, roda stainless", dasar: 2_650_000, kedap: false },
  { id: "kaca", nama: "pintu kaca tempered", spek: "kaca tempered 10 mm, engsel lantai", dasar: 4_200_000, kedap: false },
];

const UK_PINTU = [
  { id: "70", nama: "70 x 200 cm", f: 0.9 }, { id: "80", nama: "80 x 200 cm", f: 1 },
  { id: "90", nama: "90 x 210 cm", f: 1.15 }, { id: "60", nama: "60 x 180 cm", f: 0.8 },
  { id: "120", nama: "120 x 210 cm (dua daun)", f: 1.8 },
];

const KERJA_PINTU = [
  { id: "daun", nama: "Ganti daun", f: 0.75, jam: 4 },
  { id: "lengkap", nama: "Ganti daun dan kusen", f: 1.25, jam: 8 },
  { id: "engsel", nama: "Perbaikan engsel dan kunci", f: 0.14, jam: 3 },
  { id: "gasket", nama: "Ganti gasket kedap", f: 0.12, jam: 4 },
  { id: "handel", nama: "Ganti handel dan kunci", f: 0.16, jam: 2 },
];

export const POLA_PINTU: Pola[] = [{
  kode: "PTU",
  kategori: "Perbaikan — Akomodasi & Interior",
  dimensi: { pt: PINTU, uk: UK_PINTU, kj: KERJA_PINTU },
  sah: (v) => !(v.kj.id === "gasket" && !v.pt.kedap) && !(v.uk.id === "120" && ["kayu", "pvc"].includes(v.pt.id)),
  nama: (v) => `${v.kj.nama} ${v.pt.nama} ${v.uk.nama}`,
  spek: (v) =>
    v.kj.id === "gasket" ? "Gasket baru menyeluruh, diuji kedap dengan uji siram, kunci putar menekan rata"
      : v.kj.id === "engsel" ? "Engsel dan kunci disetel, pintu menutup rapat tanpa mengganjal"
        : `Pintu terpasang tegak dan rapat, ${v.pt.spek}, diuji buka tutup dan kunci berfungsi`,
  satuan: () => "Unit",
  harga: (v) => v.pt.dasar * v.uk.f * v.kj.f + (UPAH.tukang / 8) * v.kj.jam,
  bahan: (v) =>
    v.kj.id === "handel" ? ["Handel dan kunci pintu — kunci silinder, badan stainless", "Sekrup dan pelat kunci — stainless"]
      : v.kj.id === "engsel" ? ["Engsel — stainless 3 inci, 3 buah", "Kunci pintu — kunci silinder", "Pelumas dan sekrup — sesuai engsel"]
        : v.kj.id === "gasket" ? ["Gasket karet pintu — profil sesuai alur, tahan cuaca", "Lem gasket — perekat karet tahan air", SEALANT]
          : [
            `Daun pintu ${v.pt.nama} ${v.uk.nama} — ${v.pt.spek}`,
            v.kj.id === "lengkap" ? `Kusen ${v.pt.id === "kayu" ? "kayu keras" : "aluminium/plat"} — sesuai bukaan ${v.uk.nama}` : undefined,
            "Engsel dan kunci — engsel stainless 3 inci, kunci silinder",
            v.pt.kedap ? "Gasket karet pintu — profil sesuai alur, tahan cuaca" : undefined,
            SEALANT,
          ],
}];

/* ── jendela & kaca ──────────────────────────────────────────────────── */

const KACA = [
  { id: "b5", nama: "kaca bening 5 mm", dasar: 185_000 }, { id: "b6", nama: "kaca bening 6 mm", dasar: 225_000 },
  { id: "b8", nama: "kaca bening 8 mm", dasar: 295_000 }, { id: "t10", nama: "kaca tempered 10 mm", dasar: 485_000 },
  { id: "t12", nama: "kaca tempered 12 mm", dasar: 625_000 }, { id: "lam", nama: "kaca laminated 6.38 mm", dasar: 415_000 },
];
const JENDELA = [
  { id: "geser", nama: "jendela geser akomodasi", f: 1 },
  { id: "engkel", nama: "jendela engsel atas", f: 1.1 },
  { id: "mati", nama: "jendela mati (fixed)", f: 0.85 },
  { id: "bulat", nama: "jendela bulat (portlight)", f: 1.9 },
  { id: "anjungan", nama: "jendela anjungan", f: 1.6 },
  { id: "pintu", nama: "kaca daun pintu", f: 0.9 },
];
const KERJA_KACA = [
  { id: "kaca", nama: "Ganti kaca", f: 1, jam: 3 },
  { id: "karet", nama: "Ganti karet list kaca", f: 0.22, jam: 2 },
  { id: "daun", nama: "Ganti daun jendela lengkap", f: 2.4, jam: 6 },
  { id: "bocor", nama: "Perbaikan kebocoran jendela", f: 0.3, jam: 3 },
];

export const POLA_JENDELA: Pola[] = [{
  kode: "JND",
  kategori: "Perbaikan — Akomodasi & Interior",
  dimensi: { jn: JENDELA, kc: KACA, kj: KERJA_KACA },
  sah: (v) => !(v.jn.id === "anjungan" && !["t10", "t12", "lam"].includes(v.kc.id)) &&
    !(v.jn.id === "bulat" && ["b5", "lam"].includes(v.kc.id)),
  nama: (v) => `${v.kj.nama} ${v.jn.nama} — ${v.kc.nama}`,
  spek: (v) =>
    v.kj.id === "bocor" ? "Alur dibersihkan dan diberi sealant baru, diuji siram air 10 menit tanpa rembes"
      : `Kaca terpasang dengan karet baru, ${v.kc.nama}, diuji siram tidak bocor`,
  satuan: () => "Unit",
  harga: (v) => v.kc.dasar * v.jn.f * v.kj.f + (UPAH.tukang / 8) * v.kj.jam,
  bahan: (v) =>
    v.kj.id === "karet" ? ["Karet list kaca — profil U/H sesuai tebal kaca", SEALANT, MAJUN]
      : v.kj.id === "bocor" ? ["Sealant marine — silikon netral, 300 ml", "Karet list kaca — profil sesuai alur", MAJUN]
        : [
          `${v.kc.nama[0].toUpperCase()}${v.kc.nama.slice(1)} — ukuran menyesuaikan bukaan terpasang`,
          "Karet list kaca — profil U/H sesuai tebal kaca",
          v.kj.id === "daun" ? `Rangka daun jendela — ${v.jn.id === "bulat" ? "kuningan/stainless bulat" : "aluminium profil"}` : undefined,
          SEALANT, MAJUN,
        ],
}];

/* ── plafon, dinding, lantai ─────────────────────────────────────────── */

const PENUTUP = [
  { id: "plafon-pvc", nama: "plafon PVC", bidang: "plafon", dasar: 165_000 },
  { id: "plafon-gyp", nama: "plafon gypsum", bidang: "plafon", dasar: 148_000 },
  { id: "plafon-kalsi", nama: "plafon kalsiboard", bidang: "plafon", dasar: 172_000 },
  { id: "plafon-marine", nama: "panel plafon marine B-15", bidang: "plafon", dasar: 585_000 },
  { id: "plafon-akustik", nama: "plafon akustik", bidang: "plafon", dasar: 245_000 },
  { id: "dinding-hpl", nama: "panel dinding HPL", bidang: "dinding", dasar: 285_000 },
  { id: "dinding-marine", nama: "panel dinding marine B-15", bidang: "dinding", dasar: 625_000 },
  { id: "dinding-acp", nama: "panel dinding aluminium composite", bidang: "dinding", dasar: 385_000 },
  { id: "dinding-keramik", nama: "dinding keramik", bidang: "dinding", dasar: 215_000 },
  { id: "insul-50", nama: "insulasi rockwool 50 mm", bidang: "dinding", dasar: 195_000 },
  { id: "insul-75", nama: "insulasi rockwool 75 mm", bidang: "dinding", dasar: 245_000 },
  { id: "insul-100", nama: "insulasi rockwool 100 mm", bidang: "dinding", dasar: 295_000 },
  { id: "lantai-vinyl", nama: "lantai vinyl", bidang: "lantai", dasar: 225_000 },
  { id: "lantai-karet", nama: "lantai karet", bidang: "lantai", dasar: 268_000 },
  { id: "lantai-keramik", nama: "lantai keramik", bidang: "lantai", dasar: 235_000 },
  { id: "lantai-epoksi", nama: "lantai epoksi", bidang: "lantai", dasar: 315_000 },
  { id: "lantai-screed", nama: "deck covering (latex screed)", bidang: "lantai", dasar: 285_000 },
  { id: "lantai-karpet", nama: "lantai karpet", bidang: "lantai", dasar: 165_000 },
];

const RUANG = [
  { id: "penumpang", nama: "ruang penumpang", f: 1 },
  { id: "anjungan", nama: "anjungan", f: 1.2 },
  { id: "kabin", nama: "kabin awak", f: 1.05 },
  { id: "kamar-mandi", nama: "kamar mandi", f: 1.25 },
  { id: "dapur", nama: "dapur (galley)", f: 1.3 },
  { id: "kantin", nama: "kantin", f: 1.1 },
  { id: "lorong", nama: "lorong dan tangga", f: 1.1 },
  { id: "mesin", nama: "ruang mesin", f: 1.35 },
  { id: "kantor", nama: "ruang kantor kapal", f: 1 },
  { id: "musala", nama: "musala", f: 1 },
];

const KERJA_PENUTUP = [
  { id: "ganti", nama: "Ganti", f: 1, jam: 1.1 },
  { id: "perbaikan", nama: "Perbaikan setempat", f: 0.35, jam: 0.6 },
  { id: "rangka", nama: "Ganti rangka dan pasang ulang", f: 1.35, jam: 1.6 },
];

export const POLA_PENUTUP: Pola[] = [{
  kode: "INT",
  kategori: "Perbaikan — Akomodasi & Interior",
  dimensi: { pn: PENUTUP, rg: RUANG, kj: KERJA_PENUTUP },
  sah: (v) =>
    !(v.rg.id === "mesin" && ["lantai-karpet", "plafon-gyp", "dinding-hpl", "lantai-vinyl"].includes(v.pn.id)) &&
    !(v.rg.id === "kamar-mandi" && ["lantai-karpet", "plafon-gyp", "dinding-hpl"].includes(v.pn.id)) &&
    !(v.rg.id === "dapur" && ["lantai-karpet", "dinding-hpl"].includes(v.pn.id)) &&
    !(v.kj.id === "rangka" && v.pn.bidang === "lantai"),
  nama: (v) => `${v.kj.nama} ${v.pn.nama} — ${v.rg.nama}`,
  spek: (v) =>
    v.pn.bidang === "lantai" ? "Permukaan rata tanpa gelembung, sambungan rapat dan mudah dibersihkan"
      : v.pn.bidang === "plafon" ? "Plafon rata, sambungan rapat, rangka tidak melendut"
        : "Panel rata dan tegak lurus, sambungan rapat, sudut diberi list",
  satuan: () => "m2",
  harga: (v) => v.pn.dasar * v.rg.f * v.kj.f + (UPAH.tukang / 8) * v.kj.jam * v.rg.f,
  bahan: (v) => [
    `${v.pn.nama[0].toUpperCase()}${v.pn.nama.slice(1)} — bahan tahan lembap, mutu marine`,
    v.pn.bidang === "lantai" ? "Lem dan bahan perekat — sesuai bahan penutup, 4 kg" : "Rangka hollow galvalum 40 x 20 mm — dan sekrup",
    v.pn.bidang === "lantai" ? "Kawat las vinyl / nat — sewarna penutup" : "List tepi dan sudut — sesuai bahan panel",
    SEALANT, MAJUN,
  ],
}];

/* ── mebel & perlengkapan ruang ──────────────────────────────────────── */

const MEBEL = [
  { id: "kursi1", nama: "kursi penumpang tunggal", dasar: 950_000 },
  { id: "kursi2", nama: "kursi penumpang 2 dudukan", dasar: 1_650_000 },
  { id: "kursi3", nama: "kursi penumpang 3 dudukan", dasar: 2_350_000 },
  { id: "kursi4", nama: "kursi penumpang 4 dudukan", dasar: 2_950_000 },
  { id: "bangku", nama: "bangku geladak", dasar: 1_250_000 },
  { id: "kursi-kantor", nama: "kursi kantor kapal", dasar: 1_450_000 },
  { id: "meja", nama: "meja ruang makan", dasar: 2_150_000 },
  { id: "bunk", nama: "tempat tidur susun (bunk)", dasar: 4_800_000 },
  { id: "kasur", nama: "kasur busa awak kapal", dasar: 1_350_000 },
  { id: "lemari", nama: "lemari pakaian awak", dasar: 3_200_000 },
  { id: "rak", nama: "rak penyimpanan", dasar: 1_850_000 },
  { id: "tirai", nama: "tirai jendela", dasar: 485_000 },
  { id: "pantry", nama: "meja dan rak pantry", dasar: 3_650_000 },
  { id: "loker", nama: "loker perlengkapan", dasar: 2_450_000 },
];
const KERJA_MEBEL = [
  { id: "ganti", nama: "Ganti", f: 1, jam: 3 },
  { id: "busa", nama: "Ganti busa dan pelapis", f: 0.32, jam: 4 },
  { id: "rangka", nama: "Perbaikan rangka dan pengelasan", f: 0.25, jam: 4 },
  { id: "cat", nama: "Pengecatan ulang", f: 0.18, jam: 3 },
];

export const POLA_MEBEL: Pola[] = [{
  kode: "MBL",
  kategori: "Perbaikan — Akomodasi & Interior",
  dimensi: { mb: MEBEL, kj: KERJA_MEBEL },
  sah: (v) => !(v.kj.id === "busa" && !/kursi|bangku|kasur|bunk/.test(v.mb.id)) &&
    !(v.kj.id === "rangka" && ["tirai", "kasur"].includes(v.mb.id)),
  nama: (v) => `${v.kj.nama} ${v.mb.nama}`,
  spek: (v) =>
    v.kj.id === "busa" ? "Busa dan pelapis baru, jahitan rapi, rangka dikencangkan kembali"
      : v.kj.id === "rangka" ? "Rangka dilas penuh dan digerinda rata, goyangan hilang, dicat ulang"
        : "Terpasang kokoh pada lantai/dinding, bahan tahan lembap dan mudah dibersihkan",
  satuan: () => "Unit",
  harga: (v) => v.mb.dasar * v.kj.f + (UPAH.tukang / 8) * v.kj.jam,
  bahan: (v) =>
    v.kj.id === "busa" ? ["Busa jok — tebal 5 cm, kepadatan 24 kg/m3", "Kulit sintetis (oscar) — tahan air dan tahan api", "Benang dan lem jok — sesuai bahan pelapis"]
      : v.kj.id === "rangka" ? ["Besi siku / pipa rangka — sesuai profil terpasang", KAWAT_LAS, GERINDA, CAT_BESI]
        : v.kj.id === "cat" ? [CAT_BESI, "Amplas dan dempul — sesuai bahan rangka", "Kuas dan thinner"]
          : [
            `${v.mb.nama[0].toUpperCase()}${v.mb.nama.slice(1)} — bahan tahan lembap, mutu marine`,
            "Baut dan angkur pengikat — stainless",
            "Busa dan pelapis — bila berdudukan, tahan api", MAJUN,
          ],
}];

/* ── sanitasi ────────────────────────────────────────────────────────── */

const SANITER = [
  { id: "kloset-duduk", nama: "kloset duduk", dasar: 1_650_000 },
  { id: "kloset-jongkok", nama: "kloset jongkok", dasar: 685_000 },
  { id: "kloset-vakum", nama: "kloset vakum", dasar: 8_500_000 },
  { id: "urinoir", nama: "urinoir", dasar: 1_250_000 },
  { id: "wastafel", nama: "wastafel", dasar: 850_000 },
  { id: "shower", nama: "shower dan kran campur", dasar: 685_000 },
  { id: "floor-drain", nama: "floor drain", dasar: 185_000 },
  { id: "bak", nama: "bak mandi / bak cuci", dasar: 1_150_000 },
  { id: "sink", nama: "kitchen sink stainless", dasar: 1_450_000 },
  { id: "heater", nama: "pemanas air (water heater)", dasar: 2_850_000 },
  { id: "jet", nama: "jet washer", dasar: 325_000 },
  { id: "toren", nama: "tangki air (toren)", dasar: 3_450_000 },
  { id: "stp", nama: "unit pengolah limbah (STP)", dasar: 68_000_000 },
  { id: "blower-stp", nama: "blower STP", dasar: 12_500_000 },
];
const KERJA_SAN = [
  { id: "ganti", nama: "Ganti unit", f: 1, jam: 4 },
  { id: "service", nama: "Perbaikan dan servis", f: 0.22, jam: 4 },
  { id: "aksesoris", nama: "Ganti aksesoris dan kran", f: 0.2, jam: 2 },
  { id: "saluran", nama: "Perbaikan saluran dan pipa buangan", f: 0.25, jam: 4 },
];

export const POLA_SANITASI: Pola[] = [{
  kode: "SAN",
  kategori: "Perbaikan — Sanitasi",
  dimensi: { sn: SANITER, kj: KERJA_SAN },
  sah: (v) => !(["stp", "blower-stp", "toren"].includes(v.sn.id) && v.kj.id === "aksesoris"),
  nama: (v) => `${v.kj.nama} ${v.sn.nama}`,
  spek: (v) =>
    v.kj.id === "saluran" ? "Saluran lancar tanpa genangan, sambungan tidak merembes, diuji siram"
      : v.sn.id === "stp" ? "Unit jalan normal, hasil olahan memenuhi baku mutu, hasil uji dilampirkan"
        : "Terpasang rapat ke dinding/lantai, air masuk dan buangan lancar, tidak ada rembesan",
  satuan: () => "Unit",
  harga: (v) => v.sn.dasar * v.kj.f + (UPAH.tukang / 8) * v.kj.jam,
  bahan: (v) =>
    v.kj.id === "saluran" ? ["Pipa PVC 2–4 inci — tekanan kerja 10 bar (tipe AW), batang 4 m", "Sambungan PVC — elbow, sok, dan tee", "Lem PVC — kemasan 100 gram", SEALANT]
      : v.kj.id === "aksesoris" ? ["Kran dan flexible hose — kuningan krom dan selang stainless 40 cm", "Seal dan karet penyekat — sesuai fixture", SEAL_TAPE]
        : v.kj.id === "service" ? ["Seal, karet, dan packing — satu set sesuai unit", "Cairan pembersih dan penghilang kerak", SEAL_TAPE, MAJUN]
          : [
            `${v.sn.nama[0].toUpperCase()}${v.sn.nama.slice(1)} — mutu marine, lengkap kelengkapan bawaan`,
            "Flexible hose dan kran — stainless 40 cm, kran kuningan",
            "Pipa dan sambungan buangan — PVC tekanan kerja 10 bar (tipe AW)",
            "Seal dan baut pengikat — sesuai fixture", SEALANT,
          ],
}];

/* ── tata udara & ventilasi ──────────────────────────────────────────── */

const AC = [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 5].map((p) => ({ id: String(p).replace(".", ""), nama: `${p} PK`, pk: p }));
const TIPE_AC = [
  { id: "split", nama: "AC split", f: 1 },
  { id: "cassette", nama: "AC cassette", f: 1.6 },
  { id: "standing", nama: "AC standing floor", f: 1.5 },
  { id: "window", nama: "AC window", f: 0.85 },
];
const KERJA_AC = [
  { id: "cuci", nama: "Cuci dan servis", f: 0.045, jam: 3 },
  { id: "freon", nama: "Isi ulang freon", f: 0.12, jam: 2 },
  { id: "kompresor", nama: "Ganti kompresor", f: 0.45, jam: 8 },
  { id: "ganti", nama: "Ganti unit", f: 1, jam: 8 },
  { id: "evap", nama: "Ganti evaporator", f: 0.32, jam: 6 },
  { id: "kond", nama: "Ganti kondensor", f: 0.35, jam: 6 },
  { id: "bocor", nama: "Perbaikan kebocoran dan pengelasan pipa", f: 0.14, jam: 5 },
];

export const POLA_AC: Pola[] = [{
  kode: "HVC",
  kategori: "Perbaikan — Tata Udara",
  dimensi: { tp: TIPE_AC, ac: AC, kj: KERJA_AC },
  sah: (v) => !(v.tp.id === "window" && v.ac.pk > 2) && !(v.tp.id === "cassette" && v.ac.pk < 1.5),
  nama: (v) => `${v.kj.nama} ${v.tp.nama} ${v.ac.nama}`,
  spek: (v) =>
    v.kj.id === "cuci" ? "Unit dicuci menyeluruh, tekanan freon dicek, suhu keluar diukur dan dilaporkan"
      : "Unit dingin normal, tekanan kerja sesuai spesifikasi, tidak bocor dan arus terukur wajar",
  satuan: () => "Unit",
  harga: (v) => (2_850_000 + v.ac.pk * 2_400_000) * v.tp.f * v.kj.f + (UPAH.teknisi / 8) * v.kj.jam,
  bahan: (v) =>
    v.kj.id === "cuci" ? ["Cairan pembersih evaporator dan kondensor — 1 liter", "Freon R32 penambah — bila tekanan kurang", MAJUN]
      : v.kj.id === "freon" ? ["Freon R32 — sesuai kapasitas unit", "Nitrogen pengetesan dan alat manifold — sewa alat", MAJUN]
        : v.kj.id === "bocor" ? ["Pipa tembaga — sesuai diameter jalur, lengkap isolasi", "Kawat las perak dan flux — untuk sambungan tembaga", "Freon R32 pengisian ulang", MAJUN]
          : [
            v.kj.id === "ganti" ? `${v.tp.nama} ${v.ac.nama} — lengkap unit dalam, unit luar, dan braket`
              : `${v.kj.nama.replace("Ganti ", "")} — sesuai tipe dan kapasitas ${v.ac.nama}`,
            "Pipa tembaga dan isolasi — sesuai panjang instalasi",
            "Freon R32 — sesuai kapasitas unit",
            "Kabel dan braket pemasangan — NYM 3 x 1.5 mm dan braket besi", MAJUN,
          ],
}];

const VENTILASI = [
  { id: "blower-mesin", nama: "blower ventilasi ruang mesin", dasar: 14_500_000 },
  { id: "exhaust", nama: "exhaust fan", dasar: 1_850_000 },
  { id: "kipas-dinding", nama: "kipas dinding", dasar: 685_000 },
  { id: "kipas-plafon", nama: "kipas plafon", dasar: 850_000 },
  { id: "ducting", nama: "ducting ventilasi", dasar: 2_450_000 },
  { id: "louver", nama: "louver dan kisi-kisi ventilasi", dasar: 1_650_000 },
  { id: "damper", nama: "fire damper ventilasi", dasar: 4_200_000 },
  { id: "kulkas", nama: "lemari pendingin (kulkas) provisi", dasar: 6_800_000 },
  { id: "freezer", nama: "freezer provisi", dasar: 9_500_000 },
  { id: "coldstore", nama: "cold storage provisi", dasar: 38_000_000 },
];
const KERJA_VENT = [
  { id: "ganti", nama: "Ganti unit", f: 1, jam: 8 },
  { id: "service", nama: "Servis dan pembersihan", f: 0.09, jam: 5 },
  { id: "bearing", nama: "Ganti bantalan dan kapasitor", f: 0.14, jam: 5 },
  { id: "uji", nama: "Uji fungsi dan pengukuran aliran udara", f: 0.04, jam: 3 },
];

export const POLA_VENTILASI: Pola[] = [{
  kode: "VNT",
  kategori: "Perbaikan — Tata Udara",
  dimensi: { vn: VENTILASI, kj: KERJA_VENT },
  sah: (v) => !(v.kj.id === "bearing" && ["ducting", "louver", "damper", "coldstore"].includes(v.vn.id)),
  nama: (v) => `${v.kj.nama} ${v.vn.nama}`,
  spek: (v) =>
    v.kj.id === "uji" ? "Aliran udara diukur dan dibandingkan kebutuhan ruang, hasil dicatat"
      : "Berputar tanpa getaran berlebih, arus terukur wajar, aliran udara sesuai kebutuhan ruang",
  satuan: () => "Unit",
  harga: (v) => v.vn.dasar * v.kj.f + (UPAH.teknisi / 8) * v.kj.jam,
  bahan: (v) =>
    v.kj.id === "service" ? ["Cairan pembersih dan degreaser — 5 liter", "Gemuk (grease) — lithium EP2, tahan sampai 130 derajat C, 1 kg", MAJUN]
      : v.kj.id === "bearing" ? ["Bantalan (bearing) — sepasang, sesuai nomor pabrikan", "Kapasitor motor — sesuai daya", "Gemuk (grease) — lithium EP2, tahan sampai 130 derajat C, 1 kg"]
        : v.kj.id === "uji" ? ["Anemometer — kalibrasi berlaku", "Lembar hasil pengukuran", MAJUN]
          : [
            `${v.vn.nama[0].toUpperCase()}${v.vn.nama.slice(1)} — mutu marine, tahan lembap dan getar`,
            "Kabel dan braket pemasangan — NYM sesuai daya, braket besi",
            "Baut dan karet peredam getar — stainless", CAT_BESI,
          ],
}];
