/**
 * TEMPLATE 1 — Permohonan Persetujuan Docking dan Investasi.
 *
 * Surat lama memakai penomoran 1./2./3. dengan sub-poin a./b./c.; bentuk baru
 * mengalir sebagai paragraf. Tabelnya mengikuti surat lama: nomor Romawi, kolom
 * KETERANGAN memakai rowspan untuk seluruh baris biaya docking, dan tiga baris
 * subtotal berwarna sebelum grand total.
 */
import { DataSurat, TemplateSurat } from "../types";
import {
  GALANGAN, JENIS_SURVEY, KAPAL_SURAT, NAMA_BULAN, angkaRibuan, keAngka,
  namaKapalSurat, romawi, rupiahSurat, tanggalSurat,
} from "../format";
import { terbilangRupiah } from "../terbilang";
import {
  LAMPIRAN, PENUTUP_PERMOHONAN, SALAM, WARNA, b, baris, bungkus, esc, i, p, tabel, td, tdAngka, th,
} from "../htmlHelpers";

/** mata anggaran yang biasa dipakai; kode investasi diawali 1020604 */
export const MATA_ANGGARAN = [
  { kode: "5010403003", uraian: "Pemeliharaan Kapal Ro-ro / Penyeberangan" },
  { kode: "5010103004", uraian: "Insentif Operasional" },
  { kode: "5010318000", uraian: "Sertifikasi Produksi Docking" },
  { kode: "5010302006", uraian: "Fumigasi" },
  { kode: "5010403009", uraian: "Akomodasi, Peralatan, dan Perlengkapan Kapal" },
  { kode: "5010403100", uraian: "Permesinan dan Kelistrikan Kapal" },
  { kode: "5010403000", uraian: "Bahan Pelumas" },
  { kode: "5010302004", uraian: "Beban Mobilisasi Docking" },
  { kode: "1020604008", uraian: "Investasi Kapal Ro-ro / Penyeberangan" },
  { kode: "1020604009", uraian: "Investasi Akomodasi, Peralatan, dan Perlengkapan Kapal" },
  { kode: "1020604010", uraian: "Investasi Permesinan dan Kelistrikan Kapal" },
];

const investasiKah = (kode: string) => /^1020604/.test((kode || "").trim());
const mobilisasiKah = (kode: string) => /^5010302004/.test((kode || "").trim());

export interface BarisMa { kode: string; uraian: string; rka: string; cabang: string }

const barisIsi = (d: DataSurat): BarisMa[] =>
  ((d.tabel as BarisMa[]) || []).filter((r) => (r?.kode || r?.uraian || "").trim());

/** hitung ulang semua subtotal — tidak pernah diambil dari ketikan */
export function hitungDocking(d: DataSurat) {
  const isi = barisIsi(d);
  const docking = isi.filter((r) => !investasiKah(r.kode) && !mobilisasiKah(r.kode));
  const mobilisasi = isi.filter((r) => mobilisasiKah(r.kode));
  const investasi = isi.filter((r) => investasiKah(r.kode));
  const jumlah = (a: BarisMa[], k: "rka" | "cabang") => a.reduce((s, r) => s + keAngka(r[k]), 0);
  return {
    docking, mobilisasi, investasi,
    subDockingRka: jumlah(docking, "rka"),
    subDockingCabang: jumlah(docking, "cabang"),
    subMobRka: jumlah(docking, "rka") + jumlah(mobilisasi, "rka"),
    subMobCabang: jumlah(docking, "cabang") + jumlah(mobilisasi, "cabang"),
    subInvRka: jumlah(investasi, "rka"),
    subInvCabang: jumlah(investasi, "cabang"),
    totalRka: jumlah(isi, "rka"),
    totalCabang: jumlah(isi, "cabang"),
  };
}

