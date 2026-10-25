/**
 * Katalog kebutuhan rutin bulanan kapal — bahan usulan yang paling dekat
 * dengan kenyataan.
 *
 * ASALNYA dua berkas evaluasi yang dipakai cabang sendiri:
 *
 *   EVALUASI RUTIN DECK 2026.xlsx    kebutuhan deck/akomodasi tiap kapal
 *   EVALUASI RUTIN MESIN 2026.xlsx   kebutuhan permesinan tiap kapal
 *
 * Keduanya memuat kebutuhan BULAN DEMI BULAN untuk tiap kapal, lengkap dengan
 * jumlah, satuan, dan harga satuannya — 1.225 entri untuk dua belas kapal.
 *
 * KENAPA PERLU SUMBER KETIGA. Kandidat usulan selama ini berasal dari riwayat
 * pengadaan dan dari database harga. Riwayat satu kapal sering tipis, dan
 * database harga berisi enam puluh ribu barang tanpa tahu mana yang memang
 * dibutuhkan kapal tiap bulan. Akibatnya daftar kebersihan satu kapal bisa
 * keluar cuma dua baris, padahal rencana yang terbit memuat tiga puluhan.
 * Katalog ini justru menjawab pertanyaan itu: barang apa, berapa banyak, dan
 * seberapa sering kapal ini membutuhkannya.
 *
 * `kali` = berapa BULAN barang itu muncul pada berkas evaluasi. Itulah yang
 * memisahkan kebutuhan rutin dari pembelian sekali lewat, dan dipakai sebagai
 * bobot urutan — bukan sebagai penyaring, karena barang yang baru muncul
 * sekali pun tetap kebutuhan nyata kapal itu.
 */
import mentah from "./katalogRutin.json";
import { tentukanKelompok } from "./penempatan";
import { bolehDiusulkan, MA_AKOMODASI, MA_PERMESINAN } from "./kelayakan";
import type { Kandidat } from "./usulanRiwayat";

export interface ItemKatalog {
  kapal: string;
  /** "deck" -> MA Akomodasi · "mesin" -> MA Permesinan */
  jenis: string;
  nama: string;
  satuan: string;
  harga: number;
  jumlah: number;
  kali: number;
}

const KATALOG = (mentah as { item: ItemKatalog[] }).item || [];

const kunciKapal = (v: string) =>
  String(v || "").toUpperCase().replace(/^KMP\.?\s*/, "").replace(/\s+/g, " ").trim();

/** Mata Anggaran satu entri katalog */
const kodeMa = (jenis: string) => (jenis === "mesin" ? MA_PERMESINAN : MA_AKOMODASI);

/** daftar kapal yang punya entri — dipakai layar untuk memberi tahu cakupannya */
export const KAPAL_KATALOG: string[] = Array.from(new Set(KATALOG.map((x) => x.kapal)));

/**
 * Kandidat usulan dari katalog untuk satu kapal.
 *
 * Kapal yang tidak ada di berkas evaluasi — Lema dan Cengkih Afo belum
 * terdaftar di sana — dibekali katalog ARMADA: barang yang dibutuhkan kapal
 * lain sebagian besar sama, dan daftar kosong jauh lebih merugikan daripada
 * daftar yang perlu disunting sedikit. Asalnya tetap ditandai.
 */
export function kandidatKatalog(kapal: string): Kandidat[] {
  const k = kunciKapal(kapal);
  const milik = KATALOG.filter((x) => kunciKapal(x.kapal) === k);
  const sumber = milik.length ? milik : ringkasArmada();

  const out: Kandidat[] = [];
  const sudah = new Set<string>();
  for (const it of sumber) {
    const kode = kodeMa(it.jenis);
    if (!bolehDiusulkan(kode, it.nama, "", kapal).boleh) continue;
    const tempat = tentukanKelompok(kode, "", it.nama, "");
    if (!tempat.kunci) continue;
    const id = `kat-${kode}-${it.nama.toLowerCase().replace(/\s+/g, " ").trim()}`;
    if (sudah.has(id)) continue;
    sudah.add(id);
    out.push({
      id,
      kunci: tempat.kunci,
      kode,
      judul: tempat.judul,
      deskripsi: it.nama,
      spesifikasi: "",
      satuan: it.satuan || "Pcs",
      jumlah: Math.max(1, it.jumlah || 1),
      harga: Math.round(it.harga || 0),
      hargaRata: Math.round(it.harga || 0),
      // dipakai sebagai bobot urutan, sama perlakuannya dengan riwayat
      kali: it.kali || 1,
      bulanTerakhir: "",
      bulanMuncul: [],
      contohDokumen: milik.length
        ? `Evaluasi rutin · ${it.kali} bulan`
        : `Evaluasi rutin armada · ${it.kali} bulan`,
      asal: milik.length ? "katalog" : "armada",
    });
  }
  return out.filter((x) => x.harga > 0);
}

/**
 * Katalog gabungan seluruh armada, satu entri per nama barang.
 *
 * Dihitung sekali lalu disimpan: dipanggil tiap kali layar susun dibuka untuk
 * kapal yang tak punya entri sendiri, dan menyusunnya ulang tiap kali hanya
 * membuang waktu pada daftar yang isinya sama.
 */
let armada: ItemKatalog[] | null = null;
function ringkasArmada(): ItemKatalog[] {
  if (armada) return armada;
  const peta = new Map<string, ItemKatalog>();
  for (const it of KATALOG) {
    const id = `${it.jenis}|${it.nama.toLowerCase().trim()}`;
    const ada = peta.get(id);
    if (!ada) { peta.set(id, { ...it }); continue; }
    // yang lebih sering muncul dianggap lebih mewakili armada
    if (it.kali > ada.kali) peta.set(id, { ...it });
  }
  armada = Array.from(peta.values());
  return armada;
}
