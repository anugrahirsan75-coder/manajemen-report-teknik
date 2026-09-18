/** Pembersihan, penunjang docking, dan perbaikan fasilitas pelabuhan. */
import { Pola, MAJUN, CAT_BESI, KAWAT_LAS, OKSIGEN, GERINDA, SEALANT, UPAH } from "../pola";

/* ── pembersihan & perawatan rutin ───────────────────────────────────── */

const AREA_BERSIH = [
  { id: "gkend", nama: "geladak kendaraan", f: 1.2 },
  { id: "gutama", nama: "geladak utama", f: 1 },
  { id: "penumpang", nama: "ruang penumpang", f: 1 },
  { id: "kabin", nama: "kabin awak", f: 0.9 },
  { id: "kamar-mandi", nama: "kamar mandi", f: 1.3 },
  { id: "dapur", nama: "dapur (galley)", f: 1.35 },
  { id: "mesin", nama: "ruang mesin", f: 1.6 },
  { id: "bilga", nama: "bilga (got)", f: 1.8 },
  { id: "gudang", nama: "gudang dan bengkel kapal", f: 1.1 },
  { id: "anjungan", nama: "anjungan", f: 0.95 },
  { id: "lambung", nama: "lambung luar", f: 1.45 },
  { id: "kantin", nama: "kantin", f: 1.05 },
];
const KERJA_BERSIH = [
  { id: "umum", nama: "Pembersihan umum dan angkut sampah", dasar: 280_000, jam: 6 },
  { id: "tekanan", nama: "Pencucian bertekanan tinggi", dasar: 420_000, jam: 6 },
  { id: "degrease", nama: "Pembersihan minyak dan jelaga (degreasing)", dasar: 560_000, jam: 8 },
  { id: "disinfeksi", nama: "Disinfeksi dan sanitasi", dasar: 385_000, jam: 4 },
  { id: "pest", nama: "Pengendalian hama (pest control)", dasar: 650_000, jam: 4 },
];

export const POLA_BERSIH: Pola[] = [{
  kode: "BRS",
  kategori: "Perbaikan — Pembersihan & Perawatan",
  dimensi: { ar: AREA_BERSIH, kj: KERJA_BERSIH },
  sah: (v) => !(v.kj.id === "degrease" && !["mesin", "bilga", "dapur", "gkend", "lambung"].includes(v.ar.id)) &&
    !(v.kj.id === "disinfeksi" && ["bilga", "lambung", "mesin"].includes(v.ar.id)),
  nama: (v) => `${v.kj.nama} — ${v.ar.nama}`,
  spek: (v) =>
    v.kj.id === "pest" ? "Dikerjakan petugas bersertifikat, bahan aman untuk ruang berpenumpang, laporan diserahkan"
      : v.kj.id === "degrease" ? "Permukaan bebas minyak dan jelaga, limbah ditampung dan diserahkan sesuai aturan"
        : "Area bersih dan kering, sampah diangkut ke tempat pembuangan akhir, hasil diperiksa bersama",
  satuan: () => "Ls",
  harga: (v) => v.kj.dasar * v.ar.f + (UPAH.tukang / 8) * v.kj.jam * v.ar.f,
  bahan: (v) =>
    v.kj.id === "pest" ? ["Bahan pengendali hama — terdaftar dan aman untuk ruang berpenumpang", "Jasa petugas bersertifikat — lengkap laporan", "Alat pelindung diri — masker dan sarung tangan"]
      : v.kj.id === "degrease" ? ["Degreaser — cairan pembersih minyak, 20 liter", "Wadah penampung limbah — drum berlabel limbah B3", "Alat semprot dan sikat — sewa alat", MAJUN]
        : v.kj.id === "tekanan" ? ["Mesin cuci bertekanan tinggi — sewa alat lengkap operator", "Deterjen marine — 10 liter", "Air bersih dan selang", MAJUN]
          : [
            "Bahan pembersih — deterjen dan pembersih lantai, 10 liter",
            "Kantong sampah — ukuran besar, 1 pak", "Sapu, pel, dan alat kebersihan", MAJUN,
          ],
}];

/* ── penunjang docking ───────────────────────────────────────────────── */

