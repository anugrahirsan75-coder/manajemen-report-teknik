/**
 * Cocokkan baris tempelan (lembar SPBJ/PO final) dengan item yang SUDAH ada di
 * formulir.
 *
 * Bedanya dengan tempel tabel SPPB/J: di sana barisnya ditambahkan, di sini
 * tidak boleh ada baris baru sama sekali. Tabel Item SPBJ isinya diturunkan
 * dari Item SPPB/J di atasnya, jadi yang dipindahkan dari tempelan hanyalah
 * HARGA — item, jumlah dan satuannya tetap milik formulir.
 *
 * Karena itu yang dikerjakan di sini adalah perjodohan, dan perjodohan yang
 * salah jauh lebih berbahaya daripada yang tidak ketemu: harga pekerjaan A
 * masuk ke pekerjaan B tetap menghasilkan total yang benar, sehingga tidak
 * ketahuan dari angka penutup mana pun. Maka:
 *
 *   - Pencocokan selalu MENYELURUH dulu, baru dipilih: semua pasangan dinilai,
 *     diurutkan dari yang paling mirip, baru diambil. Mencocokkan satu per satu
 *     menurut urutan item membuat item pertama menyambar baris yang sebenarnya
 *     lebih cocok untuk item ketiga.
 *   - Satu baris tempelan hanya boleh dipakai satu item, dan sebaliknya.
 *   - Yang skornya di bawah ambang dibiarkan KOSONG, bukan dipaksakan ke baris
 *     terdekat. Kolom yang kosong terlihat; kolom yang salah diam saja.
 */

export interface ItemTujuan {
  id: string;
  kapal: string;
  jumlah: number;
  satuan: string;
  nama: string;
  /** harga satuan pada SPPB/J, dipakai sebagai pembanding */
  harga: number;
  hargaSpbj?: number;
}

export interface BarisSumber {
  /** nomor baris pada tempelan, 1-basis */
  sumber: number;
  kapal: string;
  jumlah: number;
  satuan: string;
  nama: string;
  /** harga satuan hasil bacaan */
  harga: number;
}

export interface Jodoh {
  item: ItemTujuan;
  baris: BarisSumber | null;
  /** 0..1, 1 = nama sama persis */
  skor: number;
  /** alasan pasangan ini perlu dilihat manusia */
  catatan?: string;
}

export type ModeCocok = "nama" | "urut";

/* ── kemiripan nama ─────────────────────────────────────────────────────── */

/**
 * Nama barang di lembar vendor jarang sama persis dengan yang diketik di
 * aplikasi: ada yang pakai titik, tanda hubung, huruf besar semua, atau
 * menyisipkan merek. Yang disamakan di sini hanya hal yang memang tidak
 * membedakan barang — tanda baca dan spasi ganda — bukan kata-katanya.
 */
