/** Kelistrikan kapal — penerangan, kabel, panel, motor, generator, baterai. */
import { Pola, ISOLASI, MAJUN, CAT_BESI, UPAH } from "../pola";

/* ── penerangan ───────────────────────────────────────────────────────── */

const LAMPU = [
  { id: "bulb", nama: "lampu LED bulb", spek: "fitting E27, 220 V", dasar: 55_000, daya: true },
  { id: "tl", nama: "lampu LED tube (TL)", spek: "tabung T8, 220 V, lengkap rumah", dasar: 95_000, daya: true },
  { id: "sorot", nama: "lampu sorot (floodlight)", spek: "tahan debu dan semprotan air (IP65), badan aluminium, 220 V", dasar: 285_000, daya: true },
  { id: "baret", nama: "lampu baret plafon", spek: "tahan cipratan air (IP44), kaca buram, 220 V", dasar: 145_000, daya: true },
  { id: "kedap", nama: "lampu kedap air ruang mesin", spek: "tahan rendaman air sementara (IP67), badan aluminium, kaca temper", dasar: 620_000, daya: true },
  { id: "darurat", nama: "lampu darurat (emergency)", spek: "baterai cadangan minimal 3 jam, otomatis nyala", dasar: 385_000, daya: false },
  { id: "nav-hal", nama: "lampu navigasi haluan (masthead)", spek: "putih 225 derajat, bersertifikat", dasar: 2_450_000, daya: false },
  { id: "nav-ka", nama: "lampu navigasi lambung kanan", spek: "hijau 112.5 derajat, bersertifikat", dasar: 1_850_000, daya: false },
  { id: "nav-ki", nama: "lampu navigasi lambung kiri", spek: "merah 112.5 derajat, bersertifikat", dasar: 1_850_000, daya: false },
  { id: "nav-bur", nama: "lampu navigasi buritan", spek: "putih 135 derajat, bersertifikat", dasar: 1_650_000, daya: false },
  { id: "nav-jkr", nama: "lampu jangkar", spek: "putih keliling 360 derajat, bersertifikat", dasar: 1_750_000, daya: false },
  { id: "nav-nuc", nama: "lampu NUC (tidak terkendali)", spek: "merah keliling 360 derajat, sepasang", dasar: 2_150_000, daya: false },
  { id: "morse", nama: "lampu morse / aldis", spek: "lengkap tombol morse dan baterai", dasar: 3_250_000, daya: false },
  { id: "cari", nama: "lampu sorot cari (searchlight)", spek: "dapat diputar, jangkauan minimal 300 m", dasar: 6_800_000, daya: false },
  { id: "geladak", nama: "lampu penerangan geladak kendaraan", spek: "tahan debu dan semprotan air (IP65), tahan getar dan air laut", dasar: 745_000, daya: true },
];

const DAYA = [
  { id: "10w", nama: "10 W", f: 0.6 }, { id: "20w", nama: "20 W", f: 0.85 },
  { id: "30w", nama: "30 W", f: 1 }, { id: "50w", nama: "50 W", f: 1.35 },
  { id: "100w", nama: "100 W", f: 2 }, { id: "150w", nama: "150 W", f: 2.7 },
  { id: "200w", nama: "200 W", f: 3.4 },
];

const KERJA_LAMPU = [
  { id: "ganti", nama: "Ganti", f: 1, jam: 2 },
  { id: "armatur", nama: "Ganti armatur lengkap dan instalasi", f: 1.35, jam: 4 },
  { id: "fitting", nama: "Perbaikan fitting dan kabel", f: 0.25, jam: 3 },
  { id: "uji", nama: "Pemeriksaan nyala dan pengukuran arus", f: 0.05, jam: 1.5 },
];

