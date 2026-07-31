# -*- coding: utf-8 -*-
"""
Ambil kerangka Repair List baku dari berkas RL yang sudah dipakai ke pusat
(KMP. GORANGO 2025) supaya penyusunan RL kapal lain tidak mulai dari kosong.

Yang diambil hanya STRUKTURnya: bagian (OM-01 dst.), sub-judul, uraian
pekerjaan, satuan, dan volume contoh — bukan harganya, karena harga menyusul
dari tarif galangan / database harga.
"""
import json, re, openpyxl
SRC = r"D:/ASDP/01. ASDP TERNATE/2024 ASDP TERNATE/ASDP TERNATE/PERENCANAAN DOCKING/2025/03. DOCKING/02. KMP GORANGO/RL KE PUSAT/REPAIR LIST DOCKING KMP GORANGO TAHUN 2025.xlsx"
OUT = "src/lib/docking/rencana/rlTemplate.json"
ROMAWI = {"I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV"}

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
def ambil(nama_sheet, jenis):
    ws = wb[nama_sheet]
    bagian, bg, sub = [], None, ""
    for r in ws.iter_rows(min_row=13, max_row=400, max_col=31, values_only=True):
        s = lambda i: ("" if r[i] is None else str(r[i]).replace("\n", " ").strip())
        no, kode, subkode, uraian = s(1), s(2), s(3), s(4)
        vol, unit, ket = r[22], s(23), s(26)
        if no.upper() in ROMAWI and uraian:
            bg = {"romawi": no.upper(), "kode": kode, "nama": uraian, "item": []}
            bagian.append(bg); sub = ""; continue
        if bg is None: continue
        # "A. General Service" / "B. Docking & Undocking" = sub-judul di dalam bagian
        m = re.match(r"^([A-Z])\.\s+(.+)$", uraian)
        if m and not kode and not unit:
            sub = m.group(2).strip(); continue
        if not uraian: continue
        bg["item"].append({
            "kode": kode or bg["kode"], "sub": subkode, "grup": sub,
            "uraian": uraian[:220], "satuan": unit,
            "vol": vol if isinstance(vol, (int, float)) else None,
            "ket": ket or jenis,
        })
    return bagian

data = {
    "sumber": "REPAIR LIST DOCKING KMP GORANGO TAHUN 2025.xlsx",
    "catatan": "Kerangka baku Repair List (tanpa harga). Kode OM/CM mengikuti Docking Code ASDP.",
    "dok": ambil("RL DOK", "Docking Repair"),
    "floating": ambil("RL Floating (2)", "Floating Repair"),
}
n = lambda k: sum(len(b["item"]) for b in data[k])
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{OUT}: DOK {len(data['dok'])} bagian/{n('dok')} item · FLOATING {len(data['floating'])} bagian/{n('floating')} item")
for b in data["dok"]: print(f"   {b['romawi']:<4} {b['kode']:<8} {b['nama'][:44]:<46} {len(b['item'])} item")
