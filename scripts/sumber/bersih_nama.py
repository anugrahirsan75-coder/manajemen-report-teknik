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
    r"kebutuhan|usulan|permintaan|penggantian\s+rutin|barang\s+rutin|jasa\s+rutin)\s+"
    r"(?:barang\s+|jasa\s+|rutin\s+)?", re.I)

# ekor: nama kapal, bulan, tahun, kata "kapal" yang menggantung
EKOR_KAPAL = re.compile(
    r"\s*[-–—,]?\s*(?:untuk\s+)?(?:kapal\s+)?(?:kmp|km|bus\s*air)\.?\s+[A-Za-z][A-Za-z .'/]*$", re.I)
EKOR_BULAN = re.compile(rf"\s*[-–—,]?\s*(?:bu?la?n\.?\s+)?(?:{BULAN})\.?\s*\d{{4}}\s*$", re.I)
EKOR_TAHUN = re.compile(r"\s*[-–—,]?\s*(?:tahun\s+)?(?:t\.?a\.?\s*)?20\d{2}\s*$", re.I)
EKOR_KAPAL_POLOS = re.compile(r"\s*[-–—,]\s*kapal\s*$", re.I)

# Awalan sampah yang menempel dengan tanda hubung: baris bantu spreadsheet,
# judul kolom yang ikut tersalin, bulan, dan nama kapal.
#   "Insert diatas ini - Alat Pel Lantai"  -> "Alat Pel Lantai"
#   "HARGA SAT (Rp) - HANDLE PINTU"        -> "HANDLE PINTU"
#   "SEPTEMBER - Grease"                   -> "Grease"
AWALAN_SAMPAH = re.compile(
    rf"^\s*(?:insert\s*di\s*atas\s*ini|insert\s*diatas\s*ini|"
    rf"harga(?:\s+(?:pjk|sat|satuan|total|net|nego|awal|akhir|lama|baru))?(?:\s*\(\s*rp\.?\s*\))?|"
    rf"[a-d]\s*[:.]\s*(?:fast|slow|death|dead|non)[\s-]*moving|(?:fast|slow|death|dead|non)[\s-]*moving|"
    rf"(?:mesin\s+induk|mesin\s+bantu|gen\s*set|genset)\s*[:\-]\s*.{{0,40}}?|"
    rf"(?:m/?e|a/?e)\s*[:\-]?\s*"
    rf"(?:yanmar|mitsubishi|cummins|perkins|caterpillar|weichai|deutz|volvo|niigata|daihatsu|hanshin|"
    rf"nissan|isuzu|doosan|scania|baudouin)\s*.{{0,40}}?|"
    rf"uraian(?:\s+barang)?(?:\s*/\s*jasa)?|nama\s+barang(?:\s*/\s*part\s*number)?|"
    rf"part\s*number|deskripsi|keterangan|"
    rf"spesifikasi[^-–—:]{{0,60}}|"
    rf"(?:{BULAN})(?:\s*\d{{4}})?|"
    rf"(?:bus\s*air\s+)?(?:kmp|km)\.?\s*[A-Za-z][A-Za-z0-9.'\-]*(?:\s+[A-Za-z0-9.'\-]+)*?"
    rf")\s+[-–—:]\s+", re.I)

# nama kapal yang menempel langsung ke sebutan pekerjaan, tanpa pemisah
KAPAL_MENEMPEL = re.compile(
    r"^\s*(?:bus\s*air\s+)?(?:kmp|km)\.?\s*[A-Za-z][A-Za-z0-9.'\-]*(?=Pem\.|Pel\.|Pemeliharaan|Permesinan|Akomodasi|Perlengkapan)", re.I)

# hasil pengupasan yang ternyata cuma nama kapal — bukan nama barang
HANYA_KAPAL = re.compile(r"^\s*(?:bus\s*air\s+)?(?:kmp|km)\.?\s*[A-Za-z][A-Za-z0-9 .'\-]*$", re.I)

