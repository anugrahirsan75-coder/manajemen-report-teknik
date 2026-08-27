"use client";
/**
 * Pengunggah berkas kiriman kapal — dipakai borang permintaan digital.
 *
 * Protokolnya sama persis dengan yang dipakai halaman /lapor (potongan base64
 * ke /api/lapor/berkas, id unggahan tetap, tanya-dulu-sampai-mana sebelum
 * mengirim), karena jalur itulah yang sudah terbukti bertahan pada jaringan
 * kapal yang putus-nyambung. Yang berbeda hanya bentuk pemanggilannya: di sini
 * ia berdiri sendiri sebagai fungsi, bukan menempel pada satu halaman.
 */
import { kenaliBerkas, PESAN_JENIS_DITOLAK } from "@/lib/lapor/berkasJenis";

/** 2,25 MB: habis dibagi 3, jadi potongan base64-nya bisa disambung tanpa sisa */
const BYTE_PER_POTONGAN = 2_250_000;
const MAKS_COBA = 5;
const JEDA_COBA = [2000, 5000, 12000, 25000];
const TENGGANG_MS = 90_000;

export interface Kiriman { id: string; token: string }
export interface Kemajuan { berkas: string; urut: number; dari: number; potongan: number; total: number; percobaan: number }

const tunggu = (ms: number) => new Promise((s) => setTimeout(s, ms));

const keB64 = (blob: Blob) => new Promise<string>((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result).split(",")[1] || "");
  fr.onerror = () => rej(new Error("Berkas tidak terbaca dari perangkat. Coba pilih ulang berkasnya."));
  fr.readAsDataURL(blob);
});

export const pesanRamah = (e: unknown) => {
  const pesan = e instanceof Error ? e.message : String(e || "");
  if (/abort|timeout|tenggang/i.test(pesan)) return "Jaringan terlalu lambat. Cari sinyal lebih baik lalu coba lagi.";
  if (/load failed|failed to fetch|networkerror|network request failed/i.test(pesan)) {
    return "Koneksi terputus saat mengunggah. Pastikan sinyal aktif lalu coba lagi.";
  }
  return pesan || "Unggahan gagal";
};

/** sidik jari pendek yang tetap sama untuk teks yang sama (FNV-1a) */
const sidik = (s: string) => {
  let a = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 0x01000193) >>> 0; }
  return a.toString(36);
};

/**
 * Id unggahan TETAP: berkas yang sama pada kiriman yang sama selalu memakai id
 * yang sama. Inilah yang membuat percobaan ulang MELANJUTKAN, bukan menaruh
 * salinan kedua di Drive.
 */
const idUnggah = (kiriman: Kiriman, f: File, ukuran: number) => {
  const k = `${kiriman.id}|${f.name}|${f.size}|${f.lastModified}|${ukuran}`;
  return `u${sidik(k)}${sidik(k.split("").reverse().join(""))}`;
};

async function mintaJson(alamat: string, isi: unknown) {
  const ac = new AbortController();
  const jam = setTimeout(() => ac.abort(), TENGGANG_MS);
  try {
    const r = await fetch(alamat, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isi), signal: ac.signal,
    });
    const teks = await r.text();
    let d: any;
    try { d = JSON.parse(teks); }
    catch {
      const er: Error & { retryable?: boolean } = new Error(`Server menjawab tidak wajar (${r.status})`);
      er.retryable = r.status >= 500;
      throw er;
    }
    if (!r.ok || !d.ok) {
      const er: Error & { retryable?: boolean } = new Error(d.error || `Gagal (${r.status})`);
      er.retryable = Boolean(d.retryable) || [408, 429, 500, 502, 503, 504].includes(r.status);
      throw er;
    }
    return d;
  } finally { clearTimeout(jam); }
}

/** foto dikecilkan dulu supaya hemat kuota ABK; kalau gagal, aslinya yang dikirim */
async function siapkan(file: File) {
  const jenis = kenaliBerkas(file.name, file.type);
  if (!jenis) throw new Error(PESAN_JENIS_DITOLAK);
  if (jenis.gambar && typeof createImageBitmap === "function") {
    let img: ImageBitmap | null = null;
    try {
      img = await createImageBitmap(file, { imageOrientation: "from-image" });
      const skala = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * skala));
      c.height = Math.max(1, Math.round(img.height * skala));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((r) => c.toBlob((b) => r(b), "image/jpeg", 0.78));
      if (blob && blob.size > 0) {
        return { nama: file.name.replace(/\.[^.]+$/, "") + ".jpg", mime: "image/jpeg", blob: blob as Blob };
      }
    } catch { /* kirim aslinya */ }
    finally { img?.close?.(); }
  }
  return { nama: file.name, mime: jenis.mime, blob: file as Blob };
}

