/**
 * Pembaca borang permintaan dari kapal.
 *
 * Kapal mengirim dua borang baku, dua-duanya hasil pindai (tak ada lapisan
 * teks), jadi harus "dilihat" model AI:
 *
 *   TF-102.01.01  DAFTAR PEKERJAAN DOCKING — inilah Repair List-nya.
 *                 Kolom: NO. · URAIAN · VOLUME (Qty|Unit) · HARGA SATUAN · KETERANGAN.
 *                 Bagian bernomor romawi (mis. "V PEKERJAAN LAMBUNG").
 *                 Harga sengaja kosong — itu bagian cabang, bukan kapal.
 *                 Dikirim terpisah: RL Deck dan RL Mesin.
 *
 *   HP-103.00.01  PERMINTAAN PENGADAAN BARANG/JASA KAPAL — cat, alat kerja,
 *                 suku cadang. Kolom: No · Jumlah · Satuan · Merk/Katalog ·
 *                 Uraian/Spesifikasi. Dikelompokkan per bidang
 *                 (CAT GARIS AIR (AGA), BOTTOM–BOTOP, VOID TANK, …).
 *
 * Yang diminta dari model hanya MEMBACA — penggolongan, pemberian Docking Code,
 * dan harga dikerjakan di sini oleh aturan yang bisa ditelusuri, bukan ditebak
 * model. Itu sengaja: usulan yang dikirim ke pusat harus bisa dipertanggung-
 * jawabkan asal angkanya.
 */

export type JenisBorang = "rl" | "permintaan" | "";

export const PROMPT_BORANG = `Kamu membaca satu halaman dokumen kapal PT ASDP (Bahasa Indonesia) hasil pindai.

Ada dua jenis borang. Kenali dari kop kanan atas ("No. Dokumen"):
- "TF-102.01.01" atau judul "DAFTAR PEKERJAAN DOCKING"  -> jenis "rl"
- "HP-103.00.01" atau judul "PERMINTAAN PENGADAAN BARANG/JASA KAPAL" -> jenis "permintaan"

Untuk jenis "rl", kolomnya BERURUTAN dari kiri:
  NO. | URAIAN | VOLUME (Qty | Unit) | HARGA SATUAN | KETERANGAN
Untuk jenis "permintaan", kolomnya BERURUTAN dari kiri:
  No | Jumlah | Satuan | Merk/Katalog | Uraian/Spesifikasi Barang
  -> "Merk/Katalog" (mis. JOTUN) masuk ke "merk", BUKAN ke "uraian".
  -> "Uraian/Spesifikasi Barang" (mis. SIGMARINE 48-700 (WHITE)) masuk ke "uraian".

"noSurat" diambil dari kepala surat "No. SPPB/J" (mis. 049/D/KRP II/VII/ASDP-TTE/2026),
BUKAN dari "No. Dokumen" (HP-103.00.01 / TF-102.01.01) — itu kode borangnya, bukan nomor surat.
"kapal" diambil dari baris "Dari : NAHKODA KMP ..." atau judul di kepala tabel; tulis nama kapalnya
saja (mis. "KMP. KERAPU II"), bukan "PT ASDP".
Baris kepala surat (Kepada, Dari, Tanggal, Tanggal dibutuhkan) BUKAN item — jangan dimasukkan ke "baris".

Aturan:
- Baris judul bagian ditulis huruf besar dan biasanya bernomor romawi (I, II, III, IV, V ...)
  atau tanpa nomor (mis. "CAT GARIS AIR ( AGA )", "VOID TANK", "PEKERJAAN LAMBUNG").
  Baris itu BUKAN item: pakai sebagai "bagian" untuk semua item di bawahnya sampai ada judul baru.
  Kalau ada nomor romawi, tulis di "romawi", kalau tidak ada isi "".
- Baris item = punya nomor urut dan/atau volume. Tulis apa adanya, termasuk ukuran
  di barisnya (mis. "Uk. P: 400 cm x L: 60 cm") — jangan diringkas, jangan diterjemahkan.
- Rincian bernomor kurung ("1) Lambung ( 8 Kg = 46 Buah )") gabungkan ke item induknya
  dengan newline pada "uraian".
- "qty" angka saja (boleh desimal). Kalau kosong di kertas, isi 0.
- "unit" salin apa adanya (M2, Bh, Set, Ls, Liter, Hari, Unit ...).
- "merk" hanya untuk jenis "permintaan" (kolom Merk/Katalog), selain itu "".
- JANGAN mengarang harga. Kolom harga pada borang ini memang kosong.
- Kalau satu sel tak terbaca jelas, isi apa adanya yang terbaca dan beri tanda "?" di akhir.
- Nomor romawi HANYA ditulis kalau memang tercetak di kertas. Jangan menomori sendiri
  baris item dengan I, II, III — biarkan "romawi" kosong bila tidak ada.
- Baca SELURUH baris pada halaman itu sampai habis, jangan berhenti di tengah tabel.

Keluarkan HANYA JSON valid:
{"jenis":"rl","kapal":"","noSurat":"","tanggal":"","baris":[{"romawi":"","bagian":"","no":"","uraian":"","qty":0,"unit":"","merk":"","ket":""}]}`;

