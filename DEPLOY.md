# Panduan Deploy ke Internet — Manajemen Report Teknik ASDP Ternate

App: Next.js 14 (App Router) + Supabase. Hosting disarankan **Vercel** (gratis, native Next.js) + **Supabase** (gratis: DB 500 MB, Storage 1 GB, egress 5 GB/bln).

---

## 0. Yang jalan & tidak di cloud

| Fitur | Lokal (PC) | Online (Vercel) |
|---|---|---|
| Generate Word / Excel | ✅ | ✅ |
| Generate **PDF (MS Office COM)** | ✅ | ❌ — **LOKAL ONLY**. Server cloud tak punya MS Office. Set `DISABLE_OFFICE_PDF=1` (server) + `NEXT_PUBLIC_ENABLE_PDF=false` (sembunyikan tombol). Excel native tetap jalan → user buka Excel lalu **Save As PDF** manual |
| Supabase (data) | ✅ | ✅ |
| Cek Kode Material (sync Google Sheet) | ✅ | ✅ |
| Login akun + password | ✅ | ✅ |
| Auto-start / watchdog | dipakai | tak perlu (Vercel selalu on) |

---

## 1. Push ke GitHub

```bash
cd "D:/ASDP/02. PROJEK/files/generator-swakelola"
git remote add origin https://github.com/<username>/manajemen-report-teknik.git
git branch -M main
git push -u origin main
```

`.env.local` TIDAK ikut (gitignore). Kredensial diisi di Vercel.

---

## 2. Import ke Vercel + Environment Variables

1. https://vercel.com/new → pilih repo. Framework **Next.js** auto-detect.
2. Settings → Environment Variables, isi SEMUA:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://odsjeazutvwrowbhmpkg.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_kYKdkGi6nJ8R92aZY4fe_Q_ntC0xT2a` |
| `DISABLE_OFFICE_PDF` | `1` |
| `NEXT_PUBLIC_ENABLE_PDF` | `false` |
| `APP_USERS` | `admin:GANTIPASSWORD,teknik:GANTIPASSWORD` |
| `AUTH_TOKEN` | string acak panjang (mis. hasil `openssl rand -hex 24`) |
| `MATERIAL_DB_CSV_URL` | (opsional) override URL CSV DB material |

3. **Deploy** → dapat URL `https://<project>.vercel.app`. Tiap `git push main` → auto-redeploy.

---

## 3. Login akun & password (sudah terpasang)

- Middleware `src/middleware.ts` mengunci semua halaman kecuali `/login` & `/api/auth/*`.
- Akun via env **`APP_USERS`** format `user:password` dipisah koma. Contoh: `admin:asdp2026,teknik:teknik2026`.
- **`AUTH_TOKEN`** = token sesi rahasia. WAJIB diisi; kalau kosong semua diarahkan ke `/login` (aman, bukan bypass).
- Tambah/ubah/hapus akun atau ganti password = ubah `APP_USERS` di Vercel → redeploy.
- Logout = tombol **Keluar** di sidebar bawah.
- Cookie sesi httpOnly, berlaku 7 hari.

> Untuk multi-user dengan reset password mandiri → nanti bisa upgrade ke Supabase Auth.

---

## 4. Foto: pindah ke Supabase Storage (HEMAT — disarankan sebelum produksi)

**Masalah sekarang:** foto disimpan base64 di kolom `payload` (DB). 1 row swakelola bisa 1,65 MB. Boros DB (limit 500 MB) + boros egress (foto ikut ter-load tiap buka list).

**Solusi:** simpan file di **Storage bucket** (1 GB, terpisah dari DB), DB cukup simpan URL.
- Binary (bukan base64) → **−33% ukuran**, disajikan via CDN → list ringan.
- DB tinggal teks → aman puluhan tahun.

Setup bucket (sekali): Supabase → Storage → New bucket `foto` (Public) → policy izinkan insert/select.

Proyeksi: foto base64-di-DB → DB free penuh ~2,5–3 tahun. Setelah migrasi ke Storage → DB puluhan tahun, bucket ~9 tahun.

> Migrasi kode (upload ke bucket + simpan URL) BELUM diterapkan. App tetap jalan pakai base64 dulu. Minta dikerjakan kalau mau deploy serius.

---

## 5. Catatan

- Template (`templates/**`) ikut ke serverless function via `outputFileTracingIncludes` (`next.config.mjs`). Jangan hapus folder `templates/`.
- Supabase publishable/anon key aman publik (dilindungi RLS).
- DB material (Cek Kode Material) auto-sync dari Google Sheet via endpoint **gviz** (`gviz/tq?tqx=out:csv`). Pastikan sheet tetap dibagikan "Anyone with link → Viewer". (endpoint `export?format=csv` lama bisa 400 kalau gid berubah → gviz lebih tahan.)
- Supabase free auto-pause ~1 minggu idle. Produksi rutin → Pro ($25/bln, 8 GB DB / 100 GB storage / no pause).

---

## 6. Checklist

- [ ] `git push` ke GitHub (tanpa `.env.local`)
- [ ] Import ke Vercel + isi semua Environment Variables
- [ ] Set `DISABLE_OFFICE_PDF=1`, `NEXT_PUBLIC_ENABLE_PDF=false`, `APP_USERS`, `AUTH_TOKEN`
- [ ] Deploy → buka URL → login
- [ ] (Disarankan) buat bucket `foto` + minta migrasi foto ke Storage
- [ ] Test: Excel jalan, tombol PDF tak muncul, login jalan, data Supabase muncul