/** potongan mana yang sudah sampai — supaya berkas besar tak naik dua kali */
async function sampaiMana(kiriman: Kiriman, unggahId: string) {
  try {
    const r = await fetch(`/api/lapor/berkas?id=${encodeURIComponent(kiriman.id)}`
      + `&token=${encodeURIComponent(kiriman.token)}&unggahId=${encodeURIComponent(unggahId)}`, { cache: "no-store" });
    const d = await r.json();
    if (!d.ok) return { sudah: new Set<number>(), selesai: false };
    if (d.selesai) return { sudah: new Set<number>(), selesai: true };
    return { sudah: new Set<number>((d.potongan || []) as number[]), selesai: false };
  } catch { return { sudah: new Set<number>(), selesai: false }; }
}

export async function unggahSatuBerkas(
  kiriman: Kiriman, f: File, urut: number, dari: number, lapor: (k: Kemajuan) => void,
) {
  const s = await siapkan(f);
  if (s.blob.size === 0) throw new Error("Berkas kosong (0 byte). Pilih ulang berkasnya.");
  const total = Math.max(1, Math.ceil(s.blob.size / BYTE_PER_POTONGAN));
  const unggahId = idUnggah(kiriman, f, s.blob.size);

  const awal = await sampaiMana(kiriman, unggahId);
  if (awal.selesai) return;

  for (let k = 0; k < total; k++) {
    // potongan terakhir selalu dikirim: itulah yang memicu penyatuan di Drive
    if (awal.sudah.has(k) && k < total - 1) continue;
    const mulai = k * BYTE_PER_POTONGAN;
    const dataBase64 = await keB64(s.blob.slice(mulai, Math.min(mulai + BYTE_PER_POTONGAN, s.blob.size)));

    let beres = false;
    let galat: unknown;
    for (let coba = 1; coba <= MAKS_COBA; coba++) {
      lapor({ berkas: s.nama, urut, dari, potongan: k + 1, total, percobaan: coba });
      try {
        const d = await mintaJson("/api/lapor/berkas", {
          id: kiriman.id, token: kiriman.token, nama: s.nama, mime: s.mime,
          unggahId, indeks: k, total, dataBase64,
        });
        beres = true;
        if (d.selesai === true) {
          const tercatat = Number(d.berkas?.ukuran) || 0;
          // berkas yang sampai TIDAK UTUH lebih berbahaya daripada yang gagal:
          // yang gagal kelihatan, yang tak utuh tercatat hijau
          if (tercatat && Math.abs(tercatat - s.blob.size) > 1024) {
            throw new Error("Berkas sampai tidak utuh di Drive. Coba kirim ulang.");
          }
          return;
        }
        break;
      } catch (e) {
        galat = e;
        const bolehUlang = e instanceof TypeError || (e as any)?.name === "AbortError"
          || Boolean((e as Error & { retryable?: boolean })?.retryable);
        if (!bolehUlang) break;
        if (coba < MAKS_COBA) await tunggu(JEDA_COBA[Math.min(coba - 1, JEDA_COBA.length - 1)]);
      }
    }
    if (!beres) throw new Error(pesanRamah(galat));
    if (k === total - 1) throw new Error("Google Drive belum menyelesaikan berkas. Tekan coba lagi.");
  }
}

/** berapa berkas yang BENAR-BENAR tercatat di kantor — bukti dari sisi sana */
export async function jumlahTercatat(kiriman: Kiriman): Promise<number | null> {
  try {
    const r = await fetch(`/api/lapor/berkas?id=${encodeURIComponent(kiriman.id)}&token=${encodeURIComponent(kiriman.token)}`,
      { cache: "no-store" });
    const d = await r.json();
    return d?.ok ? Number(d.jumlah) || 0 : null;
  } catch { return null; }
}
