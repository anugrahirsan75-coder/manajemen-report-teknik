# Project Brief — Manajemen Report Teknik ASDP Ternate

Paste seluruh isi file ini sebagai context awal di OpenCode / agent lain.

---

## Identitas
- **Nama app**: Manajemen Report Teknik ASDP Ternate
- **Pemilik / pengguna**: Tim Teknik PT. ASDP Indonesia Ferry (Persero), Cabang Ternate
- **Status**: **SUDAH DI-DEPLOY KE INTERNET** (Vercel). Branch utama `main`. Tiap `git push main` → auto-redeploy.
- **Repo GitHub**: https://github.com/anugrahirsan75-coder/manajemen-report-teknik
- **URL produksi**: (isi URL Vercel-mu setelah deploy, mis. `https://manajemen-report-teknik.vercel.app`)
- **Lokal dev**: `D:\ASDP\02. PROJEK\files\generator-swakelola` di Windows; port **3001** prod (`next start -p 3001`). Watchdog Scheduled Task tiap 5 menit auto-restart.

## Stack
- **Next.js 14** App Router + TypeScript + Tailwind CSS + Plus Jakarta Sans
- **Supabase** (DB + Storage bucket `foto` Public)
- **exceljs** (Excel umum) + **pizzip raw-XML** (SPPBJ & Non PR PO — exceljs merusak template tertentu)
- **docx** (Word) + **tesseract.js** (OCR)
- **PDF**: MS Office COM (`scripts/to-pdf.ps1`) — **LOKAL ONLY**. Online di-gate via `DISABLE_OFFICE_PDF=1` + `NEXT_PUBLIC_ENABLE_PDF=false`; user pakai Excel → Save As PDF manual.

## Otentikasi
- Login wajib via `/login`. Middleware `src/middleware.ts` kunci semua route kecuali `/login`, `/api/auth/*`, aset statis.
- Env `APP_USERS="user1:pass1,user2:pass2"` + `AUTH_TOKEN=<rahasia>`. Cookie sesi `mrt_session` httpOnly 7 hari.
- Tambah/ubah akun = ubah env `APP_USERS` di Vercel → redeploy.

## Modul utama (sidebar)
1. **Dashboard Anggaran** (`/dashboard`) — Resume terpisah: gabung SPPBJ + Non PR PO, RKA acuan pusat, penyerapan per Mata Anggaran (Biaya/Investasi) + per kapal, Rencana & Realisasi bulanan (3 MA biaya × 13 kapal, simpan ke Supabase `projects.payload.kind='anggaran'`).
1b. **Ship Database** (`/kapal`) — data partikular 13 kapal (vessel particulars): General Data, Main Dimension, Main/Auxiliary Engine. Grid kartu + modal editable (cincin kelengkapan %). Seed di `src/lib/kapal/types.ts` (ARIWANGAN terisi dari dokumen, lain skeleton + default ASDP). `useKapalDb()` simpan 1 row Supabase `projects.payload.kind='kapal'` (+ localStorage, merge seed). Menu di Sidebar section "Resume".
2. **Generator Swakelola Docking** (`/`, `/isi-data`, `/dokumen/[slug]`, `/distribusi`) — 7 dokumen docking, OCR, distribusi kalkulator, foto dokumentasi.
3. **Pengajuan Kode Material** (`/material`, `/material/cek`, `/material/isi`) — 4 dokumen + sub-tool **Cek Kode Material** (DB live dari Google Sheet via gviz, 6900+ kode; SC cocok part number abaikan pemisah; barang umum fuzzy match; Purchase Order Text otomatis; Export Excel hasil cek).
4. **SPPBJ Pengadaan** (`/sppbj`, `/sppbj/isi`, `/sppbj/detail`) — workflow SPPBJ→SPBJ→BAPP→BSTB 2 fase, raw-XML, BSTB sheet per kapal (clone), FORMAT SAP. Filter bulan + search. **Katalog HSPK**: tombol 📚 di kolom Nama (`KatalogPicker`) autofill nama/spek/satuan/harga/breakdown dari `src/lib/katalog` (seed 470 item dari RAB; LIVE gviz bila env `NEXT_PUBLIC_KATALOG_CSV_URL` diset). Badge Riil/Pasar. Tombol "Usulan Harga Riil" ekspor realisasi harga per kode → Excel utk update RAB manual. Metadata katalog (`kodeKatalog/sumberHarga`) opsional di SppbjItem — fill.ts/template SPPBJ TIDAK berubah.
5. **SPPBJ Non PR PO** (`/nonpr`, `/nonpr/isi`, `/nonpr/detail`) — formulir Non Purchase Order maks Rp 2.500.000/file, 5 sheet (Database/SPPB/spkh/BSTB/Foto), band tabel **dinamis** (insert raw-XML — tak ada batas kapasitas), BSTB per kapal + clone drawing (logo), foto via Storage bucket.
6. **Monitoring Servis Bengkel** (`/servis`, `/servis/isi`) — tracking barang kapal di bengkel: 4 status, lama hari + telat, foto, biaya, Export Excel landscape (kolom Foto embed gambar dalam cell), filter bulan + status + kapal, KPI cards.

