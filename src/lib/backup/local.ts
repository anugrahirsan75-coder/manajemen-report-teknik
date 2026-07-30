"use client";
/**
 * Backup lokal otomatis ke folder di laptop.
 *
 * Cara kerja: user memilih SATU folder sekali (File System Access API, Chrome/Edge).
 * Handle folder disimpan di IndexedDB, jadi izinnya bertahan antar sesi.
 * Setiap kali data disimpan ke Supabase, salinan JSON-nya ikut ditulis ke folder itu.
 *
 * Sifatnya "jaring pengaman": kalau folder belum dipilih / izin dicabut / browser tak
 * mendukung, fungsi diam-diam tidak melakukan apa-apa dan TIDAK boleh menggagalkan simpan.
 */

const DB_NAME = "mrt-backup";
const STORE = "handle";
const KEY = "folder";
export const LS_TERAKHIR = "backup_terakhir"; // ISO waktu backup terakhir berhasil

export const didukung = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

function bukaDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => { if (!rq.result.objectStoreNames.contains(STORE)) rq.result.createObjectStore(STORE); };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
async function simpanHandle(h: any) {
  const db = await bukaDb();
  await new Promise((res, rej) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(h, KEY); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
async function bacaHandle(): Promise<any | null> {
  try {
    const db = await bukaDb();
    return await new Promise((res, rej) => { const tx = db.transaction(STORE, "readonly"); const rq = tx.objectStore(STORE).get(KEY); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error); });
  } catch { return null; }
}
export async function lupakanFolder() {
  try { const db = await bukaDb(); await new Promise((res) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(KEY); tx.oncomplete = res; }); } catch {}
}

/** Minta user memilih folder backup (harus dipanggil dari klik). */
export async function pilihFolder(): Promise<{ ok: boolean; nama?: string; pesan?: string }> {
  if (!didukung()) return { ok: false, pesan: "Browser ini belum mendukung folder backup otomatis. Pakai Chrome/Edge di laptop, atau pakai tombol Unduh 1 File." };
  try {
    const h = await (window as any).showDirectoryPicker({ id: "mrt-backup", mode: "readwrite", startIn: "documents" });
    const izin = await h.requestPermission({ mode: "readwrite" });
    if (izin !== "granted") return { ok: false, pesan: "Izin menulis ke folder ditolak." };
    await simpanHandle(h);
    return { ok: true, nama: h.name };
  } catch (e: any) {
    if (e?.name === "AbortError") return { ok: false, pesan: "Dibatalkan." };
    return { ok: false, pesan: e?.message || String(e) };
  }
}

/** Handle folder yang siap tulis. minta=true -> boleh memunculkan prompt izin (butuh gesture). */
export async function folderSiap(minta = false): Promise<any | null> {
  const h = await bacaHandle();
  if (!h) return null;
  try {
    let st = await h.queryPermission({ mode: "readwrite" });
    if (st === "prompt" && minta) st = await h.requestPermission({ mode: "readwrite" });
    return st === "granted" ? h : null;
  } catch { return null; }
}

export async function namaFolder(): Promise<string | null> {
  const h = await bacaHandle();
  return h?.name || null;
}

async function subFolder(root: any, nama: string) {
  return root.getDirectoryHandle(nama, { create: true });
}
async function tulisFile(dir: any, nama: string, isi: string) {
  const fh = await dir.getFileHandle(nama, { create: true });
  const w = await fh.createWritable();
  await w.write(isi);
  await w.close();
}
// nama file aman utk Windows
const aman = (s: string) => (s || "tanpa-nama").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);

const stempel = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;

/**
 * Catat 1 record hasil simpan. Dipanggil setelah simpan ke Supabase berhasil.
 * Tidak pernah melempar error — backup gagal tak boleh mengganggu pekerjaan.
 */
export async function catatBackup(kind: string, id: string | undefined, payload: any, judul?: string) {
  try {
    const root = await folderSiap(false);
    if (!root) return;
    const dir = await subFolder(await subFolder(root, "data"), kind);
    const nama = `${aman(judul || kind)}__${(id || "draft").slice(0, 8)}.json`;
    await tulisFile(dir, nama, JSON.stringify({ kind, id, judul, disimpan: new Date().toISOString(), payload }, null, 2));
    localStorage.setItem(LS_TERAKHIR, new Date().toISOString());
  } catch { /* diamkan */ }
}

/**
 * Backup penuh: seluruh isi tabel projects -> 1 file snapshot + 1 file per record.
 * rows = hasil select dari Supabase.
 */
