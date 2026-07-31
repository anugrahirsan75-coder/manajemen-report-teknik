# -*- coding: utf-8 -*-
"""
Ambil RKA 2026 dari "KONTROL ANGGARAN TERNATE.xlsx" (folder Perencanaan Docking).

Tiga sheet dipakai:
  DOCKING   -> pagu docking per kapal per Mata Anggaran (8 baris tiap kapal)
  Investasi -> rencana investasi per kapal (belanja modal)
  RUTIN     -> pagu rutin per kapal per Mata Anggaran per bulan

Kode Mata Anggaran-nya dicocokkan ke master yang dipakai aplikasi
(src/lib/anggaran/types.ts) supaya angkanya langsung bisa diadu dengan realisasi
SPPBJ, bukan sekadar ditumpuk sebagai catatan.
"""
import json, re, openpyxl

SRC = r"D:/ASDP/01. ASDP TERNATE/2024 ASDP TERNATE/ASDP TERNATE/PERENCANAAN DOCKING/2026/KONTROL ANGGARAN TERNATE.xlsx"
OUT = "src/lib/anggaran/rka2026.json"
TAHUN = 2026

# label pada berkas -> kode MA master aplikasi
MA = [
    (r"kapal ro-?ro|penyebrangan|penyeberangan", "5010403003"),
    (r"permesinan", "5010403100"),
    (r"akomodasi", "5010403009"),
    (r"sertifikat|sertifikasi", "5010318000"),
    (r"fumigasi", "5010302006"),
    (r"mobilisasi", "5010302004"),
    (r"pengangkutan pelumas", "5010303002"),
    (r"pelumas", "5010303001"),
]
def kodeMa(label):
    t = (label or "").strip().lower()
    for pola, kode in MA:
        if re.search(pola, t): return kode
    return ""

def kodeInvestasi(uraian):
    t = (uraian or "").lower()
    if re.search(r"permesinan|kelistrikan|mesin", t): return "1020604010"
    if re.search(r"akomodasi|peralatan|perlengkapan", t): return "1020604009"
    return "1020604003"

n = lambda v: round(v) if isinstance(v, (int, float)) else 0
s = lambda v: "" if v is None else str(v).replace("\n", " ").strip()

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)

# ── DOCKING ──────────────────────────────────────────────────────────────────
docking = {}
for r in wb["DOCKING"].iter_rows(min_row=4, max_row=200, max_col=12, values_only=True):
    kapal, label = s(r[1]), s(r[2])
    if not kapal or not label: continue
    kode = kodeMa(label)
    if not kode: continue
    d = docking.setdefault(kapal, {})
    d[kode] = {
        "rka": n(r[3]), "tambahan": n(r[5]), "persetujuan": n(r[6]),
        "release": n(r[9]), "realisasi": n(r[10]), "label": label,
    }

# ── INVESTASI ────────────────────────────────────────────────────────────────
investasi = []
for r in wb["Investasi"].iter_rows(min_row=2, max_row=400, max_col=8, values_only=True):
    kapal, uraian, program, nilai = s(r[2]), s(r[3]), s(r[4]), n(r[5])
    if not kapal or not nilai: continue
    investasi.append({"kapal": kapal, "ma": kodeInvestasi(uraian), "uraian": uraian,
                      "program": program, "nilai": nilai})

# ── RUTIN (12 bulan x 4 kolom: RKA / PERSETUJUAN / RILIS / SUBSIDI) ───────────
rutin = {}
for r in wb["RUTIN"].iter_rows(min_row=4, max_row=400, max_col=52, values_only=True):
    kapal, label = s(r[1]), s(r[2])
    if not kapal or not label: continue
    kode = kodeMa(label)
    if not kode: continue
    # kolom D (indeks 3) mulai Januari, tiap bulan 4 kolom
    bulanan = [n(r[3 + b * 4]) for b in range(12)]
    if not any(bulanan): continue
    rutin.setdefault(kapal, {})[kode] = bulanan

wb.close()
data = {
    "tahun": TAHUN,
    "sumber": "KONTROL ANGGARAN TERNATE.xlsx (folder Perencanaan Docking 2026)",
    "docking": docking, "investasi": investasi, "rutin": rutin,
}
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)

tot = lambda d: sum(v["rka"] for k in d.values() for v in k.values())
print(f"{OUT}")
print(f"  DOCKING   : {len(docking)} kapal · RKA {tot(docking):,}".replace(",", "."))
print(f"  INVESTASI : {len(investasi)} baris · {sum(x['nilai'] for x in investasi):,}".replace(",", "."))
print(f"  RUTIN     : {len(rutin)} kapal · RKA setahun "
      f"{sum(sum(b) for k in rutin.values() for b in k.values()):,}".replace(",", "."))
