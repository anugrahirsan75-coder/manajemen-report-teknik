# Arsitektur, Logika & Keamanan — Manajemen Report Teknik ASDP Ternate

> Dokumen ini ikut di dalam `source.zip` pada backup kodingan. Dengan ZIP ini +
> dokumen ini + `.env.local`, aplikasi bisa dibangun ulang dari nol di laptop mana pun.

## 1. Ringkasan teknis

| Hal | Nilai |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Penyimpanan | Supabase — **satu tabel `projects`** + Storage bucket `foto` |
| Hosting | Vercel, repo GitHub `anugrahirsan75-coder/manajemen-report-teknik` (branch `main`) |
| Ekspor | ExcelJS (Excel), pizzip raw-XML (template SPPBJ yang korup bila lewat ExcelJS), docx, lembar cetak `window.print` (PDF) |
| OCR | tesseract.js (scan tabel SPPBJ dari gambar) |
| Login | middleware cookie — lihat §5 |

## 2. Model data: satu tabel, banyak `kind`

Seluruh modul memakai tabel `projects` `(id, nama_kapal, tahun, payload jsonb, created_at)`.
Pembeda modul = `payload.kind`:

| kind | Modul | Bentuk |
|---|---|---|
| *(tanpa kind)* | Generator Swakelola | 1 baris = 1 pekerjaan swakelola (payload = ProjectData penuh) |
| `sppbj` / `nonpr` | SPPBJ Pengadaan / Non PR PO | 1 baris = 1 pengadaan; `items[]` per baris barang |
| `anggaran` | Dashboard Anggaran | **1 baris meta**: `{rka, plafon[], docking[], program[]}` |
| `rr` | Rencana & Realisasi (Lampiran 3) | 1 baris = 1 dokumen (tipe×bulan×kapal), `payload.docId` |
| `kerusakan` | Rekap Kerusakan Kapal | 1 baris = 1 kejadian |
| `docking_jadwal` | Monitoring Docking | 1 baris = kapal×tahun: milestone, `berkas[]` BA, `termin[]`, `persiapan[]` |
| `kelas_bki` | Survey kelas BKI | 1 baris = kapal×tahun×jenis (AS I–IV, IS, SS, DS) |
| `servis` | Monitoring Servis | 1 baris = 1 barang di bengkel |
| `kapal` | Ship Database | **1 baris meta**: `{ships[]}` |
| `material_db` | Kode Material | meta katalog |

Pola store per modul (`src/lib/<modul>/store.tsx`): localStorage dulu (offline/instan)
→ Supabase (otoritatif) → tulis balik ke localStorage; upsert per `docId`;
`catatBackup()` menulis salinan JSON ke folder backup laptop setiap simpan sukses.

## 3. Logika inti (yang tidak boleh diubah sembarangan)

### 3.1 Anggaran anti-tumpang-tindih
`jenisAnggaranOf(dok)` memutuskan tepat SATU ember: `rutin` / `docking` / `lainnya`
(eksplisit > programId > tebakan dari kategoriRekap). Semua agregasi Dashboard
(`realisasiRutin`, `realisasiDocking`, `realisasiProgram`) menyaring lewat ini,
jadi satu rupiah tak pernah terhitung dua kali.

### 3.2 Pembebanan per ITEM (SPPBJ campuran)
Satu SPPBJ boleh membebani >1 sumber: `SppbjItem.jenisAnggaran` + `programId`
per baris; kosong = ikut dokumen (data lama berperilaku persis sama — terbukti
regresi 0 atas 195 dokumen). `jenisItemOf/jenisItemRow` = satu-satunya sumber
kebenaran; fungsi agregasi menerima `saring(it)`.

### 3.3 Aturan lain yang dihormati semua modul
- `stokPersediaan` → nilai tercatat tapi TIDAK menggerus pagu (semua fungsi realisasi melewatinya).
- Item multi-kapal dibagi RATA ke kapal-kapalnya (`nilaiPerKapal`) supaya total pas.
- `hargaSpbj` (final) menang atas `harga` (estimasi) bila ada satu saja di dokumen.
- Pagu = `nilai + addendum` (`paguTotal`); docking per kapal×tahun, rutin per bulan.
- Lampiran 3: tenggat pusat terprogram (rencana ≤ tgl 22 bulan sebelum periode 2-bulanan;
  realisasi ≤ tgl 1 bulan berikutnya); dokumen terkirim = terkunci; tarik-dari-SPPBJ
  ber-anti-dobel lewat sidik jari item; panel pencocokan memakai fungsi Dashboard
  yang sama sehingga mustahil beda rumus.
- Docking: lama utama = keluar→tiba lintasan (fallback galangan/atas dock);
  termin I/II/III dipicu TERBITNYA BA (Naik Dok / Selesai Pekerjaan / Selesai Masa
  Pemeliharaan = selesai pekerjaan + 30 hari, bisa diubah per kontrak);
  checklist persiapan per kapal ("tidak perlu" keluar dari pembagi persen).
