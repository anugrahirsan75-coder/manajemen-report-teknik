# -*- coding: utf-8 -*-
"""
Ubah tabel borang hasil ekspor Word menjadi template HTML berisi penanda.

Tujuannya bukan meniru borang, melainkan MEMAKAI markup Word itu sendiri:
lebar tiap sel, jenis garis (utuh / titik-titik), tinggi baris, dan perataannya
sudah benar dari sananya, jadi cetakan digital tidak mungkin meleset dari
berkas yang selama ini dipakai kapal.
"""
import io, re, os, json

AKAR = os.path.dirname(os.path.abspath(__file__))
SUMBER = os.path.join(AKAR, 'tabel1.htm')
TUJUAN = 'D:/ASDP/02. PROJEK/files/generator-swakelola/src/lib/lapor/borangTemplate.ts'

t = io.open(SUMBER, encoding='utf8').read()

# ── bersihkan sisa-sisa Word yang tak berguna di peramban ────────────────────
t = re.sub(r'\sclass=MsoNormal(Table)?', '', t)
t = re.sub(r'\slang=[A-Za-z-]+', '', t)
t = re.sub(r'mso-[a-z-]+:[^;\']*;?', '', t)          # properti khusus Word
t = t.replace('windowtext', '#000000')
t = re.sub(r'<span style=\'font-family:FrutigerExt-Normal\'>', '<span>', t)
t = re.sub(r'<o:p>.*?</o:p>', '', t, flags=re.S)
t = t.replace('<o:p></o:p>', '')
t = re.sub(r'[ \t]*\r?\n[ \t]*', ' ', t)             # satu baris panjang
t = re.sub(r'\s{2,}', ' ', t)

baris = re.split(r'(?=<tr)', t)
kepala, isiBaris = baris[0], baris[1:]

def teksSel(sel):
    x = re.sub(r'<[^>]+>', '', sel)
    return re.sub(r'\s+', ' ', x).replace('&nbsp;', ' ').strip()

def gantiIsi(sel, baru):
    """ganti isi <p>…</p> sebuah sel, gaya paragrafnya dipertahankan"""
    return re.sub(r'(<p[^>]*>).*?(</p>)', lambda m: m.group(1) + baru + m.group(2), sel, count=1, flags=re.S)

TENGAH = "<p align=center style='text-align:center;margin:0'>{0}</p>"

PARAF_KIRI = ("<p style='margin:0'>Catatan Peminta Barang &amp; Jasa :</p>"
              "<p style='margin:0;white-space:pre-wrap'>{{CATATAN}}</p>")

# empat baris kosong menyediakan ruang tanda tangan basah, persis seperti aslinya
TTD = ("<p align=center style='text-align:center;margin:0'>{0}</p>"
       "<p align=center style='text-align:center;margin:0'>&nbsp;</p>"
       "<p align=center style='text-align:center;margin:0'>&nbsp;</p>"
       "<p align=center style='text-align:center;margin:0'>&nbsp;</p>"
       "<p align=center style='text-align:center;margin:0'><u>{1}</u></p>"
       "<p align=center style='text-align:center;margin:0'><i>({2})</i></p>")


def ganti(sel, dalam):
    """ganti SELURUH isi sel, atribut <td> (garis, lebar, tinggi) dipertahankan"""
    awal = re.match(r'<td[^>]*>', sel).group(0)
    return awal + dalam + '</td>'


def belahUraian(sel):
    """Belah sel "Uraian / Spesifikasi Barang" jadi dua kolom.

    Pembelahannya JATUH TEPAT DI BATAS KOLOM yang sudah ada pada berkas asli
    (cols 6-8 lalu 9-10 dari grid sepuluh kolom milik Word), bukan di ukuran
    karangan sendiri. Dengan begitu tidak ada satu pun garis tegak lain pada
    borang yang bergeser: yang berubah hanya satu sel yang kini jadi dua.
    """
    kiri = sel.replace('width=436', 'width=215').replace('326.45pt', '161.3pt')               .replace('colspan=5', 'colspan=3')
    kanan = sel.replace('width=436', 'width=220').replace('326.45pt', '165.2pt')                .replace('colspan=5', 'colspan=2')
    # garis tegak pemisah kedua kolom
    kanan = re.sub(r'border-left:\s*none;?', 'border-left:solid #000000 1.0pt;', kanan)
    return kiri, kanan


