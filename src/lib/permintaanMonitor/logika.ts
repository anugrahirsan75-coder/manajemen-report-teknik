/**
 * Logika murni Monitoring Permintaan — tanpa React, tanpa jaringan, sehingga
 * bisa dipakai layar monitoring, dashboard manajemen, dan uji.
 */
import katalogMentah from "@/lib/rr/katalogRutin.json";
import type { BarisPermintaan } from "@/lib/lapor/skemaPermintaan";
import type { KirimanLapor } from "@/lib/lapor/types";
import {
  BATAS_MENGGANTUNG_HARI, BarisMonitor, EvalPermintaan, Klasifikasi, Pengadaan, PermohonanRingkas, Prioritas,
  RENTANG_ULANG_HARI, TAHAP_BELUM_PROSES, Tahap,
} from "./types";

const SATU_HARI = 86_400_000;

/* ── nama barang ─────────────────────────────────────────────────────────── */

const KATA_BUANG = new Set([
  "uk", "ukuran", "buah", "bh", "pcs", "unit", "set", "untuk", "dan", "yang", "dengan", "merk", "type", "tipe",
  "baru", "ganti", "pengadaan", "kmp", "kapal", "mm", "inch", "inchi", "cm", "kg", "ltr", "liter", "mtr", "meter",
  "roll", "lbr", "lembar", "btl", "botol", "dus", "pack", "pak", "the", "of", "for",
]);

/** nama barang tanpa tanda baca dan spasi ganda — dasar kunci & pencocokan */
export const normalNama = (s: string) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

const token = (s: string) =>
  normalNama(s).split(" ").filter((t) => t.length >= 3 && !KATA_BUANG.has(t) && !/^\d+$/.test(t));

/**
 * Seberapa mirip dua nama barang (0..1).
 *
 * Koefisien tumpang-tindih, bukan Jaccard: nama di SPPBJ biasanya lebih
 * panjang ("Pengadaan Filter Oli ME Donaldson P550...") daripada tulisan ABK
 * ("Filter oli ME"). Yang ditanyakan: apakah kata-kata nama yang pendek
 * seluruhnya ada di nama yang panjang.
 */
export function mirip(a: string, b: string): number {
  const A = new Set(token(a)); const B = new Set(token(b));
  if (!A.size || !B.size) return 0;
  let sama = 0;
  A.forEach((t) => { if (B.has(t)) sama++; });
  let skor = sama / Math.min(A.size, B.size);
  /*
   * Nama satu kata ("Lampu") tidak boleh dianggap sama dengan nama yang jauh
   * lebih rinci ("Lampu Downlight Philips 21 Watt"): yang pendek ikut di yang
   * panjang, tetapi barangnya belum tentu sama.
   */
  if (sama / Math.max(A.size, B.size) < 0.34) skor *= 0.6;
  /* ukuran berbeda = barang berbeda: "Kunci Pas Ring 36" bukan "uk. 23 mm" */
  const nA = angkaUkuran(a); const nB = angkaUkuran(b);
  if (nA.size && nB.size && !Array.from(nA).some((x) => nB.has(x))) skor *= 0.5;
  return skor;
}

const angkaUkuran = (s: string) =>
  new Set((String(s || "").replace(/(\d),(\d)/g, "$1.$2").match(/\d+(?:\.\d+)?/g) || []).filter((x) => x.length < 5));

/**
 * Kunci barang yang TAHAN sunting baris lain.
 *
 * Nomor urut baris saja tidak cukup: menghapus satu baris di atasnya akan
 * menggeser seluruh penilaian ke barang yang salah. Nama yang dinormalkan +
 * urutan kemunculan nama itu di berkasnya tetap sama walau baris lain
 * ditambah atau dihapus.
 */
export function kunciBarang(fileId: string, baris: BarisPermintaan[], idx: number): string {
  const n = normalNama(baris[idx]?.nama || "") || `baris-${idx}`;
  let ke = 0;
  for (let i = 0; i < idx; i++) if ((normalNama(baris[i]?.nama || "") || `baris-${i}`) === n) ke++;
  return `${fileId}|${n}|${ke}`;
}

export const kunciKapal = (k: string) =>
  String(k || "").toUpperCase().replace(/^KMP\.?\s*/, "").replace(/\s+/g, " ").trim();

/* ── saran otomatis ──────────────────────────────────────────────────────── */

