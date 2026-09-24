/**
 * Dokumen Kapal — berkas di luar empat borang wajib.
 *
 * Empat borang bulanan (permintaan & laporan, deck & mesin) menampung yang
 * RUTIN. Yang tidak rutin selama ini tidak punya tempat sama sekali: berita
 * acara kerusakan, temuan Marine Superintendent, foto kejadian, serah terima
 * jabatan, bukti bunker. Dokumen-dokumen itu beredar sebagai lampiran WhatsApp,
 * lalu hilang bersama obrolannya — dan ketika dibutuhkan berbulan-bulan
 * kemudian (audit, klaim, sengketa docking), yang tersisa cuma ingatan.
 *
 * Golongannya sengaja TERTUTUP, bukan isian bebas. Nama folder Drive dibentuk
 * dari golongan ini; kalau kapal boleh mengetik sendiri, satu kapal menulis
 * "Berita Acara", satu lagi "BA", satu lagi "berita acara kerusakan", dan
 * arsipnya pecah menjadi tiga folder yang tak pernah dicari bersamaan.
 */

export const KIND_DOKUMEN = "dokumen_kapal";

/** folder induk di Drive; di bawahnya kapal, lalu golongan dokumennya */
export const FOLDER_DOKUMEN = "Dokumen Kapal";

export interface JenisDokumen {
  id: string;
  label: string;
  /** nama folder Drive — dipisah dari label supaya label boleh diperhalus tanpa memindah arsip */
  folder: string;
  /** kapan dokumen ini dipakai, dalam kalimat yang dimengerti awak */
  ket: string;
  ikon: string;
  /** deck, mesin, atau keduanya — menentukan golongan mana yang ditawarkan ke akun */
  bagian: "deck" | "mesin" | "semua";
  /*
   * Warna lencana golongan.
   *
   * Ditulis utuh, bukan dirakit dari potongan seperti `bg-${x}-100`: Tailwind
   * membaca berkas sumber apa adanya dan kelas yang baru terbentuk saat
   * dijalankan tidak pernah ikut masuk ke berkas CSS.
   */
  warna: string;
}

export const JENIS_DOKUMEN: JenisDokumen[] = [
  {
    id: "berita_acara", label: "Berita Acara", folder: "Berita Acara", ikon: "📜", bagian: "semua",
    warna: "bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-200 dark:ring-indigo-800",
    ket: "Kejadian yang perlu dicatat resmi: kerusakan, kandas, tubrukan, penggantian besar, serah terima pekerjaan.",
  },
  {
    id: "temuan", label: "Temuan / Findings", folder: "Temuan", ikon: "🔎", bagian: "semua",
    warna: "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800",
    ket: "Hasil inspeksi Marine Superintendent, class, syahbandar, atau audit internal — beserta bukti penutupannya.",
  },
  {
    id: "kerusakan", label: "Laporan Kerusakan", folder: "Laporan Kerusakan", ikon: "⚠️", bagian: "semua",
    warna: "bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:ring-orange-800",
    ket: "Kerusakan mesin atau lambung: apa yang rusak, kapan, foto keadaannya.",
  },
  {
    id: "perawatan", label: "Bukti Perawatan", folder: "Bukti Perawatan", ikon: "🛠️", bagian: "mesin",
    warna: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
    ket: "Perawatan berkala yang sudah dikerjakan sendiri di kapal: ganti oli, servis pompa, kalibrasi.",
  },
  {
    id: "bunker", label: "Bunker & Pelumas", folder: "Bunker", ikon: "⛽", bagian: "mesin",
    warna: "bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
    ket: "Bukti terima BBM dan pelumas: nota bunker, hasil sounding, berita acara serah terima.",
  },
  {
    id: "serah_terima", label: "Serah Terima Jabatan", folder: "Serah Terima Jabatan", ikon: "🤝", bagian: "semua",
    warna: "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800",
    ket: "Pergantian nakhoda, KKM, atau perwira — beserta lampiran kondisi kapal saat diserahkan.",
  },
  {
    id: "latihan", label: "Latihan & Drill", folder: "Latihan Drill", ikon: "🧯", bagian: "deck",
    warna: "bg-red-100 text-red-800 ring-red-200 dark:bg-red-950 dark:text-red-200 dark:ring-red-800",
    ket: "Bukti drill kebakaran, sekoci, orang jatuh ke laut: daftar hadir dan fotonya.",
  },
  {
    id: "sertifikat", label: "Sertifikat & Dokumen Kapal", folder: "Sertifikat", ikon: "📑", bagian: "deck",
    warna: "bg-violet-100 text-violet-800 ring-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800",
    ket: "Salinan sertifikat yang dipegang kapal — terutama yang baru diperpanjang di pelabuhan.",
  },
  {
    id: "docking", label: "Docking", folder: "Docking", ikon: "🛥️", bagian: "semua",
    warna: "bg-cyan-100 text-cyan-900 ring-cyan-200 dark:bg-cyan-950 dark:text-cyan-200 dark:ring-cyan-800",
    ket: "Repair list, foto pekerjaan galangan, berita acara docking.",
  },
  {
    id: "lainnya", label: "Lain-lain", folder: "Lain-lain", ikon: "🗂️", bagian: "semua",
    warna: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
    ket: "Dokumen yang tidak masuk golongan mana pun di atas — sebutkan judulnya sejelas mungkin.",
  },
];