const DOCK = [
  { id: "naik", nama: "Naik dok (docking up)", dasar: 42_000_000, sat: "Ls" },
  { id: "turun", nama: "Turun dok (undocking)", dasar: 38_000_000, sat: "Ls" },
  { id: "dockspace", nama: "Sewa dock space", dasar: 8_500_000, sat: "Hari" },
  { id: "tambat", nama: "Sewa tambat di galangan", dasar: 3_200_000, sat: "Hari" },
  { id: "tunda", nama: "Jasa kapal tunda (tug assist)", dasar: 12_500_000, sat: "Gerakan" },
  { id: "pandu", nama: "Jasa pemanduan", dasar: 6_800_000, sat: "Gerakan" },
  { id: "listrik", nama: "Sambungan listrik darat selama docking", dasar: 2_400_000, sat: "Hari" },
  { id: "air", nama: "Suplai air tawar selama docking", dasar: 1_850_000, sat: "Hari" },
  { id: "crane", nama: "Sewa crane galangan", dasar: 4_500_000, sat: "Hari" },
  { id: "perancah", nama: "Sewa dan pasang perancah", dasar: 185_000, sat: "m2" },
  { id: "sampah", nama: "Angkut limbah dan sampah docking", dasar: 3_800_000, sat: "Ls" },
  { id: "gasfree", nama: "Jasa pengukuran gas free bersertifikat", dasar: 4_200_000, sat: "Sertifikat" },
  { id: "survey", nama: "Jasa surveyor klas saat docking", dasar: 18_500_000, sat: "Ls" },
  { id: "kawal", nama: "Pengawalan dan keamanan kapal di galangan", dasar: 1_650_000, sat: "Hari" },
  { id: "akomodasi", nama: "Akomodasi awak selama docking", dasar: 850_000, sat: "Orang/Hari" },
  { id: "transport", nama: "Transportasi awak dan material", dasar: 1_250_000, sat: "Hari" },
];
const KELAS_KAPAL = [
  { id: "gt300", nama: "sampai GT 300", f: 0.7 },
  { id: "gt750", nama: "GT 300–750", f: 1 },
  { id: "gt1500", nama: "GT 750–1500", f: 1.45 },
  { id: "gt3000", nama: "di atas GT 1500", f: 2 },
];

export const POLA_DOCK: Pola[] = [{
  kode: "DCK",
  kategori: "Perbaikan — Penunjang Docking",
  dimensi: { dk: DOCK, kl: KELAS_KAPAL },
  sah: (v) => !(["perancah", "gasfree", "akomodasi"].includes(v.dk.id) && v.kl.id !== "gt750"),
  nama: (v) => `${v.dk.nama}${["perancah", "gasfree", "akomodasi"].includes(v.dk.id) ? "" : ` — kapal ${v.kl.nama}`}`,
  spek: (v) =>
    v.dk.id === "gasfree" ? "Diukur petugas bersertifikat sebelum pekerjaan panas, sertifikat berlaku diserahkan"
      : v.dk.id === "survey" ? "Pemeriksaan disaksikan surveyor klas, laporan dan rekomendasi diserahkan"
        : "Dilaksanakan sesuai jadwal docking yang disetujui, dicatat dalam laporan harian pekerjaan",
  satuan: (v) => v.dk.sat,
  harga: (v) => v.dk.dasar * v.kl.f,
  bahan: (v) =>
    v.dk.id === "perancah" ? ["Perancah pipa dan papan — sewa lengkap pemasangan", "Tali pengaman dan jaring — sesuai luas bidang"]
      : v.dk.id === "gasfree" ? ["Jasa petugas gas free bersertifikat", "Sertifikat gas free — berlaku selama pekerjaan panas"]
        : ["Jasa galangan / penyedia — sesuai perjanjian dan jadwal docking", "Berita acara pelaksanaan dan foto kegiatan"],
}];

/* ── fasilitas pelabuhan ─────────────────────────────────────────────── */

