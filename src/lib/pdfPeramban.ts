"use client";
/**
 * Memuat pdf.js di peramban.
 *
 * Paketnya TIDAK boleh diimpor lewat namanya. pdfjs-dist 5 hanya menyediakan
 * berkas .mjs, dan begitu webpack membungkusnya, memuatnya gagal seketika:
 *
 *   TypeError: Object.defineProperty called on non-object
 *     at __webpack_require__.r (…)
 *     at eval (node_modules/pdfjs-dist/build/pdf.mjs:1)
 *
 * Jadi pustakanya disalin ke /public saat pemasangan (scripts/salin-pdf-worker.cjs)
 * lalu dimuat sebagai modul ES asli oleh peramban — webpackIgnore membuat
 * webpack membiarkan import ini apa adanya. Sekalian tetap sejalan dengan alasan
 * lama menyalin worker-nya: dokumen kapal tak boleh menyentuh internet.
 */
let pustaka: Promise<any> | null = null;

export function pdfjsPeramban(): Promise<any> {
  if (!pustaka) {
    pustaka = import(/* webpackIgnore: true */ "/pdf.min.mjs" as any).then((m: any) => {
      const lib = m.default?.getDocument ? m.default : m;
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return lib;
    });
  }
  return pustaka;
}

/** PDF -> dokumen pdf.js yang siap dibaca */
export async function bukaPdf(sumber: Blob | ArrayBuffer): Promise<any> {
  const pdfjs = await pdfjsPeramban();
  const data = sumber instanceof Blob ? await sumber.arrayBuffer() : sumber;
  return pdfjs.getDocument({ data }).promise;
}
