"use client";
/**
 * JURU BACA — pembaca permintaan kapal yang bekerja sendiri.
 *
 * Selama ini isi permintaan baru terbaca kalau ada orang membuka kiriman lalu
 * menekan tombol baca, dan menunggui satu-dua menit per lembar. Padahal
 * berkasnya sudah ada di Drive sejak ABK mengirimnya, dan laptop kantor yang
 * memegang AI lokal itu menyala sepanjang jam kerja.
 *
 * Maka: begitu aplikasi dibuka DARI LAPTOP YANG PUNYA OLLAMA, modul ini
 * mengambil sendiri kiriman yang belum terbaca, membacanya satu per satu di
 * latar belakang, dan menyimpan hasilnya. Perangkat lain — ponsel, atau
 * aplikasi yang dibuka dari Vercel — tinggal menampilkan hasilnya tanpa AI
 * sama sekali.
 *
 * Tiga hal yang dijaga di sini:
 *   · SATU BERKAS SATU KALI. Klaim ditulis ke basis data sebelum dibaca, jadi
 *     dua laptop yang menyala bersamaan tidak mengerjakan berkas yang sama.
 *   · KOREKSI ORANG MENANG. Bacaan yang sudah disunting tak pernah ditimpa.
 *   · SATU ANTREAN, BUKAN SEKALIGUS. AI lokal memakai seluruh inti prosesor;
 *     membaca dua berkas berbarengan membuat keduanya lambat, bukan cepat.
 */
import { KirimanLapor } from "./types";
import { bacaPermintaan } from "./bacaPermintaan";
import {
  BacaanBerkas, BarisBacaan, VERSI_BACAAN, bacaanBaru, denyutSegar, idPerangkat, muatBacaan,
  muatStatusJuruBaca, perluDibaca, simpanBacaan,
} from "./simpananBacaan";
import { BERKAS_DITERIMA, periksaMesin } from "@/lib/surat/bacaTabel";

export interface KeadaanJuruBaca {
  /** saklar pemakai (tersimpan di peramban ini) */
  aktif: boolean;
  /** mesin baca terjangkau dari perangkat ini */
  siap: boolean;
  mesin: string;
  jalur: "server" | "peramban" | "";
  /** berkas yang masih menunggu giliran */
  antre: number;
  sedang: string;
  tahap: string;
  selesai: number;
  gagal: number;
  galat: string;
  /** sedang berputar */
  jalan: boolean;
  /** kapan putaran terakhir selesai */
  terakhir: string;
  /** pembacaan sedang ditangani juru baca sisi server, peramban tinggal diam */
  diServer: boolean;
}

const KUNCI_SAKLAR = "juru_baca_aktif";

/** berkas yang memang bisa dibaca mesin; .docx & kawan-kawan dilewati diam-diam */
const EKSTENSI_BISA = BERKAS_DITERIMA.split(",")
  .filter((x) => x.startsWith("."))
  .map((x) => x.slice(1));

const bisaDibaca = (nama: string) =>
  EKSTENSI_BISA.includes((nama.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || ""));

/** hanya permintaan yang perlu jadi daftar barang; laporan bulanan tidak */
const kirimanPermintaan = (k: KirimanLapor) => k.jenis.startsWith("permintaan");

/**
 * Batas berkas per putaran. Bukan pembatasan cakupan — sisanya dikerjakan di
 * putaran berikutnya — melainkan supaya laptop yang baru dinyalakan tidak
 * langsung tenggelam membaca arsip setahun sebelum kiriman hari ini tersentuh.
 */
const MAKS_PER_PUTARAN = 20;
const JEDA_PUTARAN_MS = 3 * 60_000;

let keadaan: KeadaanJuruBaca = {
  aktif: true, siap: false, mesin: "", jalur: "", antre: 0, sedang: "", tahap: "",
  selesai: 0, gagal: 0, galat: "", jalan: false, terakhir: "", diServer: false,
};
let pendengar: ((k: KeadaanJuruBaca) => void)[] = [];
let jadwal: number | null = null;
let sudahMulai = false;

const kabari = (patch: Partial<KeadaanJuruBaca>) => {
  keadaan = { ...keadaan, ...patch };
  pendengar.forEach((f) => f(keadaan));
};

export const keadaanJuruBaca = () => keadaan;

export function langgananJuruBaca(f: (k: KeadaanJuruBaca) => void): () => void {
  pendengar.push(f);
  f(keadaan);
  return () => { pendengar = pendengar.filter((x) => x !== f); };
}

export function saklarTersimpan(): boolean {
  try { return localStorage.getItem(KUNCI_SAKLAR) !== "0"; } catch { return true; }
}

export function nyalakanJuruBaca(aktif: boolean) {
  try { localStorage.setItem(KUNCI_SAKLAR, aktif ? "1" : "0"); } catch { /* penyimpanan penuh */ }
  kabari({ aktif });
  if (aktif) void putaran();
}

/** dipanggil sekali oleh rangka aplikasi */
export function mulaiJuruBaca() {
  if (sudahMulai) return;
  sudahMulai = true;
  kabari({ aktif: saklarTersimpan() });
  void putaran();
  jadwal = window.setInterval(() => { void putaran(); }, JEDA_PUTARAN_MS);
}

export function hentikanJuruBaca() {
  if (jadwal) window.clearInterval(jadwal);
  jadwal = null; sudahMulai = false;
}

async function ambilKiriman(): Promise<KirimanLapor[]> {
  const r = await fetch("/api/lapor/daftar", { cache: "no-store" });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || "daftar kiriman gagal dimuat");
  return d.baris as KirimanLapor[];
}