/** kata kerusakan — barang yang diminta karena ada yang rusak */
const RE_RUSAK = /bocor|kebocoran|retak|patah|terbakar|rusak|tidak berfungsi|tidak bisa|macet|mati total|putus|hangus|korslet/i;

/** alat keselamatan — temuan pemeriksa dan laik laut bergantung padanya */
const RE_KESELAMATAN = new RegExp([
  "pemadam", "\\bapar\\b", "\\bapab\\b", "hydrant", "hidran", "fire ?(hose|pump|alarm|box|extinguisher)", "foam", "\\bco2\\b",
  "sprinkler", "life ?raft", "liferaft", "\\bilr\\b", "\\bhru\\b", "life ?buoy", "pelampung", "epirb", "\\bsart\\b", "\\bmob\\b",
  "flare", "parachute", "smoke detector", "heat detector", "gas detector", "general alarm", "emergency (light|lamp|fire|generator)",
].join("|"), "i");

/** komponen kritis — propulsi, kemudi, jangkar, listrik utama, navigasi */
const RE_KRITIS = new RegExp([
  "kemudi", "steering", "propeller", "baling", "shaft", "poros", "gear ?box", "governor", "injection pump", "\\bfip\\b",
  "jangkar", "rantai jangkar", "anchor", "winch", "ramp ?door", "generator", "dinamo", "dynamo", "alternator", "\\bavr\\b", "mccb",
  "accu", "\\baki\\b", "battery", "baterai", "radio", "\\bvhf\\b", "\\bssb\\b", "\\bais\\b", "\\bgps\\b", "radar", "gyro", "kompas",
  "echo ?sounder", "lampu navigasi", "module", "turbo", "liner", "piston", "bilga", "bilge",
].join("|"), "i");

/** barang habis pakai — meski menyebut komponen kritis, bukan alasan urgent */
const RE_HABIS = /\boli\b|\boil\b|pelumas|grease|gemuk|packing|paking|gasket|skun|kunci|filter|saringan|air accu|zuur|majun|baut|\bmur\b|klem|kabel ties|isolasi|lakban|amplas|sikat|kuas|cat\b|thinner/i;

/** barang habis pakai bulanan — hampir pasti masuk rencana rutin */
const RE_RUTIN = /majun|deterjen|detergen|sabun|pewangi|pembersih|karbol|sapu|pel\b|kain pel|tissue|tisu|kantong sampah|plastik sampah|atk|kertas|tinta|pulpen|bolpoin|spidol|map\b|lakban|isolasi|lem\b|kuas|amplas|thinner|tiner|cat\b|grease|gemuk|oli|pelumas|filter|saringan|v-?belt|klem|baut|mur\b|ring\b|lampu|bohlam|neon|led\b|sarung tangan|masker|kabel ties|cable tie|wd-?40|minyak/i;

/** unit atau barang modal — pengadaannya lewat persetujuan investasi */
const RE_INVESTASI = /mesin bantu baru|ae baru|unit baru|genset|ecdis|radar\b|mesin cuci|kulkas|lemari es|\bac\b|air conditioner|televisi|\btv\b|kompresor|gearbox|mesin induk|liferaft baru/i;

type ItemKatalog = { kapal: string; nama: string };
const KATALOG: ItemKatalog[] = ((katalogMentah as { item?: ItemKatalog[] }).item || []);

/**
 * Saran prioritas dari isi barangnya saja.
 *
 * Kiriman yang disertai LK TIDAK otomatis membuat seluruh barangnya urgent:
 * satu borang sering memuat barang kerusakan bersama ATK dan kebersihan, dan
 * menandai semuanya urgent membuat daftar merah penuh barang yang bisa
 * menunggu. LK cukup ditandai di barisnya; penilainya yang memutuskan.
 */
export function saranPrioritas(b: { nama: string; spesifikasi?: string; keterangan?: string }): Prioritas {
  const t = `${b.nama} ${b.spesifikasi || ""} ${b.keterangan || ""}`;
  if (RE_RUSAK.test(t)) return "urgent";
  // oli fire pump, filter ME, skun aki: habis pakai — tidak mendesak kecuali ada kerusakan
  if (RE_HABIS.test(`${b.nama} ${b.spesifikasi || ""}`)) return "normal";
  if (RE_KESELAMATAN.test(t) || RE_KRITIS.test(t)) return "urgent";
  return "normal";
}

