# Generator Swakelola Docking — PT. ASDP Indonesia Ferry (Cabang Ternate)

Generator dokumen swakelola docking kapal. Satu input data → 8 dokumen, masing-masing bisa di-generate ke **PDF**, **Word**, atau **Excel**.

## Jalankan (localhost demo)

```bash
npm install
npm run dev
```

Buka http://localhost:3000

## Alur pakai

1. Klik **Isi / Ubah Data** → isi tahun, nomor SPK, kapal, tanggal mulai/selesai, biaya, pejabat, perwira, mesin (GO/TO), crew. Otomatis tersimpan di browser (localStorage).
2. Dari Dashboard, buka tiap dokumen → klik tombol:
   - **📄 Generate PDF** — buka dialog cetak, pilih "Simpan sebagai PDF".
   - **📝 Word** — hanya File 01 (SPK), unduh `.docx`.
   - **📊 Excel** — File 02–08, unduh `.xlsx`.

## 8 Dokumen

| # | Dokumen | Format | Catatan |
|---|---------|--------|---------|
| 01 | SPK Swakelola Docking | PDF + Word | Nomor/tahun, kapal, kapten, GM, tanggal **mulai**, biaya, jangka waktu |
| 02 | Berita Acara Swakelola | PDF + Excel | Tanggal **selesai**, ref SPK, kapten/KKM/OS/Muallim I, mesin GO/TO |
| 03 | Daftar Perhitungan | PDF + Excel | **OCR**: tombol upload gambar Nilai Bruto & PPH 21 → angka terisi otomatis urut crew |
| 04 | Lampiran SPK | PDF + Excel | Ref SPK + tgl selesai, kapten, GM, pekerjaan mesin GO/TO |
| 05 | Daftar Nominatif PPH 21 | PDF + Excel | Crew, NIK, cost center, NPWP, tgl/no SPM, jumlah dari File 03 |
| 07 | Surat Pernyataan Kebenaran Harga | PDF + Excel | Kapal, nilai swakelola, tahun, tgl selesai, kapten |
| 08 | Dokumentasi Docking | PDF + Excel | Tombol upload foto **DECK** & **MESIN**, embed ke dokumen |

## Tanggal

Hanya **dua** tanggal dipakai seluruh dokumen:
- **Tanggal Mulai** → File 01 (SPK)
- **Tanggal Selesai** → File 02, 04, 07 + tanggal dokumen

## OCR (File 03)

Pakai `tesseract.js` di browser (gratis, offline setelah model ter-cache). Upload screenshot kolom angka — dibaca berurutan & dicocokkan ke crew sesuai urutan. **Selalu periksa hasilnya** dan koreksi manual di menu Isi Data bila ada salah baca.

## Supabase (opsional)

Demo jalan tanpa Supabase (mode lokal). Untuk aktifkan penyimpanan cloud:

1. Buat project di supabase.com.
2. Jalankan `supabase_schema.sql` di SQL Editor.
3. Copy `.env.local.example` → `.env.local`, isi `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Restart `npm run dev`. Badge "Supabase aktif" muncul; tombol **Simpan** menyimpan ke cloud.

## Stack

Next.js 14 · TypeScript · Tailwind · `docx` (Word) · `exceljs` (Excel) · `tesseract.js` (OCR) · Supabase.

## Cara generate (template-fill)

Output BUKAN rekonstruksi — generator memakai **file asli kamu** di `templates/` sebagai template dan hanya menimpa nilai variabel (nama, tanggal, angka, GO/TO), jadi format + logo persis aslinya.

- **Word/Excel**: server isi template lalu kirim file (`/api/generate` format `native`).
- **PDF**: file hasil dikonversi via **MS Office COM** (`scripts/to-pdf.ps1`) → PDF identik. Butuh MS Office terpasang (Windows). Logo file 02–05 & 08 disisipkan ulang dari `templates/logo_asdp.png` (export Google Sheets menghilangkan logo).

Petakan ulang sel jika template berubah: `node scripts/inspect.mjs <file.xlsx>`.

## Supabase

Sudah terhubung ke project `odsjeazutvwrowbhmpkg` via `.env.local` (publishable key). Tabel `projects`. Mode lokal otomatis dipakai bila env kosong.