export interface BarisBorang {
  romawi: string;
  bagian: string;
  no: string;
  uraian: string;
  qty: number;
  unit: string;
  merk?: string;
  ket?: string;
  /** halaman asal — supaya bisa ditelusuri balik ke kertasnya */
  halaman?: number;
}

export interface HasilBorang {
  jenis: JenisBorang;
  kapal: string;
  noSurat: string;
  tanggal: string;
  baris: BarisBorang[];
}

const teks = (v: any) => String(v ?? "").replace(/\s+/g, " ").trim();
const angka = (v: any) => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return isFinite(n) ? n : 0;
};

/** rapikan jawaban model jadi bentuk yang pasti — model boleh salah bentuk, kita tidak */
export function rapikanBorang(mentah: any, halaman = 0): HasilBorang {
  const j = teks(mentah?.jenis).toLowerCase();
  const jenis: JenisBorang = j.startsWith("rl") ? "rl" : j.startsWith("perm") ? "permintaan" : "";
  const arr: any[] = Array.isArray(mentah?.baris) ? mentah.baris : Array.isArray(mentah) ? mentah : [];
  let bagianBerjalan = "";
  let romawiBerjalan = "";
  const baris: BarisBorang[] = [];
  for (const b of arr) {
    const uraian = String(b?.uraian ?? "").replace(/[ \t]+/g, " ").trim();
    if (!uraian) continue;
    const bagian = teks(b?.bagian);
    const romawi = teks(b?.romawi).toUpperCase();
    if (bagian) bagianBerjalan = bagian;
    if (romawi) romawiBerjalan = romawi;
    baris.push({
      romawi: romawi || romawiBerjalan,
      bagian: bagian || bagianBerjalan,
      no: teks(b?.no),
      uraian,
      qty: angka(b?.qty),
      unit: teks(b?.unit),
      merk: teks(b?.merk) || undefined,
      ket: teks(b?.ket) || undefined,
      halaman: halaman || undefined,
    });
  }
  return { jenis, kapal: teks(mentah?.kapal), noSurat: teks(mentah?.noSurat), tanggal: teks(mentah?.tanggal), baris };
}

/** gabung hasil beberapa halaman jadi satu berkas utuh */
export function gabungHalaman(hasil: HasilBorang[]): HasilBorang {
  const isi = hasil.filter((h) => h.baris.length || h.jenis);
  return {
    jenis: isi.find((h) => h.jenis)?.jenis || "",
    kapal: isi.find((h) => h.kapal)?.kapal || "",
    noSurat: isi.find((h) => h.noSurat)?.noSurat || "",
    tanggal: isi.find((h) => h.tanggal)?.tanggal || "",
    baris: isi.flatMap((h) => h.baris),
  };
}

// ── penggolongan: uraian kapal -> Docking Code & klasifikasi Smartsheet ──────
//
// Kata kuncinya diambil dari bagian-bagian yang benar-benar dipakai pada RL
// 2025 (OM-01 s/d CM-10) dan dari judul bagian yang ditulis kapal. Urutan
// penting: yang lebih khusus diperiksa lebih dulu.

export interface Golongan {
  kode: string;          // Docking Code
  bagian: string;        // nama bagian pada RL
  romawi: string;
  klasifikasi: "GS" | "OM" | "CM";
}

