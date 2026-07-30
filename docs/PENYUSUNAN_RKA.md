# Penyusunan RKA Pemeliharaan Kapal — Hasil Pembelajaran Berkas 2026

> Sumber: folder `Penyusunan RKA/` (32 MB). Dipelajari 30 Juli 2026 sebagai dasar
> fitur **Rencana RKA** (untuk menyusun RKA 2027).

## 1. Isi folder

| Berkas | Isi |
|---|---|
| `01. RKA PEMELIHARAAN KAPAL TERNATE 2026/1..13. KMP. *.xls` | RKA per kapal — **1 kapal = 1 workbook ±34 sheet** (template sama semua) |
| `01. REKAPITULASI Total RKA Biaya Kapal Ternate 2026.xls` | Rekap cabang: baris = Mata Anggaran lama, kolom = 13 kapal, total **Rp 28.685.605.218** |
| `00. Prognosa Biaya Kapal 2025 ok.xlsx` / `Real dan Prog Kapal Tahun 2025.xlsx` | Prognosa: RKA tahun lalu vs realisasi PJK (Versi A) vs perhitungan RKAC (Versi B) + deviasi %; sheet per bulan = daftar SPPBJ s/d kontrak |
| `14. Jadwal Docking ... 2026.xlsx/pdf` | Jadwal docking nasional; blok TERNATE: Lema Jan, Gorango Feb, Sagori Apr, Tuna Mei, Ariwangan+Maming Jun, Baronang Jul, Lompa+Bobara Ags, Ngafi Sep |
| `USULAN INVESTASI KAPAL CAB TERNATE 2026.xlsx` | Pohon komponen aset kapal berkode (1A11 Konstruksi… 2B17 Rantai Jangkar) + umur manfaat (5/10/30 th) → dasar usulan investasi |

## 2. Anatomi workbook per kapal (template baku, contoh KMP. TUNA)

Empat kelompok sheet:

**A. Parameter (input dasar)**
- `SHIP PARTICULAR` — data kapal
- `Parameter perhitungan` — GRT, ME/AE (unit × HP), lintasan, jarak, kecepatan,
  hari operasi (366), trip/tahun (220), constanta pelumas (0.001 — SOC),
  kapasitas oil pan ME/AE, harga pelumas per liter
- `Pola Ops` — lintasan I/II/III + trip/hari + jam/trip → **jam kerja mesin per tahun**

**B. Perhitungan per Mata Anggaran**
- `PELUMAS` + `Par. pelumas ...` — topping-up = constanta × rendemen 0.8 × HP total × harga/liter; + penggantian oil pan per interval
- `KAPAL RORO` (docking): `Mobilisasi Docking` (BBM+pelumas+air+ABK dari jarak ke galangan), `Fumigasi`, `Surat Kapal`, `Mat owner supplay` (cat & anode), `RL` (repair list) → `Total Kapal RO-Ro`
- `AKOMODASI`: `Deck` (412 baris kebutuhan rutin bulanan/2-bulanan/BGA/AGA per ruangan), `Perlengkapan Kapal`, `Peralatan Kapal`, `Alat Keselamatan`, `PMK`, `ILR_TOTAL` → `Total akomodasi`
- `PERMESINAN`: **sistem Tingkat Perawatan (TP1–TP6 = harian/250/500/1000/2500/5000 jam)**
  - `Item TP ME/AE/Pes. Bantu` — objek perawatan per sistem (pelumasan, pendingin, dst.)
  - `Schedule TP` — jam kerja kumulatif per minggu (dari Pola Ops) → otomatis jatuh TP berapa di minggu mana; bulan docking ditandai DOCKING
  - `Biaya TP ME/AE/Pes. Bantu` — suku cadang per TP (part number, qty, harga) × jadwal → biaya per bulan
  - `Kebutuhan Rutin` — peralatan kerja/listrik/bahan rutin bulanan mesin
- `Beban Biaya Inv` + komponen aset → usulan investasi

**C. Rekap kapal**
- `REKAPITULASI ` (spasi di ujung!) — baris = **M.A. akuntansi lama** (bukan kode SAP),
  kolom = JANUARI–AGUSTUS (8 bulan; SEP–DES tidak ada di RKA 2026), bulan docking = lonjakan
- `REKAP BIAYA PEMELIHARAAN` — versi ringkas

**D. Rekap cabang** — `REKAPITULASI KAPAL`: baris M.A. × kolom 13 kapal + JUMLAH.

## 3. Peta kode M.A. RKA lama ⇄ kode SAP di aplikasi