interface Tugas {
  fileId: string; nama: string;
  kiriman: { id: string; kapal: string; jenis: string; periode: string };
}

/** berkas permintaan yang belum punya bacaan, terbaru dulu */
export function susunAntrean(kiriman: KirimanLapor[], peta: Map<string, BarisBacaan>, aku: string): Tugas[] {
  const tugas: Tugas[] = [];
  [...kiriman]
    .filter(kirimanPermintaan)
    .sort((a, b) => (b.dikirimPada || "").localeCompare(a.dikirimPada || ""))
    .forEach((k) => {
      k.berkas.forEach((b) => {
        if (!b.fileId || !bisaDibaca(b.nama)) return;
        if (!perluDibaca(peta.get(b.fileId)?.bacaan, aku)) return;
        tugas.push({
          fileId: b.fileId, nama: b.nama,
          kiriman: { id: k.id, kapal: k.kapal, jenis: k.jenis, periode: k.periode },
        });
      });
    });
  return tugas;
}

/**
 * Satu putaran: periksa mesin, susun antrean, kerjakan.
 *
 * Mesinnya diperiksa DULU sebelum apa pun disentuh. Di perangkat tanpa Ollama
 * — ponsel, atau aplikasi yang dibuka dari Vercel — putaran berhenti di sini
 * tanpa memuat apa-apa, jadi tidak ada ongkos yang dibayar percuma.
 */
export async function putaran(): Promise<void> {
  if (keadaan.jalan || !keadaan.aktif) return;
  kabari({ jalan: true, galat: "" });
  try {
    const m = await periksaMesin();
    if (!m.ollama) {
      kabari({
        siap: false, mesin: "", jalur: "", antre: 0,
        galat: m.galat || "AI lokal tak terjangkau dari perangkat ini.",
      });
      return;
    }
    kabari({ siap: true, mesin: m.ollama, jalur: m.jalur, galat: "" });

    /**
     * Kalau juru baca SISI SERVER masih berdenyut, peramban tidak ikut membaca.
     * Keduanya memakai Ollama yang sama di laptop yang sama; dua pembaca
     * berebut satu model hanya membuat keduanya merangkak, dan berkas yang
     * sudah diklaim server toh akan dilewati.
     */
    const denyut = await muatStatusJuruBaca().catch(() => null);
    if (denyutSegar(denyut)) {
      kabari({
        diServer: true, antre: denyut!.antre, sedang: denyut!.sedang,
        tahap: denyut!.tahap || "dikerjakan server lokal",
      });
      return;
    }
    kabari({ diServer: false });

    const aku = idPerangkat();
    const [kiriman, peta] = await Promise.all([ambilKiriman(), muatBacaan()]);
    const antrean = susunAntrean(kiriman, peta, aku).slice(0, MAKS_PER_PUTARAN);
    kabari({ antre: antrean.length });
    if (!antrean.length) return;

    for (const t of antrean) {
      if (!keadaan.aktif) break;
      await kerjakan(t, peta.get(t.fileId) || null, aku);
      kabari({ antre: Math.max(0, keadaan.antre - 1) });
    }
  } catch (e: any) {
    kabari({ galat: e?.message || String(e) });
  } finally {
    kabari({ jalan: false, sedang: "", tahap: "", terakhir: new Date().toISOString() });
  }
}

/**
 * Baca satu berkas dari awal sampai tersimpan.
 *
 * Klaim ditulis lebih dulu — sebelum berkasnya diambil — supaya perangkat lain
 * yang kebetulan berputar di detik yang sama melihat berkas ini sudah ada yang
 * pegang. Kegagalan pun DISIMPAN, lengkap dengan sebabnya: berkas yang tak
 * terbaca harus kelihatan di layar sebagai "gagal", bukan menghilang seolah
 * belum pernah diantre.
 */
async function kerjakan(t: Tugas, ada: BarisBacaan | null, aku: string) {
  const dasar: BacaanBerkas = {
    ...(ada?.bacaan || bacaanBaru(t.fileId, t.nama, t.kiriman, aku)),
    status: "proses", perangkat: aku, waktu: new Date().toISOString(), versi: VERSI_BACAAN,
  };
  let id = ada?.id || null;
  try { id = await simpanBacaan(id, dasar); } catch { /* klaim gagal — tetap dicoba dibaca */ }

  kabari({ sedang: t.nama, tahap: "Mengambil berkas…" });
  try {
    const h = await bacaPermintaan(t.fileId, t.nama, (k) => kabari({ tahap: k.tahap }), { mesin: "ollama" });
    await simpanBacaan(id, {
      ...dasar,
      status: h.baris.length ? "selesai" : "gagal",
      baris: h.baris, mesin: h.mesin, catatan: h.catatan,
      galat: h.baris.length ? "" : "Tidak ada barang yang terbaca dari berkas ini.",
      waktu: new Date().toISOString(),
    });
    kabari(h.baris.length ? { selesai: keadaan.selesai + 1 } : { gagal: keadaan.gagal + 1 });
  } catch (e: any) {
    await simpanBacaan(id, {
      ...dasar, status: "gagal", galat: e?.message || String(e), waktu: new Date().toISOString(),
    }).catch(() => { /* jaringan putus — putaran berikutnya mencoba lagi */ });
    kabari({ gagal: keadaan.gagal + 1 });
  }
}

/** baca satu berkas atas permintaan layar (tombol "baca sekarang") */
export async function bacaSekarang(
  fileId: string, nama: string,
  kiriman: { id: string; kapal: string; jenis: string; periode: string },
): Promise<void> {
  const aku = idPerangkat();
  const peta = await muatBacaan();
  await kerjakan({ fileId, nama, kiriman }, peta.get(fileId) || null, aku);
}