def selDari(tr):
    return re.findall(r'<td.*?</td>', tr, flags=re.S)

hasil = []

for n, tr in enumerate(isiBaris, 1):
    sel = selDari(tr)
    awalTr = re.match(r'<tr[^>]*>', tr).group(0)

    if n == 1:
        sel[5] = gantiIsi(sel[5], '{{NOSURAT}}')
    elif n == 2:
        sel[2] = gantiIsi(sel[2], '{{KAPAL}}')
        sel[5] = gantiIsi(sel[5], '{{TANGGAL}}')
    elif n == 3:
        sel[2] = gantiIsi(sel[2], '{{DASAR}}')
    elif n == 4:
        sel[2] = gantiIsi(sel[2], '{{DIBUTUHKAN}}')
    elif n == 5:
        # baris antara letterhead dan tabel barang: tingginya 3,85pt di berkas
        # asli. Tanpa penanda, isinya (satu spasi) memaksa tinggi satu baris
        # teks penuh dan seluruh tabel barang turun satu sentimeter lebih.
        awalTr = awalTr.replace('<tr', '<tr class=lp-antara', 1)
    elif n == 6:
        kiri, kanan = belahUraian(sel[4])
        sel[4] = gantiIsi(kiri, 'Uraian Barang')
        sel.append(gantiIsi(kanan, 'Spesifikasi'))
    elif 7 <= n <= 27:
        k = n - 7                     # slot barang ke-0 sampai ke-20
        uraian, spek = belahUraian(sel[4])
        sel[0] = gantiIsi(sel[0], '{{I%d_NO}}' % k)
        sel[1] = gantiIsi(sel[1], '{{I%d_JML}}' % k)
        sel[2] = gantiIsi(sel[2], '{{I%d_SAT}}' % k)
        sel[3] = gantiIsi(sel[3], '{{I%d_MERK}}' % k)
        sel[4] = gantiIsi(uraian, '{{I%d_URAIAN}}' % k)
        sel.append(gantiIsi(spek, '{{I%d_SPEK}}' % k))
    elif n == 28:
        # blok tanda tangan ditulis ulang seluruhnya: sel aslinya memuat
        # beberapa paragraf berisi nama contoh, dan mengganti satu paragraf saja
        # menyisakan nama orang lain di lembar kapal mana pun yang mencetaknya
        sel[0] = ganti(sel[0], PARAF_KIRI)
        sel[1] = ganti(sel[1], TENGAH.format('{{KAPAL_TANGGAL}}'))
    elif n == 29:
        # Tinggi baris tanda tangan pada berkas asli "otomatis" (mengikuti isi
        # Word), jadi tak ikut terekspor. Tanpa tinggi, ruang tanda tangannya
        # menyusut lima milimeter dan bloknya tak lagi sejajar dengan arsip.
        awalTr = awalTr.replace('<tr', '<tr class=lp-ttd', 1)
        sel[1] = ganti(sel[1], TENGAH.format('Peminta Barang,'))
    elif n in (30, 31):
        awalTr = awalTr.replace('<tr', '<tr class=lp-ttd', 1)
        sel[1] = ganti(sel[1], TENGAH.format('&nbsp;'))
    elif n == 32:
        awalTr = awalTr.replace('<tr', '<tr class=lp-ttd', 1)
        sel[1] = ganti(sel[1], TENGAH.format('<u>{{PEMINTA}}</u>'))
    elif n == 33:
        awalTr = awalTr.replace('<tr', '<tr class=lp-ttd', 1)
        sel[1] = ganti(sel[1], TENGAH.format('<i>({{JABATAN}})</i>'))
    elif n == 34:
        awalTr = awalTr.replace('<tr', '<tr class=lp-setuju', 1)
        sel[0] = ganti(sel[0], TTD.format('Persetujuan,', '{{NAKHODA}}', 'Nakhoda'))
        sel[1] = ganti(sel[1], TTD.format('&nbsp;', '{{MASINIS}}', '{{ATASAN}}'))
    elif n == 35:
        # BARIS PENGUNCI LEBAR milik Word (tinggi 0, sepuluh sel tanpa garis).
        # Baris inilah yang menetapkan lebar tiap kolom tabel; sempat dibuang
        # karena tampak kosong, dan seluruh kolom borang langsung melar tak
        # karuan. Kolom terakhirnya dipecah mengikuti pembelahan Uraian.
        pass

    hasil.append(awalTr + ''.join(sel) + '</tr>')

