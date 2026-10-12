/**
 * Permintaan Repair List dan dokumen penunjang docking — dikirim ke Nakhoda.
 *
 * Satu-satunya surat di berkas ini yang turun KE KAPAL, bukan naik ke pusat
 * atau menyeberang ke galangan. Karena itu tujuannya "Nakhoda {kapal} —
 * TEMPAT" dan penutupnya meminta kerja sama, bukan persetujuan.
 *
 * TENGGATNYA DIHITUNG, bukan ditaksir. Prosedur Docking Kapal TFA-102 poin
 * 5.2.6 menetapkan daftar pekerjaan diajukan paling lambat 90 hari sebelum
 * docking, jadi tenggat = awal bulan rencana docking dikurangi 90 hari. Yang
 * jatuh pada hari Minggu atau hari libur nasional digeser mundur ke hari kerja
 * terdekat — tenggat yang jatuh pada hari kantor tutup bukan tenggat.
 *
 * Hasil hitungan itu tetap bisa ditimpa lewat isian "Tenggat". Ada kapal yang
 * batas 90 harinya sudah lewat saat suratnya dibuat, dan memaksakan tanggal
 * yang sudah lampau membuat surat meminta sesuatu yang mustahil; yang terjadi
 * sebenarnya keterlambatan prosedur, dan tenggat penggantinya ditetapkan
 * manusia, bukan rumus.
 *
 * Daftar dokumen penunjang berupa centang: kalimatnya sama di tiap surat, dan
 * mengetiknya ulang hanya melahirkan kalimat berbeda untuk maksud yang sama.
 */
import { DataSurat, TemplateSurat } from "../types";
import { KAPAL_SURAT, geserHari, keAngka, namaKapalSurat, selisihHari, tanggalSurat } from "../format";
import { ButirSurat, b, bungkus, esc, suratBernomor } from "../htmlHelpers";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** jarak baku pengajuan repair list menurut TFA-102 poin 5.2.6 */
export const HARI_SEBELUM_DOCKING = 90;

export const PENUNJANG_RL = [
  "Daftar rencana pekerjaan docking (Repair List) Deck dan Mesin beserta volume, satuan, dan uraian pekerjaan",
  "Foto dokumentasi kondisi/kerusakan pada setiap bagian yang diusulkan untuk dikerjakan",
  "Data jam kerja (running hours) Mesin Induk, Mesin Bantu, dan permesinan bantu lainnya per tanggal pengusulan",
  "Daftar kebutuhan suku cadang beserta nomor part (part number), jumlah, dan peruntukannya",
  "Berita Acara pemakaian/penggantian suku cadang terakhir sebagai dasar pengusulan penggantian",
  "Daftar sertifikat kapal yang akan jatuh tempo pada tahun {tahun} beserta tanggal berakhirnya",
  "Laporan inventaris alat keselamatan, alat navigasi, dan alat komunikasi (radio) terakhir",
  "Usulan pekerjaan investasi (bila ada) beserta justifikasi dan data pendukungnya",
];

/**
 * Mundurkan tanggal dari hari Minggu dan libur nasional tetap.
 *
 * Hanya libur yang tanggalnya tidak berpindah tahun ke tahun yang dikenali.
 * Libur keagamaan bergerak tiap tahun dan menebaknya justru melahirkan tenggat
 * yang salah dengan percaya diri; yang begitu diserahkan ke isian tenggat.
 */
export function hariKerja(iso: string): string {
  let t = iso;
  for (let i = 0; i < 10 && t; i += 1) {
    const d = new Date(`${t}T00:00:00Z`);
    const libur = (d.getUTCMonth() === 0 && d.getUTCDate() === 1)
      || (d.getUTCMonth() === 7 && d.getUTCDate() === 17)
      || (d.getUTCMonth() === 11 && d.getUTCDate() === 25);
    if (d.getUTCDay() !== 0 && !libur) return t;
    t = geserHari(t, -1);
  }
  return t;
}

/** tenggat hasil hitungan: awal bulan docking dikurangi 90 hari, digeser ke hari kerja */
export function tenggatHitung(d: DataSurat): string {
  const tahun = keAngka(d.tahunDock);
  const bulan = BULAN.indexOf(String(d.bulanDock || "")) + 1;
  if (!tahun || !bulan) return "";
  const awal = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
  return hariKerja(geserHari(awal, -HARI_SEBELUM_DOCKING));
}

/** tenggat yang dipakai surat: isian manusia bila ada, kalau tidak hasil hitungan */
export function tenggatPakai(d: DataSurat): string {
  return String(d.tenggat || "").trim() || tenggatHitung(d);
}

