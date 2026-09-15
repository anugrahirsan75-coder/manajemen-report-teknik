/**
 * TEMPLATE 18 — Permohonan Ketersediaan Dock Space seluruh armada.
 *
 * Saudara dari surat dock space per kapal, tetapi dipakai pada saat yang
 * berbeda: ini dikirim SEKALI di awal tahun untuk seluruh kapal cabang
 * sekaligus, supaya galangan bisa menyusun antreannya setahun penuh. Yang per
 * kapal menyusul belakangan, menegaskan minggu yang sudah disepakati.
 *
 * Bentuknya mengikuti TN.101/00470/VIII/ASDP-TTE/2024 — lima kapal dengan
 * kolom NAMA KAPAL, GT, RENCANA DOCKING, dan STATUS DOCKING.
 *
 * GT diisi sendiri dari BASIS DATA KAPAL begitu nama kapal dipilih — sumber
 * yang sama dengan layar Dokumen Kapal, jadi perbaikan di sana ikut terbawa ke
 * surat. Galangan memakai angka itu untuk menghitung muat-tidaknya dok, jadi
 * yang keliru bukan sekadar salah ketik: dok yang dijanjikan bisa tak cukup.
 *
 * Barisnya diurutkan menurut bulan lalu minggu, bukan menurut urutan
 * pengetikan: surat ini dibaca sebagai jadwal, dan jadwal yang meloncat-loncat
 * memaksa pembacanya menyusun ulang sendiri.
 */
import { DataSurat, TemplateSurat } from "../types";
import {
  GALANGAN, KAPAL_SURAT, NAMA_BULAN, STATUS_DOCKING, keAngka, namaKapalSurat,
} from "../format";
import {
  ButirSurat, b, baris, bungkus, esc, suratBernomor, tabel, td, th,
} from "../htmlHelpers";
import { SUREL_KONFIRMASI } from "./dockSpace";

interface BarisArmada { kapal: string; gt: string; mingguKe: string; bulan: string; status: string }

const armadaIsi = (d: DataSurat): BarisArmada[] =>
  ((d.armada as BarisArmada[]) || []).filter((r) => String(r?.kapal || "").trim());

/** urut menurut bulan lalu minggu; yang bulannya kosong ditaruh di belakang */
const urutJadwal = (a: BarisArmada, z: BarisArmada) => {
  const bln = (r: BarisArmada) => {
    const i = NAMA_BULAN.indexOf(String(r.bulan || "").trim());
    return i < 0 ? 99 : i;
  };
  return bln(a) - bln(z) || keAngka(a.mingguKe) - keAngka(z.mingguKe);
};

function tabelArmada(d: DataSurat): string {
  const isi = armadaIsi(d).slice().sort(urutJadwal);
  if (!isi.length) return "";
  const tahun = esc(d.tahun || "");

  const kepala = baris([
    th("NO", { width: "7%" }),
    th("NAMA KAPAL", { width: "31%" }),
    th("GT", { width: "12%" }),
    th("RENCANA DOCKING", { width: "30%" }),
    th("STATUS DOCKING", { width: "20%" }),
  ]);

  const barisTabel = isi.map((r, n) => {
    const minggu = keAngka(r.mingguKe);
    const rencana = [minggu ? `Minggu ke-${minggu}` : "", esc(r.bulan || ""), tahun]
      .filter(Boolean).join(" ");
    return baris([
      td(String(n + 1), { align: "center" }),
      td(esc(namaKapalSurat(r.kapal)).toUpperCase()),
      td(esc(r.gt || ""), { align: "center" }),
      td(rencana, { align: "center" }),
      td(esc(r.status || ""), { align: "center" }),
    ]);
  });

  return tabel(barisTabel, kepala);
}

