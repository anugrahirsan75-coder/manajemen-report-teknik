// OCR angka dari gambar pakai tesseract.js (client-side, gratis, offline setelah model ke-cache)
import { createWorker } from "tesseract.js";

// parse teks OCR jadi daftar angka urut (per baris).
// "1.256.418" / "1,256,418" / "113.078" -> 1256418 / 113078
export function parseNumbers(text: string): number[] {
  const out: number[] = [];
  for (const line of text.split(/\r?\n/)) {
    // ambil token yang dominan digit + pemisah ribuan
    const matches = line.match(/[\d][\d.,\s]{2,}/g);
    if (!matches) continue;
    for (const m of matches) {
      const digits = m.replace(/[^\d]/g, "");
      if (digits.length >= 3) {
        out.push(parseInt(digits, 10));
        break; // satu angka per baris (kolom nilai)
      }
    }
  }
  return out;
}

export async function ocrNumbers(file: File, onProgress?: (p: number) => void): Promise<number[]> {
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) onProgress(Math.round(m.progress * 100));
    },
  });
  await worker.setParameters({ tessedit_char_whitelist: "0123456789.,\n " });
  const { data } = await worker.recognize(file);
  await worker.terminate();
  return parseNumbers(data.text);
}
