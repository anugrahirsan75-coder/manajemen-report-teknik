/** Alat keselamatan, pemadam, navigasi, dan komunikasi. */
import { Pola, MAJUN, CAT_BESI, SEAL_TAPE, ISOLASI, UPAH } from "../pola";

/* ── APAR ────────────────────────────────────────────────────────────── */

const APAR = [
  { id: "dcp", nama: "APAR dry chemical powder", isi: 30_000, kap: [3, 6, 9, 12, 25, 50] },
  { id: "co2", nama: "APAR CO2", isi: 55_000, kap: [3, 6, 9, 25] },
  { id: "foam", nama: "APAR foam AFFF", isi: 48_000, kap: [6, 9, 25, 50] },
  { id: "mist", nama: "APAR water mist", isi: 70_000, kap: [6, 9] },
  { id: "clean", nama: "APAR clean agent", isi: 150_000, kap: [3, 6, 9] },
];
const KAP_APAR = [3, 6, 9, 12, 25, 50].map((k) => ({ id: `${k}kg`, nama: `${k} kg`, kg: k }));
const KERJA_APAR = [
  { id: "isi", nama: "Isi ulang", f: 1, jam: 1 },
  { id: "hydro", nama: "Uji tekan (hydrotest) 5 tahunan", f: 1.6, jam: 2 },
  { id: "ganti", nama: "Ganti unit", f: 4.2, jam: 1 },
  { id: "selang", nama: "Ganti selang dan nozzle", f: 1.1, jam: 1 },
  { id: "periksa", nama: "Pemeriksaan tahunan", f: 0.35, jam: 0.5 },
];

export const POLA_APAR: Pola[] = [{
  kode: "APR",
  kategori: "Perbaikan — Keselamatan",
  dimensi: { ap: APAR, kp: KAP_APAR, kj: KERJA_APAR },
  sah: (v) => v.ap.kap.includes(v.kp.kg),
  nama: (v) => `${v.kj.nama} ${v.ap.nama} ${v.kp.nama}`,
  spek: (v) =>
    v.kj.id === "hydro" ? "Tabung diuji tekan sesuai standar, diberi tanggal uji dan disertai sertifikat"
      : v.kj.id === "periksa" ? "Tekanan, segel, selang, dan berat diperiksa; kartu periksa diperbarui dan ditandatangani"
        : "Tabung terisi penuh, tekanan pada zona hijau, segel dan pin terpasang, kartu periksa diperbarui",
  satuan: () => "Unit",
  harga: (v) => v.ap.isi * v.kp.kg * v.kj.f + (UPAH.teknisi / 8) * v.kj.jam,
  bahan: (v) =>
    v.kj.id === "ganti" ? [`${v.ap.nama} ${v.kp.nama} — bersertifikat, lengkap braket dinding`, "Kartu periksa dan segel — satu set", "Braket dan baut dinding — galvanis"]
      : v.kj.id === "hydro" ? ["Jasa uji tekan tabung — bengkel bersertifikat, lengkap sertifikat", "Seal dan pin pengaman — satu set", `Isi ulang ${v.ap.nama} ${v.kp.nama}`]
        : v.kj.id === "selang" ? ["Selang dan horn/nozzle APAR — sesuai tipe tabung", "Seal dan pin pengaman — satu set"]
          : v.kj.id === "periksa" ? ["Kartu periksa dan segel — satu set", "Timbangan dan alat ukur tekanan — kalibrasi berlaku", MAJUN]
            : [`Isi ulang ${v.ap.nama} — ${v.kp.nama}, sesuai standar`, "Seal dan pin pengaman — satu set", "Kartu periksa APAR — diperbarui"],
}];

/* ── pemadam tetap & hidran ──────────────────────────────────────────── */

