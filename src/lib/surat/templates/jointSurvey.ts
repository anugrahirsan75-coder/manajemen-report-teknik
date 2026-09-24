/**
 * TEMPLATE 21 — Permohonan Pelaksanaan Joint Survey Pra Docking ke galangan.
 *
 * Letaknya di tengah rangkaian docking: dock space sudah dipastikan, kontrak
 * belum ada. Joint survey inilah yang menghasilkan repair list, dan repair list
 * yang menjadi dasar RAB — jadi surat ini yang menentukan apakah angka docking
 * disusun dari pemeriksaan bersama atau dari perkiraan sepihak.
 *
 * Bentuknya mengikuti surat yang sudah terbit TN.101/00222/IV/ASDP-TTE/2026
 * (Joint Survey KMP. Maming dan KMP. Ngafi ke IKI Bitung): butir "Mendasari"
 * berisi rencana docking tiap kapal sebagai rincian a, b, c, lalu satu butir
 * permohonan berikut tanggal pelaksanaannya.
 *
 * SATU SURAT BISA BEBERAPA KAPAL, dan itu bukan kemewahan: tim galangan datang
 * sekali jalan, jadi kapal yang docking pada bulan berdekatan disurvei dalam
 * kunjungan yang sama. Surat terakhir yang terbit pun menggabungkan dua kapal
 * yang dockingnya terpaut tiga bulan.
 *
 * Nomor surat dock space dari galangan ikut dicantumkan bila diisi. Itu yang
 * menyambungkan surat ini ke butir sebelumnya pada ceklis audit docking —
 * tanpa nomor itu, pemeriksa harus mencari sendiri kaitannya.
 */
import { DataSurat, TemplateSurat } from "../types";
import {
  GALANGAN, JENIS_SURVEY, KAPAL_SURAT, NAMA_BULAN, namaKapalSurat, rangkai, tanggalSurat,
} from "../format";
import { ButirSurat, b, bungkus, esc, suratBernomor } from "../htmlHelpers";

interface BarisKapal { kapal: string; jenisSurvey: string; bulan: string }

const daftarKapal = (d: DataSurat): BarisKapal[] =>
  ((d.kapal as unknown as BarisKapal[]) || []).filter((r) => String(r?.kapal || "").trim());

/**
 * "KMP. Maming dan KMP. Ngafi" — dipakai pada kalimat permohonan.
 *
 * Dua nama dirangkai sendiri, tidak lewat rangkai(): pembantu itu disusun untuk
 * tiga butir ke atas dan menghasilkan "KMP. Maming, dan KMP. Ngafi" untuk dua —
 * koma yang salah di tengah nama kapal, pada kalimat inti surat.
 */
const sebutKapal = (isi: BarisKapal[]) => {
  const nama = isi.map((r) => namaKapalSurat(r.kapal)).filter(Boolean);
  if (nama.length === 2) return `${nama[0]} dan ${nama[1]}`;
  return rangkai(nama, "dan");
};

