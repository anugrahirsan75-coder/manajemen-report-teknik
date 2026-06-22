# Konsep: Katalog Pengadaan Cerdas (SPPBJ) — integrasi KATALOG RAB/HSPK

Status: **TERIMPLEMENTASI Fase A-C (2026-06-22).** Tujuan: autofill SPPBJ dari katalog harga
satuan (HSPK) + riwayat pengadaan. **Format/template SPPBJ Pengadaan TIDAK diubah.** Manual tetap ada.

## Implementasi (yang sudah jadi)
- Seed offline: `src/lib/katalog/katalogSeed.json` (470 item, 241 ber-breakdown) di-generate dari
  RAB via `scripts/gen-katalog-seed.cjs` (sheet KATALOG + 2 sheet Detail).
- Data layer: `src/lib/katalog/source.ts` — `getKatalog()` (seed default; gviz LIVE bila env
  `NEXT_PUBLIC_KATALOG_CSV_URL` [+ `..._BREAKDOWN_CSV_URL`] diset), `searchKatalog()` multi-token.
- UI: `src/components/KatalogPicker.tsx` (tombol 📚 popover cari) di `/sppbj/isi` kolom Nama ->
  auto-isi nama/spesifikasi/satuan/harga/breakdown + badge Riil✓/Pasar⚠. Field metadata opsional
  `kodeKatalog/sumberHarga/kategoriKatalog` di SppbjItem (diabaikan fill.ts -> output SPPBJ tetap).
- Feedback loop: tombol "📤 Usulan Harga Riil" di `/sppbj` -> `POST /api/sppbj/usulan-harga-export`
  (exceljs) kumpulkan harga final (hargaSpbj) per kode -> Excel usulan update Riil utk ditinjau manual.
- Untuk aktifkan LIVE: publish KATALOG (+BREAKDOWN flat: Kode|Uraian|Volume|Satuan|HargaSatuan|Spesifikasi)
  ke Google Sheet, set env gviz CSV. Tanpa env -> tetap jalan dari seed.

---
## (Konsep awal — arsip)

## Keputusan pemilik (terkunci)
1. Sinkronisasi: **Google Sheet live (gviz)** — pola sama dgn DB Cek Kode Material.
2. Harga "Pasar": **tampil + badge peringatan** (perlu verifikasi), harga tetap bisa dipakai/diedit.
3. Feedback loop: **YA, ekspor terpisah** — harga final SPPBJ -> usulan update "Riil" yang ditinjau manual ke RAB.
4. Breakdown jasa: **YA, auto-isi** field breakdown[] dari rincian detail.

## Sumber: KATALOG RAB (file RAB_MASTER_Lengkap_v3.xlsx)
Sheet `KATALOG (Lookup)`, data baris 5-474, 470 item:
`Kode | Jenis | Kategori | Nama | Spesifikasi/Ukuran | Satuan | Harga Satuan (Rp) | Sumber`
- Jenis: JASA 209, BARANG 261. Sumber: Riil 213, Pasar 257. 35 kategori.
- Breakdown terperinci ada di sheet `Jasa Ferry Detail` / `Barang Ferry Detail` (kode JS2-/BR2-).

## Pemetaan ke SppbjItem (kenapa format SPPBJ aman)
| KATALOG | SppbjItem | Dipakai fill.ts/template? |
|---|---|---|
| Nama | `nama` | ya (sudah) |
| Spesifikasi/Ukuran | `spesifikasi` | ya (sudah) |
| Satuan | `satuan` | ya (sudah) |
| Harga Satuan | `harga` (estimasi) | ya (sudah) |
| (breakdown detail) | `breakdown[]` | ya (sudah) |
| Kode | `kodeKatalog?` (BARU, opsional) | TIDAK |
| Sumber | `sumberHarga?` (BARU, opsional) | TIDAK |
| Kategori | `kategoriKatalog?` (BARU, opsional) | TIDAK |

