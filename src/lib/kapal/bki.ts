/**
 * Data resmi armada dari BKI (Biro Klasifikasi Indonesia) — hasil alih data
 * berkas "BKI_Armada_Data_Kapal_ASDP_Ternate.xlsx", 10 September 2026.
 *
 * Berkas ini DIBANGKITKAN, bukan diketik tangan: kalau BKI mengirim rekap baru,
 * jalankan ulang alih datanya dan timpa berkas ini seluruhnya. Jangan menyunting
 * angkanya di sini — suntingan tangan akan hilang pada pembaruan berikutnya, dan
 * yang lebih buruk, membuat aplikasi menyatakan sesuatu yang tidak pernah
 * dikatakan BKI.
 *
 * Kapal yang boleh disunting orang kantor (lintasan, nomor seri poros, lampiran
 * inventaris) hidup di tempat lain — lihat gabungan di types.ts. Isi di sini
 * hanya dipakai sebagai dasar, dan selalu kalah oleh isian kantor yang terisi.
 *
 * KMP. KOLORAI belum ada di rekap BKI ini, jadi datanya tetap kosong.
 */

/** Satu mesin induk. Posisi PS/PA = portside (kiri), SB/SA = starboard (kanan). */
export interface MesinIndukBKI {
  no: string; merk: string; pabrik: string; silinder: string;
  tenaga: string; rpm: string; tahun: string; model: string; posisi: string;
}
export interface MesinBantuBKI {
  item: string; merk: string; pabrik: string; lokasi: string;
  model: string; bhp: string; tahun: string;
}
export interface JangkarBKI {
  jumlahBerat: string; panjangRantai: string; diaRantai: string;
  tipe: string; tipeRantai: string; kualitasRantai: string;
}
/** Survei klasifikasi (lambung & mesin). Tanggal selalu ISO yyyy-mm-dd. */
export interface SurveiKlasBKI {
  jenis: string; jatuhTempo: string; rentangDari: string; rentangSampai: string;
  ditunda: string; terakhir: string;
}
/** Survei statutori (sertifikat negara: load line, SKKP, SNPP, AFS). */
export interface SurveiStatutoriBKI {
  jenis: string; terakhir: string; berikut1: string; berikut2: string; ditunda: string;
}

export interface DataBKI {
  nama: string; namaBKI: string;
  register: string; imo: string; status: string; jenisKapal: string; material: string;
  pelabuhan: string; bendera: string; tandaKelasLambung: string; callSign: string;
  bangunan: string; namaSebelumnya: string; dualKelas: string; exDualKelas: string;
  instalasiPendingin: string; cms: string; statusPending: string; kategori: string;
  galangan: string; tahun: string; tglPeluncuran: string; lokasiBangun: string;
  gt: string; nt: string; dwt: string; loa: string; lbp: string;
  bmld: string; hmld: string; t: string; lt: string;
  geladak: string; palka: string; ruangMuat: string;
  sekatMemanjang: string; sekatMelintang: string; forecastle: string;
  bower: JangkarBKI; stream: JangkarBKI;
  sistemStart: string; jmlBalingBaling: string; tipeBalingBaling: string;
  voltase: string; arus: string; jenisMesin: string; jmlMesinInduk: string;
  caraKerja: string; gigiReduksi: string; kecepatanDinas: string; kecepatanCoba: string;
  dayaListrik: string; jmlMesinBantu: string; diaLangkah: string;
  pemilik: string; alamatPemilik: string; kotaPemilik: string;
  operator: string; alamatOperator: string; kotaOperator: string;
  mesinInduk: MesinIndukBKI[]; mesinBantu: MesinBantuBKI[];
  surveiKlas: SurveiKlasBKI[]; surveiStatutori: SurveiStatutoriBKI[];
  rekomendasi: string; rekomendasiJatuhTempo: string; memoranda: string;
}

/** Tanggal berkas BKI yang jadi sumber isi di bawah. */
export const BKI_SUMBER = "Rekap BKI 10 September 2026";