- Pengingat (lonceng): SATU kueri lintas `kind`, dihitung ulang dari data modul —
  tidak disimpan tersendiri, jadi tak bisa berselisih dengan halaman.
- Rekap rentang bulan = MENJUMLAHKAN hasil fungsi per-bulan, bukan jalur hitung baru.

### 3.4 Ekspor
- Excel berjenjang (`exportTipe.ts`): sheet per pengadaan bergaya Lampiran-2 +
  Budget Control per kapal (Persetujuan Awal / Addendum / Total / Realisasi / Sisa),
  rumus hidup SUMIFS + hyperlink antar sheet.
- Template SPPBJ resmi diisi lewat **pizzip raw-XML** — ExcelJS merusak template ini.
- Lampiran 3 Excel meniru berkas pusat (USL/REAL per kapal).

## 4. Peta folder

```
src/middleware.ts          gerbang login (semua route)
src/app/<halaman>/         dashboard, rencana, kerusakan, docking, sensor, armada,
                           kapal, sppbj(+isi/detail), nonpr, material, servis,
                           distribusi, dokumen/*, pengingat, backup, admin, login
src/app/api/auth/*         login/logout (Node runtime)
src/lib/anggaran/          types (MA, kapal, jenisItemOf), store (agregasi),
                           program.ts (pagu surat), excel*, exportTipe (+daftarBulan)
src/lib/{sppbj,nonpr,rr,docking,kerusakan,servis,kapal,material,pengingat}/
src/lib/backup/local.ts    File System Access API (lihat §6)
src/components/            Konfirmasi (dialog global), LonengPengingat, PreviewPengadaan,
                           FotoUploader, JenisBadge, Sidebar, dst.
scripts/                   restore-supabase.cjs, bundle-source.cjs (backup kodingan)
docs/                      ARSITEKTUR.md (ini), PENYUSUNAN_RKA.md, dll.
```

## 5. Keamanan

1. **Gerbang login** — `src/middleware.ts`: SEMUA route (halaman, API, file di
   `public/` termasuk `backup/source.zip`) butuh cookie `mrt_session` == env
   `AUTH_TOKEN`. Pengecualian hanya `/login`, `/api/auth/*`, aset `_next`,
   favicon, logo. `AUTH_TOKEN` kosong = semua diarahkan ke login (fail-closed).
2. **Login** — `POST /api/auth/login` mencocokkan `user:pass` dengan env
   `APP_USERS` (`user1:pass1,user2:pass2`). Cookie **httpOnly, sameSite=lax,
   7 hari**. Logout menghapus cookie.
3. **Rahasia hanya di env** (Vercel / `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AUTH_TOKEN`, `APP_USERS`, `GEMINI_API_KEY`
   (ops), kredensial rekap-sheet. `.env*` TIDAK ikut git dan TIDAK ikut ZIP
   backup kodingan (disaring `bundle-source.cjs`).
4. **Supabase** — anon key adalah kunci publik yang aksesnya dibatasi kebijakan
   Supabase; lapisan pertahanan utama aplikasi = gerbang login di depan seluruh
   halaman. Storage bucket `foto` publik-baca (foto bukti & PDF BA) — tautannya
   hanya terlihat oleh pengguna yang sudah login.
5. **Dialog & data** — aksi merusak selalu lewat dialog konfirmasi bernada
   "bahaya" (Enter tidak mengiyakan); impor data massal selalu DRY-run dulu;
   penulisan backup tak pernah menggagalkan simpan (try/catch senyap).

## 6. Backup berlapis

| Lapis | Isi | Pemicu |
|---|---|---|
| `data/<kind>/*.json` | 1 file per dokumen | otomatis tiap simpan |
| `snapshot/projects_<tgl>.json` + `TERBARU.json` | seluruh database | tombol Backup Sekarang |
| `kodingan/source_<tgl>.zip` + `MANIFEST` | **seluruh kode aplikasi** (src, docs, scripts, konfigurasi) | tombol Backup Kodingan |

Folder dipilih sekali (File System Access API, handle di IndexedDB).
Pemulihan data: menu Backup → Pulihkan, atau `scripts/restore-supabase.cjs`.
Bangun ulang aplikasi: ekstrak ZIP → `npm install` → isi `.env.local` → `npm run dev`.

## 7. Bangun ulang & operasi

- Deploy: push ke `main` → Vercel build otomatis (`prebuild` membundel source.zip).
- Uji lokal ala produksi: `npm run build` lalu `AUTH_TOKEN=uji-lokal npx next start`.
- Jangan pernah menulis rahasia ke dalam kode / repo / ZIP backup.
