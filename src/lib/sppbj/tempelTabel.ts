/**
 * Baca tabel SPPB/J yang disalin langsung dari Excel.
 *
 * Tempel yang sudah ada di layar isi SPPBJ menuntut susunan kolom persis
 * Kapal · Jumlah · Satuan · Nama · Spesifikasi · Harga, dan hanya mau baris
 * item bersih. Lembar SPPB/J yang sebenarnya tidak seperti itu: ada baris nama
 * kapal, baris judul golongan (I. Material Liferaft @12 unit), keterangan yang
 * nyangkut di kolom lain (Exp. 16 September 2026), nomor yang mengulang dari 1
 * tiap golongan, dan tiga baris penutup Jumlah/PPn/Total. Menyalinnya apa
 * adanya menghasilkan puluhan baris sampah yang harus dibersihkan tangan —
 * persis pekerjaan yang ingin dihindari.
 *
 * Berkas ini menerjemahkan tempelan mentah menjadi baris item, DAN sekaligus
 * memeriksa hasilnya:
 *
 *   · tiap baris dicek jumlah × harga satuan terhadap kolom Jumlah di lembar;
 *   · seluruh item dijumlah lalu dibandingkan dengan baris "Jumlah Rp";
 *   · PPN dan "Total Rp" dihitung ulang dan dibandingkan.
 *
 * Pemeriksaan itu yang membuat tempelan bisa dipercaya. Tanpa itu, satu kolom
 * yang tergeser menghasilkan tabel yang kelihatan benar padahal nilainya salah,
 * dan kekeliruan macam itu baru ketahuan setelah dokumennya terbit.
 *
 * Tidak ada yang dibuang diam-diam: baris yang tidak dikenali tetap dilaporkan
 * sebagai baris terlewat, supaya jumlah baris masuk + terlewat selalu sama
 * dengan jumlah baris yang ditempel.
 */

/** peran satu kolom pada tempelan */
export type Peran =
  | "abaikan" | "no" | "kapal" | "jumlah" | "satuan"
  | "nama" | "spesifikasi" | "harga" | "total" | "keterangan";

export const PERAN_LABEL: Record<Peran, string> = {
  abaikan: "— abaikan —",
  no: "No",
  kapal: "Kapal",
  jumlah: "Jumlah",
  satuan: "Satuan",
  nama: "Nama Barang/Jasa",
  spesifikasi: "Spesifikasi",
  harga: "Harga Satuan",
  total: "Jumlah (total baris)",
  keterangan: "Keterangan",
};

export type JenisBaris = "item" | "kapal" | "golongan" | "rincian" | "penutup" | "lewat";

export interface BarisTempel {
  /** nomor baris pada tempelan, 1-basis — dipakai menunjuk baris bermasalah */
  sumber: number;
  jenis: JenisBaris;
  sel: string[];
  /* isi item bila jenis = "item" */
  kapal: string;
  jumlah: number;
  satuan: string;
  nama: string;
  spesifikasi: string;
  harga: number;
  keterangan?: string;
  breakdown?: string[];
  /** nilai kolom "Jumlah" pada lembar, untuk diadu dengan jumlah × harga */
  totalLembar?: number;
  /** alasan baris ini perlu dilihat manusia */
  catatan?: string;
  /** ikut diimpor atau tidak (dipakai layar) */
  pakai: boolean;
}

export interface HasilTempel {
  kolom: Peran[];
  baris: BarisTempel[];
  /** angka penutup yang terbaca di lembar */
  lembar: { jumlah?: number; ppn?: number; total?: number };
  /** angka hasil hitung ulang dari baris item */
  hitung: { jumlah: number; ppn: number; total: number };
  masalah: string[];
}

/* ── angka ──────────────────────────────────────────────────────────────── */