const PEMADAM = [
  { id: "selang15", nama: "selang pemadam 1.5 inci x 20 m", dasar: 1_650_000 },
  { id: "selang25", nama: "selang pemadam 2.5 inci x 20 m", dasar: 2_450_000 },
  { id: "selang30", nama: "selang pemadam 2.5 inci x 30 m", dasar: 3_250_000 },
  { id: "nozzle", nama: "nozzle jet/spray", dasar: 1_150_000 },
  { id: "kopling", nama: "kopling machino", dasar: 485_000 },
  { id: "box", nama: "hydrant box lengkap", dasar: 4_800_000 },
  { id: "intbox", nama: "international shore connection", dasar: 2_650_000 },
  { id: "co2sys", nama: "instalasi pemadam CO2 ruang mesin", dasar: 125_000_000 },
  { id: "foamsys", nama: "instalasi pemadam foam", dasar: 78_000_000 },
  { id: "sprinkler", nama: "instalasi sprinkler", dasar: 62_000_000 },
  { id: "detektor", nama: "detektor asap", dasar: 850_000 },
  { id: "detpanas", nama: "detektor panas", dasar: 780_000 },
  { id: "detapi", nama: "detektor nyala api", dasar: 6_800_000 },
  { id: "mcp", nama: "manual call point", dasar: 685_000 },
  { id: "bell", nama: "bel alarm kebakaran", dasar: 950_000 },
  { id: "panelfire", nama: "panel fire alarm", dasar: 24_500_000 },
  { id: "genalarm", nama: "general alarm", dasar: 12_500_000 },
];
const KERJA_PEMADAM = [
  { id: "ganti", nama: "Ganti", f: 1, jam: 5 },
  { id: "uji", nama: "Uji fungsi dan uji tekan", f: 0.07, jam: 4 },
  { id: "service", nama: "Servis dan kalibrasi", f: 0.11, jam: 6 },
];

export const POLA_PEMADAM: Pola[] = [{
  kode: "PMD",
  kategori: "Perbaikan — Keselamatan",
  dimensi: { pd: PEMADAM, kj: KERJA_PEMADAM },
  nama: (v) => `${v.kj.nama} ${v.pd.nama}`,
  spek: (v) =>
    v.kj.id === "uji" ? "Diuji fungsi penuh dan pada tekanan kerja, hasil dicatat dalam berita acara"
      : v.kj.id === "service" ? "Diservis dan dikalibrasi oleh teknisi bersertifikat, laporan hasil diserahkan"
        : "Terpasang sesuai gambar keselamatan, diuji fungsi, dan dicatat dalam buku perawatan",
  satuan: () => "Unit",
  harga: (v) => v.pd.dasar * v.kj.f + (UPAH.teknisi / 8) * v.kj.jam,
  bahan: (v) =>
    v.kj.id === "uji" ? ["Pompa uji tekan dan manometer — kalibrasi berlaku", "Lembar hasil uji dan berita acara", MAJUN]
      : v.kj.id === "service" ? ["Jasa teknisi bersertifikat — lengkap laporan servis", "Suku cadang dan seal penggantian — sesuai tipe", MAJUN]
        : [
          `${v.pd.nama[0].toUpperCase()}${v.pd.nama.slice(1)} — bersertifikat dan sesuai gambar keselamatan`,
          "Kopling, seal, dan baut pemasangan — kuningan/galvanis",
          "Kabel dan klem instalasi — bila unit berlistrik", SEAL_TAPE,
        ],
}];

/* ── alat penolong ───────────────────────────────────────────────────── */

const PENOLONG = [
  { id: "liferaft", nama: "inflatable liferaft", dasar: 32_000_000, kap: true },
  { id: "sekoci", nama: "sekoci penolong", dasar: 165_000_000, kap: true },
  { id: "davit", nama: "davit sekoci", dasar: 78_000_000, kap: false },
  { id: "hru", nama: "hydrostatic release unit (HRU)", dasar: 1_850_000, kap: false },
  { id: "lifejacket", nama: "lifejacket dewasa", dasar: 385_000, kap: false },
  { id: "lifejacket-anak", nama: "lifejacket anak", dasar: 345_000, kap: false },
  { id: "lifejacket-bayi", nama: "lifejacket bayi", dasar: 425_000, kap: false },
  { id: "lifebuoy", nama: "lifebuoy (pelampung cincin)", dasar: 685_000, kap: false },
  { id: "lifebuoy-lampu", nama: "lampu apung lifebuoy", dasar: 1_150_000, kap: false },
  { id: "smoke", nama: "smoke signal lifebuoy", dasar: 1_850_000, kap: false },
  { id: "immersion", nama: "immersion suit", dasar: 4_200_000, kap: false },
  { id: "eebd", nama: "EEBD (alat bantu napas darurat)", dasar: 8_500_000, kap: false },
  { id: "scba", nama: "SCBA lengkap", dasar: 24_500_000, kap: false },
  { id: "fireman", nama: "fireman outfit lengkap", dasar: 18_500_000, kap: false },
  { id: "parachute", nama: "parachute signal", dasar: 1_250_000, kap: false },
  { id: "handflare", nama: "hand flare", dasar: 485_000, kap: false },
  { id: "smokefloat", nama: "smoke float", dasar: 1_450_000, kap: false },
  { id: "linethrow", nama: "line throwing appliance", dasar: 9_800_000, kap: false },
  { id: "rambu", nama: "rambu keselamatan fotoluminesen", dasar: 125_000, kap: false },
  { id: "muster", nama: "papan muster list dan denah evakuasi", dasar: 1_650_000, kap: false },
];
const KAP_RAKIT = [6, 10, 12, 15, 20, 25, 30, 50].map((k) => ({ id: `k${k}`, nama: `kapasitas ${k} orang`, k }));
const KERJA_PENOLONG = [
  { id: "ganti", nama: "Ganti", f: 1, jam: 4 },
  { id: "service", nama: "Servis dan pemeriksaan tahunan", f: 0.14, jam: 6 },
  { id: "rawat", nama: "Perawatan, pengecatan, dan ganti pita reflektif", f: 0.09, jam: 3 },
  { id: "uji", nama: "Uji fungsi dan uji beban", f: 0.06, jam: 5 },
];