export const POLA_LAMPU: Pola[] = [{
  kode: "LMP",
  kategori: "Perbaikan — Kelistrikan & Penerangan",
  dimensi: { lp: LAMPU, dy: DAYA, kj: KERJA_LAMPU },
  sah: (v) => (v.lp.daya ? true : v.dy.id === "30w"),
  nama: (v) => `${v.kj.nama} ${v.lp.nama}${v.lp.daya ? ` ${v.dy.nama}` : ""}`,
  spek: (v) => {
    if (v.kj.id === "uji") return "Nyala diperiksa, arus diukur, hasil dicatat dan penyimpangan dilaporkan";
    if (v.kj.id === "fitting") return "Fitting dan sambungan kabel diganti, kabel diklem rapi, diuji nyala";
    if (v.lp.id.startsWith("nav")) return `Lampu bersertifikat terpasang pada dudukan semula, ${v.lp.spek}, diuji nyala dari anjungan`;
    return `Lampu menyala normal, ${v.lp.spek}, dudukan kencang dan kabel dirapikan dalam klem`;
  },
  satuan: (v) => (v.kj.id === "armatur" ? "Titik" : "Unit"),
  harga: (v) => v.lp.dasar * (v.lp.daya ? v.dy.f : 1) * v.kj.f + (UPAH.teknisi / 8) * v.kj.jam,
  bahan: (v) => {
    const unit = `${v.lp.nama[0].toUpperCase()}${v.lp.nama.slice(1)}${v.lp.daya ? ` ${v.dy.nama}` : ""} — ${v.lp.spek}`;
    if (v.kj.id === "uji") return ["Alat ukur (tang ampere dan multimeter) — kalibrasi berlaku", MAJUN];
    if (v.kj.id === "fitting") return ["Fitting lampu — keramik/PVC tahan panas", "Kabel NYM 2 x 1.5 mm — SNI", "Klem kabel — PVC, sekrup", ISOLASI];
    if (v.kj.id === "armatur") return [unit, "Kabel NYM 3 x 1.5 mm — SNI", "Klem kabel dan kotak sambung — PVC tahan air", "Baut dan fischer — sesuai dudukan", ISOLASI];
    return [unit, "Fitting dan karet penyekat — sesuai tipe lampu", ISOLASI];
  },
}];

/* ── kabel & instalasi ────────────────────────────────────────────────── */

const KABEL = [
  { id: "nym", nama: "NYM", spek: "SNI, inti tembaga, selubung PVC ganda", f: 1, min: 1.5, maks: 16 },
  { id: "nyy", nama: "NYY", spek: "SNI, inti tembaga, tahan tanam dan lembap", f: 1.25, min: 1.5, maks: 95 },
  { id: "nya", nama: "NYA", spek: "SNI, inti tunggal, dipasang dalam pipa", f: 0.55, min: 1.5, maks: 50 },
  { id: "nyaf", nama: "NYAF", spek: "serabut lentur, untuk panel", f: 0.7, min: 1.5, maks: 25 },
  { id: "frc", nama: "marine FRC tahan api", spek: "tidak merambatkan api (IEC 60332), tetap berfungsi 3 jam dalam kebakaran, berselubung baja", f: 3.4, min: 2.5, maks: 95 },
  { id: "ktrl", nama: "kabel kontrol berpelindung", spek: "berperisai (screened), inti banyak", f: 1.9, min: 1.5, maks: 6 },
];

const LUAS = [
  { id: "15", nama: "1.5 mm2", mm2: 1.5, dasar: 9_500 }, { id: "25", nama: "2.5 mm2", mm2: 2.5, dasar: 14_500 },
  { id: "4", nama: "4 mm2", mm2: 4, dasar: 22_000 }, { id: "6", nama: "6 mm2", mm2: 6, dasar: 32_000 },
  { id: "10", nama: "10 mm2", mm2: 10, dasar: 52_000 }, { id: "16", nama: "16 mm2", mm2: 16, dasar: 82_000 },
  { id: "25", nama: "25 mm2", mm2: 25, dasar: 128_000 }, { id: "35", nama: "35 mm2", mm2: 35, dasar: 178_000 },
  { id: "50", nama: "50 mm2", mm2: 50, dasar: 248_000 }, { id: "70", nama: "70 mm2", mm2: 70, dasar: 345_000 },
  { id: "95", nama: "95 mm2", mm2: 95, dasar: 465_000 },
];

