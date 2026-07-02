"use client";
// Pra-proses gambar utk OCR tesseract:
// upscale adaptif (gambar kecil dibesarkan lebih agresif) + grayscale +
// contrast-stretch (persentil 2-98) + unsharp mask (menajamkan gambar buram).
export async function preprocessImage(file: Blob): Promise<Blob> {
  const img = await createImageBitmap(file);
  // gambar kecil (<1000px) di-upscale 3x, sedang 2x — cap 3000px
  const factor = img.width < 1000 ? 3 : 2;
  const targetW = Math.min(3000, Math.max(img.width, Math.round(img.width * factor)));
  const scale = targetW / img.width;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  (ctx as any).imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const n = w * h;

  // grayscale + histogram
  const gray = new Float32Array(n);
  const hist = new Array(256).fill(0);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    gray[p] = g;
    hist[g | 0]++;
  }

  // contrast-stretch persentil 2..98
  let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n * 0.02) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= n * 0.02) { hi = i; break; } }
  const range = Math.max(1, hi - lo);
  for (let p = 0; p < n; p++) gray[p] = Math.max(0, Math.min(255, ((gray[p] - lo) / range) * 255));

  // unsharp mask: blur box separable radius 2 -> sharpened = g + amt*(g - blur)
  const blur = boxBlur(gray, w, h, 2);
  const AMT = 0.9;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const v = Math.max(0, Math.min(255, gray[p] + AMT * (gray[p] - blur[p])));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(id, 0, 0);
  return await new Promise<Blob>((res) => c.toBlob((b) => res(b || file), "image/png"));
}

// box blur separable (2 pass) — cepat, cukup utk unsharp mask
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const div = r * 2 + 1;
  // horizontal
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[row + Math.max(0, Math.min(w - 1, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / div;
      const xAdd = Math.min(w - 1, x + r + 1);
      const xSub = Math.max(0, x - r);
      sum += src[row + xAdd] - src[row + xSub];
    }
  }
  // vertical
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.max(0, Math.min(h - 1, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / div;
      const yAdd = Math.min(h - 1, y + r + 1);
      const ySub = Math.max(0, y - r);
      sum += tmp[yAdd * w + x] - tmp[ySub * w + x];
    }
  }
  return out;
}