const FASILITAS = [
  { id: "lantai-dermaga", nama: "lantai dermaga", sat: "m2", dasar: 850_000 },
  { id: "pagar-dermaga", nama: "pagar pengaman dermaga", sat: "m", dasar: 425_000 },
  { id: "fender-dermaga", nama: "fender dermaga", sat: "Unit", dasar: 3_500_000 },
  { id: "bollard-dermaga", nama: "bollard dermaga", sat: "Unit", dasar: 8_500_000 },
  { id: "catwalk", nama: "catwalk dan jembatan penghubung", sat: "m", dasar: 1_650_000 },
  { id: "movable-bridge", nama: "movable bridge", sat: "Unit", dasar: 24_500_000 },
  { id: "atap-tunggu", nama: "atap ruang tunggu", sat: "m2", dasar: 265_000 },
  { id: "plafon-tunggu", nama: "plafon ruang tunggu", sat: "m2", dasar: 185_000 },
  { id: "lantai-tunggu", nama: "lantai ruang tunggu", sat: "m2", dasar: 235_000 },
  { id: "kursi-tunggu", nama: "kursi ruang tunggu", sat: "Unit", dasar: 950_000 },
  { id: "toilet-umum", nama: "toilet umum pelabuhan", sat: "Ls", dasar: 2_250_000 },
  { id: "gate", nama: "gate dan portal masuk", sat: "Unit", dasar: 12_500_000 },
  { id: "loket", nama: "loket tiket", sat: "Unit", dasar: 8_500_000 },
  { id: "pos-jaga", nama: "pos jaga", sat: "Unit", dasar: 9_800_000 },
  { id: "lampu-halaman", nama: "lampu penerangan halaman", sat: "Titik", dasar: 950_000 },
  { id: "rambu-lalin", nama: "rambu lalu lintas pelabuhan", sat: "Unit", dasar: 685_000 },
  { id: "marka-parkir", nama: "marka parkir dan jalur antre", sat: "m", dasar: 85_000 },
  { id: "drainase", nama: "saluran drainase", sat: "m", dasar: 385_000 },
  { id: "papan-nama", nama: "papan nama dan penunjuk arah", sat: "Unit", dasar: 2_450_000 },
  { id: "cctv", nama: "kamera pengawas (CCTV)", sat: "Titik", dasar: 3_200_000 },
  { id: "pagar-batas", nama: "pagar batas kawasan pelabuhan", sat: "m", dasar: 585_000 },
  { id: "jalan-aspal", nama: "jalan aspal area pelabuhan", sat: "m2", dasar: 285_000 },
  { id: "jalan-beton", nama: "jalan beton area pelabuhan", sat: "m2", dasar: 425_000 },
  { id: "pompa-air", nama: "instalasi pompa air pelabuhan", sat: "Ls", dasar: 6_800_000 },
  { id: "genset-darat", nama: "genset cadangan pelabuhan", sat: "Unit", dasar: 42_000_000 },
  { id: "musala-pel", nama: "musala pelabuhan", sat: "Ls", dasar: 8_500_000 },
];
const KERJA_FAS = [
  { id: "perbaikan", nama: "Perbaikan", f: 1, jam: 8 },
  { id: "ganti", nama: "Penggantian", f: 1.5, jam: 10 },
  { id: "cat", nama: "Pengecatan ulang", f: 0.22, jam: 5 },
  { id: "rawat", nama: "Perawatan berkala", f: 0.16, jam: 4 },
];

export const POLA_FASILITAS: Pola[] = [{
  kode: "FAS",
  kategori: "Perbaikan — Fasilitas Pelabuhan",
  dimensi: { fs: FASILITAS, kj: KERJA_FAS },
  sah: (v) => !(v.kj.id === "cat" && ["drainase", "cctv", "lampu-halaman", "jalan-aspal", "toilet-umum", "pompa-air"].includes(v.fs.id)),
  nama: (v) => `${v.kj.nama} ${v.fs.nama}`,
  spek: (v) =>
    v.kj.id === "rawat" ? "Diperiksa, dibersihkan, dan disetel; kerusakan yang ditemukan dilaporkan dengan foto"
      : v.kj.id === "cat" ? "Karat dan kotoran dibersihkan, dicat dasar dan dua lapis cat akhir tahan cuaca"
        : "Dikerjakan rapi dan aman dilalui penumpang, hasil diperiksa bersama dan didokumentasikan",
  satuan: (v) => v.fs.sat,
  harga: (v) => v.fs.dasar * v.kj.f + (UPAH.tukang / 8) * v.kj.jam * 0.3,
  bahan: (v) =>
    v.kj.id === "cat" ? ["Cat dasar anti karat — 4 liter", "Cat akhir tahan cuaca — 4 liter", "Amplas, sikat kawat, dan kuas", "Thinner — 4 liter"]
      : v.kj.id === "rawat" ? ["Bahan pembersih dan pelumas — sesuai jenis fasilitas", "Baut dan mur pengganti — galvanis", MAJUN]
        : [
          `Bahan utama ${v.fs.nama} — mutu sesuai pasangan terpasang`,
          /beton|jalan|lantai|drainase/.test(v.fs.id) ? "Semen, pasir, dan kerikil — semen 50 kg, pasir dan kerikil cor" : "Besi profil dan plat — sesuai rangka terpasang",
          /beton|jalan|lantai|drainase/.test(v.fs.id) ? "Besi tulangan — sesuai gambar" : KAWAT_LAS,
          /beton|jalan|lantai|drainase/.test(v.fs.id) ? SEALANT : OKSIGEN,
          /beton|jalan|lantai|drainase/.test(v.fs.id) ? "Bekisting dan perancah — kayu dan multipleks" : GERINDA,
          CAT_BESI,
        ],
}];
