/**
 * JURU BACA SISI SERVER — membaca permintaan kapal tanpa satu pun tab peramban.
 *
 * Sebelumnya pembacaan hanya bisa terjadi di dalam tab yang sedang terbuka di
 * laptop ber-Ollama. Kenyataannya orang kantor membuka aplikasi dari alamat
 * Vercel, dari ponsel, dari komputer lain — dan di sana tak ada AI lokal, jadi
 * berkasnya menganggur tak terbaca meski laptopnya menyala sepanjang hari.
 *
 * Modul ini berjalan DI DALAM server Next yang hidup di laptop itu (port 3001,
 * dijaga watchdog.vbs tiap 5 menit). Ia bicara ke 127.0.0.1:11434 langsung —
 * tidak ada urusan izin asal, tidak ada larangan http dari halaman https, dan
 * tidak perlu ada yang membuka aplikasi sama sekali. Hasilnya masuk Supabase,
 * jadi layar mana pun tinggal menampilkannya.
 *
 * Di Vercel modul ini TIDAK dijadwalkan (lihat instrumentation.ts): server awan
 * jelas tak bisa menjangkau laptop, dan menjadwalkannya di sana hanya membuang
 * waktu jalan setiap beberapa menit.
 */
import { dbServer } from "@/lib/dbServer";
import { extractJson } from "@/lib/sppbj/scanPrompt";
import { promptTabel, rapikanBaris } from "@/lib/surat/bacaSkema";
import { KOLOM_PERMINTAAN, KONTEKS_PERMINTAAN, BarisPermintaan } from "./skemaPermintaan";
import {
  BacaanBerkas, KIND_BACAAN, KIND_STATUS, StatusJuruBaca, VERSI_BACAAN,
  bacaanBaru, bisaDibaca, perluDibaca,
} from "./bacaanTypes";

const HOST = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
const AKU = "server-lokal";

/** batas per putaran — sisanya dikerjakan putaran berikutnya, bukan dibuang */
const MAKS_PER_PUTARAN = 40;
const JEDA_PUTARAN_MS = 4 * 60_000;
const JEDA_AWAL_MS = 25_000;

const VISION_RE = /(vision|llava|minicpm-?v|moondream|bakllava|qwen2\.?5?-?vl|qwen2-vl|gemma3)/i;
const ukuranModel = (nama: string) => Number(/:(\d+(?:\.\d+)?)\s*b/i.exec(nama)?.[1] || 0);

let jalan = false;
let jadwal: NodeJS.Timeout | null = null;
let terakhir: StatusJuruBaca | null = null;

export const statusTerakhir = () => terakhir;

/* ══════════════════════════════════════════════════════════════════════════
   Ollama
   ══════════════════════════════════════════════════════════════════════════ */