export const POLA_PENOLONG: Pola[] = [{
  kode: "PNG",
  kategori: "Perbaikan — Keselamatan",
  dimensi: { pn: PENOLONG, kp: KAP_RAKIT, kj: KERJA_PENOLONG },
  sah: (v) =>
    (v.pn.kap ? true : v.kp.id === "k10") &&
    !(v.kj.id === "uji" && !["sekoci", "davit", "linethrow", "scba", "liferaft"].includes(v.pn.id)) &&
    !(v.kj.id === "service" && ["rambu", "muster", "parachute", "handflare", "smokefloat"].includes(v.pn.id)) &&
    !(v.kj.id === "rawat" && ["parachute", "handflare", "smokefloat", "hru", "eebd"].includes(v.pn.id)),
  nama: (v) => `${v.kj.nama} ${v.pn.nama}${v.pn.kap ? ` ${v.kp.nama}` : ""}`,
  spek: (v) =>
    v.kj.id === "service" ? "Diservis di stasiun resmi, sertifikat dan berita acara diserahkan, perlengkapan kedaluwarsa diganti"
      : v.kj.id === "uji" ? "Diuji beban dan fungsi penuh sesuai aturan SOLAS, hasil dicatat dan disaksikan"
        : v.kj.id === "rawat" ? "Bersih dan dicat ulang, nama kapal terbaca, pita reflektif SOLAS diganti"
          : "Bersertifikat SOLAS dan masa berlaku baru, terpasang sesuai denah keselamatan",
  satuan: () => "Unit",
  harga: (v) => v.pn.dasar * (v.pn.kap ? 0.55 + v.kp.k / 22 : 1) * v.kj.f + (UPAH.teknisi / 8) * v.kj.jam,
  bahan: (v) =>
    v.kj.id === "service" ? ["Jasa stasiun servis resmi — lengkap sertifikat", "Penggantian perlengkapan kedaluwarsa — ransum, pyrotechnics, baterai", "HRU baru bila jatuh tempo"]
      : v.kj.id === "rawat" ? ["Cat marine — putih dan oranye, 1 liter", "Pita reflektif — memenuhi SOLAS, memantul dari jarak 100 m", "Tali pegangan (grab line) — PP 10 mm"]
        : v.kj.id === "uji" ? ["Beban uji dan dinamometer — sewa alat", "Lembar hasil uji dan berita acara", MAJUN]
          : [
            `${v.pn.nama[0].toUpperCase()}${v.pn.nama.slice(1)}${v.pn.kap ? ` ${v.kp.nama}` : ""} — bersertifikat SOLAS, masa berlaku baru`,
            "Braket, tali, dan baut pemasangan — stainless",
            "Pita reflektif dan penandaan nama kapal — SOLAS grade",
          ],
}];

/* ── navigasi & komunikasi ───────────────────────────────────────────── */