# baris yang seluruhnya bukan nama barang — dibuang, bukan dibersihkan
BUKAN_NAMA = re.compile(
    rf"^\s*(?:insert\s*di\s*ata?s\s*ini|isi\s*di\s*sini|ketik\s*di\s*sini|"
    rf"no|nomor|uraian(?:\s+pekerjaan)?|spesifikasi|satuan|jumlah|qty|volume|keterangan|"
    rf"deskripsi|nama\s+barang|harga(?:\s+satuan)?|sub\s*total|total|grand\s*total|rekap|"
    rf"(?:{BULAN})(?:\s*\d{{4}})?)\s*[:.\-]?\s*$", re.I)

# kalimat catatan, bukan nama barang: panjang DAN memuat kata sambung
KATA_SAMBUNG = re.compile(r"\b(yang|pada|dengan|namun|tidak|karena|agar|sehingga|apabila|dalam usulan)\b", re.I)

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
    r"filter|suku\s+cadang|persiapan|pelumas|oli|cat|labour|material|umum|lain[\s-]*lain|"
    r"barang(?:\s+rutin)?|jasa(?:\s+rutin)?|rutin|bahan)"
    r"(?:\s+(?:kapal|mesin|deck|dek|bagian\s+\w+|tambahan|rutin))*$", re.I)

# konteks mesin yang menempel di depan nama suku cadang:
# "ME : YANMAR 6 AYM-WET, JAM KERJA ME KA/KI : 3571.5 JAM - O-RING"
KONTEKS_MESIN = re.compile(
    r"(jam\s*kerja|yanmar|mitsubishi|cummins|perkins|caterpillar|weichai|deutz|volvo|niigata|"
    r"daihatsu|hanshin|mesin\s+induk|mesin\s+bantu|m/?e|a/?e|^\d[\d.,]*\s*jam)", re.I)


def _buang_konteks_mesin(t: str) -> str:
    """Ruas kiri yang isinya keterangan mesin, bukan nama barangnya, dibuang."""
    potong = re.split(r"\s+[-–—]\s+", t)
    if len(potong) < 2:
        return t
    kanan = potong[-1].strip()
    kiri = " - ".join(potong[:-1])
    if len(kanan) >= 3 and KONTEKS_MESIN.search(kiri):
        return kanan
    return t


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

    if BUKAN_NAMA.match(t):
        return ""
    # catatan berbentuk kalimat: panjang dan penuh kata sambung
    if len(t) >= 80 and len(KATA_SAMBUNG.findall(t)) >= 2:
        # "…rekomendasi dapat dibuat exemption agar ditunda - Pompa sewage"
        # ruas kanannya justru nama barangnya; itu yang diselamatkan
        ekor = re.split(r"\s+[-–—]\s+", t)[-1].strip()
        return ekor if 3 <= len(ekor) <= 60 and not KATA_SAMBUNG.search(ekor) else ""

    asli = t
    for pola in CATATAN:
        t = pola.sub(" ", t)

    # Awalan bisa bertumpuk dan berselang-seling: "Kebutuhan SEPTEMBER - Grease"
    # punya narasi di depan awalan sampah, sedangkan "Insert diatas ini -
    # Pengadaan Majun" sebaliknya. Karena itu ketiganya dikupas bergantian
    # sampai tak ada lagi yang berubah.
    for _ in range(4):
        sebelum = t
        t = NOMOR_DEPAN.sub("", t)
        t = AWALAN_SAMPAH.sub("", t)
        t = NARASI_DEPAN.sub("", t)
        t = SISA_TANDA.sub("", t).strip()
        if t == sebelum:
            break

    # ekor dikupas berulang: "… KMP. TUNA Juli 2026" punya dua ekor sekaligus
    for _ in range(4):
        sebelum = t
        t = EKOR_BULAN.sub("", t)
        t = EKOR_TAHUN.sub("", t)
        t = EKOR_KAPAL.sub("", t)
        t = EKOR_KAPAL_POLOS.sub("", t)
        if t == sebelum:
            break

    t = KAPAL_MENEMPEL.sub("", t)
    t = _buang_konteks_mesin(t)
    t = _buang_awalan_kelompok(SISA_TANDA.sub("", SPASI.sub(" ", t)).strip())
    t = SISA_TANDA.sub("", t).strip()

    # yang tersisa cuma nama kapal berarti barangnya memang tak pernah disebut
    if HANYA_KAPAL.match(t) or BUKAN_NAMA.match(t):
        return ""

    # habis sama sekali = memang tak ada nama barang di dalamnya (mis. "Insert
    # diatas ini - KMP. ARIWANGAN": baris bantu berisi nama kapal, bukan barang)
    if not t:
        return ""

    # terlalu pendek berarti pengupasannya kebablasan — kembalikan yang asli
    if len(t) < 3:
        return SISA_TANDA.sub("", asli).strip()
    return t