const KERJA_KABEL = [
  { id: "baru", nama: "Tarik jalur kabel baru", sat: "m", f: 1.1, jam: 0.18 },
  { id: "ganti", nama: "Ganti jalur kabel", sat: "m", f: 1.1, jam: 0.26 },
  { id: "skun", nama: "Ganti skun dan terminasi kabel", sat: "Titik", f: 0.08, jam: 0.9 },
  { id: "megger", nama: "Uji tahanan isolasi (megger) jalur kabel", sat: "Jalur", f: 0.02, jam: 1.2 },
];

export const POLA_KABEL: Pola[] = [{
  kode: "KBL",
  kategori: "Perbaikan — Kabel & Instalasi",
  dimensi: { kb: KABEL, ls: LUAS, kj: KERJA_KABEL },
  sah: (v) => v.ls.mm2 >= v.kb.min && v.ls.mm2 <= v.kb.maks,
  nama: (v) => `${v.kj.nama} ${v.kb.nama} ${v.ls.nama}`,
  spek: (v) => {
    if (v.kj.id === "megger") return "Tahanan isolasi minimal 1 M-ohm, hasil pengukuran dicatat per inti";
    if (v.kj.id === "skun") return "Skun dipres, terminal dikencangkan, sambungan tidak panas saat dibebani";
    return `Kabel ${v.kb.spek}, diklem tiap 30 cm, diberi label jalur, diuji tahanan isolasi`;
  },
  satuan: (v) => v.kj.sat,
  harga: (v) => v.ls.dasar * v.kb.f * v.kj.f + UPAH.teknisi * v.kj.jam * (1 + v.ls.mm2 / 120),
  bahan: (v) => {
    if (v.kj.id === "megger") return ["Alat uji isolasi (megger) — 500/1000 V, kalibrasi berlaku", "Label penanda jalur", MAJUN];
    if (v.kj.id === "skun") return [`Skun kabel ${v.ls.nama} — tembaga berlapis timah`, "Selongsong bakar (heat shrink) — sesuai diameter", ISOLASI];
    return [
      `Kabel ${v.kb.nama} ${v.ls.nama} — ${v.kb.spek}`,
      "Klem kabel dan tray — klem PVC dan tray galvanis",
      `Skun kabel ${v.ls.nama} — tembaga berlapis timah`,
      "Label penanda jalur — tahan minyak dan air", ISOLASI,
    ];
  },
}];

/* ── panel & proteksi ─────────────────────────────────────────────────── */

const PROTEKSI = [
  { id: "mcb", nama: "MCB", spek: "pemutusan pada 5–10x arus nominal (kurva C), kapasitas putus 6 kA", dasar: 78_000, arus: [6, 10, 16, 20, 25, 32, 40, 63] },
  { id: "mccb", nama: "MCCB", spek: "dapat disetel, kapasitas putus 25 kA", dasar: 1_450_000, arus: [80, 100, 125, 160, 250, 400] },
  { id: "elcb", nama: "ELCB / RCBO", spek: "arus bocor 30 mA", dasar: 385_000, arus: [16, 25, 32, 40, 63] },
  { id: "kont", nama: "kontaktor", spek: "kumparan 220 V, AC-3", dasar: 425_000, arus: [9, 12, 18, 25, 32, 40, 65, 95] },
  { id: "ovl", nama: "thermal overload relay", spek: "dapat disetel, memutus dalam 10 detik pada 6x arus setelan", dasar: 315_000, arus: [6, 10, 16, 25, 40, 65] },
  { id: "fuse", nama: "sekring (fuse) dan dudukan", spek: "tipe NH, lengkap dudukan", dasar: 165_000, arus: [16, 25, 40, 63, 100, 160] },
];

const ARUS = [6, 9, 10, 12, 16, 18, 20, 25, 32, 40, 63, 65, 80, 95, 100, 125, 160, 250, 400]
  .map((a) => ({ id: String(a), nama: `${a} A`, a }));

export const POLA_PROTEKSI: Pola[] = [{
  kode: "PRT",
  kategori: "Perbaikan — Panel & Proteksi",
  dimensi: { pr: PROTEKSI, ar: ARUS },
  sah: (v) => v.pr.arus.includes(v.ar.a),
  nama: (v) => `Ganti ${v.pr.nama} ${v.ar.nama}`,
  spek: (v) => `${v.pr.spek}, terpasang pada rel panel, diuji pemutusan dan pembebanan`,
  satuan: () => "Unit",
  harga: (v) => v.pr.dasar * (0.55 + v.ar.a / 100) + (UPAH.teknisi / 8) * 2.5,
  bahan: (v) => [
    `${v.pr.nama} ${v.ar.nama} — ${v.pr.spek}`,
    "Kabel jumper dan skun — NYAF sesuai arus, skun berlapis timah",
    "Label penanda jalur — tahan minyak dan air", ISOLASI,
  ],
}];