/** Kunci = id kapal (slug), sama dengan Ship.id. */
export const BKI: Record<string, DataBKI> = {
  "kmp-kerapu-ii": {
    "nama": "KMP. KERAPU II",
    "namaBKI": "KERAPU - II",
    "register": "4210",
    "imo": "8713017",
    "status": "AKTIF (ACTIVE)",
    "jenisKapal": "PASSANGER CAR FERRY",
    "material": "BAJA (STEEL)",
    "pelabuhan": "JAKARTA",
    "bendera": "INDONESIA",
    "tandaKelasLambung": "P",
    "callSign": "YEDV",
    "bangunan": "BARU (NEW)",
    "namaSebelumnya": "",
    "dualKelas": "",
    "exDualKelas": "",
    "instalasiPendingin": "",
    "cms": "",
    "statusPending": "",
    "kategori": "IACS Non Compliance",
    "galangan": "PT.DOK & PERKAPALAN SURABAYA",
    "tahun": "1988",
    "tglPeluncuran": "1988-02-01",
    "lokasiBangun": "SURABAYA",
    "gt": "315",
    "nt": "95",
    "dwt": "115",
    "loa": "39",
    "lbp": "33,2",
    "bmld": "9,5",
    "hmld": "2,75",
    "t": "1,5",
    "lt": "1260",
    "geladak": "3",
    "palka": "",
    "ruangMuat": "0",
    "sekatMemanjang": "0",
    "sekatMelintang": "6",
    "forecastle": "0/0/0",
    "bower": {
      "jumlahBerat": "3/660.00",
      "panjangRantai": "300",
      "diaRantai": "26",
      "tipe": "",
      "tipeRantai": "",
      "kualitasRantai": "0"
    },
    "stream": {
      "jumlahBerat": "0/0.00",
      "panjangRantai": "0",
      "diaRantai": "0",
      "tipe": "",
      "tipeRantai": "",
      "kualitasRantai": "0"
    },
    "sistemStart": "",
    "jmlBalingBaling": "2",
    "tipeBalingBaling": "",
    "voltase": "380",
    "arus": "",
    "jenisMesin": "DIESEL",
    "jmlMesinInduk": "2",
    "caraKerja": "4 TAK (CYCLE)",
    "gigiReduksi": "1 : 3.03",
    "kecepatanDinas": "12",
    "kecepatanCoba": "",
    "dayaListrik": "77",
    "jmlMesinBantu": "2",
    "diaLangkah": "148 x 165",
    "pemilik": "ASDP INDONESIA FERRY, PT (PERSERO)",
    "alamatPemilik": "JL. JENDRAL AHMAD YANI KAV. 52 A",
    "kotaPemilik": "JAKARTA",
    "operator": "A.S.D.P INDONESIA FERRY, PT.",
    "alamatOperator": "JL.JEND.A.YANI KAV.52-A",
    "kotaOperator": "JAKARTA",
    "mesinInduk": [
      {
        "no": "1",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "silinder": "6",
        "tenaga": "400",
        "rpm": "1800",
        "tahun": "1987",
        "model": "6 LA DTE 439 5502",
        "posisi": "PS"
      },
      {
        "no": "2",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "silinder": "6",
        "tenaga": "400",
        "rpm": "1800",
        "tahun": "1987",
        "model": "6 LA DTE 439 5807",
        "posisi": "SB"
      }
    ],
    "mesinBantu": [
      {
        "item": "A01",
        "merk": "YANMAR",
        "pabrik": "YANMAR CO., LTD.",
        "lokasi": "JAPAN",
        "model": "4TNV106T-GGE",
        "bhp": "90",
        "tahun": "2014"
      },
      {
        "item": "A02",
        "merk": "PERKINS",
        "pabrik": "PERKINS ENGINE COMPANY LIMITED.",
        "lokasi": "ENGLAND",
        "model": "1103A-33YG2",
        "bhp": "72",
        "tahun": "2013"
      }
    ],
    "surveiKlas": [
      {
        "jenis": "Special Survey",
        "jatuhTempo": "2030-07-14",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2025-07-05"
      },
      {
        "jenis": "Annual Survey",
        "jatuhTempo": "",
        "rentangDari": "2026-04-14",
        "rentangSampai": "2026-10-14",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Docking Survey",
        "jatuhTempo": "2026-11-04",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2025-11-04"
      },
      {
        "jenis": "Intermediate Survey",
        "jatuhTempo": "",
        "rentangDari": "2027-04-14",
        "rentangSampai": "2028-10-14",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Propeller Shaft (starboard-aft), Method 4",
        "jatuhTempo": "2027-12-15",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2022-12-15"
      },
      {
        "jenis": "Propeller Shaft (portside-aft), Method 4",
        "jatuhTempo": "2029-12-02",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2024-12-02"
      }
    ],
    "surveiStatutori": [
      {
        "jenis": "Annual Load Line",
        "terakhir": "",
        "berikut1": "2026-04-14",
        "berikut2": "2026-10-14",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SKKP Nasional",
        "terakhir": "2024-12-03",
        "berikut1": "2024-09-24",
        "berikut2": "2025-12-02",
        "ditunda": ""
      },
      {
        "jenis": "Extension SKKP Nasional",
        "terakhir": "2025-03-03",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Annual SNPP",
        "terakhir": "2024-12-03",
        "berikut1": "2024-08-24",
        "berikut2": "2025-02-24",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SNPP",
        "terakhir": "2021-11-24",
        "berikut1": "2025-07-14",
        "berikut2": "2025-10-14",
        "ditunda": ""
      },
      {
        "jenis": "Renewal Load Line (PM 39)",
        "terakhir": "2025-07-05",
        "berikut1": "2030-07-14",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Replacement AFS Nasional",
        "terakhir": "2024-12-03",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      }
    ],
    "rekomendasi": "NIL",
    "rekomendasiJatuhTempo": "",
    "memoranda": "1. Skema harmonisasi KLAS & STATUTORIA DITETAPKAN TANGGAL ULANG TAHUN BARU 24 NOVEMBER, DI TAHUN 2021 UNTUK TIME WINDOW SURVEY PERIODIK (AS, IS DAN DS) BERIKUTNYA AGAR MENGACU KE TANGGAL ULANG TAHUN BARU.\n\nNote : Untuk disarankan ke Pemilik, dalam rangka mengharmonisasikan tanggal ulang tahun Sertifikat Klas dan Sertifikat Statutoria (SKKP & SNPP) untuk melaksanakan Survey Pembaruan SNPP & SKKP di Percepat di atas dok bersamaan dengan Survey Pembaruan Klas selesai paling lambat tanggal 14.07.2025\n\n2. Telah diterbitkan Surat Persetujuan (atau exemption) dari Pemerintah (Direktorat Transportasi Sungai Danau dan Penyeberangan) nomor AP.402/11/21/TSDP-01/2023 Perihal Permohonan Exemption KMP KERAPU II tanggal 16 Mei 2023\n\nDivisi Survey (dikeluarkan tanggal: 12.11.24)\n1. Berdasarkan berita acara tertanda master yang diperoleh BKI pada 07.11.24 kapal mengalami kerusakan pada part Mesin Penggerak Kanan (ME-SB), yaitu piston, cylinder head, push rod, valve exhaust, injector nozzle sehingga dapat berpengaruh pada status klas kapal setelah 30.12.23\n2. Survey khusus terkait kerusakan pada butir 1 dan dampak kerusakan terkait lainnya perlu dilaksanakan untuk mempertahankan status klas kapal.\n\nKAPAL INI TERMASUK DALAM KAPAL YANG DIATUR DALAM PERATURAN MENTERI PERHUBUNGAN NO. 4 TAHUN 2025. SELANJUTNYA AGAR DILAKSANAKAN PENYESUAIAN SERTIFIKAT GARIS MUAT NASIONAL DARI KP.988/AP.402/DRJD/2021 MENJADI PM 39 TAHUN 2016 OLEH SURVEYOR BKI PALING LAMBAT SURVEY PERIODIK TERDEKAT."
  },
  "kmp-ariwangan": {
    "nama": "KMP. ARIWANGAN",
    "namaBKI": "ARIWANGAN",
    "register": "3927",
    "imo": "8824799",
    "status": "AKTIF (ACTIVE)",
    "jenisKapal": "FERRY",
    "material": "BAJA (STEEL)",
    "pelabuhan": "JAKARTA",
    "bendera": "INDONESIA",
    "tandaKelasLambung": "L",
    "callSign": "YDZL",
    "bangunan": "BARU (NEW)",
    "namaSebelumnya": "",
    "dualKelas": "",
    "exDualKelas": "",
    "instalasiPendingin": "",
    "cms": "",
    "statusPending": "",
    "kategori": "IACS Non Compliance",
    "galangan": "PT.KODJA (PERSERO)",
    "tahun": "1986",
    "tglPeluncuran": "1986-07-07",
    "lokasiBangun": "PALEMBANG",
    "gt": "157",
    "nt": "47",
    "dwt": "0",
    "loa": "29,05",
    "lbp": "25",
    "bmld": "7",
    "hmld": "2,2",
    "t": "0",
    "lt": "960",
    "geladak": "0",
    "palka": "",
    "ruangMuat": "0",
    "sekatMemanjang": "0",
    "sekatMelintang": "0",
    "forecastle": "0/0/0",
    "bower": {
      "jumlahBerat": "2/300.00",
      "panjangRantai": "247,5",
      "diaRantai": "18",
      "tipe": "",
      "tipeRantai": "",
      "kualitasRantai": "0"
    },
    "stream": {
      "jumlahBerat": "0/0.00",
      "panjangRantai": "0",
      "diaRantai": "0",
      "tipe": "",
      "tipeRantai": "",
      "kualitasRantai": "0"
    },
    "sistemStart": "",
    "jmlBalingBaling": "2",
    "tipeBalingBaling": "",
    "voltase": "380",
    "arus": "AC",
    "jenisMesin": "DIESEL",
    "jmlMesinInduk": "2",
    "caraKerja": "4 TAK (CYCLE)",
    "gigiReduksi": "",
    "kecepatanDinas": "",
    "kecepatanCoba": "",
    "dayaListrik": "63",
    "jmlMesinBantu": "2",
    "diaLangkah": "130 x 150",
    "pemilik": "PT. ASDP INDONESIA FERRY (PERSERO)",
    "alamatPemilik": "JL. JEND. AHAMD YANI NO. 52 A",
    "kotaPemilik": "JAKARTA",
    "operator": "A.S.D.P INDONESIA FERRY, PT.",
    "alamatOperator": "JL.JEND.A.YANI KAV.52-A",
    "kotaOperator": "JAKARTA",
    "mesinInduk": [
      {
        "no": "1",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "silinder": "6",
        "tenaga": "240",
        "rpm": "2000",
        "tahun": "1986",
        "model": "6 HA-HTA 12397",
        "posisi": "SB"
      },
      {
        "no": "2",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "silinder": "6",
        "tenaga": "240",
        "rpm": "2000",
        "tahun": "1986",
        "model": "6 HA-HTA 12398",
        "posisi": "PS"
      }
    ],
    "mesinBantu": [
      {
        "item": "A01",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "lokasi": "JAPAN",
        "model": "4 CHL-N",
        "bhp": "38",
        "tahun": "1985"
      },
      {
        "item": "A02",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "lokasi": "JAPAN",
        "model": "4 CHL-N",
        "bhp": "38",
        "tahun": "1985"
      }
    ],
    "surveiKlas": [
      {
        "jenis": "Special Survey",
        "jatuhTempo": "2031-06-22",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-07-13"
      },
      {
        "jenis": "Annual Survey",
        "jatuhTempo": "",
        "rentangDari": "2027-03-22",
        "rentangSampai": "2027-09-22",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Docking Survey",
        "jatuhTempo": "2027-07-13",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-07-13"
      },
      {
        "jenis": "Intermediate Survey",
        "jatuhTempo": "",
        "rentangDari": "2028-03-22",
        "rentangSampai": "2029-09-22",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Propeller Shaft (portside-aft), Method 4",
        "jatuhTempo": "2029-06-24",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2024-06-24"
      },
      {
        "jenis": "Propeller Shaft (starboard-aft), Method 4",
        "jatuhTempo": "2029-06-24",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2024-06-24"
      }
    ],
    "surveiStatutori": [
      {
        "jenis": "Annual Load Line",
        "terakhir": "",
        "berikut1": "2027-03-22",
        "berikut2": "2027-09-22",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SKKP Nasional",
        "terakhir": "2024-06-24",
        "berikut1": "2025-03-22",
        "berikut2": "2025-06-22",
        "ditunda": ""
      },
      {
        "jenis": "Extension SKKP Nasional",
        "terakhir": "2025-03-03",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Annual SNPP",
        "terakhir": "2022-06-10",
        "berikut1": "2023-03-22",
        "berikut2": "2023-09-22",
        "ditunda": ""
      },
      {
        "jenis": "Annual SNPP",
        "terakhir": "2023-07-07",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Annual SNPP",
        "terakhir": "2024-06-24",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Intermediate SNPP",
        "terakhir": "",
        "berikut1": "2023-03-22",
        "berikut2": "2024-09-22",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SNPP",
        "terakhir": "2021-06-21",
        "berikut1": "2026-03-22",
        "berikut2": "2026-06-22",
        "ditunda": ""
      },
      {
        "jenis": "Additional SNPP",
        "terakhir": "2022-12-08",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Additional SNPP",
        "terakhir": "2023-12-24",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Renewal Load Line ILLC 88",
        "terakhir": "2021-06-21",
        "berikut1": "2026-03-22",
        "berikut2": "2026-06-22",
        "ditunda": ""
      },
      {
        "jenis": "Additional AFS Nasional",
        "terakhir": "2024-06-24",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      }
    ],
    "rekomendasi": "NIL",
    "rekomendasiJatuhTempo": "",
    "memoranda": "Penundaan rekomendasi temuan survey sesuai dengan Surat Exemption dari Perhubungan darat No.AP.402/3130/TSDP-01/XI/2022."
  },
  "kmp-pulau-sagori": {
    "nama": "KMP. PULAU SAGORI",
    "namaBKI": "PULAU SAGORI",
    "register": "8179",
    "imo": "9210608",
    "status": "AKTIF (ACTIVE)",
    "jenisKapal": "FERRY",
    "material": "BAJA (STEEL)",
    "pelabuhan": "BITUNG",
    "bendera": "INDONESIA",
    "tandaKelasLambung": "L",
    "callSign": "YHCG",
    "bangunan": "BARU (NEW)",
    "namaSebelumnya": "",
    "dualKelas": "",
    "exDualKelas": "",
    "instalasiPendingin": "",
    "cms": "",
    "statusPending": "",
    "kategori": "IACS Non Compliance",
    "galangan": "PT.INDUSTRI KAPAL INDONESIA",
    "tahun": "2001",
    "tglPeluncuran": "2001-09-03",
    "lokasiBangun": "BITUNG",
    "gt": "380",
    "nt": "114",
    "dwt": "0",
    "loa": "39,8",
    "lbp": "34,7",
    "bmld": "10,5",
    "hmld": "2,8",
    "t": "1,85",
    "lt": "960",
    "geladak": "2",
    "palka": "",
    "ruangMuat": "0",
    "sekatMemanjang": "0",
    "sekatMelintang": "5",
    "forecastle": "0/0/0",
    "bower": {
      "jumlahBerat": "2/470.00",
      "panjangRantai": "357,5",
      "diaRantai": "19",
      "tipe": "Stockless Anchor",
      "tipeRantai": "Stud Link",
      "kualitasRantai": "2"
    },
    "stream": {
      "jumlahBerat": "0/0.00",
      "panjangRantai": "0",
      "diaRantai": "0",
      "tipe": "",
      "tipeRantai": "",
      "kualitasRantai": "0"
    },
    "sistemStart": "AKI (BATTERY)",
    "jmlBalingBaling": "2",
    "tipeBalingBaling": "",
    "voltase": "220/380",
    "arus": "AC",
    "jenisMesin": "DIESEL",
    "jmlMesinInduk": "2",
    "caraKerja": "4 TAK (CYCLE)",
    "gigiReduksi": "1 : 3.50",
    "kecepatanDinas": "10,5",
    "kecepatanCoba": "10,5",
    "dayaListrik": "90",
    "jmlMesinBantu": "2",
    "diaLangkah": "148 x 165",
    "pemilik": "ASDP INDONESIA FERRY, PT (PERSERO)",
    "alamatPemilik": "JL. JENDRAL AHMAD YANI KAV. 52 A",
    "kotaPemilik": "JAKARTA",
    "operator": "A.S.D.P INDONESIA FERRY, PT.",
    "alamatOperator": "JL.JEND.A.YANI KAV.52-A",
    "kotaOperator": "JAKARTA",
    "mesinInduk": [
      {
        "no": "1",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "silinder": "6",
        "tenaga": "530",
        "rpm": "1850",
        "tahun": "1999",
        "model": "6 LAA-UTE 6150",
        "posisi": "SB"
      },
      {
        "no": "2",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "silinder": "6",
        "tenaga": "530",
        "rpm": "1850",
        "tahun": "1999",
        "model": "6 LAA-UTE 6151",
        "posisi": "PS"
      }
    ],
    "mesinBantu": [
      {
        "item": "A01",
        "merk": "CUMMINS",
        "pabrik": "CUMMINS ENGINE COMPANY INC",
        "lokasi": "USA",
        "model": "4 BT3-9-D (M)",
        "bhp": "72",
        "tahun": "1998"
      },
      {
        "item": "A02",
        "merk": "YANMAR",
        "pabrik": "YANMAR CO., LTD.",
        "lokasi": "JAPAN",
        "model": "4TNV106T-GGE",
        "bhp": "76",
        "tahun": "1998"
      }
    ],
    "surveiKlas": [
      {
        "jenis": "Special Survey",
        "jatuhTempo": "2031-04-29",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-05-11"
      },
      {
        "jenis": "Annual Survey",
        "jatuhTempo": "",
        "rentangDari": "2027-01-29",
        "rentangSampai": "2027-07-29",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Docking Survey",
        "jatuhTempo": "2027-05-11",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-05-11"
      },
      {
        "jenis": "Intermediate Survey",
        "jatuhTempo": "",
        "rentangDari": "2028-01-29",
        "rentangSampai": "2029-07-29",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Propeller Shaft (starboard-aft), Method 4",
        "jatuhTempo": "2031-05-11",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-05-11"
      },
      {
        "jenis": "Propeller Shaft (portside-aft), Method 4",
        "jatuhTempo": "2031-05-11",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-05-11"
      }
    ],
    "surveiStatutori": [
      {
        "jenis": "Annual Load Line",
        "terakhir": "",
        "berikut1": "2027-01-29",
        "berikut2": "2027-07-29",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SKKP Nasional",
        "terakhir": "2024-05-28",
        "berikut1": "2025-01-29",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Annual SNPP",
        "terakhir": "2024-05-28",
        "berikut1": "2025-01-29",
        "berikut2": "2025-07-29",
        "ditunda": ""
      },
      {
        "jenis": "Intermediate SNPP",
        "terakhir": "2023-05-31",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SNPP",
        "terakhir": "2021-08-04",
        "berikut1": "2026-01-29",
        "berikut2": "2026-04-29",
        "ditunda": ""
      },
      {
        "jenis": "Renewal Load Line (PM 39)",
        "terakhir": "2026-05-11",
        "berikut1": "2031-04-29",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Sertifikat AFS Nasional",
        "terakhir": "2024-05-28",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      }
    ],
    "rekomendasi": "NIL",
    "rekomendasiJatuhTempo": "",
    "memoranda": "1. Kapal yang kontrak pembangunan sebelum 1 Juli 2021 yang belum memasang sprinkler system pada ruang penumpang, diwajibkan untuk memasang sprinkler system paling lambat 1 juli 2026.\n2. Kapal yang kontrak pembangunan sebelum 1 Juli 2021 wajib memiliki approved damage stability paling lambat 1 juli 2026.\nTelah diterbitkan Surat Persetujuan penundaan rekomendasi (atau exemption) dari Pemerintah (Direktorat Transportasi Sungai Danau dan Penyeberangan)\n- nomor AP.402/12/98/TSDP-01/2023 tanggal 26 Mei 2023;\n- nomor AP.402/22/55/TSDP-01/2023 tanggal 28 Mei 2024;\nKAPAL INI TERMASUK DALAM KAPAL YANG DIATUR DALAM PERATURAN MENTERI PERHUBUNGAN NO. 4 TAHUN 2025. SELANJUTNYA AGAR DILAKSANAKAN PENYESUAIAN SERTIFIKAT GARIS MUAT NASIONAL DARI KP.988/AP.402/DRJD/2021 MENJADI PM 39 TAHUN 2016 OLEH SURVEYOR BKI PALING LAMBAT SURVEY PERIODIK TERDEKAT."
  },
  "kmp-lompa": {
    "nama": "KMP. LOMPA",
    "namaBKI": "LOMPA",
    "register": "22047",
    "imo": "9816983",
    "status": "AKTIF (ACTIVE)",
    "jenisKapal": "PASSANGER FERRY",
    "material": "BAJA (STEEL)",
    "pelabuhan": "JAKARTA",
    "bendera": "INDONESIA",
    "tandaKelasLambung": "P",
    "callSign": "YBPJ2",
    "bangunan": "BARU (NEW)",
    "namaSebelumnya": "",
    "dualKelas": "",
    "exDualKelas": "",
    "instalasiPendingin": "",
    "cms": "",
    "statusPending": "",
    "kategori": "IACS Non Compliance",
    "galangan": "PT. DAYA RADAR UTAMA",
    "tahun": "2017",
    "tglPeluncuran": "2016-11-09",
    "lokasiBangun": "LAMPUNG",
    "gt": "589",
    "nt": "177",
    "dwt": "0",
    "loa": "45,5",
    "lbp": "40,15",
    "bmld": "12",
    "hmld": "3,2",
    "t": "2,14",
    "lt": "1060",
    "geladak": "1",
    "palka": "",
    "ruangMuat": "1",
    "sekatMemanjang": "0",
    "sekatMelintang": "6",
    "forecastle": "0/0/0",
    "bower": {
      "jumlahBerat": "2/780.00",
      "panjangRantai": "330",
      "diaRantai": "24",
      "tipe": "",
      "tipeRantai": "Stud Link",
      "kualitasRantai": "0"
    },
    "stream": {
      "jumlahBerat": "0/0.00",
      "panjangRantai": "0",
      "diaRantai": "0",
      "tipe": "",
      "tipeRantai": "Stock Anchor",
      "kualitasRantai": "0"
    },
    "sistemStart": "AKI (BATTERY)",
    "jmlBalingBaling": "2",
    "tipeBalingBaling": "",
    "voltase": "380",
    "arus": "129",
    "jenisMesin": "",
    "jmlMesinInduk": "2",
    "caraKerja": "",
    "gigiReduksi": "",
    "kecepatanDinas": "",
    "kecepatanCoba": "",
    "dayaListrik": "68",
    "jmlMesinBantu": "2",
    "diaLangkah": "",
    "pemilik": "SATUAN KERJA PENGEMBANGAN LLASDP PROVINSI SULAWESI TENGAH",
    "alamatPemilik": "JL. RA. KARTINI NO. 35",
    "kotaPemilik": "PALU - SULAWESI TENGGARA",
    "operator": "A.S.D.P INDONESIA FERRY, PT.",
    "alamatOperator": "JL.JEND.A.YANI KAV.52-A",
    "kotaOperator": "JAKARTA",
    "mesinInduk": [
      {
        "no": "1",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "silinder": "6",
        "tenaga": "818",
        "rpm": "1900",
        "tahun": "2016",
        "model": "6AYM-WET 6262",
        "posisi": "PA"
      },
      {
        "no": "2",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "silinder": "6",
        "tenaga": "818",
        "rpm": "1900",
        "tahun": "2016",
        "model": "6AYM-WET 6261",
        "posisi": "SA"
      }
    ],
    "mesinBantu": [
      {
        "item": "A01",
        "merk": "PERKINS",
        "pabrik": "PERKINS MARINE POWER",
        "lokasi": "ENGLAND",
        "model": "6TG2AM",
        "bhp": "124",
        "tahun": "2015"
      },
      {
        "item": "A02",
        "merk": "PERKINS",
        "pabrik": "PERKINS MARINE POWER",
        "lokasi": "ENGLAND",
        "model": "6TG2AM",
        "bhp": "124",
        "tahun": "2015"
      }
    ],
    "surveiKlas": [
      {
        "jenis": "Special Survey",
        "jatuhTempo": "2027-06-25",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2022-06-25"
      },
      {
        "jenis": "Annual Survey",
        "jatuhTempo": "",
        "rentangDari": "2026-03-25",
        "rentangSampai": "2026-09-25",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Docking Survey",
        "jatuhTempo": "2026-09-17",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2025-09-17"
      },
      {
        "jenis": "Intermediate Survey",
        "jatuhTempo": "",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Propeller Shaft (portside-aft), Method 4",
        "jatuhTempo": "2027-09-08",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2022-09-08"
      },
      {
        "jenis": "Propeller Shaft (starboard-aft), Method 4",
        "jatuhTempo": "2027-09-08",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2022-09-08"
      }
    ],
    "surveiStatutori": [
      {
        "jenis": "Annual Load Line",
        "terakhir": "2025-09-17",
        "berikut1": "2026-03-25",
        "berikut2": "2026-09-25",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SKKP Nasional",
        "terakhir": "2024-10-12",
        "berikut1": "2025-06-08",
        "berikut2": "2025-09-08",
        "ditunda": ""
      },
      {
        "jenis": "Additional SKKP Nasional",
        "terakhir": "2025-01-10",
        "berikut1": "2025-04-06",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Annual SNPP",
        "terakhir": "2024-10-12",
        "berikut1": "2025-06-08",
        "berikut2": "2025-12-08",
        "ditunda": ""
      },
      {
        "jenis": "Intermediate SNPP",
        "terakhir": "2024-10-12",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SNPP",
        "terakhir": "2022-09-08",
        "berikut1": "2027-03-25",
        "berikut2": "2027-06-25",
        "ditunda": ""
      },
      {
        "jenis": "Additional SNPP",
        "terakhir": "2025-01-10",
        "berikut1": "2025-07-06",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Renewal Load Line (Hubdat)",
        "terakhir": "2022-06-25",
        "berikut1": "2027-06-25",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Sertifikat AFS Nasional",
        "terakhir": "2024-10-12",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      }
    ],
    "rekomendasi": "NIL",
    "rekomendasiJatuhTempo": "",
    "memoranda": "1. Kapal yang kontrak pembangunan sebelum 1 Juli 2021 yang belum memasang Automatic Sprinkler System pada ruang penumpang, diwajibkan untuk memasang sprinkler system paling lambat 1 juli 2026.\n2. Kapal yang kontrak pembangunan sebelum 1 Juli 2021 wajib memiliki approved damage stability paling lambat 1 juli 2026.\n3. MES agar dilaksanakan service berkala oleh perusahaan service supplier.\n\n1. PUTARAN M/E NO.1 & 2 DITETAPKAN 1800 RPM SAAT KAPAL BEROPERASI (SET OUT AT TANJUNG BRANCH OFFICE 11/12/2017)\n\n2. Telah diterbitkan Surat Persetujuan (atau exemption) dari Pemerintah (Direktorat Transportasi Sungai Danau dan Penyeberangan):\n- nomor AP.402/2368/TSDP-01/VIII/2022 tanggal 07 September 2022;\n- nomor AP.402/31/55/TSDP-01/VIII/2022 tanggal 05 Oktober 2023;\n- nomor AP.402/37/27/TSDP-01/2024 tanggal 10 Oktober 2024;\n- nomor AP.402/01/43/TSDP-01/2025 tanggal 07 Januari 2025;\nDALAM RANGKA HARMONISASI SURVEY, AGAR DILAKSANAKAN SURVEY PEMBARUAN KLAS DIPERCEPAT PADA SAAT PELAKSANAAN DO YAD."
  },
  "kmp-baronang": {
    "nama": "KMP. BARONANG",
    "namaBKI": "BARONANG",
    "register": "5101",
    "imo": "8872679",
    "status": "DITANGGUHKAN (SUSPEND)",
    "jenisKapal": "PASSANGER CAR FERRY",
    "material": "BAJA (STEEL)",
    "pelabuhan": "JAKARTA",
    "bendera": "INDONESIA",
    "tandaKelasLambung": "P",
    "callSign": "YFAC",
    "bangunan": "BARU (NEW)",
    "namaSebelumnya": "",
    "dualKelas": "",
    "exDualKelas": "",
    "instalasiPendingin": "",
    "cms": "",
    "statusPending": "",
    "kategori": "IACS Non Compliance",
    "galangan": "PT.NOAHTU SHIPYARD",
    "tahun": "1992",
    "tglPeluncuran": "1992-11-23",
    "lokasiBangun": "PANJANG-LAMPUNG",
    "gt": "526",
    "nt": "158",
    "dwt": "0",
    "loa": "45,3",
    "lbp": "40,72",
    "bmld": "12",
    "hmld": "3",
    "t": "2",
    "lt": "1010",
    "geladak": "2",
    "palka": "",
    "ruangMuat": "0",
    "sekatMemanjang": "0",
    "sekatMelintang": "6",
    "forecastle": "0/0/0",
    "bower": {
      "jumlahBerat": "2/660.00",
      "panjangRantai": "302,5",
      "diaRantai": "26",
      "tipe": "",
      "tipeRantai": "",
      "kualitasRantai": "0"
    },
    "stream": {
      "jumlahBerat": "0/0.00",
      "panjangRantai": "0",
      "diaRantai": "0",
      "tipe": "",
      "tipeRantai": "",
      "kualitasRantai": "0"
    },
    "sistemStart": "",
    "jmlBalingBaling": "2",
    "tipeBalingBaling": "",
    "voltase": "380/220",
    "arus": "AC",
    "jenisMesin": "DIESEL",
    "jmlMesinInduk": "2",
    "caraKerja": "4 TAK (CYCLE)",
    "gigiReduksi": "",
    "kecepatanDinas": "10,5",
    "kecepatanCoba": "12,5",
    "dayaListrik": "160",
    "jmlMesinBantu": "3",
    "diaLangkah": "160 x 210",
    "pemilik": "A.S.D.P INDONESIA FERRY, PT. (PERSERO)",
    "alamatPemilik": "JL.JEND.A.YANI KAV.52-A",
    "kotaPemilik": "JAKARTA",
    "operator": "A.S.D.P INDONESIA FERRY, PT.",
    "alamatOperator": "JL.JEND.A.YANI KAV.52-A",
    "kotaOperator": "JAKARTA",
    "mesinInduk": [
      {
        "no": "1",
        "merk": "NIIGATA",
        "pabrik": "NIIGATA ENGINEERING CO., LTD.",
        "silinder": "6",
        "tenaga": "650",
        "rpm": "1450",
        "tahun": "1992",
        "model": "6NSD-M 20522",
        "posisi": "PS"
      },
      {
        "no": "2",
        "merk": "NIIGATA",
        "pabrik": "NIIGATA ENGINEERING CO., LTD.",
        "silinder": "6",
        "tenaga": "650",
        "rpm": "1450",
        "tahun": "1992",
        "model": "6NSD-M 20521",
        "posisi": "SB"
      }
    ],
    "mesinBantu": [
      {
        "item": "A01",
        "merk": "PERKINS",
        "pabrik": "PERKINS ENGINE CO.",
        "lokasi": "ENGLAND",
        "model": "T63544M",
        "bhp": "115",
        "tahun": "1992"
      },
      {
        "item": "A02",
        "merk": "PERKINS",
        "pabrik": "PERKINS ENGINE CO.",
        "lokasi": "ENGLAND",
        "model": "T63544M",
        "bhp": "115",
        "tahun": "1992"
      },
      {
        "item": "A03",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "lokasi": "JAPAN",
        "model": "TF155-H",
        "bhp": "14",
        "tahun": ""
      }
    ],
    "surveiKlas": [
      {
        "jenis": "Special Survey",
        "jatuhTempo": "2030-08-27",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2025-08-13"
      },
      {
        "jenis": "Annual Survey",
        "jatuhTempo": "",
        "rentangDari": "2026-05-27",
        "rentangSampai": "2026-11-27",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Docking Survey",
        "jatuhTempo": "2026-08-13",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2025-08-13"
      },
      {
        "jenis": "Intermediate Survey",
        "jatuhTempo": "",
        "rentangDari": "2027-05-27",
        "rentangSampai": "2028-11-27",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Propeller Shaft (portside-aft), Method 4",
        "jatuhTempo": "2029-10-16",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2024-10-16"
      },
      {
        "jenis": "Propeller Shaft (starboard-aft), Method 4",
        "jatuhTempo": "2029-10-16",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2024-10-16"
      }
    ],
    "surveiStatutori": [
      {
        "jenis": "Annual Load Line",
        "terakhir": "",
        "berikut1": "2026-05-27",
        "berikut2": "2026-11-27",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SKKP Nasional",
        "terakhir": "2024-10-16",
        "berikut1": "2025-05-27",
        "berikut2": "2025-08-27",
        "ditunda": ""
      },
      {
        "jenis": "Extension SKKP Nasional",
        "terakhir": "2025-04-17",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Intermediate SNPP",
        "terakhir": "2023-10-13",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SNPP",
        "terakhir": "2021-07-09",
        "berikut1": "2025-04-09",
        "berikut2": "2025-08-27",
        "ditunda": ""
      },
      {
        "jenis": "Renewal Load Line (PM 39)",
        "terakhir": "2025-08-13",
        "berikut1": "2030-08-27",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Sertifikat AFS Nasional",
        "terakhir": "2024-10-16",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      }
    ],
    "rekomendasi": "NIL",
    "rekomendasiJatuhTempo": "",
    "memoranda": "1. Kapal yang kontrak pembangunan sebelum 1 juli 2021 yang belum memasang automatic sprinkler system pada ruang penumpang, diwajibkan untuk memasang sprinkler system paling lambat 1 juli 2026.\n2. Kapal yang kontrak pembangunan sebelum 1 juli 2021 wajib memiliki approved damage stability paling lambat 1 juli 2026.\n\nJatuh tempo pengedokan 2023 telah diharmonisasi dengan masa berlaku sertifikat SKKP\nKAPAL INI TERMASUK DALAM KAPAL YANG DIATUR DALAM PERATURAN MENTERI PERHUBUNGAN NO. 4 TAHUN 2025. SELANJUTNYA AGAR DILAKSANAKAN PENYESUAIAN SERTIFIKAT GARIS MUAT NASIONAL DARI KP.988/AP.402/DRJD/2021 MENJADI PM 39 TAHUN 2016 OLEH SURVEYOR BKI PALING LAMBAT SURVEY PERIODIK TERDEKAT."
  },
  "kmp-gorango": {
    "nama": "KMP. GORANGO",
    "namaBKI": "GORANGO",
    "register": "13054",
    "imo": "8647270",
    "status": "DITANGGUHKAN (SUSPEND)",
    "jenisKapal": "FERRY",
    "material": "BAJA (STEEL)",
    "pelabuhan": "SURABAYA",
    "bendera": "INDONESIA",
    "tandaKelasLambung": "P",
    "callSign": "PNGR",
    "bangunan": "BARU (NEW)",
    "namaSebelumnya": "",
    "dualKelas": "",
    "exDualKelas": "",
    "instalasiPendingin": "",
    "cms": "",
    "statusPending": "",
    "kategori": "IACS Non Compliance",
    "galangan": "PT.ADILUHUNG SARANASEGARA INDONESIA",
    "tahun": "2010",
    "tglPeluncuran": "2009-08-21",
    "lokasiBangun": "BANGKALAN-MADURA",
    "gt": "617",
    "nt": "186",
    "dwt": "320,8",
    "loa": "45,5",
    "lbp": "40,92",
    "bmld": "12",
    "hmld": "3,2",
    "t": "2,14",
    "lt": "1060",
    "geladak": "1",
    "palka": "",
    "ruangMuat": "0",
    "sekatMemanjang": "0",
    "sekatMelintang": "5",
    "forecastle": "0/0/0",
    "bower": {
      "jumlahBerat": "2/780.00",
      "panjangRantai": "330",
      "diaRantai": "24",
      "tipe": "",
      "tipeRantai": "Stud Link",
      "kualitasRantai": "0"
    },
    "stream": {
      "jumlahBerat": "0/0.00",
      "panjangRantai": "0",
      "diaRantai": "0",
      "tipe": "",
      "tipeRantai": "Stock Anchor",
      "kualitasRantai": "0"
    },
    "sistemStart": "AKI (BATTERY)",
    "jmlBalingBaling": "2",
    "tipeBalingBaling": "",
    "voltase": "400",
    "arus": "117.3",
    "jenisMesin": "",
    "jmlMesinInduk": "2",
    "caraKerja": "",
    "gigiReduksi": "",
    "kecepatanDinas": "11",
    "kecepatanCoba": "12",
    "dayaListrik": "162",
    "jmlMesinBantu": "2",
    "diaLangkah": "",
    "pemilik": "DEPARTEMEN PERHUBUNGAN DITJEN PERHUBUNGAN DARAT",
    "alamatPemilik": "JL.JEND.SUDIRMAN 77",
    "kotaPemilik": "JAKARTA",
    "operator": "A.S.D.P INDONESIA FERRY, PT.",
    "alamatOperator": "JL.JEND.A.YANI KAV.52-A",
    "kotaOperator": "JAKARTA",
    "mesinInduk": [
      {
        "no": "1",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "silinder": "6",
        "tenaga": "829",
        "rpm": "1900",
        "tahun": "2008",
        "model": "6 AYM-ETE 1145",
        "posisi": "SA"
      },
      {
        "no": "2",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "silinder": "6",
        "tenaga": "829",
        "rpm": "1900",
        "tahun": "2008",
        "model": "6 AYM-ETE 1146",
        "posisi": "PA"
      }
    ],
    "mesinBantu": [
      {
        "item": "A01",
        "merk": "DONGFENG CUMMINS",
        "pabrik": "DONGFENG CUMMINS ENGINE CO,.LTD.",
        "lokasi": "CHINA",
        "model": "6 BT5.9-GM83",
        "bhp": "113",
        "tahun": "2009"
      },
      {
        "item": "A02",
        "merk": "DONGFENG CUMMINS",
        "pabrik": "DONGFENG CUMMINS ENGINE CO,.LTD.",
        "lokasi": "CHINA",
        "model": "6 BT5.9-GM83",
        "bhp": "113",
        "tahun": "2009"
      }
    ],
    "surveiKlas": [
      {
        "jenis": "Special Survey",
        "jatuhTempo": "2030-01-17",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2025-02-24"
      },
      {
        "jenis": "Annual Survey",
        "jatuhTempo": "",
        "rentangDari": "2026-10-17",
        "rentangSampai": "2027-04-17",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Docking Survey",
        "jatuhTempo": "2027-03-11",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-03-11"
      },
      {
        "jenis": "Intermediate Survey",
        "jatuhTempo": "",
        "rentangDari": "2026-10-17",
        "rentangSampai": "2028-04-17",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Propeller Shaft (starboard-aft), Method 4",
        "jatuhTempo": "2027-04-01",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2022-04-01"
      },
      {
        "jenis": "Propeller Shaft (portside-aft), Method 4",
        "jatuhTempo": "2031-03-11",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-03-11"
      }
    ],
    "surveiStatutori": [
      {
        "jenis": "Annual Load Line",
        "terakhir": "2026-03-11",
        "berikut1": "2026-10-17",
        "berikut2": "2027-04-17",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SKKP Nasional",
        "terakhir": "2024-04-04",
        "berikut1": "2024-10-17",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Additional SKKP Nasional",
        "terakhir": "2024-07-03",
        "berikut1": "2024-08-03",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Annual SNPP",
        "terakhir": "2024-04-04",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SNPP",
        "terakhir": "2025-02-24",
        "berikut1": "2025-01-01",
        "berikut2": "2025-04-01",
        "ditunda": ""
      },
      {
        "jenis": "Renewal Load Line (Hubdat)",
        "terakhir": "2025-02-24",
        "berikut1": "2030-02-24",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Sertifikat AFS Nasional",
        "terakhir": "2024-04-04",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      }
    ],
    "rekomendasi": "MESIN ; Item berikut supaya dilaksanakan paling lambat 10 Juni 2026. 1. Safety device ME ka/ki agar di fungsikan kembali ( LO Low pressure, High water temp, Over speed).",
    "rekomendasiJatuhTempo": "2026-06-10",
    "memoranda": "1. Kapal yang kontrak pembangunan sebelum 1 Juli 2021 yang belum memasang sprinkler system pada ruang penumpang, diwajibkan untuk memasang sprinkler system paling lambat 1 juli 2026.\n2. Kapal yang kontrak pembangunan sebelum 1 Juli 2021 wajib memiliki approved damage stability paling lambat 1 juli 2026.\nDalam rangka harmonisasi kapal disarankan agar melaksanakan Survey Pembaruan Klas, SKKP, SNPP pada bulan Mei 2024\n\nTelah diterbitkan Surat Persetujuan penundaan rekomendasi (atau exemption) dari Pemerintah (Direktorat Transportasi Sungai Danau dan Penyeberangan)\n- nomor AP.402/20/42/TSDP-01/2024 tanggal 03 April 2024\nKAPAL INI TERMASUK DALAM KAPAL YANG DIATUR DALAM PERATURAN MENTERI PERHUBUNGAN NO. 4 TAHUN 2025. SELANJUTNYA AGAR DILAKSANAKAN PENYESUAIAN SERTIFIKAT GARIS MUAT NASIONAL DARI KP.988/AP.402/DRJD/2021 MENJADI PM 39 TAHUN 2016 OLEH SURVEYOR BKI PALING LAMBAT SURVEY PERIODIK TERDEKAT."
  },
  "kmp-portlink-viii": {
    "nama": "KMP. PORTLINK VIII",
    "namaBKI": "PORTLINK VIII",
    "register": "22128",
    "imo": "9820099",
    "status": "AKTIF (ACTIVE)",
    "jenisKapal": "PASSANGER FERRY",
    "material": "BAJA (STEEL)",
    "pelabuhan": "TANJUNG PRIOK",
    "bendera": "INDONESIA",
    "tandaKelasLambung": "P",
    "callSign": "YBKI2",
    "bangunan": "LAMA (EXISTED)",
    "namaSebelumnya": "SONGLIM GOLDEN BLUE",
    "dualKelas": "",
    "exDualKelas": "",
    "instalasiPendingin": "",
    "cms": "",
    "statusPending": "",
    "kategori": "IACS Non Compliance",
    "galangan": "MUNCHANG SHIPYARD LTD.",
    "tahun": "2016",
    "tglPeluncuran": "2015-08-28",
    "lokasiBangun": "KOREA SELATAN",
    "gt": "2125",
    "nt": "1030",
    "dwt": "0",
    "loa": "69,3",
    "lbp": "57,7",
    "bmld": "13",
    "hmld": "3,3",
    "t": "2,68",
    "lt": "612",
    "geladak": "1",
    "palka": "",
    "ruangMuat": "1",
    "sekatMemanjang": "0",
    "sekatMelintang": "9",
    "forecastle": "0/0/0",
    "bower": {
      "jumlahBerat": "2/1590.00",
      "panjangRantai": "412,5",
      "diaRantai": "34",
      "tipe": "Stockless Anchor",
      "tipeRantai": "Stud Link",
      "kualitasRantai": "2"
    },
    "stream": {
      "jumlahBerat": "0/0.00",
      "panjangRantai": "0",
      "diaRantai": "0",
      "tipe": "",
      "tipeRantai": "Stock Anchor",
      "kualitasRantai": "0"
    },
    "sistemStart": "AKI (BATTERY)",
    "jmlBalingBaling": "2",
    "tipeBalingBaling": "",
    "voltase": "220/240",
    "arus": "",
    "jenisMesin": "",
    "jmlMesinInduk": "2",
    "caraKerja": "",
    "gigiReduksi": "",
    "kecepatanDinas": "",
    "kecepatanCoba": "",
    "dayaListrik": "420",
    "jmlMesinBantu": "2",
    "diaLangkah": "",
    "pemilik": "PT PANN PEMBIAYAAN MARITIM",
    "alamatPemilik": "GEDUNG PT. PANN, JL. CIKINI IV NO. 11",
    "kotaPemilik": "JAKARTA PUSAT",
    "operator": "A.S.D.P INDONESIA FERRY, PT.",
    "alamatOperator": "JL.JEND.A.YANI KAV.52-A",
    "kotaOperator": "JAKARTA",
    "mesinInduk": [
      {
        "no": "1",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "silinder": "12",
        "tenaga": "1400",
        "rpm": "1900",
        "tahun": "",
        "model": "12 AYM - WST 4379",
        "posisi": "SA"
      },
      {
        "no": "2",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "silinder": "12",
        "tenaga": "1400",
        "rpm": "1900",
        "tahun": "",
        "model": "12 AYM - WST 4380",
        "posisi": "PA"
      }
    ],
    "mesinBantu": [
      {
        "item": "A01",
        "merk": "DOOSAN",
        "pabrik": "DOOSAN INFRACORE CO,.LTD.",
        "lokasi": "KOREA",
        "model": "AD086TI",
        "bhp": "250",
        "tahun": "2015"
      },
      {
        "item": "A02",
        "merk": "DOOSAN",
        "pabrik": "DOOSAN INFRACORE CO,.LTD.",
        "lokasi": "KOREA",
        "model": "AD086TI",
        "bhp": "250",
        "tahun": "2015"
      }
    ],
    "surveiKlas": [
      {
        "jenis": "Special Survey",
        "jatuhTempo": "2026-12-22",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2021-10-21"
      },
      {
        "jenis": "Annual Survey",
        "jatuhTempo": "",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Docking Survey",
        "jatuhTempo": "2026-11-24",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2025-11-24"
      },
      {
        "jenis": "Intermediate Survey",
        "jatuhTempo": "",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Propeller Shaft (portside-aft), Method 4",
        "jatuhTempo": "2030-11-24",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2025-11-24"
      },
      {
        "jenis": "Propeller Shaft (starboard-aft), Method 4",
        "jatuhTempo": "2030-11-24",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2025-11-24"
      }
    ],
    "surveiStatutori": [
      {
        "jenis": "Annual Load Line",
        "terakhir": "2025-11-24",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SKKP Nasional",
        "terakhir": "2024-12-16",
        "berikut1": "2025-09-22",
        "berikut2": "2025-12-22",
        "ditunda": ""
      },
      {
        "jenis": "Additional SKKP Nasional",
        "terakhir": "2024-12-16",
        "berikut1": "2025-03-12",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Annual SNPP",
        "terakhir": "2024-12-16",
        "berikut1": "2025-09-22",
        "berikut2": "2026-03-22",
        "ditunda": ""
      },
      {
        "jenis": "Intermediate SNPP",
        "terakhir": "2023-12-15",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SNPP",
        "terakhir": "2021-10-21",
        "berikut1": "2026-09-22",
        "berikut2": "2026-12-22",
        "ditunda": ""
      },
      {
        "jenis": "Additional Load Line ILLC 88",
        "terakhir": "2025-11-24",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Renewal Load Line (Hubdat)",
        "terakhir": "2021-10-21",
        "berikut1": "2026-12-22",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Sertifikat AFS Nasional",
        "terakhir": "2024-12-16",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      }
    ],
    "rekomendasi": "NIL",
    "rekomendasiJatuhTempo": "",
    "memoranda": "1. Kapal yang kontrak pembangunan sebelum 1 Juli 2021 yang belum memasang Automatic Sprinkler System pada ruang penumpang, diwajibkan untuk memasang sprinkler system paling lambat 1 juli 2026.\n2. Kapal yang kontrak pembangunan sebelum 1 Juli 2021 wajib memiliki approved damage stability paling lambat 1 juli 2026.\nTelah diterbitkan Surat Persetujuan penundaan rekomendasi (atau exemption) dari Pemerintah (Direktorat Transportasi Sungai Danau dan Penyeberangan)\n- nomor AP.402/43/19/TSDP-01/2023 tanggal 14 Desember 2023\n- nomor AP.402/29/90/TSDP-01/2024 tanggal 11 Juli 2024\n- nomor AP.402/42/22/TSDP-01/2024 tanggal 13 Desember 2024\n\nKAPAL INI TERMASUK DALAM KAPAL YANG DIATUR DALAM PERATURAN MENTERI PERHUBUNGAN NO. 4 TAHUN 2025. SELANJUTNYA AGAR DILAKSANAKAN PENYESUAIAN SERTIFIKAT GARIS MUAT NASIONAL DARI KP.988/AP.402/DRJD/2021 MENJADI PM 39 TAHUN 2016 OLEH SURVEYOR BKI PALING LAMBAT SURVEY PERIODIK TERDEKAT."
  },
  "kmp-tuna": {
    "nama": "KMP. TUNA",
    "namaBKI": "TUNA",
    "register": "5253",
    "imo": "8992821",
    "status": "AKTIF (ACTIVE)",
    "jenisKapal": "PASSANGER CAR FERRY",
    "material": "BAJA (STEEL)",
    "pelabuhan": "JAKARTA",
    "bendera": "INDONESIA",
    "tandaKelasLambung": "P",
    "callSign": "YFPW",
    "bangunan": "BARU (NEW)",
    "namaSebelumnya": "",
    "dualKelas": "",
    "exDualKelas": "",
    "instalasiPendingin": "",
    "cms": "",
    "statusPending": "",
    "kategori": "IACS Non Compliance",
    "galangan": "PT.DUMAS SHIPYARD SURABAYA",
    "tahun": "1993",
    "tglPeluncuran": "1992-09-25",
    "lokasiBangun": "SURABAYA",
    "gt": "831",
    "nt": "250",
    "dwt": "0",
    "loa": "45,4",
    "lbp": "38,5",
    "bmld": "14",
    "hmld": "3,5",
    "t": "2,1",
    "lt": "1410",
    "geladak": "2",
    "palka": "",
    "ruangMuat": "0",
    "sekatMemanjang": "0",
    "sekatMelintang": "4",
    "forecastle": "0/0/0",
    "bower": {
      "jumlahBerat": "2/924.00",
      "panjangRantai": "275",
      "diaRantai": "26",
      "tipe": "Stockless Anchor",
      "tipeRantai": "Stud Link",
      "kualitasRantai": "0"
    },
    "stream": {
      "jumlahBerat": "0/0.00",
      "panjangRantai": "0",
      "diaRantai": "0",
      "tipe": "",
      "tipeRantai": "",
      "kualitasRantai": "0"
    },
    "sistemStart": "AKI (BATTERY)",
    "jmlBalingBaling": "2",
    "tipeBalingBaling": "Solid/Pejal",
    "voltase": "380",
    "arus": "AC",
    "jenisMesin": "DIESEL",
    "jmlMesinInduk": "2",
    "caraKerja": "4 TAK (CYCLE)",
    "gigiReduksi": "",
    "kecepatanDinas": "10",
    "kecepatanCoba": "12",
    "dayaListrik": "360",
    "jmlMesinBantu": "2",
    "diaLangkah": "190 x 260",
    "pemilik": "A.S.D.P INDONESIA FERRY, PT. (PERSERO)",
    "alamatPemilik": "JL.JEND.A.YANI KAV.52-A",
    "kotaPemilik": "JAKARTA",
    "operator": "A.S.D.P INDONESIA FERRY, PT.",
    "alamatOperator": "JL.JEND.A.YANI KAV.52-A",
    "kotaOperator": "JAKARTA",
    "mesinInduk": [
      {
        "no": "1",
        "merk": "NIIGATA",
        "pabrik": "NIIGATA ENGINEERING CO., LTD.",
        "silinder": "6",
        "tenaga": "900",
        "rpm": "1000",
        "tahun": "1991",
        "model": "6 NCS-M 20322",
        "posisi": "SB"
      },
      {
        "no": "2",
        "merk": "NIIGATA",
        "pabrik": "NIIGATA ENGINEERING CO., LTD.",
        "silinder": "6",
        "tenaga": "900",
        "rpm": "1000",
        "tahun": "1991",
        "model": "6 NCS-M 20321",
        "posisi": "PS"
      }
    ],
    "mesinBantu": [
      {
        "item": "A01",
        "merk": "PERKINS",
        "pabrik": "PERKINS ENGINE COMPANY LIMITED.",
        "lokasi": "ENGLAND",
        "model": "TG 3544",
        "bhp": "100",
        "tahun": "1991"
      },
      {
        "item": "A02",
        "merk": "CATERPILLAR",
        "pabrik": "CATERPILLAR INC.",
        "lokasi": "USA",
        "model": "C4.4 DITA",
        "bhp": "126",
        "tahun": "2010"
      }
    ],
    "surveiKlas": [
      {
        "jenis": "Special Survey",
        "jatuhTempo": "2031-05-23",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-06-18"
      },
      {
        "jenis": "Annual Survey",
        "jatuhTempo": "",
        "rentangDari": "2027-02-23",
        "rentangSampai": "2027-08-23",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Docking Survey",
        "jatuhTempo": "2027-06-18",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-06-18"
      },
      {
        "jenis": "Intermediate Survey",
        "jatuhTempo": "",
        "rentangDari": "2028-02-23",
        "rentangSampai": "2029-08-23",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Propeller Shaft (portside-aft), Method 4",
        "jatuhTempo": "2029-09-02",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2024-09-02"
      },
      {
        "jenis": "Propeller Shaft (starboard-aft), Method 4",
        "jatuhTempo": "2029-09-02",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2024-09-02"
      }
    ],
    "surveiStatutori": [
      {
        "jenis": "Annual Load Line",
        "terakhir": "",
        "berikut1": "2027-02-23",
        "berikut2": "2027-08-23",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SKKP Nasional",
        "terakhir": "2024-09-02",
        "berikut1": "2025-03-25",
        "berikut2": "2025-06-25",
        "ditunda": ""
      },
      {
        "jenis": "Annual SNPP",
        "terakhir": "2024-09-02",
        "berikut1": "2025-03-25",
        "berikut2": "2025-09-25",
        "ditunda": ""
      },
      {
        "jenis": "Intermediate SNPP",
        "terakhir": "2023-08-09",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SNPP",
        "terakhir": "2021-06-25",
        "berikut1": "2026-03-25",
        "berikut2": "2026-06-25",
        "ditunda": ""
      },
      {
        "jenis": "Renewal Load Line (PM 39)",
        "terakhir": "2021-06-25",
        "berikut1": "2026-05-23",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Sertifikat AFS Nasional",
        "terakhir": "2024-09-02",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      }
    ],
    "rekomendasi": "1. Safety device Mesin induk kanan dan kiri agar difungsikan kembali paling lambat 18 September 2026 ; 1. LO Low pressure. 2. High water temp Jacket cooling. 3. Over speed. 2. AE kanan (perkins) agar dibuka lengkap.",
    "rekomendasiJatuhTempo": "2026-09-18",
    "memoranda": "Kapal yang kontrak pembangunan sebelum 1 Juli 2021 yang belum memasang sprinkler system pada ruang penumpang, diwajibkan untuk memasang sprinkler system paling lambat 1 juli 2026.\n\nKapal yang kontrak pembangunan sebelum 1 Juli 2021 wajib memiliki approved damage stability paling lambat 1 juli 2026.\n\nTelah diterbitkan Surat Persetujuan (atau exemption) dari Pemerintah (Direktorat Transportasi Sungai Danau dan Penyeberangan:\n- nomor AP.402/2007/TSDP-01/VIII/2022 tanggal 15 Agustus 2022;\n- nomor AP.402/36/13/TSDP-01/2023 pada tanggal 07 November 2023;\n- nomor AP.402/35/13/TSDP-01/2024 pada tanggal 02 September 2024;"
  },
  "kmp-bobara": {
    "nama": "KMP. BOBARA",
    "namaBKI": "BOBARA",
    "register": "11116",
    "imo": "8732312",
    "status": "DITANGGUHKAN (SUSPEND)",
    "jenisKapal": "PASSANGER CAR FERRY",
    "material": "BAJA (STEEL)",
    "pelabuhan": "JAKARTA",
    "bendera": "INDONESIA",
    "tandaKelasLambung": "P",
    "callSign": "PMGN",
    "bangunan": "BARU (NEW)",
    "namaSebelumnya": "",
    "dualKelas": "",
    "exDualKelas": "",
    "instalasiPendingin": "",
    "cms": "",
    "statusPending": "",
    "kategori": "IACS Non Compliance",
    "galangan": "PT.DOK & PERKAPALAN KODJA BAHARI",
    "tahun": "2007",
    "tglPeluncuran": "2006-06-26",
    "lokasiBangun": "PALEMBANG",
    "gt": "475",
    "nt": "143",
    "dwt": "0",
    "loa": "40",
    "lbp": "34,5",
    "bmld": "10,5",
    "hmld": "2,8",
    "t": "2",
    "lt": "810",
    "geladak": "1",
    "palka": "",
    "ruangMuat": "0",
    "sekatMemanjang": "0",
    "sekatMelintang": "4",
    "forecastle": "0/0/0",
    "bower": {
      "jumlahBerat": "3/660.00",
      "panjangRantai": "302,5",
      "diaRantai": "22",
      "tipe": "",
      "tipeRantai": "",
      "kualitasRantai": "0"
    },
    "stream": {
      "jumlahBerat": "0/0.00",
      "panjangRantai": "0",
      "diaRantai": "0",
      "tipe": "",
      "tipeRantai": "",
      "kualitasRantai": "0"
    },
    "sistemStart": "AKI (BATTERY)",
    "jmlBalingBaling": "2",
    "tipeBalingBaling": "",
    "voltase": "380",
    "arus": "AC",
    "jenisMesin": "",
    "jmlMesinInduk": "2",
    "caraKerja": "",
    "gigiReduksi": "",
    "kecepatanDinas": "",
    "kecepatanCoba": "",
    "dayaListrik": "170",
    "jmlMesinBantu": "2",
    "diaLangkah": "",
    "pemilik": "A.S.D.P INDONESIA FERRY, PT. (PERSERO)",
    "alamatPemilik": "JL.JEND.A.YANI KAV.52-A",
    "kotaPemilik": "JAKARTA",
    "operator": "A.S.D.P INDONESIA FERRY, PT.",
    "alamatOperator": "JL.JEND.A.YANI KAV.52-A",
    "kotaOperator": "JAKARTA",
    "mesinInduk": [
      {
        "no": "1",
        "merk": "YANMAR",
        "pabrik": "YANMAR CO., LTD.",
        "silinder": "6",
        "tenaga": "550",
        "rpm": "2100",
        "tahun": "2006",
        "model": "6 KYM-ETE 1187",
        "posisi": "SA"
      },
      {
        "no": "2",
        "merk": "YANMAR",
        "pabrik": "YANMAR CO., LTD.",
        "silinder": "6",
        "tenaga": "550",
        "rpm": "2100",
        "tahun": "2006",
        "model": "6 KYM-ETE 1188",
        "posisi": "PA"
      }
    ],
    "mesinBantu": [
      {
        "item": "A01",
        "merk": "PERKINS SABRE",
        "pabrik": "PERKINS SABRE DIESEL ENGINES LTD",
        "lokasi": "ENGLAND",
        "model": "6 TG 2 AM",
        "bhp": "169",
        "tahun": "2006"
      },
      {
        "item": "A02",
        "merk": "PERKINS SABRE",
        "pabrik": "PERKINS SABRE DIESEL ENGINES LTD",
        "lokasi": "ENGLAND",
        "model": "6 TG 2 AM",
        "bhp": "169",
        "tahun": "2006"
      }
    ],
    "surveiKlas": [
      {
        "jenis": "Special Survey",
        "jatuhTempo": "2027-07-19",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2022-08-25"
      },
      {
        "jenis": "Annual Survey",
        "jatuhTempo": "",
        "rentangDari": "2026-04-19",
        "rentangSampai": "2026-10-19",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Docking Survey",
        "jatuhTempo": "2026-12-10",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2025-12-10"
      },
      {
        "jenis": "Intermediate Survey",
        "jatuhTempo": "",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Propeller Shaft (starboard-aft), Method 4",
        "jatuhTempo": "2029-11-18",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2024-11-18"
      },
      {
        "jenis": "Propeller Shaft (portside-aft), Method 4",
        "jatuhTempo": "2030-12-10",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2025-12-10"
      }
    ],
    "surveiStatutori": [
      {
        "jenis": "Annual Load Line",
        "terakhir": "2025-10-17",
        "berikut1": "2026-04-19",
        "berikut2": "2026-10-19",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SKKP Nasional",
        "terakhir": "2024-11-18",
        "berikut1": "2025-07-19",
        "berikut2": "2025-10-19",
        "ditunda": ""
      },
      {
        "jenis": "Annual SNPP",
        "terakhir": "2024-11-18",
        "berikut1": "2025-07-19",
        "berikut2": "2026-01-19",
        "ditunda": ""
      },
      {
        "jenis": "Intermediate SNPP",
        "terakhir": "2024-11-18",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SNPP",
        "terakhir": "2022-11-22",
        "berikut1": "2022-07-19",
        "berikut2": "2027-10-19",
        "ditunda": ""
      },
      {
        "jenis": "Renewal Load Line (Hubdat)",
        "terakhir": "2022-08-25",
        "berikut1": "2027-07-19",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Replacement AFS Nasional",
        "terakhir": "2024-11-18",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      }
    ],
    "rekomendasi": "1. Safety Device ME ka dan ki ( LO low Press, High water temp, over speed) agar di fungsikan kembali. 2. Smoke detector zona 2-5 agar di fungsikan kembali. 3. Pressure gauge Emergency Fire Pump agar di fungsikan kembali. 4. Spray Sprinkler Nozzle car deck (3 titik) agar di fungsikan kembali.",
    "rekomendasiJatuhTempo": "2026-03-09",
    "memoranda": ""
  },
  "kmp-lema": {
    "nama": "KMP. LEMA",
    "namaBKI": "LEMA",
    "register": "20078",
    "imo": "9767297",
    "status": "AKTIF (ACTIVE)",
    "jenisKapal": "PASSANGER CAR FERRY",
    "material": "BAJA (STEEL)",
    "pelabuhan": "TANJUNG PERAK",
    "bendera": "INDONESIA",
    "tandaKelasLambung": "P",
    "callSign": "PLLY",
    "bangunan": "BARU (NEW)",
    "namaSebelumnya": "",
    "dualKelas": "",
    "exDualKelas": "",
    "instalasiPendingin": "",
    "cms": "",
    "statusPending": "",
    "kategori": "IACS Non Compliance",
    "galangan": "PT.DUMAS TANJUNG PERAK SHIPYARD",
    "tahun": "2014",
    "tglPeluncuran": "2014-10-09",
    "lokasiBangun": "SURABAYA",
    "gt": "1031",
    "nt": "310",
    "dwt": "0",
    "loa": "56,02",
    "lbp": "49,12",
    "bmld": "14",
    "hmld": "3,8",
    "t": "2,7",
    "lt": "1110",
    "geladak": "1",
    "palka": "",
    "ruangMuat": "1",
    "sekatMemanjang": "0",
    "sekatMelintang": "6",
    "forecastle": "0/0/0",
    "bower": {
      "jumlahBerat": "2/1310.00",
      "panjangRantai": "385",
      "diaRantai": "32",
      "tipe": "",
      "tipeRantai": "Stud Link",
      "kualitasRantai": "0"
    },
    "stream": {
      "jumlahBerat": "0/0.00",
      "panjangRantai": "0",
      "diaRantai": "0",
      "tipe": "",
      "tipeRantai": "Stock Anchor",
      "kualitasRantai": "0"
    },
    "sistemStart": "AKI (BATTERY)",
    "jmlBalingBaling": "2",
    "tipeBalingBaling": "",
    "voltase": "380",
    "arus": "",
    "jenisMesin": "",
    "jmlMesinInduk": "2",
    "caraKerja": "",
    "gigiReduksi": "",
    "kecepatanDinas": "",
    "kecepatanCoba": "",
    "dayaListrik": "200",
    "jmlMesinBantu": "2",
    "diaLangkah": "",
    "pemilik": "ASDP INDONESIA FERRY, PT (PERSERO)",
    "alamatPemilik": "JL. JENDRAL AHMAD YANI KAV. 52 A",
    "kotaPemilik": "JAKARTA",
    "operator": "ASDP INDONESIA FERRY, PT",
    "alamatOperator": "JL. JENDRAL AHMAD YANI KAV. 52 A",
    "kotaOperator": "JAKARTA",
    "mesinInduk": [
      {
        "no": "1",
        "merk": "YANMAR",
        "pabrik": "YANMAR CO., LTD.",
        "silinder": "6",
        "tenaga": "1138",
        "rpm": "1450",
        "tahun": "2014",
        "model": "6 EY17W FPC 0444",
        "posisi": "PA"
      },
      {
        "no": "2",
        "merk": "YANMAR",
        "pabrik": "YANMAR CO., LTD.",
        "silinder": "6",
        "tenaga": "1138",
        "rpm": "1450",
        "tahun": "2014",
        "model": "6 EY17W FPC 0443",
        "posisi": "SA"
      }
    ],
    "mesinBantu": [
      {
        "item": "A01",
        "merk": "PERKINS",
        "pabrik": "PERKINS DIESEL ENGINE CO., LTD.",
        "lokasi": "ENGLAND",
        "model": "6TG2AM",
        "bhp": "108",
        "tahun": ""
      },
      {
        "item": "A02",
        "merk": "PERKINS",
        "pabrik": "PERKINS DIESEL ENGINE CO., LTD.",
        "lokasi": "ENGLAND",
        "model": "6TG2AM",
        "bhp": "108",
        "tahun": ""
      }
    ],
    "surveiKlas": [
      {
        "jenis": "Special Survey",
        "jatuhTempo": "2030-02-06",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2025-02-06"
      },
      {
        "jenis": "Annual Survey",
        "jatuhTempo": "",
        "rentangDari": "2026-11-06",
        "rentangSampai": "2027-05-06",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Docking Survey",
        "jatuhTempo": "2027-02-12",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-02-12"
      },
      {
        "jenis": "Intermediate Survey",
        "jatuhTempo": "",
        "rentangDari": "2026-11-06",
        "rentangSampai": "2028-05-06",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Propeller Shaft (starboard-aft), Method 4",
        "jatuhTempo": "2031-02-12",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-02-12"
      },
      {
        "jenis": "Propeller Shaft (portside-aft), Method 4",
        "jatuhTempo": "2031-02-12",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-02-12"
      }
    ],
    "surveiStatutori": [
      {
        "jenis": "Annual Load Line",
        "terakhir": "2026-02-12",
        "berikut1": "2026-11-06",
        "berikut2": "2027-05-06",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SKKP Nasional",
        "terakhir": "2025-02-07",
        "berikut1": "2025-11-06",
        "berikut2": "2026-02-06",
        "ditunda": ""
      },
      {
        "jenis": "Annual SNPP",
        "terakhir": "",
        "berikut1": "2025-11-06",
        "berikut2": "2026-05-06",
        "ditunda": ""
      },
      {
        "jenis": "Intermediate SNPP",
        "terakhir": "",
        "berikut1": "2026-11-06",
        "berikut2": "2028-05-06",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SNPP",
        "terakhir": "2025-02-07",
        "berikut1": "2029-11-06",
        "berikut2": "2030-02-06",
        "ditunda": ""
      },
      {
        "jenis": "Renewal Load Line (Hubdat)",
        "terakhir": "2025-02-06",
        "berikut1": "2030-02-06",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Replacement AFS Nasional",
        "terakhir": "2025-02-07",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      }
    ],
    "rekomendasi": "NIL",
    "rekomendasiJatuhTempo": "",
    "memoranda": "1. Kapal yang kontrak pembangunan sebelum 1 Juli 2021 wajib memiliki approved damage stability paling lambat 1 juli 2026.\nTelah diterbitkan Surat Persetujuan (exemption) dari Pemerintah (Direktorat Transportasi Sungai Danau dan Penyeberangan) nomor AP.402/02/43/TSDP-01/2023 Perihal Permohonan Exemption KMP LEMA tanggal 25 Januari 2023.\nTelah diterbitkan Surat Persetujuan (exemption) dari Pemerintah (Direktorat Transportasi Sungai Danau dan Penyeberangan) nomor AP.402/05/76/TSDP-01/2023 Perihal Permohonan Exemption KMP LEMA tanggal 13 Maret 2023.\nKAPAL INI TERMASUK DALAM KAPAL YANG DIATUR DALAM PERATURAN MENTERI PERHUBUNGAN NO. 4 TAHUN 2025. SELANJUTNYA AGAR DILAKSANAKAN PENYESUAIAN SERTIFIKAT GARIS MUAT NASIONAL DARI KP.988/AP.402/DRJD/2021 MENJADI PM 39 TAHUN 2016 OLEH SURVEYOR BKI PALING LAMBAT SURVEY PERIODIK TERDEKAT."
  },
  "kmp-ngafi": {
    "nama": "KMP. NGAFI",
    "namaBKI": "NGAFI",
    "register": "22156",
    "imo": "9792412",
    "status": "DITANGGUHKAN (SUSPEND)",
    "jenisKapal": "FERRY",
    "material": "BAJA (STEEL)",
    "pelabuhan": "JAKARTA",
    "bendera": "INDONESIA",
    "tandaKelasLambung": "P",
    "callSign": "YBGT2",
    "bangunan": "BARU (NEW)",
    "namaSebelumnya": "",
    "dualKelas": "",
    "exDualKelas": "",
    "instalasiPendingin": "",
    "cms": "",
    "statusPending": "",
    "kategori": "IACS Non Compliance",
    "galangan": "PT. DAYA RADAR UTAMA",
    "tahun": "2016",
    "tglPeluncuran": "2015-09-30",
    "lokasiBangun": "JAKARTA",
    "gt": "380",
    "nt": "114",
    "dwt": "0",
    "loa": "39,38",
    "lbp": "34,56",
    "bmld": "11",
    "hmld": "3,3",
    "t": "2,3",
    "lt": "1012",
    "geladak": "1",
    "palka": "",
    "ruangMuat": "1",
    "sekatMemanjang": "0",
    "sekatMelintang": "5",
    "forecastle": "0/0/0",
    "bower": {
      "jumlahBerat": "2/660.00",
      "panjangRantai": "302,5",
      "diaRantai": "22",
      "tipe": "",
      "tipeRantai": "Stud Link",
      "kualitasRantai": "0"
    },
    "stream": {
      "jumlahBerat": "0/0.00",
      "panjangRantai": "0",
      "diaRantai": "0",
      "tipe": "",
      "tipeRantai": "Stock Anchor",
      "kualitasRantai": "0"
    },
    "sistemStart": "AKI (BATTERY)",
    "jmlBalingBaling": "2",
    "tipeBalingBaling": "",
    "voltase": "380",
    "arus": "129",
    "jenisMesin": "",
    "jmlMesinInduk": "2",
    "caraKerja": "",
    "gigiReduksi": "",
    "kecepatanDinas": "",
    "kecepatanCoba": "",
    "dayaListrik": "85",
    "jmlMesinBantu": "2",
    "diaLangkah": "",
    "pemilik": "PT. ASDP INDONESIA FERRY (PERSERO)",
    "alamatPemilik": "JL. JEND. AHAMD YANI NO. 52 A",
    "kotaPemilik": "JAKARTA",
    "operator": "PT. ASDP INDONESIA FERRY (PERSERO)",
    "alamatOperator": "JL. JEND. AHAMD YANI NO. 52 A",
    "kotaOperator": "JAKARTA",
    "mesinInduk": [
      {
        "no": "1",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "silinder": "6",
        "tenaga": "820",
        "rpm": "1500",
        "tahun": "",
        "model": "6AYM - WET 5692",
        "posisi": "SA"
      },
      {
        "no": "2",
        "merk": "YANMAR",
        "pabrik": "YANMAR DIESEL ENGINE CO., LTD.",
        "silinder": "6",
        "tenaga": "820",
        "rpm": "1500",
        "tahun": "",
        "model": "6AYM - WET 5693",
        "posisi": "PA"
      }
    ],
    "mesinBantu": [
      {
        "item": "A01",
        "merk": "PERKINS",
        "pabrik": "PERKINS",
        "lokasi": "CHINA",
        "model": "6TG2AM",
        "bhp": "124",
        "tahun": "2015"
      },
      {
        "item": "A02",
        "merk": "PERKINS",
        "pabrik": "PERKINS",
        "lokasi": "CHINA",
        "model": "6TG2AM",
        "bhp": "124",
        "tahun": "2015"
      }
    ],
    "surveiKlas": [
      {
        "jenis": "Special Survey",
        "jatuhTempo": "2030-09-18",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2025-09-26"
      },
      {
        "jenis": "Annual Survey",
        "jatuhTempo": "",
        "rentangDari": "2026-06-18",
        "rentangSampai": "2026-12-18",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Docking Survey",
        "jatuhTempo": "2026-09-26",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2025-09-26"
      },
      {
        "jenis": "Intermediate Survey",
        "jatuhTempo": "",
        "rentangDari": "2027-06-18",
        "rentangSampai": "2028-12-18",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Propeller Shaft (portside-aft), Method 4",
        "jatuhTempo": "2025-09-18",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2020-09-18"
      },
      {
        "jenis": "Propeller Shaft (starboard-aft), Method 4",
        "jatuhTempo": "2025-09-18",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2020-09-18"
      }
    ],
    "surveiStatutori": [
      {
        "jenis": "Annual Load Line",
        "terakhir": "",
        "berikut1": "2026-06-18",
        "berikut2": "2026-12-18",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SKKP Nasional",
        "terakhir": "2024-10-11",
        "berikut1": "2025-06-18",
        "berikut2": "2025-09-18",
        "ditunda": ""
      },
      {
        "jenis": "Additional SKKP Nasional",
        "terakhir": "2024-07-16",
        "berikut1": "2024-10-11",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Annual SNPP",
        "terakhir": "2024-10-11",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Intermediate SNPP",
        "terakhir": "2022-09-13",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SNPP",
        "terakhir": "2021-10-21",
        "berikut1": "2025-07-11",
        "berikut2": "2025-10-11",
        "ditunda": ""
      },
      {
        "jenis": "Additional SNPP",
        "terakhir": "2024-07-16",
        "berikut1": "2024-10-11",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Renewal Load Line (PM 39)",
        "terakhir": "2025-09-26",
        "berikut1": "2030-09-18",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Sertifikat AFS Nasional",
        "terakhir": "2024-10-11",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      }
    ],
    "rekomendasi": "Rekomendasi berikut supaya dilaksanakan paling lambat 25 Desember 2025; 1. Safety device ME kanan/kiri supaya dilaksanakan : LO Low pressure (ki), High water temp cooling (ki), Overspeed (ka/ki)",
    "rekomendasiJatuhTempo": "2025-12-25",
    "memoranda": "1. Kapal yang kontrak pembangunan sebelum 1 Juli 2021 yang belum memasang sprinkler system pada ruang penumpang, diwajibkan untuk memasang sprinkler system paling lambat 1 juli 2026.\n2. Kapal yang kontrak pembangunan sebelum 1 Juli 2021 wajib memiliki approved damage stability paling lambat 1 juli 2026.\nTelah diterbitkan Surat Persetujuan (exemption) dari Pemerintah (Direktorat Transportasi Sungai Danau dan Penyeberangan):\n- nomor AP.402/2425/TSDP-01/XI/2022 tanggal 12 September 2022\n- nomor AP.402/32/89/TSDP-01/X/2023 tanggal 19 Oktober 2023\n- nomor AP.402/08/21/TSDP-01/2024 tanggal 18 Januari 2024\n- nomor AP.402/30/22/TSDP-01/2024 tanggal 15 Juli 2024\nKAPAL INI TERMASUK DALAM KAPAL YANG DIATUR DALAM PERATURAN MENTERI PERHUBUNGAN NO. 4 TAHUN 2025. SELANJUTNYA AGAR DILAKSANAKAN PENYESUAIAN SERTIFIKAT GARIS MUAT NASIONAL DARI KP.988/AP.402/DRJD/2021 MENJADI PM 39 TAHUN 2016 OLEH SURVEYOR BKI PALING LAMBAT SURVEY PERIODIK TERDEKAT."
  },
  "kmp-maming": {
    "nama": "KMP. MAMING",
    "namaBKI": "MAMING",
    "register": "15588",
    "imo": "8677055",
    "status": "AKTIF (ACTIVE)",
    "jenisKapal": "FERRY",
    "material": "BAJA (STEEL)",
    "pelabuhan": "JAKARTA",
    "bendera": "INDONESIA",
    "tandaKelasLambung": "P",
    "callSign": "POAK",
    "bangunan": "BARU (NEW)",
    "namaSebelumnya": "",
    "dualKelas": "",
    "exDualKelas": "",
    "instalasiPendingin": "",
    "cms": "",
    "statusPending": "",
    "kategori": "IACS Non Compliance",
    "galangan": "PT.SARANA SAMUDERA PACIFIC",
    "tahun": "2011",
    "tglPeluncuran": "2010-12-21",
    "lokasiBangun": "BITUNG",
    "gt": "598",
    "nt": "180",
    "dwt": "371,35",
    "loa": "45,5",
    "lbp": "40,6",
    "bmld": "12",
    "hmld": "3,2",
    "t": "2,14",
    "lt": "1060",
    "geladak": "1",
    "palka": "",
    "ruangMuat": "1",
    "sekatMemanjang": "3",
    "sekatMelintang": "5",
    "forecastle": "0/0/0",
    "bower": {
      "jumlahBerat": "2/785.00",
      "panjangRantai": "330",
      "diaRantai": "28",
      "tipe": "",
      "tipeRantai": "Stud Link",
      "kualitasRantai": "0"
    },
    "stream": {
      "jumlahBerat": "0/0.00",
      "panjangRantai": "0",
      "diaRantai": "0",
      "tipe": "",
      "tipeRantai": "Stock Anchor",
      "kualitasRantai": "0"
    },
    "sistemStart": "AKI (BATTERY)",
    "jmlBalingBaling": "2",
    "tipeBalingBaling": "",
    "voltase": "220",
    "arus": "117.3",
    "jenisMesin": "",
    "jmlMesinInduk": "2",
    "caraKerja": "",
    "gigiReduksi": "",
    "kecepatanDinas": "10",
    "kecepatanCoba": "11,9",
    "dayaListrik": "128",
    "jmlMesinBantu": "2",
    "diaLangkah": "",
    "pemilik": "ASDP INDONESIA FERRY, PT (PERSERO)",
    "alamatPemilik": "JL. JENDRAL AHMAD YANI KAV. 52 A",
    "kotaPemilik": "JAKARTA",
    "operator": "ASDP INDONESIA FERRY, PT",
    "alamatOperator": "JL. JENDRAL AHMAD YANI KAV. 52 A",
    "kotaOperator": "JAKARTA",
    "mesinInduk": [
      {
        "no": "1",
        "merk": "MITSUBISHI",
        "pabrik": "MITSUBISHI HEAVY INDUSTRIES LTD.",
        "silinder": "6",
        "tenaga": "822",
        "rpm": "1800",
        "tahun": "2010",
        "model": "S6R - MPTK 64195",
        "posisi": "PA"
      },
      {
        "no": "2",
        "merk": "MITSUBISHI",
        "pabrik": "MITSUBISHI HEAVY INDUSTRIES LTD.",
        "silinder": "6",
        "tenaga": "822",
        "rpm": "1800",
        "tahun": "2010",
        "model": "S6R - MPTK 64196",
        "posisi": "SA"
      }
    ],
    "mesinBantu": [
      {
        "item": "A01",
        "merk": "CUMMINS",
        "pabrik": "DONGFENG CUMMINS ENGINE CO., LTD.",
        "lokasi": "CHINA",
        "model": "6 BR5.9-GM83",
        "bhp": "113",
        "tahun": "2010"
      },
      {
        "item": "A02",
        "merk": "CUMMINS",
        "pabrik": "DONGFENG CUMMINS ENGINE CO., LTD.",
        "lokasi": "CHINA",
        "model": "6 BR5.9-GM83",
        "bhp": "113",
        "tahun": "2010"
      }
    ],
    "surveiKlas": [
      {
        "jenis": "Special Survey",
        "jatuhTempo": "2031-06-13",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-08-28"
      },
      {
        "jenis": "Annual Survey",
        "jatuhTempo": "",
        "rentangDari": "2027-05-28",
        "rentangSampai": "2027-08-28",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Docking Survey",
        "jatuhTempo": "2027-08-28",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-08-28"
      },
      {
        "jenis": "Intermediate Survey",
        "jatuhTempo": "",
        "rentangDari": "2028-05-28",
        "rentangSampai": "2029-08-28",
        "ditunda": "",
        "terakhir": ""
      },
      {
        "jenis": "Propeller Shaft (starboard-aft), Method 4",
        "jatuhTempo": "2029-12-03",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2024-12-03"
      },
      {
        "jenis": "Propeller Shaft (portside-aft), Method 4",
        "jatuhTempo": "2031-08-28",
        "rentangDari": "",
        "rentangSampai": "",
        "ditunda": "",
        "terakhir": "2026-08-28"
      }
    ],
    "surveiStatutori": [
      {
        "jenis": "Annual Load Line",
        "terakhir": "",
        "berikut1": "2027-05-28",
        "berikut2": "2027-08-28",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SKKP Nasional",
        "terakhir": "2024-12-03",
        "berikut1": "2025-07-19",
        "berikut2": "2025-10-19",
        "ditunda": ""
      },
      {
        "jenis": "Additional SKKP Nasional",
        "terakhir": "2024-12-03",
        "berikut1": "2025-02-19",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Extension SKKP Nasional",
        "terakhir": "2025-02-20",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Annual SNPP",
        "terakhir": "2024-12-03",
        "berikut1": "2025-07-19",
        "berikut2": "2026-01-19",
        "ditunda": ""
      },
      {
        "jenis": "Intermediate SNPP",
        "terakhir": "2024-12-03",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Renewal SNPP",
        "terakhir": "2021-10-19",
        "berikut1": "2026-07-19",
        "berikut2": "2026-10-19",
        "ditunda": ""
      },
      {
        "jenis": "Renewal Load Line (PM 39)",
        "terakhir": "",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      },
      {
        "jenis": "Sertifikat AFS Nasional",
        "terakhir": "2024-12-03",
        "berikut1": "",
        "berikut2": "",
        "ditunda": ""
      }
    ],
    "rekomendasi": "1. Drawing safety plan terbaru (termasuk sprinkler system akomodasi) agar di submit untuk mendapatkan persetujuan. 2. Perubahan diameter pipa spray system ER sampai menuju Nozzle spray.",
    "rekomendasiJatuhTempo": "2028-11-28",
    "memoranda": "1. Kapal yang kontrak pembangunan sebelum 1 Juli 2021 yang belum memasang Automatic Sprinkler System pada ruang penumpang, diwajibkan untuk memasang sprinkler system paling lambat 1 juli 2026.\n2. Kapal yang kontrak pembangunan sebelum 1 Juli 2021 wajib memiliki approved damage stability paling lambat 1 juli 2026.\n\nNota Dinas nomor : UM.006/28/13/DK/2026 tanggal 26 Agsustus 2026. Beradasrkan Permenhub no. PM.44 thn 2021 tentang stabilitas kapal pasal 39, kapal tersebut dapat diberikan persetujuan pembebasan pemenuhan pesyaratan damage stability ketentuan sebagai berikut; 1. Kapal segera melaksanakan pengesahan gambar di direktorat jenderal perhubungan laut. 2. Kapal hanya berlayar pada lintasan pelabuhan Tobello - Daruba, dengan jarak pelayaran tidak lebih dari 20 (dua puluh) mil laut dari daratan terdekat.\n\n1. Telah diterbitkan Surat Persetujuan (exemption) dari Pemerintah (Direktorat Transportasi Sungai Danau dan Penyeberangan)\n- nomor AP.402/3098/TSDP-01/XI/2022 tanggal 2 November 2022\n- nomor AP.402/3099/TSDP-01/XI/2022 tanggal 4 November 2022.\n- nomor AP.402/40/37/TSDP-01/2023 tanggal 27 November 2023\n- nomor AP.402/41/07/TSDP-01/2024 tanggal 03 Desember 2024\n\n2. Telah dilaksanakan perubahan tanggal ulang tahun klasifikasi dan garis muat sesuai dengan Surat Kepala Divisi Survey nomor A.03776/SV.206/KI-22 perihal Pelaksanaan Survey Kapal MAMING (Reg. 15588).\n\nDALAM RANGKA HARMONISASI SURVEY STATUTORIA & SURVEY KLAS DITETAPKAN TANGGAL ULANG TAHUN BARU : 19 OKTOBER\n\nKAPAL INI TERMASUK DALAM KAPAL YANG DIATUR DALAM PERATURAN MENTERI PERHUBUNGAN NO. 4 TAHUN 2025. SELANJUTNYA AGAR DILAKSANAKAN PENYESUAIAN SERTIFIKAT GARIS MUAT NASIONAL DARI KP.988/AP.402/DRJD/2021 MENJADI PM 39 TAHUN 2016 OLEH SURVEYOR BKI PALING LAMBAT SURVEY PERIODIK TERDEKAT."
  }
};