/**
 * Baris hasil baca yang BUKAN barang: judul seksi ("I. MAIN ENGINE YANMAR"),
 * isian formulir LK ("Nama", "Tanda Tangan", "Batas Waktu Pelaksanaan"), atau
 * angka yang terlepas dari kolomnya. Cirinya sama: tanpa jumlah dan tanpa
 * satuan. Baris ini tetap ada di layar Isi Permintaan untuk dikoreksi, hanya
 * tidak ikut dipantau.
 */
export const bukanBarang = (b: { nama: string; jumlah?: string; satuan?: string }) =>
  /^\s*[\d.,]+\s*$/.test(b.nama || "") || (!angkaJumlahDepan(b.jumlah || "") && !String(b.satuan || "").trim());

const angkaJumlahDepan = (v: string) => /\d/.test(String(v || ""));

export function saranKlasifikasi(b: { nama: string; spesifikasi?: string }, kapal: string, nilai: number): Klasifikasi {
  const t = `${b.nama} ${b.spesifikasi || ""}`;
  if (RE_INVESTASI.test(t) && nilai >= 15_000_000) return "investasi";
  const k = kunciKapal(kapal);
  const diKatalog = KATALOG.some((x) => (kunciKapal(x.kapal) === k || !k) && mirip(x.nama, b.nama) >= 0.99);
  if (diKatalog || RE_RUTIN.test(t)) return "rutin";
  return "biaya";
}

const RE_LK = /ketidak ?sesuai|kerusak|rusak|\blk\b|berita acara|\bba\b|tidak berfungsi|bocor|patah|retak|terbakar/i;

/* ── pencocokan ke pengadaan ─────────────────────────────────────────────── */

const tglMs = (s: string) => { const t = new Date(s || "").getTime(); return Number.isFinite(t) ? t : 0; };

/**
 * Pengadaan yang paling mungkin memenuhi barang ini.
 *
 * Syarat: kapal sama, nama mirip (≥ 0,75), dan tanggal pengadaan tidak jauh
 * sebelum barang diminta (SPPBJ boleh disusun beberapa hari lebih dulu dari
 * berkas ABK yang menyusul). Dari yang lolos, dipilih yang PALING DEKAT
 * sesudah tanggal permintaan — pengadaan setahun kemudian untuk barang yang
 * sama hampir pasti permintaan lain.
 */
export function cocokPengadaan(b: { kapal: string; nama: string; dikirimPada: string }, daftar: Pengadaan[]): Pengadaan | null {
  const k = kunciKapal(b.kapal);
  const t0 = tglMs(b.dikirimPada) - 10 * SATU_HARI;
  const t1 = tglMs(b.dikirimPada) + 200 * SATU_HARI;
  let pilih: Pengadaan | null = null; let skor = 0; let jarak = Infinity;
  for (const p of daftar) {
    const tp = tglMs(p.tanggal);
    if (tp && b.dikirimPada && (tp < t0 || tp > t1)) continue;
    for (const it of p.items) {
      if (kunciKapal(it.kapal) !== k) continue;
      const s = mirip(b.nama, `${it.nama} ${it.spesifikasi || ""}`);
      if (s < 0.75) continue;
      const j = Math.abs(tp - tglMs(b.dikirimPada));
      if (s > skor + 0.05 || (Math.abs(s - skor) <= 0.05 && j < jarak)) { pilih = p; skor = s; jarak = j; }
    }
  }
  return pilih;
}

/* ── status ──────────────────────────────────────────────────────────────── */

/**
 * Status usulan investasi yang berlaku: bila barangnya ditautkan ke surat di
 * Monitoring Permohonan Cabang, status surat itu yang dipakai — kantor cukup
 * memperbarui satu tempat, barang-barang yang ikut di surat itu bergerak sendiri.
 */
export function statusUsul(ev: EvalPermintaan | null, pm: PermohonanRingkas | null): "" | "diusulkan" | "disetujui" | "ditolak" {
  // keputusan Pusat yang dicatat langsung di barang ini menang atas status surat
  if (ev?.usulStatus === "disetujui" || ev?.usulStatus === "ditolak") return ev.usulStatus;
  if (pm) return pm.status === "Disetujui" ? "disetujui" : pm.status === "Ditolak" ? "ditolak" : "diusulkan";
  return ev?.usulStatus || "";
}