## Foto — sistem HYBRID
- Komponen reusable `src/components/FotoUploader.tsx`: pilih file · drag-drop · **paste Ctrl+V** screenshot · tombol "Ambil dari Clipboard" (navigator.clipboard.read).
- `src/lib/fotoStorage.ts` `uploadFoto()`: kompres canvas 1024px/jpeg 0.72 → upload ke Supabase Storage bucket **`foto`** (Public, INSERT policy anon) → URL publik. **Fallback base64 di DB** kalau bucket gagal (nol regresi).
- `src/lib/server/foto.ts` `resolveFotoBuffer`/`fotoToDataUrl`: handle URL http (fetch) ATAU data URL base64 — dipakai semua embed Excel (servis export, nonpr fill, swakelola dokumentasi).
- Foto lama base64-di-DB tetap jalan.

## Environment Variables (Vercel & lokal)
```
NEXT_PUBLIC_SUPABASE_URL=https://odsjeazutvwrowbhmpkg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_kYKdkGi6nJ8R92aZY4fe_Q_ntC0xT2a
DISABLE_OFFICE_PDF=1
NEXT_PUBLIC_ENABLE_PDF=false
APP_USERS=admin:<pwd>,teknik:<pwd>
AUTH_TOKEN=<string acak 24+ byte hex>
MATERIAL_DB_CSV_URL=(opsional override gviz URL DB material)
```

## Database Supabase
- 1 tabel `projects(id uuid, nama_kapal text, tahun int, payload jsonb, created_at)` RLS anon. Reuse untuk semua: `payload.kind` ∈ {swakelola(null)|sppbj|nonpr|servis|anggaran}.
- Storage bucket **`foto`** (Public, anon INSERT). Path: `YYYY-MM/<timestamp>-<rand>.jpg`.

## Constraint penting (untuk agent baru)
- **JANGAN pakai exceljs untuk SPPBJ Pengadaan (`templates/sppbj/sppbj.xlsx`) & SPPBJ Non PR PO (`templates/nonpr/nonpr.xlsx`)** — round-trip merusak (Excel tolak buka, atau PDF Office COM gagal). Pakai **pizzip raw-XML** (engine reuse `src/lib/sppbj/fill.ts` `applyEdits`/`sheetXmlPath`/`saveZip`).
- exceljs **AMAN** untuk: workbook dari nol (servis export, material cek-export) + template Material (`templates/material/*.xlsx`) + template Swakelola.
- PDF di route API harus cek `process.platform !== "win32" || process.env.DISABLE_OFFICE_PDF === "1"` → return 501. Tombol PDF di client disembunyikan via `NEXT_PUBLIC_ENABLE_PDF !== "false"`.
- Production = `next start -p 3001`. Setiap perubahan kode di lokal → `npm run build` → `taskkill PID 3001` → watchdog restart (atau `schtasks /run /tn "ASDP Server Watchdog"`).
- Online (Vercel) tak perlu watchdog/build manual.
- Nama kapal di Dashboard selalu LENGKAP (mapping singkatan via `SINGKATAN_KAPAL` di `src/lib/anggaran/types.ts`).

## File-file kunci
- `src/middleware.ts` — gerbang auth
- `src/components/Sidebar.tsx` — navigasi 5 tool + Dashboard, logout, dark mode
- `src/components/Field.tsx` — Section/Input/Select/Textarea konsisten
- `src/components/FotoUploader.tsx` — uploader paste/drag/click
- `src/lib/supabase.ts` — client (null kalau env kosong → app fallback localStorage)
- `src/lib/sppbj/fill.ts` — engine raw-XML (dipakai juga sppbj/fill2 + nonpr/fill)
- `src/lib/material/kodeCheck.ts` — live sync gviz Google Sheet
- `scripts/to-pdf.ps1` — Office COM PDF (lokal)
- `next.config.mjs` — `outputFileTracingIncludes` template & DB JSON
- `DEPLOY.md` — panduan deploy Vercel lengkap

## Cara kerja yang sudah disepakati
- **PDF lokal-only**: tombol PDF muncul cuma di lokal; online user buka Excel lalu Save As PDF
- **Watchdog & auto-start**: vbs Startup login + Scheduled Task tiap 5 mnt cek port 3001 → restart (lokal saja)
- **Foto base64 lama** tetap diembed dengan benar (resolveFotoBuffer)
- **Filter bulan** di SPPBJ, Non PR PO, Servis, Dashboard
- **Hapus akun GitHub PAT setelah dipakai sekali** — jangan hardcode kredensial

## Yang BELUM (kalau perlu kerjakan ke depan)
- Migrasi foto base64 lama di DB → Storage (script one-off)
- Rencana/Realisasi bulanan auto-sync dari Google Drive Sheet (sekarang input manual)
- Multi-user advanced (Supabase Auth) — sekarang single-cookie sederhana
- Generate-all zip multi-file SPPBJ Non PR PO

---

### Tugas yang ingin kuminta dari agent (isi sebelum paste):
> [Tulis di sini apa yang mau dikerjakan oleh OpenCode]
