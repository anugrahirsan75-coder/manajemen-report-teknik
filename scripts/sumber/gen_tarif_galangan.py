# -*- coding: utf-8 -*-
"""
Ubah "List Pekerjaan Docking PT IKI UGB - Rev.xlsx" (daftar tarif baku galangan)
menjadi JSON yang dipakai penyusun Repair List.

Struktur berkas asal: kelompok besar (A. PELAYANAN UMUM ... M. PIPA-PIPA), lalu
sub-judul bernomor ("1. Bantuan kapal pandu..."), lalu baris item yang punya
Jumlah/Satuan/Nama/Harga Satuan. Baris tanpa harga = catatan, ikut disimpan
sebagai keterangan sub-judulnya supaya syarat tarif tidak hilang.
"""
import json, re, sys, openpyxl
SRC = r"D:/ASDP/01. ASDP TERNATE/2024 ASDP TERNATE/ASDP TERNATE/PERENCANAAN DOCKING/2026/List Pekerjaan Docking PT IKI UGB - Rev.xlsx"
OUT = "src/lib/docking/rencana/tarifGalangan.json"

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
ws = wb["Daftar Pekerjaan"]
rows = list(ws.iter_rows(min_row=1, max_row=999, max_col=8, values_only=True))

def s(x): return "" if x is None else str(x).replace("\n", " ").strip()
def num(x):
    if isinstance(x, (int, float)): return float(x)
    return None

kelompok, kel, sub = [], None, None
KEL = re.compile(r"^([A-M])\.\s+(.+)$")
SUB = re.compile(r"^(\d+)\.\s*(.+)$")
GRUP = re.compile(r"^([a-z])\.\s+(.+)$")
for i, r in enumerate(rows, 1):
    jml, sat, nama, spek, harga = num(r[1]), s(r[2]), s(r[3]), s(r[4]), num(r[5])
    ket = s(r[7])
    if not nama: continue
    mk = KEL.match(nama)
    if mk and jml is None and harga is None:
        kel = {"kode": mk.group(1), "nama": mk.group(2).strip(), "sub": []}
        kelompok.append(kel); sub = None; continue
    if kel is None: continue
    ms = SUB.match(nama)
    if ms and jml is None and harga is None:
        sub = {"no": ms.group(1), "nama": ms.group(2).strip(), "item": [], "catatan": []}
        kel["sub"].append(sub); continue
    if sub is None:
        sub = {"no": "", "nama": kel["nama"], "item": [], "catatan": []}
        kel["sub"].append(sub)
    # "a. Sch. 40" dst = pengelompokan di dalam sub — dipakai sebagai awalan item
    mg = GRUP.match(nama)
    if mg and jml is None and harga is None:
        sub["grup"] = mg.group(2).strip(); continue
    # baris ber-satuan = tarif, walau harganya masih kosong di berkas asal
    # (mis. General Overhaul per-HP) — tetap dibawa supaya jenjangnya kelihatan
    if jml is not None or (sat and harga is not None):
        sub["item"].append({
            "uraian": nama, "spek": spek, "satuan": sat or "Ls",
            "jml": jml or 1, "harga": round(harga) if harga else 0,
            "grup": sub.get("grup", ""), "ket": ket, "baris": i,
        })
    elif nama:
        sub["catatan"].append(nama)

data = {
    "sumber": "List Pekerjaan Docking PT IKI UGB - Rev.xlsx",
    "catatan": "Tarif baku galangan — dipakai sebagai harga acuan penyusunan Repair List. Harga belum termasuk PPN.",
    "kelompok": kelompok,
}
for k in kelompok:
    for sb in k["sub"]: sb.pop("grup", None)
n = sum(len(sb["item"]) for k in kelompok for sb in k["sub"])
kosong = sum(1 for k in kelompok for sb in k["sub"] for it in sb["item"] if not it["harga"])
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{OUT}: {len(kelompok)} kelompok, {sum(len(k['sub']) for k in kelompok)} sub, {n} item tarif ({kosong} belum berharga)")
