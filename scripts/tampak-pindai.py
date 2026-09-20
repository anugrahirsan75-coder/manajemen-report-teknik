# -*- coding: utf-8 -*-
"""Ubah PDF tajam menjadi PDF yang tampak seperti hasil pindaian.

Dipakai dokumen yang sudah bertanda tangan dan berstempel, ketika penerima
terbiasa menerima lembar hasil scan. Yang dikerjakan murni tampilan: tiap
halaman digambar ulang sebagai citra, diberi warna kertas, sedikit bintik
sensor, dan kemiringan yang sangat kecil seperti lembar yang tidak persis
lurus di atas kaca pemindai.

Yang TIDAK dikerjakan: lipatan palsu, noda, atau bekas jepretan — hal-hal yang
gunanya hanya membuat orang percaya ada lembar kertas yang sebenarnya tidak
pernah ada. Dokumennya memang ditandatangani; tampilannya boleh menyerupai
pindaian, riwayatnya tidak perlu dikarang.

Harganya nyata dan disebutkan ke pemakai di layar: teks berubah jadi gambar,
jadi tidak bisa dicari lagi dan ukuran berkasnya membengkak.
"""
import argparse
import io
import random
import sys

import fitz
from PIL import Image, ImageEnhance, ImageFilter


def sekitar(nilai: float, sebar: float) -> float:
    return nilai + random.uniform(-sebar, sebar)


def olah_halaman(pix: "fitz.Pixmap", acak: random.Random) -> Image.Image:
    im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

    # Warna kertas: pindaian tidak pernah putih murni. Dikerjakan sebagai
    # perkalian supaya tinta tetap pekat dan hanya latarnya yang menghangat.
    kertas = Image.new("RGB", im.size, (252, 251, 246))
    im = Image.blend(im, Image.composite(kertas, im, im.convert("L").point(lambda p: 255 if p > 200 else 0)), 0.85)

    # Kemiringan kecil — lembar yang diletakkan tangan tak pernah lurus benar.
    sudut = sekitar(0, 0.35)
    im = im.rotate(sudut, resample=Image.BICUBIC, expand=False, fillcolor=(252, 251, 246))

    # Bintik sensor: halus, tidak sampai mengotori tulisan.
    bintik = Image.effect_noise(im.size, 14).convert("L")
    im = Image.blend(im, Image.merge("RGB", (bintik, bintik, bintik)), 0.045)

    im = im.filter(ImageFilter.GaussianBlur(0.35))
    im = ImageEnhance.Contrast(im).enhance(1.06)
    im = ImageEnhance.Brightness(im).enhance(0.995)
    return im


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="masuk", required=True)
    p.add_argument("--out", dest="keluar", required=True)
    p.add_argument("--dpi", type=int, default=200)
    p.add_argument("--mutu", type=int, default=82, help="mutu JPEG halaman")
    a = p.parse_args()

    acak = random.Random(20260920)
    sumber = fitz.open(a.masuk)
    hasil = fitz.open()
    for halaman in sumber:
        pix = halaman.get_pixmap(dpi=a.dpi, colorspace=fitz.csRGB)
        im = olah_halaman(pix, acak)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=a.mutu, optimize=True)
        # ukuran halaman dipertahankan dalam titik, jadi hasil cetaknya tetap A4
        baru = hasil.new_page(width=halaman.rect.width, height=halaman.rect.height)
        baru.insert_image(baru.rect, stream=buf.getvalue())
    hasil.save(a.keluar, deflate=True)
    hasil.close()
    sumber.close()
    print("halaman: %d" % len(fitz.open(a.keluar)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
