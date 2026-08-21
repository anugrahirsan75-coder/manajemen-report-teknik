# -*- coding: utf-8 -*-
"""
Ubah "DATABASE HARGA RAB ASDP TERNATE.xlsx" (60 ribuan item hasil pemindaian
4.927 berkas pengadaan 2024-2026) menjadi satu indeks harga ringkas yang dibaca
API pencarian harga.

Disimpan sebagai larik-dalam-larik + kamus (kategori/satuan/tren) supaya jauh
lebih kecil daripada larik objek — berkasnya ikut masuk repo dan dimuat di sisi
server, bukan dikirim ke peramban.
"""
import json, re, collections, os, sys, openpyxl

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bersih_nama import bersih_nama, bersih_spek

SRC = r"D:/ASDP/01. ASDP TERNATE/2024 ASDP TERNATE/ASDP TERNATE/2026/RKA 2027/DATABASE HARGA RAB ASDP TERNATE.xlsx"
OUT = "data/hargaIndex.json"
SHEET = {"DB BARANG": "B", "DB JASA": "J", "SUKU CADANG MESIN": "S"}
# uraian yang isinya cuma nomor surat/berkas — bukan nama barang
SAMPAH = re.compile(r"^[\d\W]{0,6}\d{2,4}\s*[/.]\s*[A-Z]{2,}", re.I)

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
kat, sat, tren = {}, {}, {}
def idx(d, v):
    v = (v or "").strip()
    if not v: return -1
    if v not in d: d[v] = len(d)
    return d[v]

baris, buang, dibersihkan, mutu = [], 0, 0, collections.Counter()
for sheet, jenis in SHEET.items():
    ws = wb[sheet]
    it = ws.iter_rows(min_row=1, max_row=1, values_only=True)
    hdr = [("" if x is None else str(x)) for x in next(it)]
    c = {h: i for i, h in enumerate(hdr)}
    g = lambda r, k: r[c[k]] if k in c and c[k] < len(r) else None
    for r in ws.iter_rows(min_row=2, values_only=True):
        kode = g(r, "Kode")
        if not kode: continue
        mentah = (str(g(r, "Uraian Barang / Jasa") or "")).replace(chr(10), " ").strip()
        # NAMA BARANG saja yang masuk indeks: nomor surat, kata "Pengadaan",
        # nama kapal, dan bulan dibuang. Daftar usulan menampilkan nama ini apa
        # adanya, jadi narasi yang ikut terbawa akan terbaca di dokumen resmi.
        uraian = bersih_nama(mentah)
        if len(uraian) < 3 or SAMPAH.match(uraian): buang += 1; continue
        if uraian != mentah: dibersihkan += 1
        mutu[str(g(r, "Catatan Mutu Data") or "-")[:40]] += 1
        n = lambda k: (lambda v: round(v) if isinstance(v, (int, float)) else 0)(g(r, k))
        # spesifikasi ikut dibersihkan: kolom ini kerap kejatuhan nama kapal,
        # bulan, atau nama barangnya sendiri yang diulang
        spek = bersih_spek(str(g(r, "Spesifikasi") or ""), uraian)
        merk = bersih_spek(str(g(r, "Merk / Tipe Mesin") or ""), uraian)
        part = (str(g(r, "Part Number") or "")).strip()
        baris.append([
            str(kode), jenis, idx(kat, str(g(r, "Kategori") or "")), uraian[:160],
            (spek + (" · " + merk if merk else "") + (" · PN " + part if part else ""))[:160],
            idx(sat, str(g(r, "Satuan") or "")), int(g(r, "Jml Data") or 0),
            n("Harga Terendah"), n("Harga Tertinggi"), n("Harga Median"),
            n("Harga 2024"), n("Harga 2025"), n("Harga 2026"),
            idx(tren, str(g(r, "Tren Harga") or "")),
            (str(g(r, "Kapal") or "")).strip()[:60],
        ])
wb.close()

data = {
    "sumber": "DATABASE HARGA RAB ASDP TERNATE.xlsx",
    "kolom": ["kode", "jenis", "kategori", "uraian", "spek", "satuan", "n",
              "lo", "hi", "median", "h2024", "h2025", "h2026", "tren", "kapal"],
    "kamus": {"kategori": list(kat), "satuan": list(sat), "tren": list(tren)},
    "baris": baris,
}
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
print(f"{OUT}: {len(baris)} item ({buang} baris nomor-surat dibuang, "
      f"{dibersihkan} nama dibersihkan) · {len(kat)} kategori · {len(sat)} satuan")
for k, v in mutu.most_common(8): print(f"   mutu {v:>6}  {k}")
