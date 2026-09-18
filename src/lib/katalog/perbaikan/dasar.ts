/**
 * KATALOG PEKERJAAN PERBAIKAN — jasa perbaikan kapal & fasilitas cabang.
 *
 * Katalog HSPK yang ada disusun untuk DOCKING: sandblasting, naik-turun dok,
 * penggantian suku cadang besar. Pekerjaan sehari-hari cabang tidak ada di
 * sana — mengelas reling, mengganti pipa pemadam, membetulkan urinoir — padahal
 * itulah yang paling sering dituliskan tangan lalu diketik ulang satu per satu,
 * berikut rincian bahannya, tiap kali SPPBJ dibuat.
 *
 * HARGA. Item bertanda "Riil" memakai harga yang benar-benar dipakai cabang
 * pada catatan pekerjaan 18 Agustus 2026; harga satuannya diturunkan dari
 * nilai borongan pada catatan itu (mis. lima lida bandar Rp 2.000.000 menjadi
 * Rp 400.000 per unit). Item bertanda "Pasar" adalah taksiran untuk pekerjaan
 * sejenis yang belum pernah tercatat — wajib dicek sebelum dipakai menagih.
 *
 * RINCIAN ditulis "Bahan — spesifikasinya" dalam satu baris. Bentuk itu dipilih
 * bukan karena paling rapi secara data, melainkan karena dokumen SPPBJ mencetak
 * rincian sebagai satu kolom teks: memisahkannya menjadi dua medan hanya akan
 * hilang lagi saat dicetak, sementara penyedia tetap perlu membaca ukurannya.
 *
 * Semua isian di sini titik awal, bukan harga mati — setiap baris masih bisa
 * disunting di borang SPPBJ setelah dipilih.
 */
import type { KatalogItem } from "../source";

/** bahan las yang berulang di hampir semua pekerjaan pengelasan */
const LAS = [
  "Kawat las RB 2.5 mm — AWS E6013, kemasan 5 kg",
  "Tabung oksigen — isi ulang tabung 6 m3",
  "Mata gerinda potong — 4 inci x 1.2 mm, 1 box isi 50 lembar",
];
const CAT_BESI = "Cat besi — cat dasar zinc chromate + cat akhir, 1 kg";

interface Resep {
  kode: string;
  kategori: string;
  nama: string;
  satuan: string;
  harga: number;
  /** Riil = pernah dibayarkan cabang; Pasar = taksiran, wajib dicek */
  sumber: "Riil" | "Pasar";
  /** mutu hasil yang mengikat penyedia, bukan uraian ulang pekerjaannya */
  spesifikasi: string;
  bahan: string[];
}

