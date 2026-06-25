"use client";
// Pra-proses gambar utk OCR tesseract: upscale + grayscale + contrast-stretch.
// (Binarize keras dibuang — merusak teks tipis pada screenshot tabel.)
export async function preprocessImage(file: Blob): Promise<Blob> {
  const img = await createImageBitmap(file);
  const targetW = Math.min(2600, Math.max(img.width, Math.round(img.width * 2)));
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
  // grayscale + histogram
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }
  // contrast-stretch pakai persentil 2%..98% (buang outlier)
  const total = w * h;
  let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= total * 0.02) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= total * 0.02) { hi = i; break; } }
  const range = Math.max(1, hi - lo);
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) lut[i] = Math.max(0, Math.min(255, Math.round(((i - lo) / range) * 255)));
  for (let i = 0; i < d.length; i += 4) { const v = lut[d[i]]; d[i] = d[i + 1] = d[i + 2] = v; }
  ctx.putImageData(id, 0, 0);
  return await new Promise<Blob>((res) => c.toBlob((b) => res(b || file), "image/png"));
}