const NAVIGASI = [
  { id: "radar-x", nama: "radar X-band", dasar: 125_000_000, ant: true, bat: false },
  { id: "radar-s", nama: "radar S-band", dasar: 185_000_000, ant: true, bat: false },
  { id: "gps", nama: "GPS navigator", dasar: 12_500_000, ant: true, bat: true },
  { id: "plotter", nama: "GPS chart plotter", dasar: 32_000_000, ant: true, bat: false },
  { id: "echo", nama: "echosounder", dasar: 24_500_000, ant: true, bat: false },
  { id: "ais", nama: "AIS kelas A", dasar: 38_000_000, ant: true, bat: false },
  { id: "vhf", nama: "radio VHF DSC", dasar: 14_500_000, ant: true, bat: true },
  { id: "ssb", nama: "radio MF/HF SSB", dasar: 68_000_000, ant: true, bat: true },
  { id: "navtex", nama: "NAVTEX receiver", dasar: 28_000_000, ant: true, bat: false },
  { id: "epirb", nama: "EPIRB", dasar: 18_500_000, ant: false, bat: true },
  { id: "sart", nama: "SART", dasar: 14_500_000, ant: false, bat: true },
  { id: "kompas", nama: "kompas magnet", dasar: 16_500_000, ant: false, bat: false },
  { id: "gyro", nama: "gyro compass", dasar: 145_000_000, ant: false, bat: false },
  { id: "autopilot", nama: "autopilot", dasar: 78_000_000, ant: false, bat: false },
  { id: "bnwas", nama: "BNWAS", dasar: 22_500_000, ant: false, bat: false },
  { id: "vdr", nama: "VDR / S-VDR", dasar: 165_000_000, ant: false, bat: true },
  { id: "anemo", nama: "anemometer", dasar: 18_500_000, ant: true, bat: false },
  { id: "log", nama: "speed log", dasar: 32_000_000, ant: false, bat: false },
  { id: "rai", nama: "rudder angle indicator", dasar: 9_800_000, ant: false, bat: false },
  { id: "telegraph", nama: "engine telegraph", dasar: 24_500_000, ant: false, bat: false },
  { id: "horn", nama: "suling kapal (horn)", dasar: 16_500_000, ant: false, bat: false },
  { id: "ht", nama: "radio genggam (HT) tahan air", dasar: 4_800_000, ant: true, bat: true },
  { id: "inmarsat", nama: "terminal Inmarsat", dasar: 95_000_000, ant: true, bat: false },
  { id: "clock", nama: "jam anjungan dan barometer", dasar: 3_450_000, ant: false, bat: true },
];
const KERJA_NAV = [
  { id: "ganti", nama: "Ganti unit", f: 1, jam: 10 },
  { id: "service", nama: "Servis dan kalibrasi", f: 0.09, jam: 8 },
  { id: "antena", nama: "Ganti antena / transduser", f: 0.16, jam: 6 },
  { id: "baterai", nama: "Ganti baterai", f: 0.07, jam: 2 },
  { id: "uji", nama: "Uji fungsi dan sertifikasi radio", f: 0.05, jam: 5 },
];

export const POLA_NAVIGASI: Pola[] = [{
  kode: "NAV",
  kategori: "Perbaikan — Navigasi & Komunikasi",
  dimensi: { nv: NAVIGASI, kj: KERJA_NAV },
  sah: (v) => !(v.kj.id === "antena" && !v.nv.ant) && !(v.kj.id === "baterai" && !v.nv.bat),
  nama: (v) => `${v.kj.nama} ${v.nv.nama}`,
  spek: (v) =>
    v.kj.id === "uji" ? "Diuji oleh teknisi berlisensi, hasil dan sertifikat radio/navigasi diserahkan"
      : v.kj.id === "service" ? "Diservis dan dikalibrasi, penyimpangan dicatat dan disetel ke batas yang diizinkan"
        : v.kj.id === "baterai" ? "Baterai baru dengan masa berlaku tercetak, tanggal jatuh tempo dicatat di kapal"
          : "Bersertifikat dan sesuai daftar alat navigasi kapal, diuji fungsi penuh dari anjungan",
  satuan: () => "Unit",
  harga: (v) => v.nv.dasar * v.kj.f + (UPAH.ahli / 8) * v.kj.jam,
  bahan: (v) =>
    v.kj.id === "baterai" ? [`Baterai ${v.nv.nama} — asli pabrikan, masa berlaku baru`, "Seal dan gasket penutup — sesuai unit", "Label tanggal jatuh tempo"]
      : v.kj.id === "antena" ? [`Antena / transduser ${v.nv.nama} — sesuai tipe unit`, "Kabel koaksial dan konektor — sesuai panjang jalur", "Braket dan baut pemasangan — stainless", ISOLASI]
        : v.kj.id === "service" ? ["Jasa teknisi berlisensi — lengkap laporan servis", "Suku cadang dan seal penggantian — sesuai tipe", MAJUN]
          : v.kj.id === "uji" ? ["Jasa pengujian dan sertifikasi — pihak berlisensi", "Lembar hasil uji dan sertifikat"]
            : [
              `${v.nv.nama[0].toUpperCase()}${v.nv.nama.slice(1)} — bersertifikat, lengkap unit tampil dan sensor`,
              "Kabel daya dan data — sesuai panjang jalur, lengkap konektor",
              "Braket dan baut pemasangan — stainless",
              "Jasa pemasangan dan sertifikasi — teknisi berlisensi", ISOLASI,
            ],
}];