const RESEP: Resep[] = [
  /* ── Las & konstruksi ─────────────────────────────────────────────── */
  {
    kode: "PBK-LAS-001", kategori: "Perbaikan — Las & Konstruksi",
    nama: "Pengelasan dan ganti pipa saluran air pemadam, termasuk ganti bos",
    satuan: "Ls", harga: 1_950_000, sumber: "Riil",
    spesifikasi: "Pipa keropos diganti, sambungan las penuh, diuji tidak bocor pada tekanan kerja",
    bahan: ["Pipa GIP 2 inci — SNI, medium class, batang 6 m",
      "Bos/soket 2 inci — galvanis, drat dalam", ...LAS],
  },
  {
    kode: "PBK-LAS-002", kategori: "Perbaikan — Las & Konstruksi",
    nama: "Pengelasan reling geladak",
    satuan: "Ls", harga: 1_000_000, sumber: "Riil",
    spesifikasi: "Reling tegak lurus, sambungan las penuh, permukaan digerinda dan dicat ulang",
    bahan: ["Pipa galvanis 1.5 inci — medium class, batang 6 m", CAT_BESI, ...LAS],
  },
  {
    kode: "PBK-LAS-003", kategori: "Perbaikan — Las & Konstruksi",
    nama: "Pengelasan plat bordes geladak",
    satuan: "Ls", harga: 750_000, sumber: "Riil",
    spesifikasi: "Plat dilas penuh pada rangka, permukaan rata tidak bergelombang",
    bahan: ["Plat bordes 4 mm — baja motif kembang, 1200 x 2400 mm", ...LAS],
  },
  {
    kode: "PBK-LAS-004", kategori: "Perbaikan — Las & Konstruksi",
    nama: "Pengelasan tutup bordes yang lepas",
    satuan: "Ls", harga: 500_000, sumber: "Riil",
    spesifikasi: "Tutup dilas kembali pada rangka, rata dengan permukaan geladak",
    bahan: [...LAS],
  },
  {
    kode: "PBK-LAS-005", kategori: "Perbaikan — Las & Konstruksi",
    nama: "Pengelasan lida bandar (ramp door kecil)",
    satuan: "Unit", harga: 400_000, sumber: "Riil",
    spesifikasi: "Las penuh pada engsel dan dudukan, diuji buka tutup tanpa macet",
    bahan: ["Plat besi 8 mm — baja kapal grade A", "Besi siku 50 x 50 mm — tebal 5 mm", ...LAS],
  },
  {
    kode: "PBK-LAS-006", kategori: "Perbaikan — Las & Konstruksi",
    nama: "Sambung dan las dinding kardek yang bolong/retak",
    satuan: "Titik", harga: 120_000, sumber: "Riil",
    spesifikasi: "Lubang ditambal plat dan dilas penuh, retakan digerinda lalu dilas, dicat dasar",
    bahan: ["Plat besi 6 mm — baja kapal grade A", ...LAS],
  },
  {
    kode: "PBK-LAS-007", kategori: "Perbaikan — Las & Konstruksi",
    nama: "Pengelasan kursi/bangku geladak",
    satuan: "Unit", harga: 250_000, sumber: "Riil",
    spesifikasi: "Sambungan rangka dilas penuh, permukaan digerinda dan dicat dasar",
    bahan: [...LAS],
  },
  {
    kode: "PBK-LAS-008", kategori: "Perbaikan — Las & Konstruksi",
    nama: "Bikin tangga darurat naik kapal",
    satuan: "Unit", harga: 500_000, sumber: "Riil",
    spesifikasi: "Tangga kokoh, anak tangga anti selip, dicat dasar dan cat akhir",
    bahan: ["Besi siku 40 x 40 mm — tebal 4 mm, batang 6 m",
      "Pipa besi 1 inci — medium class, batang 6 m", CAT_BESI, LAS[0]],
  },
  {
    kode: "PBK-LAS-009", kategori: "Perbaikan — Las & Konstruksi",
    nama: "Bikin dan pasang dudukan APAR",
    satuan: "Unit", harga: 250_000, sumber: "Riil",
    spesifikasi: "Rangka besi siku dicat, dipasang pada dinding, tabung terkunci aman",
    bahan: ["Besi siku 40 x 40 mm — tebal 4 mm, batang 6 m", CAT_BESI,
      "Baut dan mur — M10 x 50 mm, galvanis", LAS[0]],
  },
  {
    kode: "PBK-LAS-010", kategori: "Perbaikan — Las & Konstruksi",
    nama: "Bikin lemari tabung pemadam berikut dudukan",
    satuan: "Unit", harga: 1_750_000, sumber: "Riil",
    spesifikasi: "Lemari plat dicat, berpintu engsel, tabung terikat pada dudukan",
    bahan: ["Plat besi 1.2 mm — lembar 1200 x 2400 mm", "Besi siku 40 x 40 mm — tebal 4 mm",
      "Engsel dan handel — engsel stainless, handel putar", CAT_BESI, LAS[0]],
  },
  {
    kode: "PBK-LAS-011", kategori: "Perbaikan — Las & Konstruksi",
    nama: "Bikin dan pasang tangga monyet / step iron",
    satuan: "Unit", harga: 650_000, sumber: "Pasar",
    spesifikasi: "Pijakan dilas penuh pada dinding, jarak antarpijakan 30 cm, dicat",
    bahan: ["Besi beton polos 16 mm — SNI, batang 12 m", CAT_BESI, ...LAS],
  },
  {
    kode: "PBK-LAS-012", kategori: "Perbaikan — Las & Konstruksi",
    nama: "Bikin dan pasang handrail tangga",
    satuan: "m", harga: 350_000, sumber: "Pasar",
    spesifikasi: "Pipa dilas pada tiang tiap 1.2 m, tinggi 90 cm, dicat dasar dan akhir",
    bahan: ["Pipa galvanis 1.25 inci — medium class, batang 6 m", CAT_BESI, ...LAS],
  },

  /* ── Jangkar, winch & perlengkapan geladak ────────────────────────── */
  {
    kode: "PBK-GLD-001", kategori: "Perbaikan — Geladak & Jangkar",
    nama: "Pengelasan lida haus jangkar dan penyangga samping winch jangkar",
    satuan: "Ls", harga: 250_000, sumber: "Riil",
    spesifikasi: "Las penuh pada dudukan, permukaan digerinda rata dan dicat dasar",
    bahan: ["Plat besi 8 mm — baja kapal grade A", ...LAS],
  },
  {
    kode: "PBK-GLD-002", kategori: "Perbaikan — Geladak & Jangkar",
    nama: "Pengelasan/dobel pipa jangkar dan pengelasan roll block",
    satuan: "Ls", harga: 1_250_000, sumber: "Riil",
    spesifikasi: "Pipa didobel plat, roll block dilas penuh dan diuji berputar bebas",
    bahan: ["Plat besi 8 mm — baja kapal grade A",
      "Pipa besi — diameter menyesuaikan pipa jangkar terpasang", ...LAS],
  },
  {
    kode: "PBK-GLD-003", kategori: "Perbaikan — Geladak & Jangkar",
    nama: "Bongkar pasang dan ganti kanvas rem winch",
    satuan: "Ls", harga: 2_000_000, sumber: "Riil",
    spesifikasi: "Kanvas terpasang rapat pada tromol, rem diuji menahan beban jangkar",
    bahan: ["Kanvas rem winch — tebal dan lebar menyesuaikan tromol terpasang",
      "Baut dan mur — galvanis", "Keling kanvas — kuningan"],
  },
  {
    kode: "PBK-GLD-004", kategori: "Perbaikan — Geladak & Jangkar",
    nama: "Ganti penyangga kanvas rem jangkar dan tambah dudukan penyangga",
    satuan: "Ls", harga: 1_250_000, sumber: "Riil",
    spesifikasi: "Penyangga baru dilas penuh, rem jangkar diuji menahan beban",
    bahan: ["Plat besi 10 mm — baja kapal grade A", "Baut dan mur — galvanis", ...LAS],
  },
  {
    kode: "PBK-GLD-005", kategori: "Perbaikan — Geladak & Jangkar",
    nama: "Pemasangan per balok (spring block)",
    satuan: "Ls", harga: 250_000, sumber: "Riil",
    spesifikasi: "Per terpasang pada dudukan dan dibaut kencang, diuji tekan",
    bahan: ["Per balok — ukuran menyesuaikan dudukan terpasang", "Baut dan mur — galvanis"],
  },
  {
    kode: "PBK-GLD-006", kategori: "Perbaikan — Geladak & Jangkar",
    nama: "Ganti tali tambat (mooring rope)",
    satuan: "Roll", harga: 7_500_000, sumber: "Pasar",
    spesifikasi: "Tali baru bersertifikat, ujung dianyam (splice) dan diberi thimble",
    bahan: ["Tali PP 24 mm — roll 220 m, breaking load sesuai GT kapal",
      "Thimble dan kausa — galvanis"],
  },
  {
    kode: "PBK-GLD-007", kategori: "Perbaikan — Geladak & Jangkar",
    nama: "Perbaikan dan pelumasan winch geladak",
    satuan: "Unit", harga: 1_500_000, sumber: "Pasar",
    spesifikasi: "Winch dibongkar, bantalan dibersihkan dan dilumasi, diuji beban",
    bahan: ["Gemuk (grease) — EP2, 1 kg", "Oli roda gigi — SAE 90, 5 liter",
      "Seal dan packing — menyesuaikan tipe winch"],
  },

  /* ── Pipa, sanitasi & air ─────────────────────────────────────────── */
  {
    kode: "PBK-PIP-001", kategori: "Perbaikan — Perpipaan",
    nama: "Bongkar pasang dan pengelasan pipa pemadam berikut pemasangan kran",
    satuan: "Ls", harga: 1_000_000, sumber: "Riil",
    spesifikasi: "Jalur pipa tersambung penuh, kran terpasang, diuji tidak bocor",
    bahan: ["Pipa GIP 2 inci — SNI, medium class, batang 6 m",
      "Kran 2 inci — kuningan, drat dalam", "Seal tape — 12 mm x 10 m", LAS[0], LAS[1]],
  },
  {
    kode: "PBK-PIP-002", kategori: "Perbaikan — Perpipaan",
    nama: "Perbaikan dan pengelasan meteran air pemadam",
    satuan: "Ls", harga: 300_000, sumber: "Riil",
    spesifikasi: "Meteran terpasang kedap, penunjukan berfungsi normal",
    bahan: ["Meteran air — diameter 2 inci, badan kuningan, kelas B",
      "Seal tape — 12 mm x 10 m", LAS[0], LAS[1]],
  },
  {
    kode: "PBK-PIP-003", kategori: "Perbaikan — Perpipaan",
    nama: "Perbaikan kran hidran",
    satuan: "Unit", harga: 250_000, sumber: "Riil",
    spesifikasi: "Kran berfungsi, sambungan tidak bocor pada tekanan kerja",
    bahan: ["Kran hidran 2 inci — kuningan, drat dalam", "Seal tape — 12 mm x 10 m"],
  },
  {
    kode: "PBK-PIP-004", kategori: "Perbaikan — Perpipaan",
    nama: "Perbaikan saluran kamar mandi yang tersumbat",
    satuan: "Titik", harga: 300_000, sumber: "Riil",
    spesifikasi: "Saluran lancar, sambungan tidak merembes",
    bahan: ["Pipa PVC 3 inci — kelas AW, batang 4 m",
      "Sambungan PVC — elbow dan sok 3 inci", "Lem PVC — kemasan 100 gram"],
  },
  {
    kode: "PBK-PIP-005", kategori: "Perbaikan — Sanitasi",
    nama: "Perbaikan urinoir berikut pipa saluran dan pipa buangan",
    satuan: "Unit", harga: 390_000, sumber: "Riil",
    spesifikasi: "Urinoir terpasang rapat ke dinding, air masuk dan buangan lancar",
    bahan: ["Urinoir — keramik, lengkap kran tekan", "Pipa PVC 2 inci — kelas AW, batang 4 m",
      "Flexible hose — stainless 40 cm", "Sealant — silikon netral 300 ml"],
  },
  {
    kode: "PBK-PIP-006", kategori: "Perbaikan — Perpipaan",
    nama: "Pasang tutup pipa pembuangan air AC",
    satuan: "Titik", harga: 150_000, sumber: "Riil",
    spesifikasi: "Ujung pipa tertutup rapat, air buangan terarah ke saluran",
    bahan: ["Pipa PVC 1 inci — kelas AW, batang 4 m", "Dop PVC — 1 inci",
      "Klem pipa — 1 inci, galvanis"],
  },
  {
    kode: "PBK-PIP-007", kategori: "Perbaikan — Perpipaan",
    nama: "Pemasangan pompa air berikut pipa instalasi",
    satuan: "Ls", harga: 1_750_000, sumber: "Riil",
    spesifikasi: "Pompa terpasang pada dudukan, instalasi diuji mengalir tanpa bocor",
    bahan: ["Pompa air — daya menyesuaikan instalasi terpasang",
      "Pipa GIP 1 inci — SNI, medium class, batang 6 m",
      "Fitting dan stop kran — kuningan 1 inci", "Seal tape — 12 mm x 10 m"],
  },
  {
    kode: "PBK-PIP-008", kategori: "Perbaikan — Perpipaan",
    nama: "Ganti pipa hidrolik berikut pengelasan dan bongkar pasang",
    satuan: "Jalur", harga: 500_000, sumber: "Riil",
    spesifikasi: "Jalur diganti baru, diuji pada tekanan kerja tanpa rembes",
    bahan: ["Pipa/selang hidrolik — tekanan kerja minimal 210 bar",
      "Fitting dan nipple — menyesuaikan jalur terpasang",
      "Oli hidrolik — ISO VG 46, 20 liter"],
  },
  {
    kode: "PBK-PIP-009", kategori: "Perbaikan — Sanitasi",
    nama: "Ganti kloset duduk berikut instalasi",
    satuan: "Unit", harga: 1_850_000, sumber: "Pasar",
    spesifikasi: "Kloset terpasang rapat, penyiraman lancar, tidak ada rembesan di kaki",
    bahan: ["Kloset duduk — keramik, lengkap tangki dan dudukan",
      "Flexible hose — stainless 40 cm", "Seal kloset (wax ring)", "Sealant — silikon netral 300 ml"],
  },
  {
    kode: "PBK-PIP-010", kategori: "Perbaikan — Sanitasi",
    nama: "Ganti wastafel berikut kran dan pipa buangan",
    satuan: "Unit", harga: 950_000, sumber: "Pasar",
    spesifikasi: "Wastafel terpasang kuat, kran tidak menetes, buangan lancar",
    bahan: ["Wastafel — keramik lengkap braket", "Kran wastafel — kuningan krom",
      "Pipa buangan (P-trap) — PVC 1.25 inci", "Sealant — silikon netral 300 ml"],
  },
  {
    kode: "PBK-PIP-011", kategori: "Perbaikan — Perpipaan",
    nama: "Perbaikan tangki air tawar (bocor/karat)",
    satuan: "Ls", harga: 2_500_000, sumber: "Pasar",
    spesifikasi: "Bagian bocor ditambal dan dilas, bagian dalam dicat epoksi food grade",
    bahan: ["Plat besi 4 mm — baja kapal grade A",
      "Cat epoksi food grade — 4 liter (2 komponen)", ...LAS],
  },
  {
    kode: "PBK-PIP-012", kategori: "Perbaikan — Perpipaan",
    nama: "Ganti pipa air bersih (jalur akomodasi)",
    satuan: "m", harga: 95_000, sumber: "Pasar",
    spesifikasi: "Jalur baru diklem tiap 1 m, diuji tekan tanpa bocor",
    bahan: ["Pipa PPR 3/4 inci — PN10, batang 4 m", "Fitting PPR — sok, elbow, tee",
      "Klem pipa — 3/4 inci"],
  },

  /* ── Akomodasi & interior ─────────────────────────────────────────── */
  {
    kode: "PBK-AKM-001", kategori: "Perbaikan — Akomodasi & Interior",
    nama: "Bikin pintu kamar mandi berikut kusen dan pemasangan",
    satuan: "Unit", harga: 2_000_000, sumber: "Riil",
    spesifikasi: "Pintu terpasang rapat dan berfungsi, saluran lancar tanpa rembes",
    bahan: ["Daun pintu PVC — 70 x 200 cm, tahan air", "Kusen aluminium — profil 3 inci",
      "Engsel dan kunci pintu — engsel stainless 3 inci, kunci silinder",
      "Pipa PVC 3 inci — kelas AW, batang 4 m", "Lem PVC — kemasan 100 gram"],
  },
  {
    kode: "PBK-AKM-002", kategori: "Perbaikan — Akomodasi & Interior",
    nama: "Bongkar pasang kunci pintu",
    satuan: "Unit", harga: 150_000, sumber: "Riil",
    spesifikasi: "Kunci berfungsi dua arah, daun pintu menutup rapat",
    bahan: ["Kunci pintu — kunci silinder, badan stainless", "Engsel — stainless 3 inci",
      "Sekrup — menyesuaikan engsel"],
  },
  {
    kode: "PBK-AKM-003", kategori: "Perbaikan — Akomodasi & Interior",
    nama: "Perbaikan dinding di bawah kusen pintu",
    satuan: "Titik", harga: 100_000, sumber: "Riil",
    spesifikasi: "Dinding diplester rata dan dicat sewarna dinding sekitarnya",
    bahan: ["Semen dan pasir — semen 50 kg dan pasir pasang",
      "Cat tembok — cat interior 2.5 liter"],
  },
  {
    kode: "PBK-AKM-004", kategori: "Perbaikan — Akomodasi & Interior",
    nama: "Pasang dinding kaca akrilik",
    satuan: "Pasang", harga: 750_000, sumber: "Riil",
    spesifikasi: "Akrilik terpasang pada rangka aluminium, sambungan diberi sealant",
    bahan: ["Akrilik 3 mm — bening, lembar 1220 x 2440 mm", "Rangka aluminium — profil 1 inci",
      "Sekrup dan sealant — sekrup 1 inci, sealant netral 300 ml"],
  },
  {
    kode: "PBK-AKM-005", kategori: "Perbaikan — Akomodasi & Interior",
    nama: "Perbaikan kursi penumpang (ganti busa dan pelapis)",
    satuan: "Unit", harga: 250_000, sumber: "Riil",
    spesifikasi: "Busa dan pelapis diganti, rangka dikencangkan kembali",
    bahan: ["Busa jok — tebal 5 cm, densitas sedang", "Kulit sintetis — oscar, tahan air",
      "Baut dan mur — galvanis"],
  },
  {
    kode: "PBK-AKM-006", kategori: "Perbaikan — Akomodasi & Interior",
    nama: "Ganti plafon PVC ruang penumpang",
    satuan: "m2", harga: 185_000, sumber: "Pasar",
    spesifikasi: "Plafon rata, sambungan rapat, rangka tidak melendut",
    bahan: ["Plafon PVC — lebar 20 cm, tebal 8 mm", "Rangka hollow — 40 x 20 mm galvalum",
      "Sekrup gypsum — 1 inci", "List plafon PVC"],
  },
  {
    kode: "PBK-AKM-007", kategori: "Perbaikan — Akomodasi & Interior",
    nama: "Ganti lantai vinyl ruang penumpang",
    satuan: "m2", harga: 225_000, sumber: "Pasar",
    spesifikasi: "Lantai rata tanpa gelembung, sambungan dilas panas (heat weld)",
    bahan: ["Vinyl roll — tebal 2 mm, anti selip", "Lem vinyl — kemasan 4 kg",
      "Kawat las vinyl — sewarna lantai"],
  },
  {
    kode: "PBK-AKM-008", kategori: "Perbaikan — Akomodasi & Interior",
    nama: "Ganti kaca jendela ruang penumpang",
    satuan: "Unit", harga: 550_000, sumber: "Pasar",
    spesifikasi: "Kaca terpasang dengan karet baru, tidak bocor saat disiram",
    bahan: ["Kaca tempered 8 mm — ukuran menyesuaikan bukaan",
      "Karet list kaca — profil U", "Sealant — silikon netral 300 ml"],
  },
  {
    kode: "PBK-AKM-009", kategori: "Perbaikan — Akomodasi & Interior",
    nama: "Perbaikan meja dan rak pantry",
    satuan: "Ls", harga: 1_200_000, sumber: "Pasar",
    spesifikasi: "Rangka kokoh, permukaan dilapis ulang dan mudah dibersihkan",
    bahan: ["Multipleks 18 mm — lembar 1220 x 2440 mm", "HPL — lembar, motif polos",
      "Lem kuning — 1 kg", "Sekrup dan engsel"],
  },
  {
    kode: "PBK-AKM-010", kategori: "Perbaikan — Akomodasi & Interior",
    nama: "Service dan cuci AC split",
    satuan: "Unit", harga: 350_000, sumber: "Pasar",
    spesifikasi: "Unit dicuci, tekanan freon dicek, suhu keluar diukur dan dilaporkan",
    bahan: ["Cairan pembersih evaporator — 1 liter", "Freon R32 — isi ulang bila kurang"],
  },

  /* ── Kelistrikan & penerangan ─────────────────────────────────────── */
  {
    kode: "PBK-LIS-001", kategori: "Perbaikan — Kelistrikan & Penerangan",
    nama: "Ganti lampu penerangan ruangan (LED)",
    satuan: "Titik", harga: 275_000, sumber: "Pasar",
    spesifikasi: "Lampu menyala normal, fitting kencang, kabel dirapikan dalam klem",
    bahan: ["Lampu LED — 20 W, 220 V", "Fitting lampu — keramik/PVC tahan panas",
      "Kabel NYM 2 x 1.5 mm — SNI", "Klem kabel dan isolasi"],
  },
  {
    kode: "PBK-LIS-002", kategori: "Perbaikan — Kelistrikan & Penerangan",
    nama: "Ganti lampu sorot geladak",
    satuan: "Unit", harga: 850_000, sumber: "Pasar",
    spesifikasi: "Lampu tahan cuaca (IP65), dudukan dilas/dibaut kuat, arah sorot disetel",
    bahan: ["Lampu sorot LED — 100 W, IP65", "Kabel NYY 3 x 2.5 mm — SNI",
      "Klem kabel dan isolasi", "Baut dan mur — stainless"],
  },
  {
    kode: "PBK-LIS-003", kategori: "Perbaikan — Kelistrikan & Penerangan",
    nama: "Perbaikan instalasi stop kontak dan saklar",
    satuan: "Titik", harga: 225_000, sumber: "Pasar",
    spesifikasi: "Sambungan rapi dalam kotak, diuji tanpa arus bocor",
    bahan: ["Stop kontak/saklar — 16 A, berpenutup", "Kabel NYM 3 x 2.5 mm — SNI",
      "Kotak instalasi — inbow/outbow", "Isolasi kabel"],
  },
  {
    kode: "PBK-LIS-004", kategori: "Perbaikan — Kelistrikan & Penerangan",
    nama: "Ganti kabel gulung (extension) kerja",
    satuan: "Roll", harga: 698_000, sumber: "Riil",
    spesifikasi: "Kabel roll lengkap dengan stop kontak berpenutup dan pengaman panas",
    bahan: ["Kabel NYY 3 x 2.5 mm — SNI, 25 m", "Roll kabel — rangka besi, 4 lubang"],
  },
  {
    kode: "PBK-LIS-005", kategori: "Perbaikan — Kelistrikan & Penerangan",
    nama: "Perbaikan panel listrik (pembersihan dan pengencangan terminal)",
    satuan: "Unit", harga: 1_250_000, sumber: "Pasar",
    spesifikasi: "Terminal dikencangkan, panel bersih, hasil pengukuran arus dilaporkan",
    bahan: ["Contact cleaner — 500 ml", "Kabel skun dan terminal — menyesuaikan panel",
      "Label penanda jalur"],
  },
  {
    kode: "PBK-LIS-006", kategori: "Perbaikan — Kelistrikan & Penerangan",
    nama: "Ganti aki (accu) kapal",
    satuan: "Unit", harga: 2_800_000, sumber: "Riil",
    spesifikasi: "Aki baru terpasang pada dudukan, terminal digrease, tegangan diukur",
    bahan: ["Aki 12 V 100 Ah — tipe basah/kering menyesuaikan dudukan",
      "Kabel aki dan skun", "Gemuk terminal (grease)"],
  },
  {
    kode: "PBK-LIS-007", kategori: "Perbaikan — Kelistrikan & Penerangan",
    nama: "Pemasangan lampu hias LED (strip)",
    satuan: "m", harga: 56_000, sumber: "Riil",
    spesifikasi: "Strip terpasang lurus dan rapat, sambungan disolder dan diisolasi",
    bahan: ["Lampu strip LED — 12 V, IP65", "Adaptor/power supply — 12 V sesuai panjang",
      "Isolasi dan klem"],
  },
  {
    kode: "PBK-LIS-008", kategori: "Perbaikan — Kelistrikan & Penerangan",
    nama: "Perbaikan kipas ventilasi (blower) ruang mesin",
    satuan: "Unit", harga: 1_450_000, sumber: "Pasar",
    spesifikasi: "Kipas berputar tanpa getaran berlebih, bantalan diganti, arus diukur",
    bahan: ["Bearing kipas — sepasang, sesuai tipe", "Kapasitor motor — sesuai daya",
      "Gemuk (grease) — EP2, 1 kg"],
  },

  /* ── Keselamatan ──────────────────────────────────────────────────── */
  {
    kode: "PBK-KSL-001", kategori: "Perbaikan — Keselamatan",
    nama: "Isi ulang APAR (dry chemical powder)",
    satuan: "Unit", harga: 275_000, sumber: "Pasar",
    spesifikasi: "Tabung diisi penuh, tekanan pada zona hijau, kartu periksa diperbarui",
    bahan: ["Serbuk kimia kering (DCP) — 6 kg", "Seal dan pin pengaman", "Kartu periksa APAR"],
  },
  {
    kode: "PBK-KSL-002", kategori: "Perbaikan — Keselamatan",
    nama: "Service dan uji tekan APAR CO2",
    satuan: "Unit", harga: 450_000, sumber: "Pasar",
    spesifikasi: "Tabung diuji tekan (hydrotest), diisi ulang, diberi tanggal uji",
    bahan: ["Isi ulang CO2 — sesuai kapasitas tabung", "Seal dan hose horn"],
  },
  {
    kode: "PBK-KSL-003", kategori: "Perbaikan — Keselamatan",
    nama: "Ganti selang pemadam (fire hose) dan nozzle",
    satuan: "Set", harga: 1_950_000, sumber: "Pasar",
    spesifikasi: "Selang diuji tekan tanpa bocor, kopling terkunci, nozzle berfungsi",
    bahan: ["Selang pemadam — 1.5 inci x 20 m, canvas rubber lined",
      "Nozzle jet/spray — kuningan 1.5 inci", "Kopling machino — sepasang"],
  },
  {
    kode: "PBK-KSL-004", kategori: "Perbaikan — Keselamatan",
    nama: "Perawatan dan pengecatan life buoy berikut dudukan",
    satuan: "Unit", harga: 325_000, sumber: "Pasar",
    spesifikasi: "Pelampung bersih, tulisan nama kapal dicat ulang, tali pegangan diganti",
    bahan: ["Cat marine — putih dan oranye, 1 liter", "Tali pegangan (grab line) — PP 10 mm",
      "Pita reflektif — SOLAS grade"],
  },
  {
    kode: "PBK-KSL-005", kategori: "Perbaikan — Keselamatan",
    nama: "Ganti dan pasang rambu keselamatan / jalur evakuasi",
    satuan: "Titik", harga: 125_000, sumber: "Pasar",
    spesifikasi: "Rambu terbaca dari 5 m, bahan photoluminescent, terpasang kuat",
    bahan: ["Pelat rambu — akrilik/vinyl photoluminescent",
      "Sekrup atau perekat 3M — tahan air"],
  },
  {
    kode: "PBK-KSL-006", kategori: "Perbaikan — Keselamatan",
    nama: "Service inflatable liferaft (di darat)",
    satuan: "Unit", harga: 4_500_000, sumber: "Pasar",
    spesifikasi: "Diservis di stasiun resmi, sertifikat dan berita acara diserahkan",
    bahan: ["Biaya service station resmi", "Penggantian perlengkapan kedaluwarsa"],
  },

  /* ── Pengecatan ───────────────────────────────────────────────────── */
  {
    kode: "PBK-CAT-001", kategori: "Perbaikan — Pengecatan",
    nama: "Pengecatan konstruksi besi (bangunan atas)",
    satuan: "m2", harga: 95_000, sumber: "Pasar",
    spesifikasi: "Karat dibersihkan, satu lapis cat dasar dan dua lapis cat akhir",
    bahan: ["Cat dasar zinc chromate — 4 liter", "Cat akhir marine — 4 liter",
      "Thinner — 4 liter", "Amplas dan sikat kawat"],
  },
  {
    kode: "PBK-CAT-002", kategori: "Perbaikan — Pengecatan",
    nama: "Pengecatan dinding dan plafon ruangan",
    satuan: "m2", harga: 55_000, sumber: "Pasar",
    spesifikasi: "Permukaan dihaluskan, dua lapis cat, warna sesuai warna semula",
    bahan: ["Cat tembok — interior, 25 kg", "Plamir dan amplas", "Kuas dan roller"],
  },
  {
    kode: "PBK-CAT-003", kategori: "Perbaikan — Pengecatan",
    nama: "Pengecatan marka geladak kendaraan",
    satuan: "m", harga: 65_000, sumber: "Pasar",
    spesifikasi: "Garis lurus lebar 10 cm, cat anti selip, dikeringkan sebelum dilalui",
    bahan: ["Cat marka — kuning/putih, 4 liter", "Pasir silika halus — anti selip",
      "Lakban kertas dan thinner"],
  },
  {
    kode: "PBK-CAT-004", kategori: "Perbaikan — Pengecatan",
    nama: "Pengecatan nama kapal dan tanda selar",
    satuan: "Ls", harga: 1_750_000, sumber: "Pasar",
    spesifikasi: "Huruf sesuai ukuran semula, rapi dan terbaca dari dermaga",
    bahan: ["Cat marine — hitam dan putih, 4 liter", "Mal huruf dan lakban",
      "Kuas dan thinner"],
  },
  {
    kode: "PBK-CAT-005", kategori: "Perbaikan — Pengecatan",
    nama: "Pengecatan pagar dan railing pelabuhan",
    satuan: "m", harga: 75_000, sumber: "Pasar",
    spesifikasi: "Karat dibersihkan, dicat dasar dan dua lapis cat akhir tahan cuaca",
    bahan: ["Cat dasar anti karat — 4 liter", "Cat akhir — 4 liter", "Amplas dan sikat kawat"],
  },

  /* ── Fasilitas pelabuhan ──────────────────────────────────────────── */
  {
    kode: "PBK-PLB-001", kategori: "Perbaikan — Fasilitas Pelabuhan",
    nama: "Perbaikan lantai dermaga (grouting beton)",
    satuan: "m2", harga: 850_000, sumber: "Pasar",
    spesifikasi: "Beton dibobok sampai bagian padat, digrouting, permukaan rata dengan lantai",
    bahan: ["Grouting semen non-susut — 25 kg", "Kerikil dan pasir cor",
      "Bahan pengeras dan perekat beton"],
  },
  {
    kode: "PBK-PLB-002", kategori: "Perbaikan — Fasilitas Pelabuhan",
    nama: "Perbaikan dan pengelasan pagar pengaman dermaga",
    satuan: "m", harga: 425_000, sumber: "Pasar",
    spesifikasi: "Pagar tegak lurus, sambungan dilas penuh, dicat tahan cuaca",
    bahan: ["Pipa galvanis 2 inci — medium class, batang 6 m", CAT_BESI, ...LAS],
  },
  {
    kode: "PBK-PLB-003", kategori: "Perbaikan — Fasilitas Pelabuhan",
    nama: "Ganti fender dermaga (karet)",
    satuan: "Unit", harga: 3_500_000, sumber: "Pasar",
    spesifikasi: "Fender terpasang lurus pada dinding dermaga, baut angkur dikencangkan",
    bahan: ["Fender karet — tipe menyesuaikan dudukan terpasang",
      "Baut angkur — M20, stainless", "Plat dudukan — baja 10 mm"],
  },
  {
    kode: "PBK-PLB-004", kategori: "Perbaikan — Fasilitas Pelabuhan",
    nama: "Perbaikan atap dan talang ruang tunggu",
    satuan: "m2", harga: 265_000, sumber: "Pasar",
    spesifikasi: "Atap tidak bocor saat hujan, talang mengalir ke saluran",
    bahan: ["Atap spandek — tebal 0.35 mm", "Talang seng — lebar 30 cm",
      "Sekrup roofing dan karet", "Sealant atap"],
  },
  {
    kode: "PBK-PLB-005", kategori: "Perbaikan — Fasilitas Pelabuhan",
    nama: "Perbaikan kursi ruang tunggu penumpang",
    satuan: "Unit", harga: 250_000, sumber: "Riil",
    spesifikasi: "Rangka dikencangkan dan dilas bila perlu, dudukan diganti, dicat ulang",
    bahan: ["Papan dudukan/fiber — menyesuaikan rangka", "Baut dan mur — galvanis", CAT_BESI],
  },
  {
    kode: "PBK-PLB-006", kategori: "Perbaikan — Fasilitas Pelabuhan",
    nama: "Perbaikan instalasi air toilet umum pelabuhan",
    satuan: "Ls", harga: 2_250_000, sumber: "Pasar",
    spesifikasi: "Air mengalir di seluruh titik, tidak ada kebocoran, buangan lancar",
    bahan: ["Pipa PVC 3/4 dan 3 inci — kelas AW", "Kran dan fitting — kuningan",
      "Sealant dan lem PVC"],
  },
  {
    kode: "PBK-PLB-007", kategori: "Perbaikan — Fasilitas Pelabuhan",
    nama: "Perbaikan lampu penerangan halaman/dermaga",
    satuan: "Titik", harga: 950_000, sumber: "Pasar",
    spesifikasi: "Lampu menyala otomatis pada malam hari, tiang dan kabel aman",
    bahan: ["Lampu jalan LED — 50 W, IP66", "Photocell — 10 A",
      "Kabel NYY 3 x 2.5 mm — SNI", "Klem dan pipa pelindung"],
  },
  {
    kode: "PBK-PLB-008", kategori: "Perbaikan — Fasilitas Pelabuhan",
    nama: "Pembersihan area (pembersihan umum dan angkut sampah)",
    satuan: "Ls", harga: 300_000, sumber: "Riil",
    spesifikasi: "Area bersih, sampah diangkut ke tempat pembuangan akhir",
    bahan: ["Bahan pembersih — deterjen dan pembersih lantai",
      "Kantong sampah — ukuran besar, 1 pak", "Sapu dan alat kebersihan"],
  },
];

/** Katalog pekerjaan perbaikan dalam bentuk KatalogItem, siap digabung. */
export const PERBAIKAN_DASAR: KatalogItem[] = RESEP.map((r) => ({
  kode: r.kode,
  jenis: "JASA",
  kategori: r.kategori,
  nama: r.nama,
  spesifikasi: r.spesifikasi,
  satuan: r.satuan,
  harga: r.harga,
  sumber: r.sumber,
  breakdown: r.bahan,
}));
