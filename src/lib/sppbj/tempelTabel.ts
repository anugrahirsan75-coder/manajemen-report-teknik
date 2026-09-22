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
const RX_JUDUL_KOLOM = /^(no|jumlah|satuan|nama\s*barang|nama\s*barang\s*\/\s*jasa|spesifikasi|harga\s*satuan|estimasi|keterangan|uraian|kapal|qty|sat)\.?$/i;

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

  // 1) cari baris judul kolom
  const judul = baris.find((b) => b.filter((s) => RX_JUDUL_KOLOM.test(s)).length >= 3);
  if (judul) {
    let sudahJumlah = false;
    judul.forEach((s, i) => {
      const t = s.toLowerCase().replace(/\s+/g, " ").trim();
      if (/^no\.?$/.test(t)) peran[i] = "no";
      else if (/kapal/.test(t)) peran[i] = "kapal";
      else if (/^(jumlah|qty)$/.test(t)) { peran[i] = sudahJumlah ? "total" : "jumlah"; sudahJumlah = true; }
      else if (/^(satuan|sat)\.?$/.test(t)) peran[i] = "satuan";
      else if (/nama|uraian/.test(t)) peran[i] = "nama";
      else if (/spesifikasi|spek/.test(t)) peran[i] = "spesifikasi";
      else if (/harga\s*satuan/.test(t)) peran[i] = "harga";
      else if (/keterangan|ket\.?/.test(t)) peran[i] = "keterangan";
    });
    // "Jumlah" kedua di kanan harga = total baris
    const iHarga = peran.indexOf("harga");
    if (iHarga >= 0) {
      for (let i = iHarga + 1; i < lebar; i++) if (peran[i] === "jumlah") peran[i] = "total";
    }
    if (peran.some((p) => p !== "abaikan")) return lengkapi(peran, baris);
  }

  // 2) tanpa judul: tebak dari isi
  const isi = baris.filter((b) => b.filter((s) => s).length >= 3);
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
  const kolomUang = skorUang.map((v, i) => ({ i, v })).filter((x) => x.v >= Math.max(2, isi.length * 0.3));
  if (kolomUang.length >= 2) {
    peran[kolomUang[kolomUang.length - 1].i] = "total";
    peran[kolomUang[kolomUang.length - 2].i] = "harga";
  } else if (kolomUang.length === 1) {
    peran[kolomUang[0].i] = "harga";
  }
  const kolomJumlah = skorPendek.map((v, i) => ({ i, v })).filter((x) => x.v >= 2 && peran[x.i] === "abaikan");
  if (kolomJumlah.length) peran[kolomJumlah[0].i] = "jumlah";
  const teks = panjang.map((v, i) => ({ i, v })).filter((x) => peran[x.i] === "abaikan").sort((a, b) => b.v - a.v);
  if (teks[0]) peran[teks[0].i] = "nama";
  if (teks[1]) peran[teks[1].i] = "spesifikasi";
  return lengkapi(peran, baris);
}

/** tambal peran yang masih kosong tapi kelihatan jelas (satuan di kanan jumlah) */
function lengkapi(peran: Peran[], baris: string[][]): Peran[] {
  const iJumlah = peran.indexOf("jumlah");
  if (iJumlah >= 0 && peran[iJumlah + 1] === "abaikan") {
    const contoh = baris.map((b) => b[iJumlah + 1] || "").filter(Boolean);
    const pendek = contoh.filter((s) => s.length <= 6 && !selAngka(s));
    if (contoh.length && pendek.length >= contoh.length * 0.6) peran[iJumlah + 1] = "satuan";
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