export function tahapBarang(ev: EvalPermintaan | null, p: Pengadaan | null, pm: PermohonanRingkas | null = null): Tahap {
  if (ev?.diterima) return "selesai";
  if (ev?.keputusan === "tolak") return "ditolak";
  if (p) {
    if (p.asal === "nonpr") return "spbj";
    if (p.status === "selesai" || p.tahapScm === "selesai") return "selesai";
    if (p.status === "spbj_terbit" || p.tahapScm === "spbj") return "spbj";
    return "sppbj";
  }
  if (ev?.keputusan === "tunda") return "ditunda";
  if (ev?.keputusan === "setuju") {
    if (ev.klasifikasi === "stok") return "stok";
    /*
     * Investasi tidak bisa langsung diadakan: harus diusulkan ke Pusat, menunggu
     * persetujuannya, lalu nomor IO — kecuali memakai PO Sementara.
     */
    if (ev.klasifikasi === "investasi") {
      const s = statusUsul(ev, pm);
      if (s === "ditolak") return "ditolak";
      if (s === "diusulkan") return "pusat";
      if (s === "disetujui") return ev.noIO || ev.poSementara ? "disetujui" : "io";
      return "usul";
    }
    return "disetujui";
  }
  if (ev && (ev.prioritas || ev.klasifikasi)) return "menunggu";
  return "baru";
}

export const umurHari = (dikirimPada: string, kini = Date.now()) =>
  dikirimPada ? Math.max(0, Math.floor((kini - tglMs(dikirimPada)) / SATU_HARI)) : 0;

/* ── perakitan baris layar ───────────────────────────────────────────────── */

export interface MasukanSusun {
  kiriman: KirimanLapor[];
  bacaan: Map<string, { baris: BarisPermintaan[]; status: string }>;
  evals: Map<string, EvalPermintaan>;
  pengadaan: Pengadaan[];
  /** permohonan ke Pusat per id (Monitoring Permohonan Cabang) */
  permohonan?: Map<string, PermohonanRingkas>;
  /** harga satuan taksiran per kunci barang */
  harga?: Record<string, number>;
  kini?: number;
}

/**
 * Jumlah barang dari isian bebas ABK ("4", "4 pcs", "2,5 kg").
 *
 * Kolom jumlah kerap berisi hal lain: tanggal ("25 Agustus 2026"), rumus
 * kapasitas ("170 Ltr X 2 = 340 Ltr"), atau keterangan. Menggabungkan semua
 * digitnya menghasilkan "252026" — dan taksiran miliaran rupiah. Yang diterima
 * hanya SATU angka, boleh diikuti satuan; selain itu dianggap tak diketahui (0).
 */
