# -*- coding: utf-8 -*-
"""
Pembersih NAMA ITEM untuk indeks harga.

Berkas RAB di lapangan menuliskan satu barang dengan segala macam bungkusnya:
nomor surat di depan, kata "Pengadaan"/"Belanja"/"Jasa" sebagai pembuka, nama
kapal dan bulan di belakang. Semuanya benar sebagai judul pekerjaan, tapi SALAH
sebagai nama barang — dan yang masuk ke daftar usulan adalah nama barang.

    "035/TN.202/ASDP-TTE/2024 - Oli Filter"            -> "Oli Filter"
    "Pengadaan Majun Kapal KMP. TUNA Juli 2026"        -> "Majun"
    "Belanja Cat Marine Paint - KMP. LEMA"             -> "Cat Marine Paint"

Aturan sengaja KONSERVATIF: kalau setelah dibersihkan namanya jadi terlalu
pendek atau habis sama sekali, nama aslinya yang dipakai. Lebih baik satu nama
kepanjangan daripada satu barang kehilangan identitasnya.
"""
import re

BULAN = (r"januari|februari|maret|april|mei|juni|juli|agustus|september|"
         r"oktober|november|desember|"
         r"jan|feb|mar|apr|jun|jul|ags|agt|agu|sep|sept|okt|nov|des")

# nomor surat/berkas di depan: "035/TN.202/ASDP-TTE/2024 - ", "046/TN.205/... : "
NOMOR_DEPAN = re.compile(
    r"^\s*[\(\[]?\s*\d{2,4}\s*[/.]\s*[A-Za-z]{2,}[A-Za-z0-9./\-]*\s*[-–—:]\s*", re.I)

# uraian yang seluruhnya cuma nomor surat (tak ada nama barangnya)
HANYA_NOMOR = re.compile(r"^[\d\W]{0,6}\d{2,4}\s*[/.]\s*[A-Z]{2,}[A-Z0-9./\-]*\s*$", re.I)

# kata pembuka yang menceritakan PEKERJAAN, bukan menyebut barang
NARASI_DEPAN = re.compile(
    r"^\s*(?:jasa\s+)?(?:pengadaan|belanja|pembelian|penyediaan|pekerjaan|biaya|"
    r"paketisasi|perawatan\s+rutin|perawatan|pemeliharaan|perbaikan\s+rutin|"
    r"kebutuhan|usulan|permintaan|penggantian\s+rutin)\s+"
    r"(?:barang\s+|jasa\s+|rutin\s+)?", re.I)

# ekor: nama kapal, bulan, tahun, kata "kapal" yang menggantung
EKOR_KAPAL = re.compile(
    r"\s*[-–—,]?\s*(?:untuk\s+)?(?:kapal\s+)?(?:kmp|km|bus\s*air)\.?\s+[A-Za-z][A-Za-z .'/]*$", re.I)
EKOR_BULAN = re.compile(rf"\s*[-–—,]?\s*(?:bu?la?n\.?\s+)?(?:{BULAN})\.?\s*\d{{4}}\s*$", re.I)
EKOR_TAHUN = re.compile(r"\s*[-–—,]?\s*(?:tahun\s+)?(?:t\.?a\.?\s*)?20\d{2}\s*$", re.I)
EKOR_KAPAL_POLOS = re.compile(r"\s*[-–—,]\s*kapal\s*$", re.I)

# catatan penyusun yang ikut terbawa, bukan bagian nama barang
CATATAN = [
    re.compile(r"\(\s*by\s+tim[^)]*\)", re.I),
    re.compile(r"\(\s*lihat\s+kontrak[^)]*\)", re.I),
    re.compile(r"\btotal\s*rp\.?\s*$", re.I),
    re.compile(r"^belum\s+pernah\s+diadakan[^\w]*", re.I),
]

SISA_TANDA = re.compile(r"^[\s\-–—:,.;/·]+|[\s\-–—:,.;/·]+$")

