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
}

export const JENIS_DOKUMEN: JenisDokumen[] = [
  {
    id: "berita_acara", label: "Berita Acara", folder: "Berita Acara", ikon: "📜", bagian: "semua",
    ket: "Kejadian yang perlu dicatat resmi: kerusakan, kandas, tubrukan, penggantian besar, serah terima pekerjaan.",
  },
  {
    id: "temuan", label: "Temuan / Findings", folder: "Temuan", ikon: "🔎", bagian: "semua",
    ket: "Hasil inspeksi Marine Superintendent, class, syahbandar, atau audit internal — beserta bukti penutupannya.",
  },
  {
    id: "kerusakan", label: "Laporan Kerusakan", folder: "Laporan Kerusakan", ikon: "⚠️", bagian: "semua",
    ket: "Kerusakan mesin atau lambung: apa yang rusak, kapan, foto keadaannya.",
  },
  {
    id: "perawatan", label: "Bukti Perawatan", folder: "Bukti Perawatan", ikon: "🛠️", bagian: "mesin",
    ket: "Perawatan berkala yang sudah dikerjakan sendiri di kapal: ganti oli, servis pompa, kalibrasi.",
  },
  {
    id: "bunker", label: "Bunker & Pelumas", folder: "Bunker", ikon: "⛽", bagian: "mesin",
    ket: "Bukti terima BBM dan pelumas: nota bunker, hasil sounding, berita acara serah terima.",
  },
  {
    id: "serah_terima", label: "Serah Terima Jabatan", folder: "Serah Terima Jabatan", ikon: "🤝", bagian: "semua",
    ket: "Pergantian nakhoda, KKM, atau perwira — beserta lampiran kondisi kapal saat diserahkan.",
  },
  {
    id: "latihan", label: "Latihan & Drill", folder: "Latihan Drill", ikon: "🧯", bagian: "deck",
    ket: "Bukti drill kebakaran, sekoci, orang jatuh ke laut: daftar hadir dan fotonya.",
  },
  {
    id: "sertifikat", label: "Sertifikat & Dokumen Kapal", folder: "Sertifikat", ikon: "📑", bagian: "deck",
    ket: "Salinan sertifikat yang dipegang kapal — terutama yang baru diperpanjang di pelabuhan.",
  },
  {
    id: "docking", label: "Docking", folder: "Docking", ikon: "🛥️", bagian: "semua",
    ket: "Repair list, foto pekerjaan galangan, berita acara docking.",
  },
  {
    id: "lainnya", label: "Lain-lain", folder: "Lain-lain", ikon: "🗂️", bagian: "semua",
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
