# Format Baku Katalog Live (Google Sheet / gviz)

File live = Google Sheet berisi 2 tab dengan kolom PERSIS di bawah. Parser app cocokkan kolom
dari **nama header** (toleran urutan & huruf besar/kecil), tapi jaga nama header mengandung kata kunci.

## Generate file siap-upload
```
node scripts/gen-katalog-live.cjs            # baca RAB_MASTER_Lengkap_v3.xlsx
# -> output/katalog/Katalog_Live.xlsx (2 sheet) + KATALOG.csv + BREAKDOWN.csv
```

## Sheet 1 — "KATALOG" (item harga satuan)
| Kolom | Wajib | Catatan |
|---|---|---|
| Kode | ya | unik, mis. `JS2-HL-002` (jadi kunci pencocokan & feedback harga) |
| Jenis | ya | `JASA` / `BARANG` |
| Kategori | ya | mis. `Docking & Lambung` |
| Nama | ya | nama pekerjaan/barang |
| Spesifikasi | ya | spesifikasi / ukuran |
| Satuan | ya | mis. `Unit`, `m2`, `Set` |
| Harga | ya | angka, **pre-PPN** (tanpa titik/Rp) |
| Sumber | ya | `Riil` (terverifikasi) / `Pasar` (estimasi, perlu verifikasi) |

## Sheet 2 — "BREAKDOWN" (rincian komponen, opsional)
Satu baris = satu komponen. Item tanpa baris di sini -> breakdown kosong (tetap jalan).
| Kolom | Wajib | Catatan |
|---|---|---|
| Kode | ya | harus sama dgn Kode di sheet KATALOG |
| Uraian | ya | nama komponen (yang dipakai app jadi baris rincian SPPBJ) |
| Volume | tidak | angka |
| Satuan | tidak | mis. `OH`, `Kg`, `Ltr` |
| HargaSatuan | tidak | angka |
| Spesifikasi | tidak | catatan komponen |

> App saat ini ambil **Kode + Uraian** dari sheet BREAKDOWN. Kolom lain disimpan utk referensi/masa depan.

## Upload ke Google Sheets
1. Buka https://drive.google.com -> New -> File upload -> `output/katalog/Katalog_Live.xlsx`.
2. Klik kanan file -> Open with -> Google Sheets (jadi spreadsheet asli, 2 tab).
   (alternatif: buat Sheet kosong, File -> Import tiap CSV ke tab terpisah.)
3. Share -> "Anyone with the link" -> **Viewer**.
4. Ambil **gid** tiap tab: klik tab, lihat URL `...#gid=ANGKA`.

## Set env (Vercel + lokal .env.local)
```
NEXT_PUBLIC_KATALOG_CSV_URL=https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:csv&gid=<gid_KATALOG>
NEXT_PUBLIC_KATALOG_BREAKDOWN_CSV_URL=https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:csv&gid=<gid_BREAKDOWN>
```
- `<ID>` = bagian URL antara `/d/` dan `/edit`.
- Tanpa env -> app tetap jalan dari seed offline (`src/lib/katalog/katalogSeed.json`).
- Setelah set env di Vercel -> Redeploy. Edit harga di Google Sheet -> langsung kepakai (gviz no-cache).

## Sinkron seed offline (opsional)
Bila katalog berubah & mau seed bundled ikut terbaru:
```
node scripts/gen-katalog-seed.cjs   # regenerate src/lib/katalog/katalogSeed.json -> commit
```