export const dockSpaceArmada: TemplateSurat = {
  id: "dock-space-armada",
  nama: "Permohonan Dock Space Kapal-kapal Ternate",
  perihal: "Permohonan Ketersediaan Dock Space Kapal PT. ASDP Indonesia Ferry (Persero) Cabang Ternate Tahun {tahun}",
  tujuan: "{jabatanTujuan} {galangan} — {kotaGalangan}",
  deskripsi: "Satu surat untuk seluruh armada: tabel kapal, GT, rencana minggu docking, dan jenis surveynya. Dikirim di awal tahun agar galangan bisa menyusun antrean dok.",
  ikon: "⚓",
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
      petunjuk: "Surat yang sama biasanya dikirim ke beberapa galangan — ganti isian ini lalu unduh lagi.",
    },
    {
      id: "kotaGalangan", label: "Kota galangan", jenis: "pilih",
      pilihan: ["Bitung", "Sorong", "Makassar", "Surabaya"], bebas: true, wajib: true, kolomBorang: 2,
      petunjuk: "Mengisi baris “Di--” di bawah nama tujuan.",
    },
    {
      id: "surel", label: "Surel tujuan jawaban", jenis: "pilih", pilihan: SUREL_KONFIRMASI,
      bebas: true, wajib: true, awal: SUREL_KONFIRMASI[0], kolomBorang: 2,
    },
    {
      id: "armada", label: "Daftar kapal & rencana docking", jenis: "tabel", wajib: true,
      petunjuk: "GT terisi sendiri dari basis data kapal begitu nama kapal dipilih — boleh diperbaiki. "
        + "Baris diurutkan menurut bulan lalu minggu saat surat disusun, jadi urutan pengetikan tidak perlu rapi.",
      bacaBerkas:
        "Tabel rencana docking kapal cabang. Tiap baris: nama kapal (mis. KMP. LOMPA), GT/tonase kotor, "
        + "rencana docking dalam bentuk “Minggu ke-2 Oktober 2026” — pisahkan angka minggunya ke kolom "
        + "minggu dan nama bulannya ke kolom bulan — serta status docking (AS-II, AS-III/IS, AS-IV, IS, SS).",
      kolom: [
        {
          id: "kapal", label: "Nama kapal", jenis: "teks", lebar: "15rem",
          saran: KAPAL_SURAT.map((k) => ({ nilai: k, label: k })),
          // GT dibaca dari basis data kapal, bukan dari daftar tetap di berkas ini
          isiOtomatis: { kolom: "gt", sumber: "gtKapal" },
        },
        { id: "gt", label: "GT", jenis: "teks", lebar: "5.5rem" },
        { id: "mingguKe", label: "Minggu ke-", jenis: "teks", lebar: "7rem",
          saran: ["1", "2", "3", "4", "5"].map((x) => ({ nilai: x, label: `Minggu ke-${x}` })) },
        { id: "bulan", label: "Bulan", jenis: "teks", lebar: "9rem",
          saran: NAMA_BULAN.map((x) => ({ nilai: x, label: x })) },
        { id: "status", label: "Status docking", jenis: "teks", lebar: "10rem",
          saran: STATUS_DOCKING.map((x) => ({ nilai: x, label: x })) },
      ],
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const isi = armadaIsi(d);
    if (!isi.length) pesan.push("Daftar kapal masih kosong — justru daftar itu isi surat ini.");

    const terlihat = new Map<string, number>();
    isi.forEach((r, n) => {
      const nama = namaKapalSurat(r.kapal).toUpperCase();
      if (terlihat.has(nama)) {
        pesan.push(`${nama} muncul dua kali (baris ${terlihat.get(nama)! + 1} dan ${n + 1}).`);
      } else {
        terlihat.set(nama, n);
      }
      if (!String(r.gt || "").trim()) {
        pesan.push(`${nama} belum punya GT — galangan memakainya untuk menghitung muat-tidaknya dok.`);
      }
      if (!String(r.bulan || "").trim()) {
        pesan.push(`${nama} belum punya bulan rencana docking.`);
      }
      const m = keAngka(r.mingguKe);
      if (m < 1 || m > 5) pesan.push(`${nama}: minggu ke-${r.mingguKe || "?"} di luar 1 sampai 5.`);
    });

    const surel = String(d.surel || "").trim();
    if (surel && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(surel)) {
      pesan.push(`“${surel}” bukan alamat surel yang sah — galangan tidak akan bisa menjawab.`);
    }
    return pesan;
  },

  generate(d) {
    const tahun = esc(d.tahun || "");
    const CABANG = "PT. ASDP Indonesia Ferry (Persero) Cabang Ternate";

    const butir: ButirSurat[] = [{
      teks: `Sehubungan dengan rencana pelaksanaan Docking Kapal-kapal ${CABANG} pada tahun `
        + `${b(tahun)} antara lain :`,
      blok: tabelArmada(d) || undefined,
    }, {
      teks: `Terkait butir 1 (satu) tersebut di atas, bersama ini mohon kiranya dapat diberikan `
        + `${b("ketersediaan Dock Space")} untuk Kapal-kapal ${CABANG} Tahun ${tahun}. `
        + `Adapun konfirmasi ketersediaan Dock Space dimaksud kiranya dapat dikirimkan melalui email : `
        + `${b(esc(String(d.surel || "")))} pada kesempatan pertama.`,
    }, {
      teks: "Demikian kami sampaikan, atas kerjasamanya diucapkan terimakasih.",
    }];

    return bungkus(suratBernomor(butir));
  },
};
