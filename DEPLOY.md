# Deploy ke Vercel (GitHub)

## Yang jalan di Vercel
- ✅ Generate **Word** (SPK) & **Excel** (02–08) — format + logo persis template.
- ✅ Supabase (simpan/muat data).
- ✅ OCR (tesseract, jalan di browser) & upload foto.
- ❌ Generate **PDF** — butuh MS Office (Windows), tidak ada di Vercel. Tombol PDF otomatis disembunyikan online. Untuk PDF: download Word/Excel lalu "Save As PDF", atau jalankan app di PC ber-Office (`npm run dev`).

## Langkah

### 1. Push ke GitHub
Buat repo kosong di https://github.com/new (mis. `generator-swakelola`), JANGAN centang "Add README". Lalu di folder project:

```bash
git remote add origin https://github.com/<username>/generator-swakelola.git
git branch -M main
git push -u origin main
```

### 2. Import ke Vercel
1. https://vercel.com/new → pilih repo `generator-swakelola`.
2. Framework: **Next.js** (auto-detect). Build & output default.
3. **Environment Variables** (Settings → Environment Variables), isi:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://odsjeazutvwrowbhmpkg.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_kYKdkGi6nJ8R92aZY4fe_Q_ntC0xT2a` |
| `NEXT_PUBLIC_ENABLE_PDF` | `false` |
| `DISABLE_OFFICE_PDF` | `1` |

4. **Deploy**. Selesai → dapat URL `https://<project>.vercel.app`.

### 3. Update berikutnya
Tiap `git push` ke `main` → Vercel auto-deploy.

## Catatan
- File template (`templates/*.docx`, `*.xlsx`, `logo_asdp.png`) ikut ke serverless function via `outputFileTracingIncludes` di `next.config.mjs`. Jangan hapus folder `templates/`.
- `.env.local` tidak ikut ke Git (gitignore) — set kredensial via Environment Variables Vercel.
- Supabase publishable key memang aman publik (dilindungi RLS).