def bersih_spek(spek: str, uraian: str = "") -> str:
    """
    Spesifikasi saja.

    Kolom spesifikasi di berkas RAB kerap kejatuhan isian lain: nama kapal,
    bulan, bahkan nama barangnya sendiri diulang. Yang begitu lebih baik kosong
    daripada menyesatkan — pembacanya akan mengira "Majun" punya spesifikasi
    "KMP. GORANGO".
    """
    t = SPASI.sub(" ", (spek or "").replace(chr(10), " ")).strip()
    if not t:
        return ""
    # nama kapal saja, atau nama kapal di ujung
    if re.match(r"^(?:kmp|km|bus\s*air)\.?\s+[A-Za-z][A-Za-z .'/]*$", t, re.I):
        return ""
    t = EKOR_KAPAL.sub("", t)
    t = EKOR_BULAN.sub("", t)
    for pola in CATATAN:
        t = pola.sub(" ", t)
    t = SISA_TANDA.sub("", SPASI.sub(" ", t)).strip()
    # pengulangan nama barangnya sendiri
    if uraian and t.lower() == uraian.strip().lower():
        return ""
    # sisa yang tak bermakna: angka polos, satu huruf, tanda baca
    if len(t) < 2 or re.fullmatch(r"[\d\W]+", t):
        return ""
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
        "Barang Rutin - Isolasi Listrik",
        "Insert diatas ini - Alat Pel Lantai",
        "HARGA SAT (Rp) - HANDLE PINTU TOGGLE SS",
        "SEPTEMBER - Grease",
        "BUS AIR KM. JURUNG-JURUNG - Roll Block",
        "insert diatas ini",
        "SUB TOTAL",
        "Dalam Usulan Cabang Dinding dilapisi dengan HPL Namun pada Pada KD. 55 tidak demikian sehingga perlu disesuaikan lagi",
        "Material Pompa Belum tersedia, rekomendasi dapat dibuat exemption agar pemasangan ditunda pada dock berikutnya - Pompa sewage",
        "URAIAN BARANG / JASA - Isi Kuas Roll Kecil",
        "Insert diatas ini - KMP. ARIWANGAN",
        "KMP.MAMING - Ganti lantai vinyl",
        "KMP. AWU-AWUPem. Akomodasi dan Perlengkapan",
        "Kebutuhan SEPTEMBER - Grease",
        "Dilaksanakan megger test seluruh instalasi listrik dan panel-panel listrik dan semua electromotor MSB, Altenator, Generator",
    ]
    for c in contoh:
        print(f"{c!r:70} -> {bersih_nama(c)!r}")
    print()
    for s, u in [("KMP. GORANGO", "Majun"), ("Sikat Kloset", "Sikat Kloset"),
                 ("Setara Daikin", "AC 1 PK"), ("Racor2020 - KMP. TUNA", "Filter Solar"), ("-", "Keset")]:
        print(f"spek {s!r:28} pada {u!r:16} -> {bersih_spek(s, u)!r}")
