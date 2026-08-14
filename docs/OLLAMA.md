# Pemindaian dokumen dengan AI lokal (Ollama)

Dokumen kapal (Repair List, permintaan pengadaan) datang sebagai hasil pindai
CamScanner — tak ada lapisan teksnya, jadi harus "dilihat" oleh model AI.
Ollama menjalankan model itu **di laptop sendiri**: isi dokumennya tidak pernah
keluar ke internet.

## Dua jalur, satu Ollama

| Aplikasi dibuka dari | Yang menghubungi Ollama | Perlu diatur |
|---|---|---|
| `localhost` (dijalankan di laptop) | server Next.js di laptop | tidak ada |
| Vercel (`https://…vercel.app`) | **peramban** di laptop | `OLLAMA_ORIGINS` |

Yang perlu ditegaskan pada jalur Vercel: server Vercel **tidak** menyentuh
gambarnya. Yang mengirim ke `127.0.0.1:11434` adalah tab peramban yang sedang
terbuka di laptop itu. Halaman datang dari internet, datanya tidak ke mana-mana.

## Sekali pasang

### 1. Model vision

```
ollama pull qwen2.5vl:7b
```

Aplikasi memilih sendiri model bervisi yang ada (`qwen2.5vl`, `llava`,
`minicpm-v`, `llama3.2-vision`, `gemma3`, …). Laptop dengan VRAM kecil bisa
memakai `qwen2.5vl:3b`.

### 2. Izinkan asal situsnya (hanya untuk jalur Vercel)

Bawaan Ollama cuma melayani `localhost`; permintaan dari alamat lain dijawab
**403 Forbidden**. Beri tahu Ollama satu alamat yang boleh — jangan `*`, karena
itu berarti situs mana pun yang sedang dibuka boleh memakai Ollama di laptop.

PowerShell (sekali saja, tersimpan di akun pengguna):

```
setx OLLAMA_ORIGINS "https://NAMA-PROJECT.vercel.app"
```

Lalu **keluar dari Ollama** (ikon di baki sistem → Quit) dan jalankan lagi,
supaya nilai barunya terbaca.

Memeriksa berhasil atau belum:

```
curl -i -X OPTIONS http://127.0.0.1:11434/api/generate -H "Origin: https://NAMA-PROJECT.vercel.app" -H "Access-Control-Request-Method: POST"
```

Berhasil bila muncul `Access-Control-Allow-Origin`. Kalau masih `403`, Ollama
belum dijalankan ulang.

### 3. Izin jaringan lokal di peramban

Chrome versi baru meminta izin saat halaman dari internet menghubungi alamat di
jaringan sendiri. Muncul sekali, pilih **Allow / Izinkan**.

## Kalau tetap tak mau

Urutan pemeriksaan:

1. Ollama hidup? `curl http://127.0.0.1:11434/api/tags`
2. Ada model bervisi? Nama modelnya harus mengandung `vl`, `vision`, `llava`,
   `minicpm-v`, atau `gemma3`.
3. `OLLAMA_ORIGINS` sudah diisi **dan** Ollama sudah dijalankan ulang?
4. Peramban sudah diberi izin jaringan lokal?

Selalu ada jalan mundur yang tak butuh apa-apa: pilih **OCR lokal** pada pemilih
mesin pembaca. Lebih rendah ketelitiannya untuk tabel padat, tapi jalan tanpa
model dan tanpa internet.

## Alamat Ollama yang lain

Bila Ollama dijalankan di mesin lain (mis. komputer kantor yang selalu hidup),
alamatnya bisa diganti dari peramban:

```js
localStorage.setItem("ollama_host", "http://192.168.1.10:11434")
```

Mesin itu perlu `OLLAMA_HOST=0.0.0.0` supaya mau menerima dari luar dirinya —
dan sadari konsekuensinya: dokumen berpindah lewat jaringan kantor.

---

# Juru Baca — permintaan kapal terbaca sendiri

Membaca satu lembar borang tulisan tangan dengan model lokal memakan satu
sampai tiga menit. Selama hasilnya tidak disimpan, ongkos itu dibayar ULANG
tiap kali orang membuka kiriman yang sama — dan hanya bisa dibayar di laptop
yang punya Ollama. Maka pembacaannya dipindahkan ke latar belakang, dan
hasilnya disimpan.

## Cara kerjanya

1. Aplikasi dibuka **dari laptop yang menjalankan Ollama** (lewat
   `http://localhost:3001`). Juru Baca menyala sendiri di halaman mana pun —
   tak perlu membuka halaman permintaan lebih dulu.
2. Ia mengambil daftar kiriman ABK, mencari berkas permintaan yang belum punya
   hasil bacaan, lalu membacanya **satu per satu** (bukan berbarengan: AI lokal
   memakai seluruh inti prosesor, membaca dua berkas sekaligus membuat keduanya
   lambat).
3. Tiap hasil disimpan ke Supabase sebagai `payload.kind = "bacaan-berkas"`,
   satu baris per BERKAS.
4. Perangkat lain — ponsel, atau aplikasi yang dibuka dari Vercel — membuka
   **Isi Permintaan Kapal** dan langsung melihat isinya. Tanpa AI sama sekali.

Pil kecil di pojok kanan bawah menunjukkan berkas yang sedang dibaca dan berapa
yang masih mengantre. Tombol ✕ pada pil menjedanya sampai halaman dimuat ulang.

## Tiga hal yang dijaga

| Hal | Cara |
|---|---|
| Satu berkas tidak dibaca dua laptop | Klaim ditulis ke basis data **sebelum** berkas diambil; klaim yang menggantung lebih dari 15 menit dianggap batal |
| Koreksi orang tidak tertimpa | Bacaan yang disunting di layar ditandai `disunting` dan tak pernah dibaca ulang otomatis |
| Laptop baru menyala tidak tenggelam | Maksimal 20 berkas per putaran, terbaru dulu; sisanya di putaran berikutnya (tiap 3 menit) |

## Kenapa harus localhost, bukan Vercel

Peramban melarang halaman **https** memanggil alamat **http** — dan Ollama
melayani http. Dari `localhost`, yang menghubungi Ollama adalah server Next.js
di laptop itu sendiri, jadi larangan tersebut tidak berlaku sama sekali.

Pintasan sekali klik: `buka-aplikasi.vbs` — menyalakan server bila belum
menyala, menunggu siap, lalu membuka halaman Isi Permintaan Kapal.

## Membaca ulang semua berkas

Bila mesin bacanya diperbaiki dan seluruh berkas layak dibaca ulang, naikkan
`VERSI_BACAAN` di `src/lib/lapor/simpananBacaan.ts`. Bacaan berversi lama tetap
tampil — hanya diantre ulang di belakang, jadi tak ada layar yang mendadak
kosong.