# Kata-kata yang menandai BAGIAN/KELOMPOK, bukan nama barang. Dipakai untuk
# memotong awalan seperti "Pemeliharaan Mesin - Deterjen" -> "Deterjen":
# ruas kiri tanda hubung yang isinya cuma sebutan kelompok memang bukan nama.
KATA_KELOMPOK = re.compile(
    r"^(?:mesin|deck|dek|kamar\s+mesin|permesinan|kelistrikan|listrik|akomodasi|"
    r"perlengkapan|peralatan|alat\s+kerja(?:\s+mesin|\s+deck)?|alat\s+keselamatan"
    r"(?:\s+dan\s+navigasi)?|keselamatan|navigasi|kebersihan|cleaning|consumable|"
    r"filter|suku\s+cadang|persiapan|pelumas|oli|cat|labour|material|umum|lain[\s-]*lain)"
    r"(?:\s+(?:kapal|mesin|deck|dek|bagian\s+\w+|tambahan|rutin))*$", re.I)

def _buang_awalan_kelompok(t: str) -> str:
    """Ruas kiri tanda hubung yang cuma sebutan kelompok dibuang."""
    for pemisah in (" - ", " – ", " — ", " : "):
        if pemisah in t:
            kiri, _, kanan = t.partition(pemisah)
            kiri_bersih = re.sub(r"\(.*?\)", "", kiri).strip()
            if (len(kanan.strip()) >= 3 and len(kiri_bersih.split()) <= 5
                    and KATA_KELOMPOK.match(kiri_bersih)):
                return kanan.strip()
    return t
SPASI = re.compile(r"\s+")


def bersih_nama(mentah: str) -> str:
    """Nama barang saja. Mengembalikan "" bila isinya memang bukan nama barang."""
    t = SPASI.sub(" ", (mentah or "").replace("\n", " ")).strip()
    if not t:
        return ""
    if HANYA_NOMOR.match(t):
        return ""

    asli = t
    t = NOMOR_DEPAN.sub("", t)
    for pola in CATATAN:
        t = pola.sub(" ", t)

    # narasi bisa bertumpuk: "Pengadaan Belanja Majun"
    for _ in range(3):
        baru = NARASI_DEPAN.sub("", t)
        if baru == t:
            break
        t = baru

    # ekor dikupas berulang: "… KMP. TUNA Juli 2026" punya dua ekor sekaligus
    for _ in range(4):
        sebelum = t
        t = EKOR_BULAN.sub("", t)
        t = EKOR_TAHUN.sub("", t)
        t = EKOR_KAPAL.sub("", t)
        t = EKOR_KAPAL_POLOS.sub("", t)
        if t == sebelum:
            break

    t = _buang_awalan_kelompok(SISA_TANDA.sub("", SPASI.sub(" ", t)).strip())
    t = SISA_TANDA.sub("", t).strip()

    # terlalu pendek berarti pengupasannya kebablasan — kembalikan yang asli
    if len(t) < 3:
        return SISA_TANDA.sub("", asli).strip()
    return t


if __name__ == "__main__":
    contoh = [
        "035/TN.202/ASDP-TTE/2024 - Oli Filter",
        "Pengadaan Majun Kapal KMP. TUNA Juli 2026",
        "Belanja Cat Marine Paint - KMP. LEMA",
        "Jasa Pengadaan Service Genset Bulan Agustus 2026",
        "(by TIM Keuangan Kantor Pusat) Perbaikan Ruang Penumpang",
        "Paketisasi Perawatan Rutin Kebersihan Kapal Bagian Deck",
        "046/TN.205/ASDP-TTE/2024",
        "Deterjen Bubuk",
        "Pemeliharaan Mesin - Deterjen",
        "Kebutuhan Filter - LO Filter",
        "PERAWATAN MESIN - Amplas/kertas Gosok 600",
        "Paketisasi Perawatan Kebersihan Kapal Bagian Mesin Bln Februari 2026",
        "Pemeliharaan Alat Keselamatan dan Navigasi - Mata Gergaji",
    ]
    for c in contoh:
        print(f"{c!r:70} -> {bersih_nama(c)!r}")