export const jenisDokumen = (id: string) => JENIS_DOKUMEN.find((j) => j.id === id);
export const labelDokumen = (id: string) => jenisDokumen(id)?.label || id;

/** golongan yang ditawarkan kepada satu bagian */
export const jenisUntuk = (bagian: "deck" | "mesin") =>
  JENIS_DOKUMEN.filter((j) => j.bagian === "semua" || j.bagian === bagian);

/**
 * Jalur folder Drive satu dokumen: Dokumen Kapal / <kapal> / <golongan>.
 *
 * Kapal ditaruh di tingkat kedua, bukan pertama, supaya seluruh dokumen tidak
 * rutin berkumpul di bawah satu induk dan bisa dibagikan atau dicadangkan
 * sekaligus tanpa menyentuh folder kiriman bulanan.
 */
export const jalurDokumen = (kapal: string, jenis: string) =>
  [FOLDER_DOKUMEN, kapal, jenisDokumen(jenis)?.folder || "Lain-lain"];

export interface BerkasDokumen {
  nama: string;
  mime: string;
  ukuran: number;
  fileId: string;
  url: string;
  diunggahPada: string;
}

export interface DokumenKapal {
  id: string;
  kapal: string;
  bagian: "deck" | "mesin";
  jenis: string;
  judul: string;
  /** tanggal KEJADIAN, bukan tanggal unggah — yang dicari saat menelusuri arsip */
  tanggal: string;
  catatan: string;
  nomor: string;
  berkas: BerkasDokumen[];
  dibuatPada: string;
  olehAkun: string;
}

/* ────────────────────────────────────────────────────────────────────────
 * GOLONGAN ARSIP = dokumen kapal + empat borang bulanan.
 *
 * Layar arsip kapal menampilkan keduanya bercampur: orang kantor yang membuka
 * satu kapal ingin melihat SELURUH yang pernah masuk dari kapal itu, dan
 * pemisahan "dokumen" lawan "borang" cuma nyata di kepala pembuat aplikasi —
 * di kepala pemakainya semuanya sama-sama berkas kiriman kapal.
 *
 * Yang TIDAK dilakukan: menambahkan keempatnya ke JENIS_DOKUMEN. Daftar itu
 * dipakai borang unggah dan pembentuk folder Drive; menaruh golongan borang
 * di sana akan membuat kantor bisa mengunggah "Laporan Deck" ke jalur arsip,
 * lalu dua jalur berbeda mengisi hal yang sama dan rekap bulanan pecah.
 * ──────────────────────────────────────────────────────────────────────── */

import { JENIS_LAPOR } from "@/lib/lapor/types";

/* ditulis utuh, bukan dirakit — alasannya sama dengan `warna` di atas */
const WARNA_BORANG: Record<string, string> = {
  permintaan_deck: "bg-teal-100 text-teal-900 ring-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-800",
  permintaan_mesin: "bg-lime-100 text-lime-900 ring-lime-200 dark:bg-lime-950 dark:text-lime-200 dark:ring-lime-800",
  laporan_deck: "bg-blue-100 text-blue-900 ring-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-800",
  laporan_mesin: "bg-fuchsia-100 text-fuchsia-900 ring-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-200 dark:ring-fuchsia-800",
};

export interface GolonganArsip { id: string; label: string; ikon: string; warna: string; borang: boolean }

/* borang di ATAS dokumen tak rutin: itu yang ditagih tiap bulan, jadi itu yang
   pertama dicari saat satu kapal dibuka */
export const GOLONGAN_ARSIP: GolonganArsip[] = [
  ...JENIS_LAPOR.map((j) => ({
    id: j.id as string, label: j.singkat, ikon: j.ikon,
    warna: WARNA_BORANG[j.id] || "bg-slate-100 text-slate-700 ring-slate-200", borang: true,
  })),
  ...JENIS_DOKUMEN.map((j) => ({ id: j.id, label: j.label, ikon: j.ikon, warna: j.warna, borang: false })),
];

export const golonganArsip = (id: string) => GOLONGAN_ARSIP.find((g) => g.id === id);