const RE_BULAN = /jan|feb|mar|apr|mei|jun|jul|agu|aug|sep|okt|oct|nov|des|dec|tanggal|tgl/i;
export const angkaJumlah = (v: string) => {
  const s = String(v || "").trim();
  if (!s || RE_BULAN.test(s) || /[=x×*]\s*\d/i.test(s) || /\b(19|20)\d{2}\b/.test(s)) return 0;
  const m = /^[^\d]{0,3}(\d+(?:[.,]\d+)?)\s*[a-z.\s"'/²]*$/i.exec(s);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 100_000 ? n : 0;
};

/* ── satuan & kelayakan taksiran ─────────────────────────────────────────── */

const GOL_SATUAN: [RegExp, string][] = [
  [/^(l|lt|ltr|liter|litre)$/, "liter"], [/^(drum|drm|dr)$/, "drum"], [/^(pail|pal|ember)$/, "pail"],
  [/^(kg|kilo|kilogram)$/, "kg"], [/^(gr|gram)$/, "gram"], [/^(m|mtr|meter|m1)$/, "meter"],
  [/^(m2|meter2|m²)$/, "m2"], [/^(roll|rol|gulung)$/, "roll"],
  [/^(pcs|pc|bh|buah|unit|unt|set|psg|pasang|lbr|lembar|btg|batang|ea|bj|biji|klg|kaleng|btl|botol|tube|dus|box|pak|pack|rim)$/, "satuan"],
  [/^(ls|lot|paket|pkt)$/, "paket"],
];
const golSatuan = (s: string) => {
  const t = String(s || "").toLowerCase().replace(/[^a-z0-9²]/g, "");
  if (!t) return "";
  return GOL_SATUAN.find(([re]) => re.test(t))?.[1] || t;
};

/**
 * Harga satuan taksiran yang LAYAK dipakai.
 *
 * Database RAB mencocokkan nama, bukan satuan: oli yang diminta per liter
 * bisa tercocok ke harga per drum (Rp8,5 jt), dan "Pelumas mesin September"
 * ke kontrak docking. Taksiran dipakai hanya bila pencocokannya yakin, satuan
 * keduanya tidak bertentangan, dan harganya masuk akal untuk satu barang.
 */
/** satuan barang; bila kolomnya kosong, diambil dari ekor kolom jumlah ("836 Ltr") */
export const satuanEfektif = (b: { satuan?: string; jumlah?: string }) =>
  String(b.satuan || "").trim() || (/\d\s*([a-z]+)/i.exec(String(b.jumlah || ""))?.[1] || "");

export function hargaLayak(satuanMinta: string, hasil?: { harga?: number; satuan?: string; yakin?: boolean } | null): number {
  const h = Number(hasil?.harga) || 0;
  if (!h || !hasil?.yakin || h > 150_000_000) return 0;
  const a = golSatuan(satuanMinta); const b = golSatuan(hasil?.satuan || "");
  if (a && b && a !== b && !(a === "satuan" && b === "satuan")) return 0;
  // barang curah per liter/kg/meter tak mungkin semahal satu drum atau satu unit
  if (["liter", "kg", "gram", "meter"].includes(a) && h > 2_000_000) return 0;
  return h;
}

export const angkaRupiah = (v: unknown) => {
  const t = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!t) return 0;
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** nilai taksiran satu barang: harga ketikan kantor menang atas taksiran RAB */
export const nilaiBarang = (b: BarisMonitor, harga: Record<string, number>) =>
  (angkaRupiah(b.hargaManual) || harga[b.kunci] || 0) * (angkaJumlah(b.jumlah) || 1);

export function susunBaris(m: MasukanSusun): BarisMonitor[] {
  const kini = m.kini ?? Date.now();
  const harga = m.harga || {};
  const keluar: BarisMonitor[] = [];
  const idPengadaan = new Map(m.pengadaan.map((p) => [p.id, p]));

  for (const k of m.kiriman) {
    if (!String(k.jenis || "").startsWith("permintaan")) continue;
    const adaLkKiriman = RE_LK.test(k.catatan || "");
    for (const berkas of k.berkas || []) {
      const bc = m.bacaan.get(berkas.fileId);
      if (!bc || bc.status !== "selesai") continue;
      const lk = adaLkKiriman || RE_LK.test(berkas.nama || "");
      bc.baris.forEach((b, i) => {
        if (!(b.nama || "").trim() || bukanBarang(b)) return;
        const kunci = kunciBarang(berkas.fileId, bc.baris, i);
        const ev = m.evals.get(kunci) || null;
        const dasar = { kapal: k.kapal, nama: b.nama, dikirimPada: k.dikirimPada };
        let pengadaan: Pengadaan | null = null; let otomatis = false;
        if (ev?.tautPengadaan && ev.tautPengadaan !== "-") pengadaan = idPengadaan.get(ev.tautPengadaan) || null;
        else if (ev?.tautPengadaan !== "-") { pengadaan = cocokPengadaan(dasar, m.pengadaan); otomatis = !!pengadaan; }
        const nilai = (angkaRupiah(b.hargaManual) || harga[kunci] || 0) * (angkaJumlah(b.jumlah) || 1);
        const sp = saranPrioritas(b);
        const sk = saranKlasifikasi(b, k.kapal, nilai);
        const prioritas = (ev?.prioritas || sp) as Prioritas;
        const klasifikasi = (ev?.klasifikasi || sk) as Klasifikasi;
        const pm = ev?.permohonanId ? m.permohonan?.get(ev.permohonanId) || null : null;
        const tahap = tahapBarang(ev, pengadaan, pm);
        const umur = umurHari(k.dikirimPada, kini);
        keluar.push({
          kunci, fileId: berkas.fileId, indeks: i, kirimanId: k.id, kapal: k.kapal, jenis: k.jenis, periode: k.periode,
          dikirimPada: k.dikirimPada, pengirim: k.pengirim, berkasNama: berkas.nama, berkasUrl: berkas.url,
          nama: b.nama, spesifikasi: b.spesifikasi || "", jumlah: b.jumlah || "", satuan: b.satuan || "",
          keterangan: b.keterangan || "", hargaManual: b.hargaManual || "",
          adaLk: lk, catatanKapal: k.catatan || "", ev,
          saranPrioritas: sp, saranKlasifikasi: sk, prioritas, klasifikasi,
          prioritasSaran: !ev?.prioritas, klasifikasiSaran: !ev?.klasifikasi,
          tahap, pengadaan, pengadaanOtomatis: otomatis, permohonan: pm, umurHari: umur,
          menggantung: prioritas === "urgent" && TAHAP_BELUM_PROSES.includes(tahap) && umur > BATAS_MENGGANTUNG_HARI,
          dimintaUlang: 0,
        });
      });
    }
  }

  /*
   * "Diminta ulang": barang mirip dari kapal yang sama, di kiriman LAIN yang
   * 7–60 hari lebih dulu dan masih belum diproses. Hampir selalu berarti permintaan pertamanya
   * belum terpenuhi — sinyal yang paling jujur bahwa sesuatu tertahan.
   */
  const perKapal = new Map<string, BarisMonitor[]>();
  keluar.forEach((b) => perKapal.set(kunciKapal(b.kapal), [...(perKapal.get(kunciKapal(b.kapal)) || []), b]));
  perKapal.forEach((daftar) => {
    daftar.forEach((b) => {
      // barang rutin memang diminta tiap bulan — mengulangnya bukan tanda tertahan
      if (b.klasifikasi === "rutin") return;
      const t = tglMs(b.dikirimPada);
      const kiriman = new Set<string>();
      daftar.forEach((x) => {
        if (x.kirimanId === b.kirimanId) return;
        const tx = tglMs(x.dikirimPada);
        // unggahan susulan di minggu yang sama bukan permintaan ulang
        if (t - tx < 7 * SATU_HARI || t - tx > RENTANG_ULANG_HARI * SATU_HARI) return;
        // yang sebelumnya sudah diadakan/selesai/ditolak = kebutuhan baru, bukan tertahan
        if (!TAHAP_BELUM_PROSES.includes(x.tahap)) return;
        if (mirip(x.nama, b.nama) >= 0.99) kiriman.add(x.kirimanId);
      });
      b.dimintaUlang = kiriman.size;
    });
  });
  return keluar;
}

/* ── ringkasan untuk kartu & dashboard ───────────────────────────────────── */

export interface Ringkasan {
  total: number;
  terbuka: number;
  belumDievaluasi: number;
  urgentTerbuka: number;
  menggantung: number;
  disetujuiBelumSppbj: number;
  prosesPengadaan: number;
  selesai: number;
  ditolak: number;
  nilaiTerbuka: number;
  nilaiPerKlasifikasi: Record<Klasifikasi, number>;
}

export function ringkas(daftar: BarisMonitor[], harga: Record<string, number>): Ringkasan {
  const r: Ringkasan = {
    total: daftar.length, terbuka: 0, belumDievaluasi: 0, urgentTerbuka: 0, menggantung: 0,
    disetujuiBelumSppbj: 0, prosesPengadaan: 0, selesai: 0, ditolak: 0, nilaiTerbuka: 0,
    nilaiPerKlasifikasi: { rutin: 0, biaya: 0, investasi: 0, docking: 0, stok: 0 },
  };
  for (const b of daftar) {
    const buka = b.tahap !== "selesai" && b.tahap !== "ditolak";
    if (buka) r.terbuka++;
    if (b.tahap === "baru") r.belumDievaluasi++;
    if (buka && b.prioritas === "urgent") r.urgentTerbuka++;
    if (b.menggantung) r.menggantung++;
    if (b.tahap === "disetujui") r.disetujuiBelumSppbj++;
    if (b.tahap === "sppbj" || b.tahap === "spbj") r.prosesPengadaan++;
    if (b.tahap === "selesai") r.selesai++;
    if (b.tahap === "ditolak") r.ditolak++;
    if (buka) {
      const n = nilaiBarang(b, harga);
      r.nilaiTerbuka += n;
      r.nilaiPerKlasifikasi[b.klasifikasi] += n;
    }
  }
  return r;
}
