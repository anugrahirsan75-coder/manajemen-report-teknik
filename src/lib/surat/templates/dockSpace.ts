/**
 * TEMPLATE 17 — Permohonan Ketersediaan Dock Space ke galangan.
 *
 * Surat paling awal dalam rangkaian docking: sebelum galangan ditunjuk, sebelum
 * kontrak, bahkan sebelum persetujuan pusat turun. Cabang menanyakan satu hal —
 * apakah galangan punya tempat pada minggu yang direncanakan. Jawabannya
 * menjadi butir 06 pada daftar auditor (Surat Persetujuan ketersediaan Dock
 * space dari galangan).
 *
 * Butir 04 termasuk yang paling tipis pada ceklis audit: 5 dari 12 kapal pada
 * 2026 dan 6 dari 13 pada 2025. Suratnya sendiri pendek — tiga butir, tanpa
 * tabel — sehingga yang membuatnya jarang ada bukan kerumitannya.
 *
 * Bentuknya mengikuti surat yang sudah terbit: TN.101/00075/II/ASDP-TTE/2025
 * (KMP. Pulau Sagori ke PT. Klasaman Indah Raya Sorong) dan
 * TN.101/00196/IV/ASDP-TTE/2025 (KMP. Tuna ke PT. Dok Kelapa Dua Permai Bitung).
 *
 * Tujuannya ikut galangan yang dipilih — bukan kalimat tetap — karena tiap kapal
 * bisa ke galangan yang berbeda.
 */
import { DataSurat, TemplateSurat } from "../types";
import { GALANGAN, KAPAL_SURAT, NAMA_BULAN, keAngka, namaKapalSurat, romawi } from "../format";
import { terbilangAngka } from "../terbilang";
import { ButirSurat, b, bungkus, esc, suratBernomor } from "../htmlHelpers";

/** surel tempat galangan diminta mengirim jawabannya */
export const SUREL_KONFIRMASI = [
  "eryanto.sidabalok@indonesiaferry.co.id",
  "teknik.ternate@indonesiaferry.co.id",
];

export const dockSpace: TemplateSurat = {
  id: "dock-space",
  nama: "Permohonan Ketersediaan Dock Space",
  perihal: "Permohonan Ketersediaan Dockspace {kapal} Tahun {tahun}",
  // tujuan ikut galangan yang dipilih; {kotaGalangan} mengisi baris "Di--"
  tujuan: "Direktur {galangan} — {kotaGalangan}",
  deskripsi: "Surat pertama rangkaian docking: menanyakan ketersediaan tempat di galangan pada minggu yang direncanakan. Butir 04 pada ceklis audit docking.",
  ikon: "🛠️",
  isian: [
    { id: "kapal", label: "Kapal", jenis: "pilih", pilihan: KAPAL_SURAT, bebas: true, wajib: true, kolomBorang: 2 },
    { id: "tahun", label: "Tahun docking", jenis: "angka", wajib: true, awal: String(new Date().getFullYear()), kolomBorang: 2 },
    {
      id: "galangan", label: "Galangan yang dituju", jenis: "pilih", pilihan: GALANGAN, bebas: true, wajib: true,
      petunjuk: "Surat dialamatkan ke “Direktur ‹galangan›”. Pilih dari daftar atau tulis sendiri bila galangannya lain.",
    },
    {
      id: "kotaGalangan", label: "Kota galangan", jenis: "pilih", pilihan: ["Bitung", "Sorong", "Makassar", "Surabaya"],
      bebas: true, wajib: true, kolomBorang: 2,
      petunjuk: "Mengisi baris “Di--” di bawah nama tujuan.",
    },
    {
      id: "mingguKe", label: "Minggu ke-", jenis: "pilih", pilihan: ["1", "2", "3", "4", "5"],
      wajib: true, awal: "1", kolomBorang: 2,
    },
    { id: "bulan", label: "Bulan rencana docking", jenis: "pilih", pilihan: NAMA_BULAN, wajib: true, kolomBorang: 2 },
    {
      id: "surel", label: "Surel tujuan jawaban", jenis: "pilih", pilihan: SUREL_KONFIRMASI,
      bebas: true, wajib: true, awal: SUREL_KONFIRMASI[0], kolomBorang: 2,
      petunjuk: "Alamat tempat galangan diminta mengirim konfirmasi ketersediaan.",
    },
  ],

  periksa(d) {
    const pesan: string[] = [];
    const minggu = keAngka(d.mingguKe);
    if (minggu < 1 || minggu > 5) pesan.push("Minggu ke- harus antara 1 sampai 5.");
    if (!String(d.kotaGalangan || "").trim()) {
      pesan.push("Kota galangan belum diisi — baris “Di--” pada surat akan kosong.");
    }
    const surel = String(d.surel || "").trim();
    if (surel && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(surel)) {
      pesan.push(`“${surel}” bukan alamat surel yang sah — galangan tidak akan bisa menjawab.`);
    }
    return pesan;
  },

  generate(d) {
    const kapal = namaKapalSurat(String(d.kapal || ""));
    const tahun = esc(d.tahun || "");
    const bulan = esc(String(d.bulan || ""));
    const minggu = keAngka(d.mingguKe);
    const kata = terbilangAngka(minggu);

    const butir: ButirSurat[] = [{
      teks: `Sehubungan dengan rencana Pelaksanaan Pekerjaan Docking ${esc(kapal)} pada `
        + `${b(`Minggu ke-${minggu} (${kata})`)} Bulan ${bulan} Tahun ${tahun}.`,
    }, {
      teks: `Terkait butir 1 (satu) tersebut di atas, bersama ini mohon kiranya dapat diberikan `
        + `${b("ketersediaan Dock Space")} untuk ${esc(kapal)} PT. ASDP Indonesia Ferry (Persero) `
        + `Cabang Ternate pada ${b(`Minggu ke-${romawi(minggu)} (${kata})`)} bulan ${bulan} ${tahun}. `
        + `Adapun konfirmasi ketersediaan Dock Space dimaksud kiranya dapat dikirimkan melalui email : `
        + `${b(esc(String(d.surel || "")))} pada kesempatan pertama.`,
    }, {
      teks: "Demikian kami sampaikan, atas kerjasamanya diucapkan terimakasih.",
    }];

    return bungkus(suratBernomor(butir));
  },
};
