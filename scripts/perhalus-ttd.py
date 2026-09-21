"""
Perhalus gambar tanda tangan dan stempel.

Berkas aslinya pernah dikecilkan ke 190-220 piksel supaya muat pada batas 64 KB
Environment Variables Vercel. Batas itu sudah tidak berlaku sejak gambarnya
disimpan tersandi di basis data, tetapi berkas kecilnya terlanjur dipakai — dan
pada dokumen A4 ia tercetak sekitar 120 dpi, jadi garis tangannya bergerigi.

Yang dikerjakan di sini BUKAN menambah detail; detail yang sudah hilang tidak
bisa dikembalikan. Yang dihilangkan adalah TANGGA PIKSELNYA:

  1. Diperbesar dengan Lanczos — tangga tajam berubah jadi gradasi.
  2. Alfanya dihaluskan lalu dipertegas lagi dengan kurva smoothstep. Blur saja
     membuat garisnya pucat dan berkabut; kurva itu mengembalikan tepi yang
     tegas tanpa mengembalikan geriginya.
  3. Untuk tanda tangan (satu warna tinta), RGB-nya disamakan ke satu warna
     tinta. Piksel tepi hasil pindaian berwarna abu kebiruan acak; kalau
     dibiarkan, setelah diperbesar ia tampak sebagai bintik kotor di sekitar
     garis.
  4. Stempel dibiarkan berwarna — lingkaran birunya dan logo di tengahnya
     memang beda warna — hanya warnanya ikut dihaluskan mengikuti alfa.

Pakai:  python scripts/perhalus-ttd.py [--faktor 3] [--periksa]
Asli disalin ke data/ttd/asli/ sebelum ditimpa.
"""
import argparse
import shutil
from pathlib import Path

from PIL import Image, ImageFilter

AKAR = Path(__file__).resolve().parent.parent
FOLDER = AKAR / "data" / "ttd"
CADANGAN = FOLDER / "asli"

# tanda tangan = satu warna tinta; stempel = banyak warna
BERKAS = {
    "ttd-dept-head.png": {"satu_warna": True},
    "ttd-staf-teknik.png": {"satu_warna": True},
    "stempel.png": {"satu_warna": False},
}


def smoothstep(v, bawah, atas):
    """Kurva S pada 0..255. Di luar rentang dijepit, di dalam melengkung halus."""
    if v <= bawah:
        return 0
    if v >= atas:
        return 255
    t = (v - bawah) / (atas - bawah)
    return int(round(255 * t * t * (3 - 2 * t)))


def warna_tinta(im):
    """Warna tinta paling mewakili: rerata piksel yang alfanya pekat."""
    px = im.load()
    l, b = im.size
    jml = [0, 0, 0]
    n = 0
    for y in range(b):
        for x in range(l):
            r, g, bl, a = px[x, y]
            if a > 200:
                jml[0] += r
                jml[1] += g
                jml[2] += bl
                n += 1
    if not n:
        return (0, 0, 0)
    return tuple(v // n for v in jml)


def perhalus(sumber: Path, faktor: int, satu_warna: bool) -> Image.Image:
    im = Image.open(sumber).convert("RGBA")
    l, b = im.size
    besar = im.resize((l * faktor, b * faktor), Image.LANCZOS)

    alfa = besar.getchannel("A")
    # radius mengikuti faktor: yang dihaluskan adalah tangga selebar 1 piksel asli
    alfa = alfa.filter(ImageFilter.GaussianBlur(radius=faktor * 0.55))
    tabel = [smoothstep(v, 70, 185) for v in range(256)]
    alfa = alfa.point(tabel)

    if satu_warna:
        tinta = warna_tinta(besar)
        hasil = Image.new("RGBA", besar.size, tinta + (0,))
        hasil.putalpha(alfa)
        return hasil

    # berwarna: warnanya ikut dihaluskan, lalu alfa halus dipasang kembali
    rgb = besar.convert("RGB").filter(ImageFilter.GaussianBlur(radius=faktor * 0.18))
    hasil = rgb.convert("RGBA")
    hasil.putalpha(alfa)

    """
    Warnanya dipangkas ke 128 rupa, lalu DIKEMBALIKAN ke RGBA.

    Memperbesar gambar melahirkan puluhan ribu warna antara yang tidak terlihat
    mata tetapi membengkakkan berkasnya empat kali lipat — dan berkas itu ikut
    tersimpan tersandi di basis data, lalu dibaca ulang tiap kali dokumen
    dibuat. Disimpan sebagai PNG berpalet memang lebih kecil lagi, tetapi
    pdf-lib tidak dijamin sanggup membaca PNG berpalet ber-alfa, jadi hasilnya
    dikembalikan ke RGBA: tetap empat kali lebih ringan, tanpa menaruh taruhan
    pada dukungan format.
    """
    return hasil.quantize(colors=128, method=Image.FASTOCTREE).convert("RGBA")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--faktor", type=int, default=3, help="kelipatan perbesaran")
    p.add_argument("--periksa", action="store_true", help="tulis ke data/ttd/uji/ saja")
    a = p.parse_args()

    tujuan = (FOLDER / "uji") if a.periksa else FOLDER
    tujuan.mkdir(parents=True, exist_ok=True)
    if not a.periksa:
        CADANGAN.mkdir(parents=True, exist_ok=True)

    for nama, opsi in BERKAS.items():
        # Sumbernya SELALU berkas asli bila cadangannya sudah ada. Tanpa ini,
        # menjalankan skrip dua kali berarti memperhalus hasil yang sudah
        # diperhalus: garisnya makin gemuk dan makin pudar tiap kali, dan tidak
        # ada cara mengembalikannya selain mencari berkas aslinya lagi.
        asal = CADANGAN / nama if (CADANGAN / nama).exists() else FOLDER / nama
        if not asal.exists():
            print(f"lewat  {nama} (tidak ada)")
            continue
        if not a.periksa:
            simpan = CADANGAN / nama
            if not simpan.exists():
                shutil.copy2(asal, simpan)
        # ukuran lama dibaca SEBELUM disimpan: tanpa --periksa, keluarannya
        # menimpa berkas asal, jadi membacanya sesudah itu hanya melaporkan
        # angka yang sama dua kali
        ukuran_lama = asal.stat().st_size
        lama = Image.open(asal)
        dim_lama = lama.size
        hasil = perhalus(asal, a.faktor, opsi["satu_warna"])
        keluar = tujuan / nama
        hasil.save(keluar, optimize=True)
        print(f"{nama}: {dim_lama[0]}x{dim_lama[1]} -> {hasil.size[0]}x{hasil.size[1]}, "
              f"{ukuran_lama // 1024} KB -> {keluar.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