async function daftarModel(): Promise<string[]> {
  const r = await fetch(`${HOST}/api/tags`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Ollama menjawab ${r.status}`);
  return ((await r.json()).models || []).map((m: any) => m.name as string);
}

/** model terbesar yang cocok; untuk teks, model biasa didahulukan */
function pilihModel(semua: string[], perluVisi: boolean): string {
  const paksa = perluVisi ? process.env.OLLAMA_VISION_MODEL : process.env.OLLAMA_TEXT_MODEL;
  if (paksa) return paksa;
  const urut = (a: string[]) => a.sort((x, y) => ukuranModel(y) - ukuranModel(x));
  const layak = semua.filter((m) => !/embed/i.test(m));
  const bervisi = urut(layak.filter((m) => VISION_RE.test(m)));
  const biasa = urut(layak.filter((m) => !VISION_RE.test(m)));
  return perluVisi ? bervisi[0] || "" : biasa[0] || bervisi[0] || "";
}

async function keOllama(sumber: { teks?: string; base64?: string }): Promise<BarisPermintaan[]> {
  const perluVisi = !!sumber.base64;
  const model = pilihModel(await daftarModel(), perluVisi);
  if (!model) throw new Error(perluVisi ? "Tak ada model bervisi di Ollama" : "Tak ada model di Ollama");

  const perintah = promptTabel(KOLOM_PERMINTAAN, KONTEKS_PERMINTAAN, perluVisi ? "gambar" : "teks")
    + (sumber.teks ? `\n\nISI BERKAS:\n${sumber.teks.slice(0, 60_000)}` : "");

  const r = await fetch(`${HOST}/api/generate`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model, prompt: perintah, images: sumber.base64 ? [sumber.base64] : undefined,
      stream: false, format: "json", options: { temperature: 0, num_ctx: 16384 },
    }),
    // borang padat pada model 7b bisa memakan beberapa menit; putus di 10 menit
    signal: AbortSignal.timeout(10 * 60_000),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const d = await r.json();
  const json = extractJson(d?.response || "");
  if (!json) throw new Error("Model tak membalas JSON yang bisa dibaca");
  const hasil = rapikanBaris(json, KOLOM_PERMINTAAN);
  return (hasil.baris as unknown as BarisPermintaan[]).filter((b) => (b.nama || "").trim());
}

/* ══════════════════════════════════════════════════════════════════════════
   Berkas
   ══════════════════════════════════════════════════════════════════════════ */

/** ambil isi berkas dari Drive lewat Apps Script — jalur yang sama dengan route /api/lapor/isi */
async function ambilBerkas(fileId: string): Promise<{ bytes: Buffer; mime: string; nama: string }> {
  const gasUrl = process.env.LAPOR_GAS_URL;
  const secret = process.env.LAPOR_GAS_SECRET;
  if (!gasUrl || !secret) throw new Error("LAPOR_GAS_URL / LAPOR_GAS_SECRET belum diset");
  const r = await fetch(gasUrl, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, aksi: "isi", fileId }),
    signal: AbortSignal.timeout(60_000), cache: "no-store",
  });
  const hasil = JSON.parse(await r.text());
  if (!hasil?.ok) throw new Error(hasil?.error || "gagal mengambil berkas dari Drive");
  const bytes = Buffer.from(String(hasil.dataBase64 || ""), "base64");
  if (!bytes.length) throw new Error("berkas kosong di Drive");
  return { bytes, mime: String(hasil.mime || ""), nama: String(hasil.nama || "berkas") };
}

const ekstensi = (nama: string) => (nama.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "");

/** lembar Excel/CSV -> teks bertab, bahan untuk model */
async function teksSpreadsheet(bytes: Buffer, ext: string): Promise<string> {
  if (ext === "csv") return bytes.toString("utf8");
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as any);
  const keluar: string[] = [];
  wb.eachSheet((ws) => {
    const baris: string[] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const sel: string[] = [];
      row.eachCell({ includeEmpty: true }, (c, i) => { sel[i - 1] = selKeTeks(c.value); });
      baris.push(Array.from(sel, (v) => v ?? "").join("\t"));
    });
    keluar.push(baris.join("\n"));
  });
  return keluar.join("\n\n");
}

function selKeTeks(v: any): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v) return String(v.text);
    if ("result" in v) return selKeTeks((v as any).result);
    if ("richText" in v) return (v as any).richText.map((r: any) => r.text).join("");
  }
  return String(v);
}

/**
 * Teks PDF. PDF hasil cetak punya lapisan teks dan bisa dibaca tepat; PDF
 * pindaian tidak, dan merendernya jadi gambar di sisi server butuh pustaka
 * kanvas yang tak terpasang. Untuk yang begitu, berkasnya ditandai supaya
 * dibaca dari peramban di laptop — bukan diam-diam dianggap kosong.
 */
async function teksPdf(bytes: Buffer): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const dok = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const halaman: string[] = [];
  for (let i = 1; i <= dok.numPages; i++) {
    const isi = await (await dok.getPage(i)).getTextContent();
    halaman.push(isi.items.map((it: any) => String(it.str ?? "")).join(" "));
  }
  return halaman.join("\n\n");
}

/**
 * Ambil gambar JPEG yang tertanam di dalam PDF pindaian.
 *
 * Merender halaman PDF jadi gambar butuh pustaka kanvas yang tak terpasang di
 * server. Untungnya tak perlu: pemindai ponsel (CamScanner dan sejenisnya)
 * menyimpan tiap halaman sebagai SATU foto JPEG utuh di dalam PDF-nya, dan foto
 * itu bisa dipotong keluar apa adanya — justru lebih tepat daripada hasil
 * render ulang, karena inilah gambar aslinya.
 *
 * Batas 20 KB menyaring logo dan gambar kecil hiasan; halaman pindaian selalu
 * jauh lebih besar dari itu.
 */
function jpegDalamPdf(bytes: Buffer, maksHal = 6): Buffer[] {
  const keluar: Buffer[] = [];
  let i = 0;
  while (i < bytes.length - 3 && keluar.length < maksHal) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
      let j = i + 3;
      while (j < bytes.length - 1 && !(bytes[j] === 0xff && bytes[j + 1] === 0xd9)) j++;
      if (j >= bytes.length - 1) break;
      const potong = bytes.subarray(i, j + 2);
      if (potong.length > 20_000) keluar.push(potong);
      i = j + 2;
      continue;
    }
    i++;
  }
  return keluar;
}

class PerluPeramban extends Error {}

/** baca satu berkas: ambil dari Drive, ubah jadi bahan, serahkan ke Ollama */
async function bacaBerkas(fileId: string, nama: string): Promise<{ baris: BarisPermintaan[]; mesin: string }> {
  const { bytes, mime, nama: namaAsli } = await ambilBerkas(fileId);
  const ext = ekstensi(namaAsli) || ekstensi(nama);

  if (["xlsx", "xls", "csv"].includes(ext)) {
    return { baris: await keOllama({ teks: await teksSpreadsheet(bytes, ext) }), mesin: "ollama-teks (server)" };
  }

  if (ext === "pdf") {
    const teks = await teksPdf(bytes).catch(() => "");
    if (teks.replace(/\s/g, "").length >= 200) {
      return { baris: await keOllama({ teks }), mesin: "ollama-teks (server)" };
    }
    // pindaian: fotonya dipotong keluar dari PDF, satu per halaman
    const gambar = jpegDalamPdf(bytes);
    if (!gambar.length) {
      throw new PerluPeramban(
        "PDF ini tanpa lapisan teks dan tanpa foto yang bisa dipotong keluar. Buka halaman ini dari laptop "
        + "lewat http://localhost:3001 lalu tekan Baca sekarang — di peramban halamannya bisa dirender jadi gambar.");
    }
    const semua: BarisPermintaan[] = [];
    for (const g of gambar) semua.push(...await keOllama({ base64: g.toString("base64") }));
    return { baris: semua, mesin: `ollama-gambar (server, ${gambar.length} hal PDF)` };
  }

  // gambar: dikirim apa adanya. Foto borang dari ABK sudah dikecilkan aplikasi
  // pengirimnya, jadi tidak perlu diperkecil lagi di sini.
  if (mime && !/^image\//.test(mime) && !["png", "jpg", "jpeg", "webp", "heic", "heif"].includes(ext)) {
    throw new PerluPeramban(`Jenis berkas .${ext || "?"} belum bisa dibaca otomatis.`);
  }
  return { baris: await keOllama({ base64: bytes.toString("base64") }), mesin: "ollama-gambar (server)" };
}

/* ══════════════════════════════════════════════════════════════════════════
   Putaran
   ══════════════════════════════════════════════════════════════════════════ */

interface Tugas {
  fileId: string; nama: string;
  kiriman: { id: string; kapal: string; jenis: string; periode: string };
}

async function simpan(db: any, id: string | null, bacaan: BacaanBerkas): Promise<string> {
  if (id) {
    const { error } = await db.from("projects").update({ payload: bacaan }).eq("id", id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await db.from("projects").insert({
    nama_kapal: bacaan.kapal || "PERMINTAAN KAPAL",
    tahun: Number((bacaan.periode || "").slice(0, 4)) || new Date().getFullYear(),
    payload: bacaan,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** denyut supaya perangkat lain tahu laptop ini sedang bekerja atau tidak */
async function tulisDenyut(db: any, s: Partial<StatusJuruBaca>) {
  terakhir = {
    kind: KIND_STATUS, host: HOST,
    mesin: "", sedang: "", tahap: "", antre: 0, selesai: 0, gagal: 0, jalan: false, galat: "",
    ...(terakhir || {}), ...s,
    // waktu selalu ditulis paling akhir: inilah denyut yang dipakai layar lain
    // untuk menilai laptop ini masih hidup atau tidak
    waktu: new Date().toISOString(),
  } as StatusJuruBaca;
  try {
    const { data } = await db.from("projects").select("id").filter("payload->>kind", "eq", KIND_STATUS).limit(1);
    const id = (data || [])[0]?.id;
    if (id) await db.from("projects").update({ payload: terakhir }).eq("id", id);
    else await db.from("projects").insert({ nama_kapal: "JURU BACA", tahun: new Date().getFullYear(), payload: terakhir });
  } catch { /* denyut gagal ditulis: pembacaan tetap jalan, hanya statusnya tak terlihat */ }
}

export async function putaranServer(): Promise<StatusJuruBaca | null> {
  if (jalan) return terakhir;
  const db = dbServer();
  if (!db) return null;
  jalan = true;
  let detak: NodeJS.Timeout | null = null;
  try {
    let model = "";
    try {
      const semua = await daftarModel();
      // yang ditampilkan model BERVISI: hampir seluruh kiriman ABK berupa foto
      model = pilihModel(semua, true) || pilihModel(semua, false);
    } catch (e: any) {
      await tulisDenyut(db, { jalan: false, mesin: "", galat: e?.message || "Ollama tak terjangkau" });
      return terakhir;
    }
    await tulisDenyut(db, { jalan: true, mesin: model, galat: "" });

    /**
     * Denyut diperbarui tiap menit SELAMA membaca, bukan hanya di antara
     * berkas. Satu foto borang pada model 7b bisa memakan sepuluh menit; tanpa
     * denyut di tengahnya, layar orang lain menyimpulkan laptop ini mati
     * padahal ia justru sedang bekerja keras.
     */
    detak = setInterval(() => { void tulisDenyut(db, {}); }, 60_000);

    // kiriman ABK + bacaan yang sudah ada
    const [{ data: kiriman }, { data: bacaan }] = await Promise.all([
      db.from("projects").select("id,nama_kapal,payload").filter("payload->>kind", "eq", "lapor_kapal"),
      db.from("projects").select("id,payload").filter("payload->>kind", "eq", KIND_BACAAN),
    ]);

    const peta = new Map<string, { id: string; bacaan: BacaanBerkas }>();
    (bacaan || []).forEach((r: any) => {
      const b = r.payload as BacaanBerkas;
      if (!b?.fileId) return;
      const lama = peta.get(b.fileId);
      if (!lama || (b.waktu || "") >= (lama.bacaan.waktu || "")) peta.set(b.fileId, { id: r.id, bacaan: b });
    });

    const antrean: Tugas[] = [];
    (kiriman || [])
      .map((r: any) => ({ id: r.id, ...(r.payload || {}), kapal: r.payload?.kapal || r.nama_kapal || "" }))
      .filter((k: any) => String(k.jenis || "").startsWith("permintaan"))
      .sort((a: any, b: any) => String(b.dikirimPada || "").localeCompare(String(a.dikirimPada || "")))
      .forEach((k: any) => (k.berkas || []).forEach((f: any) => {
        if (!f?.fileId || !bisaDibaca(f.nama || "")) return;
        if (!perluDibaca(peta.get(f.fileId)?.bacaan, AKU)) return;
        antrean.push({
          fileId: f.fileId, nama: f.nama || "berkas",
          kiriman: { id: k.id, kapal: k.kapal, jenis: k.jenis, periode: k.periode || "" },
        });
      }));

    const kerja = antrean.slice(0, MAKS_PER_PUTARAN);
    await tulisDenyut(db, { antre: kerja.length });
    if (!kerja.length) { await tulisDenyut(db, { jalan: false, sedang: "", tahap: "" }); return terakhir; }

    let selesai = 0, gagal = 0;
    for (let i = 0; i < kerja.length; i++) {
      const t = kerja[i];
      const ada = peta.get(t.fileId) || null;
      const dasar: BacaanBerkas = {
        ...(ada?.bacaan || bacaanBaru(t.fileId, t.nama, t.kiriman, AKU)),
        status: "proses", perangkat: AKU, waktu: new Date().toISOString(), versi: VERSI_BACAAN,
      };
      let id = ada?.id || null;
      try { id = await simpan(db, id, dasar); } catch { /* klaim gagal — tetap dicoba */ }
      await tulisDenyut(db, { sedang: t.nama, tahap: `membaca ${i + 1}/${kerja.length}`, antre: kerja.length - i });

      try {
        const h = await bacaBerkas(t.fileId, t.nama);
        await simpan(db, id, {
          ...dasar,
          status: h.baris.length ? "selesai" : "gagal",
          baris: h.baris, mesin: h.mesin, catatan: [],
          galat: h.baris.length ? "" : "Tidak ada barang yang terbaca dari berkas ini.",
          waktu: new Date().toISOString(),
        });
        if (h.baris.length) selesai++; else gagal++;
      } catch (e: any) {
        gagal++;
        await simpan(db, id, {
          ...dasar, status: "gagal", galat: e?.message || String(e), waktu: new Date().toISOString(),
        }).catch(() => { /* putaran berikutnya mencoba lagi */ });
      }
      await tulisDenyut(db, { selesai, gagal });
    }

    await tulisDenyut(db, { jalan: false, sedang: "", tahap: "", antre: Math.max(0, antrean.length - kerja.length) });
    return terakhir;
  } catch (e: any) {
    await tulisDenyut(db, { jalan: false, galat: e?.message || String(e) });
    return terakhir;
  } finally {
    if (detak) clearInterval(detak);
    jalan = false;
  }
}

/**
 * Jadwal tetap. Dipanggil sekali dari instrumentation.ts saat server lokal
 * hidup — dan server itu sendiri dijaga watchdog.vbs, jadi pembacaan berjalan
 * sepanjang laptop menyala tanpa ada yang perlu menekan apa pun.
 */
export function jadwalkanJuruBaca() {
  if (jadwal) return;
  setTimeout(() => { void putaranServer(); }, JEDA_AWAL_MS);
  jadwal = setInterval(() => { void putaranServer(); }, JEDA_PUTARAN_MS);
}
