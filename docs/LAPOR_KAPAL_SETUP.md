# Permintaan & Laporan Kapal — cara mengaktifkan

Fitur ini punya dua sisi:

| Halaman | Alamat | Siapa |
|---|---|---|
| Kirim berkas | `/lapor` | ABK kapal — **tanpa login** |
| Lihat & tindak lanjut | `/permintaan-laporan` | orang kantor (menu kiri) |

Berkas **tidak** disimpan di Supabase, melainkan di Google Drive pemilik.
Supabase hanya menyimpan catatan kecil (kapal, jenis, periode, pengirim,
tautan Drive), jadi kuota penyimpanan tidak ikut terpakai berapa pun banyaknya
berkas yang masuk.

```
ABK  →  /lapor  →  API  →  Apps Script  →  folder Google Drive
                     └──→  Supabase (catatan + tautan saja)
```

## Langkah pemasangan (sekali saja)

1. Buka <https://script.google.com> → **New project**.
2. Tempel seluruh isi [`lapor-apps-script.gs`](lapor-apps-script.gs) ke `Code.gs`.
3. Ganti `SECRET` dengan teks acak bebas. `ROOT_FOLDER_ID` sudah diisi dengan
   folder Drive yang dipakai sekarang — ganti kalau foldernya pindah.
4. Jalankan sekali dari editor supaya Google meminta izin akses Drive, lalu
   setujui.
5. **Deploy → New deployment → Web app**
   - *Execute as*: **Me** (pemilik Drive)
   - *Who has access*: **Anyone with the link**
6. Salin URL `/exec`, lalu isi dua env di server (lokal `.env.local`, dan di
   Vercel → Settings → Environment Variables):

   ```
   LAPOR_GAS_URL=https://script.google.com/macros/s/…/exec
   LAPOR_GAS_SECRET=teks acak yang sama dengan SECRET
   ```

7. Deploy ulang aplikasi, buka `/permintaan-laporan`, tekan **Salin tautan
   untuk ABK**, lalu sebarkan tautannya ke kapal.

Sebelum env terisi, halaman `/lapor` tetap terbuka tapi unggahan ditolak dengan
pesan "Penyimpanan berkas belum aktif" — bukan gagal diam-diam.

## Susunan folder di Drive

```
<folder utama>/
  KMP. TUNA/
    Laporan Mesin/
      2026-08 - Laporan Mesin - KMP. TUNA - laporan bulanan - 20260804-131500.pdf
    Permintaan Deck/
  KMP. BARONANG/
```

Nama berkas dibuat berurutan sendiri (periode → jenis → kapal → waktu kirim)
supaya isi folder tetap terbaca walau dibuka langsung dari Drive.

## Yang perlu diketahui

- **"Anyone with the link" pada Apps Script** hanya berarti URL-nya bisa
  dipanggil siapa saja. Tanpa `SECRET` yang cocok, permintaan ditolak dan tidak
  ada berkas yang masuk.
- Berkas di Drive **tetap milik pribadi** pemilik akun. Ubah `BAGIKAN_LINK`
  jadi `true` di Apps Script kalau berkas mau bisa dibuka siapa pun yang punya
  tautan.
- Menghapus kiriman dari aplikasi **tidak** menghapus berkas di Drive —
  disengaja, supaya salah pencet tidak menghilangkan dokumen asli kapal.
- Tombol **Hapus** pada satu dokumen memindahkan dokumen tersebut ke Sampah
  Google Drive dan menghapus tautannya dari rekap. Penghapusan dibatasi hanya
  untuk dokumen yang berada di bawah `ROOT_FOLDER_ID`.
- Batas: 12 berkas per kiriman, **35 MB per berkas**, dan 15 kiriman per 10 menit
  dari satu alamat IP. Angka 35 MB ini terikat pada `BATAS_MB` di Apps Script —
  ubah keduanya bersamaan kalau mau digeser. Foto dikecilkan otomatis di HP pengirim (sisi lebar
  maks 1600 px) supaya hemat kuota kapal.
- Konfirmasi ABK diarahkan ke WhatsApp kantor (+62 819-9489-2686) dengan pesan
  yang sudah terisi otomatis. Nomornya diatur di `src/lib/lapor/types.ts`
  (`WA_KONFIRMASI`).

> Setelah memperbarui `docs/lapor-apps-script.gs`, pilih **Deploy → Manage
> deployments → Edit → New version → Deploy**. URL `/exec` tetap sama, tetapi
> versi baru wajib diterbitkan agar tombol hapus dokumen dapat bekerja.

## Kalau ABK melapor "gagal kirim"

Urutan pemeriksaan, dari yang paling sering:

1. **Apps Script masih versi lama.** Berkas kecil masuk, berkas besar ditolak.
   Buka `/exec` di peramban: jawabannya harus memuat `"versi":3`. Kalau tidak,
   terbitkan versi baru (Deploy → Kelola deployment → pensil → Versi baru).
2. **Lihat kirimannya di menu Permintaan & Laporan Kapal.** Kiriman yang
   berkasnya tidak sampai ditandai "⚠ belum ada berkas", dan sebab kegagalan
   terakhir yang dilaporkan ponsel ikut tercatat di panel rinciannya.
3. **Sinyal kapal.** Unggahan sekarang melanjutkan dari potongan terakhir yang
   sudah sampai, jadi ABK cukup menekan "Coba lagi" — berkas tidak diulang dari
   awal, dan isian borang tidak perlu diketik ulang.
4. **Jenis berkas.** PDF, foto (termasuk HEIC iPhone), Word, Excel, CSV.
   Jenisnya ditentukan dari ekstensi nama berkas, jadi berkas yang jenisnya
   tidak dikenali ponsel tetap diterima selama namanya berakhiran benar.

## Mengunci basis data (disarankan, butuh tindakan pemilik)

Kunci `NEXT_PUBLIC_SUPABASE_ANON_KEY` ikut terkirim ke setiap peramban yang
membuka aplikasi — memang begitu sifatnya. Selama kebijakan RLS tabel
`projects` masih mengizinkan `anon` membaca dan menulis apa saja, kunci itu
sama dengan akses penuh ke seluruh data cabang: gerbang login bisa dilewati
dengan memanggil REST Supabase langsung.

Route Lapor Kapal sudah siap dipindahkan ke kunci server. Langkahnya:

1. Supabase → Project Settings → API → salin **service_role key**.
2. Isi env di Vercel (dan `.env.local`) — **tanpa awalan NEXT_PUBLIC**:

   ```
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   ```

3. Supabase → SQL editor, jalankan:

   ```sql
   alter table projects enable row level security;
   drop policy if exists "anon full access" on projects;
   -- tidak ada policy untuk anon = anon tidak bisa apa-apa;
   -- service_role melewati RLS, jadi aplikasi tetap jalan.
   ```

4. Redeploy, lalu periksa: halaman aplikasi tetap normal, sedangkan memanggil
   `https://<proyek>.supabase.co/rest/v1/projects?select=*` dengan kunci anon
   harus mengembalikan daftar kosong.

Selama env itu belum diisi, aplikasi tetap berjalan seperti sebelumnya memakai
kunci anon — tidak ada yang rusak, hanya belum terkunci.
