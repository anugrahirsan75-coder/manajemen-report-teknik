# Backup & Pemulihan Data

Data aplikasi hidup di Supabase (cloud). Dokumen ini bikin **salinan paralel di laptop** supaya
kalau Supabase bermasalah, akun terkunci, atau data terhapus, semuanya masih ada.

Tiga lapis, saling menutupi:

| Lapis | Kapan jalan | Butuh apa |
|---|---|---|
| 1. Otomatis tiap simpan | setiap kali tekan Simpan di aplikasi | Chrome/Edge di laptop, folder dipilih sekali |
| 2. Snapshot penuh sekali klik | tombol **Backup Sekarang** di menu Backup | sama seperti lapis 1 |
| 3. Terjadwal tanpa buka aplikasi | Windows Task Scheduler / manual | Node.js + folder aplikasi ini |

## Lapis 1 & 2 — di dalam aplikasi

1. Buka menu **Backup**.
2. Klik **Pilih Folder Backup** → pilih folder di laptop (mis. `Documents\Backup-MRT`).
3. Selesai. Selanjutnya tiap kali menyimpan SPPBJ / Non PR PO / Servis / Anggaran / Ship Database,
   salinan JSON-nya langsung ditulis ke folder itu.

Izin folder tersimpan di browser. Kalau setelah beberapa lama statusnya jadi
"folder terputus", klik **Ganti / Sambungkan Folder** sekali lagi.

Browser selain Chrome/Edge (atau HP): pakai tombol **⬇️ Unduh 1 File**.

## Lapis 3 — terjadwal di laptop

Sekali jalan:

```bat
cd "D:\ASDP\02. PROJEK\files\generator-swakelola"
npm run backup
```

Folder tujuan default: `%USERPROFILE%\Documents\Backup-MRT`.
Mau folder lain (mis. hard disk eksternal):

```bat
node scripts/backup-supabase.cjs "E:\Backup-MRT"
```

### Pasang di Task Scheduler (jalan sendiri tiap hari)

1. Buka **Task Scheduler** → *Create Basic Task*.
2. Nama: `Backup MRT ASDP`. Trigger: *Daily*, jam mis. 17:30 (atau *When I log on*).
3. Action: *Start a program*
   - Program: `cmd.exe`
   - Arguments:
     `/c cd /d "D:\ASDP\02. PROJEK\files\generator-swakelola" && node scripts\backup-supabase.cjs "%USERPROFILE%\Documents\Backup-MRT" >> "%USERPROFILE%\Documents\Backup-MRT\log.txt" 2>&1`
4. Centang *Run whether user is logged on or not* bila mau tetap jalan walau belum login.

## Isi folder backup

```
Backup-MRT/
├─ TERBARU.json          salinan seluruh database saat backup terakhir
├─ snapshot/             arsip bertanggal, 60 file terbaru disimpan
│   └─ projects_2026-07-22_0810.json
├─ data/                 1 file per data, gampang dicari manual
│   ├─ sppbj/Kebutuhan Cat Docking KMP Baronang__6f2a91c3.json
│   ├─ nonpr/ · servis/ · anggaran/ · kapal/ · swakelola/
└─ berkas/               foto dokumentasi & file inventaris kapal dari Storage
```

## Memulihkan data

Selalu **uji coba dulu** (tidak menulis apa pun):

```bat
npm run restore -- "%USERPROFILE%\Documents\Backup-MRT\TERBARU.json"
```

Kalau ringkasannya sudah benar, baru tulis sungguhan:

```bat
npm run restore -- "%USERPROFILE%\Documents\Backup-MRT\TERBARU.json" --tulis
```

Batasi ke satu jenis saja:

```bat
npm run restore -- "...\TERBARU.json" --tulis --hanya=sppbj
```

Sifat pemulihan:

- **upsert berdasarkan id** — data yang masih ada ditimpa versi backup, yang hilang dibuat lagi.
- **tidak pernah menghapus** — data yang ada di server tapi tak ada di backup dibiarkan.
- Foto/inventaris di `berkas/` tidak ikut diunggah ulang otomatis; unggah manual lewat aplikasi bila perlu.

## Yang perlu diingat

- Backup lapis 1 hanya menangkap input yang dilakukan **dari laptop ini**. Input dari HP tersalin
  saat berikutnya membuka aplikasi di laptop lalu menekan **Backup Sekarang**, atau lewat lapis 3.
- Simpan sesekali salinan folder `Backup-MRT` ke hard disk eksternal / Google Drive. Backup di satu
  laptop saja masih satu titik kegagalan.
- File backup memuat seluruh isi database. Perlakukan seperti dokumen internal kantor.
