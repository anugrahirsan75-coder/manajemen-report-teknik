/**
 * TEMPLATE 5 — Permohonan Perpanjangan Sertifikat Kapal.
 *
 * Data kapal ditulis sebagai daftar berbutir bulat kosong, bukan tabel, sesuai
 * bentuk yang dipakai cabang.
 */
import { TemplateSurat } from "../types";
import { KAPAL_SURAT, namaKapalSurat, rangkai, tanggalSurat } from "../format";
import { LAMPIRAN, PENUTUP_PERMOHONAN, SALAM, b, bungkus, daftarButir, esc, p } from "../htmlHelpers";

export const JENIS_SERTIFIKAT = [
  "Sertifikat Nasional Garis Muat",
  "Sertifikat Keselamatan Kapal Penyeberangan",
  "Sertifikat Keselamatan Radio",
  "Sertifikat Nasional Pencegahan Pencemaran Kapal (SNPP)",
  "Sertifikat Nasional Anti Teritip (AFS)",
  "Sertifikat Klasifikasi Lambung",
  "Sertifikat Klasifikasi Mesin",
];

export const perpanjanganSertifikat: TemplateSurat = {
  id: "perpanjangan-sertifikat",
  nama: "Permohonan Perpanjangan Sertifikat Kapal",
  perihal: "Permohonan Perpanjangan {jenisSertifikat} KMP. {kapal}",
  tujuan: "Kepala Kantor KSOP / Direktorat terkait",
  deskripsi: "Perpanjangan sertifikat yang akan berakhir, lengkap dengan data kapal dan lintasan.",
  ikon: "📄",
  isian: [
    { id: "jenisSertifikat", label: "Jenis sertifikat", jenis: "pilih", pilihan: JENIS_SERTIFIKAT, bebas: true, wajib: true },
    { id: "sementara", label: "Sertifikat sementara?", jenis: "pilih", pilihan: ["Ya", "Tidak"], awal: "Ya", petunjuk: "Bila Ya, kalimatnya menyebut kata Sementara seperti surat lama.", kolomBorang: 2 },
    { id: "noSertifikat", label: "Nomor sertifikat", jenis: "teks", wajib: true, contoh: "PK.001/12/9/KSOP.SRG-2026", kolomBorang: 2 },
    { id: "tglBerakhir", label: "Tanggal berakhir", jenis: "tanggal", wajib: true, kolomBorang: 2 },
    { id: "kapal", label: "Nama kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "noRegister", label: "Nomor register", jenis: "teks", wajib: true, contoh: "2016 Ba No. 6114/L", kolomBorang: 2 },
    { id: "imo", label: "IMO Number", jenis: "teks", wajib: true, contoh: "9210608", kolomBorang: 2 },
    { id: "lintasan", label: "Lintasan penyeberangan perintis", jenis: "daftar-teks", wajib: true, petunjuk: "Satu lintasan per baris; nanti dirangkai jadi satu kalimat.", contoh: "Ternate – Sidangoli" },
    { id: "kota", label: "Kota tujuan surat", jenis: "teks", contoh: "Sorong", kolomBorang: 2 },
  ],

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const jenis = String(d.jenisSertifikat || "");
    const label = String(d.sementara || "Ya") === "Ya" ? `${jenis} Sementara` : jenis;
    const lintasan = rangkai(((d.lintasan as string[]) || []).map((x) => esc(x)), "dan");

    const bagian: string[] = [];
    bagian.push(p(SALAM));
    bagian.push(p(
      `Mendasari dan menindaklanjuti ${b(esc(label))} ${b(esc(kapal))} Nomor ${esc(d.noSertifikat || "")}, `
      + `yang masa berlakunya akan berakhir pada tanggal ${b(esc(tanggalSurat(String(d.tglBerakhir || ""))))}.`,
    ));
    bagian.push(p(
      `Sehubungan dengan akan berakhirnya masa berlaku sertifikat sebagaimana dimaksud di atas, serta guna `
      + `mendukung kelancaran operasional ${b(esc(kapal))} pada lintasan penyeberangan perintis ${lintasan}, `
      + `bersama ini kami mengajukan ${b(`permohonan perpanjangan ${esc(jenis)} ${esc(kapal)}`)} `
      + `dengan data sebagai berikut:`,
    ));
    bagian.push(daftarButir([
      `${b("Nama Kapal")} : ${esc(kapal)};`,
      `${b("Nomor Register")} : ${esc(d.noRegister || "")};`,
      `${b("IMO Number")} : ${esc(d.imo || "")}.`,
    ]));
    bagian.push(p(LAMPIRAN));
    bagian.push(p(PENUTUP_PERMOHONAN));
    return bungkus(bagian.join("\n"));
  },
};