/**
 * Baca angka bergaya Indonesia.
 *
 * Inilah bagian yang paling gampang salah diam-diam: "2.000" harus terbaca dua
 * ribu, bukan dua koma nol. Aturannya dibuat dari BENTUK angkanya, bukan dari
 * tebakan besar-kecil:
 *
 *   ada "." dan ","  → titik ribuan, koma desimal        1.234.567,89
 *   hanya "."        → titik ribuan bila tiap kelompok
 *                      sesudahnya tepat 3 angka          3.600.000
 *                      selain itu titik desimal          7.5
 *   hanya ","        → koma desimal bila 1-2 angka
 *                      sesudahnya, selain itu ribuan     1.234,5 / 1,234,567
 */
export function bacaAngka(teks: string): number {
  let s = (teks || "").replace(/\s| /g, "").replace(/^Rp\.?/i, "");
  if (!s) return 0;
  const negatif = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/^\(|\)$/g, "").replace(/^-/, "");
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return 0;

  const adaTitik = s.includes(".");
  const adaKoma = s.includes(",");
  let angka: number;

  if (adaTitik && adaKoma) {
    // pemisah desimal = tanda yang muncul PALING KANAN
    const desimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const ribuan = desimal === "," ? "." : ",";
    angka = parseFloat(s.split(ribuan).join("").replace(desimal, "."));
  } else if (adaTitik) {
    const bagian = s.split(".");
    const ribuan = bagian.length > 1 && bagian.slice(1).every((b) => b.length === 3);
    angka = ribuan ? parseFloat(bagian.join("")) : parseFloat(s);
  } else if (adaKoma) {
    const bagian = s.split(",");
    const ekor = bagian[bagian.length - 1];
    const desimal = bagian.length === 2 && ekor.length > 0 && ekor.length <= 2;
    angka = desimal ? parseFloat(bagian.join(".")) : parseFloat(bagian.join(""));
  } else {
    angka = parseFloat(s);
  }
  if (!isFinite(angka)) return 0;
  return negatif ? -angka : angka;
}

/** apakah sel ini berisi angka dan bukan sekadar teks yang kebetulan ada angkanya */
const selAngka = (s: string) => /^[\s(]*(Rp\.?\s*)?-?[\d.,]+\)?\s*$/.test((s || "").trim()) && bacaAngka(s) !== 0;

/* ── pengenalan baris ───────────────────────────────────────────────────── */

const RX_KAPAL = /\bKMP\b|\bKMP\.|\bKM\.\s|\bKMT\b/i;
const RX_GOLONGAN = /^(?:[IVXLC]+|[A-H])[.)]\s*\S/;          // I. / II. / A.
const RX_PENUTUP = /^(jumlah|sub\s*total|total|ppn|ppn\s*11|pajak)\b/i;
/*
 * Judul kolom yang dikenali.
 *
 * Diperluas untuk lembar SPBJ/PO, yang judulnya lebih pendek daripada lembar
 * SPPB/J: "Jml" bukan "Jumlah", dan kolom uangnya "Harga SPBJ" atau "Harga"
 * saja, bukan "Harga Satuan". Tanpa ini barisnya tetap terbaca, tetapi "Jml"
 * jatuh ke abaikan dan "Jumlah" (yang di lembar SPBJ artinya total baris)
 * terbaca sebagai kuantitas - harga satuan lalu dihitung dari angka yang salah.
 */
const RX_JUDUL_KOLOM = /^(no|jumlah|jml|vol|volume|satuan|nama|nama\s*barang|nama\s*barang\s*\/\s*jasa|nama\s*barang\s*\/\s*pekerjaan|barang\s*\/\s*jasa|pekerjaan|spesifikasi|harga|harga\s*satuan|harga\s*spbj|harga\s*po|estimasi|keterangan|uraian|kapal|qty|sat)\.?$/i;