export const jointSurvey: TemplateSurat = {
  id: "joint-survey",
  nama: "Permohonan Joint Survey Pra Docking",
  perihal: "Permohonan Pelaksanaan Joint Survey Pra Docking Kapal Cabang Ternate Tahun {tahun}",
  tujuan: "{jabatanTujuan} {galangan} — {kotaGalangan}",
  deskripsi: "Meminta galangan melaksanakan joint survey sebelum kapal naik dok. Hasilnya menjadi dasar repair list dan RAB. Bisa untuk beberapa kapal sekaligus dalam satu kunjungan.",
  ikon: "🔎",
  isian: [
    { id: "tahun", label: "Tahun docking", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    {
      id: "jabatanTujuan", label: "Jabatan tujuan", jenis: "pilih",
      pilihan: ["General Manager", "Direktur", "Pimpinan"], bebas: true,
      awal: "General Manager", wajib: true, kolomBorang: 2,
      petunjuk: "Surat dialamatkan “‹jabatan› ‹galangan›”.",
    },
    {
      id: "galangan", label: "Galangan yang dituju", jenis: "pilih", pilihan: GALANGAN,
      bebas: true, wajib: true,
      petunjuk: "Galangan yang sudah menyatakan ketersediaan dock space untuk kapal-kapal di bawah.",
    },
    {
      id: "kotaGalangan", label: "Kota galangan", jenis: "pilih",
      pilihan: ["Bitung", "Sorong", "Makassar", "Surabaya"], bebas: true, wajib: true, kolomBorang: 2,
      petunjuk: "Mengisi baris “Di--” di bawah nama tujuan.",
    },
    {
      id: "kapal", label: "Kapal yang akan disurvei", jenis: "tabel", wajib: true,
      petunjuk: "Boleh lebih dari satu kapal bila dockingnya berdekatan — tim galangan datang sekali jalan. "
        + "Tiap baris muncul sebagai rincian a, b, c pada butir pertama surat.",
      bacaBerkas:
        "Daftar kapal yang akan menjalani joint survey pra docking. Tiap baris: nama kapal "
        + "(mis. KMP. PORTLINK VIII), jenis survey (AS I / AS II / AS III / IS / SS), dan bulan "
        + "rencana dockingnya (mis. November).",
      kolom: [
        {
          id: "kapal", label: "Nama kapal", jenis: "teks", lebar: "15rem",
          saran: KAPAL_SURAT.map((k) => ({ nilai: k, label: k })),
        },
        {
          id: "jenisSurvey", label: "Jenis survey", jenis: "teks", lebar: "14rem",
          saran: JENIS_SURVEY.map((x) => ({ nilai: x, label: x })),
        },
        {
          id: "bulan", label: "Bulan docking", jenis: "teks", lebar: "9rem",
          saran: NAMA_BULAN.map((x) => ({ nilai: x, label: x })),
        },
      ],
    },
    { id: "tglMulai", label: "Joint survey mulai tanggal", jenis: "tanggal", wajib: true, kolomBorang: 2 },
    {
      id: "tglSelesai", label: "sampai tanggal", jenis: "tanggal", kolomBorang: 2,
      petunjuk: "Kosongkan bila hanya satu hari.",
    },
    {
      id: "noDockSpace", label: "Nomor surat dock space galangan", jenis: "teks", kolomBorang: 2,
      contoh: "106/DS/DKP/IX/2026",
      petunjuk: "Jawaban galangan atas permohonan dock space. Kosongkan bila belum ada — butirnya ikut hilang.",
    },
    { id: "tglDockSpace", label: "Tanggal surat dock space", jenis: "tanggal", kolomBorang: 2 },
    {
      id: "lingkup", label: "Sertakan rincian lingkup pemeriksaan", jenis: "pilih",
      pilihan: ["Ya", "Tidak"], awal: "Ya", kolomBorang: 2,
      petunjuk: "Satu paragraf yang menyebut bagian apa saja yang diperiksa bersama, supaya galangan "
        + "tahu harus membawa tim apa dan hasilnya langsung bisa dipakai menyusun repair list.",
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const isi = daftarKapal(d);
    if (!isi.length) pesan.push("Daftar kapal masih kosong — tanpa itu surat ini tidak menyebut apa yang disurvei.");

    const terlihat = new Map<string, number>();
    isi.forEach((r, n) => {
      const nama = namaKapalSurat(r.kapal).toUpperCase();
      if (terlihat.has(nama)) {
        pesan.push(`${nama} muncul dua kali (baris ${(terlihat.get(nama) as number) + 1} dan ${n + 1}).`);
      } else {
        terlihat.set(nama, n);
      }
      if (!String(r.bulan || "").trim()) pesan.push(`${nama} belum punya bulan rencana docking.`);
      if (!String(r.jenisSurvey || "").trim()) pesan.push(`${nama} belum punya jenis survey (AS/IS/SS).`);
    });

    /*
     * Joint survey yang didahului dockingnya kehilangan seluruh gunanya: repair
     * list-nya terbit setelah kapal naik dok, jadi RAB disusun dari perkiraan.
     * Ini diperiksa di sini karena dua isiannya berjauhan di borang dan
     * kekeliruannya tidak kelihatan dari surat yang sudah jadi.
     */
    const mulai = String(d.tglMulai || "").trim();
    const selesai = String(d.tglSelesai || "").trim();
    if (mulai && selesai && selesai < mulai) {
      pesan.push("Tanggal selesai joint survey mendahului tanggal mulainya.");
    }
    if (mulai) {
      const blnMulai = NAMA_BULAN[Number(mulai.slice(5, 7)) - 1];
      isi.forEach((r) => {
        const bln = String(r.bulan || "").trim();
        const iDock = NAMA_BULAN.indexOf(bln);
        const iSurvey = NAMA_BULAN.indexOf(blnMulai);
        if (iDock >= 0 && iSurvey >= 0 && iDock < iSurvey) {
          pesan.push(
            `${namaKapalSurat(r.kapal).toUpperCase()} docking bulan ${bln}, tetapi joint survey `
            + `diusulkan bulan ${blnMulai} — surveynya jatuh SESUDAH kapal naik dok.`);
        }
      });
    }

    const noDs = String(d.noDockSpace || "").trim();
    if (noDs && !String(d.tglDockSpace || "").trim()) {
      pesan.push("Nomor surat dock space diisi tetapi tanggalnya kosong — rujukannya jadi tanggung.");
    }
    return pesan;
  },

  generate(d) {
    const isi = daftarKapal(d);
    const tahun = esc(d.tahun || "");
    const nama = esc(sebutKapal(isi));
    const CABANG = "PT. ASDP Indonesia Ferry (Persero) Cabang Ternate";

    /*
     * Rincian a, b, c tidak mengulang "Rencana pelaksanaan Docking" — kalimat
     * pembuka butirnya sudah menyebut itu, dan mengulangnya tiap baris membuat
     * daftar dua kapal berbunyi seperti tiga kalimat yang sama.
     */
    const rincian = (r: BarisKapal) =>
      `${esc(namaKapalSurat(r.kapal))} dalam rangka ${esc(r.jenisSurvey || "")} `
      + `pada bulan ${esc(r.bulan || "")} Tahun ${tahun}`;
    const rencana = (r: BarisKapal) => `Rencana pelaksanaan Docking ${rincian(r)}`;

    /*
     * Satu kapal ditulis sebagai kalimat utuh, beberapa kapal sebagai rincian
     * a, b, c. Rincian untuk satu baris terbaca janggal ("1. Mendasari: a.
     * ...") dan itu bukan bentuk yang dipakai pada surat yang sudah terbit.
     */
    const butirDasar: ButirSurat = isi.length === 1
      ? { teks: rencana(isi[0]) + ";" }
      : {
        teks: `Rencana pelaksanaan Docking Kapal-kapal ${CABANG} Tahun ${tahun}, yaitu :`,
        sub: isi.map((r) => rincian(r) + ";"),
      };

    const butir: ButirSurat[] = [butirDasar];

    const noDs = String(d.noDockSpace || "").trim();
    if (noDs) {
      const tgl = String(d.tglDockSpace || "").trim();
      butir.push({
        teks: `Surat ${esc(String(d.galangan || ""))} Nomor : ${b(esc(noDs))}`
          + (tgl ? ` tanggal ${esc(tanggalSurat(tgl))}` : "")
          + ` perihal ketersediaan Dock Space untuk ${nama};`,
      });
    }

    const mulai = String(d.tglMulai || "").trim();
    const selesai = String(d.tglSelesai || "").trim();
    const kapan = selesai && selesai !== mulai
      ? `${esc(tanggalSurat(mulai))} s.d ${esc(tanggalSurat(selesai))}`
      : esc(tanggalSurat(mulai));
    const jumlahDasar = butir.length;

    butir.push({
      teks: `Terkait butir ${jumlahDasar === 1 ? "1 (satu)" : `1 (satu) sampai dengan ${jumlahDasar} (${jumlahDasar === 2 ? "dua" : "tiga"})`} `
        + `tersebut di atas, bersama ini kami memohon agar dapat dilaksanakan `
        + `${b("Joint Survey Pra Docking")} ${nama} bersama Divisi Teknik ${CABANG}, `
        + `yang akan dilaksanakan pada tanggal ${b(kapan)}.`,
    });

    if (String(d.lingkup || "Ya") === "Ya") {
      butir.push({
        teks: "Adapun hasil Joint Survey dimaksud akan menjadi dasar penyusunan repair list dan "
          + "Rencana Anggaran Biaya (RAB) pekerjaan docking, meliputi pemeriksaan bersama terhadap "
          + "kondisi badan kapal (lambung, lunas dan sistem perlindungan katodik), propeller, poros "
          + "dan sistem kemudi, mesin induk dan mesin bantu, serta peralatan keselamatan dan "
          + "perlengkapan kapal lainnya.",
      });
    }

    butir.push({ teks: "Demikian yang dapat kami sampaikan, atas perhatian dan kerjasamanya diucapkan terima kasih." });

    return bungkus(suratBernomor(butir));
  },
};
