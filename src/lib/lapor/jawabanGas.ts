/**
 * Membaca jawaban Apps Script, dan menjelaskan kalau jawabannya bukan JSON.
 *
 * Pesan lama selalu berbunyi "perbarui skripnya ke versi 5", padahal itu baru
 * salah satu sebab. Yang juga sering terjadi: LAPOR_GAS_URL di lingkungan yang
 * sedang berjalan menunjuk deployment LAMA (URL /exec berbeda dari yang dipakai
 * di komputer kantor), atau deployment-nya tidak berakses "Anyone" sehingga
 * Google membalas halaman masuk berupa HTML. Ketiganya tampak sama dari luar —
 * "bukan JSON" — dan menyuruh orang memperbarui skrip yang sebenarnya sudah
 * versi terbaru membuat pencarian sebabnya berputar-putar.
 *
 * Karena itu, saat penguraian gagal, URL yang sama ditanya sekali lagi dengan
 * GET: skrip yang sehat menjawab {ok:true, versi:N} di situ. Versi yang
 * terbaca itulah yang membedakan "skripnya lama" dari "skripnya baru tetapi
 * jawaban POST-nya rusak", dan jawaban HTML membedakan keduanya dari "URL/akses
 * deployment-nya salah".
 */

/** potongan jawaban untuk ditempel di pesan galat — dirapikan dan dipendekkan */
const cuplik = (teks: string, panjang = 140) =>
  teks.replace(/\s+/g, " ").trim().slice(0, panjang);

export interface JawabanGas<T = any> {
  ok: boolean;
  data?: T;
  /** pesan siap tampil bila jawabannya tidak bisa diurai */
  error?: string;
}

/** versi skrip yang terbaca dari jawaban GET /exec; 0 bila tak terbaca */
export async function versiSkrip(gasUrl: string): Promise<{ versi: number; html: boolean }> {
  try {
    const r = await fetch(gasUrl, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const t = await r.text();
    const html = /^\s*<(!doctype|html)/i.test(t);
    if (html) return { versi: 0, html: true };
    const d = JSON.parse(t);
    return { versi: Number(d?.versi) || 0, html: false };
  } catch {
    return { versi: 0, html: false };
  }
}

/**
 * Uraikan jawaban Apps Script menjadi JSON, atau kembalikan pesan yang
 * menyebutkan sebabnya.
 *
 * @param minimal versi skrip yang dibutuhkan route pemanggil
 */
export async function uraiJawabanGas<T = any>(
  gasUrl: string, res: Response, minimal: number,
): Promise<JawabanGas<T>> {
  const teks = await res.text();
  try {
    return { ok: true, data: JSON.parse(teks) as T };
  } catch {
    /* jawaban bukan JSON — cari tahu kenapa sebelum menyalahkan versi skrip */
  }

  const { versi, html } = await versiSkrip(gasUrl);

  if (html) {
    return {
      ok: false,
      error: "URL Apps Script menjawab halaman HTML, bukan data. Deployment-nya perlu disetel "
        + "Execute as: Me dan Who has access: Anyone, lalu Deploy → Versi baru.",
    };
  }
  if (versi === 0) {
    return {
      ok: false,
      error: `Apps Script tidak menjawab JSON (HTTP ${res.status}). Periksa LAPOR_GAS_URL pada `
        + `lingkungan ini — biasanya URL /exec masih menunjuk deployment lama. `
        + `Jawaban: “${cuplik(teks)}”`,
    };
  }
  if (versi < minimal) {
    return {
      ok: false,
      error: `Apps Script di URL ini versi ${versi}, dibutuhkan versi ${minimal}. `
        + "Perbarui isinya dari docs/lapor-apps-script.gs, lalu Deploy → Kelola deployment → Versi baru.",
    };
  }
  return {
    ok: false,
    error: `Apps Script versi ${versi} menjawab bukan JSON (HTTP ${res.status}). `
      + `Jawaban: “${cuplik(teks)}”`,
  };
}