/** buang baris kosong di ujung + pecah jadi sel */
export function pecah(teks: string): string[][] {
  return (teks || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((b) => b.split("\t").map((s) => s.trim()))
    .filter((sel) => sel.some((s) => s !== ""));
}

/**
 * Tebak peran tiap kolom.
 *
 * Judul kolom dipakai lebih dulu bila ada — itu keterangan yang ditulis
 * pembuat lembarnya sendiri, jadi lebih tepercaya daripada tebakan apa pun.
 * Kalau tidak ada judul, barulah ditebak dari isi: kolom paling kanan yang
 * berisi uang adalah total, sebelahnya harga satuan, kolom teks terpanjang
 * adalah nama barang.
 */
export function tebakKolom(baris: string[][]): Peran[] {
  const lebar = Math.max(...baris.map((b) => b.length), 0);
  const peran: Peran[] = Array.from({ length: lebar }, () => "abaikan");
  if (!lebar) return peran;

  /*
   * 1) Judul kolom — dibaca dari BEBERAPA baris, bukan satu.
   *
   * Lembar SPPB/J memakai judul bertingkat: satu sel "Estimasi Harga" digabung
   * melebar, lalu di bawahnya "Harga Satuan" dan "Jumlah". Membaca satu baris
   * saja membuat dua kolom uang itu tidak pernah terpetakan, dan tabelnya masuk
   * tanpa harga sama sekali.
   */
  const iJudul = baris.findIndex((b) => b.filter((s) => RX_JUDUL_KOLOM.test(s)).length >= 3);
  if (iJudul >= 0) {
    const pakai = (i: number, p: Peran) => { if (peran[i] === "abaikan") peran[i] = p; };
    let sudahJumlah = false;
    for (let r = iJudul; r < Math.min(iJudul + 3, baris.length); r++) {
      baris[r].forEach((s, i) => {
        const t = s.toLowerCase().replace(/\s+/g, " ").trim();
        if (!t) return;
        if (/^no\.?$/.test(t)) pakai(i, "no");
        else if (/kapal/.test(t)) pakai(i, "kapal");
        // "Harga" apa pun embel-embelnya (Satuan, SPBJ, PO, Final) adalah harga
        // satuan; di lembar SPBJ kolom totalnya selalu berjudul "Jumlah"
        else if (/^harga\b/.test(t) || /harga\s*(satuan|spbj|po|final|net)/.test(t)) pakai(i, "harga");
        else if (/^(satuan|sat)\.?$/.test(t)) pakai(i, "satuan");
        // sesudah "Jml" terbaca sebagai kuantitas, kolom "Jumlah" yang menyusul
        // pasti total baris - kuantitasnya sudah punya lajur sendiri
        else if (/^(jml|qty|vol|volume)\.?$/.test(t)) { pakai(i, "jumlah"); sudahJumlah = true; }
        else if (/nama|uraian|^pekerjaan$|barang\s*\/\s*jasa/.test(t)) pakai(i, "nama");
        else if (/spesifikasi|spek/.test(t)) pakai(i, "spesifikasi");
        else if (/keterangan|^ket\.?$/.test(t)) pakai(i, "keterangan");
        else if (/^jumlah$/.test(t)) { pakai(i, sudahJumlah ? "total" : "jumlah"); sudahJumlah = true; }
      });
    }
    // "Jumlah" yang berada di KANAN harga satuan adalah total baris
    const iHarga = peran.indexOf("harga");
    if (iHarga >= 0) {
      for (let i = iHarga + 1; i < lebar; i++) if (peran[i] === "jumlah") peran[i] = "total";
    }
    /*
     * Pemetaan dari judul harus LOLOS UJI pada barisnya sendiri.
     *
     * Lembar SPPB/J memakai sel gabungan, jadi judul "Nama Barang" kerap
     * duduk di lajur yang berbeda dengan tempat teks itemnya benar-benar
     * berada. Kalau itu terjadi, kolom nama terbaca kosong di hampir semua
     * baris dan seluruh tabel jatuh ke "tidak dikenali" — persis kegagalan
     * yang tidak bisa ditebak pemakainya dari layar. Maka hasil tebakan
     * diadu dulu dengan isinya; kalau tidak terbukti, judulnya diabaikan dan
     * susunan kolom dicari dari isi tabel.
     */
    if (peran.some((p) => p !== "abaikan") && terbukti(peran, baris, iJudul + 1)) {
      return uangCadangan(lengkapi(peran, baris), baris);
    }
    peran.fill("abaikan");
  }

  /*
   * 2) tanpa judul: tebak dari isi.
   *
   * Lembar SPBJ yang ditempel sering cuma dua-tiga lajur ("Nama" dan "Harga"),
   * karena yang disalin memang hanya kolom yang berubah. Syarat tiga sel terisi
   * membuat tabel selebar itu tidak punya satu pun baris untuk dinilai, dan
   * seluruh kolomnya jatuh jadi teks - harganya hilang tanpa pesan apa pun.
   */
  const isi = baris.filter((b) => b.filter((s) => s).length >= (lebar <= 3 ? 2 : 3));
  const skorUang: number[] = Array.from({ length: lebar }, () => 0);
  const skorPendek: number[] = Array.from({ length: lebar }, () => 0);
  const panjang: number[] = Array.from({ length: lebar }, () => 0);
  for (const b of isi) {
    for (let i = 0; i < lebar; i++) {
      const s = b[i] || "";
      if (!s) continue;
      if (selAngka(s)) { if (bacaAngka(s) >= 1000) skorUang[i]++; else skorPendek[i]++; }
      panjang[i] += s.length;
    }
  }
  /*
   * Ambang dihitung dalam BARIS, bukan persentase: lembar penunjang sering cuma
   * 3-5 item, dan ambang 30% membuat kolom uangnya tidak pernah lolos.
   *
   * Pada tempelan yang isinya satu-dua baris saja - lazim di lembar SPBJ, yang
   * ditempel hanya item yang harganya berubah - ambang dua baris mustahil
   * dipenuhi. Di situ satu baris sudah cukup; risikonya salah tebak, tapi
   * tebakan itu masih ditunjukkan ke pemakai sebelum dipakai, sedangkan
   * harga yang hilang tidak terlihat sama sekali.
   */
  const minBukti = isi.length >= 3 ? 2 : 1;
  const kolomUang = skorUang.map((v, i) => ({ i, v })).filter((x) => x.v >= minBukti);
  if (kolomUang.length >= 2) {
    peran[kolomUang[kolomUang.length - 1].i] = "total";
    peran[kolomUang[kolomUang.length - 2].i] = "harga";
  } else if (kolomUang.length === 1) {
    peran[kolomUang[0].i] = "harga";
  }
  /*
   * Dua lajur berangka kecil berarti "No" lalu "Jumlah" — itu susunan baku
   * borang SPPB/J. Mengambil yang pertama sebagai Jumlah menghasilkan angka
   * yang kebetulan benar selama nomor urut dan kuantitasnya sama, lalu
   * diam-diam salah begitu berbeda (No 3, Jumlah 12).
   */
  const kolomKecil = skorPendek.map((v, i) => ({ i, v })).filter((x) => x.v >= minBukti && peran[x.i] === "abaikan");
  if (kolomKecil.length >= 2) {
    peran[kolomKecil[0].i] = "no";
    peran[kolomKecil[1].i] = "jumlah";
  } else if (kolomKecil.length === 1) {
    peran[kolomKecil[0].i] = "jumlah";
  }
  const teks = panjang.map((v, i) => ({ i, v })).filter((x) => peran[x.i] === "abaikan").sort((a, b) => b.v - a.v);
  if (teks[0]) peran[teks[0].i] = "nama";
  if (teks[1]) peran[teks[1].i] = "spesifikasi";
  return uangCadangan(lengkapi(peran, baris), baris);
}

/**
 * Jaring pengaman kolom uang.
 *
 * Kalau judulnya terbaca tapi kolom harga/total tidak ketemu — judulnya
 * bertingkat, disingkat, atau salah ketik — kolom uang dicari dari ISINYA:
 * kolom paling kanan yang sebagian besar selnya berisi angka >= 1000. Tanpa
 * ini tabel tetap masuk, hanya saja seluruh harganya nol, dan itu kesalahan
 * yang paling mahal di antara semua kemungkinan di layar ini.
 */
function uangCadangan(peran: Peran[], baris: string[][]): Peran[] {
  if (peran.includes("harga") && peran.includes("total")) return peran;
  const lebar = peran.length;
  const isi = baris.filter((b) => b.filter((s) => s).length >= 3);
  if (!isi.length) return peran;
  const skor = Array.from({ length: lebar }, (_, i) =>
    isi.filter((b) => selAngka(b[i] || "") && bacaAngka(b[i] || "") >= 1000).length);
  const calon = skor
    .map((v, i) => ({ i, v }))
    /*
     * Lajur yang SUDAH punya peran tidak boleh diambil alih di sini - termasuk
     * yang sudah jadi "harga". Sebelumnya tidak demikian, dan lembar yang punya
     * kolom harga satuan tanpa kolom total membuat kolom harganya sendiri
     * ditimpa jadi total; harga satuannya lalu dihitung ulang sebagai
     * total/jumlah, jadi tepat sebesar harga asli dibagi kuantitas.
     */
    .filter((x) => x.v >= 2 && !["nama", "spesifikasi", "satuan", "kapal", "no", "jumlah", "harga", "total"].includes(peran[x.i]));
  if (!calon.length) return peran;
  if (!peran.includes("total")) peran[calon[calon.length - 1].i] = "total";
  if (!peran.includes("harga") && calon.length >= 2) peran[calon[calon.length - 2].i] = "harga";
  else if (!peran.includes("harga") && calon.length === 1 && peran.indexOf("total") !== calon[0].i) peran[calon[0].i] = "harga";
  return peran;
}

/**
 * Apakah pemetaan ini benar-benar cocok dengan isi tabelnya?
 *
 * Ukurannya sederhana dan keras: harus ada minimal dua baris yang pada lajur
 * "nama" berisi teks DAN pada salah satu lajur angka berisi angka. Satu baris
 * bisa kebetulan; dua baris berarti susunannya memang begitu.
 *
 * Dua pengecualian, keduanya berasal dari lembar SPBJ yang pendek:
 *
 *   Baris judulnya sendiri tidak ikut dinilai (parameter `mulai`). Judul kolom
 *   selalu berisi teks pada lajur nama dan bukan angka pada lajur angka, jadi
 *   ia selalu menjadi satu baris yang "gagal" dan ikut menenggelamkan tabel
 *   yang itemnya cuma satu.
 *
 *   Kalau baris kandidatnya memang cuma satu, satu baris cocok sudah cukup.
 *   Menuntut dua baris pada tabel satu baris berarti judul kolomnya selalu
 *   dibuang, lalu susunan kolom ditebak ulang dari isi - dan tebakan itu tidak
 *   bisa membedakan kolom "Jumlah" (total) dari kolom "Harga Satuan".
 */
function terbukti(peran: Peran[], baris: string[][], mulai = 0): boolean {
  const iNama = peran.indexOf("nama");
  if (iNama < 0) return false;
  const lajurAngka = peran
    .map((p, i) => ({ p, i }))
    .filter((x) => x.p === "jumlah" || x.p === "harga" || x.p === "total")
    .map((x) => x.i);
  if (!lajurAngka.length) return false;
  const kandidat = baris.slice(mulai).filter((b) => {
    const nama = (b[iNama] || "").trim();
    return !!nama && !RX_GOLONGAN.test(nama) && !RX_PENUTUP.test(nama);
  });
  if (!kandidat.length) return false;
  const perlu = Math.min(2, kandidat.length);
  let cocok = 0;
  for (const b of kandidat) {
    if (lajurAngka.some((i) => selAngka(b[i] || ""))) cocok++;
    if (cocok >= perlu) return true;
  }
  return false;
}

/**
 * Tambal peran yang masih kosong tapi kelihatan jelas: satuan adalah lajur
 * teks pendek pertama di KANAN jumlah. Dicari sampai beberapa lajur ke kanan,
 * bukan tepat sebelah — sel gabungan di Excel kerap menyisipkan lajur kosong
 * di antaranya.
 */
function lengkapi(peran: Peran[], baris: string[][]): Peran[] {
  const iJumlah = peran.indexOf("jumlah");
  if (iJumlah < 0 || peran.includes("satuan")) return peran;
  for (let i = iJumlah + 1; i < Math.min(iJumlah + 4, peran.length); i++) {
    if (peran[i] !== "abaikan") continue;
    const contoh = baris.map((b) => b[i] || "").filter(Boolean);
    if (!contoh.length) continue;
    const pendek = contoh.filter((s) => s.length <= 6 && !selAngka(s));
    if (pendek.length >= contoh.length * 0.6) { peran[i] = "satuan"; break; }
  }
  return peran;
}

/* ── penguraian ─────────────────────────────────────────────────────────── */

const ambil = (sel: string[], peran: Peran[], p: Peran) => {
  const i = peran.indexOf(p);
  return i >= 0 ? (sel[i] || "").trim() : "";
};

export function uraikan(teks: string, kolom?: Peran[], kapalAwal = ""): HasilTempel {
  const baris = pecah(teks);
  const peran = kolom && kolom.length ? kolom : tebakKolom(baris);
  const out: BarisTempel[] = [];
  const lembar: HasilTempel["lembar"] = {};
  const masalah: string[] = [];

  let kapal = kapalAwal;
  let golongan = "";
  let terakhirItem: BarisTempel | null = null;

  baris.forEach((sel, idx) => {
    const sumber = idx + 1;
    const dasar = { sumber, sel, kapal, jumlah: 0, satuan: "", nama: "", spesifikasi: "", harga: 0, pakai: false };
    const isiSel = sel.filter((s) => s !== "");
    const gabung = isiSel.join(" ").trim();

    // baris judul kolom -> lewat
    if (sel.filter((s) => RX_JUDUL_KOLOM.test(s)).length >= 3) {
      out.push({ ...dasar, jenis: "lewat", catatan: "baris judul kolom" });
      return;
    }

    // baris penutup: Jumlah Rp / PPn 11% / Total Rp
    if (RX_PENUTUP.test(gabung) && isiSel.some((s) => selAngka(s))) {
      const nilai = bacaAngka([...isiSel].reverse().find((s) => selAngka(s)) || "");
      if (/^ppn|pajak/i.test(gabung)) lembar.ppn = nilai;
      else if (/^total/i.test(gabung)) lembar.total = nilai;
      else lembar.jumlah = nilai;
      out.push({ ...dasar, jenis: "penutup", catatan: gabung.slice(0, 60) });
      return;
    }

    // baris nama kapal (hanya satu sel berisi, dan menyebut KMP)
    if (isiSel.length <= 2 && RX_KAPAL.test(gabung)) {
      kapal = gabung.replace(/^[-–•\s]+/, "").trim();
      golongan = "";
      out.push({ ...dasar, jenis: "kapal", kapal, catatan: `kapal → ${kapal}` });
      return;
    }

    const nama = ambil(sel, peran, "nama");
    const jumlahTeks = ambil(sel, peran, "jumlah");
    const hargaTeks = ambil(sel, peran, "harga");
    const totalTeks = ambil(sel, peran, "total");
    const kapalSel = ambil(sel, peran, "kapal");
    if (kapalSel && RX_KAPAL.test(kapalSel)) kapal = kapalSel;

    /*
     * Baris golongan: tidak berjumlah, tidak berharga, teksnya pendek dan
     * diawali angka romawi. Keterangan yang nyangkut di kolom lain (mis.
     * "Exp. 16 September 2026") ikut diangkut — di lembar aslinya keterangan
     * itu memang milik golongan, bukan milik satu item.
     */
    const adaAngka = selAngka(jumlahTeks) || selAngka(hargaTeks) || selAngka(totalTeks);
    if (!adaAngka && gabung && (RX_GOLONGAN.test(gabung) || RX_GOLONGAN.test(nama))) {
      // rangkai dari sel-selnya, bukan dari gabungan + sisa: judul golongan
      // sering jatuh di kolom "No" sementara keterangannya (mis. "Exp. 16
      // September 2026") di kolom lain, dan menggabung dua-duanya menghasilkan
      // keterangan yang tertulis dua kali
      const bagian = nama ? [nama, ...isiSel.filter((s) => s !== nama)] : [...isiSel];
      golongan = bagian.filter(Boolean).join(" · ").trim();
      out.push({ ...dasar, jenis: "golongan", keterangan: golongan, catatan: `golongan → ${golongan}` });
      return;
    }

    // baris item: ada nama DAN (jumlah atau harga)
    if (nama && (selAngka(jumlahTeks) || selAngka(hargaTeks) || selAngka(totalTeks))) {
      const jumlah = bacaAngka(jumlahTeks) || 1;
      let harga = bacaAngka(hargaTeks);
      const totalLembar = bacaAngka(totalTeks) || undefined;
      // harga satuan kosong tapi total ada -> turunkan dari total
      if (!harga && totalLembar && jumlah) harga = Math.round(totalLembar / jumlah);

      const ket = ambil(sel, peran, "keterangan");
      const b: BarisTempel = {
        ...dasar,
        jenis: "item",
        kapal,
        jumlah,
        satuan: ambil(sel, peran, "satuan") || "unit",
        nama,
        spesifikasi: ambil(sel, peran, "spesifikasi"),
        harga,
        keterangan: [golongan, ket].filter(Boolean).join("\n") || undefined,
        totalLembar,
        pakai: true,
      };
      const catatan: string[] = [];
      if (!harga) catatan.push("harga satuan kosong");
      if (totalLembar && Math.abs(jumlah * harga - totalLembar) > 1) {
        catatan.push(`jumlah × harga = ${Math.round(jumlah * harga).toLocaleString("id-ID")}, di lembar ${totalLembar.toLocaleString("id-ID")}`);
      }
      if (!kapal) catatan.push("kapal belum diketahui");
      if (catatan.length) b.catatan = catatan.join(" · ");
      out.push(b);
      terakhirItem = b;
      return;
    }

    /*
     * Baris rincian: ada teks, tidak ada angka apa pun, dan menempel di bawah
     * sebuah item. Di lembar SPPB/J baris seperti ini adalah uraian bahan di
     * bawah satu pekerjaan, jadi diikutkan sebagai breakdown item terakhir —
     * bukan dijadikan item baru tanpa harga.
     */
    if (nama && !adaAngka && terakhirItem) {
      terakhirItem.breakdown = [...(terakhirItem.breakdown || []), nama];
      out.push({ ...dasar, jenis: "rincian", nama, catatan: `rincian untuk: ${terakhirItem.nama.slice(0, 40)}` });
      return;
    }

    out.push({ ...dasar, jenis: "lewat", catatan: gabung ? `tidak dikenali: ${gabung.slice(0, 60)}` : "baris kosong" });
  });

  const item = out.filter((b) => b.jenis === "item");
  const jumlah = item.reduce((s, b) => s + b.jumlah * b.harga, 0);
  const ppn = Math.round(jumlah * 0.11);
  const hitung = { jumlah, ppn, total: jumlah + ppn };

  if (!item.length) masalah.push("Tidak ada baris yang terbaca sebagai item. Periksa pemetaan kolom di atas tabel.");
  if (peran.indexOf("nama") < 0) masalah.push("Kolom Nama Barang/Jasa belum ditentukan.");
  if (peran.indexOf("harga") < 0 && peran.indexOf("total") < 0) masalah.push("Kolom Harga Satuan maupun Jumlah belum ditentukan.");
  if (lembar.jumlah && Math.abs(lembar.jumlah - jumlah) > 1) {
    masalah.push(`Jumlah hasil hitung ${jumlah.toLocaleString("id-ID")} ≠ "Jumlah Rp" di lembar ${lembar.jumlah.toLocaleString("id-ID")} (selisih ${Math.abs(lembar.jumlah - jumlah).toLocaleString("id-ID")}).`);
  }
  if (lembar.total && Math.abs(lembar.total - hitung.total) > 2) {
    masalah.push(`Total hasil hitung ${hitung.total.toLocaleString("id-ID")} ≠ "Total Rp" di lembar ${lembar.total.toLocaleString("id-ID")}.`);
  }
  const bermasalah = item.filter((b) => b.catatan).length;
  if (bermasalah) masalah.push(`${bermasalah} baris item perlu diperiksa (ditandai kuning).`);

  return { kolom: peran, baris: out, lembar, hitung, masalah };
}