const PANEL_KERJA = [
  { id: "bersih", nama: "Pembersihan dan pengencangan terminal panel", dasar: 950_000, jam: 6 },
  { id: "termo", nama: "Pemeriksaan termografi panel", dasar: 1_250_000, jam: 4 },
  { id: "ganti", nama: "Ganti box panel lengkap rakitan", dasar: 8_500_000, jam: 20 },
  { id: "busbar", nama: "Ganti busbar dan isolator panel", dasar: 3_200_000, jam: 12 },
  { id: "meter", nama: "Ganti alat ukur panel (ampere/volt meter)", dasar: 850_000, jam: 3 },
  { id: "pilot", nama: "Ganti lampu indikator dan tombol panel", dasar: 185_000, jam: 2 },
];
const PANEL = [
  { id: "utama", nama: "panel utama (MSB)", f: 1.9 },
  { id: "darurat", nama: "panel darurat (ESB)", f: 1.5 },
  { id: "distribusi", nama: "panel distribusi", f: 1 },
  { id: "penerangan", nama: "panel penerangan", f: 0.8 },
  { id: "mesin", nama: "panel ruang mesin", f: 1.2 },
  { id: "pompa", nama: "panel kendali pompa", f: 0.9 },
  { id: "anjungan", nama: "panel anjungan", f: 1.1 },
];

export const POLA_PANEL: Pola[] = [{
  kode: "PNL",
  kategori: "Perbaikan — Panel & Proteksi",
  dimensi: { pn: PANEL, kj: PANEL_KERJA },
  nama: (v) => `${v.kj.nama} — ${v.pn.nama}`,
  spek: (v) =>
    v.kj.id === "termo" ? "Seluruh sambungan dipotret termal saat berbeban, titik panas dilaporkan dengan foto"
      : v.kj.id === "bersih" ? "Panel bersih dari debu dan jelaga, seluruh terminal dikencangkan dengan kunci momen"
        : "Terpasang rapi dan berlabel, diuji berbeban tanpa panas berlebih",
  satuan: () => "Unit",
  harga: (v) => v.kj.dasar * v.pn.f + (UPAH.ahli / 8) * v.kj.jam,
  bahan: (v) =>
    v.kj.id === "bersih" ? ["Contact cleaner — 500 ml, aman untuk elektronik", "Kuas dan penyedot debu — sewa alat", "Label penanda jalur", MAJUN]
      : v.kj.id === "termo" ? ["Kamera termal — sewa alat, kalibrasi berlaku", "Lembar hasil pemeriksaan dan foto", MAJUN]
        : v.kj.id === "busbar" ? ["Busbar tembaga — sesuai arus panel", "Isolator penyangga busbar — resin, sesuai tegangan", "Baut dan mur — kuningan/stainless", MAJUN]
          : v.kj.id === "meter" ? ["Ampere meter dan volt meter — analog/digital, ketelitian 1,5 persen", "Trafo arus (CT) — rasio sesuai beban", "Kabel kontrol dan skun"]
            : v.kj.id === "pilot" ? ["Lampu indikator — LED 22 mm, merah/kuning/hijau", "Tombol tekan — 22 mm, NO/NC", ISOLASI]
              : ["Box panel — plat 1.6 mm, cat oven, tahan debu dan cipratan air (IP54)", "Rel DIN dan kanal kabel — satu set", "Komponen proteksi dan terminal — sesuai diagram", "Kabel NYAF dan skun — sesuai arus", "Label penanda jalur"],
}];

/* ── motor, generator, baterai ────────────────────────────────────────── */

