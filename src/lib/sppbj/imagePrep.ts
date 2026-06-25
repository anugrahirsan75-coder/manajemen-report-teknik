"use client";
// Pra-proses gambar utk OCR: upscale + grayscale + binarize (Otsu).
// Screenshot tabel jadi hitam-putih tajam -> akurasi tesseract naik signifikan.
export async function preprocessImage(file: Blob): Promise<Blob> {
  const img = await createImageBitmap(file);
  // skala biar lebar ~1.6x (cap 2200px) supaya huruf cukup besar tapi tak berat
  const targetW = Math.min(2200, Math.max(img.width, Math.round(img.width * 1.6)));
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
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }
  // ambang Otsu
  const total = w * h;
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, maxVar = -1, thr = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > maxVar) { maxVar = v; thr = i; }
  }
  // binarize (sedikit bias supaya teks tipis tetap kebaca)
  const t = thr + 6;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] > t ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(id, 0, 0);
  return await new Promise<Blob>((res) => c.toBlob((b) => res(b || file), "image/png"));
}