export const dataBKI = (id: string): DataBKI | undefined => BKI[id];

/**
 * Seberapa mendesak satu tanggal jatuh tempo.
 *
 * Dipakai memberi warna pada tabel survei. Ambangnya 60 hari, bukan 30: mengurus
 * survei kapal butuh menjadwalkan surveyor dan kadang naik dok, dan satu bulan
 * peringatan sudah terlambat untuk keduanya.
 */
export type NadaTempo = "lewat" | "dekat" | "aman" | "kosong";
export function nadaTempo(iso: string, hariAmbang = 60): NadaTempo {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "kosong";
  const selisih = Math.floor((new Date(iso + "T00:00:00").getTime() - Date.now()) / 86400000);
  if (selisih < 0) return "lewat";
  if (selisih <= hariAmbang) return "dekat";
  return "aman";
}

/**
 * Survei yang paling dekat jatuh temponya — yang sudah lewat didahulukan.
 *
 * Hanya survei KLASIFIKASI yang dihitung. Baris statutori di rekap BKI memuat
 * jadwal siklus sertifikat yang sebagian sudah dijalani dan diperbarui di luar
 * rekap ini, jadi memakainya membuat seluruh armada tampak lewat tempo
 * sekaligus — lencana yang menyala di semua kapal sama saja dengan tidak ada
 * lencana. Jadwal statutori tetap terlihat utuh di panel BKI.
 */
export function tempoTerdekat(b: DataBKI): { jenis: string; tanggal: string } | null {
  const calon: { jenis: string; tanggal: string }[] = [];
  b.surveiKlas.forEach((s) => {
    const t = s.jatuhTempo || s.rentangSampai;
    if (t) calon.push({ jenis: s.jenis, tanggal: t });
  });
  if (!calon.length) return null;
  const lewat = calon.filter((c) => nadaTempo(c.tanggal) === "lewat")
    .sort((x, y) => y.tanggal.localeCompare(x.tanggal));
  if (lewat.length) return lewat[0];
  return calon.filter((c) => nadaTempo(c.tanggal) !== "lewat")
    .sort((x, y) => x.tanggal.localeCompare(y.tanggal))[0] || null;
}

/** "2026-10-14" -> "14 Okt 2026"; selain itu apa adanya. */
const BULAN_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export function tglIndo(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${+d} ${BULAN_ID[+m - 1]} ${y}`;
}