const MOTOR_DAYA = [0.5, 1, 2, 3, 5, 7.5, 10, 15, 20, 30].map((h) => ({ id: String(h).replace(".", ""), nama: `${h} HP`, hp: h }));
const KERJA_MOTOR = [
  { id: "ganti", nama: "Ganti motor listrik", f: 1, jam: 6 },
  { id: "rewind", nama: "Gulung ulang (rewinding) motor listrik", f: 0.45, jam: 16 },
  { id: "bearing", nama: "Ganti bantalan motor listrik", f: 0.12, jam: 6 },
  { id: "megger", nama: "Uji tahanan isolasi dan arus motor listrik", f: 0.03, jam: 2 },
];

export const POLA_MOTOR: Pola[] = [{
  kode: "MTR",
  kategori: "Perbaikan — Motor & Generator",
  dimensi: { dy: MOTOR_DAYA, kj: KERJA_MOTOR },
  nama: (v) => `${v.kj.nama} ${v.dy.nama}`,
  spek: (v) =>
    v.kj.id === "megger" ? "Tahanan isolasi minimal 1 M-ohm dan arus tiap fasa seimbang, hasil dicatat"
      : v.kj.id === "rewind" ? "Gulungan baru sesuai data pabrikan, diuji isolasi dan jalan tanpa beban 1 jam"
        : "Motor berputar tanpa getaran berlebih, arus tiap fasa seimbang, suhu normal",
  satuan: () => "Unit",
  harga: (v) => (1_450_000 + v.dy.hp * 620_000) * v.kj.f + (UPAH.teknisi / 8) * v.kj.jam,
  bahan: (v) =>
    v.kj.id === "ganti" ? [`Motor listrik ${v.dy.nama} — 3 fasa 380 V, tertutup rapat tahan cipratan air (IP55), lengkap kaki dudukan`, "Kabel dan skun sambungan — sesuai arus motor", "Baut dudukan — baja kuat tarik 800 N/mm2, galvanis"]
      : v.kj.id === "rewind" ? ["Kawat email tembaga — tahan panas sampai 155 derajat C, diameter sesuai data gulungan", "Isolasi gulungan dan varnish — tahan panas sampai 155 derajat C", "Bantalan (bearing) — sepasang, sesuai nomor pabrikan", MAJUN]
        : v.kj.id === "bearing" ? ["Bantalan (bearing) — sepasang, sesuai nomor pabrikan", "Gemuk (grease) — lithium EP2, tahan sampai 130 derajat C, 1 kg", "Seal poros — sesuai diameter"]
          : ["Alat uji isolasi (megger) dan tang ampere — kalibrasi berlaku", MAJUN],
}];

const GENSET = [10, 20, 30, 50, 80, 100, 150, 200, 250].map((k) => ({ id: String(k), nama: `${k} kVA`, kva: k }));
const KERJA_GENSET = [
  { id: "service", nama: "Servis berkala genset", f: 0.035, jam: 8 },
  { id: "overhaul", nama: "Overhaul genset", f: 0.42, jam: 40 },
  { id: "avr", nama: "Ganti AVR genset", f: 0.06, jam: 4 },
  { id: "bearing", nama: "Ganti bantalan alternator genset", f: 0.05, jam: 8 },
  { id: "uji", nama: "Uji beban (load test) genset", f: 0.03, jam: 6 },
  { id: "radiator", nama: "Ganti dan bersihkan radiator genset", f: 0.09, jam: 10 },
];