fill.ts hanya baca nama/spesifikasi/satuan/harga/breakdown. Field baru = metadata opsional ->
output Excel & template SPPBJ tidak berubah. Zero regresi.

## Arsitektur (meniru pola material yang sudah jalan)
- `src/lib/katalog/types.ts` — `KatalogItem` + `BreakdownRow`.
- `src/lib/katalog/source.ts` — fetch gviz 2 sheet (KATALOG + BREAKDOWN), parse, cache localStorage,
  fallback ke seed JSON bila offline/gagal (persis `kodeCheck.ts`).
- `src/lib/katalog/katalogSeed.json` — snapshot offline (di-generate sekali dari xlsx).
- Reuse mesin pencarian Cek Kode Material: multi-token, abaikan tanda baca, fuzzy.

### Sumber gviz (yang harus disiapkan di Google Sheet)
1. Sheet **KATALOG**: kolom Kode|Jenis|Kategori|Nama|Spesifikasi|Satuan|Harga|Sumber (header 1 baris).
2. Sheet **BREAKDOWN** (untuk auto-isi rincian): format flat per baris ->
   `Kode | Uraian | Volume | Satuan | HargaSatuan | Spesifikasi`. App grup per Kode.
   (Item tanpa baris breakdown -> tetap jalan, breakdown kosong.)
Endpoint pola: `.../gviz/tq?tqx=out:csv&gid=<gid_sheet>`.

## UX di /sppbj/isi (combobox, bukan dropdown terkunci)
- Kolom Nama Barang/Jasa jadi combobox: ketik -> saran dari KATALOG + riwayat SPPBJ.
- Saat saran dipilih: auto-isi spesifikasi, satuan, harga, breakdown[]; simpan kodeKatalog+sumberHarga.
- Tampilkan konteks: "HSPK Rp 1.500.000 (Pasar, perlu verifikasi) - terakhir dipakai Rp 1.350.000 (Jun 2026)".
- Item Pasar -> badge kuning. Tidak diblok; harga editable.
- Kosongkan saran -> ketik manual seperti sekarang.

## Feedback loop (ekspor terpisah, RAB tak diubah otomatis)
- SppbjItem menyimpan `kodeKatalog` saat dipilih dari katalog.
- Tombol "Ekspor Usulan Harga Riil" (di /sppbj atau halaman katalog) kumpulkan dari seluruh riwayat
  SPPBJ yang sudah ada harga final (hargaSpbj): `Kode | Nama | Harga HSPK | Harga Aktual | Selisih |
  Tanggal | No SPBJ | Vendor | Sumber->Riil`. Output Excel (exceljs from-scratch).
- Pemilik tinjau -> masukkan ke RAB master (Excel/Python) manual. App tak pernah tulis ke RAB.

## Asumsi yang perlu dikonfirmasi
- Harga satuan KATALOG = pre-PPN (PPN 11% ditangani di rekap RAB). SPPBJ estimasi diasumsikan pre-PPN juga.
- Pencocokan kode breakdown: hanya item ber-detail (Set 2 JS2-/BR2-) yang punya breakdown; Set 1 tanpa.

## Build bertahap (usulan)
1. Fase A: source gviz katalog + seed fallback + combobox Nama (autofill spek/satuan/harga). [inti]
2. Fase B: auto-isi breakdown[] + badge Pasar + konteks harga riwayat.
3. Fase C: ekspor "Usulan Harga Riil" (feedback loop).
4. (opsional) Halaman "Katalog Pengadaan" untuk telusur + filter kategori/kapal.

## Yang dibutuhkan dari pemilik untuk mulai
- URL Google Sheet berisi sheet KATALOG (+ BREAKDOWN), di-set "siapa saja yang punya link bisa lihat".
- gid tiap sheet (dari URL saat tab dibuka).
- (saya bisa bantu generate CSV siap-upload KATALOG & BREAKDOWN dari xlsx supaya tinggal tempel.)