function tabelAnggaran(d: DataSurat): string {
  const h = hitungDocking(d);
  const tahun = esc(d.tahun || "");
  const urut = [...h.docking, ...h.mobilisasi, ...h.investasi];
  if (!urut.length) return "";

  const ketBaris: string[] = [];
  const perintis = String(d.lintasanPerintis || "").trim();
  const komersil = String(d.lintasanKomersil || "").trim();
  if (perintis) ketBaris.push(`${b("PERINTIS")} : ${i(esc(perintis))}`);
  if (komersil) ketBaris.push(`${b("KOMERSIL")} : ${i(esc(komersil))}`);
  const ket = ketBaris.join("<br />");

  const kepala = baris([
    th("No", { width: "5%" }),
    th("MATA ANGGARAN", { width: "41%" }),
    th(`RKA ${tahun}`, { width: "16%" }),
    th("USULAN CABANG", { width: "17%" }),
    th("KETERANGAN", { width: "21%" }),
  ]);

  const adaSubDocking = h.docking.length > 0;
  const adaSubMob = h.mobilisasi.length > 0;
  const jumlahBiaya = h.docking.length + h.mobilisasi.length;
  /**
   * Sel KETERANGAN membentang ke SELURUH blok biaya, dan baris subtotal ikut
   * dihitung. Sebelumnya rowspan hanya menghitung baris mata anggaran, sehingga
   * begitu subtotal disisipkan di tengah, kolom terakhir kehabisan baris dan
   * tabelnya jadi berantakan saat dicetak.
   */
  const tinggiKet = jumlahBiaya + (adaSubDocking ? 1 : 0) + (adaSubMob ? 1 : 0);

  const isiBaris: string[] = [];
  urut.forEach((r, idx) => {
    const biaya = idx < jumlahBiaya;
    const sel = [
      td(romawi(idx + 1), { align: "center", tebal: true, width: "5%" }),
      td(`(M.A. ${esc(r.kode)}) ${esc(r.uraian)}`, { width: "41%" }),
      tdAngka(angkaRibuan(keAngka(r.rka)), { width: "16%" }),
      tdAngka(angkaRibuan(keAngka(r.cabang)), { width: "17%" }),
    ];
    if (idx === 0) sel.push(td(ket, { rowspan: tinggiKet, valign: "top", width: "21%" }));
    else if (!biaya) sel.push(td("", { width: "21%" }));   // baris investasi punya selnya sendiri
    isiBaris.push(baris(sel));

    // subtotal disisipkan tepat setelah kelompoknya; keduanya masih tercakup rowspan
    if (adaSubDocking && idx === h.docking.length - 1) {
      isiBaris.push(baris([
        td("Sub Total Docking (I)", { colspan: 2, align: "center", tebal: true, bg: WARNA.subtotal }),
        tdAngka(angkaRibuan(h.subDockingRka), { tebal: true, bg: WARNA.subtotal }),
        tdAngka(angkaRibuan(h.subDockingCabang), { tebal: true, bg: WARNA.subtotal }),
      ]));
    }
    if (adaSubMob && idx === jumlahBiaya - 1) {
      isiBaris.push(baris([
        td("Sub Total Docking dan Mobilisasi (I+II)", { colspan: 2, align: "center", tebal: true, bg: WARNA.subtotal }),
        tdAngka(angkaRibuan(h.subMobRka), { tebal: true, bg: WARNA.subtotal }),
        tdAngka(angkaRibuan(h.subMobCabang), { tebal: true, bg: WARNA.subtotal }),
      ]));
    }
  });

  if (h.investasi.length) {
    isiBaris.push(baris([
      td("Sub Total Investasi (III)", { colspan: 2, align: "center", tebal: true, bg: WARNA.investasi }),
      tdAngka(angkaRibuan(h.subInvRka), { tebal: true, bg: WARNA.investasi }),
      tdAngka(angkaRibuan(h.subInvCabang), { tebal: true, bg: WARNA.investasi }),
      td("", { width: "21%" }),
    ]));
  }
  isiBaris.push(baris([
    td("Total Docking dan Investasi (I+II+III)", { colspan: 2, align: "center", tebal: true, bg: WARNA.total }),
    tdAngka(angkaRibuan(h.totalRka), { tebal: true, bg: WARNA.total }),
    tdAngka(angkaRibuan(h.totalCabang), { tebal: true, bg: WARNA.total }),
    td("", { width: "21%" }),
  ]));

  return tabel(isiBaris, kepala);
}

