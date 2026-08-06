# Isi tabel surat dari berkas

Setiap tabel di **Buat Surat E-Office** punya tombol **📄 Isi dari berkas**:
unggah Excel, CSV, PDF, atau foto/screenshot, hasil bacaannya diperiksa dulu di
layar, baru ditempel ke borang.

## Tiga jalur, dipilih otomatis dari jenis berkasnya

| Berkas | Cara dibaca | Butuh AI? |
|---|---|---|
| `.xlsx` `.xls` `.csv` | Dibaca langsung. Judul kolom berkas dicocokkan dengan kolom borang, angkanya diambil apa adanya. | **Tidak** |
| `.pdf` berteks (cetakan Excel/Word) | Lapisan teksnya diambil dengan pdf.js, lalu disusun jadi baris oleh model. | Ya |
| `.pdf` pindaian · foto · screenshot | Halaman dirender/dikecilkan jadi gambar, lalu dibaca model bervisi. | Ya |

Kalau judul kolom di Excel tidak dikenali, berkas itu tidak langsung gagal —
isinya dikirim sebagai teks ke model, dan layar memberi catatan bahwa itu yang
terjadi.

## Mesin AI: cloud dulu, lalu laptop

1. **Gemini** lewat `POST /api/surat/baca-tabel` — aktif bila `GEMINI_API_KEY`
   diisi (lihat `.env.example`). Model bawaan `gemini-2.0-flash`.
2. **Ollama di laptop** — dipakai bila kunci Gemini belum ada. Peramban
   menghubungi `127.0.0.1:11434` sendiri, jadi isi berkas tidak lewat server
   Vercel. Model terbesar yang tersedia yang dipilih; untuk teks model biasa
   didahulukan, untuk gambar wajib model bervisi (`ollama pull qwen2.5vl:7b`).
   Bila aplikasi dibuka dari domain Vercel, Ollama perlu mengizinkan asalnya —
   lihat `docs/OLLAMA.md`.

Tanpa keduanya, Excel/CSV tetap bisa dibaca; berkas lain memberi pesan jelas
bahwa belum ada mesin pembaca yang siap.

## Yang selalu terjadi sebelum ditempel

- Baris **TOTAL / SUB TOTAL / JUMLAH** dibuang — angka itu dihitung ulang oleh
  aplikasi dari baris-barisnya.
- Saat membaca daftar surat rujukan dari sebuah surat, baris yang isinya nomor
  surat dokumen itu sendiri ikut dibuang (kop surat, bukan data).
- Hasilnya tampil sebagai tabel yang bisa disunting, lengkap dengan **jumlah per
  kolom rupiah** — cara tercepat menangkap salah baca satu digit adalah
  membandingkan angka itu dengan total di berkas asalnya.
- Tersedia dua cara menempel: **Ganti isi tabel** atau **Tambah ke bawah**.

## Menambah tabel yang bisa diisi dari berkas

Tombolnya muncul sendiri di setiap isian bertipe `tabel`. Yang perlu ditulis di
template hanyalah kalimat konteks, supaya model tahu tabel apa yang dicari:

```ts
{
  id: "tabel", label: "Rincian mata anggaran", jenis: "tabel",
  bacaBerkas: "Rincian biaya docking per mata anggaran; tiap baris berisi kode 10 digit …",
  kolom: [ … ],
}
```

Isi `bacaBerkas: false` untuk mematikan tombolnya pada tabel tertentu.

## Catatan teknis

pdf.js **tidak** diimpor lewat nama paketnya. Dibundel webpack, `pdf.mjs` gagal
dimuat dengan `Object.defineProperty called on non-object`. Pustaka dan
worker-nya disalin ke `/public` saat `npm install`
(`scripts/salin-pdf-worker.cjs`) lalu dimuat sebagai modul ES asli lewat
`src/lib/pdfPeramban.ts`.
