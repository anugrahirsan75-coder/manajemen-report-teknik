/**
 * Buka folder foto di Windows Explorer pada laptop yang menjalankan aplikasi.
 *
 * Foto tinggal di arsip lokal, jadi tautan biasa tidak bisa dipakai: peramban
 * menolak `file://` dari halaman http. Karena server ini memang berjalan di
 * laptop yang sama, foldernya dibuka dari sisi server.
 *
 * Membuka program dari permintaan web harus dibatasi ketat:
 *  - hanya berjalan di Windows dan bukan di peladen awan;
 *  - jalur wajib berada di dalam akar arsip, diperiksa SESUDAH diresolusi,
 *    supaya "..\..\Windows" tidak bisa lolos;
 *  - dijalankan tanpa shell dan jalurnya dikirim sebagai argumen, bukan
 *    disambung ke dalam baris perintah.
 */
import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { AKAR_ARSIP } from "@/lib/dokumentasi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (process.env.VERCEL || process.platform !== "win32") {
    return NextResponse.json(
      { galat: "Hanya bisa dari aplikasi yang jalan di laptop (Windows)." }, { status: 400 });
  }

  let folder = "";
  try {
    folder = String((await req.json())?.folder || "");
  } catch {
    return NextResponse.json({ galat: "Isi permintaan bukan JSON." }, { status: 400 });
  }
  if (!folder) return NextResponse.json({ galat: "Folder kosong." }, { status: 400 });

  const akar = path.resolve(AKAR_ARSIP);
  const tujuan = path.resolve(akar, folder);
  const di_dalam = tujuan === akar || tujuan.startsWith(akar + path.sep);
  if (!di_dalam) {
    return NextResponse.json({ galat: "Jalur di luar arsip ditolak." }, { status: 403 });
  }

  try {
    const st = await fs.stat(tujuan);
    if (!st.isDirectory()) {
      return NextResponse.json({ galat: "Bukan folder." }, { status: 400 });
    }
  } catch {
    return NextResponse.json(
      { galat: "Folder tidak ada lagi di arsip: " + tujuan }, { status: 404 });
  }

  // explorer.exe mengembalikan kode keluar bukan-nol meski berhasil, jadi
  // hasilnya tidak ditunggu — cukup dilepas dan dianggap terbuka
  spawn("explorer.exe", [tujuan], { detached: true, stdio: "ignore", shell: false }).unref();
  return NextResponse.json({ ok: true, folder: tujuan });
}