export const dockingInvestasi: TemplateSurat = {
  id: "docking-investasi",
  nama: "Permohonan Persetujuan Docking dan Investasi",
  perihal: "Permohonan Persetujuan Pelaksanaan Docking dan Investasi KMP. {kapal} Tahun {tahun}",
  tujuan: "Direktur Teknik dan Fasilitas — Jakarta",
  deskripsi: "Pengajuan ke pusat, lengkap dengan tabel mata anggaran, subtotal, dan terbilang otomatis.",
  ikon: "⚓",
  isian: [
    { id: "kapal", label: "Nama kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun docking", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    { id: "jenisSurvey", label: "Jenis survey", jenis: "pilih", pilihan: JENIS_SURVEY, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "tglJatuhTempo", label: "Tanggal jatuh tempo survey", jenis: "tanggal", wajib: true, kolomBorang: 2 },
    { id: "minggu", label: "Minggu pelaksanaan", jenis: "pilih", pilihan: ["I", "II", "III", "IV"], wajib: true, kolomBorang: 2 },
    { id: "bulan", label: "Bulan pelaksanaan", jenis: "pilih", pilihan: NAMA_BULAN, wajib: true, kolomBorang: 2 },
    { id: "tahunPelaksanaan", label: "Tahun pelaksanaan", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    { id: "galangan", label: "Galangan", jenis: "pilih", pilihan: GALANGAN, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "lintasanPerintis", label: "Lintasan perintis", jenis: "teks", contoh: "TERNATE – SIDANGOLI", petunjuk: "Muncul di kolom KETERANGAN tabel. Boleh dikosongkan.", kolomBorang: 2 },
    { id: "lintasanKomersil", label: "Lintasan komersil", jenis: "teks", contoh: "BASTIONG – SIDANGOLI", kolomBorang: 2 },
    {
      id: "tabel", label: "Rincian mata anggaran", jenis: "tabel", wajib: true,
      petunjuk: "Kode 1020604xxx otomatis dihitung sebagai investasi; 5010302004 sebagai mobilisasi. Subtotal dihitung sendiri.",
      bacaBerkas:
        "Rincian estimasi biaya docking dan investasi satu kapal, per mata anggaran. Tiap baris berisi kode mata anggaran "
        + "10 digit (mis. 5010403003 atau 1020604010) beserta uraiannya, nilai RKA, dan nilai usulan cabang. "
        + "Kode dan uraiannya kadang menyatu dalam satu sel, mis. “(M.A. 5010403003) Pemeliharaan Kapal Ro-ro” — "
        + "pisahkan kodenya ke kolom kode dan sisanya ke uraian. Lewati baris Sub Total dan Total.",
      kolom: [
        { id: "kode", label: "Kode M.A.", jenis: "teks", lebar: "8rem", saran: MATA_ANGGARAN.map((m) => ({ nilai: m.kode, label: `${m.kode} — ${m.uraian}` })) },
        { id: "uraian", label: "Uraian", jenis: "teks" },
        { id: "rka", label: "Nilai RKA", jenis: "rupiah", lebar: "9rem" },
        { id: "cabang", label: "Usulan Cabang", jenis: "rupiah", lebar: "9rem" },
      ],
    },
    { id: "periksaTotal", label: "Total pembanding (opsional)", jenis: "rupiah", petunjuk: "Isi bila ingin memastikan hasil hitung sama dengan angka di berkas lain.", kolomBorang: 2 },
  ],

  periksa(d) {
    const h = hitungDocking(d);
    const pesan: string[] = [];
    const banding = keAngka(d.periksaTotal);
    if (banding && banding !== h.totalCabang) {
      pesan.push(`Total pembanding ${rupiahSurat(banding)} tidak sama dengan hasil hitung ${rupiahSurat(h.totalCabang)} `
        + `(selisih ${rupiahSurat(Math.abs(banding - h.totalCabang))}).`);
    }
    barisIsi(d).forEach((r, idx) => {
      if (!keAngka(r.cabang)) pesan.push(`Baris ${idx + 1} (${r.kode || r.uraian}) belum punya nilai Usulan Cabang.`);
      if (!r.kode) pesan.push(`Baris ${idx + 1} belum punya kode mata anggaran, jadi tidak bisa dipisah docking/investasi.`);
    });
    return pesan;
  },

  ringkasNilai: (d) => ({ label: "Total docking dan investasi", nilai: hitungDocking(d).totalCabang }),

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const tahun = esc(d.tahun || "");
    const total = hitungDocking(d).totalCabang;
    const bagian: string[] = [];

    bagian.push(p(SALAM));
    bagian.push(p(
      `Mendasari Usulan Rencana Kerja dan Anggaran (RKA) Docking ${b(esc(kapal))} Tahun ${tahun}, `
      + `jatuh tempo Docking Survey ${b(esc(kapal))} (${esc(d.jenisSurvey || "")}) pada tanggal `
      + `${esc(tanggalSurat(String(d.tglJatuhTempo || "")))}, serta rencana pelaksanaan Docking ${b(esc(kapal))} `
      + `pada Minggu Ke-${esc(d.minggu || "")} Bulan ${esc(d.bulan || "")} Tahun ${esc(d.tahunPelaksanaan || tahun)}.`,
    ));
    bagian.push(p(
      `Sehubungan dengan hal tersebut di atas, bersama ini kami mengajukan `
      + `${b(`permohonan persetujuan pelaksanaan Docking dan Investasi ${esc(kapal)} Tahun ${tahun}`)} `
      + `yang direncanakan dilaksanakan di Galangan ${esc(d.galangan || "")} pada bulan ${esc(d.bulan || "")} `
      + `${esc(d.tahunPelaksanaan || tahun)} dengan nilai sebesar ${b(rupiahSurat(total))} `
      + `(terbilang: ${i(terbilangRupiah(total))}), dengan rincian estimasi biaya sebagai berikut:`,
    ));

    const t = tabelAnggaran(d);
    if (t) bagian.push(t);

    bagian.push(p(LAMPIRAN));
    bagian.push(p(PENUTUP_PERMOHONAN));
    return bungkus(bagian.join("\n"));
  },
};