export const POLA_GENSET: Pola[] = [{
  kode: "GEN",
  kategori: "Perbaikan — Motor & Generator",
  dimensi: { gs: GENSET, kj: KERJA_GENSET },
  nama: (v) => `${v.kj.nama} ${v.gs.nama}`,
  spek: (v) =>
    v.kj.id === "uji" ? "Diuji 25/50/75/100% beban tiap 30 menit, tegangan dan frekuensi tercatat stabil"
      : v.kj.id === "service" ? "Oli, filter, dan air pendingin diganti, hasil pemeriksaan dicatat di kartu perawatan"
        : "Genset jalan stabil, tegangan dan frekuensi sesuai, tanpa bocor dan panas berlebih",
  satuan: () => "Unit",
  harga: (v) => (18_000_000 + v.gs.kva * 1_250_000) * v.kj.f + (UPAH.ahli / 8) * v.kj.jam,
  bahan: (v) =>
    v.kj.id === "service" ? ["Oli mesin — SAE 15W-40 CH-4, sesuai kapasitas karter", "Filter oli, solar, dan udara — sesuai tipe mesin", "Air pendingin (coolant) — siap pakai, 20 liter", MAJUN]
      : v.kj.id === "overhaul" ? ["Gasket lengkap (overhaul kit) — sesuai tipe mesin", "Ring piston dan bearing — satu set sesuai nomor pabrikan", "Injektor dan nozzle — dikalibrasi ulang", "Oli, filter, dan coolant — satu set penggantian", MAJUN]
        : v.kj.id === "avr" ? ["AVR — sesuai tipe alternator", "Kabel kontrol dan skun", ISOLASI]
          : v.kj.id === "bearing" ? ["Bantalan alternator — sepasang, sesuai nomor pabrikan", "Gemuk (grease) — lithium EP2, tahan sampai 130 derajat C, 1 kg", MAJUN]
            : v.kj.id === "radiator" ? ["Radiator atau inti radiator — sesuai tipe mesin", "Selang radiator dan klem — sesuai diameter", "Air pendingin (coolant) — siap pakai, 20 liter"]
              : ["Bank beban (load bank) — sewa alat", "Solar untuk pengujian — sesuai lama uji", "Lembar hasil uji dan berita acara"],
}];

const AKI = [
  { id: "60", nama: "12 V 60 Ah", ah: 60 }, { id: "80", nama: "12 V 80 Ah", ah: 80 },
  { id: "100", nama: "12 V 100 Ah", ah: 100 }, { id: "120", nama: "12 V 120 Ah", ah: 120 },
  { id: "150", nama: "12 V 150 Ah", ah: 150 }, { id: "200", nama: "12 V 200 Ah", ah: 200 },
  { id: "24-100", nama: "24 V 100 Ah", ah: 100 }, { id: "24-200", nama: "24 V 200 Ah", ah: 200 },
];
const KERJA_AKI = [
  { id: "ganti", nama: "Ganti aki", f: 1, jam: 2 },
  { id: "charge", nama: "Isi ulang dan perawatan aki", f: 0.08, jam: 4 },
  { id: "terminal", nama: "Ganti terminal dan kabel aki", f: 0.12, jam: 2 },
  { id: "uji", nama: "Uji beban dan berat jenis aki", f: 0.04, jam: 1.5 },
  { id: "dudukan", nama: "Ganti dudukan dan kotak aki", f: 0.22, jam: 4 },
];

export const POLA_AKI: Pola[] = [{
  kode: "AKI",
  kategori: "Perbaikan — Motor & Generator",
  dimensi: { ak: AKI, kj: KERJA_AKI },
  nama: (v) => `${v.kj.nama} ${v.ak.nama}`,
  spek: (v) =>
    v.kj.id === "uji" ? "Tegangan berbeban dan berat jenis tiap sel diukur, hasil dicatat per sel"
      : "Aki terpasang kencang pada dudukan, terminal digrease, tegangan diukur dan dicatat",
  satuan: () => "Unit",
  harga: (v) => (v.ak.ah * 16_500 + 350_000) * v.kj.f + (UPAH.teknisi / 8) * v.kj.jam,
  bahan: (v) =>
    v.kj.id === "ganti" ? [`Aki ${v.ak.nama} — tipe menyesuaikan dudukan terpasang`, "Kabel aki dan skun — sesuai arus starter", "Gemuk terminal (grease) — anti korosi"]
      : v.kj.id === "charge" ? ["Air aki (accu zuur/air suling) — sesuai kebutuhan sel", "Charger aki — sewa alat", MAJUN]
        : v.kj.id === "terminal" ? ["Terminal aki — timah, sepasang", "Kabel aki — sesuai arus starter", "Gemuk terminal (grease) — anti korosi"]
          : v.kj.id === "dudukan" ? ["Kotak aki — plastik tahan asam, lengkap tutup", "Besi siku dudukan — 40 x 40 mm, tebal 4 mm", CAT_BESI, "Baut dan mur — galvanis"]
            : ["Hidrometer dan alat uji beban aki — kalibrasi berlaku", MAJUN],
}];