export const permintaanRl: TemplateSurat = {
  id: "permintaan-rl-docking",
  nama: "Permintaan Repair List & Penunjang Docking",
  perihal: "Permohonan Penyusunan Dan Penyampaian Daftar Rencana Pekerjaan Docking {kapal} "
    + "Tahun {tahunDock} Beserta Dokumen Penunjang",
  tujuan: "Nakhoda {kapal} — TEMPAT",
  deskripsi: "Surat ke Nakhoda: menyusun repair list deck & mesin berikut delapan dokumen penunjangnya. "
    + "Tenggatnya dihitung 90 hari sebelum bulan docking sesuai TFA-102 poin 5.2.6, dan bisa ditimpa sendiri.",
  ikon: "🛠️",
  isian: [
    { id: "kapal", label: "Kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    {
      id: "tahunDock", label: "Tahun docking", jenis: "angka", wajib: true, kolomBorang: 2,
      awal: String(new Date().getFullYear() + 1),
    },
    {
      id: "bulanDock", label: "Bulan rencana docking", jenis: "pilih", pilihan: BULAN, wajib: true, kolomBorang: 2,
      petunjuk: "Dasar hitungan tenggat. Periksa dulu ke jadwal docking — bulan yang keliru membuat "
        + "tenggatnya ikut keliru 30 hari.",
    },
    {
      id: "tenggat", label: "Tenggat penyampaian (kosong = dihitung sendiri)", jenis: "tanggal", kolomBorang: 2,
      petunjuk: "Kosong berarti 90 hari sebelum awal bulan docking, digeser mundur bila jatuh pada hari "
        + "Minggu atau libur nasional. Isi sendiri bila batas 90 harinya sudah telanjur lewat.",
    },
    {
      id: "poinProsedur", label: "Poin prosedur yang dirujuk", jenis: "teks", kolomBorang: 2,
      awal: "5.2.6", petunjuk: "Prosedur Docking Kapal TFA-102 tanggal 15 September 2020.",
    },
    {
      id: "penunjang", label: "Dokumen penunjang yang diminta", jenis: "daftar-centang",
      pilihan: PENUNJANG_RL, awal: PENUNJANG_RL,
      petunjuk: "Penanda {tahun} diisi tahun docking secara otomatis.",
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const hitung = tenggatHitung(d);
    const pakai = tenggatPakai(d);
    const hariIni = new Date().toISOString().slice(0, 10);

    if (!pakai) {
      pesan.push("Tenggat belum bisa dihitung — bulan dan tahun docking harus terisi dulu.");
      return pesan;
    }
    if (selisihHari(hariIni, pakai) < 0) {
      pesan.push(`Tenggat ${tanggalSurat(pakai)} sudah lewat. Surat tidak bisa meminta berkas pada `
        + "tanggal yang sudah berlalu — isi tenggat baru yang masuk akal dan perlakukan ini sebagai "
        + "keterlambatan prosedur.");
    } else if (selisihHari(hariIni, pakai) < 14) {
      pesan.push(`Tenggat ${tanggalSurat(pakai)} tinggal ${selisihHari(hariIni, pakai)} hari lagi — `
        + "terlalu pendek untuk menyusun repair list beserta delapan dokumen penunjangnya.");
    }
    if (hitung && String(d.tenggat || "").trim() && pakai !== hitung) {
      pesan.push(`Tenggat diisi sendiri ${tanggalSurat(pakai)}, berbeda dari hitungan prosedur `
        + `${tanggalSurat(hitung)} (90 hari sebelum docking). Pastikan itu memang disengaja.`);
    }
    return pesan;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const tahun = esc(d.tahunDock || "");
    const bulan = esc(d.bulanDock || "");
    const poin = esc(d.poinProsedur || "5.2.6");
    const tenggat = tenggatPakai(d);

    const butir: ButirSurat[] = [{
      teks: "Memperhatikan :",
      sub: [
        `Prosedur Docking Kapal TFA-102 poin ${poin} tanggal 15 September 2020 bahwa waktu pengajuan `
          + `daftar pekerjaan docking maksimal adalah ${b(`${HARI_SEBELUM_DOCKING} (sembilan puluh) hari`)} `
          + "sebelum pelaksanaan docking;",
        `Jadwal rencana pelaksanaan Docking ${esc(kapal)} Tahun ${tahun} pada bulan ${bulan} ${tahun};`,
      ],
    }];

    butir.push({
      teks: "Terkait butir 1 (satu) tersebut di atas, dalam rangka ketepatan waktu pengusulan daftar "
        + "pekerjaan docking ke Kantor Pusat, bersama ini mohon kiranya Saudara dapat menyusun dan "
        + `menyampaikan Daftar Rencana Pekerjaan Docking (Repair List) ${esc(kapal)} Tahun ${tahun} `
        + "(Deck dan Mesin) beserta dokumen penunjangnya kepada Divisi Teknik Kapal Cabang Ternate, "
        + `paling lambat tanggal ${b(esc(tanggalSurat(tenggat)))}.`,
    });

    const penunjang = ((d.penunjang as string[]) || [])
      .filter((x) => (x || "").trim())
      .map((x) => esc(x.replace(/\{tahun\}/g, String(d.tahunDock || ""))) + ";");
    if (penunjang.length) {
      penunjang[penunjang.length - 1] = penunjang[penunjang.length - 1].replace(/;$/, ".");
      butir.push({
        teks: "Adapun dokumen penunjang sebagaimana dimaksud pada butir 2 (dua) di atas adalah sebagai berikut :",
        sub: penunjang,
      });
    }

    butir.push({
      teks: "Dokumen yang disampaikan setelah tanggal tersebut berisiko tidak terakomodir pada pengusulan "
        + "docking ke Kantor Pusat, sehingga pekerjaannya baru dapat diusulkan melalui pekerjaan tambahan.",
    });
    butir.push({ teks: "Demikian kami sampaikan, atas perhatian dan kerjasamanya diucapkan terima kasih." });
    return bungkus(suratBernomor(butir));
  },
};