| M.A. RKA (lama) | Uraian | Kode aplikasi (SAP) |
|---|---|---|
| 5.1.02.02.00.00 | Pelumas dan Gemuk | 5010303001 (+ 5010303002 mobilisasi pelumas) |
| 5.1.02.05.00.00 | Perlengkapan Kapal | bagian dari 5010403009 |
| 5.1.03.01.00.00 | Docking Tahunan (a. Docking Induk, b. Mat Owner Supply, c. Surat Kapal, d. SPJ OS, e. **Swakelola**) | 5010403003 dkk (pagu Docking per kapal) |
| 5.1.03.04.00.00 | Pemeliharaan Deck (Rutin/BGA/AGA) | 5010403009 |
| 5.1.03.05.00.00 | Pemeliharaan Mesin (Rutin, TP ME/AE/Pes. Bantu) | 5010403100 |
| 5.1.03.06.00.00 | Pemeliharaan Peralatan Kapal | 5010403009 |
| 5.1.03.07.00.00 | Alat Keselamatan (incl. PMK/ILR) | 5010403009 |
| 5.0.10.51.20.03 | Beban Fumigasi | 5011099006 |
| 5.1.03.08.00.00 | Mobilisasi Docking | 5010302004 |
| — | Sertifikasi docking | 5010318000 |
| investasi (pohon aset 1A…/2B…) | umur manfaat 5/10/30 th | 1020604003/009/010 |

Angka penting RKA 2026: total cabang **28,69 M** (Pelumas 2,35 M · Docking 13,39 M ·
Deck 5,35 M · Mesin 5,23 M · Alat Keselamatan 2,15 M · Peralatan 0,45 M ·
Perlengkapan 0,72 M · Fumigasi 0,30 M · Mobilisasi 2,05 M). Swakelola per kapal
di RKA (mis. Ariwangan 5.409.375) = angka Generator Swakelola.

## 4. Metode prognosa (dasar usulan tahun berikutnya)

Tabel per kapal × jenis biaya: `RKA tahun berjalan` | `realisasi s/d saat ini` |
`estimasi sisa tahun` (Versi A = dari realisasi PJK; Versi B = dari perhitungan RKAC)
→ `PROGNOSA = realisasi + estimasi` → `DEVIASI % terhadap RKA`. Lampiran bukti:
daftar SPPBJ/kontrak per bulan (No. PR, RFQ, SPPBJ, nilai, acc assignment, nama
pekerjaan, material group, metode PBJ).

## 5. Integrasi dengan data aplikasi (bekal fitur "Rencana RKA 2027")

Yang SUDAH ada di aplikasi dan tinggal dipakai:
1. **Realisasi 2026 per MA per bulan per kapal** (SPPBJ + Non PR PO) → pengganti
   lampiran PJK prognosa; prognosa 2026 bisa dihitung otomatis.
2. **Pagu Rutin bulanan + pagu Docking per kapal (+addendum)** → kolom "RKA 2026"
   pembanding.
3. **Ship Database** → SHIP PARTICULAR + parameter (GT, ME/AE unit×HP dari
   `Daya ME`, lintasan) — sebagian parameter pelumas (kapasitas oil pan, trip,
   kecepatan) belum ada → perlu field tambahan.
4. **Monitoring Docking** (tanggal nyata + termin + lama) → dasar jadwal docking
   2027 + biaya docking (kontrak).
5. **Katalog HSPK** → harga satuan untuk kebutuhan rutin Deck/Mesin.
6. **Generator Swakelola** → komponen "e. Swakelola" pada Docking Tahunan.
7. **Kelas BKI** (AS/SS/DS) → kapal yang SS tahun 2027 dianggarkan lebih besar.

Usulan bentuk fitur (belum dibangun): modul `/rka` dengan (a) parameter per kapal,
(b) mesin hitung pelumas (rumus SOC) + jadwal TP dari jam operasi, (c) kebutuhan
rutin Deck/Mesin dari template + katalog, (d) prognosa otomatis dari realisasi,
(e) rekap per kapal ×12 bulan + rekap cabang, (f) export Excel meniru layout
REKAPITULASI (baris M.A. lama, kolom bulan/kapal) supaya diterima pusat.

## 6. Jebakan teknis

- Berkas per kapal = **.xls lama** → baca dengan `xlrd`, bukan openpyxl.
- Nama sheet `REKAPITULASI ` berspasi ujung; ada sheet kosong (`PELUMAS`, `KAPAL
  RORO` di beberapa kapal — isinya pindah ke sheet parameter).
- Banyak sel berisi rumus antar-sheet; nilai float panjang (mis. 16149555.9808…)
  — jangan dibulatkan saat migrasi, bulatkan hanya di tampilan.
- RKA 2026 hanya 8 bulan (Jan–Ags). RKA 2027 kemungkinan 12 bulan — jangan
  hardcode 8.
- Kolom rekap cabang: KOLORAI memakai kolom P dengan header nomor ganda ("14"
  dua kali) — jangan andalkan nomor kolom, andalkan nama kapal.