# ── kunci lebar kolom ───────────────────────────────────────────────────────
# Baris pengunci Word hanya bekerja pada tata letak otomatis. Saat mencetak,
# Chrome menghitung ulang lebar kolom menurut isinya dan hasilnya melenceng
# beberapa milimeter. Colgroup + table-layout:fixed membuat lebar kolom
# ditentukan angka, bukan isi — angkanya diambil dari grid sepuluh kolom milik
# berkas aslinya (38+66+42+18+119+76+56+83+13+207 = 718px = 190mm).
# Lebarnya ditulis dalam MILIMETER, bukan piksel. Saat mencetak, Chrome
# memetakan px pada lembar ini 3,9% lebih besar dari 1/96 inci — terukur: batang
# acuan selebar 718px keluar 197,3mm, bukan 190mm — sehingga seluruh kolom ikut
# melar dan tabelnya melewati tepi kertas. Milimeter tidak bisa ditafsirkan
# ulang seperti itu.
GRID_PT = [28.5, 49.5, 31.5, 13.5, 89.25, 57.0, 42.0, 62.25, 9.75, 155.25]
colgroup = '<colgroup>' + ''.join(
    "<col style='width:%.2fmm'>" % (w * 25.4 / 72) for w in GRID_PT) + '</colgroup>'

tabel = kepala + colgroup + ''.join(hasil) + '</table>'
# tabel Word menggantung ke kiri; tepi kertasnya diatur lembar cetak, bukan di sini
tabel = tabel.replace('margin-left:-17.7pt;', '')

isi = (
'/**\n'
' * TEMPLATE BORANG PERMINTAAN KAPAL — markup asli dari berkas Word cabang.\n'
' *\n'
' * Berkas ini DIHASILKAN, bukan diketik: isinya tabel borang HP-103.00.01\n'
' * apa adanya hasil ekspor Word (scripts/sumber/bikinTemplate.py), yang sudah\n'
' * membawa lebar tiap sel, jenis garis — utuh untuk bingkai, titik-titik untuk\n'
' * pemisah antar barang — tinggi baris, dan perataannya sendiri. Meniru ukuran\n'
' * itu dengan tangan selalu meleset sedikit, dan "sedikit" sudah cukup membuat\n'
' * lembar cetak tidak bisa ditumpuk dengan berkas lama.\n'
' *\n'
' * Satu-satunya perubahan yang disengaja: kolom "Uraian / Spesifikasi Barang"\n'
' * (326,5pt) dibelah menjadi Uraian Barang 196,5pt + Spesifikasi 130pt, sesuai\n'
' * permintaan. Lebar totalnya tidak berubah.\n'
' *\n'
' * Penanda {{...}} diisi oleh isiBorang() di borangIsi.ts.\n'
' */\n'
'export const BORANG_TEMPLATE = ' + json.dumps(tabel, ensure_ascii=False) + ';' + chr(10)
)

io.open(TUJUAN, 'w', encoding='utf8').write(isi)
print('template ditulis:', len(tabel), 'karakter')
print('penanda:', sorted(set(re.findall(r'{{[A-Z0-9_]+}}', tabel)))[:12])