export async function backupPenuh(rows: any[]): Promise<{ ok: boolean; jumlah: number; berkas?: string; pesan?: string }> {
  const root = await folderSiap(true);
  if (!root) return { ok: false, jumlah: 0, pesan: "Folder backup belum dipilih / izin belum diberikan." };
  try {
    const snapDir = await subFolder(root, "snapshot");
    const berkas = `projects_${stempel()}.json`;
    await tulisFile(snapDir, berkas, JSON.stringify({ diambil: new Date().toISOString(), jumlah: rows.length, rows }, null, 2));
    await tulisFile(root, "TERBARU.json", JSON.stringify({ diambil: new Date().toISOString(), jumlah: rows.length, rows }, null, 2));

    // per record supaya gampang dicari manual
    const dataDir = await subFolder(root, "data");
    for (const r of rows) {
      const kind = r.payload?.kind || "swakelola";
      const dir = await subFolder(dataDir, kind);
      await tulisFile(dir, `${aman(r.nama_kapal || kind)}__${String(r.id).slice(0, 8)}.json`,
        JSON.stringify({ kind, id: r.id, judul: r.nama_kapal, disimpan: r.created_at, payload: r.payload }, null, 2));
    }
    await tulisFile(root, "BACA-SAYA.txt",
      [
        "BACKUP MANAJEMEN REPORT TEKNIK ASDP TERNATE",
        "",
        "TERBARU.json      : salinan seluruh database saat backup terakhir",
        "snapshot/         : arsip bertanggal (jangan dihapus semua — ini riwayat)",
        "data/<jenis>/     : 1 file per pengadaan/dokumen, ikut ter-update tiap kali disimpan",
        "",
        "Cara memulihkan: buka menu Backup di aplikasi -> Pulihkan dari file,",
        "atau jalankan scripts/restore-supabase.cjs dari folder aplikasi.",
        `Backup terakhir: ${new Date().toLocaleString("id-ID")}`,
      ].join("\n"));
    localStorage.setItem(LS_TERAKHIR, new Date().toISOString());
    return { ok: true, jumlah: rows.length, berkas };
  } catch (e: any) {
    return { ok: false, jumlah: 0, pesan: e?.message || String(e) };
  }
}

/**
 * Backup KODINGAN: salin source.zip (dibundel saat build oleh
 * scripts/bundle-source.cjs) ke folder backup — jadi folder backup memuat
 * DATA sekaligus SELURUH KODE untuk membangun ulang aplikasi.
 */
export async function backupKodingan(): Promise<{ ok: boolean; berkas?: string; info?: any; pesan?: string }> {
  const root = await folderSiap(true);
  if (!root) return { ok: false, pesan: "Folder backup belum dipilih / izin belum diberikan." };
  try {
    const [rZip, rMan] = await Promise.all([fetch("/backup/source.zip"), fetch("/backup/source-manifest.json")]);
    if (!rZip.ok) return { ok: false, pesan: `source.zip tidak ditemukan (${rZip.status}) — build belum menyertakan bundel kodingan.` };
    const blob = await rZip.blob();
    const info = rMan.ok ? await rMan.json() : null;

    const dir = await subFolder(root, "kodingan");
    const berkas = `source_${stempel()}.zip`;
    const fh = await dir.getFileHandle(berkas, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    // salinan "terbaru" bernama tetap + manifes, biar gampang ditemukan
    const fh2 = await dir.getFileHandle("source_TERBARU.zip", { create: true });
    const w2 = await fh2.createWritable();
    await w2.write(blob);
    await w2.close();
    if (info) await tulisFile(dir, "MANIFEST.json", JSON.stringify(info, null, 2));
    await tulisFile(dir, "BACA-SAYA.txt", [
      "BACKUP KODINGAN — Manajemen Report Teknik ASDP Ternate",
      "",
      "source_TERBARU.zip : seluruh kode aplikasi (src, docs, scripts, konfigurasi)",
      "source_<tanggal>.zip : arsip bertanggal",
      "",
      "Cara membangun ulang aplikasi dari nol:",
      "  1. Ekstrak source_TERBARU.zip ke folder kosong",
      "  2. npm install",
      "  3. Buat .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,",
      "     AUTH_TOKEN, APP_USERS (rahasia sengaja TIDAK ikut di ZIP)",
      "  4. npm run dev   (atau: npm run build && npm start)",
      "",
      "Arsitektur, logika bisnis & keamanan dijelaskan di docs/ARSITEKTUR.md di dalam ZIP.",
      info ? `Commit: ${info.commit} · dibundel ${info.dibuat} · ${info.jumlahBerkas} berkas` : "",
    ].join("\n"));
    localStorage.setItem(LS_TERAKHIR, new Date().toISOString());
    return { ok: true, berkas, info };
  } catch (e: any) {
    return { ok: false, pesan: e?.message || String(e) };
  }
}

/** Fallback tanpa folder: unduh ZIP kodingan langsung. */
export async function unduhKodingan(): Promise<{ ok: boolean; pesan?: string }> {
  try {
    const r = await fetch("/backup/source.zip");
    if (!r.ok) return { ok: false, pesan: `source.zip tidak ditemukan (${r.status}).` };
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `source-mrt_${stempel()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (e: any) { return { ok: false, pesan: e?.message || String(e) }; }
}

/** Fallback untuk browser tanpa File System Access API: unduh 1 file JSON. */
export function unduhSatuFile(rows: any[]) {
  const isi = JSON.stringify({ diambil: new Date().toISOString(), jumlah: rows.length, rows }, null, 2);
  const url = URL.createObjectURL(new Blob([isi], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-mrt_${stempel()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem(LS_TERAKHIR, new Date().toISOString());
}