export function normalkan(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const kata = (s: string): string[] => normalkan(s).split(" ").filter((w) => w.length > 1);

/**
 * Nilai kemiripan dua nama, 0..1.
 *
 * Dipakai koefisien Dice atas KATA, bukan atas huruf. Kemiripan huruf membuat
 * "pompa bilga" dan "pompa ballast" terlihat sangat mirip padahal barangnya
 * berbeda — yang membedakan justru satu kata, dan ukuran per kata menghukum
 * perbedaan itu sebagaimana mestinya.
 *
 * Nama yang satu memuat nama yang lain secara utuh ("ganti kunci" di dalam
 * "ganti kunci + handle lengkap set") diberi lantai 0,8: di lembar vendor
 * perluasan seperti itu lazim dan hampir selalu barang yang sama.
 */
export function miripNama(a: string, b: string): number {
  const na = normalkan(a);
  const nb = normalkan(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ka = kata(a);
  const kb = kata(b);
  if (!ka.length || !kb.length) return 0;

  const hitung: Record<string, number> = {};
  ka.forEach((w) => { hitung[w] = (hitung[w] || 0) + 1; });
  let sama = 0;
  kb.forEach((w) => { if (hitung[w] > 0) { hitung[w] -= 1; sama += 1; } });
  const dice = (2 * sama) / (ka.length + kb.length);

  const muat = na.indexOf(nb) >= 0 || nb.indexOf(na) >= 0;
  return muat ? Math.max(dice, 0.8) : dice;
}

/** di bawah ini dianggap belum ketemu — lebih baik kosong daripada salah pasang */
export const AMBANG = 0.45;

/* ── perjodohan ─────────────────────────────────────────────────────────── */

function catatanUntuk(item: ItemTujuan, baris: BarisSumber | null, skor: number): string | undefined {
  if (!baris) return "tidak ada baris tempelan yang cocok";
  const c: string[] = [];
  if (skor < 0.75) c.push("nama tidak persis sama — periksa");
  if (!baris.harga) c.push("harga pada tempelan kosong");
  if (baris.jumlah && item.jumlah && baris.jumlah !== item.jumlah) {
    c.push(`jumlah beda: formulir ${item.jumlah}, tempelan ${baris.jumlah}`);
  }
  if (
    baris.kapal && item.kapal &&
    normalkan(baris.kapal) !== normalkan(item.kapal)
  ) {
    c.push(`kapal beda: formulir ${item.kapal}, tempelan ${baris.kapal}`);
  }
  return c.length ? c.join(" · ") : undefined;
}

/**
 * Pasangkan menurut nama, menyeluruh: semua pasangan dinilai lebih dulu, lalu
 * diambil dari yang paling mirip. Kapal yang berbeda menurunkan nilai alih-alih
 * menggugurkan — lembar vendor sering tidak menyebut kapal sama sekali.
 */
function jodohNama(items: ItemTujuan[], baris: BarisSumber[]): Jodoh[] {
  const calon: { i: number; b: number; skor: number }[] = [];
  items.forEach((it, i) => {
    baris.forEach((br, b) => {
      let s = miripNama(it.nama, br.nama);
      if (s <= 0) return;
      if (br.kapal && it.kapal && normalkan(br.kapal) !== normalkan(it.kapal)) s *= 0.75;
      if (br.jumlah && it.jumlah && br.jumlah === it.jumlah) s = Math.min(1, s + 0.05);
      calon.push({ i, b, skor: s });
    });
  });
  calon.sort((x, y) => y.skor - x.skor);

  const kePos: (number | null)[] = items.map(() => null);
  const skorPos: number[] = items.map(() => 0);
  const barisTerpakai: boolean[] = baris.map(() => false);
  calon.forEach((c) => {
    if (c.skor < AMBANG) return;
    if (kePos[c.i] !== null || barisTerpakai[c.b]) return;
    kePos[c.i] = c.b;
    skorPos[c.i] = c.skor;
    barisTerpakai[c.b] = true;
  });

  return items.map((it, i) => {
    const b = kePos[i] === null ? null : baris[kePos[i] as number];
    return { item: it, baris: b, skor: skorPos[i], catatan: catatanUntuk(it, b, skorPos[i]) };
  });
}

/**
 * Pasangkan menurut urutan baris. Dipakai kalau lembar PO memang disusun
 * mengikuti urutan SPPB/J — sering terjadi, dan pada lembar yang nama
 * barangnya disingkat habis justru inilah yang benar.
 */
function jodohUrut(items: ItemTujuan[], baris: BarisSumber[]): Jodoh[] {
  return items.map((it, i) => {
    const b = i < baris.length ? baris[i] : null;
    const skor = b ? miripNama(it.nama, b.nama) : 0;
    const c = catatanUntuk(it, b, 1);        // urutan tidak dinilai dari namanya
    const beda = b && skor < AMBANG ? "namanya jauh berbeda — pastikan urutannya memang sama" : "";
    return {
      item: it, baris: b, skor,
      catatan: [beda, c].filter(Boolean).join(" · ") || undefined,
    };
  });
}

export function cocokkan(items: ItemTujuan[], baris: BarisSumber[], mode: ModeCocok): Jodoh[] {
  return mode === "urut" ? jodohUrut(items, baris) : jodohNama(items, baris);
}

/** ringkasan untuk kepala layar */
export function ringkas(jodoh: Jodoh[]) {
  const ketemu = jodoh.filter((j) => j.baris);
  const ragu = ketemu.filter((j) => j.catatan);
  return {
    total: jodoh.length,
    ketemu: ketemu.length,
    kosong: jodoh.length - ketemu.length,
    ragu: ragu.length,
  };
}