const ATURAN: { pola: RegExp; g: Golongan }[] = [
  { pola: /pandu|tug ?boat|shore ?power|air tawar|sampah|mck|listrik darat|general service|pelayanan umum/i,
    g: { kode: "OM - 01", bagian: "GENERAL SERVICE", romawi: "I", klasifikasi: "GS" } },
  { pola: /docking ?(dan|&)? ?undocking|naik ?\/? ?turun dock|kapal naik|floating|sewa dermaga|kade/i,
    g: { kode: "OM - 01", bagian: "DOCKING & UNDOCKING", romawi: "II", klasifikasi: "GS" } },
  { pola: /sand ?blasting|blasting|pengecatan|cat |sekrap|dicuci|anti ?fouling|primer|zinc ?anode|zink ?anode|anoda|ultrasonic|plimsol|lambung timbul/i,
    g: { kode: "OM - 02", bagian: "BLASTING, PAINTING & HULL PROTECTION", romawi: "III", klasifikasi: "OM" } },
  { pola: /jangkar|rantai|ceruk|chain locker|anchor/i,
    g: { kode: "CM - 06", bagian: "RANTAI JANGKAR DAN CERUK", romawi: "IV", klasifikasi: "CM" } },
  { pola: /sea ?chest|sea ?valve|kran laut|roster|saringan laut/i,
    g: { kode: "CM - 06", bagian: "SEA CHEST & SEA VALVE", romawi: "V", klasifikasi: "CM" } },
  { pola: /tail ?shaft|as propeller|propeller|baling|stern ?bush|kemudi|rudder|tongkat kemudi|daun kemudi/i,
    g: { kode: "CM - 10", bagian: "TAIL SHAFT, PROPELLER, RUDDER & STERN BUSH", romawi: "VI", klasifikasi: "CM" } },
  { pola: /tangki|tanki|got |ballast|void|cleaning tank|sump tank/i,
    g: { kode: "CM - 06", bagian: "PERAWATAN TANGKI-TANGKI", romawi: "VII", klasifikasi: "OM" } },
  { pola: /pisang.?pisang|replating|plat lambung|plat |keropos|las |pengelasan|konstruksi|manhole|reling|tangga/i,
    g: { kode: "CM - 06", bagian: "HULL / REPLATING", romawi: "VIII", klasifikasi: "CM" } },
  { pola: /rampdoor|ramp ?door|engsel|pin engsel|winch|hidrolik|hydraulic/i,
    g: { kode: "CM - 08", bagian: "OUTFITTING (RAMPDOOR & PERLENGKAPAN)", romawi: "IX", klasifikasi: "CM" } },
  { pola: /pipa|piping|flange|elbow|valve|katup|pompa/i,
    g: { kode: "CM - 04", bagian: "PIPING", romawi: "X", klasifikasi: "CM" } },
  { pola: /mesin induk|main engine|\bme\b|mesin bantu|auxiliary|\bae\b|overhaul|gearbox|kompresor|generator|alternator/i,
    g: { kode: "CM - 10", bagian: "PERMESINAN", romawi: "XI", klasifikasi: "CM" } },
  { pola: /akomodasi|interior|kamar|toilet|plafon|lantai|dinding|jendela|pintu|kursi|meja|ac |air condition/i,
    g: { kode: "OM - 03", bagian: "AKOMODASI & INTERIOR", romawi: "XII", klasifikasi: "OM" } },
  { pola: /navigasi|radar|gps|kompas|radio|ssb|lampu|penerangan|kelistrikan|kabel|panel/i,
    g: { kode: "OM - 03", bagian: "KELISTRIKAN & NAVIGASI", romawi: "XIII", klasifikasi: "OM" } },
];

const LAIN: Golongan = { kode: "", bagian: "LAIN-LAIN (perlu ditetapkan)", romawi: "", klasifikasi: "OM" };

/**
 * Tebak golongan sebuah baris. Judul bagian yang ditulis kapal diperiksa lebih
 * dulu karena itu maksud aslinya; uraian baris hanya dipakai bila judulnya tak
 * mengenali apa pun.
 */
export function golongkan(b: BarisBorang): Golongan {
  for (const sumber of [b.bagian, b.uraian]) {
    if (!sumber) continue;
    for (const a of ATURAN) if (a.pola.test(sumber)) return a.g;
  }
  return LAIN;
}
